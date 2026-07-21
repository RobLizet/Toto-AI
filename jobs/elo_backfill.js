#!/usr/bin/env node
// ProMatchXI — elo_backfill.js (job v1, 21-07-2026) — WARM-START ELO UIT HISTORIE (optie A)
// Replayt de afgeronde uitslagen van seizoen 2025 (2025/26) chronologisch door EXACT dezelfde
// Elo-wiskunde als worker updateEloForFixture (v202/v210), past 25% regressie naar 1500 toe op de
// seizoenswissel (transfers), en replayt daarna de al gespeelde 2026-fixtures er bovenop.
// Resultaat: team_ratings + elo_history volledig herbouwd (source='backfill'), teams direct gerijpt.
//
// VEILIGHEID (CIJFERBRON):
// - Alles wordt EERST volledig opgehaald en in geheugen gereplayd; pas als ALLE calls aantoonbaar
//   slaagden wordt de database aangeraakt. Eén geweigerde/gefaalde call => ABORT, DB onaangeroerd.
// - Een 200-respons met `message` maar zonder `response`-array (bv. "not subscribed") telt als FOUT,
//   niet als "geen data" (worker v276-les).
// - 0 fixtures voor een afgerond 2025-seizoen is per definitie verdacht => ABORT.
// - Rollback: team_ratings_backup_20260721 / elo_history_backup_20260721 (aangemaakt 21-07 via MCP).
//
// Vereist /opt/pmx-jobs/.env met: SUPABASE_URL, SUPABASE_KEY of SUPABASE_SERVICE_KEY (service_role), APIF_KEY (api-sports).
// Draaien: node elo_backfill.js        (eenmalig; her-draaien = volledige herbouw, idempotent)

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

// ── .env inlezen (geen dependencies) ─────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const SB_URL   = process.env.SUPABASE_URL || 'https://gtmzznlknmpjcwuyupjv.supabase.co';
const SB_KEY   = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY;
const APIF_KEY = process.env.APIF_KEY;
const missing = [];
if (!SB_KEY) missing.push('SUPABASE_KEY of SUPABASE_SERVICE_KEY');
if (!APIF_KEY) missing.push('APIF_KEY');
if (missing.length) { console.error(`[Backfill] ABORT — ontbrekend in .env: ${missing.join(', ')}`); process.exit(1); }

// ── Constanten — spiegelen worker v278 ───────────────────────────────────────
// activeLeagueIds FASE 2 (19 leagues); geen enkele hiervan zit in TOURNAMENT_LEAGUES => homeAdv 65 overal.
const LEAGUES = [39, 140, 78, 135, 61, 88, 94, 144, 179, 207, 203, 2, 3, 848, 89, 79, 80, 40, 41];
const HOME_ADV = 65;             // eloHomeAdv: clubs
const SEASON_REGRESSION = 0.25;  // 25% terug naar 1500 op de seizoenswissel 2025 -> 2026
const API_GAP_MS = 400;          // sequentieel, vast IP — ruim onder de 300/min

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── api-sports (direct, zelfde vaste IP als de Caddy-proxy) ──────────────────
async function apif(pathQ) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`https://v3.football.api-sports.io${pathQ}`, {
        headers: { 'x-apisports-key': APIF_KEY },
      });
      const data = await res.json();
      // Worker v276-regel: 200 met message maar zonder response-array = API-fout, geen lege data
      if (data.response === undefined && typeof data.message === 'string' && data.message) {
        throw new Error(`api-fout: ${data.message}`);
      }
      if (data.errors && !Array.isArray(data.errors) && Object.keys(data.errors).length) {
        throw new Error(`api-errors: ${JSON.stringify(data.errors)}`);
      }
      if (!Array.isArray(data.response)) throw new Error(`onverwachte respons (geen array) op ${pathQ}`);
      return data;
    } catch (e) {
      if (attempt === 2) throw new Error(`${pathQ} definitief mislukt: ${e.message}`);
      console.warn(`[Backfill] retry ${pathQ}: ${e.message}`);
      await sleep(2000);
    }
  }
}

async function fetchSeason(league, season) {
  const out = [];
  let page = 1, total = 1;
  do {
    const data = await apif(`/fixtures?league=${league}&season=${season}&page=${page}`);
    out.push(...data.response);
    total = data.paging && Number(data.paging.total) ? Number(data.paging.total) : 1;
    page++;
    await sleep(API_GAP_MS);
  } while (page <= total);
  return out;
}

// ── Supabase REST ────────────────────────────────────────────────────────────
async function sb(method, table, body, query = '') {
  const res = await fetch(`${SB_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: method === 'POST' ? 'return=minimal' : 'return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Supabase ${method} ${table} -> HTTP ${res.status}: ${txt.slice(0, 300)}`);
  }
}

// ── Elo-kern — byte-gelijk aan worker updateEloForFixture ────────────────────
// expH = 1/(1+10^((aElo-hElo-homeAdv)/400)); G: gd<=1 =>1, gd==2 =>1.5, anders (11+gd)/8;
// K: games<8 => 45, anders 30; nieuwe elo afgerond op 0,1.
function replayFixture(state, fx, historyRows) {
  const fid = fx.fixture && fx.fixture.id;
  const hId = fx.teams && fx.teams.home && fx.teams.home.id;
  const aId = fx.teams && fx.teams.away && fx.teams.away.id;
  const hName = fx.teams && fx.teams.home && fx.teams.home.name;
  const aName = fx.teams && fx.teams.away && fx.teams.away.name;
  const hG = fx.goals ? fx.goals.home : null;
  const aG = fx.goals ? fx.goals.away : null;
  if (!fid || hId == null || aId == null || hG == null || aG == null) return false;

  const h = state.get(hId) || { team_id: hId, team_name: hName, elo: 1500, games: 0, last: null };
  const a = state.get(aId) || { team_id: aId, team_name: aName, elo: 1500, games: 0, last: null };

  const expH = 1 / (1 + Math.pow(10, (a.elo - h.elo - HOME_ADV) / 400));
  const actH = hG > aG ? 1 : hG < aG ? 0 : 0.5;
  const gd = Math.abs(hG - aG);
  const G = gd <= 1 ? 1 : gd === 2 ? 1.5 : (11 + gd) / 8;
  const kH = h.games < 8 ? 45 : 30;
  const kA = a.games < 8 ? 45 : 30;
  const d = G * (actH - expH);
  const newH = Math.round((h.elo + kH * d) * 10) / 10;
  const newA = Math.round((a.elo - kA * d) * 10) / 10;
  const resH = hG > aG ? 'W' : hG < aG ? 'L' : 'D';
  const when = (fx.fixture && fx.fixture.date) ? new Date(fx.fixture.date).toISOString() : new Date().toISOString();

  historyRows.push(
    { fixture_id: fid, team_id: hId, opponent_id: aId, elo_before: h.elo, elo_after: newH,
      delta: Math.round(kH * d * 10) / 10, result: resH, gd: hG - aG, run_at: when, source: 'backfill' },
    { fixture_id: fid, team_id: aId, opponent_id: hId, elo_before: a.elo, elo_after: newA,
      delta: Math.round(-kA * d * 10) / 10, result: resH === 'W' ? 'L' : resH === 'L' ? 'W' : 'D',
      gd: aG - hG, run_at: when, source: 'backfill' },
  );
  h.elo = newH; h.games += 1; h.last = when; h.team_name = hName || h.team_name;
  a.elo = newA; a.games += 1; a.last = when; a.team_name = aName || a.team_name;
  state.set(hId, h); state.set(aId, a);
  return true;
}

function filterFinished(fixtures) {
  return fixtures.filter(fx => {
    const st = fx.fixture && fx.fixture.status && fx.fixture.status.short;
    return ['FT', 'AET', 'PEN'].includes(st)
      && fx.teams && fx.teams.home && fx.teams.home.id != null
      && fx.teams && fx.teams.away && fx.teams.away.id != null
      && fx.goals && fx.goals.home != null && fx.goals.away != null;
  });
}

async function main() {
  const t0 = Date.now();
  console.log(`[Backfill] Start — ${LEAGUES.length} leagues, seizoen 2025 + 2026`);

  // ── Fase 0: alles ophalen (nog NIETS wegschrijven) ─────────────────────────
  const s2025 = [], s2026 = [];
  for (const lg of LEAGUES) {
    const a = await fetchSeason(lg, 2025);
    const fin25 = filterFinished(a);
    if (fin25.length === 0) throw new Error(`league ${lg} seizoen 2025: 0 afgeronde fixtures — dat kan niet voor een afgerond seizoen => ABORT`);
    s2025.push(...fin25);
    const b = await fetchSeason(lg, 2026);
    s2026.push(...filterFinished(b)); // 0 mag hier: veel competities zijn nog niet begonnen
    console.log(`[Backfill] league ${lg}: 2025=${fin25.length} afgerond, 2026=${filterFinished(b).length} afgerond`);
  }

  // dedupe + chronologisch over ALLE leagues heen (CL/EL/ECL kruisen competities)
  const seen = new Set();
  const dedupe = (arr) => arr.filter(fx => {
    const id = fx.fixture && fx.fixture.id;
    if (!id || seen.has(id)) return false;
    seen.add(id); return true;
  });
  const chrono = (arr) => arr.sort((x, y) => new Date(x.fixture.date) - new Date(y.fixture.date));
  const replay25 = chrono(dedupe(s2025));
  const replay26 = chrono(dedupe(s2026));
  console.log(`[Backfill] replay-set: ${replay25.length} (2025) + ${replay26.length} (2026), API klaar in ${((Date.now()-t0)/1000).toFixed(0)}s`);

  // ── Fase 1-3: replay in geheugen ───────────────────────────────────────────
  const state = new Map();
  const historyRows = [];
  let n25 = 0, n26 = 0;
  for (const fx of replay25) if (replayFixture(state, fx, historyRows)) n25++;
  for (const t of state.values()) t.elo = Math.round((1500 + (1 - SEASON_REGRESSION) * (t.elo - 1500)) * 10) / 10; // seizoenswissel
  for (const fx of replay26) if (replayFixture(state, fx, historyRows)) n26++;
  console.log(`[Backfill] gereplayd: ${n25} + ${n26} fixtures, ${state.size} teams, ${historyRows.length} history-rijen`);

  // sanity: bekende orde van grootte — 19 leagues => duizenden fixtures
  if (n25 < 3000 || state.size < 300) throw new Error(`sanity gefaald (n25=${n25}, teams=${state.size}) => ABORT, DB onaangeroerd`);

  const top = [...state.values()].sort((x, y) => y.elo - x.elo).slice(0, 5)
    .map(t => `${t.team_name} ${t.elo}`).join(' | ');
  console.log(`[Backfill] top-5 Elo: ${top}`);

  // ── Fase 4: database herbouwen (backups bestaan: *_backup_20260721) ────────
  const now = new Date().toISOString();
  await sb('DELETE', 'elo_history', null, '?id=gt.0');
  await sb('DELETE', 'team_ratings', null, '?team_id=gt.0');

  const ratingRows = [...state.values()].map(t => ({
    team_id: t.team_id, team_name: t.team_name, elo: t.elo, games: t.games,
    seeded: false, last_result_at: t.last, updated_at: now,
  }));
  for (let i = 0; i < ratingRows.length; i += 500) await sb('POST', 'team_ratings', ratingRows.slice(i, i + 500));
  for (let i = 0; i < historyRows.length; i += 500) await sb('POST', 'elo_history', historyRows.slice(i, i + 500));

  await sb('POST', 'job_heartbeat', [{
    job_name: 'elo_backfill', ran_at: now, host: os.hostname(), ok: true,
    note: `warm-start: ${n25}+${n26} fixtures, ${state.size} teams, ${historyRows.length} history-rijen`,
  }]);
  console.log(`[Backfill] KLAAR in ${((Date.now()-t0)/1000).toFixed(0)}s — team_ratings=${ratingRows.length}, elo_history=${historyRows.length}`);
}

main().catch(async (e) => {
  console.error(`[Backfill] ABORT: ${e.message}`);
  try {
    await sb('POST', 'job_heartbeat', [{ job_name: 'elo_backfill', ran_at: new Date().toISOString(), host: os.hostname(), ok: false, note: ('ABORT: ' + e.message).slice(0, 280) }]);
  } catch (_) {}
  process.exit(1);
});
