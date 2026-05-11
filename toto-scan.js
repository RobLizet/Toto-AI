// TOTO AI — AI Scan Logic v11.73
// Automatisch gegenereerd — bewerk niet handmatig

async function scanAllTodayValue(mode = 'today') {


  const apiKey = 'server'; // Anthropic key op server





  const now = new Date();


  const todayStr = now.toISOString().split('T')[0];


  const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().split('T')[0];





  const allWithOdds = state.matches.filter(m => {


    if (m.homeOdds === '—' || m.isDone || !(parseFloat(m.homeOdds) > 1)) return false;


    // Alleen bekende competities — filter onbekende eruit


    if (m.leagueId && !new Set(Object.values(COMP_IDS)).has(m.leagueId)) return false;


    // Apply comp filter if set


    if (scanCompFilter.size > 0 && m.comp && !scanCompFilter.has(m.comp)) return false;


    return true;


  });





  // Debug: log candidates


  console.log('[ScanAll] Total with odds:', allWithOdds.length, 'mode:', mode);


  console.log('[ScanAll] Today:', todayStr, 'Tomorrow:', tomorrowStr);


  allWithOdds.slice(0,3).forEach(m => console.log('  -', m.home, 'vs', m.away, 'dateISO:', m.dateISO));





  let candidates;


  if (mode === 'tomorrow') {


    candidates = allWithOdds.filter(m => {


      const d = m.dateISO || '';


      return !d || d === todayStr || d === tomorrowStr;


    });


    if (!candidates.length) candidates = allWithOdds.slice(0, 25);


  } else {


    // Vandaag: dateISO === today OF dateISO leeg (datum onbekend maar niet gespeeld)


    const byDate = allWithOdds.filter(m => m.dateISO === todayStr);


    candidates = byDate.length ? byDate : allWithOdds.filter(m => !m.dateISO).concat(byDate);


    if (!candidates.length) candidates = allWithOdds.slice(0, 20);


  }


  candidates = candidates.slice(0, 25);


  console.log('[ScanAll] Candidates after filter:', candidates.length);





  if (!candidates.length) {


    alert('Geen wedstrijden met quotes. Laad eerst alle competities vandaag.');


    return;


  }





  const btnId = mode === 'tomorrow' ? 'scanTomorrowBtn' : 'scanAllTodayBtn';


  const btn = document.getElementById(btnId);


  const origText = btn?.textContent || '⚡ SCAN';


  if (btn) { btn.disabled = true; btn.textContent = `⟳ SCANNEN (0/${candidates.length})...`; }





  state.valueScans = [];

  // ── Sample size waarschuwing ──
  const settledBets = (state.wallet?.bets || []).filter(b => b.status === 'win' || b.status === 'lose');
  const sampleWarn = document.getElementById('scanSampleWarning');
  const sampleCount = document.getElementById('scanSampleCount');
  if (sampleWarn && sampleCount) {
    sampleCount.textContent = settledBets.length;
    sampleWarn.style.display = settledBets.length < 10 ? 'block' : 'none';
  }

  document.getElementById('valueExplainer') && (document.getElementById('valueExplainer').style.display = 'none');





  let done = 0;


  const scans = [];





  // Stuur alle wedstrijden in 1 API call ipv losse calls per wedstrijd


  // Dit voorkomt rate limiting en is veel sneller


  if (btn) { btn.textContent = `⟳ ANALYSEREN (${candidates.length} wedstrijden)...`; btn.classList.add('scanning'); }





  try {


    // ── STAP 1: Verzamel statistische data (Poisson, blessures, vorm) ──


    if (btn) btn.textContent = `⟳ DATA OPHALEN...`;


    const batchDataMap = {};


    const apiKey = null; // key op server


    const leagueId = COMP_IDS[state.activeComp];


    const wt = (p, ms=5000) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);





    if (fKey) {


      // Parallel data ophalen voor alle candidates


      await Promise.all(candidates.map(async m => {


        if (!m.homeId || !m.awayId) { batchDataMap[m.id] = { confidence: 3 }; return; }


        try {


          const [h2h, homeForm, awayForm, homeInj, awayInj, hStats, aStats, homeLastFix, awayLastFix] = await Promise.all([


            wt(fetchH2H(m.homeId, m.awayId), 4000),


            wt(fetchTeamForm(m.homeId), 4000),


            wt(fetchTeamForm(m.awayId), 4000),


            wt(fetchInjuries(m.homeId, m.id), 3000),


            wt(fetchInjuries(m.awayId, m.id), 3000),


            wt(fetchTeamStats(m.homeId, leagueId || 88), 4000),


            wt(fetchTeamStats(m.awayId, leagueId || 88), 4000),


            wt(fetchLastFixture(m.homeId, fKey), 3000),


            wt(fetchLastFixture(m.awayId, fKey), 3000),


          ]);





          // Confidence


          let conf = 4;


          if (h2h?.length >= 3) conf += 2; else if (h2h?.length) conf += 1;


          if (homeForm?.length >= 5 && awayForm?.length >= 5) conf += 2;


          else if (homeForm?.length && awayForm?.length) conf += 1;


          if (homeInj !== null && awayInj !== null) conf += 1;





          // Blessure factoren — verbeterd met totaal-penalty


          const calcInj = (injuries) => {


            if (!injuries?.length) return { attackFactor:1.0, defenseFactor:1.0, count:0 };


            let ap = 0, dp = 0;


            injuries.forEach(inj => {


              const pos = inj.player?.pos || '';


              if (pos==='F') ap += 0.10;      // aanvaller: -10%


              else if (pos==='M') { ap += 0.06; dp += 0.05; } // mid: -6%/-5%


              else if (pos==='D') dp += 0.10;  // verdediger: -10%


              else if (pos==='G') dp += 0.18;  // keeper: -18% (enorm)


              else { ap += 0.04; dp += 0.04; } // onbekend: -4%


            });


            // Extra straf voor veel blessures (squad depth probleem)


            const total = injuries.length;


            if (total >= 5)  { ap += 0.05; dp += 0.05; }  // 5+ blessures: -5% extra


            if (total >= 8)  { ap += 0.08; dp += 0.08; }  // 8+ blessures: -8% extra


            if (total >= 12) { ap += 0.10; dp += 0.10; }  // 12+ blessures: -10% extra


            // Minimum 0.40 (niet onder 40% kracht — zelfs bij ramp)


            return {


              attackFactor: Math.max(0.40, 1 - Math.min(ap, 0.60)),


              defenseFactor: Math.max(0.40, 1 - Math.min(dp, 0.60)),


              count: total


            };


          };


          const homeInjF = calcInj(homeInj);


          const awayInjF = calcInj(awayInj);





          // Poisson met xG


          const homeGoalStats = hStats ? extractTeamGoalStats(hStats) : null;


          const awayGoalStats = aStats ? extractTeamGoalStats(aStats) : null;


          const poisson = calcPoissonKansen(homeGoalStats, awayGoalStats, 1.35, homeInjF, awayInjF);


          if (poisson.valid) conf = Math.min(10, conf + 1 + (poisson.hasXG ? 1 : 0));





          // Marktbeweging


          const market = analyzeMarketMovement(m.id, parseFloat(m.homeOdds)||0, parseFloat(m.drawOdds)||0, parseFloat(m.awayOdds)||0);


          conf = Math.min(10, Math.max(1, conf + (market.confDelta||0)));





          const matchD = m.dateISO ? new Date(m.dateISO) : null;


          const homeRest = calcRestDays(homeLastFix, matchD);


          const awayRest = calcRestDays(awayLastFix, matchD);


          const homeStr = hStats ? calcHomeAwayStrength(hStats) : null;


          const awayStr = aStats ? calcHomeAwayStrength(aStats) : null;


          if (homeRest !== null) conf = Math.min(10, conf + 0.5);


          if (homeStr) conf = Math.min(10, conf + 0.5);





          batchDataMap[m.id] = {


            h2h:       h2h?.length   ? formatH2HCompact(h2h.slice(0,5), m.home, m.away)         : '',


            homeForm:  homeForm?.length ? formatFormCompact(homeForm.slice(0,5), m.homeId, m.home) : '',


            awayForm:  awayForm?.length ? formatFormCompact(awayForm.slice(0,5), m.awayId, m.away): '',


            homeInj:   homeInj?.length  ? `${homeInj.length}x out` : 'fit',


            awayInj:   awayInj?.length  ? `${awayInj.length}x out` : 'fit',


            homeRest, awayRest, homeStr, awayStr,


            poisson, market, confidence: Math.min(10, conf)


          };


        } catch(e) {


          batchDataMap[m.id] = { confidence: 4 };


        }


      }));


    }





    // ── STAP 2: Bouw context prompt met Poisson + stats ──

    // ── Odds versheid check ──
    const ODDS_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 uur
    const now_ts = Date.now();
    const staleOdds = candidates.filter(m => m.oddsAt && (now_ts - m.oddsAt) > ODDS_MAX_AGE_MS);
    if (staleOdds.length > 0) {
      showAutoCheckBar(`⚠ Odds van ${staleOdds.length} wedstrijd(en) ouder dan 2 uur — betrouwbaarheid lager`, 6000);
    }

    // Helper: bouw context regel voor 1 wedstrijd
    const buildMatchLine = (m, i) => {
      const d = batchDataMap[m.id] || {};
      const p = d.poisson;
      const oddsAge = m.oddsAt ? Math.round((now_ts - m.oddsAt) / 60000) : null;
      const oddsLabel = oddsAge !== null ? (oddsAge > 120 ? ` ⚠️odds ${oddsAge}min oud` : ` ✓odds ${oddsAge}min`) : '';
      let line = `${i+1}. matchId:${m.id} | ${m.home} vs ${m.away} | ${m.comp||'?'} | ${m.date||''} ${m.time||''} | 1=${m.homeOdds} X=${m.drawOdds} 2=${m.awayOdds}${oddsLabel}`;
      if (p?.valid) line += `\n   📐 Poisson: 1=${p.k1}% X=${p.kX}% 2=${p.k2}% λ_thuis=${p.lambdaHome} λ_uit=${p.lambdaAway}${p.hasXG?' (incl. xG)':''}`;
      if (d.homeForm) line += `\n   Vorm ${m.home}: ${d.homeForm}`;
      if (d.awayForm) line += `\n   Vorm ${m.away}: ${d.awayForm}`;
      if (d.h2h)      line += `\n   H2H: ${d.h2h}`;
      if (d.homeInj || d.awayInj) line += `\n   Blessures: ${m.home}=${d.homeInj||'?'}, ${m.away}=${d.awayInj||'?'}`;
      if (d.market?.direction !== 'none') line += `\n   Markt: ${d.market?.label||''}`;
      if (d.homeRest !== null || d.awayRest !== null) line += `\n   Rust: ${m.home}=${restLabel(d.homeRest)}, ${m.away}=${restLabel(d.awayRest)}`;
      if (d.homeStr?.diff > 15) line += `\n   ${m.home} dominant thuis (${d.homeStr.homeWinRate}% thuis)`;
      if (d.awayStr?.diff < -10) line += `\n   ${m.away} beter uit dan thuis`;
      return line;
    };

    // Historische leer-context (eenmalig gebouwd, meegestuurd in elke batch)
    const historyCtx = buildAIHistoryContext();

    // ── Batches van max 5 wedstrijden voor hogere AI kwaliteit ──
    const BATCH_SIZE = 5;
    const batches = [];
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      batches.push(candidates.slice(i, i + BATCH_SIZE));
    }

    const allResults = [];

    for (let bi = 0; bi < batches.length; bi++) {
      const batch = batches[bi];
      if (btn) btn.textContent = `⟳ AI ANALYSEREN (batch ${bi+1}/${batches.length})...`;

      const ctx = batch.map((m, i) => buildMatchLine(m, i)).join('\n\n');

      const batchData = await anthropicFetchWithRetry(null, {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        temperature: 0,
        system: `RESPOND WITH VALID JSON ONLY. NO TEXT BEFORE OR AFTER JSON. START YOUR RESPONSE WITH { AND END WITH }.

{"results":[{"matchId":"12345","pick":"1","pickLabel":"kort","kans1":45,"kansX":28,"kans2":27,"reason":"30-40 woorden waarom value","factoren":["kort","kort"],"risico":"max 15 woorden"}]}

Regels:
- kans1+kansX+kans2=100. Poisson als anker (±8pp).
- matchId = het ID uit de wedstrijd (verplicht, gebruik dit exact).
- Geef voor ALLE ${batch.length} wedstrijden een object.
- Als value < 3% of signalen tegenstrijdig: geef "pick":"SKIP".
- Geen uitleg, geen markdown.`,
        messages:[{role:'user', content:`Analyseer ${batch.length} wedstrijden:${historyCtx}\n\n${ctx}`}]
      });

      if (batchData.error) {
        console.warn(`[Batch ${bi+1}] AI fout:`, batchData.error.message);
        continue;
      }

      const raw = batchData.content?.[0]?.text?.trim();
      if (!raw) continue;

      const s1 = raw.indexOf('{'), e1 = raw.lastIndexOf('}');
      if (s1 < 0 || e1 < s1) continue;

      try {
        const parsed = JSON.parse(raw.substring(s1, e1 + 1));
        const batchResults = Array.isArray(parsed) ? parsed : (parsed.results || parsed.scans || []);
        allResults.push(...batchResults);
      } catch(e) {
        console.warn(`[Batch ${bi+1}] JSON parse fout:`, e.message);
      }
    }

    const results = allResults;
    if (!results.length) throw new Error('Geen resultaten uit AI batches');

    if (btn) btn.textContent = `⟳ VERWERKEN...`;





    for (const r of results) {


      // SKIP picks die AI als onbetrouwbaar markeert
      if (r.pick === 'SKIP') continue;


      // ID-based matching (betrouwbaarder dan idx)
      let m = r.matchId ? candidates.find(c => String(c.id) === String(r.matchId)) : null;
      if (!m) {
        const idx = (r.idx || 1) - 1;
        m = candidates[idx];
      }


      if (!m) continue;


      const d = batchDataMap[m.id] || {};





      // Normaliseer kansen


      const sum = (r.kans1||r.kans||33) + (r.kansX||33) + (r.kans2||34);


      let aiK1 = Math.round(((r.kans1||r.kans||33)/sum)*100);


      let aiKX = Math.round(((r.kansX||33)/sum)*100);


      let aiK2 = Math.round(((r.kans2||34)/sum)*100);





      // Blend Poisson + AI (dynamisch gewicht)


      const poisson = d.poisson;


      let k1, kX, k2;


      if (poisson?.valid) {


        const poissonW = Math.min(0.80, 0.65 + (poisson.hasXG?0.08:0) + (d.h2h?0.03:0) + (d.homeForm?0.04:0));


        const aiW = 1 - poissonW;


        k1 = Math.round(poissonW * poisson.k1 + aiW * aiK1);


        kX = Math.round(poissonW * poisson.kX + aiW * aiKX);


        k2 = Math.round(poissonW * poisson.k2 + aiW * aiK2);


        const bs = k1+kX+k2; if (bs!==100) k1 += (100-bs);


      } else {


        k1 = aiK1; kX = aiKX; k2 = aiK2;


      }





      // Value berekening


      const pick = r.pick || '1';


      const odds = pick==='1' ? parseFloat(m.homeOdds) : pick==='X' ? parseFloat(m.drawOdds) : parseFloat(m.awayOdds);


      const pickKans = pick==='1' ? k1 : pick==='X' ? kX : k2;


      const value = parseFloat(((pickKans/100 * odds - 1)*100).toFixed(1));


      const kelly = odds > 1 ? parseFloat(Math.max(0, ((pickKans/100 - (1-pickKans/100)/(odds-1))/2*100)).toFixed(1)) : 0;





      scans.push({


        match: m,


        pick,


        pickLabel: r.pickLabel || (pick==='1'?m.home+' wint':pick==='X'?'Gelijkspel':m.away+' wint'),


        kans: pickKans,


        value,


        val: value,


        confidence: d.confidence || 5,


        kelly,


        reason: r.reason || '',


        factoren: r.factoren || [],


        risico: r.risico || '',


        odds,


        bookmaker: m.oddsSource || 'API',


        poissonUsed: poisson?.valid || false,


        poissonK1: poisson?.k1, poissonKX: poisson?.kX, poissonK2: poisson?.k2,


        k1, kX, k2,


        market: d.market,


        id: m.id


      });


      done++;


    }


  } catch(e) {


    console.error('[ScanAll] Batch error:', e.message);


    showAutoCheckBar(`⚠ Scan fout: ${e.message}`, 5000);


  }





  // Koppel valueData aan match objecten voor Triple/Double Lock rendering


  state.matches.forEach(m => { if (m) m.valueData = null; });


  scans.forEach(s => {


    if (s.match && s.value >= 5) {


      s.match.valueData = {


        pct: s.value,


        pick: s.pick, pickLabel: s.pickLabel,


        kans: s.kans, odds: s.odds,


        bookmaker: s.bookmaker,


        kelly: s.kelly,


        confidence: s.confidence,


        poissonUsed: s.poissonUsed || false,


        poissonK1: s.poissonK1, poissonKX: s.poissonKX, poissonK2: s.poissonK2,


        market: s.market,


        reason: s.reason


      };


    }


  });





  // Filter op value > 0 en render


  state.valueScans = scans;


  // Bewaar scan resultaten zodat ze zichtbaar blijven na verversen


  state.lastScanResults = scans.map(s => ({


    matchId: s.match.id,


    home: s.match.home,


    away: s.match.away,


    comp: s.match.comp || '',


    pick: s.pick,


    pickLabel: s.pickLabel,


    value: s.value,


    confidence: s.confidence,


    odds: s.odds,


    kelly: s.kelly,


    scanTime: new Date().toLocaleString('nl-NL', {weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}),


    matchDate: s.match.date ? `${s.match.date}${s.match.time ? ' · ' + s.match.time : ''}` : '',


    matchTime: s.match.time || ''


  }));


  saveState();





  // Save to backtest — alleen bekende competities (niet Deens/Noors/etc.)


  const knownLeagueIds = new Set(Object.values(COMP_IDS));


  let savedCount = 0;


  scans.filter(s => s.value >= 5).forEach(s => {


    // Skip unknown competitions


    const leagueId = s.match.leagueId || s.match.raw?.league?.id;


    if (leagueId && !knownLeagueIds.has(leagueId)) return;


    const exists = (state.valueBacktest?.picks||[]).some(p => String(p.matchId) === String(s.match.id));


    if (!exists) {


      if (!state.valueBacktest) state.valueBacktest = { picks:[] };


      state.valueBacktest.picks.unshift({


        id: Date.now() + Math.random(),


        matchId: String(s.match.id),


        matchName: `${s.match.home} vs ${s.match.away}`,


        fixtureId: s.match.id,


        date: s.match.date || new Date().toLocaleDateString('nl-NL'),


        pick: s.pick, pickLabel: s.pickLabel,


        aiKans: s.kans, odds: s.odds,


        bookmaker: s.bookmaker,


        value: parseFloat(s.value.toFixed(1)),


        kelly: parseFloat((s.kelly||0).toFixed(1)),


        confidence: s.confidence || 5,


        reason: s.reason || '',


        status: 'pending', score: null,


        comp: s.match.comp || '',


        scanDate: new Date().toLocaleString('nl-NL')


      });


      savedCount++;


    }


  });


  if (savedCount > 0) saveState();





  // Render value results in matchList with Triple/Double Lock


  renderMatches(state.matches);


  setTimeout(sortMatchListByValue, 50);





  // Toon scan resultaten panel — altijd zichtbaar, naar boven scrollen


  renderScanResults(scans);





  // Zorg dat scanResultsBody open is


  const scanBody = document.getElementById('scanResultsBody');


  if (scanBody) scanBody.style.display = 'block';


  const scanChev = document.getElementById('scanResultsChevron');


  if (scanChev) scanChev.textContent = '▼';





  // Scroll naar resultaten


  setTimeout(() => {


    const panel = document.getElementById('scanResultsPanel');


    if (panel) {


      panel.style.display = 'block';


      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });


    }


  }, 300);





  // Send notifications for triple/double lock


  if (state.settings.notifEnabled && Notification.permission === 'granted') {


    // Groepeer per confidence niveau — stuur max 3 meldingen


    const notifPicks = scans


      .filter(s => s.value >= 5 && s.confidence >= 7)


      .sort((a,b) => b.value - a.value)


      .slice(0, 3);


    notifPicks.forEach(s => {


      sendPickNotification('🔑 Double Lock', s.match.home+' vs '+s.match.away+' — '+s.pickLabel+' @ '+(s.odds?.toFixed(2)||'?'), 'double-'+s.id, s.match.id, s.match.comp);


    });


    // Triple locks apart


    scans.filter(s => s.value >= 5 && s.confidence >= 9).forEach(s => {


      sendPickNotification('🏆 TRIPLE LOCK', s.match.home+' vs '+s.match.away+' — '+s.pickLabel+' @ '+(s.odds?.toFixed(2)||'?')+' (+'+Math.round(s.value)+'% value)', 'triple-'+s.id, s.match.id, s.match.comp);


    });


  }





  const valueCount = scans.filter(s => s.value >= 5).length;


  if (btn) { btn.disabled = false; btn.classList.remove('scanning'); btn.textContent = valueCount > 0 ? `✅ ${valueCount} picks` : origText; }


  setTimeout(() => { if (btn) btn.textContent = origText; }, 5000);





  if (scans.length === 0) {


    showAutoCheckBar('⚠ Geen resultaten — check console voor fouten', 5000);


  } else {


    showAutoCheckBar(`⚡ ${scans.length} gescand · ${valueCount} value picks gevonden`, 4000);


  }


}



// ── AI Leer-context: historische stats voor betere analyses ──
function buildAIHistoryContext() {
  try {
    const bets = (state.wallet?.bets || []).filter(b => b.status === 'win' || b.status === 'lose');
    if (bets.length < 3) return '';

    // Globale stats
    const wins = bets.filter(b => b.status === 'win').length;
    const hitRate = Math.round(wins / bets.length * 100);
    const profit = bets.reduce((s, b) => b.status === 'win' ? s + (b.odds - 1) : s - 1, 0);
    const roi = ((profit / bets.length) * 100).toFixed(1);

    // Per competitie
    const compMap = {};
    for (const b of bets) {
      const key = b.comp || b.league || 'Overig';
      if (!compMap[key]) compMap[key] = { wins: 0, total: 0, profit: 0 };
      compMap[key].total++;
      if (b.status === 'win') { compMap[key].wins++; compMap[key].profit += (b.odds - 1); }
      else compMap[key].profit -= 1;
    }

    const compLines = Object.entries(compMap)
      .filter(([, d]) => d.total >= 3)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 6)
      .map(([comp, d]) => {
        const pct = Math.round(d.wins / d.total * 100);
        const r = ((d.profit / d.total) * 100).toFixed(1);
        const trend = parseFloat(r) > 5 ? '📈' : parseFloat(r) < -5 ? '📉' : '➡️';
        return `  - ${comp}: ${d.total} picks, ${pct}% treffscore, ROI ${r}% ${trend}`;
      }).join('\n');

    // Per pick type (1/X/2)
    const pickMap = { '1': { wins: 0, total: 0 }, 'X': { wins: 0, total: 0 }, '2': { wins: 0, total: 0 } };
    for (const b of bets) {
      const t = b.pick || '1';
      if (pickMap[t]) { pickMap[t].total++; if (b.status === 'win') pickMap[t].wins++; }
    }
    const pickLines = Object.entries(pickMap)
      .filter(([, d]) => d.total >= 3)
      .map(([t, d]) => `  - Pick ${t}: ${d.total}x, ${Math.round(d.wins/d.total*100)}% treffscore`)
      .join('\n');

    // Recente vorm (laatste 10)
    const recent = bets.slice(0, 10);
    const recentWins = recent.filter(b => b.status === 'win').length;
    const recentForm = recent.map(b => b.status === 'win' ? 'W' : 'L').join('');

    let ctx = `\n\nJOUW HISTORISCHE PRESTATIES (gebruik dit om je analyse te kalibreren):`;
    ctx += `\nAlgemeen: ${bets.length} picks, ${hitRate}% treffscore, ROI ${roi}%`;
    ctx += `\nRecente vorm (laatste ${recent.length}): ${recentForm} (${recentWins}/${recent.length} gewonnen)`;
    if (compLines) ctx += `\nPer competitie:\n${compLines}`;
    if (pickLines) ctx += `\nPer pick type:\n${pickLines}`;
    ctx += `\n→ Wees strenger in competities met negatieve ROI. Vertrouw je sterke competities meer.`;

    return ctx;
  } catch(e) {
    return '';
  }
}

async function scanValueAll() {


  const apiKey = 'server'; // Anthropic op server


  const candidates = state.matches.filter(m =>


    m.homeOdds !== '—' && !m.isDone && parseFloat(m.homeOdds) > 1


  ).slice(0, 10);





  if (!candidates.length) {


    alert('Geen wedstrijden met quotes gevonden. Laad eerst een competitie of vul quotes in.');


    return;


  }





  const btn = document.getElementById('scanValueBtn');


  btn.disabled = true;


  btn.textContent = '⟳ STAND OPHALEN...';





  if (!state.settings.valueExplainerSeen) {


    document.getElementById('valueExplainer').style.display = 'block';


  }





  // ── ACTUELE RANGLIJST OPHALEN ──


  let standingsCtx = '';


  if (null) {


    try {


      const leagueId = COMP_IDS[state.activeComp];


      const r = await apiFetch(


        `https://v3.football.api-sports.io/standings?league=${leagueId}&season=2026`,


        null, 6000


      );


      const d = await r.json();


      const standings = d.response?.[0]?.league?.standings?.[0];


      if (standings?.length) {


        // Store voor seizoensfase berekening


        matchDataMap['_standings'] = standings;


        standingsCtx = `\n\nSTAND (${state.activeComp.toUpperCase()}):\n` +


          standings.map(t =>


            `${t.rank}. ${t.team.name} — ${t.points}pt | W${t.all.win}G${t.all.draw}V${t.all.lose} | DS:${t.goalsDiff>0?'+':''}${t.goalsDiff}`


          ).join('\n');


      }


    } catch(e) {}


  }





  // ── H2H + VORM + BLESSURES OPHALEN (parallel per wedstrijd) ──


  // Verrijkt de scan met concrete data zodat AI minder hoeft te gokken.


  // Ook de confidence-score is hierop gebaseerd: meer data = hogere confidence.


  btn.textContent = '⟳ DATA VERZAMELEN...';


  const matchDataMap = {};


  const leagueId = COMP_IDS[state.activeComp];





  if (null) {


    const wt = (p, ms=5000) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);





    // Parallel ophalen per wedstrijd — inclusief team stats voor Poisson


    await Promise.all(candidates.map(async m => {


      if (!m.homeId || !m.awayId) {


        matchDataMap[m.id] = { confidence: 3 };


        return;


      }


      try {


        const [h2h, homeForm, awayForm, homeInj, awayInj, hStats, aStats, homeLastFix, awayLastFix] = await Promise.all([


          wt(fetchH2H(m.homeId, m.awayId), 5000),


          wt(fetchTeamForm(m.homeId), 5000),


          wt(fetchTeamForm(m.awayId), 5000),


          wt(fetchInjuries(m.homeId, m.id), 4000),


          wt(fetchInjuries(m.awayId, m.id), 4000),


          wt(fetchTeamStats(m.homeId, leagueId), 5000),


          wt(fetchTeamStats(m.awayId, leagueId), 5000),


          wt(fetchLastFixture(m.homeId, null), 4000),


          wt(fetchLastFixture(m.awayId, null), 4000),


        ]);





        // Confidence score berekenen


        let conf = 4;


        if (h2h?.length >= 3) conf += 2;


        else if (h2h?.length) conf += 1;


        if (homeForm?.length >= 5 && awayForm?.length >= 5) conf += 2;


        else if (homeForm?.length && awayForm?.length) conf += 1;


        if (homeInj !== null && awayInj !== null) conf += 1;


        if (m.isLive || m.liveMin) conf += 1;





        // ── POISSON BEREKENING MET BLESSURE-CORRECTIE ──


        const homeGoalStats = hStats ? extractTeamGoalStats(hStats) : null;


        const awayGoalStats = aStats ? extractTeamGoalStats(aStats) : null;





        // Bereken blessure-impact per team


        // API geeft pos: G=keeper, D=verdediger, M=middenvelder, F=aanvaller


        const calcInjuryFactor = (injuries) => {


          if (!injuries?.length) return { attackFactor: 1.0, defenseFactor: 1.0, count: 0 };


          let attackPenalty = 0, defensePenalty = 0;


          injuries.forEach(inj => {


            const pos = inj.player?.pos || '';


            if (pos === 'F') attackPenalty += 0.10;


            else if (pos === 'M') { attackPenalty += 0.06; defensePenalty += 0.05; }


            else if (pos === 'D') defensePenalty += 0.10;


            else if (pos === 'G') defensePenalty += 0.18;


            else { attackPenalty += 0.04; defensePenalty += 0.04; }


          });


          const total = injuries.length;


          if (total >= 5)  { attackPenalty += 0.05; defensePenalty += 0.05; }


          if (total >= 8)  { attackPenalty += 0.08; defensePenalty += 0.08; }


          if (total >= 12) { attackPenalty += 0.10; defensePenalty += 0.10; }


          return {


            attackFactor:  Math.max(0.40, 1 - Math.min(attackPenalty,  0.60)),


            defenseFactor: Math.max(0.40, 1 - Math.min(defensePenalty, 0.60)),


            count: total


          };


        };





        const homeInjFactor = calcInjuryFactor(homeInj);


        const awayInjFactor = calcInjuryFactor(awayInj);





        const poisson = calcPoissonKansen(


          homeGoalStats, awayGoalStats,


          1.35,


          homeInjFactor, awayInjFactor  // meegeven aan Poisson


        );


        if (poisson.valid) conf = Math.min(10, conf + 1);





        // ── MARKTBEWEGING ──


        const market = analyzeMarketMovement(


          m.id,


          parseFloat(m.homeOdds) || 0,


          parseFloat(m.drawOdds) || 0,


          parseFloat(m.awayOdds) || 0


        );





        conf = Math.min(10, Math.max(1, conf + (market.confDelta || 0)));





        // Rust factor


        const matchDateObj = m.dateISO ? new Date(m.dateISO) : null;


        const homeRest = calcRestDays(homeLastFix, matchDateObj);


        const awayRest = calcRestDays(awayLastFix, matchDateObj);





        // Thuis/uit sterkte ratio


        const homeStrength = hStats ? calcHomeAwayStrength(hStats) : null;


        const awayStrength = aStats ? calcHomeAwayStrength(aStats) : null;





        // Seizoensfase uit standings


        const standingsArr = matchDataMap['_standings'];


        const phaseCtx = standingsArr ? calcSeasonPhase(standingsArr, m.home, m.away) : '';





        // Confidence boost voor extra data


        if (homeRest !== null && awayRest !== null) conf = Math.min(10, conf + 0.5);


        if (homeStrength) conf = Math.min(10, conf + 0.5);





        matchDataMap[m.id] = {


          h2h: h2h?.length ? formatH2HCompact(h2h.slice(0,5), m.home, m.away) : '',


          homeForm: homeForm?.length ? formatFormCompact(homeForm.slice(0,5), m.homeId, m.home) : '',


          awayForm: awayForm?.length ? formatFormCompact(awayForm.slice(0,5), m.awayId, m.away) : '',


          homeInj: homeInj?.length ? `${homeInj.length}x out` : 'fit',


          awayInj: awayInj?.length ? `${awayInj.length}x out` : 'fit',


          homeInjCount: homeInj?.length || 0,


          awayInjCount: awayInj?.length || 0,


          homeRest, awayRest, homeStrength, awayStrength, phaseCtx,


          poisson, market,


          confidence: Math.min(10, conf)


        };


      } catch(e) {


        matchDataMap[m.id] = { confidence: 4 };


      }


    }));


  } else {


    candidates.forEach(m => { matchDataMap[m.id] = { confidence: 3 }; });


  }





  btn.textContent = '⟳ SCANNEN...';





  // Build context per match — Poisson als wiskundig anker voor de AI


  const ctx = candidates.map((m, i) => {


    const d = matchDataMap[m.id] || {};


    const p = d.poisson;


    let line = `${i+1}. ID:${m.id} | ${m.home} vs ${m.away} | ${m.comp} | ${m.date||''} ${m.time} | Quotes: 1=${m.homeOdds} X=${m.drawOdds} 2=${m.awayOdds}`;


    // Poisson als primair anker — staat bovenaan zodat AI het als basis ziet


    if (p?.valid) {


      line += `\n   📐 Poisson-model: 1=${p.k1}% X=${p.kX}% 2=${p.k2}% (λ_thuis=${p.lambdaHome} λ_uit=${p.lambdaAway})`;


    }


    if (d.homeForm) line += `\n   Vorm ${m.home}: ${d.homeForm}`;


    if (d.awayForm) line += `\n   Vorm ${m.away}: ${d.awayForm}`;


    if (d.h2h) line += `\n   H2H: ${d.h2h}`;


    if (d.homeInj || d.awayInj) line += `\n   Blessures: ${m.home}=${d.homeInj||'?'}, ${m.away}=${d.awayInj||'?'}`;


    if (d.market?.direction !== 'none') line += `\n   Markt: ${d.market?.label||''}`;


    // Rust factor


    if (d.homeRest !== null || d.awayRest !== null) {


      line += `\n   Rust: ${m.home}=${restLabel(d.homeRest)}, ${m.away}=${restLabel(d.awayRest)}`;


    }


    // Thuis/uit sterkte


    if (d.homeStrength?.diff > 15) line += `\n   ${m.home} dominant thuis (${d.homeStrength.homeWinRate}% gewonnen thuis vs ${d.homeStrength.awayWinRate}% uit)`;


    if (d.awayStrength?.diff < -10) line += `\n   ${m.away} beter uit dan thuis`;


    // Seizoensfase


    if (d.phaseCtx) line += `\n   Seizoensfase: ${d.phaseCtx}`;


    return line;


  }).join('\n\n');





  try {


    const data = await anthropicFetchWithRetry(apiKey, {


      model: 'claude-haiku-4-5-20251001',


      max_tokens: 1500,


      temperature: 0,


      system: `Je bent een elite value-betting analist. Analyseer ELKE wedstrijd volledig. Geef kans1+kansX+kans2=100. NOOIT markdown headers of tekst buiten JSON.





WERKWIJZE — strikt in deze volgorde:


1. POISSON als wiskundig anker (seizoensstatistieken, meest objectief)


2. xG-correctie: als Poisson incl. xG, dan hogere betrouwbaarheid


3. RUST-FACTOR: ≤3 dagen rust = -3-5% kansen voor dat team


4. THUIS/UIT RATIO: team dat dominant thuis is → +3-5% thuisvoordeel


5. BLESSURES: sleutelspeler out → +3-5% tegenstander


6. H2H PATROON: eenduidig 4/5 zelfde team → +4% correctie


7. SEIZOENSFASE: degradatiedruk = hogere inzet, niks te verliezen = lager


8. MARKTBEWEGING sharp money → zwaar wegen (+4-6%)


9. Max totale correctie t.o.v. Poisson: ±12pp per uitkomst





KRITIEKE REGELS:


- Poisson+xG is betrouwbaarder dan gevoel — wijk er NIET van af zonder concrete reden


- Rust ≤2 dagen is een grote factor (physiek nadeel)


- 14+ blessures = GROOT nadeel — team speelt met B-keuze spelers → min 15-20% kansreductie voor dat team


- 8-13 blessures = significant nadeel → min 10-15% kansreductie


- Blessures bij keeper of vaste aanvaller = extra zwaar wegen


- Degradatiedruk verhoogt thuiswinst-kans met 5-8% (steun publiek, alles op alles)


- "Zonder druk" team (midden stand, seizoen bijna klaar) → meer X-kans


- Sharp money overtreft publieke mening altijd


- Confidence: 9-10 = Poisson+xG+H2H consistent, 7-8 = goed data, 5-6 = beperkt, <5 = gokken





RESPOND WITH VALID JSON ONLY. START WITH { END WITH }. NO TEXT BEFORE OR AFTER.


{"scans":[{"id":"123","kans1":45,"kansX":30,"kans2":25,"confidence":8,"reason":"Max 15 woorden"}]}`,


      messages: [{ role:'user', content:`Analyseer ${candidates.length} wedstrijden. Gebruik Poisson als anker, pas aan voor context:\n\n${ctx}${standingsCtx}` }]


    });





    if (data.error) throw new Error(data.error.message);


    let raw = data.content[0].text.trim();


    const _s = raw.indexOf('{'), _e = raw.lastIndexOf('}');


    if (_s < 0 || _e < _s) throw new Error('Geen JSON in response: ' + raw.substring(0,60));


    const result = JSON.parse(raw.substring(_s, _e + 1));





    const scans = (result.scans || []).map(s => {


      const match = candidates.find(m => String(m.id) === String(s.id));


      if (!match) return null;





      // Normaliseer AI-kansen naar 100


      const sum = (s.kans1||0) + (s.kansX||0) + (s.kans2||0);


      if (sum < 80 || sum > 120) return null;


      let aiK1 = Math.round((s.kans1||0) / sum * 100);


      let aiKX = Math.round((s.kansX||0) / sum * 100);


      let aiK2 = Math.round((s.kans2||0) / sum * 100);





      // ── BLEND: POISSON + AI ──


      // Poisson = wiskundig anker (seizoensstatistieken, geen bias)


      // AI = context-correctie (blessures, H2H, motivatie)


      // Gewicht: 65% Poisson + 35% AI (als Poisson beschikbaar)


      const poisson = matchDataMap[s.id]?.poisson;


      let k1, kX, k2;


      if (poisson?.valid) {


        // Dynamisch Poisson-gewicht: meer data + xG = meer vertrouwen in model


        const d = matchDataMap[s.id];


        const hasXG = poisson.hasXG;


        const hasH2H = d?.h2h?.length > 0;


        const hasForm = d?.homeForm && d?.awayForm;


        // Basisgewicht Poisson: 65%, meer als xG beschikbaar


        const poissonW = Math.min(0.80,


          0.65


          + (hasXG   ? 0.08 : 0)   // xG beschikbaar: +8%


          + (hasH2H  ? 0.03 : 0)   // goede H2H data: +3%


          + (hasForm ? 0.04 : 0)   // vorm beschikbaar: +4%


        );


        const aiW = 1 - poissonW;


        k1 = Math.round(poissonW * poisson.k1 + aiW * aiK1);


        kX = Math.round(poissonW * poisson.kX + aiW * aiKX);


        k2 = Math.round(poissonW * poisson.k2 + aiW * aiK2);


        // Herkalibreer


        const blendSum = k1 + kX + k2;


        if (blendSum !== 100) k1 += (100 - blendSum);


      } else {


        // Geen Poisson: gebruik AI maar met market-calibratie als vangrail


        k1 = aiK1; kX = aiKX; k2 = aiK2;





        // Market-calibratie (vangrail als Poisson ontbreekt)


        const drawOddsNum = parseFloat(match.drawOdds);


        const homeOddsNum = parseFloat(match.homeOdds);


        const awayOddsNum = parseFloat(match.awayOdds);


        if (drawOddsNum > 1 && homeOddsNum > 1 && awayOddsNum > 1) {


          const mktSum = 1/homeOddsNum + 1/drawOddsNum + 1/awayOddsNum;


          const mktDraw = Math.round((1/drawOddsNum) / mktSum * 100);


          const mktHome = Math.round((1/homeOddsNum) / mktSum * 100);


          const drawDiff = kX - mktDraw;


          if (drawDiff > 8) {


            const correction = Math.round(drawDiff * 0.6);


            kX -= correction;


            const homeShare = mktHome / (100 - mktDraw);


            k1 += Math.round(correction * homeShare);


            k2 += correction - Math.round(correction * homeShare);


          }


          if (homeOddsNum < 1.8 && k1 < 50) {


            const boost = 50 - k1;


            k1 = 50;


            kX = Math.max(10, kX - Math.round(boost * 0.7));


            k2 = Math.max(5, k2 - Math.round(boost * 0.3));


          }


          const ns = k1 + kX + k2;


          if (ns !== 100) k1 += (100 - ns);


        }


      }





      // ── MARKTBEWEGING CORRECTIE ──


      // Als sharp money op een bepaalde kant stroomt: pas kansen 3% aan die richting


      const market = matchDataMap[s.id]?.market;


      if (market?.isSteam && market.direction) {


        const adj = 3;


        if (market.direction === '1') { k1 += adj; kX -= adj; }


        else if (market.direction === 'X') { kX += adj; k1 -= adj; }


        else if (market.direction === '2') { k2 += adj; kX -= adj; }


        // Herkalibreer


        k1 = Math.max(5, k1); kX = Math.max(5, kX); k2 = Math.max(5, k2);


        const ms = k1 + kX + k2;


        if (ms !== 100) k1 += (100 - ms);


      }





      // Confidence: data-confidence + AI-confidence + Poisson bonus


      const dataConf = matchDataMap[s.id]?.confidence || 4;


      const aiConf = Math.max(1, Math.min(10, parseInt(s.confidence) || 5));


      const poissonBonus = poisson?.valid ? 1 : 0;


      const confidence = Math.min(10, Math.round((dataConf + aiConf) / 2) + poissonBonus);





      // Value berekenen voor alle 3 picks


      const picks = [


        { pick:'1', pickLabel:`${match.home} wint`, kans:k1, oddsInfo:getBestOdds(match, '1') },


        { pick:'X', pickLabel:`Gelijkspel`,         kans:kX, oddsInfo:getBestOdds(match, 'X') },


        { pick:'2', pickLabel:`${match.away} wint`, kans:k2, oddsInfo:getBestOdds(match, '2') },


      ].filter(p => p.oddsInfo);





      picks.forEach(p => {


        p.odds = p.oddsInfo.odds;


        p.bookmaker = p.oddsInfo.bookmaker;


        p.value = calcValue(p.kans, p.odds);


        p.kelly = halfKelly(p.kans, p.odds);


      });





      // ── GELIJKSPEL SANITY CHECKS ──


      const homeOddsF = parseFloat(match.homeOdds) || 99;


      const awayOddsF = parseFloat(match.awayOdds) || 99;


      const favoriteOdds = Math.min(homeOddsF, awayOddsF);


      const drawPick = picks.find(p => p.pick === 'X');


      const homePick = picks.find(p => p.pick === '1');


      const awayPick = picks.find(p => p.pick === '2');





      // Regel 0: Extreme favoriet (odds < 1.50) → hele wedstrijd overslaan.


      // Bij PSV 1.18, Ajax 1.22 etc. is geen van de picks betrouwbaar value:


      // - Thuiswinst: te laag geprijsd, nauwelijks value mogelijk


      // - Gelijkspel/uitwinst: onrealistisch hoge value door extreme kansen


      if (favoriteOdds < 1.50) return null;





      if (drawPick) {


        // Regel 1: Duidelijke favoriet (odds < 2.20) → gelijkspel mag niet beste pick zijn.


        if (favoriteOdds < 2.20 && drawPick.value > 0) {


          drawPick.value = Math.min(drawPick.value, 3);


        }





        // Regel 2: Gelijkspel value > 15% is statistisch onwaarschijnlijk.


        const otherHasValue = (homePick?.value > 5) || (awayPick?.value > 5);


        if (drawPick.value > 15 && otherHasValue) {


          drawPick.value = 12;


        }





        // Regel 3: Thuiswinst preferentie bij vergelijkbare value en dominante thuisploeg.


        if (drawPick.value > 0 && homePick?.value > 0 && k1 > 45) {


          if (drawPick.value - homePick.value < 4) {


            drawPick.value = homePick.value - 1;


          }


        }


      }





      // Kies pick met hoogste value na sanity checks


      picks.sort((a, b) => (b.value||-999) - (a.value||-999));


      const best = picks[0];


      if (!best) return null;





      // ── VALUE CAP ──


      // Value >60% is statistisch ongeloofwaardig — bookmakers zitten nooit zo ver mis.


      // Waarschijnlijk een data-probleem (verouderde stats, ontbrekende blessures).


      // Cap op 55% en voeg waarschuwing toe.


      const rawValue = best.value;


      const cappedValue = Math.min(best.value, 55);


      const valueCapped = rawValue > 55;


      if (valueCapped) best.value = cappedValue;





      // Injury warning: ≥3 blessures bij favoriete team = rode vlag


      const homeInjCount = matchDataMap[s.id]?.homeInjCount || 0;


      const awayInjCount = matchDataMap[s.id]?.awayInjCount || 0;


      const injWarning = (best.pick === '1' && homeInjCount >= 3) ||


                         (best.pick === '2' && awayInjCount >= 3) ||


                         (homeInjCount >= 4 || awayInjCount >= 4);





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


        valueCapped, rawValue,   // voor waarschuwing in UI


        injWarning,              // voor waarschuwing in UI


        reason: s.reason || ''


      };


    }).filter(x => x !== null);





    state.valueScans = scans;





    // Push notificaties voor Triple Lock en Double Lock picks


    if (state.settings.notifEnabled && Notification.permission === 'granted') {


      const triplePicks = scans.filter(s => s.value >= 5 && s.confidence >= 7 && s.poissonUsed);


      const doublePicks = scans.filter(s => {


        const sc = (s.value>=5?1:0)+(s.confidence>=7?1:0)+(s.poissonUsed?1:0);


        return sc === 2;


      });





      // Triple Lock → altijd sturen


      triplePicks.forEach(s => {


        sendPickNotification(


          '🏆 TRIPLE LOCK +' + Math.round(s.value) + '%',


          s.match.home + ' vs ' + s.match.away + ' — ' + s.pickLabel + ' @ ' + (s.odds?.toFixed(2)||'?'),


          'triple-' + s.id, s.match.id, s.match.comp


        );


        // Echte push (ook bij gesloten app)


        sendRealPush(


          '🏆 TRIPLE LOCK +' + Math.round(s.value) + '% VALUE',


          s.match.home + ' vs ' + s.match.away + ' — ' + s.pickLabel + ' @ ' + (s.odds?.toFixed(2)||'?') + ' · 🎲 ' + s.confidence + '/10 · 📐 Poisson',


          { tag: 'triple-' + s.id, matchId: s.match.id, comp: s.match.comp }


        ).catch(() => {});


      });





      // Double Lock → alleen als boven drempel


      const threshold = state.settings.notifThreshold || 15;


      doublePicks.filter(s => s.value >= threshold).forEach(s => {


        sendPickNotification(


          '🔑 Double Lock +' + Math.round(s.value) + '%',


          s.match.home + ' vs ' + s.match.away + ' — ' + s.pickLabel + ' @ ' + (s.odds?.toFixed(2)||'?'),


          'double-' + s.id, s.match.id, s.match.comp


        );


        sendRealPush(


          '🔑 Double Lock +' + Math.round(s.value) + '% VALUE',


          s.match.home + ' vs ' + s.match.away + ' — ' + s.pickLabel + ' @ ' + (s.odds?.toFixed(2)||'?') + ' · 🎲 ' + s.confidence + '/10',


          { tag: 'double-' + s.id, matchId: s.match.id, comp: s.match.comp }


        ).catch(() => {});


      });





      // Samenvatting push als er veel picks zijn


      if (triplePicks.length + doublePicks.length >= 3) {


        const total = triplePicks.length + doublePicks.length;


        sendRealPush(


          '⚡ TOTO AI — ' + total + ' value picks gevonden',


          triplePicks.length + '× Triple Lock · ' + doublePicks.length + '× Double Lock · Bekijk de app',


          { tag: 'scan-summary-' + Date.now() }


        ).catch(() => {});


      }


    }





    // Koppel aan matches voor rendering


    // Alleen matches met ≥5% value krijgen een valueData (badge + markering)


    state.matches.forEach(m => { m.valueData = null; });


    scans.forEach(s => {


      if (s.match && s.value >= 5) {


        s.match.valueData = {


          pct: s.value,


          pick: s.pick, pickLabel: s.pickLabel,


          kans: s.kans, odds: s.odds,


          bookmaker: s.bookmaker,


          kelly: s.kelly,


          confidence: s.confidence,


          poissonUsed: s.poissonUsed,


          poissonK1: s.poissonK1, poissonKX: s.poissonKX, poissonK2: s.poissonK2,


          market: s.market,


          reason: s.reason


        };


      }


    });





    // ── AUTO-SAVE BACKTEST PICKS (≥5% value) ──


    // Sla alleen op als de pick nog niet bestaat (zelfde matchId+pick combo)


    const newPicks = scans.filter(s => s.value >= 5);


    let savedCount = 0;


    if (!state.valueBacktest) state.valueBacktest = { picks: [] };


    newPicks.forEach(s => {


      const alreadySaved = state.valueBacktest.picks.some(p =>


        String(p.matchId) === String(s.match.id) && p.pick === s.pick


      );


      if (!alreadySaved) {


        state.valueBacktest.picks.unshift({


          id: Date.now() + Math.random(),


          matchId: String(s.match.id),


          matchName: `${s.match.home} vs ${s.match.away}`,


          fixtureId: s.match.id,


          date: s.match.date || new Date().toLocaleDateString('nl-NL'),


          matchDateObj: s.match.date || '',


          pick: s.pick,


          pickLabel: s.pickLabel,


          aiKans: s.kans,


          odds: s.odds,


          bookmaker: s.bookmaker,


          value: parseFloat(s.value.toFixed(1)),


          kelly: parseFloat((s.kelly||0).toFixed(1)),


          confidence: s.confidence || 5,


          reason: s.reason || '',


          status: 'pending',


          score: null,


          comp: s.match.comp || state.activeComp || '',


          scanDate: new Date().toLocaleString('nl-NL')


        });


        savedCount++;


      }


    });


    if (savedCount > 0) {


      saveState();


      showFirebaseStatus(`⚡ ${savedCount} value-pick${savedCount > 1?'s':''} opgeslagen in Backtest`, '#15803d');


    }





    // Sorteer op value en filter voor banner: alleen ≥5%


    scans.sort((a, b) => (b.value||-999) - (a.value||-999));


    const displayScans = scans.filter(s => s.value >= 5);





    renderMatches(state.matches);


    renderValueBanner(displayScans, scans.length);





    // Push notificaties


    if (state.settings.notifEnabled && 'Notification' in window && Notification.permission === 'granted') {


      const threshold = state.settings.notifThreshold || 20;


      const strong = scans.filter(s => s.value >= threshold);


      strong.slice(0, 3).forEach((s, i) => {


        setTimeout(() => sendValueNotification(s), i * 500);


      });


    }





  } catch(e) {


    alert('Value scan mislukt: ' + e.message);


  }





  btn.disabled = false;


  btn.textContent = '⚡ OPNIEUW SCANNEN';


}





function renderValueBanner(displayScans, totalScanned) {


  const banner = document.getElementById('valueBanner');





  // Als er géén value ≥5% is — toon een informatieve melding ipv niks


  if (!displayScans?.length) {


    banner.innerHTML = `


      <div class="value-banner-header">


        <div class="value-banner-title">⚡ VALUE SCAN</div>


        <div class="value-banner-meta">${totalScanned||0} gescand</div>


      </div>


      <div style="padding:.8rem;text-align:center;font-family:'IBM Plex Mono',monospace;font-size:.62rem;color:var(--muted);line-height:1.7;">


        Geen value ≥5% gevonden in deze wedstrijden.<br>


        Bookmakers hebben goede quotes — probeer later opnieuw of andere competitie.


      </div>


      <div style="display:flex;justify-content:flex-end;">


        <button onclick="hideValueBanner()" style="background:none;border:none;color:var(--sub);cursor:pointer;font-size:.9rem;padding:0 .3rem;">✕</button>


      </div>`;


    banner.style.display = 'block';


    return;


  }





  const top = displayScans.slice(0, 6);


  const highCount = displayScans.filter(s => s.value >= 15).length;


  const medCount = displayScans.filter(s => s.value >= 5 && s.value < 15).length;





  banner.innerHTML = `


    <div class="value-banner-header">


      <div class="value-banner-title">⚡ VALUE SCAN</div>


      <div class="value-banner-meta">


        <span style="color:#15803d;font-weight:700;">${highCount} sterk</span> ·


        <span style="color:#b45309;font-weight:700;">${medCount} licht</span> ·


        ${totalScanned - displayScans.length} filtered


      </div>


    </div>


    ${top.map(s => {


      const cls = valueClass(s.value);


      const sign = s.value > 0 ? '+' : '';


      const defaultBet = state.settings.defaultBet || 10;


      const bankroll = state.wallet?.balance || defaultBet * 50;


      const kellyEuros = (s.kelly / 100 * bankroll).toFixed(2);


      const poissonBadge = s.poissonUsed ? `<span style="color:#2563eb;font-weight:700;">📐</span> ` : '';


      const marketBadge = s.market?.isSteam && s.market?.label ? `<span style="color:#7c3aed;">📉 ${s.market.label.split('(')[0].trim()}</span>` : '';


      const injBadge = s.injWarning ? `<span style="color:#dc2626;font-weight:700;">⚠ blessures</span>` : '';


      const cappedBadge = s.valueCapped ? `<span style="color:#d97706;font-size:.45rem;"> (gecapped van +${Math.round(s.rawValue)}%)</span>` : '';


      return `


        <div class="value-row" onclick="openValueAnalysis('${s.match.id}')" title="Tik voor volledige AI analyse">


          <div class="value-row-match">


            <div class="value-row-name">${poissonBadge}${shortName(s.match.home)} vs ${shortName(s.match.away)}${injBadge ? ' '+injBadge : ''}</div>


            <div class="value-row-pick">${s.pickLabel} · ${s.kans}%${s.poissonUsed?' (P+AI)':' (AI)'} · ${s.reason}</div>


            <div style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;color:var(--sub);margin-top:2px;">


              📊 ${s.bookmaker} · 🎯 ½ Kelly: ${s.kelly.toFixed(1)}% (€${kellyEuros})${s.confidence ? ` · 🎲 ${s.confidence}/10` : ''}${marketBadge ? ' · '+marketBadge : ''}


            </div>


          </div>


          <div class="value-row-odds">${s.odds.toFixed(2)}</div>


          <div class="value-row-val ${cls}">${sign}${Math.round(s.value)}%${cappedBadge}</div>


        </div>`;


    }).join('')}


    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:.5rem;padding-top:.5rem;border-top:1px dashed rgba(15,23,42,.1);">


      <span style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;color:var(--sub);">


        ⚡ Value ≥5% · beste bookmaker quote · ½ Kelly inzet


      </span>


      <button onclick="hideValueBanner()" style="background:none;border:none;color:var(--sub);cursor:pointer;font-size:.9rem;padding:0 .3rem;">✕</button>


    </div>`;


  banner.style.display = 'block';


}





function hideValueBanner() {


  document.getElementById('valueBanner').style.display = 'none';


}


function hideValueExplainer() {


  document.getElementById('valueExplainer').style.display = 'none';


  state.settings.valueExplainerSeen = true;


  saveState();


}


function scrollToMatch(matchId) {


  const el = document.getElementById('match-' + matchId);


  if (el) el.scrollIntoView({ behavior:'smooth', block:'center' });


}





/**


 * Klik op value-row of value-info in card:


 * Selecteer wedstrijd, switch naar Analyse tab, en start analyse.


 */


function openValueAnalysis(matchId) {


  const match = state.matches.find(m => String(m.id) === String(matchId));


  if (!match) return;


  selectMatch(match);


  switchTab('analyse');


  // Run analyse automatisch (met korte delay zodat UI eerst update)


  setTimeout(() => {


    if (typeof runAnalyse === 'function') runAnalyse();


  }, 300);


}





// ═══════════════════════════════════════════════════════


// 🔔 PUSH NOTIFICATIES


// ═══════════════════════════════════════════════════════


function sendPickNotification(title, body, tag, matchId, comp) {


  if (!state.settings.notifEnabled) return;


  if (!('Notification' in window) || Notification.permission !== 'granted') return;


  if ('serviceWorker' in navigator) {


    navigator.serviceWorker.ready.then(reg => {


      const data = {};


      if (matchId) data.matchId = matchId;


      if (comp)    data.comp    = comp;


      reg.showNotification(title, {


        body, icon:'/icon-192.png', tag,


        renotify:true, vibrate:[200,100,200],


        data


      });


    }).catch(() => {});


  }


}








async function testNotification() {


  const resultEl = document.getElementById('notifTestResult');


  const setResult = (msg, color) => { if (resultEl) { resultEl.textContent = msg; resultEl.style.color = color; } };





  if (!('Notification' in window)) {


    setResult('⚠ Browser ondersteunt geen notificaties', '#dc2626'); return;


  }


  if (Notification.permission === 'denied') {


    setResult('⚠ Geblokkeerd — zet aan via browser instellingen', '#dc2626'); return;


  }


  if (Notification.permission !== 'granted') {


    setResult('⏳ Toestemming vragen...', '#f59e0b');


    const result = await Notification.requestPermission();


    if (result !== 'granted') {


      setResult('⚠ Geen toestemming gegeven', '#dc2626'); return;


    }


  }


  if (!('serviceWorker' in navigator)) {


    setResult('⚠ ServiceWorker niet beschikbaar', '#dc2626'); return;


  }


  // Countdown zodat je de app kunt sluiten


  for (let i = 10; i > 0; i--) {


    setResult(`⏳ Melding komt over ${i} seconden — sluit nu de app!`, '#f59e0b');


    await new Promise(r => setTimeout(r, 1000));


  }


  setResult('⏳ Versturen...', '#2563eb');


  try {


    // Probeer echte push via worker (werkt als app gesloten is)


    const pushed = await sendRealPush(


      '🔔 TOTO AI Test',


      'Notificaties werken! 🏆 Triple Lock · 🔑 Double Lock · ✅ Bet resultaten',


      { tag: 'test-notif' }


    );





    // Fallback: lokale notificatie


    const reg = await navigator.serviceWorker.ready;


    await reg.showNotification('🔔 TOTO AI Test', {


      body: 'Notificaties werken! 🏆 Triple Lock · 🔑 Double Lock · ✅ Bet resultaten',


      icon: '/icon-192.png',


      badge: '/icon-192.png',


      vibrate: [200, 100, 200, 100, 200],


      tag: 'test-notif',


      renotify: true


    });


    setResult(pushed ? '✅ Echte push verstuurd!' : '✅ Lokale melding verstuurd!', '#16a34a');


    // Reset na 5 sec


    setTimeout(() => { if (resultEl) { resultEl.textContent = 'Stuur een testmelding naar je telefoon'; resultEl.style.color = ''; } }, 5000);


  } catch(e) {


    setResult('⚠ Fout: ' + e.message, '#dc2626');


  }


}


async function toggleNotifications() {


  if (!('Notification' in window)) { alert('Je browser ondersteunt geen notificaties.'); return; }


  if (state.settings.notifEnabled) {


    state.settings.notifEnabled = false;


    saveState(); updateNotifUI(); return;


  }


  if (Notification.permission === 'granted') {


    state.settings.notifEnabled = true;


    saveState(); updateNotifUI();


    if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then(r => r.showNotification('⚡ TOTO AI', { body:'Notificaties aan! Je krijgt melding bij sterke value.', icon:'/icon-192.png' })).catch(()=>{});


    // Subscribe to real push if VAPID key available


    if (state.settings.vapidPublicKey) {


      showAutoCheckBar('⏳ Push abonnement aanmaken...', 2000);


      subscribeToPush().then(ok => {


        if (ok) {


          showAutoCheckBar('🔔 Echte push actief — ook als app gesloten!', 4000);


        } else {


          showAutoCheckBar('⚠ Push abonnement mislukt — check console', 4000);


        }


      }).catch(e => {


        showAutoCheckBar('⚠ Push fout: ' + e.message, 5000);


        console.error('[Push]', e);


      });


    } else {


      showAutoCheckBar('⚠ Vul eerst VAPID Public Key in bij Instellingen', 3000);


    }


    return;


  }


  if (Notification.permission === 'denied') {


    alert('Notificaties zijn geblokkeerd. Zet ze aan via je browser-instellingen.');


    return;


  }


  const result = await Notification.requestPermission();


  if (result === 'granted') {


    state.settings.notifEnabled = true;


    saveState(); updateNotifUI();


    if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then(r => r.showNotification('⚡ TOTO AI', { body:'Notificaties aan! Je krijgt melding bij sterke value.', icon:'/icon-192.png' })).catch(()=>{});


  }


}





function updateNotifUI() {


  const btn = document.getElementById('notifBtn');


  const sub = document.getElementById('notifStatusSub');


  const thresh = document.getElementById('notifThreshold');


  const desc = document.getElementById('notifThresholdDesc');


  if (!btn) return;





  const currentThreshold = state.settings.notifThreshold || 15;





  // Update beschrijvingstekst dynamisch


  if (desc) desc.textContent = currentThreshold;





  const perm = ('Notification' in window) ? Notification.permission : 'unsupported';


  if (perm === 'unsupported') {


    btn.textContent = 'NIET ONDERSTEUND'; btn.className = 'notif-btn disable'; btn.disabled = true;


    if (sub) sub.textContent = 'Browser ondersteunt dit niet';


    return;


  }


  if (perm === 'denied') {


    btn.textContent = 'GEBLOKKEERD'; btn.className = 'notif-btn disable';


    if (sub) sub.textContent = 'Zet aan via browser instellingen';


    return;


  }


  if (state.settings.notifEnabled && perm === 'granted') {


    btn.textContent = 'UITZETTEN'; btn.className = 'notif-btn disable';


    if (sub) sub.innerHTML = '<span class="notif-status on">✓ Actief</span> — melding vanaf ' + currentThreshold + '% value';


  } else {


    btn.textContent = 'AANZETTEN'; btn.className = 'notif-btn enable';


    if (sub) sub.innerHTML = '<span class="notif-status off">Uit</span> — klik AANZETTEN voor meldingen';


  }


  if (thresh) thresh.value = currentThreshold;


}





function sendValueNotification(scan) {


  if (!('Notification' in window) || Notification.permission !== 'granted') return;


  const sign = scan.value > 0 ? '+' : '';


  const title = `⚡ ${sign}${Math.round(scan.value)}% VALUE — ${scan.pickLabel}`;


  const body = `${shortName(scan.match.home)} vs ${shortName(scan.match.away)} · quote ${scan.odds.toFixed(2)} · AI ${scan.kans}%`;


  if (!('serviceWorker' in navigator)) return;


  navigator.serviceWorker.ready.then(reg => {


    reg.showNotification(title, {


      body, icon:'/icon-192.png', badge:'/icon-192.png',


      tag: 'value-' + scan.match.id,


      renotify: true,


      requireInteraction: scan.value >= 25,


      vibrate: [200, 100, 200]


    });


  }).catch(e => console.warn('Notif SW:', e));


}





// ═══════════════════════════════════════════════════════


// INZET MODAL


// ═══════════════════════════════════════════════════════


function openBetModal(e, matchId, pick, pickLabel, odds) {


  if (e) e.stopPropagation();


  const match = state.matches.find(m => String(m.id) === String(matchId));


  if (!match) return;


  pendingBet = { match, pick, pickLabel, odds:parseFloat(odds), markt:'1X2',


    _origPick:pick, _origPickLabel:pickLabel, _origOdds:parseFloat(odds) };


  document.getElementById('modalMatchName').textContent = match.home + ' vs ' + match.away;


  document.getElementById('modalPickInfo').textContent = 'Keuze: ' + pick + ' — ' + pickLabel + ' @ ' + odds;


  document.getElementById('modalBetInput').value = state.settings.defaultBet || 10;


  document.getElementById('marketPickRow').style.display = 'none';


  document.querySelectorAll('.market-btn').forEach(b => b.classList.remove('active'));


  document.getElementById('mb-1X2')?.classList.add('active');


  updatePayoutPreview();


  document.getElementById('betModal').classList.add('show');


}





function selectMarket(markt) {


  if (!pendingBet) return;


  pendingBet.markt = markt;


  document.querySelectorAll('.market-btn').forEach(b => b.classList.remove('active'));


  document.getElementById('mb-' + markt)?.classList.add('active');


  const pickRow = document.getElementById('marketPickRow');


  const pickInfo = document.getElementById('modalPickInfo');


  if (markt === '1X2') {


    pendingBet.pick = pendingBet._origPick;


    pendingBet.pickLabel = pendingBet._origPickLabel;


    pendingBet.odds = pendingBet._origOdds;


    pickInfo.textContent = 'Keuze: ' + pendingBet.pick + ' — ' + pendingBet.pickLabel + ' @ ' + pendingBet.odds;


    pickRow.style.display = 'none';


  } else {


    const labels = {


      'O25':'Meer dan 2.5 goals','U25':'Minder dan 2.5 goals',


      'O15':'Meer dan 1.5 goals','O35':'Meer dan 3.5 goals',


      'BTTSJ':'Beide teams scoren - Ja','BTTSN':'Beide teams scoren - Nee',


      '1X':'Thuis of gelijk (1X)','X2':'Gelijk of uit (X2)'


    };


    document.getElementById('customPickLabel').value = labels[markt] || '';


    document.getElementById('customOdds').value = '';


    pickInfo.textContent = 'Markt: ' + markt;


    pickRow.style.display = 'block';


    pendingBet.pick = markt; pendingBet.pickLabel = labels[markt] || markt; pendingBet.odds = null;


  }


  updatePayoutPreview();


}





function updatePayoutPreview() {


  if (!pendingBet) return;


  const amt = parseFloat(document.getElementById('modalBetInput').value) || 0;


  const odds = pendingBet.markt !== '1X2'


    ? parseFloat(document.getElementById('customOdds')?.value) || 0


    : pendingBet.odds;


  if (!odds) { document.getElementById('payoutPreview').textContent = 'Vul quote in'; return; }


  const payout = (amt * odds).toFixed(2);


  document.getElementById('payoutPreview').textContent = 'Mogelijke uitbetaling: €' + payout + ' (winst: €' + (payout - amt).toFixed(2) + ')';


}





function closeBetModal() {


  document.getElementById('betModal').classList.remove('show');


  pendingBet = null;


}





function confirmBet() {


  if (!pendingBet) return;


  const amt = parseFloat(document.getElementById('modalBetInput').value);


  if (!amt || amt <= 0) return;


  if (amt > state.wallet.balance) { alert('Onvoldoende saldo!'); return; }


  let finalOdds = pendingBet.odds;


  let finalPick = pendingBet.pick;


  let finalPickLabel = pendingBet.pickLabel;


  if (pendingBet.markt !== '1X2') {


    finalOdds = parseFloat(document.getElementById('customOdds').value);


    finalPickLabel = document.getElementById('customPickLabel').value.trim() || pendingBet.pickLabel;


    if (!finalOdds || finalOdds < 1.01) { alert('Vul een geldige quote in!'); return; }


  }


  const marktLabels = {'1X2':'Uitslag','O25':'Over 2.5','U25':'Under 2.5','O15':'Over 1.5','O35':'Over 3.5','BTTSJ':'BTTS-J','BTTSN':'BTTS-N','1X':'1X','X2':'X2'};


  const bet = {


    id: Date.now(),


    matchName: pendingBet.match.home + ' vs ' + pendingBet.match.away,


    fixtureId: pendingBet.match.id,


    pick: finalPick, pickLabel: finalPickLabel,


    markt: marktLabels[pendingBet.markt] || pendingBet.markt,


    odds: finalOdds, amount: amt,


    payout: parseFloat((amt * finalOdds).toFixed(2)),


    status: 'pending',


    date: new Date().toLocaleDateString('nl-NL')


  };


  state.wallet.balance -= amt;


  state.wallet.totalStaked += amt;


  state.wallet.bets.unshift(bet);


  saveState(); updateWalletUI(); closeBetModal();


}





// ═══════════════════════════════════════════════════════


// AI ANALYSE (alle data ophalen)


// ═══════════════════════════════════════════════════════


async function fetchH2H(homeId, awayId) {


  if (!homeId || !awayId) return [];


  try {


    const r = await apiFetch(`https://v3.football.api-sports.io/fixtures/headtohead?h2h=${homeId}-${awayId}&last=10`, null);


    const d = await r.json();


    return d.response || [];


  } catch(e) { return []; }


}


async function fetchTeamForm(teamId) {


  if (!teamId) return [];


  try {


    const r = await apiFetch(`https://v3.football.api-sports.io/fixtures?team=${teamId}&last=8`, null);


    const d = await r.json();


    return d.response || [];


  } catch(e) { return []; }


}


async function fetchTeamStats(teamId, leagueId) {


  if (!teamId) return null;


  try {


    const r = await apiFetch(`https://v3.football.api-sports.io/teams/statistics?team=${teamId}&league=${leagueId}&season=2026`, null);


    const d = await r.json();


    return d.response || null;


  } catch(e) { return null; }


}


async function fetchLineups(fixtureId) {


  if (!fixtureId) return null;


  try {


    const r = await apiFetch(`https://v3.football.api-sports.io/fixtures/lineups?fixture=${fixtureId}`, null, 5000);


    const d = await r.json();


    return d.response?.length ? d.response : null;


  } catch(e) { return null; }


}


async function fetchFixtureStats(fixtureId) {


  if (!fixtureId) return null;


  try {


    const r = await apiFetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`, null, 5000);


    const d = await r.json();


    return d.response?.length ? d.response : null;


  } catch(e) { return null; }


}


async function fetchTopScorers(leagueId) {


  if (!leagueId) return null;


  try {


    const r = await apiFetch(`https://v3.football.api-sports.io/players/topscorers?league=${leagueId}&season=2026`, null, 5000);


    const d = await r.json();


    return d.response?.slice(0,10) || null;


  } catch(e) { return null; }


}


async function fetchStandings(leagueId) {


  if (!leagueId) return null;


  try {


    const r = await apiFetch(`https://v3.football.api-sports.io/standings?league=${leagueId}&season=${leagueId===1?2026:2025}`, null, 6000);


    const d = await r.json();


    return d.response?.[0]?.league?.standings?.[0] || null;


  } catch(e) { return null; }


}


async function fetchInjuries(teamId, fixtureId) {


  if (!teamId) return [];


  try {


    const r = await apiFetch(`https://v3.football.api-sports.io/injuries?team=${teamId}&fixture=${fixtureId}`, null, 5000);


    const d = await r.json();


    return d.response || [];


  } catch(e) { return []; }


}


async function fetchPredictions(fixtureId) {


  if (!fixtureId) return null;


  try {


    const r = await apiFetch(`https://v3.football.api-sports.io/predictions?fixture=${fixtureId}`, null, 5000);


    const d = await r.json();


    return d.response?.[0] || null;


  } catch(e) { return null; }


}





async function fetchOddsHistory(fixtureId) {


  if (!fixtureId) return null;


  try {


    // Haal odds op van meerdere bookmakers voor bewegingsanalyse


    const r = await apiFetch(


      `https://v3.football.api-sports.io/odds?fixture=${fixtureId}`,


      null, 6000


    );


    const d = await r.json();


    return d.response?.[0] || null;


  } catch(e) { return null; }


}





async function fetchPlayerStats(teamId, leagueId) {


  if (!teamId || !leagueId) return null;


  try {


    const r = await apiFetch(


      `https://v3.football.api-sports.io/players?team=${teamId}&league=${leagueId}&season=2026`,


      null, 6000


    );


    const d = await r.json();


    return d.response?.slice(0, 20) || null;


  } catch(e) { return null; }


}





function formatH2H(fixtures, home, away) {


  if (!fixtures || !fixtures.length) return 'Geen H2H data beschikbaar.';


  let hw=0, aw=0, dr=0;


  const lines = fixtures.slice(0,10).map(f => {


    const ht = f.teams.home.name, at = f.teams.away.name;


    const hg = f.goals.home ?? '?', ag = f.goals.away ?? '?';


    const dt = new Date(f.fixture.date).toLocaleDateString('nl-NL',{day:'numeric',month:'short',year:'numeric'});


    if (f.teams.home.winner) hw++; else if (f.teams.away.winner) aw++; else dr++;


    const w = f.teams.home.winner ? ht : f.teams.away.winner ? at : 'Gelijk';


    return `${dt}: ${ht} ${hg}-${ag} ${at} → ${w}`;


  });


  return `SAMENVATTING laatste ${fixtures.length} duels: ${home} won ${hw}x | Gelijk ${dr}x | ${away} won ${aw}x\n\n${lines.join('\n')}`;


}


function formatForm(fixtures, teamId, teamName) {


  if (!fixtures || !fixtures.length) return 'Geen vorm data beschikbaar.';


  const results = fixtures.slice(0,8).map(f => {


    const isHome = f.teams.home.id === teamId;


    const team = isHome ? f.teams.home : f.teams.away;


    const opp = isHome ? f.teams.away.name : f.teams.home.name;


    const gFor = isHome ? (f.goals.home ?? 0) : (f.goals.away ?? 0);


    const gAg = isHome ? (f.goals.away ?? 0) : (f.goals.home ?? 0);


    const res = team.winner === true ? '✓WIN' : team.winner === false ? '✗VER' : '=GEL';


    const loc = isHome ? 'Thuis' : 'Uit';


    const dt = new Date(f.fixture.date).toLocaleDateString('nl-NL',{day:'numeric',month:'short'});


    return `${dt} [${loc}] vs ${opp}: ${gFor}-${gAg} ${res}`;


  });


  const wins = results.filter(r => r.includes('✓WIN')).length;


  return `VORM ${teamName}: ${wins}/${fixtures.slice(0,8).length} gewonnen\n${results.join('\n')}`;


}


function formatStats(stats, teamName) {


  if (!stats) return 'Geen seizoensstatistieken beschikbaar.';


  const f = stats.fixtures, g = stats.goals;


  const played = f?.played?.total || 0;


  const wins = f?.wins?.total || 0, draws = f?.draws?.total || 0, losses = f?.loses?.total || 0;


  const gFor = g?.for?.total?.total || 0, gAg = g?.against?.total?.total || 0;


  const avgFor = g?.for?.average?.total || '?', avgAg = g?.against?.average?.total || '?';


  return `${teamName} SEIZOEN 2025/26:\nGespeeld:${played} W:${wins} G:${draws} V:${losses}\nDoelpunten: ${gFor} voor / ${gAg} tegen (gem. ${avgFor}/${avgAg})`;


}


function formatInjuries(injuries, teamName) {


  if (!injuries?.length) return `${teamName}: Geen bekende blessures ✅`;


  const list = injuries.map(i => `${i.type === 'Injury' ? '🤕' : '🟥'} ${i.player.name} — ${i.reason || 'Blessure'}`);


  return `${teamName} AFWEZIGEN (${injuries.length}):\n${list.join('\n')}`;


}


function formatStandings(standings, homeName, awayName) {


  if (!standings?.length) return '';


  const find = name => standings.find(t => t.team.name.toLowerCase().includes(name.toLowerCase().substring(0,5)) || name.toLowerCase().includes(t.team.name.toLowerCase().substring(0,5)));


  const he = find(homeName), ae = find(awayName);


  let txt = '';


  if (he) txt += `${homeName}: ${he.rank}e · ${he.points}pt · W${he.all.win}G${he.all.draw}V${he.all.lose} · vorm:${he.form||'?'}\n`;


  if (ae) txt += `${awayName}: ${ae.rank}e · ${ae.points}pt · W${ae.all.win}G${ae.all.draw}V${ae.all.lose} · vorm:${ae.form||'?'}\n`;


  return txt ? `\nRANGLIJST:\n${txt}` : '';


}


function formatLineups(lineups, homeName, awayName) {


  if (!lineups?.length) return '';


  let txt = '\nOPSTELLINGEN (BEVESTIGD):\n';


  lineups.forEach(t => {


    const isHome = t.team.name.toLowerCase().includes(homeName.toLowerCase().substring(0,5));


    txt += `\n${t.team.name} | Formatie: ${t.formation||'?'}\n`;


    // Basis elf per positie


    if (t.startXI?.length) {


      const keeper = t.startXI.filter(p => p.player.pos === 'G').map(p => p.player.name);


      const defs   = t.startXI.filter(p => p.player.pos === 'D').map(p => p.player.name);


      const mids   = t.startXI.filter(p => p.player.pos === 'M').map(p => p.player.name);


      const fwds   = t.startXI.filter(p => p.player.pos === 'F').map(p => p.player.name);


      if (keeper.length) txt += `  GK: ${keeper.join(', ')}\n`;


      if (defs.length)   txt += `  DEF: ${defs.join(', ')}\n`;


      if (mids.length)   txt += `  MID: ${mids.join(', ')}\n`;


      if (fwds.length)   txt += `  AAN: ${fwds.join(', ')}\n`;


    }


    // Wisselspelers


    if (t.substitutes?.length) {


      txt += `  Bank: ${t.substitutes.slice(0,5).map(p => p.player.name).join(', ')}\n`;


    }


    // Coach


    if (t.coach?.name) txt += `  Coach: ${t.coach.name}\n`;


  });


  return txt;


}





function formatLineupsVsInjuries(lineups, injuries, homeName, awayName) {


  if (!lineups?.length) return '';


  // Check of geblesseerde spelers toch in de opstelling staan (API inconsistentie)


  const injNames = (injuries||[]).map(i => i.player?.name?.toLowerCase());


  let warnings = [];


  lineups.forEach(t => {


    t.startXI?.forEach(p => {


      if (injNames.some(n => n && p.player.name.toLowerCase().includes(n.substring(0,6)))) {


        warnings.push(`⚠️ ${p.player.name} staat in basis maar stond als geblesseerd`);


      }


    });


  });


  return warnings.length ? '\n' + warnings.join('\n') : '';


}


function formatFixtureStats(stats) {


  if (!stats?.length) return '';


  let txt = '\nWEDSTRIJD STATISTIEKEN:\n';


  stats.forEach(t => {


    const getStat = (type) => t.statistics?.find(s => s.type === type)?.value;


    const xg       = getStat('expected_goals');


    const shots    = getStat('Total Shots');


    const shotsOT  = getStat('Shots on Goal');


    const poss     = getStat('Ball Possession');


    const corners  = getStat('Corner Kicks');


    const fouls    = getStat('Fouls');


    const yellow   = getStat('Yellow Cards');


    const red      = getStat('Red Cards');


    const passes   = getStat('Total passes');


    const passAcc  = getStat('Passes accurate');





    txt += `${t.team.name}:\n`;


    if (xg)      txt += `  xG: ${xg}\n`;


    if (shots)   txt += `  Schoten: ${shots} (op doel: ${shotsOT||'?'})\n`;


    if (poss)    txt += `  Balbezit: ${poss}\n`;


    if (corners) txt += `  Hoekschoppen: ${corners}\n`;


    if (passes && passAcc) txt += `  Passes: ${passAcc}/${passes}\n`;


    if (yellow || red) txt += `  Kaarten: ${yellow||0}G ${red||0}R\n`;


  });


  return txt;


}


function detectPlayerForm(playerStats) {


  // Analyseer recente vorm op basis van ratings en goals in laatste wedstrijden


  if (!playerStats?.length) return {};


  const formMap = {};


  playerStats.forEach(p => {


    const st = p.statistics?.[0];


    if (!st) return;


    const name = p.player.name;


    const goals = st.goals?.total || 0;


    const games = st.games?.appearences || 1;


    const rating = parseFloat(st.games?.rating || 0);


    const goalsPerGame = games > 0 ? (goals / games).toFixed(2) : 0;


    // "In vorm" = hoge rating + recent scorend


    const inForm = rating >= 7.0 && parseFloat(goalsPerGame) >= 0.3;


    formMap[name] = { goals, games, rating, goalsPerGame, inForm };


  });


  return formMap;


}





function formatTopScorers(scorers, homeName, awayName, homePlayerStats, awayPlayerStats) {


  if (!scorers?.length) return '';


  const homeN = homeName.toLowerCase().substring(0,5);


  const awayN = awayName.toLowerCase().substring(0,5);


  const rel = scorers.filter(s => {


    const club = s.statistics?.[0]?.team?.name?.toLowerCase() || '';


    return club.includes(homeN) || club.includes(awayN);


  });


  if (!rel.length) return '';





  // Bouw vorm map van alle spelers


  const allPlayerStats = [...(homePlayerStats||[]), ...(awayPlayerStats||[])];


  const formMap = detectPlayerForm(allPlayerStats);





  return '\nKEY PLAYERS:\n' + rel.map(s => {


    const st = s.statistics[0];


    const goals   = st.goals?.total || 0;


    const assists = st.goals?.assists || 0;


    const rating  = st.games?.rating ? parseFloat(st.games.rating).toFixed(1) : '?';


    const mins    = st.games?.minutes || '?';


    const injured = s.player?.injured ? ' 🤕GEBLESSEERD' : '';


    const form    = formMap[s.player.name];


    const inForm  = form?.inForm ? ' 🔥IN VORM' : '';


    const gpg     = form?.goalsPerGame > 0 ? ` (${form.goalsPerGame}G/wedstrijd)` : '';


    return `⚽ ${s.player.name} (${st.team.name})${injured}${inForm} — ${goals}G${gpg} ${assists}A | Rating: ${rating} | ${mins}min`;


  }).join('\n');


}


function formatPredictions(pred) {


  if (!pred) return '';


  const p = pred.predictions;


  const comp = pred.league?.name || '';


  let txt = 'API-FOOTBALL MODEL:\n';


  if (p?.winner?.name) txt += `Voorspelling: ${p.winner.name} wint\n`;


  if (p?.advice) txt += `Advies: ${p.advice}\n`;


  if (p?.percent) {


    txt += `Kansen: 1=${p.percent.home} X=${p.percent.draw} 2=${p.percent.away}\n`;


  }


  // Goals voorspelling


  if (p?.goals?.home != null) txt += `Verwachte goals: ${p.goals.home}-${p.goals.away}\n`;


  // Head to head vergelijking


  const h2h = pred.h2h;


  if (h2h) {


    txt += `H2H API: ${p?.h2h?.home||'?'}% kans ${pred.teams?.home?.name||'thuis'}, ${p?.h2h?.draw||'?'}% gelijk\n`;


  }


  // Vergelijkende sterkte


  const home = pred.teams?.home?.last_5;


  const away = pred.teams?.away?.last_5;


  if (home?.goals?.for?.average) {


    txt += `Aanval (gem/wedstrijd): ${pred.teams.home.name}=${home.goals.for.average} ${pred.teams.away.name}=${away?.goals?.for?.average||'?'}\n`;


  }


  if (home?.goals?.against?.average) {


    txt += `Defensie (gem toegelaten): ${pred.teams.home.name}=${home.goals.against.average} ${pred.teams.away.name}=${away?.goals?.against?.average||'?'}\n`;


  }


  return txt.trim();


}





function formatOddsHistory(oddsData) {


  if (!oddsData?.bookmakers?.length) return '';


  let txt = '\nODDS ANALYSE (meerdere bookmakers):\n';





  // Verzamel odds van alle bookmakers


  const allOdds = { home: [], draw: [], away: [], bookmakers: [] };


  oddsData.bookmakers.slice(0, 8).forEach(bm => {


    const mw = bm.bets?.find(b => b.name === 'Match Winner');


    if (!mw?.values?.length) return;


    const h = parseFloat(mw.values.find(v => v.value === 'Home')?.odd || mw.values[0]?.odd);


    const d = parseFloat(mw.values.find(v => v.value === 'Draw')?.odd || mw.values[1]?.odd);


    const a = parseFloat(mw.values.find(v => v.value === 'Away')?.odd || mw.values[2]?.odd);


    if (h > 1 && d > 1 && a > 1) {


      allOdds.home.push(h);


      allOdds.draw.push(d);


      allOdds.away.push(a);


      allOdds.bookmakers.push(bm.name);


    }


  });





  if (!allOdds.home.length) return '';





  const avg = arr => arr.reduce((a,b) => a+b, 0) / arr.length;


  const min = arr => Math.min(...arr);


  const max = arr => Math.max(...arr);





  const avgH = avg(allOdds.home).toFixed(2);


  const avgD = avg(allOdds.draw).toFixed(2);


  const avgA = avg(allOdds.away).toFixed(2);





  txt += `Gemiddelde quote (${allOdds.home.length} bookmakers): 1=${avgH} X=${avgD} 2=${avgA}\n`;


  txt += `Range: 1=[${min(allOdds.home).toFixed(2)}-${max(allOdds.home).toFixed(2)}] X=[${min(allOdds.draw).toFixed(2)}-${max(allOdds.draw).toFixed(2)}] 2=[${min(allOdds.away).toFixed(2)}-${max(allOdds.away).toFixed(2)}]\n`;





  // Detecteer consensus vs. verdeeldheid


  const homeSpread = max(allOdds.home) - min(allOdds.home);


  const awaySpread = max(allOdds.away) - min(allOdds.away);


  if (homeSpread > 0.3) txt += `⚠️ Grote spreiding thuisquote (${homeSpread.toFixed(2)}) — onzekerheid bookmakers\n`;


  if (awaySpread > 0.3) txt += `⚠️ Grote spreiding uitquote (${awaySpread.toFixed(2)})\n`;





  // Beste quotes


  const bestH = max(allOdds.home).toFixed(2);


  const bestD = max(allOdds.draw).toFixed(2);


  const bestA = max(allOdds.away).toFixed(2);


  txt += `Beste beschikbare: 1=${bestH} X=${bestD} 2=${bestA}`;





  return txt;


}





async function callEntity(apiKey, system, userMsg, entityId, cardId, bodyId) {


  const chip = document.getElementById('ec-' + entityId);


  const card = document.getElementById('rc-' + cardId);


  const body = document.getElementById('rb-' + bodyId);


  chip.className = 'entity-chip running';


  card.style.display = 'block';


  document.getElementById('resultCards').classList.add('visible');


  body.innerHTML = '<span class="dots"><span></span><span></span><span></span></span>';





  // Overload-melding na 8 seconden als het nog steeds bezig is


  const overloadTimer = setTimeout(() => {


    if (chip.className.includes('running')) {


      body.innerHTML = '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:.6rem;color:#d97706;">⟳ Anthropic servers druk — even geduld, automatisch opnieuw proberen...</span>';


    }


  }, 8000);





  try {


    const data = await anthropicFetchWithRetry(apiKey, {


      model: 'claude-haiku-4-5-20251001', max_tokens: 600, system,


      messages: [{role:'user', content:userMsg}]


    });


    clearTimeout(overloadTimer);


    if (data.error) throw new Error(data.error.message || 'onbekend');


    const text = data.content[0].text;


    chip.className = 'entity-chip done';


    body.innerHTML = renderMarkdown(text);


    return text;


  } catch(e) {


    clearTimeout(overloadTimer);


    chip.className = 'entity-chip err';


    const isOverload = e.message?.toLowerCase().includes('overload');


    body.innerHTML = isOverload


      ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:.62rem;color:#d97706;line-height:1.7;">


           ⚠ Anthropic servers overbelast.<br>


           Wacht 5-10 minuten en probeer opnieuw.<br>


           <span style="color:var(--sub);">'s Avonds na 20:00 werkt beter.</span>


         </div>`


      : `⚠ Fout: ${e.message}`;


    return '';


  }


}





function renderMarkdown(text) {


  return text


    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')


    .replace(/^### (.+)$/gm,'<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.62rem;font-weight:700;color:#be185d;letter-spacing:.05em;text-transform:uppercase;margin:.8rem 0 .2rem;">$1</div>')


    .replace(/^## (.+)$/gm,'<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.65rem;font-weight:700;color:#7c3aed;letter-spacing:.04em;margin:.9rem 0 .25rem;border-bottom:1px solid rgba(124,58,237,.15);padding-bottom:.2rem;">$1</div>')


    .replace(/^# (.+)$/gm,'<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.1rem;color:#0f172a;margin:.8rem 0 .3rem;">$1</div>')


    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')


    .replace(/\*(.+?)\*/g,'<em>$1</em>')


    .replace(/^[-•] (.+)$/gm,'<div style="display:flex;gap:.4rem;margin:.2rem 0;"><span style="color:#be185d;flex-shrink:0;">•</span><span>$1</span></div>')


    .replace(/^(\d+)\. (.+)$/gm,'<div style="display:flex;gap:.4rem;margin:.2rem 0;"><span style="font-family:\'IBM Plex Mono\',monospace;font-size:.6rem;color:#7c3aed;flex-shrink:0;min-width:1rem;">$1.</span><span>$2</span></div>')


    .replace(/\n\n/g,'<br><br>').replace(/\n/g,'<br>');


}





async function runAnalyse() {


  const apiKey = document.getElementById('apiKeyInput').value.trim() || state.settings.anthropicKey;


  if (!apiKey || !apiKey.startsWith('sk-ant')) {


    document.getElementById('apiStatus').textContent = '⚠ Ongeldige API key';


    document.getElementById('apiStatus').className = 'api-status err';


    return;


  }


  if (!state.selectedMatch) { alert('Selecteer eerst een wedstrijd!'); return; }





  const m = state.selectedMatch;


  const risk = document.getElementById('riskProfile').value;


  const bet = document.getElementById('betAmount').value;


  const btn = document.getElementById('analyseBtn');


  const leagueId = m.leagueId || m.raw?.league?.id || COMP_IDS[state.activeComp];


  const homeId = m.homeId || m.raw?.teams?.home?.id;


  const awayId = m.awayId || m.raw?.teams?.away?.id;





  btn.disabled = true;


  btn.textContent = '⟳ DATA OPHALEN...';





  let h2hTxt='', homeFormTxt='', awayFormTxt='', homeStatsTxt='', awayStatsTxt='';


  let homeBlessuresTxt='', awayBlessuresTxt='', predTxt='', standingsTxt='';


  let lineupsTxt='', fixtureStatsTxt='', topScorersTxt='', oddsHistoryTxt='', restTxt='';


  let motivationTxt='', formationTxt='', effLabel='';





  try {


    if (homeId && awayId) { // footballKey op server


      const fixtureId = m.id;


      const wt = (p, ms=6000) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);


      const [h2h, homeForm, awayForm, hStats, aStats, homeInj, awayInj, pred, standings, lineups, fixStats, topScorers, oddsData, homeLastFix, awayLastFix, homePlayerStats, awayPlayerStats] = await Promise.all([


        wt(fetchH2H(homeId, awayId)), wt(fetchTeamForm(homeId)), wt(fetchTeamForm(awayId)),


        wt(fetchTeamStats(homeId, leagueId)), wt(fetchTeamStats(awayId, leagueId)),


        wt(fetchInjuries(homeId, fixtureId), 4000), wt(fetchInjuries(awayId, fixtureId), 4000),


        wt(fetchPredictions(fixtureId), 4000), wt(fetchStandings(leagueId), 5000),


        wt(fetchLineups(fixtureId), 5000), wt(fetchFixtureStats(fixtureId), 5000),


        wt(fetchTopScorers(leagueId), 5000),


        wt(fetchOddsHistory(fixtureId), 5000),


        wt(fetchLastFixture(homeId, null), 4000),


        wt(fetchLastFixture(awayId, null), 4000),


        wt(fetchPlayerStats(homeId, leagueId), 5000),


        wt(fetchPlayerStats(awayId, leagueId), 5000)


      ]);


      h2hTxt = formatH2H(h2h||[], m.home, m.away);


      homeFormTxt = formatForm(homeForm||[], homeId, m.home);


      awayFormTxt = formatForm(awayForm||[], awayId, m.away);


      homeStatsTxt = formatStats(hStats, m.home);


      awayStatsTxt = formatStats(aStats, m.away);


      homeBlessuresTxt = formatInjuries(homeInj||[], m.home);


      awayBlessuresTxt = formatInjuries(awayInj||[], m.away);


      predTxt = formatPredictions(pred);


      standingsTxt = formatStandings(standings, m.home, m.away);


      lineupsTxt = formatLineups(lineups||[], m.home, m.away);


      const lineupInjWarnings = formatLineupsVsInjuries(lineups||[], [...(homeInj||[]),...(awayInj||[])], m.home, m.away);


      if (lineupInjWarnings) lineupsTxt += lineupInjWarnings;


      fixtureStatsTxt = formatFixtureStats(fixStats||[]);


      topScorersTxt = formatTopScorers(topScorers||[], m.home, m.away, homePlayerStats, awayPlayerStats);


      oddsHistoryTxt = formatOddsHistory(oddsData);


      // Rust factor voor losse analyse


      const matchDateForRest = m.dateISO ? new Date(m.dateISO) : new Date();


      const homeRestDays = calcRestDays(homeLastFix, matchDateForRest);


      const awayRestDays = calcRestDays(awayLastFix, matchDateForRest);


      if (homeRestDays !== null || awayRestDays !== null) {


        restTxt = `\nRUST: ${m.home}=${restLabel(homeRestDays)}, ${m.away}=${restLabel(awayRestDays)}`;


      }


      // Thuis/uit sterkte


      const homeStrengthAnalyse = hStats ? calcHomeAwayStrength(hStats) : null;


      const awayStrengthAnalyse = aStats ? calcHomeAwayStrength(aStats) : null;


      if (homeStrengthAnalyse?.diff > 15) restTxt += `\n${m.home}: ${homeStrengthAnalyse.homeBias}`;


      if (awayStrengthAnalyse?.diff < -10) restTxt += `\n${m.away}: ${awayStrengthAnalyse.homeBias}`;





      // Motivatie analyse


      const standingsArr2 = standings ? (Array.isArray(standings) ? standings : []) : [];


      const motivationTxt = formatMotivationContext(standingsArr2, m.home, m.away, homeForm, awayForm);





      // Formatie matchup


      const formationTxt = analyzeFormationMatchup(lineups||[], m.home, m.away);





      // Marktefficiëntie


      const effLabel = marketEfficiencyLabel(leagueId);


    }


  } catch(e) { console.warn('Data ophalen:', e.message); }





  // ── POISSON VOOR ANALYSE ──


  let poissonAnaliseTxt = '';


  try {


    const hGs = hStats ? extractTeamGoalStats(hStats) : null;


    const aGs = aStats ? extractTeamGoalStats(aStats) : null;


    if (hGs && aGs) {


      const calcInjFactor = (injuries) => {


        if (!injuries?.length) return { attackFactor:1.0, defenseFactor:1.0 };


        let ap=0, dp=0;


        injuries.forEach(inj => {


          const pos = inj.player?.pos || '';


          if (pos==='F') ap+=0.10;


          else if (pos==='M') { ap+=0.06; dp+=0.05; }


          else if (pos==='D') dp+=0.10;


          else if (pos==='G') dp+=0.18;


          else { ap+=0.04; dp+=0.04; }


        });


        const total = injuries.length;


        if (total >= 5)  { ap+=0.05; dp+=0.05; }


        if (total >= 8)  { ap+=0.08; dp+=0.08; }


        if (total >= 12) { ap+=0.10; dp+=0.10; }


        return {


          attackFactor: Math.max(0.40, 1-Math.min(ap,0.60)),


          defenseFactor: Math.max(0.40, 1-Math.min(dp,0.60))


        };


      };


      const hInj = calcInjFactor(homeInj);


      const aInj = calcInjFactor(awayInj);


      const pois = calcPoissonKansen(hGs, aGs, 1.35, hInj, aInj);


      if (pois.valid) {


        poissonAnaliseTxt = `


📐 POISSON MODEL (seizoensstatistieken + blessure-correctie):


${m.home} wint: ${pois.k1}% | Gelijkspel: ${pois.kX}% | ${m.away} wint: ${pois.k2}%


Verwachte goals: ${m.home} λ=${pois.lambdaHome} | ${m.away} λ=${pois.lambdaAway}${pois.injLabel||''}


Bookmaker impliceert: 1=${Math.round(100/(parseFloat(m.homeOdds)||2))}% X=${Math.round(100/(parseFloat(m.drawOdds)||3))}% 2=${Math.round(100/(parseFloat(m.awayOdds)||2))}%`;


      }


    }


  } catch(e) {}





  btn.textContent = '⟳ AI ANALYSEERT...';





  const wedstrijdDatum = m.date ? `${m.date} om ${m.time}` : m.time;


  const isNeutral = m.comp?.toLowerCase().includes('beker') || m.comp?.toLowerCase().includes('cup') ||


                    m.comp?.toLowerCase().includes('finale') || (m.fixture?.neutral === true);


  const locatieInfo = isNeutral ? `LOCATIE: ${m.venue||'Neutraal'} — NEUTRAAL STADION` : `LOCATIE: ${m.venue||'Thuis ' + m.home} — THUISWEDSTRIJD ${m.home}`;





  const ctx = `


WEDSTRIJD: ${m.home} vs ${m.away}


COMPETITIE: ${m.comp}


DATUM/TIJD: ${wedstrijdDatum}


${locatieInfo}


QUOTES: 1=${m.homeOdds} | X=${m.drawOdds} | 2=${m.awayOdds}${m.oddsSource?` (${m.oddsSource})`:''}


RISICO: ${risk} | INZET: €${bet}


${standingsTxt}


${topScorersTxt}


BLESSURES:


${homeBlessuresTxt}


${awayBlessuresTxt}


${lineupsTxt || '(Opstellingen nog niet beschikbaar)'}


${fixtureStatsTxt}


${predTxt ? 'API MODEL:\n' + predTxt : ''}


${oddsHistoryTxt}


${restTxt}





${motivationTxt || ''}


${formationTxt || ''}


MARKTEFFICIËNTIE: ${effLabel}





INSTRUCTIE: Gebruik ALLEEN deze data. Verzin geen stats. Lineups zijn definitief als beschikbaar.


Als lineups beschikbaar zijn: weeg spelersinformatie zwaarder dan seizoensgemiddelden.


Als een sleutelspeler (topper in topscorers) NIET in de opstelling staat: pas kansen significant aan (±5-8%).


Marktefficiëntie laag = meer waarde-kansen mogelijk bij afwijking van bookmaker.`.trim();





  const hasLineups = lineupsTxt && lineupsTxt.includes('BEVESTIGD');


  const hasPoisson = poissonAnaliseTxt.length > 0;


  const mktEff = getMarketEfficiency(leagueId);





  ['vorm','stats','tactiek','kans','risico','advies','tip'].forEach(id => {


    const chip = document.getElementById('ec-' + id);


    const card = document.getElementById('rc-' + id);


    const body = document.getElementById('rb-' + id);


    if (chip) chip.className = 'entity-chip running';


    if (card) card.style.display = 'block';


    if (body) body.innerHTML = '<span class="dots"><span></span><span></span><span></span></span>';


  });


  document.getElementById('resultCards').classList.add('visible');





  const overloadTimer = setTimeout(() => {


    document.querySelectorAll('.entity-chip.running').forEach(chip => {


      const body = document.getElementById(chip.id.replace('ec-','rb-'));


      if (body && body.querySelector('.dots'))


        body.innerHTML = '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:.6rem;color:#d97706;">⟳ Analyseren... even geduld (grote analyse)</span>';


    });


  }, 12000);





  const combinedSystem = `Je bent een complete voetbalanalist. Geef een volledige wedstrijd-analyse in het Nederlands als JSON object met exact deze sleutels:


{


  "vorm": "## Vorm & Recent\\n[max 200 woorden: laatste 5 wedstrijden W/G/V, thuis/uit verschil, spelers IN VORM, doelpuntentrend]",


  "stats": "## Statistieken\\n[max 180 woorden: H2H patroon MET getallen, BTTS%, O/U 2.5 historiek, goals/wedstrijd]",


  "tactiek": "## Tactiek\\n[max 180 woorden: formatie matchup, tactisch voordeel, pressing vs laag blok${hasLineups ? '. LINEUPS BEVESTIGD: gebruik als primaire bron.' : '.'}]",


  "kans": "## Kansen\\n[max 200 woorden: 1/X/2 in %, value per uitkomst, verwachte score, O/U 2.5%, BTTS%, confidence 1-10. Marktefficiëntie ${Math.round(mktEff*100)}%${hasPoisson ? '. Gebruik Poisson als anker.' : '.'}]",


  "risico": "## Risico\\n[max 150 woorden: risicoscore 1-10, top 3 risicofactoren, wanneer NIET wedden]",


  "advies": "## Advies\\n[max 180 woorden: BESTE BET met value%, Kelly voor €${bet}, 2 alternatieven, TOP TIP in één zin]",


  "tip": {


    "pick": "O2.5", "pickLabel": "Meer dan 2.5 goals", "markt": "Doelpunten",


    "odds": "1.85", "kans": 68, "sterren": 4, "confidence": 7,


    "confidenceReden": "max 20 woorden",


    "redenering": "max 70 woorden",


    "tips": [


      {"pick":"1","pickLabel":"Thuis wint","markt":"Uitslag","odds":"2.10","kans":55,"reden":"kort"},


      {"pick":"BTTS-J","pickLabel":"Beide scoren","markt":"BTTS","odds":"1.70","kans":62,"reden":"kort"},


      {"pick":"O2.5","pickLabel":"Meer dan 2.5","markt":"Doelpunten","odds":"1.85","kans":68,"reden":"kort"}


    ]


  }


}


JSON only. Geen tekst buiten JSON. Gebruik ALLEEN meegeleverde data.`;





  const combinedUser = `${ctx}





VORM ${m.home}:


${homeFormTxt || '(geen data)'}





VORM ${m.away}:


${awayFormTxt || '(geen data)'}


${topScorersTxt || ''}





H2H:


${h2hTxt || '(geen data)'}





${homeStatsTxt || ''}


${awayStatsTxt || ''}





${lineupsTxt || 'Opstellingen nog niet beschikbaar'}


${formationTxt || ''}





${poissonAnaliseTxt ? poissonAnaliseTxt + '\n\n' : ''}API MODEL:


${predTxt || 'Niet beschikbaar'}





Motivatie: ${motivationTxt || '—'}


${oddsHistoryTxt || ''}`.substring(0, 18000);





  try {


    const data = await anthropicFetchWithRetry(apiKey, {


      model: 'claude-sonnet-4-5',


      max_tokens: 2800,


      system: combinedSystem,


      messages: [{ role: 'user', content: combinedUser }]


    });


    clearTimeout(overloadTimer);


    if (data.error) throw new Error(data.error.message || 'API fout');





    let raw = data.content[0].text.trim().replace(/```json\s*/g,'').replace(/```\s*/g,'').trim();


    const jsonStart = raw.indexOf('{'), jsonEnd = raw.lastIndexOf('}');


    if (jsonStart < 0 || jsonEnd < 0) throw new Error('Geen geldige JSON in antwoord');


    const result = JSON.parse(raw.substring(jsonStart, jsonEnd + 1));





    const fill = (id, text) => {


      const chip = document.getElementById('ec-' + id);


      const body = document.getElementById('rb-' + id);


      if (chip) chip.className = 'entity-chip done';


      if (body) body.innerHTML = renderMarkdown(text || '—');


      return text || '';


    };


    fill('vorm',    result.vorm);


    fill('stats',   result.stats);


    fill('tactiek', result.tactiek);


    fill('kans',    result.kans);


    fill('risico',  result.risico);


    fill('advies',  result.advies);





    const tipChip = document.getElementById('ec-tip');


    const tipBody = document.getElementById('rb-tip');


    try {


      const tip = result.tip;


      if (!tip || !tip.pick) throw new Error('Geen tip in response');


      const sterren   = '⭐'.repeat(tip.sterren||3) + '☆'.repeat(5-(tip.sterren||3));


      const kleur     = tip.kans >= 70 ? '#16a34a' : tip.kans >= 55 ? '#d97706' : '#dc2626';


      const breedte   = Math.min(100, Math.max(10, tip.kans||50));


      const conf      = tip.confidence || 5;


      const confKleur = conf >= 8 ? '#16a34a' : conf >= 6 ? '#d97706' : '#dc2626';


      const tipValue  = calcValue(tip.kans, parseFloat(tip.odds));


      const valueCls  = valueClass(tipValue);


      const valueHtml = tipValue != null ? `


        <div style="background:${valueCls==='high'?'rgba(22,163,74,.1)':'rgba(100,116,139,.06)'};border:1px solid ${valueCls==='high'?'rgba(22,163,74,.3)':'rgba(15,23,42,.08)'};border-radius:10px;padding:.6rem .85rem;margin-bottom:.75rem;display:flex;justify-content:space-between;align-items:center;">


          <div>


            <div style="font-family:'IBM Plex Mono',monospace;font-size:.55rem;color:var(--sub);font-weight:700;">⚡ VALUE</div>


            <div style="font-family:'IBM Plex Mono',monospace;font-size:.55rem;color:var(--sub);margin-top:2px;">${tip.kans}% × ${tip.odds}</div>


          </div>


          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.8rem;color:${valueCls==='high'?'#15803d':valueCls==='med'?'#b45309':'#64748b'};">${tipValue>0?'+':''}${tipValue.toFixed(1)}%</div>


        </div>` : '';


      tipBody.innerHTML = `


        <div style="background:linear-gradient(135deg,rgba(219,39,119,.06),rgba(124,58,237,.06));border-radius:12px;padding:.85rem;margin-bottom:.8rem;border:1px solid rgba(219,39,119,.15);">


          <div style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;color:#be185d;font-weight:700;letter-spacing:.05em;margin-bottom:.3rem;">🏆 BESTE TIP · ${tip.markt||'Uitslag'}</div>


          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.5rem;color:#0f172a;">${tip.pick} — ${tip.pickLabel}</div>


          <div style="font-family:'IBM Plex Mono',monospace;font-size:.62rem;color:#374151;margin:.3rem 0;">Quote: <b>${tip.odds}</b> &nbsp;·&nbsp; ${sterren}</div>


          <div style="display:flex;gap:.5rem;margin-top:.6rem;">


            <button onclick="openQuickBet('${tip.matchId||state.selectedMatch?.id}','${tip.pick}',\`${tip.pickLabel}\`,${tip.odds},'single')" style="flex:1;padding:.45rem;border-radius:10px;background:rgba(219,39,119,.12);border:1px solid rgba(219,39,119,.3);font-family:'IBM Plex Mono',monospace;font-size:.58rem;font-weight:700;color:#be185d;cursor:pointer;">💶 SINGLE BET</button>


            <button onclick="openQuickBet('${tip.matchId||state.selectedMatch?.id}','${tip.pick}',\`${tip.pickLabel}\`,${tip.odds},'combi')" style="flex:1;padding:.45rem;border-radius:10px;background:rgba(124,58,237,.1);border:1px solid rgba(124,58,237,.25);font-family:'IBM Plex Mono',monospace;font-size:.58rem;font-weight:700;color:#7c3aed;cursor:pointer;">➕ COMBI</button>


          </div>


        </div>


        ${valueHtml}


        <div style="margin-bottom:.85rem;">


          <div style="font-family:'IBM Plex Mono',monospace;font-size:.55rem;color:#374151;margin-bottom:.35rem;display:flex;justify-content:space-between;"><span>KANS VAN SLAGEN</span><span style="color:${kleur};font-weight:700;">${tip.kans}%</span></div>


          <div style="background:rgba(0,0,0,.07);border-radius:999px;height:12px;overflow:hidden;"><div style="background:${kleur};width:${breedte}%;height:100%;border-radius:999px;"></div></div>


        </div>


        <div style="font-size:.82rem;line-height:1.7;color:#1e293b;margin-bottom:.9rem;padding:.7rem .8rem;background:rgba(255,255,255,.7);border-radius:8px;">${tip.redenering||'—'}</div>


        <div style="background:rgba(255,255,255,.8);border:1px solid rgba(15,23,42,.08);border-radius:10px;padding:.65rem .8rem;margin-bottom:.8rem;">


          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.35rem;">


            <div style="font-family:'IBM Plex Mono',monospace;font-size:.55rem;font-weight:700;color:#475569;">🎯 CONFIDENCE</div>


            <span style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:${confKleur};">${conf}/10</span>


          </div>


          <div style="background:rgba(0,0,0,.07);border-radius:999px;height:8px;overflow:hidden;margin-bottom:.35rem;"><div style="background:${confKleur};width:${Math.round((conf/10)*100)}%;height:100%;"></div></div>


          ${tip.confidenceReden?`<div style="font-size:.72rem;color:#64748b;font-style:italic;">${tip.confidenceReden}</div>`:''}


        </div>


        ${tip.tips?.length?`<div style="font-family:'IBM Plex Mono',monospace;font-size:.55rem;color:#475569;font-weight:700;margin-bottom:.4rem;">📊 ALLE MARKTEN</div>


        ${tip.tips.map(t=>{const tv=calcValue(t.kans,parseFloat(t.odds));const tc=tv>=15?'#15803d':tv>=5?'#b45309':'#64748b';return`<div style="display:flex;align-items:center;gap:.6rem;padding:.5rem .7rem;background:rgba(255,255,255,.6);border-radius:8px;margin-bottom:.3rem;border:1px solid rgba(15,23,42,.07);"><div style="flex:1;"><div style="font-size:.78rem;font-weight:700;color:#0f172a;">${t.pickLabel}</div><div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:#7c3aed;">${t.markt} · ${t.kans}% kans</div><div style="font-size:.68rem;color:#475569;">${t.reden||''}</div></div><div style="text-align:right;"><div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:#16a34a;">${t.odds}</div>${tv!=null?`<div style="font-family:'IBM Plex Mono',monospace;font-size:.55rem;font-weight:700;color:${tc};">${tv>0?'+':''}${tv.toFixed(0)}% val</div>`:''}</div></div>`;}).join('')}`:''} `;


      if (tipChip) tipChip.className = 'entity-chip done';


    } catch(tipErr) {


      if (tipBody) tipBody.innerHTML = '⚠ Tip fout: ' + tipErr.message;


      if (tipChip) tipChip.className = 'entity-chip err';


    }





  } catch(e) {


    clearTimeout(overloadTimer);


    const isOverload = e.message?.toLowerCase().includes('overload');


    const isTimeout  = e.message?.toLowerCase().includes('timeout');


    ['vorm','stats','tactiek','kans','risico','advies','tip'].forEach(id => {


      const chip = document.getElementById('ec-' + id);


      const body = document.getElementById('rb-' + id);


      if (chip) chip.className = 'entity-chip err';


      if (body) body.innerHTML = isOverload


        ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:.62rem;color:#d97706;line-height:1.7;">⚠ Servers overbelast.<br>Wacht 5-10 minuten.</div>`


        : isTimeout


        ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:.62rem;color:#d97706;">⏱ Timeout — probeer opnieuw.</div>`


        : `<div style="font-family:'IBM Plex Mono',monospace;font-size:.62rem;color:#dc2626;">⚠ Fout: ${e.message}</div>`;


    });


  }





  btn.disabled = false;


  btn.textContent = '⚽ ANALYSEER OPNIEUW';


}





// ═══════════════════════════════════════════════════════


// COMBI TIP


// ═══════════════════════════════════════════════════════


async function generateCombiTip() {


  const apiKey = null; // key op server


  const btn = document.getElementById('combiGenBtn');


  btn.disabled = true; btn.textContent = '⟳ BEREKENEN...';





  // Alleen toekomstige/vandaag wedstrijden — geen gespeelde


  const upcomingMatches = state.matches.filter(m => !m.isDone);


  if (!upcomingMatches.length) {


    alert('Geen aankomende wedstrijden gevonden. Laad eerst wedstrijden via het Wedstrijden tabblad.');


    btn.disabled = false; btn.textContent = '⚡ GENEREER TOP 3 TIPS + COMBI';


    return;


  }


  const matchesCtx = upcomingMatches.slice(0,15).map(m => {


    const datum = m.date ? `${m.date} ${m.time}` : m.time;


    return `ID:${m.id} | ${m.home} vs ${m.away} | ${m.comp} | ${datum} | quotes: 1=${m.homeOdds} X=${m.drawOdds} 2=${m.awayOdds}`;


  }).join('\n');





  let standingsCtx = '';


  if (null) {


    try {


      const leagueId = COMP_IDS[state.activeComp];


      const r = await apiFetch(`https://v3.football.api-sports.io/standings?league=${leagueId}&season=${leagueId===1?2026:2025}`, null);


      const d = await r.json();


      const st = d.response?.[0]?.league?.standings?.[0];


      if (st?.length) {


        standingsCtx = `\nSTAND:\n` + st.slice(0,10).map(t => `${t.rank}. ${t.team.name} — ${t.points}pt W${t.all.win}G${t.all.draw}V${t.all.lose}`).join('\n');


      }


    } catch(e) {}


  }





  const vandaag = new Date().toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long'});





  try {


    const data = await anthropicFetch(apiKey, {


      model:'claude-haiku-4-5-20251001', max_tokens:1600,


      system:`Je bent sportadviseur. JSON only, geen tekst buiten JSON:


{"top3":[


  {"match":"A vs B","datum":"za","pick":"O2.5","pickLabel":"Meer dan 2.5","markt":"Doelpunten","odds":1.85,"vertrouwen":8,


   "reden":"30-40 woorden: waarom is dit value? Noem vorm, quotes, H2H of marktfactoren.",


   "factoren":["factor kort","factor kort"],"risico":"max 12 woorden: wat kan dit torpederen?"},


  {"match":"","datum":"","pick":"","pickLabel":"","markt":"","odds":0,"vertrouwen":0,"reden":"","factoren":[],"risico":""},


  {"match":"","datum":"","pick":"","pickLabel":"","markt":"","odds":0,"vertrouwen":0,"reden":"","factoren":[],"risico":""}


],


"combi":{"legs":[


  {"match":"","datum":"","pick":"","pickLabel":"","markt":"","odds":0,"vertrouwen":0},


  {"match":"","datum":"","pick":"","pickLabel":"","markt":"","odds":0,"vertrouwen":0},


  {"match":"","datum":"","pick":"","pickLabel":"","markt":"","odds":0,"vertrouwen":0}


],"redenering":"40-50 woorden: waarom passen deze 3 legs samen?","synergie":"max 30 woorden","risico":"max 25 woorden","kansBerekening":"72%x68%x75%=37%","valueScore":7}}


Markten: 1/X/2, O2.5, U2.5, BTTS-J/N, 1X, X2. Vul alle velden. Geen lege strings.`,


      messages:[{role:'user',content:`Datum: ${vandaag}\nWedstrijden:\n${matchesCtx}\n${standingsCtx}\n\nGeef top 3 tips en combi van 3 legs.`}]


    });


    let raw = data.content[0].text.trim();


    const js = raw.indexOf('{'), je = raw.lastIndexOf('}');


    if (js < 0 || je < js) throw new Error('Geen JSON in response: ' + raw.substring(0,60));


    const result = JSON.parse(raw.substring(js, je + 1));


    renderTop3EnCombi(result);


  } catch(e) {


    document.getElementById('combiCard').innerHTML = `<div style="color:var(--red);">⚠ ${e.message}</div>`;


    document.getElementById('combiCard').style.display = 'block';


  }


  btn.disabled = false; btn.textContent = '⚡ VERNIEUW TIPS';


}





function renderTop3EnCombi(result) {


  const defaultBet = state.settings.defaultBet || 10;


  const card = document.getElementById('combiCard');


  const stars = n => '⭐'.repeat(Math.min(n,5));


  const confColor = n => n >= 8 ? '#16a34a' : n >= 6 ? '#d97706' : '#dc2626';





  const top3Html = (result.top3||[]).map((t,i) => {


    const tv       = calcValue(t.vertrouwen * 10, parseFloat(t.odds));


    const tvSign   = tv > 0 ? '+' : '';


    const tvColor  = tv >= 15 ? '#15803d' : tv >= 5 ? '#b45309' : tv >= 0 ? '#64748b' : '#dc2626';


    const cc       = confColor(t.vertrouwen);


    const cbar     = Math.round((t.vertrouwen/10)*100);


    const clabel   = t.vertrouwen >= 8 ? 'HOOG' : t.vertrouwen >= 6 ? 'GEMIDDELD' : 'LAAG';


    const factoren = Array.isArray(t.factoren) ? t.factoren : [];


    const risico   = t.risico || '';


    return `


    <div style="background:rgba(255,255,255,.82);border:1px solid rgba(28,35,48,.08);border-radius:12px;padding:.75rem .9rem;margin-bottom:.5rem;">


      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.4rem;">


        <div style="flex:1;">


          <div style="font-size:.88rem;font-weight:700;color:#0f172a;">${i+1}. ${t.match}</div>


          <div style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;color:#7c3aed;margin-top:2px;">📅 ${t.datum||''}</div>


        </div>


        <div style="text-align:right;margin-left:.8rem;flex-shrink:0;">


          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.3rem;color:#16a34a;">${parseFloat(t.odds||0).toFixed(2)}</div>


          ${tv != null ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;font-weight:800;color:${tvColor};">⚡ ${tvSign}${Math.round(tv)}% val</div>` : ''}


        </div>


      </div>


      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.45rem;flex-wrap:wrap;">


        <span style="font-family:'IBM Plex Mono',monospace;font-size:.6rem;background:rgba(219,39,119,.1);color:#be185d;padding:2px 9px;border-radius:4px;font-weight:700;">${t.pick} — ${t.pickLabel}</span>


        <span style="font-size:.72rem;">${stars(Math.round(t.vertrouwen/2))}</span>


      </div>


      <div style="margin-bottom:.45rem;">


        <div style="display:flex;justify-content:space-between;margin-bottom:.2rem;">


          <span style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;color:var(--sub);font-weight:700;">ZEKERHEID</span>


          <span style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;font-weight:800;color:${cc};">${t.vertrouwen}/10 · ${clabel}</span>


        </div>


        <div style="background:rgba(0,0,0,.08);border-radius:999px;height:6px;overflow:hidden;">


          <div style="background:${cc};width:${cbar}%;height:100%;border-radius:999px;"></div>


        </div>


      </div>


      ${t.reden ? `<div style="font-size:.76rem;color:#1e293b;line-height:1.65;margin-bottom:.4rem;padding:.45rem .6rem;background:rgba(255,255,255,.6);border-radius:7px;border-left:2.5px solid ${tvColor};">${t.reden}</div>` : ''}


      ${factoren.length ? `<div style="display:flex;flex-wrap:wrap;gap:.2rem;margin-bottom:.35rem;">${factoren.map(f=>`<span style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;font-weight:700;padding:2px 7px;border-radius:999px;background:rgba(124,58,237,.08);border:1px solid rgba(124,58,237,.18);color:#7c3aed;">${f}</span>`).join('')}</div>` : ''}


      ${risico ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:.47rem;padding:3px 9px;border-radius:999px;display:inline-block;background:rgba(220,38,38,.07);border:1px solid rgba(220,38,38,.18);color:#dc2626;">⚠ ${risico}</div>` : ''}


    </div>`;


  }).join('');





  const combi = result.combi || {};


  const legs = (combi.legs||[]).slice(0,3);


  const totalOdds = legs.reduce((a,l) => a * parseFloat(l.odds||1), 1);


  const payout = (defaultBet * totalOdds).toFixed(2);


  const kansStr = legs.length === 3 ? Math.round(legs.reduce((a,l) => a * ((l.vertrouwen||7)/10), 1) * 100) : '—';





  const legsHtml = legs.map((l,i) => `


    <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem .75rem;background:rgba(255,255,255,.7);border-radius:10px;margin-bottom:.4rem;border:1px solid rgba(28,35,48,.08);">


      <div style="flex:1;">


        <div style="font-size:.82rem;font-weight:700;color:#0f172a;">${i+1}. ${l.match}</div>


        <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:#7c3aed;">📅 ${l.datum||''}</div>


        <div style="font-family:'IBM Plex Mono',monospace;font-size:.55rem;color:#be185d;font-weight:700;margin-top:3px;">${l.pick} — ${l.pickLabel}</div>


      </div>


      <div style="font-family:'Bebas Neue',sans-serif;font-size:1.2rem;color:#16a34a;">${parseFloat(l.odds).toFixed(2)}</div>


    </div>`).join('');





  window._lastAICombi = legs;





  const genTime = new Date().toLocaleString('nl-NL',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});


  card.innerHTML = `


    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem;">


      <div style="font-family:'Bebas Neue',sans-serif;font-size:1.05rem;color:#be185d;">🏆 TOP 3 TIPS</div>


      <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);">📅 ${genTime}</div>


    </div>


    ${top3Html}


    <div style="height:1px;background:rgba(28,35,48,.08);margin:1rem 0;"></div>


    <div style="font-family:'Bebas Neue',sans-serif;font-size:1.05rem;color:#be185d;margin-bottom:.6rem;">⚡ AI COMBI</div>


    ${legsHtml}


    <div style="background:rgba(255,255,255,.85);border:1px solid rgba(15,23,42,.08);border-radius:14px;padding:.85rem;margin:.7rem 0;">


      <div style="font-size:.84rem;line-height:1.75;color:#0f172a;margin-bottom:.5rem;">${combi.redenering||''}</div>


      ${combi.synergie ? `<div style="background:rgba(37,99,235,.06);border-left:3px solid #2563eb;padding:.5rem .7rem;border-radius:0 8px 8px 0;margin-bottom:.4rem;"><div style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;color:#2563eb;font-weight:700;">🔗 SYNERGIE</div><div style="font-size:.78rem;">${combi.synergie}</div></div>` : ''}


      ${combi.risico ? `<div style="background:rgba(220,38,38,.05);border-left:3px solid #dc2626;padding:.5rem .7rem;border-radius:0 8px 8px 0;"><div style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;color:#dc2626;font-weight:700;">⚠ RISICO</div><div style="font-size:.78rem;">${combi.risico}</div></div>` : ''}


    </div>


    <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(219,39,119,.08);border-radius:10px;padding:.65rem .9rem;margin-bottom:.7rem;">


      <div><div style="font-size:.5rem;color:#475569;font-family:'IBM Plex Mono',monospace;">QUOTE</div><div style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;">${totalOdds.toFixed(2)}</div></div>


      <div style="text-align:center;"><div style="font-size:.5rem;color:#475569;font-family:'IBM Plex Mono',monospace;">KANS</div><div style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;color:#d97706;">${kansStr}%</div></div>


      <div style="text-align:right;"><div style="font-size:.5rem;color:#475569;font-family:'IBM Plex Mono',monospace;">€${defaultBet}</div><div style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;color:#16a34a;">€${payout}</div></div>


    </div>


    <button onclick="loadAICombiIntoBuilder()" style="width:100%;background:linear-gradient(135deg,rgba(219,39,119,.2),rgba(124,58,237,.2));border:1px solid rgba(219,39,119,.35);color:#0f172a;font-family:'IBM Plex Mono',monospace;font-size:.65rem;font-weight:700;padding:.7rem;border-radius:10px;cursor:pointer;">🎰 ZET IN BUILDER</button>`;


  card.style.display = 'block';


}





function loadAICombiIntoBuilder() {


  const legs = window._lastAICombi;


  if (!legs?.length) return;


  state.combiBuilder = [];


  legs.forEach((l,i) => {


    const match = state.matches.find(m =>


      m.home.toLowerCase().includes(l.match.split(' vs ')[0]?.trim().toLowerCase().substring(0,5)) ||


      l.match.toLowerCase().includes(m.home.toLowerCase().substring(0,5))


    );


    const matchId = match ? match.id : `ai-${i}-${Date.now()}`;


    const home = match ? match.home : l.match.split(' vs ')[0]?.trim();


    const away = match ? match.away : l.match.split(' vs ')[1]?.trim();


    state.combiBuilder.push({


      matchId: String(matchId), home, away,


      pick: l.pick, pickLabel: l.pickLabel,


      odds: parseFloat(l.odds), date: l.datum || ''


    });


  });


  updateCombiBuilder();


  switchTab('wedstrijden');


  setTimeout(() => document.getElementById('combiBuilder').scrollIntoView({behavior:'smooth'}), 300);


}





// ═══════════════════════════════════════════════════════


// COMBI BUILDER


// ═══════════════════════════════════════════════════════


/**


 * Voeg een value-scan pick direct toe aan de combi-builder


 * vanuit de multi-scan banner — zonder naar de wedstrijd te navigeren.


 */


function addValuePickToCombi(matchId, pick, pickLabel, odds, home, away) {


  // Zoek de match in state.matches (huidige competitie)


  let match = state.matches.find(m => String(m.id) === String(matchId));





  // Als match niet in huidige lijst: zoek in alle scan-resultaten


  if (!match) {


    const scan = state.valueScans?.find(s => String(s.match?.id) === String(matchId));


    if (scan) match = scan.match;


  }





  const existing = state.combiBuilder.findIndex(l => String(l.matchId) === String(matchId));





  if (!match) {


    // Geen match in state — gebruik meegegeven namen (home/away uit banner)


    if (existing >= 0) {


      state.combiBuilder.splice(existing, 1);


    } else {


      if (state.combiBuilder.length >= 8) { alert('Max 8 legs!'); return; }


      state.combiBuilder.push({


        matchId: String(matchId),


        home: home || '?', away: away || '?',


        pick, pickLabel, odds: parseFloat(odds), date: ''


      });


    }


  } else {


    toggleCombiLeg(matchId, pick, pickLabel, parseFloat(odds));


  }





  // Update knop in banner direct


  const btn = document.getElementById('msrBtn-' + matchId);


  if (btn) {


    const inCombi = state.combiBuilder.some(l => String(l.matchId) === String(matchId));


    btn.textContent = inCombi ? '✓ IN COMBI' : '+ COMBI';


    btn.style.borderColor = inCombi ? 'rgba(22,163,74,.4)' : 'rgba(219,39,119,.35)';


    btn.style.background = inCombi ? 'rgba(22,163,74,.12)' : 'rgba(255,215,230,.4)';


    btn.style.color = inCombi ? '#15803d' : '#d63384';


  }





  // Toon combi-builder


  updateCombiBuilder();


  document.getElementById('combiBuilder').style.display = 'block';


}





function toggleCombiLeg(matchId, pick, pickLabel, odds) {


  const match = state.matches.find(m => String(m.id) === String(matchId));


  if (!match) return;


  const existing = state.combiBuilder.findIndex(l => String(l.matchId) === String(matchId));


  if (existing >= 0) {


    if (state.combiBuilder[existing].pick === pick) {


      state.combiBuilder.splice(existing, 1);


    } else {


      state.combiBuilder[existing] = { matchId, home:match.home, away:match.away, pick, pickLabel, odds:parseFloat(odds), date:match.date||'' };


    }


  } else {


    if (state.combiBuilder.length >= 8) { alert('Max 8 legs!'); return; }


    state.combiBuilder.push({ matchId, home:match.home, away:match.away, pick, pickLabel, odds:parseFloat(odds), date:match.date||'' });


  }


  updateCombiBuilder();


  updateMatchCardCombiState(matchId);


}





function updateCombiBuilder() {


  const legs = state.combiBuilder;


  const builder = document.getElementById('combiBuilder');


  const floatingBtn = document.getElementById('floatingCombiBtn');


  if (legs.length === 0) {


    builder.style.display = 'none';


    if (floatingBtn) floatingBtn.style.display = 'none';


    return;


  }


  builder.style.display = 'block';


  const totalOdds = legs.reduce((a,l) => a * l.odds, 1);


  document.getElementById('cbLegCount').textContent = legs.length;


  document.getElementById('cbTotalOdds').textContent = totalOdds.toFixed(2);


  document.getElementById('cbLegs').innerHTML = legs.map((l,i) => `


    <div class="combi-builder-leg">


      <div style="flex:1;">


        <div class="cbl-match">${l.home} vs ${l.away}</div>


        <div class="cbl-pick">${l.pick} — ${l.pickLabel}${l.date ? ' · '+l.date : ''}</div>


      </div>


      <span class="cbl-odds">${l.odds.toFixed(2)}</span>


      <button class="cbl-remove" onclick="removeCombiLeg(${i})">✕</button>


    </div>`).join('');


  // Update floating knop


  if (floatingBtn) {


    floatingBtn.style.display = 'block';


    const floatOdds = document.getElementById('floatingCombiOdds');


    if (floatOdds) floatOdds.textContent = totalOdds.toFixed(2) + ' (' + legs.length + ' legs)';


  }


}





function removeCombiLeg(i) {


  const matchId = state.combiBuilder[i]?.matchId;


  state.combiBuilder.splice(i, 1);


  updateCombiBuilder();


  if (matchId) updateMatchCardCombiState(matchId);


}





function clearCombiBuilder() {


  const ids = state.combiBuilder.map(l => l.matchId);


  state.combiBuilder = [];


  updateCombiBuilder();


  ids.forEach(id => updateMatchCardCombiState(id));


}





function updateMatchCardCombiState(matchId) {


  document.querySelectorAll(`.add-combi-btn[data-match="${matchId}"]`).forEach(btn => {


    const inCombi = state.combiBuilder.some(l => String(l.matchId) === String(matchId));


    const pick = state.combiBuilder.find(l => String(l.matchId) === String(matchId))?.pick || '';


    btn.className = 'add-combi-btn' + (inCombi ? ' in-combi' : '');


    btn.innerHTML = inCombi ? `✓ (${pick})` : btn.innerHTML;


  });


}





function openCombiPlaceModal() {


  const legs = state.combiBuilder;


  if (legs.length < 2) { alert('Min 2 legs!'); return; }


  const totalOdds = legs.reduce((a,l) => a * l.odds, 1);


  document.getElementById('combiModalOdds').textContent = totalOdds.toFixed(2);


  document.getElementById('combiModalLegs').innerHTML = legs.map(l => `


    <div style="display:flex;justify-content:space-between;align-items:center;padding:.35rem .6rem;border-left:3px solid rgba(255,154,193,.5);margin-bottom:.3rem;">


      <div>


        <div style="font-size:.78rem;font-weight:600;">${l.home} vs ${l.away}</div>


        <div style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;color:#a78bfa;">${l.pick} — ${l.pickLabel}</div>


      </div>


      <div style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:var(--green);">${l.odds.toFixed(2)}</div>


    </div>`).join('');


  document.getElementById('combiModalBetInput').value = state.settings.defaultBet || 10;


  updateCombiPayoutPreview();


  document.getElementById('combiPlaceModal').classList.add('show');


}





function updateCombiPayoutPreview() {


  const legs = state.combiBuilder;


  const total = legs.reduce((a,l) => a * l.odds, 1);


  const amt = parseFloat(document.getElementById('combiModalBetInput').value) || 0;


  document.getElementById('combiPayoutPreview').textContent = `Uitbetaling: €${(amt*total).toFixed(2)}`;


}





function confirmCombiBet() {


  const legs = state.combiBuilder;


  const amt = parseFloat(document.getElementById('combiModalBetInput').value);


  if (!amt || amt <= 0) return;


  if (amt > state.wallet.balance) { alert('Onvoldoende saldo!'); return; }





  // ── DUPLICATE CHECK ──


  // Voorkom dat dezelfde combi twee keer opgeslagen wordt (bijv. dubbel klikken)


  const legKey = legs.map(l => `${l.matchId}:${l.pick}`).sort().join('|');


  const isDuplicate = state.wallet.bets.some(b => {


    if (b.type !== 'combi' || b.status !== 'pending') return false;


    const existingKey = (b.legs||[]).map(l => `${l.matchId}:${l.pick}`).sort().join('|');


    return existingKey === legKey;


  });


  if (isDuplicate) {


    if (!confirm('Je hebt deze combi al openstaan. Toch nog een keer inzetten?')) return;


  }





  const total = legs.reduce((a,l) => a * l.odds, 1);


  const combiMatchName = legs.map(l => (l.home || l.match?.split(' vs ')?.[0] || '?').substring(0,12)).join(' + ');


  const bet = {


    id: Date.now(), type:'combi',


    matchName: combiMatchName,


    odds: parseFloat(total.toFixed(2)),


    legs: legs.map(l => ({...l, legStatus:'pending'})),


    totalOdds: parseFloat(total.toFixed(2)),


    amount: amt, payout: parseFloat((amt*total).toFixed(2)),


    status: 'pending', date: new Date().toLocaleDateString('nl-NL')


  };


  state.wallet.balance -= amt;


  state.wallet.totalStaked += amt;


  state.wallet.bets.unshift(bet);


  clearCombiBuilder();


  saveState(); updateWalletUI();


  closeModal('combiPlaceModal');


  switchTab('wallet');


}





function cycleCombiLegStatus(betId, i) {


  const bet = state.wallet.bets.find(b => b.id === betId);


  if (!bet) return;


  const leg = bet.legs[i];


  leg.legStatus = leg.legStatus === 'pending' ? 'win' : leg.legStatus === 'win' ? 'lose' : 'pending';


  const anyLose = bet.legs.some(l => l.legStatus === 'lose');


  const allWin = bet.legs.every(l => l.legStatus === 'win');


  const wasWin = bet.status === 'win';


  if (anyLose) {


    if (wasWin) { state.wallet.balance -= bet.payout; state.wallet.totalWon -= bet.payout; }


    bet.status = 'lose';


  } else if (allWin) {


    if (!wasWin) { state.wallet.balance += bet.payout; state.wallet.totalWon += bet.payout; }


    bet.status = 'win';


  } else {


    if (wasWin) { state.wallet.balance -= bet.payout; state.wallet.totalWon -= bet.payout; }


    bet.status = 'pending';


  }


  saveState(); updateWalletUI();


}





// ═══════════════════════════════════════════════════════