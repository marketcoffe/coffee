// Cloudflare Pages Function - Send Scheduled Campaigns
// Location: /functions/api/marketing/send-campaign.ts

declare const PagesFunction: any;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-push-webhook-secret',
  'Access-Control-Max-Age': '86400',
};

export const onRequestOptions: any = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export const onRequestPost: any = async (context: any) => {
  const { request, env } = context;

  const rawAuthHeader = request.headers.get('x-push-webhook-secret') || '';
  const authHeader = rawAuthHeader.trim();
  const configuredSecret = [env.WEBHOOK_SECRET, env.webhook_secret, env.PUSH_WEBHOOK_SECRET, env.push_webhook_secret].find(Boolean) || '';

  if (configuredSecret && authHeader) {
    if (!safeCompare(authHeader, configuredSecret)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
  }

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('status', 'scheduled')
    .lte('schedule_at', new Date().toISOString());

  let processed = 0;
  for (const campaign of campaigns || []) {
    await supabase.from('campaigns').update({ status: 'sending' }).eq('id', campaign.id);

    let targetSubscriptions: any[] = [];
    if (campaign.segment_filter === 'all') {
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('id, user_id, endpoint, p256dh, auth_secret, destinatario_telefono, anonymous_id');
      targetSubscriptions = (subs || []).filter((s: any) => s.endpoint && s.p256dh && s.auth_secret);
    } else {
      const { data: segUsers } = await supabase
        .from('customer_segments')
        .select('user_id')
        .eq('segment_key', campaign.segment_filter);
      const userIds = (segUsers || []).map((s: any) => s.user_id).filter(Boolean);
      if (userIds.length > 0) {
        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('id, user_id, endpoint, p256dh, auth_secret, destinatario_telefono, anonymous_id')
          .in('user_id', userIds);
        targetSubscriptions = (subs || []).filter((s: any) => s.endpoint && s.p256dh && s.auth_secret);
      }
    }

    if (targetSubscriptions.length === 0) {
      await supabase.from('campaigns').update({
        status: 'sent', sent_at: new Date().toISOString(),
        total_recipients: 0, total_sent: 0, total_rate_limited: 0
      }).eq('id', campaign.id);
      processed++;
      continue;
    }

    const vapidPublic = env.VAPID_PUBLIC_KEY;
    const vapidPrivate = env.VAPID_PRIVATE_KEY;
    if (!vapidPublic || !vapidPrivate) {
      await supabase.from('campaigns').update({ status: 'cancelled' }).eq('id', campaign.id);
      continue;
    }

    let webpush: any;
    const wpMod = await import('web-push');
    webpush = (wpMod as any).default || wpMod;
    webpush.setVapidDetails('mailto:admin@marketcoffesweet.com', vapidPublic, vapidPrivate);

    let sentCount = 0;
    let rateLimitedCount = 0;
    let failedCount = 0;

    for (const sub of targetSubscriptions) {
      const userId = sub.user_id || sub.anonymous_id || '';
      if (!userId) continue;

      const { data: allowed } = await supabase.rpc('check_push_rate_limit', { p_user_id: userId });
      if (allowed === false) {
        rateLimitedCount++;
        continue;
      }

      const subInfo = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth_secret }
      };

      const payloadForSW = {
        title: campaign.title,
        body: campaign.body,
        link_url: campaign.link_url || '/',
        tag: 'campaign-' + campaign.id,
        id: 'notif-campaign-' + crypto.randomUUID().slice(0, 12),
        requireInteraction: false,
        silent: false,
      };

      try {
        await webpush.sendNotification(subInfo, JSON.stringify(payloadForSW));

        const notifId = payloadForSW.id;
        await supabase.from('notifications').insert({
          id: notifId, titulo: campaign.title, mensaje: campaign.body,
          fecha: new Date().toISOString(), tipo: 'personal',
          destinatario_telefono: sub.destinatario_telefono || '',
          imagen_url: campaign.image_url || '',
          link_url: campaign.link_url || '/', leida: false
        });

        await supabase.from('push_events').insert({
          notification_id: notifId, campaign_id: campaign.id,
          user_id: sub.user_id || null,
          anonymous_id: sub.anonymous_id || '',
          event_type: 'sent'
        });

        await supabase.rpc('increment_push_count', { p_user_id: userId });
        sentCount++;
      } catch (err: any) {
        failedCount++;
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }

    await supabase.from('campaigns').update({
      status: 'sent', sent_at: new Date().toISOString(),
      total_recipients: targetSubscriptions.length,
      total_sent: sentCount,
      total_rate_limited: rateLimitedCount
    }).eq('id', campaign.id);

    processed++;
  }

  return new Response(JSON.stringify({ success: true, campaigns_processed: processed }), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
};

export const onRequestGet: any = async () => {
  return new Response(JSON.stringify({ status: 'ok', service: 'send-campaign' }), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
};
