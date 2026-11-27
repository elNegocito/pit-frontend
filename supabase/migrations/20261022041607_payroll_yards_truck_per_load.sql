-- ASG Operations / PIT #2
-- Migration 009: payroll changes requested by the client.
--
--   * Truck # per load: a load may be hauled with another truck (the usual
--     one broke). Stored in each load ({"truck": "2157", ...}); the sheet's
--     truck_number stays as the driver's main truck.
--   * Mixer drivers are not paid by revenue %: they get an "extra per yard"
--     ($0.25 by default) times the total yards hauled. Each load carries
--     {"yards": 10}; the trigger sums them and adds yards_pay to total_pay.
--   * "trucking" is labelled "Aggregate" in the app (label only, the key
--     stays 'trucking').
--
-- Additive: existing sheets keep their values (new columns default to 0 /
-- NULL = no per-yard pay).

ALTER TABLE public.pay_sheets
  ADD COLUMN per_yard_rate numeric(8, 2) CHECK (per_yard_rate IS NULL OR per_yard_rate >= 0),
  ADD COLUMN total_yards numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN yards_pay numeric(12, 2) NOT NULL DEFAULT 0;

-- Same as 008 + yards (mirrored in lib/payroll/compute.ts).
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
    COALESCE(sum(COALESCE((l->>'yards')::numeric, 0)), 0),
    min(NULLIF(l->>'date', '')::date),
    max(NULLIF(l->>'date', '')::date)
  INTO NEW.loads_count, NEW.total_revenue, NEW.total_yards, NEW.period_start, NEW.period_end
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
  NEW.yards_pay := COALESCE(round(NEW.total_yards * NEW.per_yard_rate, 2), 0);
  IF NEW.ot_rate IS NULL THEN
    NEW.regular_pay := round(hrs * NEW.hourly_rate, 2);
    NEW.ot_pay := 0;
  ELSE
    NEW.regular_pay := round(LEAST(hrs, NEW.ot_threshold) * NEW.hourly_rate, 2);
    NEW.ot_pay := round(GREATEST(hrs - NEW.ot_threshold, 0) * NEW.ot_rate, 2);
  END IF;
  NEW.total_pay := NEW.loads_pay + NEW.yards_pay + NEW.regular_pay + NEW.ot_pay + NEW.adjustments_total;

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

-- Same as 008 + per_yard_rate / total_yards in the tracked fields.
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
    'hourly_rate', 'ot_rate', 'ot_threshold', 'per_yard_rate', 'loads', 'hours',
    'adjustments', 'total_revenue', 'total_yards', 'total_hours',
    'adjustments_total', 'total_pay'
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
