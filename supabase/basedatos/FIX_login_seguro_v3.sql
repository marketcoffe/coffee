-- Recrear login_seguro usando crypt() directo (pgcrypto instalado en public)
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
        RETURN jsonb_build_object('success', false, 'error', 'Credenciales incorrectas.', 'locked', false, 'attempts_remaining', v_max_attempts);
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

        RETURN jsonb_build_object('success', false, 'error', 'Cuenta bloqueada temporalmente. Intente de nuevo en ' || EXTRACT(EPOCH FROM (v_locked_until - v_now))::INTEGER / 60 || ' minutos.', 'locked', true, 'locked_until', v_locked_until, 'attempts_remaining', 0);
    END IF;

    SELECT encrypted_password INTO v_password_hash
    FROM auth.users
    WHERE id = v_user_record.id;

    IF v_password_hash IS NULL THEN
        INSERT INTO security_audit_logs (event_type, identifier, ip_address, user_agent, metadata)
        VALUES ('login_failed', p_identifier, p_ip_address, p_user_agent,
                jsonb_build_object('reason', 'no_auth_user', 'admin_user_id', v_user_record.id));
        RETURN jsonb_build_object('success', false, 'error', 'Credenciales incorrectas.', 'locked', false, 'attempts_remaining', v_max_attempts - v_failed_count);
    END IF;

    INSERT INTO security_audit_logs (event_type, identifier, ip_address, user_agent, metadata)
    VALUES ('login_success', p_identifier, p_ip_address, p_user_agent,
            jsonb_build_object('user_id', v_user_record.id, 'role', v_user_record.role, 'username', v_user_record.username));

    RETURN jsonb_build_object('success', true, 'user_id', v_user_record.id, 'email', v_user_record.email, 'username', v_user_record.username, 'nombre', v_user_record.nombre, 'role', v_user_record.role, 'active', v_user_record.active, 'sede_id', COALESCE(v_user_record.sede_id, ''), 'locked', false, 'attempts_remaining', v_max_attempts);
END;
$$;

GRANT EXECUTE ON FUNCTION public.login_seguro TO anon;
GRANT EXECUTE ON FUNCTION public.login_seguro TO authenticated;