// ANALYTICS.JS — v21.0
// Supabase + Firebase analytics dashboard
// CLV, ROI, Sharp Money, Confidence calibratie

// ── Render analytics scherm ──────────────────────────────
function renderAnalyticsScreen() {
  const el = document.getElementById('screen-analytics');
  if (!el) return;
  el.innerHTML = `
    <div style="padding:.75rem .9rem 5rem;max-width:420px;margin:0 auto;">

      <!-- Header -->
      <div style="margin-bottom:1rem;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;color:var(--ink);letter-spacing:.03em;">📊 ANALYTICS</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);margin-top:.1rem;">PERFORMANCE · CLV · SHARP MONEY</div>
      </div>

      <!-- Loading state -->
      <div id="analytics-loading" style="text-align:center;padding:2rem 0;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);">⟳ Data ophalen...</div>
      </div>

      <!-- Content (hidden until loaded) -->
      <div id="analytics-content" style="display:none;">

        <!-- KPI blokken rij 1 -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.5rem;">
          <div id="kpi-roi" style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;padding:.7rem .8rem;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.42rem;color:var(--sub);font-weight:700;">TOTALE ROI</div>
            <div id="kpi-roi-val" style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;margin-top:.15rem;">—</div>
            <div id="kpi-roi-sub" style="font-family:'IBM Plex Mono',monospace;font-size:.42rem;color:var(--sub);margin-top:.1rem;">— picks gesetteld</div>
          </div>
          <div id="kpi-clv" style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;padding:.7rem .8rem;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.42rem;color:var(--sub);font-weight:700;">GEM. CLV</div>
            <div id="kpi-clv-val" style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;margin-top:.15rem;">—</div>
            <div id="kpi-clv-sub" style="font-family:'IBM Plex Mono',monospace;font-size:.42rem;color:var(--sub);margin-top:.1rem;">closing line value</div>
          </div>
        </div>

        <!-- KPI blokken rij 2 -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;margin-bottom:.75rem;">
          <div style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;padding:.6rem .7rem;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);font-weight:700;">HITRATE</div>
            <div id="kpi-hitrate" style="font-family:'Bebas Neue',sans-serif;font-size:1.3rem;margin-top:.1rem;">—</div>
          </div>
          <div style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;padding:.6rem .7rem;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);font-weight:700;">GEM. ODDS</div>
            <div id="kpi-odds" style="font-family:'Bebas Neue',sans-serif;font-size:1.3rem;margin-top:.1rem;">—</div>
          </div>
          <div style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;padding:.6rem .7rem;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);font-weight:700;">CLV > 0%</div>
            <div id="kpi-clv-pos" style="font-family:'Bebas Neue',sans-serif;font-size:1.3rem;margin-top:.1rem;">—</div>
          </div>
        </div>

        <!-- CLV uitleg banner -->
        <div id="clv-banner" style="display:none;background:linear-gradient(135deg,rgba(21,128,61,.08),rgba(16,185,129,.05));
          border:1px solid rgba(21,128,61,.2);border-radius:14px;padding:.65rem .85rem;margin-bottom:.75rem;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;font-weight:700;color:#15803d;">✅ POSITIEVE EDGE GEDETECTEERD</div>
          <div id="clv-banner-text" style="font-family:'DM Sans',sans-serif;font-size:.7rem;color:var(--ink);margin-top:.2rem;"></div>
        </div>

        <div id="clv-warn-banner" style="display:none;background:rgba(220,38,38,.06);
          border:1px solid rgba(220,38,38,.2);border-radius:14px;padding:.65rem .85rem;margin-bottom:.75rem;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;font-weight:700;color:#dc2626;">⚠️ NEGATIEVE CLV</div>
          <div style="font-family:'DM Sans',sans-serif;font-size:.7rem;color:var(--sub);margin-top:.2rem;">Model pakt systematisch slechtere odds dan sluiting. Calibratie nodig.</div>
        </div>

        <!-- ROI per confidence tier -->
        <div style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;padding:.75rem .85rem;margin-bottom:.5rem;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;font-weight:700;color:var(--sub);margin-bottom:.6rem;">📈 ROI PER CONFIDENCE TIER</div>
          <div id="conf-tiers" style="display:flex;flex-direction:column;gap:.35rem;"></div>
          <div id="conf-empty" style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);display:none;">Nog te weinig data per tier</div>
        </div>

        <!-- ROI per odds range -->
        <div style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;padding:.75rem .85rem;margin-bottom:.5rem;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;font-weight:700;color:var(--sub);margin-bottom:.6rem;">🎯 ROI PER ODDS RANGE</div>
          <div id="odds-ranges" style="display:flex;flex-direction:column;gap:.35rem;"></div>
        </div>

        <!-- ROI per league -->
        <div style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;padding:.75rem .85rem;margin-bottom:.5rem;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;font-weight:700;color:var(--sub);margin-bottom:.6rem;">🏆 ROI PER COMPETITIE</div>
          <div id="league-rows" style="display:flex;flex-direction:column;gap:.35rem;"></div>
          <div id="league-empty" style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);display:none;">Nog geen gesettelde picks per competitie</div>
        </div>

        <!-- Sharp Money (Supabase) -->
        <div style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;padding:.75rem .85rem;margin-bottom:.5rem;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;font-weight:700;color:var(--sub);margin-bottom:.6rem;">🔥 SHARP MONEY (LAATSTE 7 DAGEN)</div>
          <div id="sharp-rows" style="display:flex;flex-direction:column;gap:.35rem;"></div>
          <div id="sharp-empty" style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);display:none;">Geen steam movements gedetecteerd</div>
        </div>

        <!-- Laatste 30 dagen ROI -->
        <div style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;padding:.75rem .85rem;margin-bottom:.5rem;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;font-weight:700;color:var(--sub);margin-bottom:.6rem;">📅 LAATSTE 30 DAGEN</div>
          <div id="recent-rows" style="display:flex;flex-direction:column;gap:.35rem;"></div>
          <div id="recent-empty" style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);display:none;">Nog geen recente picks</div>
        </div>

        <!-- Footer meta -->
        <div style="text-align:center;padding:.5rem 0 1rem;">
          <div id="analytics-meta" style="font-family:'IBM Plex Mono',monospace;font-size:.4rem;color:var(--sub);"></div>
          <button onclick="loadAnalytics()" style="margin-top:.5rem;background:rgba(124,58,237,.1);border:1px solid rgba(124,58,237,.2);
            border-radius:999px;padding:.3rem .9rem;font-family:'IBM Plex Mono',monospace;font-size:.44rem;
            color:#7c3aed;cursor:pointer;font-weight:700;">↻ VERVERSEN</button>
        </div>

      </div>
    </div>
  `;

  loadAnalytics();
}

// ── Data laden ───────────────────────────────────────────
async function loadAnalytics() {
  const loading = document.getElementById('analytics-loading');
  const content = document.getElementById('analytics-content');
  if (loading) loading.style.display = 'block';
  if (content) content.style.display = 'none';

  try {
    // Parallel: Firebase picks + Supabase analytics
    const [picksData, supabaseData] = await Promise.all([
      loadFirebasePicks(),
      loadSupabaseAnalytics(),
    ]);

    renderAnalyticsContent(picksData, supabaseData);
  } catch(e) {
    console.error('[Analytics] Fout:', e);
    if (loading) loading.innerHTML = `<div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:#dc2626;">⚠️ Laden mislukt: ${e.message}</div>`;
  }
}

async function loadFirebasePicks() {
  try {
    const WORKER = 'https://toto-proxy.zweetzakken.workers.dev';
    const res = await fetch(`${WORKER}/picks`);
    const data = await res.json();
    return data.picks || [];
  } catch(e) {
    console.warn('[Analytics] Firebase picks fout:', e.message);
    return [];
  }
}

async function loadSupabaseAnalytics() {
  try {
    const WORKER = 'https://toto-proxy.zweetzakken.workers.dev';
    const res = await fetch(`${WORKER}/analytics`);
    return await res.json();
  } catch(e) {
    console.warn('[Analytics] Supabase fout:', e.message);
    return null;
  }
}

// ── Render content ───────────────────────────────────────
function renderAnalyticsContent(picks, supabase) {
  const settled = picks.filter(p => p.status === 'win' || p.status === 'lose');
  const wins    = settled.filter(p => p.status === 'win');
  const total   = settled.length;

  // ── KPIs ────────────────────────────────────────────────
  const roi = total > 0
    ? settled.reduce((s, p) => s + (p.status === 'win' ? (p.odds - 1) * 100 : -100), 0) / total
    : null;
  const hitrate = total > 0 ? (wins.length / total * 100) : null;
  const avgOdds = total > 0
    ? settled.reduce((s, p) => s + (p.odds || 0), 0) / total
    : null;

  // ROI kleur
  const roiColor = roi === null ? 'var(--sub)' : roi >= 10 ? '#15803d' : roi >= 0 ? '#2563eb' : '#dc2626';
  const roiVal   = roi === null ? '—' : `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`;

  document.getElementById('kpi-roi-val').textContent = roiVal;
  document.getElementById('kpi-roi-val').style.color = roiColor;
  document.getElementById('kpi-roi-sub').textContent = `${total} picks gesetteld`;

  document.getElementById('kpi-hitrate').textContent = hitrate !== null ? `${hitrate.toFixed(0)}%` : '—';
  document.getElementById('kpi-hitrate').style.color = hitrate === null ? 'var(--sub)' : hitrate >= 50 ? '#15803d' : hitrate >= 35 ? '#2563eb' : '#dc2626';

  document.getElementById('kpi-odds').textContent = avgOdds !== null ? avgOdds.toFixed(2) : '—';

  // CLV van Supabase
  const clv = supabase?.clv;
  if (clv?.avgCLV !== null && clv?.avgCLV !== undefined) {
    const clvColor = clv.avgCLV >= 2 ? '#15803d' : clv.avgCLV >= 0 ? '#2563eb' : '#dc2626';
    document.getElementById('kpi-clv-val').textContent = `${clv.avgCLV >= 0 ? '+' : ''}${clv.avgCLV}%`;
    document.getElementById('kpi-clv-val').style.color = clvColor;
    document.getElementById('kpi-clv-sub').textContent = `${clv.total} picks met CLV`;
    document.getElementById('kpi-clv-pos').textContent = clv.positiveCLVPct !== null ? `${clv.positiveCLVPct}%` : '—';
    document.getElementById('kpi-clv-pos').style.color = clv.positiveCLVPct >= 55 ? '#15803d' : 'var(--sub)';

    // Banner
    if (clv.avgCLV >= 1) {
      document.getElementById('clv-banner').style.display = 'block';
      document.getElementById('clv-banner-text').textContent =
        `Gemiddeld ${clv.avgCLV}% betere odds dan sluiting over ${clv.total} picks. ${clv.positiveCLVPct}% heeft positieve CLV. Dit wijst op structurele edge.`;
    } else if (clv.avgCLV < 0) {
      document.getElementById('clv-warn-banner').style.display = 'block';
    }
  } else {
    document.getElementById('kpi-clv-val').textContent = '—';
    document.getElementById('kpi-clv-sub').textContent = 'nog geen CLV data';
    document.getElementById('kpi-clv-pos').textContent = '—';
  }

  // ── ROI per confidence tier ──────────────────────────────
  const confTiers = { '1-4': [], '5-6': [], '7-8': [], '9-10': [] };
  settled.forEach(p => {
    const c = p.confidence || 0;
    if (c <= 4) confTiers['1-4'].push(p);
    else if (c <= 6) confTiers['5-6'].push(p);
    else if (c <= 8) confTiers['7-8'].push(p);
    else confTiers['9-10'].push(p);
  });

  const confEl = document.getElementById('conf-tiers');
  const confEmpty = document.getElementById('conf-empty');
  const confRows = Object.entries(confTiers)
    .filter(([, arr]) => arr.length > 0)
    .map(([tier, arr]) => {
      const r = arr.reduce((s, p) => s + (p.status === 'win' ? (p.odds - 1) * 100 : -100), 0) / arr.length;
      const w = arr.filter(p => p.status === 'win').length;
      return { tier, roi: r, total: arr.length, wins: w };
    });

  if (confRows.length === 0) {
    confEmpty.style.display = 'block';
  } else {
    confEl.innerHTML = confRows.map(r => roiRow(`Conf ${r.tier}/10`, r.roi, r.total, r.wins)).join('');
  }

  // ── ROI per odds range ───────────────────────────────────
  const oddsRanges = { '1.0–1.5': [], '1.5–2.0': [], '2.0–2.5': [], '2.5–3.5': [], '3.5+': [] };
  settled.forEach(p => {
    const o = p.odds || 0;
    if (o < 1.5) oddsRanges['1.0–1.5'].push(p);
    else if (o < 2.0) oddsRanges['1.5–2.0'].push(p);
    else if (o < 2.5) oddsRanges['2.0–2.5'].push(p);
    else if (o < 3.5) oddsRanges['2.5–3.5'].push(p);
    else oddsRanges['3.5+'].push(p);
  });

  document.getElementById('odds-ranges').innerHTML = Object.entries(oddsRanges)
    .filter(([, arr]) => arr.length > 0)
    .map(([range, arr]) => {
      const r = arr.reduce((s, p) => s + (p.status === 'win' ? (p.odds - 1) * 100 : -100), 0) / arr.length;
      const w = arr.filter(p => p.status === 'win').length;
      return roiRow(`@ ${range}`, r, arr.length, w);
    }).join('') || `<div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);">Nog geen data</div>`;

  // ── ROI per league ───────────────────────────────────────
  const leagueMap = {};
  settled.forEach(p => {
    const key = p.leagueName || p.leagueId || 'Onbekend';
    if (!leagueMap[key]) leagueMap[key] = [];
    leagueMap[key].push(p);
  });

  const leagueEl = document.getElementById('league-rows');
  const leagueEmpty = document.getElementById('league-empty');
  const leagueRows = Object.entries(leagueMap)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, arr]) => {
      const r = arr.reduce((s, p) => s + (p.status === 'win' ? (p.odds - 1) * 100 : -100), 0) / arr.length;
      const w = arr.filter(p => p.status === 'win').length;
      return roiRow(name, r, arr.length, w);
    });

  if (leagueRows.length === 0) {
    leagueEmpty.style.display = 'block';
  } else {
    leagueEl.innerHTML = leagueRows.join('');
  }

  // ── Sharp money ──────────────────────────────────────────
  const sharpEl = document.getElementById('sharp-rows');
  const sharpEmpty = document.getElementById('sharp-empty');
  const steamData = supabase?.sharpMoney?.topSteam || [];

  if (!steamData.length) {
    sharpEmpty.style.display = 'block';
  } else {
    sharpEl.innerHTML = steamData.map(s => `
      <div style="display:flex;justify-content:space-between;align-items:center;
        padding:.4rem .5rem;background:rgba(220,38,38,.05);border-radius:8px;border:1px solid rgba(220,38,38,.1);">
        <div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;font-weight:700;color:#dc2626;">
            🔥 fixture ${s.fixtureId} · ${s.pick}
          </div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.4rem;color:var(--sub);margin-top:.1rem;">
            ${new Date(s.detectedAt).toLocaleDateString('nl-NL')}
          </div>
        </div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:#dc2626;">
          ${s.movement > 0 ? '+' : ''}${s.movement}%
        </div>
      </div>`).join('');
    document.getElementById('sharp-rows').previousElementSibling &&
      (document.getElementById('sharp-rows').previousElementSibling.innerHTML =
        `<div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;font-weight:700;color:var(--sub);margin-bottom:.6rem;">🔥 SHARP MONEY — ${supabase.sharpMoney.steamMovements7d} steam(s) afgelopen 7d</div>`);
  }

  // ── Laatste 30 dagen ─────────────────────────────────────
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recent = settled
    .filter(p => p.verifiedAt && new Date(p.verifiedAt) >= cutoff)
    .sort((a, b) => new Date(b.verifiedAt) - new Date(a.verifiedAt))
    .slice(0, 10);

  const recentEl = document.getElementById('recent-rows');
  const recentEmpty = document.getElementById('recent-empty');

  if (!recent.length) {
    recentEmpty.style.display = 'block';
  } else {
    const recentRoi = recent.reduce((s, p) => s + (p.status === 'win' ? (p.odds - 1) * 100 : -100), 0) / recent.length;
    recentEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:.4rem;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);">ROI laatste ${recent.length} picks</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:${recentRoi >= 0 ? '#15803d' : '#dc2626'};">
          ${recentRoi >= 0 ? '+' : ''}${recentRoi.toFixed(1)}%
        </div>
      </div>
      ${recent.map(p => `
        <div style="display:flex;justify-content:space-between;align-items:center;
          padding:.3rem 0;border-bottom:1px solid var(--stroke);">
          <div>
            <div style="font-family:'DM Sans',sans-serif;font-size:.65rem;font-weight:600;color:var(--ink);">
              ${p.matchName || '?'}
            </div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.4rem;color:var(--sub);">
              ${p.pickLabel || p.pick} · @ ${parseFloat(p.odds||0).toFixed(2)} · conf ${p.confidence||'?'}/10
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;font-weight:800;
              color:${p.status==='win'?'#15803d':'#dc2626'};">
              ${p.status === 'win' ? '✅ WIN' : '❌ LOSE'}
            </div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);">
              ${p.verifiedAt ? new Date(p.verifiedAt).toLocaleDateString('nl-NL') : ''}
            </div>
          </div>
        </div>`).join('')}`;
  }

  // ── Meta footer ──────────────────────────────────────────
  document.getElementById('analytics-meta').textContent =
    `Bijgewerkt: ${new Date().toLocaleTimeString('nl-NL')} · ${total} picks gesetteld · v${APP_VERSION}`;

  // Toon content
  document.getElementById('analytics-loading').style.display = 'none';
  document.getElementById('analytics-content').style.display = 'block';
}

// ── Helper: ROI rij renderen ─────────────────────────────
function roiRow(label, roi, total, wins) {
  const roiColor = roi >= 10 ? '#15803d' : roi >= 0 ? '#2563eb' : '#dc2626';
  const barWidth = Math.min(100, Math.abs(roi) * 2);
  const barColor = roi >= 0 ? 'rgba(21,128,61,.3)' : 'rgba(220,38,38,.3)';
  const hitrate  = total > 0 ? Math.round(wins / total * 100) : 0;
  return `
    <div style="padding:.3rem 0;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.2rem;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--ink);">${label}</div>
        <div style="display:flex;align-items:center;gap:.4rem;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.4rem;color:var(--sub);">${wins}/${total} · ${hitrate}%</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:.9rem;color:${roiColor};">
            ${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%
          </div>
        </div>
      </div>
      <div style="height:3px;background:var(--stroke);border-radius:2px;overflow:hidden;">
        <div style="height:100%;width:${barWidth}%;background:${barColor};border-radius:2px;transition:width .4s;"></div>
      </div>
    </div>`;
}
