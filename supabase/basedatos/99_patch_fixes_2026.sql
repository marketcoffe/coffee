-- ═══════════════════════════════════════════════════════════════════════════
-- PATCH: Correcciones del 2026-08-27
-- Ejecutar UNA VEZ en el SQL Editor de Supabase
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Fix: Formato de ID de pedido — PED-XXXX-VAL-YYYY → ORD-XXXX
--    Solo cambia la linea de generacion del ID dentro de la funcion
-- ─────────────────────────────────────────────────────────────────────────
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
    -- Validar que la mesa existe
    IF NOT public.is_mesa_valida(p_numero_mesa) THEN
        RAISE EXCEPTION 'La mesa % no es valida o esta inactiva.', p_numero_mesa;
    END IF;

    -- Generar ID corto: ORD-XXXXXX (6 digitos)
    v_order_id := 'ORD-' || lpad(floor(random() * 90000 + 10000)::text, 6, '0');
    v_ticket_code := public.generate_ticket_code(p_numero_mesa);

    -- Insertar el pedido
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

    -- Construir respuesta
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


-- ─────────────────────────────────────────────────────────────────────────
-- 2. Fix: cron.schedule() — dollar-quoting invalido en argumento texto
--    Solo aplica si pg_cron esta instalado
-- ─────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Eliminar tareas anteriores si existen
        BEGIN PERFORM cron.unschedule('cleanup-push-subscriptions'); EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN PERFORM cron.unschedule('check-abandoned-carts'); EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN PERFORM cron.unschedule('reset-weekly-push-limits'); EXCEPTION WHEN OTHERS THEN NULL; END;

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
        RAISE NOTICE 'pg_cron no disponible. Configurar cron externo.';
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- FIN PATCH 1 — IDs ORD-XXXX + cron.schedule
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- PATCH 2: Habilitar DELETE en tabla notifications + ocultar broadcasts
-- Ejecutar DESPUES del Patch 1
-- ═══════════════════════════════════════════════════════════════════════════

-- 2a. GRANT DELETE a anon y authenticated
GRANT DELETE ON notifications TO anon;
GRANT DELETE ON notifications TO authenticated;

-- 2b. RLS DELETE policy: cliente borra sus propias notificaciones
DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own" ON notifications
  FOR DELETE TO anon, authenticated
  USING (
    -- Admin/operator puede borrar cualquiera
    public.is_admin_or_operator()
    OR
    -- Cliente puede borrar las suyas (personal dirigida a su telefono)
    (
      tipo = 'personal'
      AND destinatario_telefono IN (
        SELECT telefono FROM usuarios_clientes
        WHERE id::text = auth.uid()::text
      )
    )
    OR
    -- Cliente puede borrar requests propias
    (
      tipo = 'request'
      AND destinatario_telefono IN (
        SELECT telefono FROM usuarios_clientes
        WHERE id::text = auth.uid()::text
      )
    )
  );

-- 2c. Borrar broadcasts 'todos' existentes que no deberian estar en el panel del cliente
-- (Opcional: limpiar notificaciones antiguas tipo 'todos' si se desea)
-- DELETE FROM notifications WHERE tipo = 'todos' AND created_at < NOW() - INTERVAL '7 days';


-- ═══════════════════════════════════════════════════════════════════════════
-- FIN PATCH 2 — Verificar con:
--   SELECT COUNT(*) FROM notifications WHERE tipo = 'todos';
--   (deberia seguir existiendo en la tabla, pero el frontend no las muestra)
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- PATCH 3: Marketing section — GRANTs faltantes
-- Ejecutar DESPUES del Patch 2
-- Resuelve: analytics vacios, segmentacion vacia, recompute falla
-- ═══════════════════════════════════════════════════════════════════════════

-- 3a. SELECT en push_events para authenticated (admin push analytics)
GRANT SELECT ON push_events TO authenticated;

-- 3b. SELECT en push_subscriptions para authenticated (admin metrics)
GRANT SELECT ON push_subscriptions TO authenticated;

-- 3c. SELECT en customer_segments para authenticated (segmentacion)
GRANT SELECT ON customer_segments TO authenticated;

-- 3d. EXECUTE en evaluate_all_segments (boton Recalcular)
GRANT EXECUTE ON FUNCTION public.evaluate_all_segments TO authenticated;

-- 3e. Asegurar send_broadcast_promotion accesible por authenticated
GRANT EXECUTE ON FUNCTION public.send_broadcast_promotion TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- PATCH 4: Frontend push trigger (sin pg_net)
-- Devuelve webhook URL + secret para que el admin dispare push desde JS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_push_config()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'webhook_url', COALESCE(sc.push_webhook_url, ''),
    'webhook_secret', COALESCE(sec.push_webhook_secret, '')
  )
  FROM public.store_config sc, public.app_secrets sec
  WHERE sc.id = 1 AND sec.id = 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_push_config TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- FIN PATCH 4
--   SELECT has_table_privilege('authenticated', 'push_events', 'SELECT');
--   SELECT has_table_privilege('authenticated', 'push_subscriptions', 'SELECT');
--   SELECT has_table_privilege('authenticated', 'customer_segments', 'SELECT');
--   SELECT has_function_privilege('authenticated', 'evaluate_all_segments()', 'EXECUTE');
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- PATCH 5: Permitir clientes borrar broadcasts (tipo='todos')
-- Ejecutar DESPUES del Patch 4
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own" ON notifications
  FOR DELETE TO anon, authenticated
  USING (
    public.is_admin_or_operator()
    OR
    tipo = 'todos'
    OR
    (
      tipo = 'personal'
      AND destinatario_telefono IN (
        SELECT telefono FROM usuarios_clientes
        WHERE id::text = auth.uid()::text
      )
    )
    OR
    (
      tipo = 'request'
      AND destinatario_telefono IN (
        SELECT telefono FROM usuarios_clientes
        WHERE id::text = auth.uid()::text
      )
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- FIN PATCH 5
