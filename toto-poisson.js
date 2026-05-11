// TOTO AI — Poisson Model v11.73
// Automatisch gegenereerd — bewerk niet handmatig

// 📐 POISSON MODEL — wiskundige basiskansen


// ═══════════════════════════════════════════════════════


/**


 * Poisson-kans: P(k goals) = (λ^k × e^-λ) / k!


 */


function poissonProb(lambda, k) {


  if (lambda <= 0) return k === 0 ? 1 : 0;


  let prob = Math.exp(-lambda);


  for (let i = 1; i <= k; i++) prob *= lambda / i;


  return prob;


}





/**


 * Bereken match-uitkomst kansen via Poisson-verdeling.


 * Geeft { p1, pX, p2 } als decimalen (som = ~1.0)


 *


 * @param {number} lambdaHome — verwachte goals thuisploeg


 * @param {number} lambdaAway — verwachte goals uitploeg


 * @param {number} maxGoals   — max goals per team om te berekenen (standaard 6)


 */


function poissonMatchProbs(lambdaHome, lambdaAway, maxGoals = 6) {


  let p1 = 0, pX = 0, p2 = 0;


  for (let h = 0; h <= maxGoals; h++) {


    for (let a = 0; a <= maxGoals; a++) {


      const prob = poissonProb(lambdaHome, h) * poissonProb(lambdaAway, a);


      if (h > a) p1 += prob;


      else if (h === a) pX += prob;


      else p2 += prob;


    }


  }


  return { p1, pX, p2 };


}





/**


 * Extraheer Poisson-parameters uit team-statistieken van API-Football.


 * Retourneert { avgScoredHome, avgScoredAway, avgConcHome, avgConcAway }


 * of null als data ontbreekt.


 */


function extractTeamGoalStats(stats) {


  if (!stats?.goals) return null;


  const gf = stats.goals.for?.average;


  const ga = stats.goals.against?.average;


  if (!gf || !ga) return null;





  // xG data als beschikbaar (betere goals-verwachting dan werkelijke goals)


  const xgFor = stats.goals?.for?.xg;


  const xgAgainst = stats.goals?.against?.xg;





  return {


    avgScoredHome:  parseFloat(gf.home)  || null,


    avgScoredAway:  parseFloat(gf.away)  || null,


    avgScoredTotal: parseFloat(gf.total) || null,


    avgConcHome:    parseFloat(ga.home)  || null,


    avgConcAway:    parseFloat(ga.away)  || null,


    avgConcTotal:   parseFloat(ga.total) || null,


    // xG als blend-correctie (gemiddeld over seizoen)


    xgFor:     xgFor     ? parseFloat(xgFor)     : null,


    xgAgainst: xgAgainst ? parseFloat(xgAgainst) : null,


    // Thuiswedstrijden gespeeld — voor seizoensfase-correctie


    gamesPlayed: stats.fixtures?.played?.total || null,


  };


}





/**


 * Bereken Poisson-kansen voor een wedstrijd.


 * Gebruikt thuis/uit splitsing voor nauwkeurigheid.


 * Optionele injury factors verlagen aanvals- en verdedigingskracht.


 *


 * @returns {{ k1:number, kX:number, k2:number, valid:boolean }}


 */


function calcPoissonKansen(homeStats, awayStats, leagueAvg = 1.35, homeInjFactor = null, awayInjFactor = null) {


  if (!homeStats || !awayStats) return { k1:null, kX:null, k2:null, valid:false };





  // Basis aanvals/verdedigingskracht — thuis/uit split voor nauwkeurigheid


  let homeAttackBase  = homeStats.avgScoredHome  || homeStats.avgScoredTotal || leagueAvg;


  let awayDefenceBase = awayStats.avgConcAway    || awayStats.avgConcTotal   || leagueAvg;


  let awayAttackBase  = awayStats.avgScoredAway  || awayStats.avgScoredTotal || leagueAvg;


  let homeDefenceBase = homeStats.avgConcHome    || homeStats.avgConcTotal   || leagueAvg;





  // xG CORRECTIE — blend werkelijke goals met xG (betere voorspeller)


  // xG corrigeert voor geluk/pech in afwerking


  if (homeStats.xgFor && homeStats.xgFor > 0) {


    homeAttackBase  = homeAttackBase  * 0.6 + (homeStats.xgFor  / Math.max(homeStats.gamesPlayed || 20, 10)) * 0.4;


  }


  if (awayStats.xgFor && awayStats.xgFor > 0) {


    awayAttackBase  = awayAttackBase  * 0.6 + (awayStats.xgFor  / Math.max(awayStats.gamesPlayed || 20, 10)) * 0.4;


  }


  if (homeStats.xgAgainst && homeStats.xgAgainst > 0) {


    homeDefenceBase = homeDefenceBase * 0.6 + (homeStats.xgAgainst / Math.max(homeStats.gamesPlayed || 20, 10)) * 0.4;


  }


  if (awayStats.xgAgainst && awayStats.xgAgainst > 0) {


    awayDefenceBase = awayDefenceBase * 0.6 + (awayStats.xgAgainst / Math.max(awayStats.gamesPlayed || 20, 10)) * 0.4;


  }





  // Blessure-factoren


  const homeAttack  = homeAttackBase  * (homeInjFactor?.attackFactor  ?? 1.0);


  const homeDefence = homeDefenceBase * (1 / (homeInjFactor?.defenseFactor ?? 1.0));


  const awayAttack  = awayAttackBase  * (awayInjFactor?.attackFactor  ?? 1.0);


  const awayDefence = awayDefenceBase * (1 / (awayInjFactor?.defenseFactor ?? 1.0));





  const lambdaHome = (homeAttack * awayDefence) / leagueAvg;


  const lambdaAway = (awayAttack * homeDefence) / leagueAvg;





  if (lambdaHome <= 0 || lambdaAway <= 0 || lambdaHome > 6 || lambdaAway > 6) {


    return { k1:null, kX:null, k2:null, valid:false };


  }





  const { p1, pX, p2 } = poissonMatchProbs(lambdaHome, lambdaAway);





  const hasXG = (homeStats.xgFor || awayStats.xgFor) ? true : false;


  const injLabel = (homeInjFactor?.count || awayInjFactor?.count)


    ? ` [thuis ${homeInjFactor?.count||0}bless, uit ${awayInjFactor?.count||0}bless]`


    : '';





  return {


    k1: Math.round(p1 * 100),


    kX: Math.round(pX * 100),


    k2: Math.round(p2 * 100),


    lambdaHome: parseFloat(lambdaHome.toFixed(2)),


    lambdaAway: parseFloat(lambdaAway.toFixed(2)),


    injLabel,


    hasXG,  // voor dynamisch blend-gewicht


    valid: true


  };


}





// ═══════════════════════════════════════════════════════


// 📈 MARKTBEWEGING — opening vs huidige quote


// ═══════════════════════════════════════════════════════


/**


 * Sla opening-odds op bij eerste keer laden van een competitie.


 * state.openingOdds[fixtureId] = { home, draw, away, savedAt }


 */


function saveOpeningOdds(matches) {


  if (!state.openingOdds) state.openingOdds = {};


  const now = Date.now();


  matches.forEach(m => {


    // Alleen opslaan als we echte odds hebben en nog geen opening hebben


    if (m.homeOdds === '—' || state.openingOdds[m.id]) return;


    state.openingOdds[m.id] = {


      home: parseFloat(m.homeOdds),


      draw: parseFloat(m.drawOdds),


      away: parseFloat(m.awayOdds),


      savedAt: now


    };


  });


}





/**


 * Analyseer marktbeweging voor een wedstrijd.


 * Returns: { direction, pick, pct, label, confDelta }


 *  direction = 'home'|'draw'|'away'|'none'


 *  pct = procentuele quotebeweging (negatief = quote daalde = geld stroomt op die kant)


 *  confDelta = aanpassing confidence score (-2 tot +2)


 */


function analyzeMarketMovement(matchId, currentHome, currentDraw, currentAway) {


  if (!state.openingOdds?.[matchId]) return { direction:'none', confDelta:0, label:'' };





  const op = state.openingOdds[matchId];


  if (!op.home || !op.draw || !op.away) return { direction:'none', confDelta:0, label:'' };





  // Quote-beweging in % (negatief = daalt = geld stroomt op die kant = sharp signal)


  const homeMove = ((currentHome - op.home) / op.home) * 100;


  const drawMove = ((currentDraw - op.draw) / op.draw) * 100;


  const awayMove = ((currentAway - op.away) / op.away) * 100;





  // Grootste beweging bepalen (meest significant)


  const moves = [


    { pick:'1', move: homeMove, label:'Thuis' },


    { pick:'X', move: drawMove, label:'Gelijk' },


    { pick:'2', move: awayMove, label:'Uit' },


  ];





  // Zoek sterkste neerwaartse beweging (geld stroomt er naartoe)


  const sharpest = moves.reduce((a, b) => b.move < a.move ? b : a);





  // Alleen rapporteren als beweging significant is (>3%)


  if (Math.abs(sharpest.move) < 3) return { direction:'none', confDelta:0, label:'' };





  const pct = Math.abs(sharpest.move).toFixed(1);


  const direction = sharpest.pick;





  // Is dit steam (quote daalt sterk = sharp money)?


  const isSteam = sharpest.move < -5;


  const isReverse = sharpest.move > 5;





  const label = isSteam


    ? `📉 ${sharpest.label} -${pct}% (sharp money)`


    : `📈 ${sharpest.label} +${pct}% (publiek slingert af)`;





  const confDelta = isSteam ? 2 : isReverse ? -1 : 0;





  return { direction, pick: sharpest.pick, pct: parseFloat(pct), isSteam, label, confDelta };


}





/**


 * Scan alle wedstrijden in één AI-call.


 * Gebruikt temperature=0 + 3-uitkomst model (1/X/2 sommeert tot 100%)


 * voor deterministische, reproduceerbare resultaten.


 */





// ═══════════════════════════════════════════════════════


// SCAN ALLE COMPETITIES VANDAAG — value scan op alle geladen wedstrijden


// ═══════════════════════════════════════════════════════