// TOTO AI WORKER v48
// v47: Cache-bypass voor fixture verificatie calls (_cb parameter)
//      Voorkomt dat Cloudflare gecachte NS-status teruggeeft voor gespeelde wedstrijden

const VERSION = 'v64'; // v20 Intelligence Core
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


// ═══════════════════════════════════════════════════════
// v20 INTELLIGENCE CORE
// ═══════════════════════════════════════════════════════

// League kwaliteitsfactoren (hogere factor = betrouwbaardere data)
const LEAGUE_FACTORS = {
  39: 1.10,  // Premier League
  140: 1.08, // La Liga
  78: 1.08,  // Bundesliga
  135: 1.07, // Serie A
  61: 1.05,  // Ligue 1
  88: 1.00,  // Eredivisie
  94: 0.95,  // Jupiler Pro
  2: 1.12,   // Champions League
  3: 1.10,   // Europa League
  848: 1.05, // Conference League
  40: 0.98,  // Championship
  119: 0.90, // Eredivisie playoffs
};

// Odds bucket factoren (meest value zit in 1.5-3.5)
const ODDS_BUCKET_FACTORS = {
  '1.0-1.5': 0.75,
  '1.5-2.0': 0.95,
  '2.0-2.5': 1.05,
  '2.5-3.0': 1.08,
  '3.0-3.5': 1.05,
  '3.5-5.0': 0.90,
  '5.0+':    0.70,
};

function getOddsBucket(odds) {
  if (odds < 1.5) return '1.0-1.5';
  if (odds < 2.0) return '1.5-2.0';
  if (odds < 2.5) return '2.0-2.5';
  if (odds < 3.0) return '2.5-3.0';
  if (odds < 3.5) return '3.0-3.5';
  if (odds < 5.0) return '3.5-5.0';
  return '5.0+';
}

// Confidence Engine v1
function calculateConfidenceV20({ modelProb, value, dataQuality, marketSignal, leagueId, odds }) {
  const leagueFactor = LEAGUE_FACTORS[leagueId] || 0.92;
  const bucketFactor = ODDS_BUCKET_FACTORS[getOddsBucket(odds)] || 0.90;

  // Gewogen score (0-100)
  const raw =
    (Math.min(modelProb, 100) * 0.40) +   // AI kans gewicht
    (Math.min(Math.max(value, 0), 50) * 2 * 0.30) + // value gewicht (max 50% = 100pts)
    (Math.min(dataQuality, 100) * 0.20) +  // datakwaliteit
    (Math.min(marketSignal, 100) * 0.10);  // marktsignaal

  const final = Math.max(0, Math.min(100, raw * leagueFactor * bucketFactor));

  return {
    raw: parseFloat(raw.toFixed(1)),
    final: parseFloat(final.toFixed(1)),
    leagueFactor,
    bucketFactor,
    // Vertaal naar 1-10 schaal voor compatibiliteit
    score: Math.max(1, Math.min(10, Math.round(final / 10))),
  };
}

// Elite pick detectie
function isElitePick({ confidenceFinal, value, odds }) {
  return (
    confidenceFinal >= 72 &&
    value >= 8 &&
    odds >= 1.60 &&
    odds <= 4.50
  );
}

// Odds movement berekenen
function calcOddsMovement(openingOdds, currentOdds) {
  if (!openingOdds || !currentOdds) return null;
  const movement = ((currentOdds - openingOdds) / openingOdds) * 100;
  return parseFloat(movement.toFixed(1));
}

// Marktsignaal op basis van odds beweging
function calcMarketSignal(movement, pick) {
  if (movement === null) return 50; // neutraal
  // Dalende odds = meer actie = sterker signaal voor die uitkomst
  if (movement < -10) return 80;  // scherpe daling = sharp money
  if (movement < -5)  return 70;
  if (movement < -2)  return 60;
  if (movement > 10)  return 30;  // stijging = markt gaat tegen je
  if (movement > 5)   return 40;
  return 50;
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
  // Alle fixtures parallel ophalen (max 15 tegelijk)
  try {
    const results = await Promise.all(
      fixtureIds.map(id => apif(`/odds?fixture=${id}&bookmaker=8&bet=1`, env))
    );
    results.forEach((data, idx) => {
      const fid = fixtureIds[idx];
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
  } catch(e) {
    console.error('[Odds] Fout bij ophalen:', e);
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

  // Lees scanvenster uit scan_schedule in Firebase
  let scanFrom = 6, scanTo = 18, autoScanEnabled = true, maxPerDay = 5;
  try {
    const schedule = await fb(env, 'scan_schedule');
    if (schedule) {
      scanFrom        = schedule.startHour   ?? 6;
      scanTo          = schedule.endHour     ?? 18;
      autoScanEnabled = schedule.enabled     !== false;
      maxPerDay       = schedule.maxPerDay   ?? 5;
    }
  } catch(e) {
    console.log('[Scan] scan_schedule niet geladen, gebruik defaults');
  }

  if (!autoScanEnabled) {
    console.log('[Scan] Auto scan uitgeschakeld via scan_schedule, skip');
    return;
  }

  if (hour < scanFrom || hour >= scanTo) {
    console.log(`[Scan] Buiten scanvenster (${hour}:00 UTC, venster ${scanFrom}:00-${scanTo}:00 UTC), skip`);
    return;
  }
  console.log(`[Scan] Start scan (${hour}:00 UTC, venster ${scanFrom}:00-${scanTo}:00 UTC)`);

  let allMatches = [];

  // Haal ALLE wedstrijden vandaag + morgen op in 2 calls (geen per-league loop)
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  console.log(`[Scan] Fixtures ophalen voor ${today} en ${tomorrowStr}...`);
  try {
    const fix1 = await apif(`/fixtures?date=${today}&timezone=Europe/Amsterdam`, env);
    console.log(`[Scan] Vandaag: ${(fix1||[]).length} fixtures`);
    const fix2 = await apif(`/fixtures?date=${tomorrowStr}&timezone=Europe/Amsterdam`, env);
    console.log(`[Scan] Morgen: ${(fix2||[]).length} fixtures`);
    const fixtures = [...(fix1||[]), ...(fix2||[])];
    console.log(`[Scan] Totaal: ${fixtures.length} fixtures, filter op NS/TBD...`);

    // Alleen nog te spelen wedstrijden (NS=Not Started, TBD, PST=Postponed)
    allMatches = fixtures
      .filter(f => ['NS','TBD','PST'].includes(f.fixture?.status?.short))
      .map(f => ({
        fixtureId: f.fixture?.id,
        home: f.teams?.home?.name,
        away: f.teams?.away?.name,
        matchDate: f.fixture?.date?.split('T')[0] || today,
        matchTime: f.fixture?.date,
        leagueId: f.league?.id,
        leagueName: f.league?.name || '',
        venue: f.fixture?.venue?.name || '',
      }));
  } catch(e) {
    console.error('[Scan] Fout bij fixtures ophalen:', e);
  }

  if (!allMatches.length) {
    console.log('[Scan] Geen wedstrijden gevonden voor vandaag/morgen, stop');
    return;
  }

  allMatches.sort((a, b) => {
    const ta = new Date(a.matchTime || 0).getTime();
    const tb = new Date(b.matchTime || 0).getTime();
    return ta - tb;
  });

  const batch = allMatches.slice(0, 15); // Max 15 voor worker CPU limit
  console.log(`[Scan] ${batch.length} wedstrijden gevonden, odds ophalen...`);

  const fixtureIds = batch.map(m => m.fixtureId).filter(Boolean);
  const oddsMap = await fetchOddsForFixtures(fixtureIds, env);
  console.log(`[Scan] Odds gevonden voor ${Object.keys(oddsMap).length} wedstrijden`);

  // Sla opening odds op in Firebase voor movement tracking
  const oddsHistoryPath = `odds_history/${today}`;
  const existingHistory = await fb(env, oddsHistoryPath) || {};
  const newHistory = { ...existingHistory };
  Object.entries(oddsMap).forEach(([fid, odds]) => {
    if (!newHistory[fid]) {
      newHistory[fid] = { opening: odds, timestamp: new Date().toISOString() };
    }
    newHistory[fid].current = odds;
    newHistory[fid].updatedAt = new Date().toISOString();
  });
  await fb(env, oddsHistoryPath, 'PUT', newHistory);

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
        model: 'claude-sonnet-4-6',
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

  // Laad odds history voor movement tracking
  const todayHistory = await fb(env, `odds_history/${today}`) || {};

  analyseBatch.forEach((m, i) => {
    const ai = aiResults[i] || { h: 50, x: 25, a: 25, c: 5 };
    const odds = oddsMap[m.fixtureId] || {};
    const confidence = parseInt(ai.c) || 5;

    const candidates = [
      { pick: '1', label: `${m.home} wint`, aiKans: ai.h, bookOdds: odds.home },
      { pick: 'X', label: 'Gelijkspel',     aiKans: ai.x, bookOdds: odds.draw },
      { pick: '2', label: `${m.away} wint`, aiKans: ai.a, bookOdds: odds.away },
    ];

    const fixtureHistory = todayHistory[m.fixtureId] || {};
    const openingOdds = fixtureHistory.opening || null;

    candidates.forEach(c => {
      if (!c.bookOdds || c.bookOdds <= 1) return;
      const value = calculateValue(c.aiKans, c.bookOdds, c.pick);
      if (value < 3) return; // ruimer initieel filter, confidence engine filtert verder

      // Bereken odds movement
      const openOdds = openingOdds ? openingOdds[c.pick === '1' ? 'home' : c.pick === 'X' ? 'draw' : 'away'] : null;
      const movement = calcOddsMovement(openOdds, c.bookOdds);
      const marketSignal = calcMarketSignal(movement, c.pick);

      // Data kwaliteit op basis van AI kans spreiding
      const spread = Math.max(ai.h, ai.x, ai.a) - Math.min(ai.h, ai.x, ai.a);
      const dataQuality = Math.min(100, 50 + spread); // meer spreiding = meer overtuiging

      // Confidence Engine v20
      const conf = calculateConfidenceV20({
        modelProb: c.aiKans,
        value,
        dataQuality,
        marketSignal,
        leagueId: m.leagueId,
        odds: c.bookOdds,
      });

      // Filter: minimum conf score 5/10 en value > 3%
      if (conf.score < 5 || value < 3) return;

      const elite = isElitePick({ confidenceFinal: conf.final, value, odds: c.bookOdds });

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
          confidence: conf.score,         // 1-10 schaal
          confidenceRaw: conf.raw,        // 0-100 engine score
          confidenceFinal: conf.final,    // 0-100 na factoren
          leagueFactor: conf.leagueFactor,
          bucketFactor: conf.bucketFactor,
          oddsMovement: movement,         // % beweging tov opening
          marketSignal,                   // 0-100 marktsignaal
          elite,                          // boolean
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

  // Schrijf scan_status naar Firebase
  await fb(env, 'scan_status', 'PUT', {
    lastRun: new Date().toISOString(),
    scanDate: today,
    lastPickCount: newCount,
    lastMatchCount: analyseBatch.length,
    lastWithOdds: withOdds.length,
    lastWithoutOdds: withoutOdds.length,
    scansToday: ((await fb(env, 'scan_status/scansToday')) || 0) + 1,
    version: VERSION,
  });

  // Push notificatie — elite picks krijgen prioriteit
  const elitePicks = Object.values(newPicks).filter(p => p.elite);
  const lockPicks = Object.values(newPicks).filter(p => p.lockLevel === 'triple' || p.lockLevel === 'double');
  const pushPicks = elitePicks.length > 0 ? elitePicks : lockPicks;

  if (elitePicks.length > 0) {
    console.log(`[Scan] ${elitePicks.length} elite picks gevonden!`);
  }

  // Vervang lockPicks met pushPicks voor notificaties
  const lockPicks2 = pushPicks;
  if (lockPicks2.length > 0) {
    const top = lockPicks2.sort((a, b) => (b.value || 0) - (a.value || 0))[0];
    const icon = top.lockLevel === 'triple' ? '🔒🔒🔒' : '🔒🔒';
    const title = `${icon} ${top.lockLevel === 'triple' ? 'Triple' : 'Double'} Lock gevonden!`;
    const body = `${top.matchName} · ${top.pickLabel} @ ${top.odds} · +${Math.round(top.value)}% value`;
    await sendPushNotification(env, title, body, {
      type: 'value_alert',
      matchId: String(top.fixtureId),
      pick: top.pick,
      value: top.value,
      lockLevel: top.lockLevel,
    });
  } else if (newCount > 0) {
    // Gewone value picks: alleen pushen als ≥2 nieuwe picks
    const valuePicks = Object.values(newPicks).filter(p => (p.value || 0) >= 15 && (p.confidence || 0) >= 7);
    if (valuePicks.length >= 1) {
      const top = valuePicks[0];
      const title = `⚡ ${valuePicks.length} sterke value pick${valuePicks.length > 1 ? 's' : ''} gevonden`;
      const body = `${top.matchName} · ${top.pickLabel} @ ${top.odds} · +${Math.round(top.value)}% value`;
      await sendPushNotification(env, title, body, {
        type: 'value_alert',
        matchId: String(top.fixtureId),
        pick: top.pick,
        value: top.value,
      });
    }
  }
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

  // Haal picks op uit Firebase — alleen kwalitatieve picks
  let picks = [];
  try {
    const picksData = await fb(env, 'picks') || {};
    picks = Object.values(picksData)
      .filter(p =>
        p.status === 'pending' &&
        p.date === today &&
        !p.isSparseData &&
        (p.value || 0) >= 8 &&
        (p.confidence || 0) >= 6 &&
        p.poissonUsed
      )
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, 5);
  } catch(e) {
    console.warn('[DailyTip] Picks ophalen mislukt:', e.message);
  }

  // Geen kwalitatieve picks → geen tip vandaag
  if (!picks.length) {
    const noTip = {
      date: today,
      qualified: false,
      tip: null,
      reason: 'Geen picks die voldoen aan de kwaliteitsdrempel vandaag.',
      generatedAt: new Date().toISOString(),
      version: VERSION
    };
    await fb(env, 'daily_tip/latest', 'PUT', noTip);
    console.log('[DailyTip] Geen gekwalificeerde picks vandaag.');
    return noTip;
  }

  // Bouw prompt voor Claude — gestructureerde JSON output
  const picksText = picks
    .map(p => `- ${p.matchName || '?'}: ${p.pickLabel} @ ${p.odds} (value: +${Math.round(p.value||0)}%, conf: ${p.confidence}/10, Poisson: ${p.poissonUsed ? 'ja' : 'nee'})`)
    .join('\n');

  const prompt = `Je bent een voetbal betting analist. Kies uit onderstaande gekwalificeerde value picks de BESTE pick van de dag.

Gekwalificeerde picks (value ≥8%, conf ≥6/10, Poisson geldig):
${picksText}

Respond ONLY with valid JSON, no text outside JSON:
{
  "match": "Thuis vs Uit",
  "pick": "1",
  "pickLabel": "Thuis wint",
  "odds": 2.10,
  "value": 15,
  "confidence": 7,
  "markt": "Uitslag",
  "analyse": "2-3 zinnen concrete onderbouwing met cijfers",
  "tip": "1 zin samenvatting voor de gebruiker"
}`;

  let tipData = null;
  try {
    const res = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await res.json();
    const raw = data.content?.[0]?.text || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    tipData = {
      date: today,
      qualified: true,
      match:      parsed.match,
      pick:       parsed.pick,
      pickLabel:  parsed.pickLabel,
      odds:       parsed.odds,
      value:      parsed.value,
      confidence: parsed.confidence,
      markt:      parsed.markt || 'Uitslag',
      analyse:    parsed.analyse,
      tip:        parsed.tip,
      allPicks:   picks.slice(0, 3).map(p => ({
        match: p.matchName, label: p.pickLabel,
        odds: p.odds, value: p.value, confidence: p.confidence
      })),
      generatedAt: new Date().toISOString(),
      version: VERSION
    };
  } catch(e) {
    console.error('[DailyTip] Fout:', e.message);
    // Neem gewoon de top pick zonder AI samenvatting
    const top = picks[0];
    tipData = {
      date: today,
      qualified: true,
      match:      top.matchName || '?',
      pick:       top.pick,
      pickLabel:  top.pickLabel,
      odds:       top.odds,
      value:      top.value,
      confidence: top.confidence,
      markt:      top.markt || 'Uitslag',
      analyse:    `Value pick met ${Math.round(top.value||0)}% positieve verwachte waarde en confidence ${top.confidence}/10.`,
      tip:        `${top.pickLabel} @ ${top.odds}`,
      generatedAt: new Date().toISOString(),
      version: VERSION
    };
  }

  await fb(env, 'daily_tip/latest', 'PUT', tipData);
  await fb(env, `daily_tip/archive/${today}`, 'PUT', tipData);
  console.log('[DailyTip] Tip opgeslagen:', tipData.match, tipData.pickLabel);
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


// ── OneSignal push notificatie ────────────────────────────
async function sendPushNotification(env, title, body, data = {}) {
  const appId = env.ONESIGNAL_APP_ID;
  const apiKey = env.ONESIGNAL_API_KEY;
  if (!appId || !apiKey) {
    console.log('[Push] OneSignal keys niet geconfigureerd, skip');
    return;
  }
  try {
    const payload = {
      app_id: appId,
      included_segments: ['All'],
      headings: { en: title, nl: title },
      contents: { en: body, nl: body },
      data,
      android_channel_id: 'value-alerts',
      ttl: 3600,
    };
    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    console.log('[Push] Verstuurd:', result.id || result.errors || JSON.stringify(result));
  } catch(e) {
    console.error('[Push] Fout:', e.message);
  }
}

// ── Endpoint: /push — stuur push vanuit app ──────────────
async function handlePush(request, env) {
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405);
  try {
    const body = await request.json();
    const { title, body: msgBody, data } = body;
    if (!title || !msgBody) return json({ error: 'title en body verplicht' }, 400);
    await sendPushNotification(env, title, msgBody, data || {});
    return json({ ok: true });
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

    if (path === '/scan') {
      const secret = url.searchParams.get('secret');
      if (!secret || secret !== env.SCAN_SECRET) {
        return json({ error: 'Unauthorized' }, 401);
      }
      // Voer scan uit op de achtergrond
      const ctx_dummy = { waitUntil: (p) => p };
      json({ status: 'scan gestart', version: VERSION });
      await runScan(env);
      await verifyYesterdayPicks(env);
      return json({ status: 'scan klaar', version: VERSION });
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

    if (path === '/push') {
      return handlePush(request, env);
    }

    if (url.searchParams.get('url')) {
      return handleProxy(url.searchParams.get('url'), request, env);
    }

    return json({
      version: VERSION,
      status: 'running',
      routes: ['/apif/*', '/fd/*', '/anthropic', '/picks', '/scan', '/push', '/daily-tip', '?url=']
    });
  },

  async scheduled(event, env, ctx) {
    const now = new Date();
    const hour = now.getUTCHours();
    const isSunday = now.getUTCDay() === 0;
    ctx.waitUntil(Promise.all([
      runScan(env),
      verifyYesterdayPicks(env),
      // 06:00 UTC (= 08:00 NL zomertijd): dagelijkse AI tip genereren
      hour === 6 ? generateDailyTip(env) : Promise.resolve(),
      // Zondag 06:00 UTC: weekly calibration
      (isSunday && hour === 6) ? runWeeklyCalibration(env) : Promise.resolve(),
    ]));
  }
};
 TOTO AI WORKER v48
// v47: Cache-bypass voor fixture verificatie calls (_cb parameter)
//      Voorkomt dat Cloudflare gecachte NS-status teruggeeft voor gespeelde wedstrijden

const VERSION = 'v62';
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
  // Alle fixtures parallel ophalen (max 15 tegelijk)
  try {
    const results = await Promise.all(
      fixtureIds.map(id => apif(`/odds?fixture=${id}&bookmaker=8&bet=1`, env))
    );
    results.forEach((data, idx) => {
      const fid = fixtureIds[idx];
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
  } catch(e) {
    console.error('[Odds] Fout bij ophalen:', e);
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

  // Lees scanvenster uit Firebase settings (gebruiker kan dit aanpassen)
  const ownerUid = env.OWNER_UID || 'NpbaXO16xwha4Dm4Jgn9RqTM9Fq1';
  let scanFrom = 8, scanTo = 20, autoScanEnabled = true;
  try {
    const userSettings = await fb(env, `users/${ownerUid}/settings`);
    if (userSettings) {
      scanFrom  = userSettings.scanWindowFrom ?? 8;
      scanTo    = userSettings.scanWindowTo   ?? 20;
      autoScanEnabled = userSettings.autoScan !== false;
    }
  } catch(e) {
    console.log('[Scan] Settings niet geladen, gebruik defaults');
  }

  if (!autoScanEnabled) {
    console.log('[Scan] Auto scan uitgeschakeld door gebruiker, skip');
    return;
  }

  if (hour < scanFrom || hour >= scanTo) {
    console.log(`[Scan] Buiten scanvenster (${hour}:00 CET, venster ${scanFrom}:00-${scanTo}:00), skip`);
    return;
  }
  console.log(`[Scan] Start scan (${hour}:00 CET, venster ${scanFrom}:00-${scanTo}:00)`);

  let allMatches = [];

  // Haal ALLE wedstrijden vandaag + morgen op in 2 calls (geen per-league loop)
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  console.log(`[Scan] Fixtures ophalen voor ${today} en ${tomorrowStr}...`);
  try {
    const fix1 = await apif(`/fixtures?date=${today}&timezone=Europe/Amsterdam`, env);
    console.log(`[Scan] Vandaag: ${(fix1||[]).length} fixtures`);
    const fix2 = await apif(`/fixtures?date=${tomorrowStr}&timezone=Europe/Amsterdam`, env);
    console.log(`[Scan] Morgen: ${(fix2||[]).length} fixtures`);
    const fixtures = [...(fix1||[]), ...(fix2||[])];
    console.log(`[Scan] Totaal: ${fixtures.length} fixtures, filter op NS/TBD...`);

    // Alleen nog te spelen wedstrijden (NS=Not Started, TBD, PST=Postponed)
    allMatches = fixtures
      .filter(f => ['NS','TBD','PST'].includes(f.fixture?.status?.short))
      .map(f => ({
        fixtureId: f.fixture?.id,
        home: f.teams?.home?.name,
        away: f.teams?.away?.name,
        matchDate: f.fixture?.date?.split('T')[0] || today,
        matchTime: f.fixture?.date,
        leagueId: f.league?.id,
        leagueName: f.league?.name || '',
        venue: f.fixture?.venue?.name || '',
      }));
  } catch(e) {
    console.error('[Scan] Fout bij fixtures ophalen:', e);
  }

  if (!allMatches.length) {
    console.log('[Scan] Geen wedstrijden gevonden voor vandaag/morgen, stop');
    return;
  }

  allMatches.sort((a, b) => {
    const ta = new Date(a.matchTime || 0).getTime();
    const tb = new Date(b.matchTime || 0).getTime();
    return ta - tb;
  });

  const batch = allMatches.slice(0, 15); // Max 15 voor worker CPU limit
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
        model: 'claude-sonnet-4-6',
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
      if (value < 5 || confidence < 6) return;

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

  // Schrijf scan_status naar Firebase
  await fb(env, 'scan_status', 'PUT', {
    lastRun: new Date().toISOString(),
    scanDate: today,
    lastPickCount: newCount,
    lastMatchCount: analyseBatch.length,
    lastWithOdds: withOdds.length,
    lastWithoutOdds: withoutOdds.length,
    scansToday: ((await fb(env, 'scan_status/scansToday')) || 0) + 1,
    version: VERSION,
  });

  // Push notificatie voor triple/double locks
  const lockPicks = Object.values(newPicks).filter(p => p.lockLevel === 'triple' || p.lockLevel === 'double');
  if (lockPicks.length > 0) {
    const top = lockPicks.sort((a, b) => (b.value || 0) - (a.value || 0))[0];
    const icon = top.lockLevel === 'triple' ? '🔒🔒🔒' : '🔒🔒';
    const title = `${icon} ${top.lockLevel === 'triple' ? 'Triple' : 'Double'} Lock gevonden!`;
    const body = `${top.matchName} · ${top.pickLabel} @ ${top.odds} · +${Math.round(top.value)}% value`;
    await sendPushNotification(env, title, body, {
      type: 'value_alert',
      matchId: String(top.fixtureId),
      pick: top.pick,
      value: top.value,
      lockLevel: top.lockLevel,
    });
  } else if (newCount > 0) {
    // Gewone value picks: alleen pushen als ≥2 nieuwe picks
    const valuePicks = Object.values(newPicks).filter(p => (p.value || 0) >= 15 && (p.confidence || 0) >= 7);
    if (valuePicks.length >= 1) {
      const top = valuePicks[0];
      const title = `⚡ ${valuePicks.length} sterke value pick${valuePicks.length > 1 ? 's' : ''} gevonden`;
      const body = `${top.matchName} · ${top.pickLabel} @ ${top.odds} · +${Math.round(top.value)}% value`;
      await sendPushNotification(env, title, body, {
        type: 'value_alert',
        matchId: String(top.fixtureId),
        pick: top.pick,
        value: top.value,
      });
    }
  }
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

  // Haal picks op uit Firebase — alleen kwalitatieve picks
  let picks = [];
  try {
    const picksData = await fb(env, 'picks') || {};
    picks = Object.values(picksData)
      .filter(p =>
        p.status === 'pending' &&
        p.date === today &&
        !p.isSparseData &&
        (p.value || 0) >= 8 &&
        (p.confidence || 0) >= 6 &&
        p.poissonUsed
      )
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, 5);
  } catch(e) {
    console.warn('[DailyTip] Picks ophalen mislukt:', e.message);
  }

  // Geen kwalitatieve picks → geen tip vandaag
  if (!picks.length) {
    const noTip = {
      date: today,
      qualified: false,
      tip: null,
      reason: 'Geen picks die voldoen aan de kwaliteitsdrempel vandaag.',
      generatedAt: new Date().toISOString(),
      version: VERSION
    };
    await fb(env, 'daily_tip/latest', 'PUT', noTip);
    console.log('[DailyTip] Geen gekwalificeerde picks vandaag.');
    return noTip;
  }

  // Bouw prompt voor Claude — gestructureerde JSON output
  const picksText = picks
    .map(p => `- ${p.matchName || '?'}: ${p.pickLabel} @ ${p.odds} (value: +${Math.round(p.value||0)}%, conf: ${p.confidence}/10, Poisson: ${p.poissonUsed ? 'ja' : 'nee'})`)
    .join('\n');

  const prompt = `Je bent een voetbal betting analist. Kies uit onderstaande gekwalificeerde value picks de BESTE pick van de dag.

Gekwalificeerde picks (value ≥8%, conf ≥6/10, Poisson geldig):
${picksText}

Respond ONLY with valid JSON, no text outside JSON:
{
  "match": "Thuis vs Uit",
  "pick": "1",
  "pickLabel": "Thuis wint",
  "odds": 2.10,
  "value": 15,
  "confidence": 7,
  "markt": "Uitslag",
  "analyse": "2-3 zinnen concrete onderbouwing met cijfers",
  "tip": "1 zin samenvatting voor de gebruiker"
}`;

  let tipData = null;
  try {
    const res = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await res.json();
    const raw = data.content?.[0]?.text || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    tipData = {
      date: today,
      qualified: true,
      match:      parsed.match,
      pick:       parsed.pick,
      pickLabel:  parsed.pickLabel,
      odds:       parsed.odds,
      value:      parsed.value,
      confidence: parsed.confidence,
      markt:      parsed.markt || 'Uitslag',
      analyse:    parsed.analyse,
      tip:        parsed.tip,
      allPicks:   picks.slice(0, 3).map(p => ({
        match: p.matchName, label: p.pickLabel,
        odds: p.odds, value: p.value, confidence: p.confidence
      })),
      generatedAt: new Date().toISOString(),
      version: VERSION
    };
  } catch(e) {
    console.error('[DailyTip] Fout:', e.message);
    // Neem gewoon de top pick zonder AI samenvatting
    const top = picks[0];
    tipData = {
      date: today,
      qualified: true,
      match:      top.matchName || '?',
      pick:       top.pick,
      pickLabel:  top.pickLabel,
      odds:       top.odds,
      value:      top.value,
      confidence: top.confidence,
      markt:      top.markt || 'Uitslag',
      analyse:    `Value pick met ${Math.round(top.value||0)}% positieve verwachte waarde en confidence ${top.confidence}/10.`,
      tip:        `${top.pickLabel} @ ${top.odds}`,
      generatedAt: new Date().toISOString(),
      version: VERSION
    };
  }

  await fb(env, 'daily_tip/latest', 'PUT', tipData);
  await fb(env, `daily_tip/archive/${today}`, 'PUT', tipData);
  console.log('[DailyTip] Tip opgeslagen:', tipData.match, tipData.pickLabel);
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


// ── OneSignal push notificatie ────────────────────────────
async function sendPushNotification(env, title, body, data = {}) {
  const appId = env.ONESIGNAL_APP_ID;
  const apiKey = env.ONESIGNAL_API_KEY;
  if (!appId || !apiKey) {
    console.log('[Push] OneSignal keys niet geconfigureerd, skip');
    return;
  }
  try {
    const payload = {
      app_id: appId,
      included_segments: ['All'],
      headings: { en: title, nl: title },
      contents: { en: body, nl: body },
      data,
      android_channel_id: 'value-alerts',
      ttl: 3600,
    };
    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    console.log('[Push] Verstuurd:', result.id || result.errors || JSON.stringify(result));
  } catch(e) {
    console.error('[Push] Fout:', e.message);
  }
}

// ── Endpoint: /push — stuur push vanuit app ──────────────
async function handlePush(request, env) {
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405);
  try {
    const body = await request.json();
    const { title, body: msgBody, data } = body;
    if (!title || !msgBody) return json({ error: 'title en body verplicht' }, 400);
    await sendPushNotification(env, title, msgBody, data || {});
    return json({ ok: true });
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

    if (path === '/scan') {
      const secret = url.searchParams.get('secret');
      if (!secret || secret !== env.SCAN_SECRET) {
        return json({ error: 'Unauthorized' }, 401);
      }
      // Voer scan uit op de achtergrond
      const ctx_dummy = { waitUntil: (p) => p };
      json({ status: 'scan gestart', version: VERSION });
      await runScan(env);
      await verifyYesterdayPicks(env);
      return json({ status: 'scan klaar', version: VERSION });
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

    if (path === '/push') {
      return handlePush(request, env);
    }

    if (url.searchParams.get('url')) {
      return handleProxy(url.searchParams.get('url'), request, env);
    }

    return json({
      version: VERSION,
      status: 'running',
      routes: ['/apif/*', '/fd/*', '/anthropic', '/picks', '/scan', '/push', '/daily-tip', '?url=']
    });
  },

  async scheduled(event, env, ctx) {
    const now = new Date();
    const hour = now.getUTCHours();
    const isSunday = now.getUTCDay() === 0;
    ctx.waitUntil(Promise.all([
      runScan(env),
      verifyYesterdayPicks(env),
      // 06:00 UTC (= 08:00 NL zomertijd): dagelijkse AI tip genereren
      hour === 6 ? generateDailyTip(env) : Promise.resolve(),
      // Zondag 06:00 UTC: weekly calibration
      (isSunday && hour === 6) ? runWeeklyCalibration(env) : Promise.resolve(),
    ]));
  }
};
