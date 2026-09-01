// Cloudflare Pages Function - Push Event Tracking
// Location: /functions/api/marketing/track-event.ts

declare const PagesFunction: any;

const DEFAULT_ALLOWED_ORIGINS = [
  'https://marketcoffesweet.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const VALID_EVENT_TYPES = ['sent', 'clicked', 'dismissed'];

function resolveAllowedOrigins(env: any): string[] {
  const raw = env.ALLOWED_ORIGINS;
  if (!raw) return DEFAULT_ALLOWED_ORIGINS;
  const list = String(raw).split(',').map((s: string) => s.trim()).filter(Boolean);
  return list.length ? list : DEFAULT_ALLOWED_ORIGINS;
}

function isOriginAllowed(origin: string, env: any): boolean {
  if (!origin) return false;
  const allowed = resolveAllowedOrigins(env);
  if (allowed.includes('*')) return true;
  return allowed.indexOf(origin) !== -1;
}

function buildCorsHeaders(request: any, env: any): Record<string, string> {
  const origin = request?.headers?.get('origin') || '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  const resolved = resolveAllowedOrigins(env);
  if (resolved.indexOf('*') !== -1) headers['Access-Control-Allow-Origin'] = '*';
  else if (isOriginAllowed(origin, env)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

async function rateLimitPass(env: any, key: string): Promise<boolean> {
  const kv = env.TRACK_RATE_LIMIT_KV;
  if (!kv) return true;
  const now = Math.floor(Date.now() / 60000);
  const collKey = `track:${key}:${now}`;
  try {
    const raw = await kv.get(collKey, 'json');
    const count = typeof raw === 'number' ? raw : 0;
    if (count >= 60) return false;
    await kv.put(collKey, JSON.stringify(count + 1), { expirationTtl: 120 });
    return true;
  } catch {
    return true;
  }
}

export const onRequestOptions: any = async (context: any) => {
  const { request, env } = context;
  return new Response(null, { status: 204, headers: buildCorsHeaders(request, env) });
};

export const onRequestPost: any = async (context: any) => {
  const { request, env } = context;

  const clientIP = request?.headers?.get('cf-connecting-ip') || 'unknown';
  const rlAllowed = await rateLimitPass(env, clientIP);
  if (!rlAllowed) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
    });
  }

  try {
    const payload = await request.json();
    const { notification_id, event_type, campaign_id, user_id, anonymous_id } = payload;

    if (!notification_id || !event_type) {
      return new Response(JSON.stringify({ error: 'Missing notification_id or event_type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
      });
    }

    if (VALID_EVENT_TYPES.indexOf(event_type) === -1) {
      return new Response(JSON.stringify({ error: 'Invalid event_type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
      });
    }

    if (String(notification_id).length > 128) {
      return new Response(JSON.stringify({ error: 'notification_id too long' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
      });
    }

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
      });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase.from('push_events').insert({
      notification_id,
      campaign_id: campaign_id || null,
      user_id: user_id || null,
      anonymous_id: anonymous_id || '',
      event_type,
      metadata: payload.metadata || {}
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
      });
    }

    if (event_type === 'clicked') {
      await supabase.rpc('increment_notification_click', { p_notif_id: notification_id });
      if (campaign_id) {
        const { data: campaign } = await supabase
          .from('campaigns').select('total_clicked').eq('id', campaign_id).single();
        if (campaign) {
          await supabase.from('campaigns').update({
            total_clicked: (campaign.total_clicked || 0) + 1
          }).eq('id', campaign_id);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
    });
  }
};
