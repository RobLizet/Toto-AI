// ProMatchXI disk-heartbeat: meet vrije schijfruimte op / en schrijft 1 rij
// naar Supabase (job_heartbeat, job_name='disk'). ok=false bij <10% vrij.
// Pure Node (https-module), geen npm-dependencies. Gespiegeld op heartbeat.js.
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

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
  console.error('[FOUT] SUPABASE_URL of SUPABASE_SERVICE_KEY ontbreekt of is niet ingevuld in .env');
  process.exit(1);
}

const DREMPEL_PCT = 10; // onder deze grens vrije ruimte: ok=false (alarm)

// --- Schijfmeting. Bewust fail-loud: elke mislukking -> ok=false + fout in note,
//     nooit stilletjes ok=true. Percentages via Number.isFinite, geen ||-fallback.
let ok = false;
let note = '';
try {
  // -P: POSIX, 1 regel per filesystem (geen wrapping). -k: forceer 1024-byte blokken.
  const out = execSync('df -P -k /', { encoding: 'utf8' });
  const lines = out.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('df gaf geen dataregel: ' + JSON.stringify(out.slice(0, 120)));
  }
  const cols = lines[1].split(/\s+/);
  // cols: [Filesystem, 1K-blocks, Used, Available, Capacity%, Mounted]
  const usedKb = Number(cols[2]);
  const availKb = Number(cols[3]);
  if (!Number.isFinite(usedKb) || !Number.isFinite(availKb)) {
    throw new Error('df-kolommen niet numeriek: ' + lines[1]);
  }
  const totaalKb = usedKb + availKb;
  if (!(totaalKb > 0)) {
    throw new Error('df totaal <= 0: ' + lines[1]);
  }
  const pctVrij = (availKb / totaalKb) * 100;
  const gb = (kb) => (kb / 1024 / 1024).toFixed(1);
  ok = pctVrij >= DREMPEL_PCT;
  note = `schijf / : ${pctVrij.toFixed(1)}% vrij (${gb(availKb)} GB van ${gb(totaalKb)} GB), drempel ${DREMPEL_PCT}%`;
  if (!ok) {
    note = 'ALARM schijf laag — ' + note;
  }
} catch (e) {
  ok = false;
  note = 'ALARM df-meting mislukt: ' + (e && e.message ? e.message : String(e));
}

const body = JSON.stringify([{
  job_name: 'disk',
  host: os.hostname(),
  note,
  ok
}]);

const host = sbUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
const req = https.request({
  method: 'POST',
  host,
  path: '/rest/v1/job_heartbeat',
  headers: {
    apikey: sbKey,
    Authorization: 'Bearer ' + sbKey,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    'Content-Length': Buffer.byteLength(body)
  }
}, (res) => {
  let data = '';
  res.on('data', (c) => { data += c; });
  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log(`[OK] rij geschreven naar job_heartbeat (ok=${ok}). ${note}`);
      // exit 0: het wegschrijven zelf slaagde. Een schijf-alarm (ok=false) staat
      // in de rij en wordt door /health + de GitHub-monitor opgepikt, niet hier.
      process.exit(0);
    }
    console.error('[FOUT] Supabase status', res.statusCode, '-', data.slice(0, 300));
    process.exit(1);
  });
});
req.on('error', (e) => { console.error('[FOUT] verbinding:', e.message); process.exit(1); });
req.write(body);
req.end();
