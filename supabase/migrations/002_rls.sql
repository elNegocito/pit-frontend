-- ASG Operations / PIT #2
-- Migration 002: Row Level Security.
--
-- Access model (two fixed users, roles stored in public.profiles):
--   operator : INSERT orders, SELECT materials/customers (active catalogs),
--              INSERT customers (implicit create-on-type in the entry form).
--              No UPDATE/DELETE anywhere, no SELECT on orders or profiles.
--   admin    : full access to orders/materials/customers + merge customers.
-- Every statement goes through authenticated Supabase sessions from the web
-- app; there is no public (anon) access at all.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Helper: true when the session user is the admin.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------- profiles
-- Users read their own row (needed post-login to resolve the role).
-- Role assignment happens out-of-band (SQL / Studio), never from the app:
-- with no INSERT/UPDATE/DELETE policy, writes are denied by default.
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- ---------------------------------------------------------------- materials
CREATE POLICY materials_select_all ON public.materials
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY materials_admin_write ON public.materials
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY materials_admin_update ON public.materials
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY materials_admin_delete ON public.materials
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------- customers
CREATE POLICY customers_select_all ON public.customers
  FOR SELECT TO authenticated
  USING (true);
-- Implicit creation from the entry form: any authenticated user may insert,
-- duplicates collapse on name_key (UNIQUE) and resolve to the existing row.
CREATE POLICY customers_insert_any ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY customers_admin_update ON public.customers
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY customers_admin_delete ON public.customers
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------- orders
-- Only admins read the ledger (operator is write-only by design).
CREATE POLICY orders_admin_select ON public.orders
  FOR SELECT TO authenticated
  USING (public.is_admin());
-- Both roles insert dispatches; created_by defaults client-side to auth.uid().
CREATE POLICY orders_insert_any ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (true);
-- Only admins correct history (re-pricing recomputes gross via trigger).
CREATE POLICY orders_admin_update ON public.orders
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY orders_admin_delete ON public.orders
  FOR DELETE TO authenticated
  USING (public.is_admin());
