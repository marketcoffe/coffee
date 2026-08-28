-- ============================================================================
-- FIX: login_seguro - Habilitar pgcrypto y corregir search_path
-- PROBLEMA: function crypt(text, text) does not exist
-- SOLUCIÓN: Asegurar pgcrypto habilitado y search_path correcto
-- ============================================================================

-- 1. Habilitar pgcrypto si no existe
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Verificar que crypt() funciona
SELECT crypt('test', gen_salt('bf')) as test_hash;

-- 3. Recrear login_seguro con search_path correcto (incluye pgcrypto implícito)
CREATE OR REPLACE FUNCTION public.login_seguro(
    p_identifier TEXT,
    p_password TEXT,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pgcrypto
AS $$
DECLARE
    v_user_record RECORD;
    v_auth_user RECORD;
    v_password_hash TEXT;
    v_is_valid BOOLEAN;
    v_now TIMESTAMPTZ := NOW();
    v_lockout_duration INTERVAL := INTERVAL '15 minutes';
    v_max_attempts INTEGER := 5;
    v_failed_count INTEGER;
    v_locked_until TIMESTAMPTZ;
    v_user_email TEXT;
    v_is_email BOOLEAN;
    v_result JSONB;
BEGIN
    -- Determinar si el identifier es email o username
    v_is_email := p_identifier LIKE '%@%';

    -- Buscar usuario en admin_users
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

    -- Si no se encontró usuario
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

    -- Verificar si la cuenta está bloqueada
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
                jsonb_build_object(
                    'reason', 'account_locked',
                    'failed_attempts', v_failed_count,
                    'locked_until', v_locked_until
                ));

        RETURN jsonb_build_object(
            'success', false,
            'error', 'Cuenta bloqueada temporalmente. Intente de nuevo en ' ||
                     EXTRACT(EPOCH FROM (v_locked_until - v_now))::INTEGER / 60 || ' minutos.',
            'locked', true,
            'locked_until', v_locked_until,
            'attempts_remaining', 0
        );
    END IF;

    -- Obtener hash de contraseña de auth.users
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

    -- Verificar contraseña usando crypt() directo (pgcrypto habilitado)
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

    -- Login exitoso
    INSERT INTO security_audit_logs (event_type, identifier, ip_address, user_agent, metadata)
    VALUES ('login_success', p_identifier, p_ip_address, p_user_agent,
            jsonb_build_object(
                'user_id', v_user_record.id,
                'role', v_user_record.role,
                'username', v_user_record.username
            ));

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

-- 4. Probar que funciona
-- SELECT public.login_seguro('kecho8a@gmail.com', 'kecho.180', '127.0.0.1', 'test-agent');