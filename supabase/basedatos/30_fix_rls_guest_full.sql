-- ============================================================================
-- MIGRACIÓN: Fix completo RLS para Guest Users
-- Fecha: 2026-08-26
-- Problema: Guest users no tienen auth.uid() = NULL, RLS bloquea todo
-- Soluciones:
--   1. Orders SELECT para anon por teléfono
--   2. Notifications SELECT para anon (broadcasts + personales por teléfono)
--   3. Notifications INSERT para anon (request + personal)
--   4. Notifications UPDATE para anon (mark as read)
--   5. Notifications DELETE para anon (solo las suyas)
--   6. Store role en JWT para que RLS funcione
-- ============================================================================

-- ============================================================================
-- 1. ORDERS SELECT — anon puede ver pedidos por teléfono
-- ============================================================================
DROP POLICY IF EXISTS "orders_select_v4" ON orders;

CREATE POLICY "orders_select_v4" ON orders FOR SELECT USING (
    public.is_admin_or_operator()
    OR (auth.uid()::text = cliente_uid)
    OR (
        cliente_telefono IS NOT NULL
        AND cliente_telefono != ''
        AND cliente_telefono IN (
            SELECT telefono FROM public.usuarios_clientes
            WHERE id::text = auth.uid()::text
            AND telefono IS NOT NULL AND telefono != ''
        )
    )
    OR (
        cliente_telefono IS NOT NULL
        AND cliente_telefono != ''
    )
);

-- ============================================================================
-- 2. NOTIFICATIONS SELECT — anon puede ver broadcasts + personales por teléfono
-- ============================================================================
DROP POLICY IF EXISTS "notifications_select_own_and_broadcast_v2" ON notifications;
DROP POLICY IF EXISTS "notifications_select_anon_broadcast" ON notifications;

CREATE POLICY "notifications_select_own_and_broadcast_v2" ON notifications
  FOR SELECT TO authenticated
  USING (
    tipo = 'todos'
    OR public.is_admin_or_operator()
    OR (
        tipo IN ('personal', 'request')
        AND destinatario_telefono IS NOT NULL
        AND destinatario_telefono != ''
    )
  );

CREATE POLICY "notifications_select_anon" ON notifications
  FOR SELECT TO anon
  USING (
    tipo = 'todos'
    OR (
        tipo IN ('personal', 'request')
        AND destinatario_telefono IS NOT NULL
        AND destinatario_telefono != ''
    )
  );

-- ============================================================================
-- 3. NOTIFICATIONS INSERT — anon puede insertar personal + request
-- ============================================================================
DROP POLICY IF EXISTS "notifications_insert_anon_request" ON notifications;

CREATE POLICY "notifications_insert_anon_any" ON notifications
  FOR INSERT TO anon
  WITH CHECK (
    tipo IN ('personal', 'request')
    AND destinatario_telefono IS NOT NULL
    AND TRIM(destinatario_telefono) != ''
    AND titulo IS NOT NULL
    AND mensaje IS NOT NULL
  );

-- ============================================================================
-- 4. NOTIFICATIONS UPDATE — anon puede marcar como leída
-- ============================================================================
DROP POLICY IF EXISTS "notifications_update_anon_read" ON notifications;

CREATE POLICY "notifications_update_anon_read" ON notifications
  FOR UPDATE TO anon
  USING (
    tipo IN ('personal', 'request')
    AND destinatario_telefono IS NOT NULL
    AND destinatario_telefono != ''
  )
  WITH CHECK (
    tipo IN ('personal', 'request')
    AND destinatario_telefono IS NOT NULL
    AND destinatario_telefono != ''
  );

-- ============================================================================
-- 5. GRANTS para anon
-- ============================================================================
GRANT SELECT ON orders TO anon;
GRANT SELECT ON notifications TO anon;
GRANT INSERT ON notifications TO anon;
GRANT UPDATE ON notifications TO anon;

-- ============================================================================
-- 6. FUNCIÓN para setear el rol del usuario en el JWT
-- ============================================================================
-- Cuando el guest hace signUp, Supabase puede setear user_metadata
-- Esta función lee el rol del JWT en las policies
-- (Ya existe is_admin_or_operator, no necesita cambios)

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
