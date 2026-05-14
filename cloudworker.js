// TOTO AI WORKER v45
// Proxy + scheduled value scan

const VERSION = 'v45';
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
  const key = env.FOOTBALL_KEY || '';
  // Probeer beide API hosts (RapidAPI + directe API-Sports)
  const hosts = [
    {
      url: 'https://v3.football.api-sports.io' + path,
      headers: {
        'x-apisports-key': key,
      }
    },
    {
      url: 'https://api-football-v1.p.rapidapi.com/v3' + path,
      headers: {
        'x-rapidapi-key': key,
        'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
      }
    }
  ];

  for (const host of hosts) {
    try {
      const res = await fetch(host.url, { headers: host.headers });
      const data = await res.json();
      // Check of er een token/key error is
      if (data.errors && (data.errors.token || data.errors.key)) {
        continue; // Probeer volgende host
      }
      return json(data);
    } catch(e) {
      continue;
    }
  }
  return json({ errors: { token: 'No valid API key' }, response: [] }, 401);
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
  const init = { method: request.method, headers };
  if (request.method !== 'GET') init.body = await request.text();
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
  const today = new Date().toISOString().split('T')[0];
  const competities = [88, 94, 39, 78, 61, 135, 140, 2, 1];
  let allMatches = [];

  for (const leagueId of competities) {
    try {
      const key = env.FOOTBALL_KEY || '';
      // Probeer beide hosts
      let data = null;
      try {
        const r1 = await fetch(
          `https://v3.football.api-sports.io/fixtures?league=${leagueId}&date=${today}`,
          { headers: { 'x-apisports-key': key } }
        );
        data = await r1.json();
        if (data.errors?.token) throw new Error('invalid key');
      } catch(e) {
        const r2 = await fetch(
          `https://api-football-v1.p.rapidapi.com/v3/fixtures?league=${leagueId}&date=${today}`,
          { headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': 'api-football-v1.p.rapidapi.com' } }
        );
        data = await r2.json();
      }
      const matches = (data.response || []).map(f => ({
        fixtureId: f.fixture?.id,
        home: f.teams?.home?.name,
        away: f.teams?.away?.name,
        leagueId,
        odds: null
      }));
      allMatches = allMatches.concat(matches);
    } catch(e) {}
  }

  if (!allMatches.length) return;

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
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const aiData = await aiRes.json();
    const text = aiData?.content?.[0]?.text || '[]';
    const match = text.match(/\[[\d,\s.]+\]/);
    if (match) aiKansen = JSON.parse(match[0]);
  } catch(e) {}

  const picks = {};
  batch.forEach((m, i) => {
    const kans = aiKansen[i] || 50;
    const value = kans - 50;
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

// ── Main fetch handler ───────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

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

    return json({ version: VERSION, status: 'running', routes: ['/apif/*', '/fd/*', '/anthropic', '?url='] });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScan(env));
  }
};
