// Cloudflare Pages Function - Check Client Account Lockout Status
// Location: /functions/api/auth/check-lockout.ts

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

export const onRequestPost: any = async (context: any) => {
  const { request, env } = context;

  const clientIP = request?.headers?.get('cf-connecting-ip') || 'unknown';

  try {
    const payload = await request.json();
    const { identifier } = payload;

    if (!identifier) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Identificador requerido.' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
      });
    }

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Error de configuración del servidor.' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
      });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: rpcResult, error: rpcError } = await supabase.rpc('check_client_account_lockout', {
      p_identifier: identifier.trim(),
      p_ip_address: clientIP !== 'unknown' ? clientIP : null,
    });

    if (rpcError) {
      console.error('[Auth Check Lockout] RPC error:', rpcError.message);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Error al verificar estado.' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      ...rpcResult
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
    });

  } catch (error: any) {
    console.error('[Auth Check Lockout] Exception:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
    });
  }
};