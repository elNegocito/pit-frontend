-- LOCAL DEVELOPMENT ONLY — never run against production.
-- Creates the two app users (password: password123), their roles and
-- weighmaster names, plus sample trucks / customers / project orders so the
-- printable ticket can be tested right away.
--
-- Run after `pnpm supabase db reset`:
--   docker exec -i supabase_db_pit-frontend psql -U postgres -d postgres < supabase/dev/local-dev.sql

DO $$
DECLARE
  u record;
  uid uuid;
BEGIN
  FOR u IN
    SELECT * FROM (VALUES
      ('admin@asgoperations.com', 'admin', 'DANIEL'),
      ('operator@asgoperations.com', 'operator', 'IVONNE')
    ) AS t(email, role, display_name)
  LOOP
    SELECT id INTO uid FROM auth.users WHERE email = u.email;
    IF uid IS NULL THEN
      uid := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
        u.email, extensions.crypt('password123', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', '{}', now(), now(),
        '', '', '', ''
      );
      INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), uid, uid::text,
        jsonb_build_object('sub', uid::text, 'email', u.email, 'email_verified', true),
        'email', now(), now(), now()
      );
    END IF;
    INSERT INTO public.profiles (id, role, display_name)
    VALUES (uid, u.role, u.display_name)
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, display_name = EXCLUDED.display_name;
  END LOOP;
END;
$$;

-- Sample catalog (from the client's Excel "BASE" and "Sheet3").
INSERT INTO public.trucks (truck_number, tare_tons) VALUES
  ('222', 14.50),
  ('1100', 17.41)
ON CONFLICT (truck_key) DO NOTHING;

INSERT INTO public.customers (name) VALUES ('0911-HOLCIM'), ('EGW Services')
ON CONFLICT (name_key) DO NOTHING;

INSERT INTO public.job_orders (code, customer_id)
SELECT '11-911-AMRIZE-OPEN', id FROM public.customers WHERE name_key = '0911-HOLCIM'
ON CONFLICT (customer_id) DO NOTHING;

-- Simulates the manual ticket numbers already stored in production: the
-- automatic numbering must continue after the highest one.
SELECT setval(
  'public.ticket_number_seq',
  GREATEST(nextval('public.ticket_number_seq'), 46285),
  false
);
