-- ASG Operations / PIT #2
-- Migration 003: let users read back their own orders.
--
-- Bug context: the entry form inserts a dispatch and re-reads it
-- (ticket + frozen gross) in the same request. INSERT was allowed but the
-- implicit SELECT (PostgREST RETURNING) was denied for non-admins, so every
-- operator save failed with a generic error. This policy grants SELECT on
-- rows the user created themselves; the full ledger stays admin-only and
-- the operator UI never queries other rows.

CREATE POLICY orders_select_own ON public.orders
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());
