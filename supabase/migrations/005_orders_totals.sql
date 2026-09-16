-- ASG Operations / PIT #2
-- Migration 005: dashboard totals computed in the database.
--
-- Bug context: the dashboard summed tons/gross by fetching every filtered
-- row, but PostgREST caps responses at max_rows (1000), so totals silently
-- undercounted once a filter matched more than 1000 orders. This function
-- aggregates server-side with the same filters as the ledger query.
-- SECURITY INVOKER (default) keeps RLS in force.
-- p_truck / p_ticket arrive already stripped of LIKE wildcards (%, _, \).

CREATE OR REPLACE FUNCTION public.orders_totals(
  p_truck text DEFAULT NULL,
  p_ticket text DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL,
  p_material_id uuid DEFAULT NULL,
  p_payment text DEFAULT NULL,
  p_cod_method text DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE (total_tons numeric, total_gross numeric)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(o.tons), 0) AS total_tons,
    COALESCE(SUM(o.gross), 0) AS total_gross
  FROM public.orders o
  WHERE (p_truck IS NULL OR o.truck_number ILIKE '%' || p_truck || '%')
    AND (p_ticket IS NULL OR o.ticket_number ILIKE '%' || p_ticket || '%')
    AND (p_customer_id IS NULL OR o.customer_id = p_customer_id)
    AND (p_material_id IS NULL OR o.material_id = p_material_id)
    AND (p_payment IS NULL OR o.payment = p_payment)
    AND (p_cod_method IS NULL OR o.cod_method = p_cod_method)
    AND (p_date_from IS NULL OR o.date >= p_date_from)
    AND (p_date_to IS NULL OR o.date <= p_date_to);
$$;

REVOKE ALL ON FUNCTION public.orders_totals FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orders_totals TO authenticated;
