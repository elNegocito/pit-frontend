-- ASG Operations / PIT #2 — seed (runs on `supabase db reset` / first push).
-- Price list ported from hidden sheet Sheet2 / Table1 of the Excel book.
-- Users themselves are created in Supabase Auth (dashboard or CLI) and then
-- linked here by email. Replace the example emails with the real ones.
--
--   1. Create the two Auth users (dashboard: Authentication > Users > Invite,
--      or `supabase auth admin create-user`).
--   2. Set ADMIN_EMAIL / OPERATOR_EMAIL below to those addresses.
--   3. `supabase db push` (or reset) inserts materials + profile rows.

INSERT INTO public.materials (name, price_per_ton) VALUES
  ('CUSHION SAND', 8.80),
  ('SCREENED TOP SOIL', 18.00),
  ('SELECT FILL', 7.00)
ON CONFLICT DO NOTHING;

-- Link pre-created Auth users to their app role.
-- DO NOT store passwords here; Supabase Auth owns credentials.
DO $$
DECLARE
  admin_email text := 'admin@asgoperations.com';
  operator_email text := 'operator@asgoperations.com';
  admin_id uuid;
  operator_id uuid;
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = admin_email;
  SELECT id INTO operator_id FROM auth.users WHERE email = operator_email;

  IF admin_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, role) VALUES (admin_id, 'admin')
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
  ELSE
    RAISE NOTICE 'seed: no auth user % yet — create it, then re-run seed', admin_email;
  END IF;

  IF operator_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, role) VALUES (operator_id, 'operator')
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
  ELSE
    RAISE NOTICE 'seed: no auth user % yet — create it, then re-run seed', operator_email;
  END IF;
END;
$$;
