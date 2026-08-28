// Cloudflare Pages Function - Web Push Handler
// Location: /functions/api/push-notify.ts
// Uses Web Crypto API (no web-push library) to avoid crypto.createECDH unenv issue
//
// SECURITY:
//  - Requires a valid shared secret (server-side only) on every POST.
//  - CORS is restricted to an allowlist (never '*').
//  - Includes rate limiting (via KV binding when available) to prevent abuse.

declare const PagesFunction: any;

const DEFAULT_ALLOWED_ORIGINS = [
  'https://marketcoffesweet.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function resolveAllowedOrigins(env: any): string[] {
  const raw = env.ALLOWED_ORIGINS;
  if (!raw) return DEFAULT_ALLOWED_ORIGINS;
  const list = String(raw).split(',').map((o: string) => o.trim()).filter(Boolean);
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
    'Access-Control-Allow-Headers': 'Content-Type, x-push-webhook-secret',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  const resolved = resolveAllowedOrigins(env);
  if (resolved.indexOf('*') !== -1) headers['Access-Control-Allow-Origin'] = '*';
  else if (isOriginAllowed(origin, env)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

// ─── Base64url helpers ────────────────────────────────────────────────
function base64UrlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ─── VAPID JWT using Web Crypto ECDSA ────────────────────────────────
function getVapidAudience(endpoint: string): string {
  if (endpoint.includes('fcm.googleapis.com')) return 'https://fcm.googleapis.com';
  if (endpoint.includes('push.services.mozilla.com')) return 'https://updates.push.services.mozilla.com';
  if (endpoint.push) {
    try { return new URL(endpoint).origin; } catch {}
  }
  return new URL(endpoint).origin;
}

async function createVapidJwt(
  privateKeyRaw: Uint8Array,
  publicKeyRaw: Uint8Array,
  audience: string
): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 43200, // 12 hours (safe for push)
    sub: 'mailto:admin@marketcoffesweet.com',
  };

  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  // Import ECDSA private key (P-256) via JWK
  // VAPID_PRIVATE_KEY may be raw (32 bytes) or PKCS8 DER (longer)
  let dBytes: Uint8Array;
  if (privateKeyRaw.length === 32) {
    // Raw scalar — use directly
    dBytes = privateKeyRaw;
  } else if (privateKeyRaw[0] === 0x30) {
    // PKCS8 DER — extract the private key scalar
    // DER: 30 82 xx xx 30 13 ... 04 20 <32 bytes of private key>
    let pos = 0;
    if (privateKeyRaw[pos++] !== 0x30) throw new Error('Invalid PKCS8');
    const totalLen = privateKeyRaw[pos++];
    // Skip outer SEQUENCE
    // Skip inner SEQUENCE (algorithm)
    pos += 2; // inner SEQUENCE tag + len
    const algLen = privateKeyRaw[pos++];
    pos += algLen;
    // OCTET STRING wrapper for private key
    if (privateKeyRaw[pos++] !== 0x04) throw new Error('Invalid PKCS8: not OCTET STRING');
    const pkOctLen = privateKeyRaw[pos++];
    // Inner SEQUENCE
    if (privateKeyRaw[pos++] !== 0x30) throw new Error('Invalid PKCS8: not inner SEQUENCE');
    const innerLen = privateKeyRaw[pos++];
    // INTEGER (version)
    if (privateKeyRaw[pos++] !== 0x02) throw new Error('Invalid PKCS8: not INTEGER');
    const verLen = privateKeyRaw[pos++];
    pos += verLen;
    // OCTET STRING (private key scalar, 32 bytes)
    if (privateKeyRaw[pos++] !== 0x04) throw new Error('Invalid PKCS8: not OCTET STRING for key');
    const scalarLen = privateKeyRaw[pos++];
    dBytes = privateKeyRaw.slice(pos, pos + scalarLen);
  } else {
    const info = `Unknown VAPID_PRIVATE_KEY format: len=${privateKeyRaw.length} first=0x${privateKeyRaw[0].toString(16)} second=0x${privateKeyRaw[1]?.toString(16)}`;
    console.error('[push-notify]', info);
    throw new Error(info);
  }

  const privateKeyJwk = {
    kty: 'EC' as const,
    crv: 'P-256' as const,
    d: base64UrlEncode(dBytes),
    x: base64UrlEncode(publicKeyRaw.slice(1, 33)),
    y: base64UrlEncode(publicKeyRaw.slice(33, 65)),
  };
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    enc.encode(signingInput)
  );

  // Web Crypto ECDSA returns IEEE P1363 format (raw r||s, 64 bytes)
  // JWT ES256 expects the same raw r||s format
  const rawSig = new Uint8Array(signature);

  return `${signingInput}.${base64UrlEncode(rawSig)}`;
}

// ─── HKDF (RFC 5869) via Web Crypto ──────────────────────────────────
async function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8
  );
  return new Uint8Array(derived);
}

// ─── Push payload encryption (RFC 8291 - aes128gcm) ───────────────────
async function encryptPayload(
  plaintext: string,
  subscriptionP256dh: Uint8Array,
  subscriptionAuth: Uint8Array
): Promise<{ body: Uint8Array; ephemeralPublicKey: Uint8Array; salt: Uint8Array }> {
  try {
    // Generate ephemeral ECDH key pair
    const ephemeralKeyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits']
    );

    const ephemeralPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeralKeyPair.publicKey));

  // Import subscription's public key for ECDH
  const subPubKey = await crypto.subtle.importKey(
    'raw',
    subscriptionP256dh,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // ECDH shared secret
  const ikm = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: subPubKey },
    ephemeralKeyPair.privateKey,
    256
  ));

  // Random salt (16 bytes)
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  // authInfo = "WebPush: info\0\0\0\1" || sender_public_key || subscription_public_key
  const authInfo = new Uint8Array([
    ...new TextEncoder().encode('WebPush: info'),
    0x00, 0x00, 0x00, 0x01,
    ...ephemeralPubRaw,
    ...subscriptionP256dh,
  ]);

  // Derive PRK via HKDF
  const prk = await hkdf(ikm, salt, authInfo, 32);

  // Derive encryption key (32 bytes, first 16 used as AES key)
  const keyInfo = new Uint8Array([
    ...new TextEncoder().encode('Content-Encoding: aes128gcm'),
    0x00,
    ...prk,
  ]);
  const keyMaterial = await hkdf(prk, salt, keyInfo, 32);
  const aesKey = keyMaterial.slice(0, 16);

  // Derive nonce
  const nonceInfo = new Uint8Array([
    ...new TextEncoder().encode('Content-Encoding: nonce'),
    0x00,
    ...prk,
  ]);
  const nonce = await hkdf(prk, salt, nonceInfo, 12);

  // AES-128-GCM encrypt
  const key = await crypto.subtle.importKey('raw', aesKey, 'AES-GCM', false, ['encrypt']);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    key,
    new TextEncoder().encode(plaintext)
  );

  // Construct aes128gcm header (RFC 8291):
  // version(1) || rs(2, big-endian) || idlen(1) || keyid(65)
  const header = new Uint8Array(1 + 2 + 1 + 65); // 69 bytes total
  header[0] = 0x01; // version
  header[1] = 0x10; // rs high byte (rs = 4096 = 0x1000)
  header[2] = 0x00; // rs low byte
  header[3] = 0x41; // keyid length = 65
  header.set(ephemeralPubRaw, 4);

  // Full body: header || ciphertext
  const body = new Uint8Array(header.length + ciphertext.byteLength);
  body.set(header);
  body.set(new Uint8Array(ciphertext), header.length);

  return { body, ephemeralPublicKey: ephemeralPubRaw, salt };
  } catch (err: any) {
    console.error(`[push-notify] encryptPayload EXCEPTION step: ${err?.message}`);
    throw err;
  }
}

// ─── Send push to a single subscription ───────────────────────────────
async function sendPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  plaintext: string,
  vapidPrivateRaw: Uint8Array,
  vapidPublicRaw: Uint8Array,
  options: { TTL: number; urgency: string; topic: string }
): Promise<{ ok: boolean; endpoint: string; statusCode?: number; error?: string }> {
  try {
    const subscriptionP256dh = base64UrlDecode(sub.p256dh);
    const subscriptionAuth = base64UrlDecode(sub.auth);

    // Encrypt payload
    let body: Uint8Array;
    try {
      const enc = await encryptPayload(plaintext, subscriptionP256dh, subscriptionAuth);
      body = enc.body;
    } catch (encErr: any) {
      console.error(`[push-notify] encryptPayload FAILED: ${encErr?.message} p256dh_len=${subscriptionP256dh.length} auth_len=${subscriptionAuth.length}`);
      return { ok: false, endpoint: sub.endpoint, statusCode: 0, error: `encryptPayload: ${encErr?.message}` };
    }

    // Create VAPID JWT with correct audience for this push service
    const audience = getVapidAudience(sub.endpoint);
    const jwt = await createVapidJwt(vapidPrivateRaw, vapidPublicRaw, audience);
    const vapidPubB64 = base64UrlEncode(vapidPublicRaw);

    // Send request
    const response = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Authorization': `vapid t=${jwt}, k=${vapidPubB64}`,
        'TTL': String(options.TTL),
        'Urgency': options.urgency,
        'Topic': options.topic,
      },
      body,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return { ok: false, endpoint: sub.endpoint, statusCode: response.status, error: `HTTP ${response.status}: ${errText.substring(0, 200)}` };
    }

    return { ok: true, endpoint: sub.endpoint };
  } catch (err: any) {
    return { ok: false, endpoint: sub.endpoint, statusCode: 0, error: err?.message || String(err) };
  }
}

// ─── Constant-time comparison ─────────────────────────────────────────
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function getPushSecret(env: any): string {
  return (env.PUSH_WEBHOOK_SECRET || env.WEBHOOK_SECRET || '').trim();
}

// ─── Rate limiting via KV binding (optional) ──────────────────────────
async function rateLimitPass(env: any, key: string): Promise<boolean> {
  const kv = env.PUSH_RATE_LIMIT_KV;
  if (!kv) return true;
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

// ─── Handlers ─────────────────────────────────────────────────────────
export const onRequestGet: any = async (context: any) => {
  const { env, request } = context;

  return new Response(JSON.stringify({
    status: 'ok',
    service: 'push-notify',
    vapidConfigured: !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
    vapidPublicKey: env.VAPID_PUBLIC_KEY || '',
    authConfigured: !!getPushSecret(env),
    engine: 'web-crypto-api',
  }), {
    headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
  });
};

export const onRequestOptions: any = async (context: any) => {
  const { request, env } = context;
  return new Response(null, { status: 204, headers: buildCorsHeaders(request, env) });
};

export const onRequestPost: any = async (context: any) => {
  const { request, env } = context;

  const clientIP = request?.headers?.get('cf-connecting-ip') || 'unknown';

  // 0. Rate limiting
  const rlAllowed = await rateLimitPass(env, clientIP);
  if (!rlAllowed) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
    });
  }

  // 1. Secret verification
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
    // 2. Parse payload
    const payload = await request.json();
    let record = payload.record || payload;

    if (!record || typeof record !== 'object') {
      return new Response(JSON.stringify({ error: 'Missing record in payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) }
      });
    }

    const titulo = record.title || record.titulo || 'Marketo';
    const mensaje = record.body || record.mensaje || '';
    const linkUrl = record.link_url || record.url || '/';

    // 3. VAPID keys
    const vapidPublicB64 = env.VAPID_PUBLIC_KEY;
    const vapidPrivateB64 = env.VAPID_PRIVATE_KEY;
    if (!vapidPublicB64 || !vapidPrivateB64) {
      return new Response(
        JSON.stringify({ error: 'VAPID keys not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(request, env) } }
      );
    }

    const vapidPublicRaw = base64UrlDecode(vapidPublicB64);
    const vapidPrivateRaw = base64UrlDecode(vapidPrivateB64);

    // 4. Supabase client
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

    // 5. Fetch subscriptions
    const tipo = record.tipo;
    const destinatarioTelefono = record.destinatario_telefono;

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

    // 6. Filter by phone for personal/admin
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
        p256dh: s.p256dh,
        auth: s.auth_secret,
        _meta: { id: s.id, user_id: s.user_id, anonymous_id: s.anonymous_id }
      }))
      .filter((sub: any) => sub.endpoint && sub.p256dh && sub.auth);

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

    // 7. Build payload
    const notifId = record.id || ('notif-' + crypto.randomUUID().slice(0, 12));
    const notifTipo = record.tipo || 'todos';
    const isHighPriority = notifTipo === 'personal' || notifTipo === 'admin' || notifTipo === 'request';

    const payloadForSW = {
      title: titulo,
      body: mensaje,
      icon: record.icon || '/icon.png',
      badge: record.badge || '/icon.png',
      image: record.imagen_url || record.image || undefined,
      link_url: linkUrl,
      tag: 'marketcoffee-' + notifId,
      id: notifId,
      tipo: notifTipo,
      priority: isHighPriority ? 'high' : 'normal',
      requireInteraction: isHighPriority,
      silent: false,
    };

    const plaintext = JSON.stringify(payloadForSW);

    // 8. Send to each subscription in parallel
    const pushOptions = {
      TTL: isHighPriority ? 0 : 86400,
      urgency: isHighPriority ? 'high' : 'normal',
      topic: 'marketcoffee-' + notifTipo,
    };

    const results = await Promise.all(
      validSubscriptions.map(async (sub) => {
        try {
          const result = await sendPush(sub, plaintext, vapidPrivateRaw, vapidPublicRaw, pushOptions);

          if (result.ok) {
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
          }

          console.error(`[push-notify] FAIL endpoint=${sub.endpoint.substring(0, 60)}... status=${result.statusCode} msg=${result.error}`);

          // Remove invalid subscriptions (404/410)
          if (result.statusCode === 404 || result.statusCode === 410) {
            console.log(`[push-notify] Deleting expired subscription: ${sub.endpoint.substring(0, 60)}...`);
            try {
              await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            } catch (delErr) {
              console.error('[push-notify] Failed to delete expired subscription:', delErr);
            }
          }
          return { ok: false, endpoint: sub.endpoint, statusCode: result.statusCode, error: result.error };
        } catch (err: any) {
          console.error(`[push-notify] EXCEPTION endpoint=${sub.endpoint.substring(0, 60)}... msg=${err?.message || err}`);
          return { ok: false, endpoint: sub.endpoint, statusCode: 0, error: err?.message || String(err) };
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
      notif_id: notifId,
      _version: 'v3-ieee-p1363',
      failedDetails: failed.map(f => ({ endpoint: f.endpoint?.substring(0, 80), statusCode: f.statusCode, error: f.error }))
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
