// ═══════════════════════════════════════════════════════════════════════════
// Service Worker: Market Coffee Sweet — Push Notifications + Offline Queue
// ═══════════════════════════════════════════════════════════════════════════

// ─── Lifecycle ───
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ─── SPA Navigation Handler ───
// Let browser handle popstate (back/forward) natively; only intercept regular navigations
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate' && event.request.method === 'GET') {
    const url = new URL(event.request.url);
    if (url.pathname.startsWith('/api/')) return;
    // For same-origin navigations triggered by back/forward, let the browser handle it
    if (event.request.destination === 'document') {
      event.respondWith(
        caches.open('workbox-precache-v2').then((cache) => {
          return cache.match('/index.html').then((cached) => {
            if (cached) return cached;
            return fetch(event.request, { redirect: 'follow' }).catch(() => {
              return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/html' } });
            });
          });
        })
      );
    }
  }
});

// ─── Push Notifications ───
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
  if (!event.data) {
    console.warn('[SW Push] Evento push sin payload');
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    console.error('[SW Push] Payload JSON inválido:', e);
    return;
  }

  const title     = payload.titulo  || payload.title  || 'Market Coffee Sweet';
  const body      = payload.mensaje || payload.body   || '';
  const icon      = payload.icon   || '/icon.png';
  const badge     = payload.badge  || '/icon.png';
  const image     = payload.imagen_url || payload.image || undefined;
  const urlToOpen = payload.link_url || payload.url || '/';
  const tag       = payload.tag || ('marketcoffee-' + (payload.id || Date.now()));
  const soundUrl  = payload.sound_url || payload.sound || '/sounds/notification.wav';
  const priority  = payload.priority || 'normal';

  // Deduplicación: ignorar notificaciones duplicadas en ventana de 60s
  if (recentlyShown.has(tag)) {
    const elapsed = Date.now() - recentlyShown.get(tag);
    if (elapsed < DEDUP_TTL_MS) {
      console.log('[SW Push] Deduplicada:', tag);
      return;
    }
  }
  recentlyShown.set(tag, Date.now());
  pruneDedupCache();

  // Tag visual único por entrega para evitar colapso en barra de notificaciones
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

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => {
        // Notificar a clientes activos para reproducir sonido in-app
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then((clients) => {
            clients.forEach((client) => {
              client.postMessage({ type: 'PLAY_NOTIFICATION_SOUND', soundUrl });
            });
          });
      })
      .catch((err) => console.error('[SW Push] Error showNotification:', err))
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  const targetUrl = event.notification.data?.url || '/';
  const rawTag = event.notification.data?.tag || '';
  const notifId = rawTag.replace(/^marketcoffee-/, '');

  // Track click event
  if (notifId) {
    fetch('/api/marketing/track-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notification_id: notifId,
        event_type: 'clicked',
        anonymous_id: self._anonymous_id || ''
      })
    }).catch(() => {});
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Buscar ventana existente del mismo dominio
        for (const client of clientList) {
          if ('focus' in client) {
            if (client.url.includes(self.location.origin)) {
              client.navigate(targetUrl);
              return client.focus();
            }
          }
        }
        // Abrir nueva ventana si no hay ninguna activa
        return self.clients.openWindow(targetUrl);
      })
      .catch(() => {})
  );
});

// ─── Message handler ───
self.addEventListener('message', (event) => {
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
    event.waitUntil(
      caches.keys().then((names) =>
        Promise.all(names.filter((n) => n.includes('images') || n.includes('supabase')).map((n) => caches.delete(n)))
      ).then(() => {
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then((clients) => clients.forEach((c) => c.postMessage({ type: 'ASSETS_CACHE_CLEARED' })));
      })
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Background Sync: cola offline para POSTs (pedidos, registro, eventos)
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
  return withQueueStore('readwrite', (store) => {
    const req = store.getAll();
    req.onsuccess = () => {
      Promise.all((req.result || []).map((entry) =>
        fetch(entry.url, {
          method: entry.method,
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' }
        })
          .then(() => store.delete(entry.id))
          .catch(() => {})
      ));
    };
  }).catch(() => {});
}

// Interceptar POSTs offline
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method === 'POST' && req.url.indexOf('/api/') !== -1 && !navigator.onLine) {
    event.respondWith(
      enqueueRequest(req)
        .then(() => new Response(JSON.stringify({ queued: true }), { headers: { 'Content-Type': 'application/json' } }))
        .catch(() => new Response(JSON.stringify({ queued: true }), { headers: { 'Content-Type': 'application/json' } }))
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
