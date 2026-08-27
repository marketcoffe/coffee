-- ============================================================================
-- MIGRACIÓN 25: Fix RPCs de mesa + Funciones de limpieza
-- Fecha: 2026-08-26
-- Descripción: Crear/reemplazar funciones RPC faltantes + funciones de limpieza
-- ============================================================================

-- ============================================================================
-- 1. RPC: Aceptar pedido de mesa
-- ============================================================================
CREATE OR REPLACE FUNCTION public.aceptar_pedido_mesa(
    p_order_id TEXT,
    p_tiempo_estimado TEXT DEFAULT '15 min'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.orders
    SET
        status = 'En preparacion',
        tiempo_estimado_entrega = p_tiempo_estimado
    WHERE id = p_order_id
      AND tipo_pedido = 'mesa'
      AND status = 'enviado_cocina';

    RETURN FOUND;
END;
$$;

-- ============================================================================
-- 2. RPC: Rechazar pedido de mesa
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rechazar_pedido_mesa(
    p_order_id TEXT,
    p_motivo TEXT DEFAULT 'Pedido rechazado por el personal'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.orders
    SET
        status = 'Cancelado',
        notas_admin = COALESCE(notas_admin, '') || ' | Rechazo: ' || p_motivo
    WHERE id = p_order_id
      AND tipo_pedido = 'mesa';

    RETURN FOUND;
END;
$$;

-- ============================================================================
-- 3. RPC: Aprobar/rechazar pago móvil desde el admin
-- ============================================================================
CREATE OR REPLACE FUNCTION public.aprobar_pago_mesa(
    p_order_id TEXT,
    p_aprobar BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_aprobar THEN
        UPDATE public.orders
        SET status = 'completado'
        WHERE id = p_order_id
          AND tipo_pedido = 'mesa'
          AND status = 'pago_enviado';
    ELSE
        UPDATE public.orders
        SET status = 'pendiente_pago'
        WHERE id = p_order_id
          AND tipo_pedido = 'mesa'
          AND status = 'pago_enviado';
    END IF;

    RETURN FOUND;
END;
$$;

-- ============================================================================
-- 4. RPC: Crear pedido de mesa (si no existe)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.crear_pedido_mesa(
    p_cliente_nombre TEXT,
    p_cliente_telefono TEXT DEFAULT '',
    p_cliente_email TEXT DEFAULT '',
    p_numero_mesa INTEGER DEFAULT 0,
    p_items JSONB DEFAULT '[]'::jsonb,
    p_subtotal_usd NUMERIC DEFAULT 0,
    p_total_usd NUMERIC DEFAULT 0,
    p_total_bs NUMERIC DEFAULT 0,
    p_metodo_pago TEXT DEFAULT 'Pago Móvil',
    p_notas_admin TEXT DEFAULT ''
)
RETURNS TABLE (
    id TEXT,
    ticket_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id TEXT;
    v_ticket TEXT;
BEGIN
    v_order_id := 'PED-' || LPAD(FLOOR(RANDOM() * 9999)::TEXT, 4, '0') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 3)) || '-' || EXTRACT(YEAR FROM NOW())::TEXT;
    v_ticket := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));

    INSERT INTO public.orders (
        id, cliente_nombre, cliente_telefono, cliente_email,
        numero_mesa, items, subtotal_usd, total_usd, total_bs,
        metodo_pago, tipo_pedido, tipo_entrega, status,
        notas_admin, fecha, ticket_code
    ) VALUES (
        v_order_id, p_cliente_nombre, p_cliente_telefono, p_cliente_email,
        p_numero_mesa, p_items, p_subtotal_usd, p_total_usd, p_total_bs,
        p_metodo_pago, 'mesa', 'mesa', 'enviado_cocina',
        p_notas_admin, NOW(), v_ticket
    );

    RETURN QUERY SELECT v_order_id, v_ticket;
END;
$$;

-- ============================================================================
-- 5. RPC: Limpiar pedidos atascados (cancelar los que llevan mucho en cocina)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.limpiar_pedidos_atascados(
    p_horas_limite INTEGER DEFAULT 4
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.orders
    SET
        status = 'Cancelado',
        notas_admin = COALESCE(notas_admin, '') || ' | Auto-cancelado: Atascado más de ' || p_horas_limite || 'h en cocina'
    WHERE status = 'enviado_cocina'
      AND tipo_pedido = 'mesa'
      AND fecha < NOW() - (p_horas_limite || ' hours')::INTERVAL;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ============================================================================
-- 6. RPC: Eliminar pedidos antiguos (cleanup completo)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.eliminar_pedidos_antiguos(
    p_dias INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM public.orders
    WHERE status IN ('Cancelado', 'cancelado', 'completado', 'Entregado')
      AND fecha < NOW() - (p_dias || ' days')::INTERVAL;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ============================================================================
-- 7. RPC: Cerrar mesa (completar todos los pedidos activos de una mesa)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cerrar_mesa(
    p_numero_mesa INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.orders
    SET status = 'completado'
    WHERE tipo_pedido = 'mesa'
      AND numero_mesa = p_numero_mesa
      AND status NOT IN ('Cancelado', 'cancelado', 'completado', 'Entregado');

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ============================================================================
-- 8. Otorgar permisos EXECUTE a anon para las nuevas funciones
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.aceptar_pedido_mesa TO anon;
GRANT EXECUTE ON FUNCTION public.rechazar_pedido_mesa TO anon;
GRANT EXECUTE ON FUNCTION public.aprobar_pago_mesa TO anon;
GRANT EXECUTE ON FUNCTION public.crear_pedido_mesa TO anon;
GRANT EXECUTE ON FUNCTION public.limpiar_pedidos_atascados TO anon;
GRANT EXECUTE ON FUNCTION public.eliminar_pedidos_antiguos TO anon;
GRANT EXECUTE ON FUNCTION public.cerrar_mesa TO anon;

-- ============================================================================
-- FIN
-- ============================================================================
