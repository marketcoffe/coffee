-- ============================================================================
-- MIGRACIÓN: RPC para que clientes actualicen pedidos (bypass RLS)
-- Fecha: 2026-08-26
-- Descripción: Permite que el rol anon actualice campos específicos de un pedido
--              usando SECURITY DEFINER para evitar problemas de RLS
-- ============================================================================

-- Función: actualizar_pedido_cliente
-- Permite al cliente actualizar datos de pago o estado de su pedido
CREATE OR REPLACE FUNCTION public.actualizar_pedido_cliente(
  p_order_id text,
  p_updates jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_owner text;
  v_allowed_fields text[] := ARRAY['metodo_pago', 'referencia_pago', 'banco_origen', 'status', 'notas'];
  v_field text;
  v_set_clause text := '';
BEGIN
  -- Verificar que el pedido existe y pertenece al cliente (o es anon)
  SELECT cliente_uid INTO v_order_owner
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado: %', p_order_id;
  END IF;

  -- Permitir si es pedido de mesa (cualquiera puede actualizar) o si el cliente es el dueño
  -- Para pedidos de mesa, el cliente_uid puede ser null o un guest uid
  -- Solo restringimos si el pedido tiene un cliente_uid distinto al actual y no es mesa
  IF v_order_owner IS NOT NULL
     AND v_order_owner != ''
     AND v_order_owner != coalesce(auth.uid()::text, '')
  THEN
    -- Verificar si es admin u operador
    IF NOT public.is_admin_or_operator() THEN
      RAISE EXCEPTION 'No tienes permiso para modificar este pedido';
    END IF;
  END IF;

  -- Construir SET clause dinámicamente solo con campos permitidos
  FOR v_field IN SELECT jsonb_object_keys(p_updates)
  LOOP
    IF v_field = ANY(v_allowed_fields) THEN
      IF v_set_clause != '' THEN
        v_set_clause := v_set_clause || ', ';
      END IF;
      v_set_clause := v_set_clause || format('%I = %L', v_field, p_updates ->> v_field);
    END IF;
  END LOOP;

  IF v_set_clause = '' THEN
    RAISE EXCEPTION 'No hay campos válidos para actualizar';
  END IF;

  -- Ejecutar UPDATE dinámico
  EXECUTE format('UPDATE orders SET %s WHERE id = %L', v_set_clause, p_order_id);

  RETURN true;
END;
$$;

-- Permisos: el rol anon puede ejecutar esta función
GRANT EXECUTE ON FUNCTION public.actualizar_pedido_cliente(text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.actualizar_pedido_cliente(text, jsonb) TO authenticated;

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
