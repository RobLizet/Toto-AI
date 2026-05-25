// ═══════════════════════════════════════════════════════
// DASHBOARD.JS — v19.2 WK-aware: live banner, dynamische competitie lijst
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
  // Alleen kwalitatieve picks voor de 100 teller
  const DREMPEL = { minValue: 8, minConf: 6 };
  const kwaliPicks = allPicks.filter(p =>
    !p.isSparseData &&
    (p.value||0) >= DREMPEL.minValue &&
    (p.confidence||0) >= DREMPEL.minConf
  );
  const settledPicks = kwaliPicks.filter(p => p.status === 'win' || p.status === 'lose');
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
  const wkEnd = new Date('2026-07-20T00:00:00');
  const wkEndDiff = wkEnd - now;

  // Calibratie status
  const calibMeta = window._calibrationCache?.meta || {};
  const isCalibrated = (calibMeta.settledBets || 0) >= 10;

  screen.innerHTML = `

    <!-- 100 picks voortgang -->
    <div style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;padding:.7rem 1rem;margin-bottom:.75rem;cursor:pointer;"
      onclick="showPicksModal()">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;font-weight:800;color:var(--sub);">🎯 VOORTGANG NAAR 100 PICKS</div>
        <div style="display:flex;align-items:center;gap:.4rem;">
          ${settledPicks.length ? (() => {
            if (scanROI >= 15 && scanHitrate >= 40)  return '<span style="font-size:1.3rem;">😄</span>';
            if (scanROI >= 5  || scanHitrate >= 35)  return '<span style="font-size:1.3rem;">🙂</span>';
            if (scanROI >= 0  && scanHitrate >= 28)  return '<span style="font-size:1.3rem;">😐</span>';
            if (scanROI >= -10)                       return '<span style="font-size:1.3rem;">😕</span>';
            return '<span style="font-size:1.3rem;">😞</span>';
          })() : '<span style="font-size:1.3rem;opacity:.3;">😶</span>'}
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:#be185d;">${kwaliPicks.length}<span style="font-size:.65rem;color:var(--sub);">/100</span></div>
        </div>
      </div>
      <div style="background:rgba(15,23,42,.08);border-radius:999px;height:8px;overflow:hidden;">
        <div style="height:100%;border-radius:999px;background:linear-gradient(90deg,#be185d,#7c3aed);width:${Math.min(100,kwaliPicks.length)}%;transition:width .4s;"></div>
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;color:var(--sub);margin-top:.35rem;">
        ${kwaliPicks.length === 0 ? 'Scan wedstrijden om picks te verzamelen →' : (() => {
          const openCount = kwaliPicks.filter(p => !p.status || p.status === 'pending').length;
          const parts = [];
          if (openCount > 0)           parts.push(openCount + ' open');
          if (settledPicks.length > 0) parts.push(settledPicks.length + ' afgerond');
          if (scanHitrate !== null)     parts.push(scanHitrate + '% hitrate');
          if (scanROI !== null)         parts.push('ROI ' + (scanROI >= 0 ? '+' : '') + scanROI.toFixed(1) + '%');
          return parts.join(' · ') || 'Tik voor details →';
        })()}
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
      onclick="(function(){var mid=(topValuePick&&(topValuePick.match?.id||topValuePick.matchId||''));switchScreen('analyse');setTimeout(()=>{showAnalyseSubTab('scan');if(mid&&typeof openValueAnalysis==='function')openValueAnalysis(mid);},150);})()">
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
      <div class="dash-nav-card" onclick="openCompKeuze()">
        <div class="dash-nav-icon">🏆</div>
        <div class="dash-nav-title">COMPETITIES</div>
        <div class="dash-nav-sub">Stand, topscorers en wedstrijden per competitie</div>
        <div class="dash-nav-badge">INFO</div>
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
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:${isCalibrated?'#16a34a':'#d97706'};">${isCalibrated?'✓':'${settledPicks.length}/10'}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.4rem;color:var(--sub);">${isCalibrated?'AI GECALIB.':'AI LEERT'}</div>
        </div>
      </div>
      <div style="background:rgba(15,23,42,.06);border-radius:999px;height:5px;overflow:hidden;margin-top:.5rem;">
        <div style="background:linear-gradient(90deg,#be185d,#7c3aed);height:100%;border-radius:999px;width:${Math.min(100,settledPicks.length)}%;transition:width .4s;"></div>
      </div>
    </div>` : ''}

    <!-- WK 2026 countdown / live banner -->
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
    </div>` : wkEndDiff > 0 ? `
    <div style="background:linear-gradient(135deg,rgba(220,38,38,.12),rgba(234,179,8,.08));
      border:1px solid rgba(220,38,38,.3);border-radius:14px;padding:.75rem 1rem;margin-bottom:.75rem;cursor:pointer;animation:pulse-red 2s infinite;"
      onclick="switchScreen('wedstrijden');setTimeout(()=>selectComp('wk2026'),300)">
      <style>@keyframes pulse-red{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.3)}50%{box-shadow:0 0 0 6px rgba(220,38,38,0)}}</style>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:#dc2626;">🔴 WK 2026 LIVE</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;color:var(--sub);margin-top:.15rem;">United States · Mexico · Canada</div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;font-weight:800;color:#dc2626;">BEZIG</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);">Finale: 19 juli</div>
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

  // Laad dagelijkse tip na render
  const cachedTip = state._dailyTipCache;
  if (cachedTip) setTimeout(() => renderDailyTipCard(cachedTip), 0);
  const lastFetch = state._dailyTipFetchTime || 0;
  if (Date.now() - lastFetch > 600000 || !cachedTip) {
    fetchDailyTip().then(function(tip) {
      if (tip) { state._dailyTipCache = tip; state._dailyTipFetchTime = Date.now(); }
      renderDailyTipCard(tip);
    });
  }
}

function renderDailyTipCard(tip) {
    const tipCard = document.getElementById('dailyTipCard');
    if (!tipCard) return;
    // Geen tip of niet gekwalificeerd
    if (!tip || !tip.qualified) {
      tipCard.innerHTML = `<div style="background:var(--card);border:1px solid var(--stroke);border-radius:16px;padding:.75rem 1rem;opacity:.6;">
        <div style="display:flex;align-items:center;gap:.5rem;">
          <div style="font-size:1.1rem;">🎯</div>
          <div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.56rem;font-weight:800;color:var(--sub);">TIP VAN DE DAG</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);">Vandaag geen gekwalificeerde pick — scan meer wedstrijden.</div>
          </div>
        </div>
      </div>`;
      return;
    }

    // Sterren op basis van confidence
    var stars = '';
    var conf = tip.confidence || 0;
    for (var i = 0; i < 5; i++) stars += i < Math.round(conf/2) ? '★' : '☆';
    var valColor = (tip.value||0) >= 15 ? '#15803d' : '#b45309';

    tipCard.innerHTML = `<div style="background:linear-gradient(135deg,rgba(219,39,119,.08),rgba(124,58,237,.06));
      border:1px solid rgba(219,39,119,.2);border-radius:16px;padding:.85rem 1rem;cursor:pointer;"
      onclick="switchScreen('analyse');setTimeout(()=>{showAnalyseSubTab('scan');if(tip&&tip.fixtureId&&typeof openValueAnalysis==='function')openValueAnalysis(tip.fixtureId);},150)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:#be185d;letter-spacing:.04em;">🎯 TIP VAN DE DAG</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.42rem;color:var(--sub);">${isToday ? 'Vandaag' : (tip.date||'')}</div>
      </div>
      <div style="font-family:'DM Sans',sans-serif;font-size:.85rem;font-weight:800;color:var(--ink);margin-bottom:.3rem;">${tip.match||'?'}</div>
      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.45rem;">
        <span style="background:rgba(219,39,119,.12);border:1px solid rgba(219,39,119,.25);
          color:#be185d;font-family:'IBM Plex Mono',monospace;font-size:.54rem;font-weight:800;
          border-radius:8px;padding:.2rem .5rem;">${tip.pickLabel||'?'}</span>
        <span style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:#16a34a;">${tip.odds||'?'}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:.54rem;font-weight:800;color:${valColor};">+${Math.round(tip.value||0)}%</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:.6rem;color:#f59e0b;margin-left:auto;">${stars}</span>
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);line-height:1.65;">${tip.analyse||tip.tip||''}</div>
      <div style="margin-top:.45rem;font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);opacity:.7;">
        🎲 ${conf}/10 confidence · ${tip.markt||'Uitslag'} · Uitsluitend entertainment & educatie
      </div>
    </div>`;
}

// ── Competitie keuze popup ────────────────────────────────
function openCompKeuze() {
  document.getElementById('compKeuzeOverlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'compKeuzeOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.6);backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center;';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

  const sheet = document.createElement('div');
  sheet.style.cssText = 'width:100%;max-width:520px;max-height:85vh;overflow-y:auto;background:linear-gradient(160deg,#fdf4ff,#f0f4ff);border-radius:24px 24px 0 0;padding:1rem 1rem 2rem;';

  // Handle
  sheet.innerHTML = '<div style="text-align:center;margin-bottom:.75rem;"><div style="width:36px;height:4px;background:rgba(15,23,42,.15);border-radius:999px;display:inline-block;"></div></div>';

  // Header
  const hdr = document.createElement('div');
  hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:.85rem;';
  hdr.innerHTML = '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.2rem;background:linear-gradient(135deg,#be185d,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">KIES COMPETITIE</div>';
  const closeBtn = document.createElement('button');
  closeBtn.style.cssText = 'background:rgba(15,23,42,.08);border:none;border-radius:50%;width:2rem;height:2rem;font-size:1rem;cursor:pointer;';
  closeBtn.textContent = '✕';
  closeBtn.onclick = () => overlay.remove();
  hdr.appendChild(closeBtn);
  sheet.appendChild(hdr);

  // Competitie grid
  // Dynamische competitie lijst op basis van huidige datum
  const _now = new Date();
  const _wkStart = new Date('2026-06-11');
  const _wkEnd   = new Date('2026-07-20');
  const _euroEnd  = new Date('2026-06-01');
  const _isWKActive = _now >= _wkStart && _now < _wkEnd;
  const _isPreEuroEnd = _now < _euroEnd;

  const EURO_COMPS = [
    {key:'premier',flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿',name:'Premier League'},
    {key:'laliga',flag:'🇪🇸',name:'La Liga'},
    {key:'seriea',flag:'🇮🇹',name:'Serie A'},
    {key:'bundesliga',flag:'🇩🇪',name:'Bundesliga'},
    {key:'ligue1',flag:'🇫🇷',name:'Ligue 1'},
    {key:'champions',flag:'⭐',name:'Champions League'},
    {key:'eredivisie',flag:'🇳🇱',name:'Eredivisie'},
  ];
  const ZOMER_COMPS = [
    {key:'brasileirao',flag:'🇧🇷',name:'Brasileirão'},
    {key:'argentina',flag:'🇦🇷',name:'Liga Argentina'},
    {key:'mls',flag:'🇺🇸',name:'MLS'},
  ];
  const WK_COMP = [{key:'wk2026',flag:'🏆',name:'WK 2026'}];

  let COMPS;
  if (_isWKActive) {
    COMPS = [...WK_COMP, ...ZOMER_COMPS];
  } else if (_isPreEuroEnd) {
    COMPS = [...EURO_COMPS, ...ZOMER_COMPS, ...WK_COMP];
  } else {
    // 1 jun – 10 jun en post-WK
    COMPS = [...WK_COMP, ...ZOMER_COMPS, ...EURO_COMPS];
  }

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;';

  COMPS.forEach(c => {
    const tile = document.createElement('div');
    tile.style.cssText = 'background:rgba(255,255,255,.8);border:1.5px solid rgba(15,23,42,.08);border-radius:14px;padding:.7rem .4rem;text-align:center;cursor:pointer;';
    tile.innerHTML = `<div style="font-size:1.4rem;">${c.flag}</div><div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;font-weight:700;color:var(--sub);margin-top:.2rem;">${c.name}</div>`;
    tile.onclick = () => {
      overlay.remove();
      if (typeof openCompDetail === 'function') openCompDetail(c.key);
    };
    grid.appendChild(tile);
  });

  sheet.appendChild(grid);

  // Swipe to close
  let startY = 0;
  sheet.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, {passive:true});
  sheet.addEventListener('touchend', e => { if (e.changedTouches[0].clientY - startY > 80) overlay.remove(); }, {passive:true});

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
}

// ── Picks Modal ──────────────────────────────────────────
function showPicksModal() {
  const scanLog = state.scanLog || [];
  const allPicks = scanLog.flatMap(s => s.picks || []);
  const DREMPEL = { minValue: 8, minConf: 6 };
  const kwaliPicks = allPicks.filter(p =>
    !p.isSparseData &&
    (p.value||0) >= DREMPEL.minValue &&
    (p.confidence||0) >= DREMPEL.minConf
  );

  const settled   = kwaliPicks.filter(p => p.status === 'win' || p.status === 'lose');
  const open      = kwaliPicks.filter(p => !p.status || p.status === 'pending');
  const wins      = settled.filter(p => p.status === 'win');
  const hitrate   = settled.length ? Math.round(wins.length / settled.length * 100) : null;
  const roi       = settled.length
    ? (settled.reduce((s,p) => s + (p.status==='win' ? (p.odds-1) : -1), 0) / settled.length * 100)
    : null;

  const statusIcon = s => s === 'win' ? '✅' : s === 'lose' ? '❌' : '⏳';
  const statusColor = s => s === 'win' ? '#16a34a' : s === 'lose' ? '#dc2626' : 'var(--sub)';

  // Sorteer: afgerond bovenaan, dan open
  const sorted = [...settled.reverse(), ...open];

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:flex-end;';

  const sheet = document.createElement('div');
  sheet.style.cssText = 'background:var(--bg);border-radius:20px 20px 0 0;width:100%;max-height:85vh;overflow-y:auto;padding:1rem;';

  sheet.innerHTML = `
    <div style="width:40px;height:4px;background:rgba(0,0,0,.15);border-radius:2px;margin:0 auto .75rem;"></div>
    <div style="font-family:'Bebas Neue',sans-serif;font-size:1.2rem;margin-bottom:.5rem;">🎯 Picks Overzicht</div>

    <!-- Samenvatting stats -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.4rem;margin-bottom:.75rem;">
      ${[
        ['PICKS', kwaliPicks.length],
        ['OPEN', open.length],
        ['HITRATE', hitrate !== null ? hitrate + '%' : '—'],
        ['ROI', roi !== null ? (roi >= 0 ? '+' : '') + roi.toFixed(1) + '%' : '—'],
      ].map(([label, val]) => `
        <div style="background:var(--card);border:1px solid var(--stroke);border-radius:10px;padding:.4rem;text-align:center;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);">${label}</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:.9rem;color:#be185d;">${val}</div>
        </div>`).join('')}
    </div>

    <!-- Picks lijst -->
    ${sorted.length === 0 ? '<div style="text-align:center;color:var(--sub);font-size:.8rem;padding:1rem;">Nog geen picks — scan wedstrijden!</div>' :
      sorted.map(p => `
        <div style="background:var(--card);border:1px solid var(--stroke);border-radius:10px;padding:.5rem .7rem;margin-bottom:.4rem;display:flex;justify-content:space-between;align-items:center;">
          <div style="flex:1;min-width:0;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.match||p.matchName||'?'}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.42rem;color:var(--sub);">${p.pickLabel||p.pick||'?'} · @${p.odds||'?'} · +${p.value||0}% value</div>
          </div>
          <div style="text-align:right;margin-left:.5rem;">
            <div style="font-size:1rem;">${statusIcon(p.status)}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:${statusColor(p.status)};">${p.status==='win'?'GEWONNEN':p.status==='lose'?'VERLOREN':'OPEN'}</div>
          </div>
        </div>`).join('')}
    </div>
  `;

  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  let startY = 0;
  sheet.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, {passive:true});
  sheet.addEventListener('touchend', e => { if (e.changedTouches[0].clientY - startY > 80) overlay.remove(); }, {passive:true});

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
}
