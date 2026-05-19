// ═══════════════════════════════════════════════════════
// ANALYSE.JS — Value scan, AI analyse, Combi Tips v19.34
// ═══════════════════════════════════════════════════════

// ── Analyse screen render ─────────────────────────────────
function renderAnalyseScreen() {
  const screen = document.getElementById('screen-analyse');
  if (!screen) return;

  const m = state.selectedMatch;
  const hasMatches = (state.matches||[]).some(m => m.homeOdds !== '—');

  screen.innerHTML = `
    <!-- Sub-tabs -->
    <div class="analyse-subtabs">
      <button id="asub-scan" class="asub-btn active" onclick="showAnalyseSubTab('scan')">
        ⚡ Value Scan
      </button>
      <button id="asub-analyse" class="asub-btn inactive" onclick="showAnalyseSubTab('analyse')">
        🤖 AI Analyse
      </button>
      <button id="asub-tips" class="asub-btn inactive" onclick="showAnalyseSubTab('tips')">
        🎯 Combi Tips
      </button>
      <button id="asub-log" class="asub-btn inactive" onclick="showAnalyseSubTab('log')">
        📊 Scan Log
      </button>
    </div>

    <!-- VALUE SCAN tab -->
    <div id="asub-content-scan">
      <div id="analyseScanResults" style="margin-bottom:.5rem;"></div>
      ${hasMatches ? `
      <div style="display:grid;grid-template-columns:1fr auto;gap:.4rem;margin-bottom:.7rem;">
        <button id="valueScanBtn2" onclick="scanValueAll()"
          style="background:linear-gradient(135deg,rgba(22,163,74,.1),rgba(5,150,105,.06));
          border:1.5px solid rgba(22,163,74,.3);color:#15803d;font-family:'IBM Plex Mono',monospace;
          font-size:.65rem;font-weight:800;padding:.65rem;border-radius:12px;cursor:pointer;">
          ⚡ SCAN VALUE — alle geladen wedstrijden
        </button>
        <button onclick="state.matches=[];saveState();showToast('🔄 Wedstrijden gewist — scan opnieuw');renderAnalyseScreen();"
          title="Ververs wedstrijden"
          style="background:rgba(124,58,237,.08);border:1.5px solid rgba(124,58,237,.25);
          color:#7c3aed;font-family:'IBM Plex Mono',monospace;font-size:.7rem;font-weight:800;
          padding:.65rem .8rem;border-radius:12px;cursor:pointer;">
          🔄
        </button>
      </div>` : `
      <div style="text-align:center;padding:2rem 1.25rem;display:flex;flex-direction:column;align-items:center;gap:.7rem;">
        <div style="font-size:2rem;opacity:.3;">⚡</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.56rem;color:var(--sub);line-height:1.75;max-width:240px;">
          Laad eerst wedstrijden via het Wedstrijden tabblad, of gebruik de automatische scan hieronder.
        </div>
        <button onclick="switchScreen('wedstrijden')"
          style="padding:.6rem 1.3rem;border-radius:12px;
          background:linear-gradient(135deg,rgba(219,39,119,.85),rgba(124,58,237,.8));
          color:#fff;border:none;font-family:'IBM Plex Mono',monospace;
          font-size:.62rem;font-weight:800;cursor:pointer;">
          ⚽ Naar Wedstrijden →
        </button>
      </div>`}
      <div id="valueBanner2" style="display:none;"></div>
    </div>

    <!-- AI ANALYSE tab -->
    <div id="asub-content-analyse" style="display:none;">
      ${!m ? `
      <div style="text-align:center;padding:2.5rem 1.25rem;display:flex;flex-direction:column;align-items:center;gap:.7rem;">
        <div style="font-size:2.2rem;opacity:.3;">🤖</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.05rem;color:var(--ink);letter-spacing:.04em;">
          Kies een wedstrijd
        </div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.54rem;color:var(--sub);line-height:1.75;max-width:230px;">
          Tik op een wedstrijd in het Wedstrijden scherm en kies ANALYSE om een diepte-analyse te starten.
        </div>
        <button onclick="switchScreen('wedstrijden')"
          style="padding:.6rem 1.3rem;border-radius:12px;
          background:linear-gradient(135deg,rgba(219,39,119,.85),rgba(124,58,237,.8));
          color:#fff;border:none;font-family:'IBM Plex Mono',monospace;
          font-size:.62rem;font-weight:800;cursor:pointer;letter-spacing:.04em;
          box-shadow:0 4px 14px rgba(219,39,119,.2);margin-top:.2rem;">
          ⚽ Naar Wedstrijden →
        </button>
      </div>` : `
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
      <button id="analyseBtn" onclick="runAnalyse()"
        style="width:100%;background:linear-gradient(135deg,rgba(219,39,119,.85),rgba(124,58,237,.8));
        color:#fff;border:none;border-radius:12px;font-family:'IBM Plex Mono',monospace;
        font-size:.68rem;font-weight:800;padding:.8rem;cursor:pointer;margin-bottom:.85rem;
        letter-spacing:.05em;box-shadow:0 4px 16px rgba(219,39,119,.25);">
        🤖 ANALYSEER — ${m.home} vs ${m.away}
      </button>
      <div id="analyseOutput" style="display:none;">
        <div id="entityChips" style="display:flex;flex-wrap:wrap;gap:.35rem;margin-bottom:.8rem;"></div>
        <div id="rb-vorm"></div><div id="rb-stats"></div><div id="rb-tactiek"></div>
        <div id="rb-kans"></div><div id="rb-risico"></div><div id="rb-advies"></div><div id="rb-tip"></div>
        <div id="matchChatSection" style="display:none;margin-top:.75rem;">
          <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;font-weight:800;color:#7c3aed;">💬 VRAAG AAN AI</div>
            <button onclick="document.getElementById('matchChatSection').style.display='none'"
              style="background:none;border:none;color:var(--sub);cursor:pointer;font-size:.8rem;margin-left:auto;">✕</button>
          </div>
          <div id="chatMessages" style="max-height:280px;overflow-y:auto;margin-bottom:.5rem;"></div>
          <div style="display:flex;gap:.4rem;">
            <input id="chatInput" type="text" placeholder="Stel een vraag over deze wedstrijd..."
              style="flex:1;font-family:monospace;font-size:.6rem;padding:.5rem .7rem;border-radius:10px;
              border:1px solid var(--stroke);background:var(--card);color:var(--ink);outline:none;"
              onkeydown="if(event.key==='Enter')sendMatchChat()">
            <button onclick="sendMatchChat()"
              style="padding:.5rem .75rem;border-radius:10px;background:rgba(124,58,237,.15);
              border:1px solid rgba(124,58,237,.3);color:#7c3aed;cursor:pointer;font-size:.9rem;">➤</button>
          </div>
          <div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.4rem;" id="chatSuggestions"></div>
        </div>
        <button id="openChatBtn" onclick="openMatchChat()"
          style="width:100%;margin-top:.6rem;padding:.5rem;border-radius:10px;
          background:rgba(124,58,237,.08);border:1px solid rgba(124,58,237,.2);
          font-family:monospace;font-size:.58rem;font-weight:700;color:#7c3aed;cursor:pointer;display:none;">
          💬 Stel een vraag aan AI
        </button>
      </div>`}
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
  const scan    = document.getElementById('asub-content-scan');
  const analyse = document.getElementById('asub-content-analyse');
  const tips    = document.getElementById('asub-content-tips');
  const log     = document.getElementById('asub-content-log');
  const btnScan    = document.getElementById('asub-scan');
  const btnAnalyse = document.getElementById('asub-analyse');
  const btnTips    = document.getElementById('asub-tips');
  const btnLog     = document.getElementById('asub-log');
  [scan,analyse,tips,log].forEach(el => { if(el) el.style.display='none'; });
  [btnScan,btnAnalyse,btnTips,btnLog].forEach(b => { if(b) b.className='asub-btn inactive'; });
  if (tab === 'scan') {
    if (scan) scan.style.display = 'block';
    if (btnScan) btnScan.className = 'asub-btn active';
    if (state.valueScans?.length) {
      const sorted = [...state.valueScans].sort((a,b)=>(b.value||-999)-(a.value||-999)).filter(s=>s.value>=5);
      renderAnalyseScanResults(sorted);
    }
  } else if (tab === 'analyse') {
    if (analyse) analyse.style.display = 'block';
    if (btnAnalyse) btnAnalyse.className = 'asub-btn active';
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
  if (window._scanBusy) {
    showToast('⚡ Scan loopt nog even...');
    return;
  }
  // v18.6: max 15 candidates om JSON truncatie te voorkomen bij grote batches
  const candidates = (state.matches||[]).filter(m =>
    m.homeOdds !== '—' && !m.isDone && parseFloat(m.homeOdds) > 1
  ).slice(0, 15);

  if (!candidates.length) {
    showToast('Geen wedstrijden met quotes. Laad eerst wedstrijden.');
    return;
  }

  const btnId = document.getElementById('valueScanBtn') ? 'valueScanBtn' : 'valueScanBtn2';
  const btn = document.getElementById(btnId);
  if (btn) { btn.disabled = true; btn.textContent = `⟳ SCANNEN (${candidates.length})...`; }
  state.valueScans = [];
  window._scanBusy = true;

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
          const [h2h, homeForm, awayForm, hStats, aStats, injuries, standings, predictions] = await Promise.all([
            wt(fetchH2H(m.homeId, m.awayId), 4000),
            wt(fetchTeamForm(m.homeId), 4000),
            wt(fetchTeamForm(m.awayId), 4000),
            wt(fetchTeamStats(m.homeId, leagueId || 88), 4000),
            wt(fetchTeamStats(m.awayId, leagueId || 88), 4000),
            wt(fetchInjuries(m.id), 3000),
            wt(fetchStandings(leagueId || m.leagueId, null), 4000),
            wt(fetchPredictions(m.id), 5000),
          ]);
          // v18.9: xG ophalen uit fixture statistics
          const [homeXG, awayXG] = await Promise.all([
            wt(typeof fetchXGFromFixtures === 'function' ? fetchXGFromFixtures(m.homeId, homeForm) : Promise.resolve([]), 5000),
            wt(typeof fetchXGFromFixtures === 'function' ? fetchXGFromFixtures(m.awayId, awayForm) : Promise.resolve([]), 5000),
          ]);
          let conf = 4;
          if (h2h?.length >= 3) conf += 2; else if (h2h?.length) conf += 1;
          if (homeForm?.length >= 5 && awayForm?.length >= 5) conf += 2;
          else if (homeForm?.length && awayForm?.length) conf += 1;

          // Blessure factoren berekenen
          const homeInjFactor = injuries ? calcInjuryFactor(injuries, m.homeId) : null;
          const awayInjFactor  = injuries ? calcInjuryFactor(injuries, m.awayId)  : null;
          if (homeInjFactor?.count) conf = Math.max(1, conf - Math.min(2, homeInjFactor.count));
          if (awayInjFactor?.count)  conf = Math.max(1, conf - Math.min(1, awayInjFactor.count));

          // Stand & motivatie
          const homeStanding = standings ? extractStandingInfo(standings, m.homeId) : null;
          const awayStanding  = standings ? extractStandingInfo(standings, m.awayId)  : null;

          // Gewogen H2H
          const h2hWeighted = h2h?.length ? calcWeightedH2H(h2h, m.homeId, m.awayId) : null;
          if (h2hWeighted?.count >= 5) conf = Math.min(10, conf + 1);

          // Competitie fase
          const played = homeStanding?.played || 0;
          const compPhase = getCompetitionPhase(played);

          const homeGoalStats = hStats ? extractTeamGoalStats(hStats, homeForm, homeXG||[]) : null;
          const awayGoalStats = aStats ? extractTeamGoalStats(aStats, awayForm, awayXG||[])  : null;

          // Motivatie factor meenemen in Poisson
          const homeMotFactor = homeStanding?.motivatieFactor || 1.0;
          const awayMotFactor  = awayStanding?.motivatieFactor  || 1.0;
          const homeInjAdj = homeInjFactor || null;
          const awayInjAdj  = awayInjFactor  || null;

          const poisson = calcPoissonKansen(homeGoalStats, awayGoalStats, m.leagueId || leagueId || 1.35, homeInjAdj, awayInjAdj);
          if (poisson.valid) conf = Math.min(10, conf + 1 + (poisson.hasXG ? 1 : 0));

          const market = analyzeMarketMovement(m.id, parseFloat(m.homeOdds)||0, parseFloat(m.drawOdds)||0, parseFloat(m.awayOdds)||0);
          conf = Math.min(10, Math.max(1, conf + (market.confDelta||0)));

          const h2hCount   = h2h?.length    || 0;
          const homeGames  = homeForm?.length || 0;
          const awayGames  = awayForm?.length || 0;
          const dataQuality = h2hCount + homeGames + awayGames;
          const isSparseData = dataQuality < 5;

          let finalConf = Math.min(10, conf);
          if (isSparseData) finalConf = Math.min(finalConf, 5);
          else if (dataQuality < 8) finalConf = Math.min(finalConf, 7);

          // Blessure context string voor AI prompt
          let injuryContext = '';
          if (homeInjFactor?.count) injuryContext += `\n   🏥 ${m.home} blessures: ${homeInjFactor.players.join(', ')} (aanval ${Math.round((1-homeInjFactor.attackFactor)*100)}%↓, verdediging ${Math.round((1-homeInjFactor.defenseFactor)*100)}%↓)`;
          if (awayInjFactor?.count)  injuryContext += `\n   🏥 ${m.away} blessures: ${awayInjFactor.players.join(', ')} (aanval ${Math.round((1-awayInjFactor.attackFactor)*100)}%↓, verdediging ${Math.round((1-awayInjFactor.defenseFactor)*100)}%↓)`;

          // Stand context voor AI prompt
          let standingContext = '';
          if (homeStanding) standingContext += `\n   📊 ${m.home}: pos ${homeStanding.pos}/${homeStanding.total}, ${homeStanding.pts}pt, GD ${homeStanding.gd>0?'+':''}${homeStanding.gd}${homeStanding.motivatieLabel ? ' — '+homeStanding.motivatieLabel : ''}`;
          if (awayStanding)  standingContext += `\n   📊 ${m.away}: pos ${awayStanding.pos}/${awayStanding.total}, ${awayStanding.pts}pt, GD ${awayStanding.gd>0?'+':''}${awayStanding.gd}${awayStanding.motivatieLabel ? ' — '+awayStanding.motivatieLabel : ''}`;

          // Predictions verwerken — extra confidence als beschikbaar
          const predContext = predictions ? formatPredictions(predictions, m.home, m.away) : '';
          if (predictions?.percent?.home !== null) conf = Math.min(10, conf + 1);

          matchDataMap[m.id] = {
            h2h:           h2hCount   ? formatH2HCompact(h2h.slice(0,5), m.home, m.away)        : '',
            homeForm:      homeGames  ? formatFormCompact(homeForm.slice(0,5), m.homeId, m.home) : '',
            awayForm:      awayGames  ? formatFormCompact(awayForm.slice(0,5), m.awayId, m.away) : '',
            poisson, market,
            homeInjFactor, awayInjFactor, injuryContext,
            homeStanding, awayStanding, standingContext,
            h2hWeighted, compPhase,
            predictions, predContext,
            confidence: finalConf,
            dataQuality, isSparseData,
            h2hCount, homeGames, awayGames
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
      if (p?.valid) line += `\n   📐 Poisson: 1=${p.k1}% X=${p.kX}% 2=${p.k2}%${p.injLabel||''}`;
      if (d.homeForm) line += `\n   Vorm ${m.home}: ${d.homeForm}`;
      if (d.awayForm) line += `\n   Vorm ${m.away}: ${d.awayForm}`;
      if (d.h2h) line += `\n   H2H: ${d.h2h}`;
      if (d.h2hWeighted) line += ` [gewogen: thuis ${d.h2hWeighted.homeWinPct}% / gelijk ${d.h2hWeighted.drawPct}% / uit ${d.h2hWeighted.awayWinPct}%]`;
      if (d.market?.direction !== 'none') line += `\n   Markt: ${d.market?.label||''}`;
      if (d.injuryContext) line += d.injuryContext;
      if (d.standingContext) line += d.standingContext;
      if (d.compPhase?.label) line += `\n   🗓 Fase: ${d.compPhase.label}`;
      if (d.predContext) line += `\n   ${d.predContext.split('\n').join('\n   ')}`;
      if (d.isSparseData) line += `\n   ⚠️ DATA SCHAARS (H2H:${d.h2hCount||0} wedstr, vorm:${(d.homeGames||0)+(d.awayGames||0)} wedstr) — max confidence 5`;
      else if (d.dataQuality < 8) line += `\n   📊 Beperkte data (${d.dataQuality} wedstr totaal) — wees voorzichtig`;
      return line;
    }).join('\n\n');

    const dynamicTokens = Math.min(4000, Math.max(1500, candidates.length * 130));
    const data = await anthropicFetch(null, {
      model: 'claude-sonnet-4-6',
      max_tokens: dynamicTokens,
      temperature: 0,
      system: `RESPOND WITH VALID JSON ONLY. NO TEXT BEFORE OR AFTER JSON. START WITH { END WITH }.
{"scans":[{"id":"123","kans1":45,"kansX":30,"kans2":25,"confidence":7,"reason":"max 12 woorden concreet"}]}

DRIE ANKERS — gebruik alle drie als beschikbaar:
1. POISSON (📐): statistisch model op doelpuntengemiddelden + xG
2. API PREDICTIONS (📊/💡): externe kansberekening van API-Football (onafhankelijk model)
3. CONTEXT: vorm, H2H gewogen, blessures, motivatie, fase

WEGING:
- Als alle drie beschikbaar: Poisson 35% + API pred 30% + context 35%
- Als Poisson + API pred: elk 40% + context 20%
- Als alleen Poisson: Poisson 50% + context 50%
- API pred advies ("thuisploeg wint") = extra signaalbevestiging, niet blind volgen

ANALYSE REGELS:
- kans1+kansX+kans2 MOET exact 100 zijn
- Thuisvoordeel: +3-5pp voor thuisploeg tenzij vorm/API anders aangeeft
- Vorm weegt zwaarder dan seizoensgemiddelden (laatste 5 wedstrijden)
- GEWOGEN H2H: recente duels wegen zwaarder
- BLESSURES: 🏥 sterspelers missen → pas kansen aan (-3 tot -8pp aanvalskans betrokken team)
- MOTIVATIE: 😴 niets_te_winnen → -5 tot -8pp; 🔴 degradatie → +5pp; 🏆 titel → +3pp
- COMPETITIE FASE: 🏁 einde seizoen = rotatie → meer onzekerheid, hogere kansX
- CONVERGENTIE BONUS: als Poisson + API pred + vorm hetzelfde aangeven → confidence +1
- DIVERGENTIE: als Poisson en API pred sterk afwijken (>15pp) → confidence -1, noteer in reason

VALUE DETECTIE:
- reason = sterkste argument voor de pick (max 12 woorden, concreet met cijfers)
- confidence 8-10: meerdere ankers bevestigen + consistente signalen
- confidence 6-7: 1-2 ankers bevestigen, 1 conflicterend signaal
- confidence 1-5: schaarse data of sterke divergentie tussen ankers

SCHAARSE DATA:
- "DATA SCHAARS" label: confidence MAX 5, wijk max 5pp af van Poisson/API pred
- "Beperkte data": confidence MAX 7
- Geen uitleg buiten JSON`,
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

      // Blend Poisson + AI — dynamische weging op databeschikbaarheid
      const poisson = matchDataMap[s.id]?.poisson;
      if (poisson?.valid) {
        const d = matchDataMap[s.id];
        const dq = d.dataQuality || 0;
        const pw = Math.min(0.65,
          0.40
          + (poisson.hasXG ? 0.08 : 0)
          + (d.h2hCount >= 3 ? 0.04 : 0)
          + (d.homeGames >= 5 ? 0.05 : 0)
          + (d.awayGames >= 5 ? 0.05 : 0)
        );
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

      // Value berekenen met overround correctie
      const makePick = (pick, pickLabel, kans, oddsStr) => {
        const odds = parseFloat(oddsStr) || 0;
        if (!odds || odds <= 1) return null;
        const val = typeof calcValueFair === 'function'
          ? calcValueFair(kans, odds, match.homeOdds, match.drawOdds, match.awayOdds)
          : calcValue(kans, odds);
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

      const dataConf    = matchDataMap[s.id]?.confidence || 4;
      const aiConf      = Math.max(1, Math.min(10, parseInt(s.confidence) || 5));
      const isSparse    = matchDataMap[s.id]?.isSparseData || false;
      const dataQuality = matchDataMap[s.id]?.dataQuality  || 0;

      let confidence = Math.min(10, Math.round((dataConf + aiConf) / 2) + (poisson?.valid ? 1 : 0));
      if (isSparse)          confidence = Math.min(confidence, 5);
      else if (dataQuality < 8) confidence = Math.min(confidence, 7);

      if (isSparse && best.value > 10) {
        best.value = Math.min(best.value, 10);
      } else if (dataQuality < 8 && best.value > 20) {
        best.value = Math.min(best.value, 20);
      }

      return {
        id: s.id, match,
        pick: best.pick, pickLabel: best.pickLabel,
        kans: best.kans, odds: best.odds,
        bookmaker: best.bookmaker,
        value: best.value, kelly: best.kelly,
        confidence, allPicks: picks,
        poissonUsed:  poisson?.valid || false,
        poissonK1:    poisson?.k1, poissonKX: poisson?.kX, poissonK2: poisson?.k2,
        market:       market?.direction !== 'none' ? market : null,
        rawValue,     reason: s.reason || '',
        isSparseData: isSparse,
        dataQuality,
        _hasXG: poisson?.hasXG || false,
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

    // Sla scan resultaten op
    state.lastScanResults = scans.map(s => ({
      matchId: s.match.id,
      home: s.match.home, away: s.match.away, comp: s.match.comp,
      pick: s.pick, pickLabel: s.pickLabel,
      value: s.value, confidence: s.confidence, odds: s.odds,
      reason: s.reason || '', kelly: s.kelly || 0,
      poissonUsed: s.poissonUsed || false
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
    renderAnalyseScanResults(displayScans);
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

  window._scanBusy = false;
  if (btn) { btn.disabled = false; btn.textContent = '⚡ OPNIEUW SCANNEN'; }
}

function renderValueBannerInAnalyse(displayScans, total) {
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
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);">${s.pickLabel} · ${s.kans}%${s.poissonUsed?(s._hasXG?' (P+AI+xG)':' (P+AI)'):s._hasXG?' (xG)':''} · ${s.reason}</div>
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

function renderAnalyseScanResults(scans) {
  const el = document.getElementById('analyseScanResults');
  if (!el) return;
  if (!scans || !scans.length) { el.innerHTML = ''; return; }

  const DREMPEL = { minValue: 8, minConf: 6 };
  const teltMee  = scans.filter(s => !s.isSparseData && s.value >= DREMPEL.minValue && (s.confidence||0) >= DREMPEL.minConf);
  const teltNiet = scans.filter(s =>  s.isSparseData || s.value <  DREMPEL.minValue || (s.confidence||0) <  DREMPEL.minConf);

  const makeCard = (s, geldig) => {
    const home = s.match?.home || s.home || '?';
    const away = s.match?.away || s.away || '?';
    const matchDate = s.match?.date || s.date || '';
    const matchTime = s.match?.time || s.time || '';
    const comp = s.match?.comp || s.comp || '';
    const value = s.value || 0;
    const conf = s.confidence || 0;
    const odds = s.odds || 0;
    const valColor = !geldig ? '#94a3b8' : value >= 20 ? '#15803d' : value >= 10 ? '#b45309' : '#64748b';
    const valBg = !geldig ? 'rgba(148,163,184,.08)' : value >= 20 ? 'rgba(22,163,74,.1)' : value >= 10 ? 'rgba(180,83,9,.08)' : 'rgba(100,116,139,.08)';
    const valLabel = !geldig ? 'TELT NIET MEE' : value >= 20 ? '🏆 HOGE VALUE' : value >= 10 ? '⚡ VALUE' : '📊 LAGE VALUE';
    const redenen = [];
    if (s.isSparseData) redenen.push('data schaars');
    if (value < DREMPEL.minValue) redenen.push(`value < ${DREMPEL.minValue}%`);
    if (conf < DREMPEL.minConf) redenen.push(`conf < ${DREMPEL.minConf}/10`);

    const div = document.createElement('div');
    div.style.cssText = `background:var(--card);border:1px solid var(--stroke);border-radius:16px;
      padding:.85rem 1rem;margin-bottom:.6rem;cursor:pointer;
      border-left:${geldig && value >= 20 ? '4px solid #15803d' : geldig && value >= 10 ? '4px solid #b45309' : '1px solid var(--stroke)'};
      ${!geldig ? 'opacity:.5;' : ''}`;

    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.45rem;">
        <div style="flex:1;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);">${comp}</div>
          <div style="font-family:'DM Sans',sans-serif;font-size:.95rem;font-weight:700;color:var(--ink);margin:.15rem 0;">${home} vs ${away}</div>
          ${matchDate ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);">📅 ${matchDate}${matchTime ? ' ' + matchTime : ''}</div>` : ''}
        </div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;font-weight:800;
          padding:2px 8px;border-radius:6px;background:${valBg};color:${valColor};white-space:nowrap;margin-left:.5rem;">
          ${valLabel}${geldig ? ' +' + Math.round(value) + '%' : (redenen.length ? ' · ' + redenen.join(', ') : '')}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;">
        <span style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;">${s.pickLabel||s.pick||''}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);">
          ${s.kans||'?'}%${s.poissonUsed?(s._hasXG?' (P+AI+xG)':' (P+AI)'):''} · ${s.reason||''}
        </span>
        <span style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:#be185d;margin-left:auto;">${odds.toFixed(2)}</span>
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);margin-bottom:${geldig?'.5rem':'0'};">
        ${'⭐'.repeat(Math.min(Math.round(conf/2),5))} ${conf}/10 conf · ½K ${(s.kelly||0).toFixed(1)}%
      </div>
      ${geldig ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;">
        <button class="scan-inzet-btn"
          style="padding:.5rem;border-radius:10px;background:linear-gradient(135deg,rgba(219,39,119,.85),rgba(124,58,237,.7));
          color:#fff;border:none;font-family:'IBM Plex Mono',monospace;font-size:.55rem;font-weight:800;cursor:pointer;"
          data-mid="${s.match?.id||s.id||''}" data-pick="${s.pick||''}" data-label="${(s.pickLabel||'').replace(/"/g,'')}" data-odds="${odds}">
          💰 INZETTEN
        </button>
        <button class="scan-combi-btn"
          style="padding:.5rem;border-radius:10px;background:rgba(124,58,237,.1);
          border:1px solid rgba(124,58,237,.25);color:#7c3aed;font-family:'IBM Plex Mono',monospace;
          font-size:.55rem;font-weight:800;cursor:pointer;"
          data-mid="${s.match?.id||s.id||''}" data-pick="${s.pick||''}" data-label="${(s.pickLabel||'').replace(/"/g,'')}"
          data-odds="${odds}" data-home="${home}" data-away="${away}">
          + COMBI
        </button>
      </div>` : ''}`;

    div.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      if (typeof openCardPopup === 'function') {
        openCardPopup('scan', {
          id: String(s.match?.id||s.id||''), match: {id: String(s.match?.id||s.id||'')},
          home, away, pick: s.pick, pickLabel: s.pickLabel,
          odds, value, confidence: conf,
          reason: s.reason||'', poissonUsed: s.poissonUsed||false, isSparseData: s.isSparseData||false
        });
      }
    });
    return div;
  };

  // Bouw container
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-bottom:.5rem;';

  // Header
  const hdr = document.createElement('div');
  hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;';
  hdr.innerHTML = `<div style="font-family:'IBM Plex Mono',monospace;font-size:.6rem;font-weight:800;color:#15803d;">
    ⚡ SCAN RESULTATEN · ${teltMee.length} picks <span style="color:var(--sub);font-weight:400;">van ${scans.length}</span></div>
    <button onclick="document.getElementById('analyseScanResults').innerHTML=''"
      style="background:none;border:none;color:var(--sub);cursor:pointer;font-size:.85rem;">✕</button>`;
  wrap.appendChild(hdr);

  teltMee.forEach(s => wrap.appendChild(makeCard(s, true)));

  if (teltNiet.length) {
    const sep = document.createElement('div');
    sep.style.cssText = 'font-family:\'IBM Plex Mono\',monospace;font-size:.48rem;color:var(--sub);padding:.3rem 0;margin:.3rem 0;border-top:1px solid var(--stroke);';
    sep.textContent = 'ONDER DREMPEL (value ≥8%, conf ≥6/10)';
    wrap.appendChild(sep);
    teltNiet.forEach(s => wrap.appendChild(makeCard(s, false)));
  }

  el.appendChild(wrap);

  // Event delegation knoppen
  el.querySelectorAll('.scan-inzet-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (typeof openBetModal === 'function')
        openBetModal(null, btn.dataset.mid, btn.dataset.pick, btn.dataset.label, parseFloat(btn.dataset.odds));
    });
  });
  el.querySelectorAll('.scan-combi-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (typeof addValuePickToCombi === 'function')
        addValuePickToCombi(btn.dataset.mid, btn.dataset.pick, btn.dataset.label,
          parseFloat(btn.dataset.odds), btn.dataset.home, btn.dataset.away);
    });
  });
}

// ── Universele Card Pop-up ────────────────────────────────
function openCardPopup(type, data) {
  document.getElementById('cardPopupOverlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'cardPopupOverlay';
  overlay.style.cssText = `position:fixed;inset:0;z-index:9999;
    background:rgba(15,23,42,.65);backdrop-filter:blur(6px);
    display:flex;align-items:flex-end;justify-content:center;`;
  overlay.onclick = e => { if(e.target===overlay) overlay.remove(); };

  const close = `<button onclick="document.getElementById('cardPopupOverlay').remove()"
    style="background:rgba(15,23,42,.08);border:none;border-radius:50%;
    width:2rem;height:2rem;font-size:1rem;cursor:pointer;color:var(--ink);">✕</button>`;

  let content = '';

  if (type === 'scan') {
    const s = data;
    const valColor = (s.value||0) >= 15 ? '#15803d' : (s.value||0) >= 8 ? '#b45309' : '#64748b';
    const tvSign = (s.value||0) > 0 ? '+' : '';
    const confColor = (s.confidence||0) >= 8 ? '#16a34a' : (s.confidence||0) >= 6 ? '#d97706' : '#dc2626';
    content = `
      <div style="font-family:'DM Sans',sans-serif;font-size:1.1rem;font-weight:800;color:var(--ink);margin-bottom:.2rem;">
        ${s.home||s.match?.home||'?'} vs ${s.away||s.match?.away||'?'}
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);margin-bottom:.85rem;">
        ${s.comp||''} · ${s.date||''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;margin-bottom:.85rem;">
        <div style="background:rgba(219,39,119,.1);border:1px solid rgba(219,39,119,.2);border-radius:12px;padding:.6rem;text-align:center;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.42rem;color:#be185d;font-weight:700;">PICK</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.58rem;font-weight:800;color:#be185d;margin-top:.2rem;">${s.pickLabel||s.pick||'?'}</div>
        </div>
        <div style="background:rgba(22,163,74,.1);border:1px solid rgba(22,163,74,.2);border-radius:12px;padding:.6rem;text-align:center;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.42rem;color:#15803d;font-weight:700;">ODDS</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.35rem;color:#15803d;line-height:1;">${parseFloat(s.odds||0).toFixed(2)}</div>
        </div>
        <div style="background:rgba(${(s.value||0)>=8?'22,163,74':'180,83,9'},.1);border:1px solid rgba(${(s.value||0)>=8?'22,163,74':'180,83,9'},.2);border-radius:12px;padding:.6rem;text-align:center;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.42rem;color:${valColor};font-weight:700;">VALUE</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.35rem;color:${valColor};line-height:1;">${tvSign}${Math.round(s.value||0)}%</div>
        </div>
      </div>
      <div style="background:rgba(255,255,255,.7);border:1px solid var(--stroke);border-radius:12px;padding:.65rem .85rem;margin-bottom:.75rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.35rem;">
          <span style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;font-weight:800;color:var(--sub);">🎯 CONFIDENCE</span>
          <span style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:${confColor};">${s.confidence||'?'}/10</span>
        </div>
        <div style="background:rgba(0,0,0,.08);border-radius:999px;height:7px;overflow:hidden;">
          <div style="background:${confColor};width:${Math.round((s.confidence||0)/10*100)}%;height:100%;border-radius:999px;"></div>
        </div>
        ${s.poissonUsed ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:#7c3aed;margin-top:.3rem;">📐 Poisson + AI${s._hasXG?' + xG':''} model gebruikt</div>` : ''}
        ${s.isSparseData ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:#dc2626;margin-top:.2rem;">⚠️ Data schaars</div>` : ''}
      </div>
      ${s.reason ? `<div style="background:rgba(255,255,255,.8);border-left:3px solid ${valColor};border-radius:0 12px 12px 0;padding:.65rem .85rem;margin-bottom:.75rem;font-size:.8rem;color:#1e293b;line-height:1.7;">${s.reason}</div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;">
        <button onclick="document.getElementById('cardPopupOverlay').remove();openBetModal(null,'${s.match?.id||s.id||''}','${s.pick||''}','${(s.pickLabel||'').replace(/'/g,"\\'")}',${s.odds||2})"
          style="padding:.7rem;border-radius:12px;background:linear-gradient(135deg,rgba(219,39,119,.85),rgba(219,39,119,.6));color:#fff;border:none;font-family:'IBM Plex Mono',monospace;font-size:.62rem;font-weight:800;cursor:pointer;">💶 SINGLE BET</button>
        <button onclick="document.getElementById('cardPopupOverlay').remove();switchScreen('wedstrijden');setTimeout(()=>selectMatchAndAnalyse('${s.match?.id||s.id||''}'),100)"
          style="padding:.7rem;border-radius:12px;background:linear-gradient(135deg,rgba(124,58,237,.85),rgba(124,58,237,.6));color:#fff;border:none;font-family:'IBM Plex Mono',monospace;font-size:.62rem;font-weight:800;cursor:pointer;">🤖 ANALYSEER</button>
      </div>`;

  } else if (type === 'bet') {
    const b = data;
    const isOpen = b.status === 'pending' || b.status === 'open';
    const isWin = b.status === 'win';
    const pnl = isWin ? (b.stake*(b.odds-1)) : isOpen ? 0 : -(b.stake||0);
    const pnlColor = isWin ? '#15803d' : isOpen ? '#d97706' : '#dc2626';
    const statusLabel = isWin ? '✅ GEWONNEN' : isOpen ? '⏳ OPEN' : '❌ VERLOREN';
    content = `
      <div style="font-family:'DM Sans',sans-serif;font-size:1.1rem;font-weight:800;color:var(--ink);margin-bottom:.2rem;">${b.match||b.matchName||'?'}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);margin-bottom:.85rem;">${b.date||''} · ${b.markt||'1X2'}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;margin-bottom:.85rem;">
        <div style="background:rgba(219,39,119,.08);border:1px solid rgba(219,39,119,.2);border-radius:12px;padding:.6rem;text-align:center;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.42rem;color:#be185d;font-weight:700;">PICK</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.58rem;font-weight:800;color:#be185d;margin-top:.2rem;">${b.pickLabel||b.pick||'?'}</div>
        </div>
        <div style="background:rgba(22,163,74,.08);border:1px solid rgba(22,163,74,.2);border-radius:12px;padding:.6rem;text-align:center;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.42rem;color:#15803d;font-weight:700;">INZET @ ODDS</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:#15803d;line-height:1.2;">€${b.stake||0} @ ${parseFloat(b.odds||0).toFixed(2)}</div>
        </div>
        <div style="background:rgba(${isWin?'22,163,74':isOpen?'180,83,9':'220,38,38'},.08);border:1px solid rgba(${isWin?'22,163,74':isOpen?'180,83,9':'220,38,38'},.2);border-radius:12px;padding:.6rem;text-align:center;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.42rem;color:${pnlColor};font-weight:700;">STATUS</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.56rem;font-weight:800;color:${pnlColor};margin-top:.2rem;">${statusLabel}</div>
        </div>
      </div>
      ${b.note ? `<div style="background:rgba(255,255,255,.7);border:1px solid var(--stroke);border-radius:10px;padding:.6rem .8rem;margin-bottom:.75rem;font-family:'IBM Plex Mono',monospace;font-size:.54rem;color:var(--ink);">📝 ${b.note}</div>` : ''}
      ${!isOpen ? `<div style="background:rgba(${isWin?'22,163,74':'220,38,38'},.08);border:1px solid rgba(${isWin?'22,163,74':'220,38,38'},.2);border-radius:12px;padding:.7rem;text-align:center;margin-bottom:.75rem;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);">RESULTAAT</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;color:${pnlColor};">${isWin?'+':''}€${Math.abs(pnl).toFixed(2)}</div>
      </div>` : ''}`;

  } else if (type === 'match') {
    const m = data;
    content = `
      <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.85rem;">
        ${m.homeLogo ? `<img src="${m.homeLogo}" style="width:2.5rem;height:2.5rem;object-fit:contain;">` : ''}
        <div style="flex:1;text-align:center;">
          <div style="font-family:'DM Sans',sans-serif;font-size:.95rem;font-weight:800;color:var(--ink);">${m.home} vs ${m.away}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);">${m.comp||''} · ${m.date||''} ${m.time||''}</div>
        </div>
        ${m.awayLogo ? `<img src="${m.awayLogo}" style="width:2.5rem;height:2.5rem;object-fit:contain;">` : ''}
      </div>
      ${m.homeOdds !== '—' ? `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;margin-bottom:.85rem;">
        <div style="background:rgba(22,163,74,.08);border:1px solid rgba(22,163,74,.2);border-radius:12px;padding:.65rem;text-align:center;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);font-weight:700;">1 THUIS</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:#15803d;">${m.homeOdds}</div>
        </div>
        <div style="background:rgba(180,83,9,.08);border:1px solid rgba(180,83,9,.2);border-radius:12px;padding:.65rem;text-align:center;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);font-weight:700;">X GELIJK</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:#b45309;">${m.drawOdds}</div>
        </div>
        <div style="background:rgba(220,38,38,.08);border:1px solid rgba(220,38,38,.2);border-radius:12px;padding:.65rem;text-align:center;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);font-weight:700;">2 UIT</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:#dc2626;">${m.awayOdds}</div>
        </div>
      </div>` : `<div style="font-family:'IBM Plex Mono',monospace;font-size:.54rem;color:var(--sub);text-align:center;padding:.75rem;margin-bottom:.75rem;">Geen odds beschikbaar</div>`}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;">
        <button onclick="document.getElementById('cardPopupOverlay').remove();selectMatchAndAnalyse('${m.id}')"
          style="padding:.7rem;border-radius:12px;background:linear-gradient(135deg,rgba(219,39,119,.85),rgba(219,39,119,.6));color:#fff;border:none;font-family:'IBM Plex Mono',monospace;font-size:.62rem;font-weight:800;cursor:pointer;">🤖 ANALYSEER</button>
        <button onclick="document.getElementById('cardPopupOverlay').remove();addValuePickToCombi('${m.id}','1','${(m.home||'').replace(/'/g,"\\'")} wint',${m.homeOdds||2},'${(m.home||'').replace(/'/g,"\\'")}','${(m.away||'').replace(/'/g,"\\'")}')"
          style="padding:.7rem;border-radius:12px;background:linear-gradient(135deg,rgba(124,58,237,.85),rgba(124,58,237,.6));color:#fff;border:none;font-family:'IBM Plex Mono',monospace;font-size:.62rem;font-weight:800;cursor:pointer;">➕ COMBI</button>
      </div>`;
  }

  overlay.innerHTML = `
    <div style="width:100%;max-width:520px;max-height:92vh;overflow-y:auto;
      background:linear-gradient(160deg,#fdf4ff,#f0f4ff);
      border-radius:24px 24px 0 0;padding:1.2rem 1.1rem 2rem;
      box-shadow:0 -8px 40px rgba(15,23,42,.2);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.9rem;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.2rem;
          background:linear-gradient(135deg,#be185d,#7c3aed);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;">
          ${type==='scan'?'VALUE PICK':type==='bet'?'BET DETAILS':type==='match'?'WEDSTRIJD':'TIP'}
        </div>
        ${close}
      </div>
      ${content}
    </div>`;

  document.body.appendChild(overlay);
}

function openValueAnalysis(matchId) {
  // Eerst zoeken in valueScans voor pop-up
  const scan = (state.valueScans||[]).find(s =>
    String(s.match?.id||s.id) === String(matchId)
  );
  if (scan) {
    openCardPopup('scan', scan);
    return;
  }
  // Fallback: navigeer naar analyse tab
  const match = (state.matches||[]).find(m => String(m.id) === String(matchId));
  if (match) selectMatch(match);
  switchScreen('analyse');
  setTimeout(() => showAnalyseSubTab('analyse'), 80);
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

    const [h2h, homeForm, awayForm, hStats, aStats, lineups, injuries, standings, predictions] = await Promise.all([
      wt(fetchH2H(m.homeId, m.awayId), 5000),
      wt(fetchTeamForm(m.homeId), 5000),
      wt(fetchTeamForm(m.awayId), 5000),
      wt(fetchTeamStats(m.homeId, leagueId || 88), 5000),
      wt(fetchTeamStats(m.awayId, leagueId || 88), 5000),
      wt(fetchLineups(m.id), 4000),
      wt(fetchInjuries(m.id), 3000),
      wt(fetchStandings(leagueId || m.leagueId, null), 4000),
      wt(fetchPredictions(m.id), 5000),
    ]);

    // v18.9: xG ophalen uit fixture statistics voor betere Poisson
    const [homeXG, awayXG] = await Promise.all([
      wt(typeof fetchXGFromFixtures === 'function' ? fetchXGFromFixtures(m.homeId, homeForm) : Promise.resolve([]), 5000),
      wt(typeof fetchXGFromFixtures === 'function' ? fetchXGFromFixtures(m.awayId, awayForm) : Promise.resolve([]), 5000),
    ]);

    // Poisson met xG
    const homeGoalStats = hStats ? extractTeamGoalStats(hStats, homeForm, homeXG||[]) : null;
    const awayGoalStats = aStats ? extractTeamGoalStats(aStats, awayForm, awayXG||[]) : null;
    const poisson = calcPoissonKansen(homeGoalStats, awayGoalStats, leagueId || 1.35);

    if (btn) btn.textContent = '⟳ AI ANALYSE...';

    const h2hStr = h2h?.length ? formatH2HCompact(h2h.slice(0,5), m.home, m.away) : 'geen data';
    const homeFormStr = homeForm?.length ? formatFormCompact(homeForm.slice(0,5), m.homeId, m.home) : 'geen data';
    const awayFormStr = awayForm?.length ? formatFormCompact(awayForm.slice(0,5), m.awayId, m.away) : 'geen data';
    const poissonStr = poisson.valid ? `Poisson: 1=${poisson.k1}% X=${poisson.kX}% 2=${poisson.k2}%${poisson.injLabel||''}` : 'geen statdata';
    const formationStr = lineups?.length ? `${lineups[0]?.team?.name||m.home}: ${lineups[0]?.formation||'?'} vs ${lineups[1]?.team?.name||m.away}: ${lineups[1]?.formation||'?'}` : 'nog niet bekend';

    // Blessure context
    const homeInj = injuries ? calcInjuryFactor(injuries, m.homeId) : null;
    const awayInj  = injuries ? calcInjuryFactor(injuries, m.awayId)  : null;
    const injStr = [
      homeInj?.count ? `${m.home} blessures: ${homeInj.players.join(', ')} (aanval -${Math.round((1-homeInj.attackFactor)*100)}%, verdediging -${Math.round((1-homeInj.defenseFactor)*100)}%)` : '',
      awayInj?.count  ? `${m.away} blessures: ${awayInj.players.join(', ')} (aanval -${Math.round((1-awayInj.attackFactor)*100)}%, verdediging -${Math.round((1-awayInj.defenseFactor)*100)}%)` : ''
    ].filter(Boolean).join('\n') || 'geen bekende blessures';

    // Stand context
    const homeStand = standings ? extractStandingInfo(standings, m.homeId) : null;
    const awayStand  = standings ? extractStandingInfo(standings, m.awayId)  : null;
    const standStr = [
      homeStand ? `${m.home}: pos ${homeStand.pos}/${homeStand.total}, ${homeStand.pts}pt, GD ${homeStand.gd>0?'+':''}${homeStand.gd}${homeStand.motivatieLabel?' ('+homeStand.motivatieLabel+')':''}` : '',
      awayStand  ? `${m.away}: pos ${awayStand.pos}/${awayStand.total}, ${awayStand.pts}pt, GD ${awayStand.gd>0?'+':''}${awayStand.gd}${awayStand.motivatieLabel?' ('+awayStand.motivatieLabel+')':''}` : ''
    ].filter(Boolean).join('\n') || 'stand niet beschikbaar';

    // Gewogen H2H
    const h2hW = h2h?.length ? calcWeightedH2H(h2h, m.homeId, m.awayId) : null;
    const h2hWStr = h2hW ? `Gewogen H2H (${h2hW.count} duels): thuis ${h2hW.homeWinPct}% / gelijk ${h2hW.drawPct}% / uit ${h2hW.awayWinPct}%` : '';

    // Competitie fase
    const phase = getCompetitionPhase(homeStand?.played || 0);

    // Predictions context
    const predStr = predictions ? formatPredictions(predictions, m.home, m.away) : '';

    const context = `Wedstrijd: ${m.home} vs ${m.away}
Competitie: ${m.comp} | ${m.date} ${m.time} | Fase: ${phase.label||'normaal'}
Quotes: 1=${m.homeOdds} X=${m.drawOdds} 2=${m.awayOdds}
${poissonStr}
Vorm ${m.home}: ${homeFormStr}
Vorm ${m.away}: ${awayFormStr}
H2H: ${h2hStr}
${h2hWStr}
Standen: ${standStr}
Blessures: ${injStr}
Formaties: ${formationStr}${predStr ? '\n\nAPI PREDICTIONS:\n' + predStr : ''}`;

    const data = await anthropicFetchWithRetry(null, {
      model: 'claude-sonnet-4-6',
      max_tokens: 1800,
      system: `Je bent een elite voetbalanalist voor een bettingadvies app. JSON only, geen tekst buiten JSON.

BESCHIKBARE DATA ANKERS (gebruik alles wat beschikbaar is):
1. Poisson model (eigen berekening op doelpuntengemiddelden + xG)
2. API Predictions (onafhankelijk model van API-Football — als aanwezig in context)
3. Vorm, H2H gewogen, standen, blessures, formaties

WEGING: als Poisson + API pred beschikbaar → elk 35% + context 30%. Als alleen Poisson → 50% + context 50%.
CONVERGENTIE: als meerdere ankers dezelfde kant wijzen → hogere confidence en sterkere uitspraak.
DIVERGENTIE: als Poisson en API pred sterk afwijken (>12pp) → wees voorzichtig, vermeld in advies.

JSON STRUCTUUR:
{"vorm":"2-3 zinnen recente prestaties BEIDE teams met specifieke cijfers","stats":"2-3 zinnen statistieken + Poisson kansen + API pred kansen als beschikbaar","tactiek":"2 zinnen speelstijl en formaties","kans":"2 zinnen kansberekening: gecombineerde inschatting na weging van alle ankers","risico":"1-2 zinnen concrete risicofactoren","advies":"1-2 zinnen concreet value-advies met pick en odds",
"tip":{"pick":"1","pickLabel":"${m.home} wint","markt":"Uitslag","odds":${m.homeOdds||2},"kans":55,"sterren":3,"confidence":6,"confidenceReden":"1 zin: databeschikbaarheid + signaalconsistentie","redenering":"3-4 zinnen onderbouwing met specifieke cijfers uit de data",
"tips":[{"pick":"O2.5","pickLabel":"Meer dan 2.5 goals","markt":"Doelpunten","odds":1.8,"kans":58,"reden":"concreet statistisch argument"},{"pick":"X","pickLabel":"Gelijkspel","markt":"Uitslag","odds":${m.drawOdds||3.5},"kans":26,"reden":"concreet argument"}]}}

KWALITEITSREGELS:
- Noem teams altijd bij naam, nooit "thuisploeg"
- Gebruik specifieke cijfers: "4 van laatste 5 thuis gewonnen", "gemiddeld 2.1 goals per duel"
- kans = jouw gecombineerde schatting NA overround-correctie van de bookmaker
- confidence: 8-10 = meerdere ankers bevestigen + rijke data; 6-7 = redelijke data, 1 conflicterend; 1-5 = schaars of sterk divergerend
- tips array: 2 alternatieve markten (O/U goals, BTTS, Asian handicap) met concrete onderbouwing`,
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
    const predBadge = predictions?.advice
      ? `<br><span style="font-family:monospace;font-size:.5rem;color:#2563eb;">💡 API: ${predictions.advice}${predictions.percent?.home !== null ? ` · ${predictions.percent.home}%/${predictions.percent.draw}%/${predictions.percent.away}%` : ''}</span>`
      : '';
    fill('stats',   sectionCard('📊', 'STATS', (result.stats||'—') + (poisson.valid ? `<br><span style="font-family:monospace;font-size:.5rem;color:#7c3aed;">📐 ${poissonStr}</span>` : '') + predBadge, '#7c3aed'));
    fill('tactiek', sectionCard('⚔️', 'TACTIEK & FORMATIES', result.tactiek || '—', '#d97706'));
    fill('kans',    sectionCard('🎯', 'KANSEN', result.kans || '—', '#16a34a'));
    fill('risico',  sectionCard('⚠️', 'RISICO', result.risico || '—', '#dc2626'));
    fill('advies',  sectionCard('💡', 'ADVIES', result.advies || '—', '#be185d'));

    // Tip sectie
    const tip = result.tip;
    if (tip && tip.pick) {
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

      const chatBtn = document.getElementById('openChatBtn');
      if (chatBtn) chatBtn.style.display = 'block';

      state._lastAnalyseContext = context;
      state._lastAnalyseResult = result;
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
  const btnId = mode === 'tomorrow' ? 'scanTomorrowBtn' : 'scanAllTodayBtn';
  const btnContainer = document.getElementById(btnId);
  const btn = btnContainer?.querySelector('button') || btnContainer;
  const origText = btn?.textContent || '⚡ SCAN';

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().split('T')[0];

  // Laad alle competities als state.matches te weinig wedstrijden heeft
  const currentWithOdds = (state.matches||[]).filter(m =>
    m.homeOdds !== '—' && !m.isDone && parseFloat(m.homeOdds) > 1
  );

  if (currentWithOdds.length < 3) {
    if (btn) { btn.disabled = true; btn.textContent = '⟳ ALLE COMPS LADEN...'; }

    // Laad alle competities parallel — volledige scan lijst
    const SCAN_LEAGUE_IDS = [
      // Standaard app comps
      88, 89, 78, 39, 61, 135, 2, 3, 848, 144, 140, 40, 79, 203, 5,
      // Extra comps voor bredere coverage
      94, 179, 218, 207, 119, 103, 113, 197, 106, 283, 345,
      32, 34, 36, 1,
    ];
    const allMatches = [];
    const seen = new Set();

    await Promise.all(SCAN_LEAGUE_IDS.map(async leagueId => {
      try {
        const season = leagueId === 1 ? 2026 : 2025;
        // Gebruik next=50 om komende wedstrijden op te halen (geen datumfilter)
        const r = await apiFetch(
          `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${season}&next=10`,
          null, 8000
        );
        const d = await r.json();
        (d.response || []).forEach(f => {
          const m = parseAPIMatch(f);
          if (m && !seen.has(m.id)) {
            seen.add(m.id);
            allMatches.push(m);
          }
        });
      } catch(e) {}
    }));

    if (allMatches.length > 0) {
      if (btn) btn.textContent = `⟳ WEDSTRIJDEN GEVONDEN (${allMatches.length})...`;
      // Voeg EERST toe aan state.matches zodat fetchOddsForMatches ze kan vinden
      const existingIds = new Set((state.matches||[]).map(m => m.id));
      allMatches.forEach(m => { if (!existingIds.has(m.id)) state.matches.push(m); });
      // Sla matches op voor persistentie
      saveState();

      // Haal odds op per league — exact dezelfde methode als Wedstrijden scherm
      if (btn) btn.textContent = `⟳ ODDS OPHALEN...`;
      const leagueIds = [...new Set(allMatches.map(m => m.leagueId).filter(Boolean))];
      await Promise.all(leagueIds.map(lid => fetchOddsForMatches(lid, null).catch(()=>{})));
    }
  }

  const allWithOdds = (state.matches||[]).filter(m => {
    if (m.homeOdds === '—' || m.isDone || !(parseFloat(m.homeOdds) > 1)) return false;
    return true;
  });

  let candidates;
  if (mode === 'tomorrow') {
    candidates = allWithOdds.filter(m => !m.isDone);
    if (!candidates.length) candidates = allWithOdds.slice(0, 25);
  } else {
    // Alle komende wedstrijden met odds — geen datumfilter
    candidates = allWithOdds.filter(m => !m.isDone);
    if (!candidates.length) candidates = allWithOdds.slice(0, 20);
  }
  candidates = candidates.slice(0, 25);

  if (!candidates.length) {
    if (btn) { btn.disabled = false; btn.textContent = origText; }
    showToast('Geen wedstrijden met quotes gevonden voor vandaag.');
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = `⟳ ANALYSEREN (${candidates.length})...`; }

  // Bewaar gescande matches zodat teamnamen zichtbaar blijven
  state.matches = candidates;
  await scanValueAll();

  if (btn) { btn.disabled = false; btn.textContent = origText; }
}

// ── Combi Tips ────────────────────────────────────────────
async function generateCombiTip() {
  const btn = document.getElementById('combiGenBtn');
  if (!btn) return;
  btn.disabled = true; btn.textContent = '⟳ BEREKENEN...';

  const allMatches = (state.matches||[]).filter(m => !m.isDone);

  // Blokkeer als geen wedstrijden geladen
  if (!allMatches.length) {
    const card = document.getElementById('combiCard');
    if (card) {
      card.innerHTML = `<div style="text-align:center;padding:1.5rem;background:var(--card);border:1px solid var(--stroke);border-radius:14px;">
        <div style="font-size:1.8rem;margin-bottom:.5rem;">⚽</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.62rem;font-weight:800;color:var(--ink);margin-bottom:.4rem;">GEEN WEDSTRIJDEN GELADEN</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.54rem;color:var(--sub);margin-bottom:.8rem;line-height:1.6;">Laad eerst wedstrijden via het Wedstrijden tabblad om combi tips te genereren.</div>
        <button onclick="switchScreen('wedstrijden')" style="padding:.55rem 1.2rem;border-radius:10px;background:linear-gradient(135deg,rgba(219,39,119,.85),rgba(124,58,237,.8));color:#fff;border:none;font-family:'IBM Plex Mono',monospace;font-size:.62rem;font-weight:800;cursor:pointer;">⚽ Naar Wedstrijden →</button>
      </div>`;
      card.style.display = 'block';
    }
    btn.disabled = false; btn.textContent = '⚡ GENEREER TOP 3 TIPS + COMBI';
    return;
  }

  // Laad alle competities als te weinig wedstrijden met odds
  const withOdds = allMatches.filter(m => m.homeOdds !== '—' && parseFloat(m.homeOdds) >= 1.40);
  if (withOdds.length < 6) {
    btn.textContent = '⟳ ALLE COMPS LADEN...';
    const today = new Date().toISOString().split('T')[0];
    const SCAN_IDS = [88,89,78,39,61,135,2,3,848,144,140,40,79,203,5,94,179,218,207,119,103,113,106,32,34,36,1];
    const seen = new Set((state.matches||[]).map(m => m.id));
    const extra = [];
    await Promise.all(SCAN_IDS.map(async lid => {
      try {
        const season = lid === 1 ? 2026 : 2025;
        const r = await apiFetch(`https://v3.football.api-sports.io/fixtures?league=${lid}&season=${season}&date=${today}&status=NS-1H-HT-2H`, null, 6000);
        const d = await r.json();
        (d.response||[]).forEach(f => {
          const m = parseAPIMatch(f);
          if (m && !seen.has(m.id)) { seen.add(m.id); extra.push(m); }
        });
      } catch(e) {}
    }));
    if (extra.length) {
      btn.textContent = `⟳ ODDS OPHALEN (${extra.length})...`;
      try { await fetchOddsForAllMatches(extra, null); } catch(e) {}
      extra.forEach(m => state.matches.push(m));
    }
  }

  // Filter: minimale odds 1.40, moet quotes hebben, niet afgelopen
  const upcomingMatches = (state.matches||[]).filter(m =>
    !m.isDone &&
    m.homeOdds !== '—' &&
    parseFloat(m.homeOdds) >= 1.40 &&
    parseFloat(m.awayOdds) >= 1.10
  );

  if (!upcomingMatches.length) {
    const card = document.getElementById('combiCard');
    if (card) {
      card.innerHTML = `<div style="text-align:center;padding:1.5rem;background:var(--card);border:1px solid var(--stroke);border-radius:14px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.6rem;color:var(--sub);line-height:1.7;">Geen wedstrijden met bruikbare quotes (min. 1.40).<br>Laad meer wedstrijden of kies een andere competitie.</div>
      </div>`;
      card.style.display = 'block';
    }
    btn.disabled = false; btn.textContent = '⚡ GENEREER TOP 3 TIPS + COMBI';
    return;
  }

  // ── FIX v18.2: Gebruik index als referentie, stuur fixtureId mee ──
  // Zodat teamnamen altijd uit state.matches komen, niet uit AI response
  const matchesCtx = upcomingMatches.slice(0,25).map((m, i) => {
    const datum = m.date ? `${m.date} ${m.time}` : m.time;
    return `[${i+1}] fixtureId=${m.id} | ${m.home} vs ${m.away} | ${m.comp} | ${datum} | 1=${m.homeOdds} X=${m.drawOdds} 2=${m.awayOdds}`;
  }).join('\n');

  const vandaag = new Date().toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long'});

  try {
    const data = await anthropicFetch(null, {
      model:'claude-sonnet-4-6', max_tokens:1600,
      system:`Je bent sportadviseur. JSON only, geen tekst buiten JSON.
Het veld "match" MOET altijd de exacte teamnamen bevatten: "ThuisTeam vs UitTeam".
Het veld "fixtureId" MOET de fixtureId zijn uit de invoer.

CROSS-COMPETITIE SELECTIE:
- Kies wedstrijden uit VERSCHILLENDE competities waar mogelijk — meer diversiteit = minder correlatie
- Top 3 tips: de 3 beste value picks over ALLE beschikbare competities
- Combi: kies 3 legs uit MINIMAAL 2 verschillende competities
- Vermijd picks uit dezelfde competitie op dezelfde speelronde in de combi (hoge correlatie)
- Odds tussen 1.40 en 4.00 — NOOIT onder 1.40
- Geef voorkeur aan: thuisfavorieten met motivatieverschil, ploegen in goede vorm, duidelijke kwaliteitsverschillen

{"top3":[
  {"fixtureId":"123","match":"ThuisTeam vs UitTeam","datum":"","pick":"","pickLabel":"","markt":"","odds":0,"vertrouwen":8,"reden":"30-40 woorden met concrete redenen","factoren":["",""],"risico":""},
  {"fixtureId":"123","match":"ThuisTeam vs UitTeam","datum":"","pick":"","pickLabel":"","markt":"","odds":0,"vertrouwen":0,"reden":"","factoren":[],"risico":""},
  {"fixtureId":"123","match":"ThuisTeam vs UitTeam","datum":"","pick":"","pickLabel":"","markt":"","odds":0,"vertrouwen":0,"reden":"","factoren":[],"risico":""}
],
"combi":{"legs":[
  {"fixtureId":"123","match":"ThuisTeam vs UitTeam","datum":"","pick":"","pickLabel":"","markt":"","odds":0,"vertrouwen":0},
  {"fixtureId":"123","match":"ThuisTeam vs UitTeam","datum":"","pick":"","pickLabel":"","markt":"","odds":0,"vertrouwen":0},
  {"fixtureId":"123","match":"ThuisTeam vs UitTeam","datum":"","pick":"","pickLabel":"","markt":"","odds":0,"vertrouwen":0}
],"redenering":"40-50 woorden","synergie":"max 30 woorden — benoem de cross-competitie diversiteit","risico":"max 25 woorden","kansBerekening":"72%x68%x75%=37%","valueScore":7}}`,
      messages:[{role:'user',content:`Datum: ${vandaag}\n\nBeschikbare wedstrijden (${upcomingMatches.length} totaal, meerdere competities):\n${matchesCtx}\n\nMaak top 3 tips en een cross-competitie combi van 3 legs uit minimaal 2 verschillende competities.`}]
    });
    let raw = data.content[0].text.trim();
    const js = raw.indexOf('{'), je = raw.lastIndexOf('}');
    if (js < 0 || je < js) throw new Error('Geen JSON in response: ' + raw.substring(0,60));
    const result = JSON.parse(raw.substring(js, je + 1));

    // ── FIX v18.2: Overschrijf teamnamen met echte data uit state.matches ──
    [...(result.top3||[]), ...(result.combi?.legs||[])].forEach(t => {
      if (t.fixtureId) {
        const m = (state.matches||[]).find(m => String(m.id) === String(t.fixtureId));
        if (m) t.match = `${m.home} vs ${m.away}`;
      }
    });

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

  // Sla tips op voor pop-up
  window._top3Tips = result.top3 || [];

  const top3Html = (result.top3||[]).map((t,i) => {
    const tv = calcValue(t.vertrouwen * 10, parseFloat(t.odds));
    const tvSign = tv > 0 ? '+' : '';
    const tvColor = tv >= 15 ? '#15803d' : tv >= 5 ? '#b45309' : tv >= 0 ? '#64748b' : '#dc2626';
    const cc = confColor(t.vertrouwen);
    const cbar = Math.round((t.vertrouwen/10)*100);
    const factoren = Array.isArray(t.factoren) ? t.factoren : [];
    return `<div onclick="openTipPopup(${i})" style="background:rgba(255,255,255,.82);border:1px solid rgba(28,35,48,.08);border-radius:12px;padding:.75rem .9rem;margin-bottom:.5rem;cursor:pointer;active:opacity:.85;">
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
      <div style="font-family:monospace;font-size:.44rem;color:var(--sub);margin-top:.35rem;text-align:right;">Tik voor details →</div>
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

function openTipPopup(index) {
  const t = (window._top3Tips || [])[index];
  if (!t) return;
  const tv = calcValue(t.vertrouwen * 10, parseFloat(t.odds));
  const tvSign = tv > 0 ? '+' : '';
  const tvColor = tv >= 15 ? '#15803d' : tv >= 5 ? '#b45309' : '#64748b';
  const confColor = t.vertrouwen >= 8 ? '#16a34a' : t.vertrouwen >= 6 ? '#d97706' : '#dc2626';
  const stars = '⭐'.repeat(Math.min(Math.round(t.vertrouwen/2), 5));
  const factoren = Array.isArray(t.factoren) ? t.factoren : [];

  // Verwijder bestaande popup
  document.getElementById('tipPopupOverlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tipPopupOverlay';
  overlay.style.cssText = `position:fixed;inset:0;z-index:9999;
    background:rgba(15,23,42,.6);backdrop-filter:blur(6px);
    display:flex;align-items:flex-end;justify-content:center;
    animation:fadeIn .15s ease;`;
  overlay.onclick = e => { if(e.target === overlay) overlay.remove(); };

  overlay.innerHTML = `
    <div style="width:100%;max-width:520px;max-height:92vh;overflow-y:auto;
      background:linear-gradient(160deg,#fdf4ff,#f0f4ff);
      border-radius:24px 24px 0 0;padding:1.2rem 1.1rem 2rem;
      box-shadow:0 -8px 40px rgba(15,23,42,.2);">

      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.3rem;
          background:linear-gradient(135deg,#be185d,#7c3aed);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;">
          TIP DETAILS
        </div>
        <button onclick="document.getElementById('tipPopupOverlay').remove()"
          style="background:rgba(15,23,42,.08);border:none;border-radius:50%;
          width:2rem;height:2rem;font-size:1rem;cursor:pointer;color:var(--ink);">✕</button>
      </div>

      <!-- Wedstrijd -->
      <div style="font-family:'DM Sans',sans-serif;font-size:1.15rem;font-weight:800;
        color:var(--ink);margin-bottom:.25rem;">${t.match}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;
        color:#7c3aed;margin-bottom:.9rem;">📅 ${t.datum||''} · ${t.markt||'Uitslag'}</div>

      <!-- Pick + odds + value -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;margin-bottom:.9rem;">
        <div style="background:rgba(219,39,119,.1);border:1px solid rgba(219,39,119,.25);
          border-radius:12px;padding:.6rem;text-align:center;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:#be185d;font-weight:700;">PICK</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.62rem;font-weight:800;color:#be185d;margin-top:.2rem;">${t.pickLabel}</div>
        </div>
        <div style="background:rgba(22,163,74,.1);border:1px solid rgba(22,163,74,.25);
          border-radius:12px;padding:.6rem;text-align:center;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:#15803d;font-weight:700;">ODDS</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:#15803d;line-height:1;">${parseFloat(t.odds||0).toFixed(2)}</div>
        </div>
        <div style="background:rgba(${tv>=8?'22,163,74':'180,83,9'},.1);border:1px solid rgba(${tv>=8?'22,163,74':'180,83,9'},.25);
          border-radius:12px;padding:.6rem;text-align:center;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:${tvColor};font-weight:700;">VALUE</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:${tvColor};line-height:1;">${tvSign}${Math.round(tv)}%</div>
        </div>
      </div>

      <!-- Confidence -->
      <div style="background:rgba(255,255,255,.7);border:1px solid var(--stroke);
        border-radius:12px;padding:.7rem .9rem;margin-bottom:.75rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;font-weight:800;color:var(--sub);">
            🎯 ZEKERHEID ${stars}
          </div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.2rem;color:${confColor};">
            ${t.vertrouwen}/10
          </div>
        </div>
        <div style="background:rgba(0,0,0,.08);border-radius:999px;height:8px;overflow:hidden;">
          <div style="background:${confColor};width:${Math.round(t.vertrouwen/10*100)}%;height:100%;
            border-radius:999px;transition:width .3s;"></div>
        </div>
      </div>

      <!-- Analyse -->
      ${t.reden ? `<div style="background:rgba(255,255,255,.8);border-left:3px solid ${tvColor};
        border-radius:0 12px 12px 0;padding:.75rem .9rem;margin-bottom:.75rem;
        font-size:.82rem;color:#1e293b;line-height:1.75;">${t.reden}</div>` : ''}

      <!-- Factoren -->
      ${factoren.length ? `<div style="display:flex;flex-wrap:wrap;gap:.3rem;margin-bottom:.75rem;">
        ${factoren.map(f=>`<span style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;
          font-weight:700;padding:.2rem .55rem;border-radius:999px;
          background:rgba(124,58,237,.08);border:1px solid rgba(124,58,237,.2);
          color:#7c3aed;">${f}</span>`).join('')}
      </div>` : ''}

      <!-- Risico -->
      ${t.risico ? `<div style="background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.15);
        border-radius:10px;padding:.55rem .8rem;margin-bottom:.85rem;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;
          font-weight:800;color:#dc2626;margin-bottom:.2rem;">⚠ RISICO</div>
        <div style="font-size:.76rem;color:#7f1d1d;">${t.risico}</div>
      </div>` : ''}

      <!-- Actie knoppen -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;">
        <button onclick="document.getElementById('tipPopupOverlay').remove();
          openBetModal(null,'${t.fixtureId||''}','${t.pick}','${(t.pickLabel||'').replace(/'/g,"\\'")}',${t.odds})"
          style="padding:.7rem;border-radius:12px;
          background:linear-gradient(135deg,rgba(219,39,119,.85),rgba(219,39,119,.6));
          color:#fff;border:none;font-family:'IBM Plex Mono',monospace;
          font-size:.62rem;font-weight:800;cursor:pointer;">
          💶 SINGLE BET
        </button>
        <button onclick="document.getElementById('tipPopupOverlay').remove();
          addValuePickToCombi('${t.fixtureId||''}','${t.pick}','${(t.pickLabel||'').replace(/'/g,"\\'")}',${t.odds},'${(t.match||'').replace(/'/g,"\\'")}','')"
          style="padding:.7rem;border-radius:12px;
          background:linear-gradient(135deg,rgba(124,58,237,.85),rgba(124,58,237,.6));
          color:#fff;border:none;font-family:'IBM Plex Mono',monospace;
          font-size:.62rem;font-weight:800;cursor:pointer;">
          ➕ COMBI
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
}

function loadAICombiIntoBuilder() {
  const legs = window._lastAICombi;
  if (!legs?.length) return;
  state.combiBuilder = [];
  legs.forEach((l,i) => {
    // ── FIX v18.2: Gebruik fixtureId voor betrouwbare match-lookup ──
    const match = l.fixtureId
      ? (state.matches||[]).find(m => String(m.id) === String(l.fixtureId))
      : (state.matches||[]).find(m =>
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

function logScanResult(picks) {
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
      matchDate:   (p.match && p.match.date) || p.matchDate || '',
      matchTime:   (p.match && p.match.time) || p.matchTime || '',
      pick:        p.pick || '1',
      pickLabel:   p.pickLabel || p.label || '',
      odds:        parseFloat(p.odds || 2),
      value:       parseFloat(p.value || 0),
      confidence:  parseInt(p.confidence || 7),
      aiKans:      p.kans || 0,
      kelly:       parseFloat((p.kelly || 0).toFixed(1)),
      reason:      p.reason || '',
      poissonUsed: p.poissonUsed || false,
      isSparseData: p.isSparseData || false,
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
    timestamp: Date.now(),
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
      // v18.5: fixtureId fallback — oudere picks kunnen id ipv fixtureId hebben
      if (!p.fixtureId && p.id && !String(p.id).startsWith('manual')) {
        p.fixtureId = p.id;
      }
      if (p.status === 'pending' && p.fixtureId) pending.push({ scan, pick: p });
    });
  });
  if (!pending.length) return 0;

  let verified = 0;

  for (const { pick } of pending) {
    try {
      // v18.5: cache-bypass via timestamp zodat Worker geen oude NS-status teruggeeft
      const res = await apiFetch(
        `https://v3.football.api-sports.io/fixtures?id=${pick.fixtureId}&_cb=${Date.now()}`, null
      );
      const json = await res.json();
      const f = json?.response?.[0];
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

async function autoVerifyPendingPicks() {
  const log = state.scanLog || [];
  const today = new Date().toLocaleDateString('nl-NL');
  const pending = [];

  log.forEach(scan => {
    scan.picks.forEach(p => {
      if (p.status === 'pending' && p.fixtureId) {
        if (scan.date && scan.date !== today) {
          pending.push({ scan, pick: p });
        }
      }
    });
  });

  if (!pending.length) return 0;

  const byDate = {};
  pending.forEach(({ scan, pick }) => {
    const d = scan.date;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push({ scan, pick });
  });

  let verified = 0;
  for (const [date, items] of Object.entries(byDate)) {
    try {
      const parts = date.split('-');
      const isoDate = parts.length === 3 && parts[0].length === 2
        ? `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
        : date;
      const res = await apiFetch(
        `https://v3.football.api-sports.io/fixtures?date=${isoDate}&status=FT`, null
      );
      const resJson = await res.json();
      if (!resJson?.response) continue;
      const resultMap = {};
      resJson.response.forEach(f => {
        resultMap[f.fixture.id] = {
          home: f.goals.home ?? 0,
          away: f.goals.away ?? 0,
          status: f.fixture.status.short
        };
      });

      items.forEach(({ pick }) => {
        const result = resultMap[pick.fixtureId];
        if (!result) return;
        const hg = result.home, ag = result.away;
        pick.score = `${hg}-${ag}`;
        pick.verifiedAt = new Date().toISOString();
        const t = (pick.pick || '').toUpperCase();
        if      (t === '1')      pick.status = hg > ag  ? 'win' : 'lose';
        else if (t === 'X')      pick.status = hg === ag ? 'win' : 'lose';
        else if (t === '2')      pick.status = ag > hg  ? 'win' : 'lose';
        else if (t === '1X')     pick.status = hg >= ag ? 'win' : 'lose';
        else if (t === 'X2')     pick.status = ag >= hg ? 'win' : 'lose';
        else if (t === 'O2.5')   pick.status = (hg+ag) > 2.5 ? 'win' : 'lose';
        else if (t === 'U2.5')   pick.status = (hg+ag) < 2.5 ? 'win' : 'lose';
        else if (t === 'BTTS-J') pick.status = (hg>0 && ag>0) ? 'win' : 'lose';
        else if (t === 'BTTS-N') pick.status = (hg===0 || ag===0) ? 'win' : 'lose';
        else pick.status = 'void';
        verified++;
      });
    } catch(e) {}
  }

  if (verified > 0) {
    saveState();
    syncScanLogToBacktest();
  }
  return verified;
}

function syncScanLogToBacktest() {
  const log = state.scanLog || [];
  if (!state.valueBacktest) state.valueBacktest = { picks: [] };

  log.forEach(scan => {
    scan.picks.forEach(sp => {
      if (sp.status === 'pending' || !sp.fixtureId) return;
      const btPick = state.valueBacktest.picks.find(p =>
        String(p.fixtureId || p.matchId) === String(sp.fixtureId) && p.pick === sp.pick
      );
      if (btPick && btPick.status === 'pending') {
        btPick.status = sp.status;
        btPick.score = sp.score;
        btPick.verifiedAt = sp.verifiedAt;
      }
    });
  });
  saveState();
}

function renderScanLog() {
  const el = document.getElementById('scan-log-content');
  if (!el) return;

  autoVerifyPendingPicks().then(n => {
    if (n > 0) {
      showToast(`✅ ${n} picks automatisch geverifieerd`);
      renderScanLog();
    }
  }).catch(() => {});

  const log       = state.scanLog || [];
  const allPicks  = log.flatMap(s => s.picks);
  const DREMPEL = { minValue: 8, minConf: 6 };
  const kwaliPicks = allPicks.filter(p =>
    !p.isSparseData &&
    (p.value||0) >= DREMPEL.minValue &&
    (p.confidence||0) >= DREMPEL.minConf
  );
  const settled   = kwaliPicks.filter(p => p.status === 'win' || p.status === 'lose');
  const wins      = settled.filter(p => p.status === 'win');
  const hitrate   = settled.length ? Math.round(wins.length / settled.length * 100) : 0;
  const roi       = settled.length
    ? settled.reduce((s,p) => s + (p.status==='win' ? (p.odds-1) : -1), 0) / settled.length * 100
    : 0;
  const avgValue  = kwaliPicks.length ? kwaliPicks.reduce((s,p) => s+(p.value||0),0)/kwaliPicks.length : 0;

  const byType = {};
  settled.forEach(p => {
    const t = p.pick || '?';
    if (!byType[t]) byType[t] = {wins:0, total:0};
    byType[t].total++;
    if (p.status === 'win') byType[t].wins++;
  });

  const byComp = {};
  settled.forEach(p => {
    const c = p.comp || 'Overig';
    if (!byComp[c]) byComp[c] = {wins:0, total:0};
    byComp[c].total++;
    if (p.status === 'win') byComp[c].wins++;
  });

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

  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">'
    + '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.3rem;color:var(--text);">SCAN LOG</div>'
    + '<div style="display:flex;gap:.4rem;">'
    + '<button class="small-action-btn" onclick="verifyScanLog().then(n=>{showToast(n>0?n+\' picks geverifieerd\':\'Geen nieuwe resultaten\');renderScanLog();}).catch(e=>showToast(\'⚠ \'+e.message))">🔄 Verificeer</button>'
    + '<button class="small-action-btn" onclick="exportScanLogCSV()">📥 CSV</button>'
    + '<button class="small-action-btn" style="color:#dc2626;" onclick="if(confirm(\'Scan log wissen?\')){state.scanLog=[];saveState();renderScanLog();}">🗑</button>'
    + '</div></div>';

  html += '<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:.8rem 1rem;margin-bottom:.8rem;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem;">'
    + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.52rem;color:var(--muted);">VOORTGANG NAAR 100 PICKS</div>'
    + '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.1rem;color:var(--accent);">' + kwaliPicks.length + '/100</div>'
    + '</div>'
    + '<div style="background:rgba(15,23,42,.08);border-radius:999px;height:6px;overflow:hidden;">'
    + '<div style="height:100%;border-radius:999px;background:linear-gradient(90deg,#be185d,#7c3aed);width:' + Math.min(100,kwaliPicks.length) + '%;transition:width .4s;"></div>'
    + '</div></div>';

  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem;margin-bottom:.8rem;">'
    + statCard(kwaliPicks.length, 'PICKS' + helpBtn('scan-log'), '#2563eb')
    + statCard(hitrate + '%', 'HITRATE' + helpBtn('hitrate'), hrColor(hitrate))
    + statCard((roi>=0?'+':'') + roi.toFixed(1) + '%', 'ROI' + helpBtn('roi'), roi>=0?'#16a34a':'#dc2626')
    + statCard(avgValue.toFixed(1) + '%', 'AVG VALUE' + helpBtn('avg-value'), '#7c3aed')
    + '</div>';

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
        var statusColor = p.status==='win' ? '#16a34a' : p.status==='lose' ? '#dc2626' : '#d97706';
        var value = p.value || 0;
        var valColor = value >= 20 ? '#15803d' : value >= 10 ? '#b45309' : '#64748b';
        var valBg = value >= 20 ? 'rgba(22,163,74,.1)' : value >= 10 ? 'rgba(180,83,9,.08)' : 'rgba(100,116,139,.08)';
        var scanId = String(scan.id || '');
        var pickId = String(p.fixtureId || p.id || '');
        var pickData = JSON.stringify({
          id: String(p.fixtureId||p.id||''), pick: String(p.pick||''),
          pickLabel: String(p.pickLabel||p.pick||''), odds: p.odds||2,
          value: p.value||0, confidence: p.confidence||0, match: p.match||'',
          reason: (p.reason||'').substring(0,100),
          poissonUsed: !!p.poissonUsed, isSparseData: !!p.isSparseData
        }).replace(/"/g, '&quot;');
        var manualBtn = p.status === 'pending'
          ? '<button class="manual-verify-btn" data-scan="' + scanId + '" data-pick="' + pickId + '" data-type="' + (p.pick||'') + '" data-match="' + (p.match||'').replace(/"/g,'') + '" style="font-family:monospace;font-size:.44rem;padding:3px 8px;border-radius:6px;background:rgba(37,99,235,.08);border:1px solid rgba(37,99,235,.2);color:#2563eb;cursor:pointer;">✏ Score</button>'
          : '';
        html += '<div class="scan-pick-card" style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;'
          + 'padding:.75rem .9rem;margin-bottom:.4rem;cursor:pointer;'
          + 'border-left:' + (p.status==='win'?'3px solid #16a34a':p.status==='lose'?'3px solid #dc2626':'3px solid #d97706') + ';"'
          + ' data-p="' + pickData + '">'
          + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.3rem;">'
          + '<div style="flex:1;">'
          + '<div style="font-family:\'DM Sans\',sans-serif;font-size:.75rem;font-weight:700;color:var(--ink);">' + icon + ' ' + (p.match||'') + '</div>'
          + (p.matchDate||p.date ? '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.42rem;color:var(--sub);">📅 ' + (p.matchDate||p.date||'') + (p.matchTime||p.time ? ' ' + (p.matchTime||p.time) : '') + '</div>' : '')
          + '</div>'
          + '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.48rem;font-weight:800;padding:2px 7px;border-radius:6px;background:' + valBg + ';color:' + valColor + ';">' + (value>0?'+':'') + value.toFixed(1) + '%</div>'
          + '</div>'
          + '<div style="display:flex;align-items:center;justify-content:space-between;">'
          + '<div><span style="font-family:\'IBM Plex Mono\',monospace;font-size:.54rem;font-weight:800;">' + (p.pickLabel||p.pick||'') + '</span>'
          + '<span style="font-family:\'Bebas Neue\',sans-serif;font-size:.9rem;color:#be185d;margin-left:.4rem;">' + (p.odds||0) + '</span>'
          + '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:var(--sub);margin-left:.4rem;">conf ' + (p.confidence||0) + '/10</span></div>'
          + '<div style="display:flex;align-items:center;gap:.3rem;">'
          + (p.score ? '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:.54rem;font-weight:700;color:' + statusColor + ';">' + p.score + '</span>' : '')
          + manualBtn
          + '</div></div></div>';
      });
      html += '</div>';
    });
  }

  el.innerHTML = html;

  // Event delegation voor pick cards en verify knoppen
  el.onclick = function(e) {
    // Pop-up via data-p attribuut
    const card = e.target.closest('.scan-pick-card');
    if (card && !e.target.closest('button')) {
      if (typeof openCardPopup !== 'function') return;
      try {
        const d = JSON.parse(card.dataset.p.replace(/&quot;/g, '"'));
        const parts = (d.match || '').split(' vs ');
        openCardPopup('scan', {
          id: d.id, match: {id: d.id},
          home: parts[0]||'', away: parts[1]||'',
          pick: d.pick, pickLabel: d.pickLabel,
          odds: d.odds, value: d.value,
          confidence: d.confidence, reason: d.reason||'',
          poissonUsed: d.poissonUsed, isSparseData: d.isSparseData
        });
      } catch(e) {}
      return;
    }
    const btn = e.target.closest('.manual-verify-btn');
    if (!btn) return;
    showManualVerify(btn.dataset.scan, btn.dataset.pick, btn.dataset.type, btn.dataset.match);
  };
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

  const m = state.selectedMatch;
  if (m && !state.matches.find(x => String(x.id) === String(m.id))) {
    state.matches.unshift(m);
  }

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

  pendingBet = {
    match: m || { id: tip.matchId, home: tip.home||'', away: tip.away||'' },
    pick: tip.pick, pickLabel: tip.pickLabel||tip.pick,
    odds: parseFloat(tip.odds), markt: '1X2',
    _origPick: tip.pick, _origPickLabel: tip.pickLabel||tip.pick, _origOdds: parseFloat(tip.odds)
  };

  const modal = document.getElementById('bet-modal');
  if (modal) modal.style.display = 'flex';
}

// ── AI Match Chat ─────────────────────────────────────────

let _chatHistory = [];
let _chatMatchId = null;

function openMatchChat() {
  const m = state.selectedMatch;
  if (!m) return;

  if (_chatMatchId !== m.id) {
    _chatHistory = [];
    _chatMatchId = m.id;
    const msgs = document.getElementById('chatMessages');
    if (msgs) msgs.innerHTML = '';
  }

  const section = document.getElementById('matchChatSection');
  const btn = document.getElementById('openChatBtn');
  if (section) section.style.display = 'block';
  if (btn) btn.style.display = 'none';

  const sugg = document.getElementById('chatSuggestions');
  if (sugg && !sugg.children.length) {
    const suggestions = [
      'Wat is jouw beste pick?',
      'Hoe zit het met de verdediging?',
      'Is er value in de odds?',
      'Wat zijn de risicofactoren?',
      'Verwacht je doelpunten?'
    ];
    sugg.innerHTML = suggestions.map(s =>
      `<button onclick="setChatInput('${s}')"
        style="font-family:monospace;font-size:.46rem;padding:2px 8px;border-radius:999px;
        background:rgba(124,58,237,.08);border:1px solid rgba(124,58,237,.2);
        color:#7c3aed;cursor:pointer;white-space:nowrap;">${s}</button>`
    ).join('');
  }

  setTimeout(() => document.getElementById('chatInput')?.focus(), 100);
}

function setChatInput(text) {
  const input = document.getElementById('chatInput');
  if (input) { input.value = text; input.focus(); }
}

function appendChatMsg(role, text, isLoading = false) {
  const msgs = document.getElementById('chatMessages');
  if (!msgs) return;
  const isUser = role === 'user';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;justify-content:${isUser?'flex-end':'flex-start'};margin-bottom:.4rem;`;
  div.innerHTML = `
    <div style="max-width:85%;padding:.5rem .7rem;border-radius:${isUser?'12px 12px 2px 12px':'12px 12px 12px 2px'};
      background:${isUser?'rgba(124,58,237,.15)':'var(--card)'};
      border:1px solid ${isUser?'rgba(124,58,237,.25)':'var(--stroke)'};
      font-family:${isUser?'monospace':'inherit'};font-size:.72rem;line-height:1.6;color:var(--ink);">
      ${isLoading ? '<span style="opacity:.5;">⟳ Nadenken...</span>' : text}
    </div>`;
  div.id = isLoading ? 'chat-loading' : '';
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

async function sendMatchChat() {
  const input = document.getElementById('chatInput');
  const question = input?.value.trim();
  if (!question) return;

  const m = state.selectedMatch;
  if (!m) { showToast('Selecteer eerst een wedstrijd'); return; }

  input.value = '';
  input.disabled = true;

  appendChatMsg('user', question);
  _chatHistory.push({ role: 'user', content: question });

  appendChatMsg('assistant', '', true);

  try {
    const matchCtx = state._lastAnalyseContext ||
      `Wedstrijd: ${m.home} vs ${m.away} | ${m.comp} | ${m.date} ${m.time} | Quotes: 1=${m.homeOdds} X=${m.drawOdds} 2=${m.awayOdds}`;

    const analyseSummary = state._lastAnalyseResult ? `
Vorm: ${state._lastAnalyseResult.vorm || ''}
Stats: ${state._lastAnalyseResult.stats || ''}
Kansen: ${state._lastAnalyseResult.kans || ''}
Advies: ${state._lastAnalyseResult.advies || ''}` : '';

    const historyToSend = _chatHistory.slice(-6);

    const data = await anthropicFetch(null, {
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: `Je bent een voetbalanalist die vragen beantwoordt over een specifieke wedstrijd. 
Geef korte, directe antwoorden (max 3-4 zinnen). Gebruik de beschikbare data.
Wedstrijd context:
${matchCtx}${analyseSummary}`,
      messages: historyToSend
    });

    const loading = document.getElementById('chat-loading');
    if (loading) loading.remove();

    const answer = data.content?.[0]?.text || 'Geen antwoord ontvangen';
    appendChatMsg('assistant', answer);
    _chatHistory.push({ role: 'assistant', content: answer });

    if (_chatHistory.length > 20) _chatHistory = _chatHistory.slice(-20);

  } catch(e) {
    const loading = document.getElementById('chat-loading');
    if (loading) loading.remove();
    appendChatMsg('assistant', `⚠ Fout: ${e.message}`);
  }

  input.disabled = false;
  input.focus();
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


// ═══════════════════════════════════════════════════════
// HANDMATIGE VERIFICATIE — v18.6
// Voor picks waarvan API-Football geen resultaat geeft
// ═══════════════════════════════════════════════════════

function showManualVerify(scanId, pickId, pick, matchName) {
  // Verwijder bestaande modal als die er al is
  const existing = document.getElementById('manual-verify-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'manual-verify-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.7);z-index:9000;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px);';
  modal.innerHTML = `
    <div style="background:var(--card);border-radius:20px 20px 0 0;padding:1.25rem 1.25rem 2rem;
      width:100%;max-width:480px;box-shadow:0 -8px 32px rgba(15,23,42,.2);">
      <div style="width:36px;height:4px;background:rgba(15,23,42,.15);border-radius:999px;margin:0 auto .75rem;"></div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:var(--ink);margin-bottom:.3rem;">
        ✏ SCORE INVOEREN
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.56rem;color:var(--sub);margin-bottom:1rem;line-height:1.6;">
        ${matchName}<br>
        Pick: <b style="color:var(--ink);">${pick}</b>
      </div>
      <div style="margin-bottom:1rem;">
        <label style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;color:var(--sub);display:block;margin-bottom:.4rem;">
          EINDSTAND (bijv. 2-1)
        </label>
        <input id="manual-score-input" type="text" placeholder="0-0"
          style="width:100%;font-family:'Bebas Neue',sans-serif;font-size:1.4rem;text-align:center;
          padding:.6rem;border-radius:12px;border:2px solid var(--stroke);
          background:var(--card);color:var(--ink);outline:none;letter-spacing:.1em;"
          oninput="updateManualPreview('${pick}', this.value)">
      </div>
      <div id="manual-verify-preview" style="font-family:'IBM Plex Mono',monospace;font-size:.58rem;
        text-align:center;padding:.5rem;border-radius:8px;margin-bottom:1rem;min-height:1.5rem;"></div>
      <div style="display:flex;gap:.5rem;">
        <button onclick="document.getElementById('manual-verify-modal').remove()"
          style="flex:1;padding:.65rem;border-radius:12px;background:rgba(15,23,42,.06);
          border:1px solid var(--stroke);font-family:'IBM Plex Mono',monospace;
          font-size:.6rem;font-weight:700;color:var(--sub);cursor:pointer;">
          Annuleren
        </button>
        <button onclick="confirmManualVerify('${scanId}','${pickId}','${pick}')"
          style="flex:2;padding:.65rem;border-radius:12px;
          background:linear-gradient(135deg,rgba(219,39,119,.85),rgba(124,58,237,.8));
          color:#fff;border:none;font-family:'IBM Plex Mono',monospace;
          font-size:.6rem;font-weight:800;cursor:pointer;letter-spacing:.04em;">
          ✓ BEVESTIGEN
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  // Focus input
  setTimeout(() => document.getElementById('manual-score-input')?.focus(), 100);
  // Sluit bij tik buiten sheet
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function updateManualPreview(pick, scoreStr) {
  const preview = document.getElementById('manual-verify-preview');
  if (!preview) return;
  const parts = scoreStr.trim().split('-');
  if (parts.length !== 2) { preview.textContent = ''; return; }
  const hg = parseInt(parts[0]);
  const ag = parseInt(parts[1]);
  if (isNaN(hg) || isNaN(ag)) { preview.textContent = ''; return; }

  let won = false;
  const t = pick.toUpperCase();
  if      (t === '1')    won = hg > ag;
  else if (t === 'X')    won = hg === ag;
  else if (t === '2')    won = ag > hg;
  else if (t === '1X')   won = hg >= ag;
  else if (t === 'X2')   won = ag >= hg;
  else if (t === 'O2.5') won = (hg + ag) > 2.5;
  else if (t === 'U2.5') won = (hg + ag) < 2.5;
  else if (t === 'BTTS-J') won = hg > 0 && ag > 0;
  else if (t === 'BTTS-N') won = hg === 0 || ag === 0;

  preview.style.background = won ? 'rgba(22,163,74,.1)' : 'rgba(220,38,38,.08)';
  preview.style.color = won ? '#15803d' : '#dc2626';
  preview.style.border = `1px solid ${won ? 'rgba(22,163,74,.25)' : 'rgba(220,38,38,.2)'}`;
  preview.textContent = won ? `✅ WIN — pick ${pick} correct bij ${hg}-${ag}` : `❌ VERLIES — pick ${pick} fout bij ${hg}-${ag}`;
}

function confirmManualVerify(scanId, pickId, pick) {
  const input = document.getElementById('manual-score-input');
  const scoreStr = input?.value.trim();
  if (!scoreStr || !scoreStr.includes('-')) {
    showToast('Voer een geldige score in (bijv. 2-1)');
    return;
  }
  const parts = scoreStr.split('-');
  const hg = parseInt(parts[0]);
  const ag = parseInt(parts[1]);
  if (isNaN(hg) || isNaN(ag)) {
    showToast('Ongeldige score — gebruik formaat 2-1');
    return;
  }

  // Zoek de pick in scanLog
  const log = state.scanLog || [];
  let found = false;

  log.forEach(scan => {
    if (String(scan.id) !== String(scanId)) return;
    scan.picks.forEach(p => {
      const pId = String(p.fixtureId || p.id || '');
      if (pId !== String(pickId)) return;

      // Bereken resultaat
      const t = (p.pick || pick).toUpperCase();
      let won = false;
      if      (t === '1')      won = hg > ag;
      else if (t === 'X')      won = hg === ag;
      else if (t === '2')      won = ag > hg;
      else if (t === '1X')     won = hg >= ag;
      else if (t === 'X2')     won = ag >= hg;
      else if (t === 'O2.5')   won = (hg + ag) > 2.5;
      else if (t === 'U2.5')   won = (hg + ag) < 2.5;
      else if (t === 'BTTS-J') won = hg > 0 && ag > 0;
      else if (t === 'BTTS-N') won = hg === 0 || ag === 0;
      else won = false;

      p.status = won ? 'win' : 'lose';
      p.score = `${hg}-${ag}`;
      p.verifiedAt = new Date().toISOString();
      p.verifiedManually = true;
      found = true;
    });
  });

  if (!found) {
    showToast('Pick niet gevonden in scan log');
    return;
  }

  // Sync naar backtest
  syncScanLogToBacktest();
  saveState();

  // Sluit modal en herrender
  document.getElementById('manual-verify-modal')?.remove();
  showToast(`✅ Score ${hg}-${ag} opgeslagen`);
  renderScanLog();
}
