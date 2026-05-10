// TOTO AI WORKER v40 FINAL STABLE

const VERSION = 'v40 FINAL STABLE';

const FB_DB = 'https://toto-ai-397cb-default-rtdb.europe-west1.firebasedatabase.app';

const CONFIG = {
  minEdge: 3,
  minRisk: 65,
  maxAiMatches: 25,
  historyLimit: 5000
};

// ================= FIREBASE =================

async function fb(env, path, method = 'GET', body = null) {
  try {
    const res = await fetch(`${FB_DB}/${path}.json?auth=${env.FB_API_KEY}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : null
    });
    return await res.json();
  } catch (e) {
    console.error('FB error', e);
    return null;
  }
}

// ================= CORE =================

function edge(prob, odds) {
  return prob - (100 / odds);
}

function risk(e, vol) {
  return Math.min(100, Math.abs(vol - e * 10));
}

// ================= AI BATCH =================

async function aiBatch(matches, env) {

  const prompt = `Geef alleen JSON array met kansen (0-100):\n${JSON.stringify(matches)}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await res.json();
    const text = data?.content?.[0]?.text || '[]';

    const match = text.match(/\[.*\]/s);
    return match ? JSON.parse(match[0]) : [];

  } catch (e) {
    console.error('AI error', e);
    return [];
  }
}

// ================= PREFILTER =================

function preFilter(m) {
  const implied = 100 / (m.odds || 2);
  return (50 - implied) >= 2;
}

// ================= AUDIT =================

function audit(p, stats) {

  const vol = stats?.leagues?.[p.leagueId]?.vol || 10;

  const e = edge(p.kans, p.odds);
  const r = risk(e, vol);

  return {
    ok: (e > CONFIG.minEdge && r < CONFIG.minRisk),
    edge: e,
    risk: r
  };
}

// ================= SCAN =================

async function runScan(env) {

  const fixtures = await fetch('https://api-football-v1.p.rapidapi.com/v3/odds', {
    headers: { 'x-rapidapi-key': env.API_FOOTBALL }
  }).then(r => r.json()).catch(() => null);

  let stats = await fb(env, 'stats') || {};

  const raw = [];

  for (const f of fixtures?.response || []) {

    const m = {
      fixtureId: f.fixture?.id,
      home: f.teams?.home?.name,
      away: f.teams?.away?.name,
      odds: f.odds?.home || 2,
      leagueId: f.league?.id
    };

    if (preFilter(m)) raw.push(m);
  }

  const aiInput = raw.slice(0, CONFIG.maxAiMatches);
  const aiRes = await aiBatch(aiInput, env);

  const picks = {};

  for (let i = 0; i < aiRes.length; i++) {

    const m = aiInput[i];
    const kans = aiRes[i] || 50;

    const pick = {
      fixtureId: m.fixtureId,
      home: m.home,
      away: m.away,
      odds: m.odds,
      kans,
      leagueId: m.leagueId,
      betType: 'HOME',
      processed: false,
      createdAt: new Date().toISOString()
    };

    const result = audit(pick, stats);

    if (result.ok) {
      picks[pick.fixtureId] = {
        ...pick,
        audit: result
      };
    }
  }

  const existing = await fb(env, 'picks') || {};
  await fb(env, 'picks', 'PUT', { ...existing, ...picks });
}

// ================= SETTLE =================

async function runSettle(env) {

  let picks = await fb(env, 'picks') || {};
  let stats = await fb(env, 'stats') || {};

  const results = await fetch('https://api-football-v1.p.rapidapi.com/v3/fixtures?status=FT', {
    headers: { 'x-rapidapi-key': env.API_FOOTBALL }
  }).then(r => r.json()).catch(() => null);

  if (!stats.history) stats.history = [];
  if (!stats.leagues) stats.leagues = {};

  for (const r of results?.response || []) {

    const pick = picks[r.fixture.id];
    if (!pick || pick.processed) continue;

    const home = r.teams.home.goals;
    const away = r.teams.away.goals;

    let win = false;
    if (pick.betType === 'HOME' && home > away) win = true;

    const profit = win ? (pick.odds - 1) : -1;

    const lid = pick.leagueId;

    if (!stats.leagues[lid]) {
      stats.leagues[lid] = { bets: 0, wins: 0, losses: 0, roi: 0, vol: 10 };
    }

    stats.leagues[lid].bets++;
    win ? stats.leagues[lid].wins++ : stats.leagues[lid].losses++;
    stats.leagues[lid].roi += profit;

    stats.history.push({
      fixtureId: pick.fixtureId,
      leagueId: lid,
      win,
      profit,
      odds: pick.odds,
      kans: pick.kans
    });

    pick.processed = true;
  }

  // HISTORY LIMIT
  if (stats.history.length > CONFIG.historyLimit) {
    stats.history = stats.history.slice(-CONFIG.historyLimit);
  }

  await fb(env, 'stats', 'PUT', stats);
  await fb(env, 'picks', 'PUT', picks);
}

// ================= EXPORT =================

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScan(env));
    ctx.waitUntil(runSettle(env));
  },

  async fetch(req) {
    return new Response(JSON.stringify({
      version: VERSION,
      status: 'running'
    }));
  }
};