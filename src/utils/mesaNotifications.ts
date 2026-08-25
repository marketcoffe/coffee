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
  try {
    // Get the push subscription for this phone
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth_secret')
      .eq('destinatario_telefono', targetPhone.trim())
      .eq('is_active', true)
      .limit(1);

    if (fetchError || !subscriptions || subscriptions.length === 0) {
      console.warn('[Push] No active subscription for phone:', targetPhone);
      return false;
    }

    const sub = subscriptions[0];

    // Send via the webhook endpoint
    const webhookUrl = import.meta.env.VITE_PUSH_WEBHOOK_URL;
    if (!webhookUrl) {
      console.warn('[Push] No webhook URL configured');
      return false;
    }

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
  try {
    const webhookUrl = import.meta.env.VITE_PUSH_WEBHOOK_URL;
    if (!webhookUrl) return false;

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
    const audio = new Audio('/sounds/notification.mp3');
    audio.volume = 0.8;
    audio.play().catch(() => {});
  } catch {}
}
