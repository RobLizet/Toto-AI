// ═══════════════════════════════════════════════════════
// ROUTER.JS — switchScreen, bottom nav, back button
// v31: meer-menu verwijderd — WK2026 + Instellingen naar bottom nav
// ═══════════════════════════════════════════════════════

// switchScreen is de nieuwe naam, switchTab is de alias (legacy)
function switchScreen(name) {
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
  const mainScreens = ['dashboard','wedstrijden','analyse','wallet','instellingen','analytics','wk2026'];
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
    case 'wk2026':
      if (typeof renderWK2026Screen === 'function') renderWK2026Screen();
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
