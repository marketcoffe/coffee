-- ================================================================
-- PASO 1: EJECUTAR SOLO ESTE SCRIPT PRIMERO
-- Esto elimina TODAS las sobrecargas duplicadas
-- ================================================================
DO $$
DECLARE
  r RECORD;
  n INTEGER := 0;
BEGIN
  FOR r IN
    SELECT oidvectortypes(proargtypes) AS args
    FROM pg_proc
    WHERE proname = 'crear_pedido_mesa'
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION public.crear_pedido_mesa(' || r.args || ') CASCADE';
    n := n + 1;
    RAISE NOTICE 'Dropped: crear_pedido_mesa(%)', r.args;
  END LOOP;
  RAISE NOTICE 'Total dropped: %', n;
END $$;

-- ================================================================
-- PASO 2: Verificar que no quede ninguna
-- ================================================================
SELECT proname, pg_get_function_arguments(oid) AS args, pg_get_function_result(oid) AS ret
FROM pg_proc
WHERE proname = 'crear_pedido_mesa'
  AND pronamespace = 'public'::regnamespace;

-- Debe retornar 0 filas. Si retorna filas, hay un problema.
