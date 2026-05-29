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

// Sluit more menu bij klik/tap buiten
document.addEventListener('click', (e) => {
  const menu = document.getElementById('more-menu');
  if (!menu || !menu.classList.contains('open')) return;
  if (!menu.contains(e.target) && !e.target.closest('[onclick*="toggleMoreMenu"]')) {
    closeMoreMenu();
  }
});

// Touch fix voor mobiel
document.addEventListener('touchend', (e) => {
  const menu = document.getElementById('more-menu');
  if (!menu || !menu.classList.contains('open')) return;
  if (!menu.contains(e.target) && !e.target.closest('[onclick*="toggleMoreMenu"]')) {
    closeMoreMenu();
  }
}, { passive: true });
