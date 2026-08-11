// ═══════════════════════════════════════════════════════
// ROUTER.JS — switchScreen, bottom nav, back button
// v31: meer-menu verwijderd — WK2026 + Instellingen naar bottom nav
// v32: eigen sub-schermen oefennl + ekkwal (bereikbaar via knoppen in Matches, back-knop terug naar wedstrijden)
// ═══════════════════════════════════════════════════════

// ── v26.380: LAZY-LOAD van geisoleerde blad-schermen ────────────────
// Deze modules laden pas bij het EERSTE bezoek i.p.v. bij het opstarten.
// Gemeten veilig: geen eager module leest hun functies bij het laden
// (enkel guarded render-refs). wk2026 wordt bovendien omgeleid (regel hieronder)
// en oddsvergelijker zit achter een dormant flag -> die triggeren normaal nooit.
// marker = de functie die bestaat zodra de module geladen is.
var LAZY_SCREENS = {
  vvv:             { src: 'vvv.js',             marker: 'renderVVVScreen' },
  oddsvergelijker: { src: 'oddsvergelijker.js', marker: 'renderOddsvergelijkerScreen' },
  wk2026:          { src: 'wk2026.js',          marker: 'renderWK2026Screen' }
};
var _lazyPromises = {};
function ensureLazyModule(src) {
  if (_lazyPromises[src]) return _lazyPromises[src];
  _lazyPromises[src] = new Promise(function (resolve, reject) {
    var s = document.createElement('script');
    s.src = src + '?v=1786176600';
    s.onload = function () { resolve(true); };
    s.onerror = function () { _lazyPromises[src] = null; reject(new Error('lazy load mislukt: ' + src)); };
    document.body.appendChild(s);
  });
  return _lazyPromises[src];
}
function _lazyLoaderHtml() {
  return '<div style="padding:3rem 1rem;text-align:center;color:rgba(255,255,255,.5);font-family:\'IBM Plex Mono\',monospace;font-size:.65rem;letter-spacing:.05em;">laden\u2026</div>';
}
function _lazyErrHtml() {
  return '<div style="padding:2.5rem 1rem;text-align:center;color:#f87171;font-family:\'IBM Plex Mono\',monospace;font-size:.65rem;line-height:1.6;">Kon dit scherm niet laden.<br>Tik nogmaals of controleer je verbinding.</div>';
}

// switchScreen is de nieuwe naam, switchTab is de alias (legacy)
function switchScreen(name) {
  // v26.301: WK 2026-tabblad vervangen door VVV-Venlo. Alle oude wk2026-verwijzingen
  // (dashboard-tegels e.d.) worden omgeleid naar het dashboard zodat er niets crasht.
  if (name === 'wk2026') name = 'dashboard';
  if (name === 'oefennl') name = 'wedstrijden'; // v26.355: Oefenduels-tab verwijderd -> route veilig omgeleid (bewaarde/oude state)

  // v26.380: is dit een lazy-scherm dat nog niet geladen is? Toon een loader,
  // laad de module, en roep switchScreen daarna opnieuw aan (dan bestaat de
  // marker en valt hij door naar het normale render-pad hieronder).
  var _lz = LAZY_SCREENS[name];
  if (_lz && typeof window[_lz.marker] !== 'function') {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
    var _lzScreen = document.getElementById('screen-' + name);
    if (_lzScreen) { _lzScreen.classList.add('active'); _lzScreen.innerHTML = _lazyLoaderHtml(); }
    document.querySelectorAll('#bottom-nav .bnav-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.screen === name);
    });
    state.activeScreen = name;
    state.activeTab = name;
    ensureLazyModule(_lz.src)
      .then(function () { switchScreen(name); })
      .catch(function () { if (_lzScreen) _lzScreen.innerHTML = _lazyErrHtml(); });
    return;
  }

  // Verberg alle screens
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

  // Toon gevraagde screen
  const screen = document.getElementById('screen-' + name);
  if (screen) screen.classList.add('active');

  // Update bottom nav active state
  document.querySelectorAll('#bottom-nav .bnav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.screen === name);
  });

  // Update header back knop (toon alleen op sub-screens)
  const backBtn = document.getElementById('backBtn');
  const mainScreens = ['dashboard','wedstrijden','analyse','wallet','instellingen','analytics','vvv'];
  if (backBtn) backBtn.classList.toggle('visible', !mainScreens.includes(name));

  // Render logica per screen
  state.activeScreen = name;
  state.activeTab    = name;

  switch(name) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'wedstrijden':
      renderWedstrijdenScreen();
      if (!state.matches?.length) loadMatches(state.activeComp);
      else renderMatches(state.matches);
      break;
    case 'analyse':
      if (typeof renderAnalyseScreen === 'function') renderAnalyseScreen();
      setTimeout(() => {
        if (typeof renderAnalyseScanResults === 'function' && state.valueScans?.length) {
          const sorted = [...state.valueScans].sort((a,b)=>(b.value||-999)-(a.value||-999)).filter(s=>s.value>=5);
          renderAnalyseScanResults(sorted);
        }
      }, 80);
      break;
    case 'wallet':
      renderWalletScreen();
      updateWalletUI();
      startLiveScorePolling();
      break;
    case 'instellingen':
      if (typeof renderInstellingen === 'function') renderInstellingen();
      updateCostUI();
      break;
    case 'analytics':
      if (typeof renderAnalyticsScreen === 'function') renderAnalyticsScreen();
      break;
    case 'vvv':
      if (typeof renderVVVScreen === 'function') renderVVVScreen();
      break;
    case 'wk2026':
      // v26.301: onbereikbaar (route omgeleid naar dashboard); behouden als vangnet.
      if (typeof renderWK2026Screen === 'function') renderWK2026Screen();
      break;
    case 'oefennl':
      if (typeof renderOefenNLScreen === 'function') renderOefenNLScreen();
      break;
    case 'ekkwal':
      if (typeof renderEKKwalScreen === 'function') renderEKKwalScreen();
      break;
    case 'oddsvergelijker':
      if (typeof renderOddsvergelijkerScreen === 'function') renderOddsvergelijkerScreen();
      break;
  }

  // Sluit menu bij schermwissel
  closeMoreMenu();

  // Scroll naar top
  window.scrollTo(0, 0);
}

// Legacy alias
function switchTab(name) {
  switchScreen(name);
}

// ── Bottom nav init ───────────────────────────────────────
function initBottomNav() {
  const nav = document.getElementById('bottom-nav');
  if (!nav) return;

  // Behoud bestaande HTML (Lucide SVG iconen uit index.html)
  // Alleen active state instellen op juiste knop
  nav.style.display = 'flex';
  // v26.301: WK-navknop is vervangen door VVV-Venlo (geen datum-verberglogica meer nodig).
  nav.querySelectorAll('.bnav-btn').forEach(btn => {
    const screen = btn.dataset.screen;
    if (screen) {
      btn.classList.toggle('active', screen === (state.activeScreen || 'dashboard'));
    }
  });
}

// ── Back button ──────────────────────────────────────────
function goBack() {
  switchScreen('wedstrijden');
}

// ── More menu — verwijderd, opties in bottom nav ────────
function toggleMoreMenu() {}
function closeMoreMenu() {}

// ── Deep-link vanuit melding: #pick=<matchId> opent de scan-log op die match ──
function handlePickDeepLink() {
  const m = (location.hash || '').match(/#pick=([^&]+)/);
  if (m && typeof openScanLog === 'function') {
    openScanLog({ matchId: decodeURIComponent(m[1]) });
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  }
}
window.addEventListener('hashchange', handlePickDeepLink);
window.addEventListener('load', () => setTimeout(handlePickDeepLink, 800));
