-- ============================================================================
-- MIGRACIÓN: Fix RLS permisos para orders
-- Fecha: 2026-08-26
-- Descripción: Grant UPDATE a anon + RLS policy para clientes/admin
-- ============================================================================

-- 1. Grant UPDATE a anon (necesario para que el frontend pueda actualizar)
GRANT UPDATE ON orders TO anon;

-- 2. Eliminar policy vieja de UPDATE que solo aplica a authenticated
DROP POLICY IF EXISTS "orders_update_v3" ON orders;

-- 3. Crear policy de UPDATE que permita:
--    a) Admin/operator autenticados (cualquier UPDATE)
--    b) Clientes autenticados (solo sus propios pedidos)
--    c) Anon (solo pedidos de mesa y pedidos con cliente_uid matching)
CREATE POLICY "orders_update_v4" ON orders
  FOR UPDATE
  USING (
    -- Admin/operator puede actualizar cualquier pedido
    public.is_admin_or_operator()
    -- Cliente autenticado puede actualizar sus propios pedidos
    OR (auth.uid()::text = cliente_uid)
    -- Anon puede actualizar pedidos de mesa (guest checkout)
    OR (tipo_pedido = 'mesa' AND cliente_uid IS NULL)
    OR (tipo_pedido = 'mesa' AND cliente_uid = '')
    -- Anon puede actualizar pedidos donde cliente_uid coincide con su session
    OR (cliente_uid = coalesce(auth.uid()::text, ''))
  )
  WITH CHECK (
    public.is_admin_or_operator()
    OR (auth.uid()::text = cliente_uid)
    OR (tipo_pedido = 'mesa')
    OR (cliente_uid = coalesce(auth.uid()::text, ''))
  );

-- 4. Asegurar que is_admin_or_operator funciona con el email fallback
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

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
