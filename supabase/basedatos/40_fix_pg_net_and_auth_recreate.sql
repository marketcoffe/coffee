-- ============================================================================
-- FIX: pg_net extension + auth.users cleanup
-- Ejecuta en: Supabase Dashboard -> SQL Editor -> Run
-- ============================================================================

-- 1. Habilitar pg_net (requerido para push notifications via triggers)
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- 2. Limpiar TODA la data de auth para los usuarios corruptos
DO $$
DECLARE
  v_admin_id UUID;
  v_op_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'kecho8a@gmail.com';
  SELECT id INTO v_op_id FROM auth.users WHERE email = 'marketcoffe.ve@gmail.com';

  -- Limpiar admin
  IF v_admin_id IS NOT NULL THEN
    DELETE FROM auth.refresh_tokens WHERE user_id = v_admin_id::text;
    DELETE FROM auth.mfa_factors WHERE user_id = v_admin_id;
    DELETE FROM auth.sessions WHERE user_id = v_admin_id;
    DELETE FROM auth.instances WHERE id = v_admin_id;
    DELETE FROM auth.flow_state WHERE user_id = v_admin_id;
    DELETE FROM auth.identities WHERE user_id = v_admin_id;
    DELETE FROM auth.users WHERE id = v_admin_id;
    RAISE NOTICE 'Admin user deleted: %', v_admin_id;
  END IF;

  -- Limpiar operador
  IF v_op_id IS NOT NULL THEN
    DELETE FROM auth.refresh_tokens WHERE user_id = v_op_id::text;
    DELETE FROM auth.mfa_factors WHERE user_id = v_op_id;
    DELETE FROM auth.sessions WHERE user_id = v_op_id;
    DELETE FROM auth.instances WHERE id = v_op_id;
    DELETE FROM auth.flow_state WHERE user_id = v_op_id;
    DELETE FROM auth.identities WHERE user_id = v_op_id;
    DELETE FROM auth.users WHERE id = v_op_id;
    RAISE NOTICE 'Operator user deleted: %', v_op_id;
  END IF;
END $$;

-- 4. Limpiar usuarios_clientes duplicados que causan conflicto con el trigger
DELETE FROM public.usuarios_clientes WHERE email IN ('kecho8a@gmail.com', 'marketcoffe.ve@gmail.com');

-- 5. Crear admin correctamente via insert completo
DO $$
DECLARE
  v_admin_id UUID := gen_random_uuid();
  v_op_id UUID := gen_random_uuid();
  v_instance_id UUID;
  v_admin_encrypted TEXT;
  v_op_encrypted TEXT;
BEGIN
  SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;
  IF v_instance_id IS NULL THEN
    v_instance_id := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  v_admin_encrypted := crypt('kecho.180', gen_salt('bf'));
  v_op_encrypted := crypt('market.2026', gen_salt('bf'));

  -- Crear admin en auth.users
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, confirmation_token,
    recovery_token, email_change_token_new, email_change, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin
  ) VALUES (
    v_instance_id, v_admin_id, 'authenticated', 'authenticated',
    'kecho8a@gmail.com', v_admin_encrypted,
    NOW(), NOW(), NOW(), '', '', '', '', NOW(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"nombre": "Market Coffee", "username": "maketo", "role": "admin"}'::jsonb,
    false
  );

  -- Crear identidad para admin
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_admin_id, v_admin_id,
    '{"sub": "' || v_admin_id || '", "email": "kecho8a@gmail.com", "email_verified": true}'::jsonb,
    'email', NOW(), NOW(), NOW()
  );

  -- Crear admin_users
  INSERT INTO public.admin_users (id, email, username, nombre, role, active)
  VALUES (v_admin_id, 'kecho8a@gmail.com', 'maketo', 'Market Coffee', 'admin', true)
  ON CONFLICT (id) DO UPDATE SET active = true, role = 'admin', username = 'maketo', nombre = 'Market Coffee';

  -- Crear operador en auth.users
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, confirmation_token,
    recovery_token, email_change_token_new, email_change, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin
  ) VALUES (
    v_instance_id, v_op_id, 'authenticated', 'authenticated',
    'marketcoffe.ve@gmail.com', v_op_encrypted,
    NOW(), NOW(), NOW(), '', '', '', '', NOW(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"nombre": "Market Coffee", "username": "marketcoffee", "role": "operator"}'::jsonb,
    false
  );

  -- Crear identidad para operador
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_op_id, v_op_id,
    '{"sub": "' || v_op_id || '", "email": "marketcoffe.ve@gmail.com", "email_verified": true}'::jsonb,
    'email', NOW(), NOW(), NOW()
  );

  -- Crear admin_users para operador
  INSERT INTO public.admin_users (id, email, username, nombre, role, active)
  VALUES (v_op_id, 'marketcoffe.ve@gmail.com', 'marketcoffee', 'Market Coffee', 'operator', true)
  ON CONFLICT (id) DO UPDATE SET active = true, role = 'operator', username = 'marketcoffee';

  RAISE NOTICE 'Admin created: % (email: kecho8a@gmail.com)', v_admin_id;
  RAISE NOTICE 'Operator created: % (email: marketcoffe.ve@gmail.com)', v_op_id;
END $$;

-- 4. Verificar
SELECT email, email_confirmed_at IS NOT NULL as confirmed,
  raw_app_meta_data->>'role' as role,
  raw_user_meta_data->>'username' as username
FROM auth.users
WHERE email IN ('kecho8a@gmail.com', 'marketcoffe.ve@gmail.com');

-- 5. Verificar identities
SELECT i.user_id, u.email, i.provider
FROM auth.identities i
JOIN auth.users u ON u.id = i.user_id
WHERE u.email IN ('kecho8a@gmail.com', 'marketcoffe.ve@gmail.com');

SELECT 'DONE - pg_net enabled + users recreated' as status;
