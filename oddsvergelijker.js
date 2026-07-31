// ═══════════════════════════════════════════════════════════════════════
// ODDSVERGELIJKER B — heel vergelijkerscherm met lijnbeweging (opening→closing)
// Dormant achter model_config.oddsvergelijker_enabled (via /model-params).
// Praat UITSLUITEND met de worker: GET /bookmaker-history?fixture=<id>.
// CIJFERBRON: alleen boeken/consensus die de call ECHT teruggaf; faalt de
// fetch -> "kon niet ophalen" (uitspraak over ONZE fetch, niet de buitenwereld).
// Model-value hergebruikt state.valueScans (de pick die de frontend al heeft).
// ═══════════════════════════════════════════════════════════════════════

function _odWorker() {
  // api.js definieert de globale const WORKER; vangnet als die ooit ontbreekt.
  return (typeof WORKER !== 'undefined' && WORKER) ? WORKER : 'https://api.promatchxi.app';
}

function _odFlagAan() {
  // === true, niet truthy: ontbreekt MODEL_PARAMS dan is de flag ONBEKEND -> dormant.
  return (typeof MODEL_PARAMS !== 'undefined' && MODEL_PARAMS && MODEL_PARAMS.oddsvergelijker_enabled === true);
}

// Odds netjes tonen; alleen een echt getal, anders een streepje (geen falsy-nul).
function _odOdd(v) {
  return (typeof v === 'number' && isFinite(v)) ? v.toFixed(2) : '–';
}

// Value-scan voor een fixture opzoeken (dezelfde bron als de pick-kaart).
function _odScanVoor(fixtureId) {
  const list = (state && Array.isArray(state.valueScans)) ? state.valueScans : [];
  return list.find(s => String(s.fixtureId || s.matchId || s.id) === String(fixtureId)) || null;
}

// ── Hoofdscherm ────────────────────────────────────────────────────────
function renderOddsvergelijkerScreen() {
  const s = document.getElementById('screen-oddsvergelijker');
  if (!s) return;

  const kop = `
    <div style="display:flex;align-items:center;gap:.55rem;margin-bottom:.85rem;">
      <div style="font-size:1.5rem;">\uD83D\uDCC8</div>
      <div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.25rem;letter-spacing:.04em;color:#fff;line-height:1;">${t('od.title','Oddsvergelijker')}</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--muted);margin-top:.2rem;">${t('od.sub','Vergelijk boeken \u00b7 lijnbeweging opening \u2192 closing')}</div>
      </div>
    </div>`;

  // Flag uit? Eerlijk melden i.p.v. een leeg/kapot scherm. (Entry-knop is óók
  // flag-gated, dus dit is alleen een vangnet bij een directe route.)
  if (!_odFlagAan()) {
    s.innerHTML = kop + `
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.62rem;color:var(--muted);
        background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:14px;
        padding:1rem;text-align:center;line-height:1.6;">
        ${t('od.uit','Deze functie staat uit.')}<br>
        <span style="opacity:.7;">${t('od.uit_hint','Zet oddsvergelijker_enabled aan in model_config om hem te tonen.')}</span>
      </div>`;
    return;
  }

  const scans = (state && Array.isArray(state.valueScans)) ? state.valueScans : [];
  if (!scans.length) {
    s.innerHTML = kop + `
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.62rem;color:var(--muted);
        background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:14px;
        padding:1rem;text-align:center;line-height:1.6;">
        ${t('od.geenpicks','Nog geen value-picks om te vergelijken.')}<br>
        <span style="opacity:.7;">${t('od.geenpicks_hint','Zodra er picks binnen zijn, verschijnen ze hier met hun boeken-historie.')}</span>
      </div>`;
    return;
  }

  const rijen = scans.map(sc => {
    const fid = sc.fixtureId || sc.matchId || sc.id;
    const val = (typeof sc.value === 'number') ? sc.value : null;
    const valTxt = (val == null) ? '' :
      `<span style="color:${val >= 0 ? '#00BEC4' : 'var(--muted)'};font-weight:700;">${val >= 0 ? '+' : ''}${val.toFixed(1)}pp</span>`;
    const oddsTxt = (typeof sc.odds === 'number' && sc.odds > 0) ? `@ ${sc.odds.toFixed(2)}` : '';
    return `
      <button onclick="pmxOddsvergOpen('${fid}')" style="width:100%;text-align:left;
        background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;
        padding:.7rem .8rem;margin-bottom:.5rem;cursor:pointer;display:block;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.66rem;color:#fff;font-weight:700;line-height:1.3;">
          ${sc.home || '?'} <span style="color:var(--muted);">v</span> ${sc.away || '?'}
        </div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;color:var(--muted);margin-top:.25rem;
          display:flex;justify-content:space-between;gap:.5rem;">
          <span>${sc.comp || sc.leagueName || ''}</span>
          <span>${sc.pickLabel || sc.pick || ''} ${oddsTxt} ${valTxt}</span>
        </div>
      </button>`;
  }).join('');

  s.innerHTML = kop + `
    <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--muted);margin-bottom:.55rem;">
      ${t('od.kies','Tik op een wedstrijd voor de boeken-historie')}
    </div>
    <div>${rijen}</div>
    <div id="od-detail" style="margin-top:.4rem;"></div>`;
}

// ── Detail: haalt de boeken-historie op en rendert lijnbeweging + tabel ──
async function pmxOddsvergOpen(fixtureId) {
  const box = document.getElementById('od-detail');
  if (!box) return;
  box.innerHTML = `<div style="font-family:'IBM Plex Mono',monospace;font-size:.6rem;color:var(--muted);
    text-align:center;padding:1rem;">${t('od.laden','\u27F3 Boeken-historie laden\u2026')}</div>`;

  let d = null;
  try {
    const r = await fetch(`${_odWorker()}/bookmaker-history?fixture=${encodeURIComponent(fixtureId)}&_cb=${Date.now()}`);
    d = await r.json();
  } catch (e) {
    // Uitspraak over ONZE fetch — nooit "geen data" beweren bij een mislukte call.
    box.innerHTML = _odFout(t('od.fetchfout', 'Kon de boeken-historie niet ophalen (netwerk of server). Probeer het zo opnieuw.'));
    return;
  }

  if (!d || d.ok !== true) {
    box.innerHTML = _odFout(t('od.fetchfout', 'Kon de boeken-historie niet ophalen (netwerk of server). Probeer het zo opnieuw.'));
    return;
  }

  const reeks = Array.isArray(d.reeks) ? d.reeks : [];
  // Call slaagde aantoonbaar (ok:true) -> nu MAG "geen historie" gezegd worden.
  if (!reeks.length) {
    box.innerHTML = `<div style="font-family:'IBM Plex Mono',monospace;font-size:.6rem;color:var(--muted);
      background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;
      padding:.9rem;text-align:center;">${t('od.geenhistorie','Nog geen boeken-historie voor deze wedstrijd.')}</div>`;
    return;
  }

  const eerste = reeks[0];
  const laatste = reeks[reeks.length - 1];
  const scan = _odScanVoor(fixtureId);

  box.innerHTML =
    _odLijnbewegingHtml(reeks, eerste, laatste, d.snapshots) +
    _odModelValueHtml(scan, laatste) +
    _odBoekenTabelHtml(laatste);
}

function _odFout(tekst) {
  return `<div style="font-family:'IBM Plex Mono',monospace;font-size:.6rem;color:#f59e0b;
    background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);border-radius:12px;
    padding:.9rem;text-align:center;line-height:1.5;">${tekst}</div>`;
}

// Lijnbeweging: opening -> closing consensus + delta + sparkline (thuis).
function _odLijnbewegingHtml(reeks, eerste, laatste, snapshots) {
  const co = eerste.cons || {}, cc = laatste.cons || {};
  const rij = (label, o, c) => {
    if (typeof o !== 'number' || typeof c !== 'number') {
      return `<td style="padding:.2rem .35rem;color:var(--muted);">${label}: –</td>`;
    }
    const dlt = c - o;
    const kleur = dlt > 0 ? '#00BEC4' : (dlt < 0 ? '#f87171' : 'var(--muted)');
    const pijl = dlt > 0 ? '\u2191' : (dlt < 0 ? '\u2193' : '\u2192');
    const dtxt = (dlt === 0) ? '0' : (dlt > 0 ? '+' : '') + dlt.toFixed(2);
    return `<td style="padding:.2rem .35rem;color:#fff;">${label}: ${o.toFixed(2)}\u2009\u2192\u2009${c.toFixed(2)}
      <span style="color:${kleur};">${pijl}${dtxt}</span></td>`;
  };
  const spark = _odSparkline(reeks.map(x => (x.cons && typeof x.cons.h === 'number') ? x.cons.h : null));
  const n = (typeof snapshots === 'number') ? snapshots : reeks.length;
  const periode = _odPeriode(eerste.t, laatste.t);

  return `
  <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;
    padding:.8rem;margin-bottom:.6rem;">
    <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--muted);letter-spacing:.06em;margin-bottom:.4rem;">
      ${t('od.lijnbeweging','LIJNBEWEGING (consensus)')} \u00b7 ${n} ${t('od.snapshots','snapshots')}${periode ? ' \u00b7 ' + periode : ''}
    </div>
    <table style="font-family:'IBM Plex Mono',monospace;font-size:.56rem;border-collapse:collapse;width:100%;">
      <tr>${rij(t('od.thuis','Thuis'), co.h, cc.h)}${rij(t('od.gelijk','Gelijk'), co.d, cc.d)}${rij(t('od.uit_l','Uit'), co.a, cc.a)}</tr>
    </table>
    ${spark ? `<div style="margin-top:.5rem;">${spark}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--muted);text-align:center;margin-top:.15rem;">
        ${t('od.sparkhint','thuis-odds over tijd (opening links \u2192 closing rechts)')}</div>` : ''}
  </div>`;
}

// Minimalistische inline-SVG sparkline; alleen echte getallen, min. 2 punten.
function _odSparkline(vals) {
  const pts = vals.map((v, i) => (typeof v === 'number' && isFinite(v)) ? { i, v } : null).filter(Boolean);
  if (pts.length < 2) return '';
  const w = 260, h = 34, pad = 3;
  const xs = pts.map(p => p.i), ys = pts.map(p => p.v);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  let minY = Math.min(...ys), maxY = Math.max(...ys);
  if (maxY === minY) { minY -= 0.05; maxY += 0.05; } // platte lijn: kleine marge
  const sx = i => pad + (w - 2 * pad) * ((i - minX) / (maxX - minX || 1));
  const sy = v => (h - pad) - (h - 2 * pad) * ((v - minY) / (maxY - minY || 1));
  const dPath = pts.map((p, k) => `${k ? 'L' : 'M'}${sx(p.i).toFixed(1)},${sy(p.v).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none"
    style="display:block;background:rgba(0,190,196,.05);border-radius:6px;">
    <path d="${dPath}" fill="none" stroke="#00BEC4" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${sx(last.i).toFixed(1)}" cy="${sy(last.v).toFixed(1)}" r="2.4" fill="#00BEC4"/>
  </svg>`;
}

// Model-value uit de al-aanwezige value-scan (geen herberekening in de app).
function _odModelValueHtml(scan, laatste) {
  if (!scan) return '';
  const val = (typeof scan.value === 'number') ? scan.value : null;
  const kans = (typeof scan.kans === 'number') ? scan.kans : null;
  const pick = scan.pickLabel || scan.pick || '';
  if (!pick && val == null) return '';
  const valTxt = (val == null) ? '' :
    `<span style="color:${val >= 0 ? '#00BEC4' : '#f87171'};font-weight:700;">${val >= 0 ? '+' : ''}${val.toFixed(1)}pp value</span>`;
  const kansTxt = (kans == null) ? '' : ` \u00b7 ${t('od.modelkans','modelkans')} ${kans}%`;
  return `
  <div style="background:rgba(0,190,196,.06);border:1px solid rgba(0,190,196,.25);border-radius:12px;
    padding:.7rem .8rem;margin-bottom:.6rem;">
    <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--muted);letter-spacing:.06em;margin-bottom:.25rem;">
      ${t('od.modelpick','MODEL-PICK')}
    </div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:.62rem;color:#fff;">
      ${pick} ${valTxt}${kansTxt}
    </div>
  </div>`;
}

// Boeken-tabel van de LAATSTE snapshot; beste prijs per uitkomst gemarkeerd.
function _odBoekenTabelHtml(laatste) {
  const boeken = laatste.boeken || {};
  const namen = Object.keys(boeken);
  if (!namen.length) {
    return `<div style="font-family:'IBM Plex Mono',monospace;font-size:.58rem;color:var(--muted);
      text-align:center;padding:.6rem;">${t('od.geenboeken','Geen per-boek-odds in de laatste snapshot.')}</div>`;
  }
  // Beste (hoogste) prijs per uitkomst — alleen boeken die de markt echt gaven.
  const best = { h: -Infinity, d: -Infinity, a: -Infinity };
  namen.forEach(nm => {
    const o = boeken[nm] || {};
    ['h', 'd', 'a'].forEach(k => { if (typeof o[k] === 'number' && o[k] > best[k]) best[k] = o[k]; });
  });
  const cel = (v, k) => {
    if (typeof v !== 'number') return `<td style="padding:.28rem .3rem;text-align:right;color:var(--muted);">–</td>`;
    const isBest = (v === best[k]);
    return `<td style="padding:.28rem .3rem;text-align:right;color:${isBest ? '#00BEC4' : '#fff'};font-weight:${isBest ? '700' : '400'};">${v.toFixed(2)}${isBest ? '\u2009\u2605' : ''}</td>`;
  };
  const rijen = namen.map(nm => {
    const o = boeken[nm] || {};
    return `<tr style="border-top:1px solid rgba(255,255,255,.06);">
      <td style="padding:.28rem .3rem;color:rgba(255,255,255,.85);white-space:nowrap;">${nm}</td>
      ${cel(o.h, 'h')}${cel(o.d, 'd')}${cel(o.a, 'a')}</tr>`;
  }).join('');
  const b = (k) => (best[k] > -Infinity) ? best[k].toFixed(2) : '–';

  return `
  <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;
    padding:.7rem;overflow-x:auto;">
    <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--muted);letter-spacing:.06em;margin-bottom:.4rem;">
      ${t('od.boeken','BOEKEN (laatste snapshot)')} \u00b7 ${namen.length}
    </div>
    <table style="font-family:'IBM Plex Mono',monospace;font-size:.56rem;border-collapse:collapse;width:100%;min-width:220px;">
      <tr style="color:var(--muted);">
        <td style="padding:.28rem .3rem;">${t('od.boek','Boek')}</td>
        <td style="padding:.28rem .3rem;text-align:right;">1</td>
        <td style="padding:.28rem .3rem;text-align:right;">X</td>
        <td style="padding:.28rem .3rem;text-align:right;">2</td>
      </tr>
      ${rijen}
    </table>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;color:#00BEC4;margin-top:.4rem;">
      \u2605 ${t('od.beste','beste')}: 1 ${b('h')} \u00b7 X ${b('d')} \u00b7 2 ${b('a')}
    </div>
  </div>`;
}

// "Xu Ym" tijdspanne tussen twee ISO-tijdstippen (defensief).
function _odPeriode(tA, tB) {
  const a = new Date(tA).getTime(), b = new Date(tB).getTime();
  if (!isFinite(a) || !isFinite(b) || b <= a) return '';
  const min = Math.round((b - a) / 60000);
  const u = Math.floor(min / 60), m = min % 60;
  return (u > 0 ? u + 'u ' : '') + m + 'm';
}

// Flag-cache vroeg vullen zodat de entry-knop verschijnt zodra hij aan staat.
if (typeof loadModelParams === 'function') {
  try { loadModelParams().catch(() => null); } catch (e) { /* stil: dormant blijft dormant */ }
}
