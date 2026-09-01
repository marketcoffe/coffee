import { supabase } from '../store/supabaseClient';

/**
 * Trigger push notifications via the Cloudflare webhook.
 * Called after a notification is inserted into the notifications table.
 * Tries get_push_config() RPC first (admin/server-side secret).
 * Falls back to VITE_PUSH_WEBHOOK_URL for the URL only; secret stays server-side.
 */
export async function triggerBroadcastPush(params: {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: string;
  destinatario_telefono?: string;
  imagen_url?: string;
  link_url?: string;
}): Promise<boolean> {
  let webhookUrl = '';
  let webhookSecret = '';

  // 1. Try RPC first (preferred, secret stays server-side)
  try {
    const { data: config, error: configErr } = await supabase.rpc('get_push_config');
    if (configErr || !config) {
      console.warn('[Push] get_push_config RPC failed, falling back to env:', configErr?.message || 'no data');
    } else {
      webhookUrl = config.webhook_url || '';
      webhookSecret = config.webhook_secret || '';
    }
  } catch (e) {
    console.warn('[Push] get_push_config RPC exception, falling back to env:', e);
  }

  // 2. Fallback URL from Vite env (only the URL, never the secret)
  if (!webhookUrl) {
    webhookUrl = (import.meta.env.VITE_PUSH_WEBHOOK_URL || '').trim();
  }

  if (!webhookUrl || !webhookSecret) {
    console.error('[Push] No webhook config available (RPC failed and env vars empty)');
    return false;
  }

  // 3. Call the Cloudflare push-notify webhook
  const payload = {
    title: params.titulo,
    body: params.mensaje,
    icon: params.imagen_url || '/icon.png',
    badge: '/icon.png',
    tag: 'marketcoffee-' + params.id,
    url: params.link_url || '/',
    record: {
      id: params.id,
      title: params.titulo,
      body: params.mensaje,
      titulo: params.titulo,
      mensaje: params.mensaje,
      icon: params.imagen_url || '/icon.png',
      tag: 'marketcoffee-' + params.id,
      renotify: true,
      imagen_url: params.imagen_url || '',
      link_url: params.link_url || '/',
      tipo: params.tipo,
      destinatario_telefono: params.destinatario_telefono || '',
    }
  };

  console.log('[Push] Triggering webhook for:', params.id, params.tipo, 'url:', webhookUrl);
  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-push-webhook-secret': webhookSecret,
    },
    body: JSON.stringify(payload),
  });

  const result = await resp.json().catch(() => ({}));
  console.log('[Push] Webhook response:', resp.status, result);
  if (result.failedDetails?.length) {
    for (const fd of result.failedDetails) {
      if (fd.statusCode === 410 || fd.statusCode === 404) {
        console.log(`[Push] Sub expirada/auto-borrada: endpoint=${fd.endpoint}`);
      } else {
        console.warn(`[Push] FAIL sub: status=${fd.statusCode} error=${fd.error} endpoint=${fd.endpoint}`);
      }
    }
  }
  return resp.ok && result.success === true;
}
