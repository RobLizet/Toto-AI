// ═══════════════════════════════════════════════════════
// UI.JS — Toast, modals, skeletons, swipe, charts
// ═══════════════════════════════════════════════════════

function showToast(msg) {
  let t = document.getElementById('toastMsg');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toastMsg';
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
      'background:rgba(15,23,42,.9);color:#fff;font-family:IBM Plex Mono,monospace;' +
      'font-size:.62rem;padding:.5rem 1.2rem;border-radius:999px;z-index:9999;' +
      'pointer-events:none;transition:opacity .3s;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2500);
}

function showAutoCheckBar(msg, duration = 3000) {
  const el = document.getElementById('autoCheckBar');
  if (!el) { console.log('[AutoCheck]', msg); return; }
  el.textContent = msg;
  el.style.display = 'block';
  el.style.opacity = '1';
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => { el.style.display = 'none'; el.style.opacity = '1'; }, 350);
  }, duration);
}

function showFirebaseStatus(msg, color) {
  const el = document.getElementById('firebaseStatus');
  if (!el) return;
  el.style.display = 'block';
  el.textContent = msg;
  if (color) el.style.color = color;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function showLoadingMsg(msg, color) {
  const el = document.getElementById('match-loading');
  if (!el) return;
  el.style.display = 'block';
  el.style.color = color || 'var(--muted)';
  el.textContent = msg;
  document.querySelectorAll('.skeleton-card').forEach(s => s.remove());
}

function showSkeletonCards(n) {
  const list = document.getElementById('matchList');
  if (!list) return;
  list.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div');
    s.className = 'skeleton-card match-card';
    s.style.cssText = 'height:90px;background:linear-gradient(90deg,rgba(15,23,42,.06) 25%,rgba(15,23,42,.12) 50%,rgba(15,23,42,.06) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;';
    list.appendChild(s);
  }
}

// ── Inzet modal ─────────────────────────────────────────
let pendingBet = null;

function openBetModal(e, matchId, pick, pickLabel, odds) {
  if (e) e.stopPropagation();
  const match = state.matches.find(m => String(m.id) === String(matchId));
  if (!match) return;
  pendingBet = { match, pick, pickLabel, odds: parseFloat(odds), markt: '1X2',
    _origPick: pick, _origPickLabel: pickLabel, _origOdds: parseFloat(odds) };

  // Vul modal in
  const title = document.getElementById('bet-modal-title');
  if (title) title.textContent = match.home + ' vs ' + match.away + ' — ' + pickLabel + ' @ ' + odds;

  const matchInput = document.getElementById('bet-match');
  if (matchInput) matchInput.value = match.home + ' vs ' + match.away;

  const stakeInput = document.getElementById('bet-stake');
  if (stakeInput) stakeInput.value = state.settings.defaultBet || 10;

  const oddsInput = document.getElementById('bet-odds');
  if (oddsInput) oddsInput.value = odds;

  const noteInput = document.getElementById('bet-note');
  if (noteInput) noteInput.value = pickLabel;

  const typeSelect = document.getElementById('bet-type');
  if (typeSelect) typeSelect.value = '1X2';

  // Toon modal
  const modal = document.getElementById('bet-modal');
  if (modal) { modal.style.display = 'flex'; }
}

function selectMarket(markt) {
  if (!pendingBet) return;
  pendingBet.markt = markt;
  document.querySelectorAll('.market-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('bet-type')?.classList.add('active');
  const pickRow = document.getElementById('bet-note');
  const pickInfo = document.getElementById('bet-modal-title');
  if (markt === '1X2') {
    pendingBet.pick = pendingBet._origPick;
    pendingBet.pickLabel = pendingBet._origPickLabel;
    pendingBet.odds = pendingBet._origOdds;
    if (pickInfo) pickInfo.textContent = 'Keuze: ' + pendingBet.pick + ' — ' + pendingBet.pickLabel + ' @ ' + pendingBet.odds;
    if (pickRow) pickRow.style.display = 'none';
  } else {
    const labels = {
      'O25':'Meer dan 2.5 goals','U25':'Minder dan 2.5 goals',
      'O15':'Meer dan 1.5 goals','O35':'Meer dan 3.5 goals',
      'BTTSJ':'Beide teams scoren - Ja','BTTSN':'Beide teams scoren - Nee',
      '1X':'Thuis of gelijk (1X)','X2':'Gelijk of uit (X2)'
    };
    const customLabel = document.getElementById('bet-note');
    const customOdds = document.getElementById('bet-odds');
    if (customLabel) customLabel.value = labels[markt] || '';
    if (customOdds) customOdds.value = '';
    if (pickInfo) pickInfo.textContent = 'Markt: ' + markt;
    if (pickRow) pickRow.style.display = 'block';
    pendingBet.pick = markt; pendingBet.pickLabel = labels[markt] || markt; pendingBet.odds = null;
  }
  updatePayoutPreview();
}

function updatePayoutPreview() {
  if (!pendingBet) return;
  const amt = parseFloat(document.getElementById('bet-stake')?.value) || 0;
  const odds = pendingBet.markt !== '1X2'
    ? parseFloat(document.getElementById('bet-odds')?.value) || 0
    : pendingBet.odds;
  const preview = document.getElementById('quick-bet-return');
  if (!preview) return;
  if (!odds) { preview.textContent = 'Vul quote in'; return; }
  const payout = (amt * odds).toFixed(2);
  preview.textContent = 'Mogelijke uitbetaling: €' + payout + ' (winst: €' + (payout - amt).toFixed(2) + ')';
}

function closeBetModal() {
  const modal = document.getElementById('bet-modal');
  if (modal) modal.style.display = 'none';
  pendingBet = null;
}

function confirmBet() {
  if (!pendingBet) return;
  const amt = parseFloat(document.getElementById('bet-stake')?.value);
  if (!amt || amt <= 0) return;
  if (amt > state.wallet.balance) { alert('Onvoldoende saldo!'); return; }
  let finalOdds = pendingBet.odds;
  let finalPick = pendingBet.pick;
  let finalPickLabel = pendingBet.pickLabel;
  if (pendingBet.markt !== '1X2') {
    finalOdds = parseFloat(document.getElementById('bet-odds')?.value);
    finalPickLabel = document.getElementById('bet-note')?.value.trim() || pendingBet.pickLabel;
    if (!finalOdds || finalOdds < 1.01) { alert('Vul een geldige quote in!'); return; }
  }
  const marktLabels = {'1X2':'Uitslag','O25':'Over 2.5','U25':'Under 2.5','O15':'Over 1.5','O35':'Over 3.5','BTTSJ':'BTTS-J','BTTSN':'BTTS-N','1X':'1X','X2':'X2'};
  const bet = {
    id: Date.now(),
    matchName: pendingBet.match.home + ' vs ' + pendingBet.match.away,
    fixtureId: pendingBet.match.id,
    pick: finalPick, pickLabel: finalPickLabel,
    markt: marktLabels[pendingBet.markt] || pendingBet.markt,
    odds: finalOdds, amount: amt,
    payout: parseFloat((amt * finalOdds).toFixed(2)),
    status: 'pending',
    date: new Date().toLocaleDateString('nl-NL')
  };
  state.wallet.balance -= amt;
  state.wallet.totalStaked += amt;
  state.wallet.bets.unshift(bet);
  saveState();
  updateWalletUI();
  closeBetModal();
}

function openQuickBet(matchId, pick, pickLabel, odds, type) {
  if (type === 'combi') {
    addValuePickToCombi(matchId, pick, pickLabel, odds,
      state.selectedMatch?.home || '', state.selectedMatch?.away || '');
    showToast('➕ Toegevoegd aan combi');
  } else {
    openBetModal(null, matchId, pick, pickLabel, odds);
  }
}

// ── Swipe bets ───────────────────────────────────────────
function initSwipeBets() {
  document.querySelectorAll('.swipeable').forEach(row => {
    const inner = row.querySelector('.swipe-inner');
    const winHint  = row.querySelector('.win-hint');
    const loseHint = row.querySelector('.lose-hint');
    if (!inner || row._swipeInit) return;
    row._swipeInit = true;
    let startX = 0, startY = 0, dragging = false, dx = 0;
    const THRESHOLD = 80;
    row.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dragging = true; dx = 0;
      inner.style.transition = 'none';
    }, {passive:true});
    row.addEventListener('touchmove', e => {
      if (!dragging) return;
      dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dy) > Math.abs(dx)) { dragging = false; return; }
      inner.style.transform = 'translateX(' + dx + 'px)';
      if (dx > 20)  { if (winHint) winHint.style.opacity  = Math.min(1, (dx-20)/60); if (loseHint) loseHint.style.opacity = 0; }
      if (dx < -20) { if (loseHint) loseHint.style.opacity = Math.min(1, (-dx-20)/60); if (winHint) winHint.style.opacity  = 0; }
    }, {passive:true});
    row.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      inner.style.transition = 'transform .2s';
      inner.style.transform  = 'translateX(0)';
      if (winHint) winHint.style.opacity  = 0;
      if (loseHint) loseHint.style.opacity = 0;
      const betId = parseInt(row.id.replace('swipe-',''));
      if (dx > THRESHOLD) {
        const b = state.wallet.bets.find(x => x.id === betId);
        if (b && b.status === 'pending') { b.status = 'win'; state.wallet.balance += b.payout; state.wallet.totalWon += b.payout; saveState(); updateWalletUI(); }
      } else if (dx < -THRESHOLD) {
        const b = state.wallet.bets.find(x => x.id === betId);
        if (b && b.status === 'pending') { b.status = 'lose'; saveState(); updateWalletUI(); }
      }
    });
  });
}

// ── Wallet chart ── (in wallet.js)

// ── WK Countdown ─────────────────────────────────────────
function updateWKCountdown() {
  const el = document.getElementById('wkCountdown');
  if (!el) return;
  const wkStart = new Date('2026-06-11T00:00:00');
  const now = new Date();
  const diff = wkStart - now;
  if (diff <= 0) { el.textContent = '🔴 WK IS BEZIG!'; return; }
  const days    = Math.floor(diff / (1000*60*60*24));
  const hours   = Math.floor((diff % (1000*60*60*24)) / (1000*60*60));
  const minutes = Math.floor((diff % (1000*60*60)) / (1000*60));
  el.textContent = days + 'd ' + hours + 'u ' + minutes + 'm · Start 11 juni';
}

// ── CSV Export ───────────────────────────────────────────
function exportWalletCSV() {
  const bets = state.wallet?.bets || [];
  if (!bets.length) { alert('Geen bets om te exporteren'); return; }
  const headers = ['Datum','Wedstrijd','Pick','Quote','Inzet','Uitbetaling','W/V','Status','Score','Bron'];
  const rows = bets.map(b => {
    const pnl = b.status === 'win' ? (b.payout - (b.amount||b.stake)).toFixed(2)
              : b.status === 'lose' ? (-(b.amount||b.stake)).toFixed(2) : '0';
    return [b.date||'',(b.matchName||'').replace(/,/g,' '),(b.pickLabel||'').replace(/,/g,' '),
      b.odds||'',b.amount||b.stake||'',b.payout?.toFixed(2)||'',pnl,
      b.status==='win'?'Gewonnen':b.status==='lose'?'Verloren':'Open',b.score||'',b.source||'eigen'].join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  downloadFile(csv, `TOTO-AI-wallet-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
  showAutoCheckBar('📥 CSV gedownload!', 2000);
}

function exportTrackerCSV() {
  const bets = state.tracker?.bets || [];
  if (!bets.length) { alert('Geen tracker bets om te exporteren'); return; }
  const headers = ['Datum','Wedstrijd','Pick','Markt','Quote','Inzet','Uitbetaling','Status','Score','Bookmaker','Bron'];
  const rows = bets.map(b => [b.date||'',(b.match||'').replace(/,/g,' '),(b.pick||'').replace(/,/g,' '),
    b.markt||'',b.odds||'',b.stake||'',b.payout?.toFixed(2)||'',
    b.status==='win'?'Gewonnen':b.status==='lose'?'Verloren':'Open',
    b.score||'',b.bookmaker||'',b.source||'eigen'].join(',')).join('\n');
  const csv = [headers.join(','), rows].join('\n');
  downloadFile(csv, `TOTO-AI-tracker-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
  showAutoCheckBar('📥 Tracker CSV gedownload!', 2000);
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
