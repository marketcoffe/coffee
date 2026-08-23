-- ========================================================
-- MÓDULO: REVIEWS DE PRODUCTOS
-- ARCHIVO: /supabase/basedatos/09_reviews_productos.sql
-- PROPÓSITO: Reseñas y calificaciones de productos
-- ÚLTIMA REVISIÓN: 2026-08-23
-- DEPENDENCIAS: 02_tienda (products)
-- ========================================================

-- ----------------------------------------------------------------------------
-- 1. product_reviews (RESEÑAS Y CALIFICACIONES)
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
-- 2. POLÍTICAS RLS
-- ----------------------------------------------------------------------------
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select_public" ON product_reviews;
CREATE POLICY "reviews_select_public" ON product_reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "reviews_insert_auth" ON product_reviews;
CREATE POLICY "reviews_insert_auth" ON product_reviews
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "reviews_insert_anon" ON product_reviews;
CREATE POLICY "reviews_insert_anon" ON product_reviews
    FOR INSERT TO anon WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 3. PERMISOS
-- ----------------------------------------------------------------------------
GRANT SELECT ON product_reviews TO anon;
GRANT INSERT ON product_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_reviews TO authenticated;
