// ═══════════════════════════════════════════════════════
// NOTIFICATIONS.JS — Push, reminders, auto-check scheduler
// ═══════════════════════════════════════════════════════

let autoCheckInterval = null;
let _pushSubscription = null;

// ── OneSignal Player ID ophalen en opslaan ───────────────
async function initOneSignalPlayerId() {
  if (!window.OneSignal) return;
  try {
    // v16 SDK: gebruik User Identity
    let pid = null;

    // Methode 1: nieuwe v16 API
    if (typeof OneSignal.User?.PushSubscription?.id !== 'undefined') {
      pid = OneSignal.User.PushSubscription.id;
    }
    // Methode 2: legacy getUserId
    if (!pid && typeof OneSignal.getUserId === 'function') {
      pid = await OneSignal.getUserId();
    }
    // Methode 3: getSubscriptionId
    if (!pid && typeof OneSignal.getSubscriptionId === 'function') {
      pid = await OneSignal.getSubscriptionId();
    }

    if (pid) {
      state.oneSignalPlayerId = pid;
      if (!state.settings) state.settings = {};
      state.settings.notifPlayerId = pid;
      saveState();
      saveOwnerPlayerIdToFirebase(pid);
      console.log('[OneSignal] Player ID opgeslagen:', pid.substring(0, 8) + '...');
    } else {
      console.warn('[OneSignal] Geen Player ID gevonden');
    }

    // Luister naar toekomstige subscription changes
    if (typeof OneSignal.User?.PushSubscription?.addEventListener === 'function') {
      OneSignal.User.PushSubscription.addEventListener('change', async (event) => {
        const newId = event.current?.id;
        if (newId && newId !== state.oneSignalPlayerId) {
          state.oneSignalPlayerId = newId;
          state.settings.notifPlayerId = newId;
          saveState();
          saveOwnerPlayerIdToFirebase(newId);
          console.log('[OneSignal] Player ID bijgewerkt:', newId.substring(0, 8) + '...');
        }
      });
    }
  } catch(e) {
    console.warn('[OneSignal] Player ID ophalen mislukt:', e.message);
  }
}

// ── OneSignal push via Cloudflare Worker sturen ──────────
async function sendOneSignalValuePush(scan) {
  const pid = state.oneSignalPlayerId || state.settings?.notifPlayerId;
  if (!pid) {
    console.warn('[Push] Geen OneSignal Player ID — gebruik lokale notificatie');
    return false;
  }
  try {
    const sign = scan.value > 0 ? '+' : '';
    const title = `⚡ ${sign}${Math.round(scan.value)}% VALUE — ${scan.pickLabel}`;
    const body = `${scan.match?.home || ''} vs ${scan.match?.away || ''} · @${(scan.odds||0).toFixed(2)} · conf ${scan.confidence||'?'}/10`;
    const res = await fetch(`${WORKER}/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        body,
        data: {
          type: 'value_alert',
          matchId: String(scan.match?.id || ''),
          pick: scan.pick,
          value: scan.value,
        }
      })
    });
    return res.ok;
  } catch(e) {
    console.warn('[Push] OneSignal push mislukt:', e.message);
    return false;
  }
}

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
      navigator.serviceWorker.ready.then(r => r.showNotification('⚡ EdgeXI', {
        body: 'Notificaties aan! Je krijgt melding bij sterke value.',
        icon: '/icon-192.png'
      })).catch(()=>{});
    }
    // OneSignal Player ID ophalen (werkt zonder VAPID key)
    initOneSignalPlayerId().then(() => {
      const pid = state.oneSignalPlayerId || state.settings?.notifPlayerId;
      if (pid) {
        showAutoCheckBar('🔔 Push actief via OneSignal!', 4000);
      } else if (state.settings.vapidPublicKey) {
        showAutoCheckBar('⏳ Push abonnement aanmaken...', 2000);
        subscribeToPush().then(ok => {
          showAutoCheckBar(ok ? '🔔 Push actief — ook als app gesloten!' : '⚠ Push abonnement mislukt', 4000);
        }).catch(e => showAutoCheckBar('⚠ Push fout: ' + e.message, 5000));
      } else {
        showAutoCheckBar('⚠ OneSignal Player ID niet gevonden — probeer opnieuw', 4000);
      }
    });
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
    await sendRealPush('🔔 EdgeXI Test', 'Notificaties werken! 🏆 Triple Lock · 🔑 Double Lock · ✅ Bet resultaten', { tag: 'test-notif' });
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification('🔔 EdgeXI Test', {
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
  showToast(state.settings.autoValueAlerts ? '⚡ Auto alerts aan' : '⚡ Auto alerts uit');
}

// ── Debug push functie ───────────────────────────────
async function debugPush() {
  const lines = [];
  lines.push('🐛 PUSH DEBUG');
  lines.push('Notification API: ' + ('Notification' in window ? '✅' : '❌'));
  lines.push('Permission: ' + (('Notification' in window) ? Notification.permission : 'n/a'));
  lines.push('ServiceWorker: ' + ('serviceWorker' in navigator ? '✅' : '❌'));
  lines.push('OneSignal: ' + (window.OneSignal ? '✅' : '❌'));
  lines.push('notifEnabled: ' + (state.settings.notifEnabled ? '✅' : '❌'));
  lines.push('vapidKey: ' + (state.settings.vapidPublicKey ? '✅ aanwezig' : '❌ leeg'));
  lines.push('autoAlerts: ' + (state.settings.autoValueAlerts ? '✅' : '❌'));

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      lines.push('SW ready: ✅');
      const sub = await reg.pushManager.getSubscription();
      lines.push('Push sub: ' + (sub ? '✅ actief' : '❌ geen'));
    } catch(e) {
      lines.push('SW fout: ' + e.message);
    }
  }

  if (window.OneSignal) {
    try {
      // Probeer Player ID via alle beschikbare methodes
      let id = state.oneSignalPlayerId || state.settings?.notifPlayerId || null;
      let onesignalId = null;
      if (!id) {
        // Probeer eerst OneSignal User ID (voor include_player_ids targeting)
        try {
          if (typeof OneSignal.User?.onesignalId !== 'undefined') {
            onesignalId = OneSignal.User.onesignalId;
          }
          if (!onesignalId && typeof OneSignal.getUserId === 'function') {
            onesignalId = await OneSignal.getUserId();
          }
        } catch(_) {}
        // Subscription ID als fallback
        if (typeof OneSignal.User?.PushSubscription?.id !== 'undefined') {
          id = OneSignal.User.PushSubscription.id;
        }
        if (!id && typeof OneSignal.getSubscriptionId === 'function') {
          id = await OneSignal.getSubscriptionId();
        }
        // Gebruik OneSignal ID als primary voor push targeting
        if (onesignalId) id = onesignalId;
      }
      lines.push('OS Player ID: ' + (id ? '✅ ' + id : '❌'));
      if (id) {
        state.oneSignalPlayerId = id;
        state.settings.notifPlayerId = id;
        saveState();
        // Ook naar Firebase schrijven voor worker
        try {
          await firebase.database().ref('owner_player_id').set(id);
          lines.push('→ Player ID in Firebase ✅');
        } catch(fe) {
          lines.push('→ Firebase mislukt: ' + fe.message);
          lines.push('→ Kopieer ID voor Cloudflare secret:');
          lines.push(id);
        }
      }
    } catch(e) {
      lines.push('OS fout: ' + e.message);
    }
  }
  lines.push('Worker URL: ' + (typeof WORKER !== 'undefined' ? WORKER.substring(0,30) + '...' : '❌'));

  alert(lines.join('\n'));

  // Toon Player ID apart in prompt zodat het kopieerbaar is
  const pid = state.oneSignalPlayerId || state.settings?.notifPlayerId || null;
  if (pid) {
    setTimeout(() => prompt('📋 Kopieer Player ID voor Cloudflare:', pid), 300);
  }
}

// ── Sla Owner Player ID op in Firebase zodat Worker hem kent ──
async function saveOwnerPlayerIdToFirebase(pid) {
  try {
    if (!pid) return;
    // Wacht op Firebase auth — max 5 seconden
    await new Promise((resolve, reject) => {
      const unsubscribe = firebase.auth().onAuthStateChanged(user => {
        unsubscribe();
        if (user) resolve(user);
        else reject(new Error('Niet ingelogd'));
      });
      setTimeout(() => reject(new Error('Auth timeout')), 5000);
    });
    await firebase.database().ref('owner_player_id').set(pid);
    console.log('[OneSignal] Player ID → Firebase OK:', pid.substring(0, 8) + '...');
  } catch(e) {
    console.warn('[OneSignal] Firebase player ID opslaan mislukt:', e.message);
  }
}
