-- ========================================================
-- MÓDULO: CHECKOUT, TRES PASOS Y PAGOS
-- ARCHIVO: /supabase/basedatos/03_checkout_tres_pasos_pagos.sql
-- PROPÓSITO: Cupones, carrito persistente, proceso de compra
-- ÚLTIMA REVISIÓN: 2026-08-23
-- ========================================================

-- ----------------------------------------------------------------------------
-- 1. coupons (CUPONES DE DESCUENTO)
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
-- 2. user_carts (CARRITO PERSISTENTE)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_carts (
    user_id TEXT PRIMARY KEY,
    cart_data JSONB NOT NULL DEFAULT '[]'::JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 3. POLÍTICAS RLS
-- ----------------------------------------------------------------------------
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_carts ENABLE ROW LEVEL SECURITY;

-- coupons: Solo activos visibles públicamente, admin gestiona
DROP POLICY IF EXISTS "Lectura cupones publica" ON coupons;
CREATE POLICY "Lectura cupones publica" ON coupons
    FOR SELECT TO anon, authenticated USING (active = true);

DROP POLICY IF EXISTS "Gestion cupones admin" ON coupons;
CREATE POLICY "Gestion cupones admin" ON coupons
    FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

-- user_carts: Solo propietario gestiona su carrito
DROP POLICY IF EXISTS "user_carts_select_own" ON user_carts;
CREATE POLICY "user_carts_select_own" ON user_carts
    FOR SELECT TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "user_carts_upsert_own" ON user_carts;
CREATE POLICY "user_carts_upsert_own" ON user_carts
    FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "user_carts_update_own" ON user_carts;
CREATE POLICY "user_carts_update_own" ON user_carts
    FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "user_carts_delete_own" ON user_carts;
CREATE POLICY "user_carts_delete_own" ON user_carts
    FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- ----------------------------------------------------------------------------
-- 4. PERMISOS
-- ----------------------------------------------------------------------------
GRANT SELECT ON coupons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_carts TO authenticated;
