// TOTO AI WORKER v41
// Scheduled scan: dagelijks 08:00 + 14:00 Amsterdam
// Push notificaties via OneSignal bij value ≥ 10% + confidence ≥ 7

const VERSION = 'v41';
const FB_DB   = 'https://toto-ai-397cb-default-rtdb.europe-west1.firebasedatabase.app';
const WORKER_URL = 'https://toto-proxy.zweetzakken.workers.dev';

// Competities die we scannen (API-Football IDs)
const LEAGUES = [
  { id: 88,  name: 'Eredivisie',       season: 2024 },
  { id: 39,  name: 'Premier League',   season: 2024 },
  { id: 78,  name: 'Bundesliga',       season: 2024 },
  { id: 61,  name: 'Ligue 1',          season: 2024 },
  { id: 135, name: 'Serie A',          season: 2024 },
  { id: 140, name: 'La Liga',          season: 2024 },
  { id: 2,   name: 'Champions League', season: 2024 },
  { id: 144, name: 'Jupiler Pro',      season: 2024 },
];

// Value drempel voor push notificatie
const PUSH_MIN_VALUE      = 10;   // minimaal 10% value
const PUSH_MIN_CONFIDENCE = 7;    // minimaal 7/10 confidence
const MAX_MATCHES_PER_SCAN = 20;  // max wedstrijden per scan (kosten beperken)

// ═══════════════════════════════════════════
// FIREBASE HELPERS
// ═══════════════════════════════════════════

async function fbGet(env, path) {
  try {
    const r = await fetch(`${FB_DB}/${path}.json?auth=${env.FB_API_KEY}`);
    return await r.json();
  } catch (e) { return null; }
}

async function fbSet(env, path, data) {
  try {
    await fetch(`${FB_DB}/${path}.json?auth=${env.FB_API_KEY}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch (e) { console.error('FB write error:', e); }
}

async function fbPush(env, path, data) {
  try {
    await fetch(`${FB_DB}/${path}.json?auth=${env.FB_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch (e) { console.error('FB push error:', e); }
}

// ═══════════════════════════════════════════
// API-FOOTBALL HELPERS
// ═══════════════════════════════════════════

async function apif(env, endpoint) {
  try {
    const r = await fetch(`https://v3.football.api-sports.io${endpoint}`, {
      headers: { 'x-rapidapi-key': env.API_FOOTBALL, 'x-rapidapi-host': 'v3.football.api-sports.io' },
      signal: AbortSignal.timeout(10000)
    });
    return await r.json();
  } catch (e) {
    console.error('APIF error:', endpoint, e.message);
    return null;
  }
}

// Haal wedstrijden van vandaag op voor een competitie
async function fetchFixtures(env, leagueId, season) {
  const today = new Date().toISOString().split('T')[0];
  const data = await apif(env, `/fixtures?league=${leagueId}&season=${season}&date=${today}&status=NS`);
  return data?.response || [];
}

// Haal odds op voor een fixture
async function fetchOdds(env, fixtureId) {
  const data = await apif(env, `/odds?fixture=${fixtureId}&bookmaker=8`); // bookmaker 8 = Bet365
  const markets = data?.response?.[0]?.bookmakers?.[0]?.bets;
  if (!markets) return null;
  const match = markets.find(b => b.name === 'Match Winner');
  if (!match) return null;
  const o1 = parseFloat(match.values.find(v => v.value === 'Home')?.odd);
  const oX = parseFloat(match.values.find(v => v.value === 'Draw')?.odd);
  const o2 = parseFloat(match.values.find(v => v.value === 'Away')?.odd);
  if (!o1 || !oX || !o2) return null;
  return { home: o1, draw: oX, away: o2 };
}

// Haal statistieken op (voor Poisson)
async function fetchStats(env, teamId, leagueId, season) {
  const data = await apif(env, `/teams/statistics?team=${teamId}&league=${leagueId}&season=${season}`);
  const s = data?.response;
  if (!s) return null;
  const played = s.fixtures?.played?.total || 0;
  if (played < 3) return null;
  return {
    goalsFor:     (s.goals?.for?.total?.total  || 0) / played,
    goalsAgainst: (s.goals?.against?.total?.total || 0) / played,
    played
  };
}

// ═══════════════════════════════════════════
// POISSON BEREKENING
// ═══════════════════════════════════════════

function poissonProb(lambda, k) {
  // P(X = k) = e^-λ * λ^k / k!
  let prob = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) prob *= lambda / i;
  return prob;
}

function calcPoisson(homeStats, awayStats, leagueAvg = 1.35) {
  if (!homeStats || !awayStats) return null;
  // Verwachte doelpunten via Dixon-Coles benadering
  const homeAttack  = homeStats.goalsFor   / leagueAvg;
  const homeDefense = homeStats.goalsAgainst / leagueAvg;
  const awayAttack  = awayStats.goalsFor   / leagueAvg;
  const awayDefense = awayStats.goalsAgainst / leagueAvg;
  const lambdaHome  = homeAttack * awayDefense * leagueAvg * 1.1; // thuis voordeel
  const lambdaAway  = awayAttack * homeDefense * leagueAvg;

  let home = 0, draw = 0, away = 0;
  for (let h = 0; h <= 6; h++) {
    for (let a = 0; a <= 6; a++) {
      const p = poissonProb(lambdaHome, h) * poissonProb(lambdaAway, a);
      if (h > a) home += p;
      else if (h === a) draw += p;
      else away += p;
    }
  }
  const total = home + draw + away;
  return {
    k1: Math.round(home / total * 100),
    kX: Math.round(draw / total * 100),
    k2: Math.round(away / total * 100),
    lambdaHome: lambdaHome.toFixed(2),
    lambdaAway: lambdaAway.toFixed(2),
    valid: true
  };
}

// ═══════════════════════════════════════════
// VIG-CORRECTIE + VALUE BEREKENING
// ═══════════════════════════════════════════

function calcValue(aiKans, odds, homeOdds, drawOdds, awayOdds) {
  const kans = aiKans / 100;
  const o = parseFloat(odds);
  if (!o || o <= 1) return 0;
  // Vig-correctie: bereken fair odds
  let fairOdds = o;
  if (homeOdds > 1 && drawOdds > 1 && awayOdds > 1) {
    const overround = 1/homeOdds + 1/drawOdds + 1/awayOdds;
    const vigFactor = Math.min(1.08, Math.max(1.01, overround));
    fairOdds = o / vigFactor;
  }
  return (kans * fairOdds - 1) * 100;
}

// ═══════════════════════════════════════════
// AI ANALYSE
// ═══════════════════════════════════════════

async function analyzeWithAI(env, matches) {
  const ctx = matches.map((m, i) => {
    let line = `${i+1}. ID:${m.fixtureId} | ${m.home} vs ${m.away} | ${m.league} | Quotes: 1=${m.odds.home} X=${m.odds.draw} 2=${m.odds.away}`;
    if (m.poisson?.valid) {
      line += `\n   📐 Poisson: 1=${m.poisson.k1}% X=${m.poisson.kX}% 2=${m.poisson.k2}%`;
    }
    return line;
  }).join('\n\n');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        temperature: 0,
        system: `Je bent een value-betting analist. Gebruik Poisson als anker.
Confidence DEFINITIE: 9-10=Poisson+data consistent, 7-8=goed data, 5-6=beperkt, <5=weinig data.
Geef NOOIT confidence 9-10 zonder Poisson data.
RESPOND WITH VALID JSON ONLY. START WITH { END WITH }. NO TEXT BEFORE OR AFTER.
{"scans":[{"id":"123","kans1":45,"kansX":30,"kans2":25,"confidence":7,"reason":"Max 12 woorden"}]}`,
        messages: [{ role: 'user', content: `Analyseer ${matches.length} wedstrijden:\n\n${ctx}` }]
      }),
      signal: AbortSignal.timeout(45000)
    });

    const data = await res.json();
    const text = data?.content?.[0]?.text?.trim() || '';
    const s = text.indexOf('{'), e = text.lastIndexOf('}');
    if (s < 0 || e < s) return [];
    const result = JSON.parse(text.substring(s, e + 1));
    return result.scans || [];
  } catch (err) {
    console.error('AI error:', err.message);
    return [];
  }
}

// ═══════════════════════════════════════════
// PUSH VIA ONESIGNAL
// ═══════════════════════════════════════════

async function sendPushNotification(env, picks) {
  if (!picks.length || !env.ONESIGNAL_APP_ID || !env.ONESIGNAL_API_KEY) return;

  // Stuur maximaal 1 push (beste pick) om spam te voorkomen
  const best = picks[0];
  const valueSign = best.value > 0 ? '+' : '';

  try {
    await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${env.ONESIGNAL_API_KEY}`
      },
      body: JSON.stringify({
        app_id: env.ONESIGNAL_APP_ID,
        included_segments: ['All'],
        headings: { nl: `🎯 ${valueSign}${best.value.toFixed(0)}% VALUE — ${best.pick}` },
        contents: { nl: `${best.home} vs ${best.away} · quote ${best.odds?.toFixed(2)} · conf ${best.confidence}/10` },
        data: {
          type: 'value_tip',
          fixtureId: String(best.fixtureId),
          pick: best.pick,
          value: best.value
        },
        url: 'https://roblizet.github.io/Toto-AI/'
      })
    });
    console.log(`Push verstuurd: ${best.home} vs ${best.away} +${best.value.toFixed(0)}%`);
  } catch (e) {
    console.error('Push error:', e.message);
  }
}

// ═══════════════════════════════════════════
// HOOFD SCAN FUNCTIE
// ═══════════════════════════════════════════

async function runScheduledScan(env) {
  console.log(`[${VERSION}] Scheduled scan gestart: ${new Date().toISOString()}`);

  const today = new Date().toISOString().split('T')[0];
  const allMatches = [];

  // Haal wedstrijden + odds op voor alle competities (parallel, max 3 tegelijk)
  for (let i = 0; i < LEAGUES.length; i += 3) {
    const batch = LEAGUES.slice(i, i + 3);
    await Promise.all(batch.map(async (league) => {
      try {
        const fixtures = await fetchFixtures(env, league.id, league.season);
        for (const f of fixtures.slice(0, 5)) { // max 5 per competitie
          const homeId = f.teams?.home?.id;
          const awayId = f.teams?.away?.id;

          // Odds ophalen
          const odds = await fetchOdds(env, f.fixture.id);
          if (!odds) continue;
          if (Math.min(odds.home, odds.away) < 1.50) continue; // extreme favoriet overslaan

          // Stats voor Poisson (parallel)
          const [homeStats, awayStats] = await Promise.all([
            fetchStats(env, homeId, league.id, league.season),
            fetchStats(env, awayId, league.id, league.season)
          ]);
          const poisson = calcPoisson(homeStats, awayStats);

          allMatches.push({
            fixtureId: f.fixture.id,
            home:      f.teams.home.name,
            away:      f.teams.away.name,
            league:    league.name,
            leagueId:  league.id,
            date:      f.fixture.date,
            odds,
            poisson,
            homeId,
            awayId
          });
        }
      } catch (e) {
        console.error(`League ${league.id} error:`, e.message);
      }
    }));
  }

  if (!allMatches.length) {
    console.log('Geen wedstrijden gevonden voor vandaag');
    return;
  }

  console.log(`${allMatches.length} wedstrijden gevonden, AI scan starten...`);

  // AI analyse in één batch (max 20 wedstrijden)
  const candidates = allMatches.slice(0, MAX_MATCHES_PER_SCAN);
  const aiResults = await analyzeWithAI(env, candidates);

  if (!aiResults.length) {
    console.log('AI geen resultaten teruggegeven');
    return;
  }

  // Value berekenen + filteren
  const valuePicks = [];

  for (const r of aiResults) {
    const match = candidates.find(m => String(m.fixtureId) === String(r.id));
    if (!match) continue;

    const sum = (r.kans1 || 0) + (r.kansX || 0) + (r.kans2 || 0);
    if (sum < 80 || sum > 120) continue;

    // Normaliseer naar 100%
    const k1 = Math.round((r.kans1 || 0) / sum * 100);
    const kX = Math.round((r.kansX || 0) / sum * 100);
    const k2 = Math.round((r.kans2 || 0) / sum * 100);

    // Blend met Poisson als beschikbaar (65% Poisson + 35% AI)
    let bk1 = k1, bkX = kX, bk2 = k2;
    if (match.poisson?.valid) {
      bk1 = Math.round(0.65 * match.poisson.k1 + 0.35 * k1);
      bkX = Math.round(0.65 * match.poisson.kX + 0.35 * kX);
      bk2 = Math.round(0.65 * match.poisson.k2 + 0.35 * k2);
      const bs = bk1 + bkX + bk2;
      if (bs !== 100) bk1 += (100 - bs);
    }

    const picks3 = [
      { pick: '1', label: `${match.home} wint`, kans: bk1, odds: match.odds.home },
      { pick: 'X', label: 'Gelijkspel',          kans: bkX, odds: match.odds.draw },
      { pick: '2', label: `${match.away} wint`,  kans: bk2, odds: match.odds.away },
    ];

    for (const p of picks3) {
      const value = calcValue(p.kans, p.odds, match.odds.home, match.odds.draw, match.odds.away);
      const confidence = Math.min(10, Math.max(1, r.confidence || 5)) + (match.poisson?.valid ? 1 : 0);

      if (value >= PUSH_MIN_VALUE && confidence >= PUSH_MIN_CONFIDENCE) {
        valuePicks.push({
          fixtureId:  match.fixtureId,
          home:       match.home,
          away:       match.away,
          league:     match.league,
          leagueId:   match.leagueId,
          date:       match.date,
          pick:       p.pick,
          pickLabel:  p.label,
          kans:       p.kans,
          odds:       p.odds,
          value:      parseFloat(value.toFixed(1)),
          confidence: Math.min(10, confidence),
          reason:     r.reason || '',
          scannedAt:  new Date().toISOString()
        });
      }
    }
  }

  // Sorteer op value
  valuePicks.sort((a, b) => b.value - a.value);

  console.log(`${valuePicks.length} value picks gevonden (≥${PUSH_MIN_VALUE}% value + conf ≥${PUSH_MIN_CONFIDENCE})`);

  if (!valuePicks.length) return;

  // Sla op in Firebase zodat de app ze kan tonen
  await fbSet(env, `scheduled_scans/${today}`, {
    scannedAt: new Date().toISOString(),
    count: valuePicks.length,
    picks: valuePicks
  });

  // Sla ook op als pending_notifications voor FCM (zie functions/index.js)
  for (const pick of valuePicks.slice(0, 3)) { // max 3 in queue
    await fbPush(env, 'pending_notifications', {
      matchLabel:  `${pick.home} vs ${pick.away}`,
      market:      pick.pickLabel,
      value:       pick.value,
      confidence:  pick.confidence,
      odds:        pick.odds,
      pick:        pick.pick,
      ts:          Date.now()
    });
  }

  // Stuur push via OneSignal (1 beste pick)
  await sendPushNotification(env, valuePicks);

  console.log(`Scan klaar. Top pick: ${valuePicks[0].home} vs ${valuePicks[0].away} +${valuePicks[0].value}%`);
}

// ═══════════════════════════════════════════
// FETCH HANDLER (proxy + API routes)
// ═══════════════════════════════════════════

export default {

  // ── Scheduled trigger ──────────────────────
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduledScan(env));
  },

  // ── HTTP requests ──────────────────────────
  async fetch(req, env, ctx) {
    const url  = new URL(req.url);
    const path = url.pathname;

    // CORS headers
    const cors = {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,x-api-key,anthropic-version,x-rapidapi-key,Authorization',
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // ── Status endpoint ──
    if (path === '/' || path === '/status') {
      const lastScan = await fbGet(env, `scheduled_scans/${new Date().toISOString().split('T')[0]}`);
      return new Response(JSON.stringify({
        version: VERSION,
        status:  'running',
        lastScan: lastScan ? { scannedAt: lastScan.scannedAt, picks: lastScan.count } : null
      }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // ── Handmatige scan trigger (voor testen) ──
    if (path === '/scan' && req.method === 'POST') {
      const secret = req.headers.get('x-scan-secret');
      if (secret !== env.SCAN_SECRET) {
        return new Response('Unauthorized', { status: 401, headers: cors });
      }
      ctx.waitUntil(runScheduledScan(env));
      return new Response(JSON.stringify({ ok: true, message: 'Scan gestart' }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    // ── Haal laatste scan resultaten op ──
    if (path === '/picks') {
      const today = new Date().toISOString().split('T')[0];
      const data = await fbGet(env, `scheduled_scans/${today}`);
      return new Response(JSON.stringify(data || { picks: [] }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    // ── Anthropic proxy ──
    if (path === '/anthropic') {
      const body = await req.text();
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': env.ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body
      });
      const data = await r.text();
      return new Response(data, { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // ── API-Football proxy ──
    if (path.startsWith('/apif/')) {
      const apiPath = path.replace('/apif', '');
      const qs = url.search;
      const r = await fetch(`https://v3.football.api-sports.io${apiPath}${qs}`, {
        headers: { 'x-rapidapi-key': env.API_FOOTBALL, 'x-rapidapi-host': 'v3.football.api-sports.io' }
      });
      const data = await r.text();
      return new Response(data, { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // ── Football-data.org proxy ──
    if (path.startsWith('/fd/')) {
      const apiPath = path.replace('/fd', '');
      const qs = url.search;
      const r = await fetch(`https://api.football-data.org${apiPath}${qs}`, {
        headers: { 'X-Auth-Token': env.FD_KEY || '' }
      });
      const data = await r.text();
      return new Response(data, { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // ── OneSignal push proxy ──
    if (path === '/push/send' && req.method === 'POST') {
      const body = await req.json();
      if (body.type === 'onesignal') {
        const payload = {
          app_id: env.ONESIGNAL_APP_ID,
          include_subscription_ids: body.playerId ? [body.playerId] : undefined,
          included_segments: body.playerId ? undefined : ['All'],
          headings: { nl: body.title || 'TOTO AI' },
          contents: { nl: body.message || '' },
          data: body.data || {}
        };
        const r = await fetch('https://onesignal.com/api/v1/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${env.ONESIGNAL_API_KEY}` },
          body: JSON.stringify(payload)
        });
        const result = await r.json();
        return new Response(JSON.stringify(result), { headers: { ...cors, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: 'unknown type' }), { status: 400, headers: cors });
    }

    // ── Generic proxy fallback ──
    const proxyUrl = url.searchParams.get('url');
    if (proxyUrl) {
      try {
        const r = await fetch(proxyUrl, {
          headers: req.headers,
          signal: AbortSignal.timeout(10000)
        });
        const data = await r.text();
        return new Response(data, { headers: { ...cors, 'Content-Type': r.headers.get('content-type') || 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors });
      }
    }

    return new Response(JSON.stringify({ version: VERSION, status: 'running' }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
};
