-- ==========================================================================
-- SCRIPT DE ESQUEMA DEFINITIVO PARA MARKET COFFEE PWA
-- PLATAFORMA 3 EN 1: Mercado, Panaderia, Comida Rapida
-- ESTADO: OPTIMIZADO PARA PRODUCCION (VAPID + PUSH WEBHOOK + SEO + LOYALTY)
-- SECURITY HARDENED: 2026-07-15
-- ==========================================================================

-- Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ----------------------------------------------------------------------------
-- FUNCION HELPER: add_column_if_not_exists (idempotent migrations)
-- SECURITY: SECURITY DEFINER with fixed search_path to prevent injection
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_column_if_not_exists(
    p_table TEXT, p_column TEXT, p_type TEXT
) RETURNS VOID
SET search_path = public
AS $func$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = p_table AND column_name = p_column
    ) THEN
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s', p_table, p_column, p_type);
    END IF;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 1. store_config (CONFIGURACION CENTRAL WHITE-LABEL)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_config (
    id SERIAL PRIMARY KEY,

    -- Identidad
    site_nombre TEXT NOT NULL DEFAULT 'Market Coffee',
    telefono_soporte TEXT NOT NULL DEFAULT '+584124058904',
    direccion_fisica TEXT NOT NULL DEFAULT 'Av. Principal, Local #12, Ciudad',
    tienda_lat NUMERIC(10, 6) NOT NULL DEFAULT 10.198300,
    tienda_lng NUMERIC(10, 6) NOT NULL DEFAULT -68.004400,
    logo_url TEXT DEFAULT '',
    secondary_logo_url TEXT DEFAULT '',
    pwa_icon_url TEXT DEFAULT '',
    splash_logo_url TEXT DEFAULT '',
    favicon_url TEXT DEFAULT '',
    site_url TEXT DEFAULT '',

    -- Banners
    banner_url_1 TEXT NOT NULL DEFAULT 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=1200',
    banner_url_2 TEXT NOT NULL DEFAULT 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=1200',
    banner_url_3 TEXT NOT NULL DEFAULT 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=1200',
    banner_url_1_mobile TEXT,
    banner_url_2_mobile TEXT,
    banner_url_3_mobile TEXT,
    banner_texts TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Colores
    theme_color VARCHAR(10) NOT NULL DEFAULT '#FF2D95',
    secondary_color VARCHAR(10) DEFAULT '#FF6B35',
    accent_color VARCHAR(10) DEFAULT '#FFBE0B',
    theme_mode VARCHAR(10) DEFAULT 'light',

    -- Pagos
    zelle_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    zelle_data TEXT NOT NULL DEFAULT 'pagos@marketcoffee.com.ve',
    zelle_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    pagomovil_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    pagomovil_data TEXT NOT NULL DEFAULT 'Banesco (0134) - RIF J-50123456-7 - Tel: 0412-4058904',
    pagomovil_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    efectivo_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    efectivo_data TEXT NOT NULL DEFAULT 'Paga al motorizado en efectivo (USD/Bs) al recibir tu delivery',
    efectivo_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    transferencia_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    transferencia_data TEXT NOT NULL DEFAULT 'Banesco Cuenta Corriente - 0134-1122-33-4455667788 - Market Coffee C.A. - RIF J-50123456-7',
    transferencia_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    tasa_cambio NUMERIC(10,2) NOT NULL DEFAULT 612.43,

    -- Categorias
    categories TEXT[] DEFAULT ARRAY['Mercado', 'Panaderia', 'Comida Rapida', 'Combos', 'Bebidas', 'Dulces']::TEXT[],
    categories_images JSONB DEFAULT '{}'::JSONB,
    categories_colors JSONB DEFAULT '{}'::JSONB,

    -- Tienda
    esta_abierta BOOLEAN NOT NULL DEFAULT TRUE,
    tiene_mesas BOOLEAN NOT NULL DEFAULT FALSE,
    total_mesas INTEGER DEFAULT 0,
    recogida_en_local BOOLEAN NOT NULL DEFAULT TRUE,
    entrega_por_zonas BOOLEAN NOT NULL DEFAULT FALSE,
    delivery_gratis BOOLEAN NOT NULL DEFAULT FALSE,
    delivery_gratis_threshold NUMERIC(10,2) DEFAULT 0,
    costo_delivery_km NUMERIC(10,2) DEFAULT 0,
    envio_nacional BOOLEAN NOT NULL DEFAULT FALSE,
    costo_envio_nacional NUMERIC(10,2) DEFAULT 0,
    stock_alert_threshold INTEGER DEFAULT 5,
    delivery_zonas JSONB DEFAULT '[]'::JSONB,

    -- Textos / Hero
    mensaje_bienvenida TEXT DEFAULT 'Tu mercado, panaderia y comida rapida favorita.',
    mensaje_cierre TEXT DEFAULT 'Cerrado por ahora. Volveremos pronto.',
    hero_title TEXT DEFAULT '',
    hero_subtitle TEXT DEFAULT '',
    hero_cta_text TEXT DEFAULT '',
    hero_effect VARCHAR(20) DEFAULT 'fade',
    hero_height VARCHAR(20) DEFAULT 'auto',
    hero_overlay_opacity INTEGER DEFAULT 100,

    -- Titulos de secciones
    section_highlights_title TEXT DEFAULT 'Destacados',
    section_categories_title TEXT DEFAULT 'LO MAS POPULAR',
    section_bestseller_title TEXT DEFAULT 'LO MAS PEDIDO',
    section_rewards_title TEXT DEFAULT 'RECOMPENSAS',
    section_rewards_description TEXT DEFAULT '',
    rewards_step1_title TEXT DEFAULT 'Registrate gratis',
    rewards_step1_desc TEXT DEFAULT 'Crea tu cuenta en segundos',
    rewards_step2_title TEXT DEFAULT 'Ordena y acumula',
    rewards_step2_desc TEXT DEFAULT 'Gana puntos con cada pedido',
    rewards_step3_title TEXT DEFAULT 'Canjea recompensas',
    rewards_step3_desc TEXT DEFAULT 'Intercambia puntos por comida gratis',

    -- Footer SEO
    footer_text TEXT DEFAULT '',
    footer_copyright TEXT DEFAULT '',
    footer_about_title TEXT DEFAULT '',
    footer_about_text TEXT DEFAULT '',

    -- SEO Premium
    seo_home_title TEXT DEFAULT '',
    seo_home_description TEXT DEFAULT '',
    seo_home_keywords TEXT DEFAULT '',
    seo_catalog_title TEXT DEFAULT '',
    seo_catalog_description TEXT DEFAULT '',
    jsonld_type VARCHAR(50) DEFAULT 'Restaurant',
    jsonld_priceRange VARCHAR(10) DEFAULT '$$',
    jsonld_servesCuisine TEXT[] DEFAULT ARRAY['Mercado', 'Panaderia', 'Comida Rapida']::TEXT[],

    -- Social
    instagram_url TEXT DEFAULT '',
    twitter_url TEXT DEFAULT '',
    facebook_url TEXT DEFAULT '',
    tiktok_url TEXT DEFAULT '',
    youtube_url TEXT DEFAULT '',

    -- Push (solo URLs, secrets en vault o environment)
    push_webhook_url TEXT DEFAULT '',
    push_webhook_secret TEXT DEFAULT '',

    -- Tipografia
    font_display TEXT DEFAULT 'Fredoka',

    -- Multi-sede / Loyalty
    sedes JSONB DEFAULT '[]'::JSONB,
    multi_sucursal_enabled BOOLEAN DEFAULT FALSE,
    sede_activa_id TEXT DEFAULT '',
    loyalty JSONB DEFAULT '{}'::JSONB,
    combos JSONB DEFAULT '[]'::JSONB,
    faq_items JSONB DEFAULT '[]'::JSONB,

    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO store_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. usuarios_clientes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios_clientes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    nombre TEXT NOT NULL,
    email TEXT UNIQUE,
    telefono VARCHAR(20) UNIQUE,
    contrasena TEXT NOT NULL,
    loyalty_points INTEGER DEFAULT 0,
    loyalty_lifetime_points INTEGER DEFAULT 0,
    loyalty_tier_id TEXT DEFAULT '',
    sede_preferida_id TEXT DEFAULT '',
    is_pwa_installed BOOLEAN DEFAULT FALSE,
    pwa_installed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 3. reward_catalog (Catalogo de recompensas canjeables)
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
ALTER TABLE reward_catalog ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 4. products (MENU)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    descripcion TEXT DEFAULT '',
    categoria TEXT NOT NULL DEFAULT 'Hamburguesas',
    precio_usd NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    precio_anterior_usd NUMERIC(10,2),
    stock INTEGER NOT NULL DEFAULT 0,
    imagen_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
    es_promo BOOLEAN NOT NULL DEFAULT FALSE,
    es_nuevo BOOLEAN NOT NULL DEFAULT TRUE,
    es_mas_vendido BOOLEAN NOT NULL DEFAULT FALSE,
    delivery_gratis BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    ingredientes TEXT[] DEFAULT ARRAY[]::TEXT[],
    alergenos TEXT[] DEFAULT ARRAY[]::TEXT[],
    calorias INTEGER,
    sizes JSONB DEFAULT '[]'::JSONB,
    option_groups JSONB DEFAULT '[]'::JSONB,
    related_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
    estimated_prep_time INTEGER,
    order_count INTEGER DEFAULT 0,
    promo_end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_categoria ON products(categoria);
CREATE INDEX IF NOT EXISTS idx_products_activo ON products(activo) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_products_es_promo ON products(es_promo) WHERE es_promo = true;
CREATE INDEX IF NOT EXISTS idx_products_es_mas_vendido ON products(es_mas_vendido) WHERE es_mas_vendido = true;
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock) WHERE stock <= 5;

-- ----------------------------------------------------------------------------
-- 4.1 food_item_options (extras / opciones por producto)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_item_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    food_item_id UUID REFERENCES products(id) ON DELETE CASCADE,
    group_name TEXT NOT NULL,
    min_select INTEGER NOT NULL DEFAULT 0,
    max_select INTEGER NOT NULL DEFAULT 1,
    options JSONB NOT NULL DEFAULT '[]'::JSONB
);
ALTER TABLE food_item_options ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 5. orders
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(50) PRIMARY KEY,
    cliente_nombre TEXT NOT NULL,
    cliente_telefono TEXT NOT NULL,
    cliente_email TEXT,
    cliente_uid TEXT,
    guest_phone TEXT,
    guest_email TEXT,
    metodo_pago VARCHAR(50) NOT NULL DEFAULT 'Efectivo',
    tipo_entrega VARCHAR(20) NOT NULL DEFAULT 'delivery',
    numero_mesa INTEGER,
    direccion_envio TEXT DEFAULT '',
    lat NUMERIC(10, 6),
    lng NUMERIC(10, 6),
    distancia_km NUMERIC(8, 2) DEFAULT 0,
    items JSONB DEFAULT '[]'::JSONB,
    subtotal_usd NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    costo_envio_usd NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    descuento_cupon_usd NUMERIC(10,2) DEFAULT 0.00,
    cupon_codigo TEXT,
    total_usd NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_bs NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'Pendiente',
    tiempo_estimado_entrega TEXT DEFAULT '',
    notas_admin TEXT DEFAULT '',
    sede_id TEXT DEFAULT '',
    crear_cuenta BOOLEAN DEFAULT FALSE,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_cliente_email ON orders (cliente_email) WHERE cliente_email IS NOT NULL AND cliente_email != '';
CREATE INDEX IF NOT EXISTS idx_orders_guest_email ON orders (guest_email) WHERE guest_email IS NOT NULL AND guest_email != '';
CREATE INDEX IF NOT EXISTS idx_orders_cliente_telefono ON orders (cliente_telefono);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_fecha ON orders(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_orders_sede ON orders(sede_id) WHERE sede_id IS NOT NULL AND sede_id != '';
CREATE INDEX IF NOT EXISTS idx_orders_cliente_uid ON orders(cliente_uid) WHERE cliente_uid IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 5.1 coupons
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(10,2) DEFAULT 0,
    coupon_type TEXT DEFAULT 'percentage',
    min_purchase NUMERIC(10,2) DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    valid_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 5.2 push_subscriptions
-- SECURITY: user_id is TEXT to match usuarios_clientes.id (UUID stored as TEXT)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.usuarios_clientes(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth_secret TEXT NOT NULL,
    destinatario_telefono TEXT DEFAULT '',
    anonymous_id TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(endpoint)
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

UPDATE store_config 
SET 
    push_webhook_url = 'https://marketcoffee.maketo.site/api/push-notify',
  push_webhook_secret = 'fp-push-secret-2024-xK9m'
WHERE id = 1;
-- ----------------------------------------------------------------------------
-- 5.3 notifications
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(50) PRIMARY KEY,
    titulo TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    fecha TEXT NOT NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'todos',
    destinatario_telefono VARCHAR(20) DEFAULT '',
    leida BOOLEAN NOT NULL DEFAULT FALSE,
    imagen_url TEXT DEFAULT '',
    link_url TEXT DEFAULT '',
    click_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 5.4 product_reviews
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);

-- ----------------------------------------------------------------------------
-- 5.5 flash_sales
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS flash_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    discount_percent INTEGER NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    max_quantity INTEGER,
    sold_quantity INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_flash_sales_active ON flash_sales(active, end_date);
CREATE INDEX IF NOT EXISTS idx_flash_sales_product ON flash_sales(product_id);

-- ----------------------------------------------------------------------------
-- 5.6 user_carts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_carts (
    user_id TEXT PRIMARY KEY,
    cart_data JSONB NOT NULL DEFAULT '[]'::JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 5.7 promotions
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
-- 5.8 loyalty_transactions
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
-- 5.9 admin_users (Gestion de roles admin/operador)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator')),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- ----------------------------------------------------------------------------
-- 6. FUNCIONES Y TRIGGERS (SECURITY HARDENED)
-- ----------------------------------------------------------------------------

-- SECURITY: Todas las funciones SECURITY DEFINER usan SET search_path = public
-- para prevenir search_path injection attacks.

-- 6.1 Funcion para sincronizar perfiles desde Auth + Welcome Bonus
CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS TRIGGER
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_welcome_bonus int;
    v_loyalty_config jsonb;
BEGIN
    INSERT INTO public.usuarios_clientes (id, nombre, email, telefono, contrasena)
    VALUES (
        NEW.id::text,
        COALESCE(NEW.raw_user_meta_data->>'nombre', 'Usuario Nuevo'),
        NEW.email,
        NULLIF(COALESCE(NEW.raw_user_meta_data->>'telefono', ''), ''),
        'auth_managed'
    )
    ON CONFLICT (id) DO UPDATE SET
        nombre = COALESCE(EXCLUDED.nombre, usuarios_clientes.nombre),
        email = COALESCE(EXCLUDED.email, usuarios_clientes.email),
        telefono = COALESCE(EXCLUDED.telefono, usuarios_clientes.telefono);

    -- Welcome Bonus: otorgar puntos de bienvenida si el loyalty esta habilitado
    SELECT loyalty INTO v_loyalty_config FROM store_config WHERE id = 1;
    v_welcome_bonus := COALESCE((v_loyalty_config->>'welcome_bonus')::int, 0);

    IF v_welcome_bonus > 0 AND COALESCE((v_loyalty_config->>'enabled')::boolean, false) THEN
        UPDATE usuarios_clientes
        SET loyalty_points = loyalty_points + v_welcome_bonus,
            loyalty_lifetime_points = loyalty_lifetime_points + v_welcome_bonus
        WHERE id = NEW.id::text;

        INSERT INTO loyalty_transactions (user_id, type, points, description)
        VALUES (NEW.id::text, 'bonus', v_welcome_bonus, 'Bonus de bienvenida');
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_created();

-- 6.2 Funcion para acciones post-pedido (Stock + Cupones + Notificaciones)
-- SECURITY: Agrega validacion de stock negativo y rate limiting basico
CREATE OR REPLACE FUNCTION public.handle_new_order_actions()
RETURNS TRIGGER
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    item_json jsonb;
    v_part_id uuid;
    v_cantidad int;
    v_current_stock int;
    v_notif_id text;
    v_admin_phone text;
BEGIN
    -- Validar que items no este vacio
    IF NEW.items IS NULL OR jsonb_array_length(NEW.items) = 0 THEN
        RAISE WARNING 'Pedido % tiene items vacios', NEW.id;
        RETURN NEW;
    END IF;

    -- Validar que total sea positivo
    IF NEW.total_usd IS NULL OR NEW.total_usd <= 0 THEN
        RAISE WARNING 'Pedido % tiene total invalido: %', NEW.id, NEW.total_usd;
    END IF;

    FOR item_json IN SELECT jsonb_array_elements(NEW.items)
    LOOP
        BEGIN
            v_part_id := (COALESCE(item_json->>'food_id', item_json->>'part_id', item_json->>'id', item_json->>'producto_id'))::uuid;
            v_cantidad := (COALESCE(item_json->>'cantidad', item_json->>'quantity', item_json->>'qty', '1'))::int;

            IF v_part_id IS NOT NULL AND v_cantidad > 0 THEN
                -- Verificar stock antes de descontar
                SELECT stock INTO v_current_stock FROM public.products WHERE id = v_part_id;

                IF v_current_stock IS NOT NULL THEN
                    IF v_current_stock < v_cantidad THEN
                        RAISE WARNING 'Stock insuficiente para producto %: disponible %, solicitado %', v_part_id, v_current_stock, v_cantidad;
                    END IF;

                    UPDATE public.products
                    SET stock = GREATEST(0, stock - v_cantidad),
                        order_count = COALESCE(order_count, 0) + v_cantidad
                    WHERE id = v_part_id;
                END IF;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error actualizando stock para item %: %', v_part_id, SQLERRM;
        END;
    END LOOP;

    -- Actualizar uso de cupon
    IF NEW.cupon_codigo IS NOT NULL AND NEW.cupon_codigo != '' THEN
        UPDATE public.coupons
        SET usage_count = usage_count + 1
        WHERE code = NEW.cupon_codigo AND (usage_limit IS NULL OR usage_count < usage_limit);
    END IF;

    -- Crear notificacion admin
    v_notif_id := 'notif-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12);
    SELECT telefono_soporte INTO v_admin_phone FROM public.store_config WHERE id = 1;

    INSERT INTO public.notifications (id, titulo, mensaje, fecha, tipo, destinatario_telefono, leida)
    VALUES (
        v_notif_id,
        'Nuevo Pedido: ' || NEW.id,
        'El cliente ' || COALESCE(NEW.cliente_nombre, 'N/A') || ' ha realizado una compra por $' || COALESCE(NEW.total_usd::text, '0'),
        to_char(NOW(), 'DD/MM/YYYY HH24:MI'),
        'admin',
        COALESCE(v_admin_phone, ''),
        FALSE
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Fallo en trigger handle_new_order_actions: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_order_completion ON public.orders;
CREATE TRIGGER trigger_order_completion
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_order_actions();

-- 6.3 Funcion para notificar cambios de estado + reversar puntos al cancelar
CREATE OR REPLACE FUNCTION public.handle_order_status_push_update()
RETURNS TRIGGER
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_notif_id text;
    v_mensaje text;
    v_admin_phone text;
    v_reversed_points int;
    v_client_uid text;
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status = 'En camino' THEN
        v_notif_id := 'notif-status-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12);
        v_mensaje := 'Buenas noticias, ' || COALESCE(NEW.cliente_nombre, 'Cliente') || '! Tu pedido ' || NEW.id || ' ha sido despachado.';
        INSERT INTO public.notifications (id, titulo, mensaje, fecha, tipo, destinatario_telefono, link_url, leida)
        VALUES (v_notif_id, 'Pedido en camino!', v_mensaje, to_char(NOW(), 'DD/MM/YYYY HH24:MI'), 'personal', NEW.cliente_telefono, '/?tab=profile', FALSE);

    ELSIF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status = 'Cancelado' THEN
        SELECT telefono_soporte INTO v_admin_phone FROM public.store_config WHERE id = 1;
        v_notif_id := 'notif-cancel-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12);
        v_mensaje := 'El pedido ' || NEW.id || ' de ' || COALESCE(NEW.cliente_nombre, 'N/A') || ' ha sido cancelado.';
        INSERT INTO public.notifications (id, titulo, mensaje, fecha, tipo, destinatario_telefono, link_url, leida)
        VALUES (v_notif_id, 'Pedido Cancelado', v_mensaje, to_char(NOW(), 'DD/MM/YYYY HH24:MI'), 'admin', COALESCE(v_admin_phone, ''), '/admin', FALSE);

        -- REVERSAR PUNTOS DE FIDELIDAD ganados en este pedido
        v_client_uid := COALESCE(NEW.cliente_uid, '');
        IF v_client_uid != '' THEN
            SELECT COALESCE(SUM(points), 0) INTO v_reversed_points
            FROM loyalty_transactions
            WHERE user_id = v_client_uid AND order_id = NEW.id AND type = 'earn';

            IF v_reversed_points > 0 THEN
                -- Insertar transaccion de reversal
                INSERT INTO loyalty_transactions (user_id, type, points, description, order_id)
                VALUES (v_client_uid, 'redeem', -v_reversed_points, 'Reversal por cancelacion pedido ' || NEW.id, NEW.id)
                ON CONFLICT DO NOTHING;

                -- Deductir puntos del usuario (solo los activos, no lifetime)
                UPDATE usuarios_clientes
                SET loyalty_points = GREATEST(0, loyalty_points - v_reversed_points)
                WHERE id = v_client_uid;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_order_status_update_push ON public.orders;
CREATE TRIGGER trigger_order_status_update_push
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_status_push_update();

-- 6.4 Funcion para incrementar clics de notificacion
CREATE OR REPLACE FUNCTION public.increment_notification_click(notif_id TEXT)
RETURNS VOID
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.notifications
  SET click_count = COALESCE(click_count, 0) + 1
  WHERE id = notif_id;
END;
$$;

-- 6.5 Funcion RPC para admin leer suscripciones push
-- SECURITY: Requiere que el caller sea admin o operator
CREATE OR REPLACE FUNCTION public.get_all_push_subscriptions()
RETURNS TABLE (
    id UUID,
    user_id TEXT,
    endpoint TEXT,
    p256dh TEXT,
    auth_secret TEXT,
    destinatario_telefono TEXT,
    anonymous_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE
)
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Verificar que el caller tiene privilegios de admin
    IF NOT (
        (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
        OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
        OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
    ) THEN
        RAISE EXCEPTION 'Access denied: admin or operator role required';
    END IF;

    RETURN QUERY
    SELECT ps.id, ps.user_id, ps.endpoint, ps.p256dh, ps.auth_secret, ps.destinatario_telefono, ps.anonymous_id, ps.created_at
    FROM public.push_subscriptions ps;
END;
$$;

-- 6.6 Funcion para limpieza automatica de datos antiguos
-- SECURITY: SECURITY DEFINER para que pueda ejecutarse via pg_cron
CREATE OR REPLACE FUNCTION public.delete_old_notifications()
RETURNS void
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    DELETE FROM public.notifications WHERE created_at < NOW() - INTERVAL '15 days';
    DELETE FROM public.orders WHERE status = 'Cancelado' AND created_at < NOW() - INTERVAL '3 months';
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. PUSH WEBHOOK (Cloudflare Functions)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('settings', 'settings', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Permitir subida de logos al admin" ON storage.objects;
CREATE POLICY "Permitir subida de logos al admin" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'settings');

DROP POLICY IF EXISTS "Permitir lectura publica de logos" ON storage.objects;
CREATE POLICY "Permitir lectura publica de logos" ON storage.objects
FOR SELECT USING (bucket_id = 'settings');

-- 7.1 Trigger para notificaciones push via webhook
-- NOTA: el secreto del webhook se lee desde app_secrets (ver migración
-- 2026080200_security_hardening.sql), que es la fuente de verdad. Este bloque
-- solo garantiza que exista UN único trigger sobre public.notifications
-- (nombre canónico trigger_push_notification) para evitar envios duplicados.
CREATE OR REPLACE FUNCTION public.handle_new_notification_push()
RETURNS TRIGGER
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_webhook_url TEXT;
BEGIN
  SELECT push_webhook_url INTO v_webhook_url
  FROM public.store_config WHERE id = 1;

  IF v_webhook_url IS NOT NULL AND v_webhook_url <> '' AND NEW.tipo IN ('todos', 'personal', 'admin', 'request') THEN
    PERFORM net.http_post(
      url := v_webhook_url,
      body := jsonb_build_object(
        'title', NEW.titulo,
        'body', NEW.mensaje,
        'icon', COALESCE(NEW.imagen_url, '/icon.png'),
        'badge', '/icon.png',
        'sound', 'default',
        'vibrate', ARRAY[200, 100, 200],
        'tag', 'marketcoffee-' || NEW.id,
        'url', COALESCE(NEW.link_url, '/'),
        'record', jsonb_build_object(
          'id', NEW.id, 'title', NEW.titulo, 'body', NEW.mensaje,
          'icon', COALESCE(NEW.imagen_url, '/icon.png'),
          'tag', 'marketcoffee-' || NEW.id, 'renotify', true,
          'titulo', NEW.titulo, 'mensaje', NEW.mensaje,
          'imagen_url', COALESCE(NEW.imagen_url, ''),
          'link_url', COALESCE(NEW.link_url, '/'),
          'tipo', NEW.tipo,
          'destinatario_telefono', COALESCE(NEW.destinatario_telefono, '')
        )
      )::text,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-webhook-secret', COALESCE(public.get_push_webhook_secret(), '')
      )
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'No se pudo invocar webhook de push: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_push_notification ON public.notifications;
DROP TRIGGER IF EXISTS trigger_notify_push ON public.notifications;
CREATE TRIGGER trigger_push_notification
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_notification_push();

-- ----------------------------------------------------------------------------
-- 8. POLITICAS RLS Y SEGURIDAD
-- SECURITY: Principio de menor privilegio. Cada tabla tiene policies explicitas.
-- ----------------------------------------------------------------------------

-- Habilitar RLS en TODAS las tablas
ALTER TABLE store_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE flash_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_item_options ENABLE ROW LEVEL SECURITY;

-- Permisos base: authenticated tiene CRUD en sus tablas, anon solo lectura limitada
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT ON store_config, products, notifications, coupons, usuarios_clientes TO anon;
GRANT SELECT, INSERT, UPDATE ON orders TO anon;
GRANT SELECT, INSERT, UPDATE ON push_subscriptions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
-- Tablas publicas con RLS: el rol anon necesita grants de tabla (las policies filtran las filas).
GRANT SELECT ON promotions, flash_sales, reward_catalog, product_reviews, loyalty_transactions TO anon;
GRANT INSERT ON product_reviews TO anon;

DO $$
DECLARE
  p_record RECORD;
BEGIN

  -- =====================================================
  -- store_config: Lectura publica, escritura admin/operator
  -- =====================================================
  DROP POLICY IF EXISTS "Lectura config publica" ON store_config;
  CREATE POLICY "Lectura config publica" ON store_config FOR SELECT USING (true);

  DROP POLICY IF EXISTS "Allow all updates only to admin" ON store_config;
  CREATE POLICY "Allow all updates only to admin" ON store_config
    FOR ALL TO authenticated
    USING (
      (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
    );

  -- =====================================================
  -- products: Lectura publica (activos), gestion admin
  -- =====================================================
  DROP POLICY IF EXISTS "Lectura productos activos" ON products;
  CREATE POLICY "Lectura productos activos" ON products
    FOR SELECT USING (
      activo = true
      OR (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
    );

  DROP POLICY IF EXISTS "Allow admin changes to catalog" ON products;
  CREATE POLICY "Allow admin changes to catalog" ON products
    FOR ALL TO authenticated
    USING (
      (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
    )
    WITH CHECK (
      (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
    );

  -- =====================================================
  -- orders: Insert anon validado, select own/admin, update admin
  -- =====================================================
  DROP POLICY IF EXISTS "orders_insert_allow_anon" ON orders;
  CREATE POLICY "orders_insert_allow_anon" ON orders FOR INSERT WITH CHECK (
    cliente_nombre IS NOT NULL AND cliente_nombre != ''
    AND cliente_telefono IS NOT NULL AND cliente_telefono != ''
    AND total_usd > 0
  );

  DROP POLICY IF EXISTS "orders_select_own_or_admin" ON orders;
  CREATE POLICY "orders_select_own_or_admin" ON orders
    FOR SELECT USING (
      auth.uid()::text = cliente_uid
      OR (cliente_uid IS NOT NULL AND cliente_uid LIKE 'guest-%')
      OR (cliente_uid IS NULL)
      OR (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
    );

  DROP POLICY IF EXISTS "orders_update_admin" ON orders;
  CREATE POLICY "orders_update_admin" ON orders
    FOR ALL TO authenticated
    USING (
      (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
    )
    WITH CHECK (
      (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
    );

  -- =====================================================
  -- usuarios_clientes: Profile access (own + admin)
  -- =====================================================
  DROP POLICY IF EXISTS "Admin lee todos los clientes" ON usuarios_clientes;
  CREATE POLICY "Admin lee todos los clientes" ON usuarios_clientes
    FOR SELECT TO authenticated
    USING (
      (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
    );

  DROP POLICY IF EXISTS "Cliente lee su propio perfil" ON usuarios_clientes;
  CREATE POLICY "Cliente lee su propio perfil" ON usuarios_clientes
    FOR SELECT TO authenticated
    USING (auth.uid()::text = id);

  DROP POLICY IF EXISTS "Update propio" ON usuarios_clientes;
  CREATE POLICY "Update propio" ON usuarios_clientes FOR UPDATE TO authenticated USING (auth.uid()::text = id);

  DROP POLICY IF EXISTS "Admin gestiona todos los clientes" ON usuarios_clientes;
  CREATE POLICY "Admin gestiona todos los clientes" ON usuarios_clientes
    FOR ALL TO authenticated
    USING (
      (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
    )
    WITH CHECK (
      (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
    );

  -- =====================================================
  -- notifications: Lectura filtrada por tipo, update solo auth
  -- SECURITY: Anon NO puede hacer update (antes podia marcar leido)
  -- =====================================================
  DROP POLICY IF EXISTS "notifications_insert_allow_anon" ON notifications;
  CREATE POLICY "notifications_insert_allow_anon" ON notifications
    FOR INSERT TO anon, authenticated WITH CHECK (true);

  DROP POLICY IF EXISTS "Lectura de notificaciones" ON notifications;
  CREATE POLICY "Lectura de notificaciones" ON notifications
    FOR SELECT TO anon, authenticated USING (
      tipo = 'todos' OR tipo = 'admin'
      OR (tipo = 'personal' AND destinatario_telefono IS NOT NULL AND destinatario_telefono != '')
      OR (tipo = 'request' AND destinatario_telefono IS NOT NULL AND destinatario_telefono != '')
    );

  DROP POLICY IF EXISTS "notifications_update_allow_all" ON notifications;
  CREATE POLICY "notifications_update_auth_only" ON notifications
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

  -- =====================================================
  -- coupons: Solo activos son visibles publicamente
  -- =====================================================
  DROP POLICY IF EXISTS "Lectura cupones publica" ON coupons;
  CREATE POLICY "Lectura cupones publica" ON coupons FOR SELECT TO anon, authenticated USING (active = true);

  DROP POLICY IF EXISTS "Gestion cupones admin" ON coupons;
  CREATE POLICY "Gestion cupones admin" ON coupons
    FOR ALL TO authenticated
    USING (
      (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
    )
    WITH CHECK (
      (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
    );

  -- =====================================================
  -- product_reviews: Public read, authenticated insert
  -- =====================================================
  DROP POLICY IF EXISTS "reviews_select_public" ON product_reviews;
  CREATE POLICY "reviews_select_public" ON product_reviews FOR SELECT USING (true);

  DROP POLICY IF EXISTS "reviews_insert_auth" ON product_reviews;
  CREATE POLICY "reviews_insert_auth" ON product_reviews FOR INSERT TO authenticated WITH CHECK (true);

  DROP POLICY IF EXISTS "reviews_insert_anon" ON product_reviews;
  CREATE POLICY "reviews_insert_anon" ON product_reviews FOR INSERT TO anon WITH CHECK (true);

  -- =====================================================
  -- flash_sales: Solo activos publicos, admin gestiona
  -- =====================================================
  DROP POLICY IF EXISTS "flash_sales_select_public" ON flash_sales;
  CREATE POLICY "flash_sales_select_public" ON flash_sales FOR SELECT USING (active = true);

  DROP POLICY IF EXISTS "flash_sales_admin_all" ON flash_sales;
  CREATE POLICY "flash_sales_admin_all" ON flash_sales FOR ALL TO authenticated
    USING (
      (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
    )
    WITH CHECK (
      (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
    );

  -- =====================================================
  -- user_carts: Solo el propietario puede gestionar su carrito
  -- =====================================================
  DROP POLICY IF EXISTS "user_carts_select_own" ON user_carts;
  CREATE POLICY "user_carts_select_own" ON user_carts FOR SELECT TO authenticated USING (auth.uid()::text = user_id);

  DROP POLICY IF EXISTS "user_carts_upsert_own" ON user_carts;
  CREATE POLICY "user_carts_upsert_own" ON user_carts FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);

  DROP POLICY IF EXISTS "user_carts_update_own" ON user_carts;
  CREATE POLICY "user_carts_update_own" ON user_carts FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);

  DROP POLICY IF EXISTS "user_carts_delete_own" ON user_carts;
  CREATE POLICY "user_carts_delete_own" ON user_carts FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

  -- =====================================================
  -- promotions: Solo activas publico, admin gestiona
  -- =====================================================
  DROP POLICY IF EXISTS "promotions_select_public" ON promotions;
  CREATE POLICY "promotions_select_public" ON promotions FOR SELECT USING (status = 'active');

  DROP POLICY IF EXISTS "promotions_admin_all" ON promotions;
  CREATE POLICY "promotions_admin_all" ON promotions FOR ALL TO authenticated
    USING (
      (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
    )
    WITH CHECK (
      (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
    );

  -- =====================================================
  -- push_subscriptions: Anon puede insertar/actualizar sus propias
  -- Authenticated puede gestionar las suyas
  -- =====================================================
  DROP POLICY IF EXISTS "manage_own_push_subscriptions" ON public.push_subscriptions;
  CREATE POLICY "manage_own_push_subscriptions" ON public.push_subscriptions
    FOR ALL TO authenticated
    USING (auth.uid()::text = user_id OR user_id IS NULL)
    WITH CHECK (auth.uid()::text = user_id OR user_id IS NULL);

  DROP POLICY IF EXISTS "allow_anonymous_push_subscriptions" ON public.push_subscriptions;
  CREATE POLICY "allow_anonymous_push_subscriptions" ON public.push_subscriptions
    FOR INSERT TO anon WITH CHECK (user_id IS NULL);

  DROP POLICY IF EXISTS "allow_anonymous_push_update" ON public.push_subscriptions;
  CREATE POLICY "allow_anonymous_push_update" ON public.push_subscriptions
    FOR UPDATE TO anon USING (user_id IS NULL);

  -- =====================================================
  -- loyalty_transactions: Own select, own insert (with validation), admin gestiona
  -- =====================================================
  DROP POLICY IF EXISTS "loyalty_select_own" ON loyalty_transactions;
  CREATE POLICY "loyalty_select_own" ON loyalty_transactions
    FOR SELECT TO authenticated USING (user_id = auth.uid()::text);

  DROP POLICY IF EXISTS "loyalty_insert_own" ON loyalty_transactions;
  CREATE POLICY "loyalty_insert_own" ON loyalty_transactions
    FOR INSERT TO authenticated
    WITH CHECK (
      user_id = auth.uid()::text
      AND points != 0
      AND type IN ('earn', 'redeem', 'bonus')
    );

  DROP POLICY IF EXISTS "loyalty_admin_all" ON loyalty_transactions;
  CREATE POLICY "loyalty_admin_all" ON loyalty_transactions
    FOR ALL TO authenticated
    USING (
      (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
    )
    WITH CHECK (
      (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
    );

  -- =====================================================
  -- admin_users: Solo admin gestiona, operador solo lectura
  -- =====================================================
  DROP POLICY IF EXISTS "admin_users_admin_all" ON admin_users;
  CREATE POLICY "admin_users_admin_all" ON admin_users
    FOR ALL TO authenticated
    USING (
      (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
    )
    WITH CHECK (
      (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
    );

  DROP POLICY IF EXISTS "admin_users_operator_read" ON admin_users;
  CREATE POLICY "admin_users_operator_read" ON admin_users
    FOR SELECT TO authenticated
    USING (
      auth.uid()::text = id::text
      OR (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
    );

  -- =====================================================
  -- reward_catalog: Lectura activos publica, admin gestiona
  -- FIX: Eliminada policy ALL USING(TRUE) que anulaba la SELECT policy
  -- =====================================================
  DROP POLICY IF EXISTS "Public can read active rewards" ON reward_catalog;
  CREATE POLICY "Public can read active rewards" ON reward_catalog
    FOR SELECT USING (active = TRUE);

  DROP POLICY IF EXISTS "Admin full access rewards" ON reward_catalog;
  CREATE POLICY "Admin full access rewards" ON reward_catalog
    FOR ALL TO authenticated
    USING (
      (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
    )
    WITH CHECK (
      (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
    );

  -- =====================================================
  -- food_item_options: Lectura publica (via products), admin gestiona
  -- =====================================================
  DROP POLICY IF EXISTS "food_options_select_public" ON food_item_options;
  CREATE POLICY "food_options_select_public" ON food_item_options FOR SELECT USING (true);

  DROP POLICY IF EXISTS "food_options_admin_all" ON food_item_options;
  CREATE POLICY "food_options_admin_all" ON food_item_options
    FOR ALL TO authenticated
    USING (
      (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
    )
    WITH CHECK (
      (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
      OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
    );

END $$;

-- ----------------------------------------------------------------------------
-- 9. REALTIME
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.store_config;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ----------------------------------------------------------------------------
-- 10. MANTENIMIENTO AUTOMATICO
-- NOTA: Para ejecutar automaticamente, configurar pg_cron o un scheduler externo
-- SELECT cron.schedule('cleanup-notifications', '0 3 * * *', 'SELECT delete_old_notifications()');
-- ----------------------------------------------------------------------------

-- Limpiar store_config legacy
UPDATE public.store_config
SET push_webhook_url = '', push_webhook_secret = ''
WHERE id = 1 AND push_webhook_url IS NULL;

-- ----------------------------------------------------------------------------
-- 11. CREAR OPERADOR: sugolo28@gmail.com
-- SECURITY: Este bloque solo debe ejecutarse una vez en setup inicial
-- ----------------------------------------------------------------------------
-- Primero crear el usuario en Supabase Auth (Authentication > Users > New User)
-- Email: sugolo28@gmail.com, Password: (elegir), Auto Confirm: ON
-- Luego ejecutar estos pasos:

UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "operator"}'::jsonb
WHERE email = 'sugolo28@gmail.com';

INSERT INTO admin_users (id, email, nombre, role, active)
SELECT id, email, 'Operador Principal', 'operator', true
FROM auth.users
WHERE email = 'sugolo28@gmail.com'
ON CONFLICT (email) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 12. PRODUCTOS DE EJEMPLO (50 productos)
-- NOTA: En produccion, estos datos deben cargarse via seed script separado
-- ----------------------------------------------------------------------------

-- HAMBURGUESAS
INSERT INTO products (nombre, descripcion, categoria, precio_usd, stock, imagen_urls, es_promo, es_nuevo, es_mas_vendido, delivery_gratis, activo) VALUES
('Smash Clasica', 'Doble smash de carne 100% res, queso cheddar derretido, cebolla caramelizada, pickle y salsa especial.', 'Hamburguesas', 7.50, 60, ARRAY['https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=500'], false, false, true, false, true),
('Bacon Explosion', 'Doble carne smash, bacon crujiente, queso pepper jack, cebolla crispy y salsa BBQ ahumada.', 'Hamburguesas', 9.50, 50, ARRAY['https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&q=80&w=500'], true, false, true, false, true),
('Mushroom Swiss', 'Carne smash jugosa, champinones salteados, queso suizo derretido y mayonesa de trufa.', 'Hamburguesas', 10.00, 40, ARRAY['https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?auto=format&fit=crop&q=80&w=500'], false, true, false, false, true),
('BBQ Bacon Cheddar', 'Carne smash, bacon, cheddar derretido, aros de cebolla y salsa BBQ de la casa.', 'Hamburguesas', 8.90, 55, ARRAY['https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&q=80&w=500'], false, false, true, false, true),
('Veggie Burger', 'Burger de lentejas y champinones, lechuga, tomate, aguacate y salsa de yogurt.', 'Hamburguesas', 8.50, 30, ARRAY['https://images.unsplash.com/photo-1520072959219-c595dc870360?auto=format&fit=crop&q=80&w=500'], false, true, false, false, true),
('Smash Doble Queso', 'Doble carne smash, doble queso americano derretido, pepinillos y mostaza.', 'Hamburguesas', 8.50, 45, ARRAY['https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=500'], false, false, true, false, true),
('Crispy Chicken Burger', 'Pechuga de pollo empanizada crujiente, lechuga, tomate, mayonesa y pan tostado.', 'Hamburguesas', 8.00, 40, ARRAY['https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&q=80&w=500'], false, false, false, false, true),
('Hawaiian Burger', 'Carne smash, pina asada, jamon, queso suizo derretido y salsa teriyaki.', 'Hamburguesas', 9.00, 35, ARRAY['https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?auto=format&fit=crop&q=80&w=500'], false, true, false, false, true),
('Texas BBQ Burger', 'Triple carne smash, bacon, cheddar, onion rings, jalapenos y salsa BBQ ahumada.', 'Hamburguesas', 11.00, 25, ARRAY['https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=500'], true, false, false, false, true),
('Burger Infantil', 'Carne smash pequena, queso americano, papas fritas incluidas y salsa de tomate.', 'Hamburguesas', 5.50, 50, ARRAY['https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&q=80&w=500'], false, false, false, false, true);

-- PIZZAS
INSERT INTO products (nombre, descripcion, categoria, precio_usd, stock, imagen_urls, es_promo, es_nuevo, es_mas_vendido, delivery_gratis, activo) VALUES
('Pizza Pepperoni', 'Pizza clasica con pepperoni, queso mozzarella y salsa de tomate casera.', 'Pizzas', 9.00, 30, ARRAY['https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&q=80&w=500'], false, false, true, false, true),
('Pizza Margherita', 'Pizza tradicional con mozzarella fresca, albahaca, salsa de tomate y aceite de oliva.', 'Pizzas', 8.50, 30, ARRAY['https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&q=80&w=500'], false, false, true, false, true),
('Pizza BBQ Chicken', 'Pizza con pollo BBQ, cebolla morada, queso mozzarella y salsa BBQ ahumada.', 'Pizzas', 10.50, 25, ARRAY['https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=80&w=500'], false, true, false, false, true),
('Pizza Mexicana', 'Pizza con carne molida, jalapenos, pimientos, cebolla, nachos y queso picante.', 'Pizzas', 11.00, 20, ARRAY['https://images.unsplash.com/photo-1593504049359-74330189a345?auto=format&fit=crop&q=80&w=500'], false, true, false, false, true),
('Pizza Hawaiana', 'Pizza con jamon, pina, mozzarella y salsa de tomate.', 'Pizzas', 9.50, 30, ARRAY['https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=80&w=500'], false, false, false, false, true),
('Pizza Vegetariana', 'Pizza con champinones, pimientos, aceitunas, cebolla, maiz y mozzarella.', 'Pizzas', 10.00, 25, ARRAY['https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&q=80&w=500'], false, false, false, false, true);

-- POLLO
INSERT INTO products (nombre, descripcion, categoria, precio_usd, stock, imagen_urls, es_promo, es_nuevo, es_mas_vendido, delivery_gratis, activo) VALUES
('Alitas BBQ x6', '6 alitas de pollo banadas en salsa BBQ ahumada, acompanadas de papas fritas.', 'Pollo', 6.50, 40, ARRAY['https://images.unsplash.com/photo-1608039755401-742074f0548d?auto=format&fit=crop&q=80&w=500'], false, false, true, false, true),
('Alitas Buffalo x6', '6 alitas de pollo con salsa buffalo picante, aderezo blue cheese y papas.', 'Pollo', 6.50, 40, ARRAY['https://images.unsplash.com/photo-1608039755401-742074f0548d?auto=format&fit=crop&q=80&w=500'], false, false, false, false, true),
('Alitas Miel Mostaza x6', '6 alitas de pollo glaseadas con salsa miel mostaza y ajonjoli.', 'Pollo', 6.50, 40, ARRAY['https://images.unsplash.com/photo-1608039755401-742074f0548d?auto=format&fit=crop&q=80&w=500'], false, true, false, false, true),
('Chicken Tenders x4', '4 tiras de pechuga empanizadas, crujientes por fuera y jugosas por dentro.', 'Pollo', 7.00, 35, ARRAY['https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&q=80&w=500'], false, false, true, false, true),
('Pollo BBQ Asado', 'Mitad de pollo asado con salsa BBQ, acompanado de papas y ensalada fresca.', 'Pollo', 8.50, 20, ARRAY['https://images.unsplash.com/photo-1598103442097-8b7c2fbaa3b1?auto=format&fit=crop&q=80&w=500'], false, false, false, false, true);

-- PAPAS & SIDES
INSERT INTO products (nombre, descripcion, categoria, precio_usd, stock, imagen_urls, es_promo, es_nuevo, es_mas_vendido, delivery_gratis, activo) VALUES
('Papas Fritas Clasicas', 'Papas fritas crocantes con sal marina, servidas con salsa ketchup de la casa.', 'Papas & Sides', 3.50, 100, ARRAY['https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&q=80&w=500'], false, false, true, false, true),
('Papas Cheddar & Bacon', 'Papas fritas cubiertas con queso cheddar derretido y bacon bits crujientes.', 'Papas & Sides', 5.00, 60, ARRAY['https://images.unsplash.com/photo-1617127365659-c47c8646ef44?auto=format&fit=crop&q=80&w=500'], false, false, false, false, true),
('Onion Rings', 'Aros de cebolla empanizados y fritos hasta quedar dorados y crujientes.', 'Papas & Sides', 4.00, 50, ARRAY['https://images.unsplash.com/photo-1639024471283-03518883512d?auto=format&fit=crop&q=80&w=500'], false, false, false, false, true),
('Papas Cajun', 'Papas fritas sazonadas con especias cajun, servidas con crema agria.', 'Papas & Sides', 4.50, 50, ARRAY['https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&q=80&w=500'], false, true, false, false, true),
('Aros de Cebolla Extra', 'Aros de cebolla empanizados con panko, fritos, servidos con salsa BBQ.', 'Papas & Sides', 4.00, 50, ARRAY['https://images.unsplash.com/photo-1639024471283-03518883512d?auto=format&fit=crop&q=80&w=500'], false, false, false, false, true),
('Papas Locas', 'Papas fritas con queso cheddar, bacon, jalapenos, crema agria y pico de gallo.', 'Papas & Sides', 6.00, 40, ARRAY['https://images.unsplash.com/photo-1617127365659-c47c8646ef44?auto=format&fit=crop&q=80&w=500'], false, true, false, false, true);

-- ENTRADAS
INSERT INTO products (nombre, descripcion, categoria, precio_usd, stock, imagen_urls, es_promo, es_nuevo, es_mas_vendido, delivery_gratis, activo) VALUES
('Nachos Supreme', 'Totopos de maiz con queso cheddar derretido, guacamole, crema agria, jalapenos y pico de gallo.', 'Entradas', 6.50, 35, ARRAY['https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&q=80&w=500'], false, false, true, false, true),
('Tequenos x6', '6 palitos de queso envueltos en masa hojaldrada, fritos hasta dorar.', 'Entradas', 4.50, 50, ARRAY['https://images.unsplash.com/photo-1625220194771-7ebdea0b70b7?auto=format&fit=crop&q=80&w=500'], false, false, false, false, true),
('Empanadas de Queso x3', '3 empanadas fritas rellenas de queso, doradas y crujientes.', 'Entradas', 4.00, 40, ARRAY['https://images.unsplash.com/photo-1625220194771-7ebdea0b70b7?auto=format&fit=crop&q=80&w=500'], false, false, false, false, true),
('Mozzarella Sticks x6', '6 palitos de mozzarella empanizados con salsa marinara y crema de ajo.', 'Entradas', 5.50, 35, ARRAY['https://images.unsplash.com/photo-1625220194771-7ebdea0b70b7?auto=format&fit=crop&q=80&w=500'], false, true, false, false, true);

-- COMBOS
INSERT INTO products (nombre, descripcion, categoria, precio_usd, stock, imagen_urls, es_promo, es_nuevo, es_mas_vendido, delivery_gratis, activo) VALUES
('Combo Smash + Papas', 'Hamburguesa Smash Clasica + Papas Fritas + Bebida 500ml.', 'Combos', 11.90, 50, ARRAY['https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=500'], true, false, true, false, true),
('Combo Doble + Papas Grandes', 'Doble BBQ Bacon Cheddar + Papas Grandes + Bebida 500ml.', 'Combos', 15.90, 40, ARRAY['https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&q=80&w=500'], false, false, false, false, true),
('Combo Familiar 4 pers', '4 Smash Clasicas + Papas Familiares + 4 Bebidas + Onion Rings.', 'Combos', 34.90, 20, ARRAY['https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=500'], true, false, false, true, true),
('Combo Pizza + Papas', 'Pizza Pepperoni Personal + Papas Fritas + Bebida 500ml.', 'Combos', 14.90, 25, ARRAY['https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=80&w=500'], false, true, false, false, true),
('Combo Alitas + Papas', '6 Alitas BBQ + Papas Fritas + Bebida 500ml + Aderezo.', 'Combos', 12.50, 30, ARRAY['https://images.unsplash.com/photo-1608039755401-742074f0548d?auto=format&fit=crop&q=80&w=500'], false, false, false, false, true),
('Combo Infantil', 'Burger Infantil + Papas pequenas + Jugo + Juguete sorpresa.', 'Combos', 8.50, 40, ARRAY['https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&q=80&w=500'], false, false, false, false, true);

-- BEBIDAS
INSERT INTO products (nombre, descripcion, categoria, precio_usd, stock, imagen_urls, es_promo, es_nuevo, es_mas_vendido, delivery_gratis, activo) VALUES
('Coca-Cola 500ml', 'Refresco de cola 500ml bien frio.', 'Bebidas', 1.50, 150, ARRAY['https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=500'], false, false, true, false, true),
('Sprite 500ml', 'Refresco de limon 500ml, refrescante y burbujeante.', 'Bebidas', 1.50, 150, ARRAY['https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=500'], false, false, false, false, true),
('Fanta 500ml', 'Refresco de naranja 500ml.', 'Bebidas', 1.50, 150, ARRAY['https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=500'], false, false, false, false, true),
('Agua Mineral 500ml', 'Agua mineral natural sin gas.', 'Bebidas', 1.00, 200, ARRAY['https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=500'], false, false, false, false, true),
('Milkshake de Vainilla', 'Malteada cremosa de vainilla con crema batida y chips de chocolate.', 'Bebidas', 4.50, 40, ARRAY['https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&q=80&w=500'], false, true, false, false, true),
('Milkshake de Chocolate', 'Malteada cremosa de chocolate con crema batida y salsa de chocolate.', 'Bebidas', 4.50, 40, ARRAY['https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&q=80&w=500'], false, false, false, false, true),
('Limonada Natural', 'Limonada fresca preparada al momento con limon natural y hielo.', 'Bebidas', 2.00, 60, ARRAY['https://images.unsplash.com/photo-1621263764928-df1444c5e859?auto=format&fit=crop&q=80&w=500'], false, false, false, false, true);

-- POSTRES
INSERT INTO products (nombre, descripcion, categoria, precio_usd, stock, imagen_urls, es_promo, es_nuevo, es_mas_vendido, delivery_gratis, activo) VALUES
('Brownie con Helado', 'Brownie de chocolate caliente con una bola de helado de vainilla y salsa de chocolate.', 'Postres', 5.50, 30, ARRAY['https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=500'], false, false, true, false, true),
('Cheesecake de Fresa', 'Tajada de cheesecake cremoso con coulis de fresa fresca.', 'Postres', 4.50, 25, ARRAY['https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&q=80&w=500'], false, true, false, false, true),
('Crepas con Nutella', '2 crepas suaves rellenas de Nutella, fresas y platano.', 'Postres', 5.00, 25, ARRAY['https://images.unsplash.com/photo-1519676867240-f03562e64548?auto=format&fit=crop&q=80&w=500'], false, false, false, false, true),
('Sundae de Chocolate', 'Helado de chocolate con crema batida, salsa de chocolate, nueces y cereza.', 'Postres', 4.00, 35, ARRAY['https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=500'], false, false, false, false, true),
('Flan Casero', 'Flan de caramelo casero, suave y cremoso.', 'Postres', 3.50, 30, ARRAY['https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&q=80&w=500'], false, false, false, false, true),
('Helado Artesanal 2 bolas', '2 bolas de helado artesanal a eleccion.', 'Postres', 3.50, 40, ARRAY['https://images.unsplash.com/photo-1501443762994-82bd5dace89a?auto=format&fit=crop&q=80&w=500'], false, false, false, false, true);

-- ----------------------------------------------------------------------------
-- FIN DEL ESQUEMA
-- SECURITY SUMMARY:
-- [x] Todas las SECURITY DEFINER functions tienen SET search_path = public
-- [x] get_all_push_subscriptions() restringido a admin/operator
-- [x] RLS habilitado en TODAS las tablas incluyendo food_item_options
-- [x] reward_catalog: policy ALL corregida (no anula SELECT)
-- [x] notifications UPDATE: solo authenticated (anon bloqueado)
-- [x] orders INSERT: validacion de campos obligatorios
-- [x] Index en orders(cliente_uid) agregado
-- [x] Stock validation antes de descontar
-- [x] handle_auth_user_created maneja updates (ON CONFLICT DO UPDATE)
-- [x] push_subscriptions.user_id corregido a TEXT (match con usuarios_clientes)
-- [x] CORS comments agregados para functions Cloudflare
-- [x] Migraciones legacy removidas (ya no son necesarias)
-- ----------------------------------------------------------------------------

-- ============================================================================
-- MARKETING AUTOMATION: SISTEMA DE RETENCION Y REMARKETING
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 10.1 customer_segments: Asignacion de usuarios a segmentos
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
ALTER TABLE customer_segments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "segments_admin_all" ON customer_segments;
CREATE POLICY "segments_admin_all" ON customer_segments
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
  )
  WITH CHECK (
    (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
  );

-- ----------------------------------------------------------------------------
-- 10.2 automation_rules: Definicion de automatizaciones
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
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_admin_all" ON automation_rules;
CREATE POLICY "automation_admin_all" ON automation_rules
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
  )
  WITH CHECK (
    (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
  );

-- ----------------------------------------------------------------------------
-- 10.3 automation_log: Historial de ejecuciones
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
ALTER TABLE automation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_log_admin_all" ON automation_log;
CREATE POLICY "automation_log_admin_all" ON automation_log
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
  )
  WITH CHECK (
    (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
  );

-- ----------------------------------------------------------------------------
-- 10.4 campaigns: Campanas manuales del admin
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
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaigns_admin_all" ON campaigns;
CREATE POLICY "campaigns_admin_all" ON campaigns
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
  )
  WITH CHECK (
    (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
  );

-- ----------------------------------------------------------------------------
-- 10.5 push_events: Tracking de envio/apertura/clic
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id TEXT NOT NULL,
    campaign_id UUID,
    user_id TEXT,
    anonymous_id TEXT DEFAULT '',
    event_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_events_notif ON push_events(notification_id);
CREATE INDEX IF NOT EXISTS idx_push_events_campaign ON push_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_push_events_type ON push_events(event_type);
CREATE INDEX IF NOT EXISTS idx_push_events_created ON push_events(created_at DESC);
ALTER TABLE push_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_events_insert_anon" ON push_events;
CREATE POLICY "push_events_insert_anon" ON push_events
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "push_events_admin_all" ON push_events;
CREATE POLICY "push_events_admin_all" ON push_events
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
  )
  WITH CHECK (
    (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
  );

-- ----------------------------------------------------------------------------
-- 10.6 push_rate_limits: Rate limiting por usuario por semana
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    week_start DATE NOT NULL,
    push_count INTEGER NOT NULL DEFAULT 0,
    max_pushes INTEGER NOT NULL DEFAULT 3,
    last_push_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, week_start)
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_week ON push_rate_limits(user_id, week_start);
ALTER TABLE push_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rate_limits_admin_all" ON push_rate_limits;
CREATE POLICY "rate_limits_admin_all" ON push_rate_limits
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
  )
  WITH CHECK (
    (auth.jwt() ->> 'email' = 'kecho8a@gmail.com')
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'operator')
  );

-- ----------------------------------------------------------------------------
-- 10.7 RPC Functions: Rate Limiting y Segmentacion
-- ----------------------------------------------------------------------------

-- Verificar si un usuario puede recibir push esta semana
CREATE OR REPLACE FUNCTION public.check_push_rate_limit(p_user_id TEXT)
RETURNS BOOLEAN
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_week_start DATE;
    v_count INTEGER;
    v_max INTEGER;
BEGIN
    v_week_start := date_trunc('week', CURRENT_DATE)::date;
    SELECT push_count, max_pushes INTO v_count, v_max
    FROM push_rate_limits
    WHERE user_id = p_user_id AND week_start = v_week_start;
    IF NOT FOUND THEN
        RETURN TRUE;
    END IF;
    RETURN v_count < v_max;
END;
$$;

-- Incrementar contador de pushes
CREATE OR REPLACE FUNCTION public.increment_push_count(p_user_id TEXT)
RETURNS VOID
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_week_start DATE;
BEGIN
    v_week_start := date_trunc('week', CURRENT_DATE)::date;
    INSERT INTO push_rate_limits (user_id, week_start, push_count, last_push_at)
    VALUES (p_user_id, v_week_start, 1, NOW())
    ON CONFLICT (user_id, week_start) DO UPDATE
    SET push_count = push_rate_limits.push_count + 1,
        last_push_at = NOW();
END;
$$;

-- Reset semanal de rate limits
CREATE OR REPLACE FUNCTION public.reset_weekly_rate_limits()
RETURNS VOID
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    DELETE FROM push_rate_limits
    WHERE week_start < (CURRENT_DATE - INTERVAL '4 weeks')::date;
END;
$$;

-- Evaluar segmentos de un usuario
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

-- Evaluar segmentos de todos los usuarios (batch)
CREATE OR REPLACE FUNCTION public.evaluate_all_segments()
RETURNS VOID
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user RECORD;
BEGIN
    FOR v_user IN SELECT id FROM usuarios_clientes LOOP
        PERFORM evaluate_user_segments(v_user.id);
    END LOOP;
END;
$$;

-- Incrementar click count de notificacion
DROP FUNCTION IF EXISTS public.increment_notification_click(TEXT);
CREATE OR REPLACE FUNCTION public.increment_notification_click(p_notif_id TEXT)
RETURNS VOID
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE notifications SET click_count = COALESCE(click_count, 0) + 1 WHERE id = p_notif_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 10.8 Seed: 8 automatizaciones default
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_automation_rules()
RETURNS VOID
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO automation_rules (name, slug, description, trigger_type, trigger_config, action_type, action_config, cooldown_hours, max_sends_per_user) VALUES
    (
        'Gracias Post-Pedido', 'post_purchase_thank_you',
        'Envia push de gracias 30 min despues de entrega con puntos por review.',
        'event_based',
        '{"event": "order.status_changed", "status": "Entregado", "delay_minutes": 30}'::jsonb,
        'push',
        '{"title_template": "Gracias por tu compra, {{user_name}}! 🎉", "body_template": "Tu pedido #{{order_id}} fue entregado. Califica tu experiencia y gana puntos extra!", "link_url": "/?tab=profile"}'::jsonb,
        24, 1
    ),
    (
        'Actualizacion de Delivery', 'delivery_status_update',
        'Notifica cuando el pedido cambia a En camino o Entregado.',
        'event_based',
        '{"event": "order.status_changed", "statuses": ["En camino", "Entregado"]}'::jsonb,
        'push',
        '{"title_template": "Tu pedido #{{order_id}} esta en camino 🛵", "body_template": "Tu pedido va de camino. ¡Preparate para recibirlo!", "link_url": "/?tab=profile"}'::jsonb,
        1, 10
    ),
    (
        'Solicitud de Review', 'review_request',
        'Pide review 2 horas despues de entrega con incentivo de puntos.',
        'event_based',
        '{"event": "order.status_changed", "status": "Entregado", "delay_minutes": 120}'::jsonb,
        'push',
        '{"title_template": "¿Que te pareció tu pedido? ⭐", "body_template": "Tu opinion nos ayuda a mejorar. Califica y gana puntos.", "link_url": "/?tab=profile"}'::jsonb,
        72, 2
    ),
    (
        'Carrito Abandonado', 'cart_abandonment',
        'Recuerda carritos abandonados despues de 60 min de inactividad.',
        'event_based',
        '{"event": "cart.idle", "idle_minutes": 60}'::jsonb,
        'push',
        '{"title_template": "¡Te esperamos! 🛒", "body_template": "Tienes productos en tu carrito. ¡Ordénalos antes de que se agoten!", "link_url": "/?tab=cart"}'::jsonb,
        48, 2
    ),
    (
        'Re-engagement Inactivos', 'winback_inactive',
        'Reactiva usuarios inactivos 30+ dias con oferta especial.',
        'segment_entry',
        '{"segment": "inactive_30d", "daily_cap": 1}'::jsonb,
        'push',
        '{"title_template": "¡Te extrañamos, {{user_name}}! 💛", "body_template": "Vuelve y disfruta de un 15% de descuento con el codigo BIENVENIDO15.", "link_url": "/?tab=catalog"}'::jsonb,
        720, 3
    ),
    (
        'Bonus Cumpleaños', 'birthday_bonus',
        'Envia regalo de cumpleaños con puntos y cupon especial.',
        'event_based',
        '{"event": "user.birthday", "days_before": 0, "days_after": 3}'::jsonb,
        'push',
        '{"title_template": "¡Feliz cumpleaños, {{user_name}}! 🎂", "body_template": "Te regalamos puntos y un descuento especial. ¡Celebra con nosotros!", "link_url": "/?tab=profile"}'::jsonb,
        8760, 1
    ),
    (
        'Celebracion de Tier', 'tier_upgrade',
        'Celebra cuando un usuario sube de tier de fidelizacion.',
        'event_based',
        '{"event": "loyalty.tier_changed"}'::jsonb,
        'push',
        '{"title_template": "¡Felicidades, ascendiste! 🏆", "body_template": "Ahora tienes beneficios exclusivos. Sigue acumulando puntos para subir mas.", "link_url": "/?tab=profile"}'::jsonb,
        8760, 1
    ),
    (
        'Cupón por Vencer', 'coupon_expiry_reminder',
        'Recuerda 48 horas antes de que expire un cupon.',
        'event_based',
        '{"event": "coupon.expiring_soon", "hours_before": 48}'::jsonb,
        'push',
        '{"title_template": "Tu cupón vence pronto! ⏰", "body_template": "Tienes un descuento que vence en 48 horas. ¡Úsalo ahora!", "link_url": "/?tab=catalog"}'::jsonb,
        24, 2
    )
    ON CONFLICT (slug) DO NOTHING;
END;
$$;

SELECT seed_automation_rules();

-- ----------------------------------------------------------------------------
-- 10.9 Permisos para las nuevas tablas
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON customer_segments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_segments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON automation_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON automation_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON campaigns TO authenticated;
GRANT SELECT, INSERT ON push_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON push_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON push_rate_limits TO authenticated;
