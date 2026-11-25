-- LOCAL DEVELOPMENT ONLY. Run after ctal-sample-week.sql.
-- Demo viewer: ctal-viewer@asgoperations.com / password123
BEGIN;

DO $$
DECLARE
  viewer_email constant text := 'ctal-viewer@asgoperations.com';
  viewer_id uuid;
BEGIN
  SELECT id INTO viewer_id FROM auth.users WHERE email = viewer_email;
  IF viewer_id IS NULL THEN
    viewer_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', viewer_id, 'authenticated', 'authenticated',
      viewer_email, extensions.crypt('password123', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(),
      '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), viewer_id, viewer_id::text,
      jsonb_build_object('sub', viewer_id::text, 'email', viewer_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  END IF;
  INSERT INTO public.profiles (id, role, display_name)
  VALUES (viewer_id, 'ctal_viewer', 'CTAL DEMO VIEWER')
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- An unused carrier for the successful deletion flow. The carriers in the
-- sample log exercise the history-protection flow.
INSERT INTO public.ctal_carriers (name, hub_city)
VALUES ('CTAL DEMO UNUSED CARRIER', 'Springfield')
ON CONFLICT (name_key) DO NOTHING;

COMMIT;
