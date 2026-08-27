-- ============================================================
-- MÓDULO: MESAS V2 - CHECKOUT DEDICADO + NOTIFICACIONES PUSH
-- ARCHIVO: /supabase/basedatos/24_reemplazo_modulo_mesas_v2.sql
-- PROPÓSITO: Reemplazo total del módulo anterior de mesas.
--   - Checkout 100% independiente del checkout Delivery/PickUp
--   - Flujo: Envío a Cocina ANTES de seleccionar método de pago
--   - Notificaciones Push en TODOS los eventos clave
--   - RPCs seguras con SECURITY DEFINER
--   - Configuración de datos bancarios y tasa de cambio
-- ÚLTIMA REVISIÓN: 2026-08-25
-- DEPENDENCIAS: 01_core, 02_productos, 04_pedidos, 05_notificaciones, 16_mesas, 21_security
-- ============================================================

-- ============================================================================
-- PASO 1: LIMPIEZA - Eliminar funciones, triggers y políticas obsoletas
-- ============================================================================

-- Eliminar triggers antiguos que serán reemplazados
DROP TRIGGER IF EXISTS trigger_mesa_order_insert ON public.orders;
DROP TRIGGER IF EXISTS trigger_mesa_order_status ON public.orders;
DROP TRIGGER IF EXISTS trigger_mesa_order_status_change ON public.orders;
DROP TRIGGER IF EXISTS trigger_order_rate_limit ON public.orders;
DROP TRIGGER IF EXISTS trigger_validate_mesa_number ON public.orders;

-- Eliminar funciones antiguas
DROP FUNCTION IF EXISTS public.handle_mesa_order_insert() CASCADE;
DROP FUNCTION IF EXISTS public.handle_mesa_order_status_change() CASCADE;
DROP FUNCTION IF EXISTS public.check_order_rate_limit() CASCADE;
DROP FUNCTION IF EXISTS public.validate_mesa_number() CASCADE;
DROP FUNCTION IF EXISTS public.is_mesa_valida(integer) CASCADE;
DROP FUNCTION IF EXISTS public.count_active_mesa_orders(integer) CASCADE;
DROP FUNCTION IF EXISTS public.normalize_order_status(text) CASCADE;

-- Eliminar políticas RLS antiguas de orders
DROP POLICY IF EXISTS "orders_insert_mesa_seguro" ON orders;

-- ============================================================================
-- PASO 2: TABLA mesas - Mejorar estructura existente
-- ============================================================================

-- Asegurar que la tabla mesas existe con la estructura correcta
CREATE TABLE IF NOT EXISTS public.mesas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_mesa INTEGER NOT NULL UNIQUE,
    nombre_personalizado TEXT DEFAULT '',
    estado TEXT NOT NULL DEFAULT 'Disponible'
        CHECK (estado IN ('Disponible', 'Ocupada', 'Reservada', 'Inactiva')),
    capacidad INTEGER DEFAULT 4,
    ubicacion TEXT DEFAULT 'Interior',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Agregar columnas nuevas si no existen
DO $$ BEGIN
    ALTER TABLE public.mesas ADD COLUMN IF NOT EXISTS capacidad INTEGER DEFAULT 4;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.mesas ADD COLUMN IF NOT EXISTS ubicacion TEXT DEFAULT 'Interior';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Insertar 10 mesas por defecto si la tabla está vacía
INSERT INTO public.mesas (numero_mesa, nombre_personalizado, estado)
SELECT gs, 'Mesa ' || gs, 'Disponible'
FROM generate_series(1, 10) AS gs
WHERE NOT EXISTS (SELECT 1 FROM public.mesas LIMIT 1);

-- REPLICA IDENTITY FULL para Supabase Realtime
ALTER TABLE public.mesas REPLICA IDENTITY FULL;

-- ============================================================================
-- PASO 3: TABLA configuracion_pagos - Datos bancarios y tasa de cambio
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.configuracion_pagos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    banco_nombre TEXT NOT NULL,
    titular_cuenta TEXT NOT NULL,
    numero_cuenta TEXT NOT NULL,
    cedula_rif TEXT NOT NULL,
    telefono TEXT NOT NULL,
    tipo_cuenta TEXT DEFAULT 'Corriente',
    activo BOOLEAN DEFAULT true,
    es_principal BOOLEAN DEFAULT false,
    notas TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- REPLICA IDENTITY FULL
ALTER TABLE public.configuracion_pagos REPLICA IDENTITY FULL;

-- Insertar datos bancarios de ejemplo si la tabla está vacía
INSERT INTO public.configuracion_pagos (banco_nombre, titular_cuenta, numero_cuenta, cedula_rif, telefono, es_principal)
SELECT 'Banesco', 'Market Coffee Sweet', '0134-0000-00-0000000000', 'V-12345678', '0412-1234567', true
WHERE NOT EXISTS (SELECT 1 FROM public.configuracion_pagos LIMIT 1);

-- ============================================================================
-- PASO 4: RLS para configuracion_pagos
-- ============================================================================

ALTER TABLE public.configuracion_pagos ENABLE ROW LEVEL SECURITY;

-- Lectura: todos (anon + authenticated) — los datos bancarios son públicos para pagos
DROP POLICY IF EXISTS "config_pagos_select_all" ON public.configuracion_pagos;
CREATE POLICY "config_pagos_select_all" ON public.configuracion_pagos
    FOR SELECT USING (true);

-- Escritura: solo admin
DROP POLICY IF EXISTS "config_pagos_admin_only" ON public.configuracion_pagos;
CREATE POLICY "config_pagos_admin_only" ON public.configuracion_pagos
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Permisos
GRANT SELECT ON public.configuracion_pagos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracion_pagos TO authenticated;

-- ============================================================================
-- PASO 5: RLS para mesas (mantener mejoras)
-- ============================================================================

ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mesas_select_all" ON public.mesas;
CREATE POLICY "mesas_select_all" ON public.mesas
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "mesas_update_admin_operator" ON public.mesas;
CREATE POLICY "mesas_update_admin_operator" ON public.mesas
    FOR UPDATE TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

DROP POLICY IF EXISTS "mesas_insert_admin" ON public.mesas;
CREATE POLICY "mesas_insert_admin" ON public.mesas
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "mesas_delete_admin" ON public.mesas;
CREATE POLICY "mesas_delete_admin" ON public.mesas
    FOR DELETE TO authenticated
    USING (public.is_admin());

GRANT SELECT ON public.mesas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mesas TO authenticated;

-- ============================================================================
-- PASO 6: Realtime para mesas y configuracion_pagos
-- ============================================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.mesas;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.configuracion_pagos;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- PASO 7: Extender tabla orders para soportar flujo de mesa completo
-- ============================================================================

DO $$
BEGIN
    -- tipo_pedido: 'delivery', 'pickup', 'mesa'
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'tipo_pedido'
    ) THEN
        ALTER TABLE orders ADD COLUMN tipo_pedido VARCHAR(20) DEFAULT 'delivery'
            CHECK (tipo_pedido IN ('delivery', 'pickup', 'mesa'));
    END IF;

    -- nombre_cliente para pedidos en mesa
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'nombre_cliente'
    ) THEN
        ALTER TABLE orders ADD COLUMN nombre_cliente TEXT DEFAULT '';
    END IF;

    -- referencia_pago para pagos móviles
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'referencia_pago'
    ) THEN
        ALTER TABLE orders ADD COLUMN referencia_pago TEXT DEFAULT '';
    END IF;

    -- banco_origen para pagos móviles
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'banco_origen'
    ) THEN
        ALTER TABLE orders ADD COLUMN banco_origen TEXT DEFAULT '';
    END IF;

    -- numero_mesa
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'numero_mesa'
    ) THEN
        ALTER TABLE orders ADD COLUMN numero_mesa INTEGER;
    END IF;

    -- ticket_code: código corto para validación en caja (ej: #M-104)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'ticket_code'
    ) THEN
        ALTER TABLE orders ADD COLUMN ticket_code TEXT;
    END IF;

    -- telefono_emisor: teléfono del cliente que reporta el pago móvil
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'telefono_emisor'
    ) THEN
        ALTER TABLE orders ADD COLUMN telefono_emisor TEXT DEFAULT '';
    END IF;

    --monto_reportado: monto reportado por el cliente en el pago móvil
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'monto_reportado'
    ) THEN
        ALTER TABLE orders ADD COLUMN monto_reportado NUMERIC(10,2);
    END IF;
END $$;

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_orders_numero_mesa ON orders(numero_mesa)
    WHERE numero_mesa IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_tipo_pedido ON orders(tipo_pedido);
CREATE INDEX IF NOT EXISTS idx_orders_ticket_code ON orders(ticket_code)
    WHERE ticket_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- ============================================================================
-- PASO 8: CHECK constraint actualizado para todos los estados del sistema
-- ============================================================================

DO $$
BEGIN
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

    ALTER TABLE orders ADD CONSTRAINT orders_status_check
        CHECK (status IN (
            'Pendiente', 'Procesando',
            'En Preparacion', 'En preparacion', 'En preparación',
            'Listo', 'En Camino', 'En camino',
            'Entregado', 'Cancelado',
            'pendiente_verificacion', 'en_preparacion', 'completado', 'cancelado',
            'pago_enviado', 'pendiente_pago',
            'enviado_cocina', 'pago_en_verificacion'
        ));
END $$;

-- ============================================================================
-- PASO 9: Funciones de utilidad
-- ============================================================================

-- Normalizar status (case-insensitive, sin tildes)
CREATE OR REPLACE FUNCTION public.normalize_order_status(p_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE LOWER(REPLACE(REPLACE(REPLACE(REPLACE(
      REPLACE(REPLACE(REPLACE(REPLACE(p_status, 'á', 'a'), 'é', 'e'), 'ó', 'o'), 'ú', 'u'),
      'Á', 'A'), 'É', 'E'), 'Ó', 'O'), 'Ú', 'U'))
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
    WHEN 'enviado_cocina' THEN 'enviado_cocina'
    WHEN 'pago_en_verificacion' THEN 'pago_en_verificacion'
    ELSE p_status
  END;
$$;

-- Verificar que la mesa existe y no está inactiva
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

-- Contar pedidos activos de una mesa
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
    AND public.normalize_order_status(status) NOT IN ('Entregado', 'Cancelado', 'completado', 'cancelado');
$$;

-- Generar código corto de ticket para mesa (ej: #M-104)
CREATE OR REPLACE FUNCTION public.generate_ticket_code(p_numero_mesa integer)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT '#M-' || p_numero_mesa::text;
$$;

-- ============================================================================
-- PASO 10: TRIGGERS de seguridad y automatización
-- ============================================================================

-- Rate-limiting: máximo 5 pedidos por teléfono en 5 minutos
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

-- Validar numero_mesa en rango válido
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

    IF NOT public.is_mesa_valida(NEW.numero_mesa) THEN
      RAISE EXCEPTION 'La mesa % no existe o esta inactiva.', NEW.numero_mesa;
    END IF;

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

-- Trigger: Ocupar mesa al insertar pedido de mesa
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

DROP TRIGGER IF EXISTS trigger_mesa_order_insert ON public.orders;
CREATE TRIGGER trigger_mesa_order_insert
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_mesa_order_insert();

-- Trigger: Liberar mesa cuando se completa o cancela el pedido
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

DROP TRIGGER IF EXISTS trigger_mesa_order_status_change ON public.orders;
CREATE TRIGGER trigger_mesa_order_status_change
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_mesa_order_status_change();

-- ============================================================================
-- PASO 11: RLS mejorado para orders (soporte dual: mesa + delivery/pickup)
-- ============================================================================

DROP POLICY IF EXISTS "orders_insert_mesa_seguro" ON orders;
DROP POLICY IF EXISTS "orders_insert_allow_anon" ON orders;

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

-- ============================================================================
-- PASO 12: RPCs seguras para el flujo de mesa
-- ============================================================================

-- RPC: Crear pedido de mesa (envía directo a cocina)
-- Retorna el pedido creado con ticket_code
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
        RAISE EXCEPTION 'La mesa % no es válida o está inactiva.', p_numero_mesa;
    END IF;

    -- Generar ID y código de ticket
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

-- RPC: Reportar pago móvil desde la PWA del cliente
CREATE OR REPLACE FUNCTION public.reportar_pago_movil(
    p_order_id TEXT,
    p_banco_origen TEXT,
    p_referencia TEXT,
    p_telefono_emisor TEXT,
    p_monto NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.orders
    SET
        metodo_pago = 'Pago Móvil',
        banco_origen = p_banco_origen,
        referencia_pago = p_referencia,
        telefono_emisor = p_telefono_emisor,
        monto_reportado = p_monto,
        status = 'pago_enviado'
    WHERE id = p_order_id
      AND tipo_pedido = 'mesa'
      AND status IN ('enviado_cocina', 'pendiente_pago');

    RETURN FOUND;
END;
$$;

-- RPC: Validar pago en caja (efectivo/punto de venta)
CREATE OR REPLACE FUNCTION public.validar_pago_caja(
    p_order_id TEXT,
    p_metodo_pago TEXT DEFAULT 'Efectivo'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.orders
    SET
        metodo_pago = p_metodo_pago,
        status = 'completado'
    WHERE id = p_order_id
      AND tipo_pedido = 'mesa';

    RETURN FOUND;
END;
$$;

-- RPC: Rechazar pedido de mesa
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

-- RPC: Aprobar/rechazar pago móvil desde el admin
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

-- RPC: Aceptar pedido de mesa desde la comandera
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
        status = 'En Preparacion',
        tiempo_estimado_entrega = p_tiempo_estimado
    WHERE id = p_order_id
      AND tipo_pedido = 'mesa'
      AND status = 'enviado_cocina';

    RETURN FOUND;
END;
$$;

-- ============================================================================
-- PASO 13: Funciones para notificaciones Push automáticas
-- ============================================================================

-- Trigger function: Enviar notificación push cuando cambia el status de un pedido de mesa
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
    -- Solo procesar cambios de status en pedidos de mesa
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
-- FIN DEL SCRIPT
-- ============================================================================

-- RPC: Registrar que el cliente pagará en caja (Punto)
CREATE OR REPLACE FUNCTION public.registrar_pago_en_caja(
    p_order_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.orders
    SET status = 'pendiente_pago'
    WHERE id = p_order_id
      AND tipo_pedido = 'mesa'
      AND status IN ('enviado_cocina', 'pendiente_pago');

    RETURN FOUND;
END;
$$;
