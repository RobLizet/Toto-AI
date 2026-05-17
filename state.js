// ═══════════════════════════════════════════════════════
// STATE.JS — Centraal state object + persistence
// ═══════════════════════════════════════════════════════

const APP_VERSION = 'v18.4';

const STATE_KEY = 'totoai_state';

const state = {
  activeScreen: 'dashboard',
  activeTab: 'dashboard',
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
  combiBuilder: [],
  wallet: { balance: 500, startBalance: 500, totalStaked: 0, totalWon: 0, bets: [] },
  tracker: { bets: [] },
  valueBacktest: { picks: [] },
  costs: { calls: 0, tokensIn: 0, tokensOut: 0, totalUSD: 0 },
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
    if (saved.wallet)        Object.assign(state.wallet, saved.wallet);
    if (saved.tracker)       Object.assign(state.tracker, saved.tracker);
    if (saved.valueBacktest) Object.assign(state.valueBacktest, saved.valueBacktest);
    if (saved.settings)      Object.assign(state.settings, saved.settings);
    if (saved.costs)         Object.assign(state.costs, saved.costs);
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

function scheduleFirebaseSync() {}
