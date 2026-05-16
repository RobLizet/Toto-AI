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

function extractTeamGoalStats(stats, recentFixtures = null) {
  if (!stats?.goals) return null;
  const gf = stats.goals.for?.average;
  const ga = stats.goals.against?.average;
  if (!gf || !ga) return null;
  const xgFor = stats.goals?.for?.xg;
  const xgAgainst = stats.goals?.against?.xg;
  const gamesPlayed = stats.fixtures?.played?.total || null;
  let base = {
    avgScoredHome:  parseFloat(gf.home)  || null,
    avgScoredAway:  parseFloat(gf.away)  || null,
    avgScoredTotal: parseFloat(gf.total) || null,
    avgConcHome:    parseFloat(ga.home)  || null,
    avgConcAway:    parseFloat(ga.away)  || null,
    avgConcTotal:   parseFloat(ga.total) || null,
    xgFor:     xgFor     ? parseFloat(xgFor)     : null,
    xgAgainst: xgAgainst ? parseFloat(xgAgainst) : null,
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
