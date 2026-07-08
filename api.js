// ═══════════════════════════════════════════════════════
// API.JS — Worker proxy + Football API + Anthropic
// ═══════════════════════════════════════════════════════

const WORKER = 'https://api.promatchxi.app';

const COMP_IDS = {
  eredivisie: 88, kkd: 89, bundesliga: 78, premier: 39,
  oefennl: 667, // Friendlies Clubs (gefilterd op NL-clubs)
  beker: 90, champions: 2, ligue1: 61, seriea: 135, nations: 5, wk2026: 1,
  jupiler: 144, laliga: 140, championship: 40, bundesliga2: 79, superlig: 203,
  // Extra voor scan coverage
  portugal: 94,        // Primeira Liga Portugal
  scotland: 179,       // Scottish Premiership
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
  const backoffs = [2000, 4000, 6000]; // ms; 1e poging + 3 retries (vangt langere refresh-bursts)
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
      await new Promise(res => setTimeout(res, backoffs[attempt]));
      continue;
    }

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
    const r = await apiFetch(`https://v3.football.api-sports.io/teams/statistics?team=${teamId}&league=${leagueId}&season=${season}`, null);
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
    // Verwerk naar bruikbaar object
    return {
      winner:       pred.predictions?.winner?.name || null,
      winnerComment: pred.predictions?.winner?.comment || null,
      advice:       pred.predictions?.advice || null,
      percent: {
        home: parseInt(pred.predictions?.percent?.home) || null,
        draw: parseInt(pred.predictions?.percent?.draw) || null,
        away: parseInt(pred.predictions?.percent?.away) || null,
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

  if (pred.percent?.home !== null) {
    const h = pred.percent.home || 0;
    const d = pred.percent.draw || 0;
    const a = pred.percent.away || 0;
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
