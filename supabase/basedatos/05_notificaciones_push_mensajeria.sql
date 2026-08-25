-- ========================================================
-- MÓDULO: NOTIFICACIONES, PUSH Y MENSAJERÍA
-- ARCHIVO: /supabase/basedatos/05_notificaciones_push_mensajeria.sql
-- PROPÓSITO: Notificaciones in-app, suscripciones push, webhooks, tracking de eventos
-- ÚLTIMA REVISIÓN: 2026-08-23
-- DEPENDENCIAS: 01_core (is_admin_or_operator), 06_marketing (campaigns)
-- ========================================================

-- ----------------------------------------------------------------------------
-- 1. notifications (NOTIFICACIONES IN-APP)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(50) PRIMARY KEY,
    titulo TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    fecha TEXT NOT NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'todos',
    destinatario_telefono VARCHAR(20) DEFAULT '',
    leida BOOLEAN NOT NULL DEFAULT FALSE,
    imagen_url TEXT DEFAULT '',
    link_url TEXT DEFAULT '',
    click_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 2. push_subscriptions (SUSCRIPCIONES WEB PUSH VAPID)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.usuarios_clientes(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth_secret TEXT NOT NULL,
    destinatario_telefono TEXT DEFAULT '',
    anonymous_id TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(endpoint)
);

-- ----------------------------------------------------------------------------
-- 3. push_events (TRACKING DE EVENTOS PUSH)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id TEXT NOT NULL,
    campaign_id UUID,
    user_id TEXT,
    anonymous_id TEXT DEFAULT '',
    event_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FK para campaign_id se agrega en archivo 06 (despues de crear campaigns)
-- Ver 06_marketing_fidelizacion_cupones.sql

CREATE INDEX IF NOT EXISTS idx_push_events_notif ON push_events(notification_id);
CREATE INDEX IF NOT EXISTS idx_push_events_campaign ON push_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_push_events_type ON push_events(event_type);
CREATE INDEX IF NOT EXISTS idx_push_events_created ON push_events(created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. push_rate_limits (RATE LIMITING POR USUARIO POR SEMANA)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    week_start DATE NOT NULL,
    push_count INTEGER NOT NULL DEFAULT 0,
    max_pushes INTEGER NOT NULL DEFAULT 3,
    last_push_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_week ON push_rate_limits(user_id, week_start);

-- ----------------------------------------------------------------------------
-- 5. app_secrets (SECRETOS NO PÚBLICOS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_secrets (
    id integer PRIMARY KEY,
    push_webhook_secret text NOT NULL DEFAULT '',
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_secrets (id, push_webhook_secret)
VALUES (1, 'CHANGE_ME_IN_PRODUCTION')
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 6. RPC: Obtener secreto del webhook (SECURITY DEFINER)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_push_webhook_secret()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT push_webhook_secret FROM public.app_secrets WHERE id = 1;
$$;

-- ----------------------------------------------------------------------------
-- 7. RPC: Incrementar clics de notificación
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_notification_click(p_notif_id TEXT)
RETURNS VOID
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.notifications
  SET click_count = COALESCE(click_count, 0) + 1
  WHERE id = p_notif_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. RPC: Verificar rate limit de push
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_push_rate_limit(p_user_id TEXT)
RETURNS BOOLEAN
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_week_start DATE;
    v_count INTEGER;
    v_max INTEGER;
BEGIN
    v_week_start := date_trunc('week', CURRENT_DATE)::date;
    SELECT push_count, max_pushes INTO v_count, v_max
    FROM push_rate_limits
    WHERE user_id = p_user_id AND week_start = v_week_start;
    IF NOT FOUND THEN
        RETURN TRUE;
    END IF;
    RETURN v_count < v_max;
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. RPC: Incrementar contador de pushes
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_push_count(p_user_id TEXT)
RETURNS VOID
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_week_start DATE;
BEGIN
    v_week_start := date_trunc('week', CURRENT_DATE)::date;
    INSERT INTO push_rate_limits (user_id, week_start, push_count, last_push_at)
    VALUES (p_user_id, v_week_start, 1, NOW())
    ON CONFLICT (user_id, week_start) DO UPDATE
    SET push_count = push_rate_limits.push_count + 1,
        last_push_at = NOW();
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. RPC: Reset semanal de rate limits
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_weekly_rate_limits()
RETURNS VOID
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    DELETE FROM push_rate_limits
    WHERE week_start < (CURRENT_DATE - INTERVAL '4 weeks')::date;
END;
$$;

-- ----------------------------------------------------------------------------
-- 11. RPC: Admin leer todas las suscripciones push
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_all_push_subscriptions()
RETURNS TABLE (
    id UUID,
    user_id TEXT,
    endpoint TEXT,
    p256dh TEXT,
    auth_secret TEXT,
    destinatario_telefono TEXT,
    anonymous_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE
)
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NOT public.is_admin_or_operator() THEN
        RAISE EXCEPTION 'Access denied: admin or operator role required';
    END IF;

    RETURN QUERY
    SELECT ps.id, ps.user_id, ps.endpoint, ps.p256dh, ps.auth_secret, ps.destinatario_telefono, ps.anonymous_id, ps.created_at
    FROM public.push_subscriptions ps;
END;
$$;

-- ----------------------------------------------------------------------------
-- 12. TRIGGER: Notificaciones push via webhook
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_notification_push()
RETURNS TRIGGER
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_webhook_url TEXT;
  v_webhook_secret TEXT;
BEGIN
  SELECT push_webhook_url INTO v_webhook_url
  FROM public.store_config WHERE id = 1;

  v_webhook_secret := public.get_push_webhook_secret();

  IF v_webhook_url IS NOT NULL AND v_webhook_url <> '' AND NEW.tipo IN ('todos', 'personal', 'admin', 'request') THEN
    PERFORM net.http_post(
      url := v_webhook_url,
      body := jsonb_build_object(
        'title', NEW.titulo,
        'body', NEW.mensaje,
        'icon', COALESCE(NEW.imagen_url, '/icon.png'),
        'badge', '/icon.png',
        'sound', 'default',
        'vibrate', ARRAY[200, 100, 200],
        'tag', 'marketcoffee-' || NEW.id,
        'url', COALESCE(NEW.link_url, '/'),
        'record', jsonb_build_object(
          'id', NEW.id, 'title', NEW.titulo, 'body', NEW.mensaje,
          'icon', COALESCE(NEW.imagen_url, '/icon.png'),
          'tag', 'marketcoffee-' || NEW.id, 'renotify', true,
          'titulo', NEW.titulo, 'mensaje', NEW.mensaje,
          'imagen_url', COALESCE(NEW.imagen_url, ''),
          'link_url', COALESCE(NEW.link_url, '/'),
          'tipo', NEW.tipo,
          'destinatario_telefono', COALESCE(NEW.destinatario_telefono, '')
        )
      )::text,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-webhook-secret', v_webhook_secret
      )
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'No se pudo invocar webhook de push: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_push_notification ON public.notifications;
DROP TRIGGER IF EXISTS trigger_notify_push ON public.notifications;
CREATE TRIGGER trigger_push_notification
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.handle_new_notification_push();

-- ----------------------------------------------------------------------------
-- 13. RPC: Limpieza automática de datos antiguos
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_old_notifications()
RETURNS void
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    DELETE FROM public.notifications WHERE created_at < NOW() - INTERVAL '15 days';
    DELETE FROM public.orders WHERE status = 'Cancelado' AND created_at < NOW() - INTERVAL '3 months';
END;
$$;

-- ----------------------------------------------------------------------------
-- 14. REALTIME para notifications
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- ----------------------------------------------------------------------------
-- 15. POLÍTICAS RLS
-- ----------------------------------------------------------------------------
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_secrets ENABLE ROW LEVEL SECURITY;

-- notifications: Anti-spam
DROP POLICY IF EXISTS "notifications_insert_guardada" ON notifications;
CREATE POLICY "notifications_insert_guardada" ON notifications
    FOR INSERT TO anon, authenticated
    WITH CHECK (
        public.is_admin_or_operator()
        OR public.is_customer()
        OR tipo IN ('personal', 'request')
    );

DROP POLICY IF EXISTS "Lectura de notificaciones" ON notifications;
CREATE POLICY "Lectura de notificaciones" ON notifications
    FOR SELECT TO anon, authenticated USING (
        tipo = 'todos' OR tipo = 'admin'
        OR (tipo = 'personal' AND destinatario_telefono IS NOT NULL AND destinatario_telefono != '')
        OR (tipo = 'request' AND destinatario_telefono IS NOT NULL AND destinatario_telefono != '')
    );

DROP POLICY IF EXISTS "notifications_update_auth_only" ON notifications;
CREATE POLICY "notifications_update_auth_only" ON notifications
    FOR UPDATE TO authenticated
    USING (is_admin_or_operator() OR (tipo = 'personal' AND destinatario_telefono IS NOT NULL AND destinatario_telefono != ''))
    WITH CHECK (is_admin_or_operator() OR (tipo = 'personal' AND destinatario_telefono IS NOT NULL AND destinatario_telefono != ''));

-- push_subscriptions
DROP POLICY IF EXISTS "manage_own_push_subscriptions_safe" ON push_subscriptions;
CREATE POLICY "manage_own_push_subscriptions_safe" ON push_subscriptions
    FOR ALL TO authenticated
    USING ((user_id IS NULL) OR (auth.uid()::text = user_id))
    WITH CHECK ((user_id IS NULL) OR (auth.uid()::text = user_id));

DROP POLICY IF EXISTS "allow_anonymous_push_subscriptions" ON push_subscriptions;
CREATE POLICY "allow_anonymous_push_subscriptions" ON push_subscriptions
    FOR INSERT TO anon WITH CHECK (user_id IS NULL);

-- push_events
DROP POLICY IF EXISTS "push_events_insert_anon" ON push_events;
CREATE POLICY "push_events_insert_anon" ON push_events
    FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "push_events_insert_auth" ON push_events;
CREATE POLICY "push_events_insert_auth" ON push_events
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "push_events_admin_all" ON push_events;
CREATE POLICY "push_events_admin_all" ON push_events
    FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

-- push_rate_limits
DROP POLICY IF EXISTS "rate_limits_admin_all" ON push_rate_limits;
CREATE POLICY "rate_limits_admin_all" ON push_rate_limits
    FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

-- app_secrets
DROP POLICY IF EXISTS "app_secrets_admin_manage" ON app_secrets;
CREATE POLICY "app_secrets_admin_manage" ON app_secrets
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 16. PERMISOS
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT ON notifications TO anon;
GRANT INSERT ON push_subscriptions TO anon;
GRANT INSERT ON push_events TO anon;
