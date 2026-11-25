CREATE TABLE public.trucking_production_days (
  work_date date PRIMARY KEY,
  revenue_goal numeric(14,2) NOT NULL CHECK (revenue_goal BETWEEN 0 AND 9999999999),
  ashgrove_rate numeric(10,4) NOT NULL CHECK (ashgrove_rate BETWEEN 0 AND 99999),
  gp_rate numeric(10,4) NOT NULL CHECK (gp_rate BETWEEN 0 AND 99999),
  shale_rate numeric(10,4) NOT NULL CHECK (shale_rate BETWEEN 0 AND 99999)
);

CREATE TABLE public.trucking_production_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_date date NOT NULL REFERENCES public.trucking_production_days,
  truck text NOT NULL CHECK (length(btrim(truck)) BETWEEN 1 AND 80),
  equipment text NOT NULL DEFAULT '',
  driver text NOT NULL DEFAULT '',
  loads integer NOT NULL DEFAULT 0 CHECK (loads >= 0),
  work_notes text NOT NULL DEFAULT '',
  ashgrove_tons numeric(12,4) NOT NULL DEFAULT 0 CHECK (ashgrove_tons >= 0),
  alumina_tons numeric(12,4) NOT NULL DEFAULT 0 CHECK (alumina_tons >= 0),
  silica_tons numeric(12,4) NOT NULL DEFAULT 0 CHECK (silica_tons >= 0),
  gp_tons numeric(12,4) NOT NULL DEFAULT 0 CHECK (gp_tons >= 0),
  other_material text NOT NULL DEFAULT '',
  other_quantity numeric(12,4) NOT NULL DEFAULT 0 CHECK (other_quantity >= 0),
  excavation text NOT NULL DEFAULT '',
  customer_tons numeric(12,4) NOT NULL DEFAULT 0 CHECK (customer_tons >= 0),
  customer_loads integer NOT NULL DEFAULT 0 CHECK (customer_loads >= 0),
  adjustment numeric(14,6) NOT NULL DEFAULT 0,
  gross_override numeric(14,6),
  driver_pay numeric(14,2) CHECK (driver_pay >= 0)
);
CREATE INDEX trucking_production_entries_day_idx ON public.trucking_production_entries (work_date, truck, id);

ALTER TABLE public.trucking_production_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trucking_production_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trucking_production_days, public.trucking_production_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.trucking_production_days TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trucking_production_entries TO authenticated;
CREATE POLICY production_days_admin ON public.trucking_production_days FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY production_entries_admin ON public.trucking_production_entries FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE VIEW public.trucking_production_results WITH (security_invoker = true) AS
SELECT e.*, COALESCE(e.gross_override,
    e.ashgrove_tons * d.ashgrove_rate + e.gp_tons * d.gp_rate
    + (e.alumina_tons + e.silica_tons) * d.shale_rate + e.adjustment) AS gross,
  CASE WHEN btrim(e.driver) = '' THEN 0
    WHEN e.alumina_tons + e.silica_tons > 0 THEN 8
    WHEN e.ashgrove_tons + e.gp_tons > 0 THEN 5
    ELSE 0 END AS load_goal
FROM public.trucking_production_entries e
JOIN public.trucking_production_days d USING (work_date);

CREATE VIEW public.trucking_production_daily WITH (security_invoker = true) AS
SELECT d.*, COALESCE(t.gross, 0) AS gross, COALESCE(t.loads, 0) AS loads,
  COALESCE(t.target_rows, 0) AS target_rows, COALESCE(t.met_rows, 0) AS met_rows,
  COALESCE(t.missing_loads, 0) AS missing_loads
FROM public.trucking_production_days d
LEFT JOIN LATERAL (
  SELECT sum(r.gross) AS gross, sum(r.loads) AS loads,
    count(*) FILTER (WHERE r.load_goal > 0) AS target_rows,
    count(*) FILTER (WHERE r.load_goal > 0 AND r.loads >= r.load_goal) AS met_rows,
    sum(greatest(0, r.load_goal - r.loads)) AS missing_loads
  FROM public.trucking_production_results r WHERE r.work_date = d.work_date
) t ON true;

REVOKE ALL ON public.trucking_production_results, public.trucking_production_daily FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.trucking_production_results, public.trucking_production_daily TO authenticated;
