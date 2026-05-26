// TOTO AI WORKER v96
// v96: Automatische scan weer aan — Noorwegen (113) + Zweden (103) actief
//      Tijdvenster uitgebreid van 4u naar 24u (vond anders geen avondwedstrijden)
//      /scan-test endpoint voor pipeline verificatie (HMAC, geen Firebase write)
// v95: Marathonbet (1) + Betsson (36) toegevoegd als odds fallback voor Scandinavische leagues

const VERSION = 'v96'; // v96: /scan-test endpoint
const FB_DB = 'https://toto-ai-397cb-default-rtdb.europe-west1.firebasedatabase.app';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key, anthropic-version, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS }
  });
}

// ── HMAC token verificatie ────────────────────────────────
// Token = HMAC-SHA256(SCAN_SECRET + timestamp_minute)
// Geldig binnen TOKEN_WINDOW_MINUTES minuten
const TOKEN_WINDOW_MINUTES = 2;

async function generateHMAC(secret, timestampMinute) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(String(timestampMinute));
  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, msgData);
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyHMAC(token, secret) {
  if (!token || !secret) return false;
  const nowMinute = Math.floor(Date.now() / 60000);
  // Check huidige minuut + vorige window (TOKEN_WINDOW_MINUTES)
  for (let i = 0; i <= TOKEN_WINDOW_MINUTES; i++) {
    const expected = await generateHMAC(secret, nowMinute - i);
    if (token === expected) return true;
  }
  return false;
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

// ── Supabase helper ──────────────────────────────────────
async function sb(env, table, method = 'GET', body = null, query = '') {
  try {
    const url = `${env.SUPABASE_URL}/rest/v1/${table}${query}`;
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_KEY}`,
        'Prefer': query.includes('on_conflict')
          ? 'resolution=merge-duplicates'
          : method === 'POST' ? 'return=minimal' : 'return=representation',
      },
      body: body ? JSON.stringify(body) : null,
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[SB] ${method} ${table} fout ${res.status}:`, err);
      return null;
    }
    if (method === 'POST' || method === 'DELETE') return true;
    return await res.json();
  } catch(e) {
    console.error('[SB] fetch fout:', e);
    return null;
  }
}

// ── Supabase: odds snapshots opslaan ─────────────────────
async function saveOddsSnapshots(oddsMap, matches, env) {
  const today = new Date().toISOString().split('T')[0];
  const rows = [];
  matches.forEach(m => {
    const odds = oddsMap[m.fixtureId];
    if (!odds) return;
    rows.push({
      fixture_id: m.fixtureId,
      bookmaker: 8,
      home_odds: odds.home,
      draw_odds: odds.draw,
      away_odds: odds.away,
      match_date: m.matchDate || today,
      league_id: m.leagueId || null,
      captured_at: new Date().toISOString(),
    });
  });
  if (!rows.length) return;
  await sb(env, 'odds_snapshots', 'POST', rows, '?on_conflict=fixture_id,match_date');
  console.log(`[SB] ${rows.length} odds snapshots opgeslagen`);
}

// ── Supabase: sharp money detectie ───────────────────────
async function detectSharpMoney(oddsMap, matches, env) {
  const today = new Date().toISOString().split('T')[0];
  const existing = await sb(env, 'odds_snapshots', 'GET', null,
    `?match_date=eq.${today}&select=fixture_id,home_odds,draw_odds,away_odds`
  );
  if (!existing || !existing.length) return {};

  const openMap = {};
  existing.forEach(r => {
    openMap[r.fixture_id] = {
      home: parseFloat(r.home_odds),
      draw: parseFloat(r.draw_odds),
      away: parseFloat(r.away_odds),
    };
  });

  const sharpSignals = {};
  const movements = [];
  const SHARP_THRESHOLD = 5;

  matches.forEach(m => {
    const current = oddsMap[m.fixtureId];
    const opening = openMap[m.fixtureId];
    if (!current || !opening) return;
    const pickMap = {
      '1': { open: opening.home, curr: current.home },
      'X': { open: opening.draw, curr: current.draw },
      '2': { open: opening.away, curr: current.away },
    };
    Object.entries(pickMap).forEach(([pick, { open, curr }]) => {
      if (!open || !curr || open <= 1 || curr <= 1) return;
      const movPct = parseFloat((((curr - open) / open) * 100).toFixed(1));
      if (Math.abs(movPct) >= SHARP_THRESHOLD) {
        const direction = movPct < 0 ? 'steam' : 'drift';
        movements.push({ fixture_id: m.fixtureId, pick, from_odds: open, to_odds: curr,
          movement_pct: movPct, direction, detected_at: new Date().toISOString() });
        if (direction === 'steam') {
          sharpSignals[m.fixtureId] = sharpSignals[m.fixtureId] || {};
          sharpSignals[m.fixtureId][pick] = { movement: movPct };
          console.log(`[Sharp] ${m.home} vs ${m.away} — ${pick} ${movPct}% steam`);
        }
      }
    });
  });

  if (movements.length) {
    await sb(env, 'odds_movements', 'POST', movements);
    console.log(`[SB] ${movements.length} odds bewegingen opgeslagen`);
  }
  return sharpSignals;
}

// ── Supabase: CLV opslaan na settlement ──────────────────
async function saveCLV(pick, clv, won, env) {
  if (clv === null || clv === undefined) return;
  await sb(env, 'clv_results', 'POST', [{
    fixture_id: pick.fixtureId,
    pick: pick.pick,
    our_odds: pick.odds,
    closing_odds: pick.odds,
    clv_pct: clv,
    status: won ? 'win' : 'lose',
    match_date: pick.matchDate || null,
    league_id: pick.leagueId || null,
    settled_at: new Date().toISOString(),
  }]);
}

// ── Supabase: analytics endpoint ─────────────────────────
async function handleAnalytics(env) {
  try {
    const clvData = await sb(env, 'clv_results', 'GET', null,
      '?select=clv_pct,status,league_id,match_date&order=settled_at.desc&limit=200'
    ) || [];
    const sevenDaysAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0];
    const sharpData = await sb(env, 'odds_movements', 'GET', null,
      `?detected_at=gte.${sevenDaysAgo}T00:00:00Z&direction=eq.steam&order=movement_pct.asc&limit=50`
    ) || [];

    const withCLV = clvData.filter(r => r.clv_pct !== null);
    const avgCLV = withCLV.length
      ? parseFloat((withCLV.reduce((s,r) => s + parseFloat(r.clv_pct), 0) / withCLV.length).toFixed(1))
      : null;

    return json({
      clv: {
        total: clvData.length,
        avgCLV,
        positiveCLVPct: withCLV.length
          ? Math.round(withCLV.filter(r => parseFloat(r.clv_pct) > 0).length / withCLV.length * 100)
          : null,
      },
      sharpMoney: {
        steamMovements7d: sharpData.length,
        topSteam: sharpData.slice(0, 5).map(r => ({
          fixtureId: r.fixture_id, pick: r.pick,
          movement: r.movement_pct, detectedAt: r.detected_at,
        })),
      },
    });
  } catch(e) {
    console.error('[Analytics] fout:', e);
    return json({ error: 'Analytics mislukt' }, 500);
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
  113: 0.88, // Eliteserien Noorwegen (apr–nov, seizoen 2026)
  103: 0.88, // Allsvenskan Zweden (apr–nov, seizoen 2026)
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
function calculateConfidenceV20({ modelProb, value, dataQuality, marketSignal, leagueId, odds, calibFactor }) {
  const staticFactor = LEAGUE_FACTORS[leagueId] || 0.92;
  const leagueFactor = calibFactor ? (staticFactor * 0.5 + calibFactor * 0.5) : staticFactor;
  const bucketFactor = ODDS_BUCKET_FACTORS[getOddsBucket(odds)] || 0.90;

  const raw =
    (Math.min(modelProb, 100) * 0.40) +
    (Math.min(Math.max(value, 0), 50) * 2 * 0.30) +
    (Math.min(dataQuality, 100) * 0.20) +
    (Math.min(marketSignal, 100) * 0.10);

  const final = Math.max(0, Math.min(100, raw * leagueFactor * bucketFactor));

  return {
    raw: parseFloat(raw.toFixed(1)),
    final: parseFloat(final.toFixed(1)),
    leagueFactor,
    bucketFactor,
    score: Math.max(1, Math.min(10, Math.round(final / 10))),
  };
}

// Elite pick detectie
function isElitePick({ confidenceFinal, value, odds }) {
  return (
    confidenceFinal >= 65 &&  // verlaagd van 72 → 65 (meer elite picks in 7-8 tier)
    value >= 6 &&             // verlaagd van 8 → 6
    odds >= 1.50 &&           // verlaagd van 1.60 → 1.50
    odds <= 5.00              // verhoogd van 4.50 → 5.00
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
  if (movement === null) return 50;
  if (movement < -10) return 80;
  if (movement < -5)  return 70;
  if (movement < -2)  return 60;
  if (movement > 10)  return 30;
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
      const res = await fetchWithRetry(host.url, {
        headers: host.headers,
        cf: { cacheTtl: 0, cacheEverything: false }
      });
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
      const fetchOptions = { headers: host.headers };
      if (bypassCache) {
        fetchOptions.cf = { cacheEverything: false, cacheTtl: 0 };
      }

      const res = await fetchWithRetry(host.url, fetchOptions);
      const data = await res.json();
      if (data.errors?.token || data.errors?.key) continue;

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
  function parseOdds(data, fid) {
    if (!data || !data.length) return false;
    const bm = data[0]?.bookmakers?.[0];
    if (!bm) return false;
    const bet = bm.bets?.find(b => b.id === 1);
    if (!bet) return false;
    const home = parseFloat(bet.values?.find(v => v.value === 'Home')?.odd || 0);
    const draw = parseFloat(bet.values?.find(v => v.value === 'Draw')?.odd || 0);
    const away = parseFloat(bet.values?.find(v => v.value === 'Away')?.odd || 0);
    if (home > 1) { oddsMap[fid] = { home, draw, away }; return true; }
    return false;
  }
  try {
    // Stap 1: Bet365 (8)
    const r1 = await Promise.all(fixtureIds.map(id => apif(`/odds?fixture=${id}&bookmaker=8&bet=1`, env)));
    r1.forEach((data, i) => parseOdds(data, fixtureIds[i]));

    // Stap 2: William Hill (6) voor missende
    const missing2 = fixtureIds.filter(id => !oddsMap[id]);
    if (missing2.length) {
      const r2 = await Promise.all(missing2.map(id => apif(`/odds?fixture=${id}&bookmaker=6&bet=1`, env)));
      r2.forEach((data, i) => parseOdds(data, missing2[i]));
    }

    // Stap 3: Unibet/Jacks (16) — goed voor Scandinavische leagues
    const missing3 = fixtureIds.filter(id => !oddsMap[id]);
    if (missing3.length) {
      const r3 = await Promise.all(missing3.map(id => apif(`/odds?fixture=${id}&bookmaker=16&bet=1`, env)));
      r3.forEach((data, i) => parseOdds(data, missing3[i]));
    }

    // Stap 4: Bwin (4)
    const missing4 = fixtureIds.filter(id => !oddsMap[id]);
    if (missing4.length) {
      const r4 = await Promise.all(missing4.map(id => apif(`/odds?fixture=${id}&bookmaker=4&bet=1`, env)));
      r4.forEach((data, i) => parseOdds(data, missing4[i]));
    }

    // Stap 5: Marathonbet (1) — goede Scandinavische coverage
    const missing5 = fixtureIds.filter(id => !oddsMap[id]);
    if (missing5.length) {
      const r5 = await Promise.all(missing5.map(id => apif(`/odds?fixture=${id}&bookmaker=1&bet=1`, env)));
      r5.forEach((data, i) => parseOdds(data, missing5[i]));
    }

    // Stap 6: Betsson (36) — Scandinavische markt
    const missing6 = fixtureIds.filter(id => !oddsMap[id]);
    if (missing6.length) {
      const r6 = await Promise.all(missing6.map(id => apif(`/odds?fixture=${id}&bookmaker=36&bet=1`, env)));
      r6.forEach((data, i) => parseOdds(data, missing6[i]));
    }
  } catch(e) {
    console.error('[Odds] Fout bij ophalen:', e);
  }
  console.log(`[Odds] ${Object.keys(oddsMap).length}/${fixtureIds.length} fixtures met odds`);
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

// ── Datum normalisatie helper ─────────────────────────────
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const parts = String(dateStr).split('-');
  if (parts.length === 3 && parts[2].length === 4) {
    const day   = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year  = parts[2];
    return `${year}-${month}-${day}`;
  }
  try {
    return new Date(dateStr).toISOString().split('T')[0];
  } catch(e) { return null; }
}

// ── Auto-verificatie: pending picks van afgelopen 7 dagen checken ─────────
async function verifyYesterdayPicks(env) {
  // Supabase keepalive — voorkomt automatisch pauzeren gratis project
  try {
    await sb(env, 'clv_results', 'GET', null, '?limit=1&select=id');
    console.log('[Keepalive] Supabase ping OK');
  } catch(e) {
    console.log('[Keepalive] Supabase ping mislukt (non-fatal):', e.message);
  }

  const today = new Date();
  today.setHours(0,0,0,0);

  const picks = await fb(env, 'picks') || {};

  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  const todayStr  = today.toISOString().split('T')[0];

  const toVerify = Object.entries(picks).filter(([id, p]) => {
    if (p.processed !== false || p.status !== 'pending') return false;
    const normalized = normalizeDate(p.matchDate);
    if (!normalized) return false;
    return normalized >= cutoffStr && normalized < todayStr;
  });

  if (!toVerify.length) {
    console.log('[Verify] Geen pending picks om te verifiëren');
    return;
  }

  console.log(`[Verify] ${toVerify.length} picks te verifiëren`);

  // Max 10 picks per run
  const batch = toVerify.slice(0, 10);
  const fixtureIds = [...new Set(batch.map(([, p]) => p.fixtureId).filter(Boolean))];

  // Parallel fixture resultaten ophalen
  const fixtureResults = await Promise.all(
    fixtureIds.map(id => apif(`/fixtures?id=${id}`, env))
  );

  const resultMap = {};
  fixtureResults.forEach((data, i) => {
    const fid = String(fixtureIds[i]);
    const f = data?.[0];
    if (!f) return;
    const status = f.fixture?.status?.short;
    if (!['FT','AET','PEN'].includes(status)) return;
    resultMap[fid] = { home: f.goals?.home ?? 0, away: f.goals?.away ?? 0, status };
  });

  console.log(`[Verify] ${Object.keys(resultMap).length}/${fixtureIds.length} fixtures met resultaat`);
  if (!Object.keys(resultMap).length) return;

  // CLV odds parallel ophalen voor picks met resultaat
  const picksWithResult = batch.filter(([, p]) => resultMap[String(p.fixtureId)]);
  const clvOdds = await Promise.all(
    picksWithResult.map(([, p]) => apif(`/odds?fixture=${p.fixtureId}&bookmaker=8&bet=1`, env))
  );

  let updated = 0;
  const updatedIds = [];

  for (let i = 0; i < picksWithResult.length; i++) {
    const [id, pick] = picksWithResult[i];
    const result = resultMap[String(pick.fixtureId)];
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

    let clv = null;
    try {
      const closingOdds = clvOdds[i];
      if (closingOdds?.length > 0) {
        const bm = closingOdds[0]?.bookmakers?.[0];
        const bet = bm?.bets?.find(b => b.id === 1);
        if (bet) {
          const closingOdd = parseFloat(
            bet.values?.find(v =>
              (p === '1' && v.value === 'Home') ||
              (p === 'X' && v.value === 'Draw') ||
              (p === '2' && v.value === 'Away')
            )?.odd || 0
          );
          if (closingOdd > 1 && pick.odds > 1) {
            clv = parseFloat(((pick.odds / closingOdd - 1) * 100).toFixed(1));
          }
        }
      }
    } catch(e) {}

    picks[id] = {
      ...pick,
      score: `${hg}-${ag}`,
      status: won ? 'win' : 'lose',
      processed: true,
      verifiedAt: new Date().toISOString(),
      clv,
    };

    try { await saveCLV(pick, clv, won, env); } catch(e) { console.error('[SB] CLV fout:', e.message); }
    updated++;
    updatedIds.push(id);
  }

  if (updated > 0) {
    await fb(env, 'picks', 'PUT', picks);
    console.log(`[Verify] ${updated} picks gesetteld`);
    await updateLeagueCalibration(env, picks, updatedIds);
  }
}

// ── League calibratie bijwerken na settlement ─────────────
async function updateLeagueCalibration(env, picks, updatedIds) {
  try {
    const calibration = await fb(env, 'calibration') || {};

    updatedIds.forEach(id => {
      const pick = picks[id];
      if (!pick || pick.status === 'pending') return;

      const leagueId = String(pick.leagueId || 'unknown');
      if (!calibration[leagueId]) {
        calibration[leagueId] = {
          leagueName: pick.leagueName || '',
          wins: 0, total: 0, roi: 0,
          avgValue: 0, avgConf: 0,
          clvSum: 0, clvCount: 0,
          factor: 1.0,
          lastUpdated: new Date().toISOString()
        };
      }

      const cal = calibration[leagueId];
      cal.total++;
      if (pick.status === 'win') {
        cal.wins++;
        cal.roi += (pick.odds - 1) * 100;
      } else {
        cal.roi -= 100;
      }
      cal.avgValue = ((cal.avgValue * (cal.total - 1)) + (pick.value || 0)) / cal.total;
      cal.avgConf  = ((cal.avgConf  * (cal.total - 1)) + (pick.confidence || 5)) / cal.total;

      if (pick.clv !== null && pick.clv !== undefined) {
        cal.clvSum += pick.clv;
        cal.clvCount++;
      }

      if (cal.total >= 5) {
        const actualHitrate  = cal.wins / cal.total;
        const expectedHitrate = 1 / (cal.avgValue / 100 + 1) * (1 + cal.avgConf / 10);
        const ratio = actualHitrate / Math.max(0.1, expectedHitrate);
        cal.factor = parseFloat(Math.max(0.70, Math.min(1.30,
          cal.factor * 0.8 + ratio * 0.2
        )).toFixed(3));
      }

      cal.lastUpdated = new Date().toISOString();
      calibration[leagueId] = cal;
    });

    await fb(env, 'calibration', 'PUT', calibration);
    console.log('[Calibratie] Bijgewerkt voor', updatedIds.length, 'picks');
  } catch(e) {
    console.error('[Calibratie] Fout:', e.message);
  }
}

// ── Weekly calibratie job (zondag 06:00 UTC) ─────────────
async function runWeeklyCalibration(env) {
  console.log('[WeeklyCalib] Start wekelijkse calibratie...');
  try {
    const calibration = await fb(env, 'calibration') || {};
    const picks = await fb(env, 'picks') || {};

    const leagueStats = {};
    Object.values(picks).forEach(p => {
      if (p.status === 'pending') return;
      const lid = String(p.leagueId || 'unknown');
      if (!leagueStats[lid]) leagueStats[lid] = { wins: 0, total: 0, roi: 0, name: p.leagueName || '' };
      leagueStats[lid].total++;
      if (p.status === 'win') {
        leagueStats[lid].wins++;
        leagueStats[lid].roi += (p.odds - 1) * 100;
      } else {
        leagueStats[lid].roi -= 100;
      }
    });

    Object.entries(leagueStats).forEach(([lid, stats]) => {
      if (stats.total < 5) return;
      const hitrate = stats.wins / stats.total;
      const avgRoi = stats.roi / stats.total;
      const roiFactor = 1 + (avgRoi / 1000);
      const newFactor = parseFloat(Math.max(0.70, Math.min(1.30, roiFactor)).toFixed(3));

      if (!calibration[lid]) calibration[lid] = { leagueName: stats.name };
      calibration[lid].factor = newFactor;
      calibration[lid].historicalHitrate = parseFloat((hitrate * 100).toFixed(1));
      calibration[lid].historicalRoi = parseFloat((avgRoi).toFixed(1));
      calibration[lid].totalPicks = stats.total;
      calibration[lid].weeklyUpdatedAt = new Date().toISOString();
    });

    await fb(env, 'calibration', 'PUT', calibration);
    console.log(`[WeeklyCalib] ${Object.keys(leagueStats).length} leagues gecalibreerd`);

    const totalPicks = Object.values(picks).filter(p => p.status !== 'pending').length;
    const wins = Object.values(picks).filter(p => p.status === 'win').length;
    const hitrate = totalPicks > 0 ? Math.round(wins / totalPicks * 100) : 0;
    await sendPushNotification(env,
      `📊 Wekelijkse calibratie klaar`,
      `${totalPicks} picks · ${hitrate}% hitrate · ${Object.keys(leagueStats).length} leagues bijgewerkt`
    );
  } catch(e) {
    console.error('[WeeklyCalib] Fout:', e.message);
  }
}

// ── Scheduled value scan ─────────────────────────────────
async function runScan(env, force = false) {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const hour = now.getUTCHours() + 1;

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

  if (!autoScanEnabled && !force) {
    console.log('[Scan] Auto scan uitgeschakeld via scan_schedule, skip');
    return;
  }

  if (!force && (hour < scanFrom || hour >= scanTo)) {
    console.log(`[Scan] Buiten scanvenster (${hour}:00 UTC, venster ${scanFrom}:00-${scanTo}:00 UTC), skip`);
    return;
  }
  if (force) console.log(`[Scan] Handmatige trigger — autoScan en scanvenster overgeslagen`);
  console.log(`[Scan] Start scan (${hour}:00 UTC, venster ${scanFrom}:00-${scanTo}:00 UTC)`);

  let allMatches = [];

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  console.log(`[Scan] Fixtures ophalen voor ${today} en ${tomorrowStr}...`);

  // ── Actieve leagues (handmatig bijgehouden) ───────────────
  // WK: 11 jun – 19 jul 2026 (league 1)
  // Scandinavisch: lopen maart–december door (kleine pauze WK-periode)
  // CL/EL/ECL finales: t/m eind mei
  const dateNow = new Date(today);
  const wkStart = new Date('2026-06-11');
  const wkEnd   = new Date('2026-07-20');
  const isWKActive = dateNow >= wkStart && dateNow < wkEnd;

  let leagueConfig;
  if (isWKActive) {
    // Alleen WK
    leagueConfig = [{ id: 1, s: 2026 }];
    console.log('[Scan] 🏆 WK actief — alleen WK (ID 1)');
  } else {
    // Actieve competities buiten WK-periode:
    // 88 Eredivisie playoffs, 113 Eliteserien NO, 113→ check, 
    // 103 Allsvenskan SE, 2/3/848 CL/EL/ECL (t/m eind mei)
    leagueConfig = [
      { id: 1,   s: 2026 }, // WK 2026 (pre/post WK wedstrijden)
      { id: 113, s: 2026 }, // Eliteserien Noorwegen (mrt–dec)
      { id: 103, s: 2026 }, // Allsvenskan Zweden (apr–nov)
      { id: 2,   s: 2026 }, // Champions League
      { id: 3,   s: 2026 }, // Europa League
      { id: 848, s: 2026 }, // Conference League
      { id: 88,  s: 2025 }, // Eredivisie (playoffs)
    ];
    console.log('[Scan] Actieve leagues: WK + Scandinavisch + Europees');
  }

  const SCAN_LEAGUES = leagueConfig.map(l => l.id);

  try {
    // Haal vandaag + morgen op — MLS/Brasileirao spelen 's nachts NL-tijd
    const fixturePromises = leagueConfig.flatMap(({ id, s }) => [
      apif(`/fixtures?league=${id}&season=${s}&date=${today}&timezone=Europe/Amsterdam`, env),
      apif(`/fixtures?league=${id}&season=${s}&date=${tomorrowStr}&timezone=Europe/Amsterdam`, env),
    ]);
    const fixtureResults = await Promise.all(fixturePromises);
    const fixtures = fixtureResults.flat().filter(Boolean);

    const seen = new Set();
    const unique = fixtures.filter(f => {
      const id = f.fixture?.id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    console.log(`[Scan] ${unique.length} unieke fixtures gevonden over ${SCAN_LEAGUES.length} leagues`);

    const nowMs = Date.now();
    // Bij handmatige scan: alle wedstrijden van vandaag (tot midnight +1u)
    // Bij automatische scan: alleen wedstrijden die binnen 4u beginnen
    const endOfDay = new Date(today + 'T23:59:59').getTime() + 60 * 60 * 1000;
    // Automatische scan: wedstrijden binnen 24u (vandaag + vanavond + morgenochtend)
    // Handmatige scan (force): alle wedstrijden van vandaag t/m midnight
    const timeWindow = force ? endOfDay : nowMs + 24 * 60 * 60 * 1000;

    allMatches = unique
      .filter(f => {
        const status = f.fixture?.status?.short;
        const kickoff = f.fixture?.date ? new Date(f.fixture.date).getTime() : 0;
        const isLive = ['1H','2H','HT','ET','BT','P'].includes(status);
        const isNS = ['NS','TBD','PST'].includes(status);
        return isLive || (isNS && kickoff > nowMs - 60 * 60 * 1000 && kickoff < timeWindow);
      })
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

    console.log(`[Scan] ${allMatches.length} wedstrijden na filter (NS/live)`);
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

  const batch = allMatches.slice(0, 8);
  console.log(`[Scan] ${batch.length} wedstrijden gevonden, odds ophalen...`);

  const fixtureIds = batch.map(m => m.fixtureId).filter(Boolean);
  const oddsMap = await fetchOddsForFixtures(fixtureIds, env);
  console.log(`[Scan] Odds gevonden voor ${Object.keys(oddsMap).length} wedstrijden`);

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

  let sharpSignals = {};
  try {
    await saveOddsSnapshots(oddsMap, batch, env);
    sharpSignals = await detectSharpMoney(oddsMap, batch, env) || {};
  } catch(e) {
    console.error('[SB] fout (non-fatal):', e.message);
  }

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
  const todayHistory = await fb(env, `odds_history/${today}`) || {};
  const leagueCalibration = await fb(env, 'calibration') || {};
  console.log(`[Scan] ${Object.keys(leagueCalibration).length} league calibraties geladen`);

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
      if (value < 3) return;

      const openOdds = openingOdds ? openingOdds[c.pick === '1' ? 'home' : c.pick === 'X' ? 'draw' : 'away'] : null;
      const movement = calcOddsMovement(openOdds, c.bookOdds);
      const sharpBoost = sharpSignals?.[m.fixtureId]?.[c.pick];
      const marketSignal = sharpBoost
        ? Math.min(95, calcMarketSignal(movement, c.pick) + 15)
        : calcMarketSignal(movement, c.pick);

      const spread = Math.max(ai.h, ai.x, ai.a) - Math.min(ai.h, ai.x, ai.a);
      const dataQuality = Math.min(100, 50 + spread);

      const conf = calculateConfidenceV20({
        modelProb: c.aiKans,
        value,
        dataQuality,
        marketSignal,
        leagueId: m.leagueId,
        odds: c.bookOdds,
        calibFactor: leagueCalibration[String(m.leagueId)]?.factor || null,
      });

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
          matchDate: m.matchDate || today,
          matchTime: m.matchTime,
          leagueId: m.leagueId,
          leagueName: m.leagueName,
          pick: c.pick,
          pickLabel: c.label,
          odds: c.bookOdds,
          value: parseFloat(value.toFixed(1)),
          aiKans: Math.round(c.aiKans),
          confidence: conf.score,
          confidenceRaw: conf.raw,
          confidenceFinal: conf.final,
          leagueFactor: conf.leagueFactor,
          bucketFactor: conf.bucketFactor,
          oddsMovement: movement,
          marketSignal,
          elite,
          calibFactor: leagueCalibration[String(m.leagueId)]?.factor || null,
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

  const elitePicks = Object.values(newPicks).filter(p => p.elite);
  const lockPicks = Object.values(newPicks).filter(p => p.lockLevel === 'triple' || p.lockLevel === 'double');
  const pushPicks = elitePicks.length > 0 ? elitePicks : lockPicks;

  if (elitePicks.length > 0) {
    console.log(`[Scan] ${elitePicks.length} elite picks gevonden!`);
  }

  if (pushPicks.length > 0) {
    const top = pushPicks.sort((a, b) => (b.value || 0) - (a.value || 0))[0];
    const icon = top.lockLevel === 'triple' ? '🔒🔒🔒' : top.elite ? '⭐' : '🔒🔒';
    const title = top.elite
      ? `${icon} Elite pick gevonden!`
      : `${icon} ${top.lockLevel === 'triple' ? 'Triple' : 'Double'} Lock gevonden!`;
    const body = `${top.matchName} · ${top.pickLabel} @ ${top.odds} · +${Math.round(top.value)}% value`;
    await sendPushNotification(env, title, body, {
      type: 'value_alert',
      matchId: String(top.fixtureId),
      pick: top.pick,
      value: top.value,
      lockLevel: top.lockLevel,
    });
  } else if (newCount > 0) {
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

// ── Scan test: test automatische scan pipeline — GEEN Firebase write ─────────
// Default: Eliteserien NO (113) + Allsvenskan SE (103), beide seizoen 2026
// Gebruik: /scan-test?token=HMAC&league=113,103
// Geeft volledige verbose output: fixtures, odds, AI, value picks, verdict
async function runScanTest(env, leagueIds = [113, 103]) {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Seizoen-aware: Scandinavische + WK competities = 2026
  const SEASON_2026 = new Set([1, 2, 3, 113, 103, 71, 253, 128, 848]);
  const getSeason = (lid) => SEASON_2026.has(lid) ? 2026 : 2025;

  const log = [`[ScanTest] Start — leagues: ${leagueIds.join(', ')}, datum: ${today} + ${tomorrowStr}`];

  // ── Stap 1: Fixtures ophalen (vandaag + morgen) ──
  const allFixtures = [];
  const seen = new Set();

  await Promise.all(leagueIds.flatMap(lid => {
    const season = getSeason(lid);
    log.push(`[ScanTest] League ${lid} → seizoen ${season}`);
    return [today, tomorrowStr].map(date =>
      apif(`/fixtures?league=${lid}&season=${season}&date=${date}&timezone=Europe/Amsterdam`, env)
        .then(fixtures => {
          (fixtures || []).forEach(f => {
            const id = f.fixture?.id;
            if (id && !seen.has(id)) { seen.add(id); allFixtures.push(f); }
          });
        })
        .catch(e => log.push(`[ScanTest] Fixtures fout league ${lid} ${date}: ${e.message}`))
    );
  }));

  log.push(`[ScanTest] ${allFixtures.length} unieke fixtures gevonden`);

  // ── Stap 2: Filter — NS/live, binnen tijdvenster ──
  const nowMs = Date.now();
  // scan-test = altijd force mode: alle wedstrijden vandaag+morgen
  const endOfTomorrow = new Date(tomorrowStr + 'T23:59:59').getTime() + 60 * 60 * 1000;

  const allMatches = allFixtures
    .filter(f => {
      const status  = f.fixture?.status?.short;
      const kickoff = f.fixture?.date ? new Date(f.fixture.date).getTime() : 0;
      const isLive  = ['1H','2H','HT','ET','BT','P'].includes(status);
      const isNS    = ['NS','TBD','PST'].includes(status);
      return isLive || (isNS && kickoff < endOfTomorrow);
    })
    .map(f => ({
      fixtureId:  f.fixture?.id,
      home:       f.teams?.home?.name  || '?',
      away:       f.teams?.away?.name  || '?',
      matchDate:  f.fixture?.date?.split('T')[0] || today,
      matchTime:  f.fixture?.date || null,
      leagueId:   f.league?.id,
      leagueName: f.league?.name || '',
      status:     f.fixture?.status?.short || 'NS',
    }))
    .sort((a, b) => new Date(a.matchTime || 0) - new Date(b.matchTime || 0));

  log.push(`[ScanTest] ${allMatches.length} wedstrijden na NS/live filter`);

  if (!allMatches.length) {
    return {
      ok: true, leagues: leagueIds, today, tomorrow: tomorrowStr,
      matchesFound: 0, withOdds: 0, aiResultsCount: 0,
      picks: [], allMatches: [], log,
      verdict: '⚠️ Geen wedstrijden gevonden — controleer seizoen en leagueId',
      note: '⚠️ TEST — geen Firebase write'
    };
  }

  // ── Stap 3: Odds ophalen (zelfde functie als productie, incl. Scandinavische bookmaker fallbacks) ──
  const batch = allMatches.slice(0, 10);
  const fixtureIds = batch.map(m => m.fixtureId).filter(Boolean);
  const oddsMap = await fetchOddsForFixtures(fixtureIds, env);
  log.push(`[ScanTest] Odds: ${Object.keys(oddsMap).length}/${batch.length} fixtures gedekt`);
  batch.forEach(m => {
    const o = oddsMap[m.fixtureId];
    log.push(`[ScanTest]   ${m.home} vs ${m.away} (${m.matchDate}) → ${o ? `${o.home}/${o.draw}/${o.away}` : 'geen odds'}`);
  });

  // ── Stap 4: AI analyse (zelfde prompt als productie) ──
  const analyseBatch = batch.filter(m => oddsMap[m.fixtureId]);
  const analyseBatchFull = analyseBatch.length > 0 ? analyseBatch : batch;

  const prompt = `Je bent een voetbalanalyst. Analyseer deze ${analyseBatchFull.length} wedstrijden en geef voor ELKE wedstrijd:
1. Kans thuisploeg wint (0-100)
2. Kans gelijkspel (0-100)
3. Kans uitploeg wint (0-100)
4. Confidence in analyse (1-10)

Houd rekening met: recente vorm, historische H2H, thuisvoordeel, competitieniveau.

Wedstrijden:
${analyseBatchFull.map((m, i) => {
  const odds = oddsMap[m.fixtureId];
  const oddsStr = odds ? ` | Odds: ${odds.home}/${odds.draw}/${odds.away}` : ' | geen odds';
  return `${i+1}. ${m.home} vs ${m.away} (${m.leagueName}, ${m.matchDate})${oddsStr}`;
}).join('\n')}

Antwoord ALLEEN met een JSON array: [{"h":50,"x":25,"a":25,"c":7},...]
Exact ${analyseBatchFull.length} objecten, zelfde volgorde.`;

  let aiResults = [];
  let aiError = null;
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
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const aiData = await aiRes.json();
    const text = aiData?.content?.[0]?.text || '[]';
    const matchArr = text.match(/\[[\s\S]*?\]/);
    if (matchArr) {
      aiResults = JSON.parse(matchArr[0]);
      log.push(`[ScanTest] AI: ${aiResults.length} resultaten ontvangen`);
    } else {
      aiError = 'Geen JSON array in AI response: ' + text.substring(0, 120);
      log.push(`[ScanTest] AI FOUT: ${aiError}`);
    }
  } catch(e) {
    aiError = e.message;
    log.push(`[ScanTest] AI FOUT: ${e.message}`);
  }

  // ── Stap 5: Value berekening (zelfde logica als productie, maar geen Firebase write) ──
  const leagueCalibration = await fb(env, 'calibration') || {};
  const picks = [];

  analyseBatchFull.forEach((m, i) => {
    const ai   = aiResults[i] || { h: 50, x: 25, a: 25, c: 5 };
    const odds = oddsMap[m.fixtureId] || {};

    [
      { pick: '1', label: `${m.home} wint`, aiKans: ai.h, bookOdds: odds.home },
      { pick: 'X', label: 'Gelijkspel',     aiKans: ai.x, bookOdds: odds.draw },
      { pick: '2', label: `${m.away} wint`,  aiKans: ai.a, bookOdds: odds.away },
    ].forEach(c => {
      if (!c.bookOdds || c.bookOdds <= 1) return;
      const value = calculateValue(c.aiKans, c.bookOdds, c.pick);
      if (value < 3) return;

      const spread      = Math.max(ai.h, ai.x, ai.a) - Math.min(ai.h, ai.x, ai.a);
      const dataQuality = Math.min(100, 50 + spread);
      const conf = calculateConfidenceV20({
        modelProb: c.aiKans, value, dataQuality,
        marketSignal: 50,
        leagueId: m.leagueId,
        odds: c.bookOdds,
        calibFactor: leagueCalibration[String(m.leagueId)]?.factor || null,
      });

      if (conf.score < 5) return;

      picks.push({
        match:      `${m.home} vs ${m.away}`,
        leagueName: m.leagueName,
        matchDate:  m.matchDate,
        pick:       c.pick,
        pickLabel:  c.label,
        odds:       c.bookOdds,
        value:      parseFloat(value.toFixed(1)),
        aiKans:     Math.round(c.aiKans),
        confidence: conf.score,
        confidenceFinal: conf.final,
        elite:      isElitePick({ confidenceFinal: conf.final, value, odds: c.bookOdds }),
      });
    });
  });

  picks.sort((a, b) => b.value - a.value);

  const strongPicks  = picks.filter(p => p.value >= 5 && p.confidence >= 5);
  const elitePicks   = picks.filter(p => p.elite);
  log.push(`[ScanTest] ${picks.length} value picks (≥3%), ${strongPicks.length} sterk (≥5%), ${elitePicks.length} elite`);

  const verdict = elitePicks.length > 0
    ? `✅ ${elitePicks.length} elite pick(s) — pipeline werkt, klaar voor productie`
    : strongPicks.length > 0
      ? `✅ ${strongPicks.length} sterke picks (≥5% value, conf≥5) — pipeline werkt correct`
      : picks.length > 0
        ? `⚠️ ${picks.length} zwakke picks (≥3%) — odds mogelijk te efficiënt vandaag`
        : Object.keys(oddsMap).length === 0
          ? `⚠️ Geen odds — bookmakers hebben nog geen quotes voor deze wedstrijden`
          : `ℹ️ Geen value gevonden — markt efficiënt vandaag`;

  return {
    ok:              true,
    leagues:         leagueIds,
    today,
    tomorrow:        tomorrowStr,
    matchesFound:    allMatches.length,
    matchesAnalysed: analyseBatchFull.length,
    withOdds:        Object.keys(oddsMap).length,
    aiResultsCount:  aiResults.length,
    aiError:         aiError || null,
    totalPicks:      picks.length,
    strongPicks:     strongPicks.length,
    elitePicks:      elitePicks.length,
    picks:           picks.slice(0, 15),
    allMatches:      batch.map(m => ({
      fixtureId: m.fixtureId,
      match:     `${m.home} vs ${m.away}`,
      league:    m.leagueName,
      date:      m.matchDate,
      status:    m.status,
      hasOdds:   !!oddsMap[m.fixtureId],
      odds:      oddsMap[m.fixtureId] || null,
    })),
    log,
    verdict,
    note: '⚠️ TEST — geen picks opgeslagen in Firebase',
  };
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
// DAGELIJKSE AI TIP
// ═══════════════════════════════════════════════════════

async function generateDailyTip(env) {
  console.log('[DailyTip] Genereren dagelijkse tip...');
  const today = new Date().toISOString().split('T')[0];

  try {
    const existing = await fb(env, 'daily_tip/latest');
    if (existing?.date === today) {
      console.log('[DailyTip] Al een tip voor vandaag:', today);
      return;
    }
  } catch(e) {}

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
        model: 'claude-sonnet-4-20250514',
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
      android_sound: 'notification',
      ios_sound: 'notification.wav',
      ttl: 3600,
      priority: 10,
      large_icon: 'https://toto-ai.app/icon-192.png',
      chrome_web_icon: 'https://toto-ai.app/icon-192.png',
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

    if (path === '/settle') {
      const token = url.searchParams.get('token');
      if (!await verifyHMAC(token, env.SCAN_SECRET)) {
        return json({ error: 'Unauthorized' }, 401);
      }
      await verifyYesterdayPicks(env);
      return json({ status: 'settlement klaar', version: VERSION });
    }

    if (path === '/scan') {
      const token = url.searchParams.get('token');
      if (!await verifyHMAC(token, env.SCAN_SECRET)) {
        return json({ error: 'Unauthorized' }, 401);
      }
      await runScan(env, true);
      return json({ status: 'scan klaar', version: VERSION });
    }

    if (path === '/debug-scan') {
      const token = url.searchParams.get('token');
      if (!await verifyHMAC(token, env.SCAN_SECRET)) return json({ error: 'Unauthorized' }, 401);
      const log = [];
      try {
        const schedule = await fb(env, 'scan_schedule');
        log.push({ step: 'scan_schedule', value: schedule });
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        log.push({ step: 'dates', today, tomorrowStr });

        // Test 1 league (MLS vandaag)
        const mlsToday = await apif(`/fixtures?league=253&season=2026&date=${today}&timezone=Europe/Amsterdam`, env);
        log.push({ step: 'mls_today', count: mlsToday?.length, statuses: mlsToday?.map(f => f.fixture?.status?.short) });
        const mlsTomorrow = await apif(`/fixtures?league=253&season=2026&date=${tomorrowStr}&timezone=Europe/Amsterdam`, env);
        log.push({ step: 'mls_tomorrow', count: mlsTomorrow?.length, statuses: mlsTomorrow?.map(f => f.fixture?.status?.short) });

        // Test Brasileirao
        const bra = await apif(`/fixtures?league=71&season=2026&date=${today}&timezone=Europe/Amsterdam`, env);
        log.push({ step: 'brasileirao_today', count: bra?.length, statuses: bra?.map(f => f.fixture?.status?.short) });
        const braTomorrow = await apif(`/fixtures?league=71&season=2026&date=${tomorrowStr}&timezone=Europe/Amsterdam`, env);
        log.push({ step: 'brasileirao_tomorrow', count: braTomorrow?.length, statuses: braTomorrow?.map(f => f.fixture?.status?.short) });

        // Test Argentina
        const arg = await apif(`/fixtures?league=128&season=2026&date=${today}&timezone=Europe/Amsterdam`, env);
        log.push({ step: 'argentina_today', count: arg?.length });
      } catch(e) {
        log.push({ step: 'ERROR', error: e.message });
      }
      return json({ debug: log, version: VERSION });
    }

    if (path === '/check-odds') {
      // Test welke bookmakers odds hebben voor een fixture
      // Gebruik: /check-odds?fixture=1490324
      const fixtureId = url.searchParams.get('fixture');
      if (!fixtureId) return json({ error: 'fixture parameter verplicht' }, 400);
      const BOOKMAKERS = [
        { id: 1,  name: 'Marathonbet' },
        { id: 4,  name: 'Bwin' },
        { id: 6,  name: 'William Hill' },
        { id: 8,  name: 'Bet365' },
        { id: 10, name: 'Unibet' },
        { id: 16, name: 'Betfair' },
        { id: 18, name: 'Pinnacle' },
        { id: 36, name: 'Betsson' },
        { id: 44, name: 'NordicBet' },
        { id: 54, name: 'Betway' },
      ];
      const results = await Promise.all(
        BOOKMAKERS.map(async bm => {
          try {
            const data = await apif(`/odds?fixture=${fixtureId}&bookmaker=${bm.id}&bet=1`, env);
            const bet = data?.[0]?.bookmakers?.[0]?.bets?.find(b => b.id === 1);
            const home = parseFloat(bet?.values?.find(v => v.value === 'Home')?.odd || 0);
            const draw = parseFloat(bet?.values?.find(v => v.value === 'Draw')?.odd || 0);
            const away = parseFloat(bet?.values?.find(v => v.value === 'Away')?.odd || 0);
            const hasOdds = home > 1;
            return { ...bm, hasOdds, odds: hasOdds ? { home, draw, away } : null };
          } catch(e) {
            return { ...bm, hasOdds: false, error: e.message };
          }
        })
      );
      const withOdds = results.filter(r => r.hasOdds);
      return json({ fixture: fixtureId, found: withOdds.length, bookmakers: results, version: VERSION });
    }

    if (path === '/keepalive') {
      try {
        const result = await sb(env, 'clv_results', 'GET', null, '?limit=1&select=id');
        return json({ ok: true, supabase: result !== null ? 'online' : 'geen data', version: VERSION });
      } catch(e) {
        return json({ ok: false, error: e.message }, 500);
      }
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

    if (path === '/analytics') {
      return handleAnalytics(env);
    }

    if (path === '/push') {
      return handlePush(request, env);
    }

    if (path === '/scan-test') {
      const token = url.searchParams.get('token');
      if (!await verifyHMAC(token, env.SCAN_SECRET)) return json({ error: 'Unauthorized' }, 401);
      // ?league=113,103 of enkel ?league=113
      // Default: Eliteserien NO (113) + Allsvenskan SE (103)
      const leagueParam = url.searchParams.get('league') || '113,103';
      const leagueIds = leagueParam.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
      const result = await runScanTest(env, leagueIds);
      return json(result);
    }

    if (url.searchParams.get('url')) {
      return handleProxy(url.searchParams.get('url'), request, env);
    }

    return json({
      version: VERSION,
      status: 'running',
      routes: ['/apif/*', '/fd/*', '/anthropic', '/picks', '/scan', '/scan-test', '/settle', '/debug-scan', '/check-odds', '/keepalive', '/push', '/daily-tip', '/analytics', '?url=']
    });
  },

  async scheduled(event, env, ctx) {
    const now = new Date();
    const hour = now.getUTCHours();
    const isSunday = now.getUTCDay() === 0;
    ctx.waitUntil((async () => {
      await runScan(env);
      await verifyYesterdayPicks(env);
      if (hour === 6) await generateDailyTip(env);
      if (isSunday && hour === 6) await runWeeklyCalibration(env);
    })());
  }
};
