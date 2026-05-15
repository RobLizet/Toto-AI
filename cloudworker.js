// TOTO AI WORKER v46
// Verbeteringen:
// - Odds ophalen via API-Football voor echte value berekening
// - AI prompt uitgebreid met odds + context
// - Auto-verificatie: picks van gisteren automatisch checken
// - Lock detectie tijdsstempel opgeslagen
// - Retry mechanisme bij API fouten

const VERSION = 'v46';
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

// ── Fetch met retry ──────────────────────────────────────
async function fetchWithRetry(url, options, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (i === retries) return res;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    } catch(e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

// ── API-Football helper ──────────────────────────────────
async function apif(path, env) {
  const key = env.FOOTBALL_KEY || '';
  const hosts = [
    {
      url: 'https://v3.football.api-sports.io' + path,
      headers: { 'x-apisports-key': key }
    },
    {
      url: 'https://api-football-v1.p.rapidapi.com/v3' + path,
      headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': 'api-football-v1.p.rapidapi.com' }
    }
  ];
  for (const host of hosts) {
    try {
      const res = await fetchWithRetry(host.url, { headers: host.headers });
      const data = await res.json();
      if (data.errors?.token || data.errors?.key) continue;
      return data.response || [];
    } catch(e) { continue; }
  }
  return [];
}

// ── API-Football proxy (/apif/*) ─────────────────────────
async function handleAPIFootball(path, env) {
  const key = env.FOOTBALL_KEY || '';
  const hosts = [
    {
      url: 'https://v3.football.api-sports.io' + path,
      headers: { 'x-apisports-key': key }
    },
    {
      url: 'https://api-football-v1.p.rapidapi.com/v3' + path,
      headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': 'api-football-v1.p.rapidapi.com' }
    }
  ];
  for (const host of hosts) {
    try {
      const res = await fetchWithRetry(host.url, { headers: host.headers });
      const data = await res.json();
      if (data.errors?.token || data.errors?.key) continue;
      return json(data);
    } catch(e) { continue; }
  }
  return json({ errors: { token: 'No valid API key' }, response: [] }, 401);
}

// ── Football-data.org proxy (/fd/*) ──────────────────────
async function handleFD(path, env) {
  const url = 'https://api.football-data.org' + path;
  const res = await fetchWithRetry(url, {
    headers: { 'X-Auth-Token': env.FD_KEY || '' }
  });
  const data = await res.json();
  return json(data);
}

// ── Anthropic proxy (/anthropic) ────────────────────────
async function handleAnthropic(request, env) {
  const body = await request.text();
  const res = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
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
  const res = await fetchWithRetry(targetUrl, init);
  const data = await res.text();
  return new Response(data, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/json',
      ...CORS
    }
  });
}

// ── Odds ophalen voor wedstrijden ────────────────────────
async function fetchOddsForFixtures(fixtureIds, env) {
  const oddsMap = {};
  // Batch per 10 fixtures
  const batches = [];
  for (let i = 0; i < fixtureIds.length; i += 10) {
    batches.push(fixtureIds.slice(i, i + 10));
  }
  for (const batch of batches) {
    try {
      const results = await Promise.all(
        batch.map(id => apif(`/odds?fixture=${id}&bookmaker=8&bet=1`, env))
      );
      results.forEach((data, idx) => {
        const fid = batch[idx];
        if (!data || !data.length) return;
        const bookmakers = data[0]?.bookmakers || [];
        const bm = bookmakers[0];
        if (!bm) return;
        const bet = bm.bets?.find(b => b.id === 1); // 1X2
        if (!bet) return;
        const home = parseFloat(bet.values?.find(v => v.value === 'Home')?.odd || 0);
        const draw = parseFloat(bet.values?.find(v => v.value === 'Draw')?.odd || 0);
        const away = parseFloat(bet.values?.find(v => v.value === 'Away')?.odd || 0);
        if (home > 1) oddsMap[fid] = { home, draw, away };
      });
    } catch(e) {}
  }
  return oddsMap;
}

// ── Poisson value berekening ─────────────────────────────
function impliedProb(odds) {
  if (!odds || odds <= 1) return 0;
  return 1 / odds;
}

function calculateValue(aiKans, bookOdds, pick) {
  if (!bookOdds || bookOdds <= 1) return 0;
  const aiProb = aiKans / 100;
  const implProb = impliedProb(bookOdds);
  // Value = (AI kans / implied kans) - 1, als percentage
  const value = ((aiProb / implProb) - 1) * 100;
  return parseFloat(value.toFixed(1));
}

// ── Auto-verificatie: picks van gisteren checken ─────────
async function verifyYesterdayPicks(env) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  // Haal bestaande picks op uit Firebase
  const picks = await fb(env, 'picks') || {};
  const toVerify = Object.entries(picks).filter(([id, p]) =>
    p.matchDate === dateStr && p.processed === false && p.status === 'pending'
  );

  if (!toVerify.length) return;

  // Haal resultaten op
  const fixtures = await apif(`/fixtures?date=${dateStr}&status=FT`, env);
  if (!fixtures.length) return;

  const resultMap = {};
  fixtures.forEach(f => {
    resultMap[f.fixture.id] = {
      home: f.goals.home ?? 0,
      away: f.goals.away ?? 0,
      status: f.fixture.status.short
    };
  });

  let updated = 0;
  for (const [id, pick] of toVerify) {
    const result = resultMap[pick.fixtureId];
    if (!result) continue;
    const hg = result.home, ag = result.away;
    let won = false;
    const p = pick.betType || pick.pick || '1';
    if (p === '1') won = hg > ag;
    else if (p === '2') won = ag > hg;
    else if (p === 'X') won = hg === ag;
    else if (p === 'O2.5') won = (hg + ag) > 2.5;
    else if (p === 'U2.5') won = (hg + ag) < 2.5;
    else if (p === 'BTTS-J') won = hg > 0 && ag > 0;

    picks[id] = {
      ...pick,
      score: `${hg}-${ag}`,
      status: won ? 'win' : 'lose',
      processed: true,
      verifiedAt: new Date().toISOString()
    };
    updated++;
  }

  if (updated > 0) {
    await fb(env, 'picks', 'PUT', picks);
    console.log(`[Verify] ${updated} picks geverifieerd voor ${dateStr}`);
  }
}

// ── Scheduled value scan ─────────────────────────────────
async function runScan(env) {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const hour = now.getUTCHours() + 1; // CET = UTC+1 (of +2 zomer)

  // Alleen scannen tussen 08:00 en 20:00 CET
  if (hour < 8 || hour >= 20) {
    console.log(`[Scan] Buiten scanvenster (${hour}:00 CET), skip`);
    return;
  }

  const competities = [88, 94, 39, 78, 61, 135, 140, 2, 1];
  let allMatches = [];

  // Haal wedstrijden op per competitie
  for (const leagueId of competities) {
    try {
      const fixtures = await apif(`/fixtures?league=${leagueId}&date=${today}`, env);
      const matches = fixtures
        .filter(f => !['FT','AET','PEN','CANC','ABD'].includes(f.fixture?.status?.short))
        .map(f => ({
          fixtureId: f.fixture?.id,
          home: f.teams?.home?.name,
          away: f.teams?.away?.name,
          matchDate: today,
          matchTime: f.fixture?.date,
          leagueId,
          leagueName: f.league?.name || '',
          venue: f.fixture?.venue?.name || '',
        }));
      allMatches = allMatches.concat(matches);
    } catch(e) {
      console.error(`[Scan] Fout bij league ${leagueId}:`, e);
    }
  }

  if (!allMatches.length) {
    console.log('[Scan] Geen wedstrijden gevonden voor vandaag');
    return;
  }

  // Sorteer: wedstrijden die nog niet begonnen zijn prioriteit
  allMatches.sort((a, b) => {
    const ta = new Date(a.matchTime || 0).getTime();
    const tb = new Date(b.matchTime || 0).getTime();
    return ta - tb;
  });

  // Max 40 wedstrijden (meer dan v45)
  const batch = allMatches.slice(0, 40);
  console.log(`[Scan] ${batch.length} wedstrijden gevonden, odds ophalen...`);

  // Odds ophalen
  const fixtureIds = batch.map(m => m.fixtureId).filter(Boolean);
  const oddsMap = await fetchOddsForFixtures(fixtureIds, env);
  console.log(`[Scan] Odds gevonden voor ${Object.keys(oddsMap).length} wedstrijden`);

  // Alleen wedstrijden met odds meenemen in AI analyse
  const withOdds = batch.filter(m => oddsMap[m.fixtureId]);
  const withoutOdds = batch.filter(m => !oddsMap[m.fixtureId]);

  // AI analyse — met odds voor betere value berekening
  const analyseBatch = withOdds.length > 0 ? withOdds : batch;
  const prompt = `Je bent een voetbalanalyst. Analyseer deze ${analyseBatch.length} wedstrijden en geef voor ELKE wedstrijd:
1. Kans thuisploeg wint (0-100)
2. Kans gelijkspel (0-100)  
3. Kans uitploeg wint (0-100)
4. Confidence in analyse (1-10)

Houd rekening met: recente vorm, historische H2H, thuisvoordeel, competitieniveau.

Wedstrijden:
${analyseBatch.map((m, i) => {
  const odds = oddsMap[m.fixtureId];
  const oddsStr = odds ? ` | Odds: ${odds.home}/${odds.draw}/${odds.away}` : '';
  return `${i+1}. ${m.home} vs ${m.away} (${m.leagueName})${oddsStr}`;
}).join('\n')}

Antwoord ALLEEN met een JSON array, elk object: {"h":50,"x":25,"a":25,"c":7}
Geen uitleg, alleen de JSON array.`;

  let aiResults = [];
  try {
    const aiRes = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const aiData = await aiRes.json();
    const text = aiData?.content?.[0]?.text || '[]';
    // Parse JSON array uit response
    const match = text.match(/\[[\s\S]*?\]/);
    if (match) {
      aiResults = JSON.parse(match[0]);
    }
  } catch(e) {
    console.error('[Scan] AI fout:', e);
  }

  // Value berekenen en picks opslaan
  const newPicks = {};
  const existingPicks = await fb(env, 'picks') || {};

  analyseBatch.forEach((m, i) => {
    const ai = aiResults[i] || { h: 50, x: 25, a: 25, c: 5 };
    const odds = oddsMap[m.fixtureId] || {};
    const confidence = parseInt(ai.c) || 5;

    // Bereken value voor 1, X, 2
    const candidates = [
      { pick: '1', label: `${m.home} wint`, aiKans: ai.h, bookOdds: odds.home },
      { pick: 'X', label: 'Gelijkspel',     aiKans: ai.x, bookOdds: odds.draw },
      { pick: '2', label: `${m.away} wint`, aiKans: ai.a, bookOdds: odds.away },
    ];

    candidates.forEach(c => {
      if (!c.bookOdds || c.bookOdds <= 1) return;
      const value = calculateValue(c.aiKans, c.bookOdds, c.pick);
      if (value < 5 || confidence < 7) return; // Alleen value >= 5% en confidence >= 7

      const pickKey = `${m.fixtureId}_${c.pick}`;

      // Lock level: tel hoeveel keer dezelfde pick al gevonden is vandaag
      const existing = existingPicks[pickKey];
      const scanCount = existing ? (existing.scanCount || 1) + 1 : 1;
      const lockLevel = scanCount >= 3 ? 'triple' : scanCount >= 2 ? 'double' : 'single';

      // Alleen opslaan als nieuwe pick of bestaande met hogere value
      if (!existing || value > (existing.value || 0) || scanCount > (existing.scanCount || 0)) {
        newPicks[pickKey] = {
          fixtureId: m.fixtureId,
          home: m.home,
          away: m.away,
          matchName: `${m.home} vs ${m.away}`,
          matchDate: today,
          matchTime: m.matchTime,
          leagueId: m.leagueId,
          leagueName: m.leagueName,
          pick: c.pick,
          pickLabel: c.label,
          odds: c.bookOdds,
          value: parseFloat(value.toFixed(1)),
          aiKans: Math.round(c.aiKans),
          confidence,
          poissonK1: Math.round(ai.h),
          poissonKX: Math.round(ai.x),
          poissonK2: Math.round(ai.a),
          scanCount,
          lockLevel,
          lastScanAt: new Date().toISOString(),
          firstScanAt: existing?.firstScanAt || new Date().toISOString(),
          status: 'pending',
          score: null,
          processed: false,
          verifiedAt: null,
          source: 'scheduled'
        };
      }
    });
  });

  // Sla op in Firebase
  const toSave = { ...existingPicks, ...newPicks };
  // Begrens tot 200 picks, oudste verwijderen
  const entries = Object.entries(toSave)
    .sort((a, b) => new Date(b[1].lastScanAt || 0) - new Date(a[1].lastScanAt || 0))
    .slice(0, 200);

  await fb(env, 'picks', 'PUT', Object.fromEntries(entries));

  const newCount = Object.keys(newPicks).length;
  const lockCount = Object.values(newPicks).filter(p => p.lockLevel !== 'single').length;
  console.log(`[Scan] Klaar: ${newCount} picks opgeslagen, ${lockCount} locks, ${withoutOdds.length} wedstrijden zonder odds`);
}

// ── Endpoint: haal picks op voor app ────────────────────
async function handleGetPicks(env) {
  const picks = await fb(env, 'picks') || {};
  const arr = Object.values(picks)
    .filter(p => p.status === 'pending' || p.status === 'win' || p.status === 'lose')
    .sort((a, b) => (b.value || 0) - (a.value || 0));
  return json({ picks: arr, count: arr.length, version: VERSION });
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

    if (path === '/picks') {
      return handleGetPicks(env);
    }

    if (url.searchParams.get('url')) {
      return handleProxy(url.searchParams.get('url'), request, env);
    }

    return json({
      version: VERSION,
      status: 'running',
      routes: ['/apif/*', '/fd/*', '/anthropic', '/picks', '?url=']
    });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(Promise.all([
      runScan(env),
      verifyYesterdayPicks(env)
    ]));
  }
};
