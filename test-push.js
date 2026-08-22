/**
 * Marketo Push Notification Webhook Tester
 * Uso: node test-push.js
 */

import dotenv from 'dotenv';
import { resolve } from 'path';
import fs from 'fs';

// Cargamos el .env manualmente para diagnosticar errores
const envPath = resolve(process.cwd(), '.env');
const envExists = fs.existsSync(envPath);
const result = dotenv.config();

if (result.error) {
  console.warn('⚠️ Error al cargar .env:', result.error.message);
}

const ENDPOINT = process.env.VITE_PUSH_WEBHOOK_URL || 'https://marketcoffesweet.com/api/push-notify';
const SECRET = process.env.VITE_PUSH_WEBHOOK_SECRET || process.env.PUSH_WEBHOOK_SECRET || process.env.AUTH_SECRET;

async function triggerTestPush() {
  console.log(`\n🔍 --- DIAGNÓSTICO ---`);
  console.log(`📂 Directorio actual: ${process.cwd()}`);
  console.log(`📄 Ruta al .env: ${envPath}`);
  console.log(`❓ ¿El archivo existe?: ${envExists ? 'SÍ ✅' : 'NO ❌'}`);

  if (envExists) {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n').map(l => l.trim());
    const foundLine = lines.find(l => l.includes('PUSH_WEBHOOK_SECRET') || l.includes('AUTH_SECRET'));
    console.log(`📝 Línea encontrada en archivo: ${foundLine ? 'SÍ (Presente) ✅' : 'NO (Faltante) ❌'}`);
  }
  
  // Listar variables relacionadas para ver qué inyectó dotenv/dotenvx
  const envKeys = Object.keys(process.env).filter(k => k.includes('PUSH') || k.includes('AUTH') || k.includes('VITE_SUPABASE'));
  console.log(`🔑 Variables en memoria: ${envKeys.length > 0 ? envKeys.join(', ') : 'NINGUNA ❌'}`);
  const cleanSecret = SECRET ? SECRET.trim() : '';
  console.log(`📡 Secreto cargado: ${cleanSecret ? `SÍ (${cleanSecret.length} caracteres) ✅` : 'NO ❌'}`);
  
  if (!SECRET) {
    console.error('\n❌ ERROR: No se encontró el secreto del Webhook en el archivo .env');
    console.log('Asegúrate de que tu archivo .env contenga una de estas líneas:');
    console.log('PUSH_WEBHOOK_SECRET=tu_secreto_aqui');
    console.log('o VITE_PUSH_WEBHOOK_SECRET=tu_secreto_aqui');
    return;
  }

  console.log('🚀 Iniciando prueba de Webhook...');
  console.log(`📍 Endpoint: ${ENDPOINT}`);

  const payload = {
    type: 'INSERT',
    table: 'notifications',
    record: {
      id: `test-${Date.now()}`,
      titulo: '🔥 Prueba desde Node.js',
      mensaje: 'Si recibes esto, el secreto y el endpoint están sincronizados correctamente.',
      tipo: 'admin',
      link_url: '/admin',
      fecha: new Date().toLocaleString('es-VE')
    }
  };

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-push-webhook-secret': cleanSecret
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    
    console.log(`\n📊 Status: ${response.status} ${response.statusText}`);
    console.log(`📩 Respuesta del servidor: ${responseText}`);

    if (response.status === 401) {
      console.error('\n❌ ERROR 401: Acceso denegado.');
      console.error('REVISIÓN: El secreto enviado no coincide con el definido en las variables de entorno de tu Cloudflare Worker (AUTH_SECRET).');
    } else if (response.ok) {
      console.log('\n✅ ¡Petición enviada con éxito!');
    }
  } catch (error) {
    console.error('\n💥 Error de conexión:', error.message);
  }
}

triggerTestPush();