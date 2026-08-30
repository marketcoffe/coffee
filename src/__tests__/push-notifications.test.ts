/**
 * Comprehensive QA Tests for Push Notification System
 * Covers: push-notify, register-subscription, track-event, send-campaign,
 * check-automations, evaluate-segments, and service worker logic.
 *
 * All tests in ONE file to avoid vi.mock pollution across files.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';

// ─── Stable mock instances (created once, reused across tests) ───
let chainData: any[] = [];
let chainError: any = null;

const sendNotificationMock = vi.fn().mockResolvedValue({ statusCode: 201 });
const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
const deleteMock = vi.fn();
const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null });
const fromMock = vi.fn();

function buildChain() {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.lte = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve({ data: chainData, error: chainError }).then(resolve, reject);
  return chain;
}

vi.mock('@supabase/supabase-js', () => ({
  get createClient() {
    return vi.fn(() => ({
      from: fromMock,
      rpc: rpcMock,
    }));
  },
}));

vi.mock('web-push', () => ({
  get default() {
    return {
      setVapidDetails: vi.fn(),
      sendNotification: sendNotificationMock,
    };
  },
}));

// ─── Helpers ───
const BASE_ENV = {
  VAPID_PUBLIC_KEY: 'vk_test_123',
  VAPID_PRIVATE_KEY: 'pk_test_123',
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service_key_123',
  WEBHOOK_SECRET: 'test-secret-123',
  ALLOWED_ORIGINS: '*',
};

const TEST_WEBHOOK_SECRET = BASE_ENV.WEBHOOK_SECRET;

function makeReq(url: string, body?: any, method = 'POST', headers?: Record<string, string>) {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (headers) Object.assign(h, headers);
  return new Request(url, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function makeCtx(request: Request, env?: Record<string, string>) {
  return { request, env: { ...BASE_ENV, ...env } };
}

beforeEach(() => {
  chainData = [];
  chainError = null;
  sendNotificationMock.mockClear();
  insertMock.mockClear();
  deleteMock.mockClear();
  rpcMock.mockClear();
  rpcMock.mockResolvedValue({ data: null, error: null });
  sendNotificationMock.mockResolvedValue({ statusCode: 201 });
  fromMock.mockReset();
  fromMock.mockReturnValue(buildChain());
});

// ════════════════════════════════════════════════════════════════════════════
// 1. PUSH-NOTIFY
// ════════════════════════════════════════════════════════════════════════════
describe('push-notify', () => {
  async function callPush(body: any, env?: Record<string, string>, headers?: Record<string, string>) {
    const finalHeaders = headers ?? { 'x-push-webhook-secret': TEST_WEBHOOK_SECRET };
    const req = makeReq('https://test.com/api/push-notify', body, 'POST', finalHeaders);
    const { onRequestPost } = await import('../../functions/api/push-notify');
    return onRequestPost(makeCtx(req, env));
  }

  async function callOptions() {
    const req = makeReq('https://test.com/api/push-notify', undefined, 'OPTIONS');
    const { onRequestOptions } = await import('../../functions/api/push-notify');
    return onRequestOptions(makeCtx(req));
  }

  async function callGet() {
    const req = makeReq('https://test.com/api/push-notify', undefined, 'GET');
    const { onRequestGet } = await import('../../functions/api/push-notify');
    return onRequestGet(makeCtx(req));
  }

  it('sends push to all subscriptions with tipo=todos', async () => {
    chainData = [
      { id: 's1', endpoint: 'https://fcm/a', p256dh: 'pk1', auth_secret: 'ak1', destinatario_telefono: '04121111', anonymous_id: 'a1' },
      { id: 's2', endpoint: 'https://fcm/b', p256dh: 'pk2', auth_secret: 'ak2', destinatario_telefono: '04122222', anonymous_id: 'a2' },
    ];
    const result = await callPush({
      record: { id: 'notif-1', title: 'Test', body: 'Hello', tipo: 'todos' },
    });
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.success).toBe(true);
    expect(body.sent).toBe(2);
    expect(body.total).toBe(2);
    expect(sendNotificationMock).toHaveBeenCalledTimes(2);
  });

  it('sends push only to matching phone for tipo=personal', async () => {
    chainData = [
      { id: 's1', endpoint: 'https://fcm/a', p256dh: 'pk1', auth_secret: 'ak1', destinatario_telefono: '04121111', anonymous_id: 'a1' },
      { id: 's2', endpoint: 'https://fcm/b', p256dh: 'pk2', auth_secret: 'ak2', destinatario_telefono: '04122222', anonymous_id: 'a2' },
    ];
    const result = await callPush({
      record: { id: 'notif-2', title: 'PM', body: 'Hi', tipo: 'personal', destinatario_telefono: '04121111' },
    });
    const body = await result.json();
    expect(body.sent).toBe(1);
    expect(body.total).toBe(1);
    expect(sendNotificationMock).toHaveBeenCalledTimes(1);
  });

  it('sends push only to matching phone for tipo=admin', async () => {
    chainData = [
      { id: 's1', endpoint: 'https://fcm/a', p256dh: 'pk1', auth_secret: 'ak1', destinatario_telefono: '04121111', anonymous_id: 'a1' },
    ];
    const result = await callPush({
      record: { id: 'notif-3', title: 'Admin', body: 'Info', tipo: 'admin', destinatario_telefono: '04121111' },
    });
    const body = await result.json();
    expect(body.sent).toBe(1);
  });

  it('sends 0 when no subscriptions match personal phone', async () => {
    chainData = [
      { id: 's1', endpoint: 'https://fcm/a', p256dh: 'pk1', auth_secret: 'ak1', destinatario_telefono: '04129999', anonymous_id: 'a1' },
    ];
    const result = await callPush({
      record: { id: 'notif-4', title: 'PM', body: 'Hi', tipo: 'personal', destinatario_telefono: '04121111' },
    });
    const body = await result.json();
    expect(body.sent).toBe(0);
    expect(body.total).toBe(0);
  });

  it('empty record object handled gracefully with defaults', async () => {
    const result = await callPush({});
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.success).toBe(true);
  });

  it('record null handled gracefully (falls back to payload)', async () => {
    const result = await callPush({ record: null });
    expect(result.status).toBe(200);
  });

  it('handles record with Spanish field names (titulo/mensaje)', async () => {
    chainData = [
      { id: 's1', endpoint: 'https://fcm/a', p256dh: 'pk1', auth_secret: 'ak1', destinatario_telefono: '04121111', anonymous_id: 'a1' },
    ];
    const result = await callPush({
      record: { id: 'notif-es', titulo: 'Hola', mensaje: 'Mundo', tipo: 'todos' },
    });
    expect(result.status).toBe(200);
    const payload = JSON.parse(sendNotificationMock.mock.calls[0][1]);
    expect(payload.title).toBe('Hola');
    expect(payload.body).toBe('Mundo');
  });

  it('tag uses marketcoffee- prefix', async () => {
    chainData = [
      { id: 's1', endpoint: 'https://fcm/a', p256dh: 'pk1', auth_secret: 'ak1', destinatario_telefono: '04121111', anonymous_id: 'a1' },
    ];
    await callPush({
      record: { id: 'my-notif', title: 'T', body: 'B', tipo: 'todos' },
    });
    const payload = JSON.parse(sendNotificationMock.mock.calls[0][1]);
    expect(payload.tag).toBe('marketcoffee-my-notif');
  });

  it('tracks push_events after successful send', async () => {
    const chain = buildChain();
    chain.insert = vi.fn().mockResolvedValue({ data: null, error: null });
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    fromMock.mockReturnValue(chain);

    chainData = [
      { id: 's1', endpoint: 'https://fcm/a', p256dh: 'pk1', auth_secret: 'ak1', destinatario_telefono: '04121111', anonymous_id: 'a1', user_id: 'u1' },
    ];
    await callPush({
      record: { id: 'track-test', title: 'T', body: 'B', tipo: 'todos' },
    });
    // The chain.insert is called for push_events tracking
    expect(chain.insert).toHaveBeenCalled();
    const insertCall = chain.insert.mock.calls.find((c: any) => c[0]?.event_type === 'sent');
    expect(insertCall).toBeTruthy();
    expect(insertCall[0].notification_id).toBe('track-test');
    expect(insertCall[0].user_id).toBe('u1');
  });

  it('returns 401 for wrong webhook secret', async () => {
    const result = await callPush(
      { record: { id: 'n', title: 'T', body: 'B', tipo: 'todos' } },
      { WEBHOOK_SECRET: 'my_secret' },
      { 'x-push-webhook-secret': 'wrong_secret' }
    );
    expect(result.status).toBe(401);
    const body = await result.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('accepts correct webhook secret', async () => {
    chainData = [];
    const result = await callPush(
      { record: { id: 'n', title: 'T', body: 'B', tipo: 'todos' } },
      { WEBHOOK_SECRET: 'my_secret' },
      { 'x-push-webhook-secret': 'my_secret' }
    );
    expect(result.status).toBe(200);
  });

  it('deletes subscription on 404 error', async () => {
    const chain = buildChain();
    chain.delete = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.select = vi.fn().mockReturnValue(chain);
    fromMock.mockReturnValue(chain);

    chainData = [
      { id: 's1', endpoint: 'https://fcm/expired', p256dh: 'pk1', auth_secret: 'ak1', destinatario_telefono: '04121111', anonymous_id: 'a1' },
    ];
    sendNotificationMock.mockRejectedValueOnce({ statusCode: 404 });
    const result = await callPush({
      record: { id: 'del-test', title: 'T', body: 'B', tipo: 'todos' },
    });
    const body = await result.json();
    expect(body.failed).toBe(1);
    expect(body.sent).toBe(0);
    expect(chain.delete).toHaveBeenCalled();
  });

  it('deletes subscription on 410 error', async () => {
    const chain = buildChain();
    chain.delete = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.select = vi.fn().mockReturnValue(chain);
    fromMock.mockReturnValue(chain);

    chainData = [
      { id: 's1', endpoint: 'https://fcm/gone', p256dh: 'pk1', auth_secret: 'ak1', destinatario_telefono: '04121111', anonymous_id: 'a1' },
    ];
    sendNotificationMock.mockRejectedValueOnce({ statusCode: 410 });
    const result = await callPush({
      record: { id: 'gone-test', title: 'T', body: 'B', tipo: 'todos' },
    });
    const body = await result.json();
    expect(body.failed).toBe(1);
    expect(chain.delete).toHaveBeenCalled();
  });

  it('OPTIONS returns 204 with CORS headers', async () => {
    const result = await callOptions();
    expect(result.status).toBe(204);
    expect(result.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('GET returns diagnostic info', async () => {
    const result = await callGet();
    const body = await result.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('push-notify');
    expect(body.vapidConfigured).toBe(true);
  });

  it('returns 500 when VAPID keys missing', async () => {
    const result = await callPush(
      { record: { id: 'n', title: 'T', body: 'B', tipo: 'todos' } },
      { VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '' }
    );
    expect(result.status).toBe(500);
    const body = await result.json();
    expect(body.error).toContain('VAPID');
  });

  it('returns 500 when Supabase not configured', async () => {
    const result = await callPush(
      { record: { id: 'n', title: 'T', body: 'B', tipo: 'todos' } },
      { SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' }
    );
    expect(result.status).toBe(500);
    const body = await result.json();
    expect(body.error).toContain('Supabase');
  });

  it('handles subscription with missing keys gracefully (filtered out)', async () => {
    chainData = [
      { id: 's1', endpoint: 'https://fcm/a', p256dh: 'pk1', auth_secret: 'ak1', destinatario_telefono: '04121111', anonymous_id: 'a1' },
      { id: 's2', endpoint: 'https://fcm/b', p256dh: '', auth_secret: '', destinatario_telefono: '04122222', anonymous_id: 'a2' },
    ];
    const result = await callPush({
      record: { id: 'n', title: 'T', body: 'B', tipo: 'todos' },
    });
    const body = await result.json();
    expect(body.sent).toBe(1);
    expect(body.invalidSubscriptions).toBe(1);
  });

  it('returns success when no valid subscriptions found', async () => {
    chainData = [
      { id: 's1', endpoint: '', p256dh: 'pk1', auth_secret: 'ak1', destinatario_telefono: '04121111', anonymous_id: 'a1' },
    ];
    const result = await callPush({
      record: { id: 'n', title: 'T', body: 'B', tipo: 'todos' },
    });
    const body = await result.json();
    expect(body.success).toBe(true);
    expect(body.sent).toBe(0);
    expect(body.message).toContain('No valid');
  });

  it('continues after one subscription fails', async () => {
    const chain = buildChain();
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.insert = vi.fn().mockResolvedValue({ data: null, error: null });
    chain.delete = vi.fn().mockReturnValue(chain);
    fromMock.mockReturnValue(chain);

    chainData = [
      { id: 's1', endpoint: 'https://fcm/a', p256dh: 'pk1', auth_secret: 'ak1', destinatario_telefono: '04121111', anonymous_id: 'a1' },
      { id: 's2', endpoint: 'https://fcm/b', p256dh: 'pk2', auth_secret: 'ak2', destinatario_telefono: '04122222', anonymous_id: 'a2' },
    ];
    sendNotificationMock
      .mockRejectedValueOnce({ statusCode: 500 })
      .mockResolvedValueOnce({ statusCode: 201 });

    const result = await callPush({
      record: { id: 'resilient', title: 'T', body: 'B', tipo: 'todos' },
    });
    const body = await result.json();
    expect(body.sent).toBe(1);
    expect(body.failed).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. REGISTER-SUBSCRIPTION
// ════════════════════════════════════════════════════════════════════════════
describe('register-subscription', () => {
  async function callRegister(body: any, method = 'POST') {
    const req = makeReq('https://test.com/api/register-subscription', method === 'POST' ? body : undefined, method);
    const { onRequestPost, onRequestOptions } = await import('../../functions/api/register-subscription');
    if (method === 'OPTIONS') return onRequestOptions(makeCtx(req));
    return onRequestPost(makeCtx(req));
  }

  it('registers new subscription with phone and user_id', async () => {
    const chain = buildChain();
    chain.select = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      }),
    });
    chain.insert = vi.fn().mockResolvedValue({ data: null, error: null });
    fromMock.mockReturnValue(chain);

    const result = await callRegister({
      subscription: { endpoint: 'https://fcm/new-sub', keys: { p256dh: 'key1', auth: 'auth1' } },
      anonymous_id: 'anon-123',
      phone: '04121234567',
      user_id: 'user-123',
    });
    const body = await result.json();
    expect(result.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.anonymous_id).toBe('anon-123');
  });

  it('rejects subscription without endpoint', async () => {
    const result = await callRegister({
      subscription: { keys: { p256dh: 'k', auth: 'a' } },
    });
    expect(result.status).toBe(400);
    const body = await result.json();
    expect(body.error).toContain('Missing');
  });

  it('generates anonymous_id when not provided', async () => {
    const chain = buildChain();
    chain.select = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      }),
    });
    chain.insert = vi.fn().mockResolvedValue({ data: null, error: null });
    fromMock.mockReturnValue(chain);

    const result = await callRegister({
      subscription: { endpoint: 'https://fcm/gen-id', keys: { p256dh: 'k', auth: 'a' } },
    });
    const body = await result.json();
    expect(body.success).toBe(true);
    expect(body.anonymous_id).toBeTruthy();
    expect(body.anonymous_id.length).toBeGreaterThan(0);
  });

  it('OPTIONS returns 204', async () => {
    const result = await callRegister(undefined, 'OPTIONS');
    expect(result.status).toBe(204);
    expect(result.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. TRACK-EVENT
// ════════════════════════════════════════════════════════════════════════════
describe('track-event', () => {
  async function callTrack(body: any) {
    const req = makeReq('https://test.com/api/marketing/track-event', body);
    const { onRequestPost } = await import('../../functions/api/marketing/track-event');
    return onRequestPost(makeCtx(req));
  }

  it('tracks clicked event', async () => {
    const chain = buildChain();
    chain.insert = vi.fn().mockResolvedValue({ data: null, error: null });
    fromMock.mockReturnValue(chain);

    const result = await callTrack({ notification_id: 'n1', event_type: 'clicked' });
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.success).toBe(true);
  });

  it('tracks sent event with campaign_id', async () => {
    const chain = buildChain();
    chain.insert = vi.fn().mockResolvedValue({ data: null, error: null });
    fromMock.mockReturnValue(chain);

    const result = await callTrack({
      notification_id: 'n2',
      event_type: 'sent',
      campaign_id: 'c1',
      user_id: 'u1',
    });
    expect(result.status).toBe(200);
  });

  it('returns 400 without notification_id', async () => {
    const result = await callTrack({ event_type: 'clicked' });
    expect(result.status).toBe(400);
  });

  it('returns 400 without event_type', async () => {
    const result = await callTrack({ notification_id: 'n3' });
    expect(result.status).toBe(400);
  });

  it('increment_notification_click called for clicked events', async () => {
    const chain = buildChain();
    chain.insert = vi.fn().mockResolvedValue({ data: null, error: null });
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.single = vi.fn().mockResolvedValue({ data: { total_clicked: 5 }, error: null });
    chain.update = vi.fn().mockReturnValue(chain);
    fromMock.mockReturnValue(chain);

    rpcMock.mockResolvedValue({ data: null, error: null });
    await callTrack({ notification_id: 'n4', event_type: 'clicked' });
    expect(rpcMock).toHaveBeenCalledWith('increment_notification_click', { p_notif_id: 'n4' });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. SEND-CAMPAIGN
// ════════════════════════════════════════════════════════════════════════════
describe('send-campaign', () => {
  async function callCampaign(body?: any) {
    const req = makeReq('https://test.com/api/marketing/send-campaign', body || {});
    const { onRequestPost } = await import('../../functions/api/marketing/send-campaign');
    return onRequestPost(makeCtx(req));
  }

  it('processes 0 campaigns when none scheduled', async () => {
    chainData = [];
    fromMock.mockReturnValue(buildChain());
    const result = await callCampaign();
    const body = await result.json();
    expect(body.success).toBe(true);
    expect(body.campaigns_processed).toBe(0);
  });

  it('returns 401 for wrong webhook secret', async () => {
    const req = makeReq('https://test.com/api/marketing/send-campaign', {});
    req.headers.set('x-push-webhook-secret', 'wrong');
    const { onRequestPost } = await import('../../functions/api/marketing/send-campaign');
    const result = await onRequestPost(makeCtx(req, { WEBHOOK_SECRET: 'correct_secret' }));
    expect(result.status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. CHECK-AUTOMATIONS
// ════════════════════════════════════════════════════════════════════════════
describe('check-automations', () => {
  async function callCheck(body?: any) {
    const req = makeReq('https://test.com/api/marketing/check-automations', body || {});
    const { onRequestPost } = await import('../../functions/api/marketing/check-automations');
    return onRequestPost(makeCtx(req));
  }

  it('returns processed:0 when no active rules', async () => {
    chainData = [];
    fromMock.mockReturnValue(buildChain());
    const result = await callCheck();
    const body = await result.json();
    expect(body.success).toBe(true);
    expect(body.processed).toBe(0);
  });

  it('rejects wrong webhook secret', async () => {
    const req = makeReq('https://test.com/api/marketing/check-automations', {});
    req.headers.set('x-push-webhook-secret', 'wrong');
    const { onRequestPost } = await import('../../functions/api/marketing/check-automations');
    const result = await onRequestPost(makeCtx(req, { WEBHOOK_SECRET: 'correct_secret' }));
    expect(result.status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. EVALUATE-SEGMENTS
// ════════════════════════════════════════════════════════════════════════════
describe('evaluate-segments', () => {
  async function callEval(body?: any) {
    const req = makeReq('https://test.com/api/marketing/evaluate-segments', body || {});
    const { onRequestPost } = await import('../../functions/api/marketing/evaluate-segments');
    return onRequestPost(makeCtx(req));
  }

  it('returns success with segment counts', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    chainData = [{ segment_key: 'vip' }, { segment_key: 'vip' }, { segment_key: 'new' }];
    fromMock.mockReturnValue(buildChain());

    const result = await callEval();
    const body = await result.json();
    expect(body.success).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith('evaluate_all_segments');
  });

  it('returns 500 on RPC failure', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });
    const result = await callEval();
    expect(result.status).toBe(500);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. CORS on all endpoints
// ════════════════════════════════════════════════════════════════════════════
describe('CORS - all endpoints', () => {
  const endpoints = [
    { path: '/api/push-notify', imp: () => import('../../functions/api/push-notify'), hasOptions: true },
    { path: '/api/register-subscription', imp: () => import('../../functions/api/register-subscription'), hasOptions: true },
    { path: '/api/marketing/track-event', imp: () => import('../../functions/api/marketing/track-event'), hasOptions: true },
    { path: '/api/marketing/send-campaign', imp: () => import('../../functions/api/marketing/send-campaign'), hasOptions: true },
    { path: '/api/marketing/evaluate-segments', imp: () => import('../../functions/api/marketing/evaluate-segments'), hasOptions: true },
    { path: '/api/marketing/check-automations', imp: () => import('../../functions/api/marketing/check-automations'), hasOptions: true },
  ];

  it.each(endpoints.map(e => [e.path, e.imp, e.hasOptions]))(
    '%s OPTIONS returns 204',
    async (_path, importFn: any, hasOptions: boolean) => {
      if (!hasOptions) return;
      const mod = await importFn();
      const r = new Request(`https://test.com${_path}`, { method: 'OPTIONS' });
      const result = await mod.onRequestOptions(makeCtx(r));
      expect(result.status).toBe(204);
      expect(result.headers.get('Access-Control-Allow-Origin')).toBe('*');
    }
  );
});

// ════════════════════════════════════════════════════════════════════════════
// 8. GET diagnostic endpoints
// ════════════════════════════════════════════════════════════════════════════
describe('GET diagnostic endpoints', () => {
  it('push-notify GET', async () => {
    const r = new Request('https://test.com/api/push-notify', { method: 'GET' });
    const { onRequestGet } = await import('../../functions/api/push-notify');
    const result = await onRequestGet(makeCtx(r));
    const body = await result.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('push-notify');
  });

  it('send-campaign GET', async () => {
    const r = new Request('https://test.com/api/marketing/send-campaign', { method: 'GET' });
    const { onRequestGet } = await import('../../functions/api/marketing/send-campaign');
    const result = await onRequestGet(makeCtx(r));
    const body = await result.json();
    expect(body.status).toBe('ok');
  });

  it('check-automations GET', async () => {
    const r = new Request('https://test.com/api/marketing/check-automations', { method: 'GET' });
    const { onRequestGet } = await import('../../functions/api/marketing/check-automations');
    const result = await onRequestGet(makeCtx(r));
    const body = await result.json();
    expect(body.status).toBe('ok');
  });

  it('evaluate-segments GET', async () => {
    const r = new Request('https://test.com/api/marketing/evaluate-segments', { method: 'GET' });
    const { onRequestGet } = await import('../../functions/api/marketing/evaluate-segments');
    const result = await onRequestGet(makeCtx(r));
    const body = await result.json();
    expect(body.status).toBe('ok');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 9. Service Worker (sw-push.js) logic tests
// ════════════════════════════════════════════════════════════════════════════
describe('sw-push.js logic', () => {
  it('dedup TTL is 60 seconds', () => {
    const file = readFileSync('E:/market-coffe/public/sw-push.js', 'utf8');
    const match = file.match(/DEDUP_TTL_MS\s*=\s*(\d+)/);
    expect(match).toBeTruthy();
    expect(Number(match![1])).toBe(60000);
  });

  it('uses marketcoffee- prefix in tag generation', () => {
    const file = readFileSync('E:/market-coffe/public/sw-push.js', 'utf8');
    expect(file).toContain("'marketcoffee-' + String(payload.id || Date.now())");
  });

  it('strips marketcoffee- prefix in click handler', () => {
    const file = readFileSync('E:/market-coffe/public/sw-push.js', 'utf8');
    expect(file).toContain("rawTag.replace(/^marketcoffee-/, '')");
  });

  it('click handler calls track-event endpoint', () => {
    const file = readFileSync('E:/market-coffe/public/sw-push.js', 'utf8');
    expect(file).toContain("/api/marketing/track-event");
  });

  it('dedup check prevents duplicate notifications within TTL', () => {
    const file = readFileSync('E:/market-coffe/public/sw-push.js', 'utf8');
    expect(file).toContain('recentlyShown.has(tagKey)');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 10. Security
// ════════════════════════════════════════════════════════════════════════════
describe('Security', () => {
  it('safeCompare rejects mismatched secrets', async () => {
    const req = makeReq(
      'https://test.com/api/push-notify',
      { record: { id: 'n', title: 'T', body: 'B', tipo: 'todos' } },
      'POST',
      { 'x-push-webhook-secret': 'attacker_secret' }
    );
    const { onRequestPost } = await import('../../functions/api/push-notify');
    const result = await onRequestPost(makeCtx(req, { WEBHOOK_SECRET: 'real_secret' }));
    expect(result.status).toBe(401);
  });

  it('safeCompare rejects when length differs', async () => {
    const req = makeReq(
      'https://test.com/api/push-notify',
      { record: { id: 'n', title: 'T', body: 'B', tipo: 'todos' } },
      'POST',
      { 'x-push-webhook-secret': 'short' }
    );
    const { onRequestPost } = await import('../../functions/api/push-notify');
    const result = await onRequestPost(makeCtx(req, { WEBHOOK_SECRET: 'a_much_longer_secret' }));
    expect(result.status).toBe(401);
  });

  it('rejects requests when no webhook secret is configured', async () => {
    chainData = [];
    fromMock.mockReturnValue(buildChain());
    const req = makeReq('https://test.com/api/push-notify', { record: { id: 'n', title: 'T', body: 'B', tipo: 'todos' } });
    const { onRequestPost } = await import('../../functions/api/push-notify');
    const result = await onRequestPost(makeCtx(req, { WEBHOOK_SECRET: '', PUSH_WEBHOOK_SECRET: '' }));
    expect(result.status).toBe(500);
  });

  it('empty record handled gracefully with defaults', async () => {
    fromMock.mockReturnValue(buildChain());
    const req = makeReq('https://test.com/api/push-notify', { record: {} }, 'POST', { 'x-push-webhook-secret': TEST_WEBHOOK_SECRET });
    const { onRequestPost } = await import('../../functions/api/push-notify');
    const result = await onRequestPost(makeCtx(req));
    expect(result.status).toBe(200);
  });
});
