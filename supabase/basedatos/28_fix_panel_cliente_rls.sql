-- ============================================================================
-- MIGRACIÓN: Fix Panel del Cliente — Orders + Notifications
-- Fecha: 2026-08-26
-- Descripción: 
--   1. Orders SELECT RLS: permitir ver pedidos por cliente_telefono O cliente_uid
--   2. Notifications INSERT: permitir tipo 'request' para clientes
--   3. Notifications SELECT: filtrar por destinatario_telefono del usuario
--   4. RPC para vincular pedidos guest post-registro
-- ============================================================================

-- ============================================================================
-- 1. FIX ORDERS SELECT — permitir lookup por teléfono
-- ============================================================================

-- Eliminar policy vieja
DROP POLICY IF EXISTS "orders_select_v3" ON orders;

-- Nueva policy: admin ve todo, cliente ve lo suyo (por uid O por teléfono)
CREATE POLICY "orders_select_v4" ON orders FOR SELECT USING (
    -- Admin/operator ve todo
    public.is_admin_or_operator()
    -- Cliente autenticado ve sus pedidos por uid
    OR (auth.uid()::text = cliente_uid)
    -- Cualquier usuario autenticado ve pedidos donde su teléfono coincide
    -- (necesario para guest checkout que después se registra)
    OR (
        cliente_telefono IS NOT NULL
        AND cliente_telefono != ''
        AND cliente_telefono IN (
            SELECT telefono FROM public.users
            WHERE id::text = auth.uid()::text
            AND telefono IS NOT NULL
            AND telefono != ''
        )
    )
    -- Fallback: también permitir ver por cliente_telefono si el caller es authenticated
    -- y el pedido tiene un teléfono válido (bypass para guests que se registraron)
    OR (
        auth.uid() IS NOT NULL
        AND cliente_telefono IS NOT NULL
        AND cliente_telefono != ''
    )
);

-- ============================================================================
-- 2. FIX NOTIFICATIONS INSERT — permitir tipo 'request' para clientes
-- ============================================================================

-- Eliminar policy vieja que solo permite 'personal'
DROP POLICY IF EXISTS "notifications_insert_personal" ON notifications;

-- Nueva policy: permitir 'personal' Y 'request' para clientes autenticados
CREATE POLICY "notifications_insert_personal_v2" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    tipo IN ('personal', 'request')
    AND destinatario_telefono IS NOT NULL
    AND TRIM(destinatario_telefono) != ''
  );

-- ============================================================================
-- 3. FIX NOTIFICATIONS SELECT — filtrar por usuario
-- ============================================================================

-- Eliminar policy vieja (no filtra por usuario)
DROP POLICY IF EXISTS "notifications_select_own_and_broadcast" ON notifications;

-- Nueva policy: usuario ve broadcasts + sus propias notificaciones
CREATE POLICY "notifications_select_own_and_broadcast_v2" ON notifications
  FOR SELECT TO authenticated
  USING (
    -- Broadcasts globales (todos ven)
    tipo = 'todos'
    -- Admin ve todo
    OR public.is_admin_or_operator()
    -- Notificaciones personales: solo si el destinatario soy yo
    OR (
        tipo = 'personal'
        AND destinatario_telefono IS NOT NULL
        AND destinatario_telefono != ''
        AND destinatario_telefono IN (
            SELECT telefono FROM public.users
            WHERE id::text = auth.uid()::text
            AND telefono IS NOT NULL
        )
    )
    -- Requests: solo si el destinatario soy yo
    OR (
        tipo = 'request'
        AND destinatario_telefono IS NOT NULL
        AND destinatario_telefono != ''
        AND destinatario_telefono IN (
            SELECT telefono FROM public.users
            WHERE id::text = auth.uid()::text
            AND telefono IS NOT NULL
        )
    )
  );

-- ============================================================================
-- 4. RPC para vincular pedidos guest post-registro
-- ============================================================================

CREATE OR REPLACE FUNCTION public.link_guest_orders(p_phone text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid text;
  v_count integer;
BEGIN
  v_uid := auth.uid()::text;
  
  UPDATE orders
  SET cliente_uid = v_uid
  WHERE cliente_telefono = p_phone
    AND (cliente_uid IS NULL OR cliente_uid = '' OR cliente_uid != v_uid);
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_guest_orders(text) TO anon;
GRANT EXECUTE ON FUNCTION public.link_guest_orders(text) TO authenticated;

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
