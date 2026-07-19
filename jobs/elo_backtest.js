// ProMatchXI offload-job: Elo-blend-backtest.
// Leest v_elo_blend_backtest (model vs blend: Brier/hitrate/ROI) en logt een
// snapshot in elo_blend_backtest_log — MAAR alleen als er echte data is (n_duels>0)
// en de meting veranderd is t.o.v. de vorige. Pure Node, geen npm-deps.
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

(async () => {
  const stamp = new Date().toISOString();
  try {
    const rows = await sb('GET', '/rest/v1/v_elo_blend_backtest?select=*');
    const bt = Array.isArray(rows) ? rows[0] : null;
    if (!bt) { console.error('[FOUT] view gaf geen rij terug'); process.exit(1); }

    const n = (bt.n_duels === null || bt.n_duels === undefined) ? 0 : Number(bt.n_duels);
    console.log(`[elo_backtest] ${stamp} n_duels=${n} brier_model=${bt.brier_model} brier_blend=${bt.brier_blend}`);

    // Nog geen echte data -> alleen alive-signaal, niets wegschrijven
    if (n === 0) {
      console.log('[ok] n_duels=0 — nog geen gematurede duels, niets te loggen (blend rijpt met het seizoen).');
      process.exit(0);
    }

    // Vorige snapshot ophalen om dubbele rijen te vermijden
    const last = await sb('GET', '/rest/v1/elo_blend_backtest_log?select=n_duels&order=id.desc&limit=1');
    const lastN = (Array.isArray(last) && last[0] && last[0].n_duels !== null) ? Number(last[0].n_duels) : null;
    if (lastN === n) {
      console.log(`[ok] n_duels ongewijzigd (${n}) — geen nieuwe snapshot.`);
      process.exit(0);
    }

    const bm = bt.brier_model, bb = bt.brier_blend;
    const blendBetter = (bm !== null && bb !== null) ? (Number(bb) < Number(bm)) : null;

    const written = await sb('POST', '/rest/v1/elo_blend_backtest_log', [{
      n_duels: n,
      brier_model: bm, brier_blend: bb,
      hit_model_fav: bt.hit_model_fav, hit_blend_fav: bt.hit_blend_fav,
      roi_model_pct: bt.roi_model_pct, roi_blend_pct: bt.roi_blend_pct,
      blend_better: blendBetter,
      host: os.hostname()
    }]);
    console.log('[OK] snapshot geschreven:', JSON.stringify(written).slice(0, 220));
    process.exit(0);
  } catch (e) {
    console.error('[FOUT]', e.message);
    process.exit(1);
  }
})();
