// TOTO AI Cloudflare Worker v18
// Nieuw in v18:
//   • Cache bypass voor next= en live= fixture calls

const ONESIGNAL_APP_ID = '7efd1d2e-630e-48b3-bc32-2704e1a5dc2f';
const VAPID_SUBJECT    = 'mailto:zweetzakken@gmail.com';
const FB_DB            = 'https://toto-ai-397cb-default-rtdb.europe-west1.firebasedatabase.app';

const CACHE_TTL = {
  fixtures:  600,
  odds:      180,
  standings: 600,
  default:   300,
};

function getCacheTTL(path) {
  if (path.includes('/fixtures')) return CACHE_TTL.fixtures;
  if (path.includes('/odds'))     return CACHE_TTL.odds;
  if (path.includes('/standings'))return CACHE_TTL.standings;
  return CACHE_TTL.default;
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-apisports-key, x-rapidapi-key, x-rapidapi-host, x-auth-token, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access',
};

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...cors, 'Content-Type': 'application/json' }
  });
}

function cachedJsonResp(data, ttl, fromCache = false) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      ...cors,
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${ttl}`,
      'X-Cache': fromCache ? 'HIT' : 'MISS',
      'X-Cache-TTL': String(ttl),
    }
  });
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduledScan(env));
  },

  async fetch(request, env) {
    const url  = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    if (path === '/autoscan/settings' && request.method === 'GET') {
      try {
        const settings = await getFirebaseData(env, 'scan_schedule');
        return jsonResp(settings || getDefaultSchedule());
      } catch(e) { return jsonResp(getDefaultSchedule()); }
    }

    if (path === '/autoscan/settings' && request.method === 'POST') {
      try {
        const body = await request.json();
        const schedule = {
          enabled:    body.enabled    ?? true,
          startHour:  body.startHour  ?? 13,
          endHour:    body.endHour    ?? 18,
          maxPerDay:  body.maxPerDay  ?? 5,
          minOdds:    body.minOdds    ?? 1.60,
          updatedAt:  new Date().toISOString(),
        };
        await setFirebaseData(env, 'scan_schedule', schedule);
        return jsonResp({ ok: true, schedule });
      } catch(e) { return jsonResp({ error: e.message }, 500); }
    }

    if (path === '/autoscan/status' && request.method === 'GET') {
      try {
        const status = await getFirebaseData(env, 'scan_status');
        return jsonResp(status || { lastRun: null, scansToday: 0, lastPickCount: 0 });
      } catch(e) { return jsonResp({ lastRun: null, scansToday: 0, lastPickCount: 0 }); }
    }

    if (path === '/autoscan/trigger' && request.method === 'POST') {
      try {
        const result = await runScheduledScan(env);
        return jsonResp({ ok: true, ...result });
      } catch(e) { return jsonResp({ error: e.message }, 500); }
    }

    if (path === '/cache/clear' && request.method === 'POST') {
      return jsonResp({ ok: true, message: 'Wacht tot TTL verlopen is.' });
    }

    if (path === '/anthropic' || path === '/anthropic/') {
      if (request.method !== 'POST') return jsonResp({ error: 'POST only' }, 405);
      if (!env.ANTHROPIC_KEY) return jsonResp({ error: 'ANTHROPIC_KEY not configured' }, 500);
      try {
        const body = await request.json();
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify(body),
        });
        return jsonResp(await resp.json(), resp.status);
      } catch(e) { return jsonResp({ error: e.message }, 500); }
    }

    if (path.startsWith('/apif/')) {
      if (!env.FOOTBALL_KEY) return jsonResp({ error: 'FOOTBALL_KEY not configured' }, 500);
      try {
        const apiPath = path.replace('/apif', '');
        const ttl     = getCacheTTL(apiPath);

        // Cache bypass voor live/next calls
        if (url.search.includes('next=') || url.search.includes('live=')) {
          const resp = await fetch(`https://v3.football.api-sports.io${apiPath}${url.search}`, {
            headers: {
              'x-apisports-key': env.FOOTBALL_KEY,
              'x-rapidapi-key': env.FOOTBALL_KEY,
              'x-rapidapi-host': 'v3.football.api-sports.io'
            },
          });
          const data = await resp.json();
          return jsonResp(data, resp.status);
        }

        const cacheKey = new Request('https://cache.toto-ai.app/apif' + apiPath + url.search);
        const cache    = caches.default;
        const cached   = await cache.match(cacheKey);
        if (cached) { const data = await cached.json(); return cachedJsonResp(data, ttl, true); }
        const resp = await fetch(`https://v3.football.api-sports.io${apiPath}${url.search}`, {
          headers: { 'x-apisports-key': env.FOOTBALL_KEY, 'x-rapidapi-key': env.FOOTBALL_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' },
        });
        const data = await resp.json();
        if (resp.ok && data?.response !== undefined) {
          const toCache = cachedJsonResp(data, ttl, false);
          await cache.put(cacheKey, toCache.clone());
          return toCache;
        }
        return jsonResp(data, resp.status);
      } catch(e) { return jsonResp({ error: e.message }, 500); }
    }

    if (path.startsWith('/fd/')) {
      if (!env.FD_KEY) return jsonResp({ error: 'FD_KEY not configured' }, 500);
      try {
        const apiPath  = path.replace('/fd', '');
        const ttl      = getCacheTTL(apiPath);
        const cacheKey = new Request('https://cache.toto-ai.app/fd' + apiPath + url.search);
        const cache    = caches.default;
        const cached   = await cache.match(cacheKey);
        if (cached) { const data = await cached.json(); return cachedJsonResp(data, ttl, true); }
        const resp = await fetch(`https://api.football-data.org${apiPath}${url.search}`, {
          headers: { 'X-Auth-Token': env.FD_KEY },
        });
        const data = await resp.json();
        if (resp.ok) {
          const toCache = cachedJsonResp(data, ttl, false);
          await cache.put(cacheKey, toCache.clone());
          return toCache;
        }
        return jsonResp(data, resp.status);
      } catch(e) { return jsonResp({ error: e.message }, 500); }
    }

    if (path === '/health') {
      const schedule = await getFirebaseData(env, 'scan_schedule').catch(() => null);
      const status   = await getFirebaseData(env, 'scan_status').catch(() => null);
      return jsonResp({
        ok: true, version: '18',
        keys: { anthropic: !!env.ANTHROPIC_KEY, football: !!env.FOOTBALL_KEY, fd: !!env.FD_KEY },
        autoscan: {
          schedule: schedule || getDefaultSchedule(),
          status:   status   || { lastRun: null, scansToday: 0 },
        },
      });
    }

    if (path === '/.well-known/assetlinks.json') {
      return new Response(JSON.stringify([{
        relation: [
          'delegate_permission/common.handle_all_urls',
          'delegate_permission/common.get_login_creds'
        ],
        target: {
          namespace: 'android_app',
          package_name: 'app.toto_ai.twa',
          sha256_cert_fingerprints: [
            'B3:F5:6F:88:3E:C3:BE:B9:BE:DE:0A:94:D7:34:6F:DE:E9:81:27:AC:E5:96:53:EA:2C:CD:69:AC:FE:B6:EF:F3',
            'DA:BC:B6:63:88:2B:5B:B0:9B:40:B2:0B:F8:FC:7C:A8:C1:DA:BE:B1:76:DE:EA:EA:3B:04:AE:F8:0C:5D'
          ]
        }
      }]), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    if (path === '/push/subscribe' && request.method === 'POST') {
      try {
        const body = await request.json();
        const sub  = body.subscription || body;
        if (env.PUSH_KV) await env.PUSH_KV.put('sub', JSON.stringify(sub));
        return jsonResp({ ok: true });
      } catch(e) { return jsonResp({ error: e.message }, 500); }
    }

    if (path === '/push/send' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { type, playerId, subscription, fcmToken, title, message, data } = body;
        if (type === 'onesignal' && playerId) {
          const result = await sendOneSignalPush(playerId, title, message, data, env.ONESIGNAL_API_KEY);
          return jsonResp({ ok: result.ok, method: 'onesignal', result: result.data });
        }
        let sub = subscription;
        if (!sub && env.PUSH_KV) { const stored = await env.PUSH_KV.get('sub'); if (stored) sub = JSON.parse(stored); }
        if (sub?.endpoint && sub?.keys?.p256dh && sub?.keys?.auth) {
          try {
            const result = await sendVapidPush(sub, title || 'TOTO AI', message || '', data || {}, env);
            return jsonResp({ ok: result.ok, method: 'vapid', status: result.status });
          } catch(vapidErr) { console.error('VAPID fout:', vapidErr.message); }
        }
        let regToken = fcmToken;
        if (!regToken && sub?.endpoint?.includes('fcm.googleapis.com')) regToken = sub.endpoint.split('/').pop();
        if (regToken) {
          const accessToken = await getFCMAccessToken(env);
          const fcmResp = await fetch(
            `https://fcm.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/messages:send`,
            { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: { token: regToken, data: { title: title||'TOTO AI', body: message||'', tag: data?.tag||'totoai' },
                webpush: { notification: { title: title||'TOTO AI', body: message||'', icon: '/icon-192.png', badge: '/icon-192.png', requireInteraction: true, tag: data?.tag||'totoai' }, fcm_options: { link: 'https://toto-ai.app/' } } } }) }
          );
          return jsonResp({ ok: fcmResp.ok, method: 'fcm', result: await fcmResp.json() });
        }
        return jsonResp({ error: 'Geen geldige subscription, OneSignal ID of FCM token' }, 400);
      } catch(e) { return jsonResp({ error: e.message }, 500); }
    }

    if (url.searchParams.has('url')) {
      const target  = url.searchParams.get('url');
      const headers = {};
      request.headers.forEach((v, k) => {
        if (!['host','cf-connecting-ip','cf-ray','cf-visitor','cf-ipcountry'].includes(k.toLowerCase())) headers[k] = v;
      });
      const apiKey = request.headers.get('x-apisports-key') || request.headers.get('x-rapidapi-key');
      if (apiKey) { headers['x-apisports-key'] = apiKey; headers['x-rapidapi-key'] = apiKey; headers['x-rapidapi-host'] = 'v3.football.api-sports.io'; }
      const fdKey = request.headers.get('x-auth-token');
      if (fdKey) headers['x-auth-token'] = fdKey;
      const anthropicKey = request.headers.get('x-api-key');
      if (anthropicKey || target.includes('anthropic.com')) {
        if (anthropicKey) headers['x-api-key'] = anthropicKey;
        headers['anthropic-version'] = request.headers.get('anthropic-version') || '2023-06-01';
        headers['anthropic-dangerous-direct-browser-access'] = 'true';
      }
      try {
        const resp = await fetch(target, { method: request.method, headers, body: ['GET','HEAD'].includes(request.method) ? undefined : request.body });
        const rh = new Headers(resp.headers);
        Object.entries(cors).forEach(([k, v]) => rh.set(k, v));
        return new Response(resp.body, { status: resp.status, headers: rh });
      } catch(e) { return jsonResp({ error: e.message }, 500); }
    }

    return new Response('TOTO AI Worker v18', { headers: cors });
  }
};

// ══════════════════════════════════════════════════════════
// SCHEDULED SCAN
// ══════════════════════════════════════════════════════════
async function runScheduledScan(env) {
  const now      = new Date();
  const hour     = now.getUTCHours() + 2;
  const today    = now.toISOString().split('T')[0];

  let schedule;
  try { schedule = await getFirebaseData(env, 'scan_schedule'); } catch(e) { schedule = null; }
  schedule = schedule || getDefaultSchedule();

  if (!schedule.enabled) return { skipped: true, reason: 'disabled' };

  const startHour = schedule.startHour ?? 13;
  const endHour   = schedule.endHour   ?? 18;
  if (hour < startHour || hour >= endHour) {
    return { skipped: true, reason: `outside_window (${startHour}-${endHour})` };
  }

  let status;
  try { status = await getFirebaseData(env, 'scan_status'); } catch(e) { status = null; }
  status = status || { lastRun: null, scansToday: 0, scanDate: null, lastPickCount: 0 };

  if (status.scanDate !== today) { status.scansToday = 0; status.scanDate = today; }

  const maxPerDay = schedule.maxPerDay ?? 5;
  if (status.scansToday >= maxPerDay) {
    return { skipped: true, reason: `max_per_day (${maxPerDay})` };
  }

  const minOdds = schedule.minOdds ?? 1.60;

  const today_str = now.toISOString().split('T')[0];
  const tomorrow  = new Date(now.getTime() + 86400000).toISOString().split('T')[0];

  let fixtures = [];
  try {
    const KNOWN_LEAGUES = new Set([88,89,78,39,90,2,61,135,5,144,140,41,79,203]);
    const [rToday, rTomorrow] = await Promise.all([
      fetch(`https://v3.football.api-sports.io/fixtures?date=${today_str}`,
        { headers: { 'x-apisports-key': env.FOOTBALL_KEY, 'x-rapidapi-key': env.FOOTBALL_KEY } }),
      fetch(`https://v3.football.api-sports.io/fixtures?date=${tomorrow}`,
        { headers: { 'x-apisports-key': env.FOOTBALL_KEY, 'x-rapidapi-key': env.FOOTBALL_KEY } }),
    ]);
    const [dToday, dTomorrow] = await Promise.all([rToday.json(), rTomorrow.json()]);
    const all = [...(dToday.response||[]), ...(dTomorrow.response||[])];
    fixtures = all.filter(f =>
      KNOWN_LEAGUES.has(f.league?.id) &&
      !['FT','AET','PEN'].includes(f.fixture?.status?.short)
    );
    const seen = new Set();
    fixtures = fixtures.filter(f => { if (seen.has(f.fixture.id)) return false; seen.add(f.fixture.id); return true; });
  } catch(e) {
    return { error: e.message };
  }

  if (!fixtures.length) return { skipped: true, reason: 'no_fixtures_today_or_tomorrow' };

  const oddsMap = {};
  await Promise.allSettled(fixtures.slice(0, 15).map(async f => {
    try {
      const r = await fetch(
        `https://v3.football.api-sports.io/odds?fixture=${f.fixture.id}`,
        { headers: { 'x-apisports-key': env.FOOTBALL_KEY, 'x-rapidapi-key': env.FOOTBALL_KEY } }
      );
      const d = await r.json();
      if (!d.response?.[0]) return;
      for (const bm of (d.response[0].bookmakers || [])) {
        const mw = bm.bets?.find(b => b.name === 'Match Winner');
        if (!mw?.values?.length) continue;
        const h  = parseFloat(mw.values.find(v => v.value === 'Home')?.odd || mw.values[0]?.odd);
        const dr = parseFloat(mw.values.find(v => v.value === 'Draw')?.odd || mw.values[1]?.odd);
        const a  = parseFloat(mw.values.find(v => v.value === 'Away')?.odd || mw.values[2]?.odd);
        if (h > 1 && dr > 1 && a > 1) { oddsMap[f.fixture.id] = { h, dr, a, bm: bm.name }; break; }
      }
    } catch(e) {}
  }));

  let prevOdds = {};
  try {
    const stored = await getFirebaseData(env, 'odds_history');
    if (stored) prevOdds = stored;
  } catch(e) {}

  const oddsMovement = {};
  Object.keys(oddsMap).forEach(fid => {
    const curr = oddsMap[fid];
    const prev = prevOdds[fid];
    if (!prev) return;
    const moveH  = prev.h  ? parseFloat(((prev.h  - curr.h)  / prev.h  * 100).toFixed(1)) : 0;
    const moveX  = prev.dr ? parseFloat(((prev.dr - curr.dr) / prev.dr * 100).toFixed(1)) : 0;
    const moveA  = prev.a  ? parseFloat(((prev.a  - curr.a)  / prev.a  * 100).toFixed(1)) : 0;
    oddsMovement[fid] = { moveH, moveX, moveA,
      steamH: moveH > 3, steamX: moveX > 3, steamA: moveA > 3,
      anySteam: moveH > 3 || moveX > 3 || moveA > 3
    };
  });

  const oddsSnapshot = {};
  Object.keys(oddsMap).forEach(fid => {
    oddsSnapshot[fid] = { h: oddsMap[fid].h, dr: oddsMap[fid].dr, a: oddsMap[fid].a, ts: new Date().toISOString() };
  });
  setFirebaseData(env, 'odds_history', oddsSnapshot).catch(() => {});

  const withOdds = fixtures.filter(f => {
    const o = oddsMap[f.fixture.id];
    if (!o) return false;
    return Math.max(o.h, o.dr, o.a) >= minOdds;
  });
  if (!withOdds.length) return { skipped: true, reason: 'no_odds' };

  const statsMap = {};
  await Promise.allSettled(withOdds.slice(0, 10).map(async f => {
    try {
      const leagueId = f.league.id;
      const season   = f.league.season || new Date().getFullYear();
      const [rHome, rAway] = await Promise.all([
        fetch(`https://v3.football.api-sports.io/teams/statistics?league=${leagueId}&season=${season}&team=${f.teams.home.id}`,
          { headers: { 'x-apisports-key': env.FOOTBALL_KEY, 'x-rapidapi-key': env.FOOTBALL_KEY } }),
        fetch(`https://v3.football.api-sports.io/teams/statistics?league=${leagueId}&season=${season}&team=${f.teams.away.id}`,
          { headers: { 'x-apisports-key': env.FOOTBALL_KEY, 'x-rapidapi-key': env.FOOTBALL_KEY } }),
      ]);
      const [dHome, dAway] = await Promise.all([rHome.json(), rAway.json()]);

      const parseStats = (d, isHome) => {
        const s = d.response;
        if (!s) return null;
        const side = isHome ? 'home' : 'away';
        const played = s.fixtures?.played?.[side] || s.fixtures?.played?.total || 0;
        if (played < 8) return null;
        const goalsFor  = s.goals?.for?.total?.[side]  || s.goals?.for?.total?.total  || 0;
        const goalsAgst = s.goals?.against?.total?.[side] || s.goals?.against?.total?.total || 0;
        const wins   = s.fixtures?.wins?.[side]   || 0;
        const draws  = s.fixtures?.draws?.[side]  || 0;
        const losses = s.fixtures?.loses?.[side]  || 0;
        return {
          played,
          avgGoalsFor:   parseFloat((goalsFor  / played).toFixed(2)),
          avgGoalsAgst:  parseFloat((goalsAgst / played).toFixed(2)),
          winRate:       parseFloat((wins   / played * 100).toFixed(1)),
          drawRate:      parseFloat((draws  / played * 100).toFixed(1)),
          lossRate:      parseFloat((losses / played * 100).toFixed(1)),
          form: s.form ? s.form.slice(-5) : '',
        };
      };

      const homeStats = parseStats(dHome, true);
      const awayStats = parseStats(dAway, false);

      if (homeStats && awayStats) {
        const poisson = computePoisson(homeStats, awayStats, f.league.id);
        statsMap[f.fixture.id] = { homeStats, awayStats, poisson };
      }
    } catch(e) {}
  }));

  const ctx = withOdds.slice(0, 10).map((f, i) => {
    const o    = oddsMap[f.fixture.id];
    const st   = statsMap[f.fixture.id];
    const ht   = f.teams.home.name, at = f.teams.away.name;
    const dt   = f.fixture.date ? f.fixture.date.split('T')[0] : '';
    const implH = (1/o.h*100).toFixed(0), implX = (1/o.dr*100).toFixed(0), implA = (1/o.a*100).toFixed(0);

    let statsLine = 'Geen stats beschikbaar';
    if (st) {
      const { homeStats: hs, awayStats: as, poisson: p } = st;
      statsLine = [
        `Thuis ${hs.played}gsp: ${hs.avgGoalsFor}gvr/${hs.avgGoalsAgst}geg per wedstrijd, vorm:${hs.form}`,
        `Uit ${as.played}gsp: ${as.avgGoalsFor}gvr/${as.avgGoalsAgst}geg per wedstrijd, vorm:${as.form}`,
        `Poisson kans: 1=${p.homeWin}% X=${p.draw}% 2=${p.awayWin}%`,
      ].join(' | ');
    }

    const mv = oddsMovement[f.fixture.id];
    const steamLine = mv?.anySteam
      ? `STEAM ALERT: ${mv.steamH?`1 daalt ${mv.moveH}% `:''}${mv.steamX?`X daalt ${mv.moveX}% `:''}${mv.steamA?`2 daalt ${mv.moveA}%`:''}`
      : 'Geen odds beweging';

    return [
      `${i+1}. ID:${f.fixture.id} | ${ht} vs ${at} | ${f.league.name} | ${dt}`,
      `   Boekmakersquotes: 1=${o.h.toFixed(2)}(impl ${implH}%) X=${o.dr.toFixed(2)}(impl ${implX}%) 2=${o.a.toFixed(2)}(impl ${implA}%)`,
      `   Statistieken: ${statsLine}`,
      `   Marktbeweging: ${steamLine}`,
    ].join('\n');
  }).join('\n\n');

  let scanResults = [];
  try {
    const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        temperature: 0,
        system: `Je bent een value betting expert die Poisson-statistieken gebruikt.

WERKWIJZE per wedstrijd:
1. Vergelijk Poisson kans met boekmakersimplied probability
2. Als Poisson kans > implied probability + 5% marge = VALUE
3. Weeg ook vorm, goals voor/tegen, thuisvoordeel mee
4. confidence 8+ ALLEEN als Poisson EN vorm EN quote allemaal overeenkomen (Triple Lock)
5. confidence 6-7 als minimaal 2 van 3 signalen kloppen (Double Lock)
6. confidence <6 = geen pick

Respond ONLY with valid JSON:
{"results":[
  {"idx":1,"pick":"1|X|2","kans":55,"poissonKans":58,"confidence":8,
   "reason":"max 15 woorden: concrete factor + cijfers"}
]}

Regels:
- Geef ALLEEN picks met kans > implied + 5% marge
- poissonKans = jouw Poisson-gebaseerde schatting
- reason: noem teamnam + concrete stat
- Max 1 pick per wedstrijd
- Liever geen pick dan een slechte pick`,
        messages: [{ role: 'user', content: `Analyseer ${Math.min(withOdds.length,10)} wedstrijden:\n\n${ctx}` }]
      })
    });
    const aiData = await aiResp.json();
    const raw = aiData.content?.[0]?.text?.trim() || '';
    const js  = raw.indexOf('{'), je = raw.lastIndexOf('}');
    if (js >= 0 && je > js) {
      const parsed = JSON.parse(raw.substring(js, je + 1));
      const results = parsed.results || [];
      scanResults = results.map(r => {
        const idx  = (r.idx || 1) - 1;
        const fix  = withOdds[idx];
        if (!fix) return null;
        const o    = oddsMap[fix.fixture.id];
        const st   = statsMap[fix.fixture.id];
        const odds = r.pick === '1' ? o.h : r.pick === 'X' ? o.dr : o.a;
        if (odds < minOdds) return null;
        const value  = parseFloat(((r.kans / 100 * odds - 1) * 100).toFixed(1));
        const kelly  = parseFloat(Math.max(0, ((r.kans/100 - (1-r.kans/100)/(odds-1)) * 100)).toFixed(1));

        if (st?.poisson) {
          const p = st.poisson;
          const poissonKans = r.pick === '1' ? p.homeWin : r.pick === 'X' ? p.draw : p.awayWin;
          const impliedKans = 100 / odds;
          if (poissonKans < impliedKans - 3) return null;
        }

        const mv = oddsMovement[fix.fixture.id];
        let confBoost = 0;
        if (mv) {
          const hasSteam = r.pick==='1' ? mv.steamH : r.pick==='X' ? mv.steamX : mv.steamA;
          if (hasSteam) confBoost = 1;
        }

        return {
          fixtureId:    fix.fixture.id,
          home:         fix.teams.home.name,
          away:         fix.teams.away.name,
          comp:         fix.league.name,
          pick:         r.pick,
          pickLabel:    r.pick === '1' ? fix.teams.home.name + ' wint' : r.pick === 'X' ? 'Gelijkspel' : fix.teams.away.name + ' wint',
          kans:         r.kans,
          poissonKans:  r.poissonKans || (st?.poisson ? (r.pick==='1'?st.poisson.homeWin:r.pick==='X'?st.poisson.draw:st.poisson.awayWin) : null),
          odds:         parseFloat(odds.toFixed(2)),
          value,
          kelly,
          confidence:   Math.min(10, (r.confidence || 5) + confBoost),
          reason:       r.reason || '',
          bookmaker:    o.bm,
          hasPoisson:   !!st?.poisson,
          hasSteam:     !!(mv && (r.pick==='1'?mv.steamH:r.pick==='X'?mv.steamX:mv.steamA)),
          steamMove:    mv ? (r.pick==='1'?mv.moveH:r.pick==='X'?mv.moveX:mv.moveA) : 0,
          homeStats:    st?.homeStats ? { avgFor: st.homeStats.avgGoalsFor, avgAgst: st.homeStats.avgGoalsAgst, form: st.homeStats.form } : null,
          awayStats:    st?.awayStats ? { avgFor: st.awayStats.avgGoalsFor, avgAgst: st.awayStats.avgGoalsAgst, form: st.awayStats.form } : null,
          scannedAt:    new Date().toISOString(),
        };
      }).filter(Boolean).filter(r => r.value >= 5 && (r.confidence||0) >= 7);
    }
  } catch(e) {
    return { error: e.message };
  }

  status.scansToday++;
  status.lastRun       = new Date().toISOString();
  status.lastPickCount = scanResults.length;
  status.scanDate      = today;
  status.lastResults   = scanResults.slice(0, 10);
  await setFirebaseData(env, 'scan_status', status);

  if (scanResults.length > 0) {
    const triples = scanResults.filter(s => s.confidence >= 8);
    const doubles = scanResults.filter(s => s.confidence >= 6 && s.confidence < 8);

    let title, body;
    if (triples.length > 0) {
      const best = triples.sort((a,b) => b.value - a.value)[0];
      title = `🏆 Triple Lock — ${best.home} vs ${best.away}`;
      body  = `${best.pickLabel} @ ${best.odds} · +${best.value}% value`;
    } else if (doubles.length > 0) {
      const best = doubles.sort((a,b) => b.value - a.value)[0];
      title = `🔒 Double Lock — ${best.home} vs ${best.away}`;
      body  = `${best.pickLabel} @ ${best.odds} · +${best.value}% value`;
    } else {
      const best = scanResults.sort((a,b) => b.value - a.value)[0];
      title = `⚡ ${scanResults.length} value pick${scanResults.length > 1 ? 's' : ''} gevonden`;
      body  = `Beste: ${best.home} vs ${best.away} · +${best.value}%`;
    }

    try {
      const subData = await getFirebaseData(env, 'push_subscribers');
      if (subData?.playerId) {
        await sendOneSignalPush(
          subData.playerId, title, body,
          { tag: 'autoscan-server', url: 'https://toto-ai.app/' },
          env.ONESIGNAL_API_KEY
        );
      }
    } catch(e) {}
  }

  return {
    ok: true,
    scanned:    withOdds.length,
    picks:      scanResults.length,
    scansToday: status.scansToday,
    maxPerDay,
  };
}

// ══════════════════════════════════════════════════════════
// POISSON MODEL
// ══════════════════════════════════════════════════════════
function poissonProb(lambda, k) {
  let factorial = 1;
  for (let i = 2; i <= k; i++) factorial *= i;
  return Math.exp(-lambda) * Math.pow(lambda, k) / factorial;
}

const LEAGUE_AVERAGES = {
  39:  { home: 1.53, away: 1.15 },
  140: { home: 1.45, away: 1.08 },
  135: { home: 1.38, away: 1.05 },
  78:  { home: 1.62, away: 1.22 },
  61:  { home: 1.44, away: 1.12 },
  88:  { home: 1.58, away: 1.18 },
  89:  { home: 1.52, away: 1.14 },
  90:  { home: 1.48, away: 1.10 },
  2:   { home: 1.42, away: 1.02 },
  5:   { home: 1.40, away: 1.05 },
  144: { home: 1.55, away: 1.16 },
  41:  { home: 1.50, away: 1.12 },
  79:  { home: 1.48, away: 1.10 },
  203: { home: 1.50, away: 1.12 },
};

function computePoisson(homeStats, awayStats, leagueId) {
  const avgs = LEAGUE_AVERAGES[leagueId] || { home: 1.45, away: 1.10 };
  const homeAttack  = homeStats.avgGoalsFor  / avgs.home;
  const homeDefense = homeStats.avgGoalsAgst / avgs.away;
  const awayAttack  = awayStats.avgGoalsFor  / avgs.away;
  const awayDefense = awayStats.avgGoalsAgst / avgs.home;
  const lambdaHome  = Math.max(0.3, homeAttack  * awayDefense * avgs.home);
  const lambdaAway  = Math.max(0.3, awayAttack  * homeDefense * avgs.away);
  let homeWin = 0, draw = 0, awayWin = 0;
  for (let h = 0; h <= 6; h++) {
    for (let a = 0; a <= 6; a++) {
      const prob = poissonProb(lambdaHome, h) * poissonProb(lambdaAway, a);
      if (h > a) homeWin += prob;
      else if (h === a) draw += prob;
      else awayWin += prob;
    }
  }
  return {
    homeWin:    Math.round(homeWin  * 100),
    draw:       Math.round(draw     * 100),
    awayWin:    Math.round(awayWin  * 100),
    lambdaHome: parseFloat(lambdaHome.toFixed(2)),
    lambdaAway: parseFloat(lambdaAway.toFixed(2)),
  };
}

// ══════════════════════════════════════════════════════════
// FIREBASE HELPERS
// ══════════════════════════════════════════════════════════
async function getFirebaseData(env, path) {
  const resp = await fetch(`${FB_DB}/${path}.json?auth=${env.FB_API_KEY}`);
  if (!resp.ok) throw new Error(`Firebase GET ${path} failed: ${resp.status}`);
  return await resp.json();
}

async function setFirebaseData(env, path, data) {
  const resp = await fetch(`${FB_DB}/${path}.json?auth=${env.FB_API_KEY}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  if (!resp.ok) throw new Error(`Firebase PUT ${path} failed: ${resp.status}`);
  return await resp.json();
}

function getDefaultSchedule() {
  return { enabled: true, startHour: 13, endHour: 18, maxPerDay: 5, minOdds: 1.60 };
}

// ══════════════════════════════════════════════════════════
// ONESIGNAL PUSH
// ══════════════════════════════════════════════════════════
async function sendOneSignalPush(playerId, title, message, data, apiKey) {
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Basic ${apiKey}` };
  const base = {
    app_id: ONESIGNAL_APP_ID,
    headings: { en: title || 'TOTO AI' },
    contents: { en: message || '' },
    data: data || {},
    chrome_web_icon: 'https://toto-ai.app/icon-192.png',
    url: 'https://toto-ai.app/',
    priority: 10
  };
  let resp, result;
  resp   = await fetch('https://onesignal.com/api/v1/notifications', { method: 'POST', headers, body: JSON.stringify({ ...base, target_channel: 'push', include_subscription_ids: [playerId], ttl: 86400 }) });
  result = await resp.json();
  if (result.recipients > 0 || (result.id && !result.errors?.length)) return { ok: true, data: result };
  resp   = await fetch('https://onesignal.com/api/v1/notifications', { method: 'POST', headers, body: JSON.stringify({ ...base, include_player_ids: [playerId] }) });
  result = await resp.json();
  if (result.recipients > 0 || (result.id && !result.errors?.length)) return { ok: true, data: result };
  resp   = await fetch('https://onesignal.com/api/v1/notifications', { method: 'POST', headers, body: JSON.stringify({ ...base, included_segments: ['All'] }) });
  result = await resp.json();
  return { ok: resp.ok, data: result };
}

// ══════════════════════════════════════════════════════════
// VAPID HELPERS
// ══════════════════════════════════════════════════════════
async function sendVapidPush(subscription, title, body, data, env) {
  const endpoint  = subscription.endpoint;
  const payload   = JSON.stringify({ title, body, icon: '/icon-192.png', badge: '/icon-192.png', tag: data?.tag || 'totoai', requireInteraction: true, data });
  const jwt       = await buildVapidJWT(endpoint, env);
  const encrypted = await encryptPayload(subscription.keys.p256dh, subscription.keys.auth, payload);
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`, 'Content-Type': 'application/octet-stream', 'Content-Encoding': 'aes128gcm', 'TTL': '86400' },
    body: encrypted
  });
  if (!resp.ok) { const txt = await resp.text().catch(() => ''); throw new Error(`Push ${resp.status}: ${txt}`); }
  return { ok: true, status: resp.status };
}

async function buildVapidJWT(endpoint, env) {
  const url      = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const now      = Math.floor(Date.now() / 1000);
  const enc      = o => btoa(JSON.stringify(o)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const unsigned = `${enc({ alg:'ES256', typ:'JWT' })}.${enc({ aud:audience, exp:now+43200, sub:VAPID_SUBJECT })}`;
  const pub      = base64urlToUint8Array(env.VAPID_PUBLIC_KEY);
  const key      = await crypto.subtle.importKey('jwk', { kty:'EC', crv:'P-256', d:env.VAPID_PRIVATE_KEY, x:uint8ArrayToBase64url(pub.slice(1,33)), y:uint8ArrayToBase64url(pub.slice(33,65)), key_ops:['sign'] }, { name:'ECDSA', namedCurve:'P-256' }, false, ['sign']);
  const sig      = await crypto.subtle.sign({ name:'ECDSA', hash:'SHA-256' }, key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${uint8ArrayToBase64url(new Uint8Array(sig))}`;
}

async function encryptPayload(p256dhB64, authB64, payload) {
  const receiverPub  = base64urlToUint8Array(p256dhB64);
  const authBytes    = base64urlToUint8Array(authB64);
  const salt         = crypto.getRandomValues(new Uint8Array(16));
  const receiverKey  = await crypto.subtle.importKey('raw', receiverPub, { name:'ECDH', namedCurve:'P-256' }, false, []);
  const senderKeys   = await crypto.subtle.generateKey({ name:'ECDH', namedCurve:'P-256' }, true, ['deriveBits']);
  const senderPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', senderKeys.publicKey));
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name:'ECDH', public:receiverKey }, senderKeys.privateKey, 256));
  const enc          = new TextEncoder();
  const ikm    = await hkdf(authBytes, sharedSecret, concat(enc.encode('WebPush: info\0'), receiverPub, senderPubRaw), 32);
  const prkKey = await hkdfExtract(salt, ikm);
  const cek    = await hkdfExpand(prkKey, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce  = await hkdfExpand(prkKey, enc.encode('Content-Encoding: nonce\0'), 12);
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name:'AES-GCM', iv:nonce }, aesKey, concat(enc.encode(payload), new Uint8Array([2]))));
  const rs     = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096, false);
  return concat(salt, rs, new Uint8Array([senderPubRaw.length]), senderPubRaw, cipher);
}

async function hkdf(salt, ikm, info, length) { return hkdfExpand(await hkdfExtract(salt, ikm), info, length); }
async function hkdfExtract(salt, ikm) { const k = await crypto.subtle.importKey('raw', salt, { name:'HMAC', hash:'SHA-256' }, false, ['sign']); return new Uint8Array(await crypto.subtle.sign('HMAC', k, ikm)); }
async function hkdfExpand(prk, info, length) { const k = await crypto.subtle.importKey('raw', prk, { name:'HMAC', hash:'SHA-256' }, false, ['sign']); return (await crypto.subtle.sign('HMAC', k, concat(info, new Uint8Array([1])))).slice(0, length); }
function concat(...arrays) { const bufs = arrays.map(a => a instanceof Uint8Array ? a : new Uint8Array(a)); const out = new Uint8Array(bufs.reduce((n,a) => n+a.length, 0)); let off = 0; for (const b of bufs) { out.set(b, off); off += b.length; } return out; }
function base64urlToUint8Array(b64url) { const b64 = b64url.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(b64url.length/4)*4,'='); return Uint8Array.from(atob(b64), c => c.charCodeAt(0)); }
function uint8ArrayToBase64url(arr) { return btoa(String.fromCharCode(...arr)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,''); }

// ══════════════════════════════════════════════════════════
// FCM HELPERS
// ══════════════════════════════════════════════════════════
async function getFCMAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  const jwt = await makeJWT({ iss:env.FIREBASE_CLIENT_EMAIL, scope:'https://www.googleapis.com/auth/firebase.messaging', aud:'https://oauth2.googleapis.com/token', exp:now+3600, iat:now }, env);
  const resp = await fetch('https://oauth2.googleapis.com/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}` });
  const d = await resp.json();
  if (!d.access_token) throw new Error('OAuth2 mislukt');
  return d.access_token;
}

async function makeJWT(payload, env) {
  const enc   = o => btoa(JSON.stringify(o)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const input = `${enc({alg:'RS256',typ:'JWT'})}.${enc(payload)}`;
  const pem   = env.FIREBASE_PRIVATE_KEY.replace('-----BEGIN PRIVATE KEY-----','').replace('-----END PRIVATE KEY-----','').replace(/\n/g,'').trim();
  const der   = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key   = await crypto.subtle.importKey('pkcs8', der.buffer, {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'}, false, ['sign']);
  const sig   = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input));
  return `${input}.${btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}`;
}