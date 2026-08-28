-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: Recrear cuenta operador en Supabase Auth correctamente
-- PROPÓSITO: Resolver "Database error querying schema" al hacer signInWithPassword
-- FECHA: 2026-08-28
-- NOTA: Ejecutar este script si el login del operador falla con errors de schema
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- Eliminar y recrear la cuenta del operador correctamente
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_op_email TEXT := 'marketcoffe.ve@gmail.com';
    v_op_password TEXT := 'market.2026';
    v_op_nombre TEXT := 'Market Coffee';
    v_op_username TEXT := 'marketcoffee';
    v_auth_user_id UUID;
    v_password_hash TEXT;
    v_existing_cliente_id TEXT;
BEGIN
    v_password_hash := pgcrypto.crypt(v_op_password, pgcrypto.gen_salt('bf'));

    -- Buscar si ya existe en auth.users
    SELECT id INTO v_auth_user_id
    FROM auth.users
    WHERE email = v_op_email
    LIMIT 1;

    -- Eliminar el auth user existente si existe (para recrearlo limpio)
    IF v_auth_user_id IS NOT NULL THEN
        -- Primero eliminar de admin_users
        DELETE FROM admin_users WHERE id = v_auth_user_id;
        -- Luego eliminar de auth.users
        DELETE FROM auth.users WHERE id = v_auth_user_id;
        RAISE NOTICE 'Auth user ELIMINADO para recreación: % (id: %)', v_op_email, v_auth_user_id;
    END IF;

    -- CRÍTICO: Eliminar también de usuarios_clientes si existe el email
    -- (el trigger handle_auth_user_created hará INSERT con ON CONFLICT, pero
    -- necesitamos que el id coincida con el nuevo auth user)
    SELECT id INTO v_existing_cliente_id
    FROM usuarios_clientes
    WHERE email = v_op_email
    LIMIT 1;

    IF v_existing_cliente_id IS NOT NULL THEN
        -- Eliminar transacciones de lealtad asociadas
        DELETE FROM loyalty_history WHERE user_id = v_existing_cliente_id;
        DELETE FROM loyalty_transactions WHERE user_id = v_existing_cliente_id;
        -- Eliminar el registro de usuario cliente
        DELETE FROM usuarios_clientes WHERE id = v_existing_cliente_id;
        RAISE NOTICE 'usuarios_clientes ELIMINADO para recreación: % (id: %)', v_op_email, v_existing_cliente_id;
    END IF;

    -- Crear nuevo UUID
    v_auth_user_id := gen_random_uuid();

    -- Insertar en auth.users con TODOS los campos requeridos
    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        confirmation_sent_at,
        recovery_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        is_super_admin
    ) VALUES (
        v_auth_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        v_op_email,
        v_password_hash,
        NOW(),                      -- email_confirmed_at
        NOW(),                      -- confirmation_sent_at
        NULL,                       -- recovery_sent_at
        NULL,                       -- last_sign_in_at
        '{"provider": "email", "providers": ["email"], "role": "operator"}'::jsonb,
        json_build_object(
            'nombre', v_op_nombre,
            'username', v_op_username,
            'role', 'operator'
        )::jsonb,
        NOW(),
        NOW(),
        '',
        FALSE
    );

    RAISE NOTICE 'Auth user CREADO para operador: % (id: %)', v_op_email, v_auth_user_id;

    -- Sincronizar admin_users
    INSERT INTO public.admin_users (id, email, username, nombre, role, active, created_at)
    VALUES (v_auth_user_id, v_op_email, v_op_username, v_op_nombre, 'operator', true, NOW())
    ON CONFLICT (id) DO UPDATE SET
        email = v_op_email,
        username = v_op_username,
        nombre = v_op_nombre,
        role = 'operator',
        active = true;

    RAISE NOTICE 'admin_users SINCRONIZADO para operador (id: %)', v_auth_user_id;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- También recrear el admin por si acaso
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_admin_email TEXT := 'kecho8a@gmail.com';
    v_admin_password TEXT := 'kecho.180';
    v_auth_user_id UUID;
    v_password_hash TEXT;
BEGIN
    v_password_hash := pgcrypto.crypt(v_admin_password, pgcrypto.gen_salt('bf'));

    SELECT id INTO v_auth_user_id
    FROM auth.users
    WHERE email = v_admin_email
    LIMIT 1;

    IF v_auth_user_id IS NOT NULL THEN
        -- Actualizar contraseña y metadata
        UPDATE auth.users
        SET
            encrypted_password = v_password_hash,
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb,
            raw_user_meta_data = raw_user_meta_data ||
                '{"nombre": "Admin", "username": "maketo", "role": "admin"}'::jsonb,
            updated_at = NOW()
        WHERE id = v_auth_user_id;
        RAISE NOTICE 'Admin auth user ACTUALIZADO: %', v_admin_email;
    ELSE
        -- Crear si no existe
        v_auth_user_id := gen_random_uuid();
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password,
            email_confirmed_at, confirmation_sent_at, recovery_sent_at,
            last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
            created_at, updated_at, confirmation_token, is_super_admin
        ) VALUES (
            v_auth_user_id,
            '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated',
            v_admin_email, v_password_hash,
            NOW(), NOW(), NULL, NULL,
            '{"provider": "email", "providers": ["email"], "role": "admin"}'::jsonb,
            '{"nombre": "Admin", "username": "maketo", "role": "admin"}'::jsonb,
            NOW(), NOW(), '', FALSE
        );
        RAISE NOTICE 'Admin auth user CREADO: % (id: %)', v_admin_email, v_auth_user_id;
    END IF;

    -- Sincronizar admin_users
    INSERT INTO public.admin_users (id, email, username, nombre, role, active, created_at)
    VALUES (v_auth_user_id, v_admin_email, 'maketo', 'Admin', 'admin', true, NOW())
    ON CONFLICT (id) DO UPDATE SET
        email = v_admin_email,
        username = 'maketo',
        nombre = 'Admin',
        role = 'admin',
        active = true;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    u.id,
    u.email,
    u.email_confirmed_at IS NOT NULL AS email_confirmed,
    u.raw_app_meta_data->>'role' AS auth_role,
    a.username,
    a.role AS admin_role,
    a.active
FROM auth.users u
JOIN public.admin_users a ON a.id = u.id
WHERE u.email IN ('kecho8a@gmail.com', 'marketcoffe.ve@gmail.com')
ORDER BY u.email;
