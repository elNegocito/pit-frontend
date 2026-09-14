-- ASG Operations / PIT #2
-- Migration 004: operators can read today's orders (read-only verification).
--
-- The entry screen shows a paginated "today's tickets" list so the operator
-- can verify what was entered during the shift. Scope is strictly the
-- current pit day in America/Chicago: history stays admin-only, and no
-- UPDATE/DELETE is granted (separate policies, admin-only).

CREATE OR REPLACE FUNCTION public.is_operator()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = auth.uid() AND p.role = 'operator'
  );
$$;

CREATE POLICY orders_operator_today_select ON public.orders
  FOR SELECT TO authenticated
  USING (
    public.is_operator()
    AND date = ((now() AT TIME ZONE 'America/Chicago')::date)
  );
