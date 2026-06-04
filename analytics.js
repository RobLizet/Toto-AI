// ═══════════════════════════════════════════════════════
// ANALYTICS.JS — Stats & Analytics scherm v1.0
// Toont CLV, sharp money, league breakdown, ROI trend
// Data: /analytics endpoint (Supabase) + lokale scanLog
// ═══════════════════════════════════════════════════════

const ANALYTICS_WORKER = 'https://api.edgexi.app';

// ── Hoofd render functie ─────────────────────────────
async function renderAnalyticsScreen() {
  const screen = document.getElementById('screen-analytics');
  if (!screen) return;

  // Toon laadstatus
  screen.innerHTML = _analyticsLoadingHTML();

  // Lokale data berekenen
  const local = _calcLocalStats();

  // Worker data ophalen
  let workerData = null;
  try {
    const r = await fetch(ANALYTICS_WORKER + '/analytics');
    if (r.ok) workerData = await r.json();
  } catch(e) {
    console.warn('[Analytics] Worker niet bereikbaar:', e.message);
  }

  screen.innerHTML = _analyticsHTML(local, workerData);
}

// ── Lokale statistieken berekenen uit scanLog ────────
function _calcLocalStats() {
  const scanLog = state.scanLog || [];
  const allPicks = scanLog.flatMap(s => s.picks || []);
  const DREMPEL = { minValue: 8, minConf: 6 };

  const kwali = allPicks.filter(p =>
    !p.isSparseData &&
    (p.value||0) >= DREMPEL.minValue &&
    (p.confidence||0) >= DREMPEL.minConf
  );
  const settled = kwali.filter(p => p.status === 'win' || p.status === 'lose');
  const wins = settled.filter(p => p.status === 'win');

  // ROI trend per 10 picks
  const roiTrend = [];
  let runningROI = 0;
  settled.forEach((p, i) => {
    runningROI += p.status === 'win' ? (p.odds - 1) * 100 : -100;
    if ((i + 1) % 5 === 0 || i === settled.length - 1) {
      roiTrend.push({ n: i + 1, roi: parseFloat((runningROI / (i + 1)).toFixed(1)) });
    }
  });

  // Per pick type (1/X/2)
  const byPick = { '1': { w:0, t:0 }, 'X': { w:0, t:0 }, '2': { w:0, t:0 } };
  settled.forEach(p => {
    const key = p.pick || '1';
    if (byPick[key]) { byPick[key].t++; if (p.status==='win') byPick[key].w++; }
  });

  // Per league
  const byLeague = {};
  settled.forEach(p => {
    const lid = String(p.leagueId || 'Onbekend');
    const name = p.leagueName || p.comp || ('League ' + lid);
    if (!byLeague[lid]) byLeague[lid] = { name, wins: 0, total: 0, roi: 0 };
    byLeague[lid].total++;
    if (p.status === 'win') {
      byLeague[lid].wins++;
      byLeague[lid].roi += (p.odds - 1) * 100;
    } else {
      byLeague[lid].roi -= 100;
    }
  });

  // Per odds bucket
  const byBucket = {};
  const bucketLabel = (o) => {
    if (o < 1.5) return '1.0–1.5';
    if (o < 2.0) return '1.5–2.0';
    if (o < 2.5) return '2.0–2.5';
    if (o < 3.0) return '2.5–3.0';
    if (o < 4.0) return '3.0–4.0';
    return '4.0+';
  };
  settled.forEach(p => {
    const b = bucketLabel(p.odds || 2);
    if (!byBucket[b]) byBucket[b] = { wins: 0, total: 0 };
    byBucket[b].total++;
    if (p.status === 'win') byBucket[b].wins++;
  });

  // Confidence correlatie
  const confBuckets = { 'laag (1–4)': {w:0,t:0}, 'midden (5–7)': {w:0,t:0}, 'hoog (8–10)': {w:0,t:0} };
  settled.forEach(p => {
    const c = p.confidence || 5;
    const key = c <= 4 ? 'laag (1–4)' : c <= 7 ? 'midden (5–7)' : 'hoog (8–10)';
    confBuckets[key].t++;
    if (p.status === 'win') confBuckets[key].w++;
  });

  return {
    total: kwali.length,
    settled: settled.length,
    wins: wins.length,
    hitrate: settled.length ? Math.round(wins.length / settled.length * 100) : null,
    roi: settled.length
      ? parseFloat((settled.reduce((s,p) => s + (p.status==='win'?(p.odds-1):-1), 0) / settled.length * 100).toFixed(1))
      : null,
    avgOdds: settled.length
      ? parseFloat((settled.reduce((s,p) => s + (p.odds||0), 0) / settled.length).toFixed(2))
      : null,
    avgValue: settled.length
      ? parseFloat((settled.reduce((s,p) => s + (p.value||0), 0) / settled.length).toFixed(1))
      : null,
    roiTrend,
    byPick,
    byLeague: Object.entries(byLeague)
      .sort((a,b) => b[1].total - a[1].total)
      .slice(0, 8),
    byBucket: Object.entries(byBucket)
      .sort((a,b) => {
        const order = ['1.0–1.5','1.5–2.0','2.0–2.5','2.5–3.0','3.0–4.0','4.0+'];
        return order.indexOf(a[0]) - order.indexOf(b[0]);
      }),
    confBuckets: Object.entries(confBuckets),
    scansTotal: scanLog.length,
    openPicks: kwali.filter(p => !p.status || p.status === 'pending').length,
  };
}

// ── Loading HTML ──────────────────────────────────────
function _analyticsLoadingHTML() {
  return '<div style="padding:2rem;text-align:center;">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.6rem;color:rgba(255,255,255,.5);">📊 Analytics laden...</div>' +
    '</div>';
}

// ── Hoofd HTML builder ────────────────────────────────
function _analyticsHTML(local, worker) {
  let html = '';

  // ── Header ──
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;">';
  html += '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.3rem;color:#ffffff;">📊 STATS & ANALYTICS</div>';
  html += '<button onclick="renderAnalyticsScreen()" style="background:none;border:1px solid rgba(255,255,255,0.09);border-radius:8px;padding:.3rem .6rem;font-size:.7rem;color:rgba(255,255,255,.5);cursor:pointer;">↻ Vernieuwen</button>';
  html += '</div>';

  // ── KPI row ──
  html += '<div class="analytics-block">';
  html += '<div class="analytics-block-title">OVERZICHT</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.5rem;">';
  html += _kpi('PICKS TOTAAL', local.total + '/100', '#00BEC4');
  html += _kpi('SETTLED', local.settled, '#00a8ad');
  html += _kpi('HITRATE', local.hitrate !== null ? local.hitrate + '%' : '—', local.hitrate !== null && local.hitrate >= 50 ? '#00BEC4' : '#dc2626');
  html += _kpi('ROI', local.roi !== null ? (local.roi >= 0 ? '+' : '') + local.roi + '%' : '—', local.roi !== null && local.roi >= 0 ? '#00BEC4' : '#dc2626');
  html += '</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.4rem;">';
  html += _kpiSmall('GEM. ODDS', local.avgOdds || '—');
  html += _kpiSmall('GEM. VALUE', local.avgValue ? local.avgValue + '%' : '—');
  html += _kpiSmall('OPEN', local.openPicks);
  html += '</div>';

  // Voortgangsbalk
  html += '<div style="margin-top:.65rem;">';
  html += '<div style="display:flex;justify-content:space-between;margin-bottom:.25rem;">';
  html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:rgba(255,255,255,.5);">VOORTGANG NAAR 100 PICKS</div>';
  html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:rgba(255,255,255,.5);">' + local.total + '/100</div>';
  html += '</div>';
  html += '<div style="background:#0f2230;border-radius:999px;height:6px;overflow:hidden;">';
  html += '<div style="background:linear-gradient(90deg,#00BEC4,#00a8ad);height:100%;border-radius:999px;width:' + Math.min(100, local.total) + '%;transition:width .4s;"></div>';
  html += '</div></div></div>';

  // ── ROI Trend ──
  if (local.roiTrend.length >= 2) {
    html += '<div class="analytics-block">';
    html += '<div class="analytics-block-title">ROI TREND</div>';
    html += _roiTrendChart(local.roiTrend);
    html += '</div>';
  }

  // ── Per pick type ──
  if (local.settled > 0) {
    html += '<div class="analytics-block">';
    html += '<div class="analytics-block-title">UITSLAG TYPE</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;">';
    ['1','X','2'].forEach(pick => {
      const d = local.byPick[pick];
      const hr = d.t > 0 ? Math.round(d.w / d.t * 100) : null;
      html += '<div class="analytics-stat-card">';
      html += '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.4rem;color:#ffffff;">' + pick + '</div>';
      html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.7rem;font-weight:800;color:' + (hr!==null&&hr>=50?'#00BEC4':'#dc2626') + ';">' + (hr !== null ? hr + '%' : '—') + '</div>';
      html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:rgba(255,255,255,.5);">' + d.w + '/' + d.t + ' wins</div>';
      html += '</div>';
    });
    html += '</div></div>';
  }

  // ── Per odds bucket ──
  if (local.byBucket.length > 0) {
    html += '<div class="analytics-block">';
    html += '<div class="analytics-block-title">HITRATE PER ODDS</div>';
    local.byBucket.forEach(([bucket, d]) => {
      const hr = d.total > 0 ? Math.round(d.wins / d.total * 100) : 0;
      const barW = Math.min(100, hr);
      html += '<div style="margin-bottom:.5rem;">';
      html += '<div style="display:flex;justify-content:space-between;margin-bottom:.2rem;">';
      html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.48rem;color:#ffffff;">' + bucket + '</div>';
      html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.48rem;color:rgba(255,255,255,.5);">' + hr + '% (' + d.wins + '/' + d.total + ')</div>';
      html += '</div>';
      html += '<div style="background:#0f2230;border-radius:999px;height:5px;overflow:hidden;">';
      html += '<div style="background:' + (hr >= 50 ? '#00BEC4' : hr >= 35 ? '#d97706' : '#dc2626') + ';height:100%;border-radius:999px;width:' + barW + '%;transition:width .4s;"></div>';
      html += '</div></div>';
    });
    html += '</div>';
  }

  // ── Confidence correlatie ──
  if (local.settled >= 5) {
    html += '<div class="analytics-block">';
    html += '<div class="analytics-block-title">CONFIDENCE vs RESULTAAT</div>';
    local.confBuckets.forEach(([label, d]) => {
      const hr = d.t > 0 ? Math.round(d.w / d.t * 100) : 0;
      html += '<div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.5rem;">';
      html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:rgba(255,255,255,.5);min-width:80px;">' + label + '</div>';
      html += '<div style="flex:1;background:#0f2230;border-radius:999px;height:8px;overflow:hidden;">';
      html += '<div style="background:' + (hr >= 50 ? '#00BEC4' : hr >= 35 ? '#d97706' : '#dc2626') + ';height:100%;border-radius:999px;width:' + hr + '%;transition:width .4s;"></div>';
      html += '</div>';
      html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.48rem;font-weight:800;color:#ffffff;min-width:36px;text-align:right;">' + hr + '%</div>';
      html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:rgba(255,255,255,.5);min-width:32px;">' + d.w + '/' + d.t + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  // ── Per league ──
  if (local.byLeague.length > 0) {
    html += '<div class="analytics-block">';
    html += '<div class="analytics-block-title">PER COMPETITIE</div>';
    local.byLeague.forEach(([lid, d]) => {
      const hr = d.total > 0 ? Math.round(d.wins / d.total * 100) : 0;
      const roi = parseFloat((d.roi / d.total).toFixed(1));
      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:.4rem 0;border-bottom:1px solid rgba(255,255,255,0.09);">';
      html += '<div style="flex:1;">';
      html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:700;color:#ffffff;">' + d.name + '</div>';
      html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:rgba(255,255,255,.5);">' + d.total + ' picks · ' + d.wins + ' wins</div>';
      html += '</div>';
      html += '<div style="text-align:right;">';
      html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.56rem;font-weight:800;color:' + (hr>=50?'#00BEC4':'#dc2626') + ';">' + hr + '%</div>';
      html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:' + (roi>=0?'#00BEC4':'#dc2626') + ';">' + (roi>=0?'+':'') + roi + '% ROI</div>';
      html += '</div></div>';
    });
    html += '</div>';
  }

  // ── Supabase CLV data ──
  if (worker && worker.clv) {
    const clv = worker.clv;
    html += '<div class="analytics-block">';
    html += '<div class="analytics-block-title">CLV — CLOSING LINE VALUE <span style="font-size:.42rem;font-weight:400;color:rgba(255,255,255,.5);">via Supabase</span></div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;">';
    html += _kpiSmall('TOTAAL', clv.total || 0);
    html += _kpiSmall('GEM. CLV', clv.avgCLV !== null ? (clv.avgCLV >= 0 ? '+' : '') + clv.avgCLV + '%' : '—');
    html += _kpiSmall('POSITIEF', clv.positiveCLVPct !== null ? clv.positiveCLVPct + '%' : '—');
    html += '</div>';
    if (clv.total === 0) {
      html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.48rem;color:rgba(255,255,255,.5);margin-top:.5rem;text-align:center;">CLV data verschijnt na settlements via Worker v98+</div>';
    }
    html += '</div>';
  }

  // ── Sharp Money ──
  if (worker && worker.sharpMoney) {
    const sm = worker.sharpMoney;
    html += '<div class="analytics-block">';
    html += '<div class="analytics-block-title">SHARP MONEY <span style="font-size:.42rem;font-weight:400;color:rgba(255,255,255,.5);">laatste 7 dagen</span></div>';
    if (sm.steamMovements7d === 0) {
      html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.48rem;color:rgba(255,255,255,.5);text-align:center;padding:.5rem 0;">Geen steam movements gedetecteerd</div>';
    } else {
      html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.52rem;font-weight:800;color:#d97706;margin-bottom:.5rem;">🔥 ' + sm.steamMovements7d + ' steam movements</div>';
      if (sm.topSteam && sm.topSteam.length) {
        sm.topSteam.forEach(s => {
          html += '<div style="display:flex;justify-content:space-between;padding:.35rem 0;border-bottom:1px solid rgba(255,255,255,0.09);">';
          html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:#ffffff;">Fixture ' + s.fixtureId + ' · Pick ' + s.pick + '</div>';
          html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;font-weight:800;color:#d97706;">' + s.movement + '%</div>';
          html += '</div>';
        });
      }
    }
    html += '</div>';
  }

  // ── Lege state ──
  if (local.settled === 0 && !worker) {
    html += '<div style="text-align:center;padding:2rem;opacity:.5;">';
    html += '<div style="font-size:2rem;margin-bottom:.5rem;">📊</div>';
    html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.54rem;color:rgba(255,255,255,.5);">Nog geen settled picks — scan wedstrijden om data op te bouwen.</div>';
    html += '</div>';
  }

  // ── Footer ──
  html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:rgba(255,255,255,.5);text-align:center;padding:.75rem;margin-top:.25rem;">';
  html += 'Lokale data · ' + local.scansTotal + ' scans · Worker v98 Supabase';
  html += '</div>';

  return html;
}

// ── ROI trend mini-chart (SVG) ────────────────────────
function _roiTrendChart(trend) {
  if (trend.length < 2) return '';
  const W = 300, H = 70, PAD = 8;
  const rois = trend.map(t => t.roi);
  const min = Math.min(...rois, -5);
  const max = Math.max(...rois, 5);
  const range = max - min || 1;
  const x = (i) => PAD + (i / (trend.length - 1)) * (W - PAD * 2);
  const y = (v) => H - PAD - ((v - min) / range) * (H - PAD * 2);
  const zeroY = y(0);

  let path = trend.map((t, i) => (i === 0 ? 'M' : 'L') + x(i).toFixed(1) + ',' + y(t.roi).toFixed(1)).join(' ');
  const lastROI = rois[rois.length - 1];
  const lineColor = lastROI >= 0 ? '#00BEC4' : '#dc2626';

  let svg = '<svg width="100%" viewBox="0 0 ' + W + ' ' + H + '" style="display:block;margin:.4rem 0;">';
  // Zero lijn
  svg += '<line x1="' + PAD + '" y1="' + zeroY.toFixed(1) + '" x2="' + (W-PAD) + '" y2="' + zeroY.toFixed(1) + '" stroke="rgba(255,255,255,.15)" stroke-width="1" stroke-dasharray="3,3"/>';
  // ROI lijn
  svg += '<path d="' + path + '" fill="none" stroke="' + lineColor + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
  // Labels
  svg += '<text x="' + PAD + '" y="' + (H - 1) + '" font-family="IBM Plex Mono" font-size="8" fill="rgba(255,255,255,.4)">n=1</text>';
  svg += '<text x="' + (W - PAD) + '" y="' + (H - 1) + '" font-family="IBM Plex Mono" font-size="8" fill="rgba(255,255,255,.4)" text-anchor="end">n=' + trend[trend.length-1].n + '</text>';
  svg += '<text x="' + x(trend.length-1) + '" y="' + Math.max(10, y(lastROI) - 4) + '" font-family="IBM Plex Mono" font-size="9" font-weight="bold" fill="' + lineColor + '" text-anchor="middle">' + (lastROI>=0?'+':'') + lastROI + '%</text>';
  svg += '</svg>';
  return svg;
}

// ── Helpers ───────────────────────────────────────────
function _kpi(label, value, color) {
  return '<div style="background:#0f2230;border-radius:10px;padding:.5rem .6rem;">' +
    '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.3rem;color:' + color + ';line-height:1.1;">' + value + '</div>' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.4rem;color:rgba(255,255,255,.5);margin-top:1px;">' + label + '</div>' +
    '</div>';
}

function _kpiSmall(label, value) {
  return '<div style="background:#0f2230;border-radius:8px;padding:.4rem .5rem;text-align:center;">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.62rem;font-weight:800;color:#ffffff;">' + value + '</div>' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.38rem;color:rgba(255,255,255,.5);margin-top:1px;">' + label + '</div>' +
    '</div>';
}
