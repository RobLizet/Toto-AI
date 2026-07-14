// ═══════════════════════════════════════════════════════════════════════
// VVV.JS — VVV-Venlo clubtabblad (v26.301)
// Vervangt het WK 2026-tabblad. ALLE cijfers/programma/stand/uitslagen komen
// LIVE uit API-Football (team 204, league 89 = Eerste Divisie) via de worker-proxy.
// Historie = geverifieerde, tijdloze feiten (bron: Wikipedia / historie.vvv-venlo.nl /
// venlonaren.net) — GEEN verzonnen data. Nieuws = echte koppen via /vvv-news
// (Google News RSS geproxied door de worker), elk item linkt naar het originele artikel.
// CIJFERBRON-regel: niets wordt hier verzonnen; wat de API niet levert, tonen we eerlijk als
// 'nog geen data'.
// ═══════════════════════════════════════════════════════════════════════

const VVV_TEAM_ID   = 204;   // API-Football team-ID VVV Venlo (geverifieerd)
const VVV_LEAGUE_ID = 89;    // Eerste Divisie (Keuken Kampioen Divisie)
const VVV_LOGO      = 'https://media.api-sports.io/football/teams/204.png';
const VVV_GEEL      = '#f2c200';

// Seizoen-startjaar in API-Football (aug–mei). Vanaf juli tonen we het komende seizoen.
function _vvvSeizoen() {
  const n = new Date();
  return n.getMonth() >= 6 ? n.getFullYear() : n.getFullYear() - 1;
}
function _vvvSeizoenLabel(startYear) {
  return startYear + '/' + String(startYear + 1).slice(2);
}

// Kleine cache per sub-tab zodat wisselen niet elke keer de API raakt.
const _vvvCache = {};

function _vvvEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function _vvvFmtDatum(iso, metTijd) {
  try {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const dag = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'][d.getDay()];
    const mnd = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'][d.getMonth()];
    let s = dag + ' ' + d.getDate() + ' ' + mnd;
    if (metTijd) {
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      s += ' · ' + hh + ':' + mm;
    }
    return s;
  } catch (e) { return ''; }
}

async function _vvvApi(pad, timeout) {
  // apiFetch (api.js) proxiet via de worker naar API-Football; geeft een Response terug.
  const r = await apiFetch('https://v3.football.api-sports.io' + pad, null, timeout || 8000);
  const d = await r.json();
  return d.response || [];
}

// ── Hoofdscherm ────────────────────────────────────────────────────────
function renderVVVScreen() {
  const el = document.getElementById('screen-vvv');
  if (!el) return;
  const actief = state._vvvTab || 'programma';
  const tabs = [
    ['programma', '📅', 'Programma'],
    ['uitslagen', '✅', 'Uitslagen'],
    ['stand', '📊', 'Stand'],
    ['info', 'ℹ️', 'Info'],
    ['historie', '📜', 'Historie'],
    ['nieuws', '📰', 'Nieuws'],
  ];
  el.innerHTML =
    '<div style="padding:1rem .9rem 5rem;">' +
      // Header
      '<div style="display:flex;align-items:center;gap:.8rem;padding:.9rem 1rem;border-radius:16px;' +
        'background:linear-gradient(135deg,rgba(242,194,0,.14),rgba(0,0,0,.35));border:1px solid rgba(242,194,0,.35);margin-bottom:.9rem;">' +
        '<img src="' + VVV_LOGO + '" alt="VVV" style="width:52px;height:52px;object-fit:contain;" ' +
          'onerror="this.style.display=\'none\'"/>' +
        '<div style="min-width:0;">' +
          '<div style="font-family:Bebas Neue,sans-serif;font-size:1.7rem;letter-spacing:.02em;line-height:1;color:' + VVV_GEEL + ';">VVV-VENLO</div>' +
          '<div style="font-family:IBM Plex Mono,monospace;font-size:.5rem;color:rgba(255,255,255,.75);margin-top:.2rem;">The Good Old · Eerste Divisie · Sinds 1903</div>' +
        '</div>' +
      '</div>' +
      // Sub-tabs
      '<div style="display:flex;gap:.35rem;overflow-x:auto;padding-bottom:.5rem;margin-bottom:.7rem;-webkit-overflow-scrolling:touch;">' +
        tabs.map(([k, ic, lbl]) =>
          '<button onclick="vvvTab(\'' + k + '\')" style="flex:0 0 auto;cursor:pointer;font-family:IBM Plex Mono,monospace;' +
          'font-size:.52rem;font-weight:700;padding:.45rem .7rem;border-radius:10px;white-space:nowrap;border:1px solid ' +
          (actief === k ? 'rgba(242,194,0,.6);background:rgba(242,194,0,.16);color:' + VVV_GEEL : 'rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:rgba(255,255,255,.7)') + ';">' +
          ic + ' ' + lbl + '</button>'
        ).join('') +
      '</div>' +
      // Content
      '<div id="vvv-content" style="min-height:40vh;"></div>' +
      // Disclaimer
      '<div style="margin-top:1.2rem;font-family:IBM Plex Mono,monospace;font-size:.42rem;color:rgba(255,255,255,.4);line-height:1.5;text-align:center;">' +
        'Programma, uitslagen en stand: live via API-Football. Nieuws: Google News (koppen van externe media). ProMatchXI is niet gelieerd aan VVV-Venlo.' +
      '</div>' +
    '</div>';
  _vvvRenderTab(actief);
}

function vvvTab(tab) {
  state._vvvTab = tab;
  // Alleen de knoppen + content hertekenen (header blijft)
  renderVVVScreen();
}

function _vvvLoading(msg) {
  const c = document.getElementById('vvv-content');
  if (c) c.innerHTML = '<div style="text-align:center;padding:2.4rem 0;font-family:IBM Plex Mono,monospace;font-size:.55rem;color:rgba(255,255,255,.7);">⟳ ' + _vvvEsc(msg || 'Laden...') + '</div>';
}
function _vvvLeeg(msg) {
  return '<div style="text-align:center;padding:2.4rem 0;font-family:IBM Plex Mono,monospace;font-size:.55rem;color:rgba(255,255,255,.6);line-height:1.6;">' + msg + '</div>';
}
function _vvvFout(e) {
  const c = document.getElementById('vvv-content');
  if (c) c.innerHTML = '<div style="text-align:center;padding:2rem 0;font-family:IBM Plex Mono,monospace;font-size:.52rem;color:#fca5a5;">⚠ Kon niet laden. Controleer je verbinding en probeer opnieuw.</div>';
  console.error('[VVV]', e);
}

function _vvvRenderTab(tab) {
  try {
    if (tab === 'programma') return _vvvLoadProgramma();
    if (tab === 'uitslagen') return _vvvLoadUitslagen();
    if (tab === 'stand') return _vvvLoadStand();
    if (tab === 'info') return _vvvLoadInfo();
    if (tab === 'historie') return _vvvRenderHistorie();
    if (tab === 'nieuws') return _vvvLoadNieuws();
  } catch (e) { _vvvFout(e); }
}

// ── Fixture-rij helper ─────────────────────────────────────────────────
function _vvvFixtureRij(f, metUitslag) {
  const th = f.teams.home, ta = f.teams.away;
  const thuis = th.id === VVV_TEAM_ID;
  const teg = thuis ? ta : th;
  const gastheer = thuis ? 'THUIS' : 'UIT';
  const comp = f.league?.name || '';
  const g = f.goals || {};
  let midden;
  if (metUitslag && g.home != null && g.away != null) {
    const vvvGoals = thuis ? g.home : g.away;
    const tegGoals = thuis ? g.away : g.home;
    let kleur = '#94a3b8';
    if (vvvGoals > tegGoals) kleur = '#22c55e';
    else if (vvvGoals < tegGoals) kleur = '#ef4444';
    midden = '<span style="font-family:Bebas Neue,sans-serif;font-size:1.1rem;color:' + kleur + ';">' + g.home + ' - ' + g.away + '</span>';
  } else {
    midden = '<span style="font-family:IBM Plex Mono,monospace;font-size:.5rem;color:' + VVV_GEEL + ';">' + _vvvFmtDatum(f.fixture.date, true) + '</span>';
  }
  return '<div style="display:flex;align-items:center;gap:.6rem;padding:.6rem .3rem;border-bottom:1px solid rgba(255,255,255,.06);">' +
    '<div style="flex:0 0 2.4rem;font-family:IBM Plex Mono,monospace;font-size:.42rem;color:rgba(255,255,255,.5);">' +
      (metUitslag ? _vvvFmtDatum(f.fixture.date, false) : gastheer) + '</div>' +
    '<img src="' + _vvvEsc(teg.logo || '') + '" style="width:18px;height:18px;object-fit:contain;flex:0 0 18px;" onerror="this.style.display=\'none\'"/>' +
    '<div style="flex:1;min-width:0;font-family:DM Sans,sans-serif;font-size:.72rem;font-weight:600;color:#fff;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' +
      _vvvEsc(teg.name) + '<span style="font-size:.42rem;color:rgba(255,255,255,.45);font-family:IBM Plex Mono,monospace;"> · ' + _vvvEsc(comp) + '</span></div>' +
    '<div style="flex:0 0 auto;text-align:right;">' + midden + '</div>' +
  '</div>';
}

// ── Programma (komende wedstrijden) ────────────────────────────────────
async function _vvvLoadProgramma() {
  _vvvLoading('Programma laden...');
  try {
    const seizoen = _vvvSeizoen();
    let fx = _vvvCache['prog' + seizoen];
    if (!fx) {
      fx = await _vvvApi('/fixtures?team=' + VVV_TEAM_ID + '&season=' + seizoen);
      _vvvCache['prog' + seizoen] = fx;
    }
    const nu = Date.now();
    const komend = fx
      .filter(f => new Date(f.fixture.date).getTime() >= nu && f.fixture.status.short === 'NS')
      .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date))
      .slice(0, 12);
    const c = document.getElementById('vvv-content');
    if (!c) return;
    if (!komend.length) {
      c.innerHTML = _vvvLeeg('Nog geen aankomende wedstrijden gepland.<br>Het seizoen ' + _vvvSeizoenLabel(seizoen) + ' begint begin augustus.');
      return;
    }
    c.innerHTML = komend.map(f => _vvvFixtureRij(f, false)).join('');
  } catch (e) { _vvvFout(e); }
}

// ── Uitslagen (recente resultaten) ─────────────────────────────────────
async function _vvvLoadUitslagen() {
  _vvvLoading('Uitslagen laden...');
  try {
    const seizoen = _vvvSeizoen();
    const gespeeld = (fx) => fx.filter(f => ['FT', 'AET', 'PEN'].includes(f.fixture.status.short));
    let fx = _vvvCache['prog' + seizoen] || await _vvvApi('/fixtures?team=' + VVV_TEAM_ID + '&season=' + seizoen);
    _vvvCache['prog' + seizoen] = fx;
    let done = gespeeld(fx);
    let labelSeizoen = seizoen;
    // Nog niets gespeeld dit seizoen → toon de resultaten van vorig seizoen als referentie.
    if (!done.length) {
      const vorig = seizoen - 1;
      let fxv = _vvvCache['prog' + vorig] || await _vvvApi('/fixtures?team=' + VVV_TEAM_ID + '&season=' + vorig);
      _vvvCache['prog' + vorig] = fxv;
      done = gespeeld(fxv);
      labelSeizoen = vorig;
    }
    done.sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date));
    done = done.slice(0, 15);
    const c = document.getElementById('vvv-content');
    if (!c) return;
    if (!done.length) { c.innerHTML = _vvvLeeg('Nog geen uitslagen beschikbaar.'); return; }
    const kop = labelSeizoen !== seizoen
      ? '<div style="font-family:IBM Plex Mono,monospace;font-size:.46rem;color:rgba(255,255,255,.55);padding:.2rem 0 .5rem;">Seizoen ' + _vvvSeizoenLabel(labelSeizoen) + ' (nieuwe seizoen begint augustus)</div>'
      : '';
    c.innerHTML = kop + done.map(f => _vvvFixtureRij(f, true)).join('');
  } catch (e) { _vvvFout(e); }
}

// ── Stand ──────────────────────────────────────────────────────────────
async function _vvvLoadStand() {
  _vvvLoading('Stand laden...');
  try {
    const seizoen = _vvvSeizoen();
    const haal = async (yr) => {
      const r = await apiFetch('https://v3.football.api-sports.io/standings?league=' + VVV_LEAGUE_ID + '&season=' + yr, null, 8000);
      const d = await r.json();
      return d.response?.[0]?.league?.standings?.[0] || null;
    };
    let st = await haal(seizoen);
    let labelSeizoen = seizoen;
    let eindstand = false;
    if (!st || !st.length) {
      // Seizoen nog niet begonnen → eindstand vorig seizoen als referentie.
      st = await haal(seizoen - 1);
      labelSeizoen = seizoen - 1;
      eindstand = true;
    }
    const c = document.getElementById('vvv-content');
    if (!c) return;
    if (!st || !st.length) { c.innerHTML = _vvvLeeg('Nog geen stand beschikbaar.'); return; }

    const kop = eindstand
      ? '<div style="font-family:IBM Plex Mono,monospace;font-size:.46rem;color:' + VVV_GEEL + ';padding:.1rem 0 .5rem;">Eindstand ' + _vvvSeizoenLabel(labelSeizoen) + ' · nieuwe seizoen begint 7 augustus</div>'
      : '<div style="font-family:IBM Plex Mono,monospace;font-size:.46rem;color:rgba(255,255,255,.55);padding:.1rem 0 .5rem;">Eerste Divisie ' + _vvvSeizoenLabel(labelSeizoen) + '</div>';

    let html = kop +
      '<div style="font-family:IBM Plex Mono,monospace;font-size:.48rem;">' +
      '<div style="display:grid;grid-template-columns:1.2rem 1fr repeat(4,1.7rem);gap:.25rem;padding:.3rem 0;color:rgba(255,255,255,.6);font-weight:700;border-bottom:1px solid rgba(255,255,255,.12);margin-bottom:.2rem;">' +
      '<span>#</span><span>Team</span><span style="text-align:center">G</span><span style="text-align:center">W</span><span style="text-align:center">V</span><span style="text-align:center;color:' + VVV_GEEL + '">Pt</span></div>';
    st.forEach(function (row) {
      const isVVV = row.team?.id === VVV_TEAM_ID;
      const gd = row.goalsDiff || 0;
      html += '<div style="display:grid;grid-template-columns:1.2rem 1fr repeat(4,1.7rem);gap:.25rem;padding:.35rem 0;align-items:center;border-bottom:1px solid rgba(255,255,255,.04);' +
        (isVVV ? 'background:rgba(242,194,0,.1);border-radius:6px;' : '') + '">' +
        '<span style="color:rgba(255,255,255,.6);">' + row.rank + '</span>' +
        '<span style="font-weight:' + (isVVV ? '800' : '600') + ';color:' + (isVVV ? VVV_GEEL : '#fff') + ';overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' + _vvvEsc(row.team?.name || '?') + '</span>' +
        '<span style="text-align:center;color:rgba(255,255,255,.7);">' + (row.all?.played || 0) + '</span>' +
        '<span style="text-align:center;color:#22c55e;">' + (row.all?.win || 0) + '</span>' +
        '<span style="text-align:center;color:#ef4444;">' + (row.all?.lose || 0) + '</span>' +
        '<span style="text-align:center;font-weight:800;color:' + (isVVV ? VVV_GEEL : '#fff') + ';">' + (row.points || 0) + '</span>' +
      '</div>';
    });
    c.innerHTML = html + '</div>';
  } catch (e) { _vvvFout(e); }
}

// ── Info (stadion/club — live uit API-Football) ────────────────────────
async function _vvvLoadInfo() {
  _vvvLoading('Clubinfo laden...');
  try {
    let info = _vvvCache.info;
    if (!info) {
      const r = await _vvvApi('/teams?id=' + VVV_TEAM_ID);
      info = r[0] || null;
      _vvvCache.info = info;
    }
    const c = document.getElementById('vvv-content');
    if (!c) return;
    const t = info?.team || {};
    const v = info?.venue || {};
    const rij = (label, waarde) => waarde
      ? '<div style="display:flex;justify-content:space-between;gap:1rem;padding:.5rem 0;border-bottom:1px solid rgba(255,255,255,.06);">' +
          '<span style="font-family:IBM Plex Mono,monospace;font-size:.5rem;color:rgba(255,255,255,.55);">' + label + '</span>' +
          '<span style="font-family:DM Sans,sans-serif;font-size:.66rem;font-weight:600;color:#fff;text-align:right;">' + _vvvEsc(waarde) + '</span></div>'
      : '';
    // 'Opgericht' = de geverifieerde clubdatum (1903). API-Football's founded (1954) = start betaald
    // voetbal; die tonen we apart en eerlijk gelabeld, zodat er geen verkeerd jaartal geclaimd wordt.
    c.innerHTML =
      '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:.4rem 1rem;">' +
        rij('Officiële naam', 'Venlose Voetbal Vereniging') +
        rij('Bijnaam', 'The Good Old') +
        rij('Opgericht', '7 februari 1903') +
        rij('Betaald voetbal sinds', t.founded ? String(t.founded) : '1954') +
        rij('Clubkleuren', 'Geel / Zwart') +
        rij('Stad', v.city || 'Venlo') +
        rij('Stadion', v.name || 'De Koel') +
        rij('Capaciteit', v.capacity ? v.capacity.toLocaleString('nl-NL') + ' plaatsen' : null) +
        rij('Adres', v.address || null) +
        rij('Competitie', 'Eerste Divisie (Keuken Kampioen Divisie)') +
      '</div>' +
      (v.image ? '<img src="' + _vvvEsc(v.image) + '" alt="Stadion" style="width:100%;border-radius:14px;margin-top:.8rem;" onerror="this.style.display=\'none\'"/>' : '') +
      '<div style="font-family:IBM Plex Mono,monospace;font-size:.42rem;color:rgba(255,255,255,.4);margin-top:.7rem;text-align:center;">Clubgegevens: API-Football. Oprichtingsdatum: officiële clubhistorie.</div>';
  } catch (e) { _vvvFout(e); }
}

// ── Historie (geverifieerde, tijdloze feiten — geen verzonnen data) ─────
function _vvvRenderHistorie() {
  const c = document.getElementById('vvv-content');
  if (!c) return;
  const blok = (jaar, tekst) =>
    '<div style="display:flex;gap:.7rem;padding:.55rem 0;border-bottom:1px solid rgba(255,255,255,.06);">' +
      '<div style="flex:0 0 3.2rem;font-family:Bebas Neue,sans-serif;font-size:1.05rem;color:' + VVV_GEEL + ';line-height:1.1;">' + jaar + '</div>' +
      '<div style="flex:1;font-family:DM Sans,sans-serif;font-size:.66rem;line-height:1.45;color:rgba(255,255,255,.85);">' + tekst + '</div>' +
    '</div>';
  c.innerHTML =
    '<div style="font-family:DM Sans,sans-serif;font-size:.68rem;line-height:1.6;color:rgba(255,255,255,.8);margin-bottom:.8rem;">' +
      'VVV-Venlo behoort tot de oudste clubs van het Nederlandse betaald voetbal. De club ontstond uit het vriendenelftal <b>De Gouden Leeuw</b> en heette korte tijd ook <b>Valuas</b>, voordat op 7 februari 1903 de naam Venlose Voetbal Vereniging werd gekozen.' +
    '</div>' +
    '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:.5rem 1rem;">' +
      blok('1903', 'Opgericht op 7 februari als Venlose Voetbal Vereniging (VVV). Bijnaam: The Good Old, kleuren geel-zwart.') +
      blok('1954', 'Intrede van het betaald voetbal in Venlo.') +
      blok('1959', 'Winst van de KNVB Beker — de grootste prijs uit de clubhistorie.') +
      blok('1966', 'Splitsing in een amateur- (VVV\'03) en profafdeling.') +
      blok('1993', 'Kampioen van de Eerste Divisie en promotie naar de Eredivisie.') +
      blok('2003', 'De officiële naam wordt VVV-Venlo.') +
      blok('2009', 'Opnieuw kampioen van de Eerste Divisie, in eigen stadion De Koel.') +
      blok('2017', 'Kampioen Eerste Divisie met een recordaantal punten; terug in de Eredivisie.') +
      blok('2017-\'21', 'Vier seizoenen onafgebroken in de Eredivisie — de recentste eredivisieperiode.') +
    '</div>' +
    '<div style="font-family:IBM Plex Mono,monospace;font-size:.44rem;color:rgba(255,255,255,.45);margin-top:.8rem;line-height:1.5;text-align:center;">' +
      'Bron: officiële clubhistorie (historie.vvv-venlo.nl), Wikipedia en venlonaren.net. Tijdloze feiten — geen live data.' +
    '</div>';
}

// ── Nieuws (echte koppen via worker /vvv-news → Google News RSS) ────────
async function _vvvLoadNieuws() {
  _vvvLoading('Nieuws laden...');
  try {
    const workerBase = (typeof WORKER !== 'undefined' ? WORKER : 'https://api.promatchxi.app');
    const resp = await fetch(workerBase + '/vvv-news', { cache: 'no-store' });
    const data = await resp.json().catch(() => ({}));
    const items = (data && data.items) || [];
    const c = document.getElementById('vvv-content');
    if (!c) return;
    if (!items.length) {
      c.innerHTML = _vvvLeeg('Op dit moment geen nieuws beschikbaar.<br>Kijk op <a href="https://www.vvv-venlo.nl/nieuws" target="_blank" rel="noopener" style="color:' + VVV_GEEL + ';">vvv-venlo.nl</a> voor het laatste clubnieuws.');
      return;
    }
    c.innerHTML = items.slice(0, 20).map(function (it) {
      const bron = it.source ? _vvvEsc(it.source) : '';
      const dat = it.pubDate ? _vvvFmtDatum(it.pubDate, false) : '';
      const meta = [bron, dat].filter(Boolean).join(' · ');
      return '<a href="' + _vvvEsc(it.link) + '" target="_blank" rel="noopener" ' +
        'style="display:block;text-decoration:none;padding:.65rem .3rem;border-bottom:1px solid rgba(255,255,255,.06);">' +
        '<div style="font-family:DM Sans,sans-serif;font-size:.72rem;font-weight:600;color:#fff;line-height:1.35;">' + _vvvEsc(it.title) + '</div>' +
        (meta ? '<div style="font-family:IBM Plex Mono,monospace;font-size:.44rem;color:' + VVV_GEEL + ';margin-top:.25rem;">' + meta + '</div>' : '') +
      '</a>';
    }).join('') +
    '<div style="font-family:IBM Plex Mono,monospace;font-size:.42rem;color:rgba(255,255,255,.4);margin-top:.8rem;text-align:center;line-height:1.5;">Koppen via Google News. Tik om het volledige artikel bij de bron te lezen.</div>';
  } catch (e) { _vvvFout(e); }
}
