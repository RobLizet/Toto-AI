// ProMatchXI offload-job: Elo-blend-backtest.
// Leest v_elo_blend_backtest (model vs blend: Brier/hitrate/ROI) en logt een
// snapshot in elo_blend_backtest_log — MAAR alleen als er echte data is (n_duels>0)
// en de meting veranderd is t.o.v. de vorige. Pure Node, geen npm-deps.
//
// v2 (22-07-2026): schrijft op ELK uitgangspad een rij naar job_heartbeat.
// Reden: v1 schreef alleen bij een nieuwe snapshot, waardoor "job draait prima
// maar heeft niets te melden" niet te onderscheiden was van "job draait niet".
const JOB_VERSION = 'jobv2';
const JOB_NAME = 'elo_backtest';

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

function loadEnv() {
  const p = path.join(__dirname, '..', '.env');
  const env = {};
  if (fs.existsSync(p)) {
    for (const raw of fs.readFileSync(p, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return { ...env, ...process.env };
}

const env = loadEnv();
const sbUrl = env.SUPABASE_URL;
const sbKey = env.SUPABASE_SERVICE_KEY;
if (!sbUrl || !sbKey || sbKey.indexOf('VUL_HIER') !== -1) {
  console.error('[FOUT] SUPABASE_URL of SUPABASE_SERVICE_KEY ontbreekt/niet ingevuld in .env');
  process.exit(1);
}
const host = sbUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');

// Code-herkomst: door run.sh meegegeven. Ontbreekt hij, dan zeggen we dat ook zo
// (geen verzonnen waarde) — CIJFERBRON-regel.
const gitSha = (typeof env.PMX_GIT_SHA === 'string' && env.PMX_GIT_SHA.length > 0) ? env.PMX_GIT_SHA : 'sha?';
const gitPull = (typeof env.PMX_GIT_PULL === 'string' && env.PMX_GIT_PULL.length > 0) ? env.PMX_GIT_PULL : 'pull?';

function sb(method, urlPath, bodyObj) {
  return new Promise((resolve, reject) => {
    const body = bodyObj ? JSON.stringify(bodyObj) : null;
    const headers = {
      apikey: sbKey,
      Authorization: 'Bearer ' + sbKey,
      Accept: 'application/json'
    };
    if (body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body);
      headers.Prefer = 'return=representation';
    }
    const req = https.request({ method, host, path: urlPath, headers }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data || 'null')); }
          catch (e) { reject(new Error('JSON-parse: ' + data.slice(0, 200))); }
        } else {
          reject(new Error('HTTP ' + res.statusCode + ' - ' + data.slice(0, 300)));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Levensteken. Faalt dit, dan zeggen we dat hardop; het mag het echte
// resultaat van de job niet maskeren.
async function heartbeat(ok, note) {
  const regel = `${JOB_VERSION} ${gitSha} ${gitPull} | ${note}`.slice(0, 280);
  try {
    await sb('POST', '/rest/v1/job_heartbeat', [{
      job_name: JOB_NAME,
      ran_at: new Date().toISOString(),
      host: os.hostname(),
      ok: ok,
      note: regel
    }]);
    console.log(`[hb] ${ok ? 'ok' : 'FOUT'} — ${regel}`);
  } catch (e) {
    console.error('[hb-FOUT] levensteken niet weggeschreven:', e.message);
  }
}

async function klaar(code, ok, note) {
  await heartbeat(ok, note);
  process.exit(code);
}

(async () => {
  const stamp = new Date().toISOString();
  try {
    const rows = await sb('GET', '/rest/v1/v_elo_blend_backtest?select=*');
    const bt = Array.isArray(rows) ? rows[0] : null;
    if (!bt) { console.error('[FOUT] view gaf geen rij terug'); await klaar(1, false, 'v_elo_blend_backtest gaf 0 rijen terug'); return; }

    const n = (bt.n_duels === null || bt.n_duels === undefined) ? 0 : Number(bt.n_duels);
    console.log(`[elo_backtest] ${stamp} n_duels=${n} brier_model=${bt.brier_model} brier_blend=${bt.brier_blend}`);

    // Nog geen echte data -> alleen alive-signaal, niets wegschrijven
    if (n === 0) {
      console.log('[ok] n_duels=0 — nog geen gematurede duels, niets te loggen (blend rijpt met het seizoen).');
      await klaar(0, true, 'n_duels=0 — nog geen gematurede duels, geen snapshot');
      return;
    }

    // Vorige snapshot ophalen om dubbele rijen te vermijden
    const last = await sb('GET', '/rest/v1/elo_blend_backtest_log?select=n_duels&order=id.desc&limit=1');
    const lastN = (Array.isArray(last) && last[0] && last[0].n_duels !== null && last[0].n_duels !== undefined) ? Number(last[0].n_duels) : null;
    if (lastN === n) {
      console.log(`[ok] n_duels ongewijzigd (${n}) — geen nieuwe snapshot.`);
      await klaar(0, true, `n_duels ongewijzigd (${n}) — geen nieuwe snapshot`);
      return;
    }

    const bm = bt.brier_model, bb = bt.brier_blend;
    const blendBetter = (bm !== null && bb !== null && bm !== undefined && bb !== undefined) ? (Number(bb) < Number(bm)) : null;

    const written = await sb('POST', '/rest/v1/elo_blend_backtest_log', [{
      n_duels: n,
      brier_model: bm, brier_blend: bb,
      hit_model_fav: bt.hit_model_fav, hit_blend_fav: bt.hit_blend_fav,
      roi_model_pct: bt.roi_model_pct, roi_blend_pct: bt.roi_blend_pct,
      blend_better: blendBetter,
      host: os.hostname()
    }]);
    console.log('[OK] snapshot geschreven:', JSON.stringify(written).slice(0, 220));
    await klaar(0, true, `snapshot geschreven: n_duels ${lastN === null ? 'geen' : lastN} -> ${n}, brier model=${bm} blend=${bb}, blend_beter=${blendBetter}`);
  } catch (e) {
    console.error('[FOUT]', e.message);
    await klaar(1, false, ('ABORT: ' + e.message).slice(0, 240));
  }
})();
