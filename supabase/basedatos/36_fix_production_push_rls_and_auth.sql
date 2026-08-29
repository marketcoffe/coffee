-- ═══════════════════════════════════════════════════════════════════════════
-- 36_fix_production_push_rls_and_auth.sql
-- PROPÓSITO: Corregir permisos RLS y auth para producción
-- FECHA: 2026-08-29
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
-- 5. Fix: Asegurar RLS policies para customer_segments (admin/operator acceso)
-- ============================================================================
DROP POLICY IF EXISTS "segments_admin_all" ON customer_segments;
CREATE POLICY "segments_admin_all" ON customer_segments
  FOR ALL TO authenticated
  USING (public.is_admin_or_operator())
  WITH CHECK (public.is_admin_or_operator());

-- ============================================================================
-- 6. Verificación rápida
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '=== FIX APLICADO ===';
  RAISE NOTICE '1. is_admin_or_operator() recreada';
  RAISE NOTICE '2. GRANT SELECT otorgados a authenticated en push_events, push_subscriptions, customer_segments';
  RAISE NOTICE '3. RLS policies de admin recreadas para push_events, push_subscriptions, customer_segments';
  RAISE NOTICE '4. Si auth.users sigue corrupto, ejecutar 34_fix_operator_auth_recreate.sql con cuidado';
END $$;
