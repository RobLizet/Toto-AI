// ProMatchXI WORKER v131
// v104: No retry Anthropic, max 5 scans/dag, scan calls naar Haiku (10x goedkoper)
// v101: Push naar owner player ID
// v100: Rate limiting /anthropic — max 15/dag per user, 150 globaal
//       Kosten tracking per call in Supabase user_costs (input/output tokens)
// v99: POST /picks endpoint, UTC timezone fix, altijd push na scan
// v98: Firebase → Supabase migratie, leagueConfig uitgebreid

const VERSION = 'v163'; // v163: /health endpoint (versie, laatste scan, picks, CLV, snapshot-dichtheid + warnings) // v162: scans_today reset op nieuwe dag in hoofdpad (teller liep eindeloos op, blokkeerde /scan-now) // v161: filter licht versoepeld — shrink 0.45/0.55, draw-straf 0.88/0.90, draw-minValue lager, strong-draw guardrail-uitzondering // v160: /scan-now totaal-dagcap 25 (begrenst handmatige scan-kosten) // v159: /scan-now endpoint (handmatige scan vanuit app, cooldown 60s + daglimiet) // v158: handmatig scanpad — ondergrens aftraptijd (geen al-gespeelde wedstrijden) // v157: value-hardening — model-shrinkage naar markt (0.50 / toernooi 0.65) + favorite-longshot guardrail (odds>=3.5 vereist sharpScore>=55) // v156: snapshot-only cron-run 23-05 UTC voor late WK-kickoffs (verse slotkoers) // v155: CLV-fix — snapshot ALLE aankomende fixtures (opening->closing curve) + saveCLV valt terug op snapshot-slotkoers + niet meer bailen op lege live-CLV // v154: sharp-tier drempels in constanten (SHARP_TIERS) // v153: WK-only scan tijdens WK-zomer (FASE 1 = alleen league 1) // v152: cache-bust op odds fetch // v151: drempels terug naar productie // v151-TEST: drempels verlaagd voor test — TIJDELIJK // v150: steam 6%, sharp score ≥55, geen gelijkspel, geen gespeeld // v149: post-WK leagues — KKD + 2/3.Bundesliga + Championship + League One // v148: automatische seizoenswisseling — WK-zomer → Europees seizoen (20 jul) // v147: 24→11 actieve leagues + bulk odds fetch // v146: bulk datum odds fetch — 2 calls i.p.v. 24+ (rate limit fix) // v145: league tiers + pick tier performance + Monte Carlo // v144: AI invloed teruggebracht naar 10% — markt (fairImplied) domineert 40% // v143: prompt caching ingeschakeld — ~70% token besparing op scans // v142: scan analyses via Sonnet 4.6 ipv Haiku (betere kwaliteit) // v141: pick consistency lock + gelijkspel 2-scan bevestiging // v140: poissonMap doorgegeven aan detectSharpMoney — divergentie nu correct // v139: betere WK AI-prompt (FIFA/form), push timing 6u voor aftrap // v138: WK_ONLY_MODE uit + alle actieve leagues + WK drempel conf5/value6 + elite ook WK // v137: 1 pick per wedstrijd + strengere drempels (minValue 3→6, minConf 5→6) // v136: rate limits 15→50 user, 150→400 globaal // v135: elite sharp money engine — market_consensus + model_market_comparison + sharp_signal_results // v134: geen push bij lege scan // v133: scan-test default league 1 (WK)
const FB_DB = 'https://toto-ai-397cb-default-rtdb.europe-west1.firebasedatabase.app';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key, anthropic-version, Authorization',
};

// v115: jeugd-/onder-teams (U15–U23) hebben vrijwel nooit weddenschapsmarkten en
// verdringen bettable wedstrijden uit de analyse-slots → uitsluiten in scans.
const YOUTH_RE = /\bU-?(1[5-9]|2[0-3])\b/i;
const isYouthMatch = (home, away) => YOUTH_RE.test(home || '') || YOUTH_RE.test(away || '');

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
          ? 'return=minimal,resolution=merge-duplicates'
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
  await sb(env, 'odds_snapshots', 'POST', rows); // v122: append -> oddshistorie (opening->closing)
  console.log(`[SB] ${rows.length} odds snapshots opgeslagen`);
}

// ── Lichte snapshot-run voor late kickoffs (cron-gap 23-05 UTC) ──
// v156: WK 2026 (Amerika's) trapt vaak 23:00-05:00 UTC af — buiten de hoofd-cron (06 + 12-22).
// Deze run ververst alleen de odds van fixtures die de hoofdscan AL volgt (zelfde league-set,
// geen drift), zodat hun slotkoers vers blijft. Geen AI, geen picks, geen settlement.
async function snapshotOddsOnly(env) {
  try {
    const today    = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const rows = await sb(env, 'odds_snapshots', 'GET', null,
      `?match_date=in.(${today},${tomorrow})&select=fixture_id,league_id,match_date`);
    const seen = new Set();
    const matches = (rows || [])
      .filter(r => r.fixture_id && !seen.has(r.fixture_id) && seen.add(r.fixture_id))
      .map(r => ({ fixtureId: r.fixture_id, leagueId: r.league_id, matchDate: r.match_date }));
    if (!matches.length) { console.log('[Snapshot-only] geen getrackte fixtures'); return; }
    const ids = matches.map(m => m.fixtureId);
    const oddsMap = await fetchOddsForFixtures(ids, env, 12); // geen AI; ruim binnen subrequest-budget
    await saveOddsSnapshots(oddsMap, matches, env);
    console.log(`[Snapshot-only] ${Object.keys(oddsMap).length}/${ids.length} fixtures ververst`);
  } catch(e) { console.error('[Snapshot-only] fout:', e.message); }
}

// ── Supabase: picks ophalen ──────────────────────────────
async function sbGetPicks(env) {
  const rows = await sb(env, 'picks', 'GET', null,
    '?select=*&order=last_scan_at.desc&limit=200'
  ) || [];
  const result = {};
  rows.forEach(r => {
    result[r.id] = {
      fixtureId: r.fixture_id, home: r.home, away: r.away,
      matchName: r.match_name, matchDate: r.match_date, matchTime: r.match_time,
      leagueId: r.league_id, leagueName: r.league_name,
      pick: r.pick, pickLabel: r.pick_label,
      odds: r.odds ? parseFloat(r.odds) : null,
      value: r.value ? parseFloat(r.value) : null,
      aiKans: r.ai_kans, confidence: r.confidence ? parseFloat(r.confidence) : null,
      confidenceRaw: r.confidence_raw ? parseFloat(r.confidence_raw) : null,
      confidenceFinal: r.confidence_final,
      leagueFactor: r.league_factor ? parseFloat(r.league_factor) : null,
      bucketFactor: r.bucket_factor ? parseFloat(r.bucket_factor) : null,
      oddsMovement: r.odds_movement ? parseFloat(r.odds_movement) : null,
      marketSignal: r.market_signal, elite: r.elite,
      calibFactor: r.calib_factor ? parseFloat(r.calib_factor) : null,
      poissonK1: r.poisson_k1, poissonKX: r.poisson_kx, poissonK2: r.poisson_k2,
      scanCount: r.scan_count, lockLevel: r.lock_level,
      lastScanAt: r.last_scan_at, firstScanAt: r.first_scan_at,
      status: r.status, score: r.score, processed: r.processed,
      verifiedAt: r.verified_at, source: r.source,
    };
  });
  return result;
}

// ── Supabase: picks opslaan (upsert) ─────────────────────
async function sbSavePicks(picksObj, env) {
  const rows = Object.entries(picksObj).map(([key, p]) => ({
    id: key,
    fixture_id: p.fixtureId, home: p.home, away: p.away,
    match_name: p.matchName, match_date: p.matchDate || null,
    match_time: p.matchTime || null, league_id: p.leagueId || null,
    league_name: p.leagueName || null, pick: p.pick, pick_label: p.pickLabel || null,
    odds: p.odds || null, value: p.value || null, ai_kans: p.aiKans || null,
    confidence: p.confidence || null, confidence_raw: p.confidenceRaw || null,
    confidence_final: p.confidenceFinal || null,
    league_factor: p.leagueFactor || null, bucket_factor: p.bucketFactor || null,
    odds_movement: p.oddsMovement || null, market_signal: p.marketSignal || null,
    elite: p.elite || false, calib_factor: p.calibFactor || null,
    poisson_k1: p.poissonK1 || null, poisson_kx: p.poissonKX || null, poisson_k2: p.poissonK2 || null,
    scan_count: p.scanCount || 1, lock_level: p.lockLevel || 'single',
    last_scan_at: p.lastScanAt || new Date().toISOString(),
    first_scan_at: p.firstScanAt || new Date().toISOString(),
    status: p.status || 'pending', score: p.score || null,
    processed: p.processed || false, verified_at: p.verifiedAt || null,
    source: p.source || 'scheduled', updated_at: new Date().toISOString(),
    // v135: sharp engine velden
    sharp_score: p.sharpScore || null, sharp_tier: p.sharpTier || null, sharp_divergence: p.sharpDivergence || null,
  }));
  if (!rows.length) return;
  // v105: fixture_id extraheren uit id als het NULL is (legacy picks)
  rows.forEach(r => {
    if (!r.fixture_id && r.id) {
      const m = String(r.id).match(/^(\d+)_/);
      if (m) r.fixture_id = parseInt(m[1]);
    }
  });
  await sb(env, 'picks', 'POST', rows, '?on_conflict=id');
  console.log('[SB] ' + rows.length + ' picks upserted');
}

// ── Supabase: calibration ophalen ────────────────────────
async function sbGetCalibration(env) {
  const rows = await sb(env, 'league_calibration', 'GET', null, '?select=*') || [];
  const result = {};
  rows.forEach(r => {
    result[r.league_id] = {
      leagueName: r.league_name, wins: r.wins, total: r.total,
      roi: parseFloat(r.roi), avgValue: parseFloat(r.avg_value),
      avgConf: parseFloat(r.avg_conf), clvSum: parseFloat(r.clv_sum),
      clvCount: r.clv_count, factor: parseFloat(r.factor),
      historicalHitrate: r.historical_hitrate ? parseFloat(r.historical_hitrate) : null,
      historicalRoi: r.historical_roi ? parseFloat(r.historical_roi) : null,
      totalPicks: r.total_picks, weeklyUpdatedAt: r.weekly_updated_at,
      lastUpdated: r.last_updated,
    };
  });
  return result;
}

// ── Supabase: calibration opslaan (upsert) ───────────────
async function sbSaveCalibration(calibObj, env) {
  const rows = Object.entries(calibObj).map(([lid, c]) => ({
    league_id: lid, league_name: c.leagueName || null,
    wins: c.wins || 0, total: c.total || 0, roi: c.roi || 0,
    avg_value: c.avgValue || 0, avg_conf: c.avgConf || 0,
    clv_sum: c.clvSum || 0, clv_count: c.clvCount || 0, factor: c.factor || 1.0,
    historical_hitrate: c.historicalHitrate || null,
    historical_roi: c.historicalRoi || null,
    total_picks: c.totalPicks || 0, weekly_updated_at: c.weeklyUpdatedAt || null,
    last_updated: new Date().toISOString(),
  }));
  if (!rows.length) return;
  await sb(env, 'league_calibration', 'POST', rows, '?on_conflict=league_id');
  console.log('[SB] ' + rows.length + ' league calibraties opgeslagen');
}

// ── Supabase: scan_status updaten ────────────────────────
async function sbUpdateScanStatus(data, env) {
  await sb(env, 'scan_status', 'POST', [{
    id: 'current',
    last_run: data.lastRun || new Date().toISOString(),
    scan_date: data.scanDate || null,
    last_pick_count: data.lastPickCount || 0,
    last_match_count: data.lastMatchCount || 0,
    last_with_odds: data.lastWithOdds || 0,
    last_without_odds: data.lastWithoutOdds || 0,
    scans_today: data.scansToday || 0,
    version: data.version || VERSION,
    updated_at: new Date().toISOString(),
  }], '?on_conflict=id');
}

// ── Supabase: scan_status lezen (R1-fase2: bron = Supabase i.p.v. Firebase) ──
async function sbGetScanStatus(env) {
  const rows = await sb(env, 'scan_status', 'GET', null, '?id=eq.current&select=scan_date,scans_today&limit=1');
  const r = rows && rows[0];
  return { scanDate: r?.scan_date || null, scansToday: r?.scans_today || 0 };
}

// ── Supabase: daily tip opslaan ──────────────────────────
async function sbSaveDailyTip(tipData, env) {
  if (!tipData) return;
  const today = new Date().toISOString().split('T')[0];
  await sb(env, 'daily_tips', 'POST', [{
    id: tipData.date || today,
    tip_date: tipData.date || today,
    fixture_id: tipData.fixtureId || null,
    home: tipData.home || null, away: tipData.away || null,
    pick: tipData.pick || null, odds: tipData.odds || null,
    confidence: tipData.confidence || null,
    reasoning: tipData.reasoning || tipData.tipText || null,
    status: tipData.status || 'pending',
    is_no_tip: tipData.noTip || false,
  }], '?on_conflict=id');
}

// ══════════════════════════════════════════════════════════
// v135: ELITE SHARP MONEY ENGINE
// Drie lagen:
//   1. saveMarketConsensusSnapshot  — sla multi-book consensus op (elke scan)
//   2. detectSharpMoney             — vergelijk Poisson vs markt, bereken sharpScore
//   3. saveSharpSignalResult        — post-settlement validatie
// ══════════════════════════════════════════════════════════

// ── Statische std-deviatie helper ────────────────────────
function stdDev(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const sq = arr.map(x => Math.pow(x - mean, 2));
  return parseFloat(Math.sqrt(sq.reduce((a, b) => a + b, 0) / arr.length).toFixed(4));
}

// ── Sharp tier toewijzen o.b.v. score (0-100) ────────────
// v154: sharp-tier drempels (sharpScore 0-100) als constanten — tune hier, gedrag ongewijzigd
const SHARP_TIERS = { elite: 75, strong: 55, moderate: 35, weak: 15 };
function sharpTier(score) {
  if (score >= SHARP_TIERS.elite)    return 'elite';
  if (score >= SHARP_TIERS.strong)   return 'strong';
  if (score >= SHARP_TIERS.moderate) return 'moderate';
  if (score >= SHARP_TIERS.weak)     return 'weak';
  return 'none';
}

// ── 1. Sla multi-bookmaker consensus snapshot op ─────────
// Aangeroepen direct na fetchOddsForFixtures (die al alle books parset).
// oddsMap heeft per fixture: { home, draw, away, books, fair:{home,draw,away} }
// rawBooksMap optioneel: { fixtureId: { bookName: {h,d,a} } } voor variance + JSONB
async function saveMarketConsensusSnapshot(oddsMap, matches, rawBooksMap, env) {
  const today = new Date().toISOString().split('T')[0];
  const now   = new Date().toISOString();
  const rows  = [];

  matches.forEach(m => {
    const o = oddsMap[m.fixtureId];
    if (!o || !o.home) return;

    const raw    = rawBooksMap?.[m.fixtureId] || {};
    const hArr   = Object.values(raw).map(b => b.h).filter(x => x > 1);
    const dArr   = Object.values(raw).map(b => b.d).filter(x => x > 1);
    const aArr   = Object.values(raw).map(b => b.a).filter(x => x > 1);

    rows.push({
      fixture_id:          m.fixtureId,
      league_id:           m.leagueId || null,
      match_date:          m.matchDate || today,
      captured_at:         now,
      home_odds_consensus: o.home,
      draw_odds_consensus: o.draw,
      away_odds_consensus: o.away,
      home_implied_pct:    o.fair?.home ?? null,
      draw_implied_pct:    o.fair?.draw ?? null,
      away_implied_pct:    o.fair?.away ?? null,
      home_variance:       stdDev(hArr) || null,
      draw_variance:       stdDev(dArr) || null,
      away_variance:       stdDev(aArr) || null,
      bookmaker_count:     o.books || 0,
      bookmaker_odds:      Object.keys(raw).length ? JSON.stringify(raw) : null,
    });
  });

  if (!rows.length) return;
  await sb(env, 'market_consensus', 'POST', rows);
  console.log(`[Sharp] ${rows.length} consensus snapshots opgeslagen`);
}

// ── 2. Elite detectSharpMoney ─────────────────────────────
// Combineert:
//   a) Odds movement (opening vs huidig) — legacy steam/drift
//   b) Poisson divergence vs markt fair implied
//   c) Consensus sterkte (minder variance = meer boekmakers het eens)
// Geeft sharpSignals terug voor gebruik in confidence-berekening
async function detectSharpMoney(oddsMap, matches, env, poissonMap) {
  const today = new Date().toISOString().split('T')[0];

  // Haal opening odds op uit market_consensus (vroegste snapshot vandaag)
  const existingConsensus = await sb(env, 'market_consensus', 'GET', null,
    `?match_date=eq.${today}&select=fixture_id,home_odds_consensus,draw_odds_consensus,away_odds_consensus,home_variance,draw_variance,away_variance,bookmaker_count,home_implied_pct,draw_implied_pct,away_implied_pct,captured_at&order=captured_at.asc`
  ) || [];

  // Fallback: ook legacy odds_snapshots voor opening
  const existingLegacy = await sb(env, 'odds_snapshots', 'GET', null,
    `?match_date=eq.${today}&select=fixture_id,home_odds,draw_odds,away_odds,captured_at&order=captured_at.asc`
  ) || [];

  // Bouw opening map — consensus heeft prioriteit, anders legacy
  const openMap = {};
  existingLegacy.forEach(r => {
    if (openMap[r.fixture_id]) return;
    openMap[r.fixture_id] = {
      home: parseFloat(r.home_odds), draw: parseFloat(r.draw_odds), away: parseFloat(r.away_odds),
      homeVar: null, drawVar: null, awayVar: null, books: 0,
      homeFair: null, drawFair: null, awayFair: null,
    };
  });
  existingConsensus.forEach(r => {
    openMap[r.fixture_id] = {
      home:     parseFloat(r.home_odds_consensus),
      draw:     parseFloat(r.draw_odds_consensus),
      away:     parseFloat(r.away_odds_consensus),
      homeVar:  r.home_variance  ? parseFloat(r.home_variance)  : null,
      drawVar:  r.draw_variance  ? parseFloat(r.draw_variance)  : null,
      awayVar:  r.away_variance  ? parseFloat(r.away_variance)  : null,
      books:    r.bookmaker_count || 0,
      homeFair: r.home_implied_pct ? parseFloat(r.home_implied_pct) : null,
      drawFair: r.draw_implied_pct ? parseFloat(r.draw_implied_pct) : null,
      awayFair: r.away_implied_pct ? parseFloat(r.away_implied_pct) : null,
    };
  });

  const STEAM_THRESHOLD = 6;   // v26.89: 4→6% — alleen significante steam bewegingen
  const DRIFT_THRESHOLD = 5;   // % odds stijging = drift signaal
  const DIVERG_STRONG   = 10;  // pp: Poisson vs markt kloof als sterk
  const DIVERG_MODERATE = 6;   // pp: kloof als matig

  const sharpSignals  = {};
  const movements     = [];
  const mmmRows       = []; // model_market_comparison upserts

  matches.forEach(m => {
    const current = oddsMap[m.fixtureId];
    const opening = openMap[m.fixtureId];
    if (!current || !current.home) return;

    // Poisson kansen van deze scan (optioneel meegegeven)
    const poisson = poissonMap?.[m.fixtureId] || null;

    const picks = [
      { p: '1', open: opening?.home, curr: current.home,
        openVar: opening?.homeVar, currFair: current.fair?.home, openFair: opening?.homeFair,
        poissonPct: poisson?.h ?? null },
      { p: 'X', open: opening?.draw, curr: current.draw,
        openVar: opening?.drawVar, currFair: current.fair?.draw, openFair: opening?.drawFair,
        poissonPct: poisson?.x ?? null },
      { p: '2', open: opening?.away, curr: current.away,
        openVar: opening?.awayVar, currFair: current.fair?.away, openFair: opening?.awayFair,
        poissonPct: poisson?.a ?? null },
    ];

    picks.forEach(({ p, open, curr, openVar, currFair, openFair, poissonPct }) => {
      if (!curr || curr <= 1) return;

      // A) Odds movement
      let movPct      = null;
      let isSteam     = false;
      let isDrift     = false;
      if (open && open > 1) {
        movPct  = parseFloat((((curr - open) / open) * 100).toFixed(1));
        isSteam = movPct <= -STEAM_THRESHOLD;
        isDrift = movPct >=  DRIFT_THRESHOLD;
        if (Math.abs(movPct) >= STEAM_THRESHOLD) {
          movements.push({
            fixture_id: m.fixtureId, pick: p,
            from_odds: open, to_odds: curr,
            movement_pct: movPct,
            direction: isSteam ? 'steam' : 'drift',
            detected_at: new Date().toISOString(),
          });
        }
      }

      // B) Poisson vs markt divergentie
      let divergence      = null;
      let poissonOdds     = null;
      const marketFair    = currFair ?? openFair ?? null;  // % markt implied
      if (poissonPct !== null && marketFair !== null) {
        divergence  = parseFloat(Math.abs(poissonPct - marketFair).toFixed(2));
        poissonOdds = poissonPct > 0 ? parseFloat((100 / poissonPct).toFixed(2)) : null;
      }

      // C) Consensus sterkte (inverse variance → hoger = boekmakers het meer eens)
      let consensusStrength = 50; // default neutraal
      if (openVar !== null && openVar !== undefined) {
        // variance 0 = perfect consensus (100), variance >0.3 = chaotisch (0)
        consensusStrength = parseFloat(Math.max(0, Math.min(100, 100 - openVar * 333)).toFixed(1));
      } else if (current.books > 0) {
        // Schat consensus sterkte op basis van aantal bookmakers
        consensusStrength = Math.min(100, 30 + current.books * 5);
      }

      // ── FINAL SHARP SCORE (0-100) ──────────────────────
      // Gewichten: divergentie 40%, steam 30%, consensus 20%, boeken 10%
      let score = 0;

      // Divergentie component (0-40)
      if (divergence !== null) {
        if (divergence >= DIVERG_STRONG)   score += 40;
        else if (divergence >= DIVERG_MODERATE) score += 25;
        else if (divergence >= 3)          score += 12;
      }

      // Steam component (0-30)
      if (isSteam) {
        const steamStrength = movPct !== null ? Math.min(30, Math.abs(movPct) * 2) : 15;
        score += steamStrength;
      } else if (isDrift) {
        score += 5; // drift is minder sterk signaal
      }

      // Consensus sterkte component (0-20)
      score += (consensusStrength / 100) * 20;

      // Boeken component (0-10)
      score += Math.min(10, (current.books || 0) * 0.8);

      score = parseFloat(Math.min(100, score).toFixed(1));
      const tier = sharpTier(score);

      // Steam signaal naar scan engine — alleen bij voldoende kwaliteit
      if (isSteam || score >= 55) {
        sharpSignals[m.fixtureId] = sharpSignals[m.fixtureId] || {};
        sharpSignals[m.fixtureId][p] = {
          movement:          movPct,
          sharpScore:        score,
          sharpTier:         tier,
          divergence:        divergence,
          consensusStrength: consensusStrength,
          isSteam,
          isDrift,
        };
        if (isSteam) console.log(`[Sharp] ${m.home} vs ${m.away} — ${p} ${movPct}% steam | score ${score} (${tier}) | div ${divergence}pp`);
        else         console.log(`[Sharp] ${m.home} vs ${m.away} — ${p} score ${score} (${tier}) | div ${divergence}pp`);
      }

      // model_market_comparison row (upsert per fixture+pick)
      mmmRows.push({
        fixture_id:           m.fixtureId,
        pick:                 p,
        poisson_win_pct:      poissonPct ?? null,
        poisson_odds:         poissonOdds,
        market_implied_pct:   marketFair,
        market_consensus_odds: curr,
        bookmaker_count:      current.books || 0,
        divergence_pct:       divergence,
        opening_odds:         open ?? null,
        movement_pct:         movPct,
        movement_momentum:    null,          // uitbreiden met tijdsvenster later
        consensus_strength:   consensusStrength,
        is_steam:             isSteam,
        is_drift:             isDrift,
        steam_bookmakers:     0,             // uitbreiden via per-book analyse later
        sharp_score:          score,
        sharp_tier:           tier,
        league_id:            m.leagueId || null,
        match_date:           m.matchDate || today,
        home:                 m.home,
        away:                 m.away,
        updated_at:           new Date().toISOString(),
      });
    });
  });

  // Sla movements op in bestaande tabel
  if (movements.length) {
    await sb(env, 'odds_movements', 'POST', movements);
    console.log(`[SB] ${movements.length} odds bewegingen opgeslagen`);
  }

  // Sla model_market_comparison op (upsert op fixture_id+pick)
  if (mmmRows.length) {
    await sb(env, 'model_market_comparison', 'POST', mmmRows, '?on_conflict=fixture_id,pick');
    console.log(`[Sharp] ${mmmRows.length} model-markt vergelijkingen opgeslagen`);
  }

  const eliteCount = Object.values(sharpSignals).flatMap(s => Object.values(s)).filter(v => v.sharpTier === 'elite').length;
  console.log(`[Sharp] ${Object.keys(sharpSignals).length} fixtures met signaal, ${eliteCount} elite`);
  return sharpSignals;
}

// ── 3. Post-settlement: sla sharp signal resultaat op ─────
// Aangeroepen vanuit verifyYesterdayPicks na settlement
async function saveSharpSignalResult(pick, result, closingOdds, env) {
  // Haal opgeslagen sharp data op uit model_market_comparison
  const rows = await sb(env, 'model_market_comparison', 'GET', null,
    `?fixture_id=eq.${pick.fixtureId}&pick=eq.${pick.pick}&select=*&limit=1`
  );
  const sharp = rows?.[0] || null;

  // Haal opening odds op uit market_consensus
  const snapRows = await sb(env, 'market_consensus', 'GET', null,
    `?fixture_id=eq.${pick.fixtureId}&order=captured_at.asc&limit=1`
  );
  const snap     = snapRows?.[0] || null;
  const openOdds = snap
    ? (pick.pick === '1' ? snap.home_odds_consensus
       : pick.pick === 'X' ? snap.draw_odds_consensus
       : snap.away_odds_consensus)
    : null;

  const closingO  = closingOdds || pick.odds;
  const clvPct    = openOdds && closingO
    ? parseFloat(((pick.odds - closingO) / closingO * 100).toFixed(2))
    : null;
  const won       = result === 'win';
  const signalCorrect = sharp?.is_steam ? won : null;  // only steam signals zijn binair correct/incorrect

  await sb(env, 'sharp_signal_results', 'POST', [{
    fixture_id:           pick.fixtureId,
    pick:                 pick.pick,
    sharp_score_at_pick:  sharp?.sharp_score    ?? null,
    sharp_tier_at_pick:   sharp?.sharp_tier     ?? null,
    poisson_vs_market_pct: sharp?.divergence_pct ?? null,
    was_steam:            sharp?.is_steam       ?? false,
    movement_at_pick:     sharp?.movement_pct   ?? null,
    consensus_strength:   sharp?.consensus_strength ?? null,
    our_odds:             pick.odds,
    our_ai_kans:          pick.aiKans,
    opening_odds:         openOdds ? parseFloat(openOdds) : null,
    closing_odds:         closingO,
    clv_pct:              clvPct,
    result,
    signal_correct:       signalCorrect,
    league_id:            pick.leagueId || null,
    match_date:           pick.matchDate || null,
    home:                 pick.home,
    away:                 pick.away,
    settled_at:           new Date().toISOString(),
  }], '?on_conflict=fixture_id,pick');
}


// ── Supabase: CLV opslaan na settlement ──────────────────
// v155: robuust — opening = vroegste snapshot, closing = live API of laatste snapshot.
// Bailt niet meer op lege live-CLV (die ontbreekt vaak omdat de API-odds na aftrap weg zijn);
// dan komt de slotkoers uit de odds_snapshots-tijdreeks. Geen slot = overslaan i.p.v. ruis schrijven.
async function saveCLV(pick, clv, won, closingOdds, env) {
  const pickOf = (s) => pick.pick === '1' ? s.home_odds
                      : pick.pick === 'X' ? s.draw_odds
                      : s.away_odds;

  let openingOdds = null, snapClose = null;
  try {
    const [first, last] = await Promise.all([
      sb(env, 'odds_snapshots', 'GET', null,
        `?fixture_id=eq.${pick.fixtureId}&order=captured_at.asc&limit=1`),
      sb(env, 'odds_snapshots', 'GET', null,
        `?fixture_id=eq.${pick.fixtureId}&order=captured_at.desc&limit=1`),
    ]);
    if (first?.length) { const v = parseFloat(pickOf(first[0])); if (v > 1) openingOdds = v; }
    if (last?.length)  { const v = parseFloat(pickOf(last[0]));  if (v > 1) snapClose   = v; }
  } catch(e) { console.warn('[CLV] Snapshot ophalen mislukt:', e.message); }

  // Slotkoers: live API > laatste snapshot. Geen betrouwbaar slot = niet schrijven.
  const closeO = (closingOdds && closingOdds > 1) ? parseFloat(closingOdds) : snapClose;
  if (!closeO || !(pick.odds > 1)) {
    console.warn(`[CLV] Geen slotkoers voor fixture ${pick.fixtureId} (${pick.pick}) — overgeslagen`);
    return;
  }

  const clvPct = (clv !== null && clv !== undefined)
    ? clv
    : parseFloat(((pick.odds / closeO - 1) * 100).toFixed(2));

  await sb(env, 'clv_results', 'POST', [{
    fixture_id: pick.fixtureId,
    pick: pick.pick,
    our_odds: pick.odds,
    opening_odds: openingOdds,
    closing_odds: closeO,
    clv_pct: clvPct,
    status: won ? 'win' : 'lose',
    match_date: pick.matchDate || null,
    league_id: pick.leagueId || null,
    settled_at: new Date().toISOString(),
  }], '?on_conflict=fixture_id,pick');
}

// ── Supabase: analytics endpoint ─────────────────────────
async function handleAnalytics(env) {
  try {
    const clvData = await sb(env, 'clv_results', 'GET', null,
      '?select=clv_pct,status,league_id,match_date&order=settled_at.desc&limit=200'
    ) || [];
    const sevenDaysAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0];
    const sharpData = await sb(env, 'odds_movements', 'GET', null,
      `?detected_at=gte.${sevenDaysAgo}T00:00:00Z&direction=eq.steam&pick=neq.X&order=movement_pct.asc&limit=50`
    ) || [];

    const withCLV = clvData.filter(r => r.clv_pct !== null);
    const avgCLV = withCLV.length
      ? parseFloat((withCLV.reduce((s,r) => s + parseFloat(r.clv_pct), 0) / withCLV.length).toFixed(1))
      : null;

    const _sumRow = await sb(env, 'v_clv_summary', 'GET', null, '?limit=1') || [];
    const _sum = _sumRow[0] || null;
    const _byLeague = await sb(env, 'v_clv_per_league', 'GET', null, '?order=picks.desc&limit=8') || [];

    // v124: extra views voor dashboard-wiring
    const _rating = await sb(env, 'v_league_rating', 'GET', null, '?order=reliability.desc&limit=12') || [];
    const _trend  = await sb(env, 'v_clv_trend', 'GET', null, '?order=settled_at.asc&limit=120') || [];
    const _market = await sb(env, 'v_clv_per_market', 'GET', null, '?order=picks.desc&limit=8') || [];
    const _recent = await sb(env, 'v_clv_recent', 'GET', null, '?limit=4') || [];

    return json({
      leagueRating: _rating.map(r => ({
        leagueId: r.league_id, picks: r.picks, wins: r.wins, losses: r.losses,
        hitrate: r.hitrate, avgCLV: r.avg_clv, roiPct: r.roi_pct,
        reliability: r.reliability, label: r.betrouwbaarheid_label,
      })),
      clvTrend: _trend.map(r => ({
        dag: r.dag, n: r.n, clvPct: r.clv_pct, cumAvgCLV: r.cum_avg_clv,
      })),
      clvPerMarket: _market.map(r => ({
        markt: r.markt, picks: r.picks, hitrate: r.hitrate,
        avgCLV: r.avg_clv, roiPct: r.roi_pct,
      })),
      clvRecent: _recent.map(r => ({
        periode: r.periode, picks: r.picks, avgCLV: r.avg_clv,
        roiPct: r.roi_pct, pctBeatClose: r.pct_beat_close,
      })),
      clvSummary: _sum ? {
        picks: _sum.picks, avgCLV: _sum.avg_clv_pct, pctBeatClose: _sum.pct_beat_close,
        winRate: _sum.win_rate, wins: _sum.wins, losses: _sum.losses,
        avgPosCLV: _sum.avg_pos_clv, bestCLV: _sum.best_clv, worstCLV: _sum.worst_clv,
      } : null,
      clvByLeague: _byLeague.map(r => ({ leagueId: r.league_id, picks: r.picks,
        avgCLV: r.avg_clv_pct, pctBeatClose: r.pct_beat_close, wins: r.wins, losses: r.losses })),
      clv: {
        total: clvData.length,
        avgCLV,
        positiveCLVPct: withCLV.length
          ? Math.round(withCLV.filter(r => parseFloat(r.clv_pct) > 0).length / withCLV.length * 100)
          : null,
      },
      // v144: pick tier performance + league tier data
      pickTierPerformance: await (async () => {
        try {
          const rows = await sb(env, 'picks', 'GET', null,
            `?status=in.(win,lose)&select=lock_level,elite,status,value,confidence,sharp_score,sharp_tier,league_name,pick,odds&limit=500`
          ) || [];
          const tiers = {};
          rows.forEach(r => {
            const tier = r.elite ? 'elite' : (r.lock_level || 'single');
            if (!tiers[tier]) tiers[tier] = { total:0, wins:0, valueSum:0, confSum:0, sharpSum:0, sharpN:0 };
            tiers[tier].total++;
            if (r.status === 'win') tiers[tier].wins++;
            tiers[tier].valueSum += parseFloat(r.value||0);
            tiers[tier].confSum  += parseFloat(r.confidence||0);
            if (r.sharp_score) { tiers[tier].sharpSum += parseFloat(r.sharp_score); tiers[tier].sharpN++; }
          });
          return Object.entries(tiers).map(([tier, s]) => ({
            tier,
            total:        s.total,
            wins:         s.wins,
            hitrate:      s.total ? parseFloat((s.wins/s.total*100).toFixed(1)) : 0,
            avgValue:     s.total ? parseFloat((s.valueSum/s.total).toFixed(1)) : 0,
            avgConf:      s.total ? parseFloat((s.confSum/s.total).toFixed(1)) : 0,
            avgSharp:     s.sharpN ? parseFloat((s.sharpSum/s.sharpN).toFixed(1)) : null,
          }));
        } catch(e) { return []; }
      })(),
      leagueTiers: await (async () => {
        try {
          const rows = await sb(env, 'league_calibration', 'GET', null,
            `?total=gt.0&select=league_id,league_name,wins,total,roi,factor,tier,avg_clv,clv_count&order=total.desc&limit=20`
          ) || [];
          return rows.map(r => ({
            leagueId:   r.league_id,
            leagueName: r.league_name,
            wins:       r.wins,
            total:      r.total,
            hitrate:    r.total ? parseFloat((r.wins/r.total*100).toFixed(1)) : 0,
            roi:        parseFloat(r.roi||0).toFixed(1),
            factor:     parseFloat(r.factor||1).toFixed(3),
            tier:       r.tier || 'onbekend',
            avgClv:     r.avg_clv ? parseFloat(r.avg_clv).toFixed(2) : null,
          }));
        } catch(e) { return []; }
      })(),
      sharpMoney: await (async () => {
        // v135b: teamnamen ophalen uit picks tabel via fixture IDs
        const steamTop = sharpData.slice(0, 8);
        const steamFixIds = [...new Set(steamTop.map(r => r.fixture_id))];

        // Haal teamnamen + datum op uit picks tabel
        let picksLookup = {};
        if (steamFixIds.length) {
          const pRows = await sb(env, 'picks', 'GET', null,
            `?fixture_id=in.(${steamFixIds.join(',')})&select=fixture_id,home,away,match_date,match_time,league_name&limit=50`
          ) || [];
          pRows.forEach(p => {
            if (!picksLookup[p.fixture_id]) {
              picksLookup[p.fixture_id] = {
                home: p.home, away: p.away,
                matchDate: p.match_date, matchTime: p.match_time,
                leagueName: p.league_name,
              };
            }
          });
        }

        // topSharpScores uit model_market_comparison (heeft teamnamen al)
        let topSharpScores = [];
        try {
          const sevenAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0];
          const rows = await sb(env, 'model_market_comparison', 'GET', null,
            `?match_date=gte.${sevenAgo}&sharp_score=gte.55&pick=neq.X&order=sharp_score.desc&limit=8`
          ) || [];
          // Verrijk ook model_market_comparison rijen met picks data als home/away leeg is
          topSharpScores = rows.map(r => {
            const pk = picksLookup[r.fixture_id] || {};
            return {
              fixtureId:         r.fixture_id,
              pick:              r.pick,
              home:              r.home || pk.home || null,
              away:              r.away || pk.away || null,
              matchDate:         r.match_date || pk.matchDate || null,
              leagueName:        pk.leagueName || null,
              sharpScore:        r.sharp_score,
              sharpTier:         r.sharp_tier,
              divergence:        r.divergence_pct,
              movementPct:       r.movement_pct,
              isSteam:           r.is_steam,
              isDrift:           r.is_drift,
              poissonPct:        r.poisson_win_pct,
              marketPct:         r.market_implied_pct,
              openingOdds:       r.opening_odds,
              consensusOdds:     r.market_consensus_odds,
              consensusStrength: r.consensus_strength,
            };
          });
        } catch(e) { console.error('[Sharp] topSharpScores fout:', e.message); }

        return {
          steamMovements7d: sharpData.length,
          topSteam: steamTop.map(r => {
            const pk = picksLookup[r.fixture_id] || {};
            return {
              fixtureId:  r.fixture_id,
              pick:       r.pick,
              movement:   r.movement_pct,
              detectedAt: r.detected_at,
              fromOdds:   r.from_odds  || null,
              toOdds:     r.to_odds    || null,
              direction:  r.direction  || 'steam',
              // v135b: teamnamen + datum vanuit picks tabel
              home:       pk.home      || null,
              away:       pk.away      || null,
              matchDate:  pk.matchDate || null,
              leagueName: pk.leagueName || null,
            };
          }),
          topSharpScores,
        };
      })(),
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
// v127: landenteam-/toernooi-competities — dunne statistische data, ook al is de markt scherp.
// WK (1), WK-kwal (4 UEFA, 6 CONMEBOL, 29 CAF, 36 AFC), Nations League (5), Vriendschappelijk (10).
const TOURNAMENT_LEAGUES = new Set([1, 4, 5, 6, 10, 29, 36]);
function isTournamentLeague(leagueId) { return TOURNAMENT_LEAGUES.has(Number(leagueId)); }

// ── v144: calculateConfidenceV30 ──────────────────────────
// Nieuwe gewichtsverdeling — AI maximaal 10% directe invloed
//
// Gewichten:
//   40% fairImplied    — Shin de-vigged marktodds (objectieve prior, bookmaker consensus)
//   20% valueScore     — Edge model vs markt (hoe groot is de kloof)
//   20% dataQuality    — Spread AI-schattingen + league calibratie kwaliteit
//   10% aiAdjustment   — AI-afwijking van markt, gecapped op ±20pp (nuancering, niet basis)
//   10% marketSignal   — Sharp money + odds beweging
//
// Poisson/AI kansen zijn nu ALLEEN input voor value en aiAdjustment.
// De markt (fairImplied) is de dominante factor.
function calculateConfidenceV20({ modelProb, value, dataQuality, marketSignal, leagueId, odds, calibFactor, pick, fairImplied: fairImpliedInput }) {
  const staticFactor = LEAGUE_FACTORS[leagueId] || 0.92;
  const leagueFactor = calibFactor ? (staticFactor * 0.30 + calibFactor * 0.70) : staticFactor;
  const bucketFactor = ODDS_BUCKET_FACTORS[getOddsBucket(odds)] || 0.90;
  const drawPenalty  = pick === 'X' ? 0.90 : 1.0; // v161: iets verzacht (was 0.85)

  // 1. fairImplied: marktodds als objectieve prior (40%)
  // Gebruik meegegeven fairImplied, anders bereken uit bookOdds
  const marketBase = fairImpliedInput != null
    ? Math.min(Math.max(fairImpliedInput, 5), 95)
    : Math.min(Math.max(impliedProb(odds) * 100 * 0.95, 5), 95); // 0.95 = ruwe Shin benadering

  // 2. valueScore: edge als % van markt, gecapped op 20pp = 100 (20%)
  const valueScore = Math.min(Math.max(value, 0), 20) / 20 * 100;

  // 3. dataQuality: spread van kansen + league kwaliteit (20%) — ongewijzigd
  const dq = Math.min(dataQuality, 100);

  // 4. aiAdjustment: hoeveel wijkt AI af van markt? Gecapped op ±20pp.
  // Grote afwijking én in goede richting = kleine bonus. AI heeft max 10% gewicht.
  // aiKans (modelProb) vs fairImplied → afwijking als signaal, niet als basis.
  const aiDivergence = modelProb - marketBase; // positief = AI bullisher dan markt
  // Converteer naar 0-100 score: 0pp afwijking = 50, +20pp = 100, -20pp = 0
  const aiAdj = Math.min(100, Math.max(0, 50 + aiDivergence * 2.5));

  // 5. marketSignal: sharp + beweging (10%) — ongewijzigd
  const ms = Math.min(marketSignal, 100);

  const raw =
    (marketBase   * 0.40) +   // Markt als objectieve prior
    (valueScore   * 0.20) +   // Edge/value
    (dq           * 0.20) +   // Datakwaliteit
    (aiAdj        * 0.10) +   // AI als nuancering (max 10%)
    (ms           * 0.10);    // Sharp/beweging

  const final = Math.max(0, Math.min(100, raw * leagueFactor * bucketFactor * drawPenalty));

  return {
    raw:         parseFloat(raw.toFixed(1)),
    final:       parseFloat(final.toFixed(1)),
    leagueFactor,
    bucketFactor,
    score:       Math.max(1, Math.min(10, Math.round(final / 10))),
    // Debug info
    _weights: { marketBase: parseFloat((marketBase*0.40).toFixed(1)), valueScore: parseFloat((valueScore*0.20).toFixed(1)),
                dq: parseFloat((dq*0.20).toFixed(1)), aiAdj: parseFloat((aiAdj*0.10).toFixed(1)), ms: parseFloat((ms*0.10).toFixed(1)) }
  };
}

// Elite pick detectie — v31: gelijkspel nooit auto-elite, strengere criteria
function isElitePick({ confidenceFinal, value, odds, pick, poissonUsed }) {
  // v144: drempel herijkt voor nieuwe confidence formule (markt-dominant)
  // Old: confidenceFinal >= 68 (AI-zwaar). New: >= 62 want markt is meer gedempt.
  return (
    confidenceFinal >= 62 &&
    value >= 8 &&
    odds >= 1.55 &&
    odds <= 4.80 &&
    pick !== 'X' &&                          // gelijkspel nooit auto-elite
    (poissonUsed || value >= 15)             // Poisson of hoge value vereist
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
  // v103: geen retry op Anthropic API — elke retry kost geld
  const isAnthropic = url.includes('anthropic.com');
  const maxRetries = isAnthropic ? 0 : retries;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (i === maxRetries) return res;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    } catch(e) {
      if (i === maxRetries) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

// ── API-Football helper ──────────────────────────────────
async function apif(path, env) {
  const key = env.FOOTBALL_KEY || '';
  const PAGE_CAP = 5; // v129: max pagina's voor drukke date-queries (subrequest-budget)
  const isDateFixtures = /^\/fixtures\?date=/.test(path); // alleen hier pagineren
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
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetchWithRetry(host.url, {
          headers: host.headers,
          cf: { cacheTtl: 0, cacheEverything: false }
        });
        const data = await res.json();
        if (data.errors?.token || data.errors?.key) break; // auth-fout → volgende host
        if (data.errors?.rateLimit) {                       // v114: niet stilletjes als [] teruggeven
          if (attempt === 0) { await new Promise(r => setTimeout(r, 1500)); continue; } // backoff + retry
          break; // na retry nog steeds limited → probeer volgende host
        }
        let out = data.response || [];
        // v129: API-Football pagineert /fixtures?date= op drukke dagen (bv. WK-warm-up).
        // Zonder dit vielen friendlies/Scandinavische leagues buiten pagina 1 → "geen wedstrijden".
        const totalPages = data.paging?.total || 1;
        if (isDateFixtures && totalPages > 1) {
          for (let p = 2; p <= Math.min(totalPages, PAGE_CAP); p++) {
            try {
              const r2 = await fetchWithRetry(host.url + '&page=' + p, {
                headers: host.headers, cf: { cacheTtl: 0, cacheEverything: false }
              });
              const d2 = await r2.json();
              if (Array.isArray(d2.response) && d2.response.length) out = out.concat(d2.response);
              else break;
            } catch (e) { break; }
          }
        }
        return out;
      } catch(e) { break; }
    }
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
  // ── Rate limiting — beschermt tegen kosteninflatie ────
  const MAX_USER_CALLS_PER_DAY  = 50;  // per gebruiker (verhoogd v135c: testers + WK)
  const MAX_GLOBAL_CALLS_PER_DAY = 400; // totaal per dag (12 cron-scans × meerdere wedstrijden)

  // Gebruiker UID uit Authorization header
  let uid = 'anonymous';
  const authHeader = request.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    // Gebruik eerste 16 chars van token als anonieme identifier
    uid = authHeader.slice(7, 23) || 'anonymous';
  }

  const today = new Date().toISOString().split('T')[0];
  const monthKey = today.slice(0, 7); // YYYY-MM

  // Check globale dagelijkse limiet via Firebase (snel)
  try {
    const globalKey = `usage/daily/${today}`;
    const globalCount = (await fb(env, globalKey)) || 0;
    if (globalCount >= MAX_GLOBAL_CALLS_PER_DAY) {
      console.warn(`[Anthropic] Globale daglimiet bereikt: ${globalCount}/${MAX_GLOBAL_CALLS_PER_DAY}`);
      return json({ error: 'Daglimiet bereikt — probeer morgen opnieuw', type: 'rate_limit', limit: MAX_GLOBAL_CALLS_PER_DAY }, 429);
    }

    // Check gebruiker daglimiet
    if (uid !== 'anonymous') {
      const userKey = `usage/users/${uid}/${today}`;
      const userCount = (await fb(env, userKey)) || 0;
      if (userCount >= MAX_USER_CALLS_PER_DAY) {
        console.warn(`[Anthropic] User daglimiet bereikt: ${uid} ${userCount}/${MAX_USER_CALLS_PER_DAY}`);
        return json({ error: `Jouw daglimiet van ${MAX_USER_CALLS_PER_DAY} analyses bereikt — morgen weer beschikbaar`, type: 'rate_limit', limit: MAX_USER_CALLS_PER_DAY }, 429);
      }
      // Teller ophogen
      await fb(env, userKey, 'PUT', userCount + 1);
    }

    // Globale teller ophogen
    await fb(env, globalKey, 'PUT', globalCount + 1);
  } catch(e) {
    console.warn('[Anthropic] Rate limit check fout (doorgaan):', e.message);
  }

  // v97: valideer body vóór doorsturen naar Anthropic — voorkomt 400-loop bij multiscan
  let body;
  try {
    body = await request.text();
    const parsed = JSON.parse(body);
    if (!parsed.messages || !Array.isArray(parsed.messages) || parsed.messages.length === 0) {
      console.error('[Anthropic] Body afgewezen: messages array leeg of ontbreekt');
      return json({ error: 'messages array leeg of ontbreekt', type: 'invalid_request' }, 400);
    }
    const firstMsg = parsed.messages[0];
    if (!firstMsg.content || (typeof firstMsg.content === 'string' && !firstMsg.content.trim())) {
      console.error('[Anthropic] Body afgewezen: eerste message heeft lege content');
      return json({ error: 'message content is leeg', type: 'invalid_request' }, 400);
    }
  } catch(e) {
    console.error('[Anthropic] Body afgewezen: invalide JSON —', e.message);
    return json({ error: 'Invalide JSON body: ' + e.message, type: 'invalid_request' }, 400);
  }

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

  if (res.status === 400) {
    console.error('[Anthropic] 400 van Anthropic API:', JSON.stringify(data).substring(0, 300));
  }

  // ── Kosten bijhouden in Supabase ──
  if (res.status === 200 && data.usage) {
    try {
      const inputTokens  = data.usage.input_tokens  || 0;
      const outputTokens = data.usage.output_tokens || 0;
      // claude-sonnet-4: $3/M input, $15/M output
      const costUSD = (inputTokens * 3 + outputTokens * 15) / 1_000_000;
      await sb(env, 'user_costs', 'POST', [{
        uid, month: monthKey,
        ai_calls: 1,
        total_cost: costUSD,
        last_updated: new Date().toISOString(),
      }], '?on_conflict=uid,month');
      console.log(`[Anthropic] ${uid} — ${inputTokens}in/${outputTokens}out — $${costUSD.toFixed(5)}`);
    } catch(e) {
      console.warn('[Anthropic] Kosten tracking fout:', e.message);
    }
  }

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
async function fetchOddsForFixtures(fixtureIds, env, maxCalls = 36) {
  const oddsMap = {};
  let oddsCallsUsed = 0; // bewaak Cloudflare 50-subrequest-budget

  const median = arr => {
    const s = arr.filter(x => x > 1).sort((a, b) => a - b);
    if (!s.length) return 0;
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  // v118: consensus over ALLE bookmakers in 1 call per match (i.p.v. 1 bookmaker + fallbackketen).
  // Mediaan per uitkomst = robuust tegen uitschieters/stale prijzen -> minder valse value-picks.
  function parseConsensus(data, fid) {
    if (!data || !data.length) return false;
    const books = data[0]?.bookmakers || [];
    const H = [], D = [], A = [];
    for (const bm of books) {
      const bet = bm.bets?.find(b => b.id === 1);
      if (!bet) continue;
      const h = parseFloat(bet.values?.find(v => v.value === 'Home')?.odd || 0);
      const d = parseFloat(bet.values?.find(v => v.value === 'Draw')?.odd || 0);
      const a = parseFloat(bet.values?.find(v => v.value === 'Away')?.odd || 0);
      if (h > 1 && d > 1 && a > 1) { H.push(h); D.push(d); A.push(a); }
    }
    if (!H.length) return false;
    const home = parseFloat(median(H).toFixed(2));
    const draw = parseFloat(median(D).toFixed(2));
    const away = parseFloat(median(A).toFixed(2));
    // v128: Shin de-vig i.p.v. proportioneel — corrigeert favorite-longshot bias
    const [fh, fd, fa] = shinDevig([home, draw, away]);
    oddsMap[fid] = {
      home, draw, away,
      books: H.length,
      fair: {
        home: parseFloat((fh * 100).toFixed(1)),
        draw: parseFloat((fd * 100).toFixed(1)),
        away: parseFloat((fa * 100).toFixed(1))
      }
    };
    return true;
  }

  // v146: datum-bulk odds fetch — 1-2 calls i.p.v. 1 per fixture
  // /odds?date=YYYY-MM-DD haalt alle odds voor die dag in 1 call op (paginated)
  // Veel minder API-calls, voorkomt rate limiting
  try {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const fixtureSet = new Set(fixtureIds);

    for (const date of [today, tomorrow]) {
      if (oddsCallsUsed >= maxCalls) break;
      try {
        // Pagina 1
        const _cb = Date.now();
        const r1 = await apif(`/odds?date=${date}&bet=1&page=1&_cb=${_cb}`, env);
        oddsCallsUsed++;
        if (r1?.length) {
          r1.forEach(item => {
            const fid = item.fixture?.id;
            if (fid && fixtureSet.has(fid) && !oddsMap[fid]) parseConsensus([item], fid);
          });
          // Pagina 2 als nog niet alle fixtures gedekt
          const covered = fixtureIds.filter(id => oddsMap[id]).length;
          if (covered < fixtureIds.length && oddsCallsUsed < maxCalls) {
            const r2 = await apif(`/odds?date=${date}&bet=1&page=2`, env);
            oddsCallsUsed++;
            if (r2?.length) r2.forEach(item => {
              const fid = item.fixture?.id;
              if (fid && fixtureSet.has(fid) && !oddsMap[fid]) parseConsensus([item], fid);
            });
          }
        }
      } catch(e) { console.error(`[Odds] Bulk datum ${date} fout:`, e.message); }
    }

    // Fallback: nog ontbrekende fixtures individueel ophalen (max 5)
    const missing = fixtureIds.filter(id => !oddsMap[id]);
    if (missing.length && oddsCallsUsed < maxCalls) {
      console.log(`[Odds] Fallback: ${missing.length} fixtures individueel ophalen`);
      const toFetch = missing.slice(0, Math.min(5, maxCalls - oddsCallsUsed));
      oddsCallsUsed += toFetch.length;
      const rs = await Promise.allSettled(toFetch.map(id => apif(`/odds?fixture=${id}&bet=1`, env)));
      rs.forEach((r, j) => { if (r.status === 'fulfilled') parseConsensus(r.value, toFetch[j]); });
    }
  } catch (e) {
    console.error('[Odds] Fout bij ophalen:', e);
  }
  const n = Object.keys(oddsMap).length;
  const avgBooks = n ? (Object.values(oddsMap).reduce((s, o) => s + (o.books || 0), 0) / n).toFixed(1) : 0;
  console.log(`[Odds] ${n}/${fixtureIds.length} fixtures met consensus-odds (gem. ${avgBooks} bookmakers)`);
  return oddsMap;
}

// ── Poisson value berekening ─────────────────────────────
function impliedProb(odds) {
  if (!odds || odds <= 1) return 0;
  return 1 / odds;
}

// v157: value-hardening tegen favorite-longshot-bias
const MARKET_SHRINK_BASE       = 0.45; // v161: iets lichter (was 0.50) — meer thuis/uit-value laten doorkomen
const MARKET_SHRINK_TOURNAMENT = 0.55; // v161: iets lichter (was 0.65) — toernooi nog steeds scherper richting markt
const LONGSHOT_ODDS            = 3.5;  // odds >= dit = longshot
const LONGSHOT_MIN_SHARP       = 55;   // longshot-value alleen toegestaan mét sharpScore >= dit

// v125: value = de-vigde procentpunt-edge (modelkans% − faire consensus-implied%).
// v157: model eerst richting de markt schrinken zodat AI-ruis niet als value op longshots verschijnt.
// Intern consistent met CLV — we meten tegen de faire (vig-vrije) marktkans, niet tegen de ruwe odds.
function calculateValue(aiKans, fairImpliedPct, pick, marketShrink = 0) {
  if (fairImpliedPct == null || fairImpliedPct <= 0) return 0;
  const w = Math.min(Math.max(marketShrink, 0), 0.9);
  const modelProb = w * fairImpliedPct + (1 - w) * aiKans; // shrinkage naar markt-prior
  let value = modelProb - fairImpliedPct;
  if (pick === 'X') value = value * 0.88; // v161: gelijkspel-straf iets verzacht (was 0.80)
  return parseFloat(value.toFixed(1));
}

// v125: EV% en half-Kelly o.b.v. werkelijk verkrijgbare odds (mét vig) — voor staking, niet voor selectie.
function calcEV(aiKans, odds) {
  if (!odds || odds <= 1) return 0;
  return parseFloat((((aiKans / 100) * odds - 1) * 100).toFixed(1));
}
function calcKellyW(aiKans, odds) {
  if (!aiKans || !odds || odds <= 1) return 0;
  const p = aiKans / 100, b = odds - 1;
  const k = (b * p - (1 - p)) / b;
  return Math.max(0, parseFloat((k * 50).toFixed(2))); // half-Kelly in %
}
// v128: faire consensus-implied kans (%) voor de gekozen uitslag
function fairImpliedFor(odds, pick) {
  if (!odds || !odds.fair) return null;
  return pick === '1' ? odds.fair.home : pick === 'X' ? odds.fair.draw : odds.fair.away;
}

// v128: Shin de-vig — corrigeert favorite-longshot bias (underdog-prijs draagt relatief meer marge).
// Geeft ware kansen (0-1) terug; valt terug op proportioneel als er nauwelijks marge is.
function shinDevig(oddsArr) {
  const b = oddsArr.map(o => (o > 1 ? 1 / o : 0));
  const B = b.reduce((s, x) => s + x, 0);
  if (B <= 1.0001) return b.map(x => x / (B || 1)); // geen marge -> proportioneel
  const probs = (z) => b.map(bi => (Math.sqrt(z * z + 4 * (1 - z) * bi * bi / B) - z) / (2 * (1 - z)));
  let lo = 0, hi = 0.5; // Σp is monotoon dalend in z; zoek z zodat Σp = 1
  for (let it = 0; it < 60; it++) {
    const z = (lo + hi) / 2;
    const sum = probs(z).reduce((s, x) => s + x, 0);
    if (sum > 1) lo = z; else hi = z;
  }
  return probs((lo + hi) / 2);
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

  const picks = await sbGetPicks(env);

  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 30); // uitgebreid naar 30 dagen
  const cutoffStr = cutoff.toISOString().split('T')[0];
  // todayStr + 1 dag zodat wedstrijden van vandaag ook gesettled worden
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const toVerify = Object.entries(picks).filter(([id, p]) => {
    // processed !== false EN processed !== undefined (pakt ook picks zonder processed veld)
    if (p.processed === true) return false;
    if (p.status !== 'pending') return false;
    const normalized = normalizeDate(p.matchDate);
    if (!normalized) return false;
    return normalized >= cutoffStr && normalized < tomorrowStr;
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
    let closingOdd = null; // v103: buiten try voor scope bij saveCLV
    try {
      const closingOdds = clvOdds[i];
      if (closingOdds?.length > 0) {
        const bm = closingOdds[0]?.bookmakers?.[0];
        const bet = bm?.bets?.find(b => b.id === 1);
        if (bet) {
          closingOdd = parseFloat(
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

    try { await saveCLV(pick, clv, won, closingOdd || null, env); } catch(e) { console.error('[SB] CLV fout:', e.message); }
    // v135: sla sharp signal resultaat op voor post-WK calibratie
    try { await saveSharpSignalResult(pick, won ? 'win' : 'lose', closingOdd || null, env); } catch(e) { console.error('[SB] SharpResult fout:', e.message); }
    updated++;
    updatedIds.push(id);
  }

  if (updated > 0) {
    await sbSavePicks(picks, env);
    // v119 (R1): Firebase 'picks'-fallback verwijderd — niet gelezen (worker leest Supabase, client leest per-user backup). Bespaart subrequest + voorkomt drift.
    console.log(`[Verify] ${updated} picks gesetteld`);
    await updateLeagueCalibration(env, picks, updatedIds);
  }
}

// ── League calibratie bijwerken na settlement ─────────────
async function updateLeagueCalibration(env, picks, updatedIds) {
  try {
    const calibration = await sbGetCalibration(env);

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

    await sbSaveCalibration(calibration, env);
    await fb(env, 'calibration', 'PUT', calibration); // FB fallback
    console.log('[Calibratie] Bijgewerkt voor', updatedIds.length, 'picks');
  } catch(e) {
    console.error('[Calibratie] Fout:', e.message);
  }
}

// ── Weekly calibratie job (zondag 06:00 UTC) ─────────────
async function runWeeklyCalibration(env) {
  console.log('[WeeklyCalib] Start wekelijkse calibratie...');
  try {
    const calibration = await sbGetCalibration(env);
    const picks = await sbGetPicks(env);

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

    // v144: automatische tier berekening per league
    const tierUpdates = [];
    Object.entries(leagueStats).forEach(([lid, stats]) => {
      if (stats.total < 10) return; // te weinig data
      const hitrate = stats.wins / stats.total;
      const avgClv = calibration[lid]?.clvSum && calibration[lid]?.clvCount
        ? calibration[lid].clvSum / calibration[lid].clvCount : null;

      let tier = 'neutraal';
      if (hitrate >= 0.45 && (avgClv === null || avgClv >= 2))  tier = 'elite';
      else if (hitrate >= 0.35 && (avgClv === null || avgClv >= 0)) tier = 'goed';
      else if (hitrate < 0.25 || (avgClv !== null && avgClv < -3))  tier = 'risico';

      // Factor aanpassen op basis van tier
      if (!calibration[lid]) calibration[lid] = { leagueName: stats.name };
      calibration[lid].tier = tier;
      calibration[lid].tierUpdatedAt = new Date().toISOString();

      // Extra penalty voor risico leagues
      if (tier === 'risico' && calibration[lid].factor > 0.75) {
        calibration[lid].factor = parseFloat(Math.max(0.70, calibration[lid].factor * 0.90).toFixed(3));
        console.log(`[WeeklyCalib] ${stats.name} (${lid}) → RISICO tier, factor verlaagd naar ${calibration[lid].factor}`);
      }
      if (tier === 'elite' && calibration[lid].factor < 1.10) {
        calibration[lid].factor = parseFloat(Math.min(1.30, calibration[lid].factor * 1.05).toFixed(3));
        console.log(`[WeeklyCalib] ${stats.name} (${lid}) → ELITE tier, factor verhoogd naar ${calibration[lid].factor}`);
      }

      // Supabase tier update
      tierUpdates.push({
        league_id: lid,
        tier,
        tier_updated_at: new Date().toISOString(),
        avg_clv: avgClv ? parseFloat(avgClv.toFixed(2)) : null,
      });
    });

    // Sla tier updates op in Supabase
    if (tierUpdates.length) {
      for (const t of tierUpdates) {
        await sb(env, 'league_calibration', 'POST', [t], '?on_conflict=league_id');
      }
      console.log(`[WeeklyCalib] ${tierUpdates.length} league tiers bijgewerkt`);
    }

    await sbSaveCalibration(calibration, env);
    await fb(env, 'calibration', 'PUT', calibration); // FB fallback
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
  // Zomertijd correctie: Nederland is UTC+2 (maart-oktober), UTC+1 (oktober-maart)
  const month = now.getUTCMonth() + 1; // 1-12
  const isDST = month >= 3 && month <= 10; // Zomertijd maart t/m oktober
  const hour = now.getUTCHours() + (isDST ? 2 : 1);

  let scanFrom = 6, scanTo = 18, autoScanEnabled = true, maxPerDay = 8;
  try {
    const schedule = await fb(env, 'scan_schedule');
    if (schedule) {
      // Alleen enabled/maxPerDay uit Firebase — scanFrom/scanTo altijd via code defaults
      autoScanEnabled = schedule.enabled !== false;
      maxPerDay       = schedule.maxPerDay ?? 8;
      // startHour/endHour bewust NIET uit Firebase — voorkomt verkeerde configuratie
      console.log('[Scan] scan_schedule geladen, scanvenster vast 06:00-18:00 NL');
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
  const WK_ONLY_MODE = false; // v138: alle actieve competities + WK
  const isWKActive = WK_ONLY_MODE || (dateNow >= wkStart && dateNow < wkEnd);

  let leagueConfig;
  if (false) { // uitgeschakeld — altijd volledige config
    leagueConfig = [{ id: 1, s: 2026 }];
    console.log('[Scan] 🏆 WK actief — alleen WK (ID 1)');
  } else {
    // Actieve competities buiten WK-periode:
    // 88 Eredivisie playoffs, 113 Eliteserien NO, 113→ check, 
    // 103 Allsvenskan SE, 2/3/848 CL/EL/ECL (t/m eind mei)
    // v148: automatische seizoenswisseling
    // Fase 1: WK-zomer (t/m 19 jul 2026) — WK + actieve zomercompetities
    // Fase 2: Post-WK / nieuw Europees seizoen (vanaf 20 jul 2026) — alleen Europa
    const postWK = dateNow >= new Date('2026-07-20');

    if (!postWK) {
      // ── FASE 1: WK-zomer ──────────────────────────────────
      leagueConfig = [
        { id: 1,   s: 2026 }, // FIFA World Cup 2026 — v153: WK-only tijdens toernooi
      ];
      console.log('[Scan] FASE 1 — WK-only: alleen World Cup (league 1)');
    } else {
      // ── FASE 2: Post-WK — alleen Europa (nieuw seizoen 2026-27) ─
      leagueConfig = [
        // Top 5 Europa
        { id: 39,  s: 2026 }, // Premier League Engeland
        { id: 140, s: 2026 }, // La Liga Spanje
        { id: 78,  s: 2026 }, // Bundesliga Duitsland
        { id: 135, s: 2026 }, // Serie A Italië
        { id: 61,  s: 2026 }, // Ligue 1 Frankrijk
        // Europese subtop
        { id: 88,  s: 2026 }, // Eredivisie Nederland
        { id: 94,  s: 2026 }, // Primeira Liga Portugal
        { id: 144, s: 2026 }, // Jupiler Pro League België
        { id: 179, s: 2026 }, // Scottish Premiership
        { id: 197, s: 2026 }, // Super League Zwitserland
        { id: 203, s: 2026 }, // Super Lig Turkije
        // Europese toernooien
        { id: 2,   s: 2026 }, // Champions League
        { id: 3,   s: 2026 }, // Europa League
        { id: 848, s: 2026 }, // Conference League
        // Nederland
        { id: 43,  s: 2026 }, // Keuken Kampioen Divisie
        // Duitsland
        { id: 79,  s: 2026 }, // 2. Bundesliga
        { id: 80,  s: 2026 }, // 3. Liga
        // Engeland
        { id: 40,  s: 2026 }, // Championship
        { id: 41,  s: 2026 }, // League One
      ];
      console.log('[Scan] FASE 2 — Post-WK Europese seizoen: 19 leagues actief');
    }
  }

  // Leagues die UTC timezone gebruiken — date= werkt niet, gebruik next=15
  const NEXT_LEAGUES = new Set([1, 113, 103, 119, 129, 253, 71, 239, 292, 98, 169]); // v153: WK (1) vangnet // v146: alleen actieve zomer-leagues // 10=Friendlies, 5=NL, 6/29/36=WK kwal

  const SCAN_LEAGUES = leagueConfig.map(l => l.id);
  const SCAN_LEAGUE_SET = new Set(SCAN_LEAGUES);

  try {
    // v114: 2 globale date-calls i.p.v. ~28 per-league calls.
    // Fixt API-Football per-seconde burst-limiet (28 parallelle calls > ~5/sec op Pro)
    // én Cloudflare 50-subrequest-limiet (budget komt vrij voor odds + AI).
    const [fxToday, fxTomorrow] = await Promise.all([
      apif(`/fixtures?date=${today}&timezone=Europe/Amsterdam`, env),
      apif(`/fixtures?date=${tomorrowStr}&timezone=Europe/Amsterdam`, env),
    ]);
    const fixtures = [...fxToday, ...fxTomorrow].filter(f => SCAN_LEAGUE_SET.has(f.league?.id));

    const seen = new Set();
    const unique = fixtures.filter(f => {
      const id = f.fixture?.id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    console.log(`[Scan] ${unique.length} unieke fixtures gevonden over ${SCAN_LEAGUES.length} leagues`);

    // v130: vangnet — internationale/Scandinavische leagues die date= soms mist (UTC-opslag).
    // Alleen leagues die in de date=-uitkomst ontbraken aanvullen met next= (gezonde dag = 0 extra calls).
    const seasonOf = (id) => { const l = leagueConfig.find(x => x.id === id); return l ? l.s : 2026; };
    const coveredLeagues = new Set(unique.map(f => f.league?.id));
    const missingNext = SCAN_LEAGUES.filter(id => NEXT_LEAGUES.has(id) && !coveredLeagues.has(id));
    const recovered = [];
    if (missingNext.length) {
      console.log(`[Scan] ${missingNext.length} intl/Scand. leagues niet in date=, next= ophalen: ${missingNext.join(',')}`);
      for (const lid of missingNext.slice(0, 8)) { // cap i.v.m. Cloudflare subrequest-budget
        try {
          const nx = await apif(`/fixtures?league=${lid}&season=${seasonOf(lid)}&next=10&timezone=Europe/Amsterdam`, env);
          nx.forEach(f => { const id = f.fixture?.id; if (id && !seen.has(id)) { seen.add(id); recovered.push(f); } });
        } catch(e) { console.warn(`[Scan] next= faalde voor league ${lid}`, e); }
      }
      console.log(`[Scan] ${recovered.length} extra fixtures via next=`);
    }
    const combined = [...unique, ...recovered];

    const nowMs = Date.now();
    // Bij handmatige scan: alle wedstrijden van vandaag (tot midnight +1u)
    // Bij automatische scan: alleen wedstrijden die binnen 4u beginnen
    const endOfDay = new Date(today + 'T23:59:59').getTime() + 60 * 60 * 1000;
    // Automatische scan: wedstrijden binnen 24u (vandaag + vanavond + morgenochtend)
    // Handmatige scan (force): alle wedstrijden van vandaag t/m midnight
    const timeWindow = force ? endOfDay : nowMs + 24 * 60 * 60 * 1000;

    allMatches = combined
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
    // v107: reset teller als het een nieuwe dag is
    const st0 = await sbGetScanStatus(env); // R1-fase2: teller uit Supabase
    const lastScanDate = st0.scanDate;
    const rawScansToday = st0.scansToday;
    const scansToday0 = (lastScanDate !== today) ? 1 : rawScansToday + 1;
    if (lastScanDate !== today) console.log(`[Scan] Nieuwe dag — teller gereset (${lastScanDate} → ${today})`);
    // v103: hard limit — max scans per dag
    const MAX_SCANS_PER_DAY = 8; // v107: verhoogd van 5→8
    if (scansToday0 > MAX_SCANS_PER_DAY) {
      console.warn(`[Scan] Daglimiet bereikt: ${scansToday0-1}/${MAX_SCANS_PER_DAY} scans — stop`);
      return { ok: false, reason: 'daglimiet', scansToday: scansToday0 - 1 };
    }
    const scanData0 = { lastRun: new Date().toISOString(), lastMatchCount: 0,
      lastPickCount: 0, lastWithOdds: 0, lastWithoutOdds: 0,
      scanDate: today, version: VERSION, scansToday: scansToday0 };
    await sbUpdateScanStatus(scanData0, env);
    // v134: geen push bij lege scan — alleen pushen bij echte picks
    console.log('[Scan] Geen wedstrijden in tijdvenster — stil afsluiten (geen push)');
    return;
  }

  allMatches.sort((a, b) => {
    const ta = new Date(a.matchTime || 0).getTime();
    const tb = new Date(b.matchTime || 0).getTime();
    return ta - tb;
  });

  const youthBefore = allMatches.length;
  allMatches = allMatches.filter(m => !isYouthMatch(m.home, m.away));
  if (allMatches.length !== youthBefore) console.log(`[Scan] ${youthBefore - allMatches.length} jeugdwedstrijden (U15-U23) uitgefilterd`);

  const batch = allMatches.slice(0, 12);
  console.log(`[Scan] ${batch.length} wedstrijden gevonden, odds ophalen...`);

  // v155: snapshot-dekking verbreed. We halen odds op voor ALLE aankomende fixtures
  // (today+tomorrow, actieve leagues) i.p.v. alleen de 12 die we AI-analyseren.
  // De bulk date-fetch dekt de hele dag al in 2-4 calls, dus dit kost nauwelijks extra
  // subrequests. Resultaat: elke fixture krijgt meerdere snapshots over de 6 dagelijkse
  // cron-runs -> een echte opening->closing curve i.p.v. 1 losse meting (CLV-fix).
  const fixtureIds = allMatches.map(m => m.fixtureId).filter(Boolean);
  const oddsMap = await fetchOddsForFixtures(fixtureIds, env, 30); // bulk dekt alles; fallback gecapt op 5
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
    await saveOddsSnapshots(oddsMap, allMatches, env); // v155: snapshot alle aankomende fixtures, niet alleen de 12-batch
    // v135: market_consensus snapshot opslaan (multi-book variance + implied pct)
    await saveMarketConsensusSnapshot(oddsMap, batch, null, env);
    // v135: detectSharpMoney met Poisson map (null = eerste run, poisson komt na AI-ronde)
    sharpSignals = await detectSharpMoney(oddsMap, batch, env, null) || {};
  } catch(e) {
    console.error('[SB] fout (non-fatal):', e.message);
  }

  const withOdds = batch.filter(m => oddsMap[m.fixtureId]);
  const withoutOdds = batch.filter(m => !oddsMap[m.fixtureId]);

  // Internationale oefenwedstrijden (league 10/5/6) ook analyseren zonder odds
  // Ze worden gemarkeerd als isSparseData zodat confidence-drempel omhoog gaat
  const INTL_LEAGUES = new Set([5, 6, 10, 29, 36]);
  const withoutOddsIntl = withoutOdds.filter(m => INTL_LEAGUES.has(m.leagueId));
  const analyseBatch = withOdds.length > 0
    ? [...withOdds, ...withoutOddsIntl]  // altijd interlands toevoegen
    : batch;
  const prompt = `Je bent een kwantitatief voetbal data-analist. Analyseer ELKE wedstrijd op basis van statistische verwachtingen.

KRITISCHE REGELS:
- Baseer kansen op historische doelpuntenpatronen en competitieniveau, NIET op teamnamen of reputatie
- GELIJKSPEL WAARSCHUWING: Gelijkspel komt voor in slechts ~25-28% van alle wedstrijden. Overschat gelijkspelkansen NIET. Wees terughoudend met kansX boven 30% tenzij teams historisch veel gelijkspeelden
- Thuisvoordeel is reëel: gemiddeld +5-8% kansverhoging voor thuisteam in Europese competities
- Kleine competities (Noorwegen/Zweden/lagere divisies): data is onbetrouwbaarder, geef lagere confidence
- LANDENTEAMS/TOERNOOI [LANDENDUEL/TOERNOOI tag]: gebruik marktodds als sterke prior. Weeg FIFA-ranking: +20 plaatsen hoger = ca. +4% kansverhoging. Recente form laatste 3 duels zwaarder dan historisch gemiddelde. WK-groepsfase: hoge motivatie beide teams, verrassingen komen vaker voor. Confidence 5-7, nooit boven 7 voor landenduels
- Som van h+x+a moet exact 100 zijn

WEDSTRIJDEN:
${analyseBatch.map((m, i) => {
  const odds = oddsMap[m.fixtureId];
  const oddsStr = odds ? ` | Odds: ${odds.home}/${odds.draw}/${odds.away}` : '';
  const isTournM = typeof isTournamentLeague === 'function' && isTournamentLeague(m.leagueId);
  const tournTag = isTournM ? ' [LANDENDUEL/TOERNOOI]' : '';
  return `${i+1}. ${m.home} vs ${m.away} (${m.leagueName}, ${m.matchDate || 'datum?'})${tournTag}${oddsStr}`;
}).join('\n')}

Antwoord ALLEEN met een JSON array — geen tekst, geen uitleg, geen markdown:
[{"h":52,"x":26,"a":22,"c":7},...]
Exact ${analyseBatch.length} objecten, zelfde volgorde.`;

  let aiResults = [];
  try {
    const aiRes = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        // v142: prompt caching — systeem-deel van prompt is stabiel, bespaart ~70% tokens
        system: [{
          type: 'text',
          text: 'Je bent een kwantitatief voetbal data-analist. Antwoord ALLEEN met een JSON array. Geen tekst, geen uitleg, geen markdown.',
          cache_control: { type: 'ephemeral' }
        }],
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

  // v117: watchdog — onderscheid stille AI-mislukking (parse/API-fout) van 'geen value'
  const aiFailed = analyseBatch.length > 0 && aiResults.length === 0;
  if (aiFailed) console.error(`[Scan] ⚠️ AI gaf 0 resultaten voor ${analyseBatch.length} wedstrijden — mogelijk parse/API-fout`);

  // v139: bouw poissonMap uit AI-resultaten voor betere sharp divergentie berekening
  // { fixtureId: { h: homeWinPct, x: drawPct, a: awayWinPct } }
  const poissonMap = {};
  analyseBatch.forEach((m, i) => {
    const ai = aiResults[i];
    if (!ai) return;
    poissonMap[m.fixtureId] = { h: ai.h || 33, x: ai.x || 33, a: ai.a || 34 };
  });

  // Tweede detectSharpMoney aanroep met echte Poisson data (divergentie nu correct)
  if (Object.keys(poissonMap).length > 0) {
    try {
      sharpSignals = await detectSharpMoney(oddsMap, batch, env, poissonMap) || sharpSignals;
    } catch(e) { console.error('[Sharp] Tweede run fout:', e.message); }
  }

  const newPicks = {};
  const existingPicks = await sbGetPicks(env);
  const todayHistory = await fb(env, `odds_history/${today}`) || {};
  const leagueCalibration = await sbGetCalibration(env);
  console.log(`[Scan] ${Object.keys(leagueCalibration).length} league calibraties geladen`);

  analyseBatch.forEach((m, i) => {
    const ai = aiResults[i] || { h: 50, x: 25, a: 25, c: 5 };
    const odds = oddsMap[m.fixtureId] || {};
    const confidence = parseInt(ai.c) || 5;
    const tournament = isTournamentLeague(m.leagueId); // v127: landenduel-hardening

    const candidates = [
      // Als geen odds beschikbaar: bereken fair odds uit AI-kansen (geen edge, maar wel analyse)
      { pick: '1', label: `${m.home} wint`, aiKans: ai.h, bookOdds: odds?.home || parseFloat((100/(ai.h*0.9)).toFixed(2)) },
      { pick: 'X', label: 'Gelijkspel',     aiKans: ai.x, bookOdds: odds?.draw || parseFloat((100/(ai.x*0.9)).toFixed(2)) },
      { pick: '2', label: `${m.away} wint`, aiKans: ai.a, bookOdds: odds?.away || parseFloat((100/(ai.a*0.9)).toFixed(2)) },
    ];

    const fixtureHistory = todayHistory[m.fixtureId] || {};
    const openingOdds = fixtureHistory.opening || null;

    candidates.forEach(c => {
      if (!c.bookOdds || c.bookOdds <= 1) return;
      // Markeer als sparse als er geen echte bookmaker odds waren
      const hasRealOdds = !!(odds?.home);
      // v125: edge tegen faire consensus; bij sparse (geen consensus) terugval op ruwe implied
      const fairImplied = fairImpliedFor(odds, c.pick) ?? (impliedProb(c.bookOdds) * 100);
      const marketShrink = tournament ? MARKET_SHRINK_TOURNAMENT : MARKET_SHRINK_BASE; // v157
      const value = calculateValue(c.aiKans, fairImplied, c.pick, marketShrink);
      if (value < 3) return;
      const ev = calcEV(c.aiKans, c.bookOdds);
      const kelly = calcKellyW(c.aiKans, c.bookOdds);

      const openOdds = openingOdds ? openingOdds[c.pick === '1' ? 'home' : c.pick === 'X' ? 'draw' : 'away'] : null;
      const movement = calcOddsMovement(openOdds, c.bookOdds);
      const sharpBoost = sharpSignals?.[m.fixtureId]?.[c.pick];

      // v157: favorite-longshot guardrail — value op underdogs (hoge odds) alleen toelaten
      // als sharp money bevestigt. Voorkomt dat AI-ruis een longshot als 'beste value' opvoert.
      // v161: longshot-guardrail, met uitzondering voor draws waar het model de gelijkspel
      // sterk steunt (aiKans X >= 33%). 2-scan-bevestiging + draw-minValue blijven de remmen.
      const strongDraw = (c.pick === 'X' && c.aiKans >= 33);
      if (c.bookOdds >= LONGSHOT_ODDS && (sharpBoost?.sharpScore || 0) < LONGSHOT_MIN_SHARP && !strongDraw) {
        console.log(`[Scan] Longshot-guard: ${m.home} vs ${m.away} ${c.pick} @${c.bookOdds} — geen sharp-bevestiging (score ${sharpBoost?.sharpScore || 0}), overgeslagen`);
        return;
      }

      // v135: marketSignal incorporeert sharpScore (0-100) direct als gewogen component
      const baseMarketSignal = calcMarketSignal(movement, c.pick);
      const marketSignal = sharpBoost
        ? Math.min(95, baseMarketSignal + Math.round((sharpBoost.sharpScore || 0) * 0.25))
        : baseMarketSignal;

      const spread = Math.max(ai.h, ai.x, ai.a) - Math.min(ai.h, ai.x, ai.a);
      const dataQuality = Math.min(100, 50 + spread);

      const conf = calculateConfidenceV20({
        modelProb:     c.aiKans,     // AI-kans — nu max 10% invloed
        value,
        dataQuality,
        marketSignal,
        leagueId:      m.leagueId,
        odds:          c.bookOdds,
        calibFactor:   leagueCalibration[String(m.leagueId)]?.factor || null,
        pick:          c.pick,
        fairImplied:   fairImplied,  // v144: markt als 40% prior
      });

      // v127: toernooi/landenduel — dunne data, scherpe markt → cap betrouwbaarheid + hogere edge-lat
      if (tournament) {
        conf.final = Math.min(conf.final, 70); // v138: was 60, iets soepeler voor WK
        conf.score = Math.max(1, Math.min(10, Math.round(conf.final / 10)));
      }

      // Strengere drempel voor gelijkspel picks (en voor toernooi/landenduels)
      // v144: league tier drempels — risico leagues hogere lat
      const leagueTier = leagueCalibration[String(m.leagueId)]?.tier || 'neutraal';
      const isRisico = leagueTier === 'risico';
      const isEliteLeague = leagueTier === 'elite';
      const minConf = tournament ? 5 : (isRisico ? 7 : 6);
      const minValue = c.pick === 'X'
        ? (tournament ? 7  : isRisico ? 12 : 9)   // v161: draw-drempel licht verlaagd
        : (tournament ? 6  : isRisico ? 9  : 6);
      if (conf.score < minConf || value < minValue) return;

      // v140b: gelijkspel pas na 2 opeenvolgende bevestigingen (te wispelturig)
      if (c.pick === 'X') {
        const prevX = existingPicks[`${m.fixtureId}_X`];
        if (!prevX) return; // eerste keer gelijkspel: blokkeer, wacht op bevestiging
      }

      const elite = isElitePick({ confidenceFinal: conf.final, value, odds: c.bookOdds, pick: c.pick, poissonUsed: false }); // v138: ook WK-picks kunnen elite zijn

      const pickKey = `${m.fixtureId}_${c.pick}`;
      const existing = existingPicks[pickKey];
      const scanCount = existing ? (existing.scanCount || 1) + 1 : 1;
      const lockLevel = scanCount >= 3 ? 'triple' : scanCount >= 2 ? 'double' : 'single';

      // v140b: CONSISTENCY CHECK — pick richting mag niet wisselen tenzij odds >10% bewogen
      const prevFixturePick = Object.values(existingPicks).find(p =>
        p.fixtureId === m.fixtureId && p.status === 'pending' && p.pick !== c.pick
      );
      if (prevFixturePick) {
        const oddsShift = prevFixturePick.odds
          ? Math.abs((c.bookOdds - prevFixturePick.odds) / prevFixturePick.odds * 100)
          : 0;
        if (oddsShift < 10) {
          // Odds niet genoeg bewogen — houd bestaande richting, negeer nieuwe
          console.log(`[Scan] Consistency block: ${m.home} vs ${m.away} — ${c.pick} geblokkeerd, bestaande pick ${prevFixturePick.pick} blijft`);
          return;
        }
      }

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
          ev,
          kelly,
          fairImplied: parseFloat(fairImplied.toFixed(1)),
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
          source: 'scheduled',
          sharp: !!sharpBoost,
          sharpMove: sharpBoost?.movement || null,
          sharpScore: sharpBoost?.sharpScore || null,
          sharpTier: sharpBoost?.sharpTier || null,
          sharpDivergence: sharpBoost?.divergence || null,
          isSparseData: !hasRealOdds || tournament,  // v127: landenduels altijd sparse (dunne data, ook mét odds)
        };
      }
    });
  });

  // ── v136: PER WEDSTRIJD MAXIMAAL 1 PICK ─────────────────────
  // Tegenstrijdige picks (Canada wint + Bosnia wint) zijn onacceptabel.
  // Houd per fixtureId alleen de pick met de hoogste score: conf × value.
  // Bestaande picks worden alleen vervangen als de nieuwe pick significant beter is.
  const deduplicatedNew = {};
  const newByFixture = {};
  Object.entries(newPicks).forEach(([key, p]) => {
    const fid = p.fixtureId;
    const score = (p.confidenceFinal || 0) * (p.value || 0);
    if (!newByFixture[fid] || score > newByFixture[fid].score) {
      newByFixture[fid] = { key, score };
    }
  });
  // Alleen de winnende pick per fixture opnemen
  Object.values(newByFixture).forEach(({ key }) => {
    deduplicatedNew[key] = newPicks[key];
  });
  const removedCount = Object.keys(newPicks).length - Object.keys(deduplicatedNew).length;
  if (removedCount > 0) console.log(`[Scan] ${removedCount} tegenstrijdige picks verwijderd (1 pick per wedstrijd)`);

  // Verwijder ook bestaande picks voor dezelfde wedstrijd als er een betere nieuwe pick is
  const cleanedExisting = { ...existingPicks };
  Object.values(deduplicatedNew).forEach(newPick => {
    const fid = newPick.fixtureId;
    // Verwijder bestaande picks voor deze fixture die een andere pick-kant zijn
    Object.keys(cleanedExisting).forEach(k => {
      if (cleanedExisting[k].fixtureId === fid && cleanedExisting[k].pick !== newPick.pick
          && (cleanedExisting[k].status === 'pending')) {
        console.log(`[Scan] Verwijder conflicterende bestaande pick: ${k} (${cleanedExisting[k].pick}) → vervangen door ${newPick.pick}`);
        delete cleanedExisting[k];
      }
    });
  });

  const toSave = { ...cleanedExisting, ...deduplicatedNew };
  const entries = Object.entries(toSave)
    .sort((a, b) => new Date(b[1].lastScanAt || 0) - new Date(a[1].lastScanAt || 0))
    .slice(0, 200);

  await sbSavePicks(Object.fromEntries(entries), env);
  // v119 (R1): Firebase 'picks'-fallback verwijderd (vestigiaal — niet gelezen). Supabase is bron.

  const newCount = Object.keys(newPicks).length;
  const lockCount = Object.values(newPicks).filter(p => p.lockLevel !== 'single').length;
  console.log(`[Scan] Klaar: ${newCount} picks opgeslagen, ${lockCount} locks, ${withoutOdds.length} wedstrijden zonder odds`);

  // v162: reset de dagteller bij een nieuwe dag (deed het hoofdpad niet -> teller liep eindeloos op
  // en blokkeerde /scan-now). Gelijkgetrokken met het geen-wedstrijden-pad.
  const _stNow = await sbGetScanStatus(env);
  const scansToday1 = (_stNow.scanDate !== today) ? 1 : ((_stNow.scansToday || 0) + 1);
  const scanData1 = { lastRun: new Date().toISOString(), scanDate: today,
    lastPickCount: newCount, lastMatchCount: analyseBatch.length,
    lastWithOdds: withOdds.length, lastWithoutOdds: withoutOdds.length,
    scansToday: scansToday1, version: VERSION };
  await sbUpdateScanStatus(scanData1, env);

  const elitePicks = Object.values(newPicks).filter(p => p.elite);
  const lockPicks = Object.values(newPicks).filter(p => p.lockLevel === 'triple' || p.lockLevel === 'double');
  const pushPicks = elitePicks.length > 0 ? elitePicks : lockPicks;

  if (elitePicks.length > 0) {
    console.log(`[Scan] ${elitePicks.length} elite picks gevonden!`);
  }

  const nowStr = new Date().toLocaleTimeString('nl-NL', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam'
  });

  if (pushPicks.length > 0) {
    const top = pushPicks.sort((a, b) => (b.value || 0) - (a.value || 0))[0];
    // v138: push alleen als wedstrijd binnen 6 uur begint (anders is push te vroeg/nutteloos)
    const kickoffMs = top.matchTime ? new Date(top.matchTime).getTime() : 0;
    const nowMs2 = Date.now();
    const hoursToKickoff = kickoffMs > 0 ? (kickoffMs - nowMs2) / (1000 * 60 * 60) : 99;
    const shouldPush = hoursToKickoff <= 6 && hoursToKickoff >= -1; // max 6u voor, tot 1u na aftrap
    if (shouldPush || top.elite) { // elite picks altijd pushen
      const icon = top.lockLevel === 'triple' ? '🔒🔒🔒' : top.elite ? '⭐' : '🔒🔒';
      const timeTag = hoursToKickoff > 0 ? ` · ${Math.round(hoursToKickoff)}u voor aftrap` : '';
      const title = top.elite
        ? `${icon} Elite pick gevonden!${timeTag}`
        : `${icon} ${top.lockLevel === 'triple' ? 'Triple' : 'Double'} Lock${timeTag}`;
      const body = `${top.matchName} · ${top.pickLabel} @ ${top.odds} · +${Math.round(top.value)}% value`;
      await sendPushNotification(env, title, body, {
        type: 'value_alert', matchId: String(top.fixtureId),
        pick: top.pick, value: top.value, lockLevel: top.lockLevel,
      });
    } else {
      console.log(`[Push] Pick gevonden maar aftrap nog ${Math.round(hoursToKickoff)}u weg — geen push`);
    }
  } else if (newCount > 0) {
    const valuePicks = Object.values(newPicks).filter(p => (p.value || 0) >= 15 && (p.confidence || 0) >= 7);
    if (valuePicks.length >= 1) {
      const top = valuePicks[0];
      const title = `⚡ ${valuePicks.length} sterke pick${valuePicks.length > 1 ? 's' : ''} — ${nowStr}`;
      const body = `${top.matchName} · ${top.pickLabel} @ ${top.odds} · +${Math.round(top.value)}% value`;
      await sendPushNotification(env, title, body, {
        type: 'value_alert', matchId: String(top.fixtureId),
        pick: top.pick, value: top.value,
      });
    } else {
      const top2 = Object.values(newPicks).sort((a, b) => (b.value || 0) - (a.value || 0))[0];
      const title = `🔍 ${nowStr} — ${newCount} pick${newCount > 1 ? 's' : ''} toegevoegd`;
      const body = top2
        ? `${top2.matchName} · ${top2.pickLabel} @ ${top2.odds} · +${Math.round(top2.value)}% edge`
        : `${allMatches.length} wedstr gescand · ${Object.keys(oddsMap || {}).length} met odds`;
      await sendPushNotification(env, title, body, top2
        ? { type: 'scan_done', matchId: String(top2.fixtureId), pick: top2.pick }
        : { type: 'scan_done' });
    }
  } else {
    // Altijd een melding — ook bij 0 picks. v117: aparte alert bij stille AI-mislukking.
    const title = aiFailed ? `⚠️ ${nowStr} — scan zonder AI-analyse` : `⏱ ${nowStr} — scan klaar`;
    const body = aiFailed
      ? `${analyseBatch.length} wedstr mét odds, maar AI gaf geen analyse — check ANTHROPIC_KEY / limiet`
      : `${allMatches.length} wedstr gescand · geen nieuwe picks`;
    await sendPushNotification(env, title, body, { type: aiFailed ? 'ai_error' : 'scan_done' });
  }
}

// ── Scan test: test automatische scan pipeline — GEEN Firebase write ─────────
// Default: Eliteserien NO (113) + Allsvenskan SE (103), beide seizoen 2026
// Gebruik: /scan-test?token=HMAC&league=113,103
// Geeft volledige verbose output: fixtures, odds, AI, value picks, verdict
async function runScanTest(env, leagueIds = [1, 113, 103]) { // 1=WK 2026, 113=Allsvenskan, 103=Eliteserien
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Seizoen-aware: Scandinavische + WK competities = 2026
  const SEASON_2026 = new Set([1, 2, 3, 4, 5, 6, 7, 9, 10, 29, 30, 32, 34, 36, 71, 98, 103, 113, 119, 128, 129, 239, 253, 292, 480, 848]); // v113: identiek aan client seasonForLeague() master-set
  const getSeason = (lid) => SEASON_2026.has(lid) ? 2026 : 2025;

  const log = [`[ScanTest] Start — leagues: ${leagueIds.join(', ')}, datum: ${today} + ${tomorrowStr}`];

  // ── Stap 1: Fixtures ophalen (vandaag + morgen) ──
  const allFixtures = [];
  const seen = new Set();

  // Internationale leagues: gebruik next=15 ipv date= (geeft betere resultaten)
  const NEXT_LEAGUES_TEST = new Set([10, 5, 6, 29, 36, 113, 103, 119, 129, 253, 71, 239, 292, 98]);

  // v114: 2 globale date-calls + in-code league-filter (zelfde aanpak als productiescan,
  // geen burst meer richting API-Football).
  const leagueSet = new Set(leagueIds);
  leagueIds.forEach(lid => log.push(`[ScanTest] League ${lid} → seizoen ${getSeason(lid)}`));
  const [fxT, fxM] = await Promise.all([
    apif(`/fixtures?date=${today}&timezone=Europe/Amsterdam`, env),
    apif(`/fixtures?date=${tomorrowStr}&timezone=Europe/Amsterdam`, env),
  ]);
  [...fxT, ...fxM].forEach(f => {
    const id = f.fixture?.id;
    if (id && leagueSet.has(f.league?.id) && !seen.has(id)) { seen.add(id); allFixtures.push(f); }
  });

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
      // v158: ondergrens op aftraptijd toegevoegd (zoals auto-scan) — geen NS-matches met aftrap in verleden
      return isLive || (isNS && kickoff > nowMs - 60 * 60 * 1000 && kickoff < endOfTomorrow);
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
    const _nowStr = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
    const _pushResult = await sendPushNotification(env, `🧪 ${_nowStr} — Test OK`, `Worker actief · geen wedstrijden voor leagues ${leagueIds.join(', ')}`, { type: 'scan_test' });
    return {
      ok: true, version: VERSION, leagues: leagueIds, today, tomorrow: tomorrowStr,
      matchesFound: 0, withOdds: 0, aiResultsCount: 0,
      picks: [], allMatches: [], log: log.slice(-10),
      verdict: '⚠️ Geen wedstrijden gevonden — push verstuurd naar owner',
      note: '✅ TEST — push verstuurd',
      pushResult: _pushResult
    };
  }

  // ── Stap 3: Odds ophalen (zelfde functie als productie, incl. Scandinavische bookmaker fallbacks) ──
  const bettable = allMatches.filter(m => !isYouthMatch(m.home, m.away));
  if (bettable.length !== allMatches.length) log.push(`[ScanTest] ${allMatches.length - bettable.length} jeugdwedstrijden (U15-U23) uitgefilterd`);
  const batch = bettable.slice(0, 10);
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

  const prompt = `Je bent een kwantitatief voetbal data-analist. Analyseer ELKE wedstrijd op basis van statistische verwachtingen.

KRITISCHE REGELS:
- Baseer kansen op historische doelpuntenpatronen en competitieniveau, NIET op teamnamen of reputatie
- GELIJKSPEL WAARSCHUWING: Gelijkspel komt voor in slechts ~25-28% van alle wedstrijden. Overschat gelijkspelkansen NIET. Wees terughoudend met kansX boven 30%
- Thuisvoordeel is reëel: gemiddeld +5-8% kansverhoging voor thuisteam in Europese competities
- Som van h+x+a moet exact 100 zijn

WEDSTRIJDEN:
${analyseBatchFull.map((m, i) => {
  const odds = oddsMap[m.fixtureId];
  const oddsStr = odds ? ` | Odds: ${odds.home}/${odds.draw}/${odds.away}` : ' | geen odds';
  return `${i+1}. ${m.home} vs ${m.away} (${m.leagueName}, ${m.matchDate})${oddsStr}`;
}).join('\n')}

Antwoord ALLEEN met een JSON array — geen tekst, geen uitleg:
[{"h":52,"x":26,"a":22,"c":7},...]
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
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
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
  const leagueCalibration = await sbGetCalibration(env);
  const picks = [];

  analyseBatchFull.forEach((m, i) => {
    const ai   = aiResults[i] || { h: 50, x: 25, a: 25, c: 5 };
    const odds = oddsMap[m.fixtureId] || {};
    const tournament = isTournamentLeague(m.leagueId); // v127

    [
      { pick: '1', label: `${m.home} wint`, aiKans: ai.h, bookOdds: odds.home },
      { pick: 'X', label: 'Gelijkspel',     aiKans: ai.x, bookOdds: odds.draw },
      { pick: '2', label: `${m.away} wint`,  aiKans: ai.a, bookOdds: odds.away },
    ].forEach(c => {
      if (!c.bookOdds || c.bookOdds <= 1) return;
      const fairImplied = fairImpliedFor(odds, c.pick) ?? (impliedProb(c.bookOdds) * 100);
      const marketShrink = tournament ? MARKET_SHRINK_TOURNAMENT : MARKET_SHRINK_BASE; // v157
      const value = calculateValue(c.aiKans, fairImplied, c.pick, marketShrink);
      if (value < 3) return;
      const ev = calcEV(c.aiKans, c.bookOdds);
      const kelly = calcKellyW(c.aiKans, c.bookOdds);

      const spread      = Math.max(ai.h, ai.x, ai.a) - Math.min(ai.h, ai.x, ai.a);
      const dataQuality = Math.min(100, 50 + spread);
      const conf = calculateConfidenceV20({
        modelProb: c.aiKans, value, dataQuality,
        marketSignal: 50,
        leagueId: m.leagueId,
        odds: c.bookOdds,
        calibFactor: leagueCalibration[String(m.leagueId)]?.factor || null,
        pick: c.pick,
      });

      // v127: toernooi-hardening (zelfde als productie)
      if (tournament) {
        conf.final = Math.min(conf.final, 70); // v138: was 60, iets soepeler voor WK
        conf.score = Math.max(1, Math.min(10, Math.round(conf.final / 10)));
      }

      // v144: league tier drempels — risico leagues hogere lat
      const leagueTier = leagueCalibration[String(m.leagueId)]?.tier || 'neutraal';
      const isRisico = leagueTier === 'risico';
      const isEliteLeague = leagueTier === 'elite';
      const minConf = tournament ? 5 : (isRisico ? 7 : 6);
      const minValue = c.pick === 'X'
        ? (tournament ? 7  : isRisico ? 12 : 9)   // v161: draw-drempel licht verlaagd
        : (tournament ? 6  : isRisico ? 9  : 6);
      if (conf.score < minConf || value < minValue) return;

      // v140b: gelijkspel pas na 2 opeenvolgende bevestigingen (te wispelturig)
      if (c.pick === 'X') {
        const prevX = existingPicks[`${m.fixtureId}_X`];
        if (!prevX) return; // eerste keer gelijkspel: blokkeer, wacht op bevestiging
      }

      picks.push({
        match:      `${m.home} vs ${m.away}`,
        leagueName: m.leagueName,
        matchDate:  m.matchDate,
        pick:       c.pick,
        pickLabel:  c.label,
        odds:       c.bookOdds,
        value:      parseFloat(value.toFixed(1)),
        ev,
        kelly,
        fairImplied: parseFloat(fairImplied.toFixed(1)),
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
    version:         VERSION,
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
  const picks = await sbGetPicks(env);
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
    const picksData = await sbGetPicks(env);
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
    await sbSaveDailyTip(noTip, env);
    await fb(env, 'daily_tip/latest', 'PUT', noTip); // FB fallback
    console.log('[DailyTip] Geen gekwalificeerde picks vandaag.');
    return noTip;
  }

  const picksText = picks
    .map(p => `- ${p.matchName || '?'}: ${p.pickLabel} @ ${p.odds} (value: +${Math.round(p.value||0)}%, conf: ${p.confidence}/10, Poisson: ${p.poissonUsed ? 'ja' : 'nee'})`)
    .join('\n');

  const prompt = `Je bent een voetbal betting analist. Kies de BESTE pick van de dag.

Selectiecriteria (in volgorde van belang):
1. Hoogste combinatie van value% EN confidence — niet alleen de hoogste value
2. Poisson-onderbouwde picks krijgen voorkeur boven AI-only picks
3. Vermijd gelijkspel (X) tenzij conf ≥8 en value ≥15%
4. Odds tussen 1.60–3.50 zijn betrouwbaarder dan extremen

Gekwalificeerde picks (value ≥8%, conf ≥6/10):
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
  "analyse": "2-3 zinnen CONCRETE onderbouwing met specifieke cijfers",
  "tip": "1 zin samenvatting voor de gebruiker",
  "zwakPunt": "1 zin over het grootste risico bij deze pick"
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
      zwakPunt:   parsed.zwakPunt || null,
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

  await sbSaveDailyTip(tipData, env);
  await fb(env, 'daily_tip/latest', 'PUT', tipData);
  await fb(env, `daily_tip/archive/${today}`, 'PUT', tipData); // FB fallback
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
async function generateOranjeNieuws(env) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Geef de 5 meest recente nieuwsberichten over het Nederlands Elftal en WK 2026 voorbereiding. 
Vandaag is ${new Date().toLocaleDateString('nl-NL')}.
Geef ALLEEN JSON terug, geen tekst erbuiten:
[{"titel":"...","samenvatting":"2-3 zinnen","bron":"bijv. NOS Sport","datum":"bijv. 2 jun 2026"},...]
Focus op: selectie, blessures, tactiek, wedstrijduitslagen, coach uitspraken.`
      }]
    })
  });
  const data = await response.json();
  const text = data.content?.[0]?.text || '[]';
  const clean = text.replace(/\`\`\`json|\`\`\`/g, '').trim();
  return JSON.parse(clean);
}

async function keepSupabaseAlive(env) {
  try {
    // Ping Supabase met een simpele query om het project actief te houden
    await sb(env, 'scan_status', 'GET', null, '?select=id&limit=1');
    console.log('[Keepalive] Supabase ping OK');
  } catch(e) {
    console.warn('[Keepalive] Supabase ping mislukt:', e.message);
  }
}

async function sendPushNotification(env, title, body, data = {}) {
  const appId  = env.ONESIGNAL_APP_ID;
  const apiKey = env.ONESIGNAL_API_KEY;
  if (!appId || !apiKey) {
    console.log('[Push] OneSignal keys niet geconfigureerd, skip');
    return;
  }
  try {
    // OWNER_PLAYER_ID: eerst env secret, dan Firebase fallback
    let ownerPlayerId = env.OWNER_PLAYER_ID || null;
    if (!ownerPlayerId) {
      try {
        ownerPlayerId = await fb(env, 'owner_player_id');
        if (ownerPlayerId) console.log('[Push] Player ID uit Firebase:', ownerPlayerId.substring(0, 8) + '...');
      } catch(e) {
        console.warn('[Push] Firebase Player ID ophalen mislukt:', e.message);
      }
    }

    // Stuur altijd naar alle subscribers (jij bent de enige)
    // Player ID targeting werkt niet betrouwbaar bij web push PWA
    const targeting = { included_segments: ['Total Subscriptions'] };
    if (ownerPlayerId) console.log('[Push] Owner ID beschikbaar maar segment targeting gebruikt:', ownerPlayerId.substring(0,8));

    const payload = {
      app_id: appId,
      ...targeting,
      headings:  { en: title, nl: title },
      contents:  { en: body,  nl: body  },
      data,
      chrome_web_icon: 'https://promatchxi.app/icon-192.png',
      ttl:      3600,
      priority: 10,
    };
    // v126: deep-link naar de juiste pick in de scan-log bij klik op de melding
    if (data && data.matchId) payload.url = `https://promatchxi.app/#pick=${data.matchId}`;
    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    console.log('[Push] Verstuurd naar', ownerPlayerId ? 'owner' : 'all subscribers', '—', result.id || JSON.stringify(result.errors));
    return result;
  } catch(e) {
    console.error('[Push] Fout:', e.message);
    return { error: e.message };
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

// ── User costs endpoint (/user-costs) ───────────────────
async function handleUserCosts(request, env) {
  const url = new URL(request.url);
  const uid = url.searchParams.get('uid');
  if (!uid) return json({ error: 'uid verplicht' }, 400);

  if (request.method === 'GET') {
    const rows = await sb(env, 'user_costs', 'GET', null, `?uid=eq.${uid}&select=*`);
    if (!rows || !rows.length) return json(null);
    const r = rows[0];
    return json({
      calls: r.calls, tokensIn: r.tokens_in, tokensOut: r.tokens_out,
      totalUSD: parseFloat(r.total_usd), lastUpdated: r.last_updated
    });
  }

  if (request.method === 'POST') {
    const body = await request.json();
    await sb(env, 'user_costs', 'POST', [{
      uid,
      calls: body.calls || 0,
      tokens_in: body.tokensIn || 0,
      tokens_out: body.tokensOut || 0,
      total_usd: body.totalUSD || 0,
      last_updated: body.lastUpdated || new Date().toISOString(),
    }], '?on_conflict=uid');
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
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

    // v163: health-overzicht in één call — versie, laatste scan, picks, CLV, snapshot-dichtheid + warnings
    if (path === '/health') {
      try {
        const rows = await sb(env, 'v_health', 'GET', null, '?limit=1');
        const h = rows?.[0] || {};
        const warnings = [];
        const hour = new Date().getUTCHours();
        const activeHours = (hour === 6) || (hour >= 12 && hour <= 22);
        if (activeHours && (h.last_scan_min_ago == null || h.last_scan_min_ago > 75)) warnings.push('scan_verouderd');
        if ((h.scan_version || '') !== VERSION) warnings.push(`versie_mismatch(scan=${h.scan_version},worker=${VERSION})`);
        if ((h.scans_today || 0) >= 25) warnings.push('dagcap_bijna');
        if (Number(h.avg_snaps_recent || 0) < 2) warnings.push('snapshots_dun');
        return json({ ok: warnings.length === 0, status: warnings.length ? 'WARN' : 'OK',
          warnings, worker_version: VERSION, ...h, checked_at: new Date().toISOString() });
      } catch(e) {
        return json({ ok: false, status: 'ERROR', error: e.message, worker_version: VERSION }, 500);
      }
    }

    if (path === '/scan') {
      const token = url.searchParams.get('token');
      if (!await verifyHMAC(token, env.SCAN_SECRET)) {
        return json({ error: 'Unauthorized' }, 401);
      }
      await runScan(env, true);
      return json({ status: 'scan klaar', version: VERSION });
    }

    // v159: handmatige scan vanuit de app — geen HMAC, maar cooldown (60s) + bestaande daglimiet (8/dag)
    // begrenzen de kosten. Triggert dezelfde runScan als de cron, daarna leest de app /picks.
    if (path === '/scan-now') {
      try {
        const today = new Date().toISOString().split('T')[0];
        const st = await sb(env, 'scan_status', 'GET', null, '?id=eq.current&select=last_run,scans_today,scan_date&limit=1');
        const row = st?.[0] || {};
        const last = row.last_run ? new Date(row.last_run).getTime() : 0;
        if (last && Date.now() - last < 60000) {
          return json({ ok: false, reason: 'cooldown', retryAfter: Math.ceil((60000 - (Date.now() - last)) / 1000), version: VERSION });
        }
        // v160: totaal-dagcap (cron + handmatig). Cron raakt deze niet (gaat niet via /scan-now),
        // maar zodra het totaal de cap raakt, weigert /scan-now — begrenst runaway handmatig scannen/kosten.
        const MANUAL_SCAN_DAY_CAP = 25;
        const scansToday = (row.scan_date === today) ? (row.scans_today || 0) : 0;
        if (scansToday >= MANUAL_SCAN_DAY_CAP) {
          return json({ ok: false, reason: 'daglimiet', scansToday, cap: MANUAL_SCAN_DAY_CAP, version: VERSION });
        }
        const result = await runScan(env, true);
        return json({ ok: true, result, version: VERSION });
      } catch(e) {
        return json({ ok: false, error: e.message, version: VERSION }, 500);
      }
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

    if (path === '/user-costs') {
      return handleUserCosts(request, env);
    }

    if (path === '/picks') {
      if (request.method === 'POST') {
        // Handmatige scan picks opslaan in Supabase (vanuit app)
        try {
          const body = await request.json();
          const picks = Array.isArray(body) ? body : [body];
          if (!picks.length) return json({ ok: false, error: 'Geen picks' });
          const rows = picks.map(p => ({
            id: p.id || `${p.matchDate || 'x'}_${(p.matchName || 'x').replace(/\s/g,'_').replace(/'/g,'')}_${p.pick || '1'}`,
            fixture_id: p.fixtureId || null,
            home: p.home || null, away: p.away || null,
            match_name: p.matchName || null,
            match_date: p.matchDate || null,
            match_time: p.matchTime || null,
            league_id: p.leagueId || null,
            league_name: p.leagueName || null,
            pick: p.pick || null,
            pick_label: p.pickLabel || null,
            odds: p.odds || null,
            value: p.value || null,
            ai_kans: p.aiKans || null,
            confidence: p.confidence || null,
            confidence_final: p.confidenceFinal || null,
            elite: p.elite || false,
            lock_level: p.lockLevel || 'single',
            scan_count: p.scanCount || 1,
            status: p.status || 'pending',
            source: p.source || 'manual_scan',
            first_scan_at: p.firstScanAt || new Date().toISOString(),
            last_scan_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));
          await sb(env, 'picks', 'POST', rows, '?on_conflict=id');
          console.log(`[Picks] ${rows.length} handmatige picks opgeslagen in Supabase`);
          return json({ ok: true, saved: rows.length });
        } catch(e) {
          console.error('[Picks] POST fout:', e.message);
          return json({ ok: false, error: e.message }, 500);
        }
      }
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

    if (path === '/oranje-nieuws') {
    try {
      const nieuws = await generateOranjeNieuws(env);
      return json({ nieuws });
    } catch(e) {
      return json({ nieuws: [], error: e.message });
    }
  }

  if (path === '/scan-test') {
      // Accepteer zowel HMAC token als simpel secret wachtwoord
      const token  = url.searchParams.get('token');
      const secret = url.searchParams.get('secret');
      const validHMAC   = token  && await verifyHMAC(token, env.SCAN_SECRET);
      const validSecret = secret && secret === env.SCAN_SECRET;
      if (!validHMAC && !validSecret) return json({ error: 'Unauthorized' }, 401);
      const leagueParam = url.searchParams.get('league') || '1,113,103'; // 1=WK 2026
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
      routes: ['/apif/*', '/fd/*', '/anthropic', '/picks', '/user-costs', '/scan', '/scan-test', '/settle', '/debug-scan', '/check-odds', '/keepalive', '/push', '/daily-tip', '/analytics', '?url=']
    });
  },

  async scheduled(event, env, ctx) {
    const now = new Date();
    const hour = now.getUTCHours();
    const isSunday = now.getUTCDay() === 0;
    ctx.waitUntil((async () => {
      const fullScan = hour === 6 || (hour >= 12 && hour <= 22);
      if (fullScan) {
        await runScan(env);
        await verifyYesterdayPicks(env);
        if (hour === 6) await generateDailyTip(env);
        if (hour === 6) await keepSupabaseAlive(env);
        if (isSunday && hour === 6) await runWeeklyCalibration(env);
      } else {
        // v156: cron-gap (23-05 UTC) — alleen odds-snapshots voor late kickoffs (WK Amerika's)
        await snapshotOddsOnly(env);
      }
    })());
  }
};

