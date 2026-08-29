-- ═══════════════════════════════════════════════════════════════════════════
-- 36c_fix_notifications_rls.sql
-- PROPÓSITO: Corregir políticas RLS de notifications para admin/operator
-- FECHA: 2026-08-29
-- ═══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- 1. Recrear política INSERT para notifications
-- ============================================================================
DROP POLICY IF EXISTS "notifications_insert_guardada" ON notifications;
CREATE POLICY "notifications_insert_guardada" ON notifications
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_admin_or_operator()
        OR public.is_customer()
        OR tipo IN ('personal', 'request')
    );

-- Anon puede insertar notificaciones personales/request (sin auth)
DROP POLICY IF EXISTS "notifications_insert_anon_personal" ON notifications;
CREATE POLICY "notifications_insert_anon_personal" ON notifications
    FOR INSERT TO anon
    WITH CHECK (tipo IN ('personal', 'request'));

-- ============================================================================
-- 2. Asegurar SELECT para authenticated (admin ve todos)
-- ============================================================================
DROP POLICY IF EXISTS "notifications_select_auth" ON notifications;
CREATE POLICY "notifications_select_auth" ON notifications
    FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- 3. Asegurar UPDATE para authenticated (admin actualiza)
-- ============================================================================
DROP POLICY IF EXISTS "notifications_update_auth" ON notifications;
CREATE POLICY "notifications_update_auth" ON notifications
    FOR UPDATE TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

-- ============================================================================
-- 4. Asegurar DELETE para authenticated (admin borra)
-- ============================================================================
DROP POLICY IF EXISTS "notifications_delete_auth" ON notifications;
CREATE POLICY "notifications_delete_auth" ON notifications
    FOR DELETE TO authenticated
    USING (public.is_admin_or_operator());

-- ============================================================================
-- 5. Verificación
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '=== NOTIFICATIONS RLS FIXED ===';
  RAISE NOTICE '1. INSERT authenticated: admin/operator/customer + personal/request';
  RAISE NOTICE '2. INSERT anon: solo personal/request';
  RAISE NOTICE '3. SELECT authenticated: todos';
  RAISE NOTICE '4. UPDATE/DELETE authenticated: solo admin/operator';
END $$;
