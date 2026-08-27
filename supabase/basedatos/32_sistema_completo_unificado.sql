-- ============================================================
-- MÓDULO: SISTEMA COMPLETO UNIFICADO - REPARACIÓN Y MEJORAS
-- ARCHIVO: /supabase/basedatos/32_sistema_completo_unificado.sql
-- PROPÓSITO: RPCs transaccionales, deep linking en notificaciones,
--   automatizaciones con pg_cron, limpieza de código obsoleto
-- FECHA: 2026-08-26
-- DEPENDENCIAS: 01_core, 04_pedidos, 05_notificaciones, 24_mesas_v2
-- NOTA: Script idempotente — seguro de ejecutar múltiples veces
-- ============================================================

-- ============================================================================
-- PASO 1: LIMPIEZA — Eliminar funciones/duplicados obsoletos del módulo antiguo
-- ============================================================================

-- Eliminar variantes duplicadas de crear_pedido_mesa si existieran de versiones anteriores
DROP FUNCTION IF EXISTS public.crear_pedido_mesa_v1(
    TEXT, INTEGER, JSONB, NUMERIC, NUMERIC, NUMERIC,
    TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT
) CASCADE;

DROP FUNCTION IF EXISTS public.process_mesa_order(
    TEXT, INTEGER, JSONB, NUMERIC, NUMERIC, NUMERIC
) CASCADE;

-- Eliminar triggers obsoletos que pudieran quedar de versiones previas
DROP TRIGGER IF EXISTS trigger_mesa_notification_v1 ON public.orders;
DROP TRIGGER IF EXISTS trigger_mesa_push_v1 ON public.orders;

-- ============================================================================
-- PASO 2: RPC — Cierre transaccional de mesa (reemplaza UPDATE directo)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.close_mesa_orders(p_numero_mesa INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_closed_count INTEGER := 0;
    v_order RECORD;
BEGIN
    -- Validar que la mesa existe
    IF NOT public.is_mesa_valida(p_numero_mesa) THEN
        RAISE EXCEPTION 'La mesa % no existe o está inactiva.', p_numero_mesa;
    END IF;

    -- Cerrar todos los pedidos activos de esta mesa en una transacción atómica
    FOR v_order IN
        SELECT o.id, o.status
        FROM public.orders o
        WHERE o.numero_mesa = p_numero_mesa
          AND (o.tipo_pedido = 'mesa' OR o.tipo_entrega = 'mesa')
          AND public.normalize_order_status(o.status) NOT IN ('Entregado', 'Cancelado', 'completado', 'cancelado')
    LOOP
        UPDATE public.orders
        SET status = 'completado',
            notas_admin = COALESCE(notas_admin, '') || ' | Cerrado por cajero'
        WHERE id = v_order.id
          AND status NOT IN ('completado', 'Entregado', 'Cancelado', 'cancelado');

        IF FOUND THEN
            v_closed_count := v_closed_count + 1;
        END IF;
    END LOOP;

    -- Liberar la mesa (el trigger handle_mesa_order_status_change también lo hace,
    -- pero hacemos aquí por seguridad en caso de que el trigger tenga un WHEN condicional)
    UPDATE public.mesas
    SET estado = 'Disponible', updated_at = NOW()
    WHERE numero_mesa = p_numero_mesa
      AND estado != 'Disponible';

    RETURN jsonb_build_object(
        'success', true,
        'closed_count', v_closed_count,
        'mesa_number', p_numero_mesa
    );
END;
$$;

-- ============================================================================
-- PASO 3: RPC — Obtener cuentas bancarias activas (para el cliente)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_configuracion_pagos_activos()
RETURNS TABLE (
    id UUID,
    banco_nombre TEXT,
    titular_cuenta TEXT,
    numero_cuenta TEXT,
    cedula_rif TEXT,
    telefono TEXT,
    tipo_cuenta TEXT,
    es_principal BOOLEAN,
    notas TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT cp.id, cp.banco_nombre, cp.titular_cuenta, cp.numero_cuenta,
           cp.cedula_rif, cp.telefono, cp.tipo_cuenta, cp.es_principal, cp.notas
    FROM public.configuracion_pagos cp
    WHERE cp.activo = true
    ORDER BY cp.es_principal DESC, cp.banco_nombre ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_configuracion_pagos_activos TO anon;
GRANT EXECUTE ON FUNCTION public.get_configuracion_pagos_activos TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_mesa_orders TO authenticated;

-- ============================================================================
-- PASO 4: CORREGIR trigger notify_mesa_order_status_change
--   - Deep linking correcto: /pedido/:id para pedidos, / para otros
--   - Tipo 'personal' para que push llegue solo al cliente
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
    v_link_url TEXT;
BEGIN
    -- Solo procesar cambios de status en pedidos de mesa
    IF OLD.tipo_pedido IS DISTINCT FROM 'mesa' AND OLD.tipo_entrega IS DISTINCT FROM 'mesa' THEN
        RETURN NEW;
    END IF;

    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
        RETURN NEW;
    END IF;

    v_cliente_nombre := COALESCE(NEW.nombre_cliente, NEW.cliente_nombre, 'Cliente');
    v_numero_mesa := NEW.numero_mesa;
    v_target_phone := NEW.cliente_telefono;
    v_link_url := '/pedido/' || NEW.id;

    CASE public.normalize_order_status(NEW.status)
        WHEN 'enviado_cocina' THEN
            v_titulo := '¡Pedido Recibido! 🍳';
            v_mensaje := 'Tu pedido para Mesa #' || v_numero_mesa || ' fue enviado a cocina. ¡Pronto lo tendrás listo!';
        WHEN 'En Preparacion' THEN
            v_titulo := 'Pedido en Preparación 👨‍🍳';
            v_mensaje := 'Tu pedido para Mesa #' || v_numero_mesa || ' está siendo preparado con cariño.';
        WHEN 'pago_enviado' THEN
            v_titulo := 'Reporte de Pago Recibido 💳';
            v_mensaje := 'Recibimos tu reporte de pago para Mesa #' || v_numero_mesa || '. Estamos validándolo.';
        WHEN 'pago_en_verificacion' THEN
            v_titulo := 'Verificando Pago 🔍';
            v_mensaje := 'Tu pago para Mesa #' || v_numero_mesa || ' está en verificación.';
        WHEN 'completado' THEN
            v_titulo := '¡Pago Confirmado! ✅';
            v_mensaje := 'Tu pago para Mesa #' || v_numero_mesa || ' fue confirmado. ¡Buen provecho!';
            v_link_url := '/';
        WHEN 'Cancelado' THEN
            v_titulo := 'Pedido Cancelado ❌';
            v_mensaje := 'Tu pedido para Mesa #' || v_numero_mesa || ' ha sido cancelado.';
            v_link_url := '/';
        ELSE
            -- Para otros cambios de estado, notificar con deep link al pedido
            v_titulo := 'Estado Actualizado';
            v_mensaje := 'Tu pedido para Mesa #' || v_numero_mesa || ' tiene una actualización.';
    END CASE;

    -- Evitar duplicados: no insertar si ya existe una notificación para este evento
    IF NOT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE id = 'mesa-' || NEW.id || '-' || LOWER(REPLACE(COALESCE(NEW.status, ''), ' ', '_'))
    ) THEN
        INSERT INTO public.notifications (id, titulo, mensaje, fecha, tipo, destinatario_telefono, link_url, leida, created_at)
        VALUES (
            'mesa-' || NEW.id || '-' || LOWER(REPLACE(COALESCE(NEW.status, ''), ' ', '_')),
            v_titulo,
            v_mensaje,
            NOW()::TEXT,
            v_tipo,
            v_target_phone,
            v_link_url,
            false,
            NOW()
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Re-crear el trigger con la función actualizada
DROP TRIGGER IF EXISTS trigger_notify_mesa_status ON public.orders;
CREATE TRIGGER trigger_notify_mesa_status
AFTER UPDATE ON public.orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status
      AND (OLD.tipo_pedido = 'mesa' OR OLD.tipo_entrega = 'mesa'))
EXECUTE FUNCTION public.notify_mesa_order_status_change();

-- ============================================================================
-- PASO 5: CORREGIR trigger handle_new_order_actions
--   - Deep linking correcto para notificación admin de nuevo pedido
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_order_actions()
RETURNS TRIGGER
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    item_json jsonb;
    v_part_id uuid;
    v_cantidad int;
    v_current_stock int;
    v_notif_id text;
    v_admin_phone text;
    v_tipo_pedido TEXT;
BEGIN
    IF NEW.items IS NULL OR jsonb_array_length(NEW.items) = 0 THEN
        RAISE WARNING 'Pedido % tiene items vacíos', NEW.id;
        RETURN NEW;
    END IF;

    IF NEW.total_usd IS NULL OR NEW.total_usd <= 0 THEN
        RAISE WARNING 'Pedido % tiene total inválido: %', NEW.id, NEW.total_usd;
    END IF;

    v_tipo_pedido := COALESCE(NEW.tipo_pedido, NEW.tipo_entrega, 'delivery');

    -- Descontar stock por cada item
    FOR item_json IN SELECT jsonb_array_elements(NEW.items)
    LOOP
        BEGIN
            v_part_id := (COALESCE(item_json->>'food_id', item_json->>'part_id', item_json->>'id', item_json->>'producto_id'))::uuid;
            v_cantidad := (COALESCE(item_json->>'cantidad', item_json->>'quantity', item_json->>'qty', '1'))::int;

            IF v_part_id IS NOT NULL AND v_cantidad > 0 THEN
                SELECT stock INTO v_current_stock FROM public.products WHERE id = v_part_id;

                IF v_current_stock IS NOT NULL THEN
                    IF v_current_stock < v_cantidad THEN
                        RAISE WARNING 'Stock insuficiente para producto %: disponible %, solicitado %', v_part_id, v_current_stock, v_cantidad;
                    END IF;

                    UPDATE public.products
                    SET stock = GREATEST(0, stock - v_cantidad),
                        order_count = COALESCE(order_count, 0) + v_cantidad
                    WHERE id = v_part_id;
                END IF;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error actualizando stock para item %: %', v_part_id, SQLERRM;
        END;
    END LOOP;

    -- Actualizar uso de cupón
    IF NEW.cupon_codigo IS NOT NULL AND NEW.cupon_codigo != '' THEN
        UPDATE public.coupons
        SET usage_count = usage_count + 1
        WHERE code = NEW.cupon_codigo AND (usage_limit IS NULL OR usage_count < usage_limit);
    END IF;

    -- Crear notificación admin con deep linking al pedido
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications') THEN
        v_notif_id := 'notif-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12);
        SELECT telefono_soporte INTO v_admin_phone FROM public.store_config WHERE id = 1;

        -- Deep link: /pedido/:id abre el detalle del pedido en el panel admin
        INSERT INTO public.notifications (id, titulo, mensaje, fecha, tipo, destinatario_telefono, link_url, leida)
        VALUES (
            v_notif_id,
            CASE
                WHEN v_tipo_pedido = 'mesa' THEN '🍽️ Nuevo Pedido Mesa #' || COALESCE(NEW.numero_mesa::TEXT, '?')
                WHEN v_tipo_pedido = 'pickup' THEN '📦 Nuevo Pedido Pickup'
                ELSE '🛵 Nuevo Pedido Delivery'
            END,
            COALESCE(NEW.cliente_nombre, 'Cliente') || ' — $' || COALESCE(NEW.total_usd::TEXT, '0') ||
            CASE WHEN v_tipo_pedido = 'mesa' THEN ' (Mesa #' || COALESCE(NEW.numero_mesa::TEXT, '?') || ')' ELSE '' END,
            to_char(NOW(), 'DD/MM/YYYY HH24:MI'),
            'admin',
            COALESCE(v_admin_phone, ''),
            '/pedido/' || NEW.id,
            FALSE
        );
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Fallo en trigger handle_new_order_actions: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- ============================================================================
-- PASO 6: VISTA para comandera kanban de mesas
-- ============================================================================

CREATE OR REPLACE VIEW public.v_mesa_orders_kanban AS
SELECT
    o.id,
    o.numero_mesa,
    o.cliente_nombre,
    o.nombre_cliente,
    o.items,
    o.total_usd,
    o.total_bs,
    o.status,
    o.metodo_pago,
    o.referencia_pago,
    o.banco_origen,
    o.notas_admin,
    o.ticket_code,
    o.fecha,
    o.created_at,
    CASE
        WHEN o.status IN ('pago_enviado', 'pendiente_pago') THEN 'esperando_pago'::TEXT
        WHEN public.normalize_order_status(o.status) IN ('completado', 'Entregado') THEN 'pagado'::TEXT
        WHEN o.status = 'En Preparacion' OR o.status = 'en_preparacion' THEN 'en_preparacion'::TEXT
        ELSE 'en_cocina'::TEXT
    END AS kanban_column,
    EXTRACT(EPOCH FROM (NOW() - o.created_at))::INTEGER AS elapsed_seconds
FROM public.orders o
WHERE (o.tipo_pedido = 'mesa' OR o.tipo_entrega = 'mesa')
  AND public.normalize_order_status(o.status) NOT IN ('Entregado', 'Cancelado', 'completado', 'cancelado');

-- ============================================================================
-- PASO 7: pg_cron — Automatizaciones periódicas (si extension disponible)
-- ============================================================================

-- Intentar crear extensión pg_cron (no falla si ya existe)
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron no disponible: % — Las automatizaciones periódicas requieren configuración externa', SQLERRM;
END $$;

-- Si pg_cron está disponible, programar tareas
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Limpiar suscripciones push expiradas: diariamente a las 3:00 AM
        PERFORM cron.schedule(
            'cleanup-push-subscriptions',
            '0 3 * * *',
            'SELECT public.cleanup_expired_subscriptions()'
        );

        -- Detectar carritos abandonados: cada 30 minutos
        PERFORM cron.schedule(
            'check-abandoned-carts',
            '*/30 * * * *',
            'SELECT public.notify_abandoned_carts()'
        );

        -- Reset semanal de rate limits: lunes a las 4:00 AM
        PERFORM cron.schedule(
            'reset-weekly-push-limits',
            '0 4 * * 1',
            'SELECT public.reset_weekly_rate_limits()'
        );

        RAISE NOTICE 'pg_cron: 3 automatizaciones programadas correctamente';
    ELSE
        RAISE NOTICE 'pg_cron no disponible. Configurar cron externo para: cleanup_expired_subscriptions(), notify_abandoned_carts(), reset_weekly_rate_limits()';
    END IF;
END $$;

-- ============================================================================
-- PASO 8: Asegurar REPLICA IDENTITY FULL en tablas críticas de Realtime
-- ============================================================================

DO $$ BEGIN
    ALTER TABLE public.mesas REPLICA IDENTITY FULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.configuracion_pagos REPLICA IDENTITY FULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.orders REPLICA IDENTITY FULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.notifications REPLICA IDENTITY FULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Asegurar que todas las tablas críticas están en la publicación de Realtime
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mesas;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.configuracion_pagos;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- PASO 9: Función para obtener notificación con deep link por tipo
--   Utilidad para el frontend: dado un link_url, determinar a qué vista navegar
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_notification_deep_link(p_link_url TEXT)
RETURNS JSONB
LANGUAGE sql IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_link_url LIKE '/pedido/%' THEN
            jsonb_build_object('route', 'order_detail', 'order_id', REPLACE(p_link_url, '/pedido/', ''))
        WHEN p_link_url = '/catalog' THEN
            jsonb_build_object('route', 'catalog')
        WHEN p_link_url LIKE '/oferta%' THEN
            jsonb_build_object('route', 'catalog', 'filter', 'ofertas')
        WHEN p_link_url = '/carrito' OR p_link_url = '/cart' THEN
            jsonb_build_object('route', 'cart')
        WHEN p_link_url = '/perfil' OR p_link_url = '/profile' THEN
            jsonb_build_object('route', 'profile')
        WHEN p_link_url = '/puntos' THEN
            jsonb_build_object('route', 'profile', 'tab', 'rewards')
        WHEN p_link_url = '/cupones' THEN
            jsonb_build_object('route', 'profile', 'tab', 'coupons')
        WHEN p_link_url = '/mesa' THEN
            jsonb_build_object('route', 'mesa_checkout')
        WHEN p_link_url LIKE '/admin%' THEN
            jsonb_build_object('route', 'admin')
        ELSE
            jsonb_build_object('route', 'home')
    END;
$$;

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
