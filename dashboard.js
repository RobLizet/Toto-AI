// ═══════════════════════════════════════════════════════
// dashboard.js v31
// v31: Reliability Score, CLV display, League stats kaart, Pick categorie,
//      Verbeterde voortgangskaart met win streak, zwakPunt in daily tip
// v16: Speeldatum + tijd in live kaarten + dedup 100-picks teller
// v15: Live scores tab — pending picks met live stand + win/verlies, ververst 60s
// v14: Killer stats resultatenpagina (wallet)
// v13: "Waarom deze pick?" signalen, bullshitfilter waarschuwing

// ── RELIABILITY SCORE ENGINE ──────────────────────────────
// Combineert model confidence, league kwaliteit en value tot één score 0-100
const LEAGUE_QUALITY_SCORES = {
  2: 95, 3: 92, 848: 88,
  39: 90, 140: 88, 78: 88, 135: 87, 61: 85,
  88: 82, 94: 80, 40: 79, 113: 70, 103: 70,
};

function calcReliabilityScore(p) {
  const modelScore = p.confidenceFinal
    ? Math.min(100, p.confidenceFinal)
    : Math.min(100, (p.confidence || 5) * 10);
  const leagueScore = p.leagueId ? (LEAGUE_QUALITY_SCORES[p.leagueId] || 65) : 65;
  const value = p.value || 0;
  const odds = p.odds || 2.0;
  let marktScore = value >= 20 ? 95 : value >= 15 ? 85 : value >= 10 ? 75 : value >= 8 ? 68 : 60;
  if (odds >= 1.60 && odds <= 3.50) marktScore = Math.min(100, marktScore + 8);
  if (odds < 1.40 || odds > 5.50)   marktScore = Math.max(0, marktScore - 15);
  const score = Math.round(modelScore * 0.50 + leagueScore * 0.25 + marktScore * 0.25);
  let label, color, barColor;
  if      (score >= 80) { label = 'UITSTEKEND'; color = '#00BEC4';  barColor = 'linear-gradient(90deg,#00BEC4,#00e5c8)'; }
  else if (score >= 70) { label = 'STERK';      color = '#16a34a';  barColor = 'linear-gradient(90deg,#16a34a,#22c55e)'; }
  else if (score >= 60) { label = 'GOED';       color = '#b45309';  barColor = 'linear-gradient(90deg,#d97706,#fbbf24)'; }
  else if (score >= 50) { label = 'MATIG';      color = '#d97706';  barColor = 'linear-gradient(90deg,#d97706,#fb923c)'; }
  else                   { label = 'ZWAK';       color = '#dc2626';  barColor = 'linear-gradient(90deg,#dc2626,#f87171)'; }
  return { score, label, color, barColor };
}

function getPickCategory(p) {
  if (p.elite) return { label: '⭐ ELITE', color: '#00BEC4', bg: 'rgba(0,190,196,.15)' };
  const r = calcReliabilityScore(p);
  if (r.score >= 80) return { label: 'A+', color: '#00BEC4',  bg: 'rgba(0,190,196,.12)' };
  if (r.score >= 70) return { label: 'A',  color: '#16a34a',  bg: 'rgba(22,163,74,.12)' };
  if (r.score >= 55) return { label: 'B',  color: '#b45309',  bg: 'rgba(217,119,6,.12)' };
  return                      { label: 'C',  color: '#94a3b8', bg: 'rgba(148,163,184,.1)' };
}

function eliteOnlyActive(){ return localStorage.getItem('totoai_eliteOnly') !== '0'; } // default AAN
function passesEliteFilter(p){
  if (!eliteOnlyActive()) return true;
  if (p && p.elite) return true;
  try { if (typeof calcReliabilityScore === 'function' && calcReliabilityScore(p).score >= 80) return true; } catch(e){}
  return (((p&&p.confidence)||0) >= 8) && (((p&&p.value)||0) >= 15);
}

function togglePicksFilter() {
  const next = (localStorage.getItem('totoai_eliteOnly') !== '0') ? '0' : '1';
  localStorage.setItem('totoai_eliteOnly', next);
  const o = document.getElementById('picksOverlay'); if (o) o.remove();
  const b = document.getElementById('eliteOnlyBtn'); if (b) { b.textContent = next === '1' ? 'Aan ✓' : 'Uit'; b.classList.toggle('active', next === '1'); }
  if (typeof showPicksModal === 'function') showPicksModal();
}

function renderCLVBadge(p) {
  if (p.clv === undefined || p.clv === null) return '';
  const clv = parseFloat(p.clv);
  const pos = clv > 0;
  const color = pos ? '#00BEC4' : '#dc2626';
  const slotOdds = p.odds ? (parseFloat(p.odds) / (1 + clv / 100)).toFixed(2) : null;
  return `<span style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;
    color:${color};background:${color}18;border:1px solid ${color}33;
    border-radius:6px;padding:.1rem .35rem;white-space:nowrap;">
    ${pos ? '✓' : '✗'} CLV ${pos ? '+' : ''}${clv.toFixed(1)}%${slotOdds ? ` → sloot ${slotOdds}` : ''}
  </span>`;
}

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
    ${signals.map(s => `<span style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;background:${s.color}18;color:${s.color};border:1px solid ${s.color}33;border-radius:6px;padding:.1rem .35rem;white-space:nowrap;">${s.icon} ${s.text}</span>`).join('')}
  </div>`;
}


// Token = HMAC-SHA256(SCAN_SECRET + timestamp_minute)
const SCAN_SECRET = 'totoai2026'; // Zelfde als SCAN_SECRET in Cloudflare env
// Admin UIDs — voeg jouw Firebase UID toe
const ADMIN_UIDS = ['NpbaXO16xwha4Dm4Jgn9RqTM9Fq1'];

function checkAdminStatus() {
  // v32.3: gebruik _currentUser uit auth.js (Firebase v8 compat)
  const uid = (typeof _currentUser !== 'undefined' && _currentUser?.uid)
    || (typeof _firebaseAuth !== 'undefined' && _firebaseAuth?.currentUser?.uid)
    || window.firebase?.auth?.()?.currentUser?.uid
    || null;
  window._isAdmin = uid ? ADMIN_UIDS.includes(uid) : false;
  console.log('[Admin] UID:', uid, '| isAdmin:', window._isAdmin);
}
const WORKER_URL  = 'https://api.promatchxi.app';

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

async function triggerScanTest() {
  const btn = document.getElementById('adminScanTestBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⟳ Testen...'; }
  try {
    const token = await generateScanToken();
    const res = await fetch(WORKER_URL + '/scan-test?token=' + token + '&league=253,103,71');
    const txt = await res.text();
    let d;
    try { d = JSON.parse(txt); } catch(e) { alert('Parse fout: ' + txt.slice(0, 300)); return; }
    if (d.error) { alert('Worker fout: ' + d.error); return; }
    const picks = (d.picks || []).slice(0, 5)
      .map(p => (p.matchName || p.match || '?') + ' → ' + (p.pickLabel || p.pick) + ' @' + (p.odds || '?') + ' conf:' + (p.confidence || '?'))
      .join('\n');
    const logTail = (d.log||[]).slice(-3).join('\n');
    const msg = '✅ Haiku scan OK\nv' + (d.version||'?') + ' | ' + (d.matchesFound||0) + ' wedstrijden | ' + (d.picks||[]).length + ' picks';
    alert(msg + (picks ? '\n\n' + picks : '') + (logTail ? '\n\nLog:\n' + logTail : ''));
  } catch(e) {
    alert('Fetch fout: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🧪 Scan Test'; }
  }
}


// DASHBOARD.JS — v30.3 HMAC scan tokens, admin scan knop
// ═══════════════════════════════════════════════════════

async function fetchDailyTip() {
  try {
    const r = await fetch('https://api.promatchxi.app/daily-tip');
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
  const _staleMs = Date.now() - 2*24*60*60*1000; // open picks van 2+ dagen geleden settelen nooit meer
  const allPicks = allPicksRaw.filter(p => {
    if (p.status === 'win' || p.status === 'lose') return true;
    const _d = p.date ? new Date(p.date).getTime() : NaN;
    if (!isNaN(_d) && _d < _staleMs) return false; // stale open pick verbergen
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

  // Win streak berekenen (meest recente picks eerst)
  let winStreak = 0;
  const sortedSettled = [...settledPicks].reverse();
  for (const sp of sortedSettled) { if (sp.status === 'win') winStreak++; else break; }

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
      <button id="dashTabLive" onclick="switchDashTab('live')" style="flex:1;border:none;border-radius:9px;padding:.5rem;font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:700;cursor:pointer;background:transparent;color:rgba(255,255,255,.5);"><span id="liveDot" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#dc2626;margin-right:.3rem;vertical-align:middle;"></span>LIVE</button>
    </div>

    <div id="dashOverviewContent">

    <!-- Voortgang kaart — ring + stats rij -->
    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);border-radius:16px;padding:.8rem 1rem;margin-bottom:.75rem;cursor:pointer;backdrop-filter:blur(8px);"
      onclick="showPicksModal()">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="flex:1;padding-right:.5rem;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem;">
            <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.52rem;font-weight:800;color:rgba(255,255,255,.5);">🎯 VOORTGANG NAAR <span style="color:#00BEC4;">100</span> PICKS</div>
            <button onclick="event.stopPropagation();openPicksInsight()" style="width:22px;height:22px;border-radius:50%;background:rgba(220,38,38,.15);border:1.5px solid rgba(220,38,38,.5);color:#ef4444;font-family:\'IBM Plex Mono\',monospace;font-size:.6rem;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">?</button>
          </div>
          <div style="background:rgba(255,255,255,.08);border-radius:999px;height:7px;overflow:hidden;margin-bottom:.35rem;">
            <div style="height:100%;border-radius:999px;background:linear-gradient(90deg,#00BEC4,#00e5c8);width:${Math.min(100,kwaliPicks.length)}%;transition:width .4s;"></div>
          </div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:rgba(255,255,255,.5);display:flex;gap:.35rem;flex-wrap:wrap;">
            ${(() => {
              // U2: geen dubbele cijfers — inline = voortgang, statrij hieronder = prestatie
              const parts = [];
              if (kwaliPicks.length > 0) {
                parts.push('<span>' + kwaliPicks.length + '/100 picks</span>');
                if (settledPicks.length > 0) parts.push('<span>' + settledPicks.length + ' afgerond</span>');
              }
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
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1;"><div style=\'font-family:Bebas Neue,sans-serif;font-size:1.25rem;color:#00BEC4;\'>${kwaliPicks.length}</div><div style=\'font-family:IBM Plex Mono,monospace;font-size:.4rem;color:rgba(255,255,255,.45);margin-top:1px;\'>/100</div></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid rgba(255,255,255,0.09);margin-top:.55rem;padding-top:.5rem;">
        <div style="text-align:center;"><div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.3rem;color:#ffffff;line-height:1;">${kwaliPicks.filter(p=>!p.status||p.status==='pending').length}</div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:.38rem;color:var(--muted);margin-top:.15rem;">OPEN</div></div>
        <div style="text-align:center;"><div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.3rem;color:${scanHitrate !== null && scanHitrate >= 50 ? '#00BEC4' : scanHitrate !== null ? '#ef4444' : '#ffffff'};line-height:1;">${scanHitrate !== null ? scanHitrate+'%' : '—'}</div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:.38rem;color:var(--muted);margin-top:.15rem;">HITRATE</div></div>
        <div style="text-align:center;"><div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.3rem;color:${scanROI !== null && scanROI >= 0 ? '#00BEC4' : '#ef4444'};line-height:1;">${scanROI !== null ? (scanROI>=0?'+':'')+scanROI.toFixed(1)+'%' : '—'}</div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:.38rem;color:var(--muted);margin-top:.15rem;">ROI</div></div>
        <div style="text-align:center;"><div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.3rem;color:${winStreak >= 3 ? '#00BEC4' : winStreak >= 1 ? '#d97706' : '#ffffff'};line-height:1;">${winStreak > 0 ? '🔥'+winStreak : winPicks.length+'/'+settledPicks.length}</div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:.38rem;color:var(--muted);margin-top:.15rem;">${winStreak > 0 ? 'STREAK' : 'W/L'}</div></div>
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
      ${tip.zwakPunt ? `<div style="margin-top:.35rem;font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;padding:.25rem .5rem;border-radius:6px;background:rgba(255,165,0,.07);border:1px solid rgba(255,165,0,.2);color:#d97706;">⚡ Risico: ${tip.zwakPunt}</div>` : ''}
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

// ── Picks Insight Modal — AI analyse van je statistieken ──
async function openPicksInsight() {
  // Verzamel alle statistieken
  const scanLog = state.scanLog || [];
  const allPicks = scanLog.flatMap(s => s.picks || []);
  const DREMPEL = { minValue: 8, minConf: 6 };
  const kwali = allPicks.filter(p => !p.isSparseData && (p.value||0) >= DREMPEL.minValue && (p.confidence||0) >= DREMPEL.minConf);
  const settled = kwali.filter(p => p.status === 'win' || p.status === 'lose');
  const wins = settled.filter(p => p.status === 'win');
  const open = kwali.filter(p => !p.status || p.status === 'pending');
  const hitrate = settled.length ? Math.round(wins.length / settled.length * 100) : null;
  const roi = settled.length
    ? parseFloat((settled.reduce((s,p) => s + (p.status==='win'?(p.odds-1):-1), 0) / settled.length * 100).toFixed(1))
    : null;
  const avgOdds = settled.length
    ? parseFloat((settled.reduce((s,p) => s + (p.odds||0), 0) / settled.length).toFixed(2))
    : null;
  const avgValue = kwali.length
    ? parseFloat((kwali.reduce((s,p) => s + (p.value||0), 0) / kwali.length).toFixed(1))
    : null;

  // Per pick type (1/X/2)
  const byType = { '1': {w:0,t:0}, 'X': {w:0,t:0}, '2': {w:0,t:0} };
  settled.forEach(p => {
    const k = p.pick || '1';
    if (byType[k]) { byType[k].t++; if (p.status==='win') byType[k].w++; }
  });

  // Per league
  const byLeague = {};
  settled.forEach(p => {
    const k = p.leagueName || p.comp || 'Overig';
    if (!byLeague[k]) byLeague[k] = {w:0,t:0,roi:0};
    byLeague[k].t++;
    if (p.status==='win') { byLeague[k].w++; byLeague[k].roi += (p.odds-1); }
    else byLeague[k].roi -= 1;
  });
  const leagueList = Object.entries(byLeague)
    .filter(([,d]) => d.t >= 2)
    .map(([n,d]) => `${n}: ${Math.round(d.w/d.t*100)}% hitrate, ROI ${(d.roi/d.t*100).toFixed(1)}%, ${d.t} picks`)
    .join(' | ');

  // Win streak
  let streak = 0;
  for (const p of [...settled].reverse()) { if (p.status==='win') streak++; else break; }

  // Bouw het modal op
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);display:flex;align-items:flex-end;';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

  const sheet = document.createElement('div');
  sheet.style.cssText = 'width:100%;max-height:88vh;overflow-y:auto;background:#0B1519;border-radius:20px 20px 0 0;padding:1rem 1rem 2rem;';

  // Header
  sheet.innerHTML = `
    <div style="width:36px;height:4px;background:rgba(255,255,255,.15);border-radius:999px;margin:0 auto .75rem;"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.9rem;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:1.3rem;color:#ef4444;">📊 INZICHT IN JOUW CIJFERS</div>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:rgba(255,255,255,.4);font-size:1.2rem;cursor:pointer;">✕</button>
    </div>
    <div id="insightContent">
      <div style="text-align:center;padding:2rem 0;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.6rem;color:rgba(255,255,255,.4);">⏳ AI analyseert jouw statistieken...</div>
      </div>
    </div>`;

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  // Bouw context string voor AI
  const ctx = [
    `Picks totaal: ${kwali.length}/100`,
    `Afgerond: ${settled.length} (${wins.length} gewonnen, ${settled.length - wins.length} verloren)`,
    `Open: ${open.length}`,
    hitrate !== null ? `Hitrate: ${hitrate}%` : 'Hitrate: nog geen data',
    roi !== null ? `ROI: ${roi >= 0 ? '+' : ''}${roi}%` : 'ROI: nog geen data',
    avgOdds ? `Gemiddelde odds: ${avgOdds}` : '',
    avgValue ? `Gemiddelde value: +${avgValue}%` : '',
    streak > 0 ? `Huidige win streak: ${streak}` : '',
    `Per pick type — 1 (thuis): ${byType['1'].t > 0 ? Math.round(byType['1'].w/byType['1'].t*100)+'% hitrate, '+byType['1'].t+' picks' : 'geen data'}, X (gelijkspel): ${byType['X'].t > 0 ? Math.round(byType['X'].w/byType['X'].t*100)+'% hitrate, '+byType['X'].t+' picks' : 'geen data'}, 2 (uit): ${byType['2'].t > 0 ? Math.round(byType['2'].w/byType['2'].t*100)+'% hitrate, '+byType['2'].t+' picks' : 'geen data'}`,
    leagueList ? `Per competitie: ${leagueList}` : '',
  ].filter(Boolean).join('\n');

  // AI aanroep via worker
  try {
    const res = await fetch('https://api.promatchxi.app/anthropic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 900,
        system: `Je bent een vriendelijke maar eerlijke statistiek-analist voor sportweddenschappen. 
Analyseer de statistieken van een gebruiker en leg duidelijk uit wat de cijfers betekenen.

TOON: Toegankelijk, concreet, eerlijk. Geen jargon. Spreek de gebruiker direct aan met "jij/je".
STRUCTUUR — gebruik altijd deze 4 secties met emoji koppen:
1. 📈 WAT GAAT GOED — maximaal 2 positieve punten met uitleg waarom dit goed is
2. ⚠️ WAT KAN BETER — maximaal 2 verbeterpunten, eerlijk maar constructief
3. 🔍 OPVALLEND — 1-2 interessante patronen in de data (bijv. pick type, league, odds range)
4. 💡 AANBEVELING — 1 concrete actie die de gebruiker morgen kan doen

Wees CONCREET: gebruik de cijfers uit de context. Zeg niet "je ROI is goed" maar "je ROI van +X% betekent dat je per €10 inzet gemiddeld €Y winst maakt."
Bij weinig data (< 10 picks): geef aan dat conclusies nog niet statistisch betrouwbaar zijn, maar geef wel eerste inzichten.`,
        messages: [{ role: 'user', content: `Mijn statistieken:
${ctx}

Geef een heldere analyse in het Nederlands.` }]
      })
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || 'Geen analyse beschikbaar.';

    // Render de analyse mooi
    const el = document.getElementById('insightContent');
    if (!el) return;

    // Parse secties op emoji koppen
    const lines = text.split('\n');
    let html = '';
    const sectionColors = { '📈': '#00BEC4', '⚠️': '#d97706', '🔍': '#7c3aed', '💡': '#16a34a' };

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) { html += '<div style="height:.4rem;"></div>'; return; }

      // Kijk of het een sectie kop is
      const secMatch = Object.keys(sectionColors).find(e => trimmed.startsWith(e));
      if (secMatch) {
        const color = sectionColors[secMatch];
        html += `<div style="font-family:'IBM Plex Mono',monospace;font-size:.54rem;font-weight:800;
          color:${color};letter-spacing:.05em;margin:.75rem 0 .35rem;padding:.4rem .6rem;
          background:${color}18;border-left:3px solid ${color};border-radius:0 8px 8px 0;">
          ${trimmed}
        </div>`;
      } else if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
        html += `<div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:rgba(255,255,255,.8);
          line-height:1.7;padding:.15rem 0 .15rem .8rem;border-left:2px solid rgba(255,255,255,.1);">
          ${trimmed.substring(1).trim()}
        </div>`;
      } else {
        html += `<div style="font-size:.82rem;color:rgba(255,255,255,.85);line-height:1.75;margin:.1rem 0;">${trimmed}</div>`;
      }
    });

    // Voeg stats samenvatting toe bovenaan
    const statsBalk = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.4rem;margin-bottom:.85rem;">
        ${[
          ['PICKS', kwali.length + '/100', '#ffffff'],
          ['HITRATE', hitrate !== null ? hitrate+'%' : '—', hitrate !== null && hitrate >= 50 ? '#00BEC4' : '#ef4444'],
          ['ROI', roi !== null ? (roi>=0?'+':'')+roi+'%' : '—', roi !== null && roi >= 0 ? '#00BEC4' : '#ef4444'],
          ['STREAK', streak > 0 ? '🔥'+streak : wins.length+'/'+settled.length, streak >= 3 ? '#00BEC4' : '#ffffff'],
        ].map(([label, val, color]) => `
          <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:10px;padding:.45rem .3rem;text-align:center;">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:1.05rem;color:${color};line-height:1;">${val}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.36rem;color:rgba(255,255,255,.4);margin-top:2px;">${label}</div>
          </div>`).join('')}
      </div>`;

    el.innerHTML = statsBalk + '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:.75rem .85rem;">' + html + '</div>';

  } catch(e) {
    const el = document.getElementById('insightContent');
    if (el) el.innerHTML = `<div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:#ef4444;padding:1rem;text-align:center;">Fout: ${e.message}</div>`;
  }
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
  const sortedAll = [...settled.reverse(), ...open];
  let sorted = sortedAll.filter(passesEliteFilter);
  const hiddenCount = sortedAll.length - sorted.length;
  const eliteOn = eliteOnlyActive();

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:flex-end;';
  overlay.id = 'picksOverlay';

  const sheet = document.createElement('div');
  sheet.style.cssText = 'background:#0B1519;border-radius:20px 20px 0 0;width:100%;max-height:85vh;overflow-y:auto;padding:1rem;';

  sheet.innerHTML = `
    <div style="width:40px;height:4px;background:rgba(0,0,0,.15);border-radius:2px;margin:0 auto .75rem;"></div>
    <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.2rem;margin-bottom:.5rem;">🎯 Picks Overzicht</div>
    <details open style="background:rgba(0,190,196,.06);border:1px solid rgba(0,190,196,.18);border-radius:10px;padding:.5rem .7rem;margin-bottom:.75rem;">
      <summary style="font-family:'IBM Plex Mono',monospace;font-size:.6rem;font-weight:700;color:#00BEC4;cursor:pointer;">📋 Pick-kwaliteit checklist</summary>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.54rem;color:rgba(255,255,255,.72);line-height:1.7;margin-top:.5rem;">
        ⭐ <b>Tier eerst</b> — Elite / A+ (Reliability 75+)<br>
        💎 <b>Value 8–25%</b> — boven ~40% is meestal een stale lijn<br>
        🎯 <b>Odds 1.5–3.5</b> — geen longshots (5.0+)<br>
        🔒 <b>Triple/Double Lock</b> &gt; pick die maar 1× opdook<br>
        🤖 <b>Poisson + AI eens</b> = sterker signaal<br>
        ⚠️ <b>Gelijkspel (X) wantrouwen</b> — moeilijkst te voorspellen<br>
        📈 <b>Sharp money</b> mee = bevestiging, tegen = rode vlag<br>
        💰 <b>Inzet 1–2%</b> bankroll · singles &gt; combi's · niet terugjagen
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:rgba(255,255,255,.45);margin-top:.5rem;border-top:1px solid rgba(255,255,255,.08);padding-top:.4rem;line-height:1.5;">
        CLV is je echte scorebord: verslaat je structureel de slotkoers → edge. Entertainment · 18+ · speel met geld dat je kunt missen.
      </div>
    </details>

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
    ${eliteOn ? (hiddenCount > 0 ? `<div onclick="togglePicksFilter()" style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:8px;padding:.45rem .65rem;margin-bottom:.5rem;cursor:pointer;"><span style="font-family:'IBM Plex Mono',monospace;font-size:.54rem;color:rgba(255,255,255,.55);">🔒 ${hiddenCount} pick${hiddenCount===1?'':'s'} verborgen (B/C)</span><span style="font-family:'IBM Plex Mono',monospace;font-size:.54rem;font-weight:700;color:#00BEC4;">toon alles →</span></div>` : '') : `<div onclick="togglePicksFilter()" style="display:flex;justify-content:space-between;align-items:center;background:rgba(0,190,196,.06);border:1px solid rgba(0,190,196,.18);border-radius:8px;padding:.45rem .65rem;margin-bottom:.5rem;cursor:pointer;"><span style="font-family:'IBM Plex Mono',monospace;font-size:.54rem;color:rgba(255,255,255,.55);">👁 Alle tiers zichtbaar</span><span style="font-family:'IBM Plex Mono',monospace;font-size:.54rem;font-weight:700;color:#00BEC4;">alleen Elite/A+ →</span></div>`}
    ${sorted.length === 0 ? '<div style="text-align:center;color:rgba(255,255,255,.5);font-size:.8rem;padding:1rem;">Nog geen picks — scan wedstrijden!</div>' :
      sorted.map(p => {
        const rel = calcReliabilityScore(p);
        const cat = getPickCategory(p);
        const isSettled = p.status === 'win' || p.status === 'lose';
        const clvHtml = (isSettled && p.clv !== undefined && p.clv !== null) ? ('<div style=\"margin-top:.3rem;\">' + renderCLVBadge(p) + '</div>') : '';
        const scoreHtml = p.score ? ('<div style=\"margin-top:.25rem;font-family:\'Bebas Neue\',sans-serif;font-size:.9rem;color:' + statusColor(p.status) + ';\">' + p.score + '</div>') : '';
        return `<div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);border-radius:10px;padding:.5rem .7rem;margin-bottom:.4rem;display:flex;flex-direction:column;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div style="flex:1;min-width:0;">
              <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.7rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.match||p.matchName||'?'}</div>
              <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.6rem;color:rgba(255,255,255,.5);">${p.pickLabel||p.pick||'?'} · @${parseFloat(p.odds||2).toFixed(2)} · +${Math.round(p.value||0)}% value</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.2rem;margin-left:.5rem;">
              <div style="font-size:1rem;">${statusIcon(p.status)}</div>
              <span style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:${rel.color};background:${rel.color}18;border-radius:4px;padding:.12rem .4rem;font-weight:700;">${cat.label}</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:.4rem;margin:.3rem 0;">
            <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:rgba(255,255,255,.4);">RELIABILITY</div>
            <div style="flex:1;background:rgba(255,255,255,.1);border-radius:999px;height:5px;overflow:hidden;">
              <div style="background:${rel.barColor};height:100%;border-radius:999px;width:${rel.score}%;"></div>
            </div>
            <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.52rem;color:${rel.color};font-weight:700;">${rel.score}/100</div>
          </div>
          ${renderPickReasons(p)}${clvHtml}${scoreHtml}
        </div>`;
      }).join('')}
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
// Voeg knipperende dot animatie toe
if (!document.getElementById('livePulseStyle')) {
  const s = document.createElement('style');
  s.id = 'livePulseStyle';
  s.textContent = '@keyframes livePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}';
  document.head.appendChild(s);
}
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
    _liveScoresInterval = setInterval(() => loadLiveScores().catch(e => console.warn('[Live]', e.message)), 60000);
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
  const pendingPicks = allPicks.filter(p => p.status === 'pending' && p.fixtureId).filter(passesEliteFilter);

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

    // Sorteer: live bovenaan, dan NS, dan FT
    const sortedPicks = [...uniquePicks].sort((a, b) => {
      const fa = fixtures[a.fixtureId];
      const fb = fixtures[b.fixtureId];
      const statusOrder = s => {
        if (!s) return 2;
        const st = s.fixture?.status?.short;
        if (['1H','2H','HT','ET','BT','P'].includes(st)) return 0;
        if (st === 'NS') return 1;
        return 3;
      };
      return statusOrder(fa) - statusOrder(fb);
    });

    // Knipperende dot updaten — groen als er live wedstrijden zijn
    const hasLive = uniquePicks.some(p => {
      const fx = fixtures[p.fixtureId];
      return fx && ['1H','2H','HT','ET','BT','P'].includes(fx.fixture?.status?.short);
    });
    const dot = document.getElementById('liveDot');
    if (dot) {
      dot.style.background = hasLive ? '#22c55e' : '#dc2626';
      dot.style.animation = hasLive ? 'livePulse 1.2s ease-in-out infinite' : 'none';
    }

    list.innerHTML = sortedPicks.map(p => {
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
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.68rem;font-weight:700;">${matchName}</div>
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.58rem;color:rgba(255,255,255,.5);margin-top:.2rem;">${pick.pickLabel||pick.pick} @ ${pick.odds}${dt ? ' · 📅 ' + dt : ''} · ⏳ Nog niet begonnen</div>
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
    statusBadge = status === 'HT' ? '⏸ RUST' : `<span style="animation:livePulse 1.2s ease-in-out infinite;display:inline-block;">🟢</span> LIVE ${elapsed}'`;
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
      <span style="font-family:\'IBM Plex Mono\',monospace;font-size:.54rem;font-weight:700;color:${statusColor};">${statusBadge}</span>
      ${winIndicator ? `<span style="font-family:\'IBM Plex Mono\',monospace;font-size:.54rem;">${winIndicator}</span>` : ''}
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;">
      <div style="flex:1;text-align:right;font-family:\'IBM Plex Mono\',monospace;font-size:.62rem;font-weight:${pick.pick==='1'?'700':'400'};">${homeTeam}</div>
      <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.3rem;color:var(--text);min-width:50px;text-align:center;">${homeGoals} - ${awayGoals}</div>
      <div style="flex:1;text-align:left;font-family:\'IBM Plex Mono\',monospace;font-size:.62rem;font-weight:${pick.pick==='2'?'700':'400'};">${awayTeam}</div>
    </div>
    <div style="text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:.54rem;color:rgba(255,255,255,.5);margin-top:.35rem;padding-top:.35rem;border-top:1px solid rgba(255,255,255,0.09);">
      🎯 ${pick.pickLabel||pick.pick} @ ${pick.odds} · +${pick.value||0}% value
      ${kickoffStr ? `<br>📅 ${kickoffStr}` : ''}
    </div>
  </div>`;
}
