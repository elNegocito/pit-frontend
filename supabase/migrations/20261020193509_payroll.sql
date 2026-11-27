-- ASG Operations / PIT #2
-- Migration 008: driver payroll (weekly pay sheets).
--
-- Ported from the client's Excel "PAYROLL MODELOS" (one sheet per driver,
-- same template copied week after week). Three pay models:
--   flatbed  : 35% of load revenue + $20/h
--   mixer    : 30% of load revenue + $28/h, overtime $42/h over 40 h
--   trucking : 32% of load revenue + $20/h
-- plus per-week extras (safety meeting, bonuses, payroll error...) and
-- deductions.
--
-- Additive only: tickets / catalogs are untouched. The only change to an
-- existing object is the profiles.role CHECK, which now also accepts
-- 'payroll' (the people who prepare driver pay; there are two of them and
-- every sheet records who created / last edited it).
--
--   * drivers           : driver registry (name, pay model, truck, contact).
--   * pay_sheets        : one row per driver per pay date. Loads, hours and
--                         adjustments are stored as JSON (a pay sheet is a
--                         document); rates are snapshotted per sheet and the
--                         totals are computed + frozen by a trigger.
--   * pay_sheet_events  : audit trail (create / edit / void) with who and
--                         what changed, written only by trigger.

-- ---------------------------------------------------------------- profiles
ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'operator', 'payroll'));

-- Admin or payroll user: both may read / write payroll data.
CREATE OR REPLACE FUNCTION public.is_payroll()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'payroll')
  );
$$;

-- Name shown as "Prepared by" / in the history: display_name, else the
-- email's local part. Snapshotted so payroll users never need to read
-- other users' profiles.
CREATE OR REPLACE FUNCTION public.current_user_label()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT p.display_name FROM public.profiles p WHERE p.id = auth.uid()),
    (SELECT split_part(u.email, '@', 1) FROM auth.users u WHERE u.id = auth.uid()),
    'system'
  );
$$;

-- ---------------------------------------------------------------- drivers
CREATE TABLE public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  name_key text NOT NULL GENERATED ALWAYS AS (
    upper(regexp_replace(trim(name), '\s+', ' ', 'g'))
  ) STORED UNIQUE,
  pay_model text NOT NULL CHECK (pay_model IN ('flatbed', 'mixer', 'trucking')),
  truck_number text CHECK (truck_number IS NULL OR char_length(trim(truck_number)) BETWEEN 1 AND 40),
  -- Contact used by "Send" (WhatsApp / email). Free text, validated in the app.
  phone text CHECK (phone IS NULL OR char_length(phone) <= 30),
  email text CHECK (email IS NULL OR char_length(email) <= 120),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER drivers_touch_updated_at
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------- pay_sheets
CREATE TABLE public.pay_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Human reference printed on the sheet ("Sheet #1042").
  sheet_number bigint GENERATED ALWAYS AS IDENTITY (START WITH 1001) UNIQUE,
  driver_id uuid NOT NULL REFERENCES public.drivers (id) ON DELETE RESTRICT,
  -- Snapshots: renaming a driver or moving them to another truck never
  -- rewrites past sheets.
  driver_name text NOT NULL,
  truck_number text,
  pay_model text NOT NULL CHECK (pay_model IN ('flatbed', 'mixer', 'trucking')),
  pay_date date NOT NULL,
  notes text CHECK (notes IS NULL OR char_length(notes) <= 1000),

  -- Rates frozen on the sheet (defaults come from the pay model in the app).
  revenue_pct numeric(5, 2) NOT NULL CHECK (revenue_pct BETWEEN 0 AND 100),
  hourly_rate numeric(8, 2) NOT NULL CHECK (hourly_rate >= 0),
  -- NULL = no overtime (all hours at hourly_rate).
  ot_rate numeric(8, 2) CHECK (ot_rate IS NULL OR ot_rate >= 0),
  ot_threshold numeric(5, 2) NOT NULL DEFAULT 40 CHECK (ot_threshold >= 0),

  -- [{ "date": "2026-05-26", "revenue": 347, "load_number": "270369",
  --    "company": "TPG", "extra": "3" }, ...]   extra = zone / tons / yards
  loads jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(loads) = 'array'),
  -- [{ "day": "MON", "hours": 8, "note": "" }, ...]
  hours jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(hours) = 'array'),
  -- [{ "label": "SAFETY MEETING PAY", "amount": 0, "deduction": false }, ...]
  adjustments jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(adjustments) = 'array'),

  -- Computed + frozen by pay_sheets_compute_biu (any client value is overwritten).
  loads_count integer NOT NULL DEFAULT 0,
  total_revenue numeric(12, 2) NOT NULL DEFAULT 0,
  loads_pay numeric(12, 2) NOT NULL DEFAULT 0,
  total_hours numeric(8, 2) NOT NULL DEFAULT 0,
  regular_pay numeric(12, 2) NOT NULL DEFAULT 0,
  ot_pay numeric(12, 2) NOT NULL DEFAULT 0,
  adjustments_total numeric(12, 2) NOT NULL DEFAULT 0,
  total_pay numeric(12, 2) NOT NULL DEFAULT 0,
  -- First / last load date: lets "who worked on day X" find the sheet.
  period_start date,
  period_end date,

  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'void')),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_by_name text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  edit_count integer NOT NULL DEFAULT 0
);
CREATE INDEX pay_sheets_driver_idx ON public.pay_sheets (driver_id, pay_date DESC);
CREATE INDEX pay_sheets_pay_date_idx ON public.pay_sheets (pay_date DESC);
CREATE INDEX pay_sheets_period_idx ON public.pay_sheets (period_start, period_end);

-- Totals: single source of truth (mirrored in lib/payroll/compute.ts for the
-- live preview). Hours pay: without overtime every hour is paid at
-- hourly_rate; with overtime, hours up to ot_threshold at hourly_rate and the
-- rest at ot_rate. Deductions subtract.
CREATE OR REPLACE FUNCTION public.compute_pay_sheet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hrs numeric;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'void' THEN
    RAISE EXCEPTION 'pay sheet % is void and cannot be changed', OLD.sheet_number;
  END IF;

  SELECT
    count(*),
    COALESCE(sum(COALESCE((l->>'revenue')::numeric, 0)), 0),
    min(NULLIF(l->>'date', '')::date),
    max(NULLIF(l->>'date', '')::date)
  INTO NEW.loads_count, NEW.total_revenue, NEW.period_start, NEW.period_end
  FROM jsonb_array_elements(NEW.loads) AS l;

  SELECT COALESCE(sum(COALESCE((h->>'hours')::numeric, 0)), 0)
  INTO hrs
  FROM jsonb_array_elements(NEW.hours) AS h;
  NEW.total_hours := hrs;

  SELECT COALESCE(sum(
    CASE WHEN (a->>'deduction')::boolean THEN -1 ELSE 1 END
    * COALESCE((a->>'amount')::numeric, 0)
  ), 0)
  INTO NEW.adjustments_total
  FROM jsonb_array_elements(NEW.adjustments) AS a;

  NEW.loads_pay := round(NEW.total_revenue * NEW.revenue_pct / 100, 2);
  IF NEW.ot_rate IS NULL THEN
    NEW.regular_pay := round(hrs * NEW.hourly_rate, 2);
    NEW.ot_pay := 0;
  ELSE
    NEW.regular_pay := round(LEAST(hrs, NEW.ot_threshold) * NEW.hourly_rate, 2);
    NEW.ot_pay := round(GREATEST(hrs - NEW.ot_threshold, 0) * NEW.ot_rate, 2);
  END IF;
  NEW.total_pay := NEW.loads_pay + NEW.regular_pay + NEW.ot_pay + NEW.adjustments_total;

  -- Who: always the session user, never a client-supplied value.
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.created_by_name := public.current_user_label();
    NEW.created_at := now();
    NEW.edit_count := 0;
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.created_by_name := OLD.created_by_name;
    NEW.created_at := OLD.created_at;
    -- A void is not an edit.
    NEW.edit_count := OLD.edit_count + CASE WHEN NEW.status = OLD.status THEN 1 ELSE 0 END;
  END IF;
  NEW.updated_by := auth.uid();
  NEW.updated_by_name := public.current_user_label();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER pay_sheets_compute_biu
  BEFORE INSERT OR UPDATE ON public.pay_sheets
  FOR EACH ROW EXECUTE FUNCTION public.compute_pay_sheet();

-- ---------------------------------------------------------------- pay_sheet_events
CREATE TABLE public.pay_sheet_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id uuid NOT NULL REFERENCES public.pay_sheets (id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('create', 'edit', 'void')),
  -- { "<field>": { "from": ..., "to": ... } }. loads / hours / adjustments
  -- carry the full before/after arrays so the app can show row-level diffs.
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pay_sheet_events_sheet_idx ON public.pay_sheet_events (sheet_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.track_pay_sheet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  diff jsonb := '{}'::jsonb;
  f text;
  o jsonb;
  n jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.pay_sheet_events (sheet_id, action, changes, actor, actor_name)
    VALUES (NEW.id, 'create',
            jsonb_build_object('total_pay', jsonb_build_object('from', NULL, 'to', NEW.total_pay)),
            auth.uid(), public.current_user_label());
    RETURN NEW;
  END IF;

  o := to_jsonb(OLD);
  n := to_jsonb(NEW);
  FOREACH f IN ARRAY ARRAY[
    'driver_name', 'truck_number', 'pay_date', 'notes', 'revenue_pct',
    'hourly_rate', 'ot_rate', 'ot_threshold', 'loads', 'hours', 'adjustments',
    'total_revenue', 'total_hours', 'adjustments_total', 'total_pay'
  ] LOOP
    IF o->f IS DISTINCT FROM n->f THEN
      diff := diff || jsonb_build_object(f, jsonb_build_object('from', o->f, 'to', n->f));
    END IF;
  END LOOP;

  IF NEW.status = 'void' AND OLD.status <> 'void' THEN
    INSERT INTO public.pay_sheet_events (sheet_id, action, changes, actor, actor_name)
    VALUES (NEW.id, 'void', diff, auth.uid(), public.current_user_label());
  ELSIF diff <> '{}'::jsonb THEN
    INSERT INTO public.pay_sheet_events (sheet_id, action, changes, actor, actor_name)
    VALUES (NEW.id, 'edit', diff, auth.uid(), public.current_user_label());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER pay_sheets_track_aiu
  AFTER INSERT OR UPDATE ON public.pay_sheets
  FOR EACH ROW EXECUTE FUNCTION public.track_pay_sheet();

-- ---------------------------------------------------------------- RLS
-- Payroll data is visible only to admin + payroll users (never the operator).
-- Sheets are voided, not deleted; DELETE stays admin-only.
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pay_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pay_sheet_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY drivers_payroll_select ON public.drivers
  FOR SELECT TO authenticated USING (public.is_payroll());
CREATE POLICY drivers_payroll_insert ON public.drivers
  FOR INSERT TO authenticated WITH CHECK (public.is_payroll());
CREATE POLICY drivers_payroll_update ON public.drivers
  FOR UPDATE TO authenticated USING (public.is_payroll()) WITH CHECK (public.is_payroll());
CREATE POLICY drivers_admin_delete ON public.drivers
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY pay_sheets_payroll_select ON public.pay_sheets
  FOR SELECT TO authenticated USING (public.is_payroll());
CREATE POLICY pay_sheets_payroll_insert ON public.pay_sheets
  FOR INSERT TO authenticated WITH CHECK (public.is_payroll());
CREATE POLICY pay_sheets_payroll_update ON public.pay_sheets
  FOR UPDATE TO authenticated USING (public.is_payroll()) WITH CHECK (public.is_payroll());
CREATE POLICY pay_sheets_admin_delete ON public.pay_sheets
  FOR DELETE TO authenticated USING (public.is_admin());

-- History is written only by the trigger (SECURITY DEFINER).
CREATE POLICY pay_sheet_events_payroll_select ON public.pay_sheet_events
  FOR SELECT TO authenticated USING (public.is_payroll());
