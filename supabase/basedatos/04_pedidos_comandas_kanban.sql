-- ========================================================
-- MÓDULO: PEDIDOS, COMANDAS Y KANBAN
-- ARCHIVO: /supabase/basedatos/04_pedidos_comandas_kanban.sql
-- PROPÓSITO: Tabla orders, historial, comandas en tiempo real, Kanban, tracking GPS
-- ÚLTIMA REVISIÓN: 2026-08-23
-- DEPENDENCIAS: 01_core (is_admin_or_operator), 02_tienda (products), 03_checkout (coupons)
-- ========================================================

-- ----------------------------------------------------------------------------
-- 1. orders (TABLA PRINCIPAL DE PEDIDOS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(50) PRIMARY KEY,
    cliente_nombre TEXT NOT NULL,
    cliente_telefono TEXT NOT NULL,
    cliente_email TEXT,
    cliente_uid TEXT,
    guest_phone TEXT,
    guest_email TEXT,
    metodo_pago VARCHAR(50) NOT NULL DEFAULT 'Efectivo',
    tipo_entrega VARCHAR(20) NOT NULL DEFAULT 'delivery',
    numero_mesa INTEGER,
    direccion_envio TEXT DEFAULT '',
    lat NUMERIC(10, 6),
    lng NUMERIC(10, 6),
    distancia_km NUMERIC(8, 2) DEFAULT 0,
    items JSONB DEFAULT '[]'::JSONB,
    subtotal_usd NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    costo_envio_usd NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    descuento_cupon_usd NUMERIC(10,2) DEFAULT 0.00,
    cupon_codigo TEXT,
    total_usd NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_bs NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'Pendiente',
    tiempo_estimado_entrega TEXT DEFAULT '',
    notas_admin TEXT DEFAULT '',
    sede_id TEXT DEFAULT '',
    crear_cuenta BOOLEAN DEFAULT FALSE,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_cliente_email ON orders (cliente_email)
    WHERE cliente_email IS NOT NULL AND cliente_email != '';
CREATE INDEX IF NOT EXISTS idx_orders_guest_email ON orders (guest_email)
    WHERE guest_email IS NOT NULL AND guest_email != '';
CREATE INDEX IF NOT EXISTS idx_orders_cliente_telefono ON orders (cliente_telefono);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_fecha ON orders(fecha DESC);

-- Migración: Agregar sede_id si no existe (para tablas pre-existentes)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'sede_id'
    ) THEN
        ALTER TABLE orders ADD COLUMN sede_id TEXT DEFAULT '';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_sede ON orders(sede_id)
    WHERE sede_id IS NOT NULL AND sede_id != '';
CREATE INDEX IF NOT EXISTS idx_orders_cliente_uid ON orders(cliente_uid)
    WHERE cliente_uid IS NOT NULL;

-- REPLICA IDENTITY FULL para Supabase Realtime
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- ----------------------------------------------------------------------------
-- 2. TRIGGER: Acciones post-pedido (Stock + Cupones + Notificaciones)
-- Usa dblink o Shell para notificaciones (la tabla notifications se crea después)
-- ----------------------------------------------------------------------------
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
BEGIN
    IF NEW.items IS NULL OR jsonb_array_length(NEW.items) = 0 THEN
        RAISE WARNING 'Pedido % tiene items vacíos', NEW.id;
        RETURN NEW;
    END IF;

    IF NEW.total_usd IS NULL OR NEW.total_usd <= 0 THEN
        RAISE WARNING 'Pedido % tiene total inválido: %', NEW.id, NEW.total_usd;
    END IF;

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

    -- Crear notificación admin (notifications se crea en 06, pero el trigger puede referenciarla)
    v_notif_id := 'notif-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12);
    SELECT telefono_soporte INTO v_admin_phone FROM public.store_config WHERE id = 1;

    INSERT INTO public.notifications (id, titulo, mensaje, fecha, tipo, destinatario_telefono, leida)
    VALUES (
        v_notif_id,
        'Nuevo Pedido: ' || NEW.id,
        'El cliente ' || COALESCE(NEW.cliente_nombre, 'N/A') || ' ha realizado una compra por $' || COALESCE(NEW.total_usd::text, '0'),
        to_char(NOW(), 'DD/MM/YYYY HH24:MI'),
        'admin',
        COALESCE(v_admin_phone, ''),
        FALSE
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Fallo en trigger handle_new_order_actions: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_new_order_actions ON public.orders;
CREATE TRIGGER trigger_new_order_actions
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_order_actions();

-- ----------------------------------------------------------------------------
-- 3. TRIGGER: Cambios de estado + reversar puntos al cancelar
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_order_status_push_update()
RETURNS TRIGGER
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_reversed_points int;
    v_client_uid text;
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status = 'Cancelado' THEN
        v_client_uid := COALESCE(NEW.cliente_uid, '');
        IF v_client_uid != '' THEN
            SELECT COALESCE(SUM(points), 0) INTO v_reversed_points
            FROM loyalty_transactions
            WHERE user_id = v_client_uid AND order_id = NEW.id AND type = 'earn';

            IF v_reversed_points > 0 THEN
                INSERT INTO loyalty_transactions (user_id, type, points, description, order_id)
                VALUES (v_client_uid, 'redeem', -v_reversed_points, 'Reversal por cancelación pedido ' || NEW.id, NEW.id)
                ON CONFLICT DO NOTHING;

                UPDATE usuarios_clientes
                SET loyalty_points = GREATEST(0, loyalty_points - v_reversed_points)
                WHERE id = v_client_uid;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_order_status_update ON public.orders;
CREATE TRIGGER trigger_order_status_update
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_status_push_update();

-- ----------------------------------------------------------------------------
-- 4. REALTIME para orders
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 5. POLÍTICAS RLS
-- ----------------------------------------------------------------------------
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_insert_allow_anon" ON orders;
CREATE POLICY "orders_insert_allow_anon" ON orders FOR INSERT WITH CHECK (
    cliente_nombre IS NOT NULL AND cliente_nombre != ''
    AND cliente_telefono IS NOT NULL AND cliente_telefono != ''
    AND total_usd > 0
);

DROP POLICY IF EXISTS "orders_select_own_or_admin" ON orders;
CREATE POLICY "orders_select_own_or_admin" ON orders
    FOR SELECT USING (
        auth.uid()::text = cliente_uid
        OR (cliente_uid IS NOT NULL AND cliente_uid LIKE 'guest-%')
        OR public.is_admin_or_operator()
    );

DROP POLICY IF EXISTS "orders_update_admin" ON orders;
CREATE POLICY "orders_update_admin" ON orders
    FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

-- ----------------------------------------------------------------------------
-- 6. PERMISOS
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT ON orders TO anon;
