const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.hfcbkhsbyegwleltlzis:BRqw0PJLUasu239B4T21oekywYBLN-ShUWKKf5_ZNnA@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});
(async () => {
  await client.connect();
  const res = await client.query(`
    SELECT 
      p.oid,
      p.proname AS name,
      pg_catalog.pg_get_function_result(p.oid) AS return_type,
      pg_catalog.pg_get_function_arguments(p.oid) AS arguments,
      pg_get_userbyid(p.proowner) AS owner,
      p.prokind AS kind
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'crear_pedido_mesa'
      AND n.nspname = 'public'
    ORDER BY p.oid;
  `);
  console.log('=== Overloads of crear_pedido_mesa ===');
  res.rows.forEach((r, i) => {
    console.log(`\n--- Overload ${i+1} (oid: ${r.oid}) ---`);
    console.log(`  Arguments: ${r.arguments}`);
    console.log(`  Returns:   ${r.return_type}`);
    console.log(`  Kind:      ${r.kind}`);
    console.log(`  Owner:     ${r.owner}`);
  });
  console.log(`\nTotal overloads: ${res.rows.length}`);
  await client.end();
})().catch(e => { console.error(e.message); process.exit(1); });
