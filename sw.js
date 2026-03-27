// WildVet Service Worker v6 — GitHub Pages compatible
const SHELL_CACHE = 'wildvet-shell-v6';
const CDN_CACHE   = 'wildvet-cdn-v6';
const OLD_CACHES  = [
  'wildvet-shell-v5','wildvet-cdn-v5',
  'wildvet-shell-v4','wildvet-cdn-v4',
  'wildvet-shell-v3','wildvet-cdn-v3'
];

const SHELL_ASSETS = [
  '/wildvet/',
  '/wildvet/index.html',
  '/wildvet/manifest.json',
  '/wildvet/sw.js'
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
      caches.open(SHELL_CACHE).then(cache =>
        Promise.allSettled(SHELL_ASSETS.map(url => cache.add(url).catch(() => {})))
      ),
      caches.open(CDN_CACHE).then(cache =>
        Promise.allSettled(CDN_ASSETS.map(url => cache.add(url).catch(() => {})))
      )
    ])
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => OLD_CACHES.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  const { pathname } = new URL(url);

  // No interceptar Firebase, APIs, OAuth
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('identitytoolkit.googleapis.com') ||
    url.includes('securetoken.googleapis.com') ||
    url.includes('anthropic.com') ||
    url.includes('generativelanguage.googleapis.com') ||
    url.includes('apis.google.com') ||
    url.includes('accounts.google.com') ||
    url.includes('gstatic.com/recaptcha') ||
    url.includes('firebaseapp.com/__/auth')
  ) { return; }

  // CDN — Cache First
  const isCDN = CDN_ASSETS.some(a => url.split('?')[0] === a.split('?')[0] || url.startsWith(a.split('?')[0]));
  if (isCDN) {
    e.respondWith(
      caches.match(e.request)
        .then(cached => cached || fetch(e.request).then(resp => {
          if (resp.ok) caches.open(CDN_CACHE).then(c => c.put(e.request, resp.clone()));
          return resp;
        }))
    );
    return;
  }

  // App Shell — cualquier ruta bajo /wildvet
  // Incluye: /wildvet, /wildvet/, /wildvet/index.html, /wildvet/manifest.json
  if (pathname === '/wildvet' || pathname.startsWith('/wildvet/')) {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          if (resp.ok) caches.open(SHELL_CACHE).then(c => c.put(e.request, resp.clone()));
          return resp;
        })
        .catch(() =>
          caches.match(e.request)
            .then(cached => cached || caches.match('/wildvet/index.html'))
            .then(cached => cached || caches.match('/wildvet/'))
        )
    );
  }
});
