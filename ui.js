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
  const modalName = document.getElementById('modalMatchName');
  const modalPick = document.getElementById('modalPickInfo');
  const modalInput = document.getElementById('modalBetInput');
  if (modalName) modalName.textContent = match.home + ' vs ' + match.away;
  if (modalPick) modalPick.textContent = 'Keuze: ' + pick + ' — ' + pickLabel + ' @ ' + odds;
  if (modalInput) modalInput.value = state.settings.defaultBet || 10;
  const pickRow = document.getElementById('marketPickRow');
  if (pickRow) pickRow.style.display = 'none';
  document.querySelectorAll('.market-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('mb-1X2')?.classList.add('active');
  updatePayoutPreview();
  document.getElementById('betModal')?.classList.add('show');
}

function selectMarket(markt) {
  if (!pendingBet) return;
  pendingBet.markt = markt;
  document.querySelectorAll('.market-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('mb-' + markt)?.classList.add('active');
  const pickRow = document.getElementById('marketPickRow');
  const pickInfo = document.getElementById('modalPickInfo');
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
    const customLabel = document.getElementById('customPickLabel');
    const customOdds = document.getElementById('customOdds');
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
  const amt = parseFloat(document.getElementById('modalBetInput')?.value) || 0;
  const odds = pendingBet.markt !== '1X2'
    ? parseFloat(document.getElementById('customOdds')?.value) || 0
    : pendingBet.odds;
  const preview = document.getElementById('payoutPreview');
  if (!preview) return;
  if (!odds) { preview.textContent = 'Vul quote in'; return; }
  const payout = (amt * odds).toFixed(2);
  preview.textContent = 'Mogelijke uitbetaling: €' + payout + ' (winst: €' + (payout - amt).toFixed(2) + ')';
}

function closeBetModal() {
  document.getElementById('betModal')?.classList.remove('show');
  pendingBet = null;
}

function confirmBet() {
  if (!pendingBet) return;
  const amt = parseFloat(document.getElementById('modalBetInput')?.value);
  if (!amt || amt <= 0) return;
  if (amt > state.wallet.balance) { alert('Onvoldoende saldo!'); return; }
  let finalOdds = pendingBet.odds;
  let finalPick = pendingBet.pick;
  let finalPickLabel = pendingBet.pickLabel;
  if (pendingBet.markt !== '1X2') {
    finalOdds = parseFloat(document.getElementById('customOdds')?.value);
    finalPickLabel = document.getElementById('customPickLabel')?.value.trim() || pendingBet.pickLabel;
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

// ── Wallet chart ─────────────────────────────────────────
let chartSource = 'all';
let chartView   = 'saldo';

function setChartSource(src) {
  chartSource = src;
  document.querySelectorAll('[id^="cs-"]').forEach(b => b.classList.remove('active'));
  document.getElementById('cs-' + src)?.classList.add('active');
  renderWalletChart();
}

function setChartView(v) {
  chartView = v;
  ['saldo','pnl'].forEach(x => {
    const b = document.getElementById('cv-' + x);
    if (!b) return;
    if (x === v) { b.style.background = 'rgba(219,39,119,.1)'; b.style.borderColor = 'rgba(219,39,119,.4)'; b.style.color = '#be185d'; }
    else { b.style.background = 'transparent'; b.style.borderColor = 'rgba(15,23,42,.12)'; b.style.color = '#475569'; }
  });
  renderWalletChart();
}

function renderWalletChart() {
  const canvas = document.getElementById('walletChart');
  const emptyEl = document.getElementById('chartEmpty');
  if (!canvas) return;
  const sb = state.settings.startBalance || 500;
  const allSettled = [...state.wallet.bets].reverse().filter(b => b.status !== 'pending');
  const settled = chartSource === 'all' ? allSettled : allSettled.filter(b => (b.source||'eigen') === chartSource);
  if (!settled.length) {
    canvas.style.display = 'none';
    if (emptyEl) { emptyEl.style.display = 'block'; emptyEl.textContent = chartSource === 'all' ? 'Nog geen afgeronde weddenschappen' : 'Geen bets voor deze bron'; }
    return;
  }
  canvas.style.display = 'block';
  if (emptyEl) emptyEl.style.display = 'none';
  let running = sb;
  const points = [{value: chartView === 'saldo' ? sb : 0, result:'start'}];
  settled.forEach(b => {
    if (b.status === 'win') running += (b.payout - b.amount);
    else running -= b.amount;
    points.push({value: chartView === 'saldo' ? running : running - sb, result: b.status});
  });
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.parentElement.clientWidth - 32;
  const H = 140;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  const vals = points.map(p => p.value);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const range = maxV - minV || 1;
  const pad = {top:16, bottom:20, left:44, right:10};
  const cw = W - pad.left - pad.right, ch = H - pad.top - pad.bottom;
  const xP = i => pad.left + (i / Math.max(points.length-1,1)) * cw;
  const yP = v => pad.top + ch - ((v - minV) / range) * ch;
  const baseY = yP(chartView === 'pnl' ? 0 : sb);
  ctx.setLineDash([4,4]); ctx.strokeStyle = 'rgba(15,23,42,.1)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad.left, baseY); ctx.lineTo(pad.left + cw, baseY); ctx.stroke();
  ctx.setLineDash([]);
  const lastVal = points[points.length-1].value;
  const isPos = chartView === 'pnl' ? lastVal >= 0 : lastVal >= sb;
  const color = isPos ? '#16a34a' : '#dc2626';
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
  grad.addColorStop(0, isPos ? 'rgba(22,163,74,.22)' : 'rgba(220,38,38,.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.moveTo(xP(0), yP(points[0].value));
  points.forEach((p,i) => { if (i>0) ctx.lineTo(xP(i), yP(p.value)); });
  ctx.lineTo(xP(points.length-1), H - pad.bottom);
  ctx.lineTo(xP(0), H - pad.bottom);
  ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(xP(0), yP(points[0].value));
  points.forEach((p,i) => { if (i>0) ctx.lineTo(xP(i), yP(p.value)); });
  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
  points.forEach((p,i) => {
    ctx.beginPath(); ctx.arc(xP(i), yP(p.value), 4, 0, Math.PI*2);
    ctx.fillStyle = p.result === 'win' ? '#16a34a' : p.result === 'lose' ? '#dc2626' : '#7c3aed';
    ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  });
  ctx.fillStyle = '#94a3b8'; ctx.font = '9px IBM Plex Mono, monospace'; ctx.textAlign = 'right';
  [minV, maxV].forEach(v => ctx.fillText('€' + Math.round(v), pad.left - 4, yP(v) + 3));
  ctx.fillStyle = color; ctx.font = 'bold 10px IBM Plex Mono, monospace';
  ctx.fillText((lastVal>=0?'+':'') + '€' + Math.round(lastVal), xP(points.length-1), yP(lastVal) - 8);
}

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
