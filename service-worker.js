// Adapted from the service worker supplied with this project.
const CACHE_PREFIX = 'courtside-cache-';
const CACHE_NAME = CACHE_PREFIX + 'v3';
const FILES_TO_CACHE = [ './', './index.html', './manifest.json', './assets/icon-192.png', './assets/icon-512.png', './stats.js', './storage.js', './app.js', './styles.css' ];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).catch(error => {
    if (event.request.mode === 'navigate') return caches.match('./index.html');
    throw error;
  })));
});
