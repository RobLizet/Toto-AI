// ═══════════════════════════════════════════════════════
// ANALYSE.JS — Value scan, AI analyse, Combi Tips
// ═══════════════════════════════════════════════════════

// ── Analyse screen render ─────────────────────────────────
function renderAnalyseScreen() {
  const screen = document.getElementById('screen-analyse');
  if (!screen) return;

  const m = state.selectedMatch;

  screen.innerHTML = `
    <!-- Sub-tabs -->
    <div class="analyse-subtabs">
      <button id="asub-scan" class="asub-btn active" onclick="showAnalyseSubTab('scan')">
        ⚡ Scan &amp; Analyse
      </button>
      <button id="asub-tips" class="asub-btn inactive" onclick="showAnalyseSubTab('tips')">
        🎯 Combi Tips
      </button>
      <button id="asub-log" class="asub-btn inactive" onclick="showAnalyseSubTab('log')">
        📊 Scan Log
      </button>
    </div>

    <!-- Scan sub-tab -->
    <div id="asub-content-scan">
      ${!m ? `
      <div style="text-align:center;padding:2rem 1rem;font-family:'IBM Plex Mono',monospace;font-size:.62rem;color:var(--sub);line-height:2;">
        <div style="font-size:2rem;margin-bottom:.5rem;">⚽</div>
        Selecteer een wedstrijd via het<br>
        <b style="color:var(--ink);">Wedstrijden</b> tabblad om te analyseren.
      </div>` : `
      <!-- Geselecteerde wedstrijd info -->
      <div style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;padding:.8rem 1rem;margin-bottom:.85rem;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);margin-bottom:.35rem;">${m.comp || 'Competitie'} · ${m.date || ''} ${m.time || ''}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem;">
          <div style="font-size:.95rem;font-weight:800;color:var(--ink);">${m.home}</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:var(--ink);padding:0 .8rem;">${m.score || 'VS'}</div>
          <div style="font-size:.95rem;font-weight:800;color:var(--ink);text-align:right;">${m.away}</div>
        </div>
        ${m.homeOdds !== '—' ? `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.3rem;margin-top:.5rem;">
          <div style="text-align:center;background:rgba(255,255,255,.7);border:1px solid var(--stroke);border-radius:8px;padding:.35rem;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;color:var(--sub);">1</div>
            <div style="font-family:'Bebas Neue',sans-serif;font-size:1rem;">${m.homeOdds}</div>
          </div>
          <div style="text-align:center;background:rgba(255,255,255,.7);border:1px solid var(--stroke);border-radius:8px;padding:.35rem;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;color:var(--sub);">X</div>
            <div style="font-family:'Bebas Neue',sans-serif;font-size:1rem;">${m.drawOdds}</div>
          </div>
          <div style="text-align:center;background:rgba(255,255,255,.7);border:1px solid var(--stroke);border-radius:8px;padding:.35rem;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;color:var(--sub);">2</div>
            <div style="font-family:'Bebas Neue',sans-serif;font-size:1rem;">${m.awayOdds}</div>
          </div>
        </div>` : ''}
      </div>

      <!-- AI Analyse knop -->
      <button id="analyseBtn" onclick="runAnalyse()"
        style="width:100%;background:linear-gradient(135deg,rgba(219,39,119,.85),rgba(124,58,237,.8));
        color:#fff;border:none;border-radius:12px;font-family:'IBM Plex Mono',monospace;
        font-size:.68rem;font-weight:800;padding:.8rem;cursor:pointer;margin-bottom:.85rem;
        letter-spacing:.05em;box-shadow:0 4px 16px rgba(219,39,119,.25);">
        ⚽ ANALYSEER — ${m.home} vs ${m.away}
      </button>

      <!-- Analyse output -->
      <div id="analyseOutput" style="display:none;">
        <!-- Entity chips -->
        <div id="entityChips" style="display:flex;flex-wrap:wrap;gap:.35rem;margin-bottom:.8rem;"></div>
        <!-- Secties -->
        <div id="rb-vorm"></div>
        <div id="rb-stats"></div>
        <div id="rb-tactiek"></div>
        <div id="rb-kans"></div>
        <div id="rb-risico"></div>
        <div id="rb-advies"></div>
        <div id="rb-tip"></div>
      </div>`}

      <!-- Value scan sectie -->
      <div style="margin-top:1rem;">
        <div class="section-label">VALUE SCAN</div>
        ${(state.matches||[]).some(m => m.homeOdds !== '—') ? `
        <button id="valueScanBtn2" onclick="scanValueAll()"
          style="width:100%;background:linear-gradient(135deg,rgba(22,163,74,.1),rgba(5,150,105,.06));
          border:1.5px solid rgba(22,163,74,.3);color:#15803d;font-family:'IBM Plex Mono',monospace;
          font-size:.65rem;font-weight:800;padding:.65rem;border-radius:12px;cursor:pointer;margin-bottom:.7rem;">
          ⚡ SCAN VALUE — alle geladen matches
        </button>` : `
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.58rem;color:var(--sub);text-align:center;padding:.8rem;background:rgba(15,23,42,.04);border-radius:10px;margin-bottom:.7rem;">
          Laad eerst wedstrijden via het ⚽ Wedstrijden tabblad
        </div>`}
        <div id="valueBanner2" style="display:none;"></div>
      </div>
    </div>

    <!-- Scan Log sub-tab -->
    <div id="asub-content-log" style="display:none;">
      <div id="scan-log-content"></div>
    </div>

    <!-- Combi Tips sub-tab -->
    <div id="asub-content-tips" style="display:none;">
      <button id="combiGenBtn" onclick="generateCombiTip()"
        style="width:100%;background:linear-gradient(135deg,rgba(219,39,119,.85),rgba(124,58,237,.8));
        color:#fff;border:none;border-radius:12px;font-family:'IBM Plex Mono',monospace;
        font-size:.65rem;font-weight:800;padding:.75rem;cursor:pointer;margin-bottom:.85rem;letter-spacing:.05em;">
        ⚡ GENEREER TOP 3 TIPS + COMBI
      </button>
      <div id="combiCard" style="display:none;"></div>
    </div>
  `;
}

function showAnalyseSubTab(tab) {
  const scan = document.getElementById('asub-content-scan');
  const tips = document.getElementById('asub-content-tips');
  const log  = document.getElementById('asub-content-log');
  const btnScan = document.getElementById('asub-scan');
  const btnTips = document.getElementById('asub-tips');
  const btnLog  = document.getElementById('asub-log');
  [scan,tips,log].forEach(el => { if(el) el.style.display='none'; });
  [btnScan,btnTips,btnLog].forEach(b => { if(b) b.className='asub-btn inactive'; });
  if (tab === 'scan') {
    if (scan) scan.style.display = 'block';
    if (btnScan) btnScan.className = 'asub-btn active';
  } else if (tab === 'tips') {
    if (tips) tips.style.display = 'block';
    if (btnTips) btnTips.className = 'asub-btn active';
    generateCombiTip();
  } else if (tab === 'log') {
    if (log) log.style.display = 'block';
    if (btnLog) btnLog.className = 'asub-btn active';
    renderScanLog();
  }
}

// ── Value scan (per competitie) ───────────────────────────
async function scanValueAll() {
  const candidates = (state.matches||[]).filter(m =>
    m.homeOdds !== '—' && !m.isDone && parseFloat(m.homeOdds) > 1
  ).slice(0, 25);

  if (!candidates.length) {
    alert('Geen wedstrijden met quotes. Laad eerst wedstrijden via Wedstrijden tabblad.');
    return;
  }

  const btnId = document.getElementById('valueScanBtn') ? 'valueScanBtn' : 'valueScanBtn2';
  const btn = document.getElementById(btnId);
  if (btn) { btn.disabled = true; btn.textContent = `⟳ SCANNEN (${candidates.length})...`; }
  state.valueScans = [];

  try {
    const leagueId = COMP_IDS[state.activeComp];

    // Stap 1: haal stats op voor elke wedstrijd (parallel, met timeout)
    const matchDataMap = {};
    const wt = (p, ms=5000) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);

    if (candidates.some(m => m.homeId && m.awayId)) {
      if (btn) btn.textContent = `⟳ DATA OPHALEN...`;
      await Promise.all(candidates.map(async m => {
        if (!m.homeId || !m.awayId) { matchDataMap[m.id] = { confidence: 3 }; return; }
        try {
          const [h2h, homeForm, awayForm, hStats, aStats] = await Promise.all([
            wt(fetchH2H(m.homeId, m.awayId), 4000),
            wt(fetchTeamForm(m.homeId), 4000),
            wt(fetchTeamForm(m.awayId), 4000),
            wt(fetchTeamStats(m.homeId, leagueId || 88), 4000),
            wt(fetchTeamStats(m.awayId, leagueId || 88), 4000),
          ]);
          let conf = 4;
          if (h2h?.length >= 3) conf += 2; else if (h2h?.length) conf += 1;
          if (homeForm?.length >= 5 && awayForm?.length >= 5) conf += 2;
          else if (homeForm?.length && awayForm?.length) conf += 1;
          const homeGoalStats = hStats ? extractTeamGoalStats(hStats) : null;
          const awayGoalStats = aStats ? extractTeamGoalStats(aStats) : null;
          const poisson = calcPoissonKansen(homeGoalStats, awayGoalStats, m.leagueId || leagueId || 1.35);
          if (poisson.valid) conf = Math.min(10, conf + 1 + (poisson.hasXG ? 1 : 0));
          const market = analyzeMarketMovement(m.id, parseFloat(m.homeOdds)||0, parseFloat(m.drawOdds)||0, parseFloat(m.awayOdds)||0);
          conf = Math.min(10, Math.max(1, conf + (market.confDelta||0)));
          matchDataMap[m.id] = {
            h2h:      h2h?.length   ? formatH2HCompact(h2h.slice(0,5), m.home, m.away)          : '',
            homeForm: homeForm?.length ? formatFormCompact(homeForm.slice(0,5), m.homeId, m.home) : '',
            awayForm: awayForm?.length ? formatFormCompact(awayForm.slice(0,5), m.awayId, m.away) : '',
            poisson, market, confidence: Math.min(10, conf)
          };
        } catch(e) {
          matchDataMap[m.id] = { confidence: 4 };
        }
      }));
    }

    // Stap 2: AI batch analyse
    if (btn) btn.textContent = `⟳ AI ANALYSE (${candidates.length})...`;
    const ctx = candidates.map((m, i) => {
      const d = matchDataMap[m.id] || {};
      const p = d.poisson;
      let line = `${i+1}. ID:${m.id} | ${m.home} vs ${m.away} | ${m.comp||'?'} | ${m.date||''} ${m.time||''} | 1=${m.homeOdds} X=${m.drawOdds} 2=${m.awayOdds}`;
      if (p?.valid) line += `\n   📐 Poisson: 1=${p.k1}% X=${p.kX}% 2=${p.k2}%`;
      if (d.homeForm) line += `\n   Vorm ${m.home}: ${d.homeForm}`;
      if (d.awayForm) line += `\n   Vorm ${m.away}: ${d.awayForm}`;
      if (d.h2h) line += `\n   H2H: ${d.h2h}`;
      if (d.market?.direction !== 'none') line += `\n   Markt: ${d.market?.label||''}`;
      return line;
    }).join('\n\n');

    const data = await anthropicFetch(null, {
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      temperature: 0,
      system: `RESPOND WITH VALID JSON ONLY. NO TEXT BEFORE OR AFTER JSON. START WITH { END WITH }.
{"scans":[{"id":"123","kans1":45,"kansX":30,"kans2":25,"confidence":7,"reason":"max 12 woorden concreet"}]}
Regels: kans1+kansX+kans2=100. Gebruik Poisson als anker (±8pp). Geef voor ALLE ${candidates.length} wedstrijden een object. Geen uitleg.`,
      messages:[{role:'user', content:`Analyseer ${candidates.length} wedstrijden:\n\n${ctx}`}]
    });

    if (data.error) throw new Error(data.error.message || 'API fout');
    // Track kosten
    if (data.usage && typeof trackTokenUsage === 'function') {
      trackTokenUsage('claude-sonnet-4-6', data.usage.input_tokens||0, data.usage.output_tokens||0);
    }
    let raw = data.content?.[0]?.text?.trim();
    if (!raw) throw new Error('Lege response van API');
    const s1 = raw.indexOf('{'), e1 = raw.lastIndexOf('}');
    if (s1 < 0 || e1 < s1) throw new Error('Geen JSON: ' + raw.substring(0, 60));
    const parsed = JSON.parse(raw.substring(s1, e1 + 1));
    const scansRaw = parsed.scans || parsed.results || [];
    if (!scansRaw.length) throw new Error('Lege resultaten');

    if (btn) btn.textContent = `⟳ VERWERKEN...`;

    const scans = scansRaw.map(s => {
      const match = candidates.find(m => String(m.id) === String(s.id));
      if (!match) return null;
      const sum = (s.kans1||0) + (s.kansX||0) + (s.kans2||0);
      if (sum < 80 || sum > 120) return null;
      let k1 = Math.round((s.kans1||0) / sum * 100);
      let kX = Math.round((s.kansX||0) / sum * 100);
      let k2 = Math.round((s.kans2||0) / sum * 100);

      // Blend Poisson + AI
      const poisson = matchDataMap[s.id]?.poisson;
      if (poisson?.valid) {
        const d = matchDataMap[s.id];
        const pw = Math.min(0.80, 0.65 + (poisson.hasXG?0.08:0) + (d.h2h?0.03:0) + (d.homeForm?0.04:0));
        const aw = 1 - pw;
        k1 = Math.round(pw * poisson.k1 + aw * k1);
        kX = Math.round(pw * poisson.kX + aw * kX);
        k2 = Math.round(pw * poisson.k2 + aw * k2);
        const bs = k1+kX+k2; if (bs!==100) k1 += (100-bs);
      }

      // Marktbeweging correctie
      const market = matchDataMap[s.id]?.market;
      if (market?.isSteam && market.direction) {
        const adj = 3;
        if (market.direction === '1') { k1 += adj; kX = Math.max(5, kX-adj); }
        else if (market.direction === 'X') { kX += adj; k1 = Math.max(5, k1-adj); }
        else if (market.direction === '2') { k2 += adj; kX = Math.max(5, kX-adj); }
        const ms = k1+kX+k2; if (ms!==100) k1 += (100-ms);
      }

      // Value berekenen
      const makePick = (pick, pickLabel, kans, oddsStr) => {
        const odds = parseFloat(oddsStr) || 0;
        if (!odds || odds <= 1) return null;
        const val = calcValue(kans, odds);
        const kelly = calcKelly(kans, odds);
        return { pick, pickLabel, kans, odds, value: val, kelly, bookmaker: match.oddsSource || 'quote' };
      };
      const picks = [
        makePick('1', `${match.home} wint`, k1, match.homeOdds),
        makePick('X', 'Gelijkspel', kX, match.drawOdds),
        makePick('2', `${match.away} wint`, k2, match.awayOdds),
      ].filter(Boolean);

      // Sanity checks
      const favoriteOdds = Math.min(parseFloat(match.homeOdds)||99, parseFloat(match.awayOdds)||99);
      if (favoriteOdds < 1.50) return null;
      const drawPick = picks.find(p => p.pick === 'X');
      if (drawPick && favoriteOdds < 2.20 && drawPick.value > 0) drawPick.value = Math.min(drawPick.value, 3);

      picks.sort((a, b) => (b.value||-999) - (a.value||-999));
      const best = picks[0];
      if (!best) return null;

      // Value cap
      const rawValue = best.value;
      if (best.value > 55) best.value = 55;

      const dataConf = matchDataMap[s.id]?.confidence || 4;
      const aiConf = Math.max(1, Math.min(10, parseInt(s.confidence) || 5));
      const confidence = Math.min(10, Math.round((dataConf + aiConf) / 2) + (poisson?.valid ? 1 : 0));

      return {
        id: s.id, match,
        pick: best.pick, pickLabel: best.pickLabel,
        kans: best.kans, odds: best.odds,
        bookmaker: best.bookmaker,
        value: best.value, kelly: best.kelly,
        confidence, allPicks: picks,
        poissonUsed: poisson?.valid || false,
        poissonK1: poisson?.k1, poissonKX: poisson?.kX, poissonK2: poisson?.k2,
        market: market?.direction !== 'none' ? market : null,
        rawValue, reason: s.reason || ''
      };
    }).filter(x => x !== null);

    state.valueScans = scans;

    // Log scan resultaten
    if (scans.length > 0) logScanResult(scans);

    // Auto-save backtest picks (≥5% value + confidence >= 7)
    if (!state.valueBacktest) state.valueBacktest = { picks: [] };
    let savedCount = 0;
    scans.filter(s => s.value >= 5 && (s.confidence || 0) >= 7).forEach(s => {
      const exists = state.valueBacktest.picks.some(p =>
        String(p.matchId) === String(s.match.id) && p.pick === s.pick
      );
      if (!exists) {
        state.valueBacktest.picks.unshift({
          id: Date.now() + Math.random(),
          matchId: String(s.match.id),
          matchName: `${s.match.home} vs ${s.match.away}`,
          fixtureId: s.match.id,
          date: s.match.date || new Date().toLocaleDateString('nl-NL'),
          pick: s.pick, pickLabel: s.pickLabel,
          aiKans: s.kans, odds: s.odds, bookmaker: s.bookmaker,
          value: parseFloat(s.value.toFixed(1)),
          kelly: parseFloat((s.kelly||0).toFixed(1)),
          confidence: s.confidence || 5,
          reason: s.reason || '',
          status: 'pending', score: null,
          comp: s.match.comp || state.activeComp || '',
          scanDate: new Date().toLocaleString('nl-NL')
        });
        savedCount++;
      }
    });
    if (savedCount > 0) {
      saveState();
      showFirebaseStatus(`⚡ ${savedCount} value-pick${savedCount>1?'s':''} opgeslagen in Backtest`, '#15803d');
    }

    // Sla scan resultaten op (voor scan results panel)
    state.lastScanResults = scans.map(s => ({
      matchId: s.match.id,
      home: s.match.home, away: s.match.away, comp: s.match.comp,
      pick: s.pick, pickLabel: s.pickLabel,
      value: s.value, confidence: s.confidence, odds: s.odds
    }));
    saveState();

    // Update match cards met value badges
    state.matches.forEach(m => { m.valueData = null; });
    scans.forEach(s => {
      if (s.match && s.value >= 5) {
        s.match.valueData = { pct: s.value, pick: s.pick, pickLabel: s.pickLabel, kans: s.kans, odds: s.odds, kelly: s.kelly, confidence: s.confidence, poissonUsed: s.poissonUsed, reason: s.reason };
      }
    });

    // Render
    const displayScans = [...scans].sort((a,b) => (b.value||-999) - (a.value||-999)).filter(s => s.value >= 5);
    renderValueBannerInAnalyse(displayScans, scans.length);
    renderScanResults(state.lastScanResults);
    renderMatches(state.matches);

    // Push notificaties
    if (state.settings.notifEnabled && 'Notification' in window && Notification.permission === 'granted') {
      const threshold = state.settings.notifThreshold || 15;
      const strong = scans.filter(s => s.value >= threshold);
      strong.slice(0, 3).forEach((s, i) => {
        setTimeout(() => sendValueNotification(s), i * 500);
      });
    }

  } catch(e) {
    alert('Value scan mislukt: ' + e.message);
  }

  if (btn) { btn.disabled = false; btn.textContent = '⚡ OPNIEUW SCANNEN'; }
}

function renderValueBannerInAnalyse(displayScans, total) {
  // Fix v14.8: vul BEIDE banners (Wedstrijden + Analyse tab)
  const banners = [
    document.getElementById('valueBanner'),
    document.getElementById('valueBanner2')
  ].filter(Boolean);
  if (!banners.length) return;

  if (!displayScans?.length) {
    const emptyHtml = `<div style="font-family:'IBM Plex Mono',monospace;font-size:.58rem;color:var(--sub);padding:.8rem;text-align:center;">
      Geen value ≥5% gevonden in ${total} wedstrijden.<br>Bookmakers zitten goed in de markt vandaag.
      <button onclick="this.parentElement.parentElement.style.display='none'" style="background:none;border:none;color:var(--sub);cursor:pointer;margin-left:.5rem;">✕</button>
    </div>`;
    banners.forEach(b => { b.style.display = 'block'; b.innerHTML = emptyHtml; });
    return;
  }

  const highCount = displayScans.filter(s => s.value >= 15).length;
  const medCount = displayScans.filter(s => s.value >= 5 && s.value < 15).length;
  const html = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.6rem .9rem;
      background:linear-gradient(135deg,rgba(22,163,74,.08),rgba(5,150,105,.05));
      border-bottom:1px solid rgba(22,163,74,.15);">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.62rem;font-weight:800;color:#15803d;">⚡ VALUE SCAN</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);">
        <span style="color:#15803d;font-weight:700;">${highCount} sterk</span> · <span style="color:#b45309;font-weight:700;">${medCount} licht</span>
      </div>
    </div>
    ${displayScans.slice(0,6).map(s => {
      const cls = s.value >= 15 ? '#15803d' : '#b45309';
      const sign = s.value > 0 ? '+' : '';
      return `<div style="display:flex;align-items:center;padding:.55rem .9rem;border-bottom:1px solid var(--stroke);cursor:pointer;" onclick="openValueAnalysis('${s.match.id}')">
        <div style="flex:1;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.6rem;font-weight:700;color:var(--ink);">${s.match.home} vs ${s.match.away}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);">${s.pickLabel} · ${s.kans}%${s.poissonUsed?' (P+AI)':''} · ${s.reason}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;color:var(--sub);">📊 ${s.bookmaker||''} · ½K ${(s.kelly||0).toFixed(1)}% · 🎲 ${s.confidence||'?'}/10</div>
        </div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.2rem;color:${cls};">${sign}${Math.round(s.value)}%</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:.9rem;color:#16a34a;margin-left:.5rem;">${(s.odds||0).toFixed(2)}</div>
      </div>`;
    }).join('')}
    <div style="padding:.4rem .9rem;text-align:right;">
      <button onclick="this.parentElement.parentElement.style.display='none'" style="background:none;border:none;color:var(--sub);cursor:pointer;font-size:.9rem;">✕</button>
    </div>
  `;
  banners.forEach(b => { b.style.display = 'block'; b.innerHTML = html; });
}

function openValueAnalysis(matchId) {
  const match = (state.matches||[]).find(m => String(m.id) === String(matchId));
  if (!match) return;
  selectMatch(match);
  switchScreen('analyse');
  setTimeout(() => { if (typeof runAnalyse === 'function') runAnalyse(); }, 300);
}

// ── AI diepte analyse ─────────────────────────────────────
async function runAnalyse() {
  const m = state.selectedMatch;
  if (!m) { alert('Selecteer eerst een wedstrijd'); return; }

  const btn = document.getElementById('analyseBtn');
  const output = document.getElementById('analyseOutput');
  if (btn) { btn.disabled = true; btn.textContent = '⟳ ANALYSEREN...'; }
  if (output) output.style.display = 'block';

  // Entity chips aanmaken
  const chipContainer = document.getElementById('entityChips');
  const sections = ['vorm','stats','tactiek','kans','risico','advies','tip'];
  if (chipContainer) {
    chipContainer.innerHTML = sections.map(s => `<span class="entity-chip" id="ec-${s}">⏳ ${s}</span>`).join('');
  }

  const fill = (id, html) => {
    const el = document.getElementById('rb-' + id);
    if (el) el.innerHTML = html || '';
    const chip = document.getElementById('ec-' + id);
    if (chip) chip.className = 'entity-chip done';
  };

  try {
    if (btn) btn.textContent = '⟳ DATA OPHALEN...';
    const leagueId = m.leagueId || COMP_IDS[state.activeComp];
    const wt = (p, ms=5000) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);

    const [h2h, homeForm, awayForm, hStats, aStats, lineups] = await Promise.all([
      wt(fetchH2H(m.homeId, m.awayId), 5000),
      wt(fetchTeamForm(m.homeId), 5000),
      wt(fetchTeamForm(m.awayId), 5000),
      wt(fetchTeamStats(m.homeId, leagueId || 88), 5000),
      wt(fetchTeamStats(m.awayId, leagueId || 88), 5000),
      wt(fetchLineups(m.id), 4000),
    ]);

    // Poisson
    const homeGoalStats = hStats ? extractTeamGoalStats(hStats, homeForm) : null;
    const awayGoalStats = aStats ? extractTeamGoalStats(aStats, awayForm) : null;
    const poisson = calcPoissonKansen(homeGoalStats, awayGoalStats, leagueId || 1.35);

    if (btn) btn.textContent = '⟳ AI ANALYSE...';

    const h2hStr = h2h?.length ? formatH2HCompact(h2h.slice(0,5), m.home, m.away) : 'geen data';
    const homeFormStr = homeForm?.length ? formatFormCompact(homeForm.slice(0,5), m.homeId, m.home) : 'geen data';
    const awayFormStr = awayForm?.length ? formatFormCompact(awayForm.slice(0,5), m.awayId, m.away) : 'geen data';
    const poissonStr = poisson.valid ? `Poisson: 1=${poisson.k1}% X=${poisson.kX}% 2=${poisson.k2}%` : 'geen statdata';
    const formationStr = lineups?.length ? `${lineups[0]?.team?.name||m.home}: ${lineups[0]?.formation||'?'} vs ${lineups[1]?.team?.name||m.away}: ${lineups[1]?.formation||'?'}` : 'nog niet bekend';

    const context = `Wedstrijd: ${m.home} vs ${m.away}
Competitie: ${m.comp} | ${m.date} ${m.time}
Quotes: 1=${m.homeOdds} X=${m.drawOdds} 2=${m.awayOdds}
${poissonStr}
Vorm ${m.home}: ${homeFormStr}
Vorm ${m.away}: ${awayFormStr}
H2H: ${h2hStr}
Formaties: ${formationStr}`;

    const data = await anthropicFetchWithRetry(null, {
      model: 'claude-sonnet-4-6',
      max_tokens: 1600,
      system: `Je bent een Nederlandstalige voetbal analist. JSON only, geen tekst buiten JSON:
{"vorm":"...","stats":"...","tactiek":"...","kans":"...","risico":"...","advies":"...",
"tip":{"pick":"1","pickLabel":"${m.home} wint","markt":"Uitslag","odds":${m.homeOdds||2},"kans":55,"sterren":3,"confidence":6,"confidenceReden":"...","redenering":"...",
"tips":[{"pick":"O2.5","pickLabel":"Meer dan 2.5 goals","markt":"Doelpunten","odds":1.8,"kans":58,"reden":"..."},{"pick":"X","pickLabel":"Gelijkspel","markt":"Uitslag","odds":${m.drawOdds||3.5},"kans":26,"reden":"..."}]}}`,
      messages:[{role:'user',content:`Analyseer:\n${context}`}]
    });

    if (data.error) throw new Error(data.error.message || 'API fout');
    let raw = data.content?.[0]?.text?.trim();
    if (!raw) throw new Error('Lege response');
    const js = raw.indexOf('{'), je = raw.lastIndexOf('}');
    if (js < 0 || je < js) throw new Error('Geen JSON: ' + raw.substring(0,50));
    const result = JSON.parse(raw.substring(js, je + 1));

    const sectionCard = (icon, title, content, color) => `
      <div style="background:var(--card);border:1px solid var(--stroke);border-radius:12px;padding:.8rem .9rem;margin-bottom:.6rem;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;font-weight:800;
          color:${color||'var(--sub)'};letter-spacing:.07em;margin-bottom:.4rem;">${icon} ${title}</div>
        <div style="font-size:.82rem;line-height:1.7;color:var(--ink);">${content}</div>
      </div>`;

    fill('vorm',    sectionCard('⚡', 'VORM', result.vorm || '—', '#2563eb'));
    fill('stats',   sectionCard('📊', 'STATS', (result.stats||'—') + (poisson.valid ? `<br><span style="font-family:monospace;font-size:.5rem;color:#7c3aed;">📐 ${poissonStr}</span>` : ''), '#7c3aed'));
    fill('tactiek', sectionCard('⚔️', 'TACTIEK & FORMATIES', result.tactiek || '—', '#d97706'));
    fill('kans',    sectionCard('🎯', 'KANSEN', result.kans || '—', '#16a34a'));
    fill('risico',  sectionCard('⚠️', 'RISICO', result.risico || '—', '#dc2626'));
    fill('advies',  sectionCard('💡', 'ADVIES', result.advies || '—', '#be185d'));

    // Tip sectie
    const tip = result.tip;
    if (tip && tip.pick) {
      // Sla op voor knoppen
      state.lastAnalyseTip = { ...tip, matchId: m.id, home: m.home, away: m.away };
      const tv = calcValue(tip.kans, parseFloat(tip.odds));
      const tvColor = tv >= 15 ? '#15803d' : tv >= 5 ? '#b45309' : '#64748b';
      const kleur = tip.kans >= 70 ? '#16a34a' : tip.kans >= 55 ? '#d97706' : '#dc2626';
      const conf = tip.confidence || 5;
      const confKleur = conf >= 8 ? '#16a34a' : conf >= 6 ? '#d97706' : '#dc2626';
      const sterren = '⭐'.repeat(Math.min(tip.sterren||3, 5)) + '☆'.repeat(5 - Math.min(tip.sterren||3, 5));

      document.getElementById('rb-tip').innerHTML = `
        <div style="background:linear-gradient(135deg,rgba(219,39,119,.06),rgba(124,58,237,.06));
          border:1px solid rgba(219,39,119,.15);border-radius:14px;padding:.9rem;margin-bottom:.6rem;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:#be185d;font-weight:700;letter-spacing:.05em;margin-bottom:.4rem;">🏆 BESTE TIP · ${tip.markt||'Uitslag'}</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.5rem;color:var(--ink);margin-bottom:.3rem;">${tip.pick} — ${tip.pickLabel}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.62rem;color:#374151;margin-bottom:.5rem;">Quote: <b>${tip.odds}</b> &nbsp;·&nbsp; ${sterren}</div>
          ${tv !== null ? `
          <div style="display:flex;justify-content:space-between;align-items:center;background:${tv>=5?'rgba(22,163,74,.08)':'rgba(100,116,139,.05)'};
            border:1px solid ${tv>=5?'rgba(22,163,74,.2)':'rgba(15,23,42,.08)'};border-radius:9px;padding:.5rem .7rem;margin-bottom:.6rem;">
            <div>
              <div style="font-family:monospace;font-size:.52rem;color:var(--sub);font-weight:700;">⚡ VALUE</div>
              <div style="font-family:monospace;font-size:.5rem;color:var(--sub);">${tip.kans}% × ${tip.odds}</div>
            </div>
            <div style="font-family:'Bebas Neue',sans-serif;font-size:1.8rem;color:${tvColor};">${tv>0?'+':''}${tv.toFixed(1)}%</div>
          </div>` : ''}
          <div style="margin-bottom:.6rem;">
            <div style="font-family:monospace;font-size:.52rem;color:#374151;margin-bottom:.3rem;display:flex;justify-content:space-between;">
              <span>KANS</span><span style="color:${kleur};font-weight:700;">${tip.kans}%</span>
            </div>
            <div style="background:rgba(0,0,0,.07);border-radius:999px;height:10px;overflow:hidden;">
              <div style="background:${kleur};width:${Math.min(100,tip.kans)}%;height:100%;border-radius:999px;"></div>
            </div>
          </div>
          <div style="font-size:.8rem;line-height:1.7;color:#1e293b;margin-bottom:.6rem;padding:.6rem .7rem;
            background:rgba(255,255,255,.7);border-radius:8px;">${tip.redenering||'—'}</div>
          <div style="background:rgba(255,255,255,.7);border:1px solid var(--stroke);border-radius:9px;padding:.6rem .7rem;margin-bottom:.6rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.25rem;">
              <span style="font-family:monospace;font-size:.52rem;font-weight:700;color:#475569;">🎯 CONFIDENCE</span>
              <span style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:${confKleur};">${conf}/10</span>
            </div>
            <div style="background:rgba(0,0,0,.07);border-radius:999px;height:7px;overflow:hidden;">
              <div style="background:${confKleur};width:${Math.round(conf/10*100)}%;height:100%;"></div>
            </div>
            ${tip.confidenceReden ? `<div style="font-size:.7rem;color:#64748b;font-style:italic;margin-top:.3rem;">${tip.confidenceReden}</div>` : ''}
          </div>
          <div style="display:flex;gap:.4rem;">
            <button onclick="openBetModal(null,'${m.id}','${tip.pick}','${(tip.pickLabel||'').replace(/'/g,"\\'")}',${tip.odds})"
              style="flex:1;padding:.45rem;border-radius:10px;background:rgba(219,39,119,.12);
              border:1px solid rgba(219,39,119,.3);font-family:monospace;font-size:.58rem;font-weight:700;
              color:#be185d;cursor:pointer;">💶 SINGLE BET</button>
            <button onclick="addValuePickToCombi('${m.id}','${tip.pick}','${(tip.pickLabel||'').replace(/'/g,"\\'")}',${tip.odds},'${(m.home||'').replace(/'/g,"\\'")}','${(m.away||'').replace(/'/g,"\\'")}')"
              style="flex:1;padding:.45rem;border-radius:10px;background:rgba(124,58,237,.1);
              border:1px solid rgba(124,58,237,.25);font-family:monospace;font-size:.58rem;font-weight:700;
              color:#7c3aed;cursor:pointer;">➕ COMBI</button>
          </div>
        </div>`;
      const chip = document.getElementById('ec-tip');
      if (chip) chip.className = 'entity-chip done';
    }

  } catch(e) {
    sections.forEach(id => {
      const el = document.getElementById('rb-' + id);
      if (el && !el.innerHTML) el.innerHTML = `<div style="font-family:monospace;font-size:.58rem;color:#dc2626;">⚠ ${e.message}</div>`;
      const chip = document.getElementById('ec-' + id);
      if (chip) chip.className = 'entity-chip err';
    });
  }

  if (btn) { btn.disabled = false; btn.textContent = '⚽ ANALYSEER OPNIEUW'; }
}

// ── Scannen alle comp vandaag ─────────────────────────────
async function scanAllTodayValue(mode = 'today') {
  const allWithOdds = (state.matches||[]).filter(m => {
    if (m.homeOdds === '—' || m.isDone || !(parseFloat(m.homeOdds) > 1)) return false;
    if (m.leagueId && !new Set(Object.values(COMP_IDS)).has(m.leagueId)) return false;
    return true;
  });

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
  let candidates;
  if (mode === 'tomorrow') {
    candidates = allWithOdds.filter(m => { const d = m.dateISO||''; return !d || d === todayStr || d === tomorrowStr; });
    if (!candidates.length) candidates = allWithOdds.slice(0, 25);
  } else {
    const byDate = allWithOdds.filter(m => m.dateISO === todayStr);
    candidates = byDate.length ? byDate : allWithOdds.filter(m => !m.dateISO).concat(byDate);
    if (!candidates.length) candidates = allWithOdds.slice(0, 20);
  }
  candidates = candidates.slice(0, 25);

  if (!candidates.length) {
    alert('Geen wedstrijden met quotes. Laad eerst alle competities vandaag.');
    return;
  }

  const btnId = mode === 'tomorrow' ? 'scanTomorrowBtn' : 'scanAllTodayBtn';
  const btnContainer = document.getElementById(btnId);
  const btn = btnContainer?.querySelector('button') || btnContainer;
  const origText = btn?.textContent || '⚡ SCAN';
  if (btn) { btn.disabled = true; btn.textContent = `⟳ ANALYSEREN (${candidates.length})...`; }

  // Tijdelijk state.matches = candidates voor de scan
  const prevMatches = state.matches;
  state.matches = candidates;
  await scanValueAll();
  state.matches = prevMatches;

  if (btn) { btn.disabled = false; btn.textContent = origText; }
}

// ── Combi Tips ────────────────────────────────────────────
async function generateCombiTip() {
  const btn = document.getElementById('combiGenBtn');
  if (!btn) return;
  btn.disabled = true; btn.textContent = '⟳ BEREKENEN...';

  const upcomingMatches = (state.matches||[]).filter(m => !m.isDone);
  if (!upcomingMatches.length) {
    alert('Geen aankomende wedstrijden gevonden. Laad eerst wedstrijden via het Wedstrijden tabblad.');
    btn.disabled = false; btn.textContent = '⚡ GENEREER TOP 3 TIPS + COMBI';
    return;
  }

  const matchesCtx = upcomingMatches.slice(0,15).map(m => {
    const datum = m.date ? `${m.date} ${m.time}` : m.time;
    return `ID:${m.id} | ${m.home} vs ${m.away} | ${m.comp} | ${datum} | quotes: 1=${m.homeOdds} X=${m.drawOdds} 2=${m.awayOdds}`;
  }).join('\n');

  const vandaag = new Date().toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long'});

  try {
    const data = await anthropicFetch(null, {
      model:'claude-sonnet-4-6', max_tokens:1600,
      system:`Je bent sportadviseur. JSON only, geen tekst buiten JSON:
{"top3":[{"match":"","datum":"","pick":"","pickLabel":"","markt":"","odds":0,"vertrouwen":8,"reden":"30-40 woorden","factoren":["",""],"risico":""},{"match":"","datum":"","pick":"","pickLabel":"","markt":"","odds":0,"vertrouwen":0,"reden":"","factoren":[],"risico":""},{"match":"","datum":"","pick":"","pickLabel":"","markt":"","odds":0,"vertrouwen":0,"reden":"","factoren":[],"risico":""}],
"combi":{"legs":[{"match":"","datum":"","pick":"","pickLabel":"","markt":"","odds":0,"vertrouwen":0},{"match":"","datum":"","pick":"","pickLabel":"","markt":"","odds":0,"vertrouwen":0},{"match":"","datum":"","pick":"","pickLabel":"","markt":"","odds":0,"vertrouwen":0}],"redenering":"40-50 woorden","synergie":"max 30 woorden","risico":"max 25 woorden","kansBerekening":"72%x68%x75%=37%","valueScore":7}}`,
      messages:[{role:'user',content:`Datum: ${vandaag}\nWedstrijden:\n${matchesCtx}\n\nGeef top 3 tips en combi van 3 legs.`}]
    });
    let raw = data.content[0].text.trim();
    const js = raw.indexOf('{'), je = raw.lastIndexOf('}');
    if (js < 0 || je < js) throw new Error('Geen JSON in response: ' + raw.substring(0,60));
    const result = JSON.parse(raw.substring(js, je + 1));
    renderTop3EnCombi(result);
  } catch(e) {
    const card = document.getElementById('combiCard');
    if (card) { card.innerHTML = `<div style="color:var(--red);font-family:monospace;font-size:.62rem;">⚠ ${e.message}</div>`; card.style.display = 'block'; }
  }
  btn.disabled = false; btn.textContent = '⚡ VERNIEUW TIPS';
}

function renderTop3EnCombi(result) {
  const defaultBet = state.settings.defaultBet || 10;
  const card = document.getElementById('combiCard');
  if (!card) return;
  const stars = n => '⭐'.repeat(Math.min(n,5));
  const confColor = n => n >= 8 ? '#16a34a' : n >= 6 ? '#d97706' : '#dc2626';
  const top3Html = (result.top3||[]).map((t,i) => {
    const tv = calcValue(t.vertrouwen * 10, parseFloat(t.odds));
    const tvSign = tv > 0 ? '+' : '';
    const tvColor = tv >= 15 ? '#15803d' : tv >= 5 ? '#b45309' : tv >= 0 ? '#64748b' : '#dc2626';
    const cc = confColor(t.vertrouwen);
    const cbar = Math.round((t.vertrouwen/10)*100);
    const factoren = Array.isArray(t.factoren) ? t.factoren : [];
    return `<div style="background:rgba(255,255,255,.82);border:1px solid rgba(28,35,48,.08);border-radius:12px;padding:.75rem .9rem;margin-bottom:.5rem;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.4rem;">
        <div style="flex:1;"><div style="font-size:.88rem;font-weight:700;color:var(--ink);">${i+1}. ${t.match}</div>
          <div style="font-family:monospace;font-size:.52rem;color:#7c3aed;margin-top:2px;">📅 ${t.datum||''}</div>
        </div>
        <div style="text-align:right;margin-left:.8rem;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.3rem;color:#16a34a;">${parseFloat(t.odds||0).toFixed(2)}</div>
          ${tv !== null ? `<div style="font-family:monospace;font-size:.5rem;font-weight:800;color:${tvColor};">⚡ ${tvSign}${Math.round(tv)}% val</div>` : ''}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.45rem;flex-wrap:wrap;">
        <span style="font-family:monospace;font-size:.6rem;background:rgba(219,39,119,.1);color:#be185d;padding:2px 9px;border-radius:4px;font-weight:700;">${t.pick} — ${t.pickLabel}</span>
        <span style="font-size:.72rem;">${stars(Math.round(t.vertrouwen/2))}</span>
      </div>
      <div style="margin-bottom:.45rem;">
        <div style="display:flex;justify-content:space-between;margin-bottom:.2rem;">
          <span style="font-family:monospace;font-size:.48rem;color:var(--sub);font-weight:700;">ZEKERHEID</span>
          <span style="font-family:monospace;font-size:.52rem;font-weight:800;color:${cc};">${t.vertrouwen}/10</span>
        </div>
        <div style="background:rgba(0,0,0,.08);border-radius:999px;height:6px;overflow:hidden;">
          <div style="background:${cc};width:${cbar}%;height:100%;border-radius:999px;"></div>
        </div>
      </div>
      ${t.reden ? `<div style="font-size:.76rem;color:#1e293b;line-height:1.65;margin-bottom:.4rem;padding:.45rem .6rem;background:rgba(255,255,255,.6);border-radius:7px;border-left:2.5px solid ${tvColor};">${t.reden}</div>` : ''}
      ${factoren.length ? `<div style="display:flex;flex-wrap:wrap;gap:.2rem;margin-bottom:.3rem;">${factoren.map(f=>`<span style="font-family:monospace;font-size:.46rem;font-weight:700;padding:2px 7px;border-radius:999px;background:rgba(124,58,237,.08);border:1px solid rgba(124,58,237,.18);color:#7c3aed;">${f}</span>`).join('')}</div>` : ''}
      ${t.risico ? `<div style="font-family:monospace;font-size:.47rem;padding:3px 9px;border-radius:999px;display:inline-block;background:rgba(220,38,38,.07);border:1px solid rgba(220,38,38,.18);color:#dc2626;">⚠ ${t.risico}</div>` : ''}
    </div>`;
  }).join('');

  const combi = result.combi || {};
  const legs = (combi.legs||[]).slice(0,3);
  const totalOdds = legs.reduce((a,l) => a * parseFloat(l.odds||1), 1);
  const payout = (defaultBet * totalOdds).toFixed(2);
  const kansStr = legs.length === 3 ? Math.round(legs.reduce((a,l) => a * ((l.vertrouwen||7)/10), 1) * 100) : '—';

  const legsHtml = legs.map((l,i) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem .75rem;
      background:rgba(255,255,255,.7);border-radius:10px;margin-bottom:.4rem;border:1px solid rgba(28,35,48,.08);">
      <div style="flex:1;">
        <div style="font-size:.82rem;font-weight:700;color:var(--ink);">${i+1}. ${l.match}</div>
        <div style="font-family:monospace;font-size:.5rem;color:#7c3aed;">📅 ${l.datum||''}</div>
        <div style="font-family:monospace;font-size:.55rem;color:#be185d;font-weight:700;margin-top:3px;">${l.pick} — ${l.pickLabel}</div>
      </div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:1.2rem;color:#16a34a;">${parseFloat(l.odds||0).toFixed(2)}</div>
    </div>`).join('');

  window._lastAICombi = legs;

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:1.05rem;color:#be185d;">🏆 TOP 3 TIPS</div>
      <div style="font-family:monospace;font-size:.5rem;color:var(--sub);">📅 ${new Date().toLocaleString('nl-NL',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
    </div>
    ${top3Html}
    <div style="height:1px;background:rgba(28,35,48,.08);margin:1rem 0;"></div>
    <div style="font-family:'Bebas Neue',sans-serif;font-size:1.05rem;color:#be185d;margin-bottom:.6rem;">⚡ AI COMBI</div>
    ${legsHtml}
    <div style="background:rgba(255,255,255,.85);border:1px solid rgba(15,23,42,.08);border-radius:14px;padding:.85rem;margin:.7rem 0;">
      <div style="font-size:.84rem;line-height:1.75;color:var(--ink);margin-bottom:.5rem;">${combi.redenering||''}</div>
      ${combi.synergie ? `<div style="background:rgba(37,99,235,.06);border-left:3px solid #2563eb;padding:.5rem .7rem;border-radius:0 8px 8px 0;margin-bottom:.4rem;">
        <div style="font-family:monospace;font-size:.52rem;color:#2563eb;font-weight:700;">🔗 SYNERGIE</div>
        <div style="font-size:.78rem;">${combi.synergie}</div></div>` : ''}
      ${combi.risico ? `<div style="background:rgba(220,38,38,.05);border-left:3px solid #dc2626;padding:.5rem .7rem;border-radius:0 8px 8px 0;">
        <div style="font-family:monospace;font-size:.52rem;color:#dc2626;font-weight:700;">⚠ RISICO</div>
        <div style="font-size:.78rem;">${combi.risico}</div></div>` : ''}
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(219,39,119,.08);border-radius:10px;padding:.65rem .9rem;margin-bottom:.7rem;">
      <div><div style="font-size:.5rem;color:#475569;font-family:monospace;">QUOTE</div><div style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;">${totalOdds.toFixed(2)}</div></div>
      <div style="text-align:center;"><div style="font-size:.5rem;color:#475569;font-family:monospace;">KANS</div><div style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;color:#d97706;">${kansStr}%</div></div>
      <div style="text-align:right;"><div style="font-size:.5rem;color:#475569;font-family:monospace;">€${defaultBet}</div><div style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;color:#16a34a;">€${payout}</div></div>
    </div>
    <button onclick="loadAICombiIntoBuilder()"
      style="width:100%;background:linear-gradient(135deg,rgba(219,39,119,.2),rgba(124,58,237,.2));
      border:1px solid rgba(219,39,119,.35);color:var(--ink);font-family:monospace;font-size:.65rem;
      font-weight:700;padding:.7rem;border-radius:10px;cursor:pointer;">
      🎰 ZET IN BUILDER
    </button>`;
  card.style.display = 'block';
}

function loadAICombiIntoBuilder() {
  const legs = window._lastAICombi;
  if (!legs?.length) return;
  state.combiBuilder = [];
  legs.forEach((l,i) => {
    const match = (state.matches||[]).find(m =>
      m.home.toLowerCase().includes(l.match.split(' vs ')[0]?.trim().toLowerCase().substring(0,5)) ||
      l.match.toLowerCase().includes(m.home.toLowerCase().substring(0,5))
    );
    const matchId = match ? match.id : `ai-${i}-${Date.now()}`;
    state.combiBuilder.push({
      matchId: String(matchId),
      home: match ? match.home : l.match.split(' vs ')[0]?.trim(),
      away: match ? match.away : l.match.split(' vs ')[1]?.trim(),
      pick: l.pick, pickLabel: l.pickLabel,
      odds: parseFloat(l.odds), date: l.datum || ''
    });
  });
  updateCombiBuilder();
  switchScreen('wedstrijden');
  setTimeout(() => document.getElementById('combiBuilder')?.scrollIntoView({behavior:'smooth'}), 300);
}

// ═══════════════════════════════════════════════════════
// SCAN LOG — 100 scans trackrecord voor Play Store
// ═══════════════════════════════════════════════════════

// Sla een voltooide scan op in de log

// ═══════════════════════════════════════════════════════
// SCAN LOG — 100 scans trackrecord voor Play Store
// ═══════════════════════════════════════════════════════

function logScanResult(picks) {
  // v14.9: teamnamen fix, confidence >= 7 filter, dedup op fixtureId+dag
  if (!picks || !picks.length) return;
  const today = new Date().toLocaleDateString('nl-NL');
  const filtered = picks.filter(p => (p.confidence || 0) >= 7);
  if (!filtered.length) return;

  const log = state.scanLog || [];
  const todayIds = new Set();
  log.forEach(scan => {
    if (scan.date === today) {
      scan.picks.forEach(p => { if (p.fixtureId) todayIds.add(String(p.fixtureId) + '_' + p.pick); });
    }
  });

  const newPicks = filtered.map(p => {
    const home = p.match && p.match.home ? p.match.home : (p.home || '');
    const away = p.match && p.match.away ? p.match.away : (p.away || '');
    const fixtureId = (p.match && p.match.id) ? p.match.id : (p.fixtureId || p.id);
    return {
      id:          p.id,
      fixtureId:   fixtureId,
      match:       home + ' vs ' + away,
      comp:        (p.match && p.match.comp) || p.comp || p.compName || '',
      pick:        p.pick || '1',
      pickLabel:   p.pickLabel || p.label || '',
      odds:        parseFloat(p.odds || 2),
      value:       parseFloat(p.value || 0),
      confidence:  parseInt(p.confidence || 7),
      aiKans:      p.kans || 0,
      kelly:       parseFloat((p.kelly || 0).toFixed(1)),
      reason:      p.reason || '',
      poissonUsed: p.poissonUsed || false,
      status:      'pending',
      score:       null,
      verifiedAt:  null
    };
  }).filter(p => {
    const key = String(p.fixtureId) + '_' + p.pick;
    if (todayIds.has(key)) return false;
    todayIds.add(key);
    return true;
  });

  if (!newPicks.length) return;

  log.unshift({
    id: Date.now(),
    date: today,
    time: new Date().toLocaleTimeString('nl-NL', {hour:'2-digit', minute:'2-digit'}),
    picks: newPicks
  });
  state.scanLog = log.slice(0, 100);
  saveState();
}

async function verifyScanLog() {
  const log = state.scanLog || [];
  const pending = [];
  log.forEach(scan => {
    scan.picks.forEach(p => {
      if (p.status === 'pending' && p.fixtureId) pending.push({ scan, pick: p });
    });
  });
  if (!pending.length) return 0;

  const key = state.settings.footballKey || '';
  let verified = 0;

  for (const { pick } of pending) {
    try {
      const res = await apiFetch(
        'https://api-football-v1.p.rapidapi.com/v3/fixtures?id=' + pick.fixtureId, key
      );
      const f = res && res.response && res.response[0];
      if (!f) continue;
      const status = f.fixture && f.fixture.status && f.fixture.status.short;
      if (!['FT','AET','PEN'].includes(status)) continue;

      const home = (f.goals && f.goals.home) || 0;
      const away = (f.goals && f.goals.away) || 0;
      pick.score = home + '-' + away;
      pick.verifiedAt = new Date().toISOString();

      const t = (pick.pick||'').toUpperCase();
      if      (t === '1')    pick.status = home > away   ? 'win' : 'lose';
      else if (t === 'X')    pick.status = home === away  ? 'win' : 'lose';
      else if (t === '2')    pick.status = away > home   ? 'win' : 'lose';
      else if (t === '1X')   pick.status = home >= away  ? 'win' : 'lose';
      else if (t === 'X2')   pick.status = away >= home  ? 'win' : 'lose';
      else if (t === 'O25')  pick.status = (home+away) > 2.5 ? 'win' : 'lose';
      else if (t === 'U25')  pick.status = (home+away) < 2.5 ? 'win' : 'lose';
      else if (t === 'O15')  pick.status = (home+away) > 1.5 ? 'win' : 'lose';
      else if (t === 'O35')  pick.status = (home+away) > 3.5 ? 'win' : 'lose';
      else if (t === 'BTTS') pick.status = (home > 0 && away > 0) ? 'win' : 'lose';
      else pick.status = 'void';

      verified++;
    } catch(e) { /* skip */ }
  }

  if (verified > 0) saveState();
  return verified;
}

function renderScanLog() {
  const el = document.getElementById('scan-log-content');
  if (!el) return;

  const log       = state.scanLog || [];
  const allPicks  = log.flatMap(s => s.picks);
  const settled   = allPicks.filter(p => p.status === 'win' || p.status === 'lose');
  const wins      = settled.filter(p => p.status === 'win');
  const hitrate   = settled.length ? Math.round(wins.length / settled.length * 100) : 0;
  const roi       = settled.length
    ? settled.reduce((s,p) => s + (p.status==='win' ? (p.odds-1) : -1), 0) / settled.length * 100
    : 0;
  const avgValue  = allPicks.length ? allPicks.reduce((s,p) => s+(p.value||0),0)/allPicks.length : 0;

  // Per type
  const byType = {};
  settled.forEach(p => {
    const t = p.pick || '?';
    if (!byType[t]) byType[t] = {wins:0, total:0};
    byType[t].total++;
    if (p.status === 'win') byType[t].wins++;
  });

  // Per competitie
  const byComp = {};
  settled.forEach(p => {
    const c = p.comp || 'Overig';
    if (!byComp[c]) byComp[c] = {wins:0, total:0};
    byComp[c].total++;
    if (p.status === 'win') byComp[c].wins++;
  });

  // Value kalibratie buckets
  const vb = {'0-10%':[], '10-20%':[], '20-30%':[], '30%+':[]};
  settled.forEach(p => {
    const v = p.value||0;
    const b = v<10 ? '0-10%' : v<20 ? '10-20%' : v<30 ? '20-30%' : '30%+';
    vb[b].push(p.status === 'win');
  });

  function statCard(val, lbl, color) {
    return '<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:.6rem .4rem;text-align:center;">'
      + '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.2rem;color:' + color + ';">' + val + '</div>'
      + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.4rem;color:var(--muted);margin-top:.1rem;">' + lbl + '</div>'
      + '</div>';
  }

  function bar(pct, color) {
    return '<div style="flex:1;background:rgba(15,23,42,.08);border-radius:999px;height:6px;">'
      + '<div style="height:100%;border-radius:999px;background:' + color + ';width:' + pct + '%;"></div>'
      + '</div>';
  }

  function hrColor(hr) {
    return hr >= 55 ? '#16a34a' : hr >= 45 ? '#d97706' : '#dc2626';
  }

  let html = '';

  // Header
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">'
    + '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.3rem;color:var(--text);">SCAN LOG</div>'
    + '<div style="display:flex;gap:.4rem;">'
    + '<button class="small-action-btn" onclick="verifyScanLog().then(n=>{showToast(n+\' picks geverifieerd\');renderScanLog();})">🔄 Verificeer</button>'
    + '<button class="small-action-btn" onclick="exportScanLogCSV()">📥 CSV</button>'
    + '<button class="small-action-btn" style="color:#dc2626;" onclick="if(confirm(\'Scan log wissen?\')){state.scanLog=[];saveState();renderScanLog();}">🗑</button>'
    + '</div></div>';

  // Voortgang
  html += '<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:.8rem 1rem;margin-bottom:.8rem;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem;">'
    + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.52rem;color:var(--muted);">VOORTGANG NAAR 100 SCANS</div>'
    + '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.1rem;color:var(--accent);">' + log.length + '/100</div>'
    + '</div>'
    + '<div style="background:rgba(15,23,42,.08);border-radius:999px;height:6px;overflow:hidden;">'
    + '<div style="height:100%;border-radius:999px;background:linear-gradient(90deg,#be185d,#7c3aed);width:' + Math.min(100,log.length) + '%;transition:width .4s;"></div>'
    + '</div></div>';

  // Stats grid
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem;margin-bottom:.8rem;">'
    + statCard(allPicks.length, 'PICKS', '#2563eb')
    + statCard(hitrate + '%', 'HITRATE', hrColor(hitrate))
    + statCard((roi>=0?'+':'') + roi.toFixed(1) + '%', 'ROI', roi>=0?'#16a34a':'#dc2626')
    + statCard(avgValue.toFixed(1) + '%', 'AVG VALUE', '#7c3aed')
    + '</div>';

  // Value kalibratie
  if (settled.length >= 5) {
    html += '<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:.8rem 1rem;margin-bottom:.8rem;">'
      + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:700;color:var(--text);margin-bottom:.6rem;">📐 VALUE KALIBRATIE</div>'
      + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.4rem;">';
    Object.entries(vb).forEach(function(entry) {
      var range = entry[0], results = entry[1];
      var tot = results.length;
      var wr  = tot ? Math.round(results.filter(Boolean).length/tot*100) : null;
      html += '<div style="text-align:center;background:rgba(15,23,42,.04);border-radius:10px;padding:.5rem .3rem;">'
        + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:var(--muted);">' + range + '</div>'
        + '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1rem;color:' + (wr===null?'var(--muted)':hrColor(wr)) + ';">' + (wr===null?'—':wr+'%') + '</div>'
        + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.4rem;color:var(--muted);">' + tot + ' picks</div>'
        + '</div>';
    });
    html += '</div></div>';
  }

  // Per type
  if (Object.keys(byType).length) {
    html += '<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:.8rem 1rem;margin-bottom:.8rem;">'
      + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:700;color:var(--text);margin-bottom:.6rem;">🎯 PER PICK TYPE</div>';
    Object.entries(byType).sort((a,b)=>b[1].total-a[1].total).forEach(function(entry) {
      var type = entry[0], s = entry[1];
      var hr = Math.round(s.wins/s.total*100);
      html += '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem;">'
        + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.52rem;font-weight:700;width:2.5rem;">' + type + '</div>'
        + bar(hr, hrColor(hr))
        + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:var(--muted);width:3.5rem;text-align:right;">' + hr + '% (' + s.total + ')</div>'
        + '</div>';
    });
    html += '</div>';
  }

  // Per competitie
  if (Object.keys(byComp).length > 1) {
    html += '<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:.8rem 1rem;margin-bottom:.8rem;">'
      + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:700;color:var(--text);margin-bottom:.6rem;">🏆 PER COMPETITIE</div>';
    Object.entries(byComp).sort((a,b)=>b[1].total-a[1].total).slice(0,8).forEach(function(entry) {
      var comp = entry[0], s = entry[1];
      var hr = Math.round(s.wins/s.total*100);
      html += '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem;">'
        + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.48rem;flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' + comp + '</div>'
        + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:' + hrColor(hr) + ';font-weight:700;">' + hr + '%</div>'
        + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:var(--muted);">' + s.total + 'x</div>'
        + '</div>';
    });
    html += '</div>';
  }

  // Scan lijst
  html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:700;color:var(--text);margin-bottom:.5rem;">SCANS (' + log.length + ')</div>';

  if (!log.length) {
    html += '<div style="text-align:center;padding:2rem;font-family:\'IBM Plex Mono\',monospace;font-size:.58rem;color:var(--muted);">'
      + 'Nog geen scans. Voer een value scan uit via de Scan &amp; Analyse tab.</div>';
  } else {
    log.forEach(function(scan, si) {
      var sw = scan.picks.filter(p=>p.status==='win').length;
      var sl = scan.picks.filter(p=>p.status==='lose').length;
      var sp = scan.picks.filter(p=>p.status==='pending').length;
      html += '<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:.75rem 1rem;margin-bottom:.5rem;">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem;">'
        + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.52rem;font-weight:700;">#' + (log.length-si) + ' &middot; ' + scan.date + ' ' + scan.time + '</div>'
        + '<div style="display:flex;gap:.3rem;font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;">'
        + (sw ? '<span style="color:#16a34a;font-weight:700;">' + sw + 'W</span>' : '')
        + (sl ? '<span style="color:#dc2626;font-weight:700;">' + sl + 'V</span>' : '')
        + (sp ? '<span style="color:#d97706;">' + sp + '⏳</span>' : '')
        + '</div></div>';
      scan.picks.forEach(function(p) {
        var icon = p.status==='win' ? '✅' : p.status==='lose' ? '❌' : p.status==='void' ? '⬜' : '⏳';
        html += '<div style="display:flex;align-items:center;gap:.4rem;padding:.3rem 0;border-top:1px solid var(--border);">'
          + '<div style="width:1.6rem;text-align:center;font-size:.8rem;">' + icon + '</div>'
          + '<div style="flex:1;min-width:0;">'
          + '<div style="font-family:\'DM Sans\',sans-serif;font-size:.58rem;font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' + p.match + '</div>'
          + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:var(--muted);">' + (p.pickLabel||p.pick) + ' @ ' + p.odds + ' &middot; ' + (p.value||0).toFixed(1) + '% value &middot; conf ' + p.confidence + '/10</div>'
          + '</div>'
          + (p.score ? '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.52rem;font-weight:700;color:var(--muted);">' + p.score + '</div>' : '')
          + '</div>';
      });
      html += '</div>';
    });
  }

  el.innerHTML = html;
}

function exportScanLogCSV() {
  const log = state.scanLog || [];
  if (!log.length) { showToast('Geen scan data'); return; }
  const rows = [['Scan#','Datum','Tijd','Wedstrijd','Competitie','Pick','Odds','Value%','Confidence','Status','Score']];
  log.forEach(function(scan, si) {
    scan.picks.forEach(function(p) {
      rows.push([
        log.length - si, scan.date, scan.time,
        p.match, p.comp||'', p.pickLabel||p.pick,
        p.odds, (p.value||0).toFixed(1), p.confidence,
        p.status, p.score||''
      ]);
    });
  });
  const csv = rows.map(r => r.join(',')).join('\n');
  downloadFile(csv, 'TOTO-AI-scanlog-' + new Date().toISOString().split('T')[0] + '.csv', 'text/csv;charset=utf-8;');
  showToast('📥 Scan log gedownload');
}

// ── Analyse tip knoppen ───────────────────────────────
function openBetFromAnalyse() {
  const tip = state.lastAnalyseTip;
  if (!tip) { showToast('Geen analyse tip beschikbaar'); return; }

  // Zorg dat match in state.matches zit
  const m = state.selectedMatch;
  if (m && !state.matches.find(x => String(x.id) === String(m.id))) {
    state.matches.unshift(m);
  }

  // Vul bet modal
  const title = document.getElementById('bet-modal-title');
  if (title) title.textContent = (tip.home||'') + ' vs ' + (tip.away||'') + ' — ' + (tip.pickLabel||tip.pick) + ' @ ' + tip.odds;

  const matchInput = document.getElementById('bet-match');
  if (matchInput) matchInput.value = (tip.home||'') + ' vs ' + (tip.away||'');

  const stakeInput = document.getElementById('bet-stake');
  if (stakeInput) stakeInput.value = state.settings.defaultBet || 10;

  const oddsInput = document.getElementById('bet-odds');
  if (oddsInput) oddsInput.value = tip.odds;

  const noteInput = document.getElementById('bet-note');
  if (noteInput) noteInput.value = tip.pickLabel || tip.pick;

  // Sla pendingBet op
  pendingBet = {
    match: m || { id: tip.matchId, home: tip.home||'', away: tip.away||'' },
    pick: tip.pick, pickLabel: tip.pickLabel||tip.pick,
    odds: parseFloat(tip.odds), markt: '1X2',
    _origPick: tip.pick, _origPickLabel: tip.pickLabel||tip.pick, _origOdds: parseFloat(tip.odds)
  };

  const modal = document.getElementById('bet-modal');
  if (modal) modal.style.display = 'flex';
}

function addCombiFromAnalyse() {
  const tip = state.lastAnalyseTip;
  if (!tip) { showToast('Geen analyse tip beschikbaar'); return; }
  if (!state.combiBuilder) state.combiBuilder = [];
  const exists = state.combiBuilder.some(l => String(l.matchId) === String(tip.matchId));
  if (exists) { showToast('Al in combi'); return; }
  state.combiBuilder.push({
    matchId: tip.matchId,
    pick: tip.pick,
    pickLabel: tip.pickLabel || tip.pick,
    odds: parseFloat(tip.odds),
    home: tip.home || '',
    away: tip.away || ''
  });
  saveState();
  showToast('➕ ' + (tip.home||'') + ' toegevoegd aan combi');
}
