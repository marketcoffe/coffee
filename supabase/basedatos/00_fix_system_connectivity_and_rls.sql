-- ============================================================
-- 00. REPARACIÓN TOTAL: Conectividad Sistema ↔ Supabase
-- ARCHIVO: /supabase/basedatos/00_fix_system_connectivity_and_rls.sql
-- PROPÓSITO: Restaurar la conexión entre Panel Admin, Tienda PWA
--   y Base de Datos Supabase. Script idempotente — ejecutar una sola vez.
-- CAUSA RAÍZ: Admin auth user creado con password vacía → sesión
--   nunca se establece → todas las queries fallan → mock client activo
--   → sistema completamente aislado de la DB real.
-- FECHA: 2026-08-25
-- ============================================================

-- ============================================================================
-- PASO 1: Extensión pgcrypto para hashing de passwords
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- PASO 2: Reparar admin auth user con password REAL
-- Contraseña: admin123 (la que se usa en el mock system)
-- ============================================================================
DO $$
DECLARE
    v_admin_email TEXT := 'kecho8a@gmail.com';
    v_admin_password TEXT := 'admin123';
    v_admin_nombre TEXT := 'Admin';
    v_admin_username TEXT := 'maketo';
    v_auth_user_id UUID;
    v_password_hash TEXT;
BEGIN
    v_password_hash := crypt(v_admin_password, gen_salt('bf'));

    SELECT id INTO v_auth_user_id
    FROM auth.users WHERE email = v_admin_email LIMIT 1;

    IF v_auth_user_id IS NULL THEN
        v_auth_user_id := gen_random_uuid();
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password,
            email_confirmed_at, confirmation_sent_at, recovery_sent_at,
            last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
            created_at, updated_at, confirmation_token
        ) VALUES (
            v_auth_user_id, '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated', v_admin_email, v_password_hash,
            NOW(), NOW(), NULL, NULL,
            '{"provider": "email", "providers": ["email"], "role": "admin"}'::jsonb,
            json_build_object('nombre', v_admin_nombre, 'username', v_admin_username, 'role', 'admin')::jsonb,
            NOW(), NOW(), ''
        );
        RAISE NOTICE 'Auth user CREADO para % (id: %)', v_admin_email, v_auth_user_id;
    ELSE
        UPDATE auth.users SET
            encrypted_password = v_password_hash,
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb,
            raw_user_meta_data = raw_user_meta_data ||
                json_build_object('nombre', v_admin_nombre, 'username', v_admin_username, 'role', 'admin')::jsonb,
            updated_at = NOW()
        WHERE id = v_auth_user_id;
        RAISE NOTICE 'Auth user REPARADO para % (id: %) — password: admin123', v_admin_email, v_auth_user_id;
    END IF;

    INSERT INTO public.admin_users (id, email, username, nombre, role, active, created_at)
    VALUES (v_auth_user_id, v_admin_email, v_admin_username, v_admin_nombre, 'admin', true, NOW())
    ON CONFLICT (id) DO UPDATE SET
        email = v_admin_email, username = v_admin_username, nombre = v_admin_nombre,
        role = 'admin', active = true;

    RAISE NOTICE 'admin_users SINCRONIZADO para %', v_admin_email;
END $$;

-- ============================================================================
-- PASO 3: Funciones de rol (idempotent via CREATE OR REPLACE)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users a
    WHERE a.id::text = auth.uid()::text AND a.active = true AND a.role = 'admin'
  ) OR (auth.email() = 'kecho8a@gmail.com');
$$;

CREATE OR REPLACE FUNCTION public.is_operator()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users a
    WHERE a.id::text = auth.uid()::text AND a.active = true AND a.role IN ('admin', 'operator')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_operator()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT (public.is_admin() OR public.is_operator());
$$;

CREATE OR REPLACE FUNCTION public.is_customer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users a
    WHERE a.id::text = auth.uid()::text AND a.active = true AND a.role = 'customer'
  );
$$;

-- ============================================================================
-- PASO 4: Asegurar columnas criticas que pueden faltar
-- ============================================================================

DO $$ BEGIN
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS descripcion_completa TEXT DEFAULT '';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS disponibilidad TEXT NOT NULL DEFAULT 'Disponible';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS combo_ids TEXT[] DEFAULT ARRAY[]::TEXT[];
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================================
-- PASO 5: REPLICA IDENTITY FULL para Supabase Realtime
-- ============================================================================
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.store_config REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.mesas REPLICA IDENTITY FULL;
ALTER TABLE public.configuracion_pagos REPLICA IDENTITY FULL;
ALTER TABLE public.loyalty_history REPLICA IDENTITY FULL;
ALTER TABLE public.loyalty_rewards REPLICA IDENTITY FULL;

-- ============================================================================
-- PASO 6: PUBLICATION supabase_realtime (idempotente)
-- ============================================================================
DO $$ BEGIN
    CREATE PUBLICATION supabase_realtime;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.store_config; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.products; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.orders; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.mesas; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.configuracion_pagos; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.loyalty_history; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.loyalty_rewards; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- PASO 7: Storage Buckets (idempotente)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('settings', 'settings', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('productos', 'productos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('banners', 'banners', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('usuarios', 'usuarios', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('categories', 'categories', true) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- PASO 8: Storage RLS Policies (DROP + CREATE para idempotencia)
-- ============================================================================

-- ── Settings bucket ──
DROP POLICY IF EXISTS "Permitir subida de logos al admin" ON storage.objects;
CREATE POLICY "Permitir subida de logos al admin" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'settings' AND public.is_admin_or_operator());

DROP POLICY IF EXISTS "Permitir lectura publica de logos" ON storage.objects;
CREATE POLICY "Permitir lectura publica de logos" ON storage.objects
FOR SELECT USING (bucket_id = 'settings');

DROP POLICY IF EXISTS "settings_update_admin" ON storage.objects;
CREATE POLICY "settings_update_admin" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'settings' AND public.is_admin_or_operator())
WITH CHECK (bucket_id = 'settings' AND public.is_admin_or_operator());

DROP POLICY IF EXISTS "settings_delete_admin" ON storage.objects;
CREATE POLICY "settings_delete_admin" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'settings' AND public.is_admin());

-- ── Productos bucket ──
DROP POLICY IF EXISTS "productos_select_public" ON storage.objects;
CREATE POLICY "productos_select_public" ON storage.objects
FOR SELECT USING (bucket_id = 'productos');

DROP POLICY IF EXISTS "productos_insert_admin" ON storage.objects;
CREATE POLICY "productos_insert_admin" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'productos' AND public.is_admin_or_operator());

DROP POLICY IF EXISTS "productos_update_admin" ON storage.objects;
CREATE POLICY "productos_update_admin" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'productos' AND public.is_admin_or_operator())
WITH CHECK (bucket_id = 'productos' AND public.is_admin_or_operator());

DROP POLICY IF EXISTS "productos_delete_admin" ON storage.objects;
CREATE POLICY "productos_delete_admin" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'productos' AND public.is_admin());

-- ── Banners bucket ──
DROP POLICY IF EXISTS "banners_select_public" ON storage.objects;
CREATE POLICY "banners_select_public" ON storage.objects
FOR SELECT USING (bucket_id = 'banners');

DROP POLICY IF EXISTS "banners_insert_admin" ON storage.objects;
CREATE POLICY "banners_insert_admin" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'banners' AND public.is_admin_or_operator());

DROP POLICY IF EXISTS "banners_delete_admin" ON storage.objects;
CREATE POLICY "banners_delete_admin" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'banners' AND public.is_admin());

-- ── Categories bucket (NUEVO — no existía) ──
DROP POLICY IF EXISTS "categories_select_public" ON storage.objects;
CREATE POLICY "categories_select_public" ON storage.objects
FOR SELECT USING (bucket_id = 'categories');

DROP POLICY IF EXISTS "categories_insert_admin" ON storage.objects;
CREATE POLICY "categories_insert_admin" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'categories' AND public.is_admin_or_operator());

DROP POLICY IF EXISTS "categories_update_admin" ON storage.objects;
CREATE POLICY "categories_update_admin" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'categories' AND public.is_admin_or_operator())
WITH CHECK (bucket_id = 'categories' AND public.is_admin_or_operator());

DROP POLICY IF EXISTS "categories_delete_admin" ON storage.objects;
CREATE POLICY "categories_delete_admin" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'categories' AND public.is_admin());

-- ── Usuarios bucket ──
DROP POLICY IF EXISTS "usuarios_select_own" ON storage.objects;
CREATE POLICY "usuarios_select_own" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'usuarios' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));

DROP POLICY IF EXISTS "usuarios_insert_own" ON storage.objects;
CREATE POLICY "usuarios_insert_own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'usuarios' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "usuarios_update_own" ON storage.objects;
CREATE POLICY "usuarios_update_own" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'usuarios' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'usuarios' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "usuarios_delete_own" ON storage.objects;
CREATE POLICY "usuarios_delete_own" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'usuarios' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "usuarios_admin_all" ON storage.objects;
CREATE POLICY "usuarios_admin_all" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'usuarios' AND public.is_admin())
WITH CHECK (bucket_id = 'usuarios' AND public.is_admin());

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
-- PASO 10: RLS para orders (insert allow anon con validación)
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
-- PASO 11: RLS para products (remover INSERT de anon, solo admin escribe)
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
-- PASO 14: Verificación final
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '✅ REPARACIÓN COMPLETADA';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '🔑 Admin: kecho8a@gmail.com / admin123';
    RAISE NOTICE '📦 Buckets: settings, productos, banners, categories, usuarios';
    RAISE NOTICE '📡 Realtime: 8 tablas en publication supabase_realtime';
    RAISE NOTICE '🔒 RLS: policies recreadas para orders, products, notifications';
    RAISE NOTICE '👤 Auth: admin_users sincronizado con auth.users';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;
