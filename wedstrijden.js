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

  const scanResult = (state.lastScanResults||[]).find(s => String(s.matchId) === String(m.id));
  const valueBadge = scanResult && scanResult.value >= 5 ? `
    <div style="position:absolute;top:8px;right:8px;font-family:'IBM Plex Mono',monospace;font-size:.55rem;font-weight:900;
      color:${scanResult.value >= 15 ? '#15803d' : '#b45309'};
      background:${scanResult.value >= 15 ? 'rgba(22,163,74,.12)' : 'rgba(180,83,9,.1)'};
      border:1px solid ${scanResult.value >= 15 ? 'rgba(22,163,74,.3)' : 'rgba(180,83,9,.3)'};
      padding:2px 8px;border-radius:999px;">⚡ +${Math.round(scanResult.value)}%</div>` : '';

  const statusClass = m.isLive ? 'status-live' : m.isDone ? 'status-done' : 'status-soon';
  const statusTxt   = m.isLive ? (m.liveMin ? m.liveMin + "'" : 'LIVE') : m.isDone ? 'FT' : m.time;
  const inCombi     = (state.combiBuilder||[]).some(l => String(l.matchId) === String(m.id));

  const hasOdds = m.homeOdds !== '—' && parseFloat(m.homeOdds) > 1;

  // Kansbalken — groen/oranje/rood zoals in de oude app
  const probBar = hasOdds ? `
    <div style="display:flex;gap:3px;margin:0 .9rem .5rem;height:5px;border-radius:999px;overflow:hidden;">
      <div style="flex:${m.homePct};background:#16a34a;border-radius:999px 0 0 999px;"></div>
      <div style="flex:${m.drawPct};background:#d97706;"></div>
      <div style="flex:${m.awayPct};background:#dc2626;border-radius:0 999px 999px 0;"></div>
    </div>
    <div style="display:flex;justify-content:space-between;padding:0 .9rem .6rem;
      font-family:'IBM Plex Mono',monospace;font-size:.52rem;font-weight:700;">
      <span style="color:#16a34a;">${m.homePct}% 1</span>
      <span style="color:#d97706;">${m.drawPct}% X</span>
      <span style="color:#dc2626;">${m.awayPct}% 2</span>
    </div>` : '';

  // Grote odds cards zoals in de oude app
  const oddsCards = hasOdds ? `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.45rem;padding:.1rem .9rem .5rem;">
      <button onclick="event.stopPropagation();openBetModal(event,'${m.id}','1','Thuis wint',${m.homeOdds})"
        style="background:var(--card);border:1px solid var(--stroke);border-radius:12px;
        padding:.55rem .3rem;cursor:pointer;transition:all .15s;text-align:center;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;font-weight:700;
          color:var(--sub);letter-spacing:.08em;margin-bottom:.3rem;">1 THUIS</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.5rem;color:#16a34a;line-height:1;">${m.homeOdds}</div>
      </button>
      <button onclick="event.stopPropagation();openBetModal(event,'${m.id}','X','Gelijkspel',${m.drawOdds})"
        style="background:var(--card);border:1px solid var(--stroke);border-radius:12px;
        padding:.55rem .3rem;cursor:pointer;transition:all .15s;text-align:center;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;font-weight:700;
          color:var(--sub);letter-spacing:.08em;margin-bottom:.3rem;">X GELIJK</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.5rem;color:#d97706;line-height:1;">${m.drawOdds}</div>
      </button>
      <button onclick="event.stopPropagation();openBetModal(event,'${m.id}','2','Uit wint',${m.awayOdds})"
        style="background:var(--card);border:1px solid var(--stroke);border-radius:12px;
        padding:.55rem .3rem;cursor:pointer;transition:all .15s;text-align:center;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;font-weight:700;
          color:var(--sub);letter-spacing:.08em;margin-bottom:.3rem;">2 UIT</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.5rem;color:#dc2626;line-height:1;">${m.awayOdds}</div>
      </button>
    </div>
    <div style="text-align:right;padding:.0rem .9rem .4rem;">
      <button onclick="event.stopPropagation();openJacks('${m.id}')"
        style="background:none;border:none;font-family:'IBM Plex Mono',monospace;font-size:.48rem;
        color:var(--sub);cursor:pointer;text-decoration:underline;">
        🎰 Andere quotes gebruiken
      </button>
    </div>` : '';

  card.innerHTML = `
    <div style="position:relative;">
      ${valueBadge}
      <!-- Header: competitie + datum + status -->
      <div style="display:flex;align-items:center;justify-content:space-between;
        padding:.55rem .9rem .4rem;border-bottom:1px solid var(--stroke);">
        <div style="display:flex;align-items:center;gap:.4rem;">
          ${m.compLogo ? `<img src="${m.compLogo}" style="width:14px;height:14px;object-fit:contain;" onerror="this.style.display='none'">` : ''}
          <span style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;color:var(--sub);font-weight:700;">
            ${m.comp || ''}
          </span>
        </div>
        <div style="display:flex;align-items:center;gap:.5rem;">
          <span style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;color:#be185d;font-weight:700;">
            ${m.date ? m.date + ' ' : ''}${m.time}
          </span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;font-weight:800;
            padding:2px 8px;border-radius:999px;
            ${m.isLive ? 'background:rgba(220,38,38,.12);color:#dc2626;' :
              m.isDone ? 'background:rgba(100,116,139,.1);color:var(--sub);' :
              'background:rgba(124,58,237,.1);color:#7c3aed;'}">
            ${statusTxt}
          </span>
        </div>
      </div>

      <!-- Teams met logo's -->
      <div style="display:flex;align-items:center;padding:.75rem .9rem .6rem;gap:.5rem;">
        <!-- Thuis -->
        <div style="flex:1;display:flex;flex-direction:column;align-items:flex-start;gap:.3rem;">
          ${m.homeLogo ? `<img src="${m.homeLogo}" style="width:40px;height:40px;object-fit:contain;" onerror="this.style.display='none'">` :
            `<div style="width:40px;height:40px;border-radius:50%;background:rgba(219,39,119,.1);display:flex;align-items:center;justify-content:center;font-size:1.1rem;">⚽</div>`}
          <div style="font-family:'DM Sans',sans-serif;font-size:.95rem;font-weight:800;color:var(--ink);line-height:1.2;">${m.home}</div>
        </div>

        <!-- Score / VS -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:.2rem;min-width:44px;">
          ${m.score
            ? `<div style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;color:var(--ink);letter-spacing:.05em;">${m.score}</div>`
            : `<div style="font-family:'IBM Plex Mono',monospace;font-size:.75rem;font-weight:700;color:var(--sub);">VS</div>`}
        </div>

        <!-- Uit -->
        <div style="flex:1;display:flex;flex-direction:column;align-items:flex-end;gap:.3rem;">
          ${m.awayLogo ? `<img src="${m.awayLogo}" style="width:40px;height:40px;object-fit:contain;" onerror="this.style.display='none'">` :
            `<div style="width:40px;height:40px;border-radius:50%;background:rgba(124,58,237,.1);display:flex;align-items:center;justify-content:center;font-size:1.1rem;">⚽</div>`}
          <div style="font-family:'DM Sans',sans-serif;font-size:.95rem;font-weight:800;color:var(--ink);line-height:1.2;text-align:right;">${m.away}</div>
        </div>
      </div>

      <!-- Kansbalken -->
      ${probBar}

      <!-- Grote odds cards -->
      ${oddsCards}

      ${!hasOdds ? `
      <!-- Geen odds: alleen analyse knop -->
      <div style="padding:.3rem .9rem .65rem;">
        <button onclick="event.stopPropagation();selectMatchAndAnalyse('${m.id}')"
          style="width:100%;padding:.5rem;border-radius:10px;background:rgba(219,39,119,.08);
          border:1px solid rgba(219,39,119,.2);font-family:monospace;font-size:.58rem;
          font-weight:700;color:#be185d;cursor:pointer;">
          🤖 ANALYSEER
        </button>
      </div>` : ''}

      <!-- Onderste actieknoppen -->
      ${hasOdds ? `
      <div style="display:flex;gap:.4rem;padding:.0rem .9rem .7rem;">
        <button onclick="event.stopPropagation();selectMatchAndAnalyse('${m.id}')"
          style="flex:1;padding:.4rem;border-radius:9px;background:rgba(219,39,119,.1);
          border:1px solid rgba(219,39,119,.25);font-family:monospace;font-size:.55rem;
          font-weight:700;color:#be185d;cursor:pointer;">
          🤖 ANALYSE
        </button>
        <button onclick="event.stopPropagation();toggleCombiAdd('${m.id}')"
          id="combi-btn-${m.id}"
          style="flex:1;padding:.4rem;border-radius:9px;
          background:${inCombi ? 'rgba(22,163,74,.12)' : 'rgba(124,58,237,.08)'};
          border:1px solid ${inCombi ? 'rgba(22,163,74,.3)' : 'rgba(124,58,237,.2)'};
          font-family:monospace;font-size:.55rem;font-weight:700;
          color:${inCombi ? '#15803d' : '#7c3aed'};cursor:pointer;">
          ${inCombi ? '✓ IN COMBI' : '+ COMBI'}
        </button>
      </div>` : ''}
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
    let r = await apiFetch(`https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${season}&date=${today}`, null, 10000);
    let d = await r.json();
    if (d.response?.length > 0) {
      state.matches = d.response.map(f => parseAPIMatch(f)).filter(Boolean);
      renderMatches(state.matches);
      saveOpeningOdds(state.matches);
      fetchOddsForMatches(leagueId, null).then(() => renderMatches(state.matches));
      return true;
    }
    // Volgende wedstrijden (next=10)
    r = await apiFetch(`https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${season}&next=10`, null, 10000);
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
async function fetchOddsForMatches(leagueId, _apiKey) {
  if (!leagueId) return;
  const cacheKey = `odds_league_${leagueId}`;
  const cached = typeof _cacheGet === 'function' ? _cacheGet(cacheKey) : null;
  let oddsData = cached;

  if (!oddsData) {
    // Probeer meerdere bookmakers: 8=Unibet, 6=Bet365, 1=10Bet
    const bookmakers = [8, 6, 1];
    for (const bm of bookmakers) {
      try {
        const season = leagueId === 1 ? 2026 : 2025;
        const r = await apiFetch(
          `https://v3.football.api-sports.io/odds?league=${leagueId}&season=${season}&bookmaker=${bm}`,
          null, 8000
        );
        const d = await r.json();
        if (d.response?.length) {
          oddsData = d.response;
          if (typeof _cacheSet === 'function') _cacheSet(cacheKey, oddsData);
          break;
        }
      } catch(e) {}
    }
  }

  if (!oddsData?.length) return;

  for (const odds of oddsData) {
    const fid = String(odds.fixture?.id);
    const match = state.matches.find(m => m.id === fid);
    if (!match) continue;
    const bk = odds.bookmakers?.[0];
    if (!bk) continue;
    const mkt = bk.bets?.find(b => b.name === 'Match Winner');
    if (!mkt?.values) continue;
    const h    = mkt.values.find(v => v.value === 'Home');
    const draw = mkt.values.find(v => v.value === 'Draw');
    const a    = mkt.values.find(v => v.value === 'Away');
    if (h)    match.homeOdds = parseFloat(h.odd).toFixed(2);
    if (draw) match.drawOdds = parseFloat(draw.odd).toFixed(2);
    if (a)    match.awayOdds = parseFloat(a.odd).toFixed(2);
    if (h && draw && a) {
      const inv = 1/parseFloat(h.odd) + 1/parseFloat(draw.odd) + 1/parseFloat(a.odd);
      match.homePct = Math.round((1/parseFloat(h.odd))/inv*100);
      match.drawPct = Math.round((1/parseFloat(draw.odd))/inv*100);
      match.awayPct = 100 - match.homePct - match.drawPct;
    }
  }
}

async function fetchOddsForAllMatches(matches, _apiKey) {
  // Groepeer per league voor efficiënte batch calls ipv per fixture
  const matchesWithoutOdds = matches.filter(m => m.source === 'apif' && m.homeOdds === '—');
  if (!matchesWithoutOdds.length) return;

  // Groepeer per leagueId
  const byLeague = {};
  matchesWithoutOdds.forEach(m => {
    const lid = m.leagueId;
    if (!lid) return;
    if (!byLeague[lid]) byLeague[lid] = [];
    byLeague[lid].push(m);
  });

  // Per league: 1 call voor alle odds ipv per fixture
  for (const [leagueId, leagueMatches] of Object.entries(byLeague)) {
    const cacheKey = `odds_league_${leagueId}`;
    let oddsData = typeof _cacheGet === 'function' ? _cacheGet(cacheKey) : null;

    if (!oddsData) {
      const bookmakers = [8, 6, 1];
      for (const bm of bookmakers) {
        try {
          const today = new Date().toISOString().split('T')[0];
          const r = await apiFetch(
            `https://v3.football.api-sports.io/odds?league=${leagueId}&date=${today}&bookmaker=${bm}`,
            null, 8000
          );
          const d = await r.json();
          if (d.response?.length) {
            oddsData = d.response;
            if (typeof _cacheSet === 'function') _cacheSet(cacheKey, oddsData);
            break;
          }
        } catch(e) {}
      }
    }

    if (!oddsData?.length) continue;

    for (const odds of oddsData) {
      const fid = String(odds.fixture?.id);
      const match = state.matches.find(m => m.id === fid);
      if (!match) continue;
      const bk = odds.bookmakers?.[0];
      if (!bk) continue;
      const mkt = bk.bets?.find(b => b.name === 'Match Winner');
      if (!mkt?.values) continue;
      const h    = mkt.values.find(v => v.value === 'Home');
      const draw = mkt.values.find(v => v.value === 'Draw');
      const a    = mkt.values.find(v => v.value === 'Away');
      if (h)    match.homeOdds = parseFloat(h.odd).toFixed(2);
      if (draw) match.drawOdds = parseFloat(draw.odd).toFixed(2);
      if (a)    match.awayOdds = parseFloat(a.odd).toFixed(2);
      if (h && draw && a) {
        const inv = 1/parseFloat(h.odd) + 1/parseFloat(draw.odd) + 1/parseFloat(a.odd);
        match.homePct = Math.round((1/parseFloat(h.odd))/inv*100);
        match.drawPct = Math.round((1/parseFloat(draw.odd))/inv*100);
        match.awayPct = 100 - match.homePct - match.drawPct;
      }
    }
  }
  // Herrender kaarten met nieuwe odds
  renderMatches(state.matches);
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
  const allValuePicks = [];
  for (let i = 0; i < favs.length; i++) {
    const comp = favs[i];
    if (btn) btn.textContent = `⟳ ${i+1}/${favs.length} ${COMP_NAMES[comp]?.split(' ').slice(1).join(' ') || comp}`;
    state.activeComp = comp;
    state.matches = []; state.valueScans = [];
    document.querySelectorAll('.comp-chip').forEach(c => c.classList.remove('active'));
    document.getElementById('comp-' + comp)?.classList.add('active');
    const fdKey = state.settings.fdKey;
    const fdCode = FD_CODES[comp];
    let loaded = await loadFromAPIFootball(comp, null);
    if (!loaded && fdKey && fdCode) loaded = await loadFromFD(fdCode, fdKey, comp);
    if (!state.matches.length) continue;
    if (btn) btn.textContent = `⟳ ${i+1}/${favs.length} quotes ophalen...`;
    const leagueId = COMP_IDS[comp];
    if (leagueId) await fetchOddsForMatches(leagueId, null);
    const withOdds = state.matches.filter(m => m.homeOdds !== '—' && parseFloat(m.homeOdds) > 1);
    if (!withOdds.length) { console.log(`${comp}: geen odds beschikbaar, overgeslagen`); continue; }
    if (btn) btn.textContent = `⟳ ${i+1}/${favs.length} scannen...`;
    await scanValueAll();
    if (state.valueScans?.length) {
      allValuePicks.push(...state.valueScans
        .filter(s => s.value >= 5)
        .map(s => ({ ...s, compName: COMP_NAMES[comp] || comp })));
    }
  }
  allValuePicks.sort((a, b) => (b.value||0) - (a.value||0));
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

// ── Jacks.nl directe link ─────────────────────────────────
function openJacks(matchId) {
  const m = (state.matches||[]).find(x => String(x.id) === String(matchId));
  if (!m) { window.open('https://www.jacks.nl/sport/voetbal', '_blank'); return; }

  // Bouw zoekterm op: "thuisteam uitteam" of alleen teamnamen
  const homeSlug = encodeURIComponent(m.home.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  const awaySlug = encodeURIComponent(m.away.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));

  // Jacks URL structuur: /sport/voetbal/[competitie]/[thuis]-[uit]
  // Probeer directe match URL, val terug op zoekpagina
  const compSlugMap = {
    'Premier League':        'premier-league',
    'Eredivisie':            'eredivisie',
    'Bundesliga':            'bundesliga',
    'Ligue 1':               'ligue-1',
    'Serie A':               'serie-a',
    'La Liga':               'la-liga',
    'Champions League':      'champions-league',
    'Keuken Kampioen Divisie':'keuken-kampioen-divisie',
    'Jupiler Pro League':    'jupiler-pro-league',
    'Championship':          'championship',
    '2. Bundesliga':         '2-bundesliga',
    'Süper Lig':             'super-lig',
  };

  const comp = m.comp || '';
  let compSlug = null;
  for (const [name, slug] of Object.entries(compSlugMap)) {
    if (comp.toLowerCase().includes(name.toLowerCase())) { compSlug = slug; break; }
  }

  let url;
  if (compSlug) {
    url = `https://www.jacks.nl/sport/voetbal/${compSlug}/${homeSlug}-${awaySlug}`;
  } else {
    // Fallback: zoek op teamnamen
    url = `https://www.jacks.nl/sport/zoeken?q=${encodeURIComponent(m.home + ' ' + m.away)}`;
  }

  window.open(url, '_blank');
}
