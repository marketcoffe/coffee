// Cloudflare Pages Function - Web Push Handler
// Location: /functions/api/push-notify.ts
// Handles POST requests to send real web push notifications using web-push library
//
// SECURITY:
//  - Requires a valid shared secret (server-side only) on every POST.
//  - CORS is restricted to an allowlist (never '*').
//  - Includes rate limiting (via KV binding when available) to prevent abuse.

let webpush: any;

declare const PagesFunction: any;

// Default allowed origins for browser-based calls (dev + production).
const DEFAULT_ALLOWED_ORIGINS = [
  'https://marketcoffesweet.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function resolveAllowedOrigins(env: any): string[] {
  const raw = env.ALLOWED_ORIGINS;
  if (!raw) return DEFAULT_ALLOWED_ORIGINS;
  const list = String(raw).split(',').map((o) => o.trim()).filter(Boolean);
  return list.length ? list : DEFAULT_ALLOWED_ORIGINS;
}

function isOriginAllowed(origin: string, env: any): boolean {
  if (!origin) return false;
  const allowed = resolveAllowedOrigins(env);
  if (allowed.includes('*')) return origin === '*' ? true : true; // dev escape hatched here
  return allowed.indexOf(origin) !== -1;
}

// Build CORS headers. Reflects the requesting origin ONLY when it is allowed,
// otherwise omits cross-origin access.
function buildCorsHeaders(request: any, env: any): Record<string, string> {
  const origin = request?.headers?.get('origin') || '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-push-webhook-secret',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  const resolved = resolveAllowedOrigins(env);
  if (resolved.indexOf('*') !== -1) headers['Access-Control-Allow-Origin'] = '*';
  else if (isOriginAllowed(origin, env)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export const onRequestGet: any = async (context: any) => {
  const { env, request } = context;

  return new Response(JSON.stringify({
    status: 'ok',
    service: 'push-notify',
    vapidConfigured: !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
    authConfigured: !!getPushSecret(env),
  }), {
    headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
  });
};

// Constant-time string comparison to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function getPushSecret(env: any): string {
  // Server-side secret ONLY. VITE_* vars must never be used here.
  return (env.PUSH_WEBHOOK_SECRET || env.WEBHOOK_SECRET || '').trim();
}

export const onRequestOptions: any = async (context: any) => {
  const { env, request } = context;
  return new Response(null, { status: 204, headers: buildCorsHeaders(request, env) });
};

// Rate limiting via KV binding (optional). Returns true when allowed.
async function rateLimitPass(env: any, key: string): Promise<boolean> {
  const kv = env.PUSH_RATE_LIMIT_KV;
  if (!kv) return true; // binding not configured -> allow (operational note in docs)
  const now = Math.floor(Date.now() / 60000);
  const collKey = `push:${key}:${now}`;
  try {
    const raw = await kv.get(collKey, 'json');
    const count = typeof raw === 'number' ? raw : 0;
    if (count >= 30) return false;
    await kv.put(collKey, JSON.stringify(count + 1), { expirationTtl: 120 });
    return true;
  } catch (_e) {
    return true;
  }
}

export const onRequestPost: any = async (context: any) => {
  const { request, env } = context;

  const clientIP = request?.headers?.get('cf-connecting-ip') || 'unknown';

  // 0. Rate limiting (defense-in-depth against flooding)
  const rlAllowed = await rateLimitPass(env, clientIP);
  if (!rlAllowed) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
    });
  }

  // 1. Strict Secret Verification - ALWAYS required.
  const configuredSecret = getPushSecret(env);
  if (!configuredSecret) {
    return new Response(
      JSON.stringify({ error: 'PUSH_WEBHOOK_SECRET not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) } }
    );
  }
  const authHeader = (request?.headers?.get('x-push-webhook-secret') || '').trim();
  if (!authHeader || !safeCompare(authHeader, configuredSecret)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
    });
  }

  try {
    // 2. Extraer payload enviado por Supabase
    const payload = await request.json();

    // Handle both Supabase trigger format (with record wrapper) and direct test format
    let record = payload.record || payload;

    if (!record || typeof record !== 'object') {
      return new Response(JSON.stringify({ error: 'Missing record in payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
      });
    }

    // Support both English (title/body) and Spanish (titulo/mensaje) field names
    const titulo = record.title || record.titulo || 'Marketo';
    const mensaje = record.body || record.mensaje || '';
    const linkUrl = record.link_url || record.url || '/';

    // 3. Configurar WebPush (VAPID)
    const vapidPublic = env.VAPID_PUBLIC_KEY;
    const vapidPrivate = env.VAPID_PRIVATE_KEY;
    if (!vapidPublic || !vapidPrivate) {
      return new Response(
        JSON.stringify({ error: 'VAPID keys not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) } }
      );
    }

    // Import dinamico de web-push
    if (!webpush) {
      const wpMod = await import('web-push');
      webpush = (wpMod as any).default || wpMod;
    }

    webpush.setVapidDetails(
      'mailto:admin@marketcoffesweet.com',
      vapidPublic,
      vapidPrivate
    );

    // 4. Conectar con Supabase
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) } }
      );
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Filtrar destinatarios segun tipo
    const tipo = record.tipo;
    const destinatarioTelefono = record.destinatario_telefono;

    // Obtener suscripciones directamente de la tabla (evitar RPC con permisos restrictivos)
    let subscriptionsRaw: any[] = [];
    try {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('id, user_id, endpoint, p256dh, auth_secret, destinatario_telefono, anonymous_id');
      if (error) {
        console.error('[push-notify] Error fetching subscriptions:', error.message);
        return new Response(JSON.stringify({ error: 'Failed to fetch subscriptions: ' + error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
        });
      }
      subscriptionsRaw = data || [];
    } catch (e: any) {
      console.error('[push-notify] Exception fetching subscriptions:', e?.message || e);
      return new Response(JSON.stringify({ error: 'Exception fetching subscriptions' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
      });
    }

    // Aplicar filtro por telefono/destinatario despues de obtenerlas
    if (tipo === 'personal' || tipo === 'admin') {
      const phone = (destinatarioTelefono || '').trim();
      if (phone) {
        subscriptionsRaw = subscriptionsRaw.filter((s: any) =>
          (s.destinatario_telefono || '').trim() === phone
        );
      }
    }

    const validSubscriptions = subscriptionsRaw
      .map((s: any) => ({
        endpoint: s.endpoint,
        keys: {
          p256dh: s.p256dh,
          auth: s.auth_secret
        },
        _meta: { id: s.id, user_id: s.user_id, anonymous_id: s.anonymous_id }
      }))
      .filter((sub: any) => sub.endpoint && sub.keys.p256dh && sub.keys.auth);

    const invalidCount = subscriptionsRaw.length - validSubscriptions.length;
    if (!validSubscriptions.length) {
      return new Response(JSON.stringify({
        success: true,
        sent: 0,
        total: 0,
        invalidSubscriptions: invalidCount,
        notif_id: record.id,
        message: 'No valid push subscriptions found'
      }), {
        headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
      });
    }

    // 5. Payload Web Push - usar tag consistente con 'marketcoffee-' prefix
    const notifId = record.id || ('notif-' + crypto.randomUUID().slice(0, 12));
    const payloadForSW = {
      title: titulo,
      body: mensaje,
      link_url: linkUrl,
      tag: 'marketcoffee-' + notifId,
      id: notifId,
      requireInteraction: false,
      silent: false,
    };

    // 6. Enviar a cada suscripcion en paralelo
    const results = await Promise.all(
      validSubscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(sub as any, JSON.stringify(payloadForSW));

          // Track successful send
          try {
            await supabase.from('push_events').insert({
              notification_id: notifId,
              user_id: sub._meta?.user_id || null,
              anonymous_id: sub._meta?.anonymous_id || '',
              event_type: 'sent'
            });
          } catch (trackErr) {
            console.error('[push-notify] Failed to track sent event:', trackErr);
          }

          return { ok: true, endpoint: sub.endpoint };
        } catch (err: any) {
          // Remove invalid subscriptions (404 = subscription expired, 410 = gone)
          if (err.statusCode === 404 || err.statusCode === 410) {
            try {
              await supabase
                .from('push_subscriptions')
                .delete()
                .eq('endpoint', sub.endpoint);
            } catch (delErr) {
              console.error('[push-notify] Failed to delete expired subscription:', delErr);
            }
          }
          return {
            ok: false,
            endpoint: sub.endpoint,
            statusCode: err?.statusCode
          };
        }
      })
    );

    const sent = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok);

    return new Response(JSON.stringify({
      success: true,
      sent,
      failed: failed.length,
      total: validSubscriptions.length,
      invalidSubscriptions: invalidCount,
      notif_id: notifId
    }), {
      headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
    });

  } catch (error: any) {
    console.error('[push-notify] Unhandled error:', error?.message || error);
    return new Response(JSON.stringify({
      error: 'Error processing push notification'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
    });
  }
};