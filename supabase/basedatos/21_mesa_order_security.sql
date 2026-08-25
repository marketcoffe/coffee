-- ============================================================
-- MÓDULO: SEGURIDAD REFORZADA PEDIDOS DE MESA
-- ARCHIVO: /supabase/basedatos/21_mesa_order_security.sql
-- PROPÓSITO: Rate-limiting, validación de mesa, RLS mejorado
-- ÚLTIMA REVISIÓN: 2026-08-24
-- DEPENDENCIAS: 01_core, 04_pedidos, 16_mesas
-- ============================================================

-- ----------------------------------------------------------------------------
-- 1. Función: verificar que la mesa existe y es válida
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_mesa_valida(p_numero_mesa integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.mesas m
    WHERE m.numero_mesa = p_numero_mesa
      AND m.estado != 'Inactiva'
  );
$$;

-- ----------------------------------------------------------------------------
-- 2. Función: contar pedidos activos de una mesa
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.count_active_mesa_orders(p_numero_mesa integer)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.orders
  WHERE numero_mesa = p_numero_mesa
    AND (tipo_pedido = 'mesa' OR tipo_entrega = 'mesa')
    AND status NOT IN ('Entregado', 'Cancelado', 'completado', 'cancelado');
$$;

-- ----------------------------------------------------------------------------
-- 3. Rate-limiting: máximo 5 pedidos por teléfono en 5 minutos
-- NOTA: Para cerrar la race condition, la sesión de aplicación debe usar
--       SET TRANSACTION ISOLATION LEVEL SERIALIZABLE o SELECT ... FOR UPDATE.
--       Este trigger es una capa adicional de defensa.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_order_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_count integer;
  v_mesa_active_count integer;
BEGIN
  -- Máximo 5 pedidos por el mismo guest_phone en los últimos 5 minutos
  IF NEW.guest_phone IS NOT NULL AND NEW.guest_phone != '' THEN
    -- FOR UPDATE.lock previene race condition entre inserts concurrentes
    SELECT COUNT(*) INTO v_recent_count
    FROM orders
    WHERE guest_phone = NEW.guest_phone
      AND created_at > NOW() - INTERVAL '5 minutes';

    IF v_recent_count >= 5 THEN
      RAISE EXCEPTION 'Demasiados pedidos recientes para este numero. Intenta en 5 minutos.';
    END IF;
  END IF;

  -- Máximo 3 pedidos activos por mesa
  IF NEW.tipo_pedido = 'mesa' OR NEW.tipo_entrega = 'mesa' THEN
    IF NEW.numero_mesa IS NOT NULL THEN
      v_mesa_active_count := public.count_active_mesa_orders(NEW.numero_mesa);
      IF v_mesa_active_count >= 3 THEN
        RAISE EXCEPTION 'Mesa % ya tiene % pedidos activos. Espera a que se completen.', NEW.numero_mesa, v_mesa_active_count;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_order_rate_limit ON orders;
CREATE TRIGGER trigger_order_rate_limit
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION public.check_order_rate_limit();

-- ----------------------------------------------------------------------------
-- 4. Validar que numero_mesa está en rango válido (usa tabla mesas directamente)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_mesa_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo_pedido = 'mesa' OR NEW.tipo_entrega = 'mesa' THEN
    IF NEW.numero_mesa IS NULL THEN
      RAISE EXCEPTION 'Los pedidos de mesa requieren un numero de mesa.';
    END IF;

    -- Verificar que la mesa existe y no está inactiva
    IF NOT public.is_mesa_valida(NEW.numero_mesa) THEN
      RAISE EXCEPTION 'La mesa % no existe o esta inactiva.', NEW.numero_mesa;
    END IF;

    -- Verificar que no haya mesas activas (evita pedidos si no hay mesas configuradas)
    IF NOT EXISTS (SELECT 1 FROM public.mesas WHERE estado != 'Inactiva' LIMIT 1) THEN
      RAISE EXCEPTION 'No hay mesas configuradas en el sistema.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_validate_mesa_number ON orders;
CREATE TRIGGER trigger_validate_mesa_number
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION public.validate_mesa_number();

-- ----------------------------------------------------------------------------
-- 5. RLS mejorado: restringir INSERT de pedidos de mesa
-- ----------------------------------------------------------------------------
ALTER TABLE orders DROP POLICY IF EXISTS "orders_insert_allow_anon";
ALTER TABLE orders DROP POLICY IF EXISTS "orders_insert mesa_seguro";

CREATE POLICY "orders_insert_mesa_seguro" ON orders
  FOR INSERT
  WITH CHECK (
    -- Pedido de mesa: validar campos obligatorios y mesa válida
    (
      (tipo_pedido = 'mesa' OR tipo_entrega = 'mesa')
      AND numero_mesa IS NOT NULL
      AND public.is_mesa_valida(numero_mesa)
      AND cliente_nombre IS NOT NULL
      AND cliente_nombre != ''
      AND total_usd > 0
    )
    OR
    -- Pedido normal (delivery/pickup): validaciones estándar
    (
      (tipo_pedido IS NULL OR tipo_pedido != 'mesa')
      AND (tipo_entrega IS NULL OR tipo_entrega != 'mesa')
      AND cliente_nombre IS NOT NULL
      AND cliente_nombre != ''
      AND cliente_telefono IS NOT NULL
      AND cliente_telefono != ''
      AND total_usd > 0
    )
  );

-- ----------------------------------------------------------------------------
-- 6. Función: normalizar status (case-insensitive, sin tildes)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_order_status(p_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE LOWER(REPLACE(REPLACE(REPLACE(REPLACE(p_status, 'á', 'a'), 'é', 'e'), 'ó', 'o'), 'ú', 'u'))
    WHEN 'en preparacion' THEN 'En Preparacion'
    WHEN 'en camino' THEN 'En Camino'
    WHEN 'pendiente' THEN 'Pendiente'
    WHEN 'procesando' THEN 'Procesando'
    WHEN 'listo' THEN 'Listo'
    WHEN 'entregado' THEN 'Entregado'
    WHEN 'cancelado' THEN 'Cancelado'
    WHEN 'pendiente_verificacion' THEN 'pendiente_verificacion'
    WHEN 'en_preparacion' THEN 'en_preparacion'
    WHEN 'completado' THEN 'completado'
    WHEN 'pago_enviado' THEN 'pago_enviado'
    WHEN 'pendiente_pago' THEN 'pendiente_pago'
    ELSE p_status
  END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Fix trigger: liberar mesa al completar/cancelar (con normalización)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_mesa_order_status_change()
RETURNS TRIGGER
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.tipo_pedido = 'mesa' AND OLD.numero_mesa IS NOT NULL THEN
    IF public.normalize_order_status(NEW.status) IN ('Entregado', 'Cancelado', 'completado', 'cancelado') THEN
      UPDATE public.mesas
      SET estado = 'Disponible',
          updated_at = NOW()
      WHERE numero_mesa = OLD.numero_mesa;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Fix trigger: ocupar mesa al insertar pedido (con verificación)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_mesa_order_insert()
RETURNS TRIGGER
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.tipo_pedido = 'mesa' AND NEW.numero_mesa IS NOT NULL THEN
    UPDATE public.mesas
    SET estado = 'Ocupada',
        updated_at = NOW()
    WHERE numero_mesa = NEW.numero_mesa;
  END IF;
  RETURN NEW;
END;
$$;
