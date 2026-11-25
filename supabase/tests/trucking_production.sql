-- Run against a local database after applying migrations; fixtures roll back.
BEGIN;
INSERT INTO auth.users (id, email) VALUES
  ('b4000000-0000-0000-0000-000000000001', 'test-production-admin@example.invalid'),
  ('b4000000-0000-0000-0000-000000000002', 'test-production-operator@example.invalid');
INSERT INTO public.profiles (id, role) VALUES
  ('b4000000-0000-0000-0000-000000000001', 'admin'),
  ('b4000000-0000-0000-0000-000000000002', 'operator');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000001', true);

INSERT INTO public.trucking_production_days VALUES ('2088-10-01', 300, 10.5, 12, 5.95);
INSERT INTO public.trucking_production_entries
  (work_date, truck, driver, loads, ashgrove_tons, alumina_tons, silica_tons, gp_tons, adjustment, gross_override)
VALUES
  ('2088-10-01', 'Mixed', 'Example driver', 7, 10, 10, 5, 5, 10, NULL),
  ('2088-10-01', 'GP', 'Example driver', 5, 0, 0, 0, 10, 0, NULL),
  ('2088-10-01', 'Manual', '', 0, 10, 0, 0, 0, 0, 40);
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM public.trucking_production_daily WHERE work_date = '2088-10-01'
      AND gross = 424.25 AND loads = 12 AND target_rows = 2 AND met_rows = 1 AND missing_loads = 1) THEN
    RAISE EXCEPTION 'Unexpected daily production totals';
  END IF;
  IF NOT EXISTS (SELECT FROM public.trucking_production_results WHERE truck = 'Manual' AND gross = 40 AND load_goal = 0) THEN
    RAISE EXCEPTION 'Gross override or unassigned load-target rule incorrect';
  END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000002', true);
DO $$
BEGIN
  IF EXISTS (SELECT FROM public.trucking_production_days)
    OR EXISTS (SELECT FROM public.trucking_production_entries)
    OR EXISTS (SELECT FROM public.trucking_production_daily)
    OR EXISTS (SELECT FROM public.trucking_production_results) THEN
    RAISE EXCEPTION 'Non-admin can read production records';
  END IF;
  BEGIN
    INSERT INTO public.trucking_production_days VALUES ('2088-10-02', 0, 0, 0, 0);
    RAISE EXCEPTION 'Non-admin could create production data';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;
