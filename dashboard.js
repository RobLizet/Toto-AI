// ═══════════════════════════════════════════════════════
// DASHBOARD.JS — v19.1 verbeterd dashboard
// ═══════════════════════════════════════════════════════

async function fetchDailyTip() {
  try {
    const r = await fetch('https://toto-proxy.zweetzakken.workers.dev/daily-tip');
    if (!r.ok) return null;
    return await r.json();
  } catch(e) { return null; }
}

function renderDashboard() {
  const screen = document.getElementById('screen-dashboard');
  if (!screen) return;

  const wallet = state.wallet || { balance: 500, bets: [] };
  const bets = wallet.bets || [];
  const settled = bets.filter(b => b.status !== 'pending');
  const won = settled.filter(b => b.status === 'win');
  const pnl = won.reduce((s,b) => s + (b.payout - b.amount), 0) -
              settled.filter(b => b.status === 'lose').reduce((s,b) => s + b.amount, 0);
  const hitrate = settled.length ? Math.round(won.length / settled.length * 100) : 0;
  const pnlPos = pnl >= 0;
  const openBets = bets.filter(b => b.status === 'pending');

  // Scan log stats
  const scanLog = state.scanLog || [];
  const allPicks = scanLog.flatMap(s => s.picks || []);
  const settledPicks = allPicks.filter(p => p.status === 'win' || p.status === 'lose');
  const winPicks = settledPicks.filter(p => p.status === 'win');
  const scanHitrate = settledPicks.length ? Math.round(winPicks.length / settledPicks.length * 100) : null;
  const scanROI = settledPicks.length
    ? (settledPicks.reduce((s,p) => s + (p.status==='win' ? (p.odds-1) : -1), 0) / settledPicks.length * 100)
    : null;

  // Value picks beschikbaar
  const valuePicks = (state.valueScans||[]).filter(s => s.value >= 5);
  const topValuePick = valuePicks.sort((a,b) => (b.value||0)-(a.value||0))[0];

  // WK countdown
  // Weekoverzicht berekenen
  const weekNow = new Date();
  const weekStart = new Date(weekNow);
  weekStart.setDate(weekNow.getDate() - weekNow.getDay());
  weekStart.setHours(0,0,0,0);
  const weekScans = scanLog.filter(s => new Date(s.timestamp||0) >= weekStart);
  const weekPicksArr = weekScans.flatMap(s => s.picks||[]);
  const weekSettled = weekPicksArr.filter(p => p.status==='win'||p.status==='lose');
  const weekWins = weekSettled.filter(p => p.status==='win');
  const weekHR = weekSettled.length ? Math.round(weekWins.length/weekSettled.length*100) : null;
  const weekOpen = weekPicksArr.filter(p => p.status==='pending').length;

  const wkStart = new Date('2026-06-11T00:00:00');
  const now = new Date();
  const wkDiff = wkStart - now;
  const wkDays = wkDiff > 0 ? Math.floor(wkDiff / (1000*60*60*24)) : 0;
  const wkHours = wkDiff > 0 ? Math.floor((wkDiff % (1000*60*60*24)) / (1000*60*60)) : 0;
  const wkMins = wkDiff > 0 ? Math.floor((wkDiff % (1000*60*60)) / (1000*60)) : 0;

  // Calibratie status
  const calibMeta = window._calibrationCache?.meta || {};
  const isCalibrated = (calibMeta.settledBets || 0) >= 10;

  // Laad dagelijkse tip asynchroon
  fetchDailyTip().then(function(tip) {
    var tipCard = document.getElementById('daily-tip-card');
    if (!tipCard || !tip || !tip.tip) return;
    var today = new Date().toISOString().split('T')[0];
    var isToday = tip.date === today;
    var tipLines = tip.tip.split('\n').filter(Boolean);
    var card = document.createElement('div');
    card.style.cssText = 'background:linear-gradient(135deg,rgba(219,39,119,.08),rgba(124,58,237,.06));border:1px solid rgba(219,39,119,.2);border-radius:16px;padding:.85rem 1rem;cursor:pointer;';
    card.onclick = function() { switchScreen('analyse'); };
    var hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;';
    var t1 = document.createElement('div');
    t1.style.cssText = 'font-family:Bebas Neue,sans-serif;font-size:1rem;color:#be185d;';
    t1.textContent = '🎯 TIP VAN DE DAG';
    var t2 = document.createElement('div');
    t2.style.cssText = 'font-family:IBM Plex Mono,monospace;font-size:.42rem;color:var(--sub);';
    t2.textContent = isToday ? 'Vandaag' : (tip.date || '');
    hdr.appendChild(t1); hdr.appendChild(t2);
    card.appendChild(hdr);
    tipLines.forEach(function(line) {
      var isTitle = line.charAt(0) === '🎯' || line.indexOf('TIP') === 0;
      var isDisclaimer = line.charAt(0) === '⚠';
      var div = document.createElement('div');
      div.style.cssText = 'font-family:IBM Plex Mono,monospace;line-height:1.6;margin-bottom:.2rem;font-size:' + (isTitle ? '.6rem' : '.5rem') + ';font-weight:' + (isTitle ? '700' : '400') + ';color:' + (isTitle ? '#be185d' : isDisclaimer ? 'var(--sub)' : 'var(--ink)') + ';';
      div.textContent = line;
      card.appendChild(div);
    });
    tipCard.innerHTML = '';
    tipCard.appendChild(card);
  });

  screen.innerHTML = `
    <!-- Stats strip -->
    <div class="dash-stats">
      <div class="dash-stat" onclick="switchScreen('wallet')">
        <div class="dash-stat-val" style="color:#be185d;">€${wallet.balance.toFixed(0)}</div>
        <div class="dash-stat-lbl">SALDO</div>
      </div>
      <div class="dash-stat" onclick="switchScreen('wallet')">
        <div class="dash-stat-val" style="color:${pnlPos?'#16a34a':'#dc2626'};">${pnlPos?'+':''}€${pnl.toFixed(0)}</div>
        <div class="dash-stat-lbl">W/V</div>
      </div>
      <div class="dash-stat" onclick="switchScreen('analyse');setTimeout(()=>showAnalyseSubTab('log'),100)">
        <div class="dash-stat-val" style="color:#2563eb;">${allPicks.length}</div>
        <div class="dash-stat-lbl">PICKS</div>
      </div>
      <div class="dash-stat" onclick="switchScreen('analyse');setTimeout(()=>showAnalyseSubTab('log'),100)">
        <div class="dash-stat-val" style="color:#7c3aed;">${scanHitrate !== null ? scanHitrate + '%' : '—'}</div>
        <div class="dash-stat-lbl">HITRATE</div>
      </div>
    </div>

    <!-- Open bets -->
    ${openBets.length ? `
    <div style="background:rgba(37,99,235,.06);border:1px solid rgba(37,99,235,.18);border-radius:14px;
      padding:.7rem 1rem;margin-bottom:.75rem;cursor:pointer;" onclick="switchScreen('wallet')">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.58rem;font-weight:800;color:#2563eb;">⏳ ${openBets.length} OPEN BET${openBets.length>1?'S':''}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;color:var(--sub);margin-top:.15rem;">${openBets.slice(0,2).map(b=>b.matchName||b.match||'?').join(' · ')}</div>
        </div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:#2563eb;">€${openBets.reduce((s,b)=>s+b.amount,0).toFixed(0)}</div>
      </div>
    </div>` : ''}

    <!-- Top value pick als beschikbaar -->
    ${topValuePick ? `
    <div style="background:linear-gradient(135deg,rgba(22,163,74,.08),rgba(5,150,105,.04));
      border:1px solid rgba(22,163,74,.2);border-radius:14px;padding:.75rem 1rem;margin-bottom:.75rem;cursor:pointer;"
      onclick="switchScreen('wallet');setTimeout(()=>setWalletSubTab('value'),100)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="flex:1;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;font-weight:800;color:#15803d;margin-bottom:.2rem;">⚡ BESTE VALUE PICK</div>
          <div style="font-family:'DM Sans',sans-serif;font-size:.8rem;font-weight:700;color:var(--ink);">${topValuePick.match?.home||topValuePick.home||'?'} vs ${topValuePick.match?.away||topValuePick.away||'?'}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);margin-top:.15rem;">${topValuePick.pickLabel||topValuePick.pick} · conf ${topValuePick.confidence||'?'}/10</div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:#15803d;">+${Math.round(topValuePick.value||0)}%</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:.9rem;color:#16a34a;">${parseFloat(topValuePick.odds||0).toFixed(2)}</div>
        </div>
      </div>
    </div>` : ''}

    <!-- Nav kaarten -->
    <div class="dash-nav-grid">
      <div class="dash-nav-card" onclick="switchScreen('wedstrijden')">
        <div class="dash-nav-icon">⚽</div>
        <div class="dash-nav-title">WEDSTRIJDEN</div>
        <div class="dash-nav-sub">Laad matches, bekijk quotes en value indicators</div>
        <div class="dash-nav-badge">LIVE API</div>
      </div>
      <div class="dash-nav-card" onclick="switchScreen('analyse')">
        <div class="dash-nav-icon">⚡</div>
        <div class="dash-nav-title">ANALYSE</div>
        <div class="dash-nav-sub">AI analyse, value scan en combi tips</div>
        <div class="dash-nav-badge">AI POWERED</div>
      </div>
      <div class="dash-nav-card" onclick="switchScreen('wallet');setTimeout(()=>setWalletSubTab('wallet'),100)">
        <div class="dash-nav-icon">💰</div>
        <div class="dash-nav-title">WALLET</div>
        <div class="dash-nav-sub">Bets, tracker, backtest en pick analyse</div>
        <div class="dash-nav-badge">€${wallet.balance.toFixed(0)}</div>
      </div>
      <div class="dash-nav-card" onclick="switchScreen('instellingen')">
        <div class="dash-nav-icon">⚙️</div>
        <div class="dash-nav-title">INSTELLINGEN</div>
        <div class="dash-nav-sub">API keys, thema, notificaties en account</div>
        <div class="dash-nav-badge">CONFIG</div>
      </div>
    </div>

    <!-- Tip van de dag -->
    <div id="daily-tip-card" style="margin-bottom:.75rem;"></div>

    <!-- Weekoverzicht -->
    ${weekScans.length ? `
    <div style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;padding:.75rem 1rem;margin-bottom:.75rem;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;font-weight:800;color:var(--sub);margin-bottom:.5rem;">📅 DEZE WEEK</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:.4rem;">
        <div style="text-align:center;background:rgba(15,23,42,.04);border-radius:10px;padding:.4rem;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:#2563eb;">${weekScans.length}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);">SCANS</div>
        </div>
        <div style="text-align:center;background:rgba(15,23,42,.04);border-radius:10px;padding:.4rem;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:#7c3aed;">${weekPicksArr.length}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);">PICKS</div>
        </div>
        <div style="text-align:center;background:rgba(15,23,42,.04);border-radius:10px;padding:.4rem;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:${weekHR!==null&&weekHR>=50?'#16a34a':'#dc2626'};">${weekHR !== null ? weekHR+'%' : '—'}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);">HITRATE</div>
        </div>
        <div style="text-align:center;background:rgba(15,23,42,.04);border-radius:10px;padding:.4rem;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:#be185d;">${weekOpen}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);">OPEN</div>
        </div>
      </div>
    </div>` : ''}

    <!-- Confidence engine status -->
    ${scanROI !== null ? `
    <div style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;padding:.75rem 1rem;margin-bottom:.75rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;font-weight:800;color:var(--sub);">📊 TRACKRECORD</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;color:var(--sub);">${settledPicks.length}/100 picks</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;">
        <div style="text-align:center;background:rgba(15,23,42,.04);border-radius:10px;padding:.4rem;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:${scanHitrate>=50?'#16a34a':'#dc2626'};">${scanHitrate}%</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.4rem;color:var(--sub);">HITRATE</div>
        </div>
        <div style="text-align:center;background:rgba(15,23,42,.04);border-radius:10px;padding:.4rem;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:${scanROI>=0?'#16a34a':'#dc2626'};">${scanROI>=0?'+':''}${scanROI.toFixed(1)}%</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.4rem;color:var(--sub);">ROI</div>
        </div>
        <div style="text-align:center;background:rgba(15,23,42,.04);border-radius:10px;padding:.4rem;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:${isCalibrated?'#16a34a':'#d97706'};">${isCalibrated?'✓':'⟳'}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.4rem;color:var(--sub);">${isCalibrated?'GEKALIBREERD':'LEREN...'}</div>
        </div>
      </div>
      <div style="background:rgba(15,23,42,.06);border-radius:999px;height:5px;overflow:hidden;margin-top:.5rem;">
        <div style="background:linear-gradient(90deg,#be185d,#7c3aed);height:100%;border-radius:999px;width:${Math.min(100,settledPicks.length)}%;transition:width .4s;"></div>
      </div>
    </div>` : ''}

    <!-- WK 2026 countdown -->
    ${wkDiff > 0 ? `
    <div style="background:linear-gradient(135deg,rgba(219,39,119,.08),rgba(124,58,237,.06));
      border:1px solid rgba(219,39,119,.2);border-radius:14px;padding:.75rem 1rem;margin-bottom:.75rem;cursor:pointer;"
      onclick="switchScreen('wedstrijden');setTimeout(()=>selectComp('wk2026'),300)">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:#be185d;">🏆 WK 2026</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;color:var(--sub);margin-top:.15rem;">United States · Mexico · Canada</div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:#be185d;">${wkDays}d ${wkHours}u ${wkMins}m</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);">Start 11 juni</div>
        </div>
      </div>
    </div>` : ''}

    <!-- Disclaimer -->
    <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;color:var(--sub);text-align:center;padding:.75rem;line-height:1.6;border-top:1px solid var(--stroke);margin-top:.5rem;">
      ⚠️ Uitsluitend voor <b>entertainment & educatie</b> · Geen echt gokadvies<br>
      Speel verantwoord · 18+ · Verslavingslijn: 0900-1090
    </div>

    <div style="font-family:'Dancing Script',cursive;font-size:.75rem;color:var(--sub);text-align:center;padding:.5rem 0 1rem;">
      Made by Rob Borghouts
    </div>
  `;
}
