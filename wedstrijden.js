// ═══════════════════════════════════════════════════════
// WEDSTRIJDEN.JS v30
// v9: Sharp money badge + odds movement indicator op wedstrijdkaarten — matches, comp chips, value scan, combi
// v18.4: vriendelijke lege states, skeleton loading
// ═══════════════════════════════════════════════════════

// ── Competitie definities ────────────────────────────────
// ── Datum-gebaseerde competitie lijst ────────────────────
function getActiveCOMPLIST() {
  const now = new Date();
  const wkStart = new Date('2026-06-11');
  const wkEnd   = new Date('2026-07-20');
  const euroEnd = new Date('2026-06-01');
  const isWK    = now >= wkStart && now < wkEnd;
  const isPreEuroEnd = now < euroEnd;

  const WK       = [{ key:'wk2026',    flag:'🏆', name:'WK 2026' }];
  const SCANDI   = [
    { key:'norway',   flag:'🇳🇴', name:'Eliteserien' },
    { key:'sweden',   flag:'🇸🇪', name:'Allsvenskan' },
  ];
  // Klaar voor seizoen (verborgen tot augustus 2026)
  // Premier, Bundesliga, LaLiga, SerieA, Ligue1, Champions, Europa, Conference, Eredivisie, Jupiler
  const EUROPEES = [
    { key:'superlig',   flag:'🇹🇷', name:'Süper Lig' },  // loopt door tot juni
  ];
  const OVERIG = [
    // KNVB Beker klaar — verbergen tot nieuw seizoen
  ];
  const EXTRA = [
    { key:'portugal',    flag:'🇵🇹', name:'Primeira Liga' },
    { key:'denmark',     flag:'🇩🇰', name:'Superliga DK' },
    { key:'poland',      flag:'🇵🇱', name:'Ekstraklasa' },
    { key:'austria',     flag:'🇦🇹', name:'Bundesliga AT' },
    { key:'greece',      flag:'🇬🇷', name:'Super League GR' },
  ];
  const INTERNATIONAAL = [
    { key:'nations',        flag:'🏴',  name:'Nations League' },
    { key:'intvriendsch',   flag:'🤝',  name:'Int. Vriendsch.' },
    { key:'wk_kwal_europa', flag:'🇪🇺', name:'WK Kwal. Europa' },
    { key:'wk_kwal_latam',  flag:'🌎',  name:'WK Kwal. CONMEBOL' },
    { key:'wk_kwal_azie',   flag:'🌏',  name:'WK Kwal. Azië' },
    { key:'copaamerica',    flag:'🏆',  name:'Copa América' },
    { key:'goldcup',        flag:'🥇',  name:'Gold Cup' },
    { key:'africup',        flag:'🌍',  name:'Africa Cup' },
    { key:'asiancup',       flag:'🌏',  name:'Asian Cup' },
  ];

  if (typeof WK_ONLY_MODE !== 'undefined' && WK_ONLY_MODE) return [...WK]; // tijdelijk: alleen WK 2026
  if (isWK)          return [...WK, ...INTERNATIONAAL, ...SCANDI, ...EXTRA, ...OVERIG];
  if (!isPreEuroEnd) return [...WK, ...INTERNATIONAAL, ...SCANDI, ...EUROPEES, ...EXTRA, ...OVERIG];
  return              [...EUROPEES, ...SCANDI, ...EXTRA, ...WK, ...INTERNATIONAAL, ...OVERIG];
}

const COMP_LIST = getActiveCOMPLIST();

let _scanCompFilter = new Set();
let scanCompFilter = new Set();
let _multiMode = false;

// ── Wedstrijden screen render ─────────────────────────────
function renderWedstrijdenScreen() {
  const screen = document.getElementById('screen-wedstrijden');
  if (!screen) return;

  // Verwijder favoriteComps die niet meer in de actieve lijst staan
  const activeKeys = new Set(getActiveCOMPLIST().map(c => c.key));
  state.favoriteComps = (state.favoriteComps || []).filter(k => activeKeys.has(k));
  const favs = state.favoriteComps || [];

  screen.innerHTML = `
    <!-- AutoCheck bar -->
    <div id="autoCheckBar" style="display:none;font-family:\'IBM Plex Mono\',monospace;font-size:.58rem;color:#00BEC4;
      background:rgba(0,190,196,.08);border:1px solid rgba(0,190,196,.2);border-radius:8px;
      padding:.4rem .8rem;margin-bottom:.7rem;transition:opacity .35s;"></div>

    <!-- ══ HOOFD TABS ══ -->
    <div style="display:flex;gap:.3rem;background:rgba(255,255,255,.04);border-radius:12px;padding:.25rem;margin-bottom:.75rem;border:1px solid rgba(255,255,255,.08);">
      <button id="wtab-wedstrijden" onclick="setWedstrijdenTab('wedstrijden')"
        style="flex:1;border:none;border-radius:9px;padding:.5rem .2rem;font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;font-weight:700;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:.25rem;background:rgba(0,190,196,.15);color:#00BEC4;box-shadow:0 1px 4px rgba(0,0,0,.2);">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
        Wedstrijden
      </button>
      <button id="wtab-vandaag" onclick="setWedstrijdenTab('vandaag')"
        style="flex:1;border:none;border-radius:9px;padding:.5rem .2rem;font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;font-weight:700;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:.25rem;background:transparent;color:rgba(255,255,255,.88);">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Vandaag
      </button>
      <button id="wtab-value" onclick="setWedstrijdenTab('value')"
        style="flex:1;border:none;border-radius:9px;padding:.5rem .2rem;font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;font-weight:700;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:.25rem;background:transparent;color:rgba(255,255,255,.88);">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        Value Picks
      </button>
      <button id="wtab-live" onclick="setWedstrijdenTab('live')"
        style="flex:1;border:none;border-radius:9px;padding:.5rem .2rem;font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;font-weight:700;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:.25rem;background:transparent;color:rgba(255,255,255,.88);">
        <span style="width:7px;height:7px;background:#ef4444;border-radius:50%;animation:blink .9s infinite;box-shadow:0 0 5px #ef4444;flex-shrink:0;display:inline-block;"></span>
        Live
      </button>
    </div>

    <!-- Scan resultaten panel -->
    <div id="scanResultsPanel" style="display:none;"></div>
    <div id="valueBanner" style="display:none;background:rgba(255,255,255,.05);border:1px solid rgba(0,190,196,.25);border-radius:16px;padding:.9rem;margin-bottom:.85rem;"></div>

    <!-- ══ TAB: WEDSTRIJDEN ══ -->
    <div id="wtab-content-wedstrijden">

    <!-- Competitie tiles - compact grid -->
    <div style="margin-bottom:.6rem;">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;" id="compGrid">
        ${COMP_LIST.map(c => {
          const isActive = state.activeComp === c.key;
          const isFav = favs.includes(c.key);
          const shortName = c.name.length > 10 ? c.name.split(' ').slice(0,2).join(' ') : c.name;
          return `<div class="comp-chip${isActive?' active':''}${isFav?' fav':''}" id="comp-${c.key}"
            style="flex-direction:column;padding:.6rem .3rem;text-align:center;border-radius:14px;
            cursor:pointer;background:${isActive?'rgba(0,190,196,.15)':'rgba(255,255,255,.05)'};
            border:1.5px solid ${isActive?'rgba(0,190,196,.6)':'rgba(255,255,255,.1)'};
            position:relative;"
            ontouchstart="handleCompTouchStart('${c.key}',event)"
            ontouchend="handleCompTouchEnd('${c.key}')"
            onclick="handleCompTap('${c.key}')">
            <div style="font-size:1.5rem;line-height:1.3;margin-bottom:.15rem;">${c.flag}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;font-weight:700;
              color:${isActive?'#00BEC4':'rgba(255,255,255,.9)'};overflow:hidden;white-space:nowrap;
              text-overflow:ellipsis;max-width:100%;padding:0 3px;line-height:1.3;">${shortName}</div>
            ${isFav ? '<div style="position:absolute;top:4px;right:5px;font-size:.6rem;">✓</div>' : ''}
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Acties balk -->
    <div style="display:flex;gap:.4rem;margin-bottom:.6rem;flex-wrap:wrap;">
      <button id="multiModeBtn" onclick="toggleMultiMode()"
        style="font-family:\'IBM Plex Mono\',monospace;font-size:.52rem;font-weight:700;
        padding:.35rem .8rem;border-radius:999px;cursor:pointer;
        background:rgba(0,190,196,.1);border:1px solid rgba(0,190,196,.3);color:#00BEC4;">
        📌 MULTI-SCAN
      </button>
      <button id="scan3DaysBtn" onclick="scanAllTodayValue('3days')"
        style="font-family:\'IBM Plex Mono\',monospace;font-size:.52rem;font-weight:700;
        padding:.35rem .8rem;border-radius:999px;cursor:pointer;
        background:rgba(124,58,237,.12);border:1px solid rgba(124,58,237,.35);color:#a78bfa;">
        📅 SCAN 3 DAGEN
      </button>
      <button onclick="loadTodayAllComps()"
        style="font-family:\'IBM Plex Mono\',monospace;font-size:.52rem;font-weight:700;
        padding:.35rem .8rem;border-radius:999px;cursor:pointer;
        background:rgba(0,190,196,.08);border:1px solid rgba(0,190,196,.25);color:#00BEC4;">
        📅 VANDAAG
      </button>
      <button onclick="openCompDetail(state.activeComp)"
        style="font-family:\'IBM Plex Mono\',monospace;font-size:.52rem;font-weight:700;
        padding:.35rem .8rem;border-radius:999px;cursor:pointer;
        background:rgba(0,190,196,.08);border:1px solid rgba(0,190,196,.25);color:#00BEC4;">
        📊 STAND & INFO
      </button>
    </div>

    <!-- Multi-scan hint -->
    <div id="multiModeHint" style="display:none;font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:#00BEC4;
      background:rgba(0,190,196,.06);border:1px solid rgba(0,190,196,.15);border-radius:8px;
      padding:.4rem .8rem;margin-bottom:.5rem;">
      ✓ Multi-modus actief — tik op competities om te selecteren
    </div>

    <!-- Multi-scan balk -->
    <div id="multiScanBar" style="display:${favs.length >= 1 ? 'flex' : 'none'};align-items:center;justify-content:space-between;
      background:rgba(0,190,196,.06);border:1px solid rgba(0,190,196,.2);border-radius:12px;
      padding:.55rem .9rem;margin-bottom:.7rem;gap:.5rem;">
      <div style="flex:1;">
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:700;color:#00BEC4;">📌 MULTI-SCAN</div>
        <div id="multiScanComps" style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:rgba(255,255,255,.95);">
          ${favs.length >= 2 ? favs.map(c => COMP_NAMES[c]?.split(' ').slice(1).join(' ') || c).join(' · ') : 'Selecteer nog een competitie'}
        </div>
      </div>
      <div style="display:flex;gap:.4rem;">
        <button id="multiScanBtn" onclick="runMultiScan()"
          style="font-family:\'IBM Plex Mono\',monospace;font-size:.55rem;font-weight:800;
          padding:.4rem .8rem;border-radius:999px;cursor:pointer;
          background:rgba(0,190,196,.15);border:1px solid rgba(0,190,196,.4);color:#00BEC4;">
          ⚡ SCAN ALLES
        </button>
        <button onclick="clearFavoriteComps()"
          style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;padding:.35rem .65rem;
          border-radius:999px;background:transparent;border:1px solid rgba(255,255,255,0.09);color:rgba(255,255,255,.95);cursor:pointer;">
          ✕
        </button>
      </div>
    </div>

    <!-- Handmatig wedstrijd toevoegen -->
    <div style="margin-bottom:.6rem;">
      <button onclick="toggleManualMatchSection()"
        style="font-family:\'IBM Plex Mono\',monospace;font-size:.52rem;font-weight:700;
        padding:.35rem .8rem;border-radius:999px;
        background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.95);cursor:pointer;">
        ➕ Wedstrijd handmatig toevoegen
      </button>
    </div>
    <div id="manualMatchSection" style="display:none;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);
      border-radius:14px;padding:.9rem;margin-bottom:.7rem;">
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.6rem;font-weight:700;color:rgba(255,255,255,.95);margin-bottom:.6rem;">HANDMATIGE INVOER</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;margin-bottom:.4rem;">
        <input id="manualHome" type="text" placeholder="Thuisploeg" style="font-family:monospace;font-size:.62rem;padding:.4rem .6rem;border-radius:8px;border:1px solid rgba(255,255,255,0.09);background:rgba(255,255,255,0.05);color:#ffffff;outline:none;">
        <input id="manualAway" type="text" placeholder="Uitploeg" style="font-family:monospace;font-size:.62rem;padding:.4rem .6rem;border-radius:8px;border:1px solid rgba(255,255,255,0.09);background:rgba(255,255,255,0.05);color:#ffffff;outline:none;">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.4rem;margin-bottom:.4rem;">
        <input id="manualOdds1" type="number" step=".01" placeholder="1" style="font-family:monospace;font-size:.62rem;padding:.4rem .5rem;border-radius:8px;border:1px solid rgba(255,255,255,0.09);background:rgba(255,255,255,0.05);color:#ffffff;outline:none;">
        <input id="manualOddsX" type="number" step=".01" placeholder="X" style="font-family:monospace;font-size:.62rem;padding:.4rem .5rem;border-radius:8px;border:1px solid rgba(255,255,255,0.09);background:rgba(255,255,255,0.05);color:#ffffff;outline:none;">
        <input id="manualOdds2" type="number" step=".01" placeholder="2" style="font-family:monospace;font-size:.62rem;padding:.4rem .5rem;border-radius:8px;border:1px solid rgba(255,255,255,0.09);background:rgba(255,255,255,0.05);color:#ffffff;outline:none;">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;margin-bottom:.5rem;">
        <input id="manualLeague" type="text" placeholder="Competitie" style="font-family:monospace;font-size:.62rem;padding:.4rem .6rem;border-radius:8px;border:1px solid rgba(255,255,255,0.09);background:rgba(255,255,255,0.05);color:#ffffff;outline:none;">
        <input id="manualDate" type="date" style="font-family:monospace;font-size:.62rem;padding:.4rem .6rem;border-radius:8px;border:1px solid rgba(255,255,255,0.09);background:rgba(255,255,255,0.05);color:#ffffff;outline:none;">
      </div>
      <button onclick="addManualMatch()" style="width:100%;background:linear-gradient(135deg,rgba(0,190,196,.15),rgba(0,190,196,.1));border:1px solid rgba(0,190,196,.3);color:#00BEC4;font-family:monospace;font-size:.6rem;font-weight:700;padding:.5rem;border-radius:9px;cursor:pointer;">✓ TOEVOEGEN</button>
    </div>

    <!-- Match loading -->
    <div id="match-loading" style="display:none;font-family:\'IBM Plex Mono\',monospace;font-size:.6rem;color:var(--muted);text-align:center;padding:.5rem 0;"></div>

    <!-- Today/tomorrow scan buttons -->
    <div id="scanAllTodayBtn" style="display:none;width:100%;margin-bottom:.5rem;">
      <button onclick="scanAllTodayValue('today')"
        style="width:100%;background:linear-gradient(135deg,rgba(0,190,196,.12),rgba(5,150,105,.08));
        border:1.5px solid rgba(0,190,196,.3);color:#00BEC4;font-family:\'IBM Plex Mono\',monospace;
        font-size:.62rem;font-weight:800;padding:.65rem;border-radius:12px;cursor:pointer;">
        ⚡ SCAN ALLES VANDAAG
      </button>
    </div>
    <!-- v26.109: SCAN 3 DAGEN verplaatst naar actiebalk naast MULTI-SCAN -->
    <div id="allCompsLoading" style="display:none;flex-direction:column;align-items:center;padding:1.5rem;gap:.6rem;">
      <div style="width:24px;height:24px;border:2.5px solid rgba(0,190,196,.2);border-top-color:#00BEC4;border-radius:50%;animation:spin .7s linear infinite;"></div>
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.58rem;color:rgba(255,255,255,.95);">Wedstrijden laden...</div>
    </div>

    <!-- Match lijst -->
    <div id="matchList" class="match-list"></div>

    <!-- COMBI TIPS (verplaatst van Analyse — v26.105) -->
    <div class="analyse-block" style="padding:1.1rem;margin-top:.7rem;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:#fff;letter-spacing:.05em;margin-bottom:.8rem;">🏆 COMBI TIPS</div>
      <button id="combiGenBtn" onclick="generateCombiTip()" style="width:100%;padding:.8rem;font-family:'Bebas Neue',sans-serif;font-size:1.1rem;letter-spacing:.05em;background:linear-gradient(135deg,#00BEC4,#0099a8);color:#fff;border:none;border-radius:12px;cursor:pointer;margin-bottom:.5rem;">⚡ GENEREER TOP 3 TIPS + COMBI</button>
      <button onclick="openMonteCarloModal()" style="width:100%;padding:.65rem;font-family:'Bebas Neue',sans-serif;font-size:1rem;letter-spacing:.05em;background:rgba(124,58,237,.15);border:1.5px solid rgba(124,58,237,.5);color:#a78bfa;border-radius:12px;cursor:pointer;">🎲 MONTE CARLO BANKROLL SIMULATIE</button>
      <div id="combiCard" style="display:none;margin-top:.8rem;"></div>
    </div>

    <!-- Value scan button (per competitie) -->
    <div id="scanValueSection" style="margin-top:.5rem;display:none;">
      <button onclick="scanValueBatched()"
        style="width:100%;background:linear-gradient(135deg,rgba(0,190,196,.1),rgba(5,150,105,.06));
        border:1.5px solid rgba(0,190,196,.3);color:#00BEC4;font-family:\'IBM Plex Mono\',monospace;
        font-size:.65rem;font-weight:800;padding:.65rem;border-radius:12px;cursor:pointer;"
        id="valueScanBtn">
        ⚡ SCAN VALUE
      </button>
      <button onclick="showHelp('value-scan')" style="background:rgba(0,190,196,.1);border:1px solid rgba(0,190,196,.2);border-radius:999px;width:1.6rem;height:1.6rem;font-size:.65rem;cursor:pointer;color:#00a8ad;margin-left:.4rem;font-weight:800;">?</button>
    </div>

    </div><!-- /wtab-content-wedstrijden -->

    <!-- ══ TAB: VANDAAG ══ -->
    <div id="wtab-content-vandaag" style="display:none;">
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:800;color:rgba(255,255,255,.95);letter-spacing:.08em;margin-bottom:.65rem;display:flex;align-items:center;gap:.4rem;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00BEC4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        ALLE WEDSTRIJDEN VANDAAG
      </div>
      <div id="allCompsLoadingVandaag" style="display:none;flex-direction:column;align-items:center;padding:2rem;gap:.6rem;">
        <div style="width:24px;height:24px;border:2.5px solid rgba(0,190,196,.2);border-top-color:#00BEC4;border-radius:50%;animation:spin .7s linear infinite;"></div>
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.58rem;color:rgba(255,255,255,.95);">Wedstrijden laden...</div>
      </div>
      <div id="vandaagMatchList" class="match-list"></div>
      <div id="vandaagEmpty" style="display:none;text-align:center;padding:2.5rem 1rem;">
        <div style="font-size:2rem;margin-bottom:.5rem;">📅</div>
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.55rem;color:rgba(255,255,255,.95);">Geen wedstrijden vandaag gevonden</div>
        <button onclick="loadVandaagTab()" style="margin-top:.8rem;padding:.45rem .9rem;border-radius:10px;background:rgba(0,190,196,.1);border:1px solid rgba(0,190,196,.25);font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:#00BEC4;cursor:pointer;">↺ Opnieuw laden</button>
      </div>
    </div>

    <!-- ══ TAB: VALUE PICKS ══ -->
    <div id="wtab-content-value" style="display:none;">
      <div id="wedValuePicksList"></div>
    </div>

    <!-- ══ TAB: LIVE ══ -->
    <div id="wtab-content-live" style="display:none;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.65rem;">
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:800;color:rgba(255,255,255,.95);letter-spacing:.08em;display:flex;align-items:center;gap:.4rem;">
          <span style="width:8px;height:8px;background:#ef4444;border-radius:50%;animation:blink .9s infinite;box-shadow:0 0 5px #ef4444;display:inline-block;"></span>
          LIVE WEDSTRIJDEN
        </div>
        <button onclick="cleanupOldLiveMatches()" style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;padding:.25rem .55rem;border-radius:8px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:#ef4444;cursor:pointer;">🗑 Opruimen</button>
      </div>
      <div id="liveMatchList" class="match-list"></div>
      <div id="liveEmpty" style="display:none;text-align:center;padding:2.5rem 1rem;">
        <div style="font-size:2rem;margin-bottom:.5rem;">📡</div>
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.55rem;color:rgba(255,255,255,.95);">Geen live wedstrijden</div>
      </div>
    </div>

    <!-- Combi builder -->
    <div class="combi-builder" id="combiBuilder" style="display:none;">
      <div class="combi-builder-inner">
        <div class="combi-builder-header">
          <div class="combi-builder-title" style="display:flex;align-items:center;gap:.3rem;">⚡ COMBI BUILDER <button onclick="showHelp('combi-builder')" style="background:rgba(0,190,196,.1);border:1px solid rgba(0,190,196,.2);border-radius:999px;width:1.4rem;height:1.4rem;font-size:.55rem;cursor:pointer;color:#00a8ad;font-weight:800;">?</button></div>
          <div class="combi-builder-odds" id="combiTotalOdds">—</div>
        </div>
        <div class="combi-builder-legs" id="combiBuilderLegs"></div>
        <div id="combiBetSlipTotal"></div>
        <div class="combi-builder-actions">
          <button onclick="placeCombi()" class="combi-place-btn">💶 PLAATSEN</button>
          <button onclick="clearCombi()" class="combi-clear-btn">✕ WISSEN</button>
        </div>
      </div>
    </div>
  `;
}

// ── v18.4: Skeleton loading cards ────────────────────────
function showSkeletonCards(n = 4) {
  const list = document.getElementById('matchList');
  if (!list) return;
  list.innerHTML = Array.from({length: n}).map(() => `
    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);border-radius:16px;
      padding:1rem;margin-bottom:.6rem;animation:pulse 1.4s ease-in-out infinite;">
      <div style="display:flex;justify-content:space-between;margin-bottom:.8rem;">
        <div style="height:8px;width:90px;background:rgba(15,23,42,.08);border-radius:999px;"></div>
        <div style="height:8px;width:45px;background:rgba(15,23,42,.08);border-radius:999px;"></div>
      </div>
      <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.85rem;">
        <div style="width:40px;height:40px;border-radius:50%;background:rgba(15,23,42,.07);flex-shrink:0;"></div>
        <div style="flex:1;height:14px;background:rgba(15,23,42,.08);border-radius:8px;"></div>
        <div style="width:32px;height:14px;background:rgba(15,23,42,.05);border-radius:4px;"></div>
        <div style="flex:1;height:14px;background:rgba(15,23,42,.08);border-radius:8px;"></div>
        <div style="width:40px;height:40px;border-radius:50%;background:rgba(15,23,42,.07);flex-shrink:0;"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.4rem;">
        <div style="height:48px;background:rgba(15,23,42,.05);border-radius:10px;"></div>
        <div style="height:48px;background:rgba(15,23,42,.05);border-radius:10px;"></div>
        <div style="height:48px;background:rgba(15,23,42,.05);border-radius:10px;"></div>
      </div>
    </div>`).join('');
}

// ── v18.4: Loading bericht ────────────────────────────────
function showLoadingMsg(msg, color) {
  const el = document.getElementById('match-loading');
  if (!el) return;
  el.style.display = 'block';
  el.style.color = color || 'var(--sub)';
  el.innerHTML = msg;
}

// ── Match cards renderen ──────────────────────────────────
function renderMatches(matches) {
  const list = document.getElementById('matchList');
  if (!list) return;

  const loadingEl = document.getElementById('match-loading');
  if (loadingEl) loadingEl.style.display = 'none';

  // v18.4: vriendelijke lege state met actieknoppen
  if (!matches || !matches.length) {
    const _comp = state.activeComp || 'eredivisie';
    const _cname = (typeof COMP_NAMES !== 'undefined' && COMP_NAMES[_comp]) || _comp;
    list.innerHTML = `
      <div style="text-align:center;padding:2.5rem 1.25rem;
        display:flex;flex-direction:column;align-items:center;gap:.7rem;">
        <div style="font-size:2.2rem;opacity:.3;margin-bottom:.1rem;">⚽</div>
        <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.05rem;
          color:#ffffff;letter-spacing:.04em;">
          Geen wedstrijden
        </div>
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.55rem;
          color:rgba(255,255,255,.95);line-height:1.75;max-width:240px;">
          Niets gevonden voor <b style="color:#ffffff;">${_cname}</b> vandaag.<br>
          Probeer een andere competitie of laad alles van vandaag.
        </div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center;margin-top:.3rem;">
          <button onclick="loadTodayAllComps()"
            style="padding:.5rem 1rem;border-radius:10px;
            background:linear-gradient(135deg,rgba(0,190,196,.12),rgba(0,190,196,.08));
            border:1px solid rgba(0,190,196,.25);
            font-family:\'IBM Plex Mono\',monospace;font-size:.56rem;font-weight:700;
            color:#2563eb;cursor:pointer;">
            📅 Alles vandaag laden
          </button>
          <button onclick="loadMatches('${_comp}')"
            style="padding:.5rem 1rem;border-radius:10px;
            background:rgba(15,23,42,.04);border:1px solid rgba(255,255,255,0.09);
            font-family:\'IBM Plex Mono\',monospace;font-size:.56rem;font-weight:700;
            color:rgba(255,255,255,.95);cursor:pointer;">
            ↺ Opnieuw
          </button>
        </div>
      </div>`;
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
}


// ── Odds movement detectie voor sharp money badge ────────
const SHARP_PCT = 6; // v26.118: uniforme sharp-drempel (odds-beweging %) — tune hier
function getOddsMovement(matchId) {
  if (!matchId || !state.openingOdds) return null;
  const key = String(matchId);
  const opening = state.openingOdds[key];
  const current = (state.bookmakerOdds || {})[key];
  if (!opening || !current) return null;

  const results = [];
  [
    { pick: '1', label: 'Thuis', open: opening.home, cur: current.home },
    { pick: 'X', label: 'Gelijk', open: opening.draw, cur: current.draw },
    { pick: '2', label: 'Uit',    open: opening.away, cur: current.away },
  ].forEach(({ pick, label, open, cur }) => {
    if (!open || !cur || open <= 1 || cur <= 1) return;
    const pct = ((cur - open) / open) * 100;
    if (Math.abs(pct) >= SHARP_PCT) {
      results.push({ pick, label, pct: parseFloat(pct.toFixed(1)), open, cur });
    }
  });

  if (!results.length) return null;
  return results.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
}

function renderOddsMovementBadge(matchId) {
  const movements = getOddsMovement(matchId);
  if (!movements || !movements.length) return '';

  const top = movements[0];
  // Odds daalt = geld stroomt op die uitkomst = sharp money
  const isSharp = top.pct <= -SHARP_PCT;
  const isRising = top.pct >= SHARP_PCT;

  if (isSharp) {
    return `<div style="display:inline-flex;align-items:center;gap:.2rem;font-family:\'IBM Plex Mono\',monospace;
      font-size:.44rem;font-weight:700;color:#00BEC4;background:rgba(0,190,196,.1);
      border:1px solid rgba(0,190,196,.3);border-radius:999px;padding:2px 7px;margin-top:.25rem;">
      🦈 Sharp geld · ${top.label} ${top.pct.toFixed(1)}%
    </div>`;
  }
  if (isRising) {
    return `<div style="display:inline-flex;align-items:center;gap:.2rem;font-family:\'IBM Plex Mono\',monospace;
      font-size:.44rem;font-weight:700;color:#dc2626;background:rgba(220,38,38,.08);
      border:1px solid rgba(220,38,38,.2);border-radius:999px;padding:2px 7px;margin-top:.25rem;">
      📈 Odds stijgt · ${top.label} +${top.pct.toFixed(1)}%
    </div>`;
  }
  return '';
}

function renderOddsArrow(open, cur) {
  if (!open || !cur || open <= 1 || cur <= 1) return '';
  const pct = ((cur - open) / open) * 100;
  if (Math.abs(pct) < 2) return '';
  const down = pct < 0;
  return `<span style="font-size:.45rem;color:${down?'#00BEC4':'#dc2626'};margin-left:.2rem;">${down?'▼':'▲'}${Math.abs(pct).toFixed(0)}%</span>`;
}


// ── TAB SWITCH WEDSTRIJDEN ────────────────────────────────
function setWedstrijdenTab(tab) {
  const tabs = ['wedstrijden','vandaag','value','live'];
  tabs.forEach(t => {
    const btn     = document.getElementById('wtab-' + t);
    const content = document.getElementById('wtab-content-' + t);
    const isActive = t === tab;
    if (content) content.style.display = isActive ? 'block' : 'none';
    if (btn) {
      btn.style.background = isActive ? 'rgba(0,190,196,.15)' : 'transparent';
      btn.style.color      = isActive ? '#00BEC4' : 'rgba(255,255,255,.4)';
      btn.style.boxShadow  = isActive ? '0 1px 4px rgba(0,0,0,.2)' : 'none';
    }
  });
  if (tab === 'vandaag') loadVandaagTab();
  if (tab === 'value')   renderWedValuePicks();
  if (tab === 'live')    renderLiveTab();
}

// ── VANDAAG TAB — alle wedstrijden vandaag uit alle competities ──
async function loadVandaagTab() {
  const list    = document.getElementById('vandaagMatchList');
  const loading = document.getElementById('allCompsLoadingVandaag');
  const empty   = document.getElementById('vandaagEmpty');
  if (!list) return;

  if (loading) { loading.style.display = 'flex'; }
  list.innerHTML = '';
  if (empty) empty.style.display = 'none';

  try {
    // v26.8: één /fixtures?date= call (geen season-param → geen season-mismatch).
    // Vervangt de oude, niet-bestaande fetchMatchesForLeague() die elke keer
    // stil faalde waardoor de Vandaag-tab altijd leeg bleef.
    const todayStr = new Date().toISOString().split('T')[0];
    const r = await apiFetch(`${WORKER}/apif/fixtures?date=${todayStr}&_cb=${Date.now()}`, null, 12000);
    const d = await r.json();
    const knownLeagueIds = new Set(Object.values(COMP_IDS));
    const now = Date.now();

    const fixtures = (d.response || []).filter(f => {
      if (!f.league || !knownLeagueIds.has(f.league.id)) return false;
      const status = f.fixture?.status?.short;
      const isFinished = ['FT','AET','PEN','CANC','ABD','AWD','WO'].includes(status);
      const isLive = ['1H','2H','HT','ET','BT','P','INT','LIVE'].includes(status);
      if (isFinished) return false;
      if (isLive) {
        const _k = f.fixture?.date ? new Date(f.fixture.date).getTime() : 0;
        if (typeof isStaleLive === 'function' && isStaleLive(status, _k)) return false; // bevroren live-status
        return true;
      }
      // NS/TBD/PST: kickoff vandaag (vanaf 30 min geleden t/m einde dag)
      const kickoff = f.fixture?.date ? new Date(f.fixture.date).getTime() : 0;
      return kickoff > now - 30 * 60 * 1000;
    });

    let allMatches = fixtures.map(f => parseAPIMatch(f)).filter(Boolean);

    if (!allMatches.length) {
      if (loading) loading.style.display = 'none';
      if (empty) empty.style.display = 'block';
      return;
    }

    // In state zetten zodat odds eraan gekoppeld worden, dan quotes ophalen
    state.matches = allMatches;
    try { await fetchOddsForAllMatches(state.matches, null); } catch(e) {}

    if (loading) loading.style.display = 'none';
    allMatches.sort((a,b) => (a.time||'').localeCompare(b.time||''));

    list.innerHTML = '';
    allMatches.forEach(m => {
      const card = renderMatchCard(m);
      if (card) list.appendChild(card);
    });

  } catch(e) {
    if (loading) loading.style.display = 'none';
    if (empty) empty.style.display = 'block';
    console.warn('[loadVandaagTab]', e.message);
  }
}

// ── VALUE PICKS TAB — open value picks uit scan log ──
// ══ v26.89: renderWedValuePicks — volledig picks overzicht ══
async function renderWedValuePicks() {
  const el = document.getElementById('wedValuePicksList');
  if (!el) return;

  const WORKER = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : 'https://api.promatchxi.app');
  const mono   = "font-family:'IBM Plex Mono',monospace";
  const sans   = "font-family:'DM Sans',sans-serif";
  const bebas  = "font-family:'Bebas Neue',sans-serif";

  // Loading indicator
  el.innerHTML = `<div style="display:flex;justify-content:center;padding:2rem;">
    <div style="width:22px;height:22px;border:2.5px solid rgba(0,190,196,.2);border-top-color:#00BEC4;border-radius:50%;animation:spin .7s linear infinite;"></div>
  </div>`;

  const nowMs = Date.now();
  const STALE = 48 * 60 * 60 * 1000;
  const today = new Date().toISOString().split('T')[0];
  const seenFix = new Set();
  let allPicks = [];

  // 1. Probeer Supabase picks ophalen via worker
  try {
    const uid = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser.uid : null;
    const url = WORKER + '/picks' + (uid ? '?uid=' + uid : '');
    const res  = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const sbPicks = (data.picks || data || []).filter(p =>
        (!p.status || p.status === 'pending') &&
        (p.value||0) >= 3 &&
        p.pick !== 'X' &&
        (!(p.matchDate||p.match_date) || (p.matchDate||p.match_date) >= today)
      );
      sbPicks.forEach(p => {
        const fid = p.fixtureId || p.fixture_id || p.id;
        if (seenFix.has(fid)) return;
        seenFix.add(fid);
        allPicks.push({
          match:      p.matchName || ((p.home||'?') + ' vs ' + (p.away||'?')),
          pickLabel:  p.pickLabel || p.pick_label || p.pick,
          pick:       p.pick,
          odds:       p.odds,
          value:      parseFloat(p.value||0),
          confidence: parseFloat(p.confidence || p.confidence_final || 0),  // 1-10 score
          comp:       p.leagueName || p.league_name || '',
          elite:      p.elite,
          lockLevel:  p.lockLevel || p.lock_level || 'single',
          sharpTier:  p.sharpTier || p.sharp_tier,
          sharpScore: p.sharpScore || p.sharp_score,
          sharpMove:  p.oddsMovement || p.odds_movement,
          fixtureId:  fid,
          _source:    'supabase',
        });
      });
    }
  } catch(e) { console.warn('[ValuePicks] Supabase fetch mislukt:', e.message); }

  // 2. Aanvullen met lokale scanLog (handmatige scans)
  const scanLog = state.scanLog || [];
  scanLog
    .flatMap(s => (s.picks||[]).map(p => ({ ...p, _scanTs: s.timestamp })))
    .filter(p => {
      if (p.status && p.status !== 'pending') return false;
      if ((p.value||0) < 5 || p.pick === 'X') return false;
      const ts = typeof p._scanTs === 'number' ? p._scanTs : new Date(p._scanTs||0).getTime();
      if (ts && nowMs - ts > STALE) return false;
      const fid = p.fixtureId || p.match;
      if (seenFix.has(fid)) return false;
      seenFix.add(fid);
      return true;
    })
    .forEach(p => allPicks.push({ ...p, _source: 'local' }));

  // Sorteer op conf × value
  allPicks.sort((a,b) => ((b.confidence||0)*(b.value||0)) - ((a.confidence||0)*(a.value||0)));

  if (!allPicks.length) {
    el.innerHTML = `<div style="text-align:center;padding:2.5rem 1rem;">
      <div style="font-size:2rem;margin-bottom:.5rem;">⚡</div>
      <div style="${mono};font-size:.55rem;color:rgba(255,255,255,.95);">Geen open picks beschikbaar</div>
      <div style="${mono};font-size:.46rem;color:rgba(255,255,255,.35);margin-top:.4rem;">Doe een scan via Matches → Multi-scan</div>
    </div>`;
    return;
  }

  function badge(txt, color) {
    return `<span style="font-size:.44rem;color:${color};background:${color}18;border:1px solid ${color}33;border-radius:4px;padding:.05rem .3rem;">${txt}</span>`;
  }

  function pickCard(p) {
    const vc = p.value >= 20 ? '#00BEC4' : p.value >= 12 ? '#f59e0b' : '#d97706';
    const cc = p.confidence >= 8 ? '#00BEC4' : p.confidence >= 6 ? '#f59e0b' : 'rgba(255,255,255,.5)';
    const sharpT  = p.sharpTier || p.sharp_tier || '';
    const sharpSc = p.sharpScore || p.sharp_score || 0;
    const isSteam = p.sharpMove && parseFloat(p.sharpMove) <= -SHARP_PCT; // v26.118: 6%
    const badges = [
      p.elite && badge('⭐ Elite', '#00BEC4'),
      p.lockLevel === 'triple' && badge('🔒🔒🔒 Triple', '#7c3aed'),
      p.lockLevel === 'double' && badge('🔒🔒 Double', '#7c3aed'),
      sharpT === 'elite'    && badge('⚡ ' + Math.round(sharpSc) + '/100', '#f59e0b'),
      sharpT === 'strong'   && badge('📡 ' + Math.round(sharpSc) + '/100', '#00BEC4'),
      isSteam && badge('🔴 ' + parseFloat(p.sharpMove).toFixed(1) + '%', '#dc2626'),
    ].filter(Boolean).join(' ');

    return `<div class="worker-pick-row" onclick="openValuePickPopup(${allPicks.indexOf(p)})" style="cursor:pointer;margin-bottom:.4rem;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;">
        <div style="flex:1;min-width:0;">
          <div style="${sans};font-size:.7rem;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.match||'?'}</div>
          <div style="${mono};font-size:.44rem;color:rgba(255,255,255,.55);margin-top:.1rem;">${p.pickLabel||p.pick||'?'} · <b style="color:#fff;">@ ${p.odds||'?'}</b> · ${p.comp||''}</div>
          ${badges ? `<div style="display:flex;flex-wrap:wrap;gap:.2rem;margin-top:.25rem;">${badges}</div>` : ''}
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="${bebas};font-size:1.3rem;color:${vc};line-height:1;">+${Math.round(p.value||0)}%</div>
          <div style="${mono};font-size:.46rem;color:${cc};">conf ${p.confidence||0}/10</div>
        </div>
      </div>
    </div>`;
  }

  const elite   = allPicks.filter(p => p.elite);
  const locks   = allPicks.filter(p => !p.elite && (p.lockLevel==='triple'||p.lockLevel==='double'));
  const sharp   = allPicks.filter(p => !p.elite && !locks.includes(p) && (p.sharpTier==='elite'||p.sharpTier==='strong'||(p.sharpMove&&parseFloat(p.sharpMove)<=-SHARP_PCT)));
  // v26.103: regular = catch-all. Elke niet-elite/lock/sharp pick valt hier, ongeacht
  // lockLevel. Voorheen eiste dit lockLevel==='single', waardoor picks met een ontbrekende
  // of andere lockLevel uit álle secties vielen (wel geteld in de header, niet getoond).
  const regular = allPicks.filter(p => !p.elite && !locks.includes(p) && !sharp.includes(p));

  function section(title, icon, items, color) {
    if (!items.length) return '';
    return `<div style="margin-bottom:.75rem;">
      <div style="${mono};font-size:.48rem;font-weight:800;color:${color};letter-spacing:.06em;margin-bottom:.4rem;">
        ${icon} ${title} <span style="font-weight:400;opacity:.6;">(${items.length})</span>
      </div>
      ${items.map(pickCard).join('')}
    </div>`;
  }

  state._valuePicksList = allPicks; // v26.107: voor openValuePickPopup
  el.innerHTML =
    `<div style="${mono};font-size:.5rem;font-weight:800;color:rgba(255,255,255,.95);letter-spacing:.08em;margin-bottom:.75rem;">
      ⚡ VALUE PICKS OVERZICHT · ${allPicks.length} picks
    </div>`
    + section('ELITE PICKS',          '⭐', elite,   '#00BEC4')
    + section('TRIPLE & DOUBLE LOCK', '🔒', locks,   '#7c3aed')
    + section('SHARP MONEY',          '⚡', sharp,   '#f59e0b')
    + section('VALUE PICKS',          '📊', regular, 'rgba(255,255,255,.5)');
}




// v26.107: open de value-pick detail-popup vanuit de Value Picks-lijst
function openValuePickPopup(i) {
  const p = (state._valuePicksList || [])[i];
  if (!p) return;
  const s = { ...p, id: p.fixtureId || p.fixture_id || p.id || p.match?.id || '' };
  // match is in deze lijst een string ("Home vs Away") → splitsen voor de modal-titel
  if (typeof s.match === 'string' && !s.home) {
    const parts = s.match.split(' vs ');
    s.home = parts[0] || '?';
    s.away = parts.slice(1).join(' vs ') || '?';
  }
  if (typeof openCardPopup === 'function') openCardPopup('scan', s);
}

// ── LIVE TAB — live wedstrijden tonen + cleanup ──
async function renderLiveTab() {
  const list  = document.getElementById('liveMatchList');
  const empty = document.getElementById('liveEmpty');
  if (!list) return;

  // Cleanup: verwijder afgeronde wedstrijden die meer dan 24u oud zijn
  cleanupOldLiveMatches();

  const liveMatches = (state.matches||[]).filter(m => m.isLive);

  if (!liveMatches.length) {
    // Probeer live wedstrijden te laden
    list.innerHTML = '<div style="display:flex;justify-content:center;padding:1.5rem;">'
      + '<div style="width:22px;height:22px;border:2.5px solid rgba(0,190,196,.2);border-top-color:#00BEC4;border-radius:50%;animation:spin .7s linear infinite;"></div></div>';
    try {
      await loadTodayAllComps();
      const live = (state.matches||[]).filter(m => m.isLive);
      list.innerHTML = '';
      if (!live.length) {
        if (empty) empty.style.display = 'block';
        return;
      }
      live.forEach(m => { const card = renderMatchCard(m); if(card) list.appendChild(card); });
    } catch(e) {
      if (empty) empty.style.display = 'block';
      list.innerHTML = '';
    }
    return;
  }

  list.innerHTML = '';
  if (empty) empty.style.display = 'none';
  liveMatches.forEach(m => {
    const card = renderMatchCard(m);
    if (card) list.appendChild(card);
  });
}

// ── CLEANUP: verwijder afgeronde wedstrijden ouder dan 24u ──
function cleanupOldLiveMatches() {
  if (!state.matches?.length) return;
  const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 uur geleden
  const before = state.matches.length;
  state.matches = state.matches.filter(m => {
    if (!m.isDone) return true; // Bewaar niet-afgeronde wedstrijden altijd
    // Bewaar als datum/tijd onbekend (geen timestamp)
    if (!m.timestamp && !m.date) return true;
    // Bouw timestamp op uit m.date + m.time als m.timestamp ontbreekt
    const ts = m.timestamp || (() => {
      try {
        const d = new Date(m.date + 'T' + (m.time||'23:59') + ':00');
        return isNaN(d) ? 0 : d.getTime();
      } catch(e) { return 0; }
    })();
    return ts === 0 || ts >= cutoff;
  });
  const removed = before - state.matches.length;
  if (removed > 0) {
    saveState();
    showToast('🗑 ' + removed + ' afgeronde wedstrijd' + (removed>1?'en':' ') + ' verwijderd');
  }
}

function renderMatchCard(m) {
  if (!m) return null;
  const card = document.createElement('div');
  card.className = 'match-card' + (m.isLive ? ' value-glow' : '');
  card.style.background = 'rgba(255,255,255,0.05)';
  card.style.border = '1px solid rgba(255,255,255,0.08)';
  card.style.backdropFilter = 'blur(8px)';
  card.id = 'match-' + m.id;
  card.style.cursor = 'pointer';
  card.onclick = e => {
    // Alleen pop-up als niet op een knop geklikt
    if (!e.target.closest('button')) openCardPopup('match', m);
  };

  const scanResult = (state.lastScanResults||[]).find(s => String(s.matchId) === String(m.id));
  const sharpBadge = renderOddsMovementBadge(m.id);
  const valueBadge = scanResult && scanResult.value >= 5 && scanResult.pick !== 'X' ? `
    <div style="position:absolute;top:8px;right:8px;font-family:\'IBM Plex Mono\',monospace;font-size:.55rem;font-weight:900;
      color:${scanResult.value >= 15 ? '#00BEC4' : '#f59e0b'};
      background:${scanResult.value >= 15 ? 'rgba(0,190,196,.12)' : 'rgba(245,158,11,.1)'};
      border:1px solid ${scanResult.value >= 15 ? 'rgba(0,190,196,.3)' : 'rgba(245,158,11,.3)'};
      padding:2px 8px;border-radius:999px;">⚡ +${Math.round(scanResult.value)}%</div>` : '';

  const statusTxt = m.isLive ? (m.liveMin ? m.liveMin + "'" : 'LIVE') : m.isDone ? 'FT' : m.time;
  const inCombi   = (state.combiBuilder||[]).some(l => String(l.matchId) === String(m.id));
  const hasOdds   = m.homeOdds !== '—' && parseFloat(m.homeOdds) > 1;

  const probBar = hasOdds ? `
    <div style="display:flex;gap:3px;margin:0 .9rem .5rem;height:5px;border-radius:999px;overflow:hidden;">
      <div style="flex:${m.homePct};background:#00BEC4;border-radius:999px 0 0 999px;"></div>
      <div style="flex:${m.drawPct};background:#d97706;"></div>
      <div style="flex:${m.awayPct};background:#dc2626;border-radius:0 999px 999px 0;"></div>
    </div>
    <div style="display:flex;justify-content:space-between;padding:0 .9rem .6rem;
      font-family:\'IBM Plex Mono\',monospace;font-size:.52rem;font-weight:700;">
      <span style="color:#00BEC4;">${m.homePct}% 1</span>
      <span style="color:#d97706;">${m.drawPct}% X</span>
      <span style="color:#dc2626;">${m.awayPct}% 2</span>
    </div>` : '';

  const oddsCards = (m.isLive || m.isDone) ? '' : hasOdds ? `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.45rem;padding:.1rem .9rem .5rem;">
      <button onclick="event.stopPropagation();openBetModal(event,'${m.id}','1','Thuis wint',${m.homeOdds})"
        style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;
        padding:.55rem .3rem;cursor:pointer;text-align:center;">
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.48rem;font-weight:700;
          color:rgba(255,255,255,.95);letter-spacing:.08em;margin-bottom:.3rem;">1 THUIS</div>
        <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.5rem;color:#00BEC4;line-height:1;">${m.homeOdds}${renderOddsArrow((state.openingOdds||{})[m.id]?.home, parseFloat(m.homeOdds))}</div>
      </button>
      <button onclick="event.stopPropagation();openBetModal(event,'${m.id}','X','Gelijkspel',${m.drawOdds})"
        style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;
        padding:.55rem .3rem;cursor:pointer;text-align:center;">
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.48rem;font-weight:700;
          color:rgba(255,255,255,.95);letter-spacing:.08em;margin-bottom:.3rem;">X GELIJK</div>
        <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.5rem;color:#d97706;line-height:1;">${m.drawOdds}${renderOddsArrow((state.openingOdds||{})[m.id]?.draw, parseFloat(m.drawOdds))}</div>
      </button>
      <button onclick="event.stopPropagation();openBetModal(event,'${m.id}','2','Uit wint',${m.awayOdds})"
        style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;
        padding:.55rem .3rem;cursor:pointer;text-align:center;">
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.48rem;font-weight:700;
          color:rgba(255,255,255,.95);letter-spacing:.08em;margin-bottom:.3rem;">2 UIT</div>
        <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.5rem;color:#dc2626;line-height:1;">${m.awayOdds}${renderOddsArrow((state.openingOdds||{})[m.id]?.away, parseFloat(m.awayOdds))}</div>
      </button>
    </div>
    <div style="padding:0 .9rem .1rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.3rem;">
      <button onclick="event.stopPropagation();openJacks('${m.id}')"
        style="background:none;border:none;font-family:\'IBM Plex Mono\',monospace;font-size:.48rem;
        color:rgba(255,255,255,.95);cursor:pointer;text-decoration:underline;">
        🎰 Andere quotes gebruiken
      </button>
      ${sharpBadge}
    </div>` : `
    <!-- v18.4: geen odds — vriendelijke melding ipv leeg -->
    <div style="padding:.4rem .9rem .5rem;">
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:rgba(255,255,255,.95);
        text-align:center;padding:.45rem .7rem;
        background:rgba(255,255,255,.03);border-radius:8px;border:1px dashed rgba(255,255,255,.1);">
        📊 Geen odds beschikbaar · quotes laden na refresh
      </div>
    </div>`;

  card.innerHTML = `
    <div style="position:relative;">
      ${valueBadge}
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;
        padding:.55rem .9rem .4rem;border-bottom:1px solid rgba(255,255,255,0.09);">
        <div style="display:flex;align-items:center;gap:.4rem;">
          ${m.compLogo ? `<img src="${m.compLogo}" style="width:14px;height:14px;object-fit:contain;" onerror="this.style.display='none'">` : ''}
          <span style="font-family:\'IBM Plex Mono\',monospace;font-size:.52rem;color:rgba(255,255,255,.95);font-weight:700;">
            ${m.comp || ''}
          </span>
        </div>
        <div style="display:flex;align-items:center;gap:.5rem;">
          <span style="font-family:\'IBM Plex Mono\',monospace;font-size:.52rem;color:#00BEC4;font-weight:700;">
            ${m.date ? m.date + ' ' : ''}${m.time}
          </span>
          <span style="font-family:\'IBM Plex Mono\',monospace;font-size:.48rem;font-weight:800;
            padding:2px 8px;border-radius:999px;
            ${m.isLive ? 'background:rgba(220,38,38,.12);color:#dc2626;' :
              m.isDone ? 'background:rgba(100,116,139,.1);color:rgba(255,255,255,.95);' :
              'background:rgba(0,190,196,.1);color:#00a8ad;'}">
            ${statusTxt}
          </span>
        </div>
      </div>

      <!-- Teams -->
      <div style="display:flex;align-items:center;padding:.75rem .9rem .6rem;gap:.5rem;">
        <div style="flex:1;display:flex;flex-direction:column;align-items:flex-start;gap:.3rem;">
          ${m.homeLogo
            ? `<img src="${m.homeLogo}" style="width:40px;height:40px;object-fit:contain;" onerror="this.style.display='none'">`
            : `<div style="width:40px;height:40px;border-radius:50%;background:rgba(0,190,196,.08);border:1px solid rgba(0,190,196,.15);display:flex;align-items:center;justify-content:center;font-size:1.1rem;">⚽</div>`}
          <div style="font-family:\'DM Sans\',sans-serif;font-size:.95rem;font-weight:800;color:#ffffff;line-height:1.2;">${m.home}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:.2rem;min-width:44px;">
          ${m.score
            ? `<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.6rem;color:#ffffff;letter-spacing:.05em;">${m.score}</div>`
            : `<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.75rem;font-weight:700;color:rgba(255,255,255,.95);">VS</div>`}
        </div>
        <div style="flex:1;display:flex;flex-direction:column;align-items:flex-end;gap:.3rem;">
          ${m.awayLogo
            ? `<img src="${m.awayLogo}" style="width:40px;height:40px;object-fit:contain;" onerror="this.style.display='none'">`
            : `<div style="width:40px;height:40px;border-radius:50%;background:rgba(0,190,196,.08);border:1px solid rgba(0,190,196,.15);display:flex;align-items:center;justify-content:center;font-size:1.1rem;">⚽</div>`}
          <div style="font-family:\'DM Sans\',sans-serif;font-size:.95rem;font-weight:800;color:#ffffff;line-height:1.2;text-align:right;">${m.away}</div>
        </div>
      </div>

      <!-- Kansbalken -->
      ${probBar}

      <!-- Odds / geen-odds -->
      ${oddsCards}

      <!-- Actieknoppen -->
      <div style="display:flex;gap:.4rem;padding:.0rem .9rem .7rem;">
        <button onclick="event.stopPropagation();openMatchAnalyseModalById('${m.id}')"
          style="flex:1;padding:.4rem;border-radius:9px;background:rgba(0,190,196,.08);
          border:1px solid rgba(0,190,196,.25);font-family:monospace;font-size:.55rem;
          font-weight:700;color:#00BEC4;cursor:pointer;">
          🤖 ANALYSE
        </button>
        ${(hasOdds && !m.isLive && !m.isDone) ? `
        <button onclick="event.stopPropagation();toggleCombiAdd('${m.id}')"
          id="combi-btn-${m.id}"
          style="flex:1;padding:.4rem;border-radius:9px;
          background:${inCombi ? 'rgba(0,190,196,.15)' : 'rgba(0,190,196,.05)'};
          border:1px solid ${inCombi ? 'rgba(0,190,196,.4)' : 'rgba(0,190,196,.2)'};
          font-family:monospace;font-size:.55rem;font-weight:700;
          color:${inCombi ? '#00e5c8' : '#00BEC4'};cursor:pointer;">
          ${inCombi ? '✓ IN COMBI' : '+ COMBI'}
        </button>` : ''}
      </div>
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
  document.querySelectorAll('.match-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById('match-' + m.id);
  if (card) card.classList.add('selected');
}

function selectMatchAndAnalyse(matchId) {
  const m = (state.matches||[]).find(x => String(x.id) === String(matchId));
  if (m) selectMatch(m);
  setTimeout(() => {
    switchScreen('analyse');
    setTimeout(() => {
      showAnalyseSubTab('analyse');
      // Auto-start analyse als wedstrijd geselecteerd
      if (typeof runAnalyse === 'function') {
        setTimeout(() => runAnalyse(), 150);
      }
    }, 80);
  }, 80);
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
  document.querySelectorAll('.comp-chip').forEach(c => c.classList.remove('active'));
  document.getElementById('comp-' + comp)?.classList.add('active');
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
    if (btn) { btn.textContent = '✓ KLAAR'; btn.style.background = 'rgba(0,190,196,.2)'; btn.style.color = '#00BEC4'; }
    if (hint) hint.style.display = 'block';
  } else {
    if (btn) { btn.textContent = '📌 MULTI-SCAN SELECTEREN'; btn.style.background = 'rgba(0,190,196,.1)'; btn.style.color = '#00BEC4'; }
    if (hint) hint.style.display = 'none';
  }
}

// ── Match laden ──────────────────────────────────────────
async function loadMatches(comp) {
  const WORKER = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : 'https://api.promatchxi.app');
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
  // v18.4: lege state via renderMatches (met actieknoppen)
  renderMatches([]);
}

async function loadFromAPIFootball(comp, _apiKey) {
  const leagueId = COMP_IDS[comp];
  if (!leagueId) return false;
  const season = getCurrentSeason(comp);
  showLoadingMsg(`⟳ ${COMP_NAMES[comp] || comp} laden...`, 'var(--muted)');
  try {
    const today = new Date().toISOString().split('T')[0];
    let r = await apiFetch(`${WORKER}/apif/fixtures?league=${leagueId}&season=${season}&date=${today}&_cb=${Date.now()}`, null, 10000);
    let d = await r.json();
    if (d.response?.length > 0) {
      state.matches = d.response.map(f => parseAPIMatch(f)).filter(Boolean);
      renderMatches(state.matches);
      saveOpeningOdds(state.matches);
      fetchOddsForMatches(leagueId, null).then(() => renderMatches(state.matches));
      return true;
    }
    r = await apiFetch(`${WORKER}/apif/fixtures?league=${leagueId}&season=${season}&next=10&_cb=${Date.now()}`, null, 10000);
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
  // v26.97: via worker proxy met cache-bust (niet direct API-Sports — Cloudflare cache bypass)
  const WORKER = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : 'https://api.promatchxi.app');
  const season = seasonForLeague(leagueId);
  // v26.97: ALLE unieke datums van deze league pakken (niet alleen de eerste match).
  // Anders kreeg b.v. het WK met matches op meerdere dagen alleen odds voor 1 datum.
  const leagueMatches = (state.matches || []).filter(m => String(m.leagueId) === String(leagueId));
  let dates = [...new Set(leagueMatches.map(m => m.dateISO).filter(Boolean))];
  if (!dates.length) dates = [new Date().toISOString().split('T')[0]];
  const cb = Date.now();

  let oddsData = [];
  for (const matchDate of dates) {
    const cacheKey = `odds_league_${leagueId}_${matchDate}`;
    let dayOdds = typeof _cacheGet === 'function' ? _cacheGet(cacheKey) : null;
    if (!dayOdds?.length) {
      try {
        const r = await apiFetch(`${WORKER}/apif/odds?league=${leagueId}&season=${season}&date=${matchDate}&bet=1&_cb=${cb}`, null, 10000);
        const d = await r.json();
        if (d.response?.length) {
          dayOdds = d.response;
          if (typeof _cacheSet === 'function') _cacheSet(cacheKey, dayOdds, 300); // 5 min cache
        }
      } catch(e) {}
    }
    if (dayOdds?.length) oddsData.push(...dayOdds);
  }

  if (!oddsData.length) return;

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
    // Sla opening odds op als ze nog niet bestaan (voor movement detectie)
    if (h && draw && a) {
      if (!state.openingOdds) state.openingOdds = {};
      if (!state.openingOdds[fid]) {
        state.openingOdds[fid] = {
          home: parseFloat(h.odd),
          draw: parseFloat(draw.odd),
          away: parseFloat(a.odd),
          ts: Date.now()
        };
      }
      // Huidige odds ook opslaan in bookmakerOdds voor movement vergelijking
      if (!state.bookmakerOdds) state.bookmakerOdds = {};
      state.bookmakerOdds[fid] = {
        home: parseFloat(h.odd),
        draw: parseFloat(draw.odd),
        away: parseFloat(a.odd),
      };
    }
    if (h && draw && a) {
      const inv = 1/parseFloat(h.odd) + 1/parseFloat(draw.odd) + 1/parseFloat(a.odd);
      match.homePct = Math.round((1/parseFloat(h.odd))/inv*100);
      match.drawPct = Math.round((1/parseFloat(draw.odd))/inv*100);
      match.awayPct = 100 - match.homePct - match.drawPct;
    }
  }
}

async function fetchOddsForAllMatches(matches, _apiKey) {
  const matchesWithoutOdds = matches.filter(m => m.source === 'apif' && m.homeOdds === '—');
  if (!matchesWithoutOdds.length) return;

  const byLeague = {};
  matchesWithoutOdds.forEach(m => {
    const lid = m.leagueId;
    if (!lid) return;
    if (!byLeague[lid]) byLeague[lid] = [];
    byLeague[lid].push(m);
  });

  let _leagueIdx = 0;
  for (const [leagueId] of Object.entries(byLeague)) {
    // v26.99: throttle — kleine pauze tussen league-calls zodat de per-minuut
    // rate-limit niet verzadigt bij het in één keer laden van veel competities.
    if (_leagueIdx++ > 0) await new Promise(r => setTimeout(r, 220));
    const season = seasonForLeague(leagueId);
    // v26.97: per league ALLE unieke datums ophalen i.p.v. alleen de eerste match.
    // Hierdoor kregen WK-matches op 14 juni geen odds als er ook een match op 13 juni stond.
    const dates = [...new Set((byLeague[leagueId] || []).map(m => m.dateISO).filter(Boolean))];
    if (!dates.length) dates.push(new Date().toISOString().split('T')[0]);

    let oddsData = [];
    for (const matchDate of dates) {
      const cacheKey = `odds_league_${leagueId}_${matchDate}`;
      let dayOdds = typeof _cacheGet === 'function' ? _cacheGet(cacheKey) : null;
      if (!dayOdds?.length) {
        const bookmakers = [8, 6, 1, 16, 36]; // 16=Unibet, 36=BetVictor (o.a. Scandinavisch)
        for (const bm of bookmakers) {
          try {
            const r = await apiFetch(
              `https://v3.football.api-sports.io/odds?league=${leagueId}&season=${season}&date=${matchDate}&bookmaker=${bm}`,
              null, 5000
            );
            const d = await r.json();
            if (d.response?.length) {
              dayOdds = d.response;
              if (typeof _cacheSet === 'function') _cacheSet(cacheKey, dayOdds);
              break;
            }
          } catch(e) {}
        }
      }
      if (dayOdds?.length) oddsData.push(...dayOdds);
    }

    // Fallback: als geen enkele datum odds opleverde, next=20 zonder datum
    if (!oddsData.length) {
      for (const bm of [8, 6, 1, 16, 36]) {
        try {
          const r2 = await apiFetch(
            `https://v3.football.api-sports.io/odds?league=${leagueId}&season=${season}&bookmaker=${bm}&next=20`,
            null, 5000
          );
          const d2 = await r2.json();
          if (d2.response?.length) { oddsData = d2.response; break; }
        } catch(e) {}
      }
    }

    if (!oddsData.length) continue;

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
  const btn = document.getElementById('combi-btn-' + matchId);
  const inCombi = state.combiBuilder.some(l => String(l.matchId) === String(matchId));
  if (btn) {
    btn.textContent = inCombi ? '✓ IN COMBI' : '+ COMBI';
    btn.style.background = inCombi ? 'rgba(0,190,196,.12)' : 'rgba(0,190,196,.08)';
    btn.style.color = inCombi ? '#00BEC4' : '#00a8ad';
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
    btn.style.background = inCombi ? 'rgba(0,190,196,.12)' : 'rgba(0,190,196,.1)';
    btn.style.color = inCombi ? '#00BEC4' : '#00BEC4';
  }
  showToast(`⚡ ${pickLabel} ${inCombi ? 'toegevoegd aan' : 'verwijderd uit'} combi`);
}

function updateCombiBuilder() {
  const builder = document.getElementById('combiBuilder');
  const legsEl = document.getElementById('combiBuilderLegs');
  const oddsEl = document.getElementById('combiTotalOdds');
  if (!builder || !legsEl) return;

  const legs = state.combiBuilder || [];
  if (!legs.length) { builder.style.display = 'none'; return; }

  builder.style.display = 'block';
  const totalOdds = legs.reduce((a, l) => a * l.odds, 1);
  const defaultBet = state.settings.defaultBet || 10;
  const payout = (defaultBet * totalOdds).toFixed(2);
  if (oddsEl) oddsEl.textContent = totalOdds.toFixed(2);

  // v18.8: mooiere leg kaartjes in wedstrijdcard-stijl
  legsEl.innerHTML = legs.map((l, i) => `
    <div style="background:rgba(255,255,255,.85);border:1px solid rgba(28,35,48,.08);
      border-radius:12px;padding:.65rem .8rem;margin-bottom:.4rem;
      display:flex;align-items:center;justify-content:space-between;gap:.5rem;">
      <div style="flex:1;min-width:0;">
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:rgba(255,255,255,.95);margin-bottom:.15rem;">
          LEG ${i+1} · ${l.date||''}
        </div>
        <div style="font-size:.82rem;font-weight:700;color:#ffffff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${l.home} vs ${l.away}
        </div>
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:#00BEC4;font-weight:700;margin-top:.15rem;">
          ${l.pickLabel || l.pick}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.2rem;flex-shrink:0;">
        <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.1rem;color:#00BEC4;">${parseFloat(l.odds).toFixed(2)}</div>
        <button onclick="removeCombiLeg('${l.matchId}')"
          style="background:none;border:none;color:rgba(255,255,255,.95);cursor:pointer;font-size:.75rem;line-height:1;">✕</button>
      </div>
    </div>
  `).join('');

  // Totaal kaart onderaan
  const totaalEl = document.getElementById('combiBetSlipTotal');
  if (totaalEl) {
    totaalEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem .8rem;
        background:rgba(0,190,196,.06);border-radius:10px;margin-bottom:.5rem;">
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:rgba(255,255,255,.95);">
          ${legs.length} legs · €${defaultBet} inzet
        </div>
        <div style="display:flex;gap:.75rem;align-items:center;">
          <div style="text-align:center;">
            <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:rgba(255,255,255,.95);">QUOTE</div>
            <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1rem;">${totalOdds.toFixed(2)}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:rgba(255,255,255,.95);">WINST</div>
            <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1rem;color:#00BEC4;">€${payout}</div>
          </div>
        </div>
      </div>`;
  }
}

function removeCombiLeg(matchId) {
  state.combiBuilder = (state.combiBuilder||[]).filter(l => String(l.matchId) !== String(matchId));
  updateCombiBuilder();
  const btn = document.getElementById('combi-btn-' + matchId);
  if (btn) { btn.textContent = '+ COMBI'; btn.style.background = 'rgba(0,190,196,.08)'; btn.style.color = '#00a8ad'; }
}

function clearCombi() {
  state.combiBuilder = [];
  updateCombiBuilder();
  document.querySelectorAll('[id^="combi-btn-"]').forEach(btn => {
    btn.textContent = '+ COMBI';
    btn.style.background = 'rgba(0,190,196,.08)';
    btn.style.color = '#00a8ad';
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
    const el = document.getElementById(id); if (el) el.value = '';
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
      apiFetch(`${WORKER}/apif/fixtures?date=${today}&_cb=${Date.now()}`, null, 12000),
      apiFetch(`${WORKER}/apif/fixtures?date=${tomorrow}&_cb=${Date.now()}`, null, 12000)
    ]);
    const dToday = await rToday.json();
    const dTomorrow = await rTomorrow.json();
    const allFixtures = [...(dToday.response||[]), ...(dTomorrow.response||[])];
    const fixtures = allFixtures.filter(f => {
      const status = f.fixture.status.short;
      // Alleen wedstrijden die nog niet gespeeld zijn
      const isFinished = ['FT','AET','PEN','CANC','ABD','AWD','WO'].includes(status);
      // Lopende wedstrijden (LIVE) wel tonen
      const isLive = ['1H','2H','HT','ET','BT','P','INT','LIVE'].includes(status);
      if (isLive) {
        const _k = f.fixture.date ? new Date(f.fixture.date).getTime() : 0;
        if (typeof isStaleLive === 'function' && isStaleLive(status, _k)) return false; // bevroren live-status
        return true;
      }
      if (isFinished) return false;
      // NS/TBD/PST: alleen tonen als kickoff binnen 48 uur valt (of binnen 30 min gestart)
      const kickoff = f.fixture.date ? new Date(f.fixture.date).getTime() : 0;
      const now = Date.now();
      return kickoff > now - 30 * 60 * 1000 && kickoff < now + 48 * 60 * 60 * 1000;
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
      // v18.4: lege state via renderMatches
      renderMatches([]);
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
    const scanAll = document.getElementById('scanAllTodayBtn');
    const scanTomorrow = document.getElementById('scanTomorrowBtn');
    if (scanAll) scanAll.style.display = 'block';
    if (scanTomorrow) scanTomorrow.style.display = 'block';
    if (scanAll) { scanAll.querySelector('button').disabled = true; scanAll.querySelector('button').textContent = '⟳ Quotes ophalen...'; }
    await fetchOddsForAllMatches(state.matches, null);
    const withOdds = state.matches.filter(m => m.homeOdds !== '—').length;
    if (scanAll) { scanAll.querySelector('button').disabled = false; scanAll.querySelector('button').textContent = withOdds > 0 ? `⚡ SCAN ALLES VANDAAG (${withOdds})` : '⚡ SCAN ALLES VANDAAG'; }
    if (btn) { btn.textContent = '🔄 Verversen'; btn.style.opacity = '1'; btn.disabled = false; }
  } catch(e) {
    if (list) list.innerHTML = `
      <div style="text-align:center;padding:2rem 1.25rem;display:flex;flex-direction:column;align-items:center;gap:.6rem;">
        <div style="font-size:1.8rem;opacity:.4;">⚠️</div>
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.58rem;color:#dc2626;font-weight:700;">Laad fout</div>
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.52rem;color:rgba(255,255,255,.95);">${e.message}</div>
        <button onclick="loadTodayAllComps()" style="padding:.45rem .9rem;border-radius:10px;background:rgba(15,23,42,.05);border:1px solid rgba(255,255,255,0.09);font-family:\'IBM Plex Mono\',monospace;font-size:.56rem;color:rgba(255,255,255,.95);cursor:pointer;">↺ Opnieuw proberen</button>
      </div>`;
    if (btn) { btn.style.opacity = '1'; btn.disabled = false; }
  }
  if (loading) loading.style.display = 'none';
}

// ── Multi-scan ────────────────────────────────────────────
async function runMultiScan() {
  // v26.126: worker is de enige value-engine — multi-league client-scan vervangen door
  // één refresh uit de worker-picks (die alle actieve leagues al dekt).
  if (typeof refreshValueScansFromWorker === 'function') {
    await refreshValueScansFromWorker(false);
    if (typeof renderMultiScanResults === 'function') renderMultiScanResults((state.valueScans || []), (state.favoriteComps || []).length);
    return;
  }
  return _runMultiScan_legacy();
}
async function _runMultiScan_legacy() {
  const favs = state.favoriteComps || [];
  if (favs.length < 2) { alert('Selecteer minimaal 2 competities via 📌 MULTI-SCAN SELECTEREN.'); return; }
  const btn = document.getElementById('multiScanBtn');
  if (btn) btn.disabled = true;
  const allValuePicks = [];
  try {
  for (let i = 0; i < favs.length; i++) {
    const comp = favs[i];
    try {
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
    if (!withOdds.length) continue;
    if (btn) btn.textContent = `⟳ ${i+1}/${favs.length} scannen...`;
    await scanValueAll();
    if (state.valueScans?.length) {
      allValuePicks.push(...state.valueScans
        .filter(s => s.value >= 5)
        .map(s => ({ ...s, compName: COMP_NAMES[comp] || comp })));
    }
    } catch(e) { console.warn('[MultiScan] competitie overslaan:', comp, e); continue; }
  }
  allValuePicks.sort((a, b) => (b.value||0) - (a.value||0));
  renderMultiScanResults(allValuePicks, favs.length);
  if (allValuePicks.length) {
    state.valueScans = allValuePicks;
    state.lastScanResults = allValuePicks.map(s => ({
      matchId: s.match?.id, home: s.match?.home, away: s.match?.away,
      comp: s.match?.comp || s.compName, pick: s.pick, pickLabel: s.pickLabel,
      value: s.value, confidence: s.confidence, odds: s.odds,
      reason: s.reason||'', kelly: s.kelly||0, poissonUsed: s.poissonUsed||false
    }));
    saveState();
    showToast(`⚡ ${allValuePicks.length} value picks gevonden — check Analyse tab`);
  }
  } catch(e) {
    console.error('[MultiScan] onderbroken:', e);
    showToast('⚠ Multiscan onderbroken — ' + (e && e.message ? e.message : 'onbekende fout'));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⚡ SCAN ALLES'; }
  }
}

function renderMultiScanResults(picks, numComps) {
  const banner = document.getElementById('valueBanner');
  if (!banner) return;
  if (!picks.length) {
    banner.style.display = 'block';
    banner.innerHTML = `<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1rem;color:#00BEC4;">⚡ MULTI-SCAN (${numComps} comp.)</div>
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.58rem;color:rgba(255,255,255,.95);padding:.8rem 0;">
        Geen value ≥5% gevonden. Bookmakers zitten goed in de markt vandaag.
      </div>
      <button onclick="this.parentElement.style.display='none'" style="background:none;border:none;color:rgba(255,255,255,.95);cursor:pointer;font-size:.9rem;">✕</button>`;
    return;
  }
  const highCount = picks.filter(p => p.value >= 15).length;
  const medCount = picks.filter(p => p.value >= 5 && p.value < 15).length;
  banner.style.display = 'block';
  banner.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem;">
      <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1rem;color:#00BEC4;">⚡ MULTI-SCAN — ${numComps} competities</div>
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:rgba(255,255,255,.95);">
        <span style="color:#00BEC4;font-weight:700;">${highCount} sterk</span> · <span style="color:#b45309;font-weight:700;">${medCount} licht</span>
      </div>
    </div>
    ${picks.slice(0, 8).map(s => {
      const cls = s.value >= 15 ? '#00BEC4' : s.value >= 5 ? '#b45309' : '#64748b';
      const sign = s.value > 0 ? '+' : '';
      const inCombi = (state.combiBuilder||[]).some(l => String(l.matchId) === String(s.match?.id));
      return `<div style="display:flex;align-items:center;padding:.4rem 0;border-bottom:1px solid rgba(255,255,255,0.09);">
        <div style="flex:1;cursor:pointer;" onclick="selectMatchAndAnalyse('${s.match?.id}')">
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.6rem;font-weight:700;color:#ffffff;">${s.match?.home||'?'} vs ${s.match?.away||'?'}</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:#00a8ad;">${s.compName}</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:rgba(255,255,255,.7);">${s.pickLabel} · Kans ${s.kans}%</div>
          ${s.reason?`<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:rgba(255,255,255,.45);margin-top:1px;">${s.reason}</div>`:''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.2rem;margin-left:.5rem;">
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:rgba(255,255,255,.88);letter-spacing:.04em;">EDGE</div>
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.1rem;color:${cls};line-height:.9;">${sign}${Math.round(s.value)}%</div>
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:.9rem;color:#00BEC4;">@${(s.odds||0).toFixed(2)}</div>
          ${s.ev!=null?`<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:rgba(255,255,255,.95);">EV ${s.ev>=0?'+':''}${Math.round(s.ev)}%</div>`:''}
          <button onclick="addValuePickToCombi('${s.match?.id}','${s.pick}','${(s.pickLabel||'').replace(/'/g,"\\'")}',${s.odds||0},'${(s.match?.home||'').replace(/'/g,"\\'")}','${(s.match?.away||'').replace(/'/g,"\\'")}')"
            style="font-family:monospace;font-size:.48rem;font-weight:800;padding:2px 7px;border-radius:999px;cursor:pointer;
            border:1px solid ${inCombi?'rgba(0,190,196,.4)':'rgba(0,190,196,.35)'};
            background:${inCombi?'rgba(0,190,196,.12)':'rgba(255,215,230,.4)'};
            color:${inCombi?'#00BEC4':'#d63384'};">${inCombi ? '✓ IN COMBI' : '+ COMBI'}</button>
        </div>
      </div>`;
    }).join('')}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:.5rem;">
      <span style="font-family:monospace;font-size:.5rem;color:rgba(255,255,255,.95);">Tik naam → analyse</span>
      <button onclick="this.parentElement.parentElement.style.display='none'" style="background:none;border:none;color:rgba(255,255,255,.95);cursor:pointer;">✕</button>
    </div>
  `;
}

// ── Scan resultaten panel ─────────────────────────────────
function renderScanResults(scans, restored = false) {
  const panel = document.getElementById('scanResultsPanel');
  if (!panel) return;
  if (!scans.length) { panel.style.display = 'none'; return; }
  const normalized = scans.map(s => {
    const matchId = s.matchId || s.match?.id;
    const liveMatch = matchId ? (state.matches||[]).find(m => String(m.id) === String(matchId)) : null;
    return {
      matchId,
      home: s.home || s.match?.home || liveMatch?.home || '?',
      away: s.away || s.match?.away || liveMatch?.away || '?',
      comp: s.comp || s.match?.comp || liveMatch?.comp || '',
      pickLabel: s.pickLabel || '?',
      pick: s.pick || '',
      value: s.value || 0,
      confidence: s.confidence || 0,
      odds: s.odds || null,
      scanTime: s.scanTime || ''
    };
  });
  const withValue = normalized.filter(s => s.value >= 5);
  const displayList = withValue.length > 0 ? withValue : normalized;
  panel.style.display = 'block';
  panel.innerHTML = `
    <div class="scan-results-header" onclick="this.parentElement.querySelector('#scanResultsList').style.display = this.parentElement.querySelector('#scanResultsList').style.display==='none'?'block':'none'">
      <div class="scan-results-title">⚡ SCAN RESULTATEN${restored ? ' (hersteld)' : ''} · ${displayList.length} picks</div>
      <button onclick="event.stopPropagation();document.getElementById('scanResultsPanel').style.display='none'" style="background:none;border:none;color:rgba(255,255,255,.95);cursor:pointer;">✕</button>
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
            background:rgba(0,190,196,.1);border:1px solid rgba(0,190,196,.3);color:#00BEC4;margin-left:.4rem;">
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
  const homeSlug = encodeURIComponent(m.home.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  const awaySlug = encodeURIComponent(m.away.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  const compSlugMap = {
    'Premier League':'premier-league','Eredivisie':'eredivisie','Bundesliga':'bundesliga',
    'Ligue 1':'ligue-1','Serie A':'serie-a','La Liga':'la-liga',
    'Champions League':'champions-league','Keuken Kampioen Divisie':'keuken-kampioen-divisie',
    'Jupiler Pro League':'jupiler-pro-league','Championship':'championship',
    '2. Bundesliga':'2-bundesliga','Süper Lig':'super-lig',
    'Friendlies':'internationaal','FIFA World Cup':'wk-2026',
  };
  const comp = m.comp || '';
  let compSlug = null;
  for (const [name, slug] of Object.entries(compSlugMap)) {
    if (comp.toLowerCase().includes(name.toLowerCase())) { compSlug = slug; break; }
  }
  const url = compSlug
    ? `https://www.jacks.nl/sport/voetbal/${compSlug}/${homeSlug}-${awaySlug}`
    : `https://www.jacks.nl/sport/zoeken?q=${encodeURIComponent(m.home + ' ' + m.away)}`;
  window.open(url, '_blank');
}


// ── Competitie Info Modal ─────────────────────────────
async function openCompDetail(compKey) {
  const key = compKey || state.activeComp;
  const leagueId = COMP_IDS[key];
  const compName = COMP_NAMES[key] || key;

  let modal = document.getElementById('comp-info-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'comp-info-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.7);z-index:9000;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px);';
    modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
  }

  // Bouw modal via DOM ipv innerHTML string (voorkomt quote problemen)
  const sheet = document.createElement('div');
  sheet.style.cssText = 'background:rgba(255,255,255,0.05);border-radius:20px 20px 0 0;width:100%;max-width:480px;max-height:88vh;overflow-y:auto;';

  // Handle bar
  const handle = document.createElement('div');
  handle.style.cssText = 'padding:.75rem 0 0;text-align:center;';
  handle.innerHTML = '<div style="width:36px;height:4px;background:rgba(15,23,42,.15);border-radius:999px;display:inline-block;"></div>';
  sheet.appendChild(handle);

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:.75rem 1.25rem .5rem;';
  const title = document.createElement('div');
  title.style.cssText = 'font-family:Bebas Neue,sans-serif;font-size:1.1rem;color:#ffffff;';
  title.textContent = compName;
  const closeBtn = document.createElement('button');
  closeBtn.style.cssText = 'background:rgba(15,23,42,.08);border:none;border-radius:999px;width:2rem;height:2rem;cursor:pointer;font-size:.8rem;color:rgba(255,255,255,.95);';
  closeBtn.textContent = '✕';
  closeBtn.onclick = () => modal.remove();
  header.appendChild(title);
  header.appendChild(closeBtn);
  sheet.appendChild(header);

  // Tabs
  const tabs = document.createElement('div');
  tabs.style.cssText = 'display:flex;border-bottom:1px solid rgba(255,255,255,0.09);padding:0 1.25rem;';
  [['stand','Stand'],['scorers','Topscorers'],['wedstrijden','Wedstrijden']].forEach(([t,label]) => {
    const btn = document.createElement('button');
    btn.id = 'ctab-' + t;
    btn.style.cssText = 'font-family:IBM Plex Mono,monospace;font-size:.55rem;font-weight:700;padding:.5rem .75rem;border:none;background:none;cursor:pointer;border-bottom:2px solid ' + (t==='stand'?'#00BEC4':'transparent') + ';color:' + (t==='stand'?'#00BEC4':'var(--sub)') + ';';
    btn.textContent = label;
    btn.onclick = () => showCompTab(t);
    tabs.appendChild(btn);
  });
  sheet.appendChild(tabs);

  // Content
  const content2 = document.createElement('div');
  content2.id = 'comp-tab-content';
  content2.style.cssText = 'padding:1rem 1.25rem 2rem;';
  content2.innerHTML = '<div style="text-align:center;padding:2rem;font-family:IBM Plex Mono,monospace;font-size:.55rem;color:rgba(255,255,255,.95);">⟳ Laden...</div>';
  sheet.appendChild(content2);

  // Swipe to close
  let startY = 0;
  sheet.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, {passive:true});
  sheet.addEventListener('touchend', e => {
    if (e.changedTouches[0].clientY - startY > 80) modal.remove();
  }, {passive:true});

  modal.innerHTML = '';
  modal.appendChild(sheet);

  loadCompStand(leagueId);
}

function showCompTab(tab) {
  const key = state.activeComp;
  const leagueId = COMP_IDS[key];
  ['stand','scorers','wedstrijden'].forEach(function(t) {
    const btn = document.getElementById('ctab-' + t);
    if (btn) { btn.style.color = t === tab ? '#00BEC4' : 'var(--sub)'; btn.style.borderBottom = t === tab ? '2px solid #00BEC4' : '2px solid transparent'; }
  });
  if (tab === 'stand') loadCompStand(leagueId);
  else if (tab === 'scorers') loadCompTopscorers(leagueId);
  else loadCompWedstrijden(leagueId);
}

async function loadCompStand(leagueId) {
  const el = document.getElementById('comp-tab-content');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:2rem;font-family:IBM Plex Mono,monospace;font-size:.55rem;color:rgba(255,255,255,.95);">⟳ Stand laden...</div>';
  try {
    const standings = await fetchStandings(leagueId, null);
    if (!standings?.length) { el.innerHTML = '<div style="text-align:center;padding:2rem;font-family:IBM Plex Mono,monospace;font-size:.55rem;color:rgba(255,255,255,.95);">Geen stand beschikbaar</div>'; return; }
    let html = '<div style="font-family:IBM Plex Mono,monospace;font-size:.48rem;">'
      + '<div style="display:grid;grid-template-columns:1.2rem 1fr repeat(5,2rem);gap:.3rem;padding:.3rem 0;color:rgba(255,255,255,.95);font-weight:700;border-bottom:1px solid rgba(255,255,255,0.09);margin-bottom:.3rem;">'
      + '<span>#</span><span>Team</span><span style="text-align:center">G</span><span style="text-align:center">W</span><span style="text-align:center">V</span><span style="text-align:center">GD</span><span style="text-align:center;color:#00BEC4">Pt</span></div>';
    standings.forEach(function(t) {
      const gd = t.goalsDiff || 0;
      html += '<div style="display:grid;grid-template-columns:1.2rem 1fr repeat(5,2rem);gap:.3rem;padding:.3rem 0;border-bottom:1px solid rgba(15,23,42,.05);align-items:center;">'
        + '<span style="color:rgba(255,255,255,.95);">' + t.rank + '</span>'
        + '<span style="font-weight:600;color:#ffffff;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' + (t.team?.name||'?') + '</span>'
        + '<span style="text-align:center;color:rgba(255,255,255,.95);">' + (t.all?.played||0) + '</span>'
        + '<span style="text-align:center;color:#00BEC4;">' + (t.all?.win||0) + '</span>'
        + '<span style="text-align:center;color:#dc2626;">' + (t.all?.lose||0) + '</span>'
        + '<span style="text-align:center;color:rgba(255,255,255,.95);">' + (gd>0?'+':'') + gd + '</span>'
        + '<span style="text-align:center;font-weight:800;color:#00BEC4;">' + (t.points||0) + '</span>'
        + '</div>';
    });
    el.innerHTML = html + '</div>';
  } catch(e) { el.innerHTML = '<div style="color:#dc2626;padding:1rem;font-size:.55rem;">⚠ ' + e.message + '</div>'; }
}

async function loadCompTopscorers(leagueId) {
  const el = document.getElementById('comp-tab-content');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:2rem;font-family:IBM Plex Mono,monospace;font-size:.55rem;color:rgba(255,255,255,.95);">⟳ Topscorers laden...</div>';
  try {
    const scorers = await fetchTopScorers(leagueId);
    if (!scorers?.length) { el.innerHTML = '<div style="text-align:center;padding:2rem;font-family:IBM Plex Mono,monospace;font-size:.55rem;color:rgba(255,255,255,.95);">Geen data beschikbaar</div>'; return; }
    let html = '<div>';
    scorers.slice(0,10).forEach(function(s, i) {
      const goals = s.statistics?.[0]?.goals?.total || 0;
      const assists = s.statistics?.[0]?.goals?.assists || 0;
      const team = s.statistics?.[0]?.team?.name || '';
      html += '<div style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;border-bottom:1px solid rgba(15,23,42,.06);">'
        + '<div style="font-family:Bebas Neue,sans-serif;font-size:1rem;color:rgba(255,255,255,.95);width:1.5rem;text-align:center;">' + (i+1) + '</div>'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="font-family:DM Sans,sans-serif;font-size:.72rem;font-weight:700;color:#ffffff;">' + (s.player?.name||'?') + '</div>'
        + '<div style="font-family:IBM Plex Mono,monospace;font-size:.46rem;color:rgba(255,255,255,.95);">' + team + '</div>'
        + '</div>'
        + '<div style="text-align:right;">'
        + '<div style="font-family:Bebas Neue,sans-serif;font-size:1.1rem;color:#00BEC4;">' + goals + '</div>'
        + '<div style="font-family:IBM Plex Mono,monospace;font-size:.42rem;color:rgba(255,255,255,.95);">' + assists + ' ast</div>'
        + '</div></div>';
    });
    el.innerHTML = html + '</div>';
  } catch(e) { el.innerHTML = '<div style="color:#dc2626;padding:1rem;font-size:.55rem;">⚠ ' + e.message + '</div>'; }
}

async function loadCompWedstrijden(leagueId) {
  const el = document.getElementById('comp-tab-content');
  if (!el) return;
  const matches = (state.matches||[]).filter(function(m) { return !leagueId || String(m.leagueId) === String(leagueId); });
  if (!matches.length) {
    el.innerHTML = '<div style="text-align:center;padding:2rem;font-family:IBM Plex Mono,monospace;font-size:.55rem;color:rgba(255,255,255,.95);">Laad eerst wedstrijden</div>';
    return;
  }
  el.innerHTML = '';
  matches.forEach(function(m) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid rgba(15,23,42,.06);cursor:pointer;';
    row.onclick = function() {
      const modal = document.getElementById('comp-info-modal');
      if (modal) modal.remove();
      const match = (state.matches||[]).find(function(x) { return x.id === m.id; });
      if (match) selectMatch(match);
      switchScreen('analyse');
    };
    const time = document.createElement('div');
    time.style.cssText = 'font-family:IBM Plex Mono,monospace;font-size:.5rem;color:rgba(255,255,255,.95);';
    time.textContent = m.time;
    const name = document.createElement('div');
    name.style.cssText = 'flex:1;text-align:center;font-family:DM Sans,sans-serif;font-size:.65rem;font-weight:700;';
    name.textContent = m.home + ' vs ' + m.away;
    const odds = document.createElement('div');
    odds.style.cssText = 'font-family:IBM Plex Mono,monospace;font-size:.5rem;color:#00BEC4;';
    odds.textContent = m.homeOdds !== '—' ? m.homeOdds : '—';
    row.appendChild(time);
    row.appendChild(name);
    row.appendChild(odds);
    el.appendChild(row);
  });
}


// ── Match Analyse Modal ───────────────────────────────────
function openMatchAnalyseModalById(matchId) {
  const m = (state.matches||[]).find(x => String(x.id) === String(matchId));
  if (!m) { console.warn('Match niet gevonden:', matchId); return; }
  openMatchAnalyseModal(m);
}

function openMatchAnalyseModal(m) {
  if (typeof m === 'string') { try { m = JSON.parse(m); } catch(e) { return; } }
  const existing = document.getElementById('match-analyse-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'match-analyse-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.75);display:flex;align-items:flex-end;justify-content:center;';
  modal.onclick = function(e) { if (e.target === modal) modal.remove(); };

  const hasOdds = m.homeOdds && m.homeOdds !== '—' && m.drawOdds && m.awayOdds;

  modal.innerHTML = '<div style="background:var(--bg,#0d1b2a);border-radius:20px 20px 0 0;width:100%;max-width:600px;max-height:88vh;overflow-y:auto;padding:1.25rem 1.1rem 2.5rem;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.9rem;">'
    + '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.25rem;color:var(--ink,#fff);line-height:1;">' + (m.home||'?') + ' vs ' + (m.away||'?') + '</div>'
    + '<button onclick="document.getElementById(\'match-analyse-modal\').remove()" style="background:rgba(255,255,255,.08);border:none;border-radius:8px;padding:.3rem .65rem;color:var(--sub);font-size:.95rem;cursor:pointer;">✕</button>'
    + '</div>'
    + (hasOdds ? '<div style="display:flex;gap:.4rem;margin-bottom:.9rem;">'
      + '<div style="flex:1;text-align:center;background:rgba(0,190,196,.06);border:1px solid rgba(0,190,196,.2);border-radius:10px;padding:.45rem .2rem;"><div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:#00BEC4;font-weight:700;margin-bottom:.15rem;">1 THUIS</div><div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.2rem;color:#00BEC4;">' + m.homeOdds + '</div></div>'
      + '<div style="flex:1;text-align:center;background:rgba(255,255,255,.03);border:1px solid var(--stroke);border-radius:10px;padding:.45rem .2rem;"><div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:#d97706;font-weight:700;margin-bottom:.15rem;">X</div><div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.2rem;color:#d97706;">' + m.drawOdds + '</div></div>'
      + '<div style="flex:1;text-align:center;background:rgba(0,190,196,.06);border:1px solid rgba(0,190,196,.2);border-radius:10px;padding:.45rem .2rem;"><div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:#dc2626;font-weight:700;margin-bottom:.15rem;">2 UIT</div><div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.2rem;color:#dc2626;">' + m.awayOdds + '</div></div>'
      + '</div>' : '')
    + '<div id="modal-analyse-output" style="min-height:120px;">'
    + '<div style="text-align:center;padding:2rem 0;"><div style="font-size:2rem;">⚽</div>'
    + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:var(--sub);margin-top:.75rem;">Claude analyseert...</div></div>'
    + '</div>'
    + '<button onclick="window._modalMatch&&openMatchAnalyseModal(window._modalMatch)" style="width:100%;margin-top:.75rem;background:transparent;border:1px solid var(--stroke);border-radius:10px;padding:.4rem;font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:var(--sub);cursor:pointer;">↻ Nieuwe analyse</button>'
    + '</div>';

  document.body.appendChild(modal);
  window._modalMatch = m;
  _runModalAnalyse(m);
}

async function _runModalAnalyse(m) {
  const output = document.getElementById('modal-analyse-output');
  if (!output) return;
  try {
    const WORKER = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : 'https://api.promatchxi.app');
    const wt = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
    const [h2h, homeForm, awayForm, predictions] = await Promise.all([
      wt(typeof fetchH2H === 'function' && m.homeId && m.awayId ? fetchH2H(m.homeId, m.awayId) : Promise.resolve(null), 5000),
      wt(typeof fetchTeamForm === 'function' && m.homeId ? fetchTeamForm(m.homeId) : Promise.resolve(null), 5000),
      wt(typeof fetchTeamForm === 'function' && m.awayId ? fetchTeamForm(m.awayId) : Promise.resolve(null), 5000),
      wt(typeof fetchPredictions === 'function' && m.id ? fetchPredictions(m.id) : Promise.resolve(null), 5000),
    ]);
    const fmtForm = (form, teamId) => {
      if (!form || !form.length) return 'Onbekend';
      return form.slice(0,5).map(function(f) {
        var g = f.goals || {}; var t = f.teams || {};
        var isHome = t.home && t.home.id == teamId;
        var gf = isHome ? (g.home != null ? g.home : '?') : (g.away != null ? g.away : '?');
        var ga = isHome ? (g.away != null ? g.away : '?') : (g.home != null ? g.home : '?');
        return gf + '-' + ga;
      }).join(', ');
    };
    var h2hText = (h2h && h2h.length) ? h2h.slice(0,5).map(function(f) {
      var g = f.goals || {};
      return (f.teams&&f.teams.home&&f.teams.home.name||'?') + ' ' + (g.home!=null?g.home:'?') + '-' + (g.away!=null?g.away:'?') + ' ' + (f.teams&&f.teams.away&&f.teams.away.name||'?');
    }).join(' | ') : 'Geen H2H data';
    var context = m.home + ' vs ' + m.away
      + '\nCompetitie: ' + (m.league || m.leagueName || 'Onbekend')
      + '\nDatum: ' + (m.date || m.matchDate || 'Vandaag')
      + '\nOdds: 1=' + (m.homeOdds||'?') + ' X=' + (m.drawOdds||'?') + ' 2=' + (m.awayOdds||'?')
      + '\nVorm ' + m.home + ': ' + fmtForm(homeForm, m.homeId)
      + '\nVorm ' + m.away + ': ' + fmtForm(awayForm, m.awayId)
      + '\nH2H: ' + h2hText
      + (predictions && predictions.advice ? '\nAPI voorspelling: ' + predictions.advice : '');
    var prompt = 'Je bent een voetbalanalist. Analyseer deze wedstrijd in het Nederlands.\n\n' + context
      + '\n\nGeef een analyse met:\n1. **Vorm** van beide teams (2-3 zinnen)\n2. **Head-to-head** historiek\n3. **Kansen** op basis van odds en vorm\n4. **Value inschatting** - zijn de odds eerlijk?\n5. **Tip** in 1 duidelijke zin\n\nMaximaal 300 woorden. Wees concreet.';
    var res = await fetch(WORKER + '/anthropic', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 600, messages: [{role:'user',content:prompt}] })
    });
    var api = await res.json();
    var text = (api && api.content && api.content[0] && api.content[0].text) || '⚠️ Geen analyse ontvangen.';
    var html = text.replace(/^#{1,3}\s+(.+)$/gm,'<strong>$1</strong>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>');
    output.innerHTML = '<div style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;padding:.85rem 1rem;"><p style="font-family:\'DM Sans\',sans-serif;font-size:.7rem;color:var(--ink,#fff);line-height:1.65;margin:0;">' + html + '</p></div>';
  } catch(e) {
    if (output) output.innerHTML = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:#dc2626;text-align:center;padding:1rem;">⚠️ Analyse mislukt: ' + (e.message||'onbekend') + '</div>';
  }
}

