-- ═══════════════════════════════════════════════════════════════════════════
-- 43. FIX COMPLETO: Auth users + Trigger + Credenciales
-- ERROR: "Database error querying schema" en signInWithPassword
-- CAUSA: Trigger handle_auth_user_created falla al insertar en usuarios_clientes
-- EJECUTAR EN: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Habilitar pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- 2. Deshabilitar el trigger temporalmente para evitar conflictos
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Limpiar registros conflictivos en usuarios_clientes para admin/operador
DELETE FROM usuarios_clientes
WHERE email IN ('kecho8a@gmail.com', 'marketcoffe.ve@gmail.com');

-- 4. Recrear el trigger con manejo de errores (no falla si la tabla no existe)
CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS TRIGGER
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_welcome_bonus int;
    v_enabled boolean;
BEGIN
    -- Intentar insertar en usuarios_clientes (puede fallar si la tabla no tiene las columnas)
    BEGIN
        INSERT INTO public.usuarios_clientes (id, nombre, email, telefono)
        VALUES (
            NEW.id::text,
            COALESCE(NEW.raw_user_meta_data->>'nombre', 'Usuario Nuevo'),
            NEW.email,
            NULLIF(COALESCE(NEW.raw_user_meta_data->>'telefono', ''), '')
        )
        ON CONFLICT (id) DO UPDATE SET
            nombre = COALESCE(EXCLUDED.nombre, usuarios_clientes.nombre),
            email = COALESCE(EXCLUDED.email, usuarios_clientes.email);
    EXCEPTION WHEN OTHERS THEN
        -- Si falla (columnas faltantes, etc.), no bloquear el login
        RAISE WARNING 'handle_auth_user_created: skip usuarios_clientes insert: %', SQLERRM;
    END;

    -- Welcome Bonus: otorgar puntos si loyalty está habilitado
    BEGIN
        SELECT enabled, welcome_bonus INTO v_enabled, v_welcome_bonus
        FROM loyalty_config WHERE id = 1;

        IF v_enabled AND COALESCE(v_welcome_bonus, 0) > 0 THEN
            UPDATE usuarios_clientes
            SET puntos_fidelidad = COALESCE(puntos_fidelidad, 0) + v_welcome_bonus,
                puntos_historicos = COALESCE(puntos_historicos, 0) + v_welcome_bonus,
                loyalty_points = COALESCE(loyalty_points, 0) + v_welcome_bonus,
                loyalty_lifetime_points = COALESCE(loyalty_lifetime_points, 0) + v_welcome_bonus
            WHERE id = NEW.id::text;

            INSERT INTO loyalty_history (user_id, points, operation, reason, description, created_by)
            VALUES (NEW.id::text, v_welcome_bonus, 'suma', 'bienvenida', 'Bonus de bienvenida', 'system')
            ON CONFLICT DO NOTHING;

            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loyalty_transactions') THEN
                INSERT INTO loyalty_transactions (user_id, type, points, description)
                VALUES (NEW.id::text, 'bonus', v_welcome_bonus, 'Bonus de bienvenida')
                ON CONFLICT DO NOTHING;
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'handle_auth_user_created: skip loyalty: %', SQLERRM;
    END;

    RETURN NEW;
END;
$$;

-- 5. Recrear el trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_created();

-- 6. Sincronizar auth users para admin y operador
DO $$
DECLARE
    v_admin_email TEXT := 'kecho8a@gmail.com';
    v_admin_password TEXT := 'kecho.180';
    v_op_email TEXT := 'marketcoffe.ve@gmail.com';
    v_op_password TEXT := 'market.2026';
    v_id UUID;
    v_hash TEXT;
BEGIN
    -- === ADMIN ===
    SELECT id INTO v_id FROM auth.users WHERE email = v_admin_email;

    IF v_id IS NOT NULL THEN
        -- Actualizar password y metadata
        v_hash := crypt(v_admin_password, gen_salt('bf'));
        UPDATE auth.users
        SET encrypted_password = v_hash,
            raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb,
            raw_user_meta_data = raw_user_meta_data || '{"nombre": "Admin", "username": "maketo", "role": "admin"}'::jsonb,
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            updated_at = NOW()
        WHERE id = v_id;
        RAISE NOTICE '✅ Admin actualizado: %', v_admin_email;
    ELSE
        -- Crear desde cero
        v_id := gen_random_uuid();
        v_hash := crypt(v_admin_password, gen_salt('bf'));
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password,
            email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
            created_at, updated_at
        ) VALUES (
            v_id, '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated',
            v_admin_email, v_hash, NOW(),
            '{"provider": "email", "providers": ["email"], "role": "admin"}'::jsonb,
            '{"nombre": "Admin", "username": "maketo", "role": "admin"}'::jsonb,
            NOW(), NOW()
        );
        RAISE NOTICE '✅ Admin creado: % (id: %)', v_admin_email, v_id;
    END IF;

    -- Sincronizar admin_users para admin
    INSERT INTO public.admin_users (id, email, username, nombre, role, active, created_at)
    VALUES (v_id, v_admin_email, 'maketo', 'Admin', 'admin', true, NOW())
    ON CONFLICT (id) DO UPDATE SET email = v_admin_email, username = 'maketo', role = 'admin', active = true;

    -- === OPERADOR ===
    SELECT id INTO v_id FROM auth.users WHERE email = v_op_email;

    IF v_id IS NOT NULL THEN
        v_hash := crypt(v_op_password, gen_salt('bf'));
        UPDATE auth.users
        SET encrypted_password = v_hash,
            raw_app_meta_data = raw_app_meta_data || '{"role": "operator"}'::jsonb,
            raw_user_meta_data = raw_user_meta_data || '{"nombre": "Market Coffee", "username": "marketcoffee", "role": "operator"}'::jsonb,
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            updated_at = NOW()
        WHERE id = v_id;
        RAISE NOTICE '✅ Operador actualizado: %', v_op_email;
    ELSE
        v_id := gen_random_uuid();
        v_hash := crypt(v_op_password, gen_salt('bf'));
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password,
            email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
            created_at, updated_at
        ) VALUES (
            v_id, '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated',
            v_op_email, v_hash, NOW(),
            '{"provider": "email", "providers": ["email"], "role": "operator"}'::jsonb,
            '{"nombre": "Market Coffee", "username": "marketcoffee", "role": "operator"}'::jsonb,
            NOW(), NOW()
        );
        RAISE NOTICE '✅ Operador creado: % (id: %)', v_op_email, v_id;
    END IF;

    -- Sincronizar admin_users para operador
    INSERT INTO public.admin_users (id, email, username, nombre, role, active, created_at)
    VALUES (v_id, v_op_email, 'marketcoffee', 'Market Coffee', 'operator', true, NOW())
    ON CONFLICT (id) DO UPDATE SET email = v_op_email, username = 'marketcoffee', role = 'operator', active = true;
END $$;

-- 7. Verificación
SELECT
    u.email,
    u.raw_app_meta_data->>'role' AS auth_role,
    a.username,
    a.role AS admin_role,
    a.active,
    CASE WHEN u.encrypted_password IS NOT NULL THEN '✅ Tiene password' ELSE '❌ Sin password' END AS password_status
FROM auth.users u
JOIN admin_users a ON a.id = u.id
WHERE u.email IN ('kecho8a@gmail.com', 'marketcoffe.ve@gmail.com')
ORDER BY u.email;
