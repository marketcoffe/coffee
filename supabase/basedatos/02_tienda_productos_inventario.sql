-- ========================================================
-- MÓDULO: TIENDA, PRODUCTOS E INVENTARIO
-- ARCHIVO: /supabase/basedatos/02_tienda_productos_inventario.sql
-- PROPÓSITO: Catálogo de productos, categorías, variantes, opciones/extras, stock
-- ÚLTIMA REVISIÓN: 2026-08-23
-- ========================================================

-- ----------------------------------------------------------------------------
-- 1. products (CATÁLOGO DE PRODUCTOS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    descripcion TEXT DEFAULT '',
    descripcion_completa TEXT DEFAULT '',
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
    disponibilidad TEXT NOT NULL DEFAULT 'Disponible',
    combo_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_categoria ON products(categoria);
CREATE INDEX IF NOT EXISTS idx_products_activo ON products(activo) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_products_es_promo ON products(es_promo) WHERE es_promo = true;
CREATE INDEX IF NOT EXISTS idx_products_es_mas_vendido ON products(es_mas_vendido) WHERE es_mas_vendido = true;
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock) WHERE stock <= 5;

-- ----------------------------------------------------------------------------
-- 2. food_item_options (EXTRAS / OPCIONES POR PRODUCTO)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_item_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    food_item_id UUID REFERENCES products(id) ON DELETE CASCADE,
    group_name TEXT NOT NULL,
    min_select INTEGER NOT NULL DEFAULT 0,
    max_select INTEGER NOT NULL DEFAULT 1,
    options JSONB NOT NULL DEFAULT '[]'::JSONB
);

-- ----------------------------------------------------------------------------
-- 3. flash_sales (OFERTAS FLASH)
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
-- 4. RPC: Ajuste atómico de stock
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adjust_stock(p_id uuid, p_delta integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_or_operator() THEN
    RAISE EXCEPTION 'Access denied: admin or operator role required';
  END IF;

  UPDATE public.products
  SET stock = GREATEST(0, stock + p_delta)
  WHERE id = p_id AND stock + p_delta >= 0;
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_stock(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid, integer) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. REALTIME para products
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.products REPLICA IDENTITY FULL;

-- ----------------------------------------------------------------------------
-- 6. POLÍTICAS RLS
-- ----------------------------------------------------------------------------
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_item_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE flash_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura productos activos" ON products;
CREATE POLICY "Lectura productos activos" ON products
    FOR SELECT USING (activo = true OR public.is_admin_or_operator());

DROP POLICY IF EXISTS "Allow admin changes to catalog" ON products;
CREATE POLICY "Allow admin changes to catalog" ON products
    FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

DROP POLICY IF EXISTS "food_options_select_public" ON food_item_options;
CREATE POLICY "food_options_select_public" ON food_item_options FOR SELECT USING (true);

DROP POLICY IF EXISTS "food_options_admin_all" ON food_item_options;
CREATE POLICY "food_options_admin_all" ON food_item_options
    FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

DROP POLICY IF EXISTS "flash_sales_select_public" ON flash_sales;
CREATE POLICY "flash_sales_select_public" ON flash_sales FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "flash_sales_admin_all" ON flash_sales;
CREATE POLICY "flash_sales_admin_all" ON flash_sales FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

-- ----------------------------------------------------------------------------
-- 7. PERMISOS
-- ----------------------------------------------------------------------------
GRANT SELECT ON products TO anon;
GRANT SELECT ON flash_sales TO anon;
