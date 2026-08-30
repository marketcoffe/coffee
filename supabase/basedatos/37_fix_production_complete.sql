-- ═══════════════════════════════════════════════════════════════════════════
-- 37_fix_production_complete.sql
-- PROPÓSITO: Corrección completa para producción
-- FECHA: 2026-08-29
-- INSTRUCCIONES: Ejecutar en el SQL Editor de Supabase
-- ═══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- 1. Asegurar función is_admin_or_operator() con search_path correcto
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin_or_operator()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT (public.is_admin() OR public.is_operator());
$$;

-- ============================================================================
-- 2. Fix: GRANTs faltantes para tablas de marketing/push (admin authenticated)
-- ============================================================================
GRANT SELECT ON push_events TO authenticated;
GRANT SELECT ON push_subscriptions TO authenticated;
GRANT SELECT ON customer_segments TO authenticated;

-- ============================================================================
-- 3. Fix: RLS policies para push_events (permitir SELECT a admin/operator)
-- ============================================================================
DROP POLICY IF EXISTS "push_events_admin_all" ON push_events;
CREATE POLICY "push_events_admin_all" ON push_events
  FOR ALL TO authenticated
  USING (public.is_admin_or_operator())
  WITH CHECK (public.is_admin_or_operator());

-- ============================================================================
-- 4. Fix: RLS policies para push_subscriptions (permitir SELECT a admin/operator)
-- ============================================================================
DROP POLICY IF EXISTS "push_subscriptions_admin_all" ON push_subscriptions;
CREATE POLICY "push_subscriptions_admin_all" ON push_subscriptions
  FOR ALL TO authenticated
  USING (public.is_admin_or_operator())
  WITH CHECK (public.is_admin_or_operator());

-- ============================================================================
-- 5. Fix: RLS policies para customer_segments (admin/operator acceso)
-- ============================================================================
DROP POLICY IF EXISTS "segments_admin_all" ON customer_segments;
CREATE POLICY "segments_admin_all" ON customer_segments
  FOR ALL TO authenticated
  USING (public.is_admin_or_operator())
  WITH CHECK (public.is_admin_or_operator());

-- ============================================================================
-- 6. Fix: RLS policies para notifications (corregir INSERT/SELECT/UPDATE/DELETE)
-- ============================================================================
DROP POLICY IF EXISTS "notifications_insert_guardada" ON notifications;
CREATE POLICY "notifications_insert_guardada" ON notifications
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_admin_or_operator()
        OR public.is_customer()
        OR tipo IN ('personal', 'request')
    );

DROP POLICY IF EXISTS "notifications_insert_anon_personal" ON notifications;
CREATE POLICY "notifications_insert_anon_personal" ON notifications
    FOR INSERT TO anon
    WITH CHECK (tipo IN ('personal', 'request'));

DROP POLICY IF EXISTS "notifications_select_auth" ON notifications;
CREATE POLICY "notifications_select_auth" ON notifications
    FOR SELECT TO authenticated USING (true);

-- Permitir a anon leer notificaciones (necesario para admin en modo degradado)
DROP POLICY IF EXISTS "notifications_select_anon" ON notifications;
CREATE POLICY "notifications_select_anon" ON notifications
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "notifications_update_auth" ON notifications;
CREATE POLICY "notifications_update_auth" ON notifications
    FOR UPDATE TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

DROP POLICY IF EXISTS "notifications_delete_auth" ON notifications;
CREATE POLICY "notifications_delete_auth" ON notifications
    FOR DELETE TO authenticated
    USING (public.is_admin_or_operator());

-- ============================================================================
-- 7. Verificación
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '=== PRODUCTION FIX APPLIED ===';
  RAISE NOTICE '1. is_admin_or_operator() recreada';
  RAISE NOTICE '2. GRANT SELECT otorgados a authenticated en push_events, push_subscriptions, customer_segments';
  RAISE NOTICE '3. RLS policies de admin recreadas para push_events, push_subscriptions, customer_segments';
  RAISE NOTICE '4. RLS policies de notifications corregidas para admin/operator';
  RAISE NOTICE '';
  RAISE NOTICE 'Si auth.users sigue corrupto, ejecutar 36b_fix_auth_users_soft.sql';
  RAISE NOTICE 'Si hay cookies __cf_bm, configurar Cloudflare Bot Fight Mode exclusion';
  RAISE NOTICE 'Si hay NS_ERROR_CORRUPTED_CONTENT, limpiar cache del navegador';
END $$;
