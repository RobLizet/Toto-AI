// ═══════════════════════════════════════════════════════
// STATE.JS — Centraal state object + persistence
// v53: v26.37 — combi-tips uit scan-engine picks (consistent met scan-log, geen losse Claude-selectie)
// ═══════════════════════════════════════════════════════

const APP_VERSION = 'v26.243'; // v26.243: automatische tracker-settlement — autoSettleTracker draait stil bij openen van de Tracker (max 1x/15 min via state.tracker._lastAutoCheck), rekent alleen duels af waarvan de aftrap voorbij is, API-vriendelijk gespreid (1,2s), niet-blokkerend/fire-and-forget, offline overgeslagen; toont een subtiele balk "X bet(s) automatisch afgerekend". De "🔍 Check alle"-knop blijft als handmatige optie // v26.242: tracker-settlement gerepareerd — (1) robuuste team-scheiding in checkTrackerBet (" v ", "vs.", dash-varianten, niet alleen " vs "), (2) Asian Handicap-regex accepteert nu ook lijn zonder teken (0.0 = level/DNB) én haakjes rond "(Asian Handicap)", (3) kale "Meer/Minder dan X.X" rekent af als doelpunten-O/U (kaarten/corners uitgesloten), (4) datum-lookup zoekt ±2 dagen rond de bet-datum tegen import/OCR-datumfouten. Open WK-bets die dagenlang bleven hangen settelen nu. Wallet-legacy (checkBetResult) bewust ongemoeid (tab verborgen sinds v26.238) // v26.241: globale error-boundary (window error + unhandledrejection) — één ongevangen JS-fout sloopt niet meer de hele UI, toont een niet-blokkerende melding i.p.v. rood scherm; plus opschoning van dode v26.237-code (settleAllWalletBets + knop). Diepere wallet/backtest-purge bewust NIET gedaan: valueBacktest voedt de validatie-pijplijn // v26.240: Tracker equity-curve gebouwd — renderTrackerChart tekent cumulatief W/V van afgerekende tracker-bets op het (voorheen verborgen) #trackerChart canvas, zelfde stijl als de wallet-chart, punten gekleurd per win/verlies; verschijnt vanaf 2 afgerekende bets // v26.239: fix Tracker-crash 'renderTrackerChart is not defined' — dode aanroep (chart-wrap was toch al display:none) veilig afgevangen; Tracker opent nu weer normaal // v26.238: bet-plaatsen (virtuele saldo-wallet) volledig verwijderd — SINGLE BET/COMBI-knoppen weg uit analyse, Matches en value-cards; Wallet-tab toont nu alleen de Tracker (saldo + Resultaten/backtest verborgen); Home OPEN BET-kaart + saldo-tegel weg; bottom-nav 'Wallet' -> 'Tracker'. Odds op Matches blijven als value-indicator // v26.237: wallet-bets rekenen nu automatisch af — settleAllWalletBets draait stil bij openen Home (max 1x/15min, alleen afgelopen duels FT/AET/PEN, API-vriendelijk gespreid) i.p.v. handmatig per bet; plus knop 'X open bets afrekenen' op wallet-scherm. Lost op dat open bets dagenlang bleven hangen // v26.236: robuustheid odds-ophalen — fetchGoalOdds timeout 6s->11s + 1 nette retry bij lege/mislukte respons, zodat een tijdelijke hapering niet stil de DOELPUNTEN- + ASIAN LINES-sectie wist; nette neutrale melding met refresh-hint i.p.v. lege plek // v26.235: ASIAN LINES tabel scanbaarder — TOP VALUE-badge op de regel met de hoogste value (alleen bij >=3pp, geen hersortering) + risicoprofiel-tags per lijn (DNB bij lijn 0, PUSH bij hele lijnen, half-win/verlies bij kwartlijnen) // v26.234: ASIAN LINES trackrecord-kaart op het Analyse-scherm (inklapbaar, naast schaduw-picks en doelpunten-markten) — toont het AH-schaduwtrackrecord uit /ah-shadow: samenvatting (win/half/push/half-verlies/verlies + ROI in eenheden) en recente rijen met model-vs-markt en value // v26.233: ASIAN LINES in de diepte-analyse — AH-odds (bet 4) meegelezen in dezelfde odds-call, genormaliseerd naar thuis-handicap + 2-weg Shin de-vig; asianModelProbs uit dezelfde Poisson+Dixon-Coles matrix (kwartlijnen gesplitst, push-conditionele kansen); mismatch-anker (SoS-valkuil) ook op AH toegepast; max 4 lijnen dichtst bij 50/50, AH-edges tellen mee in de VALUE-INDEX // v26.189: i18n-motor data-i18n-html (EN-only swap) + Disclaimer + changelog-chrome + help-skeleton (sectie/card-titels, tips, nav) tweetalig // v26.188: i18n — login.html volledig tweetalig (i18n.js ingeladen, statische tags + inline-meldingen) NL/EN // v26.187: i18n — dynamische meldingen (auth/notificaties/ui/oefenduels/wallet-confirms) NL/EN // v26.186: i18n — WK 2026-scherm (tabs, laad/lege-meldingen, NL-spotlight, koppen) NL/EN // v26.185: i18n — Analytics-scherm (koppen, KPI-labels, lege/laad-meldingen, sharp-popup) NL/EN // v26.184: Anthropic-key schoongetrokken via patroon (sk-ant-…) bij opslaan én verzenden — plak-rommel (", \, spaties) wordt genegeerd // v26.183: AI-analyse — ongeldige eigen Anthropic-key geeft 1 duidelijke melding (i.p.v. 7x cryptische 401) + geen retries // v26.182: i18n — Wallet meldingen (alerts/confirms/toasts) + analyse-popup-titel NL/EN // v26.181: i18n — Wallet subschermen (value-resultaten, bet-historie, lege staten, export-alerts) NL/EN // v26.180: i18n — Wallet hoofdscherm (saldo, tabs, filters, knoppen) NL/EN // v26.179: i18n — Wedstrijden-restjes (analyse-popup, laad-fout, retry, tik-naam, verversen) NL/EN // v26.178: i18n — Wedstrijden standen/topscorers/comp-wedstrijden laad+lege meldingen NL/EN // v26.177: i18n — Wedstrijdkaart-uitslagen (THUIS/GELIJK/UIT, meer-minder-goals) + value-picks lege staat NL/EN // v26.176: i18n — Wedstrijden eerste pass (handmatige invoer, knoppen, laad/lege-meldingen) NL/EN // v26.175: i18n — Dashboard-body (nav-tegels, deze week, trackrecord-status, disclaimer, live-sectie, comp-kiezer) NL/EN // v26.174: i18n — Instellingen onderkant compleet (backups/kosten/account/db/admin/knoppen + korte hints) NL/EN // v26.173: i18n — Instellingen-velden/hints/toggles (bovenste secties) + Dashboard eerste pass (koppen/knoppen) NL/EN // v26.172: i18n fase 2 vervolg — Instellingen-sectietitels + Opslaan + 3 modals (Bet/Tracker/Storten) vertaald (NL/EN) // v26.171: i18n fase 2 (app-chrome) — data-i18n motor + nav/login-tabs vertaald (NL ongewijzigd, EN toegevoegd) + cookievoorkeuren-knop in Instellingen // v26.170: i18n fundament (fase 1) — i18n.js met t()-helper, lang in settings, taalknop in Instellingen (NL/EN, NL=default+fallback) // v26.169: cookie-consent banner + Google Consent Mode v2 (analytics_storage standaard denied; banner accepteren/weigeren, NL/EN, heropenbaar via pmxOpenConsent) // v26.168: JSON-LD structured data (SoftwareApplication) toegevoegd aan index.html + welcome.html voor SEO — naam, categorie, zoekwoorden (value betting voetbal, AI voetbalanalyse, voetbal value picks e.a.), NL/EN, 18+

// Tijdelijk: alleen WK 2026 tonen/scannen. Zet op false om alle competities te herstellen.
const WK_ONLY_MODE = true;

const STATE_KEY = 'totoai_state';

// ── v26.158: bankroll & uitleg ──────────────────────────────
// Vaste unit-strategie (BEWUST géén Kelly: Kelly schaalt op de geschatte edge,
// en die is nog niet gevalideerd → zou fouten vergroten). Units volgen de confidence.
function unitAdvies(confidence, value) {
  const c = Number(confidence) || 0, v = Number(value) || 0;
  let units = 1;
  if (c >= 8) units = 3;
  else if (c >= 7) units = 2.5;
  else if (c >= 6) units = 2;
  else if (c >= 5) units = 1.5;
  if (v >= 12 && units < 3) units += 0.5;
  const us = (typeof state !== 'undefined' && state.settings && Number(state.settings.unitSize) > 0) ? Number(state.settings.unitSize) : 0;
  const eur = us ? ` = \u20ac${(units * us).toFixed(2)}` : '';
  return { units, eur };
}
// Value in gewone taal: model-kans vs break-even-kans uit de quote.
function valueUitleg(modelPct, odds) {
  const o = parseFloat(odds), mp = Math.round(Number(modelPct));
  if (!(o > 1) || !isFinite(mp)) return '';
  const be = Math.round(100 / o);
  const diff = mp - be;
  if (diff <= 0) return `Bij een quote van ${o} moet deze uitkomst ongeveer ${be}% kans hebben om quitte te spelen; het model schat ${mp}%. Weinig tot geen voordeel hier.`;
  return `Bij een quote van ${o} hoeft deze uitkomst maar ${be}% kans te hebben om quitte te spelen. Het model schat ${mp}% \u2014 dat is ${diff} procentpunt hoger. Dat overschot is de \u201evalue\u201d: je krijgt een betere prijs dan de kans rechtvaardigt.`;
}

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
    lang: 'nl',
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

