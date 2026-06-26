// ═══════════════════════════════════════════════════════
// STATE.JS — Centraal state object + persistence
// v53: v26.37 — combi-tips uit scan-engine picks (consistent met scan-log, geen losse Claude-selectie)
// ═══════════════════════════════════════════════════════

const APP_VERSION = 'v26.153'; // v26.153: gedimde witte tekst (rgba .5/.6/.7) feller gemaakt via CSS-override voor leesbaarheid; gekleurde tekst ongemoeid // v26.152: CLV-kolom in DOELPUNTEN-MARKTEN (via /goal-markets endpoint, server-view); client-berekening als terugval // v26.151: Analyse-tab krijgt DOELPUNTEN-MARKTEN-blok (hitrate/ROI/value per O/U-lijn + BTTS) uit /picks; CLV volgt // v26.150: FIX fetchGoalOdds — apiFetch geeft een Response terug, moest .json() doen (gaf overal 'geen O/U-odds'); fixt knop + analyse-blok // v26.149: wallet-afrekening sluitend voor O/U (alle lijnen) + BTTS via gedeelde settleGoalPick-helper (beide code-stijlen) op alle 3 afrekenplekken // v26.148: goals-quotes (O/U 1.5/2.5/3.5 + BTTS) zichtbaar op de wedstrijd-kaart via 'MEER/MINDER GOALS'-knop, tikbaar net als 1/X/2 // v26.147: O/U + BTTS markt-odds + value (pp) in wedstrijd-analyse (consensus + Shin de-vig via proxy), terugval op model-only zonder odds // v26.146: O/U 1.5/2.5/3.5 + BTTS (model) in MODEL vs MARKT-blok van wedstrijd-analyse (uit lambdaHome/lambdaAway) // v26.145: doelpunten-markten in UI — pickMarket-helper + markt-chip in scan-log & dashboard-pick, live-winnend-check uitgebreid naar O/U + BTTS // v26.144: afgelopen wedstrijden filteren ook bij oude cache (kickoff uit raw.fixture.date i.p.v. enkel kickoffMs) // v26.143: afgelopen/gepasseerde wedstrijden nooit als speelbaar tonen (kickoff-vangnet in renderMatches + live-refresh draait ook bij gepasseerde niet-live matches) // v26.131: stat-labels groter + feller // v26.130: muted-tekst nog een tik feller // v26.129: muted-tekst app-breed lichter (leesbaarheid labels) // v26.128: daglimiet-melding bij handmatige scan // v26.127: handmatige scan-knop triggert worker-scan-nu (/scan-now) + ververst // v26.126: WORKER = enige value-engine — frontend-scan vervangen door /picks-bron (scanValueAll/Batched/MultiScan delegeren) // v26.125: BESTE VALUE PICK leest uit worker-picks (1 bron), niet uit frontend-scan // v26.124: value-hardening NAAR FRONTEND — shrinkage 0.55 + longshot-guardrail in calcValueFair/scan + LAATSTE SCAN verbergt verleden wedstrijden // v26.123: value-picks verbergen al-begonnen/afgelopen wedstrijden (matchHasStarted) // v26.122: fix TIP VAN DE DAG-kaart toont weer (id daily-tip-card vs dailyTipCard) // v26.121: CLV-widget pas vanaf n>=20 picks + sample-grootte (n=) getoond // v26.113: WK PICKS fix — data.picks i.p.v. Object.values // v26.112: geen value-badge op kaart voor draw-picks (consistent met Value Picks) // v26.111: 3-dagen toont matches+SCAN VALUE knop; batch-scan (>15 in stukken van 15) // v26.110: 3-dagen-scan cap 25->50 // v26.109: SCAN 3 DAGEN-knop naast MULTI-SCAN (altijd zichtbaar) // v26.108: 3-dagen-scan // v26.107: Value Picks-lijst opent detail-popup i.p.v. naar Analyse springen // v26.106: WK in LEAGUE_TRUST + reason consistent met pick/value // v26.105: Analyse = volledige analytics inline; COMBI TIPS naar Matches // v26.104: SCAN VANDAAG/MORGEN-knoppen weg op Analyse (dubbel) // v26.103: Value Picks regular = catch-all (pick werd geteld maar niet getoond) // v26.102: fix apiPath ReferenceError in retry-log // v26.101: FIX dubbele worker-prefix in apiFetch (lege Matches-tab) // v26.100: globale apiFetch-throttle + wk2026 calls via apiFetch // v26.99: odds-throttle tussen leagues + ruimere retry-backoff // v26.98: apiFetch rate-limit retry + backoff (geen valse lege schermen) // v26.97: WK/odds per unieke datum — fix 'geen odds' bij leagues met matches over meerdere dagen // v26.96: fixtures via worker proxy + cache-bust // v26.95: odds via worker + cache-bust // v26.94: cache-bust odds // v26.93: drempels terug + conf fix + header fix // v26.92: Value Picks veldnamen fix // v26.91: Value Picks laadt Supabase picks direct // v26.90: Value Picks overzicht met secties // v26.89: sharp money geoptimaliseerd // v26.88: scan log min 5pp + 1 pick per fixture // v26.87: Monte Carlo grotere tekst + breedte fix // v26.86: Monte Carlo popup tekst fix // v26.85: alle resterende donkere elementen creme fix // v26.84: tracker-row creme fix // v26.83: bet-row * override creme // v26.82: wallet bet-row tekst leesbaar creme // v26.81: post-WK leagues bijgewerkt // v26.80: automatische seizoenswisseling WK → Europa // v26.78: analytics tekst leesbaar creme thema // v26.77: league tiers + pick performance + Monte Carlo // v26.76: AI invloed 10% — markt dominant // v26.75: prompt caching Anthropic // v26.73: pick consistency lock + gelijkspel 2-scan // v26.71: creme thema bet-row + scan-card + filter knoppen // v26.70: zwarte kaartjes fix wallet + analyse + resultaten // v26.69: poissonMap sharp + settlement fix // v26.68: WK AI-prompt FIFA/form + combi-tip + push timing // v26.66: 1 pick per wedstrijd + strengere drempels // v26.65: analytics KPI kaartjes thema-proof // v26.64: rate limits verhoogd // v26.63: sharp money teamnamen + datum fix // v26.62: sharp popup klikbaar + teamnamen in analytics

// Tijdelijk: alleen WK 2026 tonen/scannen. Zet op false om alle competities te herstellen.
const WK_ONLY_MODE = true;

const STATE_KEY = 'totoai_state';

// v26.145: markt-helper — vertaalt een pick-code naar markt-groep + nette badge.
// Maakt doelpunten-picks (O/U 1.5/2.5/3.5 + BTTS) naast 1X2 herkenbaar in de UI.
function pickMarket(pick) {
  pick = String(pick || '');
  if (pick === '1' || pick === 'X' || pick === '2')
    return { group: '1X2', label: 'Uitslag', badge: pick };
  if ((pick[0] === 'O' || pick[0] === 'U') && /\d/.test(pick)) {
    const line = pick.slice(1);
    return { group: 'OU' + line.replace('.', ''), label: 'Doelpunten', badge: (pick[0] === 'O' ? 'Over ' : 'Under ') + line };
  }
  if (pick === 'BTTS' || pick === 'BTTS-J')   return { group: 'BTTS', label: 'Beide scoren', badge: 'GG' };
  if (pick === 'NOBTTS' || pick === 'BTTS-N') return { group: 'BTTS', label: 'Beide scoren', badge: 'NG' };
  return { group: 'OVERIG', label: '', badge: pick };
}

// v26.149: afrekenen van een doelpunten-pick (O/U alle lijnen + BTTS), beide code-stijlen
// (O2.5 én O25, BTTS/NOBTTS én BTTS-J/BTTS-N). Geeft 'win'/'lose' of null (geen goal-markt).
function settleGoalPick(pick, hg, ag) {
  if (hg == null || ag == null) return null;
  const tot = hg + ag;
  let p = String(pick || '').toUpperCase();
  if (p === 'BTTS' || p === 'BTTS-J' || p === 'BTTSJ' || p === 'GG') return (hg >= 1 && ag >= 1) ? 'win' : 'lose';
  if (p === 'NOBTTS' || p === 'BTTS-N' || p === 'BTTSN' || p === 'NG') return (hg >= 1 && ag >= 1) ? 'lose' : 'win';
  let m = /^([OU])(\d)(\d)$/.exec(p);              // O25 / U15 / O35 → O2.5 / U1.5 / O3.5
  if (m) p = m[1] + m[2] + '.' + m[3];
  m = /^([OU])(\d+(?:\.\d+)?)$/.exec(p);           // O2.5 / U1.5 / O3.5
  if (m) { const line = parseFloat(m[2]); if (isFinite(line)) { const over = tot > line; return (m[1] === 'O') === over ? 'win' : 'lose'; } }
  return null;
}

// v26.123: bepaalt of een wedstrijd al begonnen/afgelopen is — gebruikt om value-picks
// op verleden wedstrijden te verbergen (conservatief: alleen verbergen bij zekerheid).
// Accepteert zowel match-objecten (isDone/dateISO/date/time/timestamp) als pick-objecten (matchTime).
function matchHasStarted(m) {
  if (!m) return false;
  if (m.isDone || m.isLive || m.finished) return true;
  let ts = (typeof m.timestamp === 'number' && m.timestamp > 0) ? m.timestamp : 0;
  if (!ts) {
    const isoFull = m.matchTime || m.kickoff; // volledige ISO-datetime (pick-objecten)
    if (isoFull) { const d = new Date(isoFull); if (!isNaN(d)) ts = d.getTime(); }
  }
  if (!ts) {
    const dateStr = m.dateISO || m.matchDate || m.date;
    const timeStr = (m.time && m.time !== '\u2014') ? m.time : '23:59';
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const d = new Date(dateStr + 'T' + timeStr + ':00');
      if (!isNaN(d)) ts = d.getTime();
    }
  }
  return ts > 0 && ts < Date.now() - 5 * 60 * 1000; // 5 min marge
}

// v26.136: bevroren live-status detecteren. Een wedstrijd in 1e helft/rust kan nooit >75 min
// na aftrap nog live zijn; een hele wedstrijd zelden >150 min. Voorkomt vastzittende '45'-kaarten.
function isStaleLive(statusShort, kickoffMs) {
  if (!kickoffMs) return false;
  const ageMin = (Date.now() - kickoffMs) / 60000;
  if (['1H','HT'].includes(statusShort) && ageMin > 75) return true;
  if (ageMin > 150) return true;
  return false;
}

const state = {
  // Navigatie
  activeScreen: 'dashboard',
  activeTab: 'dashboard',

  // Wedstrijden
  activeComp: 'eredivisie',
  matches: [],
  bookmakerOdds: {},
  openingOdds: {},
  lastScanResults: [],
  favoriteComps: [],
  scheduledScanPicks: [],
  valueScans: [],
  backtestPicks: [],
  scanLog: [],
  trackerBets: [],

  // Combi builder
  combiBuilder: [],

  // Wallet
  wallet: {
    balance: 500,
    startBalance: 500,
    totalStaked: 0,
    totalWon: 0,
    bets: []
  },

  // Tracker (echte bets buiten de app)
  tracker: { bets: [] },

  // Backtest (automatisch bijgehouden value picks)
  valueBacktest: { picks: [] },

  // Kosten tracker
  costs: { calls: 0, tokensIn: 0, tokensOut: 0, totalUSD: 0 },

  // Instellingen
  settings: {
    anthropicKey: '',
    footballKey: '',
    fdKey: '',
    defaultComp: 'eredivisie',
    startBalance: 500,
    defaultBet: 10,
    defaultBookmaker: 'Bet365',
    oddsSource: 'manual',
    notifEnabled: false,
    notifThreshold: 15,
    autoDark: false,
    autoValueAlerts: false,
    vapidPublicKey: '',
    autoScan: false,
    scanSkipDate: null,
    scanWindowFrom: 14,
    scanWindowTo: 18,
    tripleMinOdds: 1.6,
    _preAutoDarkTheme: null
  }
};

function saveState() {
  try {
    // Beperk matches voor opslag — max 100, geen live wedstrijden
    const stateToSave = {...state};
    if (state.matches?.length > 100) {
      stateToSave.matches = state.matches.slice(0, 100);
    }
    localStorage.setItem(STATE_KEY, JSON.stringify(stateToSave));
    scheduleFirebaseSync();
  } catch(e) {
    console.warn('[State] saveState fout:', e.message);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    // Deep merge — bewaar structuur, overschrijf met opgeslagen waarden
    if (saved.wallet)        Object.assign(state.wallet, saved.wallet);
    if (saved.tracker)       Object.assign(state.tracker, saved.tracker);
    if (saved.valueBacktest) Object.assign(state.valueBacktest, saved.valueBacktest);
    if (saved.settings)      Object.assign(state.settings, saved.settings);

    // ── Migreer oude Triple Lock standaardwaarden naar nieuwe defaults ──
    if (!state.settings.tripleMinValue || state.settings.tripleMinValue < 10) {
      state.settings.tripleMinValue = 12;
    }
    if (!state.settings.tripleMinConf || state.settings.tripleMinConf < 8) {
      state.settings.tripleMinConf = 8;
    }
    if (!state.settings.tripleMinOdds || state.settings.tripleMinOdds < 1.55) {
      state.settings.tripleMinOdds = 1.6;
    }

    // Kosten tracker laden
    if (saved.costs) Object.assign(state.costs, saved.costs);

    const scalarFields = [
      'activeComp','activeScreen','favoriteComps','combiBuilder',
      'openingOdds','lastScanResults','scheduledScanPicks',
      'backtestPicks','trackerBets','scanLog','matches','valueScans'
    ];
    scalarFields.forEach(key => {
      if (saved[key] !== undefined) state[key] = saved[key];
    });

    // Oude wedstrijden opruimen — verwijder matches van vóór vandaag
    const _todayISO = new Date().toISOString().split('T')[0];
    if (Array.isArray(state.matches)) {
      const before = state.matches.length;
      state.matches = state.matches.filter(m => {
        const d = m.dateISO || m.date || '';
        return !d || d >= _todayISO; // bewaar als geen datum of datum >= vandaag
      });
      if (state.matches.length < before) {
        console.log(`[State] ${before - state.matches.length} oude wedstrijden opgeruimd`);
      }
    }
  } catch(e) {
    console.warn('[State] loadState fout:', e.message);
  }
}

// Stub — wordt overschreven door firebase.js
function scheduleFirebaseSync() {}

