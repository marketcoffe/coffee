import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hfcbkhsbyegwleltlzis.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmY2JraHNieWVnd2xlbHRsemlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzM1NTEwMywiZXhwIjoyMTAyOTMxMTAzfQ.BRqw0PJLUasu239B4T21oekywYBLN-ShUWKKf5_ZNnA';

const s = createClient(SUPABASE_URL, SERVICE_KEY);
const { data: config } = await s.rpc('get_push_config');

const resp = await fetch(config.webhook_url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-push-webhook-secret': config.webhook_secret,
  },
  body: JSON.stringify({
    title: 'Test Web Crypto',
    body: 'Push notification using Web Crypto API!',
    icon: '/icon.png',
    tag: 'marketcoffee-test-crypto',
    url: '/',
    record: {
      id: 'test-crypto-' + Date.now(),
      title: 'Test Web Crypto',
      body: 'Push notification using Web Crypto API!',
      titulo: 'Test Web Crypto',
      mensaje: 'Push notification using Web Crypto API!',
      icon: '/icon.png',
      tag: 'marketcoffee-test-crypto',
      renotify: true,
      imagen_url: '',
      link_url: '/',
      tipo: 'todos',
      destinatario_telefono: '',
    }
  }),
});

const result = await resp.json();
console.log('\n=== PUSH RESULT ===');
console.log(JSON.stringify(result, null, 2));

if (result.failedDetails?.length) {
  console.log('\n=== FAILED DETAILS ===');
  for (const fd of result.failedDetails) {
    console.log(`  status=${fd.statusCode} error=${fd.error}`);
  }
}
