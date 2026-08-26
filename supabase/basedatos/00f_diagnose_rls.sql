-- Step 1: Try INSERT as anon via SET ROLE
DO $$
BEGIN
  SET LOCAL ROLE anon;
  INSERT INTO orders (id, cliente_nombre, cliente_telefono, subtotal_usd, total_usd, total_bs, status, sede_id, items, fecha)
  VALUES ('TEST-ANON-DB', 'TestDB', '04120000000', 1, 1, 780, 'Pendiente', 'sede-1', '[]'::jsonb, NOW());
  RESET ROLE;
  RAISE NOTICE 'SUCCESS: anon INSERT worked';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RAISE NOTICE 'FAILED: %', SQLERRM;
END $$;

-- Step 2: Cleanup test
DELETE FROM orders WHERE id = 'TEST-ANON-DB';
