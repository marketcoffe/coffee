-- ========================================================
-- MÓDULO: MARKETING, FIDELIZACIÓN Y CUPONES
-- ARCHIVO: /supabase/basedatos/06_marketing_fidelizacion_cupones.sql
-- PROPÓSITO: Puntos, niveles, promociones, ofertas flash, combos, segmentos, automatización
-- ÚLTIMA REVISIÓN: 2026-08-23
-- DEPENDENCIAS: 01_core (usuarios_clientes), 02_tienda (products), 04_pedidos (orders)
-- ========================================================

-- ----------------------------------------------------------------------------
-- 1. loyalty_transactions (TRANSACCIONES DE FIDELIDAD)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'earn',
    points INTEGER NOT NULL,
    description TEXT DEFAULT '',
    order_id VARCHAR(50),
    sede_id TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_loyalty_user ON loyalty_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_created ON loyalty_transactions(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_no_duplicate_order
    ON loyalty_transactions(user_id, order_id) WHERE order_id IS NOT NULL AND type = 'earn';

-- ----------------------------------------------------------------------------
-- 2. reward_catalog (CATÁLOGO DE RECOMPENSAS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reward_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    points_cost INTEGER NOT NULL,
    reward_type TEXT NOT NULL DEFAULT 'discount',
    reward_value NUMERIC(10,2) DEFAULT 0,
    product_id UUID,
    imagen_url TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 3. promotions (PROMOCIONES)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    image_url TEXT,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    discount_type TEXT NOT NULL DEFAULT 'percent',
    discount_value NUMERIC(10,2) DEFAULT 0,
    coupon_code TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    start_time TIME,
    end_time TIME,
    audience TEXT DEFAULT 'all',
    audience_config JSONB DEFAULT '{}'::JSONB,
    channel TEXT DEFAULT 'both',
    status TEXT DEFAULT 'draft',
    send_as_push BOOLEAN DEFAULT FALSE,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_promotions_status ON promotions(status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_promotions_product ON promotions(product_id);

-- ----------------------------------------------------------------------------
-- 4. customer_segments (SEGMENTACIÓN DE CLIENTES)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES usuarios_clientes(id) ON DELETE CASCADE,
    segment_key TEXT NOT NULL,
    segment_label TEXT NOT NULL,
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::JSONB,
    UNIQUE(user_id, segment_key)
);

CREATE INDEX IF NOT EXISTS idx_customer_segments_user ON customer_segments(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_segments_key ON customer_segments(segment_key);

-- ----------------------------------------------------------------------------
-- 5. automation_rules (REGLAS DE AUTOMATIZACIÓN)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    trigger_type TEXT NOT NULL,
    trigger_config JSONB NOT NULL DEFAULT '{}'::JSONB,
    action_type TEXT NOT NULL DEFAULT 'push',
    action_config JSONB NOT NULL DEFAULT '{}'::JSONB,
    cooldown_hours INTEGER DEFAULT 24,
    max_sends_per_user INTEGER DEFAULT 3,
    last_run_at TIMESTAMP WITH TIME ZONE,
    total_fired INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_slug ON automation_rules(slug);
CREATE INDEX IF NOT EXISTS idx_automation_rules_enabled ON automation_rules(enabled) WHERE enabled = true;

-- ----------------------------------------------------------------------------
-- 6. automation_log (HISTORIAL DE AUTOMATIZACIONES)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES automation_rules(id) ON DELETE SET NULL,
    rule_slug TEXT NOT NULL,
    user_id TEXT,
    trigger_event JSONB DEFAULT '{}'::JSONB,
    action_taken TEXT NOT NULL DEFAULT 'push_sent',
    notification_id TEXT,
    status TEXT NOT NULL DEFAULT 'sent',
    error_message TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_log_rule ON automation_log(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_log_user ON automation_log(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_log_created ON automation_log(created_at DESC);

-- ----------------------------------------------------------------------------
-- 7. campaigns (CAMPAÑAS MANUALES DEL ADMIN)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    channel TEXT NOT NULL DEFAULT 'push',
    segment_filter TEXT DEFAULT 'all',
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    image_url TEXT DEFAULT '',
    link_url TEXT DEFAULT '/',
    schedule_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    total_recipients INTEGER DEFAULT 0,
    total_sent INTEGER DEFAULT 0,
    total_opened INTEGER DEFAULT 0,
    total_clicked INTEGER DEFAULT 0,
    total_rate_limited INTEGER DEFAULT 0,
    created_by TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_schedule ON campaigns(schedule_at) WHERE status = 'scheduled';

-- ----------------------------------------------------------------------------
-- 8. RPC: Evaluar segmentos de un usuario
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_user_segments(p_user_id TEXT)
RETURNS VOID
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user RECORD;
    v_order_count INTEGER;
    v_total_spent NUMERIC;
    v_last_order_days INTEGER;
    v_avg_order NUMERIC;
BEGIN
    SELECT * INTO v_user FROM usuarios_clientes WHERE id = p_user_id;
    IF NOT FOUND THEN RETURN; END IF;

    SELECT COUNT(*), COALESCE(SUM(total_usd), 0), COALESCE(AVG(total_usd), 0)
    INTO v_order_count, v_total_spent, v_avg_order
    FROM orders
    WHERE cliente_uid = p_user_id AND status = 'Entregado';

    SELECT EXTRACT(DAY FROM NOW() - MAX(fecha))::int
    INTO v_last_order_days
    FROM orders
    WHERE cliente_uid = p_user_id AND status = 'Entregado';

    DELETE FROM customer_segments WHERE user_id = p_user_id;

    IF v_user.loyalty_lifetime_points >= 500 OR v_order_count >= 20 THEN
        INSERT INTO customer_segments (user_id, segment_key, segment_label, metadata)
        VALUES (p_user_id, 'vip', 'VIP Client', jsonb_build_object('order_count', v_order_count, 'total_spent', v_total_spent));
    END IF;

    IF v_avg_order > 15 THEN
        INSERT INTO customer_segments (user_id, segment_key, segment_label, metadata)
        VALUES (p_user_id, 'high_value', 'Alto Valor', jsonb_build_object('avg_order', v_avg_order));
    END IF;

    IF EXTRACT(DAY FROM NOW() - v_user.created_at)::int <= 7 AND v_order_count <= 2 THEN
        INSERT INTO customer_segments (user_id, segment_key, segment_label, metadata)
        VALUES (p_user_id, 'new_user', 'Usuario Nuevo', jsonb_build_object('days_since_signup', EXTRACT(DAY FROM NOW() - v_user.created_at)::int));
    END IF;

    IF v_order_count >= 3 THEN
        INSERT INTO customer_segments (user_id, segment_key, segment_label, metadata)
        VALUES (p_user_id, 'returning', 'Recurrente', jsonb_build_object('order_count', v_order_count));
    END IF;

    IF v_last_order_days BETWEEN 14 AND 30 THEN
        INSERT INTO customer_segments (user_id, segment_key, segment_label, metadata)
        VALUES (p_user_id, 'at_risk', 'En Riesgo', jsonb_build_object('last_order_days', v_last_order_days));
    END IF;

    IF v_last_order_days > 30 THEN
        INSERT INTO customer_segments (user_id, segment_key, segment_label, metadata)
        VALUES (p_user_id, 'inactive_30d', 'Inactivo 30+ Dias', jsonb_build_object('last_order_days', v_last_order_days));
    END IF;

    IF v_last_order_days > 60 THEN
        INSERT INTO customer_segments (user_id, segment_key, segment_label, metadata)
        VALUES (p_user_id, 'inactive_60d', 'Inactivo 60+ Dias', jsonb_build_object('last_order_days', v_last_order_days));
    END IF;

    IF v_last_order_days > 90 THEN
        INSERT INTO customer_segments (user_id, segment_key, segment_label, metadata)
        VALUES (p_user_id, 'churned', 'Perdido', jsonb_build_object('last_order_days', v_last_order_days));
    END IF;

    IF v_user.loyalty_tier_id IS NOT NULL AND v_user.loyalty_tier_id != '' THEN
        INSERT INTO customer_segments (user_id, segment_key, segment_label, metadata)
        VALUES (p_user_id, 'tier_' || v_user.loyalty_tier_id, 'Miembro Tier', jsonb_build_object('tier_id', v_user.loyalty_tier_id));
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. RPC: Evaluar segmentos de TODOS los usuarios (batch)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_all_segments()
RETURNS VOID
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user RECORD;
BEGIN
    FOR v_user IN SELECT id FROM usuarios_clientes LOOP
        BEGIN
            PERFORM evaluate_user_segments(v_user.id);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error evaluando segmentos para usuario %: %', v_user.id, SQLERRM;
        END;
    END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. RPC: Seed de 8 automatizaciones predefinidas
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_automation_rules()
RETURNS VOID
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO automation_rules (name, slug, description, trigger_type, trigger_config, action_type, action_config, cooldown_hours, max_sends_per_user) VALUES
    (
        'Gracias Post-Pedido', 'post_purchase_thank_you',
        'Envía push de gracias 30 min después de entrega con puntos por review.',
        'event_based',
        '{"event": "order.status_changed", "status": "Entregado", "delay_minutes": 30}'::jsonb,
        'push',
        '{"title_template": "Gracias por tu compra, {{user_name}}!", "body_template": "Tu pedido #{{order_id}} fue entregado. Califica tu experiencia y gana puntos extra!", "link_url": "/?tab=profile"}'::jsonb,
        24, 1
    ),
    (
        'Actualización de Delivery', 'delivery_status_update',
        'Notifica cuando el pedido cambia a En camino o Entregado.',
        'event_based',
        '{"event": "order.status_changed", "statuses": ["En camino", "Entregado"]}'::jsonb,
        'push',
        '{"title_template": "Tu pedido #{{order_id}} está en camino", "body_template": "Tu pedido va de camino. ¡Prepárate para recibirlo!", "link_url": "/?tab=profile"}'::jsonb,
        1, 10
    ),
    (
        'Solicitud de Review', 'review_request',
        'Pide review 2 horas después de entrega con incentivo de puntos.',
        'event_based',
        '{"event": "order.status_changed", "status": "Entregado", "delay_minutes": 120}'::jsonb,
        'push',
        '{"title_template": "¿Qué te pareció tu pedido?", "body_template": "Tu opinión nos ayuda a mejorar. Califica y gana puntos.", "link_url": "/?tab=profile"}'::jsonb,
        72, 2
    ),
    (
        'Carrito Abandonado', 'cart_abandonment',
        'Recuerda carritos abandonados después de 60 min de inactividad.',
        'event_based',
        '{"event": "cart.idle", "idle_minutes": 60}'::jsonb,
        'push',
        '{"title_template": "¡Te esperamos!", "body_template": "Tienes productos en tu carrito. ¡Ordénalos antes de que se agoten!", "link_url": "/?tab=cart"}'::jsonb,
        48, 2
    ),
    (
        'Re-engagement Inactivos', 'winback_inactive',
        'Reactiva usuarios inactivos 30+ días con oferta especial.',
        'segment_entry',
        '{"segment": "inactive_30d", "daily_cap": 1}'::jsonb,
        'push',
        '{"title_template": "¡Te extrañamos, {{user_name}}!", "body_template": "Vuelve y disfruta de un 15% de descuento con el código BIENVENIDO15.", "link_url": "/?tab=catalog"}'::jsonb,
        720, 3
    ),
    (
        'Bonus Cumpleaños', 'birthday_bonus',
        'Envía regalo de cumpleaños con puntos y cupón especial.',
        'event_based',
        '{"event": "user.birthday", "days_before": 0, "days_after": 3}'::jsonb,
        'push',
        '{"title_template": "¡Feliz cumpleaños, {{user_name}}!", "body_template": "Te regalamos puntos y un descuento especial. ¡Celebra con nosotros!", "link_url": "/?tab=profile"}'::jsonb,
        8760, 1
    ),
    (
        'Celebración de Tier', 'tier_upgrade',
        'Celebra cuando un usuario sube de tier de fidelización.',
        'event_based',
        '{"event": "loyalty.tier_changed"}'::jsonb,
        'push',
        '{"title_template": "¡Felicidades, ascendiste!", "body_template": "Ahora tienes beneficios exclusivos. Sigue acumulando puntos para subir más.", "link_url": "/?tab=profile"}'::jsonb,
        8760, 1
    ),
    (
        'Cupón por Vencer', 'coupon_expiry_reminder',
        'Recuerda 48 horas antes de que expire un cupón.',
        'event_based',
        '{"event": "coupon.expiring_soon", "hours_before": 48}'::jsonb,
        'push',
        '{"title_template": "Tu cupón vence pronto!", "body_template": "Tienes un descuento que vence en 48 horas. ¡Úsalo ahora!", "link_url": "/?tab=catalog"}'::jsonb,
        24, 2
    )
    ON CONFLICT (slug) DO NOTHING;
END;
$$;

SELECT seed_automation_rules();

-- ----------------------------------------------------------------------------
-- 11. POLÍTICAS RLS
-- ----------------------------------------------------------------------------
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- loyalty_transactions
DROP POLICY IF EXISTS "loyalty_select_own" ON loyalty_transactions;
CREATE POLICY "loyalty_select_own" ON loyalty_transactions
    FOR SELECT TO authenticated USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "loyalty_insert_own" ON loyalty_transactions;
CREATE POLICY "loyalty_insert_own" ON loyalty_transactions
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid()::text AND points != 0 AND type IN ('earn', 'redeem', 'bonus'));

DROP POLICY IF EXISTS "loyalty_admin_all" ON loyalty_transactions;
CREATE POLICY "loyalty_admin_all" ON loyalty_transactions
    FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

-- reward_catalog
DROP POLICY IF EXISTS "Public can read active rewards" ON reward_catalog;
CREATE POLICY "Public can read active rewards" ON reward_catalog
    FOR SELECT USING (active = TRUE);

DROP POLICY IF EXISTS "Admin full access rewards" ON reward_catalog;
CREATE POLICY "Admin full access rewards" ON reward_catalog
    FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

-- promotions
DROP POLICY IF EXISTS "promotions_select_public" ON promotions;
CREATE POLICY "promotions_select_public" ON promotions FOR SELECT USING (status = 'active');

DROP POLICY IF EXISTS "promotions_admin_all" ON promotions;
CREATE POLICY "promotions_admin_all" ON promotions FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

-- customer_segments
DROP POLICY IF EXISTS "segments_admin_all" ON customer_segments;
CREATE POLICY "segments_admin_all" ON customer_segments
    FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

-- automation_rules
DROP POLICY IF EXISTS "automation_admin_all" ON automation_rules;
CREATE POLICY "automation_admin_all" ON automation_rules
    FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

-- automation_log
DROP POLICY IF EXISTS "automation_log_admin_all" ON automation_log;
CREATE POLICY "automation_log_admin_all" ON automation_log
    FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

-- campaigns
DROP POLICY IF EXISTS "campaigns_admin_all" ON campaigns;
CREATE POLICY "campaigns_admin_all" ON campaigns
    FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

-- ----------------------------------------------------------------------------
-- 12. FK para push_events.campaign_id (campaigns ahora existe)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'push_events_campaign_id_fkey'
    ) THEN
        ALTER TABLE public.push_events
            ADD CONSTRAINT push_events_campaign_id_fkey
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 13. PERMISOS
-- ----------------------------------------------------------------------------
GRANT SELECT ON promotions, reward_catalog TO anon;
