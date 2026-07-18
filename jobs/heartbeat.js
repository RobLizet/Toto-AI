// ProMatchXI job-keten proef: schrijft 1 rij naar Supabase (job_heartbeat).
// Pure Node (https-module), geen npm-dependencies.
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
  console.error('[FOUT] SUPABASE_URL of SUPABASE_SERVICE_KEY ontbreekt of is niet ingevuld in .env');
  process.exit(1);
}

const body = JSON.stringify([{
  job_name: 'heartbeat',
  host: os.hostname(),
  note: 'keten-proef: box -> node -> supabase',
  ok: true
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
      console.log('[OK] rij geschreven naar job_heartbeat. Antwoord:', data.slice(0, 200));
      process.exit(0);
    }
    console.error('[FOUT] Supabase status', res.statusCode, '-', data.slice(0, 300));
    process.exit(1);
  });
});
req.on('error', (e) => { console.error('[FOUT] verbinding:', e.message); process.exit(1); });
req.write(body);
req.end();
