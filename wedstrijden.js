// ═══════════════════════════════════════════════════════
// WEDSTRIJDEN.JS — matches, comp chips, value scan, combi
// ═══════════════════════════════════════════════════════

// ── Competitie definities ────────────────────────────────
const COMP_LIST = [
  { key:'eredivisie', flag:'🇳🇱', name:'Eredivisie' },
  { key:'kkd',        flag:'🇳🇱', name:'KKD' },
  { key:'premier',    flag:'🏴',  name:'Premier League' },
  { key:'bundesliga', flag:'🇩🇪', name:'Bundesliga' },
  { key:'ligue1',     flag:'🇫🇷', name:'Ligue 1' },
  { key:'seriea',     flag:'🇮🇹', name:'Serie A' },
  { key:'laliga',     flag:'🇪🇸', name:'La Liga' },
  { key:'champions',  flag:'⭐',  name:'Champions League' },
  { key:'jupiler',    flag:'🇧🇪', name:'Jupiler' },
  { key:'superlig',   flag:'🇹🇷', name:'Süper Lig' },
  { key:'nations',    flag:'🌍',  name:'Nations League' },
  { key:'beker',      flag:'🏆',  name:'KNVB Beker' },
  { key:'wk2026',     flag:'🏆',  name:'WK 2026' },
];

let _scanCompFilter = new Set();
let scanCompFilter = new Set();
let _multiMode = false;

// ── Wedstrijden screen render ─────────────────────────────
function renderWedstrijdenScreen() {
  const screen = document.getElementById('screen-wedstrijden');
  if (!screen) return;

  const favs = state.favoriteComps || [];

  screen.innerHTML = `
    <!-- AutoCheck bar -->
    <div id="autoCheckBar" style="display:none;font-family:'IBM Plex Mono',monospace;font-size:.58rem;color:#15803d;
      background:rgba(22,163,74,.08);border:1px solid rgba(22,163,74,.2);border-radius:8px;
      padding:.4rem .8rem;margin-bottom:.7rem;transition:opacity .35s;"></div>

    <!-- Scan resultaten panel -->
    <div id="scanResultsPanel" style="display:none;"></div>

    <!-- Value banner (multi-scan results) -->
    <div id="valueBanner" style="display:none;background:var(--card);border:1px solid rgba(22,163,74,.25);
      border-radius:16px;padding:.9rem;margin-bottom:.85rem;box-shadow:var(--shadow2);"></div>

    <!-- Competitie chips -->
    <div class="section-label">COMPETITIE</div>
    <div class="comp-grid" id="compGrid">
      ${COMP_LIST.map(c => {
        const isActive = state.activeComp === c.key;
        const isFav = favs.includes(c.key);
        return `<div class="comp-chip${isActive?' active':''}${isFav?' fav':''}" id="comp-${c.key}"
          ontouchstart="handleCompTouchStart('${c.key}',event)"
          ontouchend="handleCompTouchEnd('${c.key}')"
          onclick="handleCompTap('${c.key}')">
          <span class="flag">${c.flag}</span>
          <span class="cname">${c.name}</span>
        </div>`;
      }).join('')}
    </div>

    <!-- Multi-scan knoppen -->
    <div style="display:flex;gap:.4rem;margin-bottom:.7rem;flex-wrap:wrap;">
      <button id="multiModeBtn" onclick="toggleMultiMode()"
        style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;font-weight:700;
        padding:.35rem .8rem;border-radius:999px;cursor:pointer;
        background:rgba(22,163,74,.1);border:1px solid rgba(22,163,74,.3);color:#15803d;">
        📌 MULTI-SCAN SELECTEREN
      </button>
      <button onclick="loadTodayAllComps()"
        style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;font-weight:700;
        padding:.35rem .8rem;border-radius:999px;cursor:pointer;
        background:rgba(37,99,235,.1);border:1px solid rgba(37,99,235,.3);color:#2563eb;">
        📅 ALLES VANDAAG
      </button>
    </div>

    <!-- Multi-scan hint -->
    <div id="multiModeHint" style="display:none;font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:#15803d;
      background:rgba(22,163,74,.06);border:1px solid rgba(22,163,74,.15);border-radius:8px;
      padding:.4rem .8rem;margin-bottom:.5rem;">
      ✓ Multi-modus actief — tik op competities om te selecteren
    </div>

    <!-- Multi-scan balk -->
    <div id="multiScanBar" style="display:${favs.length >= 1 ? 'flex' : 'none'};align-items:center;justify-content:space-between;
      background:rgba(22,163,74,.08);border:1px solid rgba(22,163,74,.2);border-radius:12px;
      padding:.55rem .9rem;margin-bottom:.7rem;gap:.5rem;">
      <div style="flex:1;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;font-weight:700;color:#15803d;">📌 MULTI-SCAN</div>
        <div id="multiScanComps" style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;color:var(--sub);">
          ${favs.length >= 2 ? favs.map(c => COMP_NAMES[c]?.split(' ').slice(1).join(' ') || c).join(' · ') : 'Selecteer nog een competitie'}
        </div>
      </div>
      <div style="display:flex;gap:.4rem;">
        <button id="multiScanBtn" onclick="runMultiScan()"
          style="font-family:'IBM Plex Mono',monospace;font-size:.55rem;font-weight:800;
          padding:.4rem .8rem;border-radius:999px;cursor:pointer;
          background:rgba(22,163,74,.15);border:1px solid rgba(22,163,74,.4);color:#15803d;">
          ⚡ SCAN ALLES
        </button>
        <button onclick="clearFavoriteComps()"
          style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;padding:.35rem .65rem;
          border-radius:999px;background:transparent;border:1px solid var(--stroke);color:var(--sub);cursor:pointer;">
          ✕
        </button>
      </div>
    </div>

    <!-- Handmatig wedstrijd toevoegen -->
    <div style="margin-bottom:.6rem;">
      <button onclick="toggleManualMatchSection()"
        style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;font-weight:700;
        padding:.35rem .8rem;border-radius:999px;
        background:rgba(255,255,255,.7);border:1px solid var(--stroke);color:var(--sub);cursor:pointer;">
        ➕ Wedstrijd handmatig toevoegen
      </button>
    </div>
    <div id="manualMatchSection" style="display:none;background:var(--card);border:1px solid var(--stroke);
      border-radius:14px;padding:.9rem;margin-bottom:.7rem;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.6rem;font-weight:700;color:var(--sub);margin-bottom:.6rem;">HANDMATIGE INVOER</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;margin-bottom:.4rem;">
        <input id="manualHome" type="text" placeholder="Thuisploeg" style="font-family:monospace;font-size:.62rem;padding:.4rem .6rem;border-radius:8px;border:1px solid var(--stroke);background:var(--card);color:var(--ink);outline:none;">
        <input id="manualAway" type="text" placeholder="Uitploeg" style="font-family:monospace;font-size:.62rem;padding:.4rem .6rem;border-radius:8px;border:1px solid var(--stroke);background:var(--card);color:var(--ink);outline:none;">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.4rem;margin-bottom:.4rem;">
        <input id="manualOdds1" type="number" step=".01" placeholder="1" style="font-family:monospace;font-size:.62rem;padding:.4rem .5rem;border-radius:8px;border:1px solid var(--stroke);background:var(--card);color:var(--ink);outline:none;">
        <input id="manualOddsX" type="number" step=".01" placeholder="X" style="font-family:monospace;font-size:.62rem;padding:.4rem .5rem;border-radius:8px;border:1px solid var(--stroke);background:var(--card);color:var(--ink);outline:none;">
        <input id="manualOdds2" type="number" step=".01" placeholder="2" style="font-family:monospace;font-size:.62rem;padding:.4rem .5rem;border-radius:8px;border:1px solid var(--stroke);background:var(--card);color:var(--ink);outline:none;">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;margin-bottom:.5rem;">
        <input id="manualLeague" type="text" placeholder="Competitie" style="font-family:monospace;font-size:.62rem;padding:.4rem .6rem;border-radius:8px;border:1px solid var(--stroke);background:var(--card);color:var(--ink);outline:none;">
        <input id="manualDate" type="date" style="font-family:monospace;font-size:.62rem;padding:.4rem .6rem;border-radius:8px;border:1px solid var(--stroke);background:var(--card);color:var(--ink);outline:none;">
      </div>
      <button onclick="addManualMatch()" style="width:100%;background:linear-gradient(135deg,rgba(219,39,119,.15),rgba(124,58,237,.1));border:1px solid rgba(219,39,119,.3);color:#be185d;font-family:monospace;font-size:.6rem;font-weight:700;padding:.5rem;border-radius:9px;cursor:pointer;">✓ TOEVOEGEN</button>
    </div>

    <!-- Match loading / skeleton -->
    <div id="match-loading" style="display:none;font-family:'IBM Plex Mono',monospace;font-size:.6rem;color:var(--muted);text-align:center;padding:1rem 0;"></div>

    <!-- Today/tomorrow scan buttons (hidden until all-comps loaded) -->
    <div id="scanAllTodayBtn" style="display:none;width:100%;margin-bottom:.5rem;">
      <button onclick="scanAllTodayValue('today')"
        style="width:100%;background:linear-gradient(135deg,rgba(22,163,74,.12),rgba(5,150,105,.08));
        border:1.5px solid rgba(22,163,74,.3);color:#15803d;font-family:'IBM Plex Mono',monospace;
        font-size:.62rem;font-weight:800;padding:.65rem;border-radius:12px;cursor:pointer;">
        ⚡ SCAN ALLES VANDAAG
      </button>
    </div>
    <div id="scanTomorrowBtn" style="display:none;width:100%;margin-bottom:.7rem;">
      <button onclick="scanAllTodayValue('tomorrow')"
        style="width:100%;background:rgba(37,99,235,.06);border:1px solid rgba(37,99,235,.2);
        color:#2563eb;font-family:'IBM Plex Mono',monospace;font-size:.55rem;font-weight:700;
        padding:.55rem;border-radius:10px;cursor:pointer;">
        📅 SCAN MORGEN
      </button>
    </div>
    <div id="allCompsLoading" style="display:none;flex-direction:column;align-items:center;padding:1.5rem;gap:.6rem;">
      <div style="width:24px;height:24px;border:2.5px solid rgba(219,39,119,.2);border-top-color:#be185d;border-radius:50%;animation:spin .7s linear infinite;"></div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.58rem;color:var(--sub);">Wedstrijden laden...</div>
    </div>

    <!-- Match lijst -->
    <div id="matchList" class="match-list"></div>

    <!-- Value scan button (per competitie) -->
    <div id="scanValueSection" style="margin-top:.5rem;display:none;">
      <button onclick="scanValueAll()"
        style="width:100%;background:linear-gradient(135deg,rgba(22,163,74,.1),rgba(5,150,105,.06));
        border:1.5px solid rgba(22,163,74,.3);color:#15803d;font-family:'IBM Plex Mono',monospace;
        font-size:.65rem;font-weight:800;padding:.65rem;border-radius:12px;cursor:pointer;"
        id="valueScanBtn">
        ⚡ SCAN VALUE
      </button>
    </div>

    <!-- Combi builder (sticky bottom) -->
    <div class="combi-builder" id="combiBuilder" style="display:none;">
      <div class="combi-builder-inner">
        <div class="combi-builder-header">
          <div class="combi-builder-title">⚡ COMBI BUILDER</div>
          <div class="combi-builder-odds" id="combiTotalOdds">—</div>
        </div>
        <div class="combi-builder-legs" id="combiBuilderLegs"></div>
        <div class="combi-builder-actions">
          <button onclick="placeCombi()" class="combi-place-btn">💶 PLAATSEN</button>
          <button onclick="clearCombi()" class="combi-clear-btn">✕ WISSEN</button>
        </div>
      </div>
    </div>
  `;
}

// ── Match cards renderen ──────────────────────────────────
function renderMatches(matches) {
  const list = document.getElementById('matchList');
  if (!list) return;

  const loadingEl = document.getElementById('match-loading');
  if (loadingEl) loadingEl.style.display = 'none';

  if (!matches || !matches.length) {
    list.innerHTML = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.6rem;color:var(--muted);text-align:center;padding:1.5rem;">Geen wedstrijden gevonden</div>';
    return;
  }

  list.innerHTML = '';
  matches.forEach(m => {
    const card = renderMatchCard(m);
    if (card) list.appendChild(card);
  });

  // Toon value scan button als er matches met odds zijn
  const withOdds = matches.filter(m => m.homeOdds !== '—' && parseFloat(m.homeOdds) > 1).length;
  const scanSection = document.getElementById('scanValueSection');
  if (scanSection) {
    scanSection.style.display = withOdds > 0 ? 'block' : 'none';
    const scanBtn = document.getElementById('valueScanBtn');
    if (scanBtn) scanBtn.textContent = `⚡ SCAN VALUE (${withOdds} matches)`;
  }

  // Herstel scan resultaten
  if (state.lastScanResults?.length) renderScanResults(state.lastScanResults, true);
}

function renderMatchCard(m) {
  if (!m) return null;
  const card = document.createElement('div');
  card.className = 'match-card' + (m.isLive ? ' value-glow' : '');
  card.id = 'match-' + m.id;

  // Value badge (uit scan resultaten)
  const scanResult = (state.lastScanResults||[]).find(s => String(s.matchId) === String(m.id));
  const valueBadge = scanResult && scanResult.value >= 5 ? `
    <div style="position:absolute;top:6px;right:6px;font-family:'Bebas Neue',sans-serif;font-size:.85rem;
      color:${scanResult.value >= 15 ? '#15803d' : '#b45309'};background:${scanResult.value >= 15 ? 'rgba(22,163,74,.12)' : 'rgba(180,83,9,.1)'};
      border:1px solid ${scanResult.value >= 15 ? 'rgba(22,163,74,.3)' : 'rgba(180,83,9,.3)'};
      padding:1px 6px;border-radius:4px;">+${Math.round(scanResult.value)}%</div>` : '';

  const statusClass = m.isLive ? 'status-live' : m.isDone ? 'status-done' : 'status-soon';
  const statusTxt   = m.isLive ? (m.liveMin ? m.liveMin + `'` : 'LIVE') : m.isDone ? 'FT' : m.time;

  const formDots = (form) => {
    if (!form) return '';
    return form.split('').slice(-5).map(f =>
      `<div class="form-dot ${f}"></div>`
    ).join('');
  };

  // Kans balken
  const probBar = (m.homeOdds !== '—') ? `
    <div class="ai-probs">
      <div style="flex:${m.homePct}" class="prob-seg" style="background:rgba(22,163,74,.${Math.round(m.homePct/10)});">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;font-weight:800;">1 ${m.homePct}%</span>
      </div>
      <div style="flex:${m.drawPct}" class="prob-seg prob-draw">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;font-weight:800;">X ${m.drawPct}%</span>
      </div>
      <div style="flex:${m.awayPct}" class="prob-seg prob-away">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;font-weight:800;">2 ${m.awayPct}%</span>
      </div>
    </div>` : '';

  const inCombi = (state.combiBuilder||[]).some(l => String(l.matchId) === String(m.id));

  const hasOdds = m.homeOdds && m.homeOdds !== '—' && parseFloat(m.homeOdds) > 1;

  card.innerHTML = `
    ${valueBadge}
    <div class="card-head">
      <span class="match-comp-name">${m.comp || ''}</span>
      <span class="match-time">${m.date ? m.date + ' · ' : ''}${m.time}</span>
      <span class="match-status-pill ${statusClass}">${statusTxt}</span>
    </div>
    <div class="match-teams">
      <div class="team-block">
        <div class="team-name">${m.home}</div>
        <div class="team-form">${formDots(m.homeForm)}</div>
      </div>
      <div class="team-vs">
        ${m.score ? `<span style="font-size:1.1rem;color:var(--ink);">${m.score}</span>` : 'VS'}
      </div>
      <div class="team-block team-away">
        <div class="team-name">${m.away}</div>
        <div class="team-form">${formDots(m.awayForm)}</div>
      </div>
    </div>
    ${probBar}
    ${hasOdds ? `
    <div class="match-odds">
      <button class="odds-btn" onclick="event.stopPropagation();openBetModal(event,'${m.id}','1','Thuis',${m.homeOdds})">
        <div class="odds-label">1</div>
        <div class="odds-val">${m.homeOdds}</div>
      </button>
      <button class="odds-btn" onclick="event.stopPropagation();openBetModal(event,'${m.id}','X','Gelijk',${m.drawOdds})">
        <div class="odds-label">X</div>
        <div class="odds-val">${m.drawOdds}</div>
      </button>
      <button class="odds-btn" onclick="event.stopPropagation();openBetModal(event,'${m.id}','2','Uit',${m.awayOdds})">
        <div class="odds-label">2</div>
        <div class="odds-val">${m.awayOdds}</div>
      </button>
    </div>` : ''}
    <div class="quick-bet-row" style="padding:.3rem .9rem .65rem;gap:.4rem;">
      <button onclick="event.stopPropagation();selectMatchAndAnalyse('${m.id}')"
        class="qb-btn" style="flex:2;background:rgba(219,39,119,.1);border-color:rgba(219,39,119,.25);color:#be185d;font-weight:700;">
        🤖 ANALYSEER
      </button>
      <button onclick="event.stopPropagation();toggleCombiAdd('${m.id}')"
        id="combi-btn-${m.id}"
        class="qb-btn" style="flex:1;background:${inCombi?'rgba(22,163,74,.12)':'rgba(124,58,237,.08)'};border-color:${inCombi?'rgba(22,163,74,.3)':'rgba(124,58,237,.2)'};color:${inCombi?'#15803d':'#7c3aed'};font-weight:700;">
        ${inCombi ? '✓ COMBI' : '+ COMBI'}
      </button>
    </div>
  `;

  card.addEventListener('click', () => selectMatch(m));
  return card;
}

// ── Match selectie ────────────────────────────────────────
let _selectedMatchId = null;

function selectMatch(m) {
  if (!m) return;
  state.selectedMatch = m;
  _selectedMatchId = m.id;
  // Highlight kaart
  document.querySelectorAll('.match-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById('match-' + m.id);
  if (card) card.classList.add('selected');
}

function selectMatchAndAnalyse(matchId) {
  const m = (state.matches||[]).find(x => String(x.id) === String(matchId));
  if (m) selectMatch(m);
  setTimeout(() => switchScreen('analyse'), 80);
}

function goToAnalyse(matchId) {
  selectMatchAndAnalyse(matchId);
}

// ── Competitie chip handlers ──────────────────────────────
const _chipPressTimers = {};

function handleCompTouchStart(comp, e) {
  _chipPressTimers[comp] = setTimeout(() => {
    _chipPressTimers[comp] = null;
    if (navigator.vibrate) navigator.vibrate(50);
    openCompDetail(comp);
  }, 500);
}

function handleCompTouchEnd(comp) {
  if (_chipPressTimers[comp]) {
    clearTimeout(_chipPressTimers[comp]);
    _chipPressTimers[comp] = null;
  }
}

function handleCompTap(comp) {
  if (_multiMode) {
    toggleFavComp(comp);
    if (navigator.vibrate) navigator.vibrate(40);
  } else {
    selectComp(comp);
  }
}

function selectComp(comp) {
  state.activeComp = comp;
  saveState();
  // Update chip highlight
  document.querySelectorAll('.comp-chip').forEach(c => c.classList.remove('active'));
  document.getElementById('comp-' + comp)?.classList.add('active');
  // Laad matches
  state.matches = [];
  loadMatches(comp);
}

function toggleFavComp(comp) {
  if (!state.favoriteComps) state.favoriteComps = [];
  const idx = state.favoriteComps.indexOf(comp);
  if (idx >= 0) state.favoriteComps.splice(idx, 1);
  else state.favoriteComps.push(comp);
  saveState();
  updateFavCompUI();
}

function updateFavCompUI() {
  const favs = state.favoriteComps || [];
  document.querySelectorAll('.comp-chip').forEach(chip => {
    const comp = chip.id.replace('comp-', '');
    chip.classList.toggle('fav', favs.includes(comp));
  });
  const bar = document.getElementById('multiScanBar');
  const compsLabel = document.getElementById('multiScanComps');
  if (bar) bar.style.display = favs.length >= 1 ? 'flex' : 'none';
  if (compsLabel && favs.length) {
    compsLabel.textContent = favs.length >= 2
      ? favs.map(c => COMP_NAMES[c]?.split(' ').slice(1).join(' ') || c).join(' · ')
      : (COMP_NAMES[favs[0]] || favs[0]) + ' — selecteer nog een comp voor multi-scan';
  }
}

function clearFavoriteComps() {
  state.favoriteComps = [];
  saveState();
  updateFavCompUI();
}

function toggleMultiMode() {
  _multiMode = !_multiMode;
  const btn = document.getElementById('multiModeBtn');
  const hint = document.getElementById('multiModeHint');
  if (_multiMode) {
    if (btn) { btn.textContent = '✓ KLAAR'; btn.style.background = 'rgba(22,163,74,.2)'; btn.style.color = '#15803d'; }
    if (hint) hint.style.display = 'block';
  } else {
    if (btn) { btn.textContent = '📌 MULTI-SCAN SELECTEREN'; btn.style.background = 'rgba(22,163,74,.1)'; btn.style.color = '#15803d'; }
    if (hint) hint.style.display = 'none';
  }
}

// ── Match laden ──────────────────────────────────────────
async function loadMatches(comp) {
  const list = document.getElementById('matchList');
  if (!list) return;
  list.innerHTML = '';
  showSkeletonCards(5);
  try {
    const result = await loadFromAPIFootball(comp, null);
    if (result) return;
  } catch(e) {
    console.warn('[loadMatches] API-Football fout:', e.message);
  }
  const fdKey  = state.settings.fdKey;
  const fdCode = FD_CODES[comp];
  if (fdKey && fdCode) {
    const result = await loadFromFD(fdCode, fdKey, comp);
    if (result) return;
  }
  if (comp === 'beker') {
    showLoadingMsg('📌 Geen data beschikbaar voor KNVB Beker', 'var(--muted)'); return;
  }
  showLoadingMsg('Geen wedstrijden gevonden voor deze competitie.', 'var(--muted)');
}

async function loadFromAPIFootball(comp, _apiKey) {
  const leagueId = COMP_IDS[comp];
  if (!leagueId) return false;
  const season = getCurrentSeason(comp);
  showLoadingMsg(`⟳ ${COMP_NAMES[comp] || comp} laden...`, 'var(--muted)');
  try {
    // Probeer vandaag
    const today = new Date().toISOString().split('T')[0];
    const tms = state._multiScanMode ? 5000 : 10000;
    let r = await apiFetch(`https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${season}&date=${today}`, null, tms);
    let d = await r.json();
    if (d.response?.length > 0) {
      state.matches = d.response.map(f => parseAPIMatch(f)).filter(Boolean);
      renderMatches(state.matches);
      saveOpeningOdds(state.matches);
      fetchOddsForMatches(leagueId, null).then(() => renderMatches(state.matches));
      return true;
    }
    // Volgende wedstrijden (next=10)
    r = await apiFetch(`https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${season}&next=10`, null, tms);
    d = await r.json();
    if (d.response?.length > 0) {
      state.matches = d.response.map(f => parseAPIMatch(f)).filter(Boolean);
      renderMatches(state.matches);
      saveOpeningOdds(state.matches);
      fetchOddsForMatches(leagueId, null).then(() => renderMatches(state.matches));
      return true;
    }
    return false;
  } catch(e) {
    console.warn('[loadFromAPIFootball]', e.message);
    return false;
  }
}

async function loadFromFD(fdCode, fdKey, comp) {
  const today = new Date();
  const dateFrom = today.toISOString().split('T')[0];
  const dateTo = new Date(today.getTime() + 2 * 86400000).toISOString().split('T')[0];
  const compName = {eredivisie:'Eredivisie',bundesliga:'Bundesliga',premier:'Premier League',beker:'KNVB Beker',champions:'Champions League'}[comp] || comp;
  try {
    showLoadingMsg('⟳ football-data.org laden...', 'var(--muted)');
    let resp = await fdFetch(`https://api.football-data.org/v4/competitions/${fdCode}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`, fdKey);
    if (!resp.ok && resp.status !== 404) { showLoadingMsg(`⚠ football-data.org fout: HTTP ${resp.status}`, 'var(--red)'); return false; }
    let data = await resp.json();
    if (data.matches?.length > 0) {
      state.matches = data.matches.map(m => parseFDMatch(m, compName));
      renderMatches(state.matches);
      return true;
    }
    resp = await fdFetch(`https://api.football-data.org/v4/competitions/${fdCode}/matches?status=SCHEDULED`, fdKey);
    data = await resp.json();
    if (data.matches?.length > 0) {
      state.matches = data.matches.sort((a,b) => new Date(a.utcDate)-new Date(b.utcDate)).slice(0,12).map(m => parseFDMatch(m, compName));
      renderMatches(state.matches);
      return true;
    }
    return false;
  } catch(e) { return false; }
}

// ── Odds ophalen ─────────────────────────────────────────
function applyOddsToMatch(match, oddsObj) {
  const bk = oddsObj.bookmakers?.[0];
  if (!bk) return false;
  const mkt = bk.bets?.find(b => b.name === 'Match Winner');
  if (!mkt?.values) return false;
  const h    = mkt.values.find(v => v.value === 'Home');
  const draw = mkt.values.find(v => v.value === 'Draw');
  const a    = mkt.values.find(v => v.value === 'Away');
  if (!h || !draw || !a) return false;
  match.homeOdds = parseFloat(h.odd).toFixed(2);
  match.drawOdds = parseFloat(draw.odd).toFixed(2);
  match.awayOdds = parseFloat(a.odd).toFixed(2);
  const inv = 1/parseFloat(h.odd) + 1/parseFloat(draw.odd) + 1/parseFloat(a.odd);
  match.homePct = Math.round((1/parseFloat(h.odd))/inv*100);
  match.drawPct = Math.round((1/parseFloat(draw.odd))/inv*100);
  match.awayPct = 100 - match.homePct - match.drawPct;
  return true;
}

async function fetchOddsForMatches(leagueId, _apiKey) {
  if (!leagueId) return;
  const season = leagueId === 1 ? 2026 : 2025;
  const today  = new Date().toISOString().split('T')[0];
  try {
    // Probeer zonder bookmaker filter (geeft alle beschikbare bookmakers)
    const r = await apiFetch(
      `https://v3.football.api-sports.io/odds?league=${leagueId}&season=${season}&date=${today}`,
      null, 10000
    );
    const d = await r.json();
    if (d.response?.length) {
      for (const odds of d.response) {
        const fid   = String(odds.fixture?.id);
        const match = state.matches.find(m => m.id === fid);
        if (!match) continue;
        applyOddsToMatch(match, odds);
      }
      renderMatches(state.matches);
      return;
    }
  } catch(e) {}

  // Fallback: per fixture ophalen voor eerste 8 matches zonder odds
  const missing = state.matches.filter(m => m.homeOdds === '—' || !m.homeOdds).slice(0, 8);
  for (const match of missing) {
    try {
      const r = await apiFetch(
        `https://v3.football.api-sports.io/odds?fixture=${match.id}`,
        null, 6000
      );
      const d = await r.json();
      const odds = d.response?.[0];
      if (odds) applyOddsToMatch(match, odds);
      await new Promise(res => setTimeout(res, 300));
    } catch(e) {}
  }
  renderMatches(state.matches);
}

async function fetchOddsForAllMatches(matches, _apiKey) {
  const fixtureIds = matches.filter(m => m.source === 'apif' && m.homeOdds === '—').slice(0,20).map(m => m.id);
  if (!fixtureIds.length) return;
  try {
    for (const fid of fixtureIds.slice(0, 5)) {
      try {
        const r = await apiFetch(`https://v3.football.api-sports.io/odds?fixture=${fid}&bookmaker=6`, null, 5000);
        const d = await r.json();
        const odds = d.response?.[0];
        if (!odds) continue;
        const match = state.matches.find(m => m.id === fid);
        if (!match) continue;
        const bk = odds.bookmakers?.[0];
        if (!bk) continue;
        const mkt = bk.bets?.find(b => b.name === 'Match Winner');
        if (!mkt?.values) continue;
        const h = mkt.values.find(v => v.value === 'Home');
        const dw = mkt.values.find(v => v.value === 'Draw');
        const a = mkt.values.find(v => v.value === 'Away');
        if (h) match.homeOdds = parseFloat(h.odd).toFixed(2);
        if (dw) match.drawOdds = parseFloat(dw.odd).toFixed(2);
        if (a) match.awayOdds = parseFloat(a.odd).toFixed(2);
      } catch(e) {}
      await new Promise(r => setTimeout(r, 300));
    }
  } catch(e) {}
}

// ── Combi builder ─────────────────────────────────────────
function toggleCombiAdd(matchId) {
  const m = (state.matches||[]).find(x => String(x.id) === String(matchId));
  if (!m) return;
  if (!state.combiBuilder) state.combiBuilder = [];
  const idx = state.combiBuilder.findIndex(l => String(l.matchId) === String(matchId));
  if (idx >= 0) {
    state.combiBuilder.splice(idx, 1);
  } else {
    const odds = parseFloat(m.homeOdds) || 1.5;
    state.combiBuilder.push({
      matchId: String(matchId), home: m.home, away: m.away,
      pick: '1', pickLabel: 'Thuis', odds
    });
  }
  updateCombiBuilder();
  // Update knop
  const btn = document.getElementById('combi-btn-' + matchId);
  const inCombi = state.combiBuilder.some(l => String(l.matchId) === String(matchId));
  if (btn) {
    btn.textContent = inCombi ? '✓ IN COMBI' : '+ COMBI';
    btn.style.background = inCombi ? 'rgba(22,163,74,.12)' : 'rgba(124,58,237,.08)';
    btn.style.color = inCombi ? '#15803d' : '#7c3aed';
  }
}

function addValuePickToCombi(matchId, pick, pickLabel, odds, home, away) {
  if (!state.combiBuilder) state.combiBuilder = [];
  const idx = state.combiBuilder.findIndex(l => String(l.matchId) === String(matchId));
  if (idx >= 0) {
    state.combiBuilder.splice(idx, 1);
  } else {
    const match = (state.matches||[]).find(m => String(m.id) === String(matchId));
    state.combiBuilder.push({
      matchId: String(matchId),
      home: home || match?.home || '?',
      away: away || match?.away || '?',
      pick, pickLabel, odds: parseFloat(odds)
    });
  }
  updateCombiBuilder();
}

function addScanPickToCombi(matchId, pick, pickLabel, odds, home, away) {
  addValuePickToCombi(matchId, pick, pickLabel, odds, home, away);
  const inCombi = state.combiBuilder.some(l => String(l.matchId) === String(matchId));
  const btn = document.getElementById('sr-combi-' + matchId);
  if (btn) {
    btn.textContent = inCombi ? '✓ COMBI' : '+ COMBI';
    btn.style.background = inCombi ? 'rgba(22,163,74,.12)' : 'rgba(219,39,119,.1)';
    btn.style.color = inCombi ? '#15803d' : '#be185d';
  }
  showToast(`⚡ ${pickLabel} ${inCombi ? 'toegevoegd aan' : 'verwijderd uit'} combi`);
}

function updateCombiBuilder() {
  const builder = document.getElementById('combiBuilder');
  const legsEl = document.getElementById('combiBuilderLegs');
  const oddsEl = document.getElementById('combiTotalOdds');
  if (!builder || !legsEl) return;

  const legs = state.combiBuilder || [];

  if (!legs.length) {
    builder.style.display = 'none';
    return;
  }

  builder.style.display = 'block';
  const totalOdds = legs.reduce((a, l) => a * l.odds, 1);
  if (oddsEl) oddsEl.textContent = totalOdds.toFixed(2);

  legsEl.innerHTML = legs.map(l => `
    <div class="combi-builder-leg">
      <span class="cbl-match">${l.home} vs ${l.away}</span>
      <span class="cbl-pick">${l.pickLabel}</span>
      <span class="cbl-odds">${l.odds.toFixed(2)}</span>
      <button class="cbl-remove" onclick="removeCombiLeg('${l.matchId}')">✕</button>
    </div>
  `).join('');
}

function removeCombiLeg(matchId) {
  state.combiBuilder = (state.combiBuilder||[]).filter(l => String(l.matchId) !== String(matchId));
  updateCombiBuilder();
  // Update kaart knop
  const btn = document.getElementById('combi-btn-' + matchId);
  if (btn) { btn.textContent = '+ COMBI'; btn.style.background = 'rgba(124,58,237,.08)'; btn.style.color = '#7c3aed'; }
}

function clearCombi() {
  state.combiBuilder = [];
  updateCombiBuilder();
  document.querySelectorAll('[id^="combi-btn-"]').forEach(btn => {
    btn.textContent = '+ COMBI';
    btn.style.background = 'rgba(124,58,237,.08)';
    btn.style.color = '#7c3aed';
  });
}

function placeCombi() {
  const legs = state.combiBuilder || [];
  if (legs.length < 2) { alert('Voeg minimaal 2 wedstrijden toe aan de combi'); return; }
  const totalOdds = legs.reduce((a,l) => a * l.odds, 1);
  const amt = parseFloat(prompt('Inzet (€):', state.settings.defaultBet || '10'));
  if (!amt || amt <= 0) return;
  if (amt > state.wallet.balance) { alert('Onvoldoende saldo!'); return; }
  const bet = {
    id: Date.now(),
    matchName: 'Combi: ' + legs.map(l => shortName(l.home)).join(' + '),
    fixtureId: null,
    pick: 'COMBI',
    pickLabel: legs.map(l => `${l.home} ${l.pickLabel}`).join(' / '),
    markt: 'Combi',
    odds: parseFloat(totalOdds.toFixed(2)),
    amount: amt,
    payout: parseFloat((amt * totalOdds).toFixed(2)),
    status: 'pending',
    date: new Date().toLocaleDateString('nl-NL'),
    legs: legs.map(l => ({ ...l, status: 'pending' })),
    source: 'combi'
  };
  state.wallet.balance -= amt;
  state.wallet.totalStaked += amt;
  state.wallet.bets.unshift(bet);
  saveState();
  clearCombi();
  showToast(`✅ Combi geplaatst @ ${totalOdds.toFixed(2)} → €${bet.payout.toFixed(2)}`);
}

// ── Handmatige wedstrijd toevoegen ────────────────────────
function toggleManualMatchSection() {
  const s = document.getElementById('manualMatchSection');
  if (!s) return;
  s.style.display = s.style.display === 'none' ? 'block' : 'none';
  const d = document.getElementById('manualDate');
  if (d && !d.value) d.value = new Date().toISOString().split('T')[0];
}

function addManualMatch() {
  const home = document.getElementById('manualHome')?.value.trim();
  const away = document.getElementById('manualAway')?.value.trim();
  const odds1 = parseFloat(document.getElementById('manualOdds1')?.value) || null;
  const oddsX = parseFloat(document.getElementById('manualOddsX')?.value) || null;
  const odds2 = parseFloat(document.getElementById('manualOdds2')?.value) || null;
  const league = document.getElementById('manualLeague')?.value.trim() || 'Handmatig';
  const date = document.getElementById('manualDate')?.value || new Date().toISOString().split('T')[0];
  if (!home || !away) { alert('Vul minimaal een thuis- en uitploeg in.'); return; }
  const match = {
    id: 'manual_' + Date.now(), home, away,
    homeOdds: odds1 ? String(odds1) : '—',
    drawOdds: oddsX ? String(oddsX) : '—',
    awayOdds: odds2 ? String(odds2) : '—',
    homePct: 33, drawPct: 33, awayPct: 34,
    comp: league, date, time: '—', isManual: true,
    homeForm: '', awayForm: '', isDone: false, isLive: false
  };
  state.matches = state.matches || [];
  state.matches.unshift(match);
  renderMatches(state.matches);
  document.getElementById('manualMatchSection').style.display = 'none';
  ['manualHome','manualAway','manualOdds1','manualOddsX','manualOdds2','manualLeague'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  showToast(`✓ ${home} vs ${away} toegevoegd`);
}

// ── Alle competities vandaag ──────────────────────────────
async function loadTodayAllComps() {
  const btn = document.querySelector('[onclick="loadTodayAllComps()"]');
  const loading = document.getElementById('allCompsLoading');
  const list = document.getElementById('matchList');
  if (btn) { btn.style.opacity = '0.5'; btn.disabled = true; }
  if (loading) loading.style.display = 'flex';
  if (list) list.innerHTML = '';
  const todayDate = new Date();
  const today = todayDate.toISOString().split('T')[0];
  const tomorrow = new Date(todayDate.getTime() + 86400000).toISOString().split('T')[0];
  try {
    const [rToday, rTomorrow] = await Promise.all([
      apiFetch(`https://v3.football.api-sports.io/fixtures?date=${today}`, null, 12000),
      apiFetch(`https://v3.football.api-sports.io/fixtures?date=${tomorrow}`, null, 12000)
    ]);
    const dToday = await rToday.json();
    const dTomorrow = await rTomorrow.json();
    const allFixtures = [...(dToday.response||[]), ...(dTomorrow.response||[])];
    const fixtures = allFixtures.filter(f => {
      const status = f.fixture.status.short;
      const isFinished = ['FT','AET','PEN'].includes(status);
      const fixtureDate = f.fixture.date ? f.fixture.date.split('T')[0] : '';
      return !isFinished || fixtureDate >= today;
    });
    const knownLeagueIdsSet = new Set(Object.values(COMP_IDS));
    const leagueMap = {};
    for (const f of fixtures) {
      const lid = f.league.id;
      if (!knownLeagueIdsSet.has(lid)) continue;
      if (!leagueMap[lid]) leagueMap[lid] = { name: f.league.name, country: f.league.country, flag: f.league.flag, matches: [] };
      leagueMap[lid].matches.push(f);
    }
    if (!Object.keys(leagueMap).length) {
      if (list) list.innerHTML = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.6rem;color:var(--muted);text-align:center;padding:1.5rem;">Geen wedstrijden vandaag voor bekende competities</div>';
      if (btn) { btn.style.opacity = '1'; btn.disabled = false; }
      if (loading) loading.style.display = 'none';
      return;
    }
    const knownOrder = Object.values(COMP_IDS);
    const sorted = Object.entries(leagueMap).sort(([aId],[bId]) => {
      const ai = knownOrder.indexOf(parseInt(aId));
      const bi = knownOrder.indexOf(parseInt(bId));
      if (ai >= 0 && bi >= 0) return ai - bi;
      return 0;
    });
    state.matches = [];
    const allMatches = [];
    for (const [lid, league] of sorted) {
      const leagueMatches = league.matches.map(f => parseAPIMatch(f)).filter(Boolean);
      allMatches.push({ league, matches: leagueMatches });
      state.matches.push(...leagueMatches);
    }
    if (list) list.innerHTML = '';
    const loadingMsg = document.getElementById('match-loading');
    if (loadingMsg) loadingMsg.style.display = 'none';
    for (const { league, matches: lm } of allMatches) {
      if (!lm.length) continue;
      const header = document.createElement('div');
      header.className = 'allcomps-comp-header';
      header.innerHTML = `${league.flag ? `<img src="${league.flag}" style="width:14px;height:10px;object-fit:cover;border-radius:2px;" onerror="this.style.display='none'">` : '🌍'} ${league.name} <span style="opacity:.5;">${league.country}</span>`;
      if (list) list.appendChild(header);
      lm.forEach(m => { const card = renderMatchCard(m); if (card && list) list.appendChild(card); });
    }
    // Toon scan buttons
    const scanAll = document.getElementById('scanAllTodayBtn');
    const scanTomorrow = document.getElementById('scanTomorrowBtn');
    if (scanAll) scanAll.style.display = 'block';
    if (scanTomorrow) scanTomorrow.style.display = 'block';
    // Quotes ophalen
    if (scanAll) { scanAll.querySelector('button').disabled = true; scanAll.querySelector('button').textContent = '⟳ Quotes ophalen...'; }
    await fetchOddsForAllMatches(state.matches, null);
    const withOdds = state.matches.filter(m => m.homeOdds !== '—').length;
    if (scanAll) { scanAll.querySelector('button').disabled = false; scanAll.querySelector('button').textContent = withOdds > 0 ? `⚡ SCAN ALLES VANDAAG (${withOdds})` : '⚡ SCAN ALLES VANDAAG'; }
    if (btn) { btn.textContent = '🔄 Verversen'; btn.style.opacity = '1'; btn.disabled = false; }
  } catch(e) {
    if (list) list.innerHTML = `<div style="color:var(--red);font-family:'IBM Plex Mono',monospace;font-size:.6rem;padding:1rem;">⚠ Fout: ${e.message}</div>`;
    if (btn) { btn.style.opacity = '1'; btn.disabled = false; }
  }
  if (loading) loading.style.display = 'none';
}

// ── Multi-scan ────────────────────────────────────────────
async function runMultiScan() {
  const favs = state.favoriteComps || [];
  if (favs.length < 2) { alert('Selecteer minimaal 2 competities via 📌 MULTI-SCAN SELECTEREN.'); return; }
  const btn = document.getElementById('multiScanBtn');
  if (btn) btn.disabled = true;
  state._multiScanMode = true; // kortere timeouts
  const allValuePicks = [];
  for (let i = 0; i < favs.length; i++) {
    const comp = favs[i];
    const compLabel = COMP_NAMES[comp] || comp;
    if (btn) btn.textContent = `⟳ ${i+1}/${favs.length} ${compLabel}`;
    showLoadingMsg(`⟳ ${compLabel} laden...`, 'var(--muted)');
    state.activeComp = comp;
    state.matches = []; state.valueScans = [];
    document.querySelectorAll('.comp-chip').forEach(c => c.classList.remove('active'));
    document.getElementById('comp-' + comp)?.classList.add('active');
    const fdKey = state.settings.fdKey;
    const fdCode = FD_CODES[comp];
    // Maximaal 12 seconden per competitie
    let compDone = false;
    const compTimeout = setTimeout(() => {
      if (!compDone) {
        console.warn('[MultiScan] timeout voor', comp);
        compDone = true;
      }
    }, 12000);
    const controller1 = new AbortController();
    const t1 = setTimeout(() => controller1.abort(), 7000);
    try {
      await loadFromAPIFootball(comp, null);
    } catch(e) {} finally { clearTimeout(t1); }

    if (!state.matches.length && fdKey && fdCode) {
      const controller2 = new AbortController();
      const t2 = setTimeout(() => controller2.abort(), 7000);
      try {
        await loadFromFD(fdCode, fdKey, comp);
      } catch(e) {} finally { clearTimeout(t2); }
    }

    if (!state.matches.length) { console.log('[MultiScan] geen matches:', comp); continue; }
    if (btn) btn.textContent = `⟳ ${i+1}/${favs.length} quotes ophalen...`;
    const leagueId = COMP_IDS[comp];
    if (leagueId) {
      const t3 = setTimeout(() => {}, 5000);
      try {
        await fetchOddsForMatches(leagueId, null);
      } catch(e) {} finally { clearTimeout(t3); }
    }
    const withOdds = state.matches.filter(m => m.homeOdds !== '—' && parseFloat(m.homeOdds) > 1);
    if (!withOdds.length) { console.log(`${comp}: geen odds beschikbaar, overgeslagen`); continue; }
    if (btn) btn.textContent = `⟳ ${i+1}/${favs.length} scannen...`;
    await scanValueAll();
    if (state.valueScans?.length) {
      allValuePicks.push(...state.valueScans
        .filter(s => s.value >= 5)
        .map(s => ({ ...s, compName: COMP_NAMES[comp] || comp })));
    }
    compDone = true;
    clearTimeout(compTimeout);
    // Wacht even als timeout al vuurt
    if (!compDone) await new Promise(r => setTimeout(r, 100));
  }
  allValuePicks.sort((a, b) => (b.value||0) - (a.value||0));
  state._multiScanMode = false;
  renderMultiScanResults(allValuePicks, favs.length);
  if (btn) { btn.disabled = false; btn.textContent = '⚡ SCAN ALLES'; }
}

function renderMultiScanResults(picks, numComps) {
  const banner = document.getElementById('valueBanner');
  if (!banner) return;
  if (!picks.length) {
    banner.style.display = 'block';
    banner.innerHTML = `<div style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:#15803d;">⚡ MULTI-SCAN (${numComps} comp.)</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.58rem;color:var(--sub);padding:.8rem 0;">
        Geen value ≥5% gevonden. Bookmakers zitten goed in de markt vandaag.
      </div>
      <button onclick="this.parentElement.style.display='none'" style="background:none;border:none;color:var(--sub);cursor:pointer;font-size:.9rem;">✕</button>`;
    return;
  }
  const highCount = picks.filter(p => p.value >= 15).length;
  const medCount = picks.filter(p => p.value >= 5 && p.value < 15).length;
  banner.style.display = 'block';
  banner.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:#15803d;">⚡ MULTI-SCAN — ${numComps} competities</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);">
        <span style="color:#15803d;font-weight:700;">${highCount} sterk</span> · <span style="color:#b45309;font-weight:700;">${medCount} licht</span>
      </div>
    </div>
    ${picks.slice(0, 8).map(s => {
      const cls = s.value >= 15 ? '#15803d' : s.value >= 5 ? '#b45309' : '#64748b';
      const sign = s.value > 0 ? '+' : '';
      const inCombi = (state.combiBuilder||[]).some(l => String(l.matchId) === String(s.match?.id));
      return `<div style="display:flex;align-items:center;padding:.4rem 0;border-bottom:1px solid var(--stroke);">
        <div style="flex:1;cursor:pointer;" onclick="selectMatchAndAnalyse('${s.match?.id}')">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.6rem;font-weight:700;color:var(--ink);">${s.match?.home||'?'} vs ${s.match?.away||'?'}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:#7c3aed;">${s.compName}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);">${s.pickLabel} · ${s.kans}% · ${s.reason||''}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.2rem;margin-left:.5rem;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:${cls};">${sign}${Math.round(s.value)}%</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:.9rem;color:#16a34a;">${(s.odds||0).toFixed(2)}</div>
          <button onclick="addValuePickToCombi('${s.match?.id}','${s.pick}','${(s.pickLabel||'').replace(/'/g,"\\'")}',${s.odds||0},'${(s.match?.home||'').replace(/'/g,"\\'")}','${(s.match?.away||'').replace(/'/g,"\\'")}')"
            style="font-family:monospace;font-size:.48rem;font-weight:800;padding:2px 7px;border-radius:999px;cursor:pointer;
            border:1px solid ${inCombi?'rgba(22,163,74,.4)':'rgba(219,39,119,.35)'};
            background:${inCombi?'rgba(22,163,74,.12)':'rgba(255,215,230,.4)'};
            color:${inCombi?'#15803d':'#d63384'};">${inCombi ? '✓ IN COMBI' : '+ COMBI'}</button>
        </div>
      </div>`;
    }).join('')}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:.5rem;">
      <span style="font-family:monospace;font-size:.5rem;color:var(--sub);">Tik naam → analyse</span>
      <button onclick="this.parentElement.parentElement.style.display='none'" style="background:none;border:none;color:var(--sub);cursor:pointer;">✕</button>
    </div>
  `;
}

// ── Scan resultaten panel ─────────────────────────────────
function renderScanResults(scans, restored = false) {
  const panel = document.getElementById('scanResultsPanel');
  const _list = document.createElement('div');
  if (!panel) return;
  if (!scans.length) { panel.style.display = 'none'; return; }
  const normalized = scans.map(s => ({
    matchId: s.matchId || s.match?.id,
    home: s.home || s.match?.home || '?',
    away: s.away || s.match?.away || '?',
    comp: s.comp || s.match?.comp || '',
    pickLabel: s.pickLabel || '?',
    value: s.value || 0,
    confidence: s.confidence || 0,
    odds: s.odds || null,
    scanTime: s.scanTime || ''
  }));
  const withValue = normalized.filter(s => s.value >= 5);
  const displayList = withValue.length > 0 ? withValue : normalized;
  panel.style.display = 'block';
  panel.innerHTML = `
    <div class="scan-results-header" onclick="this.parentElement.querySelector('#scanResultsList').style.display = this.parentElement.querySelector('#scanResultsList').style.display==='none'?'block':'none'">
      <div class="scan-results-title">⚡ SCAN RESULTATEN${restored ? ' (hersteld)' : ''} · ${displayList.length} picks</div>
      <button onclick="event.stopPropagation();document.getElementById('scanResultsPanel').style.display='none'" style="background:none;border:none;color:var(--sub);cursor:pointer;">✕</button>
    </div>
    <div id="scanResultsList">
      ${displayList.map(s => {
        const cls = s.value >= 15 ? 'pos' : s.value >= 5 ? 'neu' : 'neg';
        const sign = s.value > 0 ? '+' : '';
        return `<div class="scan-result-row" onclick="openScanResult('${s.matchId}')">
          <div style="flex:1;">
            <div class="scan-result-match">${s.home} vs ${s.away}</div>
            <div class="scan-result-pick">${s.pickLabel}${s.odds ? ' · @ ' + s.odds.toFixed(2) : ''}${s.confidence ? ' · 🎲 ' + s.confidence + '/10' : ''}</div>
          </div>
          <div class="scan-result-value ${cls}">${sign}${Math.round(s.value)}%</div>
          <button onclick="event.stopPropagation();addScanPickToCombi('${s.matchId}','','${(s.pickLabel||'').replace(/'/g,"\\'")}',${s.odds||1.5},'${(s.home||'').replace(/'/g,"\\'")}','${(s.away||'').replace(/'/g,"\\'")}')"
            id="sr-combi-${s.matchId}"
            style="font-family:monospace;font-size:.48rem;font-weight:800;padding:2px 7px;border-radius:999px;cursor:pointer;
            background:rgba(219,39,119,.1);border:1px solid rgba(219,39,119,.3);color:#be185d;margin-left:.4rem;">
            + COMBI
          </button>
        </div>`;
      }).join('')}
    </div>
  `;
}

function openScanResult(matchId) {
  let m = (state.matches||[]).find(x => String(x.id) === String(matchId));
  if (m) {
    switchScreen('wedstrijden');
    setTimeout(() => {
      selectMatch(m);
      const card = document.getElementById('match-' + m.id);
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  } else {
    const scan = (state.lastScanResults||[]).find(s => String(s.matchId) === String(matchId));
    if (scan) showAutoCheckBar(`📍 Laad ${scan.comp || 'competitie'} eerst om deze wedstrijd te zien`, 3000);
    switchScreen('wedstrijden');
  }
}

function hideValueBanner() {
  const b = document.getElementById('valueBanner');
  if (b) b.style.display = 'none';
}
