-- CTAL demo data used to record the tutorial videos (scripts/ctal-tutorials).
-- Everything is made up: carriers, contacts, customers, tickets and rates.
-- LOCAL ONLY. It empties the CTAL tables first, so never run it in production.

TRUNCATE public.ctal_statements, public.ctal_loads, public.ctal_weeks,
         public.ctal_carrier_documents, public.ctal_customers, public.ctal_carriers CASCADE;

INSERT INTO public.ctal_carriers
  (carrier_number, name, pay_term, dispatch_contact, owner, equipment, ins_exp, ins_note, hub_city, usdot, email)
VALUES
  (3001, 'NORTHSIDE HAULING',     'QP', 'Marco (555) 010-1001',  'Marco (555) 010-1001',  'Marco 118 Round Bottom',  current_date + 210, NULL,        'Alvarado',   '3100118', 'dispatch@northside.example.com'),
  (3002, 'RIVER BEND TRUCKING',   '28', 'Dana (555) 010-1002',   'Luis (555) 010-1012',   'Luis 7 Belly',            current_date + 18,  NULL,        'Cleburne',   '3100207', 'office@riverbend.example.com'),
  (3003, 'LONE OAK TRANSPORT',    'QP', 'Josie (555) 010-1003',  'Josie (555) 010-1003',  'Josie 44 Aluminum',       current_date - 12,  NULL,        'Keene',      '3100344', 'josie@loneoak.example.com'),
  (3004, 'BLUEBONNET LOGISTICS',  'QP', 'Ray (555) 010-1004',    'Ray (555) 010-1004',    'Ray 301 Round Bottom',    current_date + 96,  NULL,        'Arlington',  '3100401', 'ray@bluebonnet.example.com'),
  (3005, 'THREE FORKS CARRIERS',  'QP', 'Ana (555) 010-1005',    'Victor (555) 010-1015', 'Victor 52 Belly',         current_date + 7,   NULL,        'Burleson',   '3100552', 'ana@threeforks.example.com'),
  (3006, 'MESQUITE FLATS HAULING','QP', 'Tony (555) 010-1006',   'Tony (555) 010-1006',   'Tony 9 Round Bottom',     NULL,               'CONTACTED', 'Midlothian', '3100609', NULL),
  (3007, 'PRAIRIE WIND TRUCKING', '28', 'Sofia (555) 010-1007',  'Sofia (555) 010-1007',  'Diego 210 Aluminum',      current_date + 150, NULL,        'Grandview',  '3100721', 'sofia@prairiewind.example.com'),
  (3008, 'HILL COUNTRY ROCK',     'QP', 'Ben (555) 010-1008',    'Ben (555) 010-1008',    'Ben 63 Belly',            current_date + 300, NULL,        'Joshua',     '3100863', 'ben@hillcountryrock.example.com'),
  (3009, 'CROSS TIMBERS FREIGHT', 'QP', 'Mia (555) 010-1009',    'Omar (555) 010-1019',   'Omar 15 Round Bottom',    current_date + 61,  NULL,        'Venus',      '3100915', 'mia@crosstimbers.example.com');

INSERT INTO public.ctal_customers
  (name, bill_to, default_unit, broker_rate, carrier_rate, fee_kind, fee_pct, fsc_mode, fsc_value)
VALUES
  ('BLUE RIDGE CEMENT / SILICA',  'asg',        'TON',   6.55,  6.55, 'quick_pay',  3.5, 'none',     0),
  ('BLUE RIDGE CEMENT / ALUMINA', 'asg',        'TON',   6.30,  6.30, 'quick_pay',  3.5, 'none',     0),
  ('IRONGATE PLANT',              'asg',        'TON',   9.50,  9.50, 'broker_fee', 8,   'fixed',   20),
  ('CEDAR CREEK EROSION',         'asg',        'LOAD', 335,   300,   'quick_pay',  3.5, 'none',     0),
  ('ASG READY MIX',               'ready_mix',  'TON',  12.00, 11.00, 'quick_pay',  3.5, 'percent', 12),
  ('ASG EXCAVATION / JOB 2610',   'excavation', 'LOAD', 185,   160,   'quick_pay',  3.5, 'none',     0);

-- A full week already logged (the one before the week the videos type in).
INSERT INTO public.ctal_weeks (week_start, pay_date)
SELECT d, d + 12 FROM (SELECT (current_date - extract(dow FROM current_date)::int - 14) AS d) s;

INSERT INTO public.ctal_loads
  (week_id, position, load_date, carrier_id, carrier_name, customer_id, customer_name, bill_to,
   truck, driver, ticket, quantity, unit, broker_rate, carrier_rate, fee_kind, fee_pct, fsc_mode, fsc_value)
SELECT w.id,
       (row_number() OVER (ORDER BY v.ord, n))::int - 1,
       w.week_start + v.day + (n % 2),
       c.id, c.name, k.id, k.name, k.bill_to,
       v.truck, v.driver,
       (v.ticket + n * 11)::text,
       CASE WHEN k.default_unit = 'LOAD' THEN 1 ELSE round((22 + ((v.ticket + n * 37) % 580) / 100.0)::numeric, 2) END,
       k.default_unit, k.broker_rate, k.carrier_rate, k.fee_kind,
       CASE WHEN k.fee_kind = 'quick_pay' AND c.pay_term = '28' THEN 0 ELSE k.fee_pct END,
       k.fsc_mode, k.fsc_value
FROM (VALUES
  (1, 'NORTHSIDE HAULING',      'BLUE RIDGE CEMENT / SILICA',  '118', 'MARCO',  51040, 1, 8),
  (2, 'NORTHSIDE HAULING',      'ASG READY MIX',               '118', 'MARCO',  70310, 4, 4),
  (3, 'RIVER BEND TRUCKING',    'IRONGATE PLANT',              '7',   'LUIS',   88120, 2, 7),
  (4, 'LONE OAK TRANSPORT',     'ASG EXCAVATION / JOB 2610',   '44',  'JOSIE',  30210, 3, 5),
  (5, 'BLUEBONNET LOGISTICS',   'BLUE RIDGE CEMENT / ALUMINA', '301', 'RAY',    42600, 1, 6),
  (6, 'BLUEBONNET LOGISTICS',   'BLUE RIDGE CEMENT / ALUMINA', '302', 'ELENA',  42900, 2, 4),
  (7, 'THREE FORKS CARRIERS',   'CEDAR CREEK EROSION',         '52',  'VICTOR', 19850, 3, 5),
  (8, 'PRAIRIE WIND TRUCKING',  'IRONGATE PLANT',              '210', 'DIEGO',  88510, 4, 6),
  (9, 'HILL COUNTRY ROCK',      'BLUE RIDGE CEMENT / SILICA',  '63',  'BEN',    51700, 2, 7),
  (10, 'CROSS TIMBERS FREIGHT', 'ASG READY MIX',               '15',  'OMAR',   70650, 1, 6)
) AS v(ord, carrier, customer, truck, driver, ticket, day, loads)
CROSS JOIN LATERAL generate_series(0, v.loads - 1) AS n
JOIN public.ctal_weeks w ON true
JOIN public.ctal_carriers c ON c.name_key = v.carrier
JOIN public.ctal_customers k ON k.name_key = v.customer;
