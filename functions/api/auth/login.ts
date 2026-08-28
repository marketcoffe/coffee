// Cloudflare Pages Function - Secure Client Login
// Location: /functions/api/auth/login.ts
// Handles POST requests for client authentication with rate limiting and Supabase RPC

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

async function rateLimitPass(env: any, key: string, limit: number, windowMs: number): Promise<boolean> {
  const kv = env.AUTH_RATE_LIMIT_KV;
  if (!kv) return true;
  const now = Math.floor(Date.now() / windowMs);
  const collKey = `auth:login:${key}:${now}`;
  try {
    const raw = await kv.get(collKey, 'json');
    const count = typeof raw === 'number' ? raw : 0;
    if (count >= limit) return false;
    await kv.put(collKey, JSON.stringify(count + 1), { expirationTtl: Math.ceil(windowMs / 1000) + 60 });
    return true;
  } catch (_e) {
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
  const userAgent = request?.headers?.get('user-agent') || 'unknown';

  // Rate limiting por IP (20 req/15min)
  const rlAllowed = await rateLimitPass(env, clientIP, 20, 15 * 60 * 1000);
  if (!rlAllowed) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Demasiados intentos desde esta IP. Intente de nuevo en 15 minutos.',
      locked: true,
      retry_after_seconds: 900
    }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
    });
  }

  try {
    const payload = await request.json();
    const { identifier, password } = payload;

    if (!identifier || !password) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Email/usuario y contraseña son requeridos.',
        locked: false
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

    // Llamar RPC seguro que valida credenciales, rate limiting, lockout y auditoría
    const { data: rpcResult, error: rpcError } = await supabase.rpc('login_seguro_cliente', {
      p_identifier: identifier.trim(),
      p_password: password.trim(),
      p_ip_address: clientIP !== 'unknown' ? clientIP : null,
      p_user_agent: userAgent,
    });

    if (rpcError) {
      console.error('[Auth Login] RPC error:', rpcError.message);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Error de autenticación. Intente de nuevo.',
        locked: false
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
      });
    }

    const result = rpcResult as {
      success: boolean;
      user_id?: string;
      email?: string;
      username?: string;
      nombre?: string;
      telefono?: string;
      locked?: boolean;
      locked_until?: string;
      attempts_remaining?: number;
      error?: string;
    };

    if (!result.success) {
      const status = result.locked ? 423 : 401;
      const retryAfter = result.locked_until 
        ? Math.max(0, Math.ceil((new Date(result.locked_until).getTime() - Date.now()) / 1000))
        : 0;
      
      return new Response(JSON.stringify({
        success: false,
        error: result.error || 'Credenciales incorrectas.',
        locked: result.locked || false,
        locked_until: result.locked_until || null,
        attempts_remaining: result.attempts_remaining || 0,
        retry_after_seconds: retryAfter
      }), {
        status,
        headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
      });
    }

    // Login exitoso - crear sesión en Supabase Auth para el cliente usando admin API
    const { data: authData, error: authError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: result.email!,
      options: {
        redirectTo: `${new URL(request.url).origin}/profile`
      }
    });

    let sessionToken = null;
    if (!authError && authData?.properties?.action_link) {
      // Extraer token del action_link si está disponible
      const url = new URL(authData.properties.action_link);
      sessionToken = url.searchParams.get('token');
    }

    return new Response(JSON.stringify({
      success: true,
      user: {
        id: result.user_id,
        email: result.email,
        username: result.username,
        nombre: result.nombre,
        telefono: result.telefono
      },
      session_token: sessionToken,
      attempts_remaining: result.attempts_remaining
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
    });

  } catch (error: any) {
    console.error('[Auth Login] Exception:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor.',
      locked: false
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
    });
  }
};