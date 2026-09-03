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
    -- 4. RPC: Crear pedido de mesa (versión actualizada con todos los parámetros del frontend)
    -- ============================================================================
    CREATE OR REPLACE FUNCTION public.crear_pedido_mesa(
        p_cliente_nombre TEXT,
        p_numero_mesa INTEGER,
        p_items JSONB,
        p_subtotal_usd NUMERIC,
        p_total_usd NUMERIC,
        p_total_bs NUMERIC,
        p_notas_admin TEXT DEFAULT '',
        p_sede_id TEXT DEFAULT '',
        p_usuario_id TEXT DEFAULT '',
        p_cliente_telefono TEXT DEFAULT '',
        p_cliente_email TEXT DEFAULT '',
        p_lat NUMERIC DEFAULT 0,
        p_lng NUMERIC DEFAULT 0,
        p_descuento_cupon_usd NUMERIC DEFAULT 0,
        p_cupon_codigo TEXT DEFAULT ''
    )
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
        v_order_id TEXT;
        v_ticket_code TEXT;
        v_new_order JSONB;
    BEGIN
        IF NOT public.is_mesa_valida(p_numero_mesa) THEN
            RAISE EXCEPTION 'La mesa % no es valida o esta inactiva.', p_numero_mesa;
        END IF;

        v_order_id := 'ORD-' || lpad(floor(random() * 90000 + 10000)::text, 6, '0');
        v_ticket_code := public.generate_ticket_code(p_numero_mesa);

        INSERT INTO public.orders (
            id, cliente_nombre, cliente_telefono, cliente_email,
            items, subtotal_usd, total_usd, total_bs,
            costo_envio_usd, descuento_cupon_usd, cupon_codigo,
            metodo_pago, tipo_pedido, tipo_entrega,
            numero_mesa, nombre_cliente,
            lat, lng, direccion_envio, distancia_km,
            status, notas_admin, sede_id,
            ticket_code, fecha, created_at
        ) VALUES (
            v_order_id, p_cliente_nombre, p_cliente_telefono, p_cliente_email,
            p_items, p_subtotal_usd, p_total_usd, p_total_bs,
            0, p_descuento_cupon_usd, NULLIF(p_cupon_codigo, ''),
            'Pendiente', 'mesa', 'mesa',
            p_numero_mesa, p_cliente_nombre,
            p_lat, p_lng, 'Mesa #' || p_numero_mesa::text, 0,
            'enviado_cocina', p_notas_admin, NULLIF(p_sede_id, ''),
            v_ticket_code, NOW(), NOW()
        );

        v_new_order := jsonb_build_object(
            'id', v_order_id,
            'ticket_code', v_ticket_code,
            'numero_mesa', p_numero_mesa,
            'cliente_nombre', p_cliente_nombre,
            'total_usd', p_total_usd,
            'total_bs', p_total_bs,
            'status', 'enviado_cocina',
            'fecha', NOW()::text
        );

        RETURN v_new_order;
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
    GRANT EXECUTE ON FUNCTION public.crear_pedido_mesa(
        TEXT, INTEGER, JSONB, NUMERIC, NUMERIC, NUMERIC,
        TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT
    ) TO anon;
    GRANT EXECUTE ON FUNCTION public.limpiar_pedidos_atascados TO anon;
    GRANT EXECUTE ON FUNCTION public.eliminar_pedidos_antiguos TO anon;
    GRANT EXECUTE ON FUNCTION public.cerrar_mesa TO anon;

-- ============================================================================
-- 9. RPC: Cerrar mesa a Esperando Pago (no directo a completado)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cerrar_mesa_cobrar(
    p_numero_mesa INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER := 0;
    v_order RECORD;
BEGIN
    IF NOT public.is_mesa_valida(p_numero_mesa) THEN
        RAISE EXCEPTION 'La mesa % no es valida.', p_numero_mesa;
    END IF;

    FOR v_order IN
        SELECT o.id FROM public.orders o
        WHERE o.numero_mesa = p_numero_mesa
          AND (o.tipo_pedido = 'mesa' OR o.tipo_entrega = 'mesa')
          AND public.normalize_order_status(o.status) NOT IN (
            'Entregado', 'Cancelado', 'completado', 'cancelado',
            'pendiente_pago', 'pago_enviado'
          )
    LOOP
        UPDATE public.orders
        SET status = 'pendiente_pago'
        WHERE id = v_order.id
          AND status NOT IN ('pendiente_pago', 'pago_enviado', 'completado', 'Entregado', 'Cancelado', 'cancelado');
        IF FOUND THEN v_count := v_count + 1; END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'closed_count', v_count,
        'mesa_number', p_numero_mesa
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cerrar_mesa_cobrar TO anon;

-- ============================================================================
-- FIN
