// WildVet Service Worker — offline-first
const SHELL_CACHE = 'wildvet-shell-v4';
const CDN_CACHE   = 'wildvet-cdn-v4';

const SHELL_ASSETS = ['/', '/index.html', '/manifest.json'];

const CDN_ASSETS = [
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js',
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap'
];

// INSTALL: cachear app shell y SDKs externos
self.addEventListener('install', e => {
  e.waitUntil(Promise.all([
    caches.open(SHELL_CACHE).then(cache =>
      cache.addAll(SHELL_ASSETS).catch(() => {})
    ),
    caches.open(CDN_CACHE).then(cache =>
      Promise.allSettled(CDN_ASSETS.map(url =>
        fetch(url, { mode: 'cors' })
          .then(r => { if (r.ok) cache.put(url, r.clone()); })
          .catch(() => {})
      ))
    )
  ]));
  self.skipWaiting();
});

// ACTIVATE: eliminar caches viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL_CACHE && k !== CDN_CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// FETCH: estrategia según origen
self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (e.request.method !== 'GET') return;

  // Dejar pasar llamadas a APIs de Firebase (datos en tiempo real)
  if (url.includes('firestore.googleapis.com') ||
      url.includes('googleapis.com/identitytoolkit') ||
      url.includes('securetoken.googleapis.com') ||
      url.includes('identitytoolkit.googleapis.com')) {
    return;
  }

  // SDKs Firebase y fuentes: Cache First
  if (url.includes('gstatic.com') || url.includes('fonts.google')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(r => {
          if (r && r.status === 200)
            caches.open(CDN_CACHE).then(c => c.put(e.request, r.clone()));
          return r;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // App shell: Network First con fallback a cache
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r && r.status === 200)
          caches.open(SHELL_CACHE).then(c => c.put(e.request, r.clone()));
        return r;
      })
      .catch(() =>
        caches.match(e.request).then(cached =>
          cached || caches.match('/index.html')
        )
      )
  );
});
