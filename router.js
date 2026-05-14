// ═══════════════════════════════════════════════════════
// ROUTER.JS — switchScreen, bottom nav, back button
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
  const mainScreens = ['dashboard','wedstrijden','analyse','wallet','instellingen'];
  if (backBtn) backBtn.classList.toggle('visible', !mainScreens.includes(name));

  // Render logica per screen
  state.activeScreen = name;
  state.activeTab    = name;

  switch(name) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'wedstrijden':
      // Alleen opnieuw laden als matches leeg zijn
      if (!state.matches?.length) loadMatches(state.activeComp);
      else renderMatches(state.matches);
      break;
    case 'analyse':
      // Analyse toont huidige geselecteerde match
      if (typeof renderAnalyseScreen === 'function') renderAnalyseScreen();
      break;
    case 'wallet':
      updateWalletUI();
      startLiveScorePolling();
      break;
    case 'instellingen':
      if (typeof renderInstellingen === 'function') renderInstellingen();
      updateCostUI();
      break;
  }

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
    { screen: 'wedstrijden',  icon: '⚽', label: 'Matches' },
    { screen: 'analyse',      icon: '⚡', label: 'Analyse' },
    { screen: 'wallet',       icon: '💰', label: 'Wallet' },
    { screen: 'instellingen', icon: '⚙️', label: 'More' },
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
  const menu = document.getElementById('moreMenu');
  if (menu) menu.classList.toggle('open');
}

function closeMoreMenu() {
  const menu = document.getElementById('moreMenu');
  if (menu) menu.classList.remove('open');
}

// Sluit more menu als je ergens anders tikt
document.addEventListener('click', (e) => {
  const menu = document.getElementById('moreMenu');
  if (!menu) return;
  if (!menu.contains(e.target) && !e.target.closest('[onclick*="toggleMoreMenu"]')) {
    menu.classList.remove('open');
  }
});
