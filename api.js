// ═══════════════════════════════════════════════════════
// API.JS — Worker proxy + Football API + Anthropic
// ═══════════════════════════════════════════════════════

const WORKER = 'https://toto-proxy.zweetzakken.workers.dev';

const COMP_IDS = {
  eredivisie: 88, kkd: 89, bundesliga: 78, premier: 39,
  beker: 90, champions: 2, ligue1: 61, seriea: 135, nations: 5, wk2026: 1,
  jupiler: 144, laliga: 140, championship: 40, bundesliga2: 79, superlig: 203,
};

const COMP_NAMES = {
  eredivisie: '🇳🇱 Eredivisie', kkd: '🇳🇱 Keuken Kampioen', bundesliga: '🇩🇪 Bundesliga',
  premier: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League', beker: '🏆 KNVB Beker', champions: '⭐ Champions League',
  ligue1: '🇫🇷 Ligue 1', seriea: '🇮🇹 Serie A', nations: '🌍 Nations League',
  jupiler: '🇧🇪 Jupiler Pro League', laliga: '🇪🇸 La Liga', championship: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship',
  bundesliga2: '🇩🇪 2. Bundesliga', superlig: '🇹🇷 Süper Lig', wk2026: '🏆 WK 2026'
};

const FD_CODES = {
  eredivisie: 'DED', kkd: null, bundesliga: 'BL1', premier: 'PL',
  beker: 'KBR', champions: 'CL', ligue1: 'FL1', seriea: 'SA', nations: null
};

// ── API-Football via Worker /apif/* ─────────────────────
async function apiFetch(url, _apiKey, timeoutMs = 10000) {
  const apiPath = url.replace('https://v3.football.api-sports.io', '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(`${WORKER}/apif${apiPath}`, { signal: controller.signal });
    clearTimeout(timer);
    return r;
  } catch(e) { clearTimeout(timer); throw e; }
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

// ── Anthropic via Worker /anthropic ─────────────────────
async function anthropicFetchWithRetry(_apiKey, body, maxRetries = 3) {
  if (_apiKey && typeof _apiKey === 'object' && !body) { body = _apiKey; _apiKey = null; }
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const data = await anthropicFetch(null, body);
      if (data.error?.type === 'overloaded_error' && i < maxRetries) {
        const wait = 15000 + i * 15000;
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      return data;
    } catch(e) {
      if (i === maxRetries) throw e;
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

async function anthropicFetch(_apiKey, body) {
  if (_apiKey && typeof _apiKey === 'object' && !body) { body = _apiKey; }
  if (!body || typeof body !== 'object') throw new Error('Geen geldig body object');
  const timeoutMs = (body.max_tokens || 1000) >= 1500 ? 90000 : 45000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(`${WORKER}/anthropic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timer);
    const txt = await r.text();
    try {
      const parsed = JSON.parse(txt);
      if (parsed.usage) trackTokenUsage(parsed.usage, body.model || 'claude-haiku-4-5-20251001');
      return parsed;
    } catch(e) {
      throw new Error('Worker response: ' + txt.substring(0, 100));
    }
  } catch(e) {
    clearTimeout(timer);
    const key = state.settings?.anthropicKey || '';
    const r2 = await fetch(`${WORKER}?url=${encodeURIComponent('https://api.anthropic.com/v1/messages')}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? {'x-api-key': key, 'anthropic-version': '2023-06-01',
                   'anthropic-dangerous-direct-browser-access': 'true'} : {})
      },
      body: JSON.stringify(body)
    });
    return await r2.json();
  }
}

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
  const isLive = ['1H','HT','2H','ET','BT','P','INT','LIVE'].includes(fix.status?.short);
  const isDone = ['FT','AET','PEN'].includes(fix.status?.short);
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
    isLive, isDone,
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
  if (comp === 'wk2026') return 2026;
  return 2025;
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
    const season = leagueId === 1 ? 2026 : 2025;
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
    const season = leagueId === 1 ? 2026 : 2025;
    const r = await apiFetch(`https://v3.football.api-sports.io/players/topscorers?league=${leagueId}&season=${season}`, null, 5000);
    const d = await r.json();
    return d.response?.slice(0, 10) || null;
  } catch(e) { return null; }
}
