-- Run against a local database after applying migrations; fixtures roll back.
BEGIN;
INSERT INTO auth.users (id, email) VALUES
  ('b5000000-0000-0000-0000-000000000001', 'test-roll-off-admin@example.invalid'),
  ('b5000000-0000-0000-0000-000000000002', 'test-roll-off-operator@example.invalid');
INSERT INTO public.profiles (id, role) VALUES
  ('b5000000-0000-0000-0000-000000000001', 'admin'),
  ('b5000000-0000-0000-0000-000000000002', 'operator');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b5000000-0000-0000-0000-000000000001', true);

DO $$
DECLARE
  container uuid;
  rental uuid;
  today date := (now() AT TIME ZONE 'America/Chicago')::date;
BEGIN
  INSERT INTO public.roll_off_containers (container_number, size_yards)
    VALUES ('TEST-30', 30) RETURNING id INTO container;
  INSERT INTO public.roll_off_orders (order_number, order_date, customer, address, service, size_yards, container_id, rental_days)
    VALUES ('TEST-ROLL-1', today, 'Test customer', 'Example address', 'Delivery', 30, container, 7) RETURNING id INTO rental;
  IF NOT EXISTS (SELECT FROM public.roll_off_inventory WHERE id = container AND availability = 'Reserved') THEN
    RAISE EXCEPTION 'Pending order did not reserve container';
  END IF;
  BEGIN
    INSERT INTO public.roll_off_orders (order_number, order_date, customer, address, service, size_yards, container_id)
      VALUES ('TEST-ROLL-2', today, 'Test customer', 'Example address', 'Delivery', 30, container);
    RAISE EXCEPTION 'Double assignment allowed';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.roll_off_orders SET dispatch_status = 'Assigned' WHERE id = rental;
    RAISE EXCEPTION 'Dispatch assigned without truck or driver';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE public.roll_off_orders SET delivered_on = today - 7 WHERE id = rental;
  IF NOT EXISTS (SELECT FROM public.roll_off_dispatch WHERE id = rental AND due_on = today
      AND tracking_status = 'Pick up today' AND on_site AND elapsed_days = 7) THEN
    RAISE EXCEPTION 'Expected pickup today';
  END IF;
  UPDATE public.roll_off_orders SET delivered_on = today - 8 WHERE id = rental;
  IF NOT EXISTS (SELECT FROM public.roll_off_dispatch WHERE id = rental AND tracking_status = 'Overdue') THEN
    RAISE EXCEPTION 'Expected overdue pickup';
  END IF;
  UPDATE public.roll_off_orders SET picked_up_on = today WHERE id = rental;
  IF NOT EXISTS (SELECT FROM public.roll_off_inventory WHERE id = container AND availability = 'Available' AND last_return_on = today) THEN
    RAISE EXCEPTION 'Pickup did not release container';
  END IF;
  UPDATE public.roll_off_orders SET picked_up_on = NULL, dispatch_status = 'Canceled' WHERE id = rental;
  IF EXISTS (SELECT FROM public.roll_off_dispatch WHERE id = rental AND (on_site OR tracking_status <> 'Canceled')) THEN
    RAISE EXCEPTION 'Canceled order still counted as open';
  END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', 'b5000000-0000-0000-0000-000000000002', true);
DO $$
BEGIN
  IF EXISTS (SELECT FROM public.roll_off_orders)
    OR EXISTS (SELECT FROM public.roll_off_containers)
    OR EXISTS (SELECT FROM public.roll_off_dispatch)
    OR EXISTS (SELECT FROM public.roll_off_inventory) THEN
    RAISE EXCEPTION 'Non-admin can read roll-off records';
  END IF;
  BEGIN
    INSERT INTO public.roll_off_drivers (name) VALUES ('Forbidden');
    RAISE EXCEPTION 'Non-admin could add a driver';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;
