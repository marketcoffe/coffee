-- ========================================================
-- MÓDULO: MESAS Y PEDIDOS EN MESA
-- ARCHIVO: /supabase/basedatos/16_mesas_pedidos_modulo.sql
-- PROPÓSITO: Tabla mesas, campos extendidos en orders para pedidos en mesa
-- ÚLTIMA REVISIÓN: 2026-08-23
-- DEPENDENCIAS: 01_core (is_admin_or_operator), 04_pedidos (orders)
-- ========================================================

-- ----------------------------------------------------------------------------
-- 1. mesas (TABLA DE MESAS DEL LOCAL)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mesas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_mesa INTEGER NOT NULL UNIQUE,
    nombre_personalizado TEXT DEFAULT '',
    estado TEXT NOT NULL DEFAULT 'Disponible'
        CHECK (estado IN ('Disponible', 'Ocupada', 'Reservada', 'Inactiva')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insertar 10 mesas por defecto si la tabla está vacía
INSERT INTO mesas (numero_mesa, nombre_personalizado, estado)
SELECT gs, 'Mesa ' || gs, 'Disponible'
FROM generate_series(1, 10) AS gs
WHERE NOT EXISTS (SELECT 1 FROM mesas LIMIT 1);

-- REPLICA IDENTITY FULL para Supabase Realtime
ALTER TABLE public.mesas REPLICA IDENTITY FULL;

-- ----------------------------------------------------------------------------
-- 2. POLÍTICAS RLS para mesas
-- ----------------------------------------------------------------------------
ALTER TABLE mesas ENABLE ROW LEVEL SECURITY;

-- Lectura: todos (anon + authenticated) — las mesas son públicas
DROP POLICY IF EXISTS "mesas_select_all" ON mesas;
CREATE POLICY "mesas_select_all" ON mesas
    FOR SELECT USING (true);

-- Edición (UPDATE): solo admin/operator — clientes NUNCA deben modificar mesas
DROP POLICY IF EXISTS "mesas_update_admin_operator" ON mesas;
CREATE POLICY "mesas_update_admin_operator" ON mesas
    FOR UPDATE TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

-- Insert/Delete: solo admin
DROP POLICY IF EXISTS "mesas_insert_admin" ON mesas;
CREATE POLICY "mesas_insert_admin" ON mesas
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "mesas_delete_admin" ON mesas;
CREATE POLICY "mesas_delete_admin" ON mesas
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- Permisos: anon solo lectura, authenticated solo lectura (RLS controla write)
GRANT SELECT ON mesas TO anon;
GRANT SELECT ON mesas TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. Realtime para mesas
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.mesas;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Actualizar tabla orders: agregar campos extendidos para pedidos en mesa
-- ----------------------------------------------------------------------------
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

    -- nombre_cliente para pedidos en mesa (nombre simplificado)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'nombre_cliente'
    ) THEN
        ALTER TABLE orders ADD COLUMN nombre_cliente TEXT DEFAULT '';
    END IF;

    -- referencia_pago para pagos móviles en mesa
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'referencia_pago'
    ) THEN
        ALTER TABLE orders ADD COLUMN referencia_pago TEXT DEFAULT '';
    END IF;

    -- banco_origen para pagos móviles en mesa
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'banco_origen'
    ) THEN
        ALTER TABLE orders ADD COLUMN banco_origen TEXT DEFAULT '';
    END IF;

    -- status extendido: 'pendiente_verificacion', 'en_preparacion', 'completado', 'cancelado'
    -- Se mantiene compatibilidad con los statuses existentes
END $$;

-- Index para buscar pedidos por mesa
CREATE INDEX IF NOT EXISTS idx_orders_numero_mesa ON orders(numero_mesa)
    WHERE numero_mesa IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_tipo_pedido ON orders(tipo_pedido);

-- ----------------------------------------------------------------------------
-- 5. TRIGGER: Actualizar estado de mesa al crear pedido de mesa
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

DROP TRIGGER IF EXISTS trigger_mesa_order_insert ON public.orders;
CREATE TRIGGER trigger_mesa_order_insert
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_mesa_order_insert();

-- ----------------------------------------------------------------------------
-- 6. TRIGGER: Liberar mesa cuando se completa o cancela el pedido
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_mesa_order_status_change()
RETURNS TRIGGER
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF OLD.tipo_pedido = 'mesa' AND OLD.numero_mesa IS NOT NULL THEN
        IF NEW.status IN ('Entregado', 'Cancelado', 'completado', 'cancelado') THEN
            UPDATE public.mesas
            SET estado = 'Disponible',
                updated_at = NOW()
            WHERE numero_mesa = OLD.numero_mesa;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_mesa_order_status ON public.orders;
CREATE TRIGGER trigger_mesa_order_status
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_mesa_order_status_change();

-- ----------------------------------------------------------------------------
-- 7. MIGRACIÓN: Agregar status 'pago_enviado' y 'pendiente_pago'
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    -- Actualizar el CHECK constraint del status para incluir todos los valores usados en el sistema
    -- NOTA: Incluir variantes con/ sin tilde y mayusculas/minusculas por compatibilidad
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
    
    -- Crear el nuevo constraint con todos los status incluidos
    -- NOTA: 'En preparación' (con tilde) es lo que el frontend envía desde useOrders.ts advanceStatus()
    ALTER TABLE orders ADD CONSTRAINT orders_status_check 
        CHECK (status IN (
            'Pendiente', 'Procesando', 
            'En Preparacion', 'En preparacion', 'En preparación',
            'Listo', 'En Camino', 'En camino',
            'Entregado', 'Cancelado',
            'pendiente_verificacion', 'en_preparacion', 'completado', 'cancelado',
            'pago_enviado', 'pendiente_pago'
        ));
END $$;
