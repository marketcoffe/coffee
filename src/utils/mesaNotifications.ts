import { supabase } from '../store/supabaseClient';

/**
 * Send a push notification to a specific phone number's subscription
 * Uses the Supabase Edge Function / API webhook
 */
export async function sendMesaPushNotification(
  targetPhone: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<boolean> {
  console.log('[Push] sendMesaPushNotification:', { targetPhone, title, body: body.substring(0, 60) });
  try {
    // Get the push subscription for this phone
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth_secret')
      .eq('destinatario_telefono', targetPhone.trim())
      .eq('is_active', true)
      .limit(1);

    if (fetchError) {
      console.error('[Push] Error consultando push_subscriptions:', fetchError.message);
      return false;
    }
    if (!subscriptions || subscriptions.length === 0) {
      console.warn('[Push] No active subscription for phone:', targetPhone);
      return false;
    }

    const sub = subscriptions[0];
    console.log('[Push] Suscripción encontrada:', sub.endpoint.substring(0, 50));

    // Send via the webhook endpoint
    const webhookUrl = import.meta.env.VITE_PUSH_WEBHOOK_URL;
    if (!webhookUrl) {
      console.error('[Push] VITE_PUSH_WEBHOOK_URL no configurada');
      return false;
    }

    console.log('[Push] Enviando a webhook:', webhookUrl);
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth_secret
          }
        },
        notification: {
          title,
          body,
          icon: '/icon.png',
          badge: '/icon.png',
          data: data || {},
          vibrate: [200, 100, 200],
          requireInteraction: true
        }
      })
    });

    console.log('[Push] Webhook response:', response.status, response.statusText);
    if (!response.ok) {
      const text = await response.text().catch(() => 'no body');
      console.error('[Push] Webhook error body:', text);
    }
    return response.ok;
  } catch (err) {
    console.error('[Push] Error sending notification:', err);
    return false;
  }
}

/**
 * Send push notification to all active subscriptions (broadcast)
 */
export async function sendMesaBroadcastPush(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<boolean> {
  console.log('[Push] sendMesaBroadcastPush:', { title, body: body.substring(0, 60) });
  try {
    const webhookUrl = import.meta.env.VITE_PUSH_WEBHOOK_URL;
    if (!webhookUrl) {
      console.error('[Push] VITE_PUSH_WEBHOOK_URL no configurada para broadcast');
      return false;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        broadcast: true,
        notification: {
          title,
          body,
          icon: '/icon.png',
          badge: '/icon.png',
          data: data || {},
          vibrate: [200, 100, 200]
        }
      })
    });

    console.log('[Push] Broadcast response:', response.status, response.statusText);
    return response.ok;
  } catch (err) {
    console.error('[Push] Error broadcasting:', err);
    return false;
  }
}

/**
 * Show a local browser notification (for admin panel)
 */
export function showLocalNotification(title: string, body: string, tag?: string) {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: '/icon.png',
      badge: '/icon.png',
      tag: tag || 'mesa-notification',
      requireInteraction: true
    } as NotificationOptions);

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }
}

/**
 * Play notification sound
 */
export function playMesaNotificationSound() {
  try {
    const audio = new Audio('/sounds/notification.wav');
    audio.volume = 0.8;
    audio.play().catch(() => {});
  } catch {}
}
