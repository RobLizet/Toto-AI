// ═══════════════════════════════════════════════════════
// API.JS — Worker proxy + Football API + Anthropic
// ═══════════════════════════════════════════════════════

const WORKER = 'https://api.promatchxi.app';

// ── v26.270: gecorrigeerde value ────────────────────────────────────────────
// De tabellen toonden het RUWE model-markt-verschil, terwijl de backend selecteert op
// calculateValue() = (1-w) x ruw, met w = marketShrink + tier-extra, en x0.88 voor een gelijkspel.
// Gemeten: Spain-Belgium draw 4.7pp ruw -> ~1.5pp gecorrigeerd, drempel 7pp (toernooi).
// Constanten NIET dupliceren: ze komen uit /model-params, want autotune stelt s1/s2 bij.
let MODEL_PARAMS = null;
async function loadModelParams() {
  if (MODEL_PARAMS) return MODEL_PARAMS;
  try {
    const r = await fetch(WORKER + '/model-params');
    if (!r.ok) return null;
    MODEL_PARAMS = await r.json();
    return MODEL_PARAMS;
  } catch (e) { console.warn('[model-params]', e.message); return null; }
}

// Geeft null terug als de parameters ontbreken -> de UI toont dan alleen het ruwe verschil,
// liever geen getal dan een verkeerd getal.
function adjValue(raw, aiKans, pick, leagueId) {
  const P = MODEL_PARAMS;
  if (!P || raw == null || aiKans == null) return null;
  const isTournament = (P.tournamentLeagues || []).includes(Number(leagueId));
  const base = isTournament ? P.shrink.tournament : P.shrink.base;
  const is1x2 = (pick === '1' || pick === 'X' || pick === '2');
  let extra = 0;
  if (is1x2) {
    if (aiKans < 20)      extra = P.tune.s1;
    else if (aiKans < 35) extra = P.tune.s2;
  }
  const w = Math.min(Math.max(base + extra, 0), 0.9);
  let v = raw * (1 - w);
  if (pick === 'X') v = v * P.drawPenalty;
  return parseFloat(v.toFixed(1));
}

// Drempel waar de backend deze pick aan moet voldoen (voor de uitleg onder de tabel).
function minValueFor(pick, leagueId) {
  const P = MODEL_PARAMS;
  if (!P) return null;
  const isTournament = (P.tournamentLeagues || []).includes(Number(leagueId));
  const set = isTournament ? P.minValue.tournament : P.minValue.base;
  return pick === 'X' ? set.X : set.other;
}

const COMP_IDS = {
  eredivisie: 88, kkd: 89, bundesliga: 78, premier: 39,
  oefennl: 667, // Friendlies Clubs (gefilterd op NL-clubs)
  beker: 90, champions: 2, ligue1: 61, seriea: 135, nations: 5, wk2026: 1,
  jupiler: 144, laliga: 140, championship: 40, bundesliga2: 79, superlig: 203,
  // Extra voor scan coverage
  portugal: 94,        // Primeira Liga Portugal
  scotland: 179,       // Scottish Premiership
  liga3: 80,           // 3. Liga Duitsland
  leagueone: 41,       // League One Engeland
  netherlands_cup: 90, // KNVB Beker (alias)
  austria: 218,        // Österreichische Bundesliga
  switzerland: 207,    // Super League Zwitserland
  denmark: 119,        // Superliga Denemarken
  norway: 103,         // Eliteserien Noorwegen
  sweden: 113,         // Allsvenskan Zweden
  greece: 197,         // Super League Griekenland
  russia: 235,         // RPL Rusland
  ukraine: 333,        // UPL Oekraïne
  czech: 345,          // Czech Liga
  poland: 106,         // Ekstraklasa Polen
  romania: 283,        // Liga 1 Roemenië
  europa: 3,           // Europa League
  conference: 848,     // Conference League
  wk_kwal_europa: 32,  // WK 2026 Kwalificatie Europa
  wk_kwal_azie: 36,    // WK 2026 Kwalificatie Azië
  wk_kwal_latam: 34,   // WK 2026 Kwalificatie CONMEBOL
  // Internationale landenteams
  intvriendsch: 10,    // Internationale vriendschappelijke wedstrijden
  euro2024: 4,         // UEFA Euro (archief)
  copaamerica: 9,      // Copa América
  goldcup: 30,         // CONCACAF Gold Cup
  africup: 6,          // Africa Cup of Nations
  asiancup: 7,         // AFC Asian Cup
  olympics_m: 480,     // Olympische Spelen mannen
};

const COMP_NAMES = {
  oefennl: '🤝 Oefenduels NL',
  eredivisie: '🇳🇱 Eredivisie', kkd: '🇳🇱 Keuken Kampioen', bundesliga: '🇩🇪 Bundesliga',
  premier: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League', beker: '🏆 KNVB Beker', champions: '⭐ Champions League',
  ligue1: '🇫🇷 Ligue 1', seriea: '🇮🇹 Serie A', nations: '🌍 Nations League',
  jupiler: '🇧🇪 Jupiler Pro League', laliga: '🇪🇸 La Liga', championship: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship',
  bundesliga2: '🇩🇪 2. Bundesliga', superlig: '🇹🇷 Süper Lig', wk2026: '🏆 WK 2026',
  norway: '🇳🇴 Eliteserien', sweden: '🇸🇪 Allsvenskan',
  portugal: '🇵🇹 Primeira Liga', scotland: '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scottish Prem', denmark: '🇩🇰 Superliga DK',
  liga3: '🇩🇪 3. Liga', leagueone: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 League One',
  poland: '🇵🇱 Ekstraklasa', austria: '🇦🇹 Bundesliga AT', switzerland: '🇨🇭 Super League CH',
  greece: '🇬🇷 Super League GR', czech: '🇨🇿 Czech Liga', championship: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship',
  europa: '🟠 Europa League', conference: '🟢 Conference League',
  // Internationaal
  intvriendsch: '🌍 Int. Vriendschappelijk', copaamerica: '🌎 Copa América',
  goldcup: '🌎 Gold Cup', africup: '🌍 Africa Cup', asiancup: '🌏 Asian Cup',
  wk_kwal_europa: '🌍 WK Kwal. Europa', wk_kwal_azie: '🌏 WK Kwal. Azië',
  wk_kwal_latam: '🌎 WK Kwal. CONMEBOL',
};

const FD_CODES = {
  eredivisie: 'DED', kkd: null, bundesliga: 'BL1', premier: 'PL',
  beker: 'KBR', champions: 'CL', ligue1: 'FL1', seriea: 'SA', nations: null
};

// ── API-Football via Worker /apif/* ─────────────────────
// v26.100: globale throttle — serialiseert ALLE API-Football calls met een minimale
// tussentijd. Zo kan geen enkel scherm (Matches, all-comps, WK-tab, odds, retries) de
// per-minuut rate-limit verzadigen via een burst. Reservering is synchroon → race-vrij.
const API_MIN_GAP = 120; // ms tussen opeenvolgende calls
let _apiNextSlot = 0;

// v26.309: EEN GEWEIGERDE CALL IS GEEN 'GEEN DATA'. Elke fetcher hieronder (fetchTeamStats,
// fetchTeamForm, fetchH2H) geeft `null` terug bij zowel een lege respons als een afgekapte/
// geweigerde call -- die twee zijn voor de aanroeper niet te onderscheiden. Gevolg: de
// analyse-prompt zette letterlijk 'geen data' in de context en de LLM schreef braaf op dat er
// geen vormdata BESTAAT, terwijl API-Football die gewoon heeft (gemeten op England/Argentina
// 15-07: form WDWWWW resp. WWWWWW, allebei 6 duels). De LLM loog niet; de prompt loog tegen de
// LLM. Zelfde bugfamilie als worker v245 (`if (!r?.length) break` op een geweigerde call), nu
// aan de frontend-kant. Deze teller is bewust een losse diagnose i.p.v. een sentinel-returnwaarde:
// een leeg object zou truthy zijn en door extractTeamGoalStats heen glippen.
let _apifDiag = { calls: 0, rateLimited: 0 };
function apifDiagReset() { _apifDiag = { calls: 0, rateLimited: 0 }; }
function apifDiagGet() { return { calls: _apifDiag.calls, rateLimited: _apifDiag.rateLimited }; }
function _apiThrottle() {
  const now = Date.now();
  const start = Math.max(now, _apiNextSlot);
  _apiNextSlot = start + API_MIN_GAP;
  const wait = start - now;
  return wait > 0 ? new Promise(r => setTimeout(r, wait)) : Promise.resolve();
}

async function apiFetch(url, _apiKey, timeoutMs = 10000) {
  // v26.101: robuuste URL-opbouw. Callers geven soms een api-sports URL door
  // (https://v3.football.api-sports.io/...) en soms al een volledige worker-URL
  // (`${WORKER}/apif/...`). Voorheen werd die laatste dubbel geprefixt →
  // https://api.promatchxi.app/apifhttps://... → kapotte URL → lege schermen.
  let target;
  if (url.startsWith(WORKER)) {
    target = url;                                              // al volledige worker-URL
  } else if (/^https?:\/\//.test(url)) {
    target = `${WORKER}/apif${url.replace('https://v3.football.api-sports.io', '')}`; // api-sports → proxy
  } else {
    target = `${WORKER}/apif${url.startsWith('/') ? '' : '/'}${url}`; // kaal pad
  }
  await _apiThrottle(); // v26.100: anti-burst spacing
  // v26.98: rate-limit-aware retry. API-Football geeft een per-minuut overschrijding
  // terug als HTTP 200 met { errors: { rateLimit: "..." } } (soms als 429). Zonder
  // afvangen werd dat behandeld als "0 wedstrijden/odds" → valse lege schermen.
  // v26.255: de eerste backoff was 2000ms, terwijl callers deze fetch in een 5s-timeout wikkelen
  // (wt(...)). Eén rate-limit-hit + één retry paste daardoor niet binnen het venster: de caller kreeg
  // null en de UI concludeerde "te weinig data" terwijl de call simpelweg was afgekapt. Eerste retry
  // nu snel (met jitter tegen thundering herd), latere retries blijven ruim voor echte minuut-limieten.
  // v26.309: DE DERDE RETRY KON NOOIT LANDEN. v26.255 verruimde het wt-venster 5000->9000ms en
  // verhoogde tegelijk de backoff-som, waardoor de som opnieuw BUITEN het venster viel -- dezelfde
  // fout die v26.255 zelf beschreef, één ronde later. Rekensom met de oude waarden:
  //   throttle (call #5 x 120ms) 600 + 4 fetches à ~250 = 1000 + backoffs 7900 + jitter ≤750 = 10.250ms
  // tegen een wt-venster van 9000ms -> retry 3 kwam per definitie te laat, wt gaf null, hStats null,
  // poisson.valid=false. Nu 700+1800+3200 = 5700 -> totaal ≤8050ms, past met marge.
  // WIE DIT AANPAST: som van backoffs + jitter + throttle + (n+1) x fetch-latency moet ONDER het
  // wt-venster van de aanroeper blijven (analyse.js gebruikt 9000 voor de statistics-calls).
  const backoffs = [700, 1800, 3200]; // ms; 1e poging + 3 retries. Som bewust < wt-venster.
  const jitter = () => Math.floor(Math.random() * 250);
  _apifDiag.calls++;
  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let r, text;
    try {
      r = await fetch(target, { signal: controller.signal });
      clearTimeout(timer);
      text = await r.text();
    } catch(e) {
      clearTimeout(timer);
      throw e; // netwerk/timeout: ongewijzigd gedrag
    }

    // Rate-limit detecteren
    let rateLimited = (r.status === 429);
    if (!rateLimited && text) {
      try {
        const errs = JSON.parse(text)?.errors;
        if (errs && (errs.rateLimit || errs.requests ||
            (typeof errs === 'string' && /rate|limit|too many/i.test(errs)))) {
          rateLimited = true;
        }
      } catch(e) { /* geen JSON: gewoon teruggeven */ }
    }

    if (rateLimited && attempt < backoffs.length) {
      console.warn(`[apiFetch] rate-limit, retry ${attempt + 1} over ${backoffs[attempt]}ms — ${target}`);
      await new Promise(res => setTimeout(res, backoffs[attempt] + jitter()));
      continue;
    }

    // v26.309: retries op -> de call is DEFINITIEF geweigerd. Vastleggen, want hieronder gaat de
    // rate-limit-informatie verloren: de caller ziet straks alleen een lege `response` en kan dat
    // niet onderscheiden van een wedstrijd zonder data.
    if (rateLimited) _apifDiag.rateLimited++;

    // Verse Response teruggeven zodat caller .json()/.text() kan doen
    return new Response(text, {
      status: r.status,
      statusText: r.statusText,
      headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/json' }
    });
  }
}

// ── football-data.org via Worker /fd/* ──────────────────
function fdFetch(url, _token) {
  const apiPath = url.replace('https://api.football-data.org', '');
  return fetch(`${WORKER}/fd${apiPath}`);
}

// ── Generieke proxy fallback ─────────────────────────────
async function proxyFetchWithFallback(url, options = {}) {
  const r = await fetch(`${WORKER}?url=${encodeURIComponent(url)}`,
    { ...options, signal: AbortSignal.timeout(10000) });
  if (r.ok || r.status < 500) return r;
  throw new Error('Worker onbereikbaar');
}

// ── Anthropic: zie anthropicFetch / anthropicFetchWithRetry in analyse.js (actieve versie met Firebase-auth) ──

// ── Match parse helpers ──────────────────────────────────
function parseAPIMatch(f) {
  if (!f || !f.fixture) return null;
  const fix = f.fixture;
  const home = f.teams?.home || {};
  const away = f.teams?.away || {};
  const goals = f.goals || {};
  const dateObj = fix.date ? new Date(fix.date) : null;
  const timeStr = dateObj ? dateObj.toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit' }) : '--:--';
  const dateStr = dateObj ? dateObj.toLocaleDateString('nl-NL', { weekday:'short', day:'numeric', month:'short' }) : '';
  const _kickMs = dateObj ? dateObj.getTime() : 0;
  const _short = fix.status?.short;
  const _staleLive = (typeof isStaleLive === 'function') && isStaleLive(_short, _kickMs);
  const isLive = !_staleLive && ['1H','HT','2H','ET','BT','P','INT','LIVE'].includes(_short);
  const isDone = ['FT','AET','PEN'].includes(_short) || _staleLive;
  let homeOdds = '—', drawOdds = '—', awayOdds = '—';
  let homePct = 33, drawPct = 33, awayPct = 34;
  const bk = f.bookmakers?.[0] || f.odds?.bookmakers?.[0];
  if (bk) {
    const mkt = bk.bets?.find(b => b.name === 'Match Winner') || bk.markets?.find(m => m.key === 'h2h');
    if (mkt?.values) {
      const h = mkt.values.find(v => v.value === 'Home');
      const d = mkt.values.find(v => v.value === 'Draw');
      const a = mkt.values.find(v => v.value === 'Away');
      if (h) homeOdds = parseFloat(h.odd).toFixed(2);
      if (d) drawOdds = parseFloat(d.odd).toFixed(2);
      if (a) awayOdds = parseFloat(a.odd).toFixed(2);
    }
  }
  if (homeOdds !== '—' && drawOdds !== '—' && awayOdds !== '—') {
    const inv = 1/parseFloat(homeOdds) + 1/parseFloat(drawOdds) + 1/parseFloat(awayOdds);
    homePct = Math.round(1/parseFloat(homeOdds)/inv*100);
    drawPct = Math.round(1/parseFloat(drawOdds)/inv*100);
    awayPct = 100 - homePct - drawPct;
  }
  const leagueNameMap = { 'Eerste Divisie': 'Keuken Kampioen Divisie' };
  const compName = leagueNameMap[f.league?.name] || f.league?.name || '';
  return {
    id: String(fix.id),
    source: 'apif',
    comp: compName,
    compLogo: f.league?.logo || '',
    leagueId: f.league?.id,
    time: timeStr,
    date: dateStr,
    dateISO: fix.date ? fix.date.split('T')[0] : '',
    home: home.name || '?',
    away: away.name || '?',
    homeId: home.id,
    awayId: away.id,
    homeLogo: home.logo || '',
    awayLogo: away.logo || '',
    homeForm: home.form || '',
    awayForm: away.form || '',
    homeOdds, drawOdds, awayOdds, homePct, drawPct, awayPct,
    score: isDone || isLive ? `${goals.home ?? 0}-${goals.away ?? 0}` : null,
    liveMin: fix.status?.elapsed,
    isLive, isDone, kickoffMs: _kickMs,
    venue: fix.venue?.name || '',
    fixture: { neutral: fix.neutral || false },
    raw: f,
    rawSource: 'apif'
  };
}

function parseFDMatch(m, compName) {
  if (!m) return null;
  const dateObj = m.utcDate ? new Date(m.utcDate) : null;
  const timeStr = dateObj ? dateObj.toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit' }) : '--:--';
  const dateStr = dateObj ? dateObj.toLocaleDateString('nl-NL', { weekday:'short', day:'numeric', month:'short' }) : '';
  const isDone = m.status === 'FINISHED';
  const isLive = m.status === 'IN_PLAY' || m.status === 'PAUSED';
  return {
    id: 'fd_' + m.id,
    source: 'fd',
    comp: compName || m.competition?.name || '',
    compLogo: '',
    leagueId: null,
    time: timeStr,
    date: dateStr,
    dateISO: m.utcDate ? m.utcDate.split('T')[0] : '',
    home: m.homeTeam?.shortName || m.homeTeam?.name || '?',
    away: m.awayTeam?.shortName || m.awayTeam?.name || '?',
    homeId: m.homeTeam?.id,
    awayId: m.awayTeam?.id,
    homeLogo: '', awayLogo: '',
    homeForm: '', awayForm: '',
    homeOdds: '—', drawOdds: '—', awayOdds: '—',
    homePct: 33, drawPct: 33, awayPct: 34,
    score: isDone ? `${m.score?.fullTime?.home ?? 0}-${m.score?.fullTime?.away ?? 0}` : null,
    liveMin: null, isLive, isDone,
    venue: m.venue || '',
    fixture: { neutral: false },
    raw: m, rawSource: 'fd'
  };
}

function getCurrentSeason(comp) {
  // WK + Scandinavische competities draaien in seizoen 2026
  const season2026 = ['wk2026', 'norway', 'sweden', 'europa', 'conference', 'champions', 'oefennl'];
  if (season2026.includes(comp)) return 2026;
  return 2025;
}

// ── v26.7: ÉÉN centrale season-bepaling per league-id ──────────────
// Voorkomt season-mismatch tussen fixtures-fetch en odds-fetch.
// API-Football vereist dat de odds-season exact gelijk is aan de fixture-season,
// anders komt er een lege odds-response terug ("geen wedstrijden met quotes").
// Alle kalenderjaar- en internationale competities draaien in seizoen 2026.
const SEASON_2026_LEAGUES_MASTER = new Set([
  1, 2, 3, 4, 5, 6, 7, 9, 10, 29, 30, 32, 34, 36,
  71, 98, 103, 113, 119, 128, 129, 239, 253, 292, 480, 848
]);
function seasonForLeague(leagueId) {
  return SEASON_2026_LEAGUES_MASTER.has(Number(leagueId)) ? 2026 : 2025;
}

// ── Team & fixture data ophalen ───────────────────────────
async function fetchH2H(homeId, awayId) {
  if (!homeId || !awayId) return [];
  try {
    const r = await apiFetch(`https://v3.football.api-sports.io/fixtures/headtohead?h2h=${homeId}-${awayId}&last=10`, null);
    const d = await r.json();
    return d.response || [];
  } catch(e) { return []; }
}

async function fetchTeamForm(teamId) {
  if (!teamId) return [];
  try {
    const r = await apiFetch(`https://v3.football.api-sports.io/fixtures?team=${teamId}&last=8`, null);
    const d = await r.json();
    return d.response || [];
  } catch(e) { return []; }
}

async function fetchTeamStats(teamId, leagueId) {
  if (!teamId) return null;
  try {
    const season = seasonForLeague(leagueId);
    const r = await apiFetch(`https://v3.football.api-sports.io/teams/statistics?team=${teamId}&league=${leagueId}&season=${season}`, null, 7000); // v26.255: expliciet, past binnen het ruimere wt-venster
    const d = await r.json();
    return d.response || null;
  } catch(e) { return null; }
}

async function fetchLineups(fixtureId) {
  if (!fixtureId) return null;
  try {
    const r = await apiFetch(`https://v3.football.api-sports.io/fixtures/lineups?fixture=${fixtureId}`, null, 5000);
    const d = await r.json();
    return d.response?.length ? d.response : null;
  } catch(e) { return null; }
}

async function fetchTopScorers(leagueId) {
  if (!leagueId) return null;
  try {
    const season = seasonForLeague(leagueId);
    const r = await apiFetch(`https://v3.football.api-sports.io/players/topscorers?league=${leagueId}&season=${season}`, null, 5000);
    const d = await r.json();
    return d.response?.slice(0, 10) || null;
  } catch(e) { return null; }
}

// ── Standings ophalen ────────────────────────────────────
async function fetchStandings(leagueId, _unused) {
  if (!leagueId) return null;
  try {
    const season = seasonForLeague(leagueId);
    const r = await apiFetch(`https://v3.football.api-sports.io/standings?league=${leagueId}&season=${season}`, null, 6000);
    const d = await r.json();
    return d.response?.[0]?.league?.standings?.[0] || null;
  } catch(e) { return null; }
}

// ── Injuries/suspensions ophalen ────────────────────────
async function fetchInjuries(fixtureId) {
  if (!fixtureId) return null;
  try {
    const r = await apiFetch(`https://v3.football.api-sports.io/injuries?fixture=${fixtureId}`, null, 5000);
    const d = await r.json();
    return d.response?.length ? d.response : null;
  } catch(e) { return null; }
}

// ── API-Football Predictions ophalen (pro endpoint) ─────
async function fetchPredictions(fixtureId) {
  if (!fixtureId) return null;
  try {
    const r = await apiFetch(`https://v3.football.api-sports.io/predictions?fixture=${fixtureId}`, null, 6000);
    const d = await r.json();
    const pred = d.response?.[0];
    if (!pred) return null;
    // v26.299: 0-behoudende int-parse. parseInt("0%")||null gooide een echte 0% weg (0 is falsy) ->
    // percent.away werd null bij een 50/50/0-predictie, en de STATS-referentieregel toonde "50%/50%/null%".
    // Bug-familie v26.266, maar dat fixte de CONSUMENT (formatPredictions); de 0 verdween al hier, bij de BRON.
    const _pctInt = (v) => { const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
    // Verwerk naar bruikbaar object
    return {
      winner:       pred.predictions?.winner?.name || null,
      winnerComment: pred.predictions?.winner?.comment || null,
      advice:       pred.predictions?.advice || null,
      percent: {
        home: _pctInt(pred.predictions?.percent?.home),
        draw: _pctInt(pred.predictions?.percent?.draw),
        away: _pctInt(pred.predictions?.percent?.away),
      },
      goalsHome:    pred.predictions?.goals?.home || null,
      goalsAway:    pred.predictions?.goals?.away || null,
      under_over:   pred.predictions?.under_over || null,
      form: {
        home: pred.teams?.home?.league?.form || null,
        away: pred.teams?.away?.league?.form || null,
      },
      homeAttack:   pred.teams?.home?.league?.goals?.for?.average?.total || null,
      homeDefense:  pred.teams?.home?.league?.goals?.against?.average?.total || null,
      awayAttack:   pred.teams?.away?.league?.goals?.for?.average?.total || null,
      awayDefense:  pred.teams?.away?.league?.goals?.against?.average?.total || null,
      h2h: {
        home: pred.h2h ? pred.h2h.filter(f => f.teams?.home?.winner).length : null,
        draw: pred.h2h ? pred.h2h.filter(f => !f.teams?.home?.winner && !f.teams?.away?.winner).length : null,
        away: pred.h2h ? pred.h2h.filter(f => f.teams?.away?.winner).length : null,
        total: pred.h2h?.length || null,
      },
      comparison: {
        form:          pred.comparison?.form         || null,
        att:           pred.comparison?.att          || null,
        def:           pred.comparison?.def          || null,
        poisson_distribution: pred.comparison?.poisson_distribution || null,
        h2h:           pred.comparison?.h2h          || null,
        goals:         pred.comparison?.goals        || null,
        total:         pred.comparison?.total        || null,
      },
      raw: pred
    };
  } catch(e) { return null; }
}

// ── Predictions formatteren voor AI context ─────────────
function formatPredictions(pred, home, away) {
  if (!pred) return '';
  const lines = [];

  if (pred.advice) lines.push(`💡 API advies: "${pred.advice}"`);

  // v26.266: `pred.percent?.home !== null` was ALTIJD waar (ontbreekt percent, dan is het undefined,
  // en undefined !== null). De regels eronder dereferencen pred.percent zonder ?. -> TypeError.
  // Bovendien gooide `|| 0` een legitieme 0% weg (API geeft die echt: 50/50/0).
  if (pred.percent && pred.percent.home != null) {
    const h = pred.percent.home ?? 0;
    const d = pred.percent.draw ?? 0;
    const a = pred.percent.away ?? 0;
    lines.push(`📊 API kansen: ${home} ${h}% / gelijk ${d}% / ${away} ${a}%`);
  }

  if (pred.winner) {
    lines.push(`🏆 API winnaar tip: ${pred.winner}${pred.winnerComment ? ' ('+pred.winnerComment+')' : ''}`);
  }

  if (pred.goalsHome !== null && pred.goalsAway !== null) {
    lines.push(`⚽ Verwachte doelpunten: ${home} ${pred.goalsHome} – ${away} ${pred.goalsAway}${pred.under_over ? ' ('+pred.under_over+')' : ''}`);
  }

  if (pred.comparison?.form) {
    lines.push(`📈 Vorm vergelijk: ${home} ${pred.comparison.form.home} vs ${away} ${pred.comparison.form.away}`);
  }
  if (pred.comparison?.att && pred.comparison?.def) {
    lines.push(`⚔️ Aanval/verdediging: att ${pred.comparison.att.home}/${pred.comparison.att.away} – def ${pred.comparison.def.home}/${pred.comparison.def.away}`);
  }
  if (pred.comparison?.poisson_distribution) {
    lines.push(`📐 Poisson (API): ${pred.comparison.poisson_distribution.home} / ${pred.comparison.poisson_distribution.away}`);
  }

  if (pred.h2h?.total) {
    lines.push(`🔁 H2H (API): ${pred.h2h.total} duels — ${home} ${pred.h2h.home}W / gelijk ${pred.h2h.draw} / ${away} ${pred.h2h.away}W`);
  }

  return lines.join('\n');
}

// v26.245: vorm-fallback uit predictions. Als de aparte fixtures-vormcall (team=&last=) time-out'te,
// bevat het predictions-object (1 call, altijd beide teams) alsnog de recente vorm — zo krijgt de
// uit-ploeg niet ten onrechte "geen vormdata". side = 'home' | 'away'.
function formFromPred(pred, side) {
  if (!pred) return '';
  const f = (pred.form?.[side] || '').slice(-5);            // laatste 5, bv. "DWWWW"
  const l5 = pred.raw?.teams?.[side]?.last_5?.goals;        // {for:{total}, against:{total}}
  const gf = l5?.for?.total, ga = l5?.against?.total;
  const parts = [];
  if (f) parts.push(f);
  if (gf != null && ga != null) parts.push(`${gf} voor / ${ga} tegen (laatste 5)`);
  return parts.join(' \u00b7 ');
}

