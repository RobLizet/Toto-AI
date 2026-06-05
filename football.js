// ═══════════════════════════════════════════════════════
// FOOTBALL.JS — Wiskundige modellen: Poisson, calcValue, markt
// ═══════════════════════════════════════════════════════

// ── Competitie-specifieke doelpuntengemiddelden (2024/25) ──
const LEAGUE_AVG_GOALS = {
  88:  1.68, 89:  1.55, 39:  1.40, 40:  1.52, 78:  1.55,
  79:  1.48, 61:  1.32, 135: 1.18, 140: 1.28, 2:   1.45,
  144: 1.62, 203: 1.52, 1:   1.40, _default: 1.35
};

const MARKET_EFFICIENCY = {
  39: 0.95, 78: 0.93, 135: 0.92, 61: 0.91, 2: 0.90,
  88: 0.82, 144: 0.78, 140: 0.92, 40: 0.82, 79: 0.84,
  203: 0.75, 89: 0.70, 90: 0.68, 5: 0.72,
};

function getLeagueAvg(leagueId) {
  return LEAGUE_AVG_GOALS[leagueId] || LEAGUE_AVG_GOALS._default;
}

function getMarketEfficiency(leagueId) {
  return MARKET_EFFICIENCY[leagueId] || 0.65;
}

function marketEfficiencyLabel(leagueId) {
  const eff = getMarketEfficiency(leagueId);
  if (eff >= 0.90) return `✅ Hoog efficiënte markt (${Math.round(eff*100)}%) — bookmakerquotes betrouwbaar`;
  if (eff >= 0.78) return `⚠️ Gemiddelde marktefficiëntie (${Math.round(eff*100)}%) — meer value kansen mogelijk`;
  return `🟡 Lage marktefficiëntie (${Math.round(eff*100)}%) — grotere foutmarge bookmakers`;
}


// ── Blessure impact berekening ────────────────────────────
// Berekent attack/defense factor op basis van geblesseerde spelers
function calcInjuryFactor(injuries, teamId) {
  if (!injuries?.length) return { attackFactor: 1.0, defenseFactor: 1.0, count: 0, players: [] };
  const teamInjuries = injuries.filter(i =>
    String(i.team?.id) === String(teamId) &&
    ['Missing Fixture', 'Doubtful'].includes(i.player?.reason || i.status)
  );
  if (!teamInjuries.length) return { attackFactor: 1.0, defenseFactor: 1.0, count: 0, players: [] };

  let attackImpact = 0, defenseImpact = 0;
  const players = [];
  teamInjuries.forEach(i => {
    const pos = (i.player?.pos || '').toUpperCase();
    const name = i.player?.name || '?';
    const isMissing = i.player?.reason === 'Missing Fixture';
    const impact = isMissing ? 1.0 : 0.5; // 100% impact bij zeker afwezig, 50% bij twijfelachtig
    if (pos === 'F' || pos === 'A') attackImpact  += impact * 0.08; // aanvaller: 8% per speler
    else if (pos === 'M')           attackImpact  += impact * 0.04; // middenvelder: 4%
    else if (pos === 'D')           defenseImpact += impact * 0.06; // verdediger: 6%
    else if (pos === 'G')           defenseImpact += impact * 0.10; // keeper: 10%
    players.push(name);
  });
  return {
    attackFactor:  Math.max(0.70, 1.0 - attackImpact),
    defenseFactor: Math.max(0.70, 1.0 - defenseImpact),
    count: teamInjuries.length,
    players: players.slice(0, 5)
  };
}

// ── Stand informatie extraheren ───────────────────────────
function extractStandingInfo(standings, teamId) {
  if (!standings?.length) return null;
  const entry = standings.find(s => String(s.team?.id) === String(teamId));
  if (!entry) return null;
  const total = standings.length;
  const pos = entry.rank;
  const pts = entry.points;
  const played = entry.all?.played || 0;
  const gd = entry.goalsDiff || 0;
  const form = entry.form || '';

  // Motivatie detectie
  let motivatie = 'normaal';
  let motivatieLabel = '';
  let motivatieFactor = 1.0;

  // Top 3: titelstrijd
  if (pos <= 3) {
    motivatie = 'titelstrijd';
    motivatieLabel = `🏆 Positie ${pos} — titelaspiraties`;
    motivatieFactor = 1.05;
  }
  // Degradatiezone (laatste 3)
  else if (pos >= total - 2) {
    motivatie = 'degradatiestrijd';
    motivatieLabel = `🔴 Positie ${pos}/${total} — degradatiegevaar`;
    motivatieFactor = 1.08; // extra gemotiveerd door overleving
  }
  // Veilige middenmotor
  else if (pos >= 8 && pos <= total - 5) {
    const remainingMatches = played < 30 ? (38 - played) : 0;
    if (remainingMatches <= 3) {
      motivatie = 'niets_te_winnen';
      motivatieLabel = `😴 Positie ${pos} — seizoen bijna voorbij`;
      motivatieFactor = 0.92; // minder gemotiveerd
    }
  }
  // Europees voetbal race (pos 4-7)
  else if (pos >= 4 && pos <= 7) {
    motivatie = 'europees';
    motivatieLabel = `🌍 Positie ${pos} — europarace`;
    motivatieFactor = 1.03;
  }

  return { pos, pts, played, gd, form, total, motivatie, motivatieLabel, motivatieFactor };
}

// ── Tijdsgewogen H2H ──────────────────────────────────────
// Recente H2H duels wegen zwaarder dan oude
function calcWeightedH2H(h2hFixtures, homeId, awayId) {
  if (!h2hFixtures?.length) return null;
  const now = Date.now();
  let homeWins = 0, awayWins = 0, draws = 0, totalWeight = 0;

  h2hFixtures.slice(0, 10).forEach(f => {
    const date = f.fixture?.date ? new Date(f.fixture.date) : null;
    const ageYears = date ? (now - date.getTime()) / (365.25 * 24 * 3600 * 1000) : 3;
    // Exponentieel dalend gewicht: recent = zwaar, oud = licht
    // 6 maanden geleden: ~0.85, 1 jaar: ~0.72, 2 jaar: ~0.52, 3 jaar: ~0.37
    const weight = Math.exp(-0.30 * ageYears);
    totalWeight += weight;

    const hg = f.goals?.home ?? 0, ag = f.goals?.away ?? 0;
    const homeIsHome = String(f.teams?.home?.id) === String(homeId);
    if (homeIsHome) {
      if (hg > ag) homeWins += weight;
      else if (hg < ag) awayWins += weight;
      else draws += weight;
    } else {
      if (ag > hg) homeWins += weight; // home team speelde uit
      else if (ag < hg) awayWins += weight;
      else draws += weight;
    }
  });

  if (!totalWeight) return null;
  return {
    homeWinPct: Math.round(homeWins / totalWeight * 100),
    awayWinPct: Math.round(awayWins / totalWeight * 100),
    drawPct:    Math.round(draws    / totalWeight * 100),
    count:      h2hFixtures.length,
    weighted:   true
  };
}

// ── Competitie-fase context ───────────────────────────────
function getCompetitionPhase(played, total = 38) {
  if (!played) return { phase: 'onbekend', label: '', factor: 1.0 };
  const pct = played / total;
  if (pct >= 0.90) return { phase: 'einde',   label: '🏁 Laatste speelronden', factor: 0.95 };
  if (pct >= 0.70) return { phase: 'laat',    label: '📅 Eindfase seizoen',    factor: 0.98 };
  if (pct >= 0.40) return { phase: 'midden',  label: '⚽ Midden seizoen',      factor: 1.00 };
  return              { phase: 'vroeg',    label: '🌱 Vroeg seizoen',       factor: 1.02 };
}

// ── Poisson kans ───────────────────────────────────────
function poissonProb(lambda, k) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let prob = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) prob *= lambda / i;
  return prob;
}

// ── Dixon-Coles tau correctie ──────────────────────────
function dixonColesTau(homeGoals, awayGoals, lambdaHome, lambdaAway, rho = -0.13) {
  if (homeGoals === 0 && awayGoals === 0) return 1 - lambdaHome * lambdaAway * rho;
  if (homeGoals === 0 && awayGoals === 1) return 1 + lambdaHome * rho;
  if (homeGoals === 1 && awayGoals === 0) return 1 + lambdaAway * rho;
  if (homeGoals === 1 && awayGoals === 1) return 1 - rho;
  return 1;
}

function poissonMatchProbs(lambdaHome, lambdaAway, maxGoals = 6, useDixonColes = true) {
  let p1 = 0, pX = 0, p2 = 0;
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      let prob = poissonProb(lambdaHome, h) * poissonProb(lambdaAway, a);
      if (useDixonColes) prob *= dixonColesTau(h, a, lambdaHome, lambdaAway);
      if (h > a) p1 += prob;
      else if (h === a) pX += prob;
      else p2 += prob;
    }
  }
  const total = p1 + pX + p2;
  return { p1: p1/total, pX: pX/total, p2: p2/total };
}

function extractTeamGoalStats(stats, recentFixtures = null, fixtureXgData = null) {
  if (!stats?.goals) return null;
  const gf = stats.goals.for?.average;
  const ga = stats.goals.against?.average;
  if (!gf || !ga) return null;

  // v18.9: xG uit fixture statistics (API-Football Pro levert dit per wedstrijd)
  // fixtureXgData = [{xgFor: 1.2, xgAgainst: 0.8}, ...] van laatste N wedstrijden
  let xgFor = null, xgAgainst = null;
  if (fixtureXgData?.length >= 2) {
    const validFor     = fixtureXgData.map(d => d.xgFor).filter(v => v !== null && v > 0);
    const validAgainst = fixtureXgData.map(d => d.xgAgainst).filter(v => v !== null && v > 0);
    if (validFor.length >= 2)     xgFor     = parseFloat((validFor.reduce((a,b)=>a+b,0) / validFor.length).toFixed(2));
    if (validAgainst.length >= 2) xgAgainst = parseFloat((validAgainst.reduce((a,b)=>a+b,0) / validAgainst.length).toFixed(2));
  }

  const gamesPlayed = stats.fixtures?.played?.total || null;
  let base = {
    avgScoredHome:  parseFloat(gf.home)  || null,
    avgScoredAway:  parseFloat(gf.away)  || null,
    avgScoredTotal: parseFloat(gf.total) || null,
    avgConcHome:    parseFloat(ga.home)  || null,
    avgConcAway:    parseFloat(ga.away)  || null,
    avgConcTotal:   parseFloat(ga.total) || null,
    xgFor,
    xgAgainst,
    gamesPlayed,
  };
  if (recentFixtures?.length >= 3) {
    const last5 = recentFixtures.slice(-5);
    const last3 = recentFixtures.slice(-3);
    // Weeg laatste 3 wedstrijden zwaarder dan laatste 5
    const recentGF5 = last5.reduce((s,f) => s + (f.goals?.for  || 0), 0) / last5.length;
    const recentGA5 = last5.reduce((s,f) => s + (f.goals?.against || 0), 0) / last5.length;
    const recentGF3 = last3.reduce((s,f) => s + (f.goals?.for  || 0), 0) / last3.length;
    const recentGA3 = last3.reduce((s,f) => s + (f.goals?.against || 0), 0) / last3.length;
    // Gewogen recente vorm: 60% laatste 3, 40% laatste 5
    const recentGF = 0.60 * recentGF3 + 0.40 * recentGF5;
    const recentGA = 0.60 * recentGA3 + 0.40 * recentGA5;
    // Verhoogde vormweging: 55% recent, 45% seizoen (was 40/60)
    const RW = 0.55, SW = 0.45;
    if (base.avgScoredTotal) base.avgScoredTotal = SW * base.avgScoredTotal + RW * recentGF;
    if (base.avgConcTotal)   base.avgConcTotal   = SW * base.avgConcTotal   + RW * recentGA;
    if (base.avgScoredHome)  base.avgScoredHome  = SW * base.avgScoredHome  + RW * recentGF;
    if (base.avgScoredAway)  base.avgScoredAway  = SW * base.avgScoredAway  + RW * recentGF;
    if (base.avgConcHome)    base.avgConcHome    = SW * base.avgConcHome    + RW * recentGA;
    if (base.avgConcAway)    base.avgConcAway    = SW * base.avgConcAway    + RW * recentGA;
    base.recentFormUsed = true;
    base.recentGF = parseFloat(recentGF.toFixed(2));
    base.recentGA = parseFloat(recentGA.toFixed(2));
  }
  return base;
}

function calcPoissonKansen(homeStats, awayStats, leagueAvgOrId = 1.35, homeInjFactor = null, awayInjFactor = null) {
  const leagueAvg = typeof leagueAvgOrId === 'number' && leagueAvgOrId < 10
    ? leagueAvgOrId
    : getLeagueAvg(leagueAvgOrId);
  if (!homeStats || !awayStats) return { k1:null, kX:null, k2:null, valid:false };
  let homeAttackBase  = homeStats.avgScoredHome  || homeStats.avgScoredTotal || leagueAvg;
  let awayDefenceBase = awayStats.avgConcAway    || awayStats.avgConcTotal   || leagueAvg;
  let awayAttackBase  = awayStats.avgScoredAway  || awayStats.avgScoredTotal || leagueAvg;
  let homeDefenceBase = homeStats.avgConcHome    || homeStats.avgConcTotal   || leagueAvg;
  if (homeStats.xgFor && homeStats.xgFor > 0)
    homeAttackBase  = homeAttackBase  * 0.6 + (homeStats.xgFor  / Math.max(homeStats.gamesPlayed||20,10)) * 0.4;
  if (awayStats.xgFor && awayStats.xgFor > 0)
    awayAttackBase  = awayAttackBase  * 0.6 + (awayStats.xgFor  / Math.max(awayStats.gamesPlayed||20,10)) * 0.4;
  if (homeStats.xgAgainst && homeStats.xgAgainst > 0)
    homeDefenceBase = homeDefenceBase * 0.6 + (homeStats.xgAgainst / Math.max(homeStats.gamesPlayed||20,10)) * 0.4;
  if (awayStats.xgAgainst && awayStats.xgAgainst > 0)
    awayDefenceBase = awayDefenceBase * 0.6 + (awayStats.xgAgainst / Math.max(awayStats.gamesPlayed||20,10)) * 0.4;
  const homeAttack  = homeAttackBase  * (homeInjFactor?.attackFactor  ?? 1.0);
  const homeDefence = homeDefenceBase * (1 / (homeInjFactor?.defenseFactor ?? 1.0));
  const awayAttack  = awayAttackBase  * (awayInjFactor?.attackFactor  ?? 1.0);
  const awayDefence = awayDefenceBase * (1 / (awayInjFactor?.defenseFactor ?? 1.0));
  // Thuisvoordeel factor: gemiddeld scoren thuisteams 20-25% meer dan uitwedstrijden
  // Dit is al deels verwerkt via home/away splits, maar extra correctie voor neutrale velden
  const isNeutral = false; // kan later uitgebreid worden met fixture.neutral
  const homeAdv = isNeutral ? 1.0 : 1.08; // 8% thuisvoordeel correctie
  const lambdaHome = (homeAttack * awayDefence) / leagueAvg * homeAdv;
  const lambdaAway = (awayAttack * homeDefence) / leagueAvg / homeAdv;
  if (lambdaHome <= 0 || lambdaAway <= 0 || lambdaHome > 6 || lambdaAway > 6)
    return { k1:null, kX:null, k2:null, valid:false };
  const { p1, pX, p2 } = poissonMatchProbs(lambdaHome, lambdaAway);
  const injLabel = (homeInjFactor?.count || awayInjFactor?.count)
    ? ` [thuis ${homeInjFactor?.count||0}bless, uit ${awayInjFactor?.count||0}bless]` : '';
  return {
    k1: Math.round(p1 * 100),
    kX: Math.round(pX * 100),
    k2: Math.round(p2 * 100),
    lambdaHome: parseFloat(lambdaHome.toFixed(2)),
    lambdaAway: parseFloat(lambdaAway.toFixed(2)),
    injLabel,
    hasXG: !!(homeStats.xgFor || awayStats.xgFor),
    valid: true
  };
}

// ── Value berekening ────────────────────────────────────
function calcValue(aiKans, odds) {
  if (!aiKans || !odds || odds <= 1) return null;
  const implied = 100 / odds;
  return parseFloat((aiKans - implied).toFixed(2));
}

// Overround-gecorrigeerde implied kansen
// Bookmakers bouwen ~5-8% marge in — dit corrigeert daarvoor
function calcFairOdds(homeOdds, drawOdds, awayOdds) {
  const h = parseFloat(homeOdds) || 0;
  const d = parseFloat(drawOdds) || 0;
  const a = parseFloat(awayOdds) || 0;
  if (!h || !d || !a || h <= 1 || d <= 1 || a <= 1) return null;
  const overround = 1/h + 1/d + 1/a;
  return {
    homeImplied: Math.round((1/h / overround) * 100),
    drawImplied: Math.round((1/d / overround) * 100),
    awayImplied: Math.round((1/a / overround) * 100),
    overround:   Math.round((overround - 1) * 100 * 10) / 10, // in %
    margin:      overround
  };
}

// Value berekening met overround correctie
// Vergelijkt AI kans met faire implied kans (niet raw bookmaker kans)
function calcValueFair(aiKans, odds, homeOdds, drawOdds, awayOdds) {
  if (!aiKans || !odds || odds <= 1) return null;
  const fair = calcFairOdds(homeOdds, drawOdds, awayOdds);
  if (!fair) return calcValue(aiKans, odds); // fallback naar normale berekening
  // Faire odds = bookmaker odds * overround factor
  const fairOdds = odds * fair.margin;
  const fairImplied = 100 / fairOdds;
  return parseFloat((aiKans - fairImplied).toFixed(2));
}

function calcKelly(kans, odds) {
  if (!kans || !odds || odds <= 1) return 0;
  const p = kans / 100;
  const q = 1 - p;
  const b = odds - 1;
  const kelly = (b * p - q) / b;
  return Math.max(0, parseFloat((kelly * 50).toFixed(2))); // half Kelly in %
}

// v26.22: EV% o.b.v. werkelijk verkrijgbare odds (mét vig) — voor staking/weergave, niet voor selectie.
// Selectie draait op de de-vigde edge (calcValueFair); dit is je verwachte rendement.
function calcEV(kans, odds) {
  if (!kans || !odds || odds <= 1) return null;
  return parseFloat((((kans / 100) * odds - 1) * 100).toFixed(1));
}

function valueClass(value) {
  if (value === null || value === undefined) return 'neu';
  if (value >= 15) return 'high';
  if (value >= 5)  return 'med';
  return 'low';
}

function shortName(name) {
  if (!name) return '?';
  return name.length > 12 ? name.split(' ').map(w => w[0]).join('').toUpperCase() : name;
}

// ── Marktbeweging analyse ────────────────────────────────
function saveOpeningOdds(matches) {
  if (!state.openingOdds) state.openingOdds = {};
  const now = Date.now();
  matches.forEach(m => {
    if (m.homeOdds === '—' || state.openingOdds[m.id]) return;
    state.openingOdds[m.id] = {
      home: parseFloat(m.homeOdds),
      draw: parseFloat(m.drawOdds),
      away: parseFloat(m.awayOdds),
      savedAt: now
    };
  });
}

function analyzeMarketMovement(matchId, currentHome, currentDraw, currentAway) {
  if (!state.openingOdds?.[matchId]) return { direction:'none', confDelta:0, label:'' };
  const op = state.openingOdds[matchId];
  if (!op.home || !op.draw || !op.away) return { direction:'none', confDelta:0, label:'' };
  const homeMove = ((currentHome - op.home) / op.home) * 100;
  const drawMove = ((currentDraw - op.draw) / op.draw) * 100;
  const awayMove = ((currentAway - op.away) / op.away) * 100;
  const moves = [
    { pick:'1', move: homeMove, label:'Thuis' },
    { pick:'X', move: drawMove, label:'Gelijk' },
    { pick:'2', move: awayMove, label:'Uit' },
  ];
  const sharpest = moves.reduce((a, b) => b.move < a.move ? b : a);
  if (Math.abs(sharpest.move) < 3) return { direction:'none', confDelta:0, label:'' };
  const pct = Math.abs(sharpest.move).toFixed(1);
  const isSteam = sharpest.move < -5;
  const isReverse = sharpest.move > 5;
  const label = isSteam
    ? `📉 ${sharpest.label} -${pct}% (sharp money)`
    : `📈 ${sharpest.label} +${pct}% (publiek slingert af)`;
  const confDelta = isSteam ? 2 : isReverse ? -1 : 0;
  return { direction:sharpest.pick, pick:sharpest.pick, pct:parseFloat(pct), isSteam, label, confDelta };
}

// ── Beste beschikbare odds ────────────────────────────────
function getBestOdds(match) {
  const h = parseFloat(match.homeOdds) || 0;
  const d = parseFloat(match.drawOdds) || 0;
  const a = parseFloat(match.awayOdds) || 0;
  let best = null, bestName = null;
  if (match.bookmakerOdds) {
    for (const [bk, odds] of Object.entries(match.bookmakerOdds)) {
      const o1 = parseFloat(odds['1']) || 0;
      const oX = parseFloat(odds['X']) || 0;
      const o2 = parseFloat(odds['2']) || 0;
      const bestO = Math.max(o1, oX, o2);
      if (!best || bestO > best) { best = bestO; bestName = bk; }
    }
  }
  if (!best || h > best) { best = h; bestName = match.oddsSource || 'quote'; }
  return best ? { odds: best, bookmaker: bestName } : null;
}

// ── Context helpers ──────────────────────────────────────
function formatH2HCompact(fixtures, homeName, awayName) {
  if (!fixtures?.length) return '';
  let hw=0, aw=0, dr=0, totalGoals=0;
  fixtures.forEach(f => {
    if (f.teams.home.winner === true) hw++;
    else if (f.teams.away.winner === true) aw++;
    else dr++;
    totalGoals += (f.goals.home ?? 0) + (f.goals.away ?? 0);
  });
  let homeTeamWins = 0, awayTeamWins = 0;
  const homeN = homeName.toLowerCase().substring(0,5);
  const awayN = awayName.toLowerCase().substring(0,5);
  fixtures.forEach(f => {
    const winnerTeam = f.teams.home.winner ? f.teams.home.name : f.teams.away.winner ? f.teams.away.name : null;
    if (!winnerTeam) return;
    const wn = winnerTeam.toLowerCase();
    if (wn.includes(homeN) || homeN.includes(wn.substring(0,5))) homeTeamWins++;
    else if (wn.includes(awayN) || awayN.includes(wn.substring(0,5))) awayTeamWins++;
  });
  const avg = (totalGoals / fixtures.length).toFixed(1);
  return `${fixtures.length} duels: ${homeName.split(' ')[0]} ${homeTeamWins}w, ${awayName.split(' ')[0]} ${awayTeamWins}w, ${dr}gelijk (gem ${avg} goals)`;
}

function formatFormCompact(fixtures, teamId, teamName) {
  if (!fixtures?.length) return '';
  let letters = '', gFor = 0, gAg = 0, scored = 0;
  fixtures.forEach(f => {
    const isHome = f.teams.home.id === teamId;
    const team = isHome ? f.teams.home : f.teams.away;
    const tFor = isHome ? (f.goals.home ?? 0) : (f.goals.away ?? 0);
    const tAg = isHome ? (f.goals.away ?? 0) : (f.goals.home ?? 0);
    gFor += tFor; gAg += tAg;
    if (tFor > 0) scored++;
    letters += team.winner === true ? 'W' : team.winner === false ? 'L' : 'D';
  });
  return `${letters} (${gFor}-${gAg}, scoorde ${scored}/${fixtures.length})`;
}


// ── xG ophalen uit recente fixture statistics ────────────
// Haalt xG op voor een team uit hun laatste N gespeelde wedstrijden
// Gebruik: const xgData = await fetchXGFromFixtures(teamId, recentFixtures)
async function fetchXGFromFixtures(teamId, recentFixtures) {
  if (!recentFixtures?.length || !teamId) return [];
  const last5 = recentFixtures.slice(0, 5);
  const results = [];
  await Promise.all(last5.map(async fix => {
    const fixtureId = fix.fixture?.id;
    if (!fixtureId) return;
    try {
      const cacheKey = `xg_${fixtureId}`;
      const cached = _cacheGet(cacheKey);
      if (cached) { results.push(cached); return; }
      const r = await apiFetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`, null, 4000);
      const d = await r.json();
      const teamStats = (d.response||[]).find(t => String(t.team?.id) === String(teamId));
      if (!teamStats) return;
      const xgForVal     = teamStats.statistics?.find(s => s.type === 'expected_goals')?.value;
      const xgAgainstVal = (d.response||[]).find(t => String(t.team?.id) !== String(teamId))
                            ?.statistics?.find(s => s.type === 'expected_goals')?.value;
      const entry = {
        fixtureId,
        xgFor:     xgForVal     ? parseFloat(xgForVal)     : null,
        xgAgainst: xgAgainstVal ? parseFloat(xgAgainstVal) : null,
      };
      _cacheSet(cacheKey, entry);
      results.push(entry);
    } catch(e) {}
  }));
  return results.filter(r => r.xgFor !== null || r.xgAgainst !== null);
}
