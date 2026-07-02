
// ═══════════════════════════════════════════════════════
// HELP TOOLTIP SYSTEEM — v19.0
// ❓ icoon bij elk onderdeel met uitleg popup
// ═══════════════════════════════════════════════════════

const HELP_TEXTS = {
  // Wedstrijden
  'competitie-tabs':    { title: 'Competities', text: 'Kies een competitie om wedstrijden te laden. De app haalt live odds en statistieken op via API-Football.' },
  'match-card':         { title: 'Wedstrijd kaart', text: 'Tik op een wedstrijd om die te selecteren voor analyse. De balkjes tonen de kans op thuiswinst, gelijkspel of uitwinst op basis van de odds.' },
  'odds-display':       { title: 'Odds (quote)', text: 'De odds geven de uitbetaling per €1 inzet. Lagere odds = grotere kans volgens de bookmaker. ProMatchXI vergelijkt dit met eigen berekeningen om value te vinden.' },
  'sharp':              { title: '\ud83e\udd88 Sharp geld', text: 'Sharp geld is geld van professionele gokkers. Als zij groot inzetten, verschuift de bookmaker de odds. Dalende odds op een uitkomst (bijv. "Uit -9.1%") betekent dat geld daarheen stroomt \u2014 de scherpe spelers zien er waarde. Stijgende odds ("Odds stijgt") betekent dat geld er juist wegstroomt. ProMatchXI weegt dit mee als extra bevestiging bij een pick. Het is een richtingaanwijzer, geen garantie \u2014 een deel van de bewegingen is ruis.' },
  'value-badge':        { title: 'Value %', text: 'Value = het verschil tussen de AI-kans en de implied kans van de bookmaker. +10% betekent dat AI 10% hogere kans ziet dan de bookmaker inprijst. Positieve value = potentieel winstgevende bet.' },

  // Analyse
  'value-scan':         { title: '⚡ Value Scan', text: 'Scant alle geladen wedstrijden tegelijk. De AI combineert Poisson-statistieken, xG (verwachte doelpunten), vorm, H2H en blessures om value picks te vinden.' },
  'poisson':            { title: 'Poisson kansen', text: 'Poisson is een wiskundige methode om doelpuntenkansen te berekenen op basis van aanvals- en verdedigingssterkte. Gecombineerd met xG geeft dit nauwkeurigere kansen dan odds alleen.' },
  'xg':                 { title: 'xG (Expected Goals)', text: 'xG meet hoeveel doelpunten een team "verdient" op basis van de kwaliteit van hun kansen. Een team met xG 2.1 maar 1 goal scoorde heeft pech gehad — dit voorspelt toekomstige prestaties beter.' },
  'confidence':         { title: 'Confidence score', text: 'Geeft aan hoe betrouwbaar de analyse is. 8-10 = sterke data + consistente signalen. 5-7 = redelijke data. 1-4 = weinig data, wees voorzichtig.' },
  'kelly':              { title: 'Kelly %', text: 'De Kelly formule berekent de optimale inzet als percentage van je bankroll. ½ Kelly (half Kelly) wordt aanbevolen voor minder risico. Bijv. 5% Kelly op €500 bankroll = €25.' },
  'h2h':                { title: 'H2H (Head to Head)', text: 'Historische directe ontmoetingen tussen de twee teams. Recente duels wegen zwaarder dan oude. Gewogen H2H houdt rekening met hoe recent de wedstrijden waren.' },
  'ai-analyse':         { title: 'AI Analyse', text: 'Diepgaande analyse van één wedstrijd door Claude AI. Combineert vorm, statistieken, tactiek, blessures en stand. Geeft een concrete tip met onderbouwing.' },
  'combi-tips':         { title: '🎯 Combi Tips', text: 'AI selecteert de beste 3 picks van de dag en combineert ze tot een combi. De synergie-score geeft aan hoe goed de picks bij elkaar passen.' },

  // Scan Log
  'scan-log':           { title: '📊 Scan Log', text: 'Houdt alle value picks bij die de AI heeft gevonden. Picks met ≥5% value en confidence ≥7 worden automatisch opgeslagen. Na 100 picks heb je een statistisch betrouwbaar trackrecord.' },
  'hitrate':            { title: 'Hitrate %', text: 'Percentage gewonnen picks van alle afgeronde picks. Een hitrate van 35-40% op hoge quotes (3.0+) kan al winstgevend zijn als de value klopt.' },
  'roi':                { title: 'ROI %', text: 'Return on Investment — je totale winst/verlies per €1 ingezet. Positieve ROI over 100+ picks bewijst dat de value picks écht werken.' },
  'avg-value':          { title: 'Gem. Value %', text: 'Gemiddelde value percentage van alle picks. Hoe hoger, hoe beter de kansen dat de picks op lange termijn winstgevend zijn.' },

  // Wallet
  'wallet':             { title: '💰 Wallet', text: 'Fictieve portefeuille om je bets bij te houden. Stort een startbedrag en volg je rendement. Alle bedragen zijn fictief — dit is educatief.' },
  'tracker':            { title: '📒 Tracker', text: 'Registreer je echte of fictieve bets van Jacks, Unibet of andere bookmakers. Importeer via screenshot (AI leest automatisch uit) of voeg handmatig toe.' },
  'value-picks-tab':    { title: '⚡ Value Picks', text: 'Overzicht van alle huidige value picks gevonden door de AI scan. Tik op INZETTEN om direct een bet toe te voegen aan je wallet.' },
  'triple-lock':        { title: '🔒 Triple/Double Lock', text: 'Een pick die in 3+ onafhankelijke scan-sessies (met 2+ uur ertussen) bevestigd wordt. Dit zijn de sterkste signalen — de AI is consistent over tijd.' },
  'combi-builder':      { title: '⚡ Combi Builder', text: 'Voeg picks samen tot een combi. De totale quote is het product van alle losse quotes. Meer legs = hogere quote maar lagere kans.' },
};

function showHelp(key) {
  const help = HELP_TEXTS[key];
  if (!help) return;
  document.getElementById('help-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'help-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem;backdrop-filter:blur(4px);';
  modal.onclick = function(e) { if (e.target === modal) modal.remove(); };

  const box = document.createElement('div');
  box.style.cssText = 'background:var(--card,#fff);border-radius:20px;padding:1.5rem;width:100%;max-width:340px;box-shadow:0 20px 60px rgba(15,23,42,.2);';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.75rem;';
  header.innerHTML = '<div style="font-family:Bebas Neue,sans-serif;font-size:1.1rem;color:#be185d;">' + help.title + '</div>';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'background:rgba(15,23,42,.08);border:none;border-radius:999px;width:1.8rem;height:1.8rem;cursor:pointer;font-size:.75rem;color:var(--sub);';
  closeBtn.onclick = function() { modal.remove(); };
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.style.cssText = 'font-family:IBM Plex Mono,monospace;font-size:.58rem;color:var(--sub);line-height:1.8;';
  body.textContent = help.text;

  const okBtn = document.createElement('button');
  okBtn.textContent = 'Begrepen ✓';
  okBtn.style.cssText = 'width:100%;margin-top:1rem;padding:.6rem;border-radius:12px;background:linear-gradient(135deg,rgba(219,39,119,.15),rgba(124,58,237,.12));border:1px solid rgba(219,39,119,.2);font-family:IBM Plex Mono,monospace;font-size:.6rem;font-weight:700;color:#be185d;cursor:pointer;';
  okBtn.onclick = function() { modal.remove(); };

  box.appendChild(header);
  box.appendChild(body);
  box.appendChild(okBtn);
  modal.appendChild(box);
  document.body.appendChild(modal);
}

// Helper: maak een ❓ help knop
function helpBtn(key) {
  return '<button onclick="showHelp(\'' + key + '\')" '
    + 'style="background:rgba(124,58,237,.1);border:1px solid rgba(124,58,237,.2);border-radius:999px;'
    + 'width:1.4rem;height:1.4rem;font-size:.6rem;cursor:pointer;color:#7c3aed;'
    + 'display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;'
    + 'font-family:monospace;font-weight:800;vertical-align:middle;margin-left:.3rem;">?</button>';
}

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

// (dubbele functie verwijderd v26.10 — actieve versie in wallet.js)
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

// (dubbele functie verwijderd v26.10 — actieve versie in wallet.js)
function openQuickBet(matchId, pick, pickLabel, odds, type) {
  if (type === 'combi') {
    addValuePickToCombi(matchId, pick, pickLabel, odds,
      state.selectedMatch?.home || '', state.selectedMatch?.away || '');
    showToast(t('ui.addedtocombi','➕ Toegevoegd aan combi'));
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
// (dubbele functie verwijderd v26.10 — actieve versie in wallet.js)
