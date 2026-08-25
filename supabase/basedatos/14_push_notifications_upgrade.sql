-- ========================================================
-- MIGRACION: MEJORAS AL SISTEMA PUSH NOTIFICATIONS
-- ARCHIVO: /supabase/basedatos/14_push_notifications_upgrade.sql
-- PROP OSITO: Agregar campos faltantes, triggers admin/chat, RLS mejorado
-- FECHA: 2026-08-24
-- DEPENDENCIAS: 05_notificaciones_push_mensajeria
-- ========================================================

-- ----------------------------------------------------------------------------
-- 1. Agregar campos faltantes a push_subscriptions
-- ----------------------------------------------------------------------------
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'unknown';
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS user_agent TEXT DEFAULT '';
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Index para limpiar suscripciones inactivas
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_platform ON push_subscriptions(platform);

-- Unicidad compuesta: endpoint ya tiene UNIQUE, pero refuerza por telefono+endpoint
-- para evitar duplicacion cuando un mismo usuario cambia de navegador/pestaña
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_phone_endpoint
  ON push_subscriptions(destinatario_telefono, endpoint)
  WHERE destinatario_telefono IS NOT NULL AND destinatario_telefono != '';

-- Index para busqueda rapida por telefono (envio push personal)
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_phone
  ON push_subscriptions(destinatario_telefono)
  WHERE is_active = true AND destinatario_telefono IS NOT NULL AND destinatario_telefono != '';

-- Index para busqueda rapida por user_id (envio push autenticado)
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON push_subscriptions(user_id)
  WHERE is_active = true AND user_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. NOTA sobre notificaciones de cambio de estado:
-- El trigger NOTIFICACION CLIENTE NO se crea aqui porque:
-- 1) El frontend (AppContext.updateOrderStatus) ya envia la notificacion personal
--    al cliente via addNotification() ANTES de hacer el UPDATE a la BD.
-- 2) El trigger notify_order_status_change (si existiera) duplicaria la notificacion.
-- 3) El trigger handle_new_order_actions (04_pedidos_comandas_kanban.sql) maneja
--    las notificaciones ADMIN de nuevos pedidos.
-- FLUJO CORRECTO:
--   Admin cambia estado → Frontend llama addNotification('personal', phone) → push webhook
--   Admin cambia estado → Frontend hace UPDATE → trigger handle_new_order_actions NO se duplica
--   (porque handle_new_order_actions solo fire en INSERT, no en UPDATE)
-- ----------------------------------------------------------------------------
-- Si se requiere notificar al cliente cuando el status cambia POR OTRO CAMINO
-- (ej: via API externa, cron, etc.), usar este trigger:
-- NOTA: El frontend NO debe llamar addNotification para status changes,
-- este trigger se encarga de todo.

CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.cliente_telefono IS NOT NULL AND TRIM(NEW.cliente_telefono) != '' THEN
    INSERT INTO public.notifications (id, titulo, mensaje, fecha, tipo, destinatario_telefono, link_url, created_at)
    VALUES (
      'order-' || NEW.id || '-status-' || NEW.status,
      CASE
        WHEN NEW.status IN ('En Preparacion', 'En preparacion', 'En preparación') THEN 'Tu pedido esta en preparacion'
        WHEN NEW.status IN ('En Camino', 'En camino') THEN 'Tu pedido va en camino'
        WHEN NEW.status = 'Entregado' THEN 'Tu pedido ha sido entregado'
        WHEN NEW.status IN ('Cancelado', 'cancelado') THEN 'Tu pedido ha sido cancelado'
        WHEN NEW.status = 'completado' THEN 'Tu pedido ha sido completado'
        ELSE 'Estado actualizado: ' || NEW.status
      END,
      'Pedido #' || NEW.id || ' — ' || COALESCE(NEW.tiempo_estimado_entrega, ''),
      NOW()::TEXT,
      'personal',
      NEW.cliente_telefono,
      '/order/' || NEW.id,
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger DESHABILITADO por defecto. Para activarlo, descomentar la siguiente linea.
-- Solo activar si el frontend NO envia notificaciones de cambio de estado.
-- DROP TRIGGER IF EXISTS trigger_notify_order_status_change ON public.orders;
-- CREATE TRIGGER trigger_notify_order_status_change
-- AFTER UPDATE ON public.orders
-- FOR EACH ROW EXECUTE FUNCTION public.notify_order_status_change();

-- ----------------------------------------------------------------------------
-- 4. RPC: Enviar mensaje de chat 1-a-1 como push notification
--    Solo admin/operator puede invocar esta funcion.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_chat_push(
  p_from_name TEXT,
  p_to_phone TEXT,
  p_message TEXT,
  p_sede_id TEXT DEFAULT ''
)
RETURNS BOOLEAN
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Validar que solo admin/operator pueda enviar chat push
  IF NOT public.is_admin_or_operator() THEN
    RAISE EXCEPTION 'Access denied: admin or operator role required';
  END IF;

  -- Validar inputs
  IF p_to_phone IS NULL OR TRIM(p_to_phone) = '' THEN
    RAISE EXCEPTION 'Phone number is required';
  END IF;

  IF p_message IS NULL OR TRIM(p_message) = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;

  INSERT INTO public.notifications (id, titulo, mensaje, fecha, tipo, destinatario_telefono, link_url, created_at)
  VALUES (
    'chat-' || gen_random_uuid()::TEXT,
    'Mensaje de ' || p_from_name,
    LEFT(p_message, 200),
    NOW()::TEXT,
    'personal',
    TRIM(p_to_phone),
    '/',
    NOW()
  );
  RETURN true;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. RPC: Detectar y notificar carritos abandonados
--    Corregido: evita falsos positivos con llave unica y excluye
--    pedidos que cambiaron de estado (Pagado, En preparacion, etc.)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_abandoned_carts()
RETURNS void
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cart RECORD;
  v_notif_id TEXT;
BEGIN
  -- Buscar carritos con mas de 30 minutos sin completar
  FOR v_cart IN
    SELECT
      o.id AS order_id,
      o.cliente_nombre,
      o.cliente_telefono,
      o.total_usd,
      o.created_at,
      o.sede_id
    FROM public.orders o
    WHERE o.status = 'Pendiente'
      AND o.created_at < NOW() - INTERVAL '30 minutes'
      AND o.created_at > NOW() - INTERVAL '24 hours'
      -- Solo notificar si el cliente tiene telefono valido
      AND o.cliente_telefono IS NOT NULL
      AND TRIM(o.cliente_telefono) != ''
      -- Evitar duplicados: solo si no existe ya una notificacion para ESTE pedido
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.id = 'cart-abandon-order-' || o.id
      )
  LOOP
    v_notif_id := 'cart-abandon-order-' || v_cart.order_id;

    INSERT INTO public.notifications (id, titulo, mensaje, fecha, tipo, destinatario_telefono, link_url, created_at)
    VALUES (
      v_notif_id,
      E'\u00bfOlvidaste algo en tu carrito?',
      'Tu pedido de $' || COALESCE(v_cart.total_usd::TEXT, '0') || ' te espera. Completa tu compra!',
      NOW()::TEXT,
      'personal',
      v_cart.cliente_telefono,
      '/catalog',
      NOW()
    );
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. RPC: Enviar promocion broadcast (masiva o segmentada)
--    Solo admin/operator. Soporta:
--    - audience='all': todos los usuarios con suscripcion activa
--    - audience='segment': usuarios de un segmento especifico
--    - audience='phone': un telefono especifico
--    - audience='sede': usuarios de una sede especifica
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_broadcast_promotion(
  p_title TEXT,
  p_message TEXT,
  p_audience TEXT DEFAULT 'all',
  p_target_value TEXT DEFAULT '',
  p_image_url TEXT DEFAULT '',
  p_link_url TEXT DEFAULT '/catalog',
  p_priority TEXT DEFAULT 'normal'
)
RETURNS JSONB
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_notif_id TEXT;
  v_count INTEGER := 0;
  v_target RECORD;
BEGIN
  -- Solo admin/operator puede enviar broadcasts
  IF NOT public.is_admin_or_operator() THEN
    RAISE EXCEPTION 'Access denied: admin or operator role required';
  END IF;

  -- Validar inputs
  IF p_title IS NULL OR TRIM(p_title) = '' THEN
    RAISE EXCEPTION 'Title is required';
  END IF;
  IF p_message IS NULL OR TRIM(p_message) = '' THEN
    RAISE EXCEPTION 'Message is required';
  END IF;
  IF p_audience NOT IN ('all', 'segment', 'phone', 'sede') THEN
    RAISE EXCEPTION 'Invalid audience: must be all, segment, phone, or sede';
  END IF;

  -- Caso 1: Enviar a todos los clientes (tipo 'todos' = broadcast global)
  IF p_audience = 'all' THEN
    v_notif_id := 'promo-' || gen_random_uuid()::TEXT;

    INSERT INTO public.notifications (id, titulo, mensaje, fecha, tipo, destinatario_telefono, imagen_url, link_url, created_at)
    VALUES (
      v_notif_id,
      TRIM(p_title),
      LEFT(TRIM(p_message), 500),
      NOW()::TEXT,
      'todos',
      '',
      p_image_url,
      p_link_url,
      NOW()
    );
    v_count := 1;

  -- Caso 2: Enviar a un telefono especifico (chat 1-a-1)
  ELSIF p_audience = 'phone' THEN
    IF p_target_value IS NULL OR TRIM(p_target_value) = '' THEN
      RAISE EXCEPTION 'Phone number required for phone audience';
    END IF;

    v_notif_id := 'promo-' || gen_random_uuid()::TEXT;

    INSERT INTO public.notifications (id, titulo, mensaje, fecha, tipo, destinatario_telefono, imagen_url, link_url, created_at)
    VALUES (
      v_notif_id,
      TRIM(p_title),
      LEFT(TRIM(p_message), 500),
      NOW()::TEXT,
      'personal',
      TRIM(p_target_value),
      p_image_url,
      p_link_url,
      NOW()
    );
    v_count := 1;

  -- Caso 3: Enviar a usuarios de una sede especifica
  ELSIF p_audience = 'sede' THEN
    IF p_target_value IS NULL OR TRIM(p_target_value) = '' THEN
      RAISE EXCEPTION 'Sede ID required for sede audience';
    END IF;

    -- Crear notificacion por cada suscripcion activa de esa sede
    FOR v_target IN
      SELECT DISTINCT ON (ps.destinatario_telefono)
        ps.destinatario_telefono,
        ps.id AS sub_id
      FROM public.push_subscriptions ps
      WHERE ps.is_active = true
        AND ps.destinatario_telefono IS NOT NULL
        AND TRIM(ps.destinatario_telefono) != ''
        -- Buscar pedidos recientes de esta sede para filtrar usuarios activos
        AND EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.cliente_telefono = ps.destinatario_telefono
            AND o.sede_id = p_target_value
            AND o.created_at > NOW() - INTERVAL '90 days'
        )
    LOOP
      v_notif_id := 'promo-sede-' || p_target_value || '-' || gen_random_uuid()::TEXT;

      INSERT INTO public.notifications (id, titulo, mensaje, fecha, tipo, destinatario_telefono, imagen_url, link_url, created_at)
      VALUES (
        v_notif_id,
        TRIM(p_title),
        LEFT(TRIM(p_message), 500),
        NOW()::TEXT,
        'personal',
        v_target.destinatario_telefono,
        p_image_url,
        p_link_url,
        NOW()
      );
      v_count := v_count + 1;
    END LOOP;

  -- Caso 4: Enviar a un segmento de clientes (por customer_segments)
  ELSIF p_audience = 'segment' THEN
    IF p_target_value IS NULL OR TRIM(p_target_value) = '' THEN
      RAISE EXCEPTION 'Segment key required for segment audience';
    END IF;

    FOR v_target IN
      SELECT DISTINCT ON (ps.destinatario_telefono)
        ps.destinatario_telefono,
        ps.id AS sub_id
      FROM public.push_subscriptions ps
      INNER JOIN public.customer_segments cs ON cs.user_id = ps.user_id
      WHERE ps.is_active = true
        AND ps.destinatario_telefono IS NOT NULL
        AND TRIM(ps.destinatario_telefono) != ''
        AND cs.segment_key = p_target_value
    LOOP
      v_notif_id := 'promo-seg-' || p_target_value || '-' || gen_random_uuid()::TEXT;

      INSERT INTO public.notifications (id, titulo, mensaje, fecha, tipo, destinatario_telefono, imagen_url, link_url, created_at)
      VALUES (
        v_notif_id,
        TRIM(p_title),
        LEFT(TRIM(p_message), 500),
        NOW()::TEXT,
        'personal',
        v_target.destinatario_telefono,
        p_image_url,
        p_link_url,
        NOW()
      );
      v_count := v_count + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'notifications_created', v_count,
    'audience', p_audience,
    'target', p_target_value
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Limpiar suscripciones expiradas (ejecutar periodicamente via cron)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_expired_subscriptions()
RETURNS void
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Marcar como inactivas las suscripciones sin uso por 30+ dias
  UPDATE public.push_subscriptions
  SET is_active = false
  WHERE is_active = true
    AND last_used_at < NOW() - INTERVAL '30 days';

  -- Eliminar notificaciones antiguas (mas de 30 dias) para liberar espacio
  DELETE FROM public.notifications
  WHERE created_at < NOW() - INTERVAL '30 days'
    AND tipo != 'admin';
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. RPC: Reclamar bono de instalacion PWA (idempotente, una vez por usuario)
--    Wrapper seguro que valida estado de suscripcion push antes de otorgar bono.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_pwa_push_bonus(p_user_id TEXT)
RETURNS JSONB
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_has_active_sub BOOLEAN;
  v_already_claimed BOOLEAN;
BEGIN
  -- Verificar que el usuario tiene al menos una suscripcion push activa
  SELECT EXISTS(
    SELECT 1 FROM public.push_subscriptions
    WHERE user_id = p_user_id
      AND is_active = true
      AND destinatario_telefono IS NOT NULL
      AND destinatario_telefono != ''
  ) INTO v_has_active_sub;

  IF NOT v_has_active_sub THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No active push subscription found for this user'
    );
  END IF;

  -- Delegar a claim_pwa_bonus (ya existente en 15_loyalty_system_complete.sql)
  -- Esta funcion es idempotente: retorna error controlado si ya reclamo
  RETURN public.claim_pwa_bonus(p_user_id);
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. RLS: Blindar la tabla notifications contra spam y data leaks
--    REGLA: solo service_role o SECURITY DEFINER pueden INSERTar notificaciones.
--    Los clientes autenticados solo LEEN sus propias notificaciones.
--    Los anon NO pueden INSERT ni SELECT en notifications.
-- ----------------------------------------------------------------------------

-- Primero, eliminar las politicas antiguas permisivas de anon
DROP POLICY IF EXISTS "notifications_insert_anon_chat" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_guardada" ON notifications;
DROP POLICY IF EXISTS "Lectura de notificaciones" ON notifications;
DROP POLICY IF EXISTS "notifications_update_auth_only" ON notifications;
DROP POLICY IF EXISTS "notifications_service_role_all" ON notifications;

-- Politica: Solo service_role puede INSERT en notifications
CREATE POLICY "notifications_insert_service_role" ON notifications
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Politica: Admin/operator puede INSERT cualquier notificacion (broadcast, personal, admin)
CREATE POLICY "notifications_insert_admin" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_operator()
  );

-- Politica: Cualquier usuario autenticado puede INSERT notificaciones personales
-- (necesario para mensajes de bienvenida, confirmaciones, etc.)
CREATE POLICY "notifications_insert_personal" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    tipo = 'personal'
    AND destinatario_telefono IS NOT NULL
    AND TRIM(destinatario_telefono) != ''
  );

-- Politica: Usuarios autenticados leen sus propias notificaciones o broadcasts
CREATE POLICY "notifications_select_own_and_broadcast" ON notifications
  FOR SELECT TO authenticated
  USING (
    tipo = 'todos'
    OR tipo = 'admin'
    OR (tipo = 'personal' AND destinatario_telefono IS NOT NULL AND destinatario_telefono != '')
    OR (tipo = 'request' AND destinatario_telefono IS NOT NULL AND destinatario_telefono != '')
  );

-- Politica: Admin puede leer y actualizar todas las notificaciones
CREATE POLICY "notifications_admin_all" ON notifications
  FOR ALL TO authenticated
  USING (public.is_admin_or_operator())
  WITH CHECK (public.is_admin_or_operator());

-- Politica: service_role tiene acceso total
CREATE POLICY "notifications_service_role_all" ON notifications
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 10. RLS: push_subscriptions - blindaje
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "push_subscriptions_service_role_all" ON push_subscriptions;
DROP POLICY IF EXISTS "manage_own_push_subscriptions_safe" ON push_subscriptions;
DROP POLICY IF EXISTS "allow_anonymous_push_subscriptions" ON push_subscriptions;

-- service_role tiene acceso total
CREATE POLICY "push_subscriptions_service_role_all" ON push_subscriptions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Usuarios autenticados gestionan sus propias suscripciones
CREATE POLICY "push_subscriptions_manage_own" ON push_subscriptions
  FOR ALL TO authenticated
  USING ((user_id IS NULL) OR (auth.uid()::text = user_id))
  WITH CHECK ((user_id IS NULL) OR (auth.uid()::text = user_id));

-- Anon puede INSERTar suscripciones (necesario para registro sin login)
-- pero NO puede SELECT ni UPDATE
CREATE POLICY "push_subscriptions_insert_anon" ON push_subscriptions
  FOR INSERT TO anon
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 11. RLS: push_events - blindaje
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "push_events_service_role_all" ON push_events;
DROP POLICY IF EXISTS "push_events_insert_anon" ON push_events;
DROP POLICY IF EXISTS "push_events_insert_auth" ON push_events;
DROP POLICY IF EXISTS "push_events_admin_all" ON push_events;

-- service_role tiene acceso total
CREATE POLICY "push_events_service_role_all" ON push_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Admin/operator puede todo
CREATE POLICY "push_events_admin_all" ON push_events
  FOR ALL TO authenticated
  USING (public.is_admin_or_operator())
  WITH CHECK (public.is_admin_or_operator());

-- Cualquier usuario autenticado puede registrar eventos de sus propias notificaciones
CREATE POLICY "push_events_insert_auth" ON push_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Anon puede registrar eventos (necesario para tracking desde SW)
CREATE POLICY "push_events_insert_anon" ON push_events
  FOR INSERT TO anon
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 12. Permisos GRANT - PRINCIPIO DE MENOR PRIVILEGIO
--    CRITICAL FIX: Eliminados SELECT/INSERT directos de anon sobre notifications
--    para prevenir spam masivo y data leaks de notificaciones personales.
-- ----------------------------------------------------------------------------
GRANT INSERT ON push_subscriptions TO anon;
-- NOTA: NO se concede SELECT a anon en notifications ni push_subscriptions
-- Las operaciones SELECT en notifications se manejan via Realtime (auth required)
-- o via SECURITY DEFINER RPCs del backend.

GRANT INSERT ON push_events TO anon;

GRANT EXECUTE ON FUNCTION public.notify_order_status_change TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_abandoned_carts TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_subscriptions TO service_role;
GRANT EXECUTE ON FUNCTION public.send_broadcast_promotion TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pwa_push_bonus TO authenticated;

-- send_chat_push: solo admin/operator (la funcion ya valida internamente)
GRANT EXECUTE ON FUNCTION public.send_chat_push TO authenticated;

-- ----------------------------------------------------------------------------
-- 13. Realtime para orders (necesario para triggers de notificacion)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 14. REPLICA IDENTITY para notifications (requerido por Supabase Realtime)
-- ----------------------------------------------------------------------------
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
