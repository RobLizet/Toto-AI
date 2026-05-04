// TOTO AI Cloudflare Worker v12
// Nieuw in v11:
//   • ALLE secrets uit code verwijderd — alles via env secrets
//   • VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY → nu via env secret
//   • FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY → nu via env secret
//
// Vereiste Cloudflare Worker secrets (stel in via dashboard of wrangler):
//   wrangler secret put ANTHROPIC_KEY
//   wrangler secret put FOOTBALL_KEY
//   wrangler secret put FD_KEY
//   wrangler secret put VAPID_PRIVATE_KEY
//   wrangler secret put VAPID_PUBLIC_KEY
//   wrangler secret put FIREBASE_PROJECT_ID
//   wrangler secret put FIREBASE_CLIENT_EMAIL
//   wrangler secret put FIREBASE_PRIVATE_KEY

const VAPID_SUBJECT = 'mailto:zweetzakken@gmail.com';

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

export default {
  async fetch(request, env) {
    const url  = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    // ── /anthropic → Claude API ────────────────────────────
    if (path === '/anthropic' || path === '/anthropic/') {
      if (request.method !== 'POST') return jsonResp({ error: 'POST only' }, 405);
      if (!env.ANTHROPIC_KEY) return jsonResp({ error: 'ANTHROPIC_KEY not configured as secret' }, 500);
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
      } catch (e) { return jsonResp({ error: e.message }, 500); }
    }

    // ── /apif/* → API-Football v3 ──────────────────────────
    if (path.startsWith('/apif/')) {
      if (!env.FOOTBALL_KEY) return jsonResp({ error: 'FOOTBALL_KEY not configured as secret' }, 500);
      try {
        const apiPath = path.replace('/apif', '');
        const resp = await fetch(`https://v3.football.api-sports.io${apiPath}${url.search}`, {
          headers: {
            'x-apisports-key': env.FOOTBALL_KEY,
            'x-rapidapi-key':  env.FOOTBALL_KEY,
            'x-rapidapi-host': 'v3.football.api-sports.io',
          },
        });
        return jsonResp(await resp.json(), resp.status);
      } catch (e) { return jsonResp({ error: e.message }, 500); }
    }

    // ── /fd/* → football-data.org ──────────────────────────
    if (path.startsWith('/fd/')) {
      if (!env.FD_KEY) return jsonResp({ error: 'FD_KEY not configured as secret' }, 500);
      try {
        const apiPath = path.replace('/fd', '');
        const resp = await fetch(`https://api.football-data.org${apiPath}${url.search}`, {
          headers: { 'X-Auth-Token': env.FD_KEY },
        });
        return jsonResp(await resp.json(), resp.status);
      } catch (e) { return jsonResp({ error: e.message }, 500); }
    }

    // ── /health → status check ─────────────────────────────
    if (path === '/health') {
      return jsonResp({
        ok: true, version: '11',
        keys: {
          anthropic: !!env.ANTHROPIC_KEY,
          football:  !!env.FOOTBALL_KEY,
          fd:        !!env.FD_KEY,
          vapid:     !!env.VAPID_PRIVATE_KEY,
          firebase:  !!env.FIREBASE_PRIVATE_KEY,
        }
      });
    }

    // ── TWA Asset Links ────────────────────────────────────
    if (path === '/.well-known/assetlinks.json') {
      return new Response(JSON.stringify([{
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'app.toto_ai.twa',
          sha256_cert_fingerprints: [
            'B3:F5:6F:88:3E:C3:BE:B9:BE:DE:0A:94:D7:34:6F:DE:E9:81:27:AC:E5:96:53:EA:2C:CD:69:AC:FE:B6:EF:F3'
          ]
        }
      }]), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // ── Push subscribe ─────────────────────────────────────
    if (path === '/push/subscribe' && request.method === 'POST') {
      try {
        const body = await request.json();
        const sub  = body.subscription || body;
        if (env.PUSH_KV) await env.PUSH_KV.put('sub', JSON.stringify(sub));
        return jsonResp({ ok: true });
      } catch (e) { return jsonResp({ error: e.message }, 500); }
    }

    // ── Push send ──────────────────────────────────────────
    if (path === '/push/send' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { type, playerId, subscription, fcmToken, title, message, data } = body;

let sub = subscription;
        if (!sub && env.PUSH_KV) {
          const stored = await env.PUSH_KV.get('sub');
          if (stored) sub = JSON.parse(stored);
        }
        if (sub?.endpoint && sub?.keys?.p256dh && sub?.keys?.auth) {
          try {
            const result = await sendVapidPush(sub, title || '⚡ TOTO AI', message || '', data || {}, env);
            return jsonResp({ ok: result.ok, method: 'vapid', status: result.status });
          } catch (vapidErr) { console.error('VAPID fout:', vapidErr.message); }
        }

        let regToken = fcmToken;
        if (!regToken && sub?.endpoint?.includes('fcm.googleapis.com'))
          regToken = sub.endpoint.split('/').pop();
        if (regToken) {
          const accessToken = await getFCMAccessToken(env);
          const fcmResp = await fetch(
            `https://fcm.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/messages:send`,
            {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: {
                  token: regToken,
                  data: { title: title || '⚡ TOTO AI', body: message || '', tag: data?.tag || 'totoai' },
                  webpush: {
                    notification: {
                      title: title || '⚡ TOTO AI', body: message || '',
                      icon: '/icon-192.png', badge: '/icon-192.png',
                      requireInteraction: true, tag: data?.tag || 'totoai',
                    },
                    fcm_options: { link: 'https://toto-ai.app/' }
                  }
                }
              })
            }
          );
          return jsonResp({ ok: fcmResp.ok, method: 'fcm', result: await fcmResp.json() });
        }

        return jsonResp({ error: 'Geen geldige push subscription of FCM token' }, 400);
      } catch (e) { return jsonResp({ error: e.message }, 500); }
    }

    // ── Oude ?url= proxy (fallback) ────────────────────────
    if (url.searchParams.has('url')) {
      const target  = url.searchParams.get('url');
      const headers = {};
      request.headers.forEach((v, k) => {
        if (!['host','cf-connecting-ip','cf-ray','cf-visitor','cf-ipcountry'].includes(k.toLowerCase()))
          headers[k] = v;
      });
      const apiKey = request.headers.get('x-apisports-key') || request.headers.get('x-rapidapi-key');
      if (apiKey) {
        headers['x-apisports-key'] = apiKey;
        headers['x-rapidapi-key']  = apiKey;
        headers['x-rapidapi-host'] = 'v3.football.api-sports.io';
      }
      const fdKey = request.headers.get('x-auth-token');
      if (fdKey) headers['x-auth-token'] = fdKey;
      const anthropicKey = request.headers.get('x-api-key');
      if (anthropicKey || target.includes('anthropic.com')) {
        if (anthropicKey) headers['x-api-key'] = anthropicKey;
        headers['anthropic-version'] = request.headers.get('anthropic-version') || '2023-06-01';
        headers['anthropic-dangerous-direct-browser-access'] = 'true';
      }
      try {
        const resp = await fetch(target, {
          method: request.method, headers,
          body: ['GET','HEAD'].includes(request.method) ? undefined : request.body,
        });
        const rh = new Headers(resp.headers);
        Object.entries(cors).forEach(([k, v]) => rh.set(k, v));
        return new Response(resp.body, { status: resp.status, headers: rh });
      } catch (e) { return jsonResp({ error: e.message }, 500); }
    }

    return new Response('TOTO AI Worker v12', { headers: cors });
  }
};

// ══════════════════════════════════════════════════════════
// VAPID helpers
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
// FCM helpers
// ══════════════════════════════════════════════════════════
async function getFCMAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  const jwt = await makeJWT({
    iss:   env.FIREBASE_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now
  }, env.FIREBASE_PRIVATE_KEY);
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  const d = await resp.json();
  if (!d.access_token) throw new Error('OAuth2 mislukt');
  return d.access_token;
}

async function makeJWT(payload, privateKeyPem) {
  const enc   = o => btoa(JSON.stringify(o)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const input = `${enc({alg:'RS256',typ:'JWT'})}.${enc(payload)}`;
  const pem   = privateKeyPem.replace('-----BEGIN PRIVATE KEY-----','').replace('-----END PRIVATE KEY-----','').replace(/\n/g,'').trim();
  const der   = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key   = await crypto.subtle.importKey('pkcs8', der.buffer, {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'}, false, ['sign']);
  const sig   = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input));
  return `${input}.${btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}`;
}
