
// ── Claude Insight ────────────────────────────────────
let _insightLoaded = false;

function toggleClaudeInsight() {
  const el = document.getElementById('claude-insight-content');
  const toggle = document.getElementById('claudeInsightToggle');
  if (!el) return;
  if (el.style.display === 'none') {
    el.style.display = 'block';
    if (toggle) toggle.textContent = '\u25b2';
    if (!_insightLoaded) loadClaudeInsight();
  } else {
    el.style.display = 'none';
    if (toggle) toggle.textContent = 'tik om te laden \u25bc';
  }
}

async function loadClaudeInsight(force) {
  const el = document.getElementById('claude-insight-content');
  if (!el) return;
  if (!force) {
    try {
      const c = localStorage.getItem('totoai_insight');
      if (c) { const o = JSON.parse(c); if (Date.now() - o.ts < 21600000) { el.innerHTML = o.html; _insightLoaded = true; return; } }
    } catch(e) {}
  }
  el.innerHTML = '<div style="padding:1rem;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:rgba(255,255,255,.88);">\u29d7 Claude analyseert je data...</div>';
  const sl = state.scanLog || [];
  const ap = sl.flatMap(s => s.picks || []);
  const st = ap.filter(p => p.status==='win'||p.status==='lose');
  const w  = st.filter(p => p.status==='win');
  const hr = st.length ? Math.round(w.length/st.length*100) : 0;
  const roi= st.length ? parseFloat((st.reduce((s,p)=>s+(p.status==='win'?(p.odds-1):-1),0)/st.length*100).toFixed(1)) : 0;
  const l10= st.slice(-10);
  const l10hr = l10.length ? Math.round(l10.filter(p=>p.status==='win').length/l10.length*100) : null;
  const l10roi= l10.length ? parseFloat((l10.reduce((s,p)=>s+(p.status==='win'?(p.odds-1):-1),0)/l10.length*100).toFixed(1)) : null;
  const byP = {};
  st.forEach(p=>{ if(!byP[p.pick]) byP[p.pick]={w:0,t:0}; byP[p.pick].t++; if(p.status==='win')byP[p.pick].w++; });
  const ps = Object.entries(byP).map(([k,v])=>(k==='1'?'Thuis':k==='X'?'Gelijkspel':'Uit')+': '+v.w+'/'+v.t+' ('+Math.round(v.w/v.t*100)+'%)').join(', ')||'geen data';
  const prompt = 'Je bent een eerlijke betting analyst. Analyseer deze statistieken van een Nederlandse AI-betting app en geef feedback in 4-5 zinnen, informele toon, geen bullet points:\n\nGesettled: '+st.length+' picks ('+w.length+' win)\nHitrate: '+hr+'%\nROI: '+(roi>=0?'+':'')+roi+'%\nOpen: '+ap.filter(p=>p.status==='pending').length+'\nPer type: '+ps+'\nLaatste 10: '+(l10hr!==null?l10hr+'% hitrate, ROI '+l10roi+'%':'te weinig data')+'\n\nBespreek: eerlijk oordeel, 1 sterkte, 1 verbeterpunt, verwachting richting 100 picks.';
  try {
    const res = await fetch('https://toto-proxy.zweetzakken.workers.dev/anthropic', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:400, messages:[{role:'user',content:prompt}] })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const d = await res.json();
    const txt = d?.content?.[0]?.text || d?.error || 'Geen analyse.';
    const ihtml = '<div style="padding:.75rem .85rem .6rem;">'
      +'<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;">'
      +'<div style="width:26px;height:26px;border-radius:50%;background:rgba(0,190,196,.1);border:1px solid rgba(0,190,196,.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
      +'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00BEC4" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
      +'</div><div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;font-weight:700;color:#00BEC4;">CLAUDE ANALYSEERT</div>'
      +'<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:rgba(255,255,255,.88);">Op basis van '+st.length+' gesettled picks</div></div></div>'
      +'<div style="font-family:\'DM Sans\',sans-serif;font-size:.68rem;line-height:1.65;color:var(--ink);background:rgba(0,190,196,.04);border-left:2px solid rgba(0,190,196,.3);border-radius:0 8px 8px 0;padding:.6rem .75rem;margin-bottom:.5rem;">'
      +txt.replace(/\n/g,'<br>')+'</div>'
      +'<div style="display:flex;justify-content:space-between;">'
      +'<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:rgba(255,255,255,.3);">6 uur geldig</div>'
      +'<button onclick="loadClaudeInsight(true)" style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;font-weight:700;background:rgba(0,190,196,.08);border:1px solid rgba(0,190,196,.2);color:#00BEC4;border-radius:6px;padding:.15rem .5rem;cursor:pointer;">↻ Vernieuwen</button>'
      +'</div></div>';
    el.innerHTML = ihtml;
    _insightLoaded = true;
    try { localStorage.setItem('totoai_insight', JSON.stringify({html:ihtml,ts:Date.now()})); } catch(e) {}
  } catch(e) {
    el.innerHTML = '<div style="padding:.75rem;font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:#dc2626;">Fout: '+e.message+' <button onclick="loadClaudeInsight(true)" style="margin-left:.4rem;background:rgba(220,38,38,.1);border:1px solid rgba(220,38,38,.2);color:#dc2626;border-radius:6px;padding:.15rem .4rem;cursor:pointer;font-size:.44rem;">↻ Opnieuw</button></div>';
  }
}


// ── ANALYSE SUB-TAB SWITCH ──────────────────────────
function setAnalyseSubTab(tab) {
  window._analyseActiveTab = tab;
  ['scan','ai','stats','log'].forEach(function(t) {
    var btn     = document.getElementById('atab-' + t);
    var content = document.getElementById('at-' + t + '-content');
    if (btn) {
      btn.style.background = t === tab ? '#00BEC4' : 'transparent';
      btn.style.color      = t === tab ? '#fff' : 'rgba(255,255,255,.4)';
    }
    if (content) content.style.display = t === tab ? 'block' : 'none';
  });
  if (tab === 'log') {
    setTimeout(function() {
      try { if (typeof renderScanLog === 'function') renderScanLog(); } catch(e) {}
    }, 50);
  }
}
function showAnalyseSubTab(tab) { setAnalyseSubTab(tab); }


// ══════════════════════════════════════════════════════════
// v20 CONFIDENCE ENGINE — zelfde als worker
// ══════════════════════════════════════════════════════════
const APP_LEAGUE_FACTORS = {
  39: 1.10, 140: 1.08, 78: 1.08, 135: 1.07, 61: 1.05,
  88: 1.04, 94: 1.03, 2: 1.12, 3: 1.08,
  81: 0.92, 71: 0.90, 253: 0.88
};
// ── Bullshitfilter configuratie ──────────────────────────
const LEAGUE_TRUST = {
  // Top tier — volledig vertrouwd
  39: 'top', 140: 'top', 78: 'top', 135: 'top', 61: 'top',
  2: 'top', 3: 'top', 848: 'top',
  // Goed — betrouwbaar
  88: 'good', 94: 'good', 40: 'good', 78: 'good',
  103: 'good', 113: 'good', // Noorwegen + Zweden
  71: 'good', 253: 'good', // Brazilië + MLS
  // Matig — lagere confidence
  98: 'medium', 292: 'medium', 128: 'medium', 239: 'medium',
  // v26.106: WK + overige actieve scan-competities (voorheen ten onrechte 'Onbekende competitie')
  1: 'top',                                   // FIFA World Cup
  119: 'good', 144: 'good', 43: 'good', 79: 'good',   // Denemarken, België, KKD, 2.Bundesliga
  129: 'medium', 169: 'medium', 179: 'medium', 197: 'medium', 203: 'medium', 80: 'medium', // Finland, Argentinië, Schotland, Zwitserland, Turkije, 3.Liga
  // Onbekend = default medium
};

// Leagues waar we nooit picks op willen (te weinig data/te exotisch)
const LEAGUE_BLACKLIST = new Set([
  // Kyrgyzstan, Tajikistan, Turkmenistan, Nepal, Bangladesh etc.
  // worden herkend via naam check (geen vaste IDs)
]);

const EXOTIC_KEYWORDS = [
  'kyrgyz','tajik','turkmen','nepal','bangladesh','myanmar','cambodia',
  'bhutan','laos','mongolia','maldives','macau','guam','samoa',
  'san marino','gibraltar','faroe','andorra','liechtenstein'
];

// v26.119: league-trust ook op competitienaam herkennen — lokale scan-picks missen soms leagueId
function _resolveLeagueTrust(pick) {
  if (LEAGUE_TRUST[pick.leagueId]) return LEAGUE_TRUST[pick.leagueId];
  const nm = (pick.comp || pick.leagueName || '').toLowerCase();
  if (!nm) return null;
  const NAME_TRUST = [
    ['world cup','top'], ['wereldkampioenschap','top'], ['fifa world','top'],
    ['champions league','top'], ['premier league','top'], ['la liga','top'],
    ['serie a','top'], ['bundesliga','top'], ['ligue 1','top'], ['eredivisie','top'],
    ['eliteserien','good'], ['allsvenskan','good'], ['superliga','good'],
    ['brasileir','good'], ['libertadores','good'],
    ['veikkausliiga','medium'], ['mls','medium'], ['j1 league','medium'], ['j-league','medium'],
    ['k league','medium'], ['k-league','medium'], ['primera nacional','medium'],
  ];
  for (const [k,t] of NAME_TRUST) if (nm.includes(k)) return t;
  return null;
}

function getBullshitScore(pick) {
  const warnings = [];
  let score = 0; // 0 = ok, hoger = meer zorgen

  // 1. Exotische competitie
  const leagueName = (pick.comp || pick.leagueName || '').toLowerCase();
  if (EXOTIC_KEYWORDS.some(k => leagueName.includes(k))) {
    warnings.push({ icon: '🚩', text: 'Exotische competitie — weinig data', severity: 'high' });
    score += 3;
  }

  // 2. League trust level
  const trust = _resolveLeagueTrust(pick); // v26.119: leagueId OF naam
  if (!trust || trust === 'medium') {
    // Niet top/good — lagere betrouwbaarheid
    if (!trust) {
      warnings.push({ icon: '❓', text: 'Onbekende competitie', severity: 'medium' });
      score += 1;
    }
  }

  // 3. Data schaars
  if (pick.isSparseData) {
    warnings.push({ icon: '⚠️', text: 'Weinig historische data', severity: 'high' });
    score += 2;
  }

  // 4. Lage confidence na alle factoren
  if ((pick.confidence || 0) < 5) {
    warnings.push({ icon: '📉', text: 'Lage model confidence', severity: 'medium' });
    score += 1;
  }

  // 5. Extreme odds (te laag of te hoog = risico)
  const odds = pick.odds || 0;
  if (odds > 0 && odds < 1.30) {
    warnings.push({ icon: '🔒', text: 'Odds te laag — weinig marge', severity: 'medium' });
    score += 1;
  }
  if (odds > 8.0) {
    warnings.push({ icon: '🎲', text: 'Hoge odds — hogere variance', severity: 'medium' });
    score += 1;
  }

  // 6. Late odds chaos — als odds > 15% bewogen zijn vlak voor aftrap
  if (pick.oddsMovement && Math.abs(pick.oddsMovement) > 15) {
    warnings.push({ icon: '🌀', text: 'Grote odds beweging — markt onzeker', severity: 'high' });
    score += 2;
  }

  return { score, warnings, isSafe: score === 0, isWarning: score >= 1 && score <= 2, isDangerous: score >= 3 };
}

function renderBullshitBadge(pick) {
  const { score, warnings, isDangerous, isWarning } = getBullshitScore(pick);
  if (!warnings.length) return '';

  const color = isDangerous ? '#dc2626' : isWarning ? '#b45309' : '#64748b';
  const bg    = isDangerous ? 'rgba(220,38,38,.08)' : isWarning ? 'rgba(180,83,9,.08)' : 'rgba(100,116,139,.08)';
  const label = isDangerous ? 'Hoog risico' : 'Let op';

  return `<div style="margin-top:.3rem;padding:.3rem .4rem;background:${bg};border:1px solid ${color}33;border-radius:8px;">
    <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;font-weight:700;color:${color};margin-bottom:.2rem;">
      ${isDangerous ? '🚨' : '⚠️'} ${label}
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:.2rem;">
      ${warnings.map(w => `<span style="font-family:\'IBM Plex Mono\',monospace;font-size:.36rem;color:${color};
        background:${bg};border:1px solid ${color}22;border-radius:4px;padding:.05rem .25rem;">${w.icon} ${w.text}</span>`).join('')}
    </div>
  </div>`;
}



function calculateConfidenceV20(pick, leagueId, calibration) {
  const leagueFactor = APP_LEAGUE_FACTORS[leagueId] || 0.95;
  const calFactor = (calibration && calibration[leagueId]) ? calibration[leagueId].factor || 1.0 : 1.0;

  // Odds factor
  const odds = pick.odds || 2.0;
  let oddsFactor = 1.0;
  if (odds >= 1.60 && odds <= 4.50) oddsFactor = 1.0;
  else if (odds < 1.30 || odds > 6.0) oddsFactor = 0.70;
  else if (odds < 1.60 || odds > 4.50) oddsFactor = 0.85;

  // Markt factor
  const pick1 = pick.pick || '1';
  const marktFactor = ['1','X','2'].includes(pick1) ? 1.0 :
    ['1X','X2'].includes(pick1) ? 0.90 :
    pick1.startsWith('O') || pick1.startsWith('U') ? 0.85 : 0.80;

  // Data kwaliteit
  const hasPoisson = pick.poissonUsed || pick.poissonK1 > 0;
  const dataFactor = hasPoisson ? 1.0 : 0.85;

  // Basis confidence
  const baseConf = Math.min((pick.confidence || 5) * 10, 100);
  const valueFactor = Math.min(1 + (pick.value || 0) / 100, 1.25);

  const confidenceFinal = Math.round(
    baseConf * leagueFactor * calFactor * oddsFactor * marktFactor * dataFactor * valueFactor
  );

  const elite = confidenceFinal >= 72 && (pick.value || 0) >= 8 && odds >= 1.60 && odds <= 4.50;

  return { confidenceFinal: Math.min(confidenceFinal, 100), elite };
}

// ═══════════════════════════════════════════════════════
// ANALYSE.JS — Value scan, AI analyse, Combi Tips v30
// v30: Teal sport-tech thema, Lucide iconen, glassmorphism
// v30: Scan-kaarten restyled naar dashboard kleuren (navy/goud/wit)
// v29: Bullshitfilter — exotische leagues, weinig data, late odds chaos
// v28: League stats hitrate/ROI/betrouwbaarheid
// v27: Scan log klikbaar, Supabase sync
// ═══════════════════════════════════════════════════════

// ── Anthropic fetch helper ────────────────────────────
async function anthropicFetch(apiKey, body) {
  const WORKER = 'https://toto-proxy.zweetzakken.workers.dev';
  let authToken = '';
  try {
    const u = typeof firebase !== 'undefined' && firebase.auth().currentUser;
    if (u) authToken = await u.getIdToken();
  } catch(e) {}
  // v21.1: valideer body vóór verzenden — voorkomt 400 bij lege/ongeldige requests
  if (!body || !body.messages || !body.messages.length) {
    throw new Error('Ongeldige API body: messages ontbreekt');
  }
  if (!body.messages[0].content || !String(body.messages[0].content).trim()) {
    throw new Error('Ongeldige API body: lege message content');
  }
  const res = await fetch(WORKER + '/anthropic', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { 'Authorization': 'Bearer ' + authToken } : {})
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    // Lees de error body voor debugging
    let errMsg = 'Worker HTTP ' + res.status;
    try {
      const errData = await res.json();
      const detail = errData?.error?.message || errData?.error || errData?.message || '';
      if (detail) errMsg += ': ' + String(detail).substring(0, 80);
    } catch(e) {}
    console.error('[AI] Fout:', errMsg);
    throw new Error(errMsg);
  }
  return await res.json();
}

async function anthropicFetchWithRetry(apiKey, body, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      const result = await anthropicFetch(apiKey, body);
      return result;
    } catch(e) {
      const is529 = e.message && e.message.includes('529');
      const is529b = e.message && e.message.includes('overloaded');
      if (i === retries) throw e;
      // 529 = overloaded: wacht langer
      const delay = (is529 || is529b) ? 3000 * (i + 1) : 1000 * (i + 1);
      console.log('[AI] Retry ' + (i+1) + ' na ' + delay + 'ms (' + e.message + ')');
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ── Analyse screen render ─────────────────────────────────
function renderAnalyseScreen() {
  const screen = document.getElementById('screen-analyse');
  if (!screen) return;
  try {
  var m = state.selectedMatch || null;
  const hasMatches = (state.matches||[]).some(m => m.homeOdds !== '—')
    || (state.valueScans||[]).length > 0
    || (state.lastScanResults||[]).length > 0;

  const scanLog = state.scanLog || [];
  const allPicks = scanLog.flatMap(s => s.picks || []);
  const DREMPEL = { minValue: 8, minConf: 6 };
  const kwaliPicks = allPicks.filter(p =>
    !p.isSparseData && (p.value||0) >= DREMPEL.minValue && (p.confidence||0) >= DREMPEL.minConf
  );
  const settledPicks = kwaliPicks.filter(p => p.status === 'win' || p.status === 'lose');
  const winPicks = settledPicks.filter(p => p.status === 'win');
  const scanHitrate = settledPicks.length ? Math.round(winPicks.length / settledPicks.length * 100) : null;
  const scanROI = settledPicks.length
    ? parseFloat((settledPicks.reduce((s,p) => s+(p.status==='win'?(p.odds-1):-1), 0)/settledPicks.length*100).toFixed(1))
    : null;
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0,0,0,0);
  const weekScans = scanLog.filter(s => new Date(s.timestamp||0) >= weekStart);
  const weekPicks = weekScans.flatMap(s => s.picks||[]);
  const weekSettled = weekPicks.filter(p => p.status==='win'||p.status==='lose');
  const weekWins = weekSettled.filter(p => p.status==='win');
  const weekHR = weekSettled.length ? Math.round(weekWins.length/weekSettled.length*100) : null;
  const isCalibrated = settledPicks.length >= 10;

  let html = '';

  // v26.104: SCAN VANDAAG/MORGEN-knoppen verwijderd (dubbel met SCAN VALUE op Matches + MULTI-SCAN)

  // ── STATISTIEKEN — volledige analytics inline (v26.105) ──
  html += '<div id="analyseAnalytics"></div>';

  // ── CLAUDE INSIGHT ────────────────────────────────────
  html += '<div id="claude-insight-block" style="margin-bottom:14px;">';
  html += '<div onclick="toggleClaudeInsight()" style="cursor:pointer;background:linear-gradient(135deg,rgba(0,190,196,.22),rgba(0,140,160,.15));border:2px solid rgba(0,190,196,.5);border-radius:16px;padding:1.1rem 1.2rem;display:flex;align-items:center;gap:.9rem;box-shadow:0 4px 20px rgba(0,190,196,.2);">';
  html += '<div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#00BEC4,#0077a8);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg></div>';
  html += '<div style="flex:1;">';
  html += '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.3rem;color:#00BEC4;letter-spacing:.08em;line-height:1;">CLAUDE ANALYSEERT</div>';
  html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.58rem;color:rgba(255,255,255,.6);margin-top:.25rem;">AI-analyse van jouw picks & prestaties</div>';
  html += '</div>';
  html += '<span id="claudeInsightToggle" style="font-size:1.2rem;color:#00BEC4;font-weight:700;">▼</span>';
  html += '</div>';
  html += '<div style="width:0;height:0;margin-left:26px;border-left:10px solid transparent;border-right:10px solid transparent;border-top:10px solid rgba(0,190,196,.45);"></div>';
  html += '<div id="claude-insight-content" style="display:none;background:rgba(0,190,196,.07);border:1.5px solid rgba(0,190,196,.25);border-radius:6px 16px 16px 16px;padding:1.1rem;margin-top:-1px;font-family:\'IBM Plex Mono\',monospace;font-size:.62rem;line-height:1.9;color:rgba(255,255,255,.9);"></div>';
  html += '</div>';

  // ── SCAN LOG — standaard ingeklapt ───────────────────
  html += '<div class="analyse-block" id="analyse-scanlog-block" style="padding:0;overflow:hidden;">';
  html += '<div class="analyse-block-header" onclick="(function(el){var c=document.getElementById(\'scan-log-content\');var open=c.style.display!==\'none\';c.style.display=open?\'none\':\'block\';el.querySelector(\'.sl-chevron\').style.transform=open?\'rotate(0deg)\':\'rotate(180deg)\';if(!open&&typeof renderScanLog===\'function\')renderScanLog();}).call(null,this.closest(\'.analyse-block\'))" style="cursor:pointer;padding:1rem 1.1rem;">';
  html += '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.3rem;color:#fff;letter-spacing:.05em;">📋 SCAN HISTORY</div>';
  html += '<div style="display:flex;align-items:center;gap:.5rem;">';
  html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.58rem;color:rgba(255,255,255,.88);">' + (state.scanLog||[]).length + ' scans</div>';
  html += '<svg class="sl-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="2.5" style="transition:transform .2s;"><polyline points="6 9 12 15 18 9"/></svg>';
  html += '</div></div>';
  html += '<div id="scan-log-content" style="display:none;"></div>';
  html += '</div>';

  // ── SCHADUW-PICKS — bijna-value, standaard ingeklapt ──
  html += `<div class="analyse-block" id="analyse-shadow-block" style="padding:0;overflow:hidden;">
    <div class="analyse-block-header" onclick="toggleShadowBlock(this)" style="cursor:pointer;padding:1rem 1.1rem;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:1.3rem;color:#fff;letter-spacing:.05em;">🕶️ SCHADUW-PICKS</div>
      <div style="display:flex;align-items:center;gap:.5rem;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:rgba(255,255,255,.62);">net buiten filter</div>
        <svg class="sh-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="2.5" style="transition:transform .2s;"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
    </div>
    <div id="shadow-content" style="display:none;padding:0 1.1rem 1rem;"></div>
  </div>`;

  screen.innerHTML = html;
  if (typeof renderAnalyticsInto === 'function') renderAnalyticsInto('analyseAnalytics'); // v26.105: volledige analytics inline op Analyse
  } catch(e) {
    console.error('[renderAnalyseScreen] fout:', e.message, e.stack);
    const em=e.message||'onbekend'; screen.innerHTML = '<div style="padding:1.5rem;background:rgba(232,64,74,.1);border:1px solid rgba(232,64,74,.3);border-radius:12px;margin:.5rem;"><div style="font-size:13px;font-weight:800;color:#e8404a;margin-bottom:6px;">⚠ Fout</div><div style="font-size:11px;color:#fff;font-family:monospace;word-break:break-all;">'+em+'</div><button onclick="renderAnalyseScreen()" style="margin-top:10px;padding:7px 14px;background:#00BEC4;color:#fff;border:none;border-radius:8px;font-size:12px;cursor:pointer;">↺ Opnieuw</button></div>';
    return;
  }
  // Veilig laden van scan log
  setTimeout(() => {
    try {
      if (typeof renderScanLog === 'function') renderScanLog();
    } catch(e) {
      console.warn('[analyse] renderScanLog fout:', e.message);
    }
  }, 150);
}


function toggleShadowBlock(headerEl) {
  const c = document.getElementById('shadow-content');
  if (!c) return;
  const open = c.style.display !== 'none';
  c.style.display = open ? 'none' : 'block';
  const chev = headerEl.querySelector('.sh-chevron');
  if (chev) chev.style.transform = open ? 'rotate(0deg)' : 'rotate(180deg)';
  if (!open && typeof renderShadowTrackrecord === 'function') renderShadowTrackrecord();
}

async function renderShadowTrackrecord() {
  const el = document.getElementById('shadow-content');
  if (!el) return;
  el.innerHTML = `<div style="padding:.8rem;font-family:'IBM Plex Mono',monospace;font-size:.6rem;color:rgba(255,255,255,.62);">\u27f3 Laden...</div>`;
  try {
    const r = await fetch('https://api.promatchxi.app/shadow?_cb=' + Date.now());
    const d = await r.json();
    const summary = d.summary || [];
    const picks = d.picks || [];
    const labels = { longshot: 'Longshots', draw: 'Gelijke spelen', below_threshold: 'Net onder drempel' };
    let html = `<div style="font-family:'IBM Plex Mono',monospace;font-size:.56rem;color:rgba(255,255,255,.62);line-height:1.6;margin:.2rem 0 .7rem;">Wedstrijden die n\u00e9t buiten je value-filter vielen \u2014 zo zie je of het filter terecht streng is. Niet meegeteld in je echte trackrecord.</div>`;
    if (!summary.length) {
      html += `<div style="font-family:'IBM Plex Mono',monospace;font-size:.6rem;color:rgba(255,255,255,.7);">Nog geen schaduw-picks.</div>`;
    } else {
      summary.forEach(s => {
        const afg = s.afgerekend || 0;
        const roi = s.roi_pct;
        const roiKleur = roi == null ? 'rgba(255,255,255,.6)' : (roi >= 0 ? '#16c784' : '#dc2626');
        html += `<div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:12px;padding:.6rem .75rem;margin-bottom:.45rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.3rem;"><span style="font-family:'IBM Plex Mono',monospace;font-size:.62rem;font-weight:700;color:#fff;">${labels[s.reason] || s.reason}</span><span style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:rgba(255,255,255,.62);">${afg} afgerekend \u00b7 ${s.open||0} open</span></div>`;
        if (afg > 0) {
          html += `<div style="display:flex;gap:1rem;font-family:'IBM Plex Mono',monospace;font-size:.58rem;">
            <span style="color:rgba(255,255,255,.88);">Hitrate <b style="color:#fff;">${s.hitrate_pct ?? '\u2013'}%</b></span>
            <span style="color:rgba(255,255,255,.88);">Gem. odds <b style="color:#fff;">${s.gem_odds ?? '\u2013'}</b></span>
            <span style="color:rgba(255,255,255,.88);">ROI <b style="color:${roiKleur};">${roi == null ? '\u2013' : (roi>=0?'+':'') + roi + '%'}</b></span>
          </div>`;
        } else {
          html += `<div style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;color:rgba(255,255,255,.55);">nog niet afgerekend \u2014 uitslagen volgen</div>`;
        }
        html += `</div>`;
      });
    }
    if (picks.length) {
      html += `<div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:rgba(255,255,255,.62);letter-spacing:.06em;margin:.6rem 0 .35rem;">RECENT</div>`;
      const rb = { longshot:'longshot', draw:'gelijk', below_threshold:'net-onder' };
      picks.slice(0, 25).forEach(p => {
        const icon = p.status === 'win' ? '\u2705' : p.status === 'lose' ? '\u274c' : '\u23f3';
        html += `<div style="display:flex;align-items:center;gap:.5rem;padding:.35rem 0;border-bottom:1px solid rgba(255,255,255,.06);">
          <span style="font-size:.8rem;">${icon}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.56rem;color:#fff;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${p.home||''} vs ${p.away||''}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;color:rgba(255,255,255,.62);">${p.pick_label||p.pick} @ ${p.odds||'?'} \u00b7 model ${p.model_pct||'?'}% vs markt ${p.market_pct||'?'}% \u00b7 ${rb[p.reason]||p.reason}${p.score ? ' \u00b7 ' + p.score : ''}</div>
          </div>
        </div>`;
      });
    }
    el.innerHTML = html;
  } catch(e) {
    el.innerHTML = `<div style="padding:.8rem;font-family:'IBM Plex Mono',monospace;font-size:.58rem;color:#dc2626;">Kon schaduw-picks niet laden.</div>`;
  }
}

// ── Auto-scan: laad wedstrijden (vandaag+morgen) + scan direct ──
async function autoScanAndSwitch() {
  const btn = document.getElementById('autoScanBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⟳ WEDSTRIJDEN LADEN...'; }

  try {
    // Stap 1: wis state.matches zodat scanAllTodayValue altijd alle competities laadt
    state.matches = [];
    showToast('⚡ Wedstrijden ophalen...');

    // Stap 2: toon scan sub-tab zonder te herrenderen (behoudt UI)
    showAnalyseSubTab('scan');
    await new Promise(r => setTimeout(r, 100));

    // Stap 3: scanAllTodayValue laadt alle competities + odds + doet de value scan
    await scanAllTodayValue('today');

  } catch(e) {
    showToast('❌ Auto-scan mislukt: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = '⚡ AUTOMATISCH SCANNEN →'; }
  }
}


// ── Auto-scan panel toggle ─────────────────────────────
function toggleAutoScanPanel() {
  const panel = document.getElementById('autoScanPanel');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) updateAutoScanPanelUI();
}

function updateAutoScanPanelUI() {
  const fromEl = document.getElementById('scanWindowFrom');
  const toEl   = document.getElementById('scanWindowTo');
  const btn    = document.getElementById('autoScanToggleBtn');
  const status = document.getElementById('autoScanStatusBar');
  if (fromEl) fromEl.value = state.settings.scanWindowFrom ?? 14;
  if (toEl)   toEl.value   = state.settings.scanWindowTo   ?? 18;
  if (btn) {
    const on = state.settings.autoScan;
    btn.textContent = on ? 'Uitzetten' : 'Inschakelen';
    btn.style.background    = on ? 'rgba(220,38,38,.1)'   : 'rgba(0,190,196,.1)';
    btn.style.borderColor   = on ? 'rgba(220,38,38,.35)'  : 'rgba(0,190,196,.35)';
    btn.style.color         = on ? '#dc2626'              : '#00BEC4';
  }
  if (status) {
    const from = state.settings.scanWindowFrom ?? 14;
    const to   = state.settings.scanWindowTo   ?? 18;
    const skip = state.settings.scanSkipDate === new Date().toDateString();
    const on   = state.settings.autoScan;
    if (!on)   status.textContent = '⏸ Auto-scan uitgeschakeld';
    else if (skip) status.textContent = '⏭ Overgeslagen voor vandaag';
    else {
      const h = new Date().getHours();
      const inWindow = h >= from && h < to;
      status.textContent = inWindow
        ? `✅ Actief — scant elk uur tussen ${from}:00–${to}:00`
        : `⏳ Wacht op scanvenster (${from}:00–${to}:00)`;
    }
  }
}

// ── Scheduler (elk uur checken) ────────────────────────
let _autoScanIntervalId = null;

function startAutoCheckScheduler() {
  if (_autoScanIntervalId) clearInterval(_autoScanIntervalId);
  _autoScanIntervalId = setInterval(checkAndAutoScan, 60 * 60 * 1000); // elk uur
  checkAndAutoScan(); // meteen checken bij starten
  updateAutoScanPanelUI();
}

async function checkAndAutoScan() {
  if (!state.settings.autoScan) return;
  if (state.settings.scanSkipDate === new Date().toDateString()) return;
  const h    = new Date().getHours();
  const from = state.settings.scanWindowFrom ?? 14;
  const to   = state.settings.scanWindowTo   ?? 18;
  if (h < from || h >= to) return;
  // Voorkom dubbele scan binnen zelfde uur
  const nowHour = new Date().toISOString().substring(0, 13);
  if (state.settings.lastAutoScanHour === nowHour) return;
  state.settings.lastAutoScanHour = nowHour;
  saveState();
  showToast(`⚡ Auto-scan gestart (${h}:00)`);
  await autoScanAndSwitch();
  updateAutoScanPanelUI();
}

function showAnalyseSubTab(tab) {
  // v21.1: geen tabs meer — scroll naar sectie
  const scrollMap = {
    'scan':    'analyseScanResults',
    'analyse': 'analyseBtn',
    'tips':    'combiGenBtn',
    'log':     'analyse-scanlog-block',
  };
  const targetId = scrollMap[tab];
  if (targetId) {
    setTimeout(() => {
      const el = document.getElementById(targetId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }
}


// v26.126: WORKER = ENIGE VALUE-ENGINE. De frontend berekent geen value meer; alle
// value-weergave komt uit de worker-picks (/picks). Deze mapper zet een worker-pick om
// naar de bestaande valueScans-vorm zodat balk, popup, wallet en combi-tips ongewijzigd werken.
function workerPickToScan(p) {
  const odds = parseFloat(p.odds) || 0;
  const kans = (typeof p.aiKans === 'number') ? p.aiKans : (parseFloat(p.aiKans) || 0);
  const kelly = (typeof calcKelly === 'function' && kans && odds) ? calcKelly(kans, odds) : 0;
  return {
    id: p.fixtureId, matchId: p.fixtureId, fixtureId: p.fixtureId,
    match: { id: p.fixtureId, home: p.home, away: p.away, comp: p.leagueName || '',
             dateISO: p.matchDate || '', matchTime: p.matchTime || '', date: p.matchDate || '', time: '' },
    home: p.home, away: p.away, comp: p.leagueName || '', leagueName: p.leagueName || '',
    pick: p.pick, pickLabel: p.pickLabel || p.pick,
    kans: Math.round(kans), odds,
    value: (typeof p.value === 'number') ? p.value : (parseFloat(p.value) || 0),
    confidence: (typeof p.confidence === 'number') ? p.confidence : (parseFloat(p.confidence) || 0),
    kelly, reason: p.reason || '',
    sharp: !!p.elite, poissonUsed: true, _hasXG: false,
    isSparseData: false, oddsMovement: p.oddsMovement || null,
    status: (p.status && p.status !== 'pending') ? p.status : undefined,
    matchTime: p.matchTime || null, matchDate: p.matchDate || null,
  };
}

// Haalt de worker-picks op en vult state.valueScans (enige bron). Vervangt de oude client-scan.
async function refreshValueScansFromWorker(silent = false) {
  const btns = ['valueScanBtn','valueScanBtn2','multiScanBtn']
    .map(id => document.getElementById(id)).filter(Boolean);
  const saved = btns.map(b => b.textContent);
  btns.forEach(b => { b.disabled = true; b.textContent = '\u27f3 LADEN...'; });
  try {
    // v26.127: handmatige scan (niet-silent) triggert eerst een worker-scan-nu; daarna lezen we /picks.
    // Silent/achtergrond-refreshes lezen alleen de laatste picks (geen scan-kosten).
    if (!silent) {
      try {
        btns.forEach(b => { b.textContent = '\u27f3 SCANNEN...'; });
        const sr = await fetch('https://api.promatchxi.app/scan-now');
        if (sr.ok) {
          const sd = await sr.json();
          if (sd && sd.reason === 'cooldown' && typeof showToast === 'function') {
            showToast(`Net gescand \u2014 toon laatste picks (wacht ${sd.retryAfter||60}s)`);
          } else if (sd && sd.reason === 'daglimiet' && typeof showToast === 'function') {
            showToast(`Daglimiet bereikt (${sd.scansToday||''}/${sd.cap||25} scans) \u2014 toon laatste picks`);
          }
        }
      } catch(e) { console.warn('[ValueScan] /scan-now niet bereikbaar:', e.message); }
    }
    try {
      const r = await fetch('https://api.promatchxi.app/picks');
      if (r.ok) { const d = await r.json(); state._qualityPicks = d.picks || (Array.isArray(d) ? d : []); }
    } catch(e) { console.warn('[ValueScan] /picks niet bereikbaar:', e.message); }

    const picks = (state._qualityPicks || [])
      .filter(p => (!p.status || p.status === 'pending'))
      .map(workerPickToScan)
      .filter(s => !matchHasStarted(s))
      .filter(s => (s.value || 0) >= 5)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    state.valueScans = picks;
    if (typeof saveState === 'function') saveState();
    if (typeof renderValueBannerInAnalyse === 'function') renderValueBannerInAnalyse(picks, picks.length);
    if (typeof renderAnalyseScanResults === 'function') renderAnalyseScanResults(picks);
    if (typeof renderMatches === 'function') renderMatches(state.matches);
    if (!silent && typeof showToast === 'function') {
      showToast(picks.length ? `${picks.length} value picks uit de worker` : 'Geen gekwalificeerde value picks');
    }
  } catch(e) {
    console.warn('[ValueScan] worker-bron fout:', e.message);
    if (!silent && typeof showToast === 'function') showToast('Kon worker-picks niet laden');
  } finally {
    btns.forEach((b, i) => { b.disabled = false; b.textContent = saved[i]; });
  }
}

// ── Value scan (per competitie) ───────────────────────────
// v26.126: client-scan vervangen door worker-bron. Wrappers delegeren naar refreshValueScansFromWorker.
async function scanValueBatched() {
  return refreshValueScansFromWorker(false);
}
async function _scanValueBatched_legacy() {
  if (window._scanBusy) { alert('Er loopt al een scan. Wacht tot die klaar is.'); return; }
  const oddsOk = m => {
    const h = parseFloat(m.homeOdds), d = parseFloat(m.drawOdds), a = parseFloat(m.awayOdds);
    return !m.isDone && m.homeOdds !== '\u2014' && m.drawOdds !== '\u2014' && m.awayOdds !== '\u2014'
      && h > 1 && d > 1 && a > 1 && !isNaN(h) && !isNaN(d) && !isNaN(a);
  };
  const all = (state.matches || []).filter(oddsOk);
  if (!all.length) { alert('Geen wedstrijden met quotes. Laad eerst wedstrijden.'); return; }
  if (all.length <= 15) { return scanValueAll(false); }  // \u226415 \u2192 \u00e9\u00e9n scan

  const btn = document.getElementById('valueScanBtn');
  const fullMatches = state.matches;
  const chunks = [];
  for (let i = 0; i < all.length; i += 15) chunks.push(all.slice(i, i + 15));
  const accumulated = [];
  window._suppressScanPush = true;  // geen push per batch
  try {
    for (let c = 0; c < chunks.length; c++) {
      if (btn) { btn.disabled = true; btn.textContent = `\u27f3 BATCH ${c + 1}/${chunks.length} (${chunks[c].length})...`; }
      state.matches = chunks[c];
      await scanValueAll(true);                        // scant batch \u2192 zet state.valueScans
      accumulated.push(...(state.valueScans || []));   // verzamel resultaten
    }
  } finally {
    window._suppressScanPush = false;
    state.matches = fullMatches;                       // volledige lijst herstellen
    state.valueScans = accumulated;                    // alle batch-resultaten samen
    window._scanBusy = false;
    // \u00e9\u00e9nmalig de volledige resultaten tonen
    const displayAll = [...accumulated].sort((a,b) => (b.value||-999) - (a.value||-999)).filter(s => s.value >= 5);
    if (typeof renderValueBannerInAnalyse === 'function') renderValueBannerInAnalyse(displayAll, accumulated.length);
    if (typeof renderAnalyseScanResults === 'function') renderAnalyseScanResults(displayAll);
    if (typeof renderMatches === 'function') renderMatches(state.matches);
    if (btn) { btn.disabled = false; btn.textContent = '\u26a1 OPNIEUW SCANNEN'; }
  }
  if (typeof showToast === 'function') showToast(`Scan klaar \u2014 ${accumulated.length} resultaten uit ${all.length} wedstrijden`);
}

async function scanValueAll(silent = false) {
  return refreshValueScansFromWorker(silent); // v26.126: worker = enige value-engine
}
async function _scanValueAll_legacy(silent = false) {
  if (window._scanBusy) {
    if (!silent) alert('Er loopt al een scan. Wacht tot die klaar is.');
    return;
  }
  // v21.0: max 15 candidates om JSON truncatie te voorkomen bij grote batches
  // v21.1: alle drie odds moeten geldig zijn — voorkomt HTTP 400 bij incomplete odds
  const candidates = (state.matches||[]).filter(m => {
    const h = parseFloat(m.homeOdds), d = parseFloat(m.drawOdds), a = parseFloat(m.awayOdds);
    return !m.isDone
      && m.homeOdds !== '—' && m.drawOdds !== '—' && m.awayOdds !== '—'
      && h > 1 && d > 1 && a > 1
      && !isNaN(h) && !isNaN(d) && !isNaN(a);
  }).slice(0, 15);

  if (!candidates.length) {
    if (!silent) alert('Geen wedstrijden met quotes. Laad eerst wedstrijden via Wedstrijden tabblad.');
    return;
  }

  const btnId = document.getElementById('valueScanBtn') ? 'valueScanBtn' : 'valueScanBtn2';
  const btn = document.getElementById(btnId);
  if (btn) { btn.disabled = true; btn.textContent = `⟳ SCANNEN (${candidates.length})...`; }
  state.valueScans = [];
  window._scanBusy = true;

  try {
    const leagueId = COMP_IDS[state.activeComp];

    // Stap 1: haal stats op voor elke wedstrijd (parallel, met timeout)
    const matchDataMap = {};
    const wt = (p, ms=5000) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);

    if (candidates.some(m => m.homeId && m.awayId)) {
      if (btn) btn.textContent = `⟳ DATA OPHALEN...`;
      await Promise.all(candidates.map(async m => {
        if (!m.homeId || !m.awayId) { matchDataMap[m.id] = { confidence: 3 }; return; }
        try {
          const [h2h, homeForm, awayForm, hStats, aStats, injuries, standings, predictions] = await Promise.all([
            wt(fetchH2H(m.homeId, m.awayId), 4000),
            wt(fetchTeamForm(m.homeId), 4000),
            wt(fetchTeamForm(m.awayId), 4000),
            wt(fetchTeamStats(m.homeId, leagueId || 88), 4000),
            wt(fetchTeamStats(m.awayId, leagueId || 88), 4000),
            wt(fetchInjuries(m.id), 3000),
            wt(fetchStandings(leagueId || m.leagueId, null), 4000),
            wt(fetchPredictions(m.id), 5000),
          ]);
          // v18.9: xG ophalen uit fixture statistics
          const [homeXG, awayXG] = await Promise.all([
            wt(typeof fetchXGFromFixtures === 'function' ? fetchXGFromFixtures(m.homeId, homeForm) : Promise.resolve([]), 5000),
            wt(typeof fetchXGFromFixtures === 'function' ? fetchXGFromFixtures(m.awayId, awayForm) : Promise.resolve([]), 5000),
          ]);
          let conf = 4;
          if (h2h?.length >= 3) conf += 2; else if (h2h?.length) conf += 1;
          if (homeForm?.length >= 5 && awayForm?.length >= 5) conf += 2;
          else if (homeForm?.length && awayForm?.length) conf += 1;

          // Blessure factoren berekenen
          const homeInjFactor = injuries ? calcInjuryFactor(injuries, m.homeId) : null;
          const awayInjFactor  = injuries ? calcInjuryFactor(injuries, m.awayId)  : null;
          if (homeInjFactor?.count) conf = Math.max(1, conf - Math.min(2, homeInjFactor.count));
          if (awayInjFactor?.count)  conf = Math.max(1, conf - Math.min(1, awayInjFactor.count));

          // Stand & motivatie
          const homeStanding = standings ? extractStandingInfo(standings, m.homeId) : null;
          const awayStanding  = standings ? extractStandingInfo(standings, m.awayId)  : null;

          // Gewogen H2H
          const h2hWeighted = h2h?.length ? calcWeightedH2H(h2h, m.homeId, m.awayId) : null;
          if (h2hWeighted?.count >= 5) conf = Math.min(10, conf + 1);

          // Competitie fase
          const played = homeStanding?.played || 0;
          const compPhase = getCompetitionPhase(played);

          const homeGoalStats = hStats ? extractTeamGoalStats(hStats, homeForm, homeXG||[]) : null;
          const awayGoalStats = aStats ? extractTeamGoalStats(aStats, awayForm, awayXG||[])  : null;

          // Motivatie factor meenemen in Poisson
          const homeMotFactor = homeStanding?.motivatieFactor || 1.0;
          const awayMotFactor  = awayStanding?.motivatieFactor  || 1.0;
          const homeInjAdj = homeInjFactor || null;
          const awayInjAdj  = awayInjFactor  || null;

          const poisson = calcPoissonKansen(homeGoalStats, awayGoalStats, m.leagueId || leagueId || 1.35, homeInjAdj, awayInjAdj);
          if (poisson.valid) conf = Math.min(10, conf + 1 + (poisson.hasXG ? 1 : 0));

          const market = analyzeMarketMovement(m.id, parseFloat(m.homeOdds)||0, parseFloat(m.drawOdds)||0, parseFloat(m.awayOdds)||0);
          conf = Math.min(10, Math.max(1, conf + (market.confDelta||0)));

          const h2hCount   = h2h?.length    || 0;
          const homeGames  = homeForm?.length || 0;
          const awayGames  = awayForm?.length || 0;
          const dataQuality = h2hCount + homeGames + awayGames;
          const isSparseData = dataQuality < 5;

          let finalConf = Math.min(10, conf);
          if (isSparseData) finalConf = Math.min(finalConf, 5);
          else if (dataQuality < 8) finalConf = Math.min(finalConf, 7);

          // Blessure context string voor AI prompt
          let injuryContext = '';
          if (homeInjFactor?.count) injuryContext += `\n   🏥 ${m.home} blessures: ${homeInjFactor.players.join(', ')} (aanval ${Math.round((1-homeInjFactor.attackFactor)*100)}%↓, verdediging ${Math.round((1-homeInjFactor.defenseFactor)*100)}%↓)`;
          if (awayInjFactor?.count)  injuryContext += `\n   🏥 ${m.away} blessures: ${awayInjFactor.players.join(', ')} (aanval ${Math.round((1-awayInjFactor.attackFactor)*100)}%↓, verdediging ${Math.round((1-awayInjFactor.defenseFactor)*100)}%↓)`;

          // Stand context voor AI prompt
          let standingContext = '';
          if (homeStanding) standingContext += `\n   📊 ${m.home}: pos ${homeStanding.pos}/${homeStanding.total}, ${homeStanding.pts}pt, GD ${homeStanding.gd>0?'+':''}${homeStanding.gd}${homeStanding.motivatieLabel ? ' — '+homeStanding.motivatieLabel : ''}`;
          if (awayStanding)  standingContext += `\n   📊 ${m.away}: pos ${awayStanding.pos}/${awayStanding.total}, ${awayStanding.pts}pt, GD ${awayStanding.gd>0?'+':''}${awayStanding.gd}${awayStanding.motivatieLabel ? ' — '+awayStanding.motivatieLabel : ''}`;

          // Predictions verwerken — extra confidence als beschikbaar
          const predContext = predictions ? formatPredictions(predictions, m.home, m.away) : '';
          if (predictions?.percent?.home !== null) conf = Math.min(10, conf + 1);

          matchDataMap[m.id] = {
            h2h:           h2hCount   ? formatH2HCompact(h2h.slice(0,5), m.home, m.away)        : '',
            homeForm:      homeGames  ? formatFormCompact(homeForm.slice(0,5), m.homeId, m.home) : '',
            awayForm:      awayGames  ? formatFormCompact(awayForm.slice(0,5), m.awayId, m.away) : '',
            poisson, market,
            homeInjFactor, awayInjFactor, injuryContext,
            homeStanding, awayStanding, standingContext,
            h2hWeighted, compPhase,
            predictions, predContext,
            confidence: finalConf,
            dataQuality, isSparseData,
            h2hCount, homeGames, awayGames
          };
        } catch(e) {
          matchDataMap[m.id] = { confidence: 4 };
        }
      }));
    }

    // Stap 2: AI batch analyse
    if (btn) btn.textContent = `⟳ AI ANALYSE (${candidates.length})...`;
    const ctx = candidates.map((m, i) => {
      const d = matchDataMap[m.id] || {};
      const p = d.poisson;
      let line = `${i+1}. ID:${m.id} | ${m.home} vs ${m.away} | ${m.comp||'?'} | ${m.date||''} ${m.time||''} | 1=${m.homeOdds} X=${m.drawOdds} 2=${m.awayOdds}`;
      if (p?.valid) line += `\n   📐 Poisson: 1=${p.k1}% X=${p.kX}% 2=${p.k2}%${p.injLabel||''}`;
      if (d.homeForm) line += `\n   Vorm ${m.home}: ${d.homeForm}`;
      if (d.awayForm) line += `\n   Vorm ${m.away}: ${d.awayForm}`;
      if (d.h2h) line += `\n   H2H: ${d.h2h}`;
      if (d.h2hWeighted) line += ` [gewogen: thuis ${d.h2hWeighted.homeWinPct}% / gelijk ${d.h2hWeighted.drawPct}% / uit ${d.h2hWeighted.awayWinPct}%]`;
      if (d.market?.direction !== 'none') line += `\n   Markt: ${d.market?.label||''}`;
      if (d.injuryContext) line += d.injuryContext;
      if (d.standingContext) line += d.standingContext;
      if (d.compPhase?.label) line += `\n   🗓 Fase: ${d.compPhase.label}`;
      if (d.predContext) line += `\n   ${d.predContext.split('\n').join('\n   ')}`;
      if (d.isSparseData) line += `\n   ⚠️ DATA SCHAARS (H2H:${d.h2hCount||0} wedstr, vorm:${(d.homeGames||0)+(d.awayGames||0)} wedstr) — max confidence 5`;
      else if (d.dataQuality < 8) line += `\n   📊 Beperkte data (${d.dataQuality} wedstr totaal) — wees voorzichtig`;
      return line;
    }).join('\n\n');

    // v21.1: guard — lege context mag nooit naar Anthropic
    if (!ctx || ctx.trim().length < 20) throw new Error('Lege scan context — geen geldige wedstrijden');
    const dynamicTokens = Math.min(4000, Math.max(1500, candidates.length * 130));
    const data = await anthropicFetch(null, {
      model: 'claude-sonnet-4-6',
      max_tokens: dynamicTokens,
      temperature: 0,
      system: `RESPOND WITH VALID JSON ONLY. NO TEXT BEFORE OR AFTER JSON. START WITH { END WITH }.
{"scans":[{"id":"123","kans1":45,"kansX":30,"kans2":25,"confidence":7,"reason":"max 12 woorden concreet"}]}

DRIE ANKERS — gebruik alle drie als beschikbaar:
1. POISSON (📐): statistisch model op doelpuntengemiddelden + xG
2. API PREDICTIONS (📊/💡): externe kansberekening van API-Football (onafhankelijk model)
3. CONTEXT: vorm, H2H gewogen, blessures, motivatie, fase

WEGING:
- Als alle drie beschikbaar: Poisson 35% + API pred 30% + context 35%
- Als Poisson + API pred: elk 40% + context 20%
- Als alleen Poisson: Poisson 50% + context 50%
- API pred advies ("thuisploeg wint") = extra signaalbevestiging, niet blind volgen

ANALYSE REGELS:
- kans1+kansX+kans2 MOET exact 100 zijn
- Thuisvoordeel: +5-8pp voor thuisploeg tenzij vorm/API anders aangeeft
- Vorm weegt zwaarder dan seizoensgemiddelden (laatste 5 wedstrijden)
- GEWOGEN H2H: recente duels wegen zwaarder
- BLESSURES: 🏥 sterspelers missen → pas kansen aan (-3 tot -8pp aanvalskans betrokken team)
- MOTIVATIE: 😴 niets_te_winnen → -5 tot -8pp; 🔴 degradatie → +5pp; 🏆 titel → +3pp
- COMPETITIE FASE: 🏁 einde seizoen = rotatie → meer onzekerheid, hogere kansX
- CONVERGENTIE BONUS: als Poisson + API pred + vorm hetzelfde aangeven → confidence +1
- DIVERGENTIE: als Poisson en API pred sterk afwijken (>15pp) → confidence -1, noteer in reason

GELIJKSPEL WAARSCHUWING — KRITISCH:
- Gelijkspel komt voor in ~25-28% van wedstrijden. NOOIT kansX boven 33% tenzij BEIDE teams gelijkspeelhistorie >30%
- Kies NOOIT gelijkspel (X) als beste pick tenzij: kansX ≥ 33% EN Poisson kansX ≥ 30% EN H2H ≥ 30% gelijke spelen
- Bij twijfel: kies ALTIJD 1 of 2, NOOIT X
- Gelijkspel is statistisch de slechtst voorspelbare uitkomst

VALUE DETECTIE:
- reason = korte onderbouwing IN DE RICHTING VAN DE PICK (max 14 woorden). Verklaar waarom júist deze uitkomst value heeft. Bij een underdog/value-pick: leg uit waarom de markt de tegenstander overschat of waarom deze kant ondergewaardeerd is — beschrijf NOOIT alleen de kracht van de tegenstander, want dat spreekt de pick tegen. Marktovershatting mag je benoemen, maar geen kale odds-getallen.
- confidence 8-10: meerdere ankers bevestigen + consistente signalen
- confidence 6-7: 1-2 ankers bevestigen, 1 conflicterend signaal
- confidence 1-5: schaarse data of sterke divergentie tussen ankers

SCHAARSE DATA:
- "DATA SCHAARS" label: confidence MAX 5, wijk max 5pp af van Poisson/API pred
- "Beperkte data": confidence MAX 7
- Geen uitleg buiten JSON`,
      messages:[{role:'user', content:`Analyseer ${candidates.length} wedstrijden:\n\n${ctx}`}]
    });

    if (data.error) throw new Error(data.error.message || 'API fout');
    // Track kosten
    if (data.usage && typeof trackTokenUsage === 'function') {
      trackTokenUsage('claude-sonnet-4-6', data.usage.input_tokens||0, data.usage.output_tokens||0);
    }
    let raw = data.content?.[0]?.text?.trim();
    if (!raw) throw new Error('Lege response van API');
    const s1 = raw.indexOf('{'), e1 = raw.lastIndexOf('}');
    if (s1 < 0 || e1 < s1) throw new Error('Geen JSON: ' + raw.substring(0, 60));
    const parsed = JSON.parse(raw.substring(s1, e1 + 1));
    const scansRaw = parsed.scans || parsed.results || [];
    if (!scansRaw.length) throw new Error('Lege resultaten');

    if (btn) btn.textContent = `⟳ VERWERKEN...`;

    const scans = scansRaw.map(s => {
      const match = candidates.find(m => String(m.id) === String(s.id));
      if (!match) return null;
      const sum = (s.kans1||0) + (s.kansX||0) + (s.kans2||0);
      if (sum < 80 || sum > 120) return null;
      let k1 = Math.round((s.kans1||0) / sum * 100);
      let kX = Math.round((s.kansX||0) / sum * 100);
      let k2 = Math.round((s.kans2||0) / sum * 100);

      // Blend Poisson + AI — dynamische weging op databeschikbaarheid
      const poisson = matchDataMap[s.id]?.poisson;
      if (poisson?.valid) {
        const d = matchDataMap[s.id];
        const dq = d.dataQuality || 0;
        const pw = Math.min(0.65,
          0.40
          + (poisson.hasXG ? 0.08 : 0)
          + (d.h2hCount >= 3 ? 0.04 : 0)
          + (d.homeGames >= 5 ? 0.05 : 0)
          + (d.awayGames >= 5 ? 0.05 : 0)
        );
        const aw = 1 - pw;
        k1 = Math.round(pw * poisson.k1 + aw * k1);
        kX = Math.round(pw * poisson.kX + aw * kX);
        k2 = Math.round(pw * poisson.k2 + aw * k2);
        const bs = k1+kX+k2; if (bs!==100) k1 += (100-bs);
      }

      // Marktbeweging correctie
      const market = matchDataMap[s.id]?.market;
      if (market?.isSteam && market.direction) {
        const adj = 3;
        if (market.direction === '1') { k1 += adj; kX = Math.max(5, kX-adj); }
        else if (market.direction === 'X') { kX += adj; k1 = Math.max(5, k1-adj); }
        else if (market.direction === '2') { k2 += adj; kX = Math.max(5, kX-adj); }
        const ms = k1+kX+k2; if (ms!==100) k1 += (100-ms);
      }

      // Value berekenen met overround correctie
      const makePick = (pick, pickLabel, kans, oddsStr) => {
        const odds = parseFloat(oddsStr) || 0;
        if (!odds || odds <= 1) return null;
        const val = typeof calcValueFair === 'function'
          ? calcValueFair(kans, odds, match.homeOdds, match.drawOdds, match.awayOdds)
          : calcValue(kans, odds);
        const kelly = calcKelly(kans, odds);
        const ev = (typeof calcEV === 'function') ? calcEV(kans, odds) : null;
        return { pick, pickLabel, kans, odds, value: val, ev, kelly, bookmaker: match.oddsSource || 'quote' };
      };
      const picks = [
        makePick('1', `${match.home} wint`, k1, match.homeOdds),
        makePick('X', 'Gelijkspel', kX, match.drawOdds),
        makePick('2', `${match.away} wint`, k2, match.awayOdds),
      ].filter(Boolean)
       // v26.123: favorite-longshot guardrail — longshots (hoge odds) niet als value-pick tonen
       .filter(p => p.odds < ((typeof FE_LONGSHOT_ODDS === 'number') ? FE_LONGSHOT_ODDS : 3.5));

      // Sanity checks
      const favoriteOdds = Math.min(parseFloat(match.homeOdds)||99, parseFloat(match.awayOdds)||99);
      if (favoriteOdds < 1.50) return null;
      const drawPick = picks.find(p => p.pick === 'X');
      if (drawPick && drawPick.value > 0) {
        // Gelijkspel: alleen toestaan als Poisson kX >= 32% EN geen duidelijke favoriet
        // Anders altijd op 0 — te onvoorspelbaar
        const poissonDrawStrong = poisson?.valid && (poisson.kX || 0) >= 32;
        if (!poissonDrawStrong || favoriteOdds < 2.20) {
          drawPick.value = 0;
        }
      }

      picks.sort((a, b) => (b.value||-999) - (a.value||-999));
      const best = picks[0];
      if (!best) return null;

      // Value cap
      const rawValue = best.value;
      if (best.value > 55) best.value = 55;

      const dataConf    = matchDataMap[s.id]?.confidence || 4;
      const aiConf      = Math.max(1, Math.min(10, parseInt(s.confidence) || 5));
      const isSparse    = matchDataMap[s.id]?.isSparseData || false;
      const dataQuality = matchDataMap[s.id]?.dataQuality  || 0;

      let confidence = Math.min(10, Math.round((dataConf + aiConf) / 2) + (poisson?.valid ? 1 : 0));
      if (isSparse)          confidence = Math.min(confidence, 5);
      else if (dataQuality < 8) confidence = Math.min(confidence, 7);

      if (isSparse && best.value > 10) {
        best.value = Math.min(best.value, 10);
      } else if (dataQuality < 8 && best.value > 20) {
        best.value = Math.min(best.value, 20);
      }

      return {
        id: s.id, match,
        pick: best.pick, pickLabel: best.pickLabel,
        kans: best.kans, odds: best.odds,
        bookmaker: best.bookmaker,
        value: best.value, kelly: best.kelly,
        confidence, allPicks: picks,
        poissonUsed:  poisson?.valid || false,
        poissonK1:    poisson?.k1, poissonKX: poisson?.kX, poissonK2: poisson?.k2,
        market:       market?.direction !== 'none' ? market : null,
        rawValue,     reason: s.reason || '',
        isSparseData: isSparse,
        dataQuality,
        _hasXG: poisson?.hasXG || false,
      };
    }).filter(x => x !== null);

    state.valueScans = scans;

    // Log scan resultaten
    if (scans.length > 0) logScanResult(scans);

    // Auto-save backtest picks (≥5% value + confidence >= 7)
    if (!state.valueBacktest) state.valueBacktest = { picks: [] };
    let savedCount = 0;
    scans.filter(s => s.value >= 5 && (s.confidence || 0) >= 7).forEach(s => {
      const exists = state.valueBacktest.picks.some(p =>
        String(p.matchId) === String(s.match.id) && p.pick === s.pick
      );
      if (!exists) {
        state.valueBacktest.picks.unshift({
          id: Date.now() + Math.random(),
          matchId: String(s.match.id),
          matchName: `${s.match.home} vs ${s.match.away}`,
          fixtureId: s.match.id,
          date: s.match.date || new Date().toLocaleDateString('nl-NL'),
          pick: s.pick, pickLabel: s.pickLabel,
          aiKans: s.kans, odds: s.odds, bookmaker: s.bookmaker,
          value: parseFloat(s.value.toFixed(1)),
          kelly: parseFloat((s.kelly||0).toFixed(1)),
          confidence: s.confidence || 5,
          reason: s.reason || '',
          status: 'pending', score: null,
          comp: s.match.comp || state.activeComp || '',
          scanDate: new Date().toLocaleString('nl-NL')
        });
        savedCount++;
      }
    });
    if (savedCount > 0) {
      saveState();
      showFirebaseStatus(`⚡ ${savedCount} value-pick${savedCount>1?'s':''} opgeslagen in Backtest`, '#00BEC4');
    }

    // Sla scan resultaten op
    state.lastScanResults = scans.map(s => ({
      matchId: s.match.id,
      home: s.match.home, away: s.match.away, comp: s.match.comp,
      pick: s.pick, pickLabel: s.pickLabel,
      value: s.value, confidence: s.confidence, odds: s.odds,
      reason: s.reason || '', kelly: s.kelly || 0,
      poissonUsed: s.poissonUsed || false
    }));
    saveState();

    // Update match cards met value badges
    state.matches.forEach(m => { m.valueData = null; });
    scans.forEach(s => {
      if (s.match && s.value >= 5) {
        s.match.valueData = { pct: s.value, pick: s.pick, pickLabel: s.pickLabel, kans: s.kans, odds: s.odds, kelly: s.kelly, confidence: s.confidence, poissonUsed: s.poissonUsed, reason: s.reason };
      }
    });

    // Render
    const displayScans = [...scans].sort((a,b) => (b.value||-999) - (a.value||-999)).filter(s => s.value >= 5);
    renderValueBannerInAnalyse(displayScans, scans.length);
    renderAnalyseScanResults(displayScans);
    renderMatches(state.matches);

    // Push notificaties
    if (state.settings.notifEnabled && !window._suppressScanPush) {
      const threshold = state.settings.notifThreshold || 15;
      const strong = scans.filter(s => s.value >= threshold && (s.confidence || 0) >= 6);

      if (strong.length > 0) {
        // Lokale notificatie (app open / PWA actief)
        if ('Notification' in window && Notification.permission === 'granted') {
          strong.slice(0, 3).forEach((s, i) => {
            setTimeout(() => {
              if (typeof sendValueNotification === 'function') sendValueNotification(s);
            }, i * 500);
          });
        }

        // OneSignal push (ook als app dicht) — beste pick sturen
        const top = strong[0];
        if (typeof sendOneSignalValuePush === 'function') {
          sendOneSignalValuePush(top);
        } else if (state.settings.notifPlayerId || state.oneSignalPlayerId) {
          // Fallback: stuur via Cloudflare Worker
          const pid = state.settings.notifPlayerId || state.oneSignalPlayerId;
          const body = `${top.match?.home||''} vs ${top.match?.away||''} · ${top.pickLabel} · odds ${(top.odds||0).toFixed(2)} · +${Math.round(top.value||0)}% value`;
          fetch('https://toto-ai.zweetzakken.workers.dev/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              player_id: pid,
              title: `⚡ ${strong.length} value pick${strong.length > 1 ? 's' : ''} gevonden`,
              body,
              data: { matchId: String(top.match?.id || ''), value: top.value }
            })
          }).catch(() => {});
        }
      }
    }

  } catch(e) {
    // v21.0: geen alert() meer — multiscan mag niet onderbroken worden door pop-ups
    // Toon subtiele toast i.p.v. blocking alert
    console.warn('[Scan] Value scan fout:', e.message);
    if (typeof showToast === 'function') {
      showToast('⚠ Scan fout: ' + e.message.substring(0, 60));
    }
  }

  window._scanBusy = false;
  if (btn) { btn.disabled = false; btn.textContent = '⚡ OPNIEUW SCANNEN'; }
}

function renderValueBannerInAnalyse(displayScans, total) {
  // v26.123: verberg picks op wedstrijden die al begonnen/afgelopen zijn (geen fantoom-picks)
  displayScans = (displayScans || []).filter(s => !matchHasStarted(s.match));
  const banners = [
    document.getElementById('valueBanner'),
    document.getElementById('valueBanner2')
  ].filter(Boolean);
  if (!banners.length) return;

  if (!displayScans?.length) {
    const emptyHtml = `<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.58rem;color:rgba(255,255,255,.95);padding:.8rem;text-align:center;">
      Geen value ≥5% gevonden in ${total} wedstrijden.<br>Bookmakers zitten goed in de markt vandaag.
      <button onclick="this.parentElement.parentElement.style.display='none'" style="background:none;border:none;color:rgba(255,255,255,.95);cursor:pointer;margin-left:.5rem;">✕</button>
    </div>`;
    banners.forEach(b => { b.style.display = 'block'; b.innerHTML = emptyHtml; });
    return;
  }

  const highCount = displayScans.filter(s => s.value >= 15).length;
  const medCount = displayScans.filter(s => s.value >= 5 && s.value < 15).length;
  const html = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.6rem .9rem;
      background:linear-gradient(135deg,rgba(0,190,196,.08),rgba(5,150,105,.05));
      border-bottom:1px solid rgba(0,190,196,.15);">
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.62rem;font-weight:800;color:#00BEC4;">⚡ VALUE SCAN</div>
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:rgba(255,255,255,.95);">
        <span style="color:#00BEC4;font-weight:700;">${highCount} sterk</span> · <span style="color:#b45309;font-weight:700;">${medCount} licht</span>
      </div>
    </div>
    ${displayScans.slice(0,6).map(s => {
      const cls = s.value >= 15 ? '#00BEC4' : '#b45309';
      const sign = s.value > 0 ? '+' : '';
      return `<div style="display:flex;align-items:center;padding:.55rem .9rem;border-bottom:1px solid rgba(255,255,255,0.09);cursor:pointer;" onclick="openValueAnalysis('${s.match.id}')">
        <div style="flex:1;">
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.6rem;font-weight:700;color:#ffffff;">${s.match.home} vs ${s.match.away}${s.sharp ? '<span style="font-size:.36rem;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);color:#ef4444;border-radius:4px;padding:1px 4px;margin-left:.3rem;font-weight:700;">🔥 SHARP</span>' : ''}</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:rgba(255,255,255,.95);">${s.pickLabel} · ${s.kans}%${s.poissonUsed?(s._hasXG?' (P+AI+xG)':' (P+AI)'):s._hasXG?' (xG)':''} · ${s.reason}</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:rgba(255,255,255,.95);">📊 ${s.bookmaker||''} · ½K ${(s.kelly||0).toFixed(1)}% · 🎲 ${s.confidence||'?'}/10</div>
        </div>
        <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.2rem;color:${cls};">${sign}${Math.round(s.value)}%</div>
        <div style="font-family:\'Bebas Neue\',sans-serif;font-size:.9rem;color:#00BEC4;margin-left:.5rem;">${(s.odds||0).toFixed(2)}</div>
      </div>`;
    }).join('')}
    <div style="padding:.4rem .9rem;text-align:right;">
      <button onclick="this.parentElement.parentElement.style.display='none'" style="background:none;border:none;color:rgba(255,255,255,.95);cursor:pointer;font-size:.9rem;">✕</button>
    </div>
  `;
  banners.forEach(b => { b.style.display = 'block'; b.innerHTML = html; });
}

function renderAnalyseScanResults(scans) {
  const el = document.getElementById('analyseScanResults');
  if (!el) return;
  if (!scans || !scans.length) { el.innerHTML = ''; return; }

  // Kwaliteitsdrempel voor de 100 picks
  const DREMPEL = { minValue: 8, minConf: 6 };
  // Poisson is een bonus maar niet verplicht — hoge value+conf telt altijd mee
  const teltMee  = scans.filter(s => {
    if (s.isSparseData) return false;
    if (s.value < DREMPEL.minValue) return false;
    if ((s.confidence||0) < DREMPEL.minConf) return false;
    // Bullshitfilter: exotische competities uitsluiten
    const leagueName = (s.comp || s.leagueName || '').toLowerCase();
    if (typeof EXOTIC_KEYWORDS !== 'undefined' && EXOTIC_KEYWORDS.some(k => leagueName.includes(k))) return false;
    return true;
  });
  const teltNiet = scans.filter(s =>  s.isSparseData || s.value <  DREMPEL.minValue || (s.confidence||0) <  DREMPEL.minConf);

  const renderPick = (s, geldig) => {
    const valColor = !geldig ? '#94a3b8' : s.value >= 15 ? '#00BEC4' : '#b45309';
    const sign = s.value > 0 ? '+' : '';
    const home = s.match?.home || s.home || '?';
    const away = s.match?.away || s.away || '?';
    const redenen = [];
    if (s.isSparseData) redenen.push('data schaars');
    if (s.value < DREMPEL.minValue) redenen.push(`value < ${DREMPEL.minValue}%`);
    if ((s.confidence||0) < DREMPEL.minConf) redenen.push(`conf < ${DREMPEL.minConf}/10`);
    // geen Poisson is geen reden meer voor afwijzing

    return `<div style="display:flex;align-items:center;padding:.5rem .9rem;
      border-bottom:1px solid rgba(255,255,255,0.09);cursor:pointer;
      ${!geldig ? 'opacity:.45;' : ''}"
      onclick="openValueAnalysis('${s.match?.id || s.id}')">
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:.4rem;">
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.62rem;
            font-weight:700;color:${geldig ? '#ffffff' : 'var(--sub)'};">${home} vs ${away}</div>
          ${!geldig ? `<span style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;
            background:rgba(148,163,184,.15);border:1px solid rgba(148,163,184,.3);
            color:#94a3b8;border-radius:4px;padding:.1rem .3rem;font-weight:700;">
            TELT NIET MEE</span>` : `<span style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;
            background:rgba(0,190,196,.1);border:1px solid rgba(0,190,196,.25);
            color:#00BEC4;border-radius:4px;padding:.1rem .3rem;font-weight:700;">✓ PICK</span>`}
          ${(function(){var mk=pickMarket(s.pick);return (mk.group!=='1X2'&&mk.label)?`<span style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;background:rgba(168,85,247,.14);border:1px solid rgba(168,85,247,.35);color:#c084fc;border-radius:4px;padding:.1rem .3rem;font-weight:700;">${mk.label.toUpperCase()}</span>`:'';})()}
        </div>
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:rgba(255,255,255,.95);">
          ${s.pickLabel} · ${s.kans||'?'}%${s.poissonUsed?(s._hasXG?' (P+AI+xG)':' (P+AI)'):s._hasXG?' (xG)':''} · ${s.reason||''}
        </div>
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:rgba(255,255,255,.95);">
          🎲 ${s.confidence||'?'}/10 · ½K ${(s.kelly||0).toFixed(1)}%
          ${s.sharp ? '<span style="font-size:.36rem;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);color:#ef4444;border-radius:4px;padding:1px 4px;font-weight:700;margin-left:.2rem;">🔥 SHARP' + (s.sharpMove ? ' ' + Math.abs(s.sharpMove||0).toFixed(1) + '%' : '') + '</span>' : ''}
          ${!geldig ? `· <span style="color:#94a3b8;">${redenen.join(', ')}</span>` : ''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.2rem;margin-left:.5rem;">
        <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.2rem;color:${valColor};">
          ${sign}${Math.round(s.value)}%
        </div>
        <div style="font-family:\'Bebas Neue\',sans-serif;font-size:.9rem;color:${geldig ? '#00BEC4' : '#94a3b8'};">
          ${(s.odds||0).toFixed(2)}
        </div>
      </div>
    </div>`;
  };

  const html = `
    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(0,190,196,.25);border-radius:14px;
      overflow:hidden;margin-bottom:.5rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;
        padding:.55rem .9rem;background:linear-gradient(135deg,rgba(0,190,196,.08),rgba(5,150,105,.05));
        border-bottom:1px solid rgba(0,190,196,.15);">
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.6rem;font-weight:800;color:#00BEC4;">
          ⚡ SCAN RESULTATEN · ${teltMee.length} picks <span style="color:rgba(255,255,255,.95);font-weight:400;">van ${scans.length}</span>
        </div>
        <button onclick="document.getElementById('analyseScanResults').innerHTML=''"
          style="background:none;border:none;color:rgba(255,255,255,.95);cursor:pointer;font-size:.85rem;">✕</button>
      </div>
      ${teltMee.map(s => renderPick(s, true)).join('')}
      ${teltNiet.length ? `
        <div style="padding:.35rem .9rem;font-family:\'IBM Plex Mono\',monospace;font-size:.48rem;
          color:rgba(255,255,255,.95);background:var(--card-bg,rgba(0,0,0,.03));border-top:1px solid rgba(255,255,255,0.09);">
          ONDER DREMPEL (value ≥8%, conf ≥6/10)
        </div>
        ${teltNiet.map(s => renderPick(s, false)).join('')}
      ` : ''}
    </div>`;
  el.innerHTML = html;
}

// ── Universele Card Pop-up ────────────────────────────────
function openCardPopup(type, data) {
  document.getElementById('cardPopupOverlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'cardPopupOverlay';
  overlay.style.cssText = `position:fixed;inset:0;z-index:9999;
    background:rgba(15,23,42,.65);backdrop-filter:blur(6px);
    display:flex;align-items:flex-end;justify-content:center;`;
  overlay.onclick = e => { if(e.target===overlay) overlay.remove(); };

  const close = `<button onclick="document.getElementById('cardPopupOverlay').remove()"
    style="background:var(--track-bg,rgba(0,0,0,.08));border:none;border-radius:50%;
    width:2rem;height:2rem;font-size:1rem;cursor:pointer;color:#ffffff;">✕</button>`;

  let content = '';

  if (type === 'scan') {
    const s = data;
    const valColor = (s.value||0) >= 15 ? '#00BEC4' : (s.value||0) >= 8 ? '#b45309' : '#64748b';
    const tvSign = (s.value||0) > 0 ? '+' : '';
    const confColor = (s.confidence||0) >= 8 ? '#00BEC4' : (s.confidence||0) >= 6 ? '#d97706' : '#dc2626';
    content = `
      <div style="font-family:\'DM Sans\',sans-serif;font-size:1.1rem;font-weight:800;color:#ffffff;margin-bottom:.2rem;">
        ${s.home||s.match?.home||'?'} vs ${s.away||s.match?.away||'?'}
      </div>
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:rgba(255,255,255,.95);margin-bottom:.85rem;">
        ${s.comp||''} · ${s.date||''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;margin-bottom:.85rem;">
        <div style="background:rgba(0,190,196,.1);border:1px solid rgba(0,190,196,.2);border-radius:12px;padding:.6rem;text-align:center;">
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:#00BEC4;font-weight:700;">PICK</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.58rem;font-weight:800;color:#00BEC4;margin-top:.2rem;">${s.pickLabel||s.pick||'?'}</div>
        </div>
        <div style="background:rgba(0,190,196,.1);border:1px solid rgba(0,190,196,.2);border-radius:12px;padding:.6rem;text-align:center;">
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:#00BEC4;font-weight:700;">ODDS</div>
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.35rem;color:#00BEC4;line-height:1;">${parseFloat(s.odds||0).toFixed(2)}</div>
        </div>
        <div style="background:rgba(${(s.value||0)>=8?'22,163,74':'180,83,9'},.1);border:1px solid rgba(${(s.value||0)>=8?'22,163,74':'180,83,9'},.2);border-radius:12px;padding:.6rem;text-align:center;">
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:${valColor};font-weight:700;">VALUE</div>
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.35rem;color:${valColor};line-height:1;">${tvSign}${Math.round(s.value||0)}%</div>
        </div>
      </div>
      <div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,0.09);border-radius:12px;padding:.65rem .85rem;margin-bottom:.75rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.35rem;">
          <span style="font-family:\'IBM Plex Mono\',monospace;font-size:.48rem;font-weight:800;color:rgba(255,255,255,.95);">🎯 CONFIDENCE</span>
          <span style="font-family:\'Bebas Neue\',sans-serif;font-size:1.1rem;color:${confColor};">${s.confidence||'?'}/10</span>
        </div>
        <div style="background:rgba(0,0,0,.08);border-radius:999px;height:7px;overflow:hidden;">
          <div style="background:${confColor};width:${Math.round((s.confidence||0)/10*100)}%;height:100%;border-radius:999px;"></div>
        </div>
        ${s.poissonUsed ? `<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:#00a8ad;margin-top:.3rem;">📐 Poisson + AI${s._hasXG?' + xG':''} model gebruikt</div>` : ''}
        ${s.isSparseData ? `<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:#dc2626;margin-top:.2rem;">⚠️ Data schaars</div>` : ''}
        ${typeof renderBullshitBadge === 'function' ? renderBullshitBadge({
          comp: s.comp, leagueName: s.leagueName, leagueId: s.leagueId,
          isSparseData: s.isSparseData, confidence: s.confidence,
          odds: s.odds, oddsMovement: s.oddsMovement
        }) : ''}
      </div>
      ${s.reason ? `<div style="background:rgba(255,255,255,.05);border-left:3px solid ${valColor};border-radius:0 12px 12px 0;padding:.65rem .85rem;margin-bottom:.75rem;font-size:.8rem;color:rgba(255,255,255,.95);line-height:1.7;">${s.reason}</div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;">
        <button onclick="document.getElementById('cardPopupOverlay').remove();openBetModal(null,'${s.match?.id||s.id||''}','${s.pick||''}','${(s.pickLabel||'').replace(/'/g,"\\'")}',${s.odds||2})"
          style="padding:.7rem;border-radius:12px;background:linear-gradient(135deg,rgba(0,190,196,.85),rgba(0,190,196,.6));color:#fff;border:none;font-family:\'IBM Plex Mono\',monospace;font-size:.62rem;font-weight:800;cursor:pointer;">💶 SINGLE BET</button>
        <button onclick="document.getElementById('cardPopupOverlay').remove();switchScreen('wedstrijden');setTimeout(()=>selectMatchAndAnalyse('${s.match?.id||s.id||''}'),100)"
          style="padding:.7rem;border-radius:12px;background:linear-gradient(135deg,rgba(0,190,196,.85),rgba(0,190,196,.6));color:#fff;border:none;font-family:\'IBM Plex Mono\',monospace;font-size:.62rem;font-weight:800;cursor:pointer;">🤖 ANALYSEER</button>
      </div>`;

  } else if (type === 'bet') {
    const b = data;
    const isOpen = b.status === 'pending' || b.status === 'open';
    const isWin = b.status === 'win';
    const pnl = isWin ? (b.stake*(b.odds-1)) : isOpen ? 0 : -(b.stake||0);
    const pnlColor = isWin ? '#00BEC4' : isOpen ? '#d97706' : '#dc2626';
    const statusLabel = isWin ? '✅ GEWONNEN' : isOpen ? '⏳ OPEN' : '❌ VERLOREN';
    content = `
      <div style="font-family:\'DM Sans\',sans-serif;font-size:1.1rem;font-weight:800;color:#ffffff;margin-bottom:.2rem;">${b.match||b.matchName||'?'}</div>
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:rgba(255,255,255,.95);margin-bottom:.85rem;">${b.date||''} · ${b.markt||'1X2'}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;margin-bottom:.85rem;">
        <div style="background:rgba(0,190,196,.08);border:1px solid rgba(0,190,196,.2);border-radius:12px;padding:.6rem;text-align:center;">
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:#00BEC4;font-weight:700;">PICK</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.58rem;font-weight:800;color:#00BEC4;margin-top:.2rem;">${b.pickLabel||b.pick||'?'}</div>
        </div>
        <div style="background:rgba(0,190,196,.08);border:1px solid rgba(0,190,196,.2);border-radius:12px;padding:.6rem;text-align:center;">
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:#00BEC4;font-weight:700;">INZET @ ODDS</div>
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1rem;color:#00BEC4;line-height:1.2;">€${b.stake||0} @ ${parseFloat(b.odds||0).toFixed(2)}</div>
        </div>
        <div style="background:rgba(${isWin?'22,163,74':isOpen?'180,83,9':'220,38,38'},.08);border:1px solid rgba(${isWin?'22,163,74':isOpen?'180,83,9':'220,38,38'},.2);border-radius:12px;padding:.6rem;text-align:center;">
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:${pnlColor};font-weight:700;">STATUS</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.56rem;font-weight:800;color:${pnlColor};margin-top:.2rem;">${statusLabel}</div>
        </div>
      </div>
      ${b.note ? `<div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,0.09);border-radius:10px;padding:.6rem .8rem;margin-bottom:.75rem;font-family:\'IBM Plex Mono\',monospace;font-size:.54rem;color:#ffffff;">📝 ${b.note}</div>` : ''}
      ${!isOpen ? `<div style="background:rgba(${isWin?'22,163,74':'220,38,38'},.08);border:1px solid rgba(${isWin?'22,163,74':'220,38,38'},.2);border-radius:12px;padding:.7rem;text-align:center;margin-bottom:.75rem;">
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:rgba(255,255,255,.95);">RESULTAAT</div>
        <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.6rem;color:${pnlColor};">${isWin?'+':''}€${Math.abs(pnl).toFixed(2)}</div>
      </div>` : ''}`;

  } else if (type === 'match') {
    const m = data;
    content = `
      <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.85rem;">
        ${m.homeLogo ? `<img src="${m.homeLogo}" style="width:2.5rem;height:2.5rem;object-fit:contain;">` : ''}
        <div style="flex:1;text-align:center;">
          <div style="font-family:\'DM Sans\',sans-serif;font-size:.95rem;font-weight:800;color:#ffffff;">${m.home} vs ${m.away}</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:rgba(255,255,255,.95);">${m.comp||''} · ${m.date||''} ${m.time||''}</div>
        </div>
        ${m.awayLogo ? `<img src="${m.awayLogo}" style="width:2.5rem;height:2.5rem;object-fit:contain;">` : ''}
      </div>
      ${m.homeOdds !== '—' ? `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;margin-bottom:.85rem;">
        <div style="background:rgba(0,190,196,.08);border:1px solid rgba(0,190,196,.2);border-radius:12px;padding:.65rem;text-align:center;">
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:rgba(255,255,255,.95);font-weight:700;">1 THUIS</div>
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.4rem;color:#00BEC4;">${m.homeOdds}</div>
        </div>
        <div style="background:rgba(180,83,9,.08);border:1px solid rgba(180,83,9,.2);border-radius:12px;padding:.65rem;text-align:center;">
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:rgba(255,255,255,.95);font-weight:700;">X GELIJK</div>
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.4rem;color:#b45309;">${m.drawOdds}</div>
        </div>
        <div style="background:rgba(220,38,38,.08);border:1px solid rgba(220,38,38,.2);border-radius:12px;padding:.65rem;text-align:center;">
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:rgba(255,255,255,.95);font-weight:700;">2 UIT</div>
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.4rem;color:#dc2626;">${m.awayOdds}</div>
        </div>
      </div>` : `<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.54rem;color:rgba(255,255,255,.95);text-align:center;padding:.75rem;margin-bottom:.75rem;">Geen odds beschikbaar</div>`}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;">
        <button onclick="document.getElementById('cardPopupOverlay').remove();selectMatchAndAnalyse('${m.id}')"
          style="padding:.7rem;border-radius:12px;background:linear-gradient(135deg,rgba(0,190,196,.85),rgba(0,190,196,.6));color:#fff;border:none;font-family:\'IBM Plex Mono\',monospace;font-size:.62rem;font-weight:800;cursor:pointer;">🤖 ANALYSEER</button>
        <button onclick="document.getElementById('cardPopupOverlay').remove();addValuePickToCombi('${m.id}','1','${(m.home||'').replace(/'/g,"\\'")} wint',${m.homeOdds||2},'${(m.home||'').replace(/'/g,"\\'")}','${(m.away||'').replace(/'/g,"\\'")}')"
          style="padding:.7rem;border-radius:12px;background:linear-gradient(135deg,rgba(0,190,196,.85),rgba(0,190,196,.6));color:#fff;border:none;font-family:\'IBM Plex Mono\',monospace;font-size:.62rem;font-weight:800;cursor:pointer;">➕ COMBI</button>
      </div>`;
  }

  overlay.innerHTML = `
    <div style="width:100%;max-width:520px;max-height:92vh;overflow-y:auto;
      background:var(--sheet-bg,#0d1e24);
      border-radius:24px 24px 0 0;padding:1.2rem 1.1rem 2rem;
      box-shadow:0 -8px 40px rgba(15,23,42,.2);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.9rem;">
        <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.2rem;
          background:linear-gradient(135deg,#00BEC4,#00a8ad);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;">
          ${type==='scan'?'VALUE PICK':type==='bet'?'BET DETAILS':type==='match'?'WEDSTRIJD':'TIP'}
        </div>
        ${close}
      </div>
      ${content}
    </div>`;

  document.body.appendChild(overlay);
}

function openValueAnalysis(matchId) {
  // Eerst zoeken in valueScans voor pop-up
  const scan = (state.valueScans||[]).find(s =>
    String(s.match?.id||s.id) === String(matchId)
  );
  if (scan) {
    openCardPopup('scan', scan);
    return;
  }
  // Fallback: navigeer naar analyse tab
  const match = (state.matches||[]).find(m => String(m.id) === String(matchId));
  if (match) selectMatch(match);
  switchScreen('analyse');
  setTimeout(() => showAnalyseSubTab('analyse'), 80);
}

// ── AI diepte analyse ─────────────────────────────────────
function buildModelVsMarktHTML(poisson, m) {
  const oH = parseFloat(m.homeOdds), oD = parseFloat(m.drawOdds), oA = parseFloat(m.awayOdds);
  if (!poisson || !poisson.valid || !(oH > 1 && oD > 1 && oA > 1)) return '';
  const rawH = 1/oH, rawD = 1/oD, rawA = 1/oA, s = rawH + rawD + rawA;
  const rows = [
    ['1', `${m.home} wint`, poisson.k1, rawH/s*100],
    ['X', 'Gelijkspel',     poisson.kX, rawD/s*100],
    ['2', `${m.away} wint`, poisson.k2, rawA/s*100],
  ];
  const body = rows.map(r => {
    const model = Number(r[2]), markt = Number(r[3]), diff = model - markt, pos = diff >= 0;
    const kleur = Math.abs(diff) >= 5 ? (pos ? '#16c784' : '#dc2626') : 'rgba(255,255,255,.7)';
    return `<div style="display:flex;justify-content:space-between;gap:.5rem;padding:.22rem 0;font-family:'IBM Plex Mono',monospace;font-size:.6rem;"><span style="color:#fff;">${r[0]} ${r[1]}</span><span style="color:rgba(255,255,255,.88);white-space:nowrap;">model ${model.toFixed(0)}% \u00b7 markt ${markt.toFixed(0)}% \u00b7 <span style="color:${kleur};font-weight:700;">${pos?'+':''}${diff.toFixed(1)}pp</span></span></div>`;
  }).join('');
  // v26.146: doelpunten-markten (model) — O/U 1.5/2.5/3.5 + BTTS uit lambdaHome/lambdaAway
  let goalsHTML = '';
  const gm = (typeof goalMarketProbs === 'function') ? goalMarketProbs(poisson.lambdaHome, poisson.lambdaAway) : null;
  if (gm) {
    const expG = (Number(poisson.lambdaHome) + Number(poisson.lambdaAway)).toFixed(1);
    const grow = (lab, o, u) => `<div style="display:flex;justify-content:space-between;gap:.5rem;padding:.2rem 0;font-family:'IBM Plex Mono',monospace;font-size:.58rem;"><span style="color:#fff;">${lab}</span><span style="color:rgba(255,255,255,.88);">Over <b style="color:#c084fc;">${o}%</b> \u00b7 Under <b style="color:#c084fc;">${u}%</b></span></div>`;
    goalsHTML = `<div style="margin-top:.6rem;padding-top:.5rem;border-top:1px solid rgba(255,255,255,.09);">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:rgba(255,255,255,.62);letter-spacing:.07em;margin-bottom:.3rem;">\u26bd DOELPUNTEN \u2014 model (verw. ${expG} goals)</div>
      ${grow('Over/Under 1.5', gm.o15, gm.u15)}${grow('Over/Under 2.5', gm.o25, gm.u25)}${grow('Over/Under 3.5', gm.o35, gm.u35)}
      <div style="display:flex;justify-content:space-between;gap:.5rem;padding:.2rem 0;font-family:'IBM Plex Mono',monospace;font-size:.58rem;"><span style="color:#fff;">Beide teams scoren</span><span style="color:rgba(255,255,255,.88);">Ja <b style="color:#c084fc;">${gm.bttsY}%</b> \u00b7 Nee <b style="color:#c084fc;">${gm.bttsN}%</b></span></div>
      <div style="font-size:.5rem;color:rgba(255,255,255,.5);margin-top:.3rem;line-height:1.5;">Modelkans uit verwachte goals \u00b7 value op deze markten verschijnt als de scan ze als pick selecteert</div>
    </div>`;
  }
  return `<div style="margin-top:.6rem;padding-top:.5rem;border-top:1px solid rgba(255,255,255,.09);"><div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:rgba(255,255,255,.62);letter-spacing:.07em;margin-bottom:.3rem;">\ud83d\udcd0 MODEL vs MARKT (vig eruit)</div>${body}<div style="font-size:.55rem;color:rgba(255,255,255,.62);margin-top:.35rem;line-height:1.5;">+pp = model hoger dan markt (mogelijk value) \u00b7 \u2212pp = lager (geen value op die uitkomst)</div>${goalsHTML}</div>`;
}

async function runAnalyse() {
  const m = state.selectedMatch;
  if (!m) { alert('Selecteer eerst een wedstrijd'); return; }

  const btn = document.getElementById('analyseBtn');
  const output = document.getElementById('analyseOutput');
  if (btn) { btn.disabled = true; btn.textContent = '⟳ ANALYSEREN...'; }
  if (output) output.style.display = 'block';

  // Entity chips aanmaken
  const chipContainer = document.getElementById('entityChips');
  const sections = ['vorm','stats','tactiek','kans','risico','advies','tip'];
  if (chipContainer) {
    chipContainer.innerHTML = sections.map(s => `<span class="entity-chip" id="ec-${s}">⏳ ${s}</span>`).join('');
  }

  const fill = (id, html) => {
    const el = document.getElementById('rb-' + id);
    if (el) el.innerHTML = html || '';
    const chip = document.getElementById('ec-' + id);
    if (chip) chip.className = 'entity-chip done';
  };

  try {
    if (btn) btn.textContent = '⟳ DATA OPHALEN...';
    const leagueId = m.leagueId || COMP_IDS[state.activeComp];
    const wt = (p, ms=5000) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);

    const [h2h, homeForm, awayForm, hStats, aStats, lineups, injuries, standings, predictions] = await Promise.all([
      wt(fetchH2H(m.homeId, m.awayId), 5000),
      wt(fetchTeamForm(m.homeId), 5000),
      wt(fetchTeamForm(m.awayId), 5000),
      wt(fetchTeamStats(m.homeId, leagueId || 88), 5000),
      wt(fetchTeamStats(m.awayId, leagueId || 88), 5000),
      wt(fetchLineups(m.id), 4000),
      wt(fetchInjuries(m.id), 3000),
      wt(fetchStandings(leagueId || m.leagueId, null), 4000),
      wt(fetchPredictions(m.id), 5000),
    ]);

    // v18.9: xG ophalen uit fixture statistics voor betere Poisson
    const [homeXG, awayXG] = await Promise.all([
      wt(typeof fetchXGFromFixtures === 'function' ? fetchXGFromFixtures(m.homeId, homeForm) : Promise.resolve([]), 5000),
      wt(typeof fetchXGFromFixtures === 'function' ? fetchXGFromFixtures(m.awayId, awayForm) : Promise.resolve([]), 5000),
    ]);

    // Poisson met xG
    const homeGoalStats = hStats ? extractTeamGoalStats(hStats, homeForm, homeXG||[]) : null;
    const awayGoalStats = aStats ? extractTeamGoalStats(aStats, awayForm, awayXG||[]) : null;
    const poisson = calcPoissonKansen(homeGoalStats, awayGoalStats, leagueId || 1.35);

    if (btn) btn.textContent = '⟳ AI ANALYSE...';

    const h2hStr = h2h?.length ? formatH2HCompact(h2h.slice(0,5), m.home, m.away) : 'geen data';
    const homeFormStr = homeForm?.length ? formatFormCompact(homeForm.slice(0,5), m.homeId, m.home) : 'geen data';
    const awayFormStr = awayForm?.length ? formatFormCompact(awayForm.slice(0,5), m.awayId, m.away) : 'geen data';
    const poissonStr = poisson.valid ? `Poisson: 1=${poisson.k1}% X=${poisson.kX}% 2=${poisson.k2}%${poisson.injLabel||''}` : 'geen statdata';
    const formationStr = lineups?.length ? `${lineups[0]?.team?.name||m.home}: ${lineups[0]?.formation||'?'} vs ${lineups[1]?.team?.name||m.away}: ${lineups[1]?.formation||'?'}` : 'nog niet bekend';

    // Blessure context
    const homeInj = injuries ? calcInjuryFactor(injuries, m.homeId) : null;
    const awayInj  = injuries ? calcInjuryFactor(injuries, m.awayId)  : null;
    const injStr = [
      homeInj?.count ? `${m.home} blessures: ${homeInj.players.join(', ')} (aanval -${Math.round((1-homeInj.attackFactor)*100)}%, verdediging -${Math.round((1-homeInj.defenseFactor)*100)}%)` : '',
      awayInj?.count  ? `${m.away} blessures: ${awayInj.players.join(', ')} (aanval -${Math.round((1-awayInj.attackFactor)*100)}%, verdediging -${Math.round((1-awayInj.defenseFactor)*100)}%)` : ''
    ].filter(Boolean).join('\n') || 'geen bekende blessures';

    // Stand context
    const homeStand = standings ? extractStandingInfo(standings, m.homeId) : null;
    const awayStand  = standings ? extractStandingInfo(standings, m.awayId)  : null;
    const standStr = [
      homeStand ? `${m.home}: pos ${homeStand.pos}/${homeStand.total}, ${homeStand.pts}pt, GD ${homeStand.gd>0?'+':''}${homeStand.gd}${homeStand.motivatieLabel?' ('+homeStand.motivatieLabel+')':''}` : '',
      awayStand  ? `${m.away}: pos ${awayStand.pos}/${awayStand.total}, ${awayStand.pts}pt, GD ${awayStand.gd>0?'+':''}${awayStand.gd}${awayStand.motivatieLabel?' ('+awayStand.motivatieLabel+')':''}` : ''
    ].filter(Boolean).join('\n') || 'stand niet beschikbaar';

    // Gewogen H2H
    const h2hW = h2h?.length ? calcWeightedH2H(h2h, m.homeId, m.awayId) : null;
    const h2hWStr = h2hW ? `Gewogen H2H (${h2hW.count} duels): thuis ${h2hW.homeWinPct}% / gelijk ${h2hW.drawPct}% / uit ${h2hW.awayWinPct}%` : '';

    // Competitie fase
    const phase = getCompetitionPhase(homeStand?.played || 0);

    // Predictions context
    const predStr = predictions ? formatPredictions(predictions, m.home, m.away) : '';

    const context = `Wedstrijd: ${m.home} vs ${m.away}
Competitie: ${m.comp} | ${m.date} ${m.time} | Fase: ${phase.label||'normaal'}
Quotes: 1=${m.homeOdds} X=${m.drawOdds} 2=${m.awayOdds}
${poissonStr}
Vorm ${m.home}: ${homeFormStr}
Vorm ${m.away}: ${awayFormStr}
H2H: ${h2hStr}
${h2hWStr}
Standen: ${standStr}
Blessures: ${injStr}
Formaties: ${formationStr}${predStr ? '\n\nAPI PREDICTIONS:\n' + predStr : ''}`;

    const data = await anthropicFetchWithRetry(null, {
      model: 'claude-sonnet-4-6',
      max_tokens: 1800,
      system: `Je bent een kritische, conservatieve voetbalanalist voor een bettingadvies app. JSON only, geen tekst buiten JSON.

KERNREGEL — GEEN SPECULATIE:
- Als data onvoldoende is: geef confidence MAX 4 en vermeld expliciet waarom
- Verzin NOOIT statistieken of cijfers die niet in de context staan
- Bij twijfel: wees eerlijk over de onzekerheid, geef GEEN sterke pick
- Liever geen pick dan een slechte pick — bij confidence < 5 geef je geen waarde-advies

BESCHIKBARE DATA ANKERS (gebruik ALLEEN wat aanwezig is in de context):
1. Poisson model (eigen berekening op doelpuntengemiddelden + xG)
2. API Predictions (onafhankelijk model van API-Football — alleen als aanwezig)
3. Vorm, H2H, standen, blessures, formaties — alleen als aanwezig

WEGING: als Poisson + API pred beschikbaar → elk 35% + context 30%. Als alleen Poisson → 50% + context 50%.
CONVERGENTIE: meerdere ankers wijzen dezelfde kant → hogere confidence.
DIVERGENTIE: Poisson en API pred wijken sterk af (>12pp) → confidence MAX 5, vermeld conflict.
DUNNE DATA: minder dan 3 H2H wedstrijden of minder dan 5 recente wedstrijden per team → confidence MAX 6.

JSON STRUCTUUR:
{"vorm":"2-3 zinnen recente prestaties BEIDE teams met ALLEEN cijfers uit de context — verzin niets","stats":"2-3 zinnen statistieken + Poisson kansen + API pred kansen als beschikbaar","tactiek":"2 zinnen speelstijl en formaties — alleen als bekend","kans":"2 zinnen kansberekening op basis van ALLEEN beschikbare data","risico":"1-2 zinnen concrete risicofactoren inclusief databeperkingen",
"advies":"1-2 zinnen eerlijk advies — bij weinig data expliciet vermelden dat pick onzeker is",
"tip":{"pick":"1","pickLabel":"${m.home} wint","markt":"Uitslag","odds":${m.homeOdds||2},"kans":55,"sterren":3,"confidence":6,"confidenceReden":"1 zin: EERLIJKE beoordeling databeschikbaarheid + signaalconsistentie — noem beperkingen","redenering":"3-4 zinnen onderbouwing met ALLEEN cijfers die in de context staan",
"tips":[{"pick":"O2.5","pickLabel":"Meer dan 2.5 goals","markt":"Doelpunten","odds":1.8,"kans":58,"reden":"concreet statistisch argument uit de data"},{"pick":"X","pickLabel":"Gelijkspel","markt":"Uitslag","odds":${m.drawOdds||3.5},"kans":26,"reden":"concreet argument uit de data"}]}}

KWALITEITSREGELS:
- Noem teams altijd bij naam, nooit "thuisploeg"
- Gebruik ALLEEN specifieke cijfers die in de context staan — NOOIT verzinnen
- kans = gecombineerde schatting NA overround-correctie van de bookmaker
- confidence: 8-10 = meerdere ankers bevestigen + rijke data; 6-7 = redelijke data; 1-5 = schaars/conflicterend/dunne data
- Bij confidence < 5: sterren MAX 2, vermeld in redenering dat data onvoldoende is
- tips array: alleen invullen met concrete statistische basis — geen speculatieve alternatieven`,
      messages:[{role:'user',content:`Analyseer:\n${context}`}]
    });

    if (data.error) throw new Error(data.error.message || 'API fout');
    let raw = data.content?.[0]?.text?.trim();
    if (!raw) throw new Error('Lege response');
    const js = raw.indexOf('{'), je = raw.lastIndexOf('}');
    if (js < 0 || je < js) throw new Error('Geen JSON: ' + raw.substring(0,50));
    const result = JSON.parse(raw.substring(js, je + 1));

    const sectionCard = (icon, title, content, color) => `
      <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);border-radius:12px;padding:.8rem .9rem;margin-bottom:.6rem;">
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:800;
          color:${color||'var(--sub)'};letter-spacing:.07em;margin-bottom:.4rem;">${icon} ${title}</div>
        <div style="font-size:.82rem;line-height:1.7;color:#ffffff;">${content}</div>
      </div>`;

    fill('vorm',    sectionCard('⚡', 'VORM', result.vorm || '—', '#2563eb'));
    const predBadge = predictions?.advice
      ? `<br><span style="font-family:monospace;font-size:.5rem;color:#2563eb;">💡 API: ${predictions.advice}${predictions.percent?.home !== null ? ` · ${predictions.percent.home}%/${predictions.percent.draw}%/${predictions.percent.away}%` : ''}</span>`
      : '';
    fill('stats',   sectionCard('📊', 'STATS', (result.stats||'—') + (poisson.valid ? `<br><span style="font-family:monospace;font-size:.5rem;color:#00a8ad;">📐 ${poissonStr}</span>` : '') + predBadge, '#00a8ad'));
    fill('tactiek', sectionCard('⚔️', 'TACTIEK & FORMATIES', result.tactiek || '—', '#d97706'));
    const _mvm = (typeof buildModelVsMarktHTML === 'function') ? buildModelVsMarktHTML(poisson, m) : '';
    fill('kans',    sectionCard('🎯', 'KANSEN', (result.kans || '—') + _mvm, '#00BEC4'));
    fill('risico',  sectionCard('⚠️', 'RISICO', result.risico || '—', '#dc2626'));
    fill('advies',  sectionCard('💡', 'ADVIES', result.advies || '—', '#00BEC4'));

    // Tip sectie
    const tip = result.tip;
    if (tip && tip.pick) {
      state.lastAnalyseTip = { ...tip, matchId: m.id, home: m.home, away: m.away };
      const tv = calcValue(tip.kans, parseFloat(tip.odds));
      const tvColor = tv >= 15 ? '#00BEC4' : tv >= 5 ? '#b45309' : '#64748b';
      const kleur = tip.kans >= 70 ? '#00BEC4' : tip.kans >= 55 ? '#d97706' : '#dc2626';
      const conf = tip.confidence || 5;
      const confKleur = conf >= 8 ? '#00BEC4' : conf >= 6 ? '#d97706' : '#dc2626';
      const sterren = '⭐'.repeat(Math.min(tip.sterren||3, 5)) + '☆'.repeat(5 - Math.min(tip.sterren||3, 5));

      document.getElementById('rb-tip').innerHTML = `
        <div style="background:linear-gradient(135deg,rgba(0,190,196,.06),rgba(0,190,196,.06));
          border:1px solid rgba(0,190,196,.15);border-radius:14px;padding:.9rem;margin-bottom:.6rem;">
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:#00BEC4;font-weight:700;letter-spacing:.05em;margin-bottom:.4rem;">🏆 BESTE TIP · ${tip.markt||'Uitslag'}</div>
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.5rem;color:#ffffff;margin-bottom:.3rem;">${tip.pick} — ${tip.pickLabel}</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.62rem;color:#374151;margin-bottom:.5rem;">Quote: <b>${tip.odds}</b> &nbsp;·&nbsp; ${sterren}</div>
          ${tv !== null ? `
          <div style="display:flex;justify-content:space-between;align-items:center;background:${tv>=5?'rgba(0,190,196,.08)':'rgba(100,116,139,.05)'};
            border:1px solid ${tv>=5?'rgba(0,190,196,.2)':'var(--track-bg,rgba(0,0,0,.08))'};border-radius:9px;padding:.5rem .7rem;margin-bottom:.6rem;">
            <div>
              <div style="font-family:monospace;font-size:.52rem;color:rgba(255,255,255,.95);font-weight:700;">⚡ VALUE</div>
              <div style="font-family:monospace;font-size:.5rem;color:rgba(255,255,255,.95);">${tip.kans}% × ${tip.odds}</div>
            </div>
            <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.8rem;color:${tvColor};">${tv>0?'+':''}${tv.toFixed(1)}%</div>
          </div>` : ''}
          <div style="margin-bottom:.6rem;">
            <div style="font-family:monospace;font-size:.52rem;color:#374151;margin-bottom:.3rem;display:flex;justify-content:space-between;">
              <span>KANS</span><span style="color:${kleur};font-weight:700;">${tip.kans}%</span>
            </div>
            <div style="background:rgba(0,0,0,.07);border-radius:999px;height:10px;overflow:hidden;">
              <div style="background:${kleur};width:${Math.min(100,tip.kans)}%;height:100%;border-radius:999px;"></div>
            </div>
          </div>
          <div style="font-size:.8rem;line-height:1.7;color:rgba(255,255,255,.95);margin-bottom:.6rem;padding:.6rem .7rem;
            background:rgba(255,255,255,.07);border-radius:8px;">${tip.redenering||'—'}</div>
          <div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,0.09);border-radius:9px;padding:.6rem .7rem;margin-bottom:.6rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.25rem;">
              <span style="font-family:monospace;font-size:.52rem;font-weight:700;color:#475569;">🎯 CONFIDENCE</span>
              <span style="font-family:\'Bebas Neue\',sans-serif;font-size:1.1rem;color:${confKleur};">${conf}/10</span>
            </div>
            <div style="background:rgba(0,0,0,.07);border-radius:999px;height:7px;overflow:hidden;">
              <div style="background:${confKleur};width:${Math.round(conf/10*100)}%;height:100%;"></div>
            </div>
            ${tip.confidenceReden ? `<div style="font-size:.7rem;color:#64748b;font-style:italic;margin-top:.3rem;">${tip.confidenceReden}</div>` : ''}
          </div>
          <div style="display:flex;gap:.4rem;">
            <button onclick="openBetModal(null,'${m.id}','${tip.pick}','${(tip.pickLabel||'').replace(/'/g,"\\'")}',${tip.odds})"
              style="flex:1;padding:.45rem;border-radius:10px;background:rgba(0,190,196,.12);
              border:1px solid rgba(0,190,196,.3);font-family:monospace;font-size:.58rem;font-weight:700;
              color:#00BEC4;cursor:pointer;">💶 SINGLE BET</button>
            <button onclick="addValuePickToCombi('${m.id}','${tip.pick}','${(tip.pickLabel||'').replace(/'/g,"\\'")}',${tip.odds},'${(m.home||'').replace(/'/g,"\\'")}','${(m.away||'').replace(/'/g,"\\'")}')"
              style="flex:1;padding:.45rem;border-radius:10px;background:rgba(0,190,196,.1);
              border:1px solid rgba(0,190,196,.25);font-family:monospace;font-size:.58rem;font-weight:700;
              color:#00a8ad;cursor:pointer;">➕ COMBI</button>
          </div>
        </div>`;
      const chip = document.getElementById('ec-tip');
      if (chip) chip.className = 'entity-chip done';

      const chatBtn = document.getElementById('openChatBtn');
      if (chatBtn) chatBtn.style.display = 'block';

      state._lastAnalyseContext = context;
      state._lastAnalyseResult = result;
    }

  } catch(e) {
    sections.forEach(id => {
      const el = document.getElementById('rb-' + id);
      if (el && !el.innerHTML) el.innerHTML = `<div style="font-family:monospace;font-size:.58rem;color:#dc2626;">⚠ ${e.message}</div>`;
      const chip = document.getElementById('ec-' + id);
      if (chip) chip.className = 'entity-chip err';
    });
  }

  if (btn) { btn.disabled = false; btn.textContent = '⚽ ANALYSEER OPNIEUW'; }
}

// ── Scannen alle comp vandaag ─────────────────────────────
async function scanAllTodayValue(mode = 'today') {
  const btnId = mode === '3days' ? 'scan3DaysBtn' : mode === 'tomorrow' ? 'scanTomorrowBtn' : 'scanAllTodayBtn';
  const btnContainer = document.getElementById(btnId);
  const btn = btnContainer?.querySelector('button') || btnContainer;
  const origText = btn?.textContent || '⚡ SCAN';

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
  const day3Str = new Date(now.getTime() + 2*86400000).toISOString().split('T')[0]; // v26.108: 3-dagen-scan

  // Laad alle competities als state.matches te weinig wedstrijden heeft
  const currentWithOdds = (state.matches||[]).filter(m =>
    m.homeOdds !== '—' && !m.isDone && parseFloat(m.homeOdds) > 1
  );

  if (currentWithOdds.length < 5) {
    if (btn) { btn.disabled = true; btn.textContent = '⟳ ALLE COMPS LADEN...'; }

    // Laad alle competities parallel — volledige scan lijst
    const SCAN_LEAGUE_IDS = [
      // Standaard app comps
      88, 89, 78, 39, 61, 135, 2, 3, 848, 144, 140, 40, 79, 203, 5,
      // Extra comps voor bredere coverage
      94, 179, 218, 207, 119, 103, 113, 197, 106, 283, 345,
      32, 34, 36, 1,
      10, 6, 29,      // International Friendlies, WK kwal CONMEBOL, WK kwal Afrika
    ];
    const allMatches = [];
    const seen = new Set();

    await Promise.all(SCAN_LEAGUE_IDS.map(async leagueId => {
      try {
        const season = seasonForLeague(leagueId);
        // v26.108: 3-dagen-scan haalt een datumrange op (vandaag t/m +2)
        const dateQ = mode === '3days' ? `from=${todayStr}&to=${day3Str}`
                    : mode === 'tomorrow' ? `date=${tomorrowStr}`
                    : `date=${todayStr}`;
        const r = await apiFetch(
          `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${season}&${dateQ}&status=NS-1H-HT-2H`,
          null, 8000
        );
        const d = await r.json();
        (d.response || []).forEach(f => {
          const m = parseAPIMatch(f);
          if (m && !seen.has(m.id)) {
            seen.add(m.id);
            allMatches.push(m);
          }
        });
      } catch(e) {}
    }));

    if (allMatches.length > 0) {
      // Haal odds op voor gevonden wedstrijden
      if (btn) btn.textContent = `⟳ ODDS OPHALEN (${allMatches.length})...`;
      try {
        await fetchOddsForAllMatches(allMatches, null);
      } catch(e) {}
      // Voeg toe aan state.matches (dedupliceer)
      const existingIds = new Set((state.matches||[]).map(m => m.id));
      allMatches.forEach(m => { if (!existingIds.has(m.id)) state.matches.push(m); });
    }
  }

  // Ruimere scan leagues — ook internationale/vriendschappelijke wedstrijden
  const WIDE_SCAN_LEAGUES = new Set([
    1,2,3,4,5,6,10,29,32,34,36,39,40,61,71,78,79,88,89,94,98,103,106,
    113,119,129,135,140,144,179,197,203,207,218,239,253,283,292,345,848
  ]);
  const allWithOdds = (state.matches||[]).filter(m => {
    if (m.homeOdds === '—' || m.isDone || !(parseFloat(m.homeOdds) > 1)) return false;
    // Accepteer alle bekende leagues — niet beperken tot alleen COMP_IDS
    return true;
  });

  let candidates;
  if (mode === '3days') {
    const win = new Set([todayStr, tomorrowStr, day3Str]);
    candidates = allWithOdds.filter(m => { const d = m.dateISO||''; return !d || win.has(d); })
      .sort((a,b) => (a.dateISO||'').localeCompare(b.dateISO||''));
    if (!candidates.length) candidates = allWithOdds.slice(0, 25);
  } else if (mode === 'tomorrow') {
    candidates = allWithOdds.filter(m => { const d = m.dateISO||''; return !d || d === todayStr || d === tomorrowStr; });
    if (!candidates.length) candidates = allWithOdds.slice(0, 25);
  } else {
    const byDate = allWithOdds.filter(m => m.dateISO === todayStr);
    candidates = byDate.length ? byDate : allWithOdds.filter(m => !m.dateISO).concat(byDate);
    if (!candidates.length) candidates = allWithOdds.slice(0, 20);
  }
  const scanCap = mode === '3days' ? 50 : 25; // v26.110: 3-dagen-scan hogere cap
  candidates = candidates.slice(0, scanCap);

  if (!candidates.length) {
    if (btn) { btn.disabled = false; btn.textContent = origText; }
    showToast('Geen wedstrijden met quotes gevonden voor vandaag.');
    return;
  }

  // v26.111: 3-dagen-scan toont eerst de matches + SCAN VALUE-knop (net als 'vandaag').
  // De SCAN VALUE-knop scant daarna ALLE matches in batches via scanValueBatched().
  if (mode === '3days') {
    state.matches = candidates;
    if (typeof renderMatches === 'function') renderMatches(state.matches);
    if (btn) { btn.disabled = false; btn.textContent = origText; }
    if (typeof showToast === 'function') showToast(`${candidates.length} wedstrijden geladen — druk onderin op ⚡ SCAN VALUE`);
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = `⟳ ANALYSEREN (${candidates.length})...`; }

  // Bewaar gescande matches zodat teamnamen zichtbaar blijven
  state.matches = candidates;
  // v21.0: silent=true — geen blocking alerts tijdens multiscan
  try {
    await scanValueAll(true);
  } catch(e) {
    console.error('[ScanVandaag] onderbroken:', e);
    showToast('⚠ Scan onderbroken — ' + (e && e.message ? e.message : 'onbekende fout'));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = origText; }
  }
}

// ── Combi Tips ────────────────────────────────────────────
async function generateCombiTip() {
  const btn = document.getElementById('combiGenBtn');
  if (!btn) return;
  btn.disabled = true; btn.textContent = '⟳ BEREKENEN...';

  const allMatches = (state.matches||[]).filter(m => !m.isDone);

  // Blokkeer alleen als er noch geladen wedstrijden noch eerdere value-scans zijn
  if (!allMatches.length && !(state.valueScans||[]).length) {
    const card = document.getElementById('combiCard');
    if (card) {
      card.innerHTML = `<div style="text-align:center;padding:1.5rem;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);border-radius:14px;">
        <div style="font-size:1.8rem;margin-bottom:.5rem;">⚽</div>
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.62rem;font-weight:800;color:#ffffff;margin-bottom:.4rem;">GEEN WEDSTRIJDEN GELADEN</div>
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.54rem;color:rgba(255,255,255,.95);margin-bottom:.8rem;line-height:1.6;">Laad eerst wedstrijden via het Wedstrijden tabblad om combi tips te genereren.</div>
        <button onclick="switchScreen('wedstrijden')" style="padding:.55rem 1.2rem;border-radius:10px;background:linear-gradient(135deg,rgba(0,190,196,.85),rgba(0,190,196,.8));color:#fff;border:none;font-family:\'IBM Plex Mono\',monospace;font-size:.62rem;font-weight:800;cursor:pointer;">⚽ Naar Wedstrijden →</button>
      </div>`;
      card.style.display = 'block';
    }
    btn.disabled = false; btn.textContent = '⚡ GENEREER TOP 3 TIPS + COMBI';
    return;
  }

  // v26.37: kandidaten = value-picks uit de scan-engine (consistent met de scan-log + WK-hardening).
  // Niet langer een losse selectie over alle odds; Claude kiest straks UITSLUITEND uit deze picks.
  const _todayStr = new Date().toISOString().split('T')[0];
  const _tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const _byMatch = {};

  (state.valueScans || []).forEach(s => {
    if (!s || !s.match || !s.pick || s.pick === 'X') return;       // geen gelijkspelen in combi
    if (parseFloat(s.odds) < 1.40 || parseFloat(s.odds) > 6.00) return; // odds range
    if (!(s.value > 0)) return;
    const d = s.match.dateISO || s.match.date || '';
    // v138: alleen vandaag + morgen (niet overmorgen of verder) — combi moet speelbaar zijn
    if (d && d < _todayStr) return;
    if (d && d > _tomorrowStr) return;
    const k = String(s.match.id);
    // v138: houd per fixture alleen beste pick (hoogste conf × value)
    const score = (s.confidence || 0) * (s.value || 0);
    const prevScore = _byMatch[k] ? (_byMatch[k].confidence || 0) * (_byMatch[k].value || 0) : -1;
    if (!_byMatch[k] || score > prevScore) _byMatch[k] = s;
  });

  // v138: verwijder fixtures waar de ene pick de andere tegenspreekt
  // (kan niet meer voorkomen na worker fix, maar veiligheidsnet)
  const _fixtureIds = Object.keys(_byMatch);
  _fixtureIds.forEach(k => {
    const pick = _byMatch[k].pick;
    const conflicts = _fixtureIds.filter(k2 => k2 !== k &&
      _byMatch[k2]?.match?.id === _byMatch[k]?.match?.id &&
      _byMatch[k2]?.pick !== pick);
    conflicts.forEach(k2 => delete _byMatch[k2]);
  });

  const upcomingMatches = Object.values(_byMatch)
    .sort((a, b) => (b.confidence - a.confidence) || (b.value - a.value))
    .map(s => ({
      id: s.match.id, home: s.match.home, away: s.match.away, comp: s.match.comp || '',
      date: s.match.date || '', time: s.match.time || '',
      pick: s.pick, pickLabel: s.pickLabel, odds: s.odds, value: s.value, confidence: s.confidence
    }));

  if (upcomingMatches.length < 2) {
    const card = document.getElementById('combiCard');
    if (card) {
      card.innerHTML = `<div style="text-align:center;padding:1.5rem;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);border-radius:14px;">
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.6rem;color:rgba(255,255,255,.95);line-height:1.7;">Te weinig value-picks uit de scan.<br>Draai eerst een value-scan zodat de tips uit dezelfde analyse komen als de scan-log.</div>
      </div>`;
      card.style.display = 'block';
    }
    btn.disabled = false; btn.textContent = '⚡ GENEREER TOP 3 TIPS + COMBI';
    return;
  }

  // Engine-picks als context — Claude kiest hieruit, mag pick/odds NIET wijzigen
  const matchesCtx = upcomingMatches.slice(0, 12).map((m, i) =>
    `[${i+1}] fixtureId=${m.id} | ${m.home} vs ${m.away} | ${m.comp} | engine-pick=${m.pick} (${m.pickLabel}) | odds=${m.odds} | engine-value=${m.value}% | confidence=${m.confidence}/10`
  ).join('\n');

  const vandaag = new Date().toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long'});

  try {
    const data = await anthropicFetch(null, {
      model:'claude-sonnet-4-6', max_tokens:1600,
      system:`Je bent sportadviseur. JSON only, geen tekst buiten JSON.
Het veld "match" MOET altijd de exacte teamnamen bevatten: "ThuisTeam vs UitTeam".
Het veld "fixtureId" MOET de fixtureId zijn uit de invoer.

SELECTIE UIT ENGINE-PICKS:
- Kies UITSLUITEND uit de aangeleverde engine-picks. Gebruik de gegeven "engine-pick" en "odds" EXACT — verzin NOOIT een andere uitslag, markt of odds.
- Top 3 tips: de 3 sterkste engine-picks (hoogste confidence, dan value), elk een ANDERE wedstrijd (andere fixtureId).
- Combi: 3 legs uit die picks, liefst uit MINIMAAL 2 verschillende competities (lagere correlatie).
- Combi totale odds maximaal 12.00 — kies anders engine-picks met lagere odds.
- "pick" is altijd "1" of "2" (de engine levert geen gelijkspelen).
- "odds" = exact de gegeven odds; "vertrouwen" = de gegeven confidence (1-10).
- Geef bij elke top3 pick een zwakPunt (1 zin over het grootste risico).

{"top3":[
  {"fixtureId":"123","match":"ThuisTeam vs UitTeam","datum":"","pick":"","pickLabel":"","markt":"","odds":0,"vertrouwen":8,"reden":"30-40 woorden met concrete redenen","factoren":["",""],"risico":"","zwakPunt":"1 zin over het risico"},
  {"fixtureId":"123","match":"ThuisTeam vs UitTeam","datum":"","pick":"","pickLabel":"","markt":"","odds":0,"vertrouwen":0,"reden":"","factoren":[],"risico":"","zwakPunt":""},
  {"fixtureId":"123","match":"ThuisTeam vs UitTeam","datum":"","pick":"","pickLabel":"","markt":"","odds":0,"vertrouwen":0,"reden":"","factoren":[],"risico":"","zwakPunt":""}
],
"combi":{"legs":[
  {"fixtureId":"123","match":"ThuisTeam vs UitTeam","datum":"","pick":"","pickLabel":"","markt":"","odds":0,"vertrouwen":0},
  {"fixtureId":"123","match":"ThuisTeam vs UitTeam","datum":"","pick":"","pickLabel":"","markt":"","odds":0,"vertrouwen":0},
  {"fixtureId":"123","match":"ThuisTeam vs UitTeam","datum":"","pick":"","pickLabel":"","markt":"","odds":0,"vertrouwen":0}
],"redenering":"40-50 woorden","synergie":"max 30 woorden — benoem de cross-competitie diversiteit","risico":"max 25 woorden","kansBerekening":"72%x68%x75%=37%","valueScore":7}}`,
      messages:[{role:'user',content:`Datum: ${vandaag}\n\nBeschikbare wedstrijden (${upcomingMatches.length} totaal, meerdere competities):\n${matchesCtx}\n\nMaak top 3 tips en een cross-competitie combi van 3 legs uit minimaal 2 verschillende competities.`}]
    });
    let raw = data.content[0].text.trim();
    const js = raw.indexOf('{'), je = raw.lastIndexOf('}');
    if (js < 0 || je < js) throw new Error('Geen JSON in response: ' + raw.substring(0,60));
    const result = JSON.parse(raw.substring(js, je + 1));

    // ── FIX v18.2: Overschrijf teamnamen met echte data uit state.matches ──
    [...(result.top3||[]), ...(result.combi?.legs||[])].forEach(t => {
      if (t.fixtureId) {
        const m = (state.matches||[]).find(m => String(m.id) === String(t.fixtureId));
        if (m) t.match = `${m.home} vs ${m.away}`;
      }
    });

    // Dedupliceer top3 — max 1 pick per wedstrijd, geen gelijkspel
    if (result.top3) {
      const seenFixtures = new Set();
      result.top3 = result.top3.filter(t => {
        if (t.pick === 'X') return false; // geen gelijkspel
        const fid = String(t.fixtureId || t.match);
        if (seenFixtures.has(fid)) return false;
        seenFixtures.add(fid);
        return true;
      });
    }

    renderTop3EnCombi(result);
  } catch(e) {
    const card = document.getElementById('combiCard');
    if (card) { card.innerHTML = `<div style="color:var(--red);font-family:monospace;font-size:.62rem;">⚠ ${e.message}</div>`; card.style.display = 'block'; }
  }
  btn.disabled = false; btn.textContent = '⚡ VERNIEUW TIPS';
}

function renderTop3EnCombi(result) {
  const defaultBet = state.settings.defaultBet || 10;
  const card = document.getElementById('combiCard');
  if (!card) return;
  const stars = n => '⭐'.repeat(Math.min(n,5));
  const confColor = n => n >= 8 ? '#00BEC4' : n >= 6 ? '#d97706' : '#dc2626';

  // Sla tips op voor pop-up
  window._top3Tips = result.top3 || [];

  const top3Html = (result.top3||[]).map((t,i) => {
    const tv = calcValue(t.vertrouwen * 10, parseFloat(t.odds));
    const tvSign = tv > 0 ? '+' : '';
    const tvColor = tv >= 15 ? '#00BEC4' : tv >= 5 ? '#b45309' : tv >= 0 ? '#64748b' : '#dc2626';
    const cc = confColor(t.vertrouwen);
    const cbar = Math.round((t.vertrouwen/10)*100);
    const factoren = Array.isArray(t.factoren) ? t.factoren : [];
    return `<div onclick="openTipPopup(${i})" style="background:var(--card-bg-dark,rgba(0,0,0,.06));border:1px solid rgba(0,0,0,.1);border-radius:12px;padding:.75rem .9rem;margin-bottom:.5rem;cursor:pointer;active:opacity:.85;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.4rem;">
        <div style="flex:1;"><div style="font-size:.88rem;font-weight:700;color:#ffffff;">${i+1}. ${t.match}</div>
          <div style="font-family:monospace;font-size:.52rem;color:#00a8ad;margin-top:2px;">📅 ${t.datum||''}</div>
        </div>
        <div style="text-align:right;margin-left:.8rem;">
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.3rem;color:#00BEC4;">${parseFloat(t.odds||0).toFixed(2)}</div>
          ${tv !== null ? `<div style="font-family:monospace;font-size:.5rem;font-weight:800;color:${tvColor};">⚡ ${tvSign}${Math.round(tv)}% val</div>` : ''}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.45rem;flex-wrap:wrap;">
        <span style="font-family:monospace;font-size:.6rem;background:rgba(0,190,196,.1);color:#00BEC4;padding:2px 9px;border-radius:4px;font-weight:700;">${t.pick} — ${t.pickLabel}</span>
        <span style="font-size:.72rem;">${stars(Math.round(t.vertrouwen/2))}</span>
      </div>
      <div style="margin-bottom:.45rem;">
        <div style="display:flex;justify-content:space-between;margin-bottom:.2rem;">
          <span style="font-family:monospace;font-size:.48rem;color:rgba(255,255,255,.95);font-weight:700;">ZEKERHEID</span>
          <span style="font-family:monospace;font-size:.52rem;font-weight:800;color:${cc};">${t.vertrouwen}/10</span>
        </div>
        <div style="background:rgba(0,0,0,.08);border-radius:999px;height:6px;overflow:hidden;">
          <div style="background:${cc};width:${cbar}%;height:100%;border-radius:999px;"></div>
        </div>
      </div>
      ${t.reden ? `<div style="font-size:.76rem;color:rgba(255,255,255,.95);line-height:1.65;margin-bottom:.4rem;padding:.45rem .6rem;background:rgba(255,255,255,.06);border-radius:7px;border-left:2.5px solid ${tvColor};">${t.reden}</div>` : ''}
      ${factoren.length ? `<div style="display:flex;flex-wrap:wrap;gap:.2rem;margin-bottom:.3rem;">${factoren.map(f=>`<span style="font-family:monospace;font-size:.46rem;font-weight:700;padding:2px 7px;border-radius:999px;background:rgba(0,190,196,.08);border:1px solid rgba(0,190,196,.18);color:#00a8ad;">${f}</span>`).join('')}</div>` : ''}
      ${t.risico ? `<div style="font-family:monospace;font-size:.47rem;padding:3px 9px;border-radius:999px;display:inline-block;background:rgba(220,38,38,.07);border:1px solid rgba(220,38,38,.18);color:#dc2626;">⚠ ${t.risico}</div>` : ''}
      ${t.zwakPunt ? `<div style="font-family:monospace;font-size:.44rem;padding:3px 9px;border-radius:999px;display:inline-block;background:rgba(255,165,0,.07);border:1px solid rgba(255,165,0,.2);color:#d97706;margin-top:.2rem;">⚡ ${t.zwakPunt}</div>` : ''}
      <div style="font-family:monospace;font-size:.44rem;color:rgba(255,255,255,.95);margin-top:.35rem;text-align:right;">Tik voor details →</div>
    </div>`;
  }).join('');

  const combi = result.combi || {};
  const legs = (combi.legs||[]).slice(0,3);
  const totalOdds = legs.reduce((a,l) => a * parseFloat(l.odds||1), 1);
  const payout = (defaultBet * totalOdds).toFixed(2);
  const kansStr = legs.length === 3 ? Math.round(legs.reduce((a,l) => a * ((l.vertrouwen||7)/10), 1) * 100) : '—';

  const legsHtml = legs.map((l,i) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem .75rem;
      background:rgba(255,255,255,.07);border-radius:10px;margin-bottom:.4rem;border:1px solid rgba(255,255,255,.08);">
      <div style="flex:1;">
        <div style="font-size:.82rem;font-weight:700;color:#ffffff;">${i+1}. ${l.match}</div>
        <div style="font-family:monospace;font-size:.5rem;color:#00a8ad;">📅 ${l.datum||''}</div>
        <div style="font-family:monospace;font-size:.55rem;color:#00BEC4;font-weight:700;margin-top:3px;">${l.pick} — ${l.pickLabel}</div>
      </div>
      <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.2rem;color:#00BEC4;">${parseFloat(l.odds||0).toFixed(2)}</div>
    </div>`).join('');

  window._lastAICombi = legs;

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem;">
      <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.05rem;color:#00BEC4;">🏆 TOP 3 TIPS</div>
      <div style="font-family:monospace;font-size:.5rem;color:rgba(255,255,255,.95);">📅 ${new Date().toLocaleString('nl-NL',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
    </div>
    ${top3Html}
    <div style="height:1px;background:rgba(28,35,48,.08);margin:1rem 0;"></div>
    <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.05rem;color:#00BEC4;margin-bottom:.6rem;">⚡ AI COMBI</div>
    ${legsHtml}
    <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:.85rem;margin:.7rem 0;">
      <div style="font-size:.84rem;line-height:1.75;color:#ffffff;margin-bottom:.5rem;">${combi.redenering||''}</div>
      ${combi.synergie ? `<div style="background:rgba(0,190,196,.06);border-left:3px solid #2563eb;padding:.5rem .7rem;border-radius:0 8px 8px 0;margin-bottom:.4rem;">
        <div style="font-family:monospace;font-size:.52rem;color:#2563eb;font-weight:700;">🔗 SYNERGIE</div>
        <div style="font-size:.78rem;">${combi.synergie}</div></div>` : ''}
      ${combi.risico ? `<div style="background:rgba(220,38,38,.05);border-left:3px solid #dc2626;padding:.5rem .7rem;border-radius:0 8px 8px 0;">
        <div style="font-family:monospace;font-size:.52rem;color:#dc2626;font-weight:700;">⚠ RISICO</div>
        <div style="font-size:.78rem;">${combi.risico}</div></div>` : ''}
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(0,190,196,.08);border-radius:10px;padding:.65rem .9rem;margin-bottom:.7rem;">
      <div><div style="font-size:.5rem;color:#475569;font-family:monospace;">QUOTE</div><div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.6rem;">${totalOdds.toFixed(2)}</div></div>
      <div style="text-align:center;"><div style="font-size:.5rem;color:#475569;font-family:monospace;">KANS</div><div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.6rem;color:#d97706;">${kansStr}%</div></div>
      <div style="text-align:right;"><div style="font-size:.5rem;color:#475569;font-family:monospace;">€${defaultBet}</div><div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.6rem;color:#00BEC4;">€${payout}</div></div>
    </div>
    <button onclick="loadAICombiIntoBuilder()"
      style="width:100%;background:linear-gradient(135deg,rgba(0,190,196,.2),rgba(0,190,196,.2));
      border:1px solid rgba(0,190,196,.35);color:#ffffff;font-family:monospace;font-size:.65rem;
      font-weight:700;padding:.7rem;border-radius:10px;cursor:pointer;">
      🎰 ZET IN BUILDER
    </button>`;
  card.style.display = 'block';
}

function openTipPopup(index) {
  const t = (window._top3Tips || [])[index];
  if (!t) return;
  const tv = calcValue(t.vertrouwen * 10, parseFloat(t.odds));
  const tvSign = tv > 0 ? '+' : '';
  const tvColor = tv >= 15 ? '#00BEC4' : tv >= 5 ? '#b45309' : '#64748b';
  const confColor = t.vertrouwen >= 8 ? '#00BEC4' : t.vertrouwen >= 6 ? '#d97706' : '#dc2626';
  const stars = '⭐'.repeat(Math.min(Math.round(t.vertrouwen/2), 5));
  const factoren = Array.isArray(t.factoren) ? t.factoren : [];

  // Verwijder bestaande popup
  document.getElementById('tipPopupOverlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tipPopupOverlay';
  overlay.style.cssText = `position:fixed;inset:0;z-index:9999;
    background:rgba(15,23,42,.6);backdrop-filter:blur(6px);
    display:flex;align-items:flex-end;justify-content:center;
    animation:fadeIn .15s ease;`;
  overlay.onclick = e => { if(e.target === overlay) overlay.remove(); };

  overlay.innerHTML = `
    <div style="width:100%;max-width:520px;max-height:92vh;overflow-y:auto;
      background:var(--sheet-bg,#0d1e24);
      border-radius:24px 24px 0 0;padding:1.2rem 1.1rem 2rem;
      box-shadow:0 -8px 40px rgba(15,23,42,.2);">

      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
        <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.3rem;
          background:linear-gradient(135deg,#00BEC4,#00a8ad);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;">
          TIP DETAILS
        </div>
        <button onclick="document.getElementById('tipPopupOverlay').remove()"
          style="background:var(--track-bg,rgba(0,0,0,.08));border:none;border-radius:50%;
          width:2rem;height:2rem;font-size:1rem;cursor:pointer;color:#ffffff;">✕</button>
      </div>

      <!-- Wedstrijd -->
      <div style="font-family:\'DM Sans\',sans-serif;font-size:1.15rem;font-weight:800;
        color:#ffffff;margin-bottom:.25rem;">${t.match}</div>
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.52rem;
        color:#00a8ad;margin-bottom:.9rem;">📅 ${t.datum||''} · ${t.markt||'Uitslag'}</div>

      <!-- Pick + odds + value -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;margin-bottom:.9rem;">
        <div style="background:rgba(0,190,196,.1);border:1px solid rgba(0,190,196,.25);
          border-radius:12px;padding:.6rem;text-align:center;">
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:#00BEC4;font-weight:700;">PICK</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.62rem;font-weight:800;color:#00BEC4;margin-top:.2rem;">${t.pickLabel}</div>
        </div>
        <div style="background:rgba(0,190,196,.1);border:1px solid rgba(0,190,196,.25);
          border-radius:12px;padding:.6rem;text-align:center;">
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:#00BEC4;font-weight:700;">ODDS</div>
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.4rem;color:#00BEC4;line-height:1;">${parseFloat(t.odds||0).toFixed(2)}</div>
        </div>
        <div style="background:rgba(${tv>=8?'22,163,74':'180,83,9'},.1);border:1px solid rgba(${tv>=8?'22,163,74':'180,83,9'},.25);
          border-radius:12px;padding:.6rem;text-align:center;">
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:${tvColor};font-weight:700;">VALUE</div>
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.4rem;color:${tvColor};line-height:1;">${tvSign}${Math.round(tv)}%</div>
        </div>
      </div>

      <!-- Confidence -->
      <div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,0.09);
        border-radius:12px;padding:.7rem .9rem;margin-bottom:.75rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem;">
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:800;color:rgba(255,255,255,.95);">
            🎯 ZEKERHEID ${stars}
          </div>
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.2rem;color:${confColor};">
            ${t.vertrouwen}/10
          </div>
        </div>
        <div style="background:rgba(0,0,0,.08);border-radius:999px;height:8px;overflow:hidden;">
          <div style="background:${confColor};width:${Math.round(t.vertrouwen/10*100)}%;height:100%;
            border-radius:999px;transition:width .3s;"></div>
        </div>
      </div>

      <!-- Analyse -->
      ${t.reden ? `<div style="background:rgba(255,255,255,.05);border-left:3px solid ${tvColor};
        border-radius:0 12px 12px 0;padding:.75rem .9rem;margin-bottom:.75rem;
        font-size:.82rem;color:rgba(255,255,255,.95);line-height:1.75;">${t.reden}</div>` : ''}

      <!-- Factoren -->
      ${factoren.length ? `<div style="display:flex;flex-wrap:wrap;gap:.3rem;margin-bottom:.75rem;">
        ${factoren.map(f=>`<span style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;
          font-weight:700;padding:.2rem .55rem;border-radius:999px;
          background:rgba(0,190,196,.08);border:1px solid rgba(0,190,196,.2);
          color:#00a8ad;">${f}</span>`).join('')}
      </div>` : ''}

      <!-- Risico -->
      ${t.risico ? `<div style="background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.15);
        border-radius:10px;padding:.55rem .8rem;margin-bottom:.85rem;">
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.48rem;
          font-weight:800;color:#dc2626;margin-bottom:.2rem;">⚠ RISICO</div>
        <div style="font-size:.76rem;color:#7f1d1d;">${t.risico}</div>
      </div>` : ''}

      <!-- Actie knoppen -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;">
        <button onclick="document.getElementById('tipPopupOverlay').remove();
          openBetModal(null,'${t.fixtureId||''}','${t.pick}','${(t.pickLabel||'').replace(/'/g,"\\'")}',${t.odds})"
          style="padding:.7rem;border-radius:12px;
          background:linear-gradient(135deg,rgba(0,190,196,.85),rgba(0,190,196,.6));
          color:#fff;border:none;font-family:\'IBM Plex Mono\',monospace;
          font-size:.62rem;font-weight:800;cursor:pointer;">
          💶 SINGLE BET
        </button>
        <button onclick="document.getElementById('tipPopupOverlay').remove();
          addValuePickToCombi('${t.fixtureId||''}','${t.pick}','${(t.pickLabel||'').replace(/'/g,"\\'")}',${t.odds},'${(t.match||'').replace(/'/g,"\\'")}','')"
          style="padding:.7rem;border-radius:12px;
          background:linear-gradient(135deg,rgba(0,190,196,.85),rgba(0,190,196,.6));
          color:#fff;border:none;font-family:\'IBM Plex Mono\',monospace;
          font-size:.62rem;font-weight:800;cursor:pointer;">
          ➕ COMBI
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
}

function loadAICombiIntoBuilder() {
  const legs = window._lastAICombi;
  if (!legs?.length) return;
  state.combiBuilder = [];
  legs.forEach((l,i) => {
    // ── FIX v18.2: Gebruik fixtureId voor betrouwbare match-lookup ──
    const match = l.fixtureId
      ? (state.matches||[]).find(m => String(m.id) === String(l.fixtureId))
      : (state.matches||[]).find(m =>
          m.home.toLowerCase().includes(l.match.split(' vs ')[0]?.trim().toLowerCase().substring(0,5)) ||
          l.match.toLowerCase().includes(m.home.toLowerCase().substring(0,5))
        );
    const matchId = match ? match.id : `ai-${i}-${Date.now()}`;
    state.combiBuilder.push({
      matchId: String(matchId),
      home: match ? match.home : l.match.split(' vs ')[0]?.trim(),
      away: match ? match.away : l.match.split(' vs ')[1]?.trim(),
      pick: l.pick, pickLabel: l.pickLabel,
      odds: parseFloat(l.odds), date: l.datum || ''
    });
  });
  updateCombiBuilder();
  switchScreen('wedstrijden');
  setTimeout(() => document.getElementById('combiBuilder')?.scrollIntoView({behavior:'smooth'}), 300);
}

// ═══════════════════════════════════════════════════════
// SCAN LOG — 100 scans trackrecord voor Play Store
// ═══════════════════════════════════════════════════════

function logScanResult(picks) {
  if (!picks || !picks.length) return;
  const today = new Date().toLocaleDateString('nl-NL');
  const todayISO = new Date().toISOString().split('T')[0];
  const filtered = picks; // Alle picks opslaan, ook onder drempel
  if (!filtered.length) return;

  const log = state.scanLog || [];
  const todayIds = new Set();
  log.forEach(scan => {
    if (scan.date === today) {
      scan.picks.forEach(p => { if (p.fixtureId) todayIds.add(String(p.fixtureId) + '_' + p.pick); });
    }
  });

  const newPicks = filtered.map(p => {
    const home = p.match && p.match.home ? p.match.home : (p.home || '');
    const away = p.match && p.match.away ? p.match.away : (p.away || '');
    const fixtureId = (p.match && p.match.id) ? p.match.id : (p.fixtureId || p.id);
    return {
      id:          p.id,
      fixtureId:   fixtureId,
      match:       home + ' vs ' + away,
      comp:        (p.match && p.match.comp) || p.comp || p.compName || '',
      pick:        p.pick || '1',
      pickLabel:   p.pickLabel || p.label || '',
      odds:        parseFloat(p.odds || 2),
      value:       parseFloat(p.value || 0),
      confidence:  parseInt(p.confidence || 7),
      aiKans:      p.kans || 0,
      kelly:       parseFloat((p.kelly || 0).toFixed(1)),
      reason:      p.reason || '',
      poissonUsed: p.poissonUsed || false,
      poissonK1:   p.poissonK1,
      poissonKX:   p.poissonKX,
      poissonK2:   p.poissonK2,
      marketSignal: (typeof marketSignalFromMarket === 'function') ? marketSignalFromMarket(p.market, p.pick || '1') : null,
      matchTime:   (p.match && p.match.date) || p.matchTime || p.kickoff || null,
      matchDate:   (p.match && p.match.dateStr) || p.matchDate || null,
      status:      'pending',
      score:       null,
      verifiedAt:  null
    };
  }).map(p => {
    // Bereken confidenceFinal en elite via v20 Confidence Engine
    const leagueId = p.leagueId || (p.match && p.match.leagueId) || (p.match && p.match.comp) || null;
    const cv = calculateConfidenceV20(p, leagueId, null);
    p.confidenceFinal = cv.confidenceFinal;
    p.elite = cv.elite;
    return p;
  }).filter(p => {
    const key = String(p.fixtureId) + '_' + p.pick;
    if (todayIds.has(key)) return false;
    todayIds.add(key);
    return true;
  });

  if (!newPicks.length) return;

  log.unshift({
    id: Date.now(),
    timestamp: Date.now(),
    date: today,
    time: new Date().toLocaleTimeString('nl-NL', {hour:'2-digit', minute:'2-digit'}),
    picks: newPicks
  });
  state.scanLog = log.slice(0, 100);
  saveState();

  // Sync naar Firebase picks/ zodat worker picks en app picks samenkomen
  syncPicksToFirebase(newPicks);
}

// Converteert "22-5-2026" naar "2026-05-22" voor Firebase settlement
function normalizeDateISO(dateStr, fallback) {
  if (!dateStr) return fallback || new Date().toISOString().split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
    var p = dateStr.split("-");
    return p[2] + "-" + p[1].padStart(2,"0") + "-" + p[0].padStart(2,"0");
  }
  try { return new Date(dateStr).toISOString().split("T")[0]; } catch(e) { return fallback; }
}

async function syncPicksToFirebase(picks) {
  try {
    if (!firebase || !firebase.database) return;
    const todayISO = new Date().toISOString().split('T')[0];
    const db = firebase.database();
    const updates = {};
    const supabasePicks = [];

    picks.forEach(p => {
      const key = String(p.fixtureId || p.id) + '_' + p.pick;
      const matchDate = normalizeDateISO(p.matchDate, todayISO);
      const pickObj = {
        fixtureId:       p.fixtureId,
        home:            p.match ? p.match.split(' vs ')[0] : '',
        away:            p.match ? p.match.split(' vs ')[1] : '',
        matchName:       p.match,
        matchDate,
        matchTime:       p.matchTime || null,
        leagueName:      p.comp || '',
        pick:            p.pick,
        pickLabel:       p.pickLabel,
        odds:            p.odds,
        value:           p.value,
        confidence:      p.confidence,
        confidenceFinal: p.confidenceFinal || null,
        elite:           p.elite || false,
        aiKans:          p.aiKans || 0,
        lockLevel:       'single',
        scanCount:       1,
        source:          'manual_scan',
        status:          'pending',
        score:           null,
        processed:       false,
        firstScanAt:     new Date().toISOString(),
        lastScanAt:      new Date().toISOString(),
      };
      updates['picks/' + key] = pickObj;
      supabasePicks.push({ ...pickObj, id: key });
    });

    // Firebase sync
    await db.ref('/').update(updates);
    console.log('[Sync] ' + picks.length + ' picks gesynchroniseerd naar Firebase');

    // Supabase sync via worker POST /picks
    try {
      const workerUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : 'https://toto-proxy.zweetzakken.workers.dev') + '/picks';
      const res = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supabasePicks),
      });
      const data = await res.json();
      if (data.ok) {
        console.log('[Sync] ' + data.saved + ' picks gesynchroniseerd naar Supabase');
      } else {
        console.warn('[Sync] Supabase sync fout:', data.error);
      }
    } catch(e) {
      console.warn('[Sync] Supabase sync mislukt:', e.message);
    }
  } catch(e) {
    console.warn('[Sync] Firebase sync mislukt:', e.message);
  }
}

async function verifyScanLog() {
  const log = state.scanLog || [];
  const pending = [];
  log.forEach(scan => {
    scan.picks.forEach(p => {
      // v18.5: fixtureId fallback — oudere picks kunnen id ipv fixtureId hebben
      if (!p.fixtureId && p.id && !String(p.id).startsWith('manual')) {
        p.fixtureId = p.id;
      }
      if (p.status === 'pending' && p.fixtureId) pending.push({ scan, pick: p });
    });
  });
  if (!pending.length) return 0;

  let verified = 0;

  for (const { pick } of pending) {
    try {
      // v18.5: cache-bypass via timestamp zodat Worker geen oude NS-status teruggeeft
      const res = await apiFetch(
        `https://v3.football.api-sports.io/fixtures?id=${pick.fixtureId}&_cb=${Date.now()}`, null
      );
      const json = await res.json();
      const f = json?.response?.[0];
      if (!f) continue;
      const status = f.fixture && f.fixture.status && f.fixture.status.short;
      if (!['FT','AET','PEN'].includes(status)) continue;

      const home = (f.goals && f.goals.home) || 0;
      const away = (f.goals && f.goals.away) || 0;
      pick.score = home + '-' + away;
      pick.verifiedAt = new Date().toISOString();

      const t = (pick.pick||'').toUpperCase();
      if      (t === '1')    pick.status = home > away   ? 'win' : 'lose';
      else if (t === 'X')    pick.status = home === away  ? 'win' : 'lose';
      else if (t === '2')    pick.status = away > home   ? 'win' : 'lose';
      else if (t === '1X')   pick.status = home >= away  ? 'win' : 'lose';
      else if (t === 'X2')   pick.status = away >= home  ? 'win' : 'lose';
      else if (t === 'O25')  pick.status = (home+away) > 2.5 ? 'win' : 'lose';
      else if (t === 'U25')  pick.status = (home+away) < 2.5 ? 'win' : 'lose';
      else if (t === 'O15')  pick.status = (home+away) > 1.5 ? 'win' : 'lose';
      else if (t === 'O35')  pick.status = (home+away) > 3.5 ? 'win' : 'lose';
      else if (t === 'BTTS') pick.status = (home > 0 && away > 0) ? 'win' : 'lose';
      else pick.status = 'void';

      verified++;
    } catch(e) { /* skip */ }
  }

  if (verified > 0) saveState();
  return verified;
}

async function autoVerifyPendingPicks() {
  const log = state.scanLog || [];
  const today = new Date().toLocaleDateString('nl-NL');
  const pending = [];

  log.forEach(scan => {
    scan.picks.forEach(p => {
      if (p.status === 'pending' && p.fixtureId) {
        if (scan.date && scan.date !== today) {
          pending.push({ scan, pick: p });
        }
      }
    });
  });

  if (!pending.length) return 0;

  const byDate = {};
  pending.forEach(({ scan, pick }) => {
    const d = scan.date;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push({ scan, pick });
  });

  let verified = 0;
  for (const [date, items] of Object.entries(byDate)) {
    try {
      const parts = date.split('-');
      const isoDate = parts.length === 3 && parts[0].length === 2
        ? `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
        : date;
      const res = await apiFetch(
        `https://v3.football.api-sports.io/fixtures?date=${isoDate}&status=FT`, null
      );
      const resJson = await res.json();
      if (!resJson?.response) continue;
      const resultMap = {};
      resJson.response.forEach(f => {
        resultMap[f.fixture.id] = {
          home: f.goals.home ?? 0,
          away: f.goals.away ?? 0,
          status: f.fixture.status.short
        };
      });

      items.forEach(({ pick }) => {
        const result = resultMap[pick.fixtureId];
        if (!result) return;
        const hg = result.home, ag = result.away;
        pick.score = `${hg}-${ag}`;
        pick.verifiedAt = new Date().toISOString();
        const t = (pick.pick || '').toUpperCase();
        if      (t === '1')      pick.status = hg > ag  ? 'win' : 'lose';
        else if (t === 'X')      pick.status = hg === ag ? 'win' : 'lose';
        else if (t === '2')      pick.status = ag > hg  ? 'win' : 'lose';
        else if (t === '1X')     pick.status = hg >= ag ? 'win' : 'lose';
        else if (t === 'X2')     pick.status = ag >= hg ? 'win' : 'lose';
        else if (t === 'O2.5')   pick.status = (hg+ag) > 2.5 ? 'win' : 'lose';
        else if (t === 'U2.5')   pick.status = (hg+ag) < 2.5 ? 'win' : 'lose';
        else if (t === 'BTTS-J') pick.status = (hg>0 && ag>0) ? 'win' : 'lose';
        else if (t === 'BTTS-N') pick.status = (hg===0 || ag===0) ? 'win' : 'lose';
        else pick.status = 'void';
        verified++;
      });
    } catch(e) {}
  }

  if (verified > 0) {
    saveState();
    syncScanLogToBacktest();
  }
  return verified;
}

function syncScanLogToBacktest() {
  const log = state.scanLog || [];
  if (!state.valueBacktest) state.valueBacktest = { picks: [] };

  log.forEach(scan => {
    scan.picks.forEach(sp => {
      if (sp.status === 'pending' || !sp.fixtureId) return;
      const btPick = state.valueBacktest.picks.find(p =>
        String(p.fixtureId || p.matchId) === String(sp.fixtureId) && p.pick === sp.pick
      );
      if (btPick && btPick.status === 'pending') {
        btPick.status = sp.status;
        btPick.score = sp.score;
        btPick.verifiedAt = sp.verifiedAt;
      }
    });
  });
  saveState();
}

// v26.24: open de scan-log (vanaf dashboard-kaart of melding) en filter optioneel op een match.
function openScanLog(arg) {
  let query = '';
  if (arg && typeof arg === 'object') {
    if (arg.matchId) {
      const all = (state.scanLog || []).flatMap(s => s.picks || []);
      const hit = all.find(p => String(p.fixtureId || p.matchId || '') === String(arg.matchId));
      query = hit ? (hit.match || '') : '';
    } else if (arg.q) { query = arg.q; }
  } else if (typeof arg === 'string') { query = arg; }
  try { if (typeof switchScreen === 'function') switchScreen('analyse'); } catch (e) {}
  setTimeout(() => {
    const c = document.getElementById('scan-log-content');
    const blk = document.getElementById('analyse-scanlog-block');
    if (c && c.style.display === 'none') {
      c.style.display = 'block';
      const chev = blk && blk.querySelector('.sl-chevron');
      if (chev) chev.style.transform = 'rotate(180deg)';
    }
    if (!window._scanFilter) window._scanFilter = { q:'', conf:'', pick:'', comp:'', status:'', odds:'', sort:'newest', sharp:false };
    window._scanFilter.q = query || '';
    if (typeof renderScanLog === 'function') renderScanLog();
    if (blk) blk.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 250);
}

function renderScanLog() {
  const el = document.getElementById('scan-log-content');
  if (!el) return;

  autoVerifyPendingPicks().then(n => {
    if (n > 0) {
      showToast(`✅ ${n} picks automatisch geverifieerd`);
      renderScanLog();
    }
  }).catch(() => {});

  const log       = state.scanLog || [];

  // ── Zoek/filter state ──────────────────────────────
  if (!window._scanFilter) window._scanFilter = { q:'', conf:'', pick:'', comp:'', status:'', odds:'', sort:'newest', sharp:false };
  const F = window._scanFilter;

  // Gefilterde picks voor stats
  function pickMatchesFilter(p) {
    if (F.conf   && String(p.confidence) !== F.conf) return false;
    if (F.pick) {
      const pl = (p.pickLabel||p.pick||'').toLowerCase();
      const pm = (p.match||'').toLowerCase();
      if (F.pick === '1'    && !pl.includes('thuis') && p.pick !== '1') return false;
      if (F.pick === 'X'    && p.pick !== 'X' && !pl.includes('gelijkspel')) return false;
      if (F.pick === '2'    && !pl.includes('uit') && p.pick !== '2') return false;
    }
    if (F.comp   && (p.comp||'').toLowerCase().indexOf(F.comp.toLowerCase()) === -1) return false;
    if (F.status && p.status !== F.status) return false;
    if (F.odds) {
      const o = parseFloat(p.odds) || 0;
      if (F.odds === '1.0-1.5' && !(o >= 1.0 && o < 1.5)) return false;
      if (F.odds === '1.5-2.0' && !(o >= 1.5 && o < 2.0)) return false;
      if (F.odds === '2.0-3.0' && !(o >= 2.0 && o < 3.0)) return false;
      if (F.odds === '3.0-5.0' && !(o >= 3.0 && o < 5.0)) return false;
      if (F.odds === '5.0+'    && !(o >= 5.0)) return false;
    }
    if (F.sharp && !p.sharp) return false;
    if (F.q) {
      const q = F.q.toLowerCase();
      const haystack = ((p.match||'') + ' ' + (p.comp||'') + ' ' + (p.pickLabel||p.pick||'')).toLowerCase();
      if (haystack.indexOf(q) === -1) return false;
    }
    return true;
  }

  // v26.88: kwaliteitsfilter — verberg picks onder drempel + conflicterende richtingen
  const MIN_VAL_DISPLAY = 5; // toon alleen picks met ≥5pp value (iets soepeler dan opslag)
  const MIN_CONF_DISPLAY = 4; // en conf ≥4

  // Per scan: dedupliceer op fixture_id — houd alleen beste pick per wedstrijd
  function deduplicateByFixture(picks) {
    const best = {};
    picks.forEach(p => {
      const fid = p.fixtureId || p.match || p.matchId || p.id;
      if (!fid) return;
      const score = (p.value||0) * (p.confidence||0);
      const prev = best[fid];
      if (!prev || score > (prev.value||0)*(prev.confidence||0)) best[fid] = p;
    });
    return Object.values(best);
  }

  const _anyFilter = F.q || F.conf || F.pick || F.comp || F.status || F.odds || F.sharp;
  let filteredLog = log
    .map(s => ({
      ...s,
      picks: deduplicateByFixture(
        (s.picks || []).filter(p =>
          (p.value||0) >= MIN_VAL_DISPLAY &&
          (p.confidence||0) >= MIN_CONF_DISPLAY
        )
      )
    }))
    .filter(s => s.picks.length > 0);

  if (_anyFilter) {
    filteredLog = filteredLog
      .map(s => ({ ...s, picks: s.picks.filter(pickMatchesFilter) }))
      .filter(s => s.picks.length > 0);
  }

  // Sortering
  if (F.sort === 'value') {
    filteredLog = filteredLog.map(s => ({ ...s, picks: [...s.picks].sort((a,b) => (b.value||0)-(a.value||0)) }));
    filteredLog.sort((a,b) => Math.max(...b.picks.map(p=>p.value||0)) - Math.max(...a.picks.map(p=>p.value||0)));
  } else if (F.sort === 'odds') {
    filteredLog = filteredLog.map(s => ({ ...s, picks: [...s.picks].sort((a,b) => (b.odds||0)-(a.odds||0)) }));
    filteredLog.sort((a,b) => Math.max(...b.picks.map(p=>p.odds||0)) - Math.max(...a.picks.map(p=>p.odds||0)));
  } else if (F.sort === 'conf') {
    filteredLog = filteredLog.map(s => ({ ...s, picks: [...s.picks].sort((a,b) => (b.confidence||0)-(a.confidence||0)) }));
    filteredLog.sort((a,b) => Math.max(...b.picks.map(p=>p.confidence||0)) - Math.max(...a.picks.map(p=>p.confidence||0)));
  }
  // 'newest' = default volgorde (al gesorteerd)

  const allPicks  = filteredLog.flatMap(s => s.picks);
  const settled   = allPicks.filter(p => p.status === 'win' || p.status === 'lose');
  const wins      = settled.filter(p => p.status === 'win');
  const hitrate   = settled.length ? Math.round(wins.length / settled.length * 100) : 0;
  const roi       = settled.length
    ? settled.reduce((s,p) => s + (p.status==='win' ? (p.odds-1) : -1), 0) / settled.length * 100
    : 0;
  const avgValue  = allPicks.length ? allPicks.reduce((s,p) => s+(p.value||0),0)/allPicks.length : 0;

  const byType = {};
  settled.forEach(p => {
    const t = p.pick || '?';
    if (!byType[t]) byType[t] = {wins:0, total:0};
    byType[t].total++;
    if (p.status === 'win') byType[t].wins++;
  });

  const byComp = {};
  settled.forEach(p => {
    const c = p.comp || 'Overig';
    if (!byComp[c]) byComp[c] = {wins:0, total:0};
    byComp[c].total++;
    if (p.status === 'win') byComp[c].wins++;
  });

  const vb = {'0-10%':[], '10-20%':[], '20-30%':[], '30%+':[]};
  settled.forEach(p => {
    const v = p.value||0;
    const b = v<10 ? '0-10%' : v<20 ? '10-20%' : v<30 ? '20-30%' : '30%+';
    vb[b].push(p.status === 'win');
  });

  function statCard(val, lbl, color) {
    return '<div style="background:rgba(255,255,255,.05);border:1px solid rgba(26,31,60,.1);border-radius:14px;padding:.7rem .4rem;text-align:center;box-shadow:0 1px 6px rgba(26,31,60,.06);">'
      + '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.4rem;color:' + color + ';">' + val + '</div>'
      + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.54rem;color:#64748b;margin-top:.15rem;letter-spacing:.03em;">' + lbl + '</div>'
      + '</div>';
  }

  function bar(pct, color) {
    return '<div style="flex:1;background:var(--track-bg,rgba(0,0,0,.08));border-radius:999px;height:6px;">'
      + '<div style="height:100%;border-radius:999px;background:' + color + ';width:' + pct + '%;"></div>'
      + '</div>';
  }

  function hrColor(hr) {
    return hr >= 55 ? '#00BEC4' : hr >= 45 ? '#d97706' : '#dc2626';
  }

  let html = '';

    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.6rem;">'
    + '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.4rem;color:var(--text);">SCAN LOG</div>'
    + '<div style="display:flex;gap:.4rem;">'
    + '<button class="small-action-btn" onclick="verifyScanLog().then(n=>{showToast(n>0?n+\' picks geverifieerd\':\'Geen nieuwe resultaten\');renderScanLog();}).catch(e=>showToast(\'⚠ \'+e.message))">🔄 Verificeer</button>'
    + '<button class="small-action-btn" onclick="showScanLogStatsPopup()">📊 Stats</button>'
    + '<button class="small-action-btn" onclick="exportScanLogCSV()">📥 CSV</button>'
    + '<button class="small-action-btn" style="color:#dc2626;" onclick="if(confirm(\'Scan log wissen?\')){\'state.scanLog=[];saveState();renderScanLog();}">🗑</button>'
    + '</div></div>';

  // ── Zoek & Filter bar ─────────────────────────────
  const activeFilters = F.q || F.conf || F.pick || F.comp || F.status || F.odds || F.sharp || F.sort !== 'newest';
  html += '<div style="background:rgba(255,255,255,.05);border:1px solid rgba(26,31,60,.1);border-radius:16px;padding:.7rem .8rem;margin-bottom:.8rem;box-shadow:0 1px 4px rgba(26,31,60,.05);">'
    + '<div style="display:flex;gap:.4rem;margin-bottom:.5rem;">'
    + '<input id="scanSearchQ" type="text" placeholder="🔍 Zoek wedstrijd, competitie..." value="' + (F.q||'') + '" '
    + 'oninput="window._scanFilter.q=this.value;renderScanLog()" '
    + 'style="flex:1;padding:.35rem .6rem;border-radius:8px;border:1px solid rgba(255,255,255,0.09);background:var(--input-bg,rgba(0,0,0,.06));font-family:\'IBM Plex Mono\',monospace;font-size:.60rem;color:var(--text);outline:none;" />'
    + (activeFilters ? '<button onclick="window._scanFilter={q:\'\',conf:\'\',pick:\'\',comp:\'\',status:\'\',odds:\'\',sort:\'newest\',sharp:false};renderScanLog()" style="padding:.35rem .6rem;border-radius:8px;border:1px solid rgba(220,38,38,.2);background:rgba(220,38,38,.08);color:#dc2626;font-family:\'IBM Plex Mono\',monospace;font-size:.56rem;cursor:pointer;white-space:nowrap;">✕ Reset</button>' : '')
    + '</div>'
    + '<div style="display:flex;gap:.3rem;flex-wrap:wrap;">'
    + '<select onchange="window._scanFilter.conf=this.value;renderScanLog()" style="padding:.28rem .5rem;border-radius:8px;border:1px solid rgba(255,255,255,0.09);background:' + (F.conf?'rgba(0,190,196,.12)':'var(--card)') + ';font-family:\'IBM Plex Mono\',monospace;font-size:.56rem;color:var(--text);cursor:pointer;">'
    + '<option value="">Conf</option>'
    + [6,7,8,9,10].map(c => '<option value="'+c+'"'+(F.conf===String(c)?' selected':'')+'>conf '+c+'</option>').join('')
    + '</select>'
    + '<select onchange="window._scanFilter.pick=this.value;renderScanLog()" style="padding:.28rem .5rem;border-radius:8px;border:1px solid rgba(255,255,255,0.09);background:' + (F.pick?'rgba(0,190,196,.12)':'var(--card)') + ';font-family:\'IBM Plex Mono\',monospace;font-size:.56rem;color:var(--text);cursor:pointer;">'
    + '<option value="">Pick type</option>'
    + '<option value="1"'+(F.pick==="1"?' selected':'')+'>🏠 Thuis</option>'
    + '<option value="X"'+(F.pick==="X"?' selected':'')+'>🤝 Gelijk</option>'
    + '<option value="2"'+(F.pick==="2"?' selected':'')+'>✈️ Uit</option>'
    + '</select>'
    + '<select onchange="window._scanFilter.status=this.value;renderScanLog()" style="padding:.28rem .5rem;border-radius:8px;border:1px solid rgba(255,255,255,0.09);background:' + (F.status?'rgba(0,190,196,.12)':'var(--card)') + ';font-family:\'IBM Plex Mono\',monospace;font-size:.56rem;color:var(--text);cursor:pointer;">'
    + '<option value="">Status</option>'
    + '<option value="win"'+(F.status==="win"?' selected':'')+'>✅ Win</option>'
    + '<option value="lose"'+(F.status==="lose"?' selected':'')+'>❌ Verlies</option>'
    + '<option value="pending"'+(F.status==="pending"?' selected':'')+'>⏳ Open</option>'
    + '</select>'

    // Odds range filter
    + '<select onchange="window._scanFilter.odds=this.value;renderScanLog()" style="padding:.28rem .5rem;border-radius:8px;border:1px solid rgba(255,255,255,0.09);background:' + (F.odds?'rgba(0,190,196,.12)':'var(--card)') + ';font-family:\'IBM Plex Mono\',monospace;font-size:.56rem;color:var(--text);cursor:pointer;">'
    + '<option value="">Odds</option>'
    + '<option value="1.0-1.5"'+(F.odds==="1.0-1.5"?' selected':'')+'>1.0–1.5</option>'
    + '<option value="1.5-2.0"'+(F.odds==="1.5-2.0"?' selected':'')+'>1.5–2.0</option>'
    + '<option value="2.0-3.0"'+(F.odds==="2.0-3.0"?' selected':'')+'>2.0–3.0 ⭐</option>'
    + '<option value="3.0-5.0"'+(F.odds==="3.0-5.0"?' selected':'')+'>3.0–5.0</option>'
    + '<option value="5.0+"'+(F.odds==="5.0+"?' selected':'')+'>5.0+</option>'
    + '</select>'

    // Sorteer optie
    + '<select onchange="window._scanFilter.sort=this.value;renderScanLog()" style="padding:.28rem .5rem;border-radius:8px;border:1px solid rgba(255,255,255,0.09);background:' + (F.sort!=="newest"?'rgba(0,190,196,.12)':'var(--card)') + ';font-family:\'IBM Plex Mono\',monospace;font-size:.56rem;color:var(--text);cursor:pointer;">'
    + '<option value="newest"'+(F.sort==="newest"?' selected':'')+'>🕐 Nieuwst</option>'
    + '<option value="value"'+(F.sort==="value"?' selected':'')+'>📈 Value%</option>'
    + '<option value="odds"'+(F.sort==="odds"?' selected':'')+'>🎯 Odds</option>'
    + '<option value="conf"'+(F.sort==="conf"?' selected':'')+'>🔒 Conf</option>'
    + '</select>'

    // Sharp money toggle
    + '<button onclick="window._scanFilter.sharp=!window._scanFilter.sharp;renderScanLog()" '
    + 'style="padding:.28rem .6rem;border-radius:8px;border:1px solid ' + (F.sharp?'rgba(239,68,68,.4)':'rgba(255,255,255,0.09)') + ';background:' + (F.sharp?'rgba(239,68,68,.12)':'var(--card)') + ';font-family:\'IBM Plex Mono\',monospace;font-size:.56rem;color:' + (F.sharp?'#ef4444':'var(--text)') + ';cursor:pointer;white-space:nowrap;">'
    + '🔥 Sharp' + (F.sharp?' ON':'') + '</button>'

    + '</div>'
    + (activeFilters ? '<div style="margin-top:.4rem;font-family:\'IBM Plex Mono\',monospace;font-size:.56rem;color:var(--muted);">' + allPicks.length + ' picks gevonden in ' + filteredLog.length + ' scans</div>' : '')
    + '</div>';


  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem;margin-bottom:.8rem;">'
    + statCard(allPicks.length, 'PICKS' + helpBtn('scan-log'), '#2563eb')
    + statCard(hitrate + '%', 'HITRATE' + helpBtn('hitrate'), hrColor(hitrate))
    + statCard((roi>=0?'+':'') + roi.toFixed(1) + '%', 'ROI' + helpBtn('roi'), roi>=0?'#00BEC4':'#dc2626')
    + statCard(avgValue.toFixed(1) + '%', 'AVG VALUE' + helpBtn('avg-value'), '#00a8ad')
    + '</div>';

  // ROI curve grafiek
  if (settled.length >= 2) {
    html += '<div style="background:rgba(255,255,255,.05);border:1px solid rgba(26,31,60,.1);border-radius:16px;padding:.8rem 1rem;margin-bottom:.8rem;box-shadow:0 2px 8px rgba(26,31,60,.05);">'
      + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.62rem;font-weight:700;color:var(--text);margin-bottom:.4rem;">📈 ROI CURVE</div>'
      + '<canvas id="scanLogChart" height="80" style="width:100%;"></canvas>'
      + '</div>';
  }

  if (settled.length >= 5) {
    html += '<div style="background:rgba(255,255,255,.05);border:1px solid rgba(26,31,60,.1);border-radius:16px;padding:.8rem 1rem;margin-bottom:.8rem;box-shadow:0 2px 8px rgba(26,31,60,.05);">'
      + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.62rem;font-weight:700;color:var(--text);margin-bottom:.6rem;">📐 VALUE KALIBRATIE</div>'
      + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.4rem;">';
    Object.entries(vb).forEach(function(entry) {
      var range = entry[0], results = entry[1];
      var tot = results.length;
      var wr  = tot ? Math.round(results.filter(Boolean).length/tot*100) : null;
      html += '<div style="text-align:center;background:var(--card-bg,rgba(0,0,0,.04));border-radius:10px;padding:.5rem .3rem;">'
        + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.54rem;color:var(--muted);">' + range + '</div>'
        + '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.4rem;color:' + (wr===null?'var(--muted)':hrColor(wr)) + ';">' + (wr===null?'—':wr+'%') + '</div>'
        + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.64rem;color:var(--muted);">' + tot + ' picks</div>'
        + '</div>';
    });
    html += '</div></div>';
  }

  if (Object.keys(byType).length) {
    html += '<div style="background:rgba(255,255,255,.05);border:1px solid rgba(26,31,60,.1);border-radius:16px;padding:.8rem 1rem;margin-bottom:.8rem;box-shadow:0 2px 8px rgba(26,31,60,.05);">'
      + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.62rem;font-weight:700;color:var(--text);margin-bottom:.6rem;">🎯 PER PICK TYPE</div>';
    Object.entries(byType).sort((a,b)=>b[1].total-a[1].total).forEach(function(entry) {
      var type = entry[0], s = entry[1];
      var hr = Math.round(s.wins/s.total*100);
      html += '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem;">'
        + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.64rem;font-weight:700;width:2.5rem;">' + type + '</div>'
        + bar(hr, hrColor(hr))
        + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.62rem;color:var(--muted);width:3.5rem;text-align:right;">' + hr + '% (' + s.total + ')</div>'
        + '</div>';
    });
    html += '</div>';
  }

  if (Object.keys(byComp).length > 1) {
    html += '<div style="background:rgba(255,255,255,.05);border:1px solid rgba(26,31,60,.1);border-radius:16px;padding:.8rem 1rem;margin-bottom:.8rem;box-shadow:0 2px 8px rgba(26,31,60,.05);">'
      + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.62rem;font-weight:700;color:var(--text);margin-bottom:.6rem;">🏆 PER COMPETITIE</div>';
    Object.entries(byComp).sort((a,b)=>b[1].total-a[1].total).slice(0,8).forEach(function(entry) {
      var comp = entry[0], s = entry[1];
      var hr = Math.round(s.wins/s.total*100);
      html += '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem;">'
        + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.60rem;flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' + comp + '</div>'
        + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.62rem;color:' + hrColor(hr) + ';font-weight:700;">' + hr + '%</div>'
        + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.72rem;color:var(--muted);">' + s.total + 'x</div>'
        + '</div>';
    });
    html += '</div>';
  }

  // ── PICKS ANALYSE — toont elke 100 picks (100, 200, 300...) ──
  const _milestone = Math.floor(allPicks.length / 100) * 100;
  if (_milestone >= 100) {
    // Per odds range
    const byOdds = {'1.0-1.5':[], '1.5-2.0':[], '2.0-3.0':[], '3.0-5.0':[], '5.0+':[]}; 
    settled.forEach(p => {
      const o = p.odds || 0;
      const b = o < 1.5 ? '1.0-1.5' : o < 2.0 ? '1.5-2.0' : o < 3.0 ? '2.0-3.0' : o < 5.0 ? '3.0-5.0' : '5.0+';
      byOdds[b].push({win: p.status === 'win', roi: p.status === 'win' ? (p.odds-1)*100 : -100});
    });

    // Per confidence
    const byConf = {'6':[], '7':[], '8':[], '9':[], '10':[]};
    settled.forEach(p => {
      const c = String(Math.min(10, Math.max(6, parseInt(p.confidence) || 7)));
      if (byConf[c]) byConf[c].push(p.status === 'win');
    });

    // Best presterende competitie
    const compStats = {};
    settled.forEach(p => {
      const c = p.comp || 'Overig';
      if (!compStats[c]) compStats[c] = {wins:0, total:0, roi:0};
      compStats[c].total++;
      if (p.status === 'win') { compStats[c].wins++; compStats[c].roi += (p.odds-1)*100; }
      else compStats[c].roi -= 100;
    });
    const topComps = Object.entries(compStats)
      .filter(([,s]) => s.total >= 3)
      .sort((a,b) => (b[1].roi/b[1].total) - (a[1].roi/a[1].total))
      .slice(0, 5);

    // Beste pick type
    const bestType = Object.entries(byType)
      .filter(([,s]) => s.total >= 5)
      .sort((a,b) => (b[1].wins/b[1].total) - (a[1].wins/a[1].total))[0];

    // Conclusie gezichtje
    const face = roi >= 15 && hitrate >= 40 ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00BEC4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 3 4 3 4-3 4-3"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>' : roi >= 5 || hitrate >= 35 ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>' : roi >= 0 ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>' : roi >= -10 ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 15s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-3-4-3-4 3-4 3"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>';

    html += '<div style="background:linear-gradient(135deg,rgba(0,190,196,.08),rgba(0,190,196,.06));border:1.5px solid rgba(0,190,196,.2);border-radius:16px;padding:.9rem 1rem;margin-bottom:.8rem;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem;">'
      + '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.4rem;background:linear-gradient(135deg,#00a8ad,#00BEC4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">🏆 ' + _milestone + ' PICKS ANALYSE</div>'
      + '<span style="font-size:1.5rem;">' + face + '</span>'
      + '</div>'

      // Samenvatting
      + '<div style="background:var(--card-bg,rgba(0,0,0,.04));border-radius:12px;padding:.6rem .7rem;margin-bottom:.65rem;font-family:\'IBM Plex Mono\',monospace;font-size:.60rem;line-height:1.8;color:rgba(255,255,255,.95);">'
      + '<b style="color:#ffffff;">' + allPicks.length + ' picks</b> geanalyseerd &middot; '
      + '<b style="color:' + (hitrate>=40?'#00BEC4':hitrate>=30?'#d97706':'#dc2626') + ';">' + hitrate + '% hitrate</b> &middot; '
      + '<b style="color:' + (roi>=0?'#00BEC4':'#dc2626') + ';">' + (roi>=0?'+':'') + roi.toFixed(1) + '% ROI</b>'
      + '</div>'

      // Odds range analyse
      + '<div style="margin-bottom:.6rem;">'
      + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.60rem;font-weight:700;color:rgba(255,255,255,.95);margin-bottom:.4rem;">📊 ODDS RANGE</div>'
      + '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.3rem;">'
      + Object.entries(byOdds).map(([range, results]) => {
          const tot = results.length;
          const wr = tot ? Math.round(results.filter(r=>r.win).length/tot*100) : null;
          const avgRoi = tot ? results.reduce((s,r)=>s+r.roi,0)/tot : 0;
          const col = wr===null?'var(--sub)':wr>=50?'#00BEC4':wr>=35?'#d97706':'#dc2626';
          return '<div style="text-align:center;background:var(--card-bg,rgba(0,0,0,.04));border-radius:10px;padding:.4rem .2rem;">'
            + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:rgba(255,255,255,.95);">' + range + '</div>'
            + '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:.9rem;color:' + col + ';">' + (wr===null?'—':wr+'%') + '</div>'
            + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.36rem;color:rgba(255,255,255,.95);">' + tot + 'x</div>'
            + '</div>';
        }).join('')
      + '</div></div>'

      // Confidence analyse
      + '<div style="margin-bottom:.6rem;">'
      + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.60rem;font-weight:700;color:rgba(255,255,255,.95);margin-bottom:.4rem;">🎯 CONFIDENCE</div>'
      + '<div style="display:flex;gap:.3rem;align-items:flex-end;height:2.5rem;">'
      + Object.entries(byConf).map(([conf, results]) => {
          const tot = results.length;
          const wr = tot ? Math.round(results.filter(Boolean).length/tot*100) : 0;
          const col = wr>=50?'#00BEC4':wr>=35?'#d97706':'#dc2626';
          const h = tot ? Math.max(15, Math.round(wr * 0.4)) : 5;
          return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;">'
            + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:' + col + ';font-weight:700;">' + (tot?wr+'%':'—') + '</div>'
            + '<div style="width:100%;background:' + col + ';border-radius:4px 4px 0 0;height:' + h + 'px;opacity:.8;"></div>'
            + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:rgba(255,255,255,.95);">conf ' + conf + '</div>'
            + '</div>';
        }).join('')
      + '</div></div>'

      // Top competities
      + (topComps.length ? '<div style="margin-bottom:.6rem;">'
        + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.60rem;font-weight:700;color:rgba(255,255,255,.95);margin-bottom:.4rem;">🏆 TOP COMPETITIES (min 3 picks)</div>'
        + topComps.map(([comp, s]) => {
            const hr = Math.round(s.wins/s.total*100);
            const avgRoi = (s.roi/s.total).toFixed(1);
            const col = hr>=50?'#00BEC4':hr>=35?'#d97706':'#dc2626';
            return '<div style="display:flex;justify-content:space-between;align-items:center;padding:.25rem 0;border-bottom:1px solid rgba(255,255,255,0.09);">'
              + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.72rem;flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' + comp + '</div>'
              + '<div style="display:flex;gap:.5rem;font-family:\'IBM Plex Mono\',monospace;font-size:.72rem;">'
              + '<span style="color:' + col + ';font-weight:700;">' + hr + '%</span>'
              + '<span style="color:' + (parseFloat(avgRoi)>=0?'#00BEC4':'#dc2626') + ';">' + (parseFloat(avgRoi)>=0?'+':'') + avgRoi + '% ROI</span>'
              + '<span style="color:rgba(255,255,255,.95);">' + s.total + 'x</span>'
              + '</div></div>';
          }).join('')
        + '</div>' : '')

      // Beste pick type conclusie
      + (bestType ? '<div style="background:rgba(0,190,196,.06);border:1px solid rgba(0,190,196,.2);border-radius:10px;padding:.5rem .7rem;font-family:\'IBM Plex Mono\',monospace;font-size:.60rem;color:rgba(255,255,255,.95);">'
        + '💡 <b style="color:#ffffff;">Beste pick type:</b> <span style="color:#00BEC4;font-weight:700;">'
        + (bestType[0]==='1'?'Thuisploeg wint':bestType[0]==='2'?'Uitploeg wint':bestType[0]==='X'?'Gelijkspel':bestType[0])
        + '</span> · ' + Math.round(bestType[1].wins/bestType[1].total*100) + '% hitrate (' + bestType[1].total + 'x)'
        + '</div>' : '')

      + '</div>';
  }

    html += '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.7rem;">'
      + '<div style="width:3px;height:1.1rem;background:#c9a84c;border-radius:2px;flex-shrink:0;"></div>'
      + '<div style="font-family:\'Bebas Neue\',\'DM Sans\',sans-serif;font-size:1.4rem;letter-spacing:.04em;color:#ffffff;">SCANS</div>'
      + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.72rem;font-weight:700;color:#c9a84c;background:rgba(201,168,76,.12);border:1px solid rgba(201,168,76,.3);border-radius:99px;padding:.1rem .5rem;">' + log.length + '</div>'
      + '</div>';

  if (!log.length) {
    html += '<div style="text-align:center;padding:2.5rem 1rem;background:rgba(255,255,255,.05);border-radius:16px;border:1px dashed rgba(201,168,76,.4);">'
      + '<div style="font-size:2rem;margin-bottom:.5rem;">🎯</div>'
      + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.68rem;color:#ffffff;font-weight:700;">Nog geen scans</div>'
      + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.72rem;color:rgba(255,255,255,.95);margin-top:.3rem;">Voer een value scan uit via de Scan &amp; Analyse tab</div>'
      + '</div>';
  } else {
  // Compacte weergave: max 20 zichtbaar
  window._scanLogPage = window._scanLogPage || 1;
  var PAGE_SIZE = 20;
  var visibleLog = filteredLog.slice(0, window._scanLogPage * PAGE_SIZE);
  
  visibleLog.forEach(function(scan, si) {
      var sw = scan.picks.filter(p=>p.status==='win').length;
      var sl = scan.picks.filter(p=>p.status==='lose').length;
      var sp = scan.picks.filter(p=>p.status==='pending').length;
      var scanId = String(scan.id||si);
      var collapseId = 'scan-collapse-' + scanId;
      var hrPct = (sw+sl) ? Math.round(sw/(sw+sl)*100) : null;
      var hrColor = hrPct===null?'#94a3b8':hrPct>=60?'#00BEC4':hrPct>=40?'#d97706':'#dc2626';
      var scanFace = (function() {
        if (!sw && !sl) return '😶';
        if (hrPct >= 70) return '😄';
        if (hrPct >= 50) return '🙂';
        if (hrPct >= 35) return '😐';
        if (hrPct >= 20) return '😕';
        return '😢';
      })();

      // Scan card header — zelfde stijl als match-card
      html += '<div class="match-card" style="margin-bottom:.6rem;padding:0;background:var(--card);">';
      
      // Header — klikbaar voor inklapbaar
      html += '<div onclick="(function(el){var c=document.getElementById(\'' + collapseId + '\');if(!c)return;var open=c.style.display!==\'none\';c.style.display=open?\'none\':\'block\';el.querySelector(\'.scan-chevron\').style.transform=open?\'rotate(0deg)\':\'rotate(180deg)\';}).call(null,this.closest(\'.match-card\'))" '
        + 'style="display:flex;align-items:center;justify-content:space-between;padding:.7rem .9rem;cursor:pointer;border-bottom:1px solid var(--stroke);">';
      
      // Links: nummer + datum
      html += '<div style="display:flex;align-items:center;gap:.5rem;">';
      html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.64rem;font-weight:800;color:#C9A84C;">#' + (log.length-si) + '</div>';
      html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.56rem;color:rgba(255,255,255,.95);">';
      html += (function() {
          var times = scan.picks.filter(function(p){return !!p.matchTime;}).map(function(p){return new Date(p.matchTime).getTime();}).filter(function(t){return !isNaN(t) && new Date(t).getFullYear()>=2024 && new Date(t).getFullYear()<=2031;});
          if (!times.length) return scan.date||'';
          times.sort(function(a,b){return a-b;});
          var earliest = new Date(times[0]);
          var latest = new Date(times[times.length-1]);
          var fmt = function(d){return d.getDate()+'-'+(d.getMonth()+1)+'-'+d.getFullYear();};
          if (times.length===1||earliest.toDateString()===latest.toDateString()) return fmt(earliest);
          return fmt(earliest)+' t/m '+fmt(latest);
        })();
      html += '</div></div>';
      
      // Rechts: badges + smiley + chevron
      html += '<div style="display:flex;align-items:center;gap:.35rem;">';
      if (sw) html += '<span style="background:rgba(0,190,196,.15);color:#00BEC4;font-family:\'IBM Plex Mono\',monospace;font-size:.64rem;font-weight:800;border-radius:8px;padding:.1rem .4rem;">' + sw + 'W</span>';
      if (sl) html += '<span style="background:rgba(220,38,38,.12);color:#dc2626;font-family:\'IBM Plex Mono\',monospace;font-size:.64rem;font-weight:800;border-radius:8px;padding:.1rem .4rem;">' + sl + 'V</span>';
      if (sp) html += '<span style="background:rgba(201,168,76,.12);color:#C9A84C;font-family:\'IBM Plex Mono\',monospace;font-size:.64rem;font-weight:800;border-radius:8px;padding:.1rem .4rem;">' + sp + '⏳</span>';
      html += '<span style="font-size:.9rem;">' + scanFace + '</span>';
      html += '<button class="delete-scan-btn" data-scan="' + scanId + '" style="background:rgba(220,38,38,.08);border:1px solid rgba(220,38,38,.2);color:#dc2626;border-radius:8px;padding:.15rem .35rem;font-size:.62rem;cursor:pointer;">🗑</button>';
      html += '<svg class="scan-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="2.5" style="transition:transform .2s;flex-shrink:0;"><polyline points="6 9 12 15 18 9"/></svg>';
      html += '</div>';
      html += '</div>'; // einde header
      
      // Picks — standaard ingeklapt
      html += '<div id="' + collapseId + '" style="display:none;">';
      
      scan.picks.forEach(function(p) {
        var icon = p.status==='win' ? '✅' : p.status==='lose' ? '❌' : p.status==='void' ? '⬜' : '⏳';
        var pickId = String(p.fixtureId || p.id || '');
        var pickType = String(p.pick || '');
        var manualBtn = p.status === 'pending'
          ? '<button class="manual-verify-btn" data-scan="' + scanId + '" data-pick="' + pickId + '" data-type="' + pickType + '" data-match="' + (p.match||'').replace(/"/g,'') + '" style="font-family:monospace;font-size:.54rem;padding:2px 6px;border-radius:6px;background:rgba(0,190,196,.1);border:1px solid rgba(0,190,196,.25);color:#00BEC4;cursor:pointer;flex-shrink:0;">✏ Score</button>'
          : '';
        var deletePickBtn = '<button class="delete-pick-btn" data-scan="' + scanId + '" data-pick="' + pickId + '" data-type="' + pickType + '" style="font-family:monospace;font-size:.54rem;padding:2px 5px;border-radius:6px;background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.15);color:#dc2626;cursor:pointer;flex-shrink:0;">🗑</button>';
        var vColor = (p.value||0) >= 20 ? '#00BEC4' : (p.value||0) >= 10 ? '#d97706' : 'rgba(255,255,255,.4)';
        var sharpBadge = p.sharp ? '<span style="font-size:.36rem;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);color:#ef4444;border-radius:4px;padding:1px 4px;font-family:\'IBM Plex Mono\',monospace;font-weight:700;">🔥 SHARP</span>' : '';
        
        html += '<div style="display:flex;align-items:flex-start;gap:.5rem;padding:.55rem .9rem;border-top:1px solid rgba(255,255,255,.05);">';
        html += '<div style="font-size:.85rem;flex-shrink:0;margin-top:.05rem;">' + icon + '</div>';
        html += '<div style="flex:1;min-width:0;">';
        html += '<div style="font-family:\'DM Sans\',sans-serif;font-size:.72rem;font-weight:700;color:#ffffff;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' + p.match + (sharpBadge?' '+sharpBadge:'') + '</div>';
        html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.54rem;color:rgba(255,255,255,.95);margin-top:.1rem;">'
          + '<span style="color:rgba(255,255,255,.8);">' + (p.pickLabel||p.pick) + '</span>'
          + ' <span style="color:rgba(255,255,255,.88);">@</span> <span style="color:#fff;font-weight:700;">' + p.odds + '</span>'
          + ' · <span style="color:' + vColor + ';font-weight:700;">' + (p.value||0).toFixed(1) + '% value</span>'
          + ' · conf ' + p.confidence + '/10'
          + '</div>';
        html += '</div>';
        if (p.score) html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.62rem;font-weight:800;color:#fff;background:rgba(255,255,255,.08);border-radius:8px;padding:.15rem .4rem;flex-shrink:0;">' + p.score + '</div>';
        html += manualBtn + deletePickBtn;
        html += '</div>';
      });
      
      html += '</div>'; // einde collapse
      html += '</div>'; // einde match-card
    });

  // Toon meer knop als er meer dan 20 zijn
  if (filteredLog.length > visibleLog.length) {
    var remaining = filteredLog.length - visibleLog.length;
    html += '<button onclick="window._scanLogPage=(window._scanLogPage||1)+1;renderScanLog()" style="width:100%;margin-top:.4rem;padding:.6rem;border-radius:12px;background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.25);font-family:monospace;font-size:.62rem;font-weight:700;color:#C9A84C;cursor:pointer;">▼ Toon ' + remaining + ' oudere scans</button>';
  }
  
  // Reset pagina bij nieuwe filter
  if (!window._scanLogPage) window._scanLogPage = 1;
  }

  el.innerHTML = html;

  // Teken scan log ROI curve
  setTimeout(function() {
    const c = document.getElementById('scanLogChart');
    if (c) c.width = c.parentElement?.offsetWidth || 320;
    if (!c || settled.length < 2) return;
    const ctx = c.getContext('2d');
    c.width = c.offsetWidth || 320; c.height = 80;
    const W = c.width, H = 80;
    ctx.clearRect(0,0,W,H);
    const points = [0];
    settled.forEach(p => { const last=points[points.length-1]; points.push(last+(p.status==='win'?(p.odds-1):-1)); });
    const minV=Math.min(...points,-0.5), maxV=Math.max(...points,0.5), range=maxV-minV;
    const pad={top:10,bottom:12,left:38,right:8};
    const cw=W-pad.left-pad.right, ch=H-pad.top-pad.bottom;
    const xP=i=>pad.left+(i/Math.max(points.length-1,1))*cw;
    const yP=v=>pad.top+ch-((v-minV)/range)*ch;
    const lastVal=points[points.length-1], isPos=lastVal>=0;
    const lineColor=isPos?'#00BEC4':'#dc2626';
    ctx.setLineDash([3,3]); ctx.strokeStyle='rgba(148,163,184,.4)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pad.left,yP(0)); ctx.lineTo(pad.left+cw,yP(0)); ctx.stroke();
    ctx.setLineDash([]);
    const grad=ctx.createLinearGradient(0,pad.top,0,pad.top+ch);
    grad.addColorStop(0,isPos?'rgba(21,128,61,.2)':'rgba(220,38,38,.15)');
    grad.addColorStop(1,'rgba(255,255,255,0)');
    ctx.beginPath(); ctx.moveTo(xP(0),yP(0));
    points.forEach((v,i)=>{ if(i>0) ctx.lineTo(xP(i),yP(v)); });
    ctx.lineTo(xP(points.length-1),H-pad.bottom); ctx.lineTo(xP(0),H-pad.bottom);
    ctx.closePath(); ctx.fillStyle=grad; ctx.fill();
    ctx.beginPath(); ctx.moveTo(xP(0),yP(0));
    points.forEach((v,i)=>{ if(i>0) ctx.lineTo(xP(i),yP(v)); });
    ctx.strokeStyle=lineColor; ctx.lineWidth=2; ctx.lineJoin='round'; ctx.stroke();
    settled.forEach((p,i) => {
      ctx.beginPath(); ctx.arc(xP(i+1),yP(points[i+1]),2.5,0,Math.PI*2);
      ctx.fillStyle=p.status==='win'?'#00BEC4':'#dc2626';
      ctx.fill(); ctx.strokeStyle='#fff'; ctx.lineWidth=1; ctx.stroke();
    });
    ctx.fillStyle='#94a3b8'; ctx.font='9px monospace'; ctx.textAlign='right';
    ctx.fillText((lastVal>=0?'+':'')+lastVal.toFixed(2)+' €/pick', pad.left-2, yP(lastVal)+3);
  }, 200);

  // Verwijder pick knop
  el.addEventListener('click', function(e) {
    const btn = e.target.closest('.delete-pick-btn');
    if (!btn) return;
    const scanId = btn.dataset.scan;
    const pickId = btn.dataset.pick;
    const pickType = btn.dataset.type;
    if (!confirm('Pick verwijderen uit scan log?')) return;
    const scanIdx = state.scanLog.findIndex(s => String(s.id||'') === scanId);
    if (scanIdx === -1) return;
    state.scanLog[scanIdx].picks = state.scanLog[scanIdx].picks.filter(p =>
      !(String(p.fixtureId||p.id||'') === pickId && String(p.pick||'') === pickType)
    );
    // Verwijder lege scans
    if (state.scanLog[scanIdx].picks.length === 0) {
      state.scanLog.splice(scanIdx, 1);
    }
    saveState();
    renderScanLog();
    showToast('🗑 Pick verwijderd');
  });

  // Verwijder hele scan knop
  el.addEventListener('click', function(e) {
    const btn = e.target.closest('.delete-scan-btn');
    if (!btn) return;
    const scanId = btn.dataset.scan;
    if (!confirm('Hele scan verwijderen?')) return;
    state.scanLog = state.scanLog.filter(s => String(s.id||'') !== scanId);
    saveState();
    renderScanLog();
    showToast('🗑 Scan verwijderd');
  });

  // v18.6: event delegation voor Score knoppen (data-attributen aanpak)
  el.addEventListener('click', function(e) {
    const btn = e.target.closest('.manual-verify-btn');
    if (!btn) return;
    const scanId = btn.dataset.scan;
    const pickId = btn.dataset.pick;
    const pickType = btn.dataset.type;
    const matchName = btn.dataset.match;
    showManualVerify(scanId, pickId, pickType, matchName);
  });
}


function showScanPopup(scanIdx) {
  const log = state.scanLog || [];
  const scan = log[scanIdx];
  if (!scan) return;

  const sw = scan.picks.filter(p=>p.status==='win').length;
  const sl = scan.picks.filter(p=>p.status==='lose').length;
  const sp = scan.picks.filter(p=>p.status==='pending').length;
  const scanHr = (sw+sl) ? Math.round(sw/(sw+sl)*100) : null;
  const hrColor = n => n >= 55 ? '#00BEC4' : n >= 45 ? '#d97706' : '#dc2626';
  const scanFace = (function() {
    if (!sw && !sl) return '😶';
    var hr = sw / (sw + sl) * 100;
    if (hr >= 70) return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00BEC4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 3 4 3 4-3 4-3"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>';
    if (hr >= 50) return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>';
    if (hr >= 35) return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>';
    if (hr >= 20) return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 15s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>';
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-3-4-3-4 3-4 3"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>';
  })();

  // Verwijder bestaande popup
  const existing = document.getElementById('scanPopupOverlay');
  if (existing) existing.remove();

  let picksHtml = '';
  scan.picks.forEach(function(p) {
    const icon = p.status==='win' ? '✅' : p.status==='lose' ? '❌' : p.status==='void' ? '⬜' : '⏳';
    const statusColor = p.status==='win' ? '#00BEC4' : p.status==='lose' ? '#dc2626' : p.status==='void' ? '#94a3b8' : '#d97706';
    const elite = p.elite ? '<span style="background:rgba(0,190,196,.12);color:#00BEC4;border:1px solid rgba(0,190,196,.25);font-family:monospace;font-size:.46rem;font-weight:700;padding:1px 6px;border-radius:4px;margin-left:.3rem;">⭐ ELITE</span>' : '';
    const lockBadge = p.lock === 'triple' ? '<span style="background:rgba(0,190,196,.12);color:#00BEC4;border:1px solid rgba(0,190,196,.25);font-family:monospace;font-size:.46rem;font-weight:700;padding:1px 6px;border-radius:4px;margin-left:.3rem;">🏆 TRIPLE</span>'
      : p.lock === 'double' ? '<span style="background:rgba(0,190,196,.1);color:#1d4ed8;border:1px solid rgba(0,190,196,.2);font-family:monospace;font-size:.46rem;font-weight:700;padding:1px 6px;border-radius:4px;margin-left:.3rem;">🔒 DOUBLE</span>' : '';

    picksHtml += `<div style="background:var(--card-bg,rgba(0,0,0,.03));border:1px solid var(--card-bg,rgba(0,0,0,.07));border-radius:12px;padding:.7rem .85rem;margin-bottom:.5rem;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.35rem;">
        <div style="display:flex;align-items:center;gap:.4rem;flex:1;min-width:0;">
          <span style="font-size:1rem;">${icon}</span>
          <div style="font-family:\'DM Sans\',sans-serif;font-size:.72rem;font-weight:700;color:var(--ink,#0f172a);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${p.match||''}</div>
        </div>
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.52rem;font-weight:700;color:${statusColor};white-space:nowrap;margin-left:.4rem;">${p.status==='win'?'WIN':p.status==='lose'?'VERLIES':p.status==='void'?'VOID':'PENDING'}</div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:.3rem;margin-bottom:.35rem;">
        <span style="background:rgba(0,190,196,.1);color:#6d28d9;border:1px solid rgba(0,190,196,.2);font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;font-weight:700;padding:2px 7px;border-radius:4px;">${p.pickLabel||p.pick}</span>
        <span style="background:var(--card-bg,rgba(0,0,0,.06));color:var(--ink,#0f172a);border:1px solid rgba(15,23,42,.1);font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;padding:2px 7px;border-radius:4px;">@ ${p.odds}</span>
        <span style="background:rgba(0,190,196,.08);color:#1d4ed8;border:1px solid rgba(0,190,196,.18);font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;padding:2px 7px;border-radius:4px;">${(p.value||0).toFixed(1)}% value</span>
        <span style="background:rgba(255,255,255,.07);color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.1);font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;padding:2px 7px;border-radius:4px;">conf ${p.confidence}/10</span>
        ${p.confidenceFinal ? `<span style="background:rgba(0,190,196,.08);color:#00BEC4;border:1px solid rgba(0,190,196,.2);font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;padding:2px 7px;border-radius:4px;">CI ${p.confidenceFinal}</span>` : ''}
        ${elite}${lockBadge}
      </div>
      ${p.comp ? `<div style="font-family:monospace;font-size:.42rem;color:rgba(255,255,255,.95);">${p.comp}${p.score ? ' &middot; Score: <b>' + p.score + '</b>' : ''}</div>` : ''}
    </div>`;
  });

  const overlay = document.createElement('div');
  overlay.id = 'scanPopupOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9998;display:flex;align-items:flex-end;justify-content:center;padding:0;backdrop-filter:blur(2px);';
  overlay.innerHTML = `
    <div style="background:var(--sheet-bg,#0d1e24);border-radius:20px 20px 0 0;width:100%;max-width:600px;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -8px 32px rgba(15,23,42,.18);">
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.85rem 1rem .7rem;border-bottom:1px solid var(--track-bg,rgba(0,0,0,.08));">
        <div>
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.2rem;color:var(--ink,#0f172a);">
            SCAN #${log.length - scanIdx}
            <span style="font-size:1.6rem;margin-left:.3rem;">${scanFace}</span>
          </div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.48rem;color:rgba(255,255,255,.95);margin-top:.1rem;">${scan.date} · ${scan.time||''}</div>
        </div>
        <div style="display:flex;gap:.5rem;align-items:center;">
          ${scanHr !== null ? `<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.52rem;font-weight:700;color:${hrColor(scanHr)};">${scanHr}% HR</div>` : ''}
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:rgba(255,255,255,.95);">
            ${sw ? `<span style="color:#00BEC4;">${sw}W</span> ` : ''}${sl ? `<span style="color:#dc2626;">${sl}V</span> ` : ''}${sp ? `<span style="color:#d97706;">${sp}⏳</span>` : ''}
          </div>
          <button onclick="document.getElementById('scanPopupOverlay').remove()"
            style="background:var(--card-bg,rgba(0,0,0,.07));border:none;border-radius:50%;width:2rem;height:2rem;font-size:.9rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
        </div>
      </div>
      <!-- Picks lijst -->
      <div style="overflow-y:auto;padding:.8rem 1rem 1.5rem;flex:1;">
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.48rem;font-weight:700;color:rgba(255,255,255,.95);margin-bottom:.6rem;">${scan.picks.length} PICKS</div>
        ${picksHtml}
      </div>
    </div>`;

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}


function showScanLogStatsPopup() {
  const log = state.scanLog || [];
  const allPicks = log.flatMap(s => s.picks);
  const settled  = allPicks.filter(p => p.status === 'win' || p.status === 'lose');
  const wins     = settled.filter(p => p.status === 'win');
  const hitrate  = settled.length ? Math.round(wins.length / settled.length * 100) : 0;
  const roi      = settled.length
    ? settled.reduce((s,p) => s + (p.status==='win' ? (p.odds-1) : -1), 0) / settled.length * 100 : 0;
  const avgOdds  = settled.length ? settled.reduce((s,p)=>s+(p.odds||0),0)/settled.length : 0;
  const avgValue = allPicks.length ? allPicks.reduce((s,p)=>s+(p.value||0),0)/allPicks.length : 0;
  const hrColor  = n => n >= 55 ? '#00BEC4' : n >= 45 ? '#d97706' : '#dc2626';

  // Per type
  const byType = {};
  settled.forEach(p => {
    const t = p.pick||'?';
    if (!byType[t]) byType[t]={wins:0,total:0};
    byType[t].total++;
    if (p.status==='win') byType[t].wins++;
  });

  // Per competitie
  const byComp = {};
  settled.forEach(p => {
    const c = p.comp||'Overig';
    if (!byComp[c]) byComp[c]={wins:0,total:0,roi:0};
    byComp[c].total++;
    if (p.status==='win') { byComp[c].wins++; byComp[c].roi+=(p.odds-1); }
    else byComp[c].roi-=1;
  });

  // Per odds range
  const byOdds = {'1.0-1.5':[],'1.5-2.0':[],'2.0-3.0':[],'3.0-5.0':[],'5.0+':[]};
  settled.forEach(p => {
    const o = p.odds||0;
    const b = o<1.5?'1.0-1.5':o<2.0?'1.5-2.0':o<3.0?'2.0-3.0':o<5.0?'3.0-5.0':'5.0+';
    byOdds[b].push(p.status==='win');
  });

  // Value kalibratie
  const vb = {'0-10%':[],'10-20%':[],'20-30%':[],'30%+':[]};
  settled.forEach(p => {
    const v = p.value||0;
    const b = v<10?'0-10%':v<20?'10-20%':v<30?'20-30%':'30%+';
    vb[b].push(p.status==='win');
  });

  const existing = document.getElementById('scanStatsPopupOverlay');
  if (existing) existing.remove();

  let body = '';

  // Stat blokken
  body += `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.5rem;margin-bottom:.8rem;">
    ${[
      ['PICKS TOTAAL', allPicks.length, '#2563eb'],
      ['AFGEROND', settled.length, '#00a8ad'],
      ['HITRATE', hitrate+'%', hrColor(hitrate)],
      ['ROI', (roi>=0?'+':'')+roi.toFixed(1)+'%', roi>=0?'#00BEC4':'#dc2626'],
      ['GEM. ODDS', avgOdds.toFixed(2), '#0f172a'],
      ['GEM. VALUE', avgValue.toFixed(1)+'%', '#00BEC4'],
    ].map(([lbl,val,col]) => `<div style="background:var(--card-bg,rgba(0,0,0,.04));border-radius:12px;padding:.6rem .7rem;text-align:center;">
      <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.1rem;color:${col};">${val}</div>
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:rgba(255,255,255,.95);">${lbl}</div>
    </div>`).join('')}
  </div>`;

  // Per pick type
  if (Object.keys(byType).length) {
    body += `<div style="background:var(--card-bg,rgba(0,0,0,.03));border-radius:12px;padding:.7rem .85rem;margin-bottom:.6rem;">
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:700;color:rgba(255,255,255,.95);margin-bottom:.5rem;">🎯 PER PICK TYPE</div>`;
    Object.entries(byType).sort((a,b)=>b[1].total-a[1].total).forEach(([type,s]) => {
      const hr = Math.round(s.wins/s.total*100);
      body += `<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.3rem;">
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.52rem;font-weight:700;min-width:2.5rem;">${type}</div>
        <div style="flex:1;background:var(--track-bg,rgba(0,0,0,.08));border-radius:999px;height:6px;">
          <div style="height:100%;border-radius:999px;background:${hrColor(hr)};width:${hr}%;"></div></div>
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.48rem;color:rgba(255,255,255,.95);min-width:4rem;text-align:right;">${hr}% (${s.total})</div>
      </div>`;
    });
    body += '</div>';
  }

  // Per competitie
  if (Object.keys(byComp).length) {
    body += `<div style="background:var(--card-bg,rgba(0,0,0,.03));border-radius:12px;padding:.7rem .85rem;margin-bottom:.6rem;">
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:700;color:rgba(255,255,255,.95);margin-bottom:.5rem;">🏆 PER COMPETITIE</div>`;
    Object.entries(byComp).sort((a,b)=>(b[1].roi/b[1].total)-(a[1].roi/a[1].total)).slice(0,8).forEach(([comp,s]) => {
      const hr = Math.round(s.wins/s.total*100);
      const roi = (s.roi/s.total*100).toFixed(1);
      body += `<div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.3rem;">
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${comp}</div>
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.48rem;font-weight:700;color:${hrColor(hr)};">${hr}%</div>
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:${parseFloat(roi)>=0?'#00BEC4':'#dc2626'};">${parseFloat(roi)>=0?'+':''}${roi}% ROI</div>
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:rgba(255,255,255,.95);">${s.total}x</div>
      </div>`;
    });
    body += '</div>';
  }

  // Per odds range
  body += `<div style="background:var(--card-bg,rgba(0,0,0,.03));border-radius:12px;padding:.7rem .85rem;margin-bottom:.6rem;">
    <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:700;color:rgba(255,255,255,.95);margin-bottom:.5rem;">📊 PER ODDS RANGE</div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.3rem;">`;
  Object.entries(byOdds).forEach(([range,results]) => {
    const tot = results.length;
    const wr  = tot ? Math.round(results.filter(Boolean).length/tot*100) : null;
    body += `<div style="text-align:center;background:var(--card-bg,rgba(0,0,0,.04));border-radius:8px;padding:.4rem .2rem;">
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:rgba(255,255,255,.95);">${range}</div>
      <div style="font-family:\'Bebas Neue\',sans-serif;font-size:.9rem;color:${wr===null?'var(--sub)':hrColor(wr)};">${wr===null?'—':wr+'%'}</div>
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:rgba(255,255,255,.95);">${tot}x</div>
    </div>`;
  });
  body += '</div></div>';

  // Value kalibratie
  body += `<div style="background:var(--card-bg,rgba(0,0,0,.03));border-radius:12px;padding:.7rem .85rem;margin-bottom:.6rem;">
    <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:700;color:rgba(255,255,255,.95);margin-bottom:.5rem;">📐 VALUE KALIBRATIE</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.3rem;">`;
  Object.entries(vb).forEach(([range,results]) => {
    const tot = results.length;
    const wr  = tot ? Math.round(results.filter(Boolean).length/tot*100) : null;
    body += `<div style="text-align:center;background:var(--card-bg,rgba(0,0,0,.04));border-radius:8px;padding:.4rem .2rem;">
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:rgba(255,255,255,.95);">${range}</div>
      <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1rem;color:${wr===null?'var(--sub)':hrColor(wr)};">${wr===null?'—':wr+'%'}</div>
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:rgba(255,255,255,.95);">${tot} picks</div>
    </div>`;
  });
  body += '</div></div>';

  const overlay = document.createElement('div');
  overlay.id = 'scanStatsPopupOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9998;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(2px);';
  overlay.innerHTML = `
    <div style="background:var(--sheet-bg,#0d1e24);border-radius:20px 20px 0 0;width:100%;max-width:600px;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -8px 32px rgba(15,23,42,.18);">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.85rem 1rem .7rem;border-bottom:1px solid var(--track-bg,rgba(0,0,0,.08));">
        <div>
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.2rem;color:var(--ink,#0f172a);">📊 SCAN LOG STATISTIEKEN</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:rgba(255,255,255,.95);margin-top:.1rem;">${allPicks.length} picks · ${settled.length} afgerond</div>
        </div>
        <button onclick="document.getElementById('scanStatsPopupOverlay').remove()"
          style="background:var(--card-bg,rgba(0,0,0,.07));border:none;border-radius:50%;width:2rem;height:2rem;font-size:.9rem;cursor:pointer;">✕</button>
      </div>
      <div style="overflow-y:auto;padding:.8rem 1rem 1.5rem;flex:1;">${body}</div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

function exportScanLogCSV() {
  const log = state.scanLog || [];
  if (!log.length) { showToast('Geen scan data'); return; }
  const rows = [['Scan#','Datum','Tijd','Wedstrijd','Competitie','Pick','Odds','Value%','Confidence','Status','Score']];
  log.forEach(function(scan, si) {
    scan.picks.forEach(function(p) {
      rows.push([
        log.length - si, scan.date, scan.time,
        p.match, p.comp||'', p.pickLabel||p.pick,
        p.odds, (p.value||0).toFixed(1), p.confidence,
        p.status, p.score||''
      ]);
    });
  });
  const csv = rows.map(r => r.join(',')).join('\n');
  downloadFile(csv, 'TOTO-AI-scanlog-' + new Date().toISOString().split('T')[0] + '.csv', 'text/csv;charset=utf-8;');
  showToast('📥 Scan log gedownload');
}

// ── Analyse tip knoppen ───────────────────────────────
function openBetFromAnalyse() {
  const tip = state.lastAnalyseTip;
  if (!tip) { showToast('Geen analyse tip beschikbaar'); return; }

  const m = state.selectedMatch;
  if (m && !state.matches.find(x => String(x.id) === String(m.id))) {
    state.matches.unshift(m);
  }

  const title = document.getElementById('bet-modal-title');
  if (title) title.textContent = (tip.home||'') + ' vs ' + (tip.away||'') + ' — ' + (tip.pickLabel||tip.pick) + ' @ ' + tip.odds;

  const matchInput = document.getElementById('bet-match');
  if (matchInput) matchInput.value = (tip.home||'') + ' vs ' + (tip.away||'');

  const stakeInput = document.getElementById('bet-stake');
  if (stakeInput) stakeInput.value = state.settings.defaultBet || 10;

  const oddsInput = document.getElementById('bet-odds');
  if (oddsInput) oddsInput.value = tip.odds;

  const noteInput = document.getElementById('bet-note');
  if (noteInput) noteInput.value = tip.pickLabel || tip.pick;

  pendingBet = {
    match: m || { id: tip.matchId, home: tip.home||'', away: tip.away||'' },
    pick: tip.pick, pickLabel: tip.pickLabel||tip.pick,
    odds: parseFloat(tip.odds), markt: '1X2',
    _origPick: tip.pick, _origPickLabel: tip.pickLabel||tip.pick, _origOdds: parseFloat(tip.odds)
  };

  const modal = document.getElementById('bet-modal');
  if (modal) modal.style.display = 'flex';
}

// ── AI Match Chat ─────────────────────────────────────────

let _chatHistory = [];
let _chatMatchId = null;

function openMatchChat() {
  const m = state.selectedMatch;
  if (!m) return;

  if (_chatMatchId !== m.id) {
    _chatHistory = [];
    _chatMatchId = m.id;
    const msgs = document.getElementById('chatMessages');
    if (msgs) msgs.innerHTML = '';
  }

  const section = document.getElementById('matchChatSection');
  const btn = document.getElementById('openChatBtn');
  if (section) section.style.display = 'block';
  if (btn) btn.style.display = 'none';

  const sugg = document.getElementById('chatSuggestions');
  if (sugg && !sugg.children.length) {
    const suggestions = [
      'Wat is jouw beste pick?',
      'Hoe zit het met de verdediging?',
      'Is er value in de odds?',
      'Wat zijn de risicofactoren?',
      'Verwacht je doelpunten?'
    ];
    sugg.innerHTML = suggestions.map(s =>
      `<button onclick="setChatInput('${s}')"
        style="font-family:monospace;font-size:.46rem;padding:2px 8px;border-radius:999px;
        background:rgba(0,190,196,.08);border:1px solid rgba(0,190,196,.2);
        color:#00a8ad;cursor:pointer;white-space:nowrap;">${s}</button>`
    ).join('');
  }

  setTimeout(() => document.getElementById('chatInput')?.focus(), 100);
}

function setChatInput(text) {
  const input = document.getElementById('chatInput');
  if (input) { input.value = text; input.focus(); }
}

function appendChatMsg(role, text, isLoading = false) {
  const msgs = document.getElementById('chatMessages');
  if (!msgs) return;
  const isUser = role === 'user';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;justify-content:${isUser?'flex-end':'flex-start'};margin-bottom:.4rem;`;
  div.innerHTML = `
    <div style="max-width:85%;padding:.5rem .7rem;border-radius:${isUser?'12px 12px 2px 12px':'12px 12px 12px 2px'};
      background:${isUser?'rgba(0,190,196,.15)':'rgba(255,255,255,0.05)'};
      border:1px solid ${isUser?'rgba(0,190,196,.25)':'rgba(255,255,255,0.09)'};
      font-family:${isUser?'monospace':'inherit'};font-size:.72rem;line-height:1.6;color:#ffffff;">
      ${isLoading ? '<span style="opacity:.5;">⟳ Nadenken...</span>' : text}
    </div>`;
  div.id = isLoading ? 'chat-loading' : '';
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

async function sendMatchChat() {
  const input = document.getElementById('chatInput');
  const question = input?.value.trim();
  if (!question) return;

  const m = state.selectedMatch;
  if (!m) { showToast('Selecteer eerst een wedstrijd'); return; }

  input.value = '';
  input.disabled = true;

  appendChatMsg('user', question);
  _chatHistory.push({ role: 'user', content: question });

  appendChatMsg('assistant', '', true);

  try {
    const matchCtx = state._lastAnalyseContext ||
      `Wedstrijd: ${m.home} vs ${m.away} | ${m.comp} | ${m.date} ${m.time} | Quotes: 1=${m.homeOdds} X=${m.drawOdds} 2=${m.awayOdds}`;

    const analyseSummary = state._lastAnalyseResult ? `
Vorm: ${state._lastAnalyseResult.vorm || ''}
Stats: ${state._lastAnalyseResult.stats || ''}
Kansen: ${state._lastAnalyseResult.kans || ''}
Advies: ${state._lastAnalyseResult.advies || ''}` : '';

    const historyToSend = _chatHistory.slice(-6);

    const data = await anthropicFetch(null, {
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: `Je bent een voetbalanalist die vragen beantwoordt over een specifieke wedstrijd. 
Geef korte, directe antwoorden (max 3-4 zinnen). Gebruik de beschikbare data.
Wedstrijd context:
${matchCtx}${analyseSummary}`,
      messages: historyToSend
    });

    const loading = document.getElementById('chat-loading');
    if (loading) loading.remove();

    const answer = data.content?.[0]?.text || 'Geen antwoord ontvangen';
    appendChatMsg('assistant', answer);
    _chatHistory.push({ role: 'assistant', content: answer });

    if (_chatHistory.length > 20) _chatHistory = _chatHistory.slice(-20);

  } catch(e) {
    const loading = document.getElementById('chat-loading');
    if (loading) loading.remove();
    appendChatMsg('assistant', `⚠ Fout: ${e.message}`);
  }

  input.disabled = false;
  input.focus();
}

function addCombiFromAnalyse() {
  const tip = state.lastAnalyseTip;
  if (!tip) { showToast('Geen analyse tip beschikbaar'); return; }
  if (!state.combiBuilder) state.combiBuilder = [];
  const exists = state.combiBuilder.some(l => String(l.matchId) === String(tip.matchId));
  if (exists) { showToast('Al in combi'); return; }
  state.combiBuilder.push({
    matchId: tip.matchId,
    pick: tip.pick,
    pickLabel: tip.pickLabel || tip.pick,
    odds: parseFloat(tip.odds),
    home: tip.home || '',
    away: tip.away || ''
  });
  saveState();
  showToast('➕ ' + (tip.home||'') + ' toegevoegd aan combi');
}


// ═══════════════════════════════════════════════════════
// HANDMATIGE VERIFICATIE — v18.6
// Voor picks waarvan API-Football geen resultaat geeft
// ═══════════════════════════════════════════════════════

function showManualVerify(scanId, pickId, pick, matchName) {
  // Verwijder bestaande modal als die er al is
  const existing = document.getElementById('manual-verify-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'manual-verify-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.7);z-index:9000;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px);';
  modal.innerHTML = `
    <div style="background:rgba(255,255,255,0.05);border-radius:20px 20px 0 0;padding:1.25rem 1.25rem 2rem;
      width:100%;max-width:480px;box-shadow:0 -8px 32px rgba(15,23,42,.2);">
      <div style="width:36px;height:4px;background:rgba(15,23,42,.15);border-radius:999px;margin:0 auto .75rem;"></div>
      <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.1rem;color:#ffffff;margin-bottom:.3rem;">
        ✏ SCORE INVOEREN
      </div>
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.56rem;color:rgba(255,255,255,.95);margin-bottom:1rem;line-height:1.6;">
        ${matchName}<br>
        Pick: <b style="color:#ffffff;">${pick}</b>
      </div>
      <div style="margin-bottom:1rem;">
        <label style="font-family:\'IBM Plex Mono\',monospace;font-size:.52rem;color:rgba(255,255,255,.95);display:block;margin-bottom:.4rem;">
          EINDSTAND (bijv. 2-1)
        </label>
        <input id="manual-score-input" type="text" placeholder="0-0"
          style="width:100%;font-family:\'Bebas Neue\',sans-serif;font-size:1.4rem;text-align:center;
          padding:.6rem;border-radius:12px;border:2px solid rgba(255,255,255,0.09);
          background:rgba(255,255,255,0.05);color:#ffffff;outline:none;letter-spacing:.1em;"
          oninput="updateManualPreview('${pick}', this.value)">
      </div>
      <div id="manual-verify-preview" style="font-family:\'IBM Plex Mono\',monospace;font-size:.58rem;
        text-align:center;padding:.5rem;border-radius:8px;margin-bottom:1rem;min-height:1.5rem;"></div>
      <div style="display:flex;gap:.5rem;">
        <button onclick="document.getElementById('manual-verify-modal').remove()"
          style="flex:1;padding:.65rem;border-radius:12px;background:var(--card-bg,rgba(0,0,0,.06));
          border:1px solid rgba(255,255,255,0.09);font-family:\'IBM Plex Mono\',monospace;
          font-size:.6rem;font-weight:700;color:rgba(255,255,255,.95);cursor:pointer;">
          Annuleren
        </button>
        <button onclick="confirmManualVerify('${scanId}','${pickId}','${pick}')"
          style="flex:2;padding:.65rem;border-radius:12px;
          background:linear-gradient(135deg,rgba(0,190,196,.85),rgba(0,190,196,.8));
          color:#fff;border:none;font-family:\'IBM Plex Mono\',monospace;
          font-size:.6rem;font-weight:800;cursor:pointer;letter-spacing:.04em;">
          ✓ BEVESTIGEN
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  // Focus input
  setTimeout(() => document.getElementById('manual-score-input')?.focus(), 100);
  // Sluit bij tik buiten sheet
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function updateManualPreview(pick, scoreStr) {
  const preview = document.getElementById('manual-verify-preview');
  if (!preview) return;
  const parts = scoreStr.trim().split('-');
  if (parts.length !== 2) { preview.textContent = ''; return; }
  const hg = parseInt(parts[0]);
  const ag = parseInt(parts[1]);
  if (isNaN(hg) || isNaN(ag)) { preview.textContent = ''; return; }

  let won = false;
  const t = pick.toUpperCase();
  if      (t === '1')    won = hg > ag;
  else if (t === 'X')    won = hg === ag;
  else if (t === '2')    won = ag > hg;
  else if (t === '1X')   won = hg >= ag;
  else if (t === 'X2')   won = ag >= hg;
  else if (t === 'O2.5') won = (hg + ag) > 2.5;
  else if (t === 'U2.5') won = (hg + ag) < 2.5;
  else if (t === 'BTTS-J') won = hg > 0 && ag > 0;
  else if (t === 'BTTS-N') won = hg === 0 || ag === 0;

  preview.style.background = won ? 'rgba(0,190,196,.1)' : 'rgba(220,38,38,.08)';
  preview.style.color = won ? '#00BEC4' : '#dc2626';
  preview.style.border = `1px solid ${won ? 'rgba(0,190,196,.25)' : 'rgba(220,38,38,.2)'}`;
  preview.textContent = won ? `✅ WIN — pick ${pick} correct bij ${hg}-${ag}` : `❌ VERLIES — pick ${pick} fout bij ${hg}-${ag}`;
}

function confirmManualVerify(scanId, pickId, pick) {
  const input = document.getElementById('manual-score-input');
  const scoreStr = input?.value.trim();
  if (!scoreStr || !scoreStr.includes('-')) {
    showToast('Voer een geldige score in (bijv. 2-1)');
    return;
  }
  const parts = scoreStr.split('-');
  const hg = parseInt(parts[0]);
  const ag = parseInt(parts[1]);
  if (isNaN(hg) || isNaN(ag)) {
    showToast('Ongeldige score — gebruik formaat 2-1');
    return;
  }

  // Zoek de pick in scanLog
  const log = state.scanLog || [];
  let found = false;

  log.forEach(scan => {
    if (String(scan.id) !== String(scanId)) return;
    scan.picks.forEach(p => {
      const pId = String(p.fixtureId || p.id || '');
      if (pId !== String(pickId)) return;

      // Bereken resultaat
      const t = (p.pick || pick).toUpperCase();
      let won = false;
      if      (t === '1')      won = hg > ag;
      else if (t === 'X')      won = hg === ag;
      else if (t === '2')      won = ag > hg;
      else if (t === '1X')     won = hg >= ag;
      else if (t === 'X2')     won = ag >= hg;
      else if (t === 'O2.5')   won = (hg + ag) > 2.5;
      else if (t === 'U2.5')   won = (hg + ag) < 2.5;
      else if (t === 'BTTS-J') won = hg > 0 && ag > 0;
      else if (t === 'BTTS-N') won = hg === 0 || ag === 0;
      else won = false;

      p.status = won ? 'win' : 'lose';
      p.score = `${hg}-${ag}`;
      p.verifiedAt = new Date().toISOString();
      p.verifiedManually = true;
      found = true;
    });
  });

  if (!found) {
    showToast('Pick niet gevonden in scan log');
    return;
  }

  // Sync naar backtest
  syncScanLogToBacktest();
  saveState();

  // Sluit modal en herrender
  document.getElementById('manual-verify-modal')?.remove();
  showToast(`✅ Score ${hg}-${ag} opgeslagen`);
  renderScanLog();
}

// ══════════════════════════════════════════════════════════
// v144: MONTE CARLO BANKROLL SIMULATIE
// Simuleert 10.000 scenario's op basis van historische hitrate,
// gemiddelde odds en Kelly inzet.
// ══════════════════════════════════════════════════════════

function openMonteCarloModal() {
  document.getElementById('monteCarloOverlay')?.remove();

  // Haal stats op uit state
  const settled = (state.valueScans || []).filter(s => s.status === 'win' || s.status === 'lose');
  const wins    = settled.filter(s => s.status === 'win').length;
  const hitrate = settled.length > 0 ? wins / settled.length : 0.35;
  const avgOdds = settled.length > 0
    ? settled.reduce((sum, s) => sum + parseFloat(s.odds || 2), 0) / settled.length
    : 2.5;

  runMonteCarloSim(hitrate, avgOdds, 0.25, 100, 10000);
}

function runMonteCarloSim(hitrate, avgOdds, kellyFraction, nPicks, nSims) {
  document.getElementById('monteCarloOverlay')?.remove();

  // ── Simulatie ──────────────────────────────────────────
  const kellyStake = Math.max(0.01, Math.min(0.20,
    kellyFraction * ((hitrate * avgOdds - 1) / (avgOdds - 1))
  ));

  const finalBankrolls = [];
  const drawdowns      = [];
  let   allPaths       = []; // sample 200 paths voor grafiek

  for (let sim = 0; sim < nSims; sim++) {
    let bankroll = 1.0;
    let peak     = 1.0;
    let maxDD    = 0;
    const path   = sim < 200 ? [1.0] : null;

    for (let pick = 0; pick < nPicks; pick++) {
      const stake = bankroll * kellyStake;
      if (Math.random() < hitrate) {
        bankroll += stake * (avgOdds - 1);
      } else {
        bankroll -= stake;
      }
      bankroll = Math.max(0, bankroll);
      if (bankroll > peak) peak = bankroll;
      const dd = (peak - bankroll) / peak;
      if (dd > maxDD) maxDD = dd;
      if (path) path.push(parseFloat(bankroll.toFixed(3)));
    }

    finalBankrolls.push(bankroll);
    drawdowns.push(maxDD);
    if (path) allPaths.push(path);
  }

  // ── Statistieken ───────────────────────────────────────
  finalBankrolls.sort((a, b) => a - b);
  drawdowns.sort((a, b) => a - b);

  const p10  = finalBankrolls[Math.floor(nSims * 0.10)];
  const p25  = finalBankrolls[Math.floor(nSims * 0.25)];
  const p50  = finalBankrolls[Math.floor(nSims * 0.50)];
  const p75  = finalBankrolls[Math.floor(nSims * 0.75)];
  const p90  = finalBankrolls[Math.floor(nSims * 0.90)];
  const mean = finalBankrolls.reduce((a,b) => a+b, 0) / nSims;
  const pRuin= finalBankrolls.filter(b => b < 0.10).length / nSims * 100;
  const pProfit = finalBankrolls.filter(b => b > 1.0).length / nSims * 100;
  const medDD = drawdowns[Math.floor(nSims * 0.50)];
  const p90DD = drawdowns[Math.floor(nSims * 0.90)];

  // ── SVG grafiek (200 sample paths) ─────────────────────
  const W = 340, H = 160, PAD = 30;
  const maxB = Math.min(5, Math.max(...allPaths.flat()));
  const scaleX = (i) => PAD + (i / nPicks) * (W - PAD * 2);
  const scaleY = (v) => H - PAD - (Math.min(v, maxB) / maxB) * (H - PAD * 2);

  let svgPaths = '';
  allPaths.forEach((path, idx) => {
    const d = path.map((v, i) => `${i===0?'M':'L'}${scaleX(i).toFixed(1)},${scaleY(v).toFixed(1)}`).join(' ');
    const isBad = path[path.length-1] < 0.5;
    svgPaths += `<path d="${d}" stroke="${isBad?'rgba(220,38,38,.12)':'rgba(0,190,196,.08)'}" stroke-width="1" fill="none"/>`;
  });
  // Mediaan lijn
  const medPath = allPaths.sort((a,b) =>
    a[a.length-1] - b[b.length-1])[Math.floor(allPaths.length/2)];
  if (medPath) {
    const md = medPath.map((v,i) => `${i===0?'M':'L'}${scaleX(i).toFixed(1)},${scaleY(v).toFixed(1)}`).join(' ');
    svgPaths += `<path d="${md}" stroke="#00BEC4" stroke-width="2" fill="none"/>`;
  }
  // Baseline
  svgPaths += `<line x1="${PAD}" y1="${scaleY(1)}" x2="${W-PAD}" y2="${scaleY(1)}" stroke="rgba(255,255,255,.2)" stroke-width="1" stroke-dasharray="4"/>`;

  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;">
    <rect width="${W}" height="${H}" fill="transparent"/>
    ${svgPaths}
    <text x="${PAD}" y="${H-8}" font-family="monospace" font-size="9" fill="rgba(255,255,255,.3)">0</text>
    <text x="${W-PAD-10}" y="${H-8}" font-family="monospace" font-size="9" fill="rgba(255,255,255,.3)">${nPicks}</text>
    <text x="${PAD-5}" y="${scaleY(1)+4}" font-family="monospace" font-size="8" fill="rgba(255,255,255,.3)" text-anchor="end">1x</text>
    <text x="${PAD-5}" y="${scaleY(maxB)+4}" font-family="monospace" font-size="8" fill="rgba(255,255,255,.3)" text-anchor="end">${maxB.toFixed(1)}x</text>
  </svg>`;

  // ── UI ─────────────────────────────────────────────────
  function statRow(label, value, color) {
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:.35rem 0;border-bottom:1px solid rgba(255,255,255,.08);">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:13px;color:rgba(255,255,255,.88);">${label}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:800;color:${color||'#fff'};white-space:nowrap;margin-left:.5rem;">${value}</div>
    </div>`;
  }

  const overlay = document.createElement('div');
  overlay.id = 'monteCarloOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

  overlay.innerHTML = `
    <div style="background:#0d1f2d;border-radius:20px 20px 0 0;width:100%;max-width:100%;padding:1.25rem 1.25rem 2rem;max-height:92vh;overflow-y:auto;box-sizing:border-box;">

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:16px;font-weight:800;color:#00BEC4;">🎲 MONTE CARLO SIMULATIE</div>
        <button onclick="document.getElementById('monteCarloOverlay').remove()"
          style="background:rgba(255,255,255,.08);border:none;color:rgba(255,255,255,.7);border-radius:50%;width:28px;height:28px;cursor:pointer;">✕</button>
      </div>

      <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:rgba(255,255,255,.6);margin-bottom:.75rem;">
        ${nSims.toLocaleString()} simulaties · ${nPicks} picks · hitrate ${(hitrate*100).toFixed(1)}% · gem. odds ${avgOdds.toFixed(2)} · Kelly ${(kellyFraction*100).toFixed(0)}%
      </div>

      <!-- Grafiek -->
      <div style="background:rgba(255,255,255,.03);border-radius:12px;padding:.5rem;margin-bottom:.75rem;">
        ${svg}
        <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:rgba(255,255,255,.6);text-align:center;margin-top:.2rem;">200 sample-paden — cyaan = mediaan scenario</div>
      </div>

      <!-- Resultaten -->
      <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:.6rem .7rem;margin-bottom:.75rem;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:rgba(255,255,255,.7);font-weight:700;margin-bottom:.35rem;">BANKROLL UITKOMSTEN (startbankroll = 1x)</div>
        ${statRow('Pessimistisch (10%)', p10.toFixed(2)+'x', p10<1?'#dc2626':'#00BEC4')}
        ${statRow('Laag kwartiel (25%)', p25.toFixed(2)+'x', p25<1?'#dc2626':'#d97706')}
        ${statRow('Mediaan (50%)', p50.toFixed(2)+'x', p50<1?'#dc2626':'#00BEC4')}
        ${statRow('Hoog kwartiel (75%)', p75.toFixed(2)+'x', '#00BEC4')}
        ${statRow('Optimistisch (90%)', p90.toFixed(2)+'x', '#00BEC4')}
        ${statRow('Gemiddeld rendement', mean.toFixed(2)+'x', mean<1?'#dc2626':'#00BEC4')}
      </div>

      <!-- Risico -->
      <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:.6rem .7rem;margin-bottom:.75rem;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:rgba(255,255,255,.7);font-weight:700;margin-bottom:.35rem;">RISICO ANALYSE</div>
        ${statRow('Kans op winst', pProfit.toFixed(1)+'%', pProfit>60?'#00BEC4':'#d97706')}
        ${statRow('Kans op ruin (<10%)', pRuin.toFixed(1)+'%', pRuin<5?'#00BEC4':pRuin<15?'#d97706':'#dc2626')}
        ${statRow('Mediaan max drawdown', (medDD*100).toFixed(1)+'%', medDD<0.3?'#00BEC4':'#d97706')}
        ${statRow('Worst case drawdown (90%)', (p90DD*100).toFixed(1)+'%', p90DD<0.5?'#d97706':'#dc2626')}
        ${statRow('Kelly inzet per pick', (kellyStake*100).toFixed(1)+'% bankroll', '#64748b')}
      </div>

      <!-- Sliders -->
      <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:.6rem .7rem;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:rgba(255,255,255,.7);font-weight:700;margin-bottom:.5rem;">PARAMETERS AANPASSEN</div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
          <button onclick="runMonteCarloSim(${hitrate},${avgOdds},0.10,${nPicks},${nSims})"
            style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;background:${kellyFraction===0.10?'rgba(0,190,196,.2)':'rgba(255,255,255,.06)'};border:1px solid rgba(0,190,196,.3);color:#00BEC4;border-radius:8px;padding:.35rem .6rem;cursor:pointer;">½ Kelly 10%</button>
          <button onclick="runMonteCarloSim(${hitrate},${avgOdds},0.25,${nPicks},${nSims})"
            style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;background:${kellyFraction===0.25?'rgba(0,190,196,.2)':'rgba(255,255,255,.06)'};border:1px solid rgba(0,190,196,.3);color:#00BEC4;border-radius:8px;padding:.35rem .6rem;cursor:pointer;">¼ Kelly 25%</button>
          <button onclick="runMonteCarloSim(${hitrate},${avgOdds},0.50,${nPicks},${nSims})"
            style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;background:${kellyFraction===0.50?'rgba(0,190,196,.2)':'rgba(255,255,255,.06)'};border:1px solid rgba(0,190,196,.3);color:#00BEC4;border-radius:8px;padding:.35rem .6rem;cursor:pointer;">½ Kelly 50%</button>
          <button onclick="runMonteCarloSim(${hitrate},${avgOdds},0.10,50,${nSims})"
            style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.6);border-radius:8px;padding:.35rem .6rem;cursor:pointer;">50 picks</button>
          <button onclick="runMonteCarloSim(${hitrate},${avgOdds},0.10,200,${nSims})"
            style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.6);border-radius:8px;padding:.35rem .6rem;cursor:pointer;">200 picks</button>
        </div>
      </div>

    </div>`;

  document.body.appendChild(overlay);
}

