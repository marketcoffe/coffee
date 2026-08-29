-- ═══════════════════════════════════════════════════════════════════════════
-- 36b_fix_auth_users_soft.sql
-- PROPÓSITO: Corregir auth.users sin eliminar datos (soft fix)
-- FECHA: 2026-08-29
-- NOTA: No hardcodea passwords. Solo asegura metadatos y confirmación.
-- ═══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- 1. Asegurar que admin_users tenga los IDs correctos
-- ============================================================================
DO $$
DECLARE
    v_admin_email TEXT := 'kecho8a@gmail.com';
    v_op_email TEXT := 'marketcoffe.ve@gmail.com';
    v_admin_id UUID;
    v_op_id UUID;
BEGIN
    SELECT id INTO v_admin_id FROM admin_users WHERE email = v_admin_email LIMIT 1;
    SELECT id INTO v_op_id FROM admin_users WHERE email = v_op_email LIMIT 1;

    IF v_admin_id IS NULL THEN
        RAISE NOTICE 'Admin no encontrado en admin_users: %', v_admin_email;
    END IF;
    IF v_op_id IS NULL THEN
        RAISE NOTICE 'Operador no encontrado en admin_users: %', v_op_email;
    END IF;
END $$;

-- ============================================================================
-- 2. Asegurar auth.users exista y esté confirmado (sin cambiar password)
-- ============================================================================
DO $$
DECLARE
    v_admin_email TEXT := 'kecho8a@gmail.com';
    v_op_email TEXT := 'marketcoffe.ve@gmail.com';
    v_admin_id UUID;
    v_op_id UUID;
    v_auth_id UUID;
BEGIN
    -- Buscar admin en admin_users
    SELECT id INTO v_admin_id FROM admin_users WHERE email = v_admin_email LIMIT 1;
    SELECT id INTO v_op_id FROM admin_users WHERE email = v_op_email LIMIT 1;

    -- Admin: asegurar existencia en auth.users
    IF v_admin_id IS NOT NULL THEN
        SELECT id INTO v_auth_id FROM auth.users WHERE id = v_admin_id LIMIT 1;
        IF v_auth_id IS NULL THEN
            RAISE NOTICE 'Admin auth.users faltante. Creando placeholder (requiere password reset).';
            INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_sent_at, created_at, updated_at, confirmation_token, is_super_admin, raw_app_meta_data, raw_user_meta_data)
            VALUES (v_admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_admin_email, crypt('TEMP_RESET_REQUIRED', gen_salt('bf')), NOW(), NOW(), NOW(), NOW(), '', FALSE, '{"provider": "email", "providers": ["email"], "role": "admin"}'::jsonb, '{"nombre": "Admin", "username": "maketo", "role": "admin"}'::jsonb);
        ELSE
            UPDATE auth.users SET
                email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
                raw_app_meta_data = COALESCE(raw_app_meta_data, '{"provider": "email", "providers": ["email"], "role": "admin"}'::jsonb) || '{"role": "admin"}'::jsonb,
                raw_user_meta_data = COALESCE(raw_user_meta_data, '{"nombre": "Admin", "username": "maketo", "role": "admin"}'::jsonb),
                updated_at = NOW()
            WHERE id = v_admin_id;
        END IF;
    END IF;

    -- Operador: asegurar existencia en auth.users
    IF v_op_id IS NOT NULL THEN
        SELECT id INTO v_auth_id FROM auth.users WHERE id = v_op_id LIMIT 1;
        IF v_auth_id IS NULL THEN
            RAISE NOTICE 'Operador auth.users faltante. Creando placeholder (requiere password reset).';
            INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_sent_at, created_at, updated_at, confirmation_token, is_super_admin, raw_app_meta_data, raw_user_meta_data)
            VALUES (v_op_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_op_email, crypt('TEMP_RESET_REQUIRED', gen_salt('bf')), NOW(), NOW(), NOW(), NOW(), '', FALSE, '{"provider": "email", "providers": ["email"], "role": "operator"}'::jsonb, '{"nombre": "Market Coffee", "username": "marketcoffee", "role": "operator"}'::jsonb);
        ELSE
            UPDATE auth.users SET
                email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
                raw_app_meta_data = COALESCE(raw_app_meta_data, '{"provider": "email", "providers": ["email"], "role": "operator"}'::jsonb) || '{"role": "operator"}'::jsonb,
                raw_user_meta_data = COALESCE(raw_user_meta_data, '{"nombre": "Market Coffee", "username": "marketcoffee", "role": "operator"}'::jsonb),
                updated_at = NOW()
            WHERE id = v_op_id;
        END IF;
    END IF;
END $$;

-- ============================================================================
-- 3. Verificación
-- ============================================================================
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
