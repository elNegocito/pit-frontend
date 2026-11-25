CREATE TABLE public.roll_off_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  phone text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.roll_off_trucks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_number text NOT NULL CHECK (length(btrim(truck_number)) BETWEEN 1 AND 80),
  plate text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX roll_off_trucks_number_idx ON public.roll_off_trucks (lower(truck_number));

CREATE TABLE public.roll_off_containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_number text NOT NULL CHECK (length(btrim(container_number)) BETWEEN 1 AND 80),
  size_yards smallint NOT NULL CHECK (size_yards IN (10, 15, 20, 30, 40)),
  location text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  UNIQUE (id, size_yards)
);
CREATE UNIQUE INDEX roll_off_containers_number_idx ON public.roll_off_containers (lower(container_number));

CREATE TABLE public.roll_off_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL CHECK (length(btrim(order_number)) BETWEEN 1 AND 80),
  order_date date NOT NULL,
  scheduled_date date,
  customer text NOT NULL CHECK (length(btrim(customer)) BETWEEN 1 AND 120),
  phone text NOT NULL DEFAULT '',
  address text NOT NULL CHECK (length(btrim(address)) BETWEEN 1 AND 300),
  service text NOT NULL CHECK (service IN ('Delivery', 'Pick Up', 'Swap Out', 'Relocation')),
  container_id uuid,
  size_yards smallint NOT NULL CHECK (size_yards IN (10, 15, 20, 30, 40)),
  delivered_on date,
  rental_days integer CHECK (rental_days BETWEEN 1 AND 3650),
  due_on date GENERATED ALWAYS AS (delivered_on + rental_days) STORED,
  picked_up_on date,
  truck_id uuid REFERENCES public.roll_off_trucks,
  driver_id uuid REFERENCES public.roll_off_drivers,
  instructions text NOT NULL DEFAULT '',
  dispatch_status text NOT NULL DEFAULT 'Unassigned'
    CHECK (dispatch_status IN ('Unassigned', 'Assigned', 'En route', 'Completed', 'Canceled')),
  notes text NOT NULL DEFAULT '',
  charge numeric(12,2) CHECK (charge >= 0),
  reference text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (container_id, size_yards) REFERENCES public.roll_off_containers (id, size_yards),
  CHECK (picked_up_on IS NULL OR delivered_on IS NULL OR picked_up_on >= delivered_on),
  CHECK (dispatch_status NOT IN ('Assigned', 'En route') OR (truck_id IS NOT NULL AND driver_id IS NOT NULL))
);
CREATE UNIQUE INDEX roll_off_orders_number_idx ON public.roll_off_orders (lower(order_number));
CREATE INDEX roll_off_orders_dates_idx ON public.roll_off_orders (order_date DESC, id);
CREATE INDEX roll_off_orders_schedule_idx ON public.roll_off_orders (scheduled_date);
CREATE INDEX roll_off_orders_container_idx ON public.roll_off_orders (container_id, created_at DESC, id);
-- A pending assignment reserves the container, but it is not physically on site yet.
CREATE UNIQUE INDEX roll_off_one_open_order_per_container ON public.roll_off_orders (container_id)
  WHERE container_id IS NOT NULL AND picked_up_on IS NULL AND dispatch_status <> 'Canceled';

DO $$
DECLARE
  name text;
BEGIN
  FOREACH name IN ARRAY ARRAY['roll_off_drivers', 'roll_off_trucks', 'roll_off_containers', 'roll_off_orders']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', name);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO authenticated', name);
    EXECUTE format('CREATE POLICY roll_off_admin ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', name);
  END LOOP;
END $$;

CREATE VIEW public.roll_off_dispatch WITH (security_invoker = true) AS
SELECT o.*, c.container_number, t.truck_number, d.name AS driver_name,
  (o.container_id IS NOT NULL AND o.dispatch_status <> 'Canceled' AND o.delivered_on IS NOT NULL AND o.picked_up_on IS NULL) AS on_site,
  CASE WHEN o.delivered_on IS NULL THEN NULL
    ELSE greatest(0, coalesce(o.picked_up_on, clock.today) - o.delivered_on) END AS elapsed_days,
  CASE
    WHEN o.dispatch_status = 'Canceled' THEN 'Canceled'
    WHEN o.picked_up_on IS NOT NULL THEN 'Completed'
    WHEN o.delivered_on IS NULL THEN 'Pending delivery'
    WHEN o.due_on IS NULL THEN 'No pickup date'
    WHEN o.due_on < clock.today THEN 'Overdue'
    WHEN o.due_on = clock.today THEN 'Pick up today'
    ELSE 'Active'
  END AS tracking_status
FROM public.roll_off_orders o
LEFT JOIN public.roll_off_containers c ON c.id = o.container_id
LEFT JOIN public.roll_off_trucks t ON t.id = o.truck_id
LEFT JOIN public.roll_off_drivers d ON d.id = o.driver_id
CROSS JOIN (SELECT (now() AT TIME ZONE 'America/Chicago')::date AS today) clock;

CREATE VIEW public.roll_off_inventory WITH (security_invoker = true) AS
SELECT c.*, latest.order_number, latest.id AS order_id, latest.dispatch_status,
  CASE
    WHEN NOT c.active THEN 'Inactive'
    WHEN latest.id IS NULL OR latest.picked_up_on IS NOT NULL THEN 'Available'
    WHEN latest.delivered_on IS NULL THEN 'Reserved'
    ELSE 'On site'
  END AS availability,
  CASE WHEN latest.picked_up_on IS NULL THEN latest.due_on END AS expected_available_on,
  latest.picked_up_on AS last_return_on,
  CASE WHEN latest.picked_up_on IS NULL AND latest.delivered_on IS NOT NULL THEN latest.address ELSE c.location END AS current_location
FROM public.roll_off_containers c
LEFT JOIN LATERAL (
  SELECT id, order_number, dispatch_status, picked_up_on, delivered_on, due_on, address
  FROM public.roll_off_orders
  WHERE container_id = c.id AND dispatch_status <> 'Canceled'
  ORDER BY (picked_up_on IS NULL) DESC, created_at DESC, id
  LIMIT 1
) latest ON true;

REVOKE ALL ON public.roll_off_dispatch, public.roll_off_inventory FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.roll_off_dispatch, public.roll_off_inventory TO authenticated;
