// ═══════════════════════════════════════════════════════════════════════════
// Service Worker: Market Coffee Sweet — Push + Offline + Deep Linking
// RFC 8292 (VAPID) · RFC 8030 (Push)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Lifecycle ───
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('workbox-precache-v2').then((cache) =>
      cache.addAll(['/index.html']).catch(() => {})
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const CURRENT_CACHE = 'workbox-precache-v2';
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((names) =>
        Promise.all(
          names.map((n) => {
            // Delete ALL caches except the current version.
            // This cleans stale workbox caches, old asset caches (from previous deploys),
            // and any caches left by the previously-enabled VitePWA/Workbox config.
            if (n !== CURRENT_CACHE) {
              return caches.delete(n);
            }
          })
        )
      )
    ])
  );
});

// ─── SPA Navigation Handler ───
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate' && event.request.method === 'GET') {
    const url = new URL(event.request.url);
    if (url.pathname.startsWith('/api/')) return;
    if (event.request.destination === 'document') {
      event.respondWith(
        fetch(event.request, { redirect: 'follow' }).then((resp) => {
          if (resp.ok) return resp;
          return caches.open('workbox-precache-v2').then((cache) =>
            cache.match('/index.html').then((cached) => cached || resp)
          );
        }).catch(() => {
          return caches.open('workbox-precache-v2').then((cache) =>
            cache.match('/index.html').then((cached) =>
              cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/html' } })
            )
          );
        })
      );
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DEEP LINKING: Mapa de rutas notificación → vista/modal del SPA
// ═══════════════════════════════════════════════════════════════════════════

const DEEP_LINK_MAP = {
  '/pedido/':  { spa_route: '/profile', action: 'OPEN_ORDER_TRACKER',  extractId: true },
  '/oferta':   { spa_route: '/catalog', action: 'FILTER_OFFERS' },
  '/catalog':  { spa_route: '/catalog', action: 'NAVIGATE' },
  '/carrito':  { spa_route: '/cart',    action: 'NAVIGATE' },
  '/cart':     { spa_route: '/cart',    action: 'NAVIGATE' },
  '/perfil':   { spa_route: '/profile', action: 'NAVIGATE' },
  '/profile':  { spa_route: '/profile', action: 'NAVIGATE' },
  '/puntos':   { spa_route: '/profile', action: 'OPEN_REWARDS' },
  '/cupones':  { spa_route: '/profile', action: 'OPEN_COUPONS' },
  '/mesa':     { spa_route: '/mesa',    action: 'NAVIGATE' },
  '/admin':    { spa_route: '/admin',   action: 'NAVIGATE' },
};

function resolveDeepLink(url) {
  if (!url || url === '/') return { spa_route: '/', action: 'NAVIGATE' };
  for (const [prefix, mapping] of Object.entries(DEEP_LINK_MAP)) {
    if (url.startsWith(prefix)) {
      const result = { ...mapping };
      if (mapping.extractId) {
        result.order_id = url.replace('/pedido/', '').split('?')[0].split('#')[0];
      }
      return result;
    }
  }
  return { spa_route: url, action: 'NAVIGATE' };
}

// ═══════════════════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

const recentlyShown = new Map();
const DEDUP_TTL_MS = 60000;

function pruneDedupCache() {
  if (recentlyShown.size > 100) {
    const now = Date.now();
    for (const [k, t] of recentlyShown) {
      if (now - t > DEDUP_TTL_MS) recentlyShown.delete(k);
    }
  }
}

self.addEventListener('push', (event) => {
  console.log('[SW Push] Evento push recibido');
  if (!event.data) {
    console.warn('[SW Push] Evento push sin payload');
    return;
  }

  let payload;
  try {
    payload = event.data.json();
    console.log('[SW Push] Payload parseado:', JSON.stringify(payload).substring(0, 300));
  } catch (e) {
    console.error('[SW Push] Payload JSON inválido:', e, 'Raw data:', event.data.text());
    return;
  }

  // Extraer datos del record anidado si existe (formato pg_net → webhook)
  const record = payload.record || payload;
  const title     = record.titulo  || record.title  || payload.titulo  || payload.title  || 'Market Coffee Sweet';
  const body      = record.mensaje || record.body   || payload.mensaje || payload.body   || '';
  const icon      = record.icon    || payload.icon   || '/icon.png';
  const badge     = record.badge   || payload.badge  || '/icon.png';
  const image     = record.imagen_url || record.image || payload.imagen_url || payload.image || undefined;
  const urlToOpen = record.link_url || record.url || payload.link_url || payload.url || '/';
  const tag       = record.tag     || payload.tag || ('marketcoffee-' + (record.id || payload.id || Date.now()));
  const soundUrl  = payload.sound_url || payload.sound || '/sounds/notification.wav';
  const priority  = payload.priority || record.priority || 'normal';

  console.log('[SW Push] Datos extraídos:', { title, body: body.substring(0, 80), urlToOpen, tag, priority });

  // Deduplicación
  if (recentlyShown.has(tag)) {
    const elapsed = Date.now() - recentlyShown.get(tag);
    if (elapsed < DEDUP_TTL_MS) {
      console.log('[SW Push] Deduplicada:', tag);
      return;
    }
  }
  recentlyShown.set(tag, Date.now());
  pruneDedupCache();

  const displayTag = tag + '::' + Date.now();

  const options = {
    body,
    icon,
    badge,
    image,
    vibrate: priority === 'high' ? [300, 100, 300, 100, 300] : [200, 100, 200],
    tag: displayTag,
    renotify: true,
    requireInteraction: priority === 'high' || payload.requireInteraction === true,
    silent: false,
    data: { url: urlToOpen, tag, displayTag, soundUrl },
    actions: [
      { action: 'open',  title: 'Ver Detalles' },
      { action: 'close', title: 'Cerrar' }
    ]
  };

  console.log('[SW Push] Mostrando notificación nativa:', title, 'priority:', priority, 'requireInteraction:', options.requireInteraction);

  event.waitUntil(
    // SIEMPRE mostrar notificación nativa (independiente de si la app está abierta)
    self.registration.showNotification(title, options)
      .then(() => {
        console.log('[SW Push] showNotification OK:', title);

        // Si la app está abierta, enviar also toast + sonido al SPA
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then((clients) => {
            const hasOpenClient = clients.some(c => c.visibilityState === 'visible');
            if (hasOpenClient) {
              console.log('[SW Push] App en foreground — toast SPA adicional');
              clients.forEach((client) => {
                client.postMessage({ type: 'PLAY_NOTIFICATION_SOUND', soundUrl });
                client.postMessage({
                  type: 'SHOW_IN_APP_NOTIFICATION',
                  title, body, icon, badge, image, tag: tag, url: urlToOpen,
                  priority, soundUrl,
                });
              });
            }
          });
      })
      .catch((err) => console.error('[SW Push] Error showNotification:', err))
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION CLICK — Deep linking con message passing al SPA
// ═══════════════════════════════════════════════════════════════════════════

self.addEventListener('notificationclick', (event) => {
  console.log('[SW Click] Notificación clickeada:', event.notification.data);
  event.notification.close();
  if (event.action === 'close') {
    console.log('[SW Click] Acción "close" — ignorando');
    return;
  }

  const targetUrl = event.notification.data?.url || '/';
  const rawTag = event.notification.data?.tag || '';
  const notifId = rawTag.replace(/^marketcoffee-/, '');
  console.log('[SW Click] targetUrl:', targetUrl, 'notifId:', notifId);

  // Track click event
  if (notifId) {
    fetch('/api/marketing/track-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notification_id: notifId,
        event_type: 'clicked',
        anonymous_id: ''
      })
    }).catch(() => {});
  }

  const deepLink = resolveDeepLink(targetUrl);
  console.log('[SW Click] Deep link resuelto:', deepLink);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        console.log('[SW Click] Clientes disponibles:', clientList.length);
        // Buscar ventana existente del mismo dominio
        for (const client of clientList) {
          if ('focus' in client && client.url.includes(self.location.origin)) {
            console.log('[SW Click] Enviando deep link a cliente:', client.url);
            // Enviar deep link al SPA para que navegue al modal/vista correcta
            client.postMessage({
              type: 'NOTIFICATION_CLICKED',
              deepLink,
              targetUrl,
              notificationId: notifId
            });
            client.navigate(deepLink.spa_route);
            return client.focus();
          }
        }
        // Abrir nueva ventana con la ruta correcta
        console.log('[SW Click] No se encontró cliente existente — abriendo nueva ventana');
        return self.clients.openWindow(deepLink.spa_route);
      })
      .catch((err) => console.error('[SW Click] Error en notificationclick:', err))
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION CLOSE — Tracking de dismissals (RFC 8030)
// ═══════════════════════════════════════════════════════════════════════════

self.addEventListener('notificationclose', (event) => {
  const rawTag = event.notification.data?.tag || '';
  const notifId = rawTag.replace(/^marketcoffee-/, '');
  console.log('[SW Close] Notificación cerrada/dismissed:', notifId);

  if (notifId) {
    fetch('/api/marketing/track-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notification_id: notifId,
        event_type: 'dismissed',
        anonymous_id: ''
      })
    }).catch(() => {});
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PUSH SUBSCRIPTION CHANGE — Renovación automática (RFC 8030 §6.2)
// ═══════════════════════════════════════════════════════════════════════════

self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] pushsubscriptionchange disparado');
  console.log('[SW] Old subscription:', event.oldSubscription?.endpoint?.substring(0, 50));

  const subscribeOptions = {
    userVisibleOnly: true,
  };
  if (vapidPublicKey) {
    try {
      subscribeOptions.applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
    } catch (e) {
      console.error('[SW] VAPID key invalida para pushsubscriptionchange:', e);
    }
  }

  event.waitUntil(
    self.registration.pushManager.subscribe(subscribeOptions)
      .then((newSubscription) => {
        console.log('[SW] Nueva suscripción obtenida:', newSubscription.endpoint.substring(0, 50));
        // Enviar la nueva suscripción al backend
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then((clients) => {
            // Notificar a todos los clientes abiertos para que re-registren la suscripción
            clients.forEach((client) => {
              client.postMessage({
                type: 'PUSH_SUBSCRIPTION_CHANGED',
                newEndpoint: newSubscription.endpoint
              });
            });
            // También intentar registrar directamente
            return fetch('/api/register-subscription', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                endpoint: newSubscription.endpoint,
                keys: {
                  p256dh: arrayBufferToBase64url(newSubscription.getKey('p256dh')),
                  auth: arrayBufferToBase64url(newSubscription.getKey('auth'))
                },
                old_endpoint: event.oldSubscription ? event.oldSubscription.endpoint : undefined
              })
            });
          });
      })
      .catch((err) => {
        console.error('[SW] Error en pushsubscriptionchange:', err);
      })
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════

function arrayBufferToBase64url(buffer) {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// ─── VAPID key para pushsubscriptionchange ───
let vapidPublicKey = '';

// ─── Message handler ───
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SET_VAPID_PUBLIC_KEY') {
    vapidPublicKey = event.data.vapidPublicKey || '';
  }

  if (event.data?.type === 'SET_ANONYMOUS_ID') {
    self._anonymous_id = event.data.anonymous_id;
  }

  if (event.data?.type === 'CONFIG_UPDATED') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clients) => clients.forEach((c) => c.postMessage({ type: 'CONFIG_UPDATED' })))
    );
  }

  if (event.data?.type === 'CLEAR_ASSETS_CACHE') {
    const CURRENT_CACHE = 'workbox-precache-v2';
    event.waitUntil(
      caches.keys().then((names) =>
        Promise.all(names.filter((n) => n !== CURRENT_CACHE).map((n) => caches.delete(n)))
      ).then(() => {
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then((clients) => clients.forEach((c) => c.postMessage({ type: 'ASSETS_CACHE_CLEARED' })));
      })
    );
  }

  // El SPA solicita deep link processing
  if (event.data?.type === 'NAVIGATE_TO_DEEP_LINK') {
    const deepLink = resolveDeepLink(event.data.url);
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clients) => {
          for (const client of clients) {
            if ('focus' in client) {
              client.postMessage({
                type: 'NOTIFICATION_CLICKED',
                deepLink,
                targetUrl: event.data.url
              });
              return client.focus();
            }
          }
        })
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// BACKGROUND SYNC: Cola offline para POSTs
// ═══════════════════════════════════════════════════════════════════════════
const QUEUE_NAME = 'marketcoffee-offline-queue';
const QUEUE_STORE = 'reqs';
const DB_NAME = 'marketcoffee-offline-db';

function openQueueDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withQueueStore(mode, fn) {
  return openQueueDB().then((db) =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, mode);
      const store = tx.objectStore(QUEUE_STORE);
      const result = fn(store);
      tx.oncomplete = () => resolve(result?.result !== undefined ? result.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    })
  );
}

function enqueueRequest(request) {
  const entry = { url: request.url, method: request.method, ts: Date.now() };
  return withQueueStore('readwrite', (store) => {
    store.add(entry);
  }).catch(() => true);
}

function replayQueue() {
  return openQueueDB().then((db) =>
    new Promise((resolve) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const entries = req.result || [];
        Promise.all(
          entries.map((entry) =>
            fetch(entry.url, {
              method: entry.method,
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' }
            })
              .then(() => store.delete(entry.id))
              .catch(() => {})
          )
        ).then(() => resolve());
      };
      tx.onerror = () => resolve();
    })
  ).catch(() => {});
}

// Interceptar POSTs offline
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method === 'POST' && req.url.indexOf('/api/') !== -1) {
    event.respondWith(
      fetch(req).catch(() => {
        return enqueueRequest(req)
          .then(() => new Response(JSON.stringify({ queued: true }), { headers: { 'Content-Type': 'application/json' } }))
          .catch(() => new Response(JSON.stringify({ queued: true }), { headers: { 'Content-Type': 'application/json' } }));
      })
    );
  }
});

// Background Sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'marketcoffee-queue') {
    event.waitUntil(replayQueue());
  }
});

self.addEventListener('online', () => {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.sync) {
        reg.sync.register('marketcoffee-queue').catch(() => {});
      }
    });
  }
});
