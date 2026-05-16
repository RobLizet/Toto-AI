// ═══════════════════════════════════════════════════════
// STATE.JS — Centraal state object + persistence
// ═══════════════════════════════════════════════════════

const APP_VERSION = 'v17.5';

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
    tripleMinOdds: 1.5,
    _preAutoDarkTheme: null
  }
};

function saveState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
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
    // Scalaire velden
    // Kosten tracker laden
    if (saved.costs) Object.assign(state.costs, saved.costs);

    const scalarFields = [
      'activeComp','activeScreen','favoriteComps','combiBuilder',
      'openingOdds','lastScanResults','scheduledScanPicks',
      'backtestPicks','trackerBets','scanLog'
    ];
    scalarFields.forEach(key => {
      if (saved[key] !== undefined) state[key] = saved[key];
    });
  } catch(e) {
    console.warn('[State] loadState fout:', e.message);
  }
}

// Stub — wordt overschreven door firebase.js
function scheduleFirebaseSync() {}
