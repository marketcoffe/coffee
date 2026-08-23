-- ========================================================
-- MÓDULO: CORE SISTEMA, SEDES Y ROLES
-- ARCHIVO: /supabase/basedatos/01_core_sistema_sedes_roles.sql
-- PROPÓSITO: Configuración central, usuarios, roles admin/operator/customer, sedes
-- ÚLTIMA REVISIÓN: 2026-08-23
-- ========================================================

-- ----------------------------------------------------------------------------
-- EXTENSIONES REQUERIDAS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ----------------------------------------------------------------------------
-- 1. store_config (CONFIGURACIÓN CENTRAL WHITE-LABEL)
-- Tabla singleton (id=1) con toda la configuración de la tienda
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_config (
    id SERIAL PRIMARY KEY,

    -- Identidad del sitio
    site_nombre TEXT NOT NULL DEFAULT 'Market Coffee Sweet',
    telefono_soporte TEXT NOT NULL DEFAULT '+584124058904',
    direccion_fisica TEXT NOT NULL DEFAULT 'Av. Principal El Trigal, justo al frente de Patio Trigal, Valencia, Carabobo',
    tienda_lat NUMERIC(10, 6) NOT NULL DEFAULT 10.218500,
    tienda_lng NUMERIC(10, 6) NOT NULL DEFAULT -68.002100,
    logo_url TEXT DEFAULT '',
    secondary_logo_url TEXT DEFAULT '',
    pwa_icon_url TEXT DEFAULT '',
    splash_logo_url TEXT DEFAULT '',
    favicon_url TEXT DEFAULT '',
    site_url TEXT DEFAULT '',

    -- Banners
    banner_url_1 TEXT NOT NULL DEFAULT '/imagen/descarga_app.webp',
    banner_url_2 TEXT NOT NULL DEFAULT '/imagen/combo-banner.webp',
    banner_url_3 TEXT NOT NULL DEFAULT '/imagen/panaderia_pc.webp',
    banner_url_1_mobile TEXT DEFAULT '/imagen/descarga_appmovil.webp',
    banner_url_2_mobile TEXT DEFAULT '/imagen/combos_movil.webp',
    banner_url_3_mobile TEXT DEFAULT '/imagen/panaderia_movil.webp',
    banner_texts TEXT[] DEFAULT ARRAY['', 'Combos Especiales para ti', 'Pan Artesanal Fresco']::TEXT[],
    banner_titles TEXT[] DEFAULT ARRAY['', 'Combos Especiales para ti', 'Pan Artesanal Fresco']::TEXT[],
    banner_descriptions TEXT[] DEFAULT ARRAY['', 'Ahorra más comprando en combo, ofertas listas para toda ocasión', 'Pan fresco, tortas, dulces y pastelería del día']::TEXT[],
    banner_cta_texts TEXT[] DEFAULT ARRAY['', 'Ver combos', '']::TEXT[],
    banner_cta_urls TEXT[] DEFAULT ARRAY['', '/catalog', '']::TEXT[],

    -- Colores y tema
    theme_color VARCHAR(10) NOT NULL DEFAULT '#6E472A',
    secondary_color VARCHAR(10) DEFAULT '#A4D045',
    accent_color VARCHAR(10) DEFAULT '#FFBE0B',
    theme_mode VARCHAR(10) DEFAULT 'light',

    -- Métodos de pago
    zelle_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    zelle_data TEXT NOT NULL DEFAULT 'pagos@marketcoffesweet.com',
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

    -- Categorías
    categories TEXT[] DEFAULT ARRAY['Bebidas', 'Carnicería', 'Charcutería', 'Charcutería y Embutidos', 'Combos Familiares', 'Comida Rapida', 'Frutas y Verduras', 'Higiene Personal', 'Hogar', 'Lácteos', 'Licores', 'Limpieza', 'Mascotas', 'Panaderia', 'Dulces y Postres', 'Salsas y Condimentos', 'Snacks y Frituras', 'Viveres']::TEXT[],
    categories_images JSONB DEFAULT '{}'::JSONB,
    categories_colors JSONB DEFAULT '{}'::JSONB,

    -- Tienda
    esta_abierta BOOLEAN NOT NULL DEFAULT TRUE,
    tiene_mesas BOOLEAN NOT NULL DEFAULT FALSE,
    total_mesas INTEGER DEFAULT 0,
    recogida_en_local BOOLEAN NOT NULL DEFAULT TRUE,
    entrega_por_zonas BOOLEAN NOT NULL DEFAULT TRUE,
    delivery_gratis BOOLEAN NOT NULL DEFAULT FALSE,
    delivery_gratis_threshold NUMERIC(10,2) DEFAULT 0,
    costo_delivery_km NUMERIC(10,2) DEFAULT 1.50,
    envio_nacional BOOLEAN NOT NULL DEFAULT FALSE,
    costo_envio_nacional NUMERIC(10,2) DEFAULT 0,
    stock_alert_threshold INTEGER DEFAULT 5,
    delivery_zonas JSONB DEFAULT '[{"id": "z1", "name": "El Trigal (0-3 km)", "cost": 2.00, "minKm": 0, "maxKm": 3}, {"id": "z2", "name": "La Trigaleña / Prebo (3-8 km)", "cost": 4.50, "minKm": 3, "maxKm": 8}, {"id": "z3", "name": "La Viña / Mañongo / Naguanagua / San Diego (8-18 km)", "cost": 7.00, "minKm": 8, "maxKm": 18}]'::JSONB,

    -- Textos / Hero
    mensaje_bienvenida TEXT DEFAULT 'Tu minimarket de confianza, panadería, comida rápida de la buena y víveres para resolver el mercado.',
    mensaje_cierre TEXT DEFAULT 'Cerrado por ahora. Volveremos pronto.',
    hero_title TEXT DEFAULT '',
    hero_subtitle TEXT DEFAULT '',
    hero_cta_text TEXT DEFAULT 'Descargar la app',
    hero_cta_url TEXT DEFAULT '#download-app',
    hero_effect VARCHAR(20) DEFAULT 'fade',
    hero_height VARCHAR(20) DEFAULT 'auto',
    hero_overlay_opacity INTEGER DEFAULT 100,

    -- Títulos de secciones
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
    seo_home_title TEXT DEFAULT 'Market Coffee Sweet | Panadería, Comida Rápida y Víveres en Valencia',
    seo_home_description TEXT DEFAULT 'Tu minimarket de confianza en El Trigal, Valencia. Panadería fresca, comida rápida (hamburguesas, shawarmas, perros calientes), víveres, frutas, verduras, bebidas y agua potable con delivery a domicilio.',
    seo_home_keywords TEXT DEFAULT 'panadería, comida rápida, hamburguesas, shawarmas, víveres, delivery, Valencia, El Trigal, Prebo, La Viña, Mañongo, Naguanagua, San Diego, minimarket, pan fresco, agua potable',
    seo_catalog_title TEXT DEFAULT 'Catálogo de Productos',
    seo_catalog_description TEXT DEFAULT 'Explora nuestro catálogo completo: panadería fresca, comida rápida, víveres, frutas, verduras, bebidas y más con delivery en Valencia y alrededores.',
    jsonld_type VARCHAR(50) DEFAULT 'FastFoodRestaurant',
    jsonld_priceRange VARCHAR(10) DEFAULT '$$',
    jsonld_servesCuisine TEXT[] DEFAULT ARRAY['Panadería', 'Comida Rápida', 'Hamburguesas', 'Shawarma', 'Víveres', 'Bebidas']::TEXT[],

    -- Redes sociales
    instagram_url TEXT DEFAULT '',
    twitter_url TEXT DEFAULT '',
    facebook_url TEXT DEFAULT '',
    tiktok_url TEXT DEFAULT '',
    youtube_url TEXT DEFAULT '',

    -- Push (URLs, secrets en app_secrets)
    push_webhook_url TEXT DEFAULT '',
    push_webhook_secret TEXT DEFAULT '',

    -- Tipografía
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
-- 2. usuarios_clientes (PERFILES DE CLIENTES)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios_clientes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    nombre TEXT NOT NULL,
    email TEXT UNIQUE,
    telefono VARCHAR(20) UNIQUE,
    contrasena TEXT NOT NULL DEFAULT 'auth_managed',
    loyalty_points INTEGER DEFAULT 0,
    loyalty_lifetime_points INTEGER DEFAULT 0,
    loyalty_tier_id TEXT DEFAULT '',
    sede_preferida_id TEXT DEFAULT '',
    is_pwa_installed BOOLEAN DEFAULT FALSE,
    pwa_installed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 3. admin_users (ROLES ADMIN / OPERATOR / CUSTOMER)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator', 'customer')),
    active BOOLEAN NOT NULL DEFAULT true,
    sede_id TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_sede ON admin_users(sede_id)
    WHERE sede_id IS NOT NULL AND sede_id != '';

-- ----------------------------------------------------------------------------
-- 4. FUNCIONES HELPER DE ROLES
-- SECURITY: SECURITY DEFINER con SET search_path para prevenir inyección
-- ----------------------------------------------------------------------------

-- is_admin(): Solo rol 'admin'
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users a
    WHERE a.id::text = auth.uid()::text
      AND a.active = true
      AND a.role = 'admin'
  );
$$;

-- is_operator(): Admin + Operator (NO customer)
CREATE OR REPLACE FUNCTION public.is_operator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users a
    WHERE a.id::text = auth.uid()::text
      AND a.active = true
      AND a.role IN ('admin', 'operator')
  );
$$;

-- is_admin_or_operator(): Combinación de admin u operator
CREATE OR REPLACE FUNCTION public.is_admin_or_operator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT (public.is_admin() OR public.is_operator());
$$;

-- is_customer(): Solo rol 'customer'
CREATE OR REPLACE FUNCTION public.is_customer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users a
    WHERE a.id::text = auth.uid()::text
      AND a.active = true
      AND a.role = 'customer'
  );
$$;

-- ----------------------------------------------------------------------------
-- 5. TRIGGER: Sincronizar usuarios desde Auth + Welcome Bonus
-- ----------------------------------------------------------------------------
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

    -- Welcome Bonus: otorgar puntos si loyalty está habilitado
    SELECT loyalty INTO v_loyalty_config FROM store_config WHERE id = 1;
    v_welcome_bonus := COALESCE((v_loyalty_config->>'welcome_bonus')::int, 0);

    IF v_welcome_bonus > 0 AND COALESCE((v_loyalty_config->>'enabled')::boolean, false) THEN
        UPDATE usuarios_clientes
        SET loyalty_points = loyalty_points + v_welcome_bonus,
            loyalty_lifetime_points = loyalty_lifetime_points + v_welcome_bonus
        WHERE id = NEW.id::text;

        -- loyalty_transactions se inserta en 06_marketing después de crear la tabla
        -- Se usa un INSERT directo aquí porque la tabla existirá antes de que se ejecute el trigger en producción
        INSERT INTO loyalty_transactions (user_id, type, points, description)
        VALUES (NEW.id::text, 'bonus', v_welcome_bonus, 'Bonus de bienvenida')
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_created();

-- ----------------------------------------------------------------------------
-- 6. REALTIME para store_config
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.store_config;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 7. POLÍTICAS RLS
-- ----------------------------------------------------------------------------

-- store_config: Lectura pública, escritura admin/operator
ALTER TABLE store_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura config publica" ON store_config;
CREATE POLICY "Lectura config publica" ON store_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all updates only to admin" ON store_config;
CREATE POLICY "Allow all updates only to admin" ON store_config
    FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

-- usuarios_clientes
ALTER TABLE usuarios_clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin lee todos los clientes" ON usuarios_clientes;
CREATE POLICY "Admin lee todos los clientes" ON usuarios_clientes
    FOR SELECT TO authenticated
    USING (public.is_admin_or_operator());

DROP POLICY IF EXISTS "Cliente lee su propio perfil" ON usuarios_clientes;
CREATE POLICY "Cliente lee su propio perfil" ON usuarios_clientes
    FOR SELECT TO authenticated
    USING (auth.uid()::text = id);

DROP POLICY IF EXISTS "Update propio" ON usuarios_clientes;
CREATE POLICY "Update propio" ON usuarios_clientes
    FOR UPDATE TO authenticated USING (auth.uid()::text = id);

DROP POLICY IF EXISTS "Admin gestiona todos los clientes" ON usuarios_clientes;
CREATE POLICY "Admin gestiona todos los clientes" ON usuarios_clientes
    FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

-- admin_users
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_users_admin_all" ON admin_users;
CREATE POLICY "admin_users_admin_all" ON admin_users
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_users_operator_read" ON admin_users;
CREATE POLICY "admin_users_operator_read" ON admin_users
    FOR SELECT TO authenticated
    USING (
        auth.uid()::text = id::text
        OR public.is_admin()
    );

-- ----------------------------------------------------------------------------
-- 8. PERMISOS BASE
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT ON store_config, usuarios_clientes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
