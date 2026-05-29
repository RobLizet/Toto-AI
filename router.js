// ═══════════════════════════════════════════════════════
// ROUTER.JS — switchScreen, bottom nav, back button
// v30: menu close fix voor mobiel (touchend + backdrop)
// ═══════════════════════════════════════════════════════

// switchScreen is de nieuwe naam, switchTab is de alias (legacy)
function switchScreen(name) {
  // Verberg alle screens
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

  // Toon gevraagde screen
  const screen = document.getElementById('screen-' + name);
  if (screen) screen.classList.add('active');

  // Update bottom nav
  document.querySelectorAll('.bnav-btn').forEach(b => {
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

  const navItems = [
    { screen: 'dashboard',    icon: '🏠', label: 'Home' },
    { screen: 'wedstrijden',  icon: '⚽', label: 'Wedstrijden' },
    { screen: 'analyse',      icon: '⚡', label: 'Analyse' },
    { screen: 'wallet',       icon: '💰', label: 'Wallet' },
  ];

  nav.innerHTML = navItems.map(item => `
    <button class="bnav-btn${state.activeScreen === item.screen ? ' active' : ''}"
      data-screen="${item.screen}"
      onclick="switchScreen('${item.screen}');closeMoreMenu()">
      <span class="bnav-icon">${item.icon}</span>
      <span class="bnav-label">${item.label}</span>
      <div class="bnav-dot-line"></div>
    </button>
  `).join('');
}

// ── Back button ──────────────────────────────────────────
function goBack() {
  switchScreen('wedstrijden');
}

// ── More menu (Instellingen + extra) ────────────────────
function toggleMoreMenu() {
  const menu = document.getElementById('more-menu');
  const bd   = document.getElementById('more-menu-backdrop');
  if (!menu) return;
  const isOpen = menu.classList.toggle('open');
  if (bd) bd.classList.toggle('open', isOpen);
}

function closeMoreMenu() {
  const menu = document.getElementById('more-menu');
  const bd   = document.getElementById('more-menu-backdrop');
  if (menu) menu.classList.remove('open');
  if (bd)   bd.classList.remove('open');
}

// ── Sluit menu bij klik/tap buiten — fix voor Android ────
function _handleMenuClose(e) {
  const menu = document.getElementById('more-menu');
  if (!menu || !menu.classList.contains('open')) return;
  if (!menu.contains(e.target) && !e.target.closest('[onclick*="toggleMoreMenu"]')) {
    closeMoreMenu();
  }
}

document.addEventListener('click',    _handleMenuClose);
document.addEventListener('touchend', _handleMenuClose, { passive: true });
