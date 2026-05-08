
DO $$
DECLARE
  v_client_id uuid := gen_random_uuid();
  v_partner_id uuid := gen_random_uuid();
BEGIN
  -- CLIENTE
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'cliente@teste.com') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_client_id, 'authenticated', 'authenticated',
      'cliente@teste.com', crypt('Cliente@2026', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Cliente Teste","role":"cliente"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_client_id, v_client_id::text, jsonb_build_object('sub', v_client_id::text, 'email','cliente@teste.com'), 'email', now(), now(), now());
    INSERT INTO public.profiles (id, email, full_name) VALUES (v_client_id, 'cliente@teste.com', 'Cliente Teste')
      ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (v_client_id, 'cliente') ON CONFLICT DO NOTHING;
  END IF;

  -- PARCEIRO
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'parceiro@teste.com') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_partner_id, 'authenticated', 'authenticated',
      'parceiro@teste.com', crypt('Parceiro@2026', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Parceiro Teste","role":"parceiro"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_partner_id, v_partner_id::text, jsonb_build_object('sub', v_partner_id::text, 'email','parceiro@teste.com'), 'email', now(), now(), now());
    INSERT INTO public.profiles (id, email, full_name) VALUES (v_partner_id, 'parceiro@teste.com', 'Parceiro Teste')
      ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (v_partner_id, 'parceiro') ON CONFLICT DO NOTHING;
  END IF;
END $$;
