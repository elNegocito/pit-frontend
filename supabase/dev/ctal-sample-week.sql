-- CTAL sample data for local development. Everything here is made up
-- (carriers, customers, tickets, rates): it only exercises each rule.
-- Run after `supabase db reset` + local-dev.sql. Never run in production.
--
-- Expected, week 01/04/2026 - 01/10/2026 (12 loads, 3 carriers):
--   carrier amount 2,290.00 | broker amount 2,540.00 | broker fee -40.00 | quick pay -57.05 | FSC 106.00
--   statements: NORTHSIDE HAULING 1,175.75 | RIVER BEND TRUCKING 660.00 | LONE OAK TRANSPORT 463.20
--   billing: ASG 1,200.00 + 40.00 | Ready Mix 600.00 + 66.00 | Excavation 740.00

INSERT INTO public.ctal_carriers (name, pay_term, hub_city, ins_exp) VALUES
  ('NORTHSIDE HAULING', 'QP', 'Springfield', current_date + 200),
  ('RIVER BEND TRUCKING', '28', 'Riverton', current_date + 15),
  ('LONE OAK TRANSPORT', 'QP', 'Oakdale', current_date - 10)
ON CONFLICT (name_key) DO NOTHING;

INSERT INTO public.ctal_customers
  (name, bill_to, default_unit, broker_rate, carrier_rate, fee_kind, fee_pct, fsc_mode, fsc_value)
VALUES
  ('SAMPLE QUARRY / SAND', 'asg',        'TON',  7,   6,   'quick_pay',  3.5, 'none',    0),
  ('SAMPLE CEMENT',        'asg',        'TON', 10,  10,   'broker_fee', 8,   'fixed',  20),
  ('SAMPLE READY MIX',     'ready_mix',  'TON', 12,  11,   'quick_pay',  3.5, 'percent', 12),
  ('SAMPLE EXCAVATION',    'excavation', 'LOAD', 185, 160, 'quick_pay',  3.5, 'none',    0)
ON CONFLICT (name_key) DO NOTHING;

INSERT INTO public.ctal_weeks (week_start, pay_date) VALUES ('2026-01-04', '2026-01-16')
ON CONFLICT (week_start) DO NOTHING;

DELETE FROM public.ctal_loads WHERE week_id = (SELECT id FROM public.ctal_weeks WHERE week_start = '2026-01-04');

INSERT INTO public.ctal_loads
  (week_id, position, load_date, carrier_id, carrier_name, customer_id, customer_name, bill_to,
   truck, driver, ticket, quantity, unit, broker_rate, carrier_rate, fee_kind, fee_pct, fsc_mode, fsc_value)
SELECT w.id, v.position, v.load_date::date, c.id, c.name, k.id, k.name, k.bill_to,
       v.truck, v.driver, v.ticket, v.quantity, k.default_unit, k.broker_rate, k.carrier_rate,
       k.fee_kind,
       -- 28-day carriers pay no quick pay fee.
       CASE WHEN k.fee_kind = 'quick_pay' AND c.pay_term = '28' THEN 0 ELSE k.fee_pct END,
       k.fsc_mode, k.fsc_value
FROM (VALUES
  (0, '2026-01-05', 'NORTHSIDE HAULING',   'SAMPLE QUARRY / SAND', '101', 'ALEX', '50001', 25),
  (1, '2026-01-05', 'NORTHSIDE HAULING',   'SAMPLE QUARRY / SAND', '101', 'ALEX', '50002', 25),
  (2, '2026-01-06', 'NORTHSIDE HAULING',   'SAMPLE QUARRY / SAND', '102', 'SAM',  '50003', 20),
  (3, '2026-01-06', 'NORTHSIDE HAULING',   'SAMPLE QUARRY / SAND', '102', 'SAM',  '50004', 30),
  (4, '2026-01-07', 'NORTHSIDE HAULING',   'SAMPLE READY MIX',     '101', 'ALEX', '70001', 25),
  (5, '2026-01-07', 'NORTHSIDE HAULING',   'SAMPLE READY MIX',     '101', 'ALEX', '70002', 25),
  (6, '2026-01-07', 'RIVER BEND TRUCKING', 'SAMPLE CEMENT',        '7',   'PAT',  '90001', 25),
  (7, '2026-01-08', 'RIVER BEND TRUCKING', 'SAMPLE CEMENT',        '7',   'PAT',  '90002', 25),
  (8, '2026-01-08', 'RIVER BEND TRUCKING', 'SAMPLE EXCAVATION',    '7',   'PAT',  '30001', 1),
  (9, '2026-01-09', 'LONE OAK TRANSPORT',  'SAMPLE EXCAVATION',    '44',  'JO',   '30002', 1),
  (10, '2026-01-09', 'LONE OAK TRANSPORT', 'SAMPLE EXCAVATION',    '44',  'JO',   '30003', 1),
  (11, '2026-01-09', 'LONE OAK TRANSPORT', 'SAMPLE EXCAVATION',    '44',  'JO',   '30004', 1)
) AS v(position, load_date, carrier, customer, truck, driver, ticket, quantity)
JOIN public.ctal_weeks w ON w.week_start = '2026-01-04'
JOIN public.ctal_carriers c ON c.name_key = v.carrier
JOIN public.ctal_customers k ON k.name_key = v.customer;
