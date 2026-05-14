// ═══════════════════════════════════════════════════════
// NOTIFICATIONS.JS — Push, reminders, auto-check scheduler
// ═══════════════════════════════════════════════════════

let autoCheckInterval = null;
let _pushSubscription = null;

// ── Push notificaties ────────────────────────────────────
function sendPickNotification(title, body, tag, matchId, comp) {
  if (!state.settings.notifEnabled) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(reg => {
      const data = {};
      if (matchId) data.matchId = matchId;
      if (comp)    data.comp    = comp;
      reg.showNotification(title, {
        body, icon:'/icon-192.png', tag,
        renotify:true, vibrate:[200,100,200], data
      });
    }).catch(() => {});
  }
}

function sendValueNotification(scan) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const sign = scan.value > 0 ? '+' : '';
  const title = `⚡ ${sign}${Math.round(scan.value)}% VALUE — ${scan.pickLabel}`;
  const body = `${shortName(scan.match.home)} vs ${shortName(scan.match.away)} · quote ${scan.odds.toFixed(2)} · AI ${scan.kans}%`;
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then(reg => {
    reg.showNotification(title, {
      body, icon:'/icon-192.png', badge:'/icon-192.png',
      tag: 'value-' + scan.match.id,
      renotify: true,
      requireInteraction: scan.value >= 25,
      vibrate: [200, 100, 200]
    });
  }).catch(e => console.warn('Notif SW:', e));
}

async function toggleNotifications() {
  if (!('Notification' in window)) { alert('Je browser ondersteunt geen notificaties.'); return; }
  if (state.settings.notifEnabled) {
    state.settings.notifEnabled = false;
    saveState(); updateNotifUI(); return;
  }
  if (Notification.permission === 'granted') {
    state.settings.notifEnabled = true;
    saveState(); updateNotifUI();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(r => r.showNotification('⚡ TOTO AI', {
        body: 'Notificaties aan! Je krijgt melding bij sterke value.',
        icon: '/icon-192.png'
      })).catch(()=>{});
    }
    if (state.settings.vapidPublicKey) {
      showAutoCheckBar('⏳ Push abonnement aanmaken...', 2000);
      subscribeToPush().then(ok => {
        showAutoCheckBar(ok ? '🔔 Echte push actief — ook als app gesloten!' : '⚠ Push abonnement mislukt', 4000);
      }).catch(e => showAutoCheckBar('⚠ Push fout: ' + e.message, 5000));
    } else {
      showAutoCheckBar('⚠ Vul eerst VAPID Public Key in bij Instellingen', 3000);
    }
    return;
  }
  if (Notification.permission === 'denied') {
    alert('Notificaties zijn geblokkeerd. Zet ze aan via je browser-instellingen.');
    return;
  }
  const result = await Notification.requestPermission();
  if (result === 'granted') {
    state.settings.notifEnabled = true;
    saveState(); updateNotifUI();
  }
}

function updateNotifUI() {
  const btn = document.getElementById('notifBtn');
  const sub = document.getElementById('notifStatusSub');
  const thresh = document.getElementById('notifThreshold');
  const desc = document.getElementById('notifThresholdDesc');
  if (!btn) return;
  const currentThreshold = state.settings.notifThreshold || 15;
  if (desc) desc.textContent = currentThreshold;
  const perm = ('Notification' in window) ? Notification.permission : 'unsupported';
  if (perm === 'unsupported') {
    btn.textContent = 'NIET ONDERSTEUND'; btn.className = 'notif-btn disable'; btn.disabled = true;
    if (sub) sub.textContent = 'Browser ondersteunt dit niet';
    return;
  }
  if (perm === 'denied') {
    btn.textContent = 'GEBLOKKEERD'; btn.className = 'notif-btn disable';
    if (sub) sub.textContent = 'Zet aan via browser instellingen';
    return;
  }
  if (state.settings.notifEnabled && perm === 'granted') {
    btn.textContent = 'UITZETTEN'; btn.className = 'notif-btn disable';
    if (sub) sub.innerHTML = '<span class="notif-status on">✓ Actief</span> — melding vanaf ' + currentThreshold + '% value';
  } else {
    btn.textContent = 'AANZETTEN'; btn.className = 'notif-btn enable';
    if (sub) sub.innerHTML = '<span class="notif-status off">Uit</span> — klik AANZETTEN voor meldingen';
  }
  if (thresh) thresh.value = currentThreshold;
  // Bel-dot in topbar
  const dot = document.getElementById('notif-dot');
  if (dot) dot.style.display = (state.settings.notifEnabled && perm === 'granted') ? 'block' : 'none';
}

// ── VAPID push subscriptie ───────────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function subscribeToPush() {
  try {
    const vapidKey = state.settings.vapidPublicKey;
    if (!vapidKey) return false;
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) { _pushSubscription = existing; return true; }
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey)
    });
    _pushSubscription = sub;
    // Stuur endpoint naar Worker
    await fetch(`${WORKER}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON() })
    });
    return true;
  } catch(e) {
    console.error('[Push] Subscribe fout:', e);
    return false;
  }
}

async function sendRealPush(title, body, options = {}) {
  if (!_pushSubscription) return false;
  try {
    const r = await fetch(`${WORKER}/push/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: _pushSubscription.toJSON(),
        payload: { title, body, ...options }
      })
    });
    return r.ok;
  } catch(e) { return false; }
}

async function testNotification() {
  const resultEl = document.getElementById('notifTestResult');
  const setResult = (msg, color) => { if (resultEl) { resultEl.textContent = msg; resultEl.style.color = color; } };
  if (!('Notification' in window)) { setResult('⚠ Browser ondersteunt geen notificaties', '#dc2626'); return; }
  if (Notification.permission === 'denied') { setResult('⚠ Geblokkeerd — zet aan via browser instellingen', '#dc2626'); return; }
  if (Notification.permission !== 'granted') {
    setResult('⏳ Toestemming vragen...', '#f59e0b');
    const result = await Notification.requestPermission();
    if (result !== 'granted') { setResult('⚠ Geen toestemming gegeven', '#dc2626'); return; }
  }
  if (!('serviceWorker' in navigator)) { setResult('⚠ ServiceWorker niet beschikbaar', '#dc2626'); return; }
  for (let i = 10; i > 0; i--) {
    setResult(`⏳ Melding komt over ${i} seconden — sluit nu de app!`, '#f59e0b');
    await new Promise(r => setTimeout(r, 1000));
  }
  setResult('⏳ Versturen...', '#2563eb');
  try {
    await sendRealPush('🔔 TOTO AI Test', 'Notificaties werken! 🏆 Triple Lock · 🔑 Double Lock · ✅ Bet resultaten', { tag: 'test-notif' });
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification('🔔 TOTO AI Test', {
      body: 'Notificaties werken! 🏆 Triple Lock · 🔑 Double Lock · ✅ Bet resultaten',
      icon: '/icon-192.png', badge: '/icon-192.png',
      vibrate: [200, 100, 200, 100, 200], tag: 'test-notif', renotify: true
    });
    setResult('✅ Melding verstuurd!', '#16a34a');
    setTimeout(() => { if (resultEl) { resultEl.textContent = 'Stuur een testmelding naar je telefoon'; resultEl.style.color = ''; } }, 5000);
  } catch(e) {
    setResult('⚠ Fout: ' + e.message, '#dc2626');
  }
}

// ── Auto-check bets scheduler ────────────────────────────
function startAutoCheckScheduler() {
  if (autoCheckInterval) clearInterval(autoCheckInterval);
  autoCheckInterval = setInterval(async () => {
    const now = new Date();
    const h = now.getHours();
    if (h < 13 || h >= 23) return;
    const open = (state.wallet.bets || []).filter(b => b.status === 'pending');
    if (!open.length) return;
    showAutoCheckBar('🔄 Auto-check bets...');
    let upd = 0;
    for (const bet of open) {
      try {
        const prev = bet.status;
        await checkBetResult(bet.id);
        if (bet.status !== prev) upd++;
      } catch(e) {}
    }
    if (upd > 0) showAutoCheckBar(`✅ ${upd} bet${upd>1?'s':''} bijgewerkt!`, 4000);
    else showAutoCheckBar('✓ Geen updates', 2000);
  }, 60 * 60 * 1000); // 60 minuten
}

// ── Bet reminders ────────────────────────────────────────
function checkBetReminders() {
  const bets = (state.wallet?.bets || []).filter(b => b.status === 'pending');
  const now = Date.now();
  bets.forEach(bet => {
    if (!bet.matchTime) return;
    const matchTime = new Date(bet.matchTime).getTime();
    const diff = matchTime - now;
    if (diff > 0 && diff < 30 * 60000) {
      const key = 'remind_' + bet.id;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, '1');
        sendPickNotification(
          `⏰ ${bet.matchName} begint zo!`,
          `Je hebt €${bet.amount} op ${bet.pickLabel} @ ${bet.odds}`,
          'reminder-' + bet.id, null, null
        );
      }
    }
    if (diff < -120 * 60000) localStorage.removeItem('remind_' + bet.id);
  });
}

// ── Auto donker thema ────────────────────────────────────
function toggleAutoDark() {
  state.settings.autoDark = !state.settings.autoDark;
  updateAutoDarkUI();
  saveState();
  if (state.settings.autoDark) checkAutoDarkNow();
}

function updateAutoDarkUI() {
  const pill = document.getElementById('autoDarkPill');
  if (!pill) return;
  pill.classList.toggle('on', !!state.settings.autoDark);
}

function checkAutoDarkNow() {
  if (state.settings.autoDark) {
    const h = new Date().getHours();
    const isDark = h >= 20 || h < 8;
    const current = localStorage.getItem('totoai_theme') || 'mint';
    if (isDark && current !== 'dark') {
      state.settings._preAutoDarkTheme = current;
      localStorage.setItem('totoai_theme', 'dark');
      applyTheme();
    } else if (!isDark && current === 'dark' && state.settings._preAutoDarkTheme) {
      localStorage.setItem('totoai_theme', state.settings._preAutoDarkTheme);
      state.settings._preAutoDarkTheme = null;
      applyTheme();
    }
    return;
  }
  if (!localStorage.getItem('totoai_theme')) {
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    if (prefersDark) { localStorage.setItem('totoai_theme', 'dark'); applyTheme(); }
  }
}

function toggleAutoValueAlerts() {
  state.settings.autoValueAlerts = !state.settings.autoValueAlerts;
  const pill = document.getElementById('autoAlertsPill');
  if (pill) pill.classList.toggle('on', !!state.settings.autoValueAlerts);
  saveState();
}
