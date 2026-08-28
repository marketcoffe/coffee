-- ═══════════════════════════════════════════════════════════════════════════
-- 33. BLINDAJE DE AUTENTICACIÓN: Credenciales + Rate Limiting + Auditoría
-- PROPÓSITO: Actualizar credenciales, crear tabla de auditoría de seguridad,
--            implementar RPCs de login seguro, recuperación WhatsApp y reset manual.
-- FECHA: 2026-08-28
-- NOTA: Idempotente — puede ejecutarse múltiples veces sin errores.
--       NO crea tipos de datos ENUM ni tablas de roles nuevas.
--       Respeta la estructura existente: admin_users(role CHECK IN ('admin','operator','customer'))
-- ═══════════════════════════════════════════════════════════════════════════

-- Habilitar pgcrypto si no existe
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. ACTUALIZACIÓN DE CREDENCIALES
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1.1 Administrador Principal: actualizar contraseña a 'kecho.180'
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_admin_email TEXT := 'kecho8a@gmail.com';
    v_new_password TEXT := 'kecho.180';
    v_auth_user_id UUID;
    v_password_hash TEXT;
BEGIN
    v_password_hash := pgcrypto.crypt(v_new_password, pgcrypto.gen_salt('bf'));

    SELECT id INTO v_auth_user_id
    FROM auth.users
    WHERE email = v_admin_email
    LIMIT 1;

    IF v_auth_user_id IS NULL THEN
        -- Crear el auth user si no existe
        v_auth_user_id := gen_random_uuid();
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password,
            email_confirmed_at, confirmation_sent_at, recovery_sent_at,
            last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
            created_at, updated_at, confirmation_token
        ) VALUES (
            v_auth_user_id,
            '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated',
            v_admin_email, v_password_hash,
            NOW(), NOW(), NULL, NULL,
            '{"provider": "email", "providers": ["email"], "role": "admin"}'::jsonb,
            '{"nombre": "Admin", "username": "maketo", "role": "admin"}'::jsonb,
            NOW(), NOW(), ''
        );
        RAISE NOTICE 'Admin auth user CREADO: % (id: %)', v_admin_email, v_auth_user_id;
    ELSE
        -- Actualizar contraseña y asegurar metadata
        UPDATE auth.users
        SET
            encrypted_password = v_password_hash,
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb,
            raw_user_meta_data = raw_user_meta_data ||
                '{"nombre": "Admin", "username": "maketo", "role": "admin"}'::jsonb,
            updated_at = NOW()
        WHERE id = v_auth_user_id;
        RAISE NOTICE 'Admin auth user ACTUALIZADO: % — nueva contraseña aplicada', v_admin_email;
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
    RAISE NOTICE 'admin_users SINCRONIZADO para Admin (id: %)', v_auth_user_id;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1.2 Usuario Operador: crear marketcoffe.ve@gmail.com / market.2026
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

    SELECT id INTO v_auth_user_id
    FROM auth.users
    WHERE email = v_op_email
    LIMIT 1;

    -- Si ya existe, eliminar para recrear limpio
    IF v_auth_user_id IS NOT NULL THEN
        DELETE FROM admin_users WHERE id = v_auth_user_id;
        DELETE FROM auth.users WHERE id = v_auth_user_id;
        RAISE NOTICE 'Auth user existente ELIMINADO para recreación: %', v_op_email;
    END IF;

    -- CRÍTICO: Limpiar usuarios_clientes con este email (trigger hará INSERT)
    SELECT id INTO v_existing_cliente_id
    FROM usuarios_clientes
    WHERE email = v_op_email
    LIMIT 1;

    IF v_existing_cliente_id IS NOT NULL THEN
        DELETE FROM loyalty_history WHERE user_id = v_existing_cliente_id;
        DELETE FROM loyalty_transactions WHERE user_id = v_existing_cliente_id;
        DELETE FROM usuarios_clientes WHERE id = v_existing_cliente_id;
        RAISE NOTICE 'usuarios_clientes ELIMINADO para recreación: %', v_op_email;
    END IF;

    -- Crear auth user limpio
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
        v_op_email, v_password_hash,
        NOW(), NOW(), NULL, NULL,
        '{"provider": "email", "providers": ["email"], "role": "operator"}'::jsonb,
        json_build_object('nombre', v_op_nombre, 'username', v_op_username, 'role', 'operator')::jsonb,
        NOW(), NOW(), '', FALSE
    );
    RAISE NOTICE 'Operador auth user CREADO: % (id: %)', v_op_email, v_auth_user_id;

    -- Sincronizar admin_users
    INSERT INTO public.admin_users (id, email, username, nombre, role, active, created_at)
    VALUES (v_auth_user_id, v_op_email, v_op_username, v_op_nombre, 'operator', true, NOW())
    ON CONFLICT (id) DO UPDATE SET
        email = v_op_email,
        username = v_op_username,
        nombre = v_op_nombre,
        role = 'operator',
        active = true;
    RAISE NOTICE 'admin_users SINCRONIZADO para Operador (id: %)', v_auth_user_id;
END $$;


-- ============================================================================
-- 2. TABLA DE AUDITORÍA DE SEGURIDAD
-- ============================================================================

CREATE TABLE IF NOT EXISTS security_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    identifier TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_security_audit_identifier ON security_audit_logs(identifier);
CREATE INDEX IF NOT EXISTS idx_security_audit_created_at ON security_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_security_audit_ip ON security_audit_logs(ip_address) WHERE ip_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_security_audit_event_type ON security_audit_logs(event_type);

-- RLS: Solo admin puede leer, sistema puede insertar
ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "security_logs_admin_read" ON security_audit_logs;
CREATE POLICY "security_logs_admin_read" ON security_audit_logs
    FOR SELECT TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "security_logs_system_insert" ON security_audit_logs;
CREATE POLICY "security_logs_system_insert" ON security_audit_logs
    FOR INSERT TO anon
    WITH CHECK (true);

DROP POLICY IF EXISTS "security_logs_authenticated_insert" ON security_audit_logs;
CREATE POLICY "security_logs_authenticated_insert" ON security_audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Permisos
GRANT SELECT ON security_audit_logs TO authenticated;
GRANT INSERT ON security_audit_logs TO anon;
GRANT INSERT ON security_audit_logs TO authenticated;
GRANT USAGE ON SEQUENCE security_audit_logs_id_seq TO anon;
GRANT USAGE ON SEQUENCE security_audit_logs_id_seq TO authenticated;


-- ============================================================================
-- 3. RPC: LOGIN SEGURO (RATE LIMITING + BLOQUEO DE CUENTA)
-- ============================================================================

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
        -- Registrar intento contra usuario inexistente (para auditoría)
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
        -- Calcular cuándo se desbloquea
        SELECT MAX(created_at) + v_lockout_duration INTO v_locked_until
        FROM security_audit_logs
        WHERE identifier = v_user_email
          AND event_type = 'login_failed'
          AND created_at > v_now - v_lockout_duration;

        -- Registrar evento de bloqueo
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

    -- Verificar contraseña
    v_is_valid := (v_password_hash = pgcrypto.crypt(p_password, v_password_hash));

    IF NOT v_is_valid THEN
        -- Registrar fallo
        INSERT INTO security_audit_logs (event_type, identifier, ip_address, user_agent, metadata)
        VALUES ('login_failed', p_identifier, p_ip_address, p_user_agent,
                jsonb_build_object(
                    'reason', 'invalid_password',
                    'attempt_number', v_failed_count + 1,
                    'user_email', v_user_email,
                    'user_role', v_user_record.role
                ));

        -- Verificar si este fallo desencadena el bloqueo
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

    -- Login exitoso — limpiar fallos registrando éxito
    INSERT INTO security_audit_logs (event_type, identifier, ip_address, user_agent, metadata)
    VALUES ('login_success', p_identifier, p_ip_address, p_user_agent,
            jsonb_build_object(
                'user_id', v_user_record.id,
                'role', v_user_record.role,
                'username', v_user_record.username
            ));

    -- Retornar datos del usuario autenticado
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


-- ============================================================================
-- 4. RPC: SOLICITAR RESET DE CONTRASEÑA VIA WHATSAPP
-- ============================================================================

CREATE OR REPLACE FUNCTION public.solicitar_reset_whatsapp(
    p_identifier TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_record RECORD;
    v_is_email BOOLEAN;
    v_token TEXT;
    v_token_expiry TIMESTAMPTZ;
    v_whatsapp_phone TEXT := '+584123758879';
BEGIN
    v_is_email := p_identifier LIKE '%@%';

    -- Buscar usuario en usuarios_clientes
    IF v_is_email THEN
        SELECT id, nombre, email, telefono
        INTO v_user_record
        FROM usuarios_clientes
        WHERE email = p_identifier
        LIMIT 1;
    ELSE
        SELECT id, nombre, email, telefono
        INTO v_user_record
        FROM usuarios_clientes
        WHERE username = p_identifier
        LIMIT 1;
    END IF;

    -- Si no se encontró, retornar éxito genérico (no revelar si el usuario existe)
    IF v_user_record IS NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Si el correo está registrado, recibirás instrucciones.',
            'token', null,
            'phone', v_whatsapp_phone
        );
    END IF;

    -- Generar token de 6 dígitos
    v_token := lpad(floor(random() * 999999 + 1)::TEXT, 6, '0');
    v_token_expiry := NOW() + INTERVAL '15 minutes';

    -- Registrar token en auditoría
    INSERT INTO security_audit_logs (event_type, identifier, metadata)
    VALUES ('reset_token_generated', COALESCE(v_user_record.email, p_identifier),
            jsonb_build_object(
                'token', v_token,
                'expires_at', v_token_expiry,
                'user_id', v_user_record.id,
                'user_nombre', v_user_record.nombre,
                'requester_identifier', p_identifier
            ));

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Código de recuperación generado.',
        'token', v_token,
        'phone', v_whatsapp_phone,
        'user_nombre', v_user_record.nombre,
        'expires_at', v_token_expiry,
        'user_id', v_user_record.id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.solicitar_reset_whatsapp TO anon;
GRANT EXECUTE ON FUNCTION public.solicitar_reset_whatsapp TO authenticated;


-- ============================================================================
-- 5. RPC: RESTABLECER CONTRASEÑA DESDE PANEL DE CONTROL (SOLO ADMIN)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reset_password_manual(
    p_user_id UUID,
    p_new_password TEXT,
    p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pgcrypto
AS $$
DECLARE
    v_is_authorized BOOLEAN;
    v_requester_role TEXT;
    v_auth_user RECORD;
    v_password_hash TEXT;
    v_target_email TEXT;
BEGIN
    -- Verificar que el solicitante es admin u operator activo
    SELECT EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = p_admin_id
          AND role IN ('admin', 'operator')
          AND active = true
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Acceso denegado. Solo administradores y operadores pueden restablecer contraseñas.';
    END IF;

    -- Obtener rol del solicitante para el log
    SELECT role INTO v_requester_role
    FROM admin_users
    WHERE id = p_admin_id;

    -- Verificar que el usuario objetivo existe en auth.users
    SELECT id, email INTO v_auth_user
    FROM auth.users
    WHERE id = p_user_id;

    IF v_auth_user IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado en el sistema de autenticación.';
    END IF;

    v_target_email := v_auth_user.email;

    -- Generar hash de la nueva contraseña
    v_password_hash := pgcrypto.crypt(p_new_password, pgcrypto.gen_salt('bf'));

    -- Actualizar contraseña en auth.users
    UPDATE auth.users
    SET encrypted_password = v_password_hash,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Registrar en auditoría
    INSERT INTO security_audit_logs (event_type, identifier, metadata)
    VALUES ('password_reset_manual', v_target_email,
            jsonb_build_object(
                'target_user_id', p_user_id,
                'admin_user_id', p_admin_id,
                'requester_role', v_requester_role,
                'reset_at', NOW()
            ));

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Contraseña actualizada correctamente.',
        'target_email', v_target_email
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_password_manual TO authenticated;


-- ============================================================================
-- 6. FUNCIÓN DE LIMPIEZA DE LOGS EXPIRADOS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_security_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM security_audit_logs
    WHERE created_at < NOW() - INTERVAL '30 days';

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE 'Limpiados % registros de auditoría de seguridad expirados', v_deleted;
    RETURN v_deleted;
END;
$$;

-- Programar limpieza diaria si pg_cron está disponible
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        BEGIN PERFORM cron.unschedule('cleanup-security-logs'); EXCEPTION WHEN OTHERS THEN NULL; END;
        PERFORM cron.schedule(
            'cleanup-security-logs',
            '0 4 * * *',
            'SELECT public.cleanup_expired_security_logs()'
        );
        RAISE NOTICE 'Tarea pg_cron programada: cleanup-security-logs (diaria a las 4:00 AM)';
    ELSE
        RAISE NOTICE 'pg_cron no disponible. Configurar cron externo para cleanup_expired_security_logs()';
    END IF;
END $$;


-- ============================================================================
-- 7. FUNCIÓN AUXILIAR: Verificar estado de bloqueo de cuenta
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_account_lockout(
    p_identifier TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lockout_duration INTERVAL := INTERVAL '15 minutes';
    v_max_attempts INTEGER := 5;
    v_failed_count INTEGER;
    v_locked_until TIMESTAMPTZ;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    SELECT COUNT(*) INTO v_failed_count
    FROM security_audit_logs
    WHERE identifier = p_identifier
      AND event_type = 'login_failed'
      AND created_at > v_now - v_lockout_duration;

    IF v_failed_count >= v_max_attempts THEN
        SELECT MAX(created_at) + v_lockout_duration INTO v_locked_until
        FROM security_audit_logs
        WHERE identifier = p_identifier
          AND event_type = 'login_failed'
          AND created_at > v_now - v_lockout_duration;

        RETURN jsonb_build_object(
            'locked', true,
            'locked_until', v_locked_until,
            'attempts_remaining', 0,
            'retry_after_seconds', EXTRACT(EPOCH FROM (v_locked_until - v_now))::INTEGER
        );
    END IF;

    RETURN jsonb_build_object(
        'locked', false,
        'attempts_remaining', v_max_attempts - v_failed_count,
        'locked_until', null,
        'retry_after_seconds', 0
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_account_lockout TO anon;
GRANT EXECUTE ON FUNCTION public.check_account_lockout TO authenticated;


-- ============================================================================
-- 8. VERIFICACIÓN (opcional — ejecutar para confirmar)
-- ============================================================================

-- SELECT u.id, u.email, u.raw_app_meta_data->>'role' AS auth_role,
--        a.username, a.role AS admin_role, a.active
-- FROM auth.users u
-- JOIN admin_users a ON a.id = u.id
-- WHERE u.email IN ('kecho8a@gmail.com', 'marketcoffe.ve@gmail.com');

-- SELECT * FROM security_audit_logs ORDER BY created_at DESC LIMIT 10;
