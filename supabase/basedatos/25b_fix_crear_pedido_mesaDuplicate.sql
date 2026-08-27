-- ============================================================================
-- FIX DEFINITIVO: crear_pedido_mesa "is not unique"
-- Ejecutar este script COMPLETO en el SQL Editor de Supabase
-- ============================================================================

-- PASO 1: Eliminar TODAS las sobrecargas usando un bloque dinamico
DO $$
DECLARE
  func_record RECORD;
  dropped INTEGER := 0;
BEGIN
  FOR func_record IN
    SELECT oidvectortypes(p.proargtypes) AS arg_types
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'crear_pedido_mesa'
      AND n.nspname = 'public'
  LOOP
    EXECUTE format(
      'DROP FUNCTION IF EXISTS public.crear_pedido_mesa(%s) CASCADE',
      func_record.arg_types
    );
    dropped := dropped + 1;
    RAISE NOTICE 'Eliminada sobrecarga: crear_pedido_mesa(%)', func_record.arg_types;
  END LOOP;
  RAISE NOTICE 'Total eliminadas: %', dropped;
END $$;

-- PASO 2: Recrear la funcion correcta (la que usa el frontend en MesaCheckout.tsx)
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
    IF NOT public.is_mesa_valida(p_numero_mesa) THEN
        RAISE EXCEPTION 'La mesa % no es valida o esta inactiva.', p_numero_mesa;
    END IF;

    v_order_id := 'ORD-' || lpad(floor(random() * 90000 + 10000)::text, 6, '0');
    v_ticket_code := public.generate_ticket_code(p_numero_mesa);

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

-- PASO 3: Otorgar permisos
GRANT EXECUTE ON FUNCTION public.crear_pedido_mesa(
    TEXT, INTEGER, JSONB, NUMERIC, NUMERIC, NUMERIC,
    TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT
) TO anon;

-- PASO 4: Verificacion final
SELECT
  p.proname AS funcion,
  pg_catalog.pg_get_function_arguments(p.oid) AS argumentos,
  pg_catalog.pg_get_function_result(p.oid) AS retorna
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'crear_pedido_mesa'
  AND n.nspname = 'public';
