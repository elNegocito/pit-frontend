-- ASG Operations / PIT #2
-- Migration 007: trucks store their TARE (empty weight), not their gross.
--
-- Client correction: the truck is weighed empty (tare); the ticket computes
-- Gross = Tare + Net (Net = tons loaded). Previously the registry stored the
-- gross and printed Tare = Gross - Net.
--
-- Rename only (values kept): the registered weight is re-labelled as tare.

ALTER TABLE public.trucks RENAME COLUMN gross_tons TO tare_tons;
ALTER TABLE public.trucks RENAME CONSTRAINT trucks_gross_tons_check TO trucks_tare_tons_check;

ALTER TABLE public.orders RENAME COLUMN truck_gross_tons TO truck_tare_tons;
