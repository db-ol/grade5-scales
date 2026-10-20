/*
 * Offline support. Every request goes to the network first (revalidated, so a new deploy
 * never mixes new and old files) and falls back to the cache when offline.
 * Only this app's own caches are touched, because other GitHub Pages projects share the origin.
 */
var PREFIX = 'g5-scales-';
var VERSION = PREFIX + 'v3';
var FILES = [
  './',
  'index.html',
  'css/style.css',
  'js/theory.js',
  'js/syllabus.js',
  'js/speech.js',
  'js/audio.js',
  'js/keyboard.js',
  'js/app.js',
  'fonts/bodoni-moda-subset.woff2',
  'fonts/bodoni-moda-italic-subset.woff2',
  'fonts/noto-music-accidentals.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'manifest.webmanifest'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(VERSION).then(function (cache) {
      return cache.addAll(FILES.map(function (f) { return new Request(f, { cache: 'reload' }); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k.indexOf(PREFIX) === 0 && k !== VERSION;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // A navigation Request cannot be copied with options, so pages are fetched by URL.
  // redirect 'manual' hands any host redirect (a custom domain, say) back to the browser.
  var net = req.mode === 'navigate'
    ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin', redirect: 'manual' })
    : fetch(req, { cache: 'no-cache' });
  event.respondWith(
    net.then(function (res) {
      if (res.ok) {
        var copy = res.clone();
        caches.open(VERSION).then(function (cache) { cache.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('index.html');
        return Response.error();
      });
    })
  );
});
