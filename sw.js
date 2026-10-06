/*
 * Service worker : garde Cube Malin sur l'appareil pour qu'il marche sans internet.
 * - « core » : l'appli elle-même. Servie depuis le cache, mise à jour en arrière-plan
 *   (une nouvelle version arrive au lancement suivant).
 * - « voix » : les phrases enregistrées. Elles ne changent jamais (le nom du fichier dépend
 *   du texte), donc le cache d'abord. L'appli les télécharge toutes avec le bouton « Télécharger ».
 * Changer CORE (v2, v3…) quand la liste CORE_FILES change.
 */
'use strict';
var CORE = 'cube-malin-core-v1';
var VOIX = 'cube-malin-voix';
var CORE_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/fonts.css',
  'css/style.css',
  'fonts/atkinson-400.woff2',
  'fonts/atkinson-700.woff2',
  'fonts/baloo2.woff2',
  'js/vendor/three.min.js',
  'js/cube.js',
  'js/lessons.js',
  'js/voice-files.js',
  'js/view3d.js',
  'js/app.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CORE)
      .then(function (c) { return c.addAll(CORE_FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) {
          return k.indexOf('cube-malin-core') === 0 && k !== CORE;
        }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

function store(cacheName, req, res) {
  if (res && res.status === 200 && res.type === 'basic') {
    var copy = res.clone();
    caches.open(cacheName).then(function (c) { c.put(req, copy); });
  }
  return res;
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.indexOf('/audio/voix/') !== -1) {
    e.respondWith(
      caches.open(VOIX).then(function (c) {
        return c.match(req, { ignoreSearch: true }).then(function (hit) {
          return hit || fetch(req).then(function (res) { return store(VOIX, req, res); });
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.open(CORE).then(function (c) {
      return c.match(req, { ignoreSearch: true }).then(function (hit) {
        var fresh = fetch(req).then(function (res) { return store(CORE, req, res); });
        if (hit) {
          e.waitUntil(fresh.catch(function () { /* hors ligne : on garde le cache */ }));
          return hit;
        }
        return fresh.catch(function () {
          // Hors ligne et pas en cache : pour une page, on renvoie l'appli.
          if (req.mode === 'navigate') return c.match('index.html');
          return Response.error();
        });
      });
    })
  );
});
