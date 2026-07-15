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

// ═══ v26.253: MARKT-ANKER OP HET DOELPUNTENTOTAAL ═══════════════════════════
// De Poisson-lambda's zijn SoS-blind. Wijkt het model-totaal materieel af van het markt-impliciete
// totaal, dan tonen Under 1.5/2.5/3.5 EN BTTS-Nee allemaal dezelfde "value" — vier keer dezelfde
// scheve parameter, geen vier edges. Het anker trekt het TOTAAL naar de markt en laat de supremacie
// (verhouding lambdaHome:lambdaAway) exact ongemoeid.
// DORMANT: LAMBDA_ANCHOR_W = 0 -> de lambda's blijven byte-identiek, alleen de diagnose wordt gezet.
// Test-override op één toestel: localStorage.setItem('pmx_lambda_anchor_w','0.7')
const LAMBDA_ANCHOR_W_DEFAULT = 0;
const LAMBDA_ANCHOR_DEADBAND  = 0.30; // < 0.30 goal verschil = ruis, niet corrigeren
const LINE_ANCHOR_WEIGHTS     = { '1.5': 1, '2.5': 2, '3.5': 1 }; // 2.5 is het liquiedst -> zwaarder

function getLambdaAnchorW() {
  try {
    const v = parseFloat(localStorage.getItem('pmx_lambda_anchor_w'));
    if (isFinite(v)) return Math.min(Math.max(v, 0), 1);
  } catch (e) {}
  return LAMBDA_ANCHOR_W_DEFAULT;
}

// Lost het markt-impliciete doelpuntentotaal op uit één de-vigde Over-kans, met dezelfde
// Poisson+Dixon-Coles-kern als het model en met behoud van de supremacie-verhouding.
function solveMarketTotal(lh, la, line, fairOver) {
  if (!(fairOver > 0 && fairOver < 100)) return null;
  if (!(lh > 0) || !(la > 0) || !isFinite(line)) return null;
  const share = lh / (lh + la), thr = Math.floor(line);
  const pOver = T => {
    const A = T * share, B = T * (1 - share);
    let under = 0;
    for (let h = 0; h <= 12; h++) for (let a = 0; a <= 12; a++) {
      if (h + a <= thr) under += poissonProb(A, h) * poissonProb(B, a) * dixonColesTau(h, a, A, B);
    }
    return (1 - under) * 100;
  };
  let lo = 0.5, hi = 6;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (pOver(mid) < fairOver) lo = mid; else hi = mid; }
  const t = (lo + hi) / 2;
  return (t > 0.51 && t < 5.99) ? t : null; // bisectie tegen de rand geplakt = onbetrouwbaar
}

// Gewogen markt-totaal over alle beschikbare O/U-lijnen. Bewust NIET alleen 2.5: kalibreren op één
// lijn zet die lijn per constructie op 0pp value, waardoor je hem nooit meer als pick kunt vinden.
function marketTotalGoals(lh, la, goalOdds) {
  let num = 0, den = 0;
  for (const line of ['1.5', '2.5', '3.5']) {
    const fo = goalOdds?.ou?.[line]?.fairOver;
    const t = solveMarketTotal(lh, la, parseFloat(line), fo);
    if (t != null) { const w = LINE_ANCHOR_WEIGHTS[line] || 1; num += t * w; den += w; }
  }
  return den > 0 ? num / den : null;
}

// Zet ALTIJD poisson.anchor (de diagnose), en muteert de lambda's + 1X2 alleen als het anker aanstaat.
// Geeft het anchor-object terug, of null als er niets te meten viel.
function anchorLambdasToMarket(poisson, goalOdds) {
  if (!poisson || !poisson.valid) return null;
  const lh = poisson.lambdaHome, la = poisson.lambdaAway;
  if (!(lh > 0) || !(la > 0)) return null;
  const w = getLambdaAnchorW();
  const modelTot = lh + la;
  const mktTot = marketTotalGoals(lh, la, goalOdds);
  const anchor = { modelTot, mktTot, gap: null, coherent: true, applied: false, w };
  if (mktTot == null) { poisson.anchor = anchor; return anchor; }
  anchor.gap = modelTot - mktTot;
  anchor.coherent = Math.abs(anchor.gap) <= LAMBDA_ANCHOR_DEADBAND;
  if (!anchor.coherent && w > 0) {
    const f = (modelTot + (mktTot - modelTot) * w) / modelTot;
    poisson.lambdaHome = Math.max(0.05, lh * f);
    poisson.lambdaAway = Math.max(0.05, la * f);
    // v26.256: k1/kX/k2 bewust NIET herberekenen. Deze functie draait ná de SoS-pull, die de 1X2-kansen
    // al naar de de-vigde markt heeft getrokken. Ze opnieuw uit de lambda's afleiden zou die pull wissen.
    // Het anker corrigeert het doelpuntentotaal: dat raakt de goal-markten en de AH-staart, niet 1X2.
    anchor.applied = true;
  }
  poisson.anchor = anchor;
  return anchor;
}

// v26.146: model-kansen voor doelpunten-markten (O/U 1.5/2.5/3.5 + BTTS) uit lambdaHome/lambdaAway.
// Zelfde Poisson + Dixon-Coles als poissonMatchProbs, zodat de getallen consistent zijn met 1X2.
function goalMarketProbs(lambdaHome, lambdaAway, maxGoals = 8, useDixonColes = true) {
  if (!(lambdaHome > 0 && lambdaAway > 0)) return null;
  let o15 = 0, o25 = 0, o35 = 0, btts = 0, tot = 0;
  const grid = [];
  for (let h = 0; h <= maxGoals; h++) for (let a = 0; a <= maxGoals; a++) {
    let p = poissonProb(lambdaHome, h) * poissonProb(lambdaAway, a);
    if (useDixonColes) p *= dixonColesTau(h, a, lambdaHome, lambdaAway);
    grid.push([h, a, p]); tot += p;
  }
  if (tot <= 0) return null;
  for (const [h, a, p0] of grid) {
    const p = p0 / tot, t = h + a;
    if (t >= 2) o15 += p; if (t >= 3) o25 += p; if (t >= 4) o35 += p;
    if (h >= 1 && a >= 1) btts += p;
  }
  const pc = x => Math.round(x * 100);
  return { o15: pc(o15), u15: pc(1-o15), o25: pc(o25), u25: pc(1-o25), o35: pc(o35), u35: pc(1-o35), bttsY: pc(btts), bttsN: pc(1-btts) };
}

// v26.233: Asian Handicap model-kansen uit dezelfde Poisson + Dixon-Coles matrix als 1X2/goals.
// homeLine = handicap vanuit THUIS-perspectief (bv. -0.75). Kwartlijnen splitsen in twee halve lijnen (half win/verlies).
// Geeft PUSH-CONDITIONELE faire kansen: home = pWin/(pWin+pLoss) — direct vergelijkbaar met de 2-weg de-vigde markt.
// v26.249: optioneel t1x2 = {p1,pX,p2} (de SoS-gecorrigeerde 1X2 in %). Dan wordt de scorematrix zó herschaald
// dat haar marginalen (thuiswinst/gelijk/uit) EXACT die 1X2 zijn — zodat AH consistent is met de getoonde 1X2
// (bv. AH -0.5 == P(thuiswinst), DNB == P1/(P1+P2)). Zonder t1x2 = oud gedrag (rauwe Poisson).
function asianModelProbs(lambdaHome, lambdaAway, homeLine, maxGoals = 10, t1x2 = null) {
  if (!(lambdaHome > 0 && lambdaAway > 0) || !isFinite(homeLine)) return null;
  const grid = []; let tot = 0;
  for (let h = 0; h <= maxGoals; h++) for (let a = 0; a <= maxGoals; a++) {
    let p = poissonProb(lambdaHome, h) * poissonProb(lambdaAway, a);
    p *= dixonColesTau(h, a, lambdaHome, lambdaAway);
    grid.push([h, a, p]); tot += p;
  }
  if (tot <= 0) return null;
  // v26.249: herschaal de drie uitkomst-blokken naar de gecorrigeerde 1X2 (behoudt de marge-vorm binnen elk blok)
  if (t1x2 && t1x2.p1 > 0 && t1x2.pX > 0 && t1x2.p2 > 0) {
    let rawW = 0, rawD = 0, rawL = 0;
    for (const [h, a, p] of grid) { if (h > a) rawW += p; else if (h === a) rawD += p; else rawL += p; }
    if (rawW > 0 && rawD > 0 && rawL > 0) {
      const T = t1x2.p1 + t1x2.pX + t1x2.p2;
      const sW = (t1x2.p1 / T) / (rawW / tot), sD = (t1x2.pX / T) / (rawD / tot), sL = (t1x2.p2 / T) / (rawL / tot);
      tot = 0;
      for (const cell of grid) { const [h, a] = cell; cell[2] *= (h > a ? sW : h === a ? sD : sL); tot += cell[2]; }
    }
  }
  const q = Math.round(homeLine * 4);
  const comps = (q % 2 === 0) ? [homeLine] : [homeLine - 0.25, homeLine + 0.25];
  let pW = 0, pP = 0, pL = 0;
  for (const c of comps) for (const [h, a, p0] of grid) {
    const adj = (h - a) + c, p = p0 / tot;
    if (adj > 0.001) pW += p; else if (adj < -0.001) pL += p; else pP += p;
  }
  pW /= comps.length; pP /= comps.length; pL /= comps.length;
  if (pW + pL <= 0) return null;
  return { home: +(pW / (pW + pL) * 100).toFixed(1), away: +(pL / (pW + pL) * 100).toFixed(1), push: +(pP * 100).toFixed(1) };
}

// v26.246: deterministische ASIAN LINES-tabel voor de match-analyse (meerdere lijnen).
// Vergelijkt de push-conditionele modelkans (asianModelProbs, zelfde Poisson+DC) met de 2-weg
// de-vigde marktkans per lijn. Bij een 2-weg-lijn is away-value = -home-value, dus 1 value-getal
// per lijn volstaat. Puur informatief + eerlijk gelabeld als experimenteel/shadow (nog niet gevalideerd).
// v26.259: één bron voor de beste Asian-Handicap-EV. Wordt gebruikt door zowel de AH-tabel als de
// tipkaart, zodat die twee elkaar nooit kunnen tegenspreken. Rangschikt op EV met de échte odds
// (push-correct), alleen binnen de betrouwbaarheidsband (markt 20-80%).
function bestAsianEV(poisson, goalOdds, m) {
  try {
    const ah = goalOdds && goalOdds.ah;
    if (!ah || !poisson || !poisson.valid) return null;
    const lh = poisson.lambdaHome, la = poisson.lambdaAway;
    if (!(lh > 0 && la > 0)) return null;
    const lines = Object.keys(ah).map(parseFloat).filter(x => isFinite(x) && Math.abs(x) <= 2).sort((a, b) => a - b);
    if (!lines.length) return null;
    const sgn = x => (x > 0 ? '+' : '') + x;
    const t1x2 = (poisson.k1 > 0 && poisson.kX > 0 && poisson.k2 > 0) ? { p1: poisson.k1, pX: poisson.kX, p2: poisson.k2 } : null;
    const BAND_LO = 20, BAND_HI = 80;
    const _an = poisson.anchor || {};
    const tailOk = _an.applied ? true : (_an.coherent !== false);
    let best = null;
    for (const ln of lines) {
      const key = (Math.round(ln * 4) / 4).toFixed(2);
      const mk = ah[key]; if (!mk) continue;
      const mdl = asianModelProbs(lh, la, ln, 10, t1x2); if (!mdl) continue;
      const vH = +(mdl.home - mk.fairHome).toFixed(1);
      const pP = (mdl.push || 0) / 100;
      const pW = (mdl.home / 100) * (1 - pP), pL = (mdl.away / 100) * (1 - pP);
      const oH = mk.home, oA = mk.away;
      let ev = null;
      if (vH >= 0 && oH > 1) ev = (pW * (oH - 1) - pL) * 100;
      else if (vH < 0 && oA > 1) ev = (pL * (oA - 1) - pW) * 100;
      const inBand = mk.fairHome >= BAND_LO && mk.fairHome <= BAND_HI;
      if (inBand && ev != null && (!best || ev > best.ev)) {
        best = { ev, txt: `${vH >= 0 ? m.home : m.away} ${vH >= 0 ? sgn(ln) : sgn(-ln)}`, odds: vH >= 0 ? oH : oA, pp: Math.abs(vH), line: ln };
      }
    }
    return best ? { ...best, tailOk } : null;
  } catch (e) { return null; }
}

function buildAsianLinesHtml(poisson, goalOdds, m) {
  try {
    const ah = goalOdds && goalOdds.ah;
    // v26.310: NIET MEER STIL VERDWIJNEN. Geen AH-lijnen kan drie dingen betekenen: de odds-call is
    // geweigerd (technisch), de bookmakers posten geen AH voor dit duel, of er is geen model. Voorheen
    // gaven alle drie `return ''` -- een lege plek waar de gebruiker geen enkele verklaring voor had, en
    // die niet te onderscheiden was van 'deze markt bestaat niet'. Alleen de eerste is een fout van ons.
    const _mono = "font-family:'IBM Plex Mono',monospace;";
    const _melding = (tekst) => `<div style="margin-top:.6rem;padding-top:.5rem;border-top:1px solid rgba(255,255,255,.09);${_mono}font-size:.55rem;color:rgba(255,255,255,.5);line-height:1.6;">\u2696\ufe0f ASIAN LINES<br>${tekst}</div>`;
    // v26.311: goalOdds === null betekent ONBEKEND, niet 'geen odds'. fetchGoalOdds doet 3 calls met elk
    // een apifFetch-retryketen (~6,5s) PLUS een eigen retry-ronde -> tot ~16s, tegen een wt-venster van
    // 11s in analyse.js -> wt geeft null -> er is geen _faalde-object meer om op te kijken, en de tak
    // hieronder beweerde vrolijk 'geen AH gepost'. Gemeten op fixture 1586077 op het moment dat de app dat
    // toonde: bet=4 gaf 11 bookmakers, 20 lijnen, 169/170 values door de parser. De bewering was onwaar.
    // Exact dezelfde fout als v26.309 bij de statistics (retryketen buiten het eigen venster) en dezelfde
    // les: de bugfamilie zit in het PATROON rond elke fetch, niet in een veld. Daarom is de rate-limit-
    // teller uit api.js hier het vangnet: alleen 'niet gepost' zeggen als de call aantoonbaar slaagde.
    const _d = (typeof apifDiagGet === 'function') ? apifDiagGet() : { rateLimited: 0 };
    const _ahGeweigerd = (goalOdds && goalOdds._faalde && goalOdds._faalde.ah) || !goalOdds || _d.rateLimited > 0;
    if (!ah && _ahGeweigerd) {
      return _melding('De handicap-odds konden niet worden opgehaald (API-limiet of trage respons). Dit zegt niets over deze wedstrijd \u2014 de markt bestaat wel. Tik op \u201cNieuwe analyse\u201d om het opnieuw te proberen.');
    }
    if (!ah && poisson && poisson.valid) {
      return _melding('Geen Asian-Handicap-odds gepost voor deze wedstrijd.');
    }
    if (!ah || !poisson || !poisson.valid) return '';
    const lh = poisson.lambdaHome, la = poisson.lambdaAway;
    if (!(lh > 0 && la > 0)) return '';
    const lines = Object.keys(ah).map(parseFloat).filter(x => isFinite(x) && Math.abs(x) <= 2).sort((a, b) => a - b);
    if (!lines.length) return '';
    const mono = "font-family:'IBM Plex Mono',monospace;";
    const sgn = x => (x > 0 ? '+' : '') + x;
    // v26.249: AH-model afgeleid van de SoS-gecorrigeerde 1X2 (poisson.k1/kX/k2) via matrix-herschaling.
    const t1x2 = (poisson.k1 > 0 && poisson.kX > 0 && poisson.k2 > 0) ? { p1: poisson.k1, pX: poisson.kX, p2: poisson.k2 } : null;
    // v26.250: rangschik op EV (met echte odds, push-correct), NIET op procentpunten. Het model-markt-verschil
    // in pp groeit automatisch naarmate de lijn verder van de money-line ligt (staart-aanname van het Poisson),
    // dus pp-ranking wijst systematisch naar de extreemste, minst betrouwbare lijn. Bovendien negeert pp de odds.
    // De headline kijkt alleen naar lijnen binnen een betrouwbaarheidsband (markt 20-80%).
    const BAND_LO = 20, BAND_HI = 80;
    // v26.250: STAART-COHERENTIE. De AH-lijnen buiten de money-line hangen volledig aan de doelpuntenmarge-
    // verdeling van het model. Die is alleen geloofwaardig als het model hetzelfde doelpuntentotaal verwacht
    // als de markt. Leid het markt-impliciete totaal af uit de de-vigde Over 2.5 en vergelijk. Wijkt het
    // materieel af, dan is elke "EV" op niet-money-lijnen een artefact van de staart -> geen advies tonen.
    // v26.253: één bron voor de coherentie — poisson.anchor (gezet door anchorLambdasToMarket).
    // Staat het anker aan, dan zijn de lambda's al naar het markt-totaal getrokken en is de staart per
    // constructie coherent; staat het uit, dan blijft dit de eerlijke "geen EV-advies"-rem.
    const _an = poisson.anchor || {}; // gezet in de analyse-flow, vóór deze render
    const modelTot = lh + la;             // reeds geankerd als het anker aanstond
    const mktTot = (_an.mktTot != null) ? _an.mktTot : null;
    const tailOk = _an.applied ? true : (_an.coherent !== false);
    let rows = '';
    const best = bestAsianEV(poisson, goalOdds, m); // v26.259: één bron, tabel en tipkaart kunnen niet uiteenlopen
    for (const ln of lines) {
      const key = (Math.round(ln * 4) / 4).toFixed(2);
      const mk = ah[key]; if (!mk) continue;
      const mdl = asianModelProbs(lh, la, ln, 10, t1x2); if (!mdl) continue;
      const mH = mdl.home, mA = mdl.away;
      const vH = +(mH - mk.fairHome).toFixed(1);            // home-side value in pp; away = -vH
      const absV = Math.abs(vH);
      const side = vH >= 0 ? m.home : m.away;
      const sideLn = vH >= 0 ? sgn(ln) : sgn(-ln);
      // EV op de kant met value, met de echte odds en correcte push-afhandeling
      const pP = (mdl.push || 0) / 100;
      const pW = (mH / 100) * (1 - pP), pL = (mA / 100) * (1 - pP);
      const oH = mk.home, oA = mk.away;
      let ev = null;
      if (vH >= 0 && oH > 1) ev = (pW * (oH - 1) - pL) * 100;
      else if (vH < 0 && oA > 1) ev = (pL * (oA - 1) - pW) * 100;
      const inBand = mk.fairHome >= BAND_LO && mk.fairHome <= BAND_HI;
      // (best komt uit bestAsianEV — zie onder de lus; hier alleen de rijen renderen)
      const col = !inBand ? 'rgba(255,255,255,.35)' : (absV >= 3 ? '#16c784' : (absV >= 1 ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.5)'));
      const tail = inBand ? '' : `<span title="staartlijn" style="color:rgba(255,190,80,.75);font-size:.42rem;"> ⚠</span>`;
      rows += `<div style="display:grid;grid-template-columns:1fr 1.15fr 1.15fr 1.25fr;gap:.2rem;padding:.34rem .1rem;border-top:1px solid rgba(255,255,255,.06);${mono}font-size:.52rem;align-items:center;">
        <span style="color:${inBand ? '#fff' : 'rgba(255,255,255,.45)'};">${sgn(ln)}${tail}</span>
        <span style="color:rgba(255,255,255,${inBand ? '.72' : '.4'});">${mH}/${mA}</span>
        <span style="color:rgba(255,255,255,${inBand ? '.5' : '.32'});">${mk.fairHome}/${mk.fairAway}</span>
        <span style="color:${col};font-weight:700;text-align:right;">${vH >= 0 ? '▲' : '▼'} ${absV}pp</span>
      </div>`;
    }
    if (!rows) return '';
    return `<div class="analyse-block" style="padding:0;overflow:hidden;margin:.6rem 0;">
      <div style="padding:.85rem 1rem .45rem;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.2rem;color:#fff;letter-spacing:.05em;">⚖️ ASIAN LINES</div>
        <div style="${mono}font-size:.46rem;color:rgba(255,190,80,.92);margin-top:.15rem;">experimenteel · model vs. de-vigde markt · nog in validatie (shadow)</div>
      </div>
      <div style="padding:0 1rem .2rem;">
        <div style="display:grid;grid-template-columns:1fr 1.15fr 1.15fr 1.25fr;gap:.2rem;${mono}font-size:.42rem;color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:.03em;padding:0 .1rem .15rem;">
          <span>Lijn</span><span>Model H/U</span><span>Markt H/U</span><span style="text-align:right;">Value</span>
        </div>
        ${rows}
      </div>
      <div style="padding:.45rem 1rem .85rem;${mono}font-size:.5rem;color:rgba(255,255,255,.72);">
        ${best && best.ev > 0
          ? `Beste EV: <span style="color:${tailOk ? '#00BEC4' : 'rgba(0,190,196,.65)'};font-weight:700;">${best.txt} @${best.odds}</span> <span style="color:${tailOk ? '#16c784' : 'rgba(22,199,132,.65)'};font-weight:700;">${best.ev >= 0 ? '+' : ''}${best.ev.toFixed(1)}%</span>${
              tailOk ? '' : ` <span style="color:rgba(255,190,80,.9);font-weight:700;">\u26a0 lage betrouwbaarheid</span>`}`
          : `<span style="color:rgba(255,255,255,.6);">Geen positieve EV binnen de betrouwbare lijnen</span>`}
        ${tailOk ? '' : `<div style="margin-top:.28rem;color:rgba(255,190,80,.7);line-height:1.5;">Doelpuntentotaal wijkt af: model ${modelTot.toFixed(2)}, markt ${mktTot.toFixed(2)}. Deze EV leunt deels op de doelpuntenmarge-aanname, niet puur op een edge.</div>`}
        <div style="color:rgba(255,255,255,.4);margin-top:.3rem;line-height:1.55;">Lijn vanuit thuisploeg · ▲ value op thuis, ▼ op uit · EV is gerangschikt met de échte odds (push meegerekend), niet met procentpunten.<br>⚠ = staartlijn (markt buiten 20–80%): daar meet je vooral de aanname van het model over de doelpuntenmarge, niet een echte edge. Buiten beschouwing gelaten voor de EV-keuze.</div>
      </div>
    </div>`;
  } catch(e) { return ''; }
}

// v26.147: O/U + BTTS markt-odds per wedstrijd (via worker-proxy), consensus + 2-weg Shin de-vig.
// Geeft { ou: { '2.5': {over,under,fairOver,fairUnder}, ... }, btts: {yes,no,fairYes,fairNo} } of null.
async function fetchGoalOdds(fixtureId, _retry = 0) {
  try {
    // v26.288: het volledige /odds-blok is ~232KB (150+ markten) en haalt op mobiel vaak de timeout niet
    // -> stille "geen O/U-odds beschikbaar" terwijl de odds er wel zijn. Nu 3 gefilterde, piepkleine calls
    // (bet 4=Asian Handicap, 5=Goals Over/Under, 8=Both Teams Score); de parse-loop hieronder blijft gelijk.
    // v26.310: EEN GEWEIGERDE ODDS-CALL IS GEEN 'GEEN ODDS'. Voorheen gaf fetchBet bij zowel een
    // rate-limit als bij een fixture zonder odds een lege array -- niet te onderscheiden. Gevolg: faalt
    // alleen bet=4 (Asian Handicap) en slaagt bet=5, dan is `books` niet leeg (dus geen retry), maar
    // ahRaw blijft leeg en buildAsianLinesHtml doet `return ''` -> de ASIAN LINES-sectie verdween ZONDER
    // ENIGE MELDING. Dat is precies wat Rob meldde ('geen Asian lines'), en de stilste variant van deze
    // bugfamilie: bij vorm/H2H stond tenminste nog een (onware) zin, hier stond niets.
    const fetchBet = async (bet) => {
      try {
        const rr = await apiFetch(`https://v3.football.api-sports.io/odds?fixture=${fixtureId}&bet=${bet}`, null, 8000);
        const dd = await rr.json();
        if (dd && dd.errors && dd.errors.rateLimit) return { books: [], faalde: true };
        return { books: (dd && dd.response && dd.response[0] && dd.response[0].bookmakers) || [], faalde: false };
      } catch (e) { return { books: [], faalde: true }; }
    };
    const [r4, r5, r8] = await Promise.all([fetchBet(4), fetchBet(5), fetchBet(8)]);
    const b4 = r4.books, b5 = r5.books, b8 = r8.books;
    const _faalde = { ah: r4.faalde, ou: r5.faalde, btts: r8.faalde };
    const books = [...b4, ...b5, ...b8];
    // 1 nette retry bij lege respons — voorkomt dat een tijdelijke hapering stil de sectie wist.
    // v26.311: alleen opnieuw proberen bij een ECHT lege respons. Is de call geweigerd, dan heeft
    // apiFetch al 3x geretryd met backoff; nog een ronde kost ~8s extra en duwt fetchGoalOdds juist
    // over het wt-venster van 11s heen -> null -> geen diagnose meer. Retry die de fout verergert.
    const _ietsGeweigerd = _faalde.ah || _faalde.ou || _faalde.btts;
    if (!books.length) { if (!_ietsGeweigerd && _retry < 1) { await new Promise(r => setTimeout(r, 400)); return fetchGoalOdds(fixtureId, _retry + 1); } return null; }
    const med = arr => { const s = arr.filter(x => x > 1).sort((a, b) => a - b); if (!s.length) return 0; const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m-1] + s[m]) / 2; };
    const ouRaw = { '1.5': { O: [], U: [] }, '2.5': { O: [], U: [] }, '3.5': { O: [], U: [] } };
    const bttsRaw = { Y: [], N: [] };
    const ahRaw = {}; // v26.233: Asian Handicap (bet 4), genormaliseerd naar THUIS-handicap
    const ahKey = ln => (Math.round(ln * 4) / 4).toFixed(2);
    for (const bm of books) for (const bet of (bm.bets || [])) {
      if (bet.id === 5) {
        for (const v of (bet.values || [])) { const mt = /^(Over|Under)\s+(\d+\.\d)$/.exec(v.value || ''); if (mt && ouRaw[mt[2]]) { const o = parseFloat(v.odd || 0); if (o > 1) ouRaw[mt[2]][mt[1] === 'Over' ? 'O' : 'U'].push(o); } }
      } else if (bet.id === 8) {
        for (const v of (bet.values || [])) { const o = parseFloat(v.odd || 0); if (o > 1) { if (/^yes$/i.test(v.value)) bttsRaw.Y.push(o); else if (/^no$/i.test(v.value)) bttsRaw.N.push(o); } }
      } else if (bet.id === 4) {
        // v26.233: Asian Handicap — "Home -1" / "Away +1" zijn twee kanten van dezelfde lijn (thuis-handicap -1)
        for (const v of (bet.values || [])) {
          const mt = /^(Home|Away)\s*([+-]?\d+(?:\.\d+)?)$/.exec(v.value || '');
          if (!mt) continue;
          const o = parseFloat(v.odd || 0); if (!(o > 1)) continue;
          const raw = parseFloat(mt[2]);
          // v26.247: API-Football geeft de AH-lijn ALTIJD vanuit thuis-perspectief; "Away +1.5" is de
          // uit-kant van thuis-handicap +1.5 (niet -1.5). Home én Away met dezelfde waarde vormen het
          // complementaire paar — dus NIET het teken van de away-lijn negeren (dat was de inversie-bug).
          const k = ahKey(raw);
          if (!ahRaw[k]) ahRaw[k] = { H: [], A: [] };
          ahRaw[k][mt[1] === 'Home' ? 'H' : 'A'].push(o);
        }
      }
    }
    const ou = {};
    for (const line of ['1.5', '2.5', '3.5']) { const O = med(ouRaw[line].O), U = med(ouRaw[line].U); if (O > 1 && U > 1) { const [fo, fu] = shinDevig([O, U]); ou[line] = { over: +O.toFixed(2), under: +U.toFixed(2), fairOver: +(fo*100).toFixed(1), fairUnder: +(fu*100).toFixed(1) }; } }
    let btts = null; const Y = med(bttsRaw.Y), N = med(bttsRaw.N); if (Y > 1 && N > 1) { const [fy, fn] = shinDevig([Y, N]); btts = { yes: +Y.toFixed(2), no: +N.toFixed(2), fairYes: +(fy*100).toFixed(1), fairNo: +(fn*100).toFixed(1) }; }
    const ah = {};
    for (const k of Object.keys(ahRaw)) {
      const Hm = med(ahRaw[k].H), Am = med(ahRaw[k].A);
      if (Hm > 1 && Am > 1) { const [fh, fa] = shinDevig([Hm, Am]); ah[k] = { home: +Hm.toFixed(2), away: +Am.toFixed(2), fairHome: +(fh*100).toFixed(1), fairAway: +(fa*100).toFixed(1) }; }
    }
    const hasAh = Object.keys(ah).length > 0;
    if (!Object.keys(ou).length && !btts && !hasAh) return null;
    return { ou, btts, ah: hasAh ? ah : null, _faalde };
  } catch (e) {
    if (_retry < 1) { await new Promise(r => setTimeout(r, 400)); return fetchGoalOdds(fixtureId, _retry + 1); }
    return null;
  }
}

function extractTeamGoalStats(stats, recentFixtures = null, fixtureXgData = null, teamId = null) {
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
  // v26.257: sample-size per split — de home-sterkte steunt alleen op thuiswedstrijden, de away-sterkte
  // alleen op uitwedstrijden. Zonder dat kun je niet regulariseren met de juiste n.
  const playedHome = stats.fixtures?.played?.home || null;
  const playedAway = stats.fixtures?.played?.away || null;
  let base = {
    // v26.260: `parseFloat(x) || null` maakte van een echte 0.0 een null, want 0 is falsy in JS. Een team
    // dat nul tegendoelpunten toeliet viel daardoor terug op het competitiegemiddelde: Spain hield thuis
    // de nul in alle 3 duels en werd als PRECIES GEMIDDELD verdedigend gemodelleerd (1.40) — vandaar
    // Belgium 47% waar de markt 17% zegt. Zelfde bugfamilie als `!data.errors` op een lege array en
    // `Array.isArray` op een object: een falsy waarde die inhoudelijk betekenisvol is.
    avgScoredHome:  _num(gf.home),
    avgScoredAway:  _num(gf.away),
    avgScoredTotal: _num(gf.total),
    avgConcHome:    _num(ga.home),
    avgConcAway:    _num(ga.away),
    avgConcTotal:   _num(ga.total),
    xgFor,
    xgAgainst,
    gamesPlayed,
    playedHome,
    playedAway,
  };
  // v26.261: BUGFIX. Dit las `f.goals.for` / `f.goals.against`, maar API-Football levert
  // `f.goals = { home, away }`. Beide velden waren dus ALTIJD undefined -> `|| 0` -> recentGF=0, recentGA=0.
  // Met RW=0.55 werd elke teamsterkte daardoor met 0.45 vermenigvuldigd: het model verwachtte 1.36 goals
  // waar de markt 2.58 inprijst. De "recente vorm"-weging heeft dus nooit vorm gemeten, alleen gedempt.
  // Per fixture moet je weten of het team thuis of uit stond; vandaar de nieuwe teamId-parameter.
  const _played = (recentFixtures || []).filter(f => {
    const st = f.fixture?.status?.short;
    return (st === 'FT' || st === 'AET' || st === 'PEN') && f.goals && f.goals.home != null && f.goals.away != null;
  });
  const _gf = f => (teamId && f.teams?.away?.id === teamId) ? f.goals.away : f.goals.home;
  const _ga = f => (teamId && f.teams?.away?.id === teamId) ? f.goals.home : f.goals.away;
  if (teamId && _played.length >= 3) {
    const last5 = _played.slice(-5);
    const last3 = _played.slice(-3);
    // Weeg laatste 3 wedstrijden zwaarder dan laatste 5
    const recentGF5 = last5.reduce((s,f) => s + _gf(f), 0) / last5.length;
    const recentGA5 = last5.reduce((s,f) => s + _ga(f), 0) / last5.length;
    const recentGF3 = last3.reduce((s,f) => s + _gf(f), 0) / last3.length;
    const recentGA3 = last3.reduce((s,f) => s + _ga(f), 0) / last3.length;
    // Gewogen recente vorm: 60% laatste 3, 40% laatste 5
    const recentGF = 0.60 * recentGF3 + 0.40 * recentGF5;
    const recentGA = 0.60 * recentGA3 + 0.40 * recentGA5;
    // Verhoogde vormweging: 55% recent, 45% seizoen (was 40/60)
    const RW = 0.55, SW = 0.45;
    // v26.261: `!= null` i.p.v. truthy — een gemeten 0 is data (zelfde bugfamilie als v26.260)
    if (base.avgScoredTotal != null) base.avgScoredTotal = SW * base.avgScoredTotal + RW * recentGF;
    if (base.avgConcTotal   != null) base.avgConcTotal   = SW * base.avgConcTotal   + RW * recentGA;
    if (base.avgScoredHome  != null) base.avgScoredHome  = SW * base.avgScoredHome  + RW * recentGF;
    if (base.avgScoredAway  != null) base.avgScoredAway  = SW * base.avgScoredAway  + RW * recentGF;
    if (base.avgConcHome    != null) base.avgConcHome    = SW * base.avgConcHome    + RW * recentGA;
    if (base.avgConcAway    != null) base.avgConcAway    = SW * base.avgConcAway    + RW * recentGA;
    base.recentFormUsed = true;
    base.recentGF = parseFloat(recentGF.toFixed(2));
    base.recentGA = parseFloat(recentGA.toFixed(2));
  }
  return base;
}

// v26.260: 0 behouden, alleen echt ontbrekende/ongeldige waarden worden null.
function _num(v) { const x = parseFloat(v); return Number.isFinite(x) ? x : null; }
// eerste niet-null uit een reeks fallbacks (0 telt dus gewoon mee)
function _firstNum(...vals) { for (const v of vals) if (v != null && Number.isFinite(v)) return v; return null; }
// een sterkte van exact 0 mag lambda niet naar nul sturen (dan valt het hele model om)
const MIN_STRENGTH = 0.10;

// ═══ v26.257: REGULARISATIE VAN DE TEAMSTERKTES (empirical-Bayes shrinkage) ═══════════════════
// Het model schat lambda uit `aanval x verdediging / leagueAvg`. Op 5 wedstrijden zijn die ratio's
// extreem: Morocco liet uit 0.5 goals toe -> lambda_away 0.50 -> 9% winstkans waar de markt 16% zegt.
// Diezelfde onderschatting duwt het doelpuntentotaal omlaag, waarna de vloer (1.9 -> 2.1) het weer
// kunstmatig optilt: 1X2 komt dan uit de rauwe lambda's, de goal-markten uit de opgetilde. Twee modellen
// in één analyse.
// De fix is niet corrigeren maar minder overtuigd zijn: trek elke sterkte-ratio naar 1.0 met gewicht
// n/(n+K), waarbij K het aantal "pseudo-wedstrijden" van gemiddeldheid is. Bij n -> oneindig verdwijnt
// het effect vanzelf, dus dit is zelf-uitschakelend zodra clubdata rijpt.
// DORMANT: K = 0 -> geen shrinkage, lambda's byte-identiek.
// Test op één toestel: localStorage.setItem('pmx_shrink_k','8')
// Aanval en defensie zijn niet even ruizig. Op 3-5 wedstrijden zijn aanvalsgemiddelden nog plausibel
// (2.14x gemiddeld), maar defensiegemiddelden ontsporen (0.21x = "laat 5x minder toe dan gemiddeld").
// Daarom twee aparte K's. Grid-search op 4 WK-duels gaf Ka~5, Kd~3; dat is te weinig data om vast te
// zetten, dus beide staan op 0 tot er clubdata is.
// v26.258: AAN. Niet omdat de grid-search dat zegt (4 wedstrijden = geen validatie), maar omdat de
// leagueAvg-bugfix uit v26.257 twee duels van "geen model" naar "kapot model" bracht: Norway-England
// toonde 6.50 verwachte goals en gaf England 79% waar de markt 52% zegt. Regularisatie bij n=3-5 duels
// is standaardpraktijk, geen gefit trucje. De K-WAARDEN zijn wel gefit, dus bewust de rand van het
// plateau (Ka=5/Kd=3, MAE 7.18) i.p.v. het optimum (Ka=8/Kd=3, MAE 6.29).
// Raakt geen picks: de worker berekent zijn eigen kansen en gebruikt calcPoissonKansen niet.
// Hertunen op clubdata na 20 juli; n/(n+K) dooft zichzelf uit naarmate het seizoen vordert.
const STRENGTH_SHRINK_K_ATT_DEFAULT = 5;
const STRENGTH_SHRINK_K_DEF_DEFAULT = 3;
function _lsNum(key, dflt) {
  try {
    const v = parseFloat(localStorage.getItem(key));
    if (isFinite(v) && v >= 0 && v <= 40) return v;
  } catch (e) {}
  return dflt;
}
function getStrengthShrinkKAtt() { return _lsNum('pmx_shrink_k_att', STRENGTH_SHRINK_K_ATT_DEFAULT); }
function getStrengthShrinkKDef() { return _lsNum('pmx_shrink_k_def', STRENGTH_SHRINK_K_DEF_DEFAULT); }

// Trekt een absoluut goals-gemiddelde naar het competitiegemiddelde, gewogen naar sample-size.
function shrinkStrength(val, n, leagueAvg, K) {
  if (!(K > 0) || !(n > 0) || !(val >= 0) || !(leagueAvg > 0)) return val; // v26.260: val === 0 is geldig en moet juist geshrunkt worden
  const ratio = val / leagueAvg;
  const shrunk = (n * ratio + K * 1.0) / (n + K);
  return shrunk * leagueAvg;
}

function calcPoissonKansen(homeStats, awayStats, leagueAvgOrId = 1.35, homeInjFactor = null, awayInjFactor = null) {
  // v26.257: BUGFIX. De oude check was `typeof === 'number' && < 10` om een gemiddelde van een league-ID
  // te onderscheiden. Maar ALLE toernooi-IDs zijn eencijferig: 1=WK, 2=Champions League, 3=Europa League,
  // 4=EK, 5=Nations League, 6=Afrika Cup, 9=Copa America. Die werden dus als doelpuntgemiddelde gebruikt:
  // het WK deelde door 1.0 i.p.v. 1.40, Copa America door 9.0. LEAGUE_AVG_GOALS bevat expliciet `1: 1.40`
  // en `2: 1.45` — die regels waren onbereikbaar. Gevolg (gemeten op 4 WK-duels): lambda's tot 6.94,
  // Norway-England kwam uit op 9.10 verwachte goals, en 2 van de 4 wedstrijden vielen buiten het geldige
  // bereik -> valid:false -> "model n.v.t.". League-ID's zijn altijd gehele getallen, gemiddeldes niet.
  const leagueAvg = (typeof leagueAvgOrId === 'number' && !Number.isInteger(leagueAvgOrId))
    ? leagueAvgOrId
    : getLeagueAvg(leagueAvgOrId);
  if (!homeStats || !awayStats) return { k1:null, kX:null, k2:null, valid:false };
  // v26.260: _firstNum i.p.v. `||` — een gemeten 0 is data, geen ontbrekende waarde.
  let homeAttackBase  = _firstNum(homeStats.avgScoredHome, homeStats.avgScoredTotal, leagueAvg);
  let awayDefenceBase = _firstNum(awayStats.avgConcAway,   awayStats.avgConcTotal,   leagueAvg);
  let awayAttackBase  = _firstNum(awayStats.avgScoredAway, awayStats.avgScoredTotal, leagueAvg);
  let homeDefenceBase = _firstNum(homeStats.avgConcHome,   homeStats.avgConcTotal,   leagueAvg);
  if (homeStats.xgFor && homeStats.xgFor > 0)
    homeAttackBase  = homeAttackBase  * 0.6 + (homeStats.xgFor  / Math.max(homeStats.gamesPlayed||20,10)) * 0.4;
  if (awayStats.xgFor && awayStats.xgFor > 0)
    awayAttackBase  = awayAttackBase  * 0.6 + (awayStats.xgFor  / Math.max(awayStats.gamesPlayed||20,10)) * 0.4;
  if (homeStats.xgAgainst && homeStats.xgAgainst > 0)
    homeDefenceBase = homeDefenceBase * 0.6 + (homeStats.xgAgainst / Math.max(homeStats.gamesPlayed||20,10)) * 0.4;
  if (awayStats.xgAgainst && awayStats.xgAgainst > 0)
    awayDefenceBase = awayDefenceBase * 0.6 + (awayStats.xgAgainst / Math.max(awayStats.gamesPlayed||20,10)) * 0.4;
  // v26.257: regulariseer de vier sterktes met de sample-size van hún eigen split.
  const _Ka = getStrengthShrinkKAtt(), _Kd = getStrengthShrinkKDef();
  const _nH = _firstNum(homeStats.playedHome, homeStats.gamesPlayed, 0); // v26.300: _firstNum i.p.v. `||` — 0 gespeelde thuisduels is data (n=0 -> volledige shrink naar leagueAvg), geen ontbrekende waarde
  const _nA = _firstNum(awayStats.playedAway, awayStats.gamesPlayed, 0); // v26.300: idem uit-split
  if (_Ka > 0 || _Kd > 0) {
    homeAttackBase  = shrinkStrength(homeAttackBase,  _nH, leagueAvg, _Ka);
    homeDefenceBase = shrinkStrength(homeDefenceBase, _nH, leagueAvg, _Kd);
    awayAttackBase  = shrinkStrength(awayAttackBase,  _nA, leagueAvg, _Ka);
    awayDefenceBase = shrinkStrength(awayDefenceBase, _nA, leagueAvg, _Kd);
  }
  // v26.260: vangnet. Met regularisatie wordt een gemeten 0 naar het gemiddelde getrokken en is dit dood
  // hout; met de noodrem (K=0) zou een echte 0 anders lambda op 0 zetten -> valid:false -> geen model.
  homeAttackBase  = Math.max(MIN_STRENGTH, homeAttackBase);
  homeDefenceBase = Math.max(MIN_STRENGTH, homeDefenceBase);
  awayAttackBase  = Math.max(MIN_STRENGTH, awayAttackBase);
  awayDefenceBase = Math.max(MIN_STRENGTH, awayDefenceBase);

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
    shrunk: (_Ka > 0 || _Kd > 0), // v26.257: gezet als de sterktes geregulariseerd zijn -> de totaal-vloer mag uit
    shrinkK: { att: _Ka, def: _Kd },
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

// v26.31: Shin de-vig — corrigeert favorite-longshot bias (underdog-prijs draagt relatief meer marge).
// Geeft ware kansen (0-1) terug; valt terug op proportioneel als er nauwelijks marge is.
function shinDevig(oddsArr) {
  const b = oddsArr.map(o => (o > 1 ? 1 / o : 0));
  const B = b.reduce((s, x) => s + x, 0);
  if (B <= 1.0001) return b.map(x => x / (B || 1));
  const probs = (z) => b.map(bi => (Math.sqrt(z * z + 4 * (1 - z) * bi * bi / B) - z) / (2 * (1 - z)));
  let lo = 0, hi = 0.5;
  for (let i = 0; i < 60; i++) {
    const z = (lo + hi) / 2;
    const sum = probs(z).reduce((s, x) => s + x, 0);
    if (sum > 1) lo = z; else hi = z;
  }
  return probs((lo + hi) / 2);
}

// Value berekening met overround correctie
// Vergelijkt AI kans met faire implied kans (niet raw bookmaker kans)
// v26.123: value-hardening in de frontend (mirror van worker v157) — anders tonen de
// in-app VALUE SCAN en BESTE VALUE PICK nog ruwe AI-edges (favorite-longshot-bias).
const FE_MARKET_SHRINK = 0.55; // model 55% richting faire markt getrokken vóór de edge
const FE_LONGSHOT_ODDS = 3.5;  // odds >= dit = longshot: niet als value-pick tonen

function calcValueFair(aiKans, odds, homeOdds, drawOdds, awayOdds) {
  if (!aiKans || !odds || odds <= 1) return null;
  const h = parseFloat(homeOdds), d = parseFloat(drawOdds), a = parseFloat(awayOdds);
  if (!h || !d || !a || h <= 1 || d <= 1 || a <= 1) return calcValue(aiKans, odds);
  // v26.31: Shin de-vig (corrigeert favorite-longshot bias) i.p.v. proportioneel
  const fair = shinDevig([h, d, a]); // [pH, pD, pA] in 0-1
  let p = null, best = Infinity;
  [[h, fair[0]], [d, fair[1]], [a, fair[2]]].forEach(([o, pr]) => {
    const diff = Math.abs(o - odds); if (diff < best) { best = diff; p = pr; }
  });
  if (p == null) return calcValue(aiKans, odds);
  const fairImplied = p * 100;
  // v26.123: shrinkage naar markt-prior zodat AI-ruis geen value op longshots maakt
  const w = (typeof FE_MARKET_SHRINK === 'number') ? FE_MARKET_SHRINK : 0;
  const modelProb = w * fairImplied + (1 - w) * aiKans;
  return parseFloat((modelProb - fairImplied).toFixed(2));
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

// v26.23: marktsignaal 0-100 (50 = neutraal) uit odds-beweging, voor de gewogen pick-uitleg.
// market.direction = uitslag waarvan de odds het sterkst korter werden (geld erin); isSteam = scherpe daling.
function marketSignalFromMarket(market, pick) {
  if (!market || !market.direction || market.direction === 'none') return 50;
  const mag = Math.min(20, Math.abs(market.pct || 0));
  if (market.direction === pick) {
    return Math.round(Math.min(95, 50 + mag * 1.6 + (market.isSteam ? 10 : 0))); // markt steunt onze pick
  }
  return Math.round(Math.max(10, 50 - mag * 1.3)); // geld ging naar andere uitslag = tegen onze pick
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
