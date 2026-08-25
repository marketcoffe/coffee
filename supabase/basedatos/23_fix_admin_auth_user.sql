-- =============================================================
-- 23. FIX: Asegurar admin en Supabase Auth (signInWithPassword)
-- PROPÓSITO: Garantizar que el admin exista en auth.users con:
--   - email confirmado (email_confirmed_at != NULL)
--   - role en app_metadata (requerido por authenticateAdmin)
--   - admin_users espejado con role='admin'
-- FECHA: 2026-08-25
-- NOTA: Los scripts 10 y 18 solo INSERTAN en admin_users desde
--       auth.users, pero NUNCA crean el auth user. Si el admin
--       no fue dado de alta vía signUp(), no existe en auth.users
--       y signInWithPassword retorna "Credenciales incorrectas".
-- =============================================================

-- Habilitar pgcrypto para generar hashes bcrypt
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Administrador dueño (credenciales por defecto del mock system)
-- Si el auth user no existe, se crea. Si existe, se repara.
DO $$
DECLARE
    v_admin_email TEXT := 'kecho8a@gmail.com';
    v_admin_password TEXT := '';
    v_admin_nombre TEXT := 'Admin';
    v_admin_username TEXT := 'maketo';
    v_auth_user_id UUID;
    v_password_hash TEXT;
BEGIN
    -- Generar hash bcrypt de la contraseña
    v_password_hash := crypt(v_admin_password, gen_salt('bf'));

    -- =========================================================
    -- PASO 1: Asegurar que el auth user exista en auth.users
    -- =========================================================
    SELECT id INTO v_auth_user_id
    FROM auth.users
    WHERE email = v_admin_email
    LIMIT 1;

    IF v_auth_user_id IS NULL THEN
        -- Auth user NO existe: crearlo completamente
        v_auth_user_id := gen_random_uuid();

        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password,
            email_confirmed_at, confirmation_sent_at, recovery_sent_at,
            last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
            created_at, updated_at, confirmation_token
        ) VALUES (
            v_auth_user_id,
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            v_admin_email,
            v_password_hash,
            NOW(),                  -- email confirmado
            NOW(),                  -- confirmation_sent_at
            NULL,                   -- recovery_sent_at
            NULL,                   -- last_sign_in_at
            '{"provider": "email", "providers": ["email"], "role": "admin"}'::jsonb,
            json_build_object('nombre', v_admin_nombre, 'username', v_admin_username, 'role', 'admin')::jsonb,
            NOW(),
            NOW(),
            ''
        );

        RAISE NOTICE 'Auth user CREADO para % (id: %)', v_admin_email, v_auth_user_id;
    ELSE
        -- Auth user YA existe: reparar metadata y contraseña
        UPDATE auth.users
        SET
            encrypted_password = v_password_hash,
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb,
            raw_user_meta_data = raw_user_meta_data ||
                json_build_object('nombre', v_admin_nombre, 'username', v_admin_username, 'role', 'admin')::jsonb,
            updated_at = NOW()
        WHERE id = v_auth_user_id;

        RAISE NOTICE 'Auth user REPARADO para % (id: %) — email confirmado y role admin asegurado', v_admin_email, v_auth_user_id;
    END IF;

    -- =========================================================
    -- PASO 2: Asegurar que admin_users tenga la fila espejo
    -- =========================================================
    INSERT INTO public.admin_users (id, email, username, nombre, role, active, created_at)
    VALUES (v_auth_user_id, v_admin_email, v_admin_username, v_admin_nombre, 'admin', true, NOW())
    ON CONFLICT (id) DO UPDATE SET
        email = v_admin_email,
        username = v_admin_username,
        nombre = v_admin_nombre,
        role = 'admin',
        active = true;

    RAISE NOTICE 'admin_users SINCRONIZADO para % (id: %)', v_admin_email, v_auth_user_id;
END $$;

-- ============================================================================
-- VERIFICACIÓN (opcional — ejecutar para confirmar que todo está correcto)
-- ============================================================================
-- SELECT
--     u.id,
--     u.email,
--     u.email_confirmed_at IS NOT NULL AS email_confirmed,
--     u.raw_app_meta_data->>'role' AS auth_role,
--     a.username,
--     a.role AS admin_role,
--     a.active
-- FROM auth.users u
-- JOIN public.admin_users a ON a.id = u.id
-- WHERE u.email = 'kecho8a@gmail.com';
