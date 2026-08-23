-- ========================================================
-- MIGRACION: MEJORAS AL SISTEMA PUSH NOTIFICATIONS
-- ARCHIVO: /supabase/basedatos/14_push_notifications_upgrade.sql
-- PROP OSITO: Agregar campos faltantes, triggers admin/chat, RLS mejorado
-- FECHA: 2026-08-23
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

-- ----------------------------------------------------------------------------
-- 2. Trigger: Notificar al ADMIN/OPERATOR cuando un cliente crea un pedido
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_admin_new_order()
RETURNS TRIGGER
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sede_id TEXT;
  v_admin_phone TEXT;
BEGIN
  -- Obtener la sede del pedido
  v_sede_id := COALESCE(NEW.sede_id, '');
  
  -- Insertar notificacion in-app para admins/operators
  INSERT INTO public.notifications (id, titulo, mensaje, fecha, tipo, destinatario_telefono, link_url, created_at)
  VALUES (
    'order-' || NEW.id || '-admin',
    'Nuevo Pedido #' || NEW.id,
    'Cliente: ' || COALESCE(NEW.cliente_nombre, 'N/A') || ' — Total: $' || COALESCE(NEW.total_usd::TEXT, '0'),
    NOW()::TEXT,
    'admin',
    '',
    '/admin',
    NOW()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_admin_new_order ON public.orders;
CREATE TRIGGER trigger_notify_admin_new_order
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_new_order();

-- ----------------------------------------------------------------------------
-- 3. Trigger: Notificar cambio de estado de pedido al cliente
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Solo notificar si el status realmente cambio
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (id, titulo, mensaje, fecha, tipo, destinatario_telefono, link_url, created_at)
    VALUES (
      'order-' || NEW.id || '-status-' || NEW.status,
      CASE NEW.status
        WHEN 'En Preparacion' THEN 'Tu pedido esta en preparacion'
        WHEN 'En Camino' THEN 'Tu pedido va en camino'
        WHEN 'Entregado' THEN 'Tu pedido ha sido entregado'
        WHEN 'Cancelado' THEN 'Tu pedido ha sido cancelado'
        ELSE 'Estado actualizado: ' || NEW.status
      END,
      'Pedido #' || NEW.id || ' — ' || COALESCE(NEW.tiempo_estimado_entrega, ''),
      NOW()::TEXT,
      'personal',
      COALESCE(NEW.cliente_telefono, ''),
      '/',
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_order_status_change ON public.orders;
CREATE TRIGGER trigger_notify_order_status_change
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_order_status_change();

-- ----------------------------------------------------------------------------
-- 4. RPC: Enviar mensaje de chat 1-a-1 como push notification
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
  INSERT INTO public.notifications (id, titulo, mensaje, fecha, tipo, destinatario_telefono, link_url, created_at)
  VALUES (
    'chat-' || gen_random_uuid()::TEXT,
    'Mensaje de ' || p_from_name,
    LEFT(p_message, 200),
    NOW()::TEXT,
    'personal',
    p_to_phone,
    '/',
    NOW()
  );
  RETURN true;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. RPC: Detectar y notificar carritos abandonados
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_abandoned_carts()
RETURNS void
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cart RECORD;
BEGIN
  -- Buscar carritos con mas de 30 minutos sin completar
  FOR v_cart IN
    SELECT DISTINCT
      o.cliente_nombre,
      o.cliente_telefono,
      o.total_usd,
      o.created_at,
      o.sede_id
    FROM public.orders o
    WHERE o.status = 'Pendiente'
      AND o.created_at < NOW() - INTERVAL '30 minutes'
      AND o.created_at > NOW() - INTERVAL '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.id LIKE 'cart-abandon-' || o.id || '%'
      )
  LOOP
    INSERT INTO public.notifications (id, titulo, mensaje, fecha, tipo, destinatario_telefono, link_url, created_at)
    VALUES (
      'cart-abandon-' || v_cart.cliente_telefono || '-' || EXTRACT(EPOCH FROM NOW())::TEXT,
      '¿Olvidaste algo en tu carrito? 🛒',
      'Tu pedido de $' || COALESCE(v_cart.total_usd::TEXT, '0') || ' te espera. ¡Completa tu compra!',
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
-- 6. Limpiar suscripciones expiradas (executar periodicamente via cron)
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
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. RLS: Permitir service_role para operaciones de push
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "push_subscriptions_service_role_all" ON push_subscriptions;
CREATE POLICY "push_subscriptions_service_role_all" ON push_subscriptions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_service_role_all" ON notifications;
CREATE POLICY "notifications_service_role_all" ON notifications
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "push_events_service_role_all" ON push_events;
CREATE POLICY "push_events_service_role_all" ON push_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Permitir INSERT a anon en notifications (para trigger de chat)
DROP POLICY IF EXISTS "notifications_insert_anon_chat" ON notifications;
CREATE POLICY "notifications_insert_anon_chat" ON notifications
  FOR INSERT TO anon
  WITH CHECK (tipo IN ('personal', 'admin', 'request'));

-- ----------------------------------------------------------------------------
-- 8. Permisos GRANT adicionales
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON push_subscriptions TO anon;
GRANT SELECT, INSERT ON notifications TO anon;
GRANT EXECUTE ON FUNCTION public.send_chat_push TO anon;
GRANT EXECUTE ON FUNCTION public.notify_abandoned_carts TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_subscriptions TO service_role;

-- ----------------------------------------------------------------------------
-- 9. Realtime para orders (necesario para triggers de notificacion)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
