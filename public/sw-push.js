// Custom Push Notifications Service Worker Extension for Marketo PWA
// Loaded via workbox importScripts (generateSW strategy)

// ─── SPA Navigation Handler ───
// Intercept navigation requests to prevent redirect errors from the server.
// Serves index.html from cache for all SPA navigation routes.
self.addEventListener('fetch', function(event) {
  if (event.request.mode === 'navigate' && event.request.method === 'GET') {
    var url = new URL(event.request.url);
    if (url.pathname.startsWith('/api/')) return;
    event.respondWith(
      caches.open('workbox-precache-v2').then(function(cache) {
        return cache.match('/index.html').then(function(cached) {
          if (cached) return cached;
          return caches.match('/index.html').then(function(c2) {
            if (c2) return c2;
            return fetch(event.request, { redirect: 'follow' }).catch(function() {
              return caches.match('/offline.html');
            });
          });
        });
      })
    );
  }
});

function clearAssetsCache() {
  return caches.keys().then(function(names) {
    return Promise.all(names.map(function(n) {
      if (n.includes('images') || n.includes('supabase') || n.includes('manifest')) return caches.delete(n);
    }));
  });
}

function notifyClients(type) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients) {
    clients.forEach(function(c) { c.postMessage({ type: type }); });
  });
}

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

self.addEventListener('push', function(event) {
  try {
    if (!event.data) {
      console.warn('[SW Push] Evento push recibido sin payload de datos.');
      return;
    }

    const payload = event.data.json();
    console.log('[SW Push] Notificación recibida:', payload);

    const title     = payload.titulo  || payload.title  || 'Marketo Supermercado';
    const body      = payload.mensaje || payload.body   || '';
    const icon      = payload.icon   || payload.badge || '/icon.png';
    const badge     = '/icon.png';
    const image     = payload.imagen_url || payload.image || undefined;
    const urlToOpen = payload.link_url || payload.url || '/';
    const tag       = payload.tag || ('marketcoffee-' + String(payload.id || Date.now()));
    // Tag de VISUALIZACION unico por entrega: evita que el navegador colapse/reemplace
    // una notificacion de estado mientras la anterior aun esta en pantalla
    // (con requireInteraction). El dedup logico sigue por `payload.tag`.
    const displayTag = tag + '::' + Date.now();
    const soundUrl  = payload.sound_url || payload.sound || '/sounds/notification.mp3';

    const tagKey = tag;
    if (recentlyShown.has(tagKey)) {
      const elapsed = Date.now() - recentlyShown.get(tagKey);
      if (elapsed < DEDUP_TTL_MS) {
        console.log('[SW Push] Deduplicada notificación con tag:', tagKey);
        return;
      }
    }
    recentlyShown.set(tagKey, Date.now());
    pruneDedupCache();

    const options = {
      body: body,
      icon: icon,
      badge: badge,
      image: image,
      vibrate: [200, 100, 200],
      tag: displayTag,
      renotify: true,
      requireInteraction: true,
      silent: false,
      data: { url: urlToOpen, tag: tag, displayTag: displayTag, soundUrl: soundUrl },
      actions: [
        { action: 'open',  title: 'Ver Detalles' },
        { action: 'close', title: 'Cerrar' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(title, options).then(function() {
        return self.clients
          .matchAll({ type: 'window', includeUncontrolled: true })
          .then(function(clients) {
            clients.forEach(function(client) {
              client.postMessage({ type: 'PLAY_NOTIFICATION_SOUND', soundUrl: soundUrl });
            });
          });
      })
    );
  } catch (error) {
    console.error('[SW Push] Error procesando evento push:', error);
  }
});

self.addEventListener('notificationclick', function(event) {
  try {
    event.notification.close();
    if (event.action === 'close') return;

    const targetUrl = event.notification.data?.url || '/';
    const rawTag = event.notification.data?.tag || '';
    const notifId = rawTag.replace(/^marketcoffee-/, '');

    // Track click event via fetch
    if (notifId) {
      fetch('/api/marketing/track-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notification_id: notifId,
          event_type: 'clicked',
          anonymous_id: self._anonymous_id || ''
        })
      }).catch(function() {});
    }

    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
        for (const client of clientList) {
          if ('focus' in client) {
            if (client.navigate) client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
    );
  } catch (error) {
    console.error('[SW Push] Error en clic de notificación:', error);
  }
});

// ─── Message handler ───
self.addEventListener('message', function(event) {
  if (event.data?.type === 'PUSH_CLIENT_ERROR') {
    console.error('[SW Push] Error reportado desde el cliente:', event.data.error);
  }

  if (event.data?.type === 'SET_ANONYMOUS_ID') {
    self._anonymous_id = event.data.anonymous_id;
  }

  // Notificar actualización de config desde el admin
  if (event.data?.type === 'CONFIG_UPDATED') {
    console.log('[SW Push] Config actualizada desde el admin');
    event.waitUntil(notifyClients('CONFIG_UPDATED'));
  }

  // Limpiar caches de imágenes
  if (event.data?.type === 'CLEAR_ASSETS_CACHE') {
    console.log('[SW Push] Limpiando caches de assets...');
    event.waitUntil(
      clearAssetsCache().then(function() {
        return notifyClients('ASSETS_CACHE_CLEARED');
      })
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Background Sync: cola offline para acciones POST (pedidos, registro o eventos)
// ═══════════════════════════════════════════════════════════════════════════
const QUEUE_NAME = 'marketcoffee-offline-queue';
const QUEUE_STORE = 'reqs';

function openQueueDB() {
  return new Promise(function(resolve, reject) {
    var req = indexedDB.open('marketcoffee-offline-db', 1);
    req.onupgradeneeded = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = function() { resolve(req.result); };
    req.onerror = function() { reject(req.error); };
  });
}

function withQueueStore(mode, fn) {
  return openQueueDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(QUEUE_STORE, mode);
      var store = tx.objectStore(QUEUE_STORE);
      var result = fn(store);
      tx.oncomplete = function() { resolve(result && result.result !== undefined ? result.result : undefined); };
      tx.onerror = function() { reject(tx.error); };
      tx.onabort = function() { reject(tx.error); };
    });
  });
}

function enqueueRequest(request) {
  // Guardar metodo y URL; el body se re-materializa usando la request en replay.
  var entry = { url: request.url, method: request.method, ts: Date.now() };
  return withQueue('readwrite', function(store) {
    store.add(entry);
  }).catch(function() {
    return true; // si falla IDB, continuar igualmente
  });
}

function replayQueue() {
  return withQueue('readwrite', function(store) {
    var req = store.getAll();
    req.onsuccess = function() {
      Promise.all((req.result || []).map(function(entry) {
        return fetch(entry.url, { method: entry.method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } })
          .then(function() { store.delete(entry.id); })
          .catch(function() { /* reintentar la proxima vez */ });
      }));
    };
  }).catch(function() { /* sin cola */ });
}

// Interceptar POSTs a la API cuando NO hay conexion temporal: encolar y responder vacio.
self.addEventListener('fetch', function(event) {
  var req = event.request;
  if (req.method === 'POST' && req.url.indexOf('/api/') !== -1 && !navigator.onLine) {
    event.respondWith(
      enqueueRequest(req).then(function() { return new Response('queued'); })
        .catch(function() { return new Response('queued'); })
    );
  }
});

// Reintentar la cola cuando vuelva la conexion (Background Sync / Periodc Sync de browser).
self.addEventListener('sync', function(event) {
  if (event.tag === 'marketcoffee-queue') {
    event.waitUntil(replayQueue());
  }
});

self.addEventListener('online', function() {
  self.registration.getTags && self.registration.getTags().then(function(tags) {
    if (tags.indexOf('marketcoffee-queue') === -1 && typeof self.registration.sync !== 'undefined') {
      self.registration.sync.register('marketcoffee-queue');
    }
  });
});
