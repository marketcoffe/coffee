-- ============================================================================
-- MIGRACIÓN 31: Fix trigger notify_mesa_order_status_change
-- Fecha: 2026-08-27
-- PROBLEMA: El INSERT en el trigger no incluía "id" (PRIMARY KEY VARCHAR(50))
--           Error: "null value in column id violates not-null constraint"
-- IMPACTO: Todos los aceptar/rechazar pedidos de mesa fallaban con HTTP 400
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_mesa_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_titulo TEXT;
    v_mensaje TEXT;
    v_tipo TEXT := 'personal';
    v_target_phone TEXT;
    v_cliente_nombre TEXT;
    v_numero_mesa INTEGER;
BEGIN
    IF OLD.tipo_pedido != 'mesa' OR OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    v_cliente_nombre := COALESCE(NEW.nombre_cliente, NEW.cliente_nombre, 'Cliente');
    v_numero_mesa := NEW.numero_mesa;
    v_target_phone := NEW.cliente_telefono;

    CASE public.normalize_order_status(NEW.status)
        WHEN 'enviado_cocina' THEN
            v_titulo := 'Pedido Recibido en Cocina';
            v_mensaje := 'Tu pedido para Mesa #' || v_numero_mesa || ' ha sido enviado a cocina. Por favor selecciona tu método de pago.';
        WHEN 'En Preparacion' THEN
            v_titulo := 'Pedido en Preparación';
            v_mensaje := 'Tu pedido para Mesa #' || v_numero_mesa || ' está siendo preparado.';
        WHEN 'pago_enviado' THEN
            v_titulo := 'Reporte de Pago Recibido';
            v_mensaje := 'Hemos recibido tu reporte de pago para Mesa #' || v_numero_mesa || '. En proceso de validación.';
        WHEN 'completado' THEN
            v_titulo := '¡Pago Confirmado!';
            v_mensaje := 'Tu pago para Mesa #' || v_numero_mesa || ' ha sido confirmado. ¡Buen provecho!';
        WHEN 'Cancelado' THEN
            v_titulo := 'Pedido Cancelado';
            v_mensaje := 'Tu pedido para Mesa #' || v_numero_mesa || ' ha sido cancelado.';
        ELSE
            RETURN NEW;
    END CASE;

    INSERT INTO public.notifications (id, titulo, mensaje, tipo, destinatario_telefono, fecha, leida)
    VALUES (
        'mesa-' || NEW.id || '-' || LOWER(REPLACE(COALESCE(NEW.status, ''), ' ', '_')) || '-' || EXTRACT(EPOCH FROM NOW())::BIGINT,
        v_titulo,
        v_mensaje,
        v_tipo,
        v_target_phone,
        NOW()::TEXT,
        false
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_mesa_status ON public.orders;
CREATE TRIGGER trigger_notify_mesa_status
AFTER UPDATE ON public.orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND OLD.tipo_pedido = 'mesa')
EXECUTE FUNCTION public.notify_mesa_order_status_change();

-- ============================================================================
-- FIN MIGRACIÓN 31
-- ============================================================================
