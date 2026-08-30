import { supabase } from '../store/supabaseClient';

/**
 * Send a push notification to a specific phone number's subscription
 * Uses the /api/push-notify webhook endpoint with compatible payload format
 */
export async function sendMesaPushNotification(
  targetPhone: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<boolean> {
  console.log('[Push] sendMesaPushNotification:', { targetPhone, title, body: body.substring(0, 60) });
  try {
    const webhookUrl = import.meta.env.VITE_PUSH_WEBHOOK_URL;
    if (!webhookUrl) {
      console.error('[Push] VITE_PUSH_WEBHOOK_URL no configurada');
      return false;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        record: {
          titulo: title,
          mensaje: body,
          tipo: 'personal',
          destinatario_telefono: targetPhone.trim(),
          imagen_url: (data && typeof data === 'object' && 'imagen_url' in data ? data.imagen_url : undefined) || '',
          link_url: (data && typeof data === 'object' && 'link_url' in data ? data.link_url : undefined) || '/',
          icon: '/icon.png',
          badge: '/icon.png',
          data: data || {},
          requireInteraction: true,
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
        record: {
          titulo: title,
          mensaje: body,
          tipo: 'todos',
          imagen_url: (data && typeof data === 'object' && 'imagen_url' in data ? data.imagen_url : undefined) || '',
          link_url: (data && typeof data === 'object' && 'link_url' in data ? data.link_url : undefined) || '/',
          icon: '/icon.png',
          badge: '/icon.png',
          data: data || {},
          requireInteraction: false,
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
