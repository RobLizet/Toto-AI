// TOTO AI WORKER v48
// v47: Cache-bypass voor fixture verificatie calls (_cb parameter)
//      Voorkomt dat Cloudflare gecachte NS-status teruggeeft voor gespeelde wedstrijden

const VERSION = 'v49';
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
async function handleAPIFootball(path, env, bypassCache = false) {
  const key = env.FOOTBALL_KEY || '';

  // v47: verwijder _cb cache-bypass parameter voor de echte API call
  const cleanPath = path.replace(/[&?]_cb=\d+/, '').replace(/\?&/, '?');

  const hosts = [
    {
      url: 'https://v3.football.api-sports.io' + cleanPath,
      headers: { 'x-apisports-key': key }
    },
    {
      url: 'https://api-football-v1.p.rapidapi.com/v3' + cleanPath,
      headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': 'api-football-v1.p.rapidapi.com' }
    }
  ];

  for (const host of hosts) {
    try {
      // v47: bij cache-bypass geen Cloudflare cache gebruiken
      const fetchOptions = { headers: host.headers };
      if (bypassCache) {
        fetchOptions.cf = { cacheEverything: false, cacheTtl: 0 };
      }

      const res = await fetchWithRetry(host.url, fetchOptions);
      const data = await res.json();
      if (data.errors?.token || data.errors?.key) continue;

      // v47: bij cache-bypass ook no-cache headers in response
      const responseHeaders = { 'Content-Type': 'application/json', ...CORS };
      if (bypassCache) {
        responseHeaders['Cache-Control'] = 'no-store, no-cache, must-revalidate';
        responseHeaders['X-Cache-Bypass'] = '1';
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: responseHeaders
      });
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
        const bet = bm.bets?.find(b => b.id === 1);
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
  const value = ((aiProb / implProb) - 1) * 100;
  return parseFloat(value.toFixed(1));
}

// ── Auto-verificatie: picks van gisteren checken ─────────
async function verifyYesterdayPicks(env) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  const picks = await fb(env, 'picks') || {};
  const toVerify = Object.entries(picks).filter(([id, p]) =>
    p.matchDate === dateStr && p.processed === false && p.status === 'pending'
  );

  if (!toVerify.length) return;

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
  const hour = now.getUTCHours() + 1;

  if (hour < 8 || hour >= 20) {
    console.log(`[Scan] Buiten scanvenster (${hour}:00 CET), skip`);
    return;
  }

  const competities = [88, 94, 39, 78, 61, 135, 140, 2, 1, 40, 79, 10, 33];
  let allMatches = [];

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

  allMatches.sort((a, b) => {
    const ta = new Date(a.matchTime || 0).getTime();
    const tb = new Date(b.matchTime || 0).getTime();
    return ta - tb;
  });

  const batch = allMatches.slice(0, 40);
  console.log(`[Scan] ${batch.length} wedstrijden gevonden, odds ophalen...`);

  const fixtureIds = batch.map(m => m.fixtureId).filter(Boolean);
  const oddsMap = await fetchOddsForFixtures(fixtureIds, env);
  console.log(`[Scan] Odds gevonden voor ${Object.keys(oddsMap).length} wedstrijden`);

  const withOdds = batch.filter(m => oddsMap[m.fixtureId]);
  const withoutOdds = batch.filter(m => !oddsMap[m.fixtureId]);

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
    const match = text.match(/\[[\s\S]*?\]/);
    if (match) {
      aiResults = JSON.parse(match[0]);
    }
  } catch(e) {
    console.error('[Scan] AI fout:', e);
  }

  const newPicks = {};
  const existingPicks = await fb(env, 'picks') || {};

  analyseBatch.forEach((m, i) => {
    const ai = aiResults[i] || { h: 50, x: 25, a: 25, c: 5 };
    const odds = oddsMap[m.fixtureId] || {};
    const confidence = parseInt(ai.c) || 5;

    const candidates = [
      { pick: '1', label: `${m.home} wint`, aiKans: ai.h, bookOdds: odds.home },
      { pick: 'X', label: 'Gelijkspel',     aiKans: ai.x, bookOdds: odds.draw },
      { pick: '2', label: `${m.away} wint`, aiKans: ai.a, bookOdds: odds.away },
    ];

    candidates.forEach(c => {
      if (!c.bookOdds || c.bookOdds <= 1) return;
      const value = calculateValue(c.aiKans, c.bookOdds, c.pick);
      if (value < 5 || confidence < 7) return;

      const pickKey = `${m.fixtureId}_${c.pick}`;
      const existing = existingPicks[pickKey];
      const scanCount = existing ? (existing.scanCount || 1) + 1 : 1;
      const lockLevel = scanCount >= 3 ? 'triple' : scanCount >= 2 ? 'double' : 'single';

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

  const toSave = { ...existingPicks, ...newPicks };
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


// ═══════════════════════════════════════════════════════
// DAGELIJKSE AI TIP — v19.3
// Elke dag om 08:00 UTC: haal picks op + genereer AI tip
// Opgeslagen in Firebase onder daily_tip/
// ═══════════════════════════════════════════════════════

async function generateDailyTip(env) {
  console.log('[DailyTip] Genereren dagelijkse tip...');
  const today = new Date().toISOString().split('T')[0];

  // Check of er al een tip is voor vandaag
  try {
    const existing = await fb(env, 'daily_tip/latest');
    if (existing?.date === today) {
      console.log('[DailyTip] Al een tip voor vandaag:', today);
      return;
    }
  } catch(e) {}

  // Haal picks op uit Firebase
  let picks = [];
  try {
    const picksData = await fb(env, 'picks') || {};
    picks = Object.values(picksData)
      .filter(p => p.status === 'pending' && p.date === today)
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, 5);
  } catch(e) {
    console.warn('[DailyTip] Picks ophalen mislukt:', e.message);
  }

  // Haal vandaag fixtures op van API-Football voor context
  let topFixtures = [];
  try {
    const r = await apif(env, `/fixtures?date=${today}&status=NS`);
    const d = await r.json();
    const known = new Set([39, 140, 78, 135, 61, 2, 88, 94, 203]);
    topFixtures = (d.response || [])
      .filter(f => known.has(f.league.id))
      .slice(0, 8)
      .map(f => `${f.teams.home.name} vs ${f.teams.away.name} (${f.league.name})`);
  } catch(e) {}

  // Bouw prompt voor Claude
  const picksText = picks.length
    ? picks.map(p => `- ${p.matchName || '?'}: ${p.pickLabel} @ ${p.odds} (value: +${Math.round(p.value || 0)}%, conf: ${p.confidence}/10)`).join('\n')
    : 'Nog geen gescande picks beschikbaar voor vandaag.';

  const fixturesText = topFixtures.length
    ? topFixtures.join('\n')
    : 'Geen fixtures gevonden.';

  const prompt = `Je bent een voetbal betting analist. Geef een korte, concrete dagelijkse tip voor ${today}.

Top value picks van vandaag:
${picksText}

Wedstrijden van vandaag (grote competities):
${fixturesText}

Geef je analyse in het Nederlands. Maximaal 3 zinnen. Geef 1 concrete beste pick met onderbouwing. Eindig met een korte disclaimer.
Formaat:
🎯 TIP VAN DE DAG: [pick]
📊 ANALYSE: [2 zinnen analyse]
⚠️ [korte disclaimer]`;

  // Genereer tip via Claude
  let tipText = '';
  let tipPick = '';
  try {
    const res = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await res.json();
    tipText = data.content?.[0]?.text || '';

    // Extraheer de pick uit de tip
    const tipMatch = tipText.match(/TIP VAN DE DAG:\s*(.+)/);
    tipPick = tipMatch?.[1]?.trim() || '';
  } catch(e) {
    console.error('[DailyTip] Claude API fout:', e.message);
    tipText = '🎯 TIP VAN DE DAG: Geen tip beschikbaar\n📊 ANALYSE: AI service tijdelijk niet beschikbaar.\n⚠️ Uitsluitend voor entertainment.';
  }

  // Sla op in Firebase
  const tipData = {
    date: today,
    tip: tipText,
    pick: tipPick,
    picks: picks.slice(0, 3).map(p => ({
      match: p.matchName,
      label: p.pickLabel,
      odds: p.odds,
      value: p.value,
      confidence: p.confidence
    })),
    generatedAt: new Date().toISOString(),
    version: VERSION
  };

  await fb(env, 'daily_tip/latest', 'PUT', tipData);
  await fb(env, `daily_tip/archive/${today}`, 'PUT', tipData);

  console.log('[DailyTip] Tip opgeslagen voor', today, ':', tipPick);
  return tipData;
}

// ── Daily tip endpoint (/daily-tip) ───────────────────────
async function handleDailyTip(env) {
  try {
    const tip = await fb(env, 'daily_tip/latest');
    if (!tip) return json({ error: 'Geen tip beschikbaar' }, 404);
    return json(tip);
  } catch(e) {
    return json({ error: e.message }, 500);
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

      // v47: detecteer cache-bypass parameter (_cb=timestamp)
      const bypassCache = url.searchParams.has('_cb');

      return handleAPIFootball(apiPath, env, bypassCache);
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

    if (path === '/daily-tip') {
      return handleDailyTip(env);
    }

    if (path === '/daily-tip/generate') {
      const tip = await generateDailyTip(env);
      return json(tip || { error: 'Genereren mislukt' });
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
    const now = new Date();
    const hour = now.getUTCHours();
    const isSunday = now.getUTCDay() === 0;
    ctx.waitUntil(Promise.all([
      runScan(env),
      verifyYesterdayPicks(env),
      // 08:00 UTC: dagelijkse AI tip genereren
      hour === 8 ? generateDailyTip(env) : Promise.resolve(),
      // Zondag 06:00 UTC: weekly calibration
      (isSunday && hour === 6) ? runWeeklyCalibration(env) : Promise.resolve(),
    ]));
  }
};
