-- ═══════════════════════════════════════════════════════════════════════════
-- 41. SINCRONIZAR admin_users → auth.users (SIN contraseñas temporales)
-- PROPÓSITO: Asegurar que TODOS los admin_users tengan auth.users correcto
--            para que signInWithPassword funcione con la contraseña YA existente.
-- OPERADOR = mismos privilegios que admin, solo se ocultan pestañas técnicas.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ═══ PASS 1: Fix login_seguro — agregar validación de contraseña ═══
CREATE OR REPLACE FUNCTION public.login_seguro(
    p_identifier TEXT,
    p_password TEXT,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_record RECORD;
    v_password_hash TEXT;
    v_is_valid BOOLEAN;
    v_now TIMESTAMPTZ := NOW();
    v_lockout_duration INTERVAL := INTERVAL '15 minutes';
    v_max_attempts INTEGER := 5;
    v_failed_count INTEGER;
    v_locked_until TIMESTAMPTZ;
    v_user_email TEXT;
    v_is_email BOOLEAN;
BEGIN
    v_is_email := p_identifier LIKE '%@%';

    IF v_is_email THEN
        SELECT id, email, username, nombre, role, active, sede_id
        INTO v_user_record
        FROM admin_users
        WHERE email = p_identifier
        LIMIT 1;
    ELSE
        SELECT id, email, username, nombre, role, active, sede_id
        INTO v_user_record
        FROM admin_users
        WHERE username = p_identifier
          AND active = true
        LIMIT 1;
    END IF;

    IF v_user_record IS NULL THEN
        INSERT INTO security_audit_logs (event_type, identifier, ip_address, user_agent, metadata)
        VALUES ('login_failed', p_identifier, p_ip_address, p_user_agent,
                jsonb_build_object('reason', 'user_not_found'));
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Credenciales incorrectas.',
            'locked', false,
            'attempts_remaining', v_max_attempts
        );
    END IF;

    v_user_email := v_user_record.email;

    SELECT COUNT(*) INTO v_failed_count
    FROM security_audit_logs
    WHERE identifier = v_user_email
      AND event_type = 'login_failed'
      AND created_at > v_now - v_lockout_duration;

    IF v_failed_count >= v_max_attempts THEN
        SELECT MAX(created_at) + v_lockout_duration INTO v_locked_until
        FROM security_audit_logs
        WHERE identifier = v_user_email
          AND event_type = 'login_failed'
          AND created_at > v_now - v_lockout_duration;

        INSERT INTO security_audit_logs (event_type, identifier, ip_address, user_agent, metadata)
        VALUES ('login_blocked', p_identifier, p_ip_address, p_user_agent,
                jsonb_build_object('reason', 'account_locked', 'failed_attempts', v_failed_count, 'locked_until', v_locked_until));

        RETURN jsonb_build_object(
            'success', false,
            'error', 'Cuenta bloqueada temporalmente. Intente de nuevo en ' ||
                     EXTRACT(EPOCH FROM (v_locked_until - v_now))::INTEGER / 60 || ' minutos.',
            'locked', true,
            'locked_until', v_locked_until,
            'attempts_remaining', 0
        );
    END IF;

    SELECT encrypted_password INTO v_password_hash
    FROM auth.users
    WHERE id = v_user_record.id;

    IF v_password_hash IS NULL THEN
        INSERT INTO security_audit_logs (event_type, identifier, ip_address, user_agent, metadata)
        VALUES ('login_failed', p_identifier, p_ip_address, p_user_agent,
                jsonb_build_object('reason', 'no_auth_user', 'admin_user_id', v_user_record.id));
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Credenciales incorrectas.',
            'locked', false,
            'attempts_remaining', v_max_attempts - v_failed_count
        );
    END IF;

    -- CRÍTICO: Validar contraseña con crypt()
    v_is_valid := (v_password_hash = crypt(p_password, v_password_hash));

    IF NOT v_is_valid THEN
        INSERT INTO security_audit_logs (event_type, identifier, ip_address, user_agent, metadata)
        VALUES ('login_failed', p_identifier, p_ip_address, p_user_agent,
                jsonb_build_object(
                    'reason', 'invalid_password',
                    'attempt_number', v_failed_count + 1,
                    'user_email', v_user_email,
                    'user_role', v_user_record.role
                ));

        IF v_failed_count + 1 >= v_max_attempts THEN
            INSERT INTO security_audit_logs (event_type, identifier, ip_address, user_agent, metadata)
            VALUES ('account_locked', p_identifier, p_ip_address, p_user_agent,
                    jsonb_build_object(
                        'reason', 'max_attempts_reached',
                        'total_failures', v_failed_count + 1,
                        'lockout_minutes', 15
                    ));
        END IF;

        RETURN jsonb_build_object(
            'success', false,
            'error', 'Credenciales incorrectas.',
            'locked', false,
            'attempts_remaining', GREATEST(0, v_max_attempts - v_failed_count - 1)
        );
    END IF;

    INSERT INTO security_audit_logs (event_type, identifier, ip_address, user_agent, metadata)
    VALUES ('login_success', p_identifier, p_ip_address, p_user_agent,
            jsonb_build_object('user_id', v_user_record.id, 'role', v_user_record.role, 'username', v_user_record.username));

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_record.id,
        'email', v_user_record.email,
        'username', v_user_record.username,
        'nombre', v_user_record.nombre,
        'role', v_user_record.role,
        'active', v_user_record.active,
        'sede_id', COALESCE(v_user_record.sede_id, ''),
        'locked', false,
        'attempts_remaining', v_max_attempts
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.login_seguro TO anon;
GRANT EXECUTE ON FUNCTION public.login_seguro TO authenticated;


-- ═══ PASS 2: Sincronizar SOLO metadata de auth.users existentes ═══
-- NO crea auth users nuevos ni cambia contraseñas.
-- Solo actualiza role, nombre, username en raw_app_meta_data y raw_user_meta_data.
DO $$
DECLARE
    v_record RECORD;
    v_auth_exists BOOLEAN;
    v_synced INTEGER := 0;
    v_missing INTEGER := 0;
BEGIN
    FOR v_record IN
        SELECT id, email, username, nombre, role, active
        FROM admin_users
    LOOP
        SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = v_record.id) INTO v_auth_exists;

        IF v_auth_exists THEN
            -- Auth user existe — sincronizar metadata (role, nombre, username)
            UPDATE auth.users
            SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', v_record.role),
                raw_user_meta_data = raw_user_meta_data ||
                    jsonb_build_object('role', v_record.role, 'nombre', v_record.nombre, 'username', v_record.username),
                email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
                updated_at = NOW()
            WHERE id = v_record.id;

            v_synced := v_synced + 1;
            RAISE NOTICE '✅ Auth user sincronizado: % (role: %)', v_record.email, v_record.role;
        ELSE
            -- Auth user NO existe — registrar para que admin resetee desde panel
            v_missing := v_missing + 1;
            RAISE WARNING '⚠️ Auth user FALTA: % (%). Resetear contraseña desde el panel de administración.', v_record.email, v_record.role;
        END IF;
    END LOOP;

    RAISE NOTICE '═══ Sync completado: % sincronizados, % sin auth user (resetear desde panel) ═══', v_synced, v_missing;
END $$;


-- ═══ PASS 3: Verificación ═══
SELECT
    a.id,
    a.email,
    a.username,
    a.role,
    a.active,
    CASE WHEN u.id IS NOT NULL THEN '✅' ELSE '❌ FALTA — resetear desde panel' END AS auth_user_status,
    CASE WHEN u.encrypted_password IS NOT NULL THEN '✅' ELSE '❌' END AS tiene_password,
    u.raw_app_meta_data->>'role' AS auth_role
FROM admin_users a
LEFT JOIN auth.users u ON u.id = a.id
ORDER BY a.role, a.email;
