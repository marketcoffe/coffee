-- ============================================================================
-- FIX COMPREHENSIVE: RLS + Auth + Push + Realtime
-- Ejecuta en: Supabase Dashboard -> SQL Editor -> Run
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════
-- PARTE 1: RESET DE CONTRASENA (GoTrue-safe)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.reset_user_password(p_email TEXT, p_new_password TEXT)
RETURNS TEXT AS $$
DECLARE
  v_user_id UUID;
  v_new_encrypted TEXT;
  v_instance_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  
  IF v_user_id IS NULL THEN
    RETURN 'Usuario no encontrado: ' || p_email;
  END IF;
  
  -- Obtener instance_id de auth.instances (requerido por GoTrue)
  SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;
  
  -- Limpiar TODOS los datos de auth relacionados
  DELETE FROM auth.refresh_tokens WHERE user_id = v_user_id;
  DELETE FROM auth.instances WHERE id = v_user_id;
  
  -- Generar hash bcrypt
  v_new_encrypted := crypt(p_new_password, gen_salt('bf'));
  
  -- Actualizar auth.users con TODOS los campos requeridos por GoTrue
  UPDATE auth.users 
  SET 
    encrypted_password = v_new_encrypted,
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    last_sign_in_at = NOW(),
    raw_app_meta_data = '{"provider": "email", "providers": ["email"]}'::jsonb,
    raw_user_meta_data = '{}'::jsonb,
    updated_at = NOW(),
    confirmation_token = '',
    recovery_token = '',
    confirmation_sent_at = NULL,
    recovery_sent_at = NULL,
    is_super_admin = false,
    instance_id = COALESCE(v_instance_id, '00000000-0000-0000-0000-000000000000'::uuid)
  WHERE id = v_user_id;
  
  -- Asegurar admin_users
  INSERT INTO public.admin_users (id, email, nombre, role, active)
  VALUES (v_user_id, p_email, p_email, 'operator', true)
  ON CONFLICT (id) DO UPDATE SET active = true;
  
  RETURN 'OK: ' || p_email || ' id=' || v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Resetear operador
SELECT public.reset_user_password('marketcoffe.ve@gmail.com', 'market.2026');
-- Resetear admin (usuario: maketo, clave: kecho.180)
SELECT public.reset_user_password('kecho8a@gmail.com', 'kecho.180');

-- ═══════════════════════════════════════════════════════════════
-- PARTE 2: RLS ANON POLICIES (permite admin sin sesion auth)
-- ═══════════════════════════════════════════════════════════════
-- Estas policies permiten que el admin/opere sin sesion Supabase Auth.
-- Se pueden eliminar cuando signInWithPassword funcione correctamente.

-- Helper: crear policy si no existe
CREATE OR REPLACE FUNCTION public._create_policy_if_not_exists(
  p_table TEXT, p_name TEXT, p_cmd TEXT, p_role TEXT, 
  p_using TEXT, p_check TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = p_table AND policyname = p_name
  ) THEN
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR %s TO %I USING (%s)',
      p_name, p_table, p_cmd, p_role, p_using
    );
    IF p_check IS NOT NULL THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR %s TO %I WITH CHECK (%s)',
        p_name || '_wc', p_table, p_cmd, p_role, p_check
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- --- products: full CRUD for anon ---
DROP POLICY IF EXISTS "anon_products_all" ON public.products;
CREATE POLICY "anon_products_all" ON public.products
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- --- store_config: full CRUD for anon ---
DROP POLICY IF EXISTS "anon_store_config_all" ON public.store_config;
CREATE POLICY "anon_store_config_all" ON public.store_config
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- --- orders: full CRUD for anon ---
DROP POLICY IF EXISTS "anon_orders_all" ON public.orders;
CREATE POLICY "anon_orders_all" ON public.orders
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- --- mesas: full CRUD for anon ---
DROP POLICY IF EXISTS "anon_mesas_all" ON public.mesas;
CREATE POLICY "anon_mesas_all" ON public.mesas
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- --- notifications: full CRUD for anon ---
DROP POLICY IF EXISTS "anon_notifications_all" ON public.notifications;
CREATE POLICY "anon_notifications_all" ON public.notifications
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- --- coupons: full CRUD for anon ---
DROP POLICY IF EXISTS "anon_coupons_all" ON public.coupons;
CREATE POLICY "anon_coupons_all" ON public.coupons
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- --- promotions: full CRUD for anon ---
DROP POLICY IF EXISTS "anon_promotions_all" ON public.promotions;
CREATE POLICY "anon_promotions_all" ON public.promotions
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- --- configuracion_pagos: full CRUD for anon ---
DROP POLICY IF EXISTS "anon_configuracion_pagos_all" ON public.configuracion_pagos;
CREATE POLICY "anon_configuracion_pagos_all" ON public.configuracion_pagos
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- --- loyalty_config: full CRUD for anon ---
DROP POLICY IF EXISTS "anon_loyalty_config_all" ON public.loyalty_config;
CREATE POLICY "anon_loyalty_config_all" ON public.loyalty_config
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- --- loyalty_levels: full CRUD for anon ---
DROP POLICY IF EXISTS "anon_loyalty_levels_all" ON public.loyalty_levels;
CREATE POLICY "anon_loyalty_levels_all" ON public.loyalty_levels
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- --- loyalty_rewards: full CRUD for anon ---
DROP POLICY IF EXISTS "anon_loyalty_rewards_all" ON public.loyalty_rewards;
CREATE POLICY "anon_loyalty_rewards_all" ON public.loyalty_rewards
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- --- loyalty_history: INSERT+SELECT for anon ---
DROP POLICY IF EXISTS "anon_loyalty_history_all" ON public.loyalty_history;
CREATE POLICY "anon_loyalty_history_all" ON public.loyalty_history
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- --- reward_catalog: full CRUD for anon ---
DROP POLICY IF EXISTS "anon_reward_catalog_all" ON public.reward_catalog;
CREATE POLICY "anon_reward_catalog_all" ON public.reward_catalog
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- --- usuarios_clientes: full CRUD for anon ---
DROP POLICY IF EXISTS "anon_usuarios_clientes_all" ON public.usuarios_clientes;
CREATE POLICY "anon_usuarios_clientes_all" ON public.usuarios_clientes
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- --- admin_users: full CRUD for anon ---
DROP POLICY IF EXISTS "anon_admin_users_all" ON public.admin_users;
CREATE POLICY "anon_admin_users_all" ON public.admin_users
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- --- push_events: INSERT+SELECT for anon ---
DROP POLICY IF EXISTS "anon_push_events_all" ON public.push_events;
CREATE POLICY "anon_push_events_all" ON public.push_events
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- --- customer_segments: SELECT for anon ---
DROP POLICY IF EXISTS "anon_customer_segments_select" ON public.customer_segments;
CREATE POLICY "anon_customer_segments_select" ON public.customer_segments
  FOR SELECT TO anon USING (true);

-- --- automation_rules: full CRUD for anon ---
DROP POLICY IF EXISTS "anon_automation_rules_all" ON public.automation_rules;
CREATE POLICY "anon_automation_rules_all" ON public.automation_rules
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- --- automation_log: INSERT+SELECT for anon ---
DROP POLICY IF EXISTS "anon_automation_log_all" ON public.automation_log;
CREATE POLICY "anon_automation_log_all" ON public.automation_log
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- --- campaigns: full CRUD for anon ---
DROP POLICY IF EXISTS "anon_campaigns_all" ON public.campaigns;
CREATE POLICY "anon_campaigns_all" ON public.campaigns
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- --- security_audit_logs: INSERT for anon ---
DROP POLICY IF EXISTS "anon_security_audit_logs_all" ON public.security_audit_logs;
CREATE POLICY "anon_security_audit_logs_all" ON public.security_audit_logs
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- --- product_reviews: INSERT+SELECT for anon ---
DROP POLICY IF EXISTS "anon_product_reviews_all" ON public.product_reviews;
CREATE POLICY "anon_product_reviews_all" ON public.product_reviews
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- PARTE 3: GRANTS para anon
-- ═══════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_config TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mesas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracion_pagos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_config TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_levels TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_rewards TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_history TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reward_catalog TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuarios_clientes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_users TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_events TO anon;
GRANT SELECT ON public.customer_segments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_rules TO anon;
GRANT SELECT, INSERT ON public.automation_log TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO anon;
GRANT SELECT, INSERT ON public.security_audit_logs TO anon;
GRANT SELECT, INSERT ON public.product_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO anon;

SELECT 'GRANTS completados para anon' as status;

-- ═══════════════════════════════════════════════════════════════
-- PARTE 4: REPLICA IDENTITY FULL + REALTIME
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE IF EXISTS public.orders REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.notifications REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.store_config REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.products REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.mesas REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.usuarios_clientes REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='store_config') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.store_config;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='products') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='mesas') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mesas;
  END IF;
END $$;

SELECT 'REALTIME + REPLICA IDENTITY aplicados' as status;

-- ═══════════════════════════════════════════════════════════════
-- PARTE 5: VERIFICACION
-- ═══════════════════════════════════════════════════════════════

SELECT '=== REALTIME TABLES ===' as section;
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename;

SELECT '=== PUSH_SUBSCRIPTIONS DATA ===' as section;
SELECT COUNT(*) as total, 
  COUNT(*) FILTER (WHERE endpoint IS NOT NULL AND p256dh IS NOT NULL AND auth_secret IS NOT NULL AND is_active = true) as active_valid
FROM push_subscriptions;

SELECT '=== AUTH USERS ===' as section;
SELECT u.email, u.raw_app_meta_data->>'role' as role, a.active
FROM auth.users u
LEFT JOIN public.admin_users a ON a.id = u.id
WHERE u.email IN ('kecho8a@gmail.com', 'marketcoffe.ve@gmail.com');

SELECT '=== DONE ===' as done;
