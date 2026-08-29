-- ============================================================================
-- DIAGNÓSTICO Y FIX COMPLETO - Market Coffee Sweet
-- Ejecuta en: Supabase Dashboard → SQL Editor → Run
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════
-- PARTE 1: DIAGNÓSTICO
-- ═══════════════════════════════════════════════════════════════

-- 1a. Estado de usuarios en auth.users
SELECT '=== AUTH.USERS STATUS ===' as section;
SELECT 
  id, email, 
  email_confirmed_at IS NOT NULL as confirmed,
  raw_app_meta_data->>'role' as app_role,
  raw_user_meta_data->>'role' as user_role,
  created_at,
  last_sign_in_at
FROM auth.users 
WHERE email IN ('kecho8a@gmail.com', 'marketcoffe.ve@gmail.com')
ORDER BY email;

-- 1b. Estado en admin_users
SELECT '=== ADMIN_USERS STATUS ===' as section;
SELECT id, email, username, nombre, role, active, sede_id 
FROM admin_users 
WHERE email IN ('kecho8a@gmail.com', 'marketcoffe.ve@gmail.com')
ORDER BY email;

-- 1c. Verificar usuarios auth vs admin_users
SELECT '=== AUTH vs ADMIN_USERS ===' as section;
SELECT 
  u.id as auth_id,
  u.email,
  a.id as admin_id,
  a.role as admin_role,
  a.active,
  CASE WHEN a.id IS NULL THEN '❌ FALTA en admin_users' ELSE '✅ OK' END as status
FROM auth.users u
LEFT JOIN public.admin_users a ON a.id = u.id
WHERE u.email IN ('kecho8a@gmail.com', 'marketcoffe.ve@gmail.com')
ORDER BY u.email;

-- 1d. Publicación realtime - qué tablas están habilitadas
SELECT '=== REALTIME PUBLICATION ===' as section;
SELECT tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- 1e. Replica Identity de tablas importantes
SELECT '=== REPLICA IDENTITY ===' as section;
SELECT 
  c.relname as table_name,
  CASE c.relreplident
    WHEN 'd' THEN 'DEFAULT'
    WHEN 'n' THEN 'NOTHING'
    WHEN 'f' THEN 'FULL'
    WHEN 'i' THEN 'INDEX'
  END as replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
  AND c.relname IN ('orders', 'notifications', 'store_config', 'products', 'push_subscriptions', 'mesas', 'usuarios_clientes')
ORDER BY c.relname;

-- 1f. RLS policies en push_subscriptions
SELECT '=== PUSH_SUBSCRIPTIONS RLS ===' as section;
SELECT policyname, cmd, roles::text[]
FROM pg_policies 
WHERE tablename = 'push_subscriptions'
ORDER BY policyname;

-- 1g. Verificar si push_subscriptions tiene datos
SELECT '=== PUSH_SUBSCRIPTIONS DATA ===' as section;
SELECT COUNT(*) as total, 
  COUNT(*) FILTER (WHERE endpoint IS NOT NULL AND p256dh IS NOT NULL AND "auth" IS NOT NULL) as valid
FROM push_subscriptions;

-- 1h. Verificar GRANTS en tablas críticas
SELECT '=== TABLE GRANTS ===' as section;
SELECT 
  grantee, table_name, privilege_type
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND table_name IN ('orders', 'push_subscriptions', 'notifications')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- ═══════════════════════════════════════════════════════════════
-- PARTE 2: FIXES
-- ═══════════════════════════════════════════════════════════════

-- 2a. Asegurar REPLICA IDENTITY FULL en tablas críticas para CDC
ALTER TABLE IF EXISTS public.orders REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.notifications REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.store_config REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.products REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.mesas REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.usuarios_clientes REPLICA IDENTITY FULL;

SELECT '✅ REPLICA IDENTITY FULL aplicado' as fix;

-- 2b. Agregar tablas a publicación supabase_realtime (ignora si ya existe)
DO $$
BEGIN
  -- orders
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    RAISE NOTICE '✅ orders agregado a supabase_realtime';
  ELSE
    RAISE NOTICE 'ℹ️ orders ya está en supabase_realtime';
  END IF;

  -- notifications
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    RAISE NOTICE '✅ notifications agregado a supabase_realtime';
  ELSE
    RAISE NOTICE 'ℹ️ notifications ya está en supabase_realtime';
  END IF;

  -- store_config
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='store_config') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.store_config;
    RAISE NOTICE '✅ store_config agregado a supabase_realtime';
  ELSE
    RAISE NOTICE 'ℹ️ store_config ya está en supabase_realtime';
  END IF;

  -- products
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='products') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
    RAISE NOTICE '✅ products agregado a supabase_realtime';
  ELSE
    RAISE NOTICE 'ℹ️ products ya está en supabase_realtime';
  END IF;

  -- mesas
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='mesas') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mesas;
    RAISE NOTICE '✅ mesas agregado a supabase_realtime';
  ELSE
    RAISE NOTICE 'ℹ️ mesas ya está en supabase_realtime';
  END IF;
END $$;

-- 2c. RLS para push_subscriptions: permitir SELECT a anon (para Cloudflare Worker)
-- Primero eliminar política restrictiva si existe
DROP POLICY IF EXISTS "push_subscriptions_insert_anon" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_service_role_all" ON public.push_subscriptions;

-- Política: anon puede LEER todas las suscripciones (para push-notify Worker)
CREATE POLICY "push_subscriptions_anon_select" ON public.push_subscriptions
  FOR SELECT TO anon USING (true);

-- Política: anon puede INSERTAR suscripciones
CREATE POLICY "push_subscriptions_anon_insert" ON public.push_subscriptions
  FOR INSERT TO anon WITH CHECK (true);

-- Política: authenticated puede gestionar todas (admin/operator)
CREATE POLICY "push_subscriptions_auth_all" ON public.push_subscriptions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Política: service_role puede todo
CREATE POLICY "push_subscriptions_service_all" ON public.push_subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

SELECT '✅ RLS push_subscriptions: anon puede SELECT + INSERT' as fix;

-- 2d. Asegurar que push_subscriptions tenga las columnas necesarias
ALTER TABLE IF EXISTS public.push_subscriptions 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ DEFAULT NOW();

SELECT '✅ push_subscriptions columnas verificadas' as fix;

-- 2e. GRANT SELECT en push_subscriptions para anon
GRANT SELECT, INSERT ON public.push_subscriptions TO anon;
GRANT ALL ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

SELECT '✅ GRANTS push_subscriptions actualizados' as fix;

-- 2f. Asegurar RLS en orders para que anon pueda SELECT (necesario para degraded mode)
-- Verificar si ya existe política de SELECT para orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'orders' 
    AND cmd = 'SELECT' 
    AND 'anon'::text = ANY(roles::text[])
  ) THEN
    CREATE POLICY "orders_anon_select" ON public.orders
      FOR SELECT TO anon USING (true);
    RAISE NOTICE '✅ orders: anon SELECT policy created';
  ELSE
    RAISE NOTICE 'ℹ️ orders: anon SELECT policy already exists';
  END IF;
END $$;

-- 2g. Asegurar RLS en notifications para anon
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notifications' 
    AND cmd = 'SELECT' 
    AND 'anon'::text = ANY(roles::text[])
  ) THEN
    CREATE POLICY "notifications_anon_select" ON public.notifications
      FOR SELECT TO anon USING (true);
    RAISE NOTICE '✅ notifications: anon SELECT policy created';
  ELSE
    RAISE NOTICE 'ℹ️ notifications: anon SELECT policy already exists';
  END IF;
END $$;

-- 2h. Verificar/crear política UPDATE para orders (authenticated puede cambiar estado)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'orders' 
    AND cmd = 'UPDATE'
  ) THEN
    CREATE POLICY "orders_auth_update" ON public.orders
      FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    RAISE NOTICE '✅ orders: authenticated UPDATE policy created';
  ELSE
    RAISE NOTICE 'ℹ️ orders: UPDATE policy already exists';
  END IF;
END $$;

-- 2i. Verificar/crear política DELETE para orders (authenticated puede eliminar)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'orders' 
    AND cmd = 'DELETE'
  ) THEN
    CREATE POLICY "orders_auth_delete" ON public.orders
      FOR DELETE TO authenticated USING (true);
    RAISE NOTICE '✅ orders: authenticated DELETE policy created';
  ELSE
    RAISE NOTICE 'ℹ️ orders: DELETE policy already exists';
  END IF;
END $$;

-- 2j. Grants en orders para authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;

SELECT '✅ RLS + GRANTS orders actualizados' as fix;

-- ═══════════════════════════════════════════════════════════════
-- PARTE 2b: RESET DE CONTRASEÑA DEL OPERADOR
-- ═══════════════════════════════════════════════════════════════

-- Función para resetear contraseña de usuario auth
-- USO: SELECT reset_user_password('marketcoffe.ve@gmail.com', 'market.2026');
CREATE OR REPLACE FUNCTION public.reset_user_password(p_email TEXT, p_new_password TEXT)
RETURNS TEXT AS $$
DECLARE
  v_user_id UUID;
  v_new_encrypted TEXT;
BEGIN
  -- Buscar el usuario
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  
  IF v_user_id IS NULL THEN
    RETURN '❌ Usuario no encontrado: ' || p_email;
  END IF;
  
  -- Generar hash bcrypt de la nueva contraseña
  v_new_encrypted := crypt(p_new_password, gen_salt('bf'));
  
  -- Actualizar la contraseña en auth.users
  UPDATE auth.users 
  SET 
    encrypted_password = v_new_encrypted,
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"provider": "email", "providers": ["email"]}'::jsonb,
    updated_at = NOW()
  WHERE id = v_user_id;
  
  -- Asegurar que existe en admin_users
  INSERT INTO public.admin_users (id, email, nombre, role, active)
  VALUES (v_user_id, p_email, p_email, 'operator', true)
  ON CONFLICT (id) DO UPDATE SET active = true;
  
  RETURN '✅ Contraseña actualizada para ' || p_email || ' (id: ' || v_user_id || ')';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ejecutar el reset para el operador
SELECT public.reset_user_password('marketcoffe.ve@gmail.com', 'market.2026');

-- También resetear admin por si acaso
SELECT public.reset_user_password('kecho8a@gmail.com', 'Market.2026');

-- ═══════════════════════════════════════════════════════════════
-- PARTE 3: VERIFICACIÓN FINAL
-- ═══════════════════════════════════════════════════════════════

SELECT '=== VERIFICACIÓN FINAL ===' as section;

-- Realtime publication
SELECT 'Realtime tables:' as check, string_agg(tablename, ', ') as tables
FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- Replica Identity
SELECT 
  c.relname as table_name,
  CASE c.relreplident WHEN 'f' THEN '✅ FULL' ELSE '❌ ' || c.relreplident END as status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
  AND c.relname IN ('orders', 'notifications', 'store_config', 'products', 'mesas')
ORDER BY c.relname;

-- Push subscriptions RLS
SELECT policyname, cmd, roles::text[] as applies_to
FROM pg_policies 
WHERE tablename = 'push_subscriptions'
ORDER BY policyname;

-- Auth users state
SELECT 
  u.email,
  CASE WHEN a.id IS NOT NULL THEN '✅' ELSE '❌ NO EN admin_users' END as admin_users_status,
  a.role as admin_role,
  a.active
FROM auth.users u
LEFT JOIN public.admin_users a ON a.id = u.id
WHERE u.email IN ('kecho8a@gmail.com', 'marketcoffe.ve@gmail.com');

SELECT '=== DIAGNÓSTICO COMPLETO ===' as done;
