const STATIC_CACHE = 'carreta-static-v1';
const DYNAMIC_CACHE = 'carreta-dynamic-v1';

// ← REQUERIDO por vite-plugin-pwa injectManifest
const WB_MANIFEST = self.__WB_MANIFEST || [];

// ─── INSTALL ───────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // Cachear los assets que Vite inyecta automáticamente
      const urls = WB_MANIFEST.map((entry) => entry.url);
      return cache.addAll([...urls, '/', '/index.html', '/manifest.json']);
    })
  );
  self.skipWaiting();
});

// ─── ACTIVATE ──────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ─── FETCH ─────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== location.origin && !url.hostname.includes('supabase')) return;

  // API / Supabase: Network first
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Assets estáticos: Cache first
  if (['script', 'style', 'image', 'font'].includes(request.destination)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Navegación SPA: Network first, fallback index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

// ─── ESTRATEGIAS ───────────────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: 'Sin conexión', offline: true }),
      { headers: { 'Content-Type': 'application/json' }, status: 503 }
    );
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  return cached || fetchPromise;
}

// ─── BACKGROUND SYNC ───────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-cargas') {
    event.waitUntil(syncCargas());
  }
});

async function syncCargas() {
  const db = await openDB();
  const pendientes = await getPendientes(db);
  for (const item of pendientes) {
    try {
      await fetch('/api/cargas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.data),
      });
      await deletePendiente(db, item.id);
    } catch {
      console.log('[SW] Sync fallido, reintentará luego');
    }
  }
}

// ─── PUSH NOTIFICATIONS ────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Carreta', {
      body: data.body || 'Nueva actividad en Carreta',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      data: { url: data.url || '/' },
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});

// ─── INDEXEDDB HELPERS ─────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('carreta-offline', 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('pendientes', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getPendientes(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendientes', 'readonly');
    const req = tx.objectStore('pendientes').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function deletePendiente(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendientes', 'readwrite');
    const req = tx.objectStore('pendientes').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
