// ═══════════════════════════════════════════════════════
// dashboard.js v16
// v16: Speeldatum + tijd in live kaarten + dedup 100-picks teller
// v15: Live scores tab — pending picks met live stand + win/verlies, ververst 60s
// v14: Killer stats resultatenpagina (wallet)
// v13: "Waarom deze pick?" signalen, bullshitfilter waarschuwing

// ── Pick signalen — snelle uitleg per pick ────────────────
function buildPickReasons(p) {
  const signals = [];
  if ((p.value||0) >= 20)      signals.push({ icon: '🔥', text: 'Hoge value +' + Math.round(p.value) + '%', color: '#00BEC4' });
  else if ((p.value||0) >= 10) signals.push({ icon: '⚡', text: 'Value +' + Math.round(p.value) + '%', color: '#b45309' });
  if ((p.confidence||0) >= 8)  signals.push({ icon: '🎯', text: 'Hoge confidence ' + p.confidence + '/10', color: '#00BEC4' });
  else if ((p.confidence||0) >= 6) signals.push({ icon: '🎲', text: 'Conf ' + p.confidence + '/10', color: '#b45309' });
  const lock = p.lockLevel || (typeof detectLockLevel === 'function' ? detectLockLevel(p.fixtureId, p.pick) : 'single');
  if (lock === 'triple')       signals.push({ icon: '🔒', text: 'Triple Lock — 3x bevestigd', color: '#00BEC4' });
  else if (lock === 'double')  signals.push({ icon: '🔒', text: 'Double Lock — 2x bevestigd', color: '#b45309' });
  if (p.elite)                 signals.push({ icon: '⭐', text: 'Elite pick', color: '#00a8ad' });
  if (p.poissonUsed || (p.poissonK1 && p.poissonK2))
    signals.push({ icon: '📐', text: 'Poisson + AI model', color: '#64748b' });
  if (p.aiKans && p.odds) {
    const diff = (p.aiKans||0) - Math.round(100 / p.odds);
    if (diff >= 10)      signals.push({ icon: '📊', text: 'Odds verkeerd geprijsd (+' + diff + '%)', color: '#00BEC4' });
    else if (diff >= 5)  signals.push({ icon: '📊', text: 'Lichte mispricing (+' + diff + '%)', color: '#b45309' });
  }
  if (p.isSparseData || (p.confidence||0) < 5)
    signals.push({ icon: '⚠️', text: 'Weinig data — lagere betrouwbaarheid', color: '#dc2626' });
  return signals;
}

function renderPickReasons(p) {
  const signals = buildPickReasons(p);
  if (!signals.length) return '';
  return `<div style="display:flex;flex-wrap:wrap;gap:.25rem;margin-top:.35rem;">
    ${signals.map(s => `<span style="font-family:\'IBM Plex Mono\',monospace;font-size:.38rem;background:${s.color}18;color:${s.color};border:1px solid ${s.color}33;border-radius:6px;padding:.1rem .35rem;white-space:nowrap;">${s.icon} ${s.text}</span>`).join('')}
  </div>`;
}


// Token = HMAC-SHA256(SCAN_SECRET + timestamp_minute)
const SCAN_SECRET = 'totoai2026'; // Zelfde als SCAN_SECRET in Cloudflare env
// Admin UIDs — voeg jouw Firebase UID toe
const ADMIN_UIDS = ['NpbaXO16xwha4Dm4Jgn9RqTM9Fq1'];

function checkAdminStatus() {
  const uid = window.firebase?.auth?.()?.currentUser?.uid
    || (typeof auth !== 'undefined' && auth?.currentUser?.uid)
    || null;
  window._isAdmin = uid ? ADMIN_UIDS.includes(uid) : false;
}
const WORKER_URL  = 'https://toto-proxy.zweetzakken.workers.dev';

async function generateScanToken() {
  const encoder = new TextEncoder();
  const nowMinute = Math.floor(Date.now() / 60000);
  const keyData = encoder.encode(SCAN_SECRET);
  const msgData = encoder.encode(String(nowMinute));
  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, msgData);
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function triggerWorkerScan() {
  try {
    const token = await generateScanToken();
    const res = await fetch(`${WORKER_URL}/scan?token=${token}`);
    const data = await res.json();
    return data;
  } catch(e) {
    console.error('[Scan] Worker scan fout:', e);
    return { error: e.message };
  }
}

async function triggerWorkerSettle() {
  try {
    const token = await generateScanToken();
    const res = await fetch(`${WORKER_URL}/settle?token=${token}`);
    const data = await res.json();
    return data;
  } catch(e) {
    console.error('[Settle] Fout:', e);
    return { error: e.message };
  }
}


// DASHBOARD.JS — v30.3 HMAC scan tokens, admin scan knop
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
  checkAdminStatus(); // v32.2: zorg dat admin status altijd actueel is bij render

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
  const allPicksRaw = scanLog.flatMap(s => s.picks || []);
  // Dedup op fixtureId+pick — settled altijd behouden, pending alleen meest recente
  const _seenDash = new Set();
  const allPicks = allPicksRaw.filter(p => {
    if (p.status === 'win' || p.status === 'lose') return true;
    const key = (p.fixtureId || p.match || '') + '_' + (p.pick || '');
    if (_seenDash.has(key)) return false;
    _seenDash.add(key);
    return true;
  });
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

    <!-- Dashboard tabs -->
    <div style="display:flex;gap:.4rem;margin-bottom:.75rem;background:rgba(15,23,42,.04);border-radius:12px;padding:.25rem;">
      <button id="dashTabOverview" onclick="switchDashTab('overview')" style="flex:1;border:none;border-radius:9px;padding:.5rem;font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:700;cursor:pointer;background:rgba(255,255,255,0.05);color:var(--text);box-shadow:0 1px 3px rgba(0,0,0,.1);">📊 OVERZICHT</button>
      <button id="dashTabLive" onclick="switchDashTab('live')" style="flex:1;border:none;border-radius:9px;padding:.5rem;font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:700;cursor:pointer;background:transparent;color:rgba(255,255,255,.5);">🔴 LIVE</button>
    </div>

    <div id="dashOverviewContent">

    <!-- Voortgang kaart — ring + stats rij -->
    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);border-radius:16px;padding:.8rem 1rem;margin-bottom:.75rem;cursor:pointer;backdrop-filter:blur(8px);"
      onclick="showPicksModal()">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="flex:1;padding-right:.5rem;">
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.52rem;font-weight:800;color:rgba(255,255,255,.5);margin-bottom:.5rem;">🎯 VOORTGANG NAAR <span style="color:#00BEC4;">100</span> PICKS</div>
          <div style="background:rgba(255,255,255,.08);border-radius:999px;height:7px;overflow:hidden;margin-bottom:.35rem;">
            <div style="height:100%;border-radius:999px;background:linear-gradient(90deg,#00BEC4,#00e5c8);width:${Math.min(100,kwaliPicks.length)}%;transition:width .4s;"></div>
          </div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:rgba(255,255,255,.5);display:flex;gap:.35rem;flex-wrap:wrap;">
            ${(() => {
              const openCount = kwaliPicks.filter(p => !p.status || p.status === 'pending').length;
              const parts = [];
              if (openCount > 0)           parts.push('<span>' + openCount + ' open</span>');
              if (settledPicks.length > 0) parts.push('<span>' + settledPicks.length + ' afgerond</span>');
              if (scanROI !== null)         parts.push('<span style="color:#00BEC4;font-weight:700;">ROI ' + (scanROI >= 0 ? '+' : '') + scanROI.toFixed(1) + '%</span>');
              return parts.length ? parts.join(' · ') : '<span>Scan wedstrijden →</span>';
            })()}
          </div>
        </div>
        <div style="position:relative;width:58px;height:58px;flex-shrink:0;">
          <svg width="58" height="58" viewBox="0 0 58 58" style="transform:rotate(-90deg);">
            <circle fill="none" stroke="rgba(255,255,255,.1)" stroke-width="5" cx="29" cy="29" r="23"/>
            <circle fill="none" stroke="#00BEC4" stroke-width="5" cx="29" cy="29" r="23" stroke-dasharray="145" stroke-dashoffset="${Math.round(145-(145*Math.min(100,kwaliPicks.length)/100)*0.55)}" stroke-linecap="round"/>
            <circle fill="none" stroke="#00e5c8" stroke-width="5" cx="29" cy="29" r="23" stroke-dasharray="145" stroke-dashoffset="${Math.round(145-(145*Math.min(100,settledPicks.length)/100)*0.3)}" stroke-linecap="round"/>
          </svg>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:\'Bebas Neue\',sans-serif;font-size:1.25rem;color:#00BEC4;">${kwaliPicks.length}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid rgba(255,255,255,0.09);margin-top:.55rem;padding-top:.5rem;">
        <div style="text-align:center;"><div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.3rem;color:#ffffff;line-height:1;">${kwaliPicks.filter(p=>!p.status||p.status==='pending').length}</div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:.38rem;color:var(--muted);margin-top:.15rem;">OPEN</div></div>
        <div style="text-align:center;"><div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.3rem;color:#ffffff;line-height:1;">${settledPicks.length}</div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:.38rem;color:var(--muted);margin-top:.15rem;">AFGEROND</div></div>
        <div style="text-align:center;"><div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.3rem;color:#ffffff;line-height:1;">${scanHitrate !== null ? scanHitrate+'%' : '—'}</div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:.38rem;color:var(--muted);margin-top:.15rem;">HITRATE</div></div>
        <div style="text-align:center;"><div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.3rem;color:${scanROI !== null && scanROI >= 0 ? '#00BEC4' : '#ef4444'};line-height:1;">${scanROI !== null ? (scanROI>=0?'+':'')+scanROI.toFixed(1)+'%' : '—'}</div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:.38rem;color:var(--muted);margin-top:.15rem;">ROI</div></div>
      </div>
    </div>

    <!-- Open bets -->
    ${openBets.length ? `
    <div style="background:rgba(0,190,196,.06);border:1px solid rgba(0,190,196,.2);border-radius:14px;
      padding:.7rem 1rem;margin-bottom:.75rem;cursor:pointer;" onclick="switchScreen('wallet')">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.58rem;font-weight:800;color:#00BEC4;">⏳ ${openBets.length} OPEN BET${openBets.length>1?'S':''}</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:rgba(255,255,255,.5);margin-top:.15rem;">${openBets.slice(0,2).map(b=>b.matchName||b.match||'?').join(' · ')}</div>
        </div>
        <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.1rem;color:#00BEC4;">€${openBets.reduce((s,b)=>s+b.amount,0).toFixed(0)}</div>
      </div>
    </div>` : ''}

    <!-- Top value pick als beschikbaar -->
    ${topValuePick ? `
    <div style="background:linear-gradient(135deg,rgba(22,163,74,.08),rgba(5,150,105,.04));
      border:1px solid rgba(22,163,74,.2);border-radius:14px;padding:.75rem 1rem;margin-bottom:.75rem;cursor:pointer;"
      onclick="(function(){var mid=(topValuePick&&(topValuePick.match?.id||topValuePick.matchId||''));switchScreen('analyse');setTimeout(()=>{showAnalyseSubTab('scan');if(mid&&typeof openValueAnalysis==='function')openValueAnalysis(mid);},150);})()">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="flex:1;">
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.48rem;font-weight:800;color:#00BEC4;margin-bottom:.2rem;">⚡ BESTE VALUE PICK</div>
          <div style="font-family:\'DM Sans\',sans-serif;font-size:.8rem;font-weight:700;color:#ffffff;">${topValuePick.match?.home||topValuePick.home||'?'} vs ${topValuePick.match?.away||topValuePick.away||'?'}</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:rgba(255,255,255,.5);margin-top:.15rem;">${topValuePick.pickLabel||topValuePick.pick} · conf ${topValuePick.confidence||'?'}/10</div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.4rem;color:#00BEC4;">+${Math.round(topValuePick.value||0)}%</div>
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:.9rem;color:#00BEC4;">${parseFloat(topValuePick.odds||0).toFixed(2)}</div>
        </div>
      </div>
    </div>` : ''}

    <!-- 4 Nav kaarten — gouden SVG iconen -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">

      <!-- WEDSTRIJDEN -->
      <div onclick="switchScreen('wedstrijden')"
        style="background:linear-gradient(135deg,rgba(0,60,70,.6),rgba(0,35,45,.5));border:1px solid rgba(0,190,196,.2);border-radius:16px;padding:16px;cursor:pointer;min-height:140px;display:flex;flex-direction:column;position:relative;overflow:hidden;"
        ontouchstart="this.style.transform=\'scale(.97)\'" ontouchend="this.style.transform=\'scale(1)\'">
        <div style="position:absolute;bottom:-8px;right:-8px;opacity:.07;pointer-events:none;">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>
        </div>
        <div style="margin-bottom:10px;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(201,168,76,.9)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>
          </svg>
        </div>
        <div style="font-family:\'Plus Jakarta Sans\',sans-serif;font-size:14px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:.3px;line-height:1.2;margin-bottom:6px;">WEDSTRIJDEN</div>
        <div style="font-family:\'Plus Jakarta Sans\',sans-serif;font-size:10.5px;color:rgba(255,255,255,.5);line-height:1.5;flex:1;">Laad matches, bekijk quotes en value indicators</div>
        <div style="margin-top:8px;"><span style="font-size:10px;font-weight:800;color:#00BEC4;border:1px solid rgba(0,190,196,.4);border-radius:4px;padding:2px 7px;letter-spacing:.4px;">LIVE API</span></div>
      </div>

      <!-- ANALYSE -->
      <div onclick="switchScreen('analyse')"
        style="background:linear-gradient(135deg,rgba(0,50,80,.6),rgba(0,30,60,.4));border:1px solid rgba(0,150,196,.2);border-radius:16px;padding:16px;cursor:pointer;min-height:140px;display:flex;flex-direction:column;position:relative;overflow:hidden;"
        ontouchstart="this.style.transform=\'scale(.97)\'" ontouchend="this.style.transform=\'scale(1)\'">
        <div style="position:absolute;bottom:-8px;right:-8px;opacity:.07;pointer-events:none;">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1"><circle cx="12" cy="12" r="8"/><path d="M12 4v4M12 16v4M4 12h4M16 12h4"/><circle cx="12" cy="12" r="3"/></svg>
        </div>
        <div style="margin-bottom:10px;">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="rgba(201,168,76,.9)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="16" cy="16" r="10"/><circle cx="16" cy="16" r="3"/>
            <line x1="16" y1="6" x2="16" y2="10"/><line x1="16" y1="22" x2="16" y2="26"/>
            <line x1="6" y1="16" x2="10" y2="16"/><line x1="22" y1="16" x2="26" y2="16"/>
          </svg>
        </div>
        <div style="font-family:\'Plus Jakarta Sans\',sans-serif;font-size:14px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:.3px;line-height:1.2;margin-bottom:6px;">ANALYSE</div>
        <div style="font-family:\'Plus Jakarta Sans\',sans-serif;font-size:10.5px;color:rgba(255,255,255,.5);line-height:1.5;flex:1;">AI analyse, value scan en combi tips</div>
        <div style="margin-top:8px;"><span style="font-size:10px;font-weight:800;color:#00BEC4;border:1px solid rgba(0,190,196,.4);border-radius:4px;padding:2px 7px;letter-spacing:.4px;">AI POWERED</span></div>
      </div>

      <!-- WALLET -->
      <div onclick="switchScreen('wallet');setTimeout(()=>setWalletSubTab('wallet'),100)"
        style="background:linear-gradient(135deg,rgba(0,60,50,.6),rgba(0,40,30,.4));border:1px solid rgba(201,168,76,.2);border-radius:16px;padding:16px;cursor:pointer;min-height:140px;display:flex;flex-direction:column;position:relative;overflow:hidden;"
        ontouchstart="this.style.transform=\'scale(.97)\'" ontouchend="this.style.transform=\'scale(1)\'">
        <div style="margin-bottom:10px;display:flex;gap:8px;align-items:center;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(201,168,76,.9)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 12V8H6a2 2 0 0 1 0-4h14v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
          </svg>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(201,168,76,.55)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="8" stroke-dasharray="3 2"/><path d="M12 8v4l3 3"/>
          </svg>
        </div>
        <div style="font-family:\'Plus Jakarta Sans\',sans-serif;font-size:14px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:.3px;line-height:1.2;margin-bottom:6px;">WALLET</div>
        <div style="font-family:\'Plus Jakarta Sans\',sans-serif;font-size:10.5px;color:rgba(255,255,255,.5);line-height:1.5;flex:1;">Bets, tracker, backtest en pick analyse</div>
        <div style="margin-top:8px;"><span style="font-size:12px;font-weight:800;color:#C9A84C;">€${wallet.balance.toFixed(0)}</span></div>
      </div>

      <!-- COMPETITIES -->
      <div onclick="typeof openCompKeuze==='function'?openCompKeuze():switchScreen('wedstrijden')"
        style="background:linear-gradient(135deg,rgba(40,30,0,.6),rgba(30,20,0,.4));border:1px solid rgba(201,168,76,.2);border-radius:16px;padding:16px;cursor:pointer;min-height:140px;display:flex;flex-direction:column;position:relative;overflow:hidden;"
        ontouchstart="this.style.transform=\'scale(.97)\'" ontouchend="this.style.transform=\'scale(1)\'">
        <div style="margin-bottom:10px;display:flex;gap:6px;align-items:center;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(201,168,76,.9)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 21h8M12 17v4M7 4H4a1 1 0 0 0-1 1v3c0 3.3 2.7 6 6 6h6c3.3 0 6-2.7 6-6V5a1 1 0 0 0-1-1h-3"/><path d="M7 4h10v8a5 5 0 0 1-10 0V4z"/>
          </svg>
          <div style="font-size:11px;line-height:1.3;">🇳🇱🏴󠁧󠁢󠁥󠁮󠁧󠁿<br>🇩🇪🇪🇸🇮🇹🇧🇪</div>
        </div>
        <div style="font-family:\'Plus Jakarta Sans\',sans-serif;font-size:14px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:.3px;line-height:1.2;margin-bottom:6px;">COMPETITIES</div>
        <div style="font-family:\'Plus Jakarta Sans\',sans-serif;font-size:10.5px;color:rgba(255,255,255,.5);line-height:1.5;flex:1;">Stand, topscorers en wedstrijden per competitie</div>
        <div style="margin-top:8px;"><span style="font-size:10px;font-weight:800;color:#C9A84C;border:1px solid rgba(201,168,76,.4);border-radius:4px;padding:2px 7px;letter-spacing:.4px;">INFO</span></div>
      </div>

    </div>


    <!-- Tip van de dag -->
    <div id="daily-tip-card" style="margin-bottom:.75rem;"></div>

    <!-- Weekoverzicht -->
    ${weekScans.length ? `
    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);border-radius:14px;padding:.75rem 1rem;margin-bottom:.75rem;">
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:800;color:rgba(255,255,255,.5);margin-bottom:.5rem;">📅 DEZE WEEK</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:.4rem;">
        <div style="text-align:center;background:rgba(15,23,42,.04);border-radius:10px;padding:.4rem;">
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1rem;color:#00BEC4;">${weekScans.length}</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.38rem;color:rgba(255,255,255,.5);">SCANS</div>
        </div>
        <div style="text-align:center;background:rgba(15,23,42,.04);border-radius:10px;padding:.4rem;">
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1rem;color:#00a8ad;">${weekPicksArr.length}</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.38rem;color:rgba(255,255,255,.5);">PICKS</div>
        </div>
        <div style="text-align:center;background:rgba(15,23,42,.04);border-radius:10px;padding:.4rem;">
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1rem;color:${weekHR!==null&&weekHR>=50?'#00BEC4':'#dc2626'};">${weekHR !== null ? weekHR+'%' : '—'}</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.38rem;color:rgba(255,255,255,.5);">HITRATE</div>
        </div>
        <div style="text-align:center;background:rgba(15,23,42,.04);border-radius:10px;padding:.4rem;">
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1rem;color:#00BEC4;">${weekOpen}</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.38rem;color:rgba(255,255,255,.5);">OPEN</div>
        </div>
      </div>
    </div>` : ''}

    <!-- Confidence engine status -->
    ${scanROI !== null ? `
    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);border-radius:14px;padding:.75rem 1rem;margin-bottom:.75rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;">
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:800;color:rgba(255,255,255,.5);">📊 TRACKRECORD</div>
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:rgba(255,255,255,.5);">${settledPicks.length}/100 picks</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;">
        <div style="text-align:center;background:rgba(15,23,42,.04);border-radius:10px;padding:.4rem;">
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1rem;color:${scanHitrate>=50?'#00BEC4':'#dc2626'};">${scanHitrate}%</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.4rem;color:rgba(255,255,255,.5);">HITRATE</div>
        </div>
        <div style="text-align:center;background:rgba(15,23,42,.04);border-radius:10px;padding:.4rem;">
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1rem;color:${scanROI>=0?'#00BEC4':'#dc2626'};">${scanROI>=0?'+':''}${scanROI.toFixed(1)}%</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.4rem;color:rgba(255,255,255,.5);">ROI</div>
        </div>
        <div style="text-align:center;background:rgba(15,23,42,.04);border-radius:10px;padding:.4rem;">
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1rem;color:${isCalibrated?'#00BEC4':'#d97706'};">${isCalibrated?'✓':`${settledPicks.length}/10`}</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.4rem;color:rgba(255,255,255,.5);">${isCalibrated?'AI GECALIB.':'AI LEERT'}</div>
        </div>
      </div>
      <div style="background:rgba(15,23,42,.06);border-radius:999px;height:5px;overflow:hidden;margin-top:.5rem;">
        <div style="background:linear-gradient(90deg,#00BEC4,#00a8ad);height:100%;border-radius:999px;width:${Math.min(100,settledPicks.length)}%;transition:width .4s;"></div>
      </div>
    </div>` : ''}

    <!-- WK 2026 AI Voorspelling widget -->
    <div id="wk-dashboard-widget" style="background:linear-gradient(135deg,rgba(220,38,38,.06),rgba(190,24,93,.04));
      border:1px solid rgba(220,38,38,.15);border-radius:14px;padding:.7rem .85rem;margin-bottom:.75rem;">
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:rgba(255,255,255,.5);">⟳ Laden...</div>
    </div>

    <!-- Admin: Worker scan & settle knoppen -->
    ${window._isAdmin ? `
    <div style="display:flex;gap:.5rem;margin-bottom:.75rem;">
      <button onclick="(async()=>{
        this.disabled=true;this.textContent='⟳ Scannen...';
        const r=await triggerWorkerScan();
        this.disabled=false;this.textContent='🔍 Worker Scan';
        alert(r.status||r.error||JSON.stringify(r));
      })()" style="flex:1;background:rgba(0,168,173,.1);border:1px solid rgba(0,168,173,.3);
        border-radius:10px;padding:.5rem;font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;
        font-weight:700;color:#00a8ad;cursor:pointer;">🔍 Worker Scan</button>
      <button onclick="(async()=>{
        this.disabled=true;this.textContent='⟳ Testen...';
        const token=await generateScanToken();
        const res=await fetch(WORKER_URL+'/scan-test?token='+token+'&league=88');
        const d=await res.json();
        const picks=(d.picks||[]).map(p=>p.matchName+' → '+p.pickLabel+' @'+p.odds+' (conf:'+p.confidence+')').join('\n');
        this.disabled=false;this.textContent='🧪 Scan Test';
        alert('v'+d.version+' | '+d.matchesFound+' wedstrijden | '+(d.picks||[]).length+' picks\n\n'+(picks||'Geen picks'));
      })()" style="flex:1;background:rgba(139,92,246,.1);border:1px solid rgba(139,92,246,.3);
        border-radius:10px;padding:.5rem;font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;
        font-weight:700;color:#a78bfa;cursor:pointer;">🧪 Scan Test</button>
      <button onclick="(async()=>{
        this.disabled=true;this.textContent='⟳ Settlen...';
        const r=await triggerWorkerSettle();
        this.disabled=false;this.textContent='✅ Settle';
        alert(r.status||r.error||JSON.stringify(r));
      })()" style="flex:1;background:rgba(21,128,61,.1);border:1px solid rgba(21,128,61,.3);
        border-radius:10px;padding:.5rem;font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;
        font-weight:700;color:#00BEC4;cursor:pointer;">✅ Settle</button>
    </div>` : ''}

    <!-- WK 2026 countdown / live banner -->
    ${wkDiff > 0 ? `
    <div style="background:linear-gradient(135deg,rgba(0,190,196,.08),rgba(0,168,173,.06));
      border:1px solid rgba(0,190,196,.2);border-radius:14px;padding:.75rem 1rem;margin-bottom:.75rem;cursor:pointer;"
      onclick="switchScreen('wedstrijden');setTimeout(()=>selectComp('wk2026'),300)">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1rem;color:#00BEC4;">🏆 WK 2026</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:rgba(255,255,255,.5);margin-top:.15rem;">United States · Mexico · Canada</div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.1rem;color:#00BEC4;">${wkDays}d ${wkHours}u ${wkMins}m</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:rgba(255,255,255,.5);">Start 11 juni</div>
        </div>
      </div>
    </div>` : wkEndDiff > 0 ? `
    <div style="background:linear-gradient(135deg,rgba(220,38,38,.12),rgba(234,179,8,.08));
      border:1px solid rgba(220,38,38,.3);border-radius:14px;padding:.75rem 1rem;margin-bottom:.75rem;cursor:pointer;animation:pulse-red 2s infinite;"
      onclick="switchScreen('wedstrijden');setTimeout(()=>selectComp('wk2026'),300)">
      <style>@keyframes pulse-red{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.3)}50%{box-shadow:0 0 0 6px rgba(220,38,38,0)}}</style>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1rem;color:#dc2626;">🔴 WK 2026 LIVE</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:rgba(255,255,255,.5);margin-top:.15rem;">United States · Mexico · Canada</div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.52rem;font-weight:800;color:#dc2626;">BEZIG</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:rgba(255,255,255,.5);">Finale: 19 juli</div>
        </div>
      </div>
    </div>` : ''}

    <!-- Disclaimer -->
    <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:rgba(255,255,255,.5);text-align:center;padding:.75rem;line-height:1.6;border-top:1px solid rgba(255,255,255,0.09);margin-top:.5rem;">
      ⚠️ Uitsluitend voor <b>entertainment & educatie</b> · Geen echt gokadvies<br>
      Speel verantwoord · 18+ · Verslavingslijn: 0900-1090
    </div>

    <div style="font-family:'Dancing Script',cursive;font-size:.75rem;color:rgba(255,255,255,.5);text-align:center;padding:.5rem 0 1rem;">
      Made by Rob Borghouts
    </div>
    </div><!-- /dashOverviewContent -->

    <!-- Live scores content -->
    <div id="dashLiveContent" style="display:none;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.6rem;">
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.52rem;font-weight:800;color:rgba(255,255,255,.5);">🔴 LIVE STANDEN VAN JE PICKS</div>
        <button onclick="loadLiveScores()" style="background:none;border:1px solid rgba(255,255,255,0.09);border-radius:8px;padding:.25rem .5rem;font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:rgba(255,255,255,.5);cursor:pointer;">⟳ Ververs</button>
      </div>
      <div id="liveScoresList"><div style="text-align:center;padding:2rem;color:rgba(255,255,255,.5);font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;">Tik op LIVE om standen te laden...</div></div>
    </div>
  `;

  // Laad WK widget na render
  if (typeof renderWKDashboardWidget === 'function') setTimeout(renderWKDashboardWidget, 50);

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
      tipCard.innerHTML = `<div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);border-radius:16px;padding:.75rem 1rem;opacity:.6;">
        <div style="display:flex;align-items:center;gap:.5rem;">
          <div style="font-size:1.1rem;">🎯</div>
          <div>
            <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.56rem;font-weight:800;color:rgba(255,255,255,.5);">TIP VAN DE DAG</div>
            <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:rgba(255,255,255,.5);">Vandaag geen gekwalificeerde pick — scan meer wedstrijden.</div>
          </div>
        </div>
      </div>`;
      return;
    }

    // Sterren op basis van confidence
    var stars = '';
    var conf = tip.confidence || 0;
    for (var i = 0; i < 5; i++) stars += i < Math.round(conf/2) ? '★' : '☆';
    var valColor = (tip.value||0) >= 15 ? '#00BEC4' : '#b45309';

    tipCard.innerHTML = `<div style="background:linear-gradient(135deg,rgba(0,190,196,.08),rgba(0,168,173,.06));
      border:1px solid rgba(0,190,196,.2);border-radius:16px;padding:.85rem 1rem;cursor:pointer;"
      onclick="switchScreen('analyse');setTimeout(()=>{showAnalyseSubTab('scan');if(tip&&tip.fixtureId&&typeof openValueAnalysis==='function')openValueAnalysis(tip.fixtureId);},150)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;">
        <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1rem;color:#00BEC4;letter-spacing:.04em;">🎯 TIP VAN DE DAG</div>
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:rgba(255,255,255,.5);">${isToday ? 'Vandaag' : (tip.date||'')}</div>
      </div>
      <div style="font-family:\'DM Sans\',sans-serif;font-size:.85rem;font-weight:800;color:#ffffff;margin-bottom:.3rem;">${tip.match||'?'}</div>
      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.45rem;">
        <span style="background:rgba(0,190,196,.12);border:1px solid rgba(0,190,196,.25);
          color:#00BEC4;font-family:\'IBM Plex Mono\',monospace;font-size:.54rem;font-weight:800;
          border-radius:8px;padding:.2rem .5rem;">${tip.pickLabel||'?'}</span>
        <span style="font-family:\'Bebas Neue\',sans-serif;font-size:1.1rem;color:#00BEC4;">${tip.odds||'?'}</span>
        <span style="font-family:\'IBM Plex Mono\',monospace;font-size:.54rem;font-weight:800;color:${valColor};">+${Math.round(tip.value||0)}%</span>
        <span style="font-family:\'IBM Plex Mono\',monospace;font-size:.6rem;color:#f59e0b;margin-left:auto;">${stars}</span>
      </div>
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:rgba(255,255,255,.5);line-height:1.65;">${tip.analyse||tip.tip||''}</div>
      <div style="margin-top:.45rem;font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:rgba(255,255,255,.5);opacity:.7;">
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
  hdr.innerHTML = '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.2rem;background:linear-gradient(135deg,#00BEC4,#00a8ad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">KIES COMPETITIE</div>';
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
    tile.innerHTML = `<div style="font-size:1.4rem;">${c.flag}</div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;font-weight:700;color:rgba(255,255,255,.5);margin-top:.2rem;">${c.name}</div>`;
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
  const statusColor = s => s === 'win' ? '#00BEC4' : s === 'lose' ? '#dc2626' : 'var(--sub)';

  // Sorteer: afgerond bovenaan, dan open
  const sorted = [...settled.reverse(), ...open];

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:flex-end;';

  const sheet = document.createElement('div');
  sheet.style.cssText = 'background:#0B1519;border-radius:20px 20px 0 0;width:100%;max-height:85vh;overflow-y:auto;padding:1rem;';

  sheet.innerHTML = `
    <div style="width:40px;height:4px;background:rgba(0,0,0,.15);border-radius:2px;margin:0 auto .75rem;"></div>
    <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.2rem;margin-bottom:.5rem;">🎯 Picks Overzicht</div>

    <!-- Samenvatting stats -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.4rem;margin-bottom:.75rem;">
      ${[
        ['PICKS', kwaliPicks.length],
        ['OPEN', open.length],
        ['HITRATE', hitrate !== null ? hitrate + '%' : '—'],
        ['ROI', roi !== null ? (roi >= 0 ? '+' : '') + roi.toFixed(1) + '%' : '—'],
      ].map(([label, val]) => `
        <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);border-radius:10px;padding:.4rem;text-align:center;">
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.38rem;color:rgba(255,255,255,.5);">${label}</div>
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:.9rem;color:#00BEC4;">${val}</div>
        </div>`).join('')}
    </div>

    <!-- Picks lijst -->
    ${sorted.length === 0 ? '<div style="text-align:center;color:rgba(255,255,255,.5);font-size:.8rem;padding:1rem;">Nog geen picks — scan wedstrijden!</div>' :
      sorted.map(p => `
        <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);border-radius:10px;padding:.5rem .7rem;margin-bottom:.4rem;display:flex;flex-direction:column;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="flex:1;min-width:0;">
              <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.48rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.match||p.matchName||'?'}</div>
              <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:rgba(255,255,255,.5);">${p.pickLabel||p.pick||'?'} · @${p.odds||'?'} · +${p.value||0}% value</div>
            </div>
            <div style="text-align:right;margin-left:.5rem;">
              <div style="font-size:1rem;">${statusIcon(p.status)}</div>
              <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.38rem;color:${statusColor(p.status)};">${p.status==='win'?'GEWONNEN':p.status==='lose'?'VERLOREN':'OPEN'}</div>
            </div>
          </div>
          ${renderPickReasons(p)}
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

// ═══════════════════════════════════════════════════════
// LIVE SCORES TAB — dashboard v15
// Toont pending picks met live stand + win/verlies indicatie, ververst elke 60s
// ═══════════════════════════════════════════════════════

let _liveScoresInterval = null;

function switchDashTab(tab) {
  const overviewBtn = document.getElementById('dashTabOverview');
  const liveBtn     = document.getElementById('dashTabLive');
  const overviewContent = document.getElementById('dashOverviewContent');
  const liveContent     = document.getElementById('dashLiveContent');
  if (!overviewContent || !liveContent) return;

  if (tab === 'live') {
    overviewContent.style.display = 'none';
    liveContent.style.display = 'block';
    overviewBtn.style.background = 'transparent';
    overviewBtn.style.color = 'var(--sub)';
    overviewBtn.style.boxShadow = 'none';
    liveBtn.style.background = 'rgba(255,255,255,0.05)';
    liveBtn.style.color = 'var(--text)';
    liveBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,.1)';
    loadLiveScores();
    // Auto-refresh elke 60s zolang tab open is
    if (_liveScoresInterval) clearInterval(_liveScoresInterval);
    _liveScoresInterval = setInterval(loadLiveScores, 60000);
  } else {
    overviewContent.style.display = 'block';
    liveContent.style.display = 'none';
    liveBtn.style.background = 'transparent';
    liveBtn.style.color = 'var(--sub)';
    liveBtn.style.boxShadow = 'none';
    overviewBtn.style.background = 'rgba(255,255,255,0.05)';
    overviewBtn.style.color = 'var(--text)';
    overviewBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,.1)';
    // Stop auto-refresh
    if (_liveScoresInterval) { clearInterval(_liveScoresInterval); _liveScoresInterval = null; }
  }
}

async function loadLiveScores() {
  const list = document.getElementById('liveScoresList');
  if (!list) return;

  // Verzamel pending picks uit scanLog
  const scanLog = state.scanLog || [];
  const allPicks = scanLog.flatMap(s => s.picks || []);
  const pendingPicks = allPicks.filter(p => p.status === 'pending' && p.fixtureId);

  // Dedup op fixtureId + pick
  const seen = new Set();
  const uniquePicks = [];
  pendingPicks.forEach(p => {
    const key = p.fixtureId + '_' + p.pick;
    if (!seen.has(key)) { seen.add(key); uniquePicks.push(p); }
  });

  if (!uniquePicks.length) {
    list.innerHTML = '<div style="text-align:center;padding:2rem;color:rgba(255,255,255,.5);font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;line-height:1.6;">Geen openstaande picks om live te volgen.<br>Doe eerst een scan!</div>';
    return;
  }

  // Haal live data op voor de fixture IDs
  const fixtureIds = [...new Set(uniquePicks.map(p => p.fixtureId))];
  try {
    const idsParam = fixtureIds.join('-');
    const r = await fetch(`${WORKER_URL}/apif/fixtures?ids=${idsParam}`);
    const d = await r.json();
    const fixtures = {};
    (d.response || []).forEach(f => { fixtures[f.fixture.id] = f; });

    list.innerHTML = uniquePicks.map(p => {
      const fx = fixtures[p.fixtureId];
      if (!fx) {
        return liveCardHtml(p, null);
      }
      return liveCardHtml(p, fx);
    }).join('');

    // Update tijd
    const now = new Date();
    list.innerHTML += `<div style="text-align:center;padding:.5rem;color:rgba(255,255,255,.5);font-family:\'IBM Plex Mono\',monospace;font-size:.4rem;">Laatst bijgewerkt: ${now.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit',second:'2-digit'})} · ververst elke 60s</div>`;
  } catch(e) {
    list.innerHTML = '<div style="text-align:center;padding:2rem;color:#dc2626;font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;">Fout bij laden live data. Probeer opnieuw.</div>';
  }
}

function liveCardHtml(pick, fx) {
  const matchName = pick.match || pick.matchName || '?';

  // Geen live data — wedstrijd nog niet begonnen of al klaar
  if (!fx) {
    const dt = [pick.matchDate||pick.date, pick.matchTime||pick.time].filter(Boolean).join(' ');
    return `<div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);border-radius:12px;padding:.6rem .8rem;margin-bottom:.5rem;">
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:700;">${matchName}</div>
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:rgba(255,255,255,.5);margin-top:.2rem;">${pick.pickLabel||pick.pick} @ ${pick.odds}${dt ? ' · 📅 ' + dt : ''} · ⏳ Nog niet begonnen</div>
    </div>`;
  }

  const status = fx.fixture.status.short; // NS, 1H, HT, 2H, FT etc.
  const elapsed = fx.fixture.status.elapsed;
  const homeGoals = fx.goals.home ?? 0;
  const awayGoals = fx.goals.away ?? 0;
  const homeTeam = fx.teams.home.name;
  const awayTeam = fx.teams.away.name;
  // Kickoff datum/tijd uit fixture
  let kickoffStr = '';
  if (fx.fixture.date) {
    const ko = new Date(fx.fixture.date);
    kickoffStr = ko.toLocaleDateString('nl-NL',{day:'2-digit',month:'2-digit'}) + ' ' + ko.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});
  }

  const isLive = ['1H','2H','HT','ET','BT','P','LIVE'].includes(status);
  const isDone = ['FT','AET','PEN'].includes(status);
  const notStarted = status === 'NS';

  // Bepaal of pick momenteel wint
  let pickWinning = false;
  if (pick.pick === '1') pickWinning = homeGoals > awayGoals;
  else if (pick.pick === '2') pickWinning = awayGoals > homeGoals;
  else if (pick.pick === 'X') pickWinning = homeGoals === awayGoals;

  // Status indicator
  let statusBadge, statusColor, borderColor;
  if (notStarted) {
    statusBadge = '⏳ Nog niet begonnen';
    statusColor = '#64748b';
    borderColor = 'rgba(255,255,255,0.09)';
  } else if (isLive) {
    statusBadge = status === 'HT' ? '⏸ RUST' : `🔴 LIVE ${elapsed}'`;
    statusColor = pickWinning ? '#00BEC4' : '#dc2626';
    borderColor = pickWinning ? 'rgba(22,163,74,.4)' : 'rgba(220,38,38,.4)';
  } else if (isDone) {
    statusBadge = pickWinning ? '✅ GEWONNEN' : '❌ VERLOREN';
    statusColor = pickWinning ? '#00BEC4' : '#dc2626';
    borderColor = pickWinning ? 'rgba(22,163,74,.4)' : 'rgba(220,38,38,.4)';
  } else {
    statusBadge = status;
    statusColor = '#64748b';
    borderColor = 'rgba(255,255,255,0.09)';
  }

  const winIndicator = (isLive || isDone)
    ? (pickWinning
        ? '<span style="color:#00BEC4;font-weight:700;">✓ Pick wint</span>'
        : '<span style="color:#dc2626;font-weight:700;">✗ Pick verliest</span>')
    : '';

  return `<div style="background:rgba(255,255,255,0.05);border:1.5px solid ${borderColor};border-radius:12px;padding:.6rem .8rem;margin-bottom:.5rem;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.35rem;">
      <span style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;font-weight:700;color:${statusColor};">${statusBadge}</span>
      ${winIndicator ? `<span style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;">${winIndicator}</span>` : ''}
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;">
      <div style="flex:1;text-align:right;font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:${pick.pick==='1'?'700':'400'};">${homeTeam}</div>
      <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.3rem;color:var(--text);min-width:50px;text-align:center;">${homeGoals} - ${awayGoals}</div>
      <div style="flex:1;text-align:left;font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:${pick.pick==='2'?'700':'400'};">${awayTeam}</div>
    </div>
    <div style="text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:rgba(255,255,255,.5);margin-top:.35rem;padding-top:.35rem;border-top:1px solid rgba(255,255,255,0.09);">
      🎯 ${pick.pickLabel||pick.pick} @ ${pick.odds} · +${pick.value||0}% value
      ${kickoffStr ? `<br>📅 ${kickoffStr}` : ''}
    </div>
  </div>`;
}
