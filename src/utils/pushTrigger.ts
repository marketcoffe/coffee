import { supabase } from '../store/supabaseClient';

/**
 * Trigger push notifications via the Cloudflare webhook.
 * Called after a notification is inserted into the notifications table.
 * Uses get_push_config() RPC to obtain the webhook secret server-side.
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
  try {
    // 1. Get webhook config from Supabase (admin-only RPC)
    const { data: config, error: configErr } = await supabase.rpc('get_push_config');
    if (configErr || !config) {
      console.error('[Push] get_push_config error:', configErr?.message || 'no data');
      return false;
    }

    const webhookUrl = config.webhook_url;
    const webhookSecret = config.webhook_secret;

    if (!webhookUrl || !webhookSecret) {
      console.error('[Push] webhook_url or secret empty');
      return false;
    }

    // 2. Call the Cloudflare push-notify webhook
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

    console.log('[Push] Triggering webhook for:', params.id, params.tipo);
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
    return resp.ok && result.success === true;
  } catch (err) {
    console.error('[Push] triggerBroadcastPush error:', err);
    return false;
  }
}
