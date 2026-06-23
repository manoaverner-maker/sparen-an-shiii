/* =====================================================================
   service-worker.js  ·  Macht Sparkurs offline-faehig
   =====================================================================
   WOFUER IST DIESE DATEI DA?
   Ein Service Worker ist ein kleines Hintergrund-Programm des Browsers.
   Er faengt alle Datei-Anfragen der App ab und liefert sie aus einem
   lokalen Zwischenspeicher ("Cache"). Dadurch:
     - startet die App auch ganz ohne Internet
     - laedt sie blitzschnell
     - laesst sie sich aufs iPhone/Desktop wie eine echte App installieren

   WICHTIG: Service Worker laufen NUR ueber https:// oder localhost,
   NICHT wenn du die index.html per Doppelklick (file://) oeffnest.

   WENN DU DEN CODE AENDERST: erhoehe die Zahl in CACHE_NAME (z.B. v2),
   damit der Browser die neuen Dateien laedt statt der alten.
   ===================================================================== */

const CACHE_NAME = 'sparkurs-v9';

/* Alle Dateien, die fuer den Offline-Betrieb gebraucht werden.
   Pfade relativ ("./"), damit es auch in einem Unterordner (GitHub Pages)
   funktioniert. */
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/defaults.js',
  './js/icons.js',
  './js/storage.js',
  './js/budget.js',
  './js/charts.js',
  './js/markets.js',
  './js/ai.js',
  './js/ui.js',
  './js/app.js',
  './assets/logo.svg',
  './assets/favicon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
  './assets/apple-touch-icon.png'
];

/* INSTALLIEREN: beim ersten Aufruf alle Dateien in den Cache legen. */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // addAll bricht ab, falls eine Datei fehlt – wir nehmen es einzeln,
      // damit eine fehlende Icon-Datei die Installation nicht verhindert.
      return Promise.all(ASSETS.map(function (url) {
        return cache.add(url).catch(function () { /* einzelne Datei ignorieren */ });
      }));
    })
  );
  // Neue Version SOFORT uebernehmen -> Updates kommen zuverlaessig an (gerade
  // als PWA auf dem iPhone). Nach dem Wechsel zeigt die App ein dezentes
  // "Neue Version"-Banner zum Neuladen (siehe app.js, controllerchange).
  self.skipWaiting();
});

/* AKTIVIEREN: alte Caches (fruehere Versionen) aufraeumen. */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE_NAME) return caches.delete(k);
      }));
    })
  );
  self.clients.claim();
});

/* ABFRAGEN: zuerst im Cache nachsehen (schnell + offline), sonst Netz.
   Was neu aus dem Netz kommt, wird gleich mitgespeichert. */
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  // Fremde Server (CoinGecko, Anthropic) NICHT abfangen – die gehen immer
  // direkt ans Netz; wir kuemmern uns nur um die eigenen App-Dateien.
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then(function (treffer) {
      if (treffer) return treffer; // aus dem Cache
      return fetch(event.request).then(function (antwort) {
        // gueltige Antworten zusaetzlich in den Cache legen
        if (antwort && antwort.status === 200 && antwort.type === 'basic') {
          const kopie = antwort.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, kopie); });
        }
        return antwort;
      }).catch(function () {
        // Offline und nicht im Cache: bei Seitenaufrufen die Startseite zeigen
        if (event.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
