-- ASG Operations / PIT #2
-- Migration 006: printable tickets.
--
-- Additive only: existing orders keep their data, new columns are nullable or
-- defaulted. Adds:
--   * trucks      : fixed truck registry with its GROSS weight (tons). Ported
--                   from the client's Excel "BASE" sheet: the ticket shows
--                   Gross = truck gross, Net = tons loaded, Tare = Gross - Net.
--   * job_orders  : company project codes (e.g. 11-911-AMRIZE-OPEN). One per
--                   customer at most; printed on the ticket as "Order".
--                   (Named job_orders because public.orders already holds
--                   the tickets.)
--   * orders      : snapshots printed on the ticket (order code, truck gross,
--                   weighmaster), optional PO/Job numbers, void status and
--                   edit tracking. Ticket numbers are now system-generated.
--   * ticket_events: change history of operator edits/voids (admin-only read).
--   * operator may UPDATE (edit / void) today's tickets. DELETE stays admin.

-- ---------------------------------------------------------------- profiles
-- Name printed as "Weighmaster" on the ticket (set from Studio / SQL).
ALTER TABLE public.profiles ADD COLUMN display_name text
  CHECK (display_name IS NULL OR char_length(trim(display_name)) BETWEEN 1 AND 60);

-- ---------------------------------------------------------------- trucks
CREATE TABLE public.trucks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_number text NOT NULL CHECK (char_length(trim(truck_number)) BETWEEN 1 AND 40),
  -- Same normalization as ticket_key: "222", " 222" and "2 22" are one truck.
  truck_key text NOT NULL GENERATED ALWAYS AS (
    upper(regexp_replace(trim(truck_number), '\s+', '', 'g'))
  ) STORED UNIQUE,
  gross_tons numeric(10, 2) NOT NULL CHECK (gross_tons > 0 AND gross_tons <= 200),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trucks_touch_updated_at
  BEFORE UPDATE ON public.trucks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------- job_orders
CREATE TABLE public.job_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL CHECK (char_length(trim(code)) BETWEEN 1 AND 80),
  code_key text NOT NULL GENERATED ALWAYS AS (
    upper(regexp_replace(trim(code), '\s+', ' ', 'g'))
  ) STORED UNIQUE,
  -- A customer has at most one order (client rule).
  customer_id uuid NOT NULL UNIQUE REFERENCES public.customers (id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER job_orders_touch_updated_at
  BEFORE UPDATE ON public.job_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------- orders (tickets)
ALTER TABLE public.orders
  ADD COLUMN job_order_code text,
  ADD COLUMN truck_gross_tons numeric(10, 2),
  ADD COLUMN weighmaster text,
  ADD COLUMN po_number text CHECK (po_number IS NULL OR char_length(po_number) <= 40),
  ADD COLUMN job_number text CHECK (job_number IS NULL OR char_length(job_number) <= 40),
  ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'void')),
  ADD COLUMN voided_at timestamptz,
  ADD COLUMN edited_at timestamptz,
  ADD COLUMN edit_count integer NOT NULL DEFAULT 0;

CREATE INDEX orders_status_idx ON public.orders (status);

-- ---------------------------------------------------------------- ticket numbers
-- System-generated, 5+ digits, continuing after the highest numeric ticket
-- already stored (manual tickets typed before this migration).
CREATE SEQUENCE public.ticket_number_seq;

SELECT setval(
  'public.ticket_number_seq',
  GREATEST(
    10000,
    COALESCE(
      (SELECT max(ticket_number::bigint) + 1
       FROM public.orders
       WHERE ticket_number ~ '^\s*[0-9]{1,15}\s*$'),
      10000
    )
  ),
  false
);

-- Skips any number already taken (defensive: old manual tickets are unique
-- on ticket_key and could sit ahead of the sequence). SECURITY DEFINER so the
-- existence check sees every ticket, not only the ones RLS lets the caller read.
CREATE OR REPLACE FUNCTION public.next_ticket_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate text;
BEGIN
  LOOP
    candidate := nextval('public.ticket_number_seq')::text;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.orders WHERE ticket_key = candidate
    );
  END LOOP;
  RETURN candidate;
END;
$$;

REVOKE ALL ON FUNCTION public.next_ticket_number FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_ticket_number TO authenticated;

ALTER TABLE public.orders
  ALTER COLUMN ticket_number SET DEFAULT public.next_ticket_number();

-- ---------------------------------------------------------------- ticket_events
CREATE TABLE public.ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  ticket_number text NOT NULL,
  action text NOT NULL CHECK (action IN ('edit', 'void')),
  -- { "<field>": { "from": "...", "to": "..." }, ... } with readable values.
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ticket_events_order_idx ON public.ticket_events (order_id);
CREATE INDEX ticket_events_created_at_idx ON public.ticket_events (created_at DESC);

-- Edit tracking + history. Only changes made by non-admin users (the
-- operator) are tracked: they are what the admin needs to be notified of.
-- Admin-side bulk fixes (customer merge) must not flag every ticket.
CREATE OR REPLACE FUNCTION public.track_order_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  diff jsonb := '{}'::jsonb;
  old_name text;
  new_name text;
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN
    SELECT name INTO old_name FROM public.customers WHERE id = OLD.customer_id;
    SELECT name INTO new_name FROM public.customers WHERE id = NEW.customer_id;
    diff := diff || jsonb_build_object('customer', jsonb_build_object('from', old_name, 'to', new_name));
  END IF;
  IF NEW.material_id IS DISTINCT FROM OLD.material_id THEN
    SELECT name INTO old_name FROM public.materials WHERE id = OLD.material_id;
    SELECT name INTO new_name FROM public.materials WHERE id = NEW.material_id;
    diff := diff || jsonb_build_object('material', jsonb_build_object('from', old_name, 'to', new_name));
  END IF;
  IF NEW.truck_number IS DISTINCT FROM OLD.truck_number THEN
    diff := diff || jsonb_build_object('truck', jsonb_build_object('from', OLD.truck_number, 'to', NEW.truck_number));
  END IF;
  IF NEW.tons IS DISTINCT FROM OLD.tons THEN
    diff := diff || jsonb_build_object('tons', jsonb_build_object('from', OLD.tons, 'to', NEW.tons));
  END IF;
  IF NEW.payment IS DISTINCT FROM OLD.payment THEN
    diff := diff || jsonb_build_object('payment', jsonb_build_object('from', OLD.payment, 'to', NEW.payment));
  END IF;
  IF NEW.cod_method IS DISTINCT FROM OLD.cod_method THEN
    diff := diff || jsonb_build_object('cod_method', jsonb_build_object('from', OLD.cod_method, 'to', NEW.cod_method));
  END IF;
  IF NEW.po_number IS DISTINCT FROM OLD.po_number THEN
    diff := diff || jsonb_build_object('po_number', jsonb_build_object('from', OLD.po_number, 'to', NEW.po_number));
  END IF;
  IF NEW.job_number IS DISTINCT FROM OLD.job_number THEN
    diff := diff || jsonb_build_object('job_number', jsonb_build_object('from', OLD.job_number, 'to', NEW.job_number));
  END IF;

  IF NEW.status = 'void' AND OLD.status <> 'void' THEN
    NEW.voided_at := now();
    INSERT INTO public.ticket_events (order_id, ticket_number, action, changes, actor)
    VALUES (NEW.id, NEW.ticket_number, 'void', diff, auth.uid());
  ELSIF diff <> '{}'::jsonb THEN
    NEW.edited_at := now();
    NEW.edit_count := OLD.edit_count + 1;
    INSERT INTO public.ticket_events (order_id, ticket_number, action, changes, actor)
    VALUES (NEW.id, NEW.ticket_number, 'edit', diff, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_track_edit_bu
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.track_order_edit();

-- ---------------------------------------------------------------- loads today
-- "Loads today" printed on the ticket: position of this ticket among the
-- day's active tickets for the same customer / same truck. Deterministic, so
-- a reprint shows the same numbers as the original.
CREATE OR REPLACE FUNCTION public.ticket_loads(p_order_id uuid)
RETURNS TABLE (customer_loads integer, truck_loads integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*)::int FROM public.orders o
      WHERE o.date = t.date AND o.status = 'active'
        AND o.customer_id = t.customer_id
        AND o.created_at <= t.created_at),
    (SELECT count(*)::int FROM public.orders o
      WHERE o.date = t.date AND o.status = 'active'
        AND upper(regexp_replace(trim(o.truck_number), '\s+', '', 'g'))
          = upper(regexp_replace(trim(t.truck_number), '\s+', '', 'g'))
        AND o.created_at <= t.created_at)
  FROM public.orders t
  WHERE t.id = p_order_id
    -- Callers only get counts for tickets they are allowed to read.
    AND (public.is_admin() OR t.created_by = auth.uid()
         OR (public.is_operator() AND t.date = ((now() AT TIME ZONE 'America/Chicago')::date)));
$$;

REVOKE ALL ON FUNCTION public.ticket_loads FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ticket_loads TO authenticated;

-- ---------------------------------------------------------------- totals (replaces 005)
-- Void tickets never count toward tons / gross / loads.
DROP FUNCTION IF EXISTS public.orders_totals(text, text, uuid, uuid, text, text, date, date);

CREATE OR REPLACE FUNCTION public.orders_totals(
  p_truck text DEFAULT NULL,
  p_ticket text DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL,
  p_material_id uuid DEFAULT NULL,
  p_payment text DEFAULT NULL,
  p_cod_method text DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS TABLE (total_tons numeric, total_gross numeric, total_loads bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(o.tons), 0) AS total_tons,
    COALESCE(SUM(o.gross), 0) AS total_gross,
    COUNT(*) AS total_loads
  FROM public.orders o
  WHERE o.status = 'active'
    AND (p_truck IS NULL OR o.truck_number ILIKE '%' || p_truck || '%')
    AND (p_ticket IS NULL OR o.ticket_number ILIKE '%' || p_ticket || '%')
    AND (p_customer_id IS NULL OR o.customer_id = p_customer_id)
    AND (p_material_id IS NULL OR o.material_id = p_material_id)
    AND (p_payment IS NULL OR o.payment = p_payment)
    AND (p_cod_method IS NULL OR o.cod_method = p_cod_method)
    AND (p_date_from IS NULL OR o.date >= p_date_from)
    AND (p_date_to IS NULL OR o.date <= p_date_to)
    -- p_status = 'void' matches nothing here (voids never count).
    AND (p_status IS NULL
         OR p_status = 'active'
         OR (p_status = 'modified' AND o.edited_at IS NOT NULL));
$$;

REVOKE ALL ON FUNCTION public.orders_totals FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orders_totals TO authenticated;

-- ---------------------------------------------------------------- RLS
ALTER TABLE public.trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY trucks_select_all ON public.trucks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY trucks_admin_insert ON public.trucks
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY trucks_admin_update ON public.trucks
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY trucks_admin_delete ON public.trucks
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY job_orders_select_all ON public.job_orders
  FOR SELECT TO authenticated USING (true);
CREATE POLICY job_orders_admin_insert ON public.job_orders
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY job_orders_admin_update ON public.job_orders
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY job_orders_admin_delete ON public.job_orders
  FOR DELETE TO authenticated USING (public.is_admin());

-- History is written only by the trigger (SECURITY DEFINER); admin reads it.
CREATE POLICY ticket_events_admin_select ON public.ticket_events
  FOR SELECT TO authenticated USING (public.is_admin());

-- Operator edits / voids today's tickets (same day scope as 004). The
-- WITH CHECK keeps the row on today so it cannot be moved to another day.
CREATE POLICY orders_operator_today_update ON public.orders
  FOR UPDATE TO authenticated
  USING (
    public.is_operator()
    AND date = ((now() AT TIME ZONE 'America/Chicago')::date)
  )
  WITH CHECK (
    public.is_operator()
    AND date = ((now() AT TIME ZONE 'America/Chicago')::date)
  );
