ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'operator', 'payroll', 'ctal_viewer'));

CREATE FUNCTION public.is_ctal_viewer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ctal_viewer'
  );
$$;

CREATE POLICY ctal_weeks_viewer_select ON public.ctal_weeks
  FOR SELECT TO authenticated USING ((SELECT public.is_ctal_viewer()));
CREATE POLICY ctal_loads_viewer_select ON public.ctal_loads
  FOR SELECT TO authenticated USING ((SELECT public.is_ctal_viewer()));

-- Legacy PIT inserts previously accepted any authenticated account.
ALTER POLICY customers_insert_any ON public.customers
  WITH CHECK (NOT (SELECT public.is_ctal_viewer()));
ALTER POLICY orders_insert_any ON public.orders
  WITH CHECK (NOT (SELECT public.is_ctal_viewer()));

-- The ticket-number RPC advances a sequence even when no ticket is saved.
CREATE OR REPLACE FUNCTION public.next_ticket_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate text;
BEGIN
  IF public.is_ctal_viewer() THEN
    RAISE insufficient_privilege USING MESSAGE = 'CTAL viewers cannot allocate ticket numbers';
  END IF;
  LOOP
    candidate := nextval('public.ticket_number_seq')::text;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE ticket_key = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;

-- Loads already restrict carrier deletion. Protect linked statements too, and
-- require documents to be removed through Storage before deleting a carrier.
ALTER TABLE public.ctal_statements
  DROP CONSTRAINT ctal_statements_carrier_id_fkey,
  ADD CONSTRAINT ctal_statements_carrier_id_fkey
    FOREIGN KEY (carrier_id) REFERENCES public.ctal_carriers (id) ON DELETE RESTRICT;
ALTER TABLE public.ctal_carrier_documents
  DROP CONSTRAINT ctal_carrier_documents_carrier_id_fkey,
  ADD CONSTRAINT ctal_carrier_documents_carrier_id_fkey
    FOREIGN KEY (carrier_id) REFERENCES public.ctal_carriers (id) ON DELETE RESTRICT;
