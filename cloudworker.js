// TOTO AI WORKER v43
// Proxy + scheduled value scan

const VERSION = 'v43';
const FB_DB = 'https://toto-ai-397cb-default-rtdb.europe-west1.firebasedatabase.app';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key, anthropic-version',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS }
  });
}

// ── Firebase helper ──────────────────────────────────────
async function fb(env, path, method = 'GET', body = null) {
  try {
    const res = await fetch(`${FB_DB}/${path}.json?auth=${env.FB_API_KEY}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : null
    });
    return await res.json();
  } catch(e) {
    console.error('FB error', e);
    return null;
  }
}

// ── API-Football proxy (/apif/*) ─────────────────────────
async function handleAPIFootball(path, env) {
  const url = 'https://v3.football.api-sports.io' + path;
  const headers = {
    'x-apisports-key': env.FOOTBALL_KEY,
    'x-rapidapi-key':  env.FOOTBALL_KEY,
    'x-rapidapi-host': 'v3.football.api-sports.io',
  };
  const res = await fetch(url, { headers });
  const data = await res.json();
  return json(data);
}

// ── Football-data.org proxy (/fd/*) ──────────────────────
async function handleFD(path, env) {
  const url = 'https://api.football-data.org' + path;
  const res = await fetch(url, {
    headers: { 'X-Auth-Token': env.FD_KEY || '' }
  });
  const data = await res.json();
  return json(data);
}

// ── Anthropic proxy (/anthropic) ────────────────────────
async function handleAnthropic(request, env) {
  const body = await request.text();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body
  });
  const data = await res.json();
  return json(data, res.status);
}

// ── Generic URL proxy (?url=...) ────────────────────────
async function handleProxy(urlParam, request, env) {
  const targetUrl = decodeURIComponent(urlParam);
  const isAnthropic = targetUrl.includes('api.anthropic.com');
  const headers = { 'Content-Type': 'application/json' };
  if (isAnthropic) {
    headers['x-api-key'] = env.ANTHROPIC_KEY;
    headers['anthropic-version'] = '2023-06-01';
  }
  const init = {
    method: request.method,
    headers,
  };
  if (request.method !== 'GET') {
    init.body = await request.text();
  }
  const res = await fetch(targetUrl, init);
  const data = await res.text();
  return new Response(data, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/json',
      ...CORS
    }
  });
}

// ── Scheduled value scan ─────────────────────────────────
async function runScan(env) {
  // Haal wedstrijden van vandaag op
  const today = new Date().toISOString().split('T')[0];
  const competities = [88, 94, 39, 78, 61, 135, 140, 2, 1]; // Eredivisie, KKD, PL, Bundesliga, Ligue1, SerieA, LaLiga, CL, WC

  let allMatches = [];

  for (const leagueId of competities) {
    try {
      const res = await fetch(
        `https://v3.football.api-sports.io/fixtures?league=${leagueId}&date=${today}`,
        {
          headers: {
            'x-apisports-key': env.FOOTBALL_KEY,
            'x-rapidapi-key':  env.FOOTBALL_KEY,
          }
        }
      );
      const data = await res.json();
      const matches = (data.response || []).map(f => ({
        fixtureId: f.fixture?.id,
        home:      f.teams?.home?.name,
        away:      f.teams?.away?.name,
        leagueId,
        odds:      null
      }));
      allMatches = allMatches.concat(matches);
    } catch(e) {}
  }

  if (!allMatches.length) return;

  // AI batch analyse
  const batch = allMatches.slice(0, 25);
  const prompt = `Analyseer deze voetbalwedstrijden en geef voor elke wedstrijd een kans (0-100) dat de thuisploeg wint. Antwoord ALLEEN met een JSON array van getallen:\n${JSON.stringify(batch.map((m,i) => `${i+1}. ${m.home} vs ${m.away}`))}`;

  let aiKansen = [];
  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const aiData = await aiRes.json();
    const text = aiData?.content?.[0]?.text || '[]';
    const match = text.match(/\[[\d,\s.]+\]/);
    if (match) aiKansen = JSON.parse(match[0]);
  } catch(e) {}

  // Bouw picks
  const picks = {};
  batch.forEach((m, i) => {
    const kans = aiKansen[i] || 50;
    const impliedOdds = 100 / Math.max(kans, 1);
    const value = kans - 50; // simpele value estimate
    if (value >= 5) {
      picks[m.fixtureId] = {
        ...m, kans, value,
        betType: '1',
        createdAt: new Date().toISOString(),
        processed: false
      };
    }
  });

  if (Object.keys(picks).length) {
    const existing = await fb(env, 'picks') || {};
    await fb(env, 'picks', 'PUT', { ...existing, ...picks });
  }
}

// ── Settle afgeronde bets ────────────────────────────────
async function runSettle(env) {
  let picks = await fb(env, 'picks') || {};
  let stats = await fb(env, 'stats') || { history: [], leagues: {} };

  const results = await fetch(
    'https://v3.football.api-sports.io/fixtures?status=FT&date=' + new Date().toISOString().split('T')[0],
    { headers: { 'x-apisports-key': env.FOOTBALL_KEY } }
  ).then(r => r.json()).catch(() => null);

  let changed = false;
  for (const r of results?.response || []) {
    const pick = picks[r.fixture.id];
    if (!pick || pick.processed) continue;

    const home = r.goals?.home ?? 0;
    const away = r.goals?.away ?? 0;
    const win = pick.betType === '1' ? home > away : away > home;
    const profit = win ? (2 - 1) : -1; // odds 2.0 als fallback

    const lid = pick.leagueId;
    if (!stats.leagues[lid]) stats.leagues[lid] = { bets:0, wins:0, losses:0, roi:0 };
    stats.leagues[lid].bets++;
    win ? stats.leagues[lid].wins++ : stats.leagues[lid].losses++;
    stats.leagues[lid].roi += profit;

    if (!stats.history) stats.history = [];
    stats.history.push({ fixtureId: pick.fixtureId, leagueId: lid, win, profit, kans: pick.kans });
    if (stats.history.length > 5000) stats.history = stats.history.slice(-5000);

    pick.processed = true;
    changed = true;
  }

  if (changed) {
    await fb(env, 'stats', 'PUT', stats);
    await fb(env, 'picks', 'PUT', picks);
  }
}

// ── Main fetch handler ───────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    // Routes
    if (path.startsWith('/apif/') || path.startsWith('/apif?')) {
      const apiPath = path.replace('/apif', '') + (url.search || '');
      return handleAPIFootball(apiPath, env);
    }

    if (path.startsWith('/fd/') || path.startsWith('/fd?')) {
      const fdPath = path.replace('/fd', '') + (url.search || '');
      return handleFD(fdPath, env);
    }

    if (path === '/anthropic') {
      return handleAnthropic(request, env);
    }

    if (url.searchParams.get('url')) {
      return handleProxy(url.searchParams.get('url'), request, env);
    }

    // Status
    return json({ version: VERSION, status: 'running', routes: ['/apif/*', '/fd/*', '/anthropic', '?url='] });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScan(env));
    ctx.waitUntil(runSettle(env));
  }
};
