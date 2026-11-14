/* Atmos Studio — service worker
   Automatsko ažuriranje: promeni VERSION (i VER u index.html) pri svakom izdanju.
   Pregledač proverava sw.js na serveru; kad se bajtovi razlikuju, nova verzija se preuzme u pozadini,
   a aplikacija prikaže traku „Osveži“. */
const VERSION = '1.2.5';
const CACHE = 'atmos-studio-' + VERSION;
const ASSETS = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'icon-maskable.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))
  ));
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith('atmos-studio-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  if (req.mode === 'navigate') {
    /* stranica: prvo mreža (najnovija verzija), ali najviše 3 s — na slabom internetu otvara se sačuvana kopija,
       a nova se preuzme u pozadini i stiže pri sledećem otvaranju. Bez interneta: odmah sačuvana kopija. */
    e.respondWith((async () => {
      const net = fetch(req, { cache: 'no-cache' }).then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); }
        return res;
      });
      const saved = (await caches.match('index.html')) || (await caches.match('./'));
      if (!saved) return net;
      e.waitUntil(net.catch(() => {}));
      return Promise.race([
        net.then(res => (res && res.ok ? res : saved), () => saved),
        new Promise(r => setTimeout(() => r(saved), 3000))
      ]);
    })());
    return;
  }

  /* ostalo: iz keša, uz osvežavanje u pozadini */
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const act = (e.notification.data && e.notification.data.act) || '';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      if (cs.length) { cs[0].postMessage({ type: 'notif', act }); return cs[0].focus(); }
      return self.clients.openWindow('./index.html' + (act ? '?n=' + encodeURIComponent(act) : ''));
    })
  );
});
