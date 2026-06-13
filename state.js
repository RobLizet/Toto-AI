// ═══════════════════════════════════════════════════════
// STATE.JS — Centraal state object + persistence
// v53: v26.37 — combi-tips uit scan-engine picks (consistent met scan-log, geen losse Claude-selectie)
// ═══════════════════════════════════════════════════════

const APP_VERSION = 'v26.98'; // v26.98: apiFetch rate-limit retry + backoff (geen valse lege schermen) // v26.97: WK/odds per unieke datum — fix 'geen odds' bij leagues met matches over meerdere dagen // v26.96: fixtures via worker proxy + cache-bust // v26.95: odds via worker + cache-bust // v26.94: cache-bust odds // v26.93: drempels terug + conf fix + header fix // v26.92: Value Picks veldnamen fix // v26.91: Value Picks laadt Supabase picks direct // v26.90: Value Picks overzicht met secties // v26.89: sharp money geoptimaliseerd // v26.88: scan log min 5pp + 1 pick per fixture // v26.87: Monte Carlo grotere tekst + breedte fix // v26.86: Monte Carlo popup tekst fix // v26.85: alle resterende donkere elementen creme fix // v26.84: tracker-row creme fix // v26.83: bet-row * override creme // v26.82: wallet bet-row tekst leesbaar creme // v26.81: post-WK leagues bijgewerkt // v26.80: automatische seizoenswisseling WK → Europa // v26.78: analytics tekst leesbaar creme thema // v26.77: league tiers + pick performance + Monte Carlo // v26.76: AI invloed 10% — markt dominant // v26.75: prompt caching Anthropic // v26.73: pick consistency lock + gelijkspel 2-scan // v26.71: creme thema bet-row + scan-card + filter knoppen // v26.70: zwarte kaartjes fix wallet + analyse + resultaten // v26.69: poissonMap sharp + settlement fix // v26.68: WK AI-prompt FIFA/form + combi-tip + push timing // v26.66: 1 pick per wedstrijd + strengere drempels // v26.65: analytics KPI kaartjes thema-proof // v26.64: rate limits verhoogd // v26.63: sharp money teamnamen + datum fix // v26.62: sharp popup klikbaar + teamnamen in analytics

// Tijdelijk: alleen WK 2026 tonen/scannen. Zet op false om alle competities te herstellen.
const WK_ONLY_MODE = true;

const STATE_KEY = 'totoai_state';

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
    defaultBookmaker: 'Jacks',
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

