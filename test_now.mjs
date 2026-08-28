import { createClient } from '@supabase/supabase-js';

const s = createClient('https://hfcbkhsbyegwleltlzis.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmY2JraHNieWVnd2xlbHRsemlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzM1NTEwMywiZXhwIjoyMTAyOTMxMTAzfQ.BRqw0PJLUasu239B4T21oekywYBLN-ShUWKKf5_ZNnA');

console.log('=== 1. pg_net ===');
const { data: ext } = await s.from('pg_extension').select('extname').eq('extname', 'pg_net').maybeSingle();
console.log(ext ? 'INSTALLED ✓' : 'NOT INSTALLED ✗');

console.log('\n=== 2. Push test ===');
const before = (await s.from('push_events').select('*', { count: 'exact', head: true })).count || 0;
console.log('push_events before:', before);

const testId = 'test-' + Date.now();
await s.from('notifications').insert({
  id: testId, titulo: '[TEST] Push', mensaje: 'Verificacion push',
  fecha: new Date().toISOString(), tipo: 'todos', destinatario_telefono: '',
  leida: false, imagen_url: '', link_url: '/', created_at: new Date().toISOString()
});

console.log('Waiting 10s...');
await new Promise(r => setTimeout(r, 10000));

const after = (await s.from('push_events').select('*', { count: 'exact', head: true })).count || 0;
console.log('push_events after:', after);
await s.from('notifications').delete().eq('id', testId);

console.log(after > before ? '\n✅ PUSH FUNCIONA!' : '\n⚠️ Sin eventos push (subscriptions fake o pg_net no activo)');
