/* Kuembu Village Demographics - service worker
   Enables install (Add to Home screen / Install app) and basic offline load. */
const CACHE = 'kuembu-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon-32.png'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // Cache what we can; ignore any single asset that 404s so install never fails.
      return Promise.all(ASSETS.map(function (url) {
        return c.add(url).catch(function () { return null; });
      }));
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  // Never cache Firebase / Google API traffic - always go to network for live data.
  var url = req.url;
  if (url.indexOf('firestore') !== -1 || url.indexOf('firebase') !== -1 ||
      url.indexOf('googleapis') !== -1 || url.indexOf('gstatic') !== -1) {
    return; // let the browser handle it normally
  }
  // Network-first for the HTML page so updates show up; fall back to cache offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (resp) {
        var copy = resp.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return resp;
      }).catch(function () { return caches.match('./index.html'); })
    );
    return;
  }
  // Cache-first for same-origin static assets.
  e.respondWith(
    caches.match(req).then(function (cached) {
      return cached || fetch(req).then(function (resp) {
        var copy = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy).catch(function () {}); });
        return resp;
      }).catch(function () { return cached; });
    })
  );
});
