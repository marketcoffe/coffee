-- ═══════════════════════════════════════════════════════════════════════════
-- 35. LOGIN SEGURO CLIENTES: Rate Limiting + Account Lockout + Auditoría (FIXED)
-- PROPÓSITO: Proteger login de clientes (usuarios_clientes) igual que admin/operator
-- FECHA: 2026-08-28
-- NOTA: Parámetros con DEFAULT al final para evitar error 42P13
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- RPC: LOGIN SEGURO CLIENTES (RATE LIMITING + BLOQUEO DE CUENTA + IP)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.login_seguro_cliente(
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
    v_max_ip_attempts INTEGER := 20;
    v_failed_count INTEGER;
    v_ip_failed_count INTEGER;
    v_locked_until TIMESTAMPTZ;
    v_user_email TEXT;
    v_is_email BOOLEAN;
    v_result JSONB;
BEGIN
    -- Determinar si el identifier es email o username
    v_is_email := p_identifier LIKE '%@%';

    -- Buscar usuario en usuarios_clientes
    IF v_is_email THEN
        SELECT id, nombre, email, telefono, username
        INTO v_user_record
        FROM usuarios_clientes
        WHERE email = p_identifier
        LIMIT 1;
    ELSE
        SELECT id, nombre, email, telefono, username
        INTO v_user_record
        FROM usuarios_clientes
        WHERE username = p_identifier
        LIMIT 1;
    END IF;

    -- Si no se encontró usuario
    IF v_user_record IS NULL THEN
        -- Registrar intento contra usuario inexistente (para auditoría)
        INSERT INTO security_audit_logs (event_type, identifier, ip_address, user_agent, metadata)
        VALUES ('client_login_failed', p_identifier, p_ip_address, p_user_agent,
                jsonb_build_object('reason', 'user_not_found'));

        RETURN jsonb_build_object(
            'success', false,
            'error', 'Credenciales incorrectas.',
            'locked', false,
            'attempts_remaining', v_max_attempts
        );
    END IF;

    v_user_email := v_user_record.email;

    -- Verificar si la cuenta está bloqueada (por cuenta)
    SELECT COUNT(*) INTO v_failed_count
    FROM security_audit_logs
    WHERE identifier = v_user_email
      AND event_type = 'client_login_failed'
      AND created_at > v_now - v_lockout_duration;

    -- Verificar rate limiting por IP
    IF p_ip_address IS NOT NULL THEN
        SELECT COUNT(*) INTO v_ip_failed_count
        FROM security_audit_logs
        WHERE ip_address = p_ip_address
          AND event_type = 'client_login_failed'
          AND created_at > v_now - v_lockout_duration;
    ELSE
        v_ip_failed_count := 0;
    END IF;

    -- Bloqueo por cuenta
    IF v_failed_count >= v_max_attempts THEN
        SELECT MAX(created_at) + v_lockout_duration INTO v_locked_until
        FROM security_audit_logs
        WHERE identifier = v_user_email
          AND event_type = 'client_login_failed'
          AND created_at > v_now - v_lockout_duration;

        INSERT INTO security_audit_logs (event_type, identifier, ip_address, user_agent, metadata)
        VALUES ('client_login_blocked', p_identifier, p_ip_address, p_user_agent,
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

    -- Bloqueo por IP (más permisivo)
    IF v_ip_failed_count >= v_max_ip_attempts THEN
        SELECT MAX(created_at) + v_lockout_duration INTO v_locked_until
        FROM security_audit_logs
        WHERE ip_address = p_ip_address
          AND event_type = 'client_login_failed'
          AND created_at > v_now - v_lockout_duration;

        INSERT INTO security_audit_logs (event_type, identifier, ip_address, user_agent, metadata)
        VALUES ('client_login_ip_blocked', p_identifier, p_ip_address, p_user_agent,
                jsonb_build_object(
                    'reason', 'ip_rate_limited',
                    'failed_attempts', v_ip_failed_count,
                    'locked_until', v_locked_until
                ));

        RETURN jsonb_build_object(
            'success', false,
            'error', 'Demasiados intentos desde esta IP. Intente de nuevo en ' ||
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
        VALUES ('client_login_failed', p_identifier, p_ip_address, p_user_agent,
                jsonb_build_object('reason', 'no_auth_user', 'client_id', v_user_record.id));

        RETURN jsonb_build_object(
            'success', false,
            'error', 'Credenciales incorrectas.',
            'locked', false,
            'attempts_remaining', v_max_attempts - v_failed_count
        );
    END IF;

    -- Verificar contraseña
    v_is_valid := (v_password_hash = pgcrypto.crypt(p_password, v_password_hash));

    IF NOT v_is_valid THEN
        -- Registrar fallo
        INSERT INTO security_audit_logs (event_type, identifier, ip_address, user_agent, metadata)
        VALUES ('client_login_failed', p_identifier, p_ip_address, p_user_agent,
                jsonb_build_object(
                    'reason', 'invalid_password',
                    'attempt_number', v_failed_count + 1,
                    'user_email', v_user_email,
                    'client_id', v_user_record.id
                ));

        -- Verificar si este fallo desencadena el bloqueo
        IF v_failed_count + 1 >= v_max_attempts THEN
            INSERT INTO security_audit_logs (event_type, identifier, ip_address, user_agent, metadata)
            VALUES ('client_account_locked', p_identifier, p_ip_address, p_user_agent,
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

    -- Login exitoso — registrar éxito
    INSERT INTO security_audit_logs (event_type, identifier, ip_address, user_agent, metadata)
    VALUES ('client_login_success', p_identifier, p_ip_address, p_user_agent,
            jsonb_build_object(
                'user_id', v_user_record.id,
                'email', v_user_email,
                'username', v_user_record.username
            ));

    -- Retornar datos del usuario autenticado
    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_record.id,
        'email', v_user_record.email,
        'username', v_user_record.username,
        'nombre', v_user_record.nombre,
        'telefono', v_user_record.telefono,
        'locked', false,
        'attempts_remaining', v_max_attempts
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.login_seguro_cliente TO anon;
GRANT EXECUTE ON FUNCTION public.login_seguro_cliente TO authenticated;


-- ============================================================================
-- RPC: CHECK ACCOUNT LOCKOUT CLIENTE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_client_account_lockout(
    p_identifier TEXT,
    p_ip_address INET DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lockout_duration INTERVAL := INTERVAL '15 minutes';
    v_max_attempts INTEGER := 5;
    v_max_ip_attempts INTEGER := 20;
    v_failed_count INTEGER;
    v_ip_failed_count INTEGER;
    v_locked_until TIMESTAMPTZ;
    v_now TIMESTAMPTZ := NOW();
    v_user_email TEXT;
    v_user_record RECORD;
    v_is_email BOOLEAN;
BEGIN
    v_is_email := p_identifier LIKE '%@%';

    -- Buscar email del usuario para verificar lockout por cuenta
    IF v_is_email THEN
        SELECT email INTO v_user_email
        FROM usuarios_clientes
        WHERE email = p_identifier
        LIMIT 1;
    ELSE
        SELECT email INTO v_user_email
        FROM usuarios_clientes
        WHERE username = p_identifier
        LIMIT 1;
    END IF;

    -- Si no existe el usuario, no hay lockout
    IF v_user_email IS NULL THEN
        RETURN jsonb_build_object(
            'locked', false,
            'attempts_remaining', v_max_attempts,
            'locked_until', null,
            'retry_after_seconds', 0
        );
    END IF;

    -- Verificar lockout por cuenta
    SELECT COUNT(*) INTO v_failed_count
    FROM security_audit_logs
    WHERE identifier = v_user_email
      AND event_type = 'client_login_failed'
      AND created_at > v_now - v_lockout_duration;

    -- Verificar lockout por IP
    IF p_ip_address IS NOT NULL THEN
        SELECT COUNT(*) INTO v_ip_failed_count
        FROM security_audit_logs
        WHERE ip_address = p_ip_address
          AND event_type = 'client_login_failed'
          AND created_at > v_now - v_lockout_duration;
    ELSE
        v_ip_failed_count := 0;
    END IF;

    -- Lockout por cuenta
    IF v_failed_count >= v_max_attempts THEN
        SELECT MAX(created_at) + v_lockout_duration INTO v_locked_until
        FROM security_audit_logs
        WHERE identifier = v_user_email
          AND event_type = 'client_login_failed'
          AND created_at > v_now - v_lockout_duration;

        RETURN jsonb_build_object(
            'locked', true,
            'locked_until', v_locked_until,
            'attempts_remaining', 0,
            'retry_after_seconds', EXTRACT(EPOCH FROM (v_locked_until - v_now))::INTEGER,
            'lockout_reason', 'account'
        );
    END IF;

    -- Lockout por IP
    IF v_ip_failed_count >= v_max_ip_attempts THEN
        SELECT MAX(created_at) + v_lockout_duration INTO v_locked_until
        FROM security_audit_logs
        WHERE ip_address = p_ip_address
          AND event_type = 'client_login_failed'
          AND created_at > v_now - v_lockout_duration;

        RETURN jsonb_build_object(
            'locked', true,
            'locked_until', v_locked_until,
            'attempts_remaining', 0,
            'retry_after_seconds', EXTRACT(EPOCH FROM (v_locked_until - v_now))::INTEGER,
            'lockout_reason', 'ip'
        );
    END IF;

    RETURN jsonb_build_object(
        'locked', false,
        'attempts_remaining', v_max_attempts - v_failed_count,
        'locked_until', null,
        'retry_after_seconds', 0,
        'ip_attempts_remaining', v_max_ip_attempts - v_ip_failed_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_client_account_lockout TO anon;
GRANT EXECUTE ON FUNCTION public.check_client_account_lockout TO authenticated;


-- ============================================================================
-- RPC: REGISTRO DE CLIENTE CON AUDITORÍA (PARÁMETROS CON DEFAULT AL FINAL)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.register_client_audit(
    p_email TEXT,
    p_username TEXT,
    p_success BOOLEAN,
    p_error TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO security_audit_logs (event_type, identifier, ip_address, user_agent, metadata)
    VALUES (
        CASE WHEN p_success THEN 'client_register_success' ELSE 'client_register_failed' END,
        p_email,
        p_ip_address,
        p_user_agent,
        jsonb_build_object(
            'username', p_username,
            'success', p_success,
            'error', p_error
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_client_audit TO anon;
GRANT EXECUTE ON FUNCTION public.register_client_audit TO authenticated;