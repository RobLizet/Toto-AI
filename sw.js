// ProMatchXI Service Worker v25.2 — Cache bust bij elke deploy
const SW_VERSION = '36.378'; // v26.378: SW mee omhoog (cache-name reset) bij FAB auto-hide + value-edge %->pp in de frontend; geen SW-logica gewijzigd. // v26.377: SW mee omhoog (cache-name reset) bij de firebase-verplaatsing uit de <head> in index.html; geen SW-logica gewijzigd. // v26.376: seizoensbug deel 2 -- scanAllTodayValue (SCAN 3 DAGEN/VANDAAG/MORGEN) + odds-fallbacks naar seizoenVoorComp (worker-bron) i.p.v. de driftende lijst; 14 van 19 foute competities daarmee gefixt. SW mee omhoog (cache-first HTML/JS). // v26.375: seizoensbug in de analyse -- standings/teamstats kwamen uit vorig seizoen (KKD/Eredivisie-start). Seizoen nu uit de fixture (api.js), nieuw-seizoen-melding bij ronde 1 (analyse.js), geen valse rang-motivatie bij 0 duels (football.js). SW mee omhoog (cache-first HTML/JS). // v26.374: Analyse-schakelaar clubtijdperk/alle picks (worker v318 club-bron). SW mee omhoog (cache-first). // v26.373: Value-Picks-tab als opvallende gouden pill. SW mee omhoog (cache-first). // v26.372: Wedstrijden-scherm scrollbare categorie-tabs + favorieten-tab + opvallende Value-Picks-tab. SW mee omhoog (cache-first). // v26.371: Europese-beker-iconen naar een rustige teal glyph (rust op het Wedstrijden-scherm). SW mee omhoog (cache-first). // v26.370: categorie-kopjes in de wedstrijdenlijst inklapbaar. SW mee omhoog (cache-first). // v26.369: wedstrijdenlijst per categorie gescheiden + blauwe knop naar teal. SW mee omhoog (cache-first). // v26.368: club-hitrate op break-even gekleurd (worker v317 gem_odds). SW_VERSION mee omhoog (cache-first). // v26.367: dashboard-held omgedraaid (clubtijdperk = held) + break-even-kleuren + inklapbare details. SW_VERSION mee omhoog want sw.js serveert HTML/JS cache-first. // v26.366: bovenste voortgang-balk leest nu als 'alle picks incl. WK/kwalificatie' (optie B), subregel op het dashboard. SW_VERSION mee omhoog want sw.js serveert HTML/JS cache-first. // v26.365: value-picks-kaart met inline !important (won niet van new-theme.css). SW_VERSION mee omhoog (cache-first). // // v26.364: echte Value Picks-subtab kleurrijker. SW_VERSION mee omhoog (cache-first). // // v26.363: value-picks-tabblad kleurrijker + 'nog niet gescand' opvallend. SW_VERSION mee omhoog (cache-first HTML/JS). // // v26.362: 'gescand'-status op de wedstrijdtegels (worker v316 /analysed). SW_VERSION mee omhoog want sw.js serveert HTML/JS cache-first -- zonder bump zou de nieuwe wedstrijden.js/state.js nooit op het toestel verschijnen. // v26.361: MARKT-badge helemaal weg (tip-hoekje alleen nog echte value/model-picks)
const CACHE = 'totoai-' + SW_VERSION;

self.addEventListener('install', e => { self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('api-sports') ||
      e.request.url.includes('anthropic') ||
      e.request.url.includes('firebase') ||
      e.request.url.includes('workers.dev') ||
      e.request.url.includes('googleapis')) return;
  // JS/CSS bestanden altijd network-first — nooit stale cache
  if (e.request.url.match(/\.(js|css)(\?|$)/)) {
    e.respondWith(
      fetch(e.request)
        .then(r => { const c = r.clone(); caches.open(CACHE).then(cache => cache.put(e.request, c)); return r; })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(caches.match(e.request).then(c => c || fetch(e.request)));
});

// ── Standaard Web Push ────────────────────────────────
self.addEventListener('push', e => {
  console.log('[SW] Push ontvangen!');
  if (!e.data) return;
  let payload;
  try { payload = e.data.json(); }
  catch(err) { payload = { title: '⚡ ProMatchXI', body: e.data.text() }; }

  const title = payload.notification?.title || payload.title || '⚡ ProMatchXI';
  const body  = payload.notification?.body  || payload.body  || '';
  const data  = payload.data || {};

  e.waitUntil(
    self.registration.showNotification(title, {
      body, icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'totoai',
      requireInteraction: true,
      data
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      for (const w of wins) {
        if (w.url.includes(self.location.origin) && 'focus' in w) { w.focus(); return; }
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

