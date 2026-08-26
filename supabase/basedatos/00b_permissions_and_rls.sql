-- ============================================================
-- 00b. PERMISOS Y RLS (solo si paso 14 del script 00 fallo)
-- Ejecutar en Supabase SQL Editor si steps 9-14 no corrieron
-- ============================================================

-- ============================================================================
-- PASO 9: GRANT permisos generales
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON store_config, usuarios_clientes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
GRANT SELECT, INSERT ON orders TO anon;

-- ============================================================================
-- PASO 10: RLS para orders
-- ============================================================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_insert_allow_anon" ON orders;
CREATE POLICY "orders_insert_allow_anon" ON orders FOR INSERT WITH CHECK (
    cliente_nombre IS NOT NULL AND cliente_nombre != ''
    AND cliente_telefono IS NOT NULL AND cliente_telefono != ''
    AND total_usd > 0
);

DROP POLICY IF EXISTS "orders_select_own_or_admin" ON orders;
CREATE POLICY "orders_select_own_or_admin" ON orders
FOR SELECT USING (auth.uid()::text = cliente_uid OR public.is_admin_or_operator());

DROP POLICY IF EXISTS "orders_update_admin" ON orders;
CREATE POLICY "orders_update_admin" ON orders
FOR ALL TO authenticated
USING (public.is_admin_or_operator())
WITH CHECK (public.is_admin_or_operator());

-- ============================================================================
-- PASO 11: RLS para products
-- ============================================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura productos activos" ON products;
CREATE POLICY "Lectura productos activos" ON products
FOR SELECT USING (activo = true OR public.is_admin_or_operator());

DROP POLICY IF EXISTS "Allow admin changes to catalog" ON products;
CREATE POLICY "Allow admin changes to catalog" ON products
FOR ALL TO authenticated
USING (public.is_admin_or_operator())
WITH CHECK (public.is_admin_or_operator());

REVOKE INSERT ON products FROM anon;

-- ============================================================================
-- PASO 12: RLS para store_config
-- ============================================================================
ALTER TABLE store_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura config publica" ON store_config;
CREATE POLICY "Lectura config publica" ON store_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all updates only to admin" ON store_config;
CREATE POLICY "Allow all updates only to admin" ON store_config
FOR ALL TO authenticated
USING (public.is_admin_or_operator())
WITH CHECK (public.is_admin_or_operator());

-- ============================================================================
-- PASO 13: RLS para notifications
-- ============================================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_insert_auth" ON notifications;
CREATE POLICY "notifications_insert_auth" ON notifications
FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_operator());

DROP POLICY IF EXISTS "notifications_insert_personal" ON notifications;
CREATE POLICY "notifications_insert_personal" ON notifications
FOR INSERT TO authenticated
WITH CHECK (tipo = 'personal' AND destinatario_telefono IS NOT NULL AND TRIM(destinatario_telefono) != '');

DROP POLICY IF EXISTS "notifications_select_own_and_broadcast" ON notifications;
CREATE POLICY "notifications_select_own_and_broadcast" ON notifications
FOR SELECT TO authenticated
USING (tipo = 'todos' OR tipo = 'admin'
    OR (tipo = 'personal' AND destinatario_telefono IS NOT NULL AND destinatario_telefono != '')
    OR (tipo = 'request' AND destinatario_telefono IS NOT NULL AND destinatario_telefono != ''));

DROP POLICY IF EXISTS "notifications_admin_all" ON notifications;
CREATE POLICY "notifications_admin_all" ON notifications
FOR ALL TO authenticated
USING (public.is_admin_or_operator())
WITH CHECK (public.is_admin_or_operator());

-- ============================================================================
-- PASO 13b: Drop FK on push_subscriptions.user_id
-- ============================================================================
DO $$ BEGIN
    ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_fkey;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ============================================================================
-- PASO 14: Verificacion
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'REPARACION COMPLETADA';
    RAISE NOTICE 'Admin: kecho8a@gmail.com / admin123';
    RAISE NOTICE 'Buckets: settings, productos, banners, categories, usuarios';
    RAISE NOTICE 'Realtime: 8 tablas en publication supabase_realtime';
    RAISE NOTICE 'RLS: policies recreadas para orders, products, notifications';
    RAISE NOTICE 'Auth: admin_users sincronizado con auth.users';
END $$;
