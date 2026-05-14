// ═══════════════════════════════════════════════════════
// DASHBOARD.JS — renderDashboard, stats strip, nav cards
// ═══════════════════════════════════════════════════════

function renderDashboard() {
  const screen = document.getElementById('screen-dashboard');
  if (!screen) return;

  const wallet = state.wallet;
  const bets = wallet.bets || [];
  const settled = bets.filter(b => b.status !== 'pending');
  const won = settled.filter(b => b.status === 'win');
  const pnl = won.reduce((s,b) => s + (b.payout - b.amount), 0) -
              settled.filter(b => b.status === 'lose').reduce((s,b) => s + b.amount, 0);
  const hitrate = settled.length ? Math.round(won.length / settled.length * 100) : 0;
  const pnlPos = pnl >= 0;
  const openBets = bets.filter(b => b.status === 'pending');

  // Scheduled scan picks (van Worker)
  const scanPicks = state.scheduledScanPicks || [];
  const topPicks = scanPicks.filter(p => (p.value||0) >= 10).slice(0,3);

  // WK countdown
  const wkStart = new Date('2026-06-11T00:00:00');
  const now = new Date();
  const wkDiff = wkStart - now;
  const wkDays = wkDiff > 0 ? Math.floor(wkDiff / (1000*60*60*24)) : 0;

  screen.innerHTML = `
    <!-- Stats strip -->
    <div class="dash-stats">
      <div class="dash-stat">
        <div class="dash-stat-val" style="color:#be185d;">€${wallet.balance.toFixed(0)}</div>
        <div class="dash-stat-lbl">SALDO</div>
      </div>
      <div class="dash-stat">
        <div class="dash-stat-val" style="color:${pnlPos?'#16a34a':'#dc2626'};">${pnlPos?'+':''}€${pnl.toFixed(0)}</div>
        <div class="dash-stat-lbl">W/V</div>
      </div>
      <div class="dash-stat">
        <div class="dash-stat-val" style="color:#2563eb;">${bets.length}</div>
        <div class="dash-stat-lbl">BETS</div>
      </div>
      <div class="dash-stat">
        <div class="dash-stat-val" style="color:#7c3aed;">${settled.length ? hitrate + '%' : '—'}</div>
        <div class="dash-stat-lbl">HITRATE</div>
      </div>
    </div>

    <!-- Open bets strip -->
    ${openBets.length ? `
    <div style="background:rgba(37,99,235,.06);border:1px solid rgba(37,99,235,.18);border-radius:12px;padding:.65rem 1rem;margin-bottom:.85rem;cursor:pointer;" onclick="switchScreen('wallet')">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.58rem;font-weight:800;color:#2563eb;">⏳ ${openBets.length} OPEN BET${openBets.length>1?'S':''}</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:#2563eb;">€${openBets.reduce((s,b)=>s+b.amount,0).toFixed(0)} ingezet</div>
      </div>
    </div>` : ''}

    <!-- Auto-scan picks van Worker -->
    ${topPicks.length ? `
    <div style="background:linear-gradient(135deg,rgba(22,163,74,.08),rgba(5,150,105,.05));border:1px solid rgba(22,163,74,.2);border-radius:14px;padding:.85rem;margin-bottom:.85rem;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.6rem;font-weight:800;color:#15803d;margin-bottom:.55rem;">🤖 AUTO PICKS VANDAAG</div>
      ${topPicks.map(p => {
        const sign = p.value > 0 ? '+' : '';
        const cls = p.value >= 15 ? '#15803d' : '#b45309';
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:.4rem 0;border-bottom:1px solid rgba(22,163,74,.1);" onclick="switchScreen('wedstrijden')">
          <div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.6rem;font-weight:700;color:var(--ink);">${p.home||'?'} vs ${p.away||'?'}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);">${p.pickLabel||p.pick} · @ ${(p.odds||0).toFixed(2)}</div>
          </div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.2rem;color:${cls};">${sign}${Math.round(p.value)}%</div>
        </div>`;
      }).join('')}
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;color:var(--sub);margin-top:.4rem;text-align:center;">Tik voor analyse in Wedstrijden</div>
    </div>` : ''}

    <!-- Nav kaarten 2x2 -->
    <div class="nav-cards">
      <div class="nav-card" onclick="switchScreen('wedstrijden')">
        <span class="nav-card-icon">⚽</span>
        <div class="nav-card-title">WEDSTRIJDEN</div>
        <div class="nav-card-sub">Laad matches, bekijk quotes en value indicators</div>
        <div class="nav-badge nb-blue">LIVE API</div>
        <span class="nav-card-arrow">→</span>
      </div>
      <div class="nav-card" onclick="switchScreen('analyse')">
        <span class="nav-card-icon">⚡</span>
        <div class="nav-card-title">ANALYSE</div>
        <div class="nav-card-sub">AI analyse, value scan en combi tips</div>
        <div class="nav-badge nb-pink">AI POWERED</div>
        <span class="nav-card-arrow">→</span>
      </div>
      <div class="nav-card" onclick="switchScreen('wallet')">
        <span class="nav-card-icon">💰</span>
        <div class="nav-card-title">WALLET</div>
        <div class="nav-card-sub">Bets, tracker, backtest en pick analyse</div>
        ${openBets.length ? `<div class="nav-badge nb-green">${openBets.length} OPEN</div>` : `<div class="nav-badge nb-gray">€${wallet.balance.toFixed(0)}</div>`}
        <span class="nav-card-arrow">→</span>
      </div>
      <div class="nav-card" onclick="switchScreen('instellingen')">
        <span class="nav-card-icon">⚙️</span>
        <div class="nav-card-title">INSTELLINGEN</div>
        <div class="nav-card-sub">API keys, thema, notificaties en account</div>
        <div class="nav-badge nb-gray">CONFIG</div>
        <span class="nav-card-arrow">→</span>
      </div>
    </div>

    <!-- WK 2026 countdown -->
    ${wkDays > 0 ? `
    <div style="background:linear-gradient(135deg,rgba(37,99,235,.08),rgba(124,58,237,.06));border:1px solid rgba(37,99,235,.2);border-radius:14px;padding:.8rem 1rem;margin-top:.8rem;cursor:pointer;" onclick="switchScreen('wedstrijden');setTimeout(()=>selectComp('wk2026'),200)">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.05rem;letter-spacing:.06em;color:#2563eb;">🏆 WK 2026</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);">United States · Mexico · Canada</div>
        </div>
        <div>
          <div id="wkCountdown" style="font-family:'IBM Plex Mono',monospace;font-size:.58rem;font-weight:700;color:#7c3aed;text-align:right;"></div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);text-align:right;">tot aftrap</div>
        </div>
      </div>
    </div>` : ''}

    <!-- Disclaimer -->
    <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;color:var(--sub);text-align:center;margin-top:1rem;line-height:1.8;padding:.65rem;background:rgba(220,38,38,.05);border:1px solid rgba(220,38,38,.1);border-radius:10px;">
      ⚠️ Uitsluitend voor <b>entertainment & educatie</b> · Geen echt gokadvies<br>
      Speel verantwoord · 18+ · Verslavingslijn: <b>0900-1090</b>
    </div>

    <!-- Made by -->
    <div style="text-align:center;margin-top:.8rem;">
      <div class="made-by">Made by Rob Borghouts</div>
    </div>
  `;

  // Start WK countdown update
  updateWKCountdown();
}

function updateWalletUI() {
  // Update stats strip als dashboard zichtbaar
  if (state.activeScreen === 'dashboard') renderDashboard();

  // Update wallet screen
  const walletScreen = document.getElementById('screen-wallet');
  if (!walletScreen || !walletScreen.classList.contains('active')) return;

  const w = state.wallet;
  const bets = w.bets || [];
  const settled = bets.filter(b => b.status !== 'pending');
  const won = settled.filter(b => b.status === 'win');
  const pnl = won.reduce((s,b) => s + (b.payout - b.amount), 0) -
              settled.filter(b => b.status === 'lose').reduce((s,b) => s + b.amount, 0);
  const hitrate = settled.length ? Math.round(won.length / settled.length * 100) : 0;

  const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  setEl('wSaldo', '€' + w.balance.toFixed(2));
  setEl('wPnl', (pnl>=0?'+':'') + '€' + pnl.toFixed(2));
  setEl('wBets', bets.length);
  setEl('wHitrate', settled.length ? hitrate + '%' : '—');

  const pnlEl = document.getElementById('wPnl');
  if (pnlEl) pnlEl.style.color = pnl >= 0 ? '#16a34a' : '#dc2626';

  renderBetsList();
  renderWalletChart();
}
