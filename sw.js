// WildVet Service Worker v5 — GitHub Pages compatible
const SHELL_CACHE = 'wildvet-shell-v5';
const CDN_CACHE   = 'wildvet-cdn-v5';
const OLD_CACHES  = ['wildvet-shell-v4','wildvet-cdn-v4','wildvet-shell-v3','wildvet-cdn-v3'];

const SHELL_ASSETS = [
  '/wildvet/',
  '/wildvet/index.html',
  '/wildvet/manifest.json'
];

const CDN_ASSETS = [
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js',
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    Promise.all([
      caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_ASSETS).catch(() => {})),
      caches.open(CDN_CACHE).then(cache => cache.addAll(CDN_ASSETS).catch(() => {}))
    ])
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => OLD_CACHES.includes(k)).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // No interceptar Firebase, APIs ni autenticación
  if (url.includes('firestore.googleapis.com') ||
      url.includes('identitytoolkit.googleapis.com') ||
      url.includes('securetoken.googleapis.com') ||
      url.includes('anthropic.com') ||
      url.includes('generativelanguage.googleapis.com') ||
      url.includes('apis.google.com')) {
    return;
  }

  // CDN — Cache First
  if (CDN_ASSETS.some(a => url.startsWith(a.substring(0, a.indexOf('?') > 0 ? a.indexOf('?') : a.length)))) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
        const clone = resp.clone();
        caches.open(CDN_CACHE).then(c => c.put(e.request, clone));
        return resp;
      }))
    );
    return;
  }

  // App shell — Network First con fallback a cache
  if (url.includes('/wildvet/') || url.endsWith('/wildvet')) {
    e.respondWith(
      fetch(e.request).then(resp => {
        const clone = resp.clone();
        caches.open(SHELL_CACHE).then(c => c.put(e.request, clone));
        return resp;
      }).catch(() => caches.match(e.request).then(cached => cached || caches.match('/wildvet/index.html')))
    );
  }
});
