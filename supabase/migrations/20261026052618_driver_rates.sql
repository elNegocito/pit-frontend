-- ASG Operations / PIT #2
-- Migration 011: each driver's own pay rate.
--
-- Not every driver earns the same. Saved on the driver when payroll adds
-- them, and used to fill each new pay sheet:
--   * mixer     : hourly_rate ($/h; overtime is 1.5x this rate)
--   * aggregate : revenue_pct (% of each load's revenue)
--   * flat bed  : fixed model rates (single driver), both stay NULL.
-- NULL = use the pay model's default. Saved sheets keep their own rates.

ALTER TABLE public.drivers
  ADD COLUMN hourly_rate numeric(8, 2) CHECK (hourly_rate IS NULL OR hourly_rate BETWEEN 0 AND 500),
  ADD COLUMN revenue_pct numeric(5, 2) CHECK (revenue_pct IS NULL OR revenue_pct BETWEEN 0 AND 100);
