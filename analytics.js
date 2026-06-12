// ═══════════════════════════════════════════════════════
// ANALYTICS.JS — Stats & Analytics scherm v1.0
// Toont CLV, sharp money, league breakdown, ROI trend
// Data: /analytics endpoint (Supabase) + lokale scanLog
// ═══════════════════════════════════════════════════════

const ANALYTICS_WORKER = 'https://api.promatchxi.app';

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
  html += '<div style="background:var(--track-bg,rgba(255,255,255,.1));border-radius:999px;height:6px;overflow:hidden;">';
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
      html += '<div style="background:var(--track-bg,rgba(255,255,255,.1));border-radius:999px;height:5px;overflow:hidden;">';
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
      html += '<div style="flex:1;background:var(--track-bg,rgba(255,255,255,.1));border-radius:999px;height:8px;overflow:hidden;">';
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

  // ── Supabase CLV data (v123: v_clv_summary) ──
  const cs = worker && worker.clvSummary;
  const csPicks = cs ? Number(cs.picks) : 0;
  if (cs && csPicks > 0) {
    const avgN = (cs.avgCLV === null || cs.avgCLV === '') ? null : Number(cs.avgCLV);
    const avgTxt = avgN === null ? '—' : (avgN >= 0 ? '+' : '') + cs.avgCLV + '%';
    const avgCol = avgN === null ? '#ffffff' : (avgN >= 0 ? '#00BEC4' : '#ef4444');
    html += '<div class="analytics-block">';
    html += '<div class="analytics-block-title">CLV — CLOSING LINE VALUE <span style="font-size:.46rem;font-weight:400;color:rgba(255,255,255,.5);">via Supabase</span></div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.5rem;">';
    html += '<div style="background:rgba(0,190,196,.07);border:1px solid rgba(0,190,196,.22);border-radius:10px;padding:.6rem;text-align:center;"><div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:rgba(255,255,255,.5);">GEM. CLV</div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:1.05rem;font-weight:800;color:' + avgCol + ';">' + avgTxt + '</div></div>';
    html += '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:10px;padding:.6rem;text-align:center;"><div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:rgba(255,255,255,.5);">VERSLAAT CLOSE</div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:1.05rem;font-weight:800;color:#ffffff;">' + (cs.pctBeatClose == null ? '—' : cs.pctBeatClose + '%') + '</div></div>';
    html += '</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;">';
    html += _kpiSmall('PICKS', cs.picks);
    html += _kpiSmall('WIN-RATE', cs.winRate == null ? '—' : cs.winRate + '%');
    html += _kpiSmall('BESTE', cs.bestCLV == null ? '—' : '+' + cs.bestCLV + '%');
    html += '</div>';
    if (worker.clvByLeague && worker.clvByLeague.length) {
      html += '<div style="margin-top:.6rem;">';
      worker.clvByLeague.slice(0,4).forEach(l => {
        const lc = Number(l.avgCLV) >= 0 ? '#00BEC4' : '#ef4444';
        html += '<div style="display:flex;justify-content:space-between;padding:.3rem 0;border-bottom:1px solid rgba(255,255,255,0.07);"><div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:rgba(255,255,255,.7);">Competitie ' + l.leagueId + ' · ' + l.picks + ' picks</div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:800;color:' + lc + ';">' + (Number(l.avgCLV)>=0?'+':'') + l.avgCLV + '%</div></div>';
      });
      html += '</div>';
    }
    html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:rgba(255,255,255,.45);margin-top:.5rem;line-height:1.45;">CLV = je odds vs. de slotkoers. Structureel boven 0% = je verslaat de markt — de sterkste voorspeller van lange-termijn edge.</div>';
    html += '</div>';
  } else {
    html += '<div class="analytics-block">';
    html += '<div class="analytics-block-title">CLV — CLOSING LINE VALUE <span style="font-size:.46rem;font-weight:400;color:rgba(255,255,255,.5);">via Supabase</span></div>';
    html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:rgba(255,255,255,.5);text-align:center;padding:.6rem 0;line-height:1.45;">CLV verschijnt zodra picks settelen.<br>De engine bouwt nu oddshistorie op (worker v122+).</div>';
    html += '</div>';
  }

  // ── CLV Trend (v124: v_clv_trend) ──
  if (worker && worker.clvTrend && worker.clvTrend.length >= 2) {
    html += '<div class="analytics-block">';
    html += '<div class="analytics-block-title">CLV TREND <span style="font-size:.46rem;font-weight:400;color:rgba(255,255,255,.5);">cumulatief gemiddelde</span></div>';
    html += _clvTrendChart(worker.clvTrend);
    html += '</div>';
  }

  // ── ROI per periode + markt (v124: v_clv_recent + v_clv_per_market) ──
  if (worker && ((worker.clvRecent && worker.clvRecent.length) || (worker.clvPerMarket && worker.clvPerMarket.length))) {
    html += _roiBlocks(worker.clvRecent || [], worker.clvPerMarket || []);
  }

  // ── Competitie-rating (v124: v_league_rating) ──
  if (worker && worker.leagueRating && worker.leagueRating.length) {
    html += _leagueRatingBlock(worker.leagueRating);
  }

  // ── Sharp Money ── v135: klikbaar met popup
  if (worker && worker.sharpMoney) {
    const sm = worker.sharpMoney;
    // Combineer steam movements + sharp scores voor volledige weergave
    const sharpItems = [];
    // Voeg topSharpScores toe als primaire bron (heeft teamnamen + alle data)
    if (sm.topSharpScores && sm.topSharpScores.length) {
      sm.topSharpScores.forEach(s => sharpItems.push({ ...s, _type: 'score' }));
    }
    // Voeg steam movements toe die nog niet in sharpItems zitten
    if (sm.topSteam && sm.topSteam.length) {
      sm.topSteam.forEach(s => {
        const exists = sharpItems.find(x => x.fixtureId == s.fixtureId && x.pick === s.pick);
        if (!exists) sharpItems.push({ ...s, _type: 'steam' });
      });
    }

    html += '<div class="analytics-block">';
    html += '<div class="analytics-block-title">SHARP MONEY <span style="font-size:.42rem;font-weight:400;color:rgba(255,255,255,.5);">laatste 7 dagen</span></div>';

    if (sm.steamMovements7d === 0 && !sharpItems.length) {
      html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.48rem;color:rgba(255,255,255,.5);text-align:center;padding:.5rem 0;">Geen steam movements gedetecteerd</div>';
    } else {
      if (sm.steamMovements7d > 0) {
        html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.52rem;font-weight:800;color:#d97706;margin-bottom:.5rem;">🔥 ' + sm.steamMovements7d + ' steam movements</div>';
      }
      sharpItems.forEach(s => {
        // Label voor pick kolom
        const pickLabel = s.pick === '1' ? 'Thuis wint' : s.pick === 'X' ? 'Gelijkspel' : 'Uit wint';
        // Team naam of fixture ID
        const matchLabel = (s.home && s.away) ? (s.home + ' vs ' + s.away) : ('Fixture ' + s.fixtureId);
        // Kleur + badge op basis van tier of beweging
        const tier = s.sharpTier || (s.isSteam ? 'moderate' : null);
        const tierColors = { elite: '#f59e0b', strong: '#00BEC4', moderate: '#7c3aed', weak: '#64748b' };
        const tierIcons  = { elite: '⚡', strong: '📡', moderate: '👁', weak: '〰' };
        const tierColor  = tierColors[tier] || '#d97706';
        const tierIcon   = tierIcons[tier]  || '🔥';
        // Beweging badge
        const movPct = s.movementPct || s.movement || null;
        const movBadge = (movPct !== null && Math.abs(movPct) >= 4)
          ? '<span style="font-size:.38rem;color:#dc2626;background:rgba(220,38,38,.1);border:1px solid rgba(220,38,38,.2);border-radius:4px;padding:.05rem .25rem;margin-left:.3rem;">🔴 ' + parseFloat(movPct).toFixed(1) + '%</span>'
          : '';
        // Sharp score badge
        const scoreBadge = s.sharpScore
          ? '<span style="font-size:.38rem;color:' + tierColor + ';background:' + tierColor + '18;border:1px solid ' + tierColor + '33;border-radius:4px;padding:.05rem .25rem;margin-left:.25rem;">' + tierIcon + ' ' + Math.round(s.sharpScore) + '/100</span>'
          : '';

        // Sla data op in window voor popup
        const dataId = 'sharp_' + s.fixtureId + '_' + s.pick;
        window.__sharpData = window.__sharpData || {};
        window.__sharpData[dataId] = s;

        html += '<div onclick="showSharpPopup(\'' + dataId + '\')" style="display:flex;justify-content:space-between;align-items:center;padding:.45rem .5rem;border-bottom:1px solid rgba(255,255,255,.07);cursor:pointer;border-radius:8px;transition:background .15s;">';
        html += '<div style="flex:1;min-width:0;">';
        html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + matchLabel + '</div>';
        // v135b: datum + competitie tonen onder teamnamen
        const metaLine = [
          s.matchDate ? s.matchDate : (s.detectedAt ? s.detectedAt.split('T')[0] : null),
          s.leagueName || null,
        ].filter(Boolean).join(' · ');
        if (metaLine) html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.4rem;color:rgba(255,255,255,.35);margin-top:.08rem;">' + metaLine + '</div>';
        html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:rgba(255,255,255,.5);margin-top:.1rem;">' + pickLabel + movBadge + scoreBadge + '</div>';
        html += '</div>';
        html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:rgba(255,255,255,.4);margin-left:.5rem;">→</div>';
        html += '</div>';
      });
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

  // ── Pick Tier Performance Dashboard ─────────────────
  if (worker?.pickTierPerformance?.length) {
    html += '<div class="analytics-block">';
    html += '<div class="analytics-block-title">PICK TIER PERFORMANCE</div>';
    const tierOrder = ['elite','triple','double','single'];
    const tierLabels = { elite:'⭐ Elite', triple:'🔒🔒🔒 Triple', double:'🔒🔒 Double', single:'🔒 Single' };
    const tierColors = { elite:'#f59e0b', triple:'#00BEC4', double:'#7c3aed', single:'#64748b' };
    worker.pickTierPerformance
      .sort((a,b) => (tierOrder.indexOf(a.tier)) - (tierOrder.indexOf(b.tier)))
      .forEach(t => {
        const color = tierColors[t.tier] || '#64748b';
        const label = tierLabels[t.tier] || t.tier;
        const roi = t.total > 0
          ? ((t.wins * (1/0.35) - t.total) / t.total * 100).toFixed(0) // schatting
          : null;
        html += '<div style="display:flex;align-items:center;gap:.4rem;padding:.35rem 0;border-bottom:1px solid rgba(255,255,255,.06);">';
        html += `<div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;font-weight:800;color:${color};min-width:90px;">${label}</div>`;
        html += '<div style="flex:1;">';
        html += `<div style="background:var(--track-bg,rgba(0,0,0,.08));border-radius:999px;height:5px;overflow:hidden;">`;
        html += `<div style="background:${color};height:100%;border-radius:999px;width:${Math.min(100,t.hitrate)}%;"></div></div>`;
        html += '</div>';
        html += `<div style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;font-weight:700;color:${color};min-width:36px;text-align:right;">${t.hitrate}%</div>`;
        html += `<div style="font-family:'IBM Plex Mono',monospace;font-size:.42rem;color:rgba(255,255,255,.4);min-width:50px;text-align:right;">${t.wins}W/${t.total-t.wins}L</div>`;
        html += '</div>';
        html += `<div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:rgba(255,255,255,.4);padding-bottom:.25rem;">`;
        html += `gem. value +${t.avgValue}pp · conf ${t.avgConf}/10${t.avgSharp ? ` · sharp ${t.avgSharp}/100` : ''}</div>`;
      });
    html += '</div>';
  }

  // ── League Tier Dashboard ─────────────────────────────
  if (worker?.leagueTiers?.length) {
    html += '<div class="analytics-block">';
    html += '<div class="analytics-block-title">LEAGUE RATINGS</div>';
    const tierBg = { elite:'rgba(245,158,11,.12)', goed:'rgba(0,190,196,.08)', neutraal:'rgba(255,255,255,.04)', risico:'rgba(220,38,38,.08)', onbekend:'rgba(255,255,255,.03)' };
    const tierBorder = { elite:'rgba(245,158,11,.4)', goed:'rgba(0,190,196,.3)', neutraal:'rgba(255,255,255,.1)', risico:'rgba(220,38,38,.3)', onbekend:'rgba(255,255,255,.08)' };
    const tierIcon = { elite:'⭐', goed:'✅', neutraal:'〰', risico:'⚠️', onbekend:'❓' };
    worker.leagueTiers.forEach(l => {
      const tier = l.tier || 'onbekend';
      html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem .5rem;margin-bottom:.3rem;background:${tierBg[tier]||tierBg.onbekend};border:1px solid ${tierBorder[tier]||tierBorder.onbekend};border-radius:8px;">`;
      html += '<div style="flex:1;min-width:0;">';
      html += `<div style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;font-weight:700;color:#fff;">${tierIcon[tier]||'❓'} ${l.leagueName}</div>`;
      html += `<div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:rgba(255,255,255,.4);margin-top:.05rem;">${l.total} picks · ${l.hitrate}% hitrate · factor ${l.factor}</div>`;
      html += '</div>';
      html += `<div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;font-weight:800;color:${l.hitrate>=45?'#00BEC4':l.hitrate>=35?'#d97706':'#dc2626'};">${l.roi > 0 ? '+' : ''}${l.roi}%</div>`;
      html += '</div>';
    });
    html += '</div>';
  }

  // ── Footer ──
  html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:rgba(255,255,255,.5);text-align:center;padding:.75rem;margin-top:.25rem;">';
  html += 'Lokale data · ' + local.scansTotal + ' scans · CLV-engine via Supabase';
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
  return '<div style="background:var(--card-bg,rgba(255,255,255,.07));border:1px solid var(--card-border,rgba(255,255,255,.09));border-radius:10px;padding:.5rem .6rem;">' +
    '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.3rem;color:' + color + ';line-height:1.1;">' + value + '</div>' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.4rem;color:var(--muted,rgba(255,255,255,.5));margin-top:1px;">' + label + '</div>' +
    '</div>';
}

function _kpiSmall(label, value) {
  return '<div style="background:var(--card-bg,rgba(255,255,255,.07));border:1px solid var(--card-border,rgba(255,255,255,.09));border-radius:8px;padding:.4rem .5rem;text-align:center;">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.62rem;font-weight:800;color:var(--text,#ffffff);">' + value + '</div>' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.38rem;color:var(--muted,rgba(255,255,255,.5));margin-top:1px;">' + label + '</div>' +
    '</div>';
}

// ── League namen (lokale map, fallback "Competitie {id}") ──
const _LEAGUE_NAMES = {
  39:'Premier League',140:'La Liga',78:'Bundesliga',135:'Serie A',61:'Ligue 1',
  88:'Eredivisie',94:'Jupiler Pro',2:'Champions League',3:'Europa League',
  848:'Conference League',40:'Championship',119:'Eredivisie playoffs',
  113:'Eliteserien',103:'Allsvenskan',
};
function _leagueLabel(id){ return _LEAGUE_NAMES[id] || ('Competitie ' + id); }

// ── CLV trend chart (SVG, cumulatief gemiddelde) ──────
function _clvTrendChart(trend) {
  const pts = trend.filter(t => t.cumAvgCLV !== null && t.cumAvgCLV !== undefined)
                   .map(t => Number(t.cumAvgCLV));
  if (pts.length < 2) return '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:rgba(255,255,255,.5);text-align:center;padding:.5rem 0;">Trend verschijnt vanaf 2 settled picks.</div>';
  const W = 300, H = 80, PAD = 10;
  const min = Math.min(...pts, -2);
  const max = Math.max(...pts, 2);
  const range = (max - min) || 1;
  const x = (i) => PAD + (i / (pts.length - 1)) * (W - PAD * 2);
  const y = (v) => H - PAD - ((v - min) / range) * (H - PAD * 2);
  const zeroY = y(0);
  const last = pts[pts.length - 1];
  const col = last >= 0 ? '#00BEC4' : '#ef4444';
  const path = pts.map((v,i) => (i===0?'M':'L') + x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ');
  let svg = '<svg width="100%" viewBox="0 0 ' + W + ' ' + H + '" style="display:block;margin:.4rem 0;">';
  svg += '<line x1="' + PAD + '" y1="' + zeroY.toFixed(1) + '" x2="' + (W-PAD) + '" y2="' + zeroY.toFixed(1) + '" stroke="rgba(255,255,255,.15)" stroke-width="1" stroke-dasharray="3,3"/>';
  svg += '<path d="' + path + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
  svg += '<circle cx="' + x(pts.length-1).toFixed(1) + '" cy="' + y(last).toFixed(1) + '" r="2.5" fill="' + col + '"/>';
  svg += '<text x="' + x(pts.length-1) + '" y="' + Math.max(10, y(last) - 5) + '" font-family="IBM Plex Mono" font-size="9" font-weight="bold" fill="' + col + '" text-anchor="end">' + (last>=0?'+':'') + last.toFixed(1) + '%</text>';
  svg += '<text x="' + PAD + '" y="' + (H - 2) + '" font-family="IBM Plex Mono" font-size="8" fill="rgba(255,255,255,.4)">n=1</text>';
  svg += '<text x="' + (W - PAD) + '" y="' + (H - 2) + '" font-family="IBM Plex Mono" font-size="8" fill="rgba(255,255,255,.4)" text-anchor="end">n=' + (trend[trend.length-1].n || pts.length) + '</text>';
  svg += '</svg>';
  return svg;
}

// ── ROI blokken (30d / 100 / per markt) ───────────────
function _roiBlocks(recent, market) {
  const fmtPct = (v) => (v === null || v === undefined || v === '') ? '—' : (Number(v)>=0?'+':'') + Number(v).toFixed(1) + '%';
  const col = (v) => (v === null || v === undefined || v === '') ? '#ffffff' : (Number(v)>=0?'#00BEC4':'#ef4444');
  let html = '<div class="analytics-block">';
  html += '<div class="analytics-block-title">ROI & RENDEMENT <span style="font-size:.46rem;font-weight:400;color:rgba(255,255,255,.5);">via Supabase</span></div>';
  if (recent.length) {
    html += '<div style="display:grid;grid-template-columns:repeat(' + Math.min(recent.length,2) + ',1fr);gap:.5rem;margin-bottom:.55rem;">';
    recent.forEach(r => {
      html += '<div style="background:rgba(0,190,196,.06);border:1px solid rgba(0,190,196,.2);border-radius:10px;padding:.55rem;text-align:center;">';
      html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:rgba(255,255,255,.5);text-transform:uppercase;">' + String(r.periode||'').replace(/_/g,' ') + '</div>';
      html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:1.05rem;font-weight:800;color:' + col(r.roiPct) + ';">' + fmtPct(r.roiPct) + '</div>';
      html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:rgba(255,255,255,.5);">' + (r.picks||0) + ' picks · CLV ' + fmtPct(r.avgCLV) + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }
  if (market.length) {
    html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:rgba(255,255,255,.5);margin:.2rem 0 .3rem;">PER MARKT</div>';
    market.forEach(m => {
      const hr = (m.hitrate==null)?null:Math.round(Number(m.hitrate));
      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:.35rem 0;border-bottom:1px solid rgba(255,255,255,0.07);">';
      html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:#ffffff;">' + m.markt + '</div>';
      html += '<div style="display:flex;gap:.7rem;align-items:center;">';
      html += '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:rgba(255,255,255,.5);">' + (m.picks||0) + 'p · ' + (hr==null?'—':hr+'%') + '</span>';
      html += '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:.56rem;font-weight:800;color:' + col(m.roiPct) + ';min-width:48px;text-align:right;">' + fmtPct(m.roiPct) + '</span>';
      html += '</div></div>';
    });
  }
  html += '</div>';
  return html;
}

// ── Competitie-rating (betrouwbaarheid 0-100) ─────────
function _leagueRatingBlock(ratings) {
  let html = '<div class="analytics-block">';
  html += '<div class="analytics-block-title">COMPETITIE-RATING <span style="font-size:.46rem;font-weight:400;color:rgba(255,255,255,.5);">betrouwbaarheid</span></div>';
  ratings.forEach(r => {
    const rel = (r.reliability==null)?0:Number(r.reliability);
    const relCol = rel >= 70 ? '#00BEC4' : rel >= 45 ? '#d97706' : '#ef4444';
    const roi = (r.roiPct==null||r.roiPct==='')?null:Number(r.roiPct);
    html += '<div style="margin-bottom:.55rem;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.2rem;">';
    html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:700;color:#ffffff;">' + _leagueLabel(r.leagueId) + '</div>';
    html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:' + relCol + ';font-weight:800;">' + (r.label || (rel + '/100')) + '</div>';
    html += '</div>';
    html += '<div style="background:var(--track-bg,rgba(255,255,255,.1));border-radius:999px;height:6px;overflow:hidden;margin-bottom:.2rem;">';
    html += '<div style="background:' + relCol + ';height:100%;border-radius:999px;width:' + Math.min(100,rel) + '%;transition:width .4s;"></div>';
    html += '</div>';
    html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:rgba(255,255,255,.5);">' + (r.picks||0) + ' picks · ' + (r.wins||0) + 'W-' + (r.losses||0) + 'L · ROI ' + (roi==null?'—':(roi>=0?'+':'')+roi.toFixed(1)+'%') + '</div>';
    html += '</div>';
  });
  html += '</div>';
  return html;
}

// ── Sharp Money Detail Popup ─── v135 ──────────────────
function showSharpPopup(dataId) {
  const s = (window.__sharpData || {})[dataId];
  if (!s) return;

  const existing = document.getElementById('sharpPopupOverlay');
  if (existing) existing.remove();

  const tierColors = { elite: '#f59e0b', strong: '#00BEC4', moderate: '#7c3aed', weak: '#64748b' };
  const tierIcons  = { elite: '⚡ ELITE SHARP', strong: '📡 SHARP', moderate: '👁 MATIG SHARP', weak: '〰 ZWAK SIGNAAL' };
  const tier       = s.sharpTier || (s.isSteam ? 'moderate' : 'weak');
  const tierColor  = tierColors[tier] || '#d97706';
  const tierLabel  = tierIcons[tier]  || '🔥 STEAM';

  const pickLabel  = s.pick === '1' ? 'Thuis wint' : s.pick === 'X' ? 'Gelijkspel' : 'Uit wint';
  const matchLabel = (s.home && s.away) ? (s.home + ' vs ' + s.away) : ('Fixture ' + s.fixtureId);
  const movPct     = parseFloat(s.movementPct || s.movement || 0);
  const isSteam    = s.isSteam || movPct < -4;
  const isDrift    = s.isDrift || movPct > 5;

  // Odds rij helper
  function oddsRow(label, from, to) {
    if (!from && !to) return '';
    const dir = to && from ? (to < from ? '↓' : to > from ? '↑' : '→') : '';
    const dirColor = to < from ? '#dc2626' : to > from ? '#64748b' : '#ffffff';
    return `<div style="display:flex;justify-content:space-between;align-items:center;
      padding:.3rem 0;border-bottom:1px solid rgba(255,255,255,.06);">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;color:rgba(255,255,255,.55);">${label}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;font-weight:700;">
        ${from ? '<span style="color:rgba(255,255,255,.5);">'+parseFloat(from).toFixed(2)+'</span>' : '—'}
        ${dir ? ' <span style="color:'+dirColor+';">'+dir+'</span> ' : ''}
        ${to   ? '<span style="color:#fff;">'+parseFloat(to).toFixed(2)+'</span>' : ''}
      </div>
    </div>`;
  }

  // Kans rij helper
  function pctRow(label, pct, color) {
    if (pct == null) return '';
    return `<div style="display:flex;align-items:center;gap:.5rem;padding:.25rem 0;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:rgba(255,255,255,.5);min-width:80px;">${label}</div>
      <div style="flex:1;background:rgba(255,255,255,.08);border-radius:999px;height:5px;">
        <div style="background:${color};height:100%;border-radius:999px;width:${Math.min(100,parseFloat(pct))}%;"></div>
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;font-weight:700;color:${color};min-width:36px;text-align:right;">${parseFloat(pct).toFixed(1)}%</div>
    </div>`;
  }

  const overlay = document.createElement('div');
  overlay.id = 'sharpPopupOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';

  overlay.innerHTML = `
    <div style="background:#0d1f2d;border-radius:20px 20px 0 0;width:100%;max-width:480px;
      padding:1.25rem 1rem 2rem;max-height:88vh;overflow-y:auto;">

      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.9rem;">
        <div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.62rem;font-weight:800;color:#fff;line-height:1.25;">${matchLabel}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;color:rgba(255,255,255,.5);margin-top:.15rem;">${pickLabel}${s.matchDate ? ' · ' + s.matchDate : ''}</div>
        </div>
        <button onclick="document.getElementById('sharpPopupOverlay').remove()"
          style="background:rgba(255,255,255,.08);border:none;color:rgba(255,255,255,.7);border-radius:50%;width:28px;height:28px;font-size:.8rem;cursor:pointer;flex-shrink:0;margin-left:.5rem;">✕</button>
      </div>

      <!-- Tier badge -->
      <div style="display:inline-flex;align-items:center;gap:.4rem;background:${tierColor}18;
        border:1px solid ${tierColor}44;border-radius:10px;padding:.4rem .75rem;margin-bottom:.9rem;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.54rem;font-weight:800;color:${tierColor};">${tierLabel}</div>
        ${s.sharpScore ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;color:${tierColor};opacity:.8;">${Math.round(s.sharpScore)}/100</div>` : ''}
      </div>

      <!-- Wat betekent dit -->
      <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:.6rem .7rem;margin-bottom:.75rem;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.4rem;color:rgba(255,255,255,.4);margin-bottom:.25rem;">WAT BETEKENT DIT</div>
        <div style="font-family:'DM Sans',sans-serif;font-size:.58rem;line-height:1.6;color:rgba(255,255,255,.8);">
          ${isSteam
            ? `Grote professionele spelers (sharps) hebben ${Math.abs(movPct).toFixed(1)}% van de odds afgedrukt door fors op <b>${pickLabel}</b> te wedden. Bookmakers beschermen zichzelf — dit is een concrete bevestiging van jouw model.`
            : isDrift
            ? `De odds zijn ${movPct.toFixed(1)}% gestegen. Dat betekent dat recreatief geld de andere kant op gaat. Wees voorzichtig — de markt trekt weg van ${pickLabel}.`
            : s.divergence
            ? `Jouw Poisson model denkt ${parseFloat(s.divergence).toFixed(1)}pp anders dan de markt. Groot verschil = potentieel grote value. Nog geen odds beweging, maar de kloof is significant.`
            : `Er is een sharp signaal gedetecteerd op ${pickLabel}.`
          }
        </div>
      </div>

      <!-- Odds beweging -->
      ${(s.fromOdds || s.openingOdds || s.consensusOdds) ? `
      <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:.6rem .7rem;margin-bottom:.75rem;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.4rem;color:rgba(255,255,255,.4);margin-bottom:.35rem;">ODDS BEWEGING</div>
        ${oddsRow('Opening odds', s.fromOdds || s.openingOdds, null)}
        ${oddsRow('Huidige odds', null, s.toOdds || s.consensusOdds)}
        ${movPct ? `<div style="display:flex;justify-content:space-between;padding:.3rem 0;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;color:rgba(255,255,255,.55);">Beweging</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;font-weight:800;color:${isSteam ? '#dc2626' : '#64748b'};">
            ${movPct > 0 ? '+' : ''}${movPct.toFixed(1)}% ${isSteam ? '🔴 STEAM' : isDrift ? '↑ DRIFT' : ''}
          </div>
        </div>` : ''}
      </div>` : ''}

      <!-- Model vs markt -->
      ${(s.poissonPct || s.marketPct) ? `
      <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:.6rem .7rem;margin-bottom:.75rem;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.4rem;color:rgba(255,255,255,.4);margin-bottom:.35rem;">MODEL vs MARKT</div>
        ${pctRow('Jouw model', s.poissonPct, '#00BEC4')}
        ${pctRow('Markt implied', s.marketPct, '#64748b')}
        ${s.divergence ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:rgba(255,255,255,.5);margin-top:.3rem;">
          Kloof: <span style="color:#f59e0b;font-weight:700;">${parseFloat(s.divergence).toFixed(1)}pp</span>
          ${parseFloat(s.divergence) >= 10 ? ' — groot verschil' : parseFloat(s.divergence) >= 6 ? ' — significant' : ''}
        </div>` : ''}
      </div>` : ''}

      <!-- Consensus sterkte -->
      ${s.consensusStrength != null ? `
      <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:.6rem .7rem;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.4rem;color:rgba(255,255,255,.4);margin-bottom:.35rem;">BOOKMAKER CONSENSUS</div>
        ${pctRow('Eens met odds', s.consensusStrength, s.consensusStrength > 70 ? '#00BEC4' : '#d97706')}
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.42rem;color:rgba(255,255,255,.4);margin-top:.25rem;">
          ${parseFloat(s.consensusStrength) > 80
            ? 'Boekmakers zijn het grotendeels eens — betrouwbaar signaal'
            : parseFloat(s.consensusStrength) > 50
            ? 'Redelijke consensus — signaal is matig betrouwbaar'
            : 'Lage consensus — boekmakers zijn het oneens, wees voorzichtig'}
        </div>
      </div>` : ''}

    </div>`;

  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}
