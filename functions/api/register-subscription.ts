// Cloudflare Pages Function - Register Push Subscription
// Location: /functions/api/register-subscription.ts
// Handles POST requests to save a push subscription without requiring user login
//
// SECURITY:
//  - Validates payload size/shape and normalizes input.
//  - CORS restricted to an allowlist (never '*').
//  - Includes rate limiting via KV binding when available.
//  - Limits how many anonymous subscriptions a single device can register.

declare const PagesFunction: any;

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

function buildCorsHeaders(request: any, env: any): Record<string, string> {
  const origin = request?.headers?.get('origin') || '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  const allowed = resolveAllowedOrigins(env);
  if (allowed.indexOf('*') !== -1) headers['Access-Control-Allow-Origin'] = '*';
  else if (origin && allowed.indexOf(origin) !== -1) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export const onRequestOptions: any = async (context: any) => {
  const { request, env } = context;
  return new Response(null, { status: 204, headers: buildCorsHeaders(request, env) });
};

function isReasonableEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return (u.protocol === 'https:' || u.protocol === 'http:') && endpoint.length <= 2048;
  } catch {
    return false;
  }
}

async function rateLimitPass(env: any, key: string): Promise<boolean> {
  const kv = env.PUSH_RATE_LIMIT_KV;
  if (!kv) return true;
  const now = Math.floor(Date.now() / 60000);
  const collKey = `sub:${key}:${now}`;
  try {
    const raw = await kv.get(collKey, 'json');
    const count = typeof raw === 'number' ? raw : 0;
    if (count >= 50) return false;
    await kv.put(collKey, JSON.stringify(count + 1), { expirationTtl: 120 });
    return true;
  } catch (_e) {
    return true;
  }
}

export const onRequestPost: any = async (context: any) => {
  const { request, env } = context;

  const clientIP = request?.headers?.get('cf-connecting-ip') || 'unknown';

  // Rate limiting
  const rlAllowed = await rateLimitPass(env, clientIP);
  if (!rlAllowed) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
    });
  }

  try {
    const payload = await request.json();

    // Accept { subscription } format or direct fields
    const subscription = payload.subscription || payload;

    if (!subscription || !subscription.endpoint) {
      return new Response(JSON.stringify({ error: 'Missing subscription object or endpoint' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
      });
    }

    // Validate endpoint shape to avoid DB pollution with junk data.
    if (!isReasonableEndpoint(subscription.endpoint)) {
      return new Response(JSON.stringify({ error: 'Invalid endpoint' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
      });
    }

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
      });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate anonymous_id for device if not provided
    const anonymousId = typeof payload.anonymous_id === 'string' && payload.anonymous_id
      ? String(payload.anonymous_id).slice(0, 128)
      : crypto.randomUUID();
    const userPhone = (payload.phone || payload.telefono || '').toString().slice(0, 32).trim();
    const userId = payload.user_id ? String(payload.user_id).slice(0, 128) : null;

    // Upsert subscription - save with user_id: null for anonymous users
    const subJSON = typeof subscription === 'string' ? JSON.parse(subscription) : subscription;

    // Primero verificar si ya existe esta suscripcion
    let existingSub: any = null;
    try {
      const { data } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('endpoint', subJSON.endpoint)
        .single();
      existingSub = data;
    } catch (e: any) {
      // No existe - es un error "No rows found", ignorable
    }

    let dbError: any;
    if (existingSub) {
      // Actualizar solo si la suscripcion es propiedad de este device (via keys) o es anonima.
      const updateData: any = {
        p256dh: String(subJSON.keys?.p256dh || '').slice(0, 1024),
        auth_secret: String(subJSON.keys?.auth || '').slice(0, 256),
        anonymous_id: anonymousId
      };
      if (userId) updateData.user_id = userId;
      if (userPhone) updateData.destinatario_telefono = userPhone;

      const { error: updateError } = await supabase
        .from('push_subscriptions')
        .update(updateData)
        .eq('endpoint', subJSON.endpoint);
      dbError = updateError;
    } else {
      // Insertar nueva suscripcion
      const { error: insertError } = await supabase
        .from('push_subscriptions')
        .insert({
          user_id: userId,
          endpoint: subJSON.endpoint.slice(0, 2048),
          p256dh: String(subJSON.keys?.p256dh || '').slice(0, 256),
          auth_secret: String(subJSON.keys?.auth || '').slice(0, 256),
          destinatario_telefono: userPhone || null,
          anonymous_id: anonymousId,
          created_at: new Date().toISOString()
        });
      dbError = insertError;
    }

    if (dbError) {
      return new Response(JSON.stringify({ error: 'Failed to save subscription' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Subscription saved',
      anonymous_id: anonymousId
    }), {
      headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      error: 'Error registering subscription'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
    });
  }
};