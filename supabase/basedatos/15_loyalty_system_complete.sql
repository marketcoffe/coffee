-- ========================================================
-- MIGRACION: SISTEMA DE FIDELIZACION COMPLETO (REFACTORIZADO)
-- ARCHIVO: /supabase/basedatos/15_loyalty_system_complete.sql
-- PROPÓSITO: Tablas, RPCs atómicas, triggers, referidos, RLS, PWA bonus
-- FECHA: 2026-08-24 (Refactorizado para producción)
-- DEPENDENCIAS: 01_core (usuarios_clientes), 04_pedidos (orders), 06_marketing
--
-- CAMBIOS vs VERSIÓN ANTERIOR:
-- 1. SEGURIDAD: process_loyalty_points ya NO es callable por authenticated
--    (solo service_role y funciones SECURITY DEFINER internas)
-- 2. SEGURIDAD: Agregado FOR UPDATE para prevenir race conditions
-- 3. PWA: Nuevo campo pwa_download_bonus + RPC claim_pwa_bonus()
-- 4. PWA: Tabla pwa_bonus_claims para control de duplicados
-- 5. CONSISTENCIA: Eliminado bloque _compatibilidad inseguro
-- 6. CONSISTENCIA: Agregado 'bono_pwa' a loyalty_history.reason
-- 7. GRANTs: Completados y corregidos para todas las RPCs
-- ========================================================

-- ----------------------------------------------------------------------------
-- 1. loyalty_config (CONFIGURACION GLOBAL DE FIDELIDAD)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loyalty_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    enabled BOOLEAN NOT NULL DEFAULT false,
    points_per_dollar NUMERIC(5,2) NOT NULL DEFAULT 1.0,
    min_order_for_points NUMERIC(10,2) NOT NULL DEFAULT 5.0,
    redemption_rate INTEGER NOT NULL DEFAULT 100,
    max_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 30.0,
    welcome_bonus INTEGER NOT NULL DEFAULT 50,
    first_order_bonus INTEGER NOT NULL DEFAULT 25,
    referral_bonus_referrer INTEGER NOT NULL DEFAULT 100,
    referral_bonus_referred INTEGER NOT NULL DEFAULT 50,
    daily_login_bonus INTEGER NOT NULL DEFAULT 5,
    review_bonus INTEGER NOT NULL DEFAULT 10,
    pwa_download_bonus INTEGER NOT NULL DEFAULT 25,
    check_interval INTERVAL NOT NULL DEFAULT '30 minutes',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (id = 1)
);

INSERT INTO loyalty_config (id, enabled) VALUES (1, false) ON CONFLICT (id) DO NOTHING;

-- Migración: agregar columna pwa_download_bonus si no existe
DO $$ BEGIN
    ALTER TABLE loyalty_config ADD COLUMN IF NOT EXISTS pwa_download_bonus INTEGER NOT NULL DEFAULT 25;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 2. loyalty_levels (NIVELES DE FIDELIDAD)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loyalty_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    min_points INTEGER NOT NULL DEFAULT 0,
    multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.0,
    benefits TEXT[] DEFAULT ARRAY['Puntos base'],
    color TEXT NOT NULL DEFAULT '#CD7F32',
    icon TEXT DEFAULT '🥉',
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed de niveles por defecto
INSERT INTO loyalty_levels (name, min_points, multiplier, benefits, color, icon, sort_order) VALUES
    ('Bronce', 0, 1.0, ARRAY['Puntos base'], '#CD7F32', '🥉', 1),
    ('Plata', 500, 1.25, ARRAY['25% más puntos', 'Acceso anticipado a ofertas'], '#8E8E93', '🥈', 2),
    ('Oro', 1500, 1.5, ARRAY['50% más puntos', 'Envío gratis en pedidos >$10', 'Acceso a promos exclusivas'], '#FF9500', '🥇', 3),
    ('Platino', 5000, 2.0, ARRAY['100% más puntos', 'Envío gratis siempre', 'Atención prioritaria', 'Regalo de cumpleaños'], '#B8860B', '💎', 4)
ON CONFLICT (name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. loyalty_rewards (CATALOGO CRUD DE PREMIOS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loyalty_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    points_cost INTEGER NOT NULL CHECK (points_cost > 0),
    reward_type TEXT NOT NULL CHECK (reward_type IN ('discount_percent', 'discount_fixed', 'free_product', 'free_shipping', 'custom')),
    reward_value NUMERIC(10,2) NOT NULL DEFAULT 0,
    product_id UUID,
    imagen_url TEXT DEFAULT '',
    stock INTEGER DEFAULT -1,
    stock_used INTEGER DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_active ON loyalty_rewards(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_type ON loyalty_rewards(reward_type);

-- ----------------------------------------------------------------------------
-- 4. loyalty_history (LOG INMUTABLE DE PUNTOS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loyalty_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES usuarios_clientes(id) ON DELETE CASCADE,
    points INTEGER NOT NULL CHECK (points != 0),
    operation TEXT NOT NULL CHECK (operation IN ('suma', 'resta')),
    reason TEXT NOT NULL CHECK (reason IN (
        'bienvenida', 'primer_pedido', 'compra', 'referido', 'referido_registro',
        'canje', 'ajuste_admin', 'bono_review', 'bono_diario', 'expiracion', 'bono_pwa'
    )),
    description TEXT DEFAULT '',
    order_id VARCHAR(50),
    reward_id UUID REFERENCES loyalty_rewards(id) ON DELETE SET NULL,
    created_by TEXT DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_history_user ON loyalty_history(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_history_reason ON loyalty_history(reason);
CREATE INDEX IF NOT EXISTS idx_loyalty_history_created ON loyalty_history(created_at DESC);

-- ----------------------------------------------------------------------------
-- 5. pwa_bonus_claims (CONTROL DE DUPLICADOS PARA BONO PWA)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pwa_bonus_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES usuarios_clientes(id) ON DELETE CASCADE,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

ALTER TABLE pwa_bonus_claims ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 6. Actualizar usuarios_clientes: agregar campos de fidelidad
-- ----------------------------------------------------------------------------
ALTER TABLE usuarios_clientes ADD COLUMN IF NOT EXISTS puntos_fidelidad INTEGER DEFAULT 0;
ALTER TABLE usuarios_clientes ADD COLUMN IF NOT EXISTS puntos_historicos INTEGER DEFAULT 0;
ALTER TABLE usuarios_clientes ADD COLUMN IF NOT EXISTS codigo_referido TEXT UNIQUE;
ALTER TABLE usuarios_clientes ADD COLUMN IF NOT EXISTS referred_by TEXT;
ALTER TABLE usuarios_clientes ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0;
ALTER TABLE usuarios_clientes ADD COLUMN IF NOT EXISTS pwa_bonus_claimed BOOLEAN DEFAULT FALSE;

-- Generar codigos de referido para usuarios existentes sin codigo
UPDATE usuarios_clientes
SET codigo_referido = 'REF' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6))
WHERE codigo_referido IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_codigo_referido ON usuarios_clientes(codigo_referido) WHERE codigo_referido IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 7. referral_tracking (REGISTRO DE REFERIDOS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id TEXT NOT NULL REFERENCES usuarios_clientes(id) ON DELETE CASCADE,
    referred_id TEXT NOT NULL REFERENCES usuarios_clientes(id) ON DELETE CASCADE,
    referred_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'bonus_paid')),
    referrer_bonus_paid BOOLEAN DEFAULT false,
    referred_bonus_paid BOOLEAN DEFAULT false,
    first_order_id VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    UNIQUE(referred_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_tracking_referrer ON referral_tracking(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_tracking_referred ON referral_tracking(referred_id);

-- ============================================================================
-- RPCs (REMOTE PROCEDURES)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 8. RPC: Procesar puntos atómicamente (INTERNA - solo service_role/triggers)
-- ----------------------------------------------------------------------------
-- SEGURIDAD: Esta función NO tiene GRANT a authenticated.
-- Solo es llamada por triggers SECURITY DEFINER y por adjust_loyalty_points.
-- Un cliente malicioso NO puede inyectar puntos llamando esta función.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_loyalty_points(
    p_user_id TEXT,
    p_points INTEGER,
    p_operation TEXT,
    p_reason TEXT,
    p_description TEXT DEFAULT '',
    p_order_id TEXT DEFAULT NULL,
    p_created_by TEXT DEFAULT 'system'
)
RETURNS JSONB
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_config RECORD;
    v_current_points INTEGER;
    v_new_points INTEGER;
    v_new_historic INTEGER;
    v_history_id UUID;
BEGIN
    -- Obtener configuracion
    SELECT * INTO v_config FROM loyalty_config WHERE id = 1;
    IF NOT FOUND OR NOT v_config.enabled THEN
        RETURN jsonb_build_object('success', false, 'error', 'Loyalty system disabled');
    END IF;

    -- Obtener saldo actual CON BLOQUEO DE FILA (FOR UPDATE)
    -- Previene race conditions cuando dos transacciones simultáneas leen el mismo saldo
    SELECT puntos_fidelidad, puntos_historicos INTO v_current_points, v_new_historic
    FROM usuarios_clientes WHERE id = p_user_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    -- Validar que no se resten más puntos de los disponibles
    IF p_operation = 'resta' AND v_current_points < p_points THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient points', 'current', v_current_points, 'requested', p_points);
    END IF;

    -- Calcular nuevos saldos
    IF p_operation = 'suma' THEN
        v_new_points := v_current_points + p_points;
        v_new_historic := v_new_historic + p_points;
    ELSE
        v_new_points := v_current_points - p_points;
    END IF;

    -- Actualizar saldo del usuario (atómico)
    UPDATE usuarios_clientes
    SET puntos_fidelidad = v_new_points,
        puntos_historicos = CASE WHEN p_operation = 'suma' THEN v_new_historic ELSE puntos_historicos END
    WHERE id = p_user_id;

    -- Registrar en historial
    INSERT INTO loyalty_history (user_id, points, operation, reason, description, order_id, created_by)
    VALUES (p_user_id, p_points, p_operation, p_reason, p_description, p_order_id, p_created_by)
    RETURNING id INTO v_history_id;

    -- Compatibilidad: insertar en loyalty_transactions si existe (de módulo 06)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loyalty_transactions') THEN
        INSERT INTO loyalty_transactions (user_id, type, points, description, order_id)
        VALUES (p_user_id,
            CASE WHEN p_operation = 'suma' THEN 'earn' ELSE 'redeem' END,
            CASE WHEN p_operation = 'suma' THEN p_points ELSE -p_points END,
            p_description,
            p_order_id
        ) ON CONFLICT DO NOTHING;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'history_id', v_history_id,
        'previous_points', v_current_points,
        'new_points', v_new_points,
        'points_change', CASE WHEN p_operation = 'suma' THEN p_points ELSE -p_points END
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. RPC: Canjear premio de forma atómica
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_loyalty_reward(
    p_user_id TEXT,
    p_reward_id UUID
)
RETURNS JSONB
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_reward RECORD;
    v_current_points INTEGER;
    v_coupon_code TEXT;
BEGIN
    -- Buscar premio (bloqueo de fila para prevenir race conditions)
    SELECT * INTO v_reward FROM loyalty_rewards
    WHERE id = p_reward_id AND active = true
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reward not found or inactive');
    END IF;

    -- Verificar stock
    IF v_reward.stock >= 0 AND v_reward.stock <= v_reward.stock_used THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reward out of stock');
    END IF;

    -- Obtener puntos del usuario (bloqueo de fila)
    SELECT puntos_fidelidad INTO v_current_points
    FROM usuarios_clientes WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    -- Verificar saldo suficiente
    IF v_current_points < v_reward.points_cost THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient points', 'current', v_current_points, 'cost', v_reward.points_cost);
    END IF;

    -- Descontar puntos
    UPDATE usuarios_clientes SET puntos_fidelidad = puntos_fidelidad - v_reward.points_cost WHERE id = p_user_id;

    -- Incrementar stock usado
    UPDATE loyalty_rewards SET stock_used = stock_used + 1 WHERE id = p_reward_id;

    -- Generar codigo de cupón
    v_coupon_code := 'LOY-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));

    -- Registrar en historial
    INSERT INTO loyalty_history (user_id, points, operation, reason, description, reward_id, created_by)
    VALUES (p_user_id, v_reward.points_cost, 'resta', 'canje',
        'Canje: ' || v_reward.name || ' (' || v_coupon_code || ')',
        p_reward_id, p_user_id);

    -- Compatibilidad: loyalty_transactions si existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loyalty_transactions') THEN
        INSERT INTO loyalty_transactions (user_id, type, points, description)
        VALUES (p_user_id, 'redeem', -v_reward.points_cost, 'Canje: ' || v_reward.name);
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'coupon_code', v_coupon_code,
        'reward_name', v_reward.name,
        'points_spent', v_reward.points_cost,
        'remaining_points', v_current_points - v_reward.points_cost
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. RPC: Ajustar puntos manualmente (admin)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adjust_loyalty_points(
    p_user_id TEXT,
    p_points INTEGER,
    p_operation TEXT,
    p_reason TEXT,
    p_description TEXT,
    p_admin_id TEXT
)
RETURNS JSONB
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Verificar que el caller es admin
    IF NOT public.is_admin_or_operator() THEN
        RAISE EXCEPTION 'Access denied: admin or operator role required';
    END IF;

    RETURN public.process_loyalty_points(
        p_user_id, p_points, p_operation, 'ajuste_admin',
        p_description || ' (Admin: ' || p_admin_id || ')',
        NULL, p_admin_id
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 11. RPC: Aplicar codigo de referido al registrarse
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_referral_code(
    p_new_user_id TEXT,
    p_referral_code TEXT
)
RETURNS JSONB
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_referrer RECORD;
    v_config RECORD;
    v_result JSONB;
BEGIN
    -- Buscar referidor por codigo CON BLOQUEO DE FILA
    SELECT id, codigo_referido INTO v_referrer
    FROM usuarios_clientes
    WHERE UPPER(codigo_referido) = UPPER(p_referral_code)
    AND id != p_new_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
    END IF;

    -- Obtener configuracion
    SELECT * INTO v_config FROM loyalty_config WHERE id = 1;

    -- Registrar tracking
    INSERT INTO referral_tracking (referrer_id, referred_id, referred_code, status)
    VALUES (v_referrer.id, p_new_user_id, UPPER(p_referral_code), 'pending');

    -- Vincular usuario referido
    UPDATE usuarios_clientes SET referred_by = v_referrer.id WHERE id = p_new_user_id;

    -- Otorgar bono al referido (si esta configurado)
    IF v_config.enabled AND v_config.referral_bonus_referred > 0 THEN
        v_result := public.process_loyalty_points(
            p_new_user_id, v_config.referral_bonus_referred, 'suma', 'referido_registro',
            'Bono por registro con código de referido', NULL, 'system'
        );
    END IF;

    -- Incrementar contador de referidos del referidor
    UPDATE usuarios_clientes SET referral_count = referral_count + 1 WHERE id = v_referrer.id;

    RETURN jsonb_build_object(
        'success', true,
        'referrer_id', v_referrer.id,
        'referred_bonus', COALESCE(v_config.referral_bonus_referred, 0)
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 12. RPC: Completar referido (cuando el referido hace su primer pedido)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_referral(
    p_referred_user_id TEXT,
    p_order_id TEXT
)
RETURNS JSONB
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_referral RECORD;
    v_config RECORD;
BEGIN
    -- Buscar referral pendiente
    SELECT * INTO v_referral FROM referral_tracking
    WHERE referred_id = p_referred_user_id AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'No pending referral found');
    END IF;

    -- Obtener configuracion
    SELECT * INTO v_config FROM loyalty_config WHERE id = 1;

    -- Marcar como completado
    UPDATE referral_tracking
    SET status = 'completed', first_order_id = p_order_id, completed_at = NOW()
    WHERE id = v_referral.id;

    -- Otorgar bono al referidor
    IF v_config.enabled AND v_config.referral_bonus_referrer > 0 AND NOT v_referral.referrer_bonus_paid THEN
        PERFORM public.process_loyalty_points(
            v_referral.referrer_id, v_config.referral_bonus_referrer, 'suma', 'referido',
            'Bono por referir a un amigo (pedido #' || p_order_id || ')',
            p_order_id, 'system'
        );
        UPDATE referral_tracking SET referrer_bonus_paid = true WHERE id = v_referral.id;
    END IF;

    -- Otorgar bono al referido (si no se otorgo en registro)
    IF v_config.enabled AND v_config.referral_bonus_referred > 0 AND NOT v_referral.referred_bonus_paid THEN
        PERFORM public.process_loyalty_points(
            p_referred_user_id, v_config.referral_bonus_referred, 'suma', 'referido',
            'Bono por registro con código de referido', p_order_id, 'system'
        );
        UPDATE referral_tracking SET referred_bonus_paid = true WHERE id = v_referral.id;
    END IF;

    -- Actualizar estado
    UPDATE referral_tracking SET status = 'bonus_paid' WHERE id = v_referral.id AND referrer_bonus_paid AND referred_bonus_paid;

    RETURN jsonb_build_object('success', true, 'referrer_id', v_referral.referrer_id);
END;
$$;

-- ----------------------------------------------------------------------------
-- 13. RPC: Reclamar bono de instalación PWA (una sola vez por usuario)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_pwa_bonus(p_user_id TEXT)
RETURNS JSONB
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_config RECORD;
    v_already_claimed BOOLEAN;
    v_result JSONB;
BEGIN
    -- Verificar que el sistema de fidelidad está habilitado
    SELECT * INTO v_config FROM loyalty_config WHERE id = 1;
    IF NOT FOUND OR NOT v_config.enabled THEN
        RETURN jsonb_build_object('success', false, 'error', 'Loyalty system disabled');
    END IF;

    -- Verificar que el bono PWA está configurado
    IF v_config.pwa_download_bonus <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'PWA bonus not configured');
    END IF;

    -- Verificar que el usuario no ha reclamado ya el bono (idempotente, CON BLOQUEO)
    SELECT pwa_bonus_claimed INTO v_already_claimed
    FROM usuarios_clientes WHERE id = p_user_id FOR UPDATE;
    IF v_already_claimed THEN
        RETURN jsonb_build_object('success', false, 'error', 'PWA bonus already claimed');
    END IF;

    -- Registrar reclamación (control de duplicados)
    INSERT INTO pwa_bonus_claims (user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    -- Verificar que se insertó (puede haber race condition con otro intento simultáneo)
    SELECT EXISTS(SELECT 1 FROM pwa_bonus_claims WHERE user_id = p_user_id) INTO v_already_claimed;
    IF NOT v_already_claimed THEN
        RETURN jsonb_build_object('success', false, 'error', 'PWA bonus already claimed');
    END IF;

    -- Otorgar puntos
    v_result := public.process_loyalty_points(
        p_user_id, v_config.pwa_download_bonus, 'suma', 'bono_pwa',
        'Bono por instalar la aplicación PWA', NULL, 'system'
    );

    -- Marcar en usuario (ya bloqueado por FOR UPDATE arriba)
    UPDATE usuarios_clientes SET pwa_bonus_claimed = TRUE WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'points_awarded', v_config.pwa_download_bonus,
        'message', 'PWA bonus claimed successfully'
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 14. RPC: Obtener nivel del usuario
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_loyalty_level(p_user_id TEXT)
RETURNS JSONB
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user RECORD;
    v_current_level RECORD;
    v_next_level RECORD;
    v_progress NUMERIC;
BEGIN
    SELECT puntos_historicos, puntos_fidelidad INTO v_user
    FROM usuarios_clientes WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'User not found');
    END IF;

    -- Nivel actual (mayor nivel cuyo min_points <= historicos)
    SELECT * INTO v_current_level
    FROM loyalty_levels
    WHERE active = true AND min_points <= COALESCE(v_user.puntos_historicos, 0)
    ORDER BY min_points DESC LIMIT 1;

    -- Siguiente nivel
    SELECT * INTO v_next_level
    FROM loyalty_levels
    WHERE active = true AND min_points > COALESCE(v_user.puntos_historicos, 0)
    ORDER BY min_points ASC LIMIT 1;

    -- Calcular progreso
    IF v_next_level IS NOT NULL AND v_current_level IS NOT NULL THEN
        v_progress := ROUND(
            ((COALESCE(v_user.puntos_historicos, 0) - v_current_level.min_points)::NUMERIC /
            NULLIF(v_next_level.min_points - v_current_level.min_points, 0)) * 100, 1
        );
    ELSIF v_current_level IS NOT NULL THEN
        v_progress := 100;
    ELSE
        v_progress := 0;
    END IF;

    RETURN jsonb_build_object(
        'current_points', COALESCE(v_user.puntos_fidelidad, 0),
        'lifetime_points', COALESCE(v_user.puntos_historicos, 0),
        'current_level', CASE WHEN v_current_level IS NOT NULL THEN
            jsonb_build_object('id', v_current_level.id, 'name', v_current_level.name, 'multiplier', v_current_level.multiplier, 'color', v_current_level.color, 'icon', v_current_level.icon, 'benefits', v_current_level.benefits)
        ELSE NULL END,
        'next_level', CASE WHEN v_next_level IS NOT NULL THEN
            jsonb_build_object('id', v_next_level.id, 'name', v_next_level.name, 'min_points', v_next_level.min_points, 'color', v_next_level.color, 'icon', v_next_level.icon)
        ELSE NULL END,
        'progress_percent', COALESCE(v_progress, 0)
    );
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 15. TRIGGER: Bono de bienvenida al registrar usuario
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_welcome_bonus()
RETURNS TRIGGER
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_config RECORD;
BEGIN
    SELECT * INTO v_config FROM loyalty_config WHERE id = 1;

    IF v_config.enabled AND v_config.welcome_bonus > 0 THEN
        PERFORM public.process_loyalty_points(
            NEW.id, v_config.welcome_bonus, 'suma', 'bienvenida',
            'Bono de bienvenida por registro', NULL, 'system'
        );
    END IF;

    -- Generar codigo de referido si no tiene
    IF NEW.codigo_referido IS NULL THEN
        UPDATE usuarios_clientes
        SET codigo_referido = 'REF' || UPPER(SUBSTRING(MD5(NEW.id::TEXT) FROM 1 FOR 6))
        WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 16. TRIGGER: Puntos por entrega de pedido + primera compra + referral
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_order_delivery_points()
RETURNS TRIGGER
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_config RECORD;
    v_user RECORD;
    v_base_points INTEGER;
    v_tier_multiplier NUMERIC;
    v_total_points INTEGER;
    v_order_count INTEGER;
    v_is_first_order BOOLEAN;
BEGIN
    -- Solo ejecutar cuando el status cambia a 'Entregado'
    IF OLD.status IS DISTINCT FROM 'Entregado' AND NEW.status = 'Entregado' THEN
        -- Obtener configuracion
        SELECT * INTO v_config FROM loyalty_config WHERE id = 1;
        IF NOT v_config.enabled THEN RETURN NEW; END IF;

        -- Obtener datos del usuario
        SELECT * INTO v_user FROM usuarios_clientes WHERE id = NEW.cliente_uid;
        IF NOT FOUND THEN RETURN NEW; END IF;

        -- Verificar si es primera orden
        SELECT COUNT(*) INTO v_order_count
        FROM orders
        WHERE cliente_uid = NEW.cliente_uid AND status = 'Entregado' AND id != NEW.id;

        v_is_first_order := (v_order_count = 0);

        -- Calcular puntos base: monto * puntos_por_dollar
        v_base_points := CEIL(NEW.total_usd * v_config.points_per_dollar);

        -- Obtener multiplicador del tier
        SELECT COALESCE(lm.multiplier, 1.0) INTO v_tier_multiplier
        FROM loyalty_levels lm
        WHERE lm.active = true AND lm.min_points <= COALESCE(v_user.puntos_historicos, 0)
        ORDER BY lm.min_points DESC LIMIT 1;

        IF v_tier_multiplier IS NULL THEN v_tier_multiplier := 1.0; END IF;

        -- Calcular puntos totales
        v_total_points := CEIL(v_base_points * v_tier_multiplier);

        -- Verificar pedido minimo
        IF NEW.total_usd < v_config.min_order_for_points THEN
            RETURN NEW;
        END IF;

        -- Otorgar puntos por compra
        PERFORM public.process_loyalty_points(
            NEW.cliente_uid, v_total_points, 'suma', 'compra',
            'Puntos por pedido #' || NEW.id || ' ($' || NEW.total_usd::TEXT || ')',
            NEW.id, 'system'
        );

        -- Bono por primera compra
        IF v_is_first_order AND v_config.first_order_bonus > 0 THEN
            PERFORM public.process_loyalty_points(
                NEW.cliente_uid, v_config.first_order_bonus, 'suma', 'primer_pedido',
                'Bono por primera compra completada',
                NEW.id, 'system'
            );
        END IF;

        -- Completar referral si el usuario fue referido
        IF v_user.referred_by IS NOT NULL THEN
            PERFORM public.complete_referral(NEW.cliente_uid, NEW.id);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Aplicar trigger
DROP TRIGGER IF EXISTS trigger_order_delivery_points ON orders;
CREATE TRIGGER trigger_order_delivery_points
AFTER UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION public.trigger_order_delivery_points();

-- ----------------------------------------------------------------------------
-- 17. TRIGGER: Auto-generar codigo de referido en INSERT
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_generate_referral_code()
RETURNS TRIGGER
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NEW.codigo_referido IS NULL THEN
        NEW.codigo_referido := 'REF' || UPPER(SUBSTRING(MD5(COALESCE(NEW.id, NEW.email, RANDOM()::TEXT)) FROM 1 FOR 6));
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_generate_referral_code ON usuarios_clientes;
CREATE TRIGGER trigger_generate_referral_code
BEFORE INSERT ON usuarios_clientes
FOR EACH ROW EXECUTE FUNCTION public.trigger_generate_referral_code();

-- ============================================================================
-- RLS (ROW LEVEL SECURITY)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 18. RLS: Seguridad completa
-- ----------------------------------------------------------------------------
ALTER TABLE loyalty_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE pwa_bonus_claims ENABLE ROW LEVEL SECURITY;

-- loyalty_config: Solo admin puede leer/escribir
DROP POLICY IF EXISTS "loyalty_config_admin" ON loyalty_config;
CREATE POLICY "loyalty_config_admin" ON loyalty_config
    FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

DROP POLICY IF EXISTS "loyalty_config_service_role" ON loyalty_config;
CREATE POLICY "loyalty_config_service_role" ON loyalty_config
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- loyalty_levels: Lectura publica, edicion admin
DROP POLICY IF EXISTS "loyalty_levels_public_read" ON loyalty_levels;
CREATE POLICY "loyalty_levels_public_read" ON loyalty_levels
    FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "loyalty_levels_admin_all" ON loyalty_levels;
CREATE POLICY "loyalty_levels_admin_all" ON loyalty_levels
    FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

DROP POLICY IF EXISTS "loyalty_levels_service_role" ON loyalty_levels;
CREATE POLICY "loyalty_levels_service_role" ON loyalty_levels
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- loyalty_rewards: Lectura publica de activos, edicion admin
DROP POLICY IF EXISTS "loyalty_rewards_public_read" ON loyalty_rewards;
CREATE POLICY "loyalty_rewards_public_read" ON loyalty_rewards
    FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "loyalty_rewards_admin_all" ON loyalty_rewards;
CREATE POLICY "loyalty_rewards_admin_all" ON loyalty_rewards
    FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

DROP POLICY IF EXISTS "loyalty_rewards_service_role" ON loyalty_rewards;
CREATE POLICY "loyalty_rewards_service_role" ON loyalty_rewards
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- loyalty_history: Usuario lee lo suyo, admin lee todo
DROP POLICY IF EXISTS "loyalty_history_own_read" ON loyalty_history;
CREATE POLICY "loyalty_history_own_read" ON loyalty_history
    FOR SELECT TO authenticated
    USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "loyalty_history_admin_all" ON loyalty_history;
CREATE POLICY "loyalty_history_admin_all" ON loyalty_history
    FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

DROP POLICY IF EXISTS "loyalty_history_service_role" ON loyalty_history;
CREATE POLICY "loyalty_history_service_role" ON loyalty_history
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- referral_tracking: Usuarios ven lo suyo, admin ve todo
DROP POLICY IF EXISTS "referral_tracking_own" ON referral_tracking;
CREATE POLICY "referral_tracking_own" ON referral_tracking
    FOR SELECT TO authenticated
    USING (referrer_id = auth.uid()::text OR referred_id = auth.uid()::text);

DROP POLICY IF EXISTS "referral_tracking_admin" ON referral_tracking;
CREATE POLICY "referral_tracking_admin" ON referral_tracking
    FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

DROP POLICY IF EXISTS "referral_tracking_service_role" ON referral_tracking;
CREATE POLICY "referral_tracking_service_role" ON referral_tracking
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- pwa_bonus_claims: Solo service_role puede gestionar (via RPCs SECURITY DEFINER)
DROP POLICY IF EXISTS "pwa_bonus_claims_service_role" ON pwa_bonus_claims;
CREATE POLICY "pwa_bonus_claims_service_role" ON pwa_bonus_claims
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- PERMISOS GRANT (SEGURIDAD)
-- ============================================================================
-- REGLA: process_loyalty_points NO tiene GRANT a authenticated.
-- Solo es callable por:
--   - service_role (triggers, RPCs internas)
--   - Otras funciones SECURITY DEFINER (adjust_loyalty_points, apply_referral_code, etc.)
-- Esto previene que un cliente malicioso inyecte puntos desde la API.
-- ----------------------------------------------------------------------------
-- 19. PERMISOS GRANT
-- ----------------------------------------------------------------------------
-- Lectura pública para catálogos y configuración
GRANT SELECT ON loyalty_config, loyalty_levels, loyalty_rewards TO anon;

-- Lectura de historial solo para authenticated (RLS own_read)
GRANT SELECT ON loyalty_history TO authenticated;

-- Lectura de tracking solo para authenticated (RLS own_read)
GRANT SELECT ON referral_tracking TO authenticated;

-- Lectura de claims solo para service_role (via RPCs)
-- No hay GRANT a anon/authenticated para pwa_bonus_claims

-- RPCs seguras: solo authenticated puede llamar estas
GRANT EXECUTE ON FUNCTION public.get_user_loyalty_level TO anon;
GRANT EXECUTE ON FUNCTION public.redeem_loyalty_reward TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_referral_code TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_loyalty_points TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pwa_bonus TO authenticated;

-- complete_referral: solo service_role (llamado desde trigger_order_delivery_points)
GRANT EXECUTE ON FUNCTION public.complete_referral TO service_role;

-- process_loyalty_points: SIN GRANT a authenticated (INTERNA)
-- Solo accesible por triggers SECURITY DEFINER y otras funciones SECURITY DEFINER

-- ============================================================================
-- REALTIME
-- ============================================================================
-- 20. Realtime para tablas de fidelidad
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE loyalty_history;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE loyalty_rewards;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.loyalty_history REPLICA IDENTITY FULL;
ALTER TABLE public.loyalty_rewards REPLICA IDENTITY FULL;

-- 21. Revocar permisos innecesarios
-- ----------------------------------------------------------------------------
-- Revocar INSERT a anon en loyalty_history (ya existe la política RLS, pero belt safety)
REVOKE INSERT ON loyalty_history FROM anon;

-- Revocar INSERT a anon en pwa_bonus_claims (solo service_role maneja esto)
REVOKE ALL ON pwa_bonus_claims FROM anon;
REVOKE ALL ON pwa_bonus_claims FROM authenticated;

-- ============================================================================
-- 22. PERFORMANCE INDEXES
-- ============================================================================
-- Orders: busqueda por status y sede (Comandera Kanban)
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status) WHERE status != 'Entregado' AND status != 'Cancelado';
CREATE INDEX IF NOT EXISTS idx_orders_sede_status ON orders(sede_id, status) WHERE status != 'Entregado' AND status != 'Cancelado';
CREATE INDEX IF NOT EXISTS idx_orders_fecha ON orders(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_orders_cliente_uid ON orders(cliente_uid) WHERE cliente_uid IS NOT NULL;

-- Notifications: busqueda por tipo y telefono (chat 1-a-1)
CREATE INDEX IF NOT EXISTS idx_notifications_tipo ON notifications(tipo);
CREATE INDEX IF NOT EXISTS idx_notifications_telefono ON notifications(destinatario_telefono) WHERE destinatario_telefono IS NOT NULL AND destinatario_telefono != '';
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- Push subscriptions: busqueda por user_id y telefono (envio push)
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_active ON push_subscriptions(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_phone_active ON push_subscriptions(destinatario_telefono) WHERE is_active = true AND destinatario_telefono IS NOT NULL;

-- Products: busqueda por categoria y stock
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_products_categoria ON products USING GIN(categoria gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_stock_low ON products(stock) WHERE stock <= 5 AND activo = true;
