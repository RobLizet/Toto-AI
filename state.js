// ═══════════════════════════════════════════════════════
// STATE.JS — Centraal state object + persistence
// v53: v26.37 — combi-tips uit scan-engine picks (consistent met scan-log, geen losse Claude-selectie)
// ═══════════════════════════════════════════════════════

const APP_VERSION = 'v26.278'; // v26.278: registratie-hook -> POST /register-notify bij login/registratie (nieuwe gebruiker -> Supabase app_users + admin-only push); admin.html gebruikerslijst. // v26.277: TRACKER-P&L HALF VERLIES/PUSH. De v26.276-fix zat alleen in de wallet-lijst; de Tracker-tab (state.tracker.bets) rekende op DRIE plekken nog naief -stake bij elke 'lose' (renderTracker, updateTrackerStats, detail-popup) EN checkTrackerBet schreef de payout alleen bij winst weg -> een half verlies (bv. Under 2.5/3.0 bij 3 goals: Under2.5 verliest, Under3.0 pusht) verscheen als -10 i.p.v. -5. Nu overal pmxProfit/pmxIsPush + payout=werkelijke terugbetaling, plus eenmalige migratie pmxFixTrackerPayouts() die oude bruto-payouts lokaal herberekent uit b.score. Tevens: jaar-robuuste fixture-matcher (screenshot-import gokte 2025 i.p.v. 2026 -> bet bleef eeuwig OPEN; +-2 dagen ving geen jaar-fout, nu ook zelfde dag/maand in huidig/vorig jaar). Settle-kern DRY in pmxSettleFromScore (geen drift tussen live-settle en migratie). // v26.276: TRACKER BOEKTE HALF VERLIES ALS WINST. settleAsianPick() bepaalde de status met `payout > 0 ? 'win' : 'lose'`, terwijl een kwartlijn ook payout = halve inzet (half verlies) en payout = inzet (push) kan geven. Concreet: 10 euro op Under 2.75 met precies 3 doelpunten -> payout 5 -> status 'win', en de rij toonde '+EUR -5.00' omdat de P&L als payout-amount werd gerenderd. Pushes telden als overwinning in de hitrate. Nu vergelijkt de status payout met de INZET (win / push / lose), is er een nieuwe status 'push' die buiten de hitrate valt, en loopt elke P&L en grafiek via pmxProfit(b) = payout - inzet. De units-grafiek rekende `win ? odds-1 : -1` en boekte een half verlies dus als -1 unit; nu profit/inzet. Raakt de backend-picks NIET (die kennen geen kwartlijnen). Daarnaast: het label 'Jacks' vervangen door 'bookmaker' in de UI, en bestaande rijen worden via pmxBookmaker() ook zo getoond. // v26.275: 'Nieuwe analyse' deed zichtbaar niets, ook nadat de knop correct in de bundel stond (topniveau-functie, klassieke script-tag, cache-bust op wedstrijden.js, geen CSP). Ik kon de oorzaak niet met zekerheid vaststellen, dus verwijder ik de aanname i.p.v. hem te omzeilen: knoppen worden nu via addEventListener aan het element gekoppeld in plaats van via een inline onclick, waarmee de afhankelijkheid van de globale scope vervalt. Bovendien wordt elke fout in de handler ZICHTBAAR gemaakt in de modal (rode banner) i.p.v. stil in de console te belanden -- dat was de reden dat 'doet niets' niet te diagnosticeren was. Zelfde behandeling voor de meldknop. // v26.274: zichtbare terugkoppeling op 'Nieuwe analyse'. Na v26.273 herbouwt de knop de modal niet meer, maar daardoor gebeurde er ook visueel niets: de secties gaan leeg en de LLM doet er enkele seconden over. Nu wordt de knop uitgeschakeld met spinner-tekst, verschijnt er een banner bovenin de modal, worden dubbelklikken genegeerd (_pmxRerunBezig), en toont de banner bij een fout de foutmelding i.p.v. stil te verdwijnen. runAnalyse() wordt nu ge-await zodat de knop pas terugkomt als de analyse echt klaar is. // v26.273: TWEE KAPOTTE KNOPPEN, beide uit v26.262. (a) 'Nieuwe analyse' riep openMatchAnalyseModalById() aan, die de modal SLOOPT (existing.remove()) en opnieuw opbouwt -> zichtbare flits en scrollpositie weg. Nu pmxRerunAnalyse(): leegt de rb-*-secties en de chips en draait runAnalyse() in de bestaande modal. (b) De meldknop bouwde het onclick-attribuut met JSON.stringify(naam), dat dubbele quotes oplevert -- in een attribuut dat zelf met dubbele quotes is afgebakend. De HTML-parser sloot het attribuut bij de tweede quote, dus klikken gaf een SyntaxError: de in-app meldweg die Google Play's AI-content-policy eist heeft sinds v26.262 NIET gewerkt. Nu via data-attributen. // v26.272: TWEE RESTFOUTEN UIT v26.270/271, beide van mij. (a) GROOTSTE AFWIJKING vergeleek appels met peren: 1X2 + doelpunten leverden gecorrigeerde pp, AH nog ruwe -> AH won de ranking per constructie (5.5pp vs max 4.1pp) en de badge wees 'AH Belgium +1' aan terwijl de kaart eronder al een BESTE EV-badge heeft. AH-rijen nu uit de ranking; ze gaan niet door calculateValue en worden op EV (push meegerekend) gerangschikt. (b) Het bronblok bouwde de doelpunten-kandidaten met een AFGERONDE marktkans (47 i.p.v. 46.8) -> raw 9.0 i.p.v. 9.2 -> 4.05, en 4.05.toFixed(1) geeft in JS '4.0' (binair 4.0499...). De tabel toonde 4.1, de AI-tekst 4.0. Nu mktExact op de kandidaten; afronding alleen nog voor weergave. // v26.271: BRONBLOK EN BADGE MEE NAAR GECORRIGEERD. v26.270 zette de tabellen om, maar het verplichte bronblok bleef de RUWE 1X2-value leveren en gaf voor doelpunten helemaal geen pp -- dus citeerde de LLM +4.7 waar de tabel +1.5 toonde, en rekende hij 9pp zelf uit ondanks het rekenverbod. Nu levert het bronblok gecorrigeerde waarden voor 1X2 EN doelpunten (ruw tussen haakjes, expliciet gelabeld als vóór-shrinkage), plus de geldende drempels. Prompt verbiedt het ruwe getal als 'de afwijking' te presenteren. GROOTSTE AFWIJKING-badge rekent nu ook met de gecorrigeerde waarde. AH-rijen blijven ruw: die gaan niet door calculateValue en worden op EV gerangschikt. // v26.270: EEN WOORD, DRIE BETEKENISSEN. De tabellen toonden als 'value' het RUWE model-markt-verschil, terwijl de pickselectie beslist op calculateValue() = (1-w) x ruw (w = shrink 0.45 club / 0.55 toernooi, plus tier-extra s1/s2 onder 20% resp. 20-35% modelkans bij 1X2), en voor een gelijkspel nog x0.88. Gemeten op Spain-Belgium: draw ruw +4.7pp -> gecorrigeerd ~+1.5pp, drempel 7pp -> geen pick en zelfs geen shadow-rij, terwijl het scherm een dikke edge suggereerde. Under 2.5 ruw +9.2 -> +4.1 tegen drempel 6. 1X2- en doelpuntentabellen tonen nu de gecorrigeerde waarde met het ruwe verschil erachter, plus de geldende drempel. Constanten komen uit de nieuwe worker-endpoint /model-params (v226) zodat ze niet driften zodra autotune s1/s2 bijstelt; ontbreekt de endpoint, dan valt de UI terug op alleen ruw -- liever geen getal dan een fout getal. AH-tabel blijft ruw: die rangschikt op EV (push meegerekend), een vierde grootheid. Raakt geen enkele berekening. // v26.269: DE LLM CITEERT, HIJ REKENT NIET. v26.268 dichtte de verzonnen doelpuntentotalen (nu correct: 2.42 vs 2.81), maar de LLM leidde vervolgens de 1X2-afwijking zelf af en schreef 'binnen 3pp voor alle drie uitkomsten' terwijl het gelijkspel op +4.7pp staat (Spain -3.4, X +4.7, Belgium -1.3). Dat vlakt juist het signaal weg dat ertoe doet: diezelfde draw-afwijking is de stelling die de hele AH-curve naar de underdog kantelt. Patroon over v26.267-269: elk getal dat de LLM AFLEIDT i.p.v. CITEERT is een foutkans. Nu staat '1X2 value (model min markt, in pp)' exact in het bronblok, berekend uit de ONafgeronde marktkansen zoals de MODEL vs MARKT-tabel, met een expliciet verbod op eigen rekenwerk, afrondingen en samenvattende marges. // v26.268: HALLUCINATIE DIE IK ZELF UITLOKTE. v26.267 schreef de LLM een verplichte zin voor met twee invulvakjes -- '(model A vs markt B)' -- maar de doelpuntentotalen stonden NIET in het GECORRIGEERDE KANSEN-blok. De LLM verzon ze: '~1.9 goals vs markt ~2.4', terwijl de app zelf 2.42 vs 2.81 toont; die 2.4 is vermoedelijk het MODEL-totaal uit 'verw. 2.4 goals', als markt gelabeld. Exact de fout die CIJFERBRON moet voorkomen. Nu staat 'Doelpuntentotaal model: X | markt (na de-vig): Y | gecorreleerde afwijking: JA/nee' in het verplichte bronblok, met expliciet verbod op afronden, schatten en op gebruik van 'verw. X goals' als marktwaarde. Ontbreekt de anchor, dan luidt de bron 'NIET BESCHIKBAAR' en mag er geen totaal genoemd worden. Les: een verplichte formulering vraagt om verplichte cijfers. // v26.267: PROMPT — verboden rechtvaardiging bij gecorreleerde afwijking. v26.264 leerde de LLM de correlatie te BENOEMEN, maar niet welke conclusie erbij hoort: hij schreef vervolgens tweemaal dat de afwijking 'niet groot genoeg' was, bij een gemeten 9.2pp op Under 2.5 (model 2.42 goals vs markt 2.81) — de grootste afwijking van de week. Hij ruilde de ene onware reden ('geen value-gap', v26.263) in voor de andere ('te klein'). De echte reden om niet te spelen is de BRON: de afwijking rust volledig op een doelpuntenparameter die niet aan de markt verankerd is (lambda_anchor_w = 0), dus het model meet zijn eigen lambda. Nu expliciet verboden om omvang als reden op te voeren wanneer de afwijking groot is, met de juiste formulering voorgeschreven, en met een aparte tak voor het geval de afwijking wel echt klein is (<3pp). // v26.266: FALSY-FAMILIE #8 EN #9, gevonden door de nieuwe lint-regel. (a) api.js formatPredictions: `if (pred.percent?.home !== null)` was altijd waar (ontbreekt percent -> undefined !== null), en de drie regels eronder dereferencen pred.percent ZONDER ?. -> TypeError i.p.v. het blok overslaan. Bovendien gooide `|| 0` een legitieme 0% weg; de API geeft die echt (gemeten: 50/50/0). Nu `pred.percent && pred.percent.home != null` + `?? 0`. (b) analyse.js r2292: zelfde `!== null` in de API-tekstregel. (c) _tailBad boven _arow gezet en een bewuste typeof-guard in unitAdvies gedocumenteerd, zodat de blokkerende lint schoon draait zonder dat iemand hem gaat negeren. // v26.265: HOTFIX v26.264. De AH-coherentiewaarschuwing (_ahWarn, r1857) las `_incoherent`, maar die const wordt pas op r1884 gedeclareerd -> temporal dead zone -> ReferenceError "Cannot access '_incoherent' before initialization" bij ELKE analyse met AH-odds. De error boundary ving hem (4x zichtbaar), de AH-lijst en de kaarten eronder braken. `node --check` vangt dit niet: dat is syntax, geen scope-volgorde. Nu _tailBad (r1842, identieke expressie, staat wel eerder). Les: eslint no-use-before-define hoort in de pre-push-check, naast de falsy-regel. // v26.264: ANALYSE-COHERENTIE (6 punten). (1) AH-badge rangschikt op push-bewuste EV i.p.v. procentpunten en heet nu BESTE EV -- pp en EV wijzen verschillende lijnen aan (op -1 krijg je bij 1 goal verschil je inzet terug; dat zit niet in de pp), dus TOP VALUE op -1 sprak de shadow-kaart tegen die -1.25 koos. Zelfde formule als bestAsianEV(). (2) Prompt: gecorreleerde afwijking moet als EEN scheve parameter benoemd worden, niet als 'geen value-gap' (fout: de gaten bestaan) of als meerdere kansen. (3) 'geen tip - markt efficient' krijgt scope '1X2/doelpunten' -- de AH-markt kan wel EV bieden. (5) conf-bump: `predictions?.percent?.home !== null` was ALTIJD waar (bij timeout is predictions null -> undefined !== null -> true; bij succes is percent.home een string). Elke wedstrijd kreeg +1 confidence zonder data, en conf voedt unitAdvies() = inzet-advies. Zevende falsy-instantie. (6) API Predictions herkaderd in de prompt: gemeten op 16 fixtures is de draw nooit <35% en bijna altijd gelijk aan het hoogste team-pct (45/45/10 9x, 50/50/0 4x) -- geen kansmodel, mag niet als 'grootste risico' opgevoerd worden. (7) Coherentie-waarschuwing nu ook boven de AH-lijst, niet alleen boven het doelpuntenblok. // v26.263: EEN BRON VAN WAARHEID voor het trackrecord. Dashboard + Analytics kregen alle backend-picks binnen (state._qualityPicks / /picks) en filterden er daarna ZELF nog eens op value>=6pp en confidence>=5, terwijl de backend op >=3pp selecteert en die picks in picks/clv_results/v_ai_tip_accuracy meet. Gevolg: 14 van de 18 picks zichtbaar, ROI +24.1% i.p.v. +26.6%, J1 League volledig verdwenen uit 'Per competitie', en de 100-picks-benchmarkteller kon de backend per constructie nooit inhalen. Nieuwe helper pmxKwaliPicks(picks, fromBackend) filtert alleen nog bij LEGACY localStorage-scanlog-picks, die geen backend-selectie hebben doorlopen. Zelfde klasse fout als de tip-bron in v26.251/252: een scherm, twee bronnen. // v26.262: PLAY-STORE COMPLIANCE. (1) In-app meldweg voor AI-gegenereerde analyses (pmxReportAnalysis -> POST /report -> content_reports). Google Play's AI-Generated Content-policy eist dat gebruikers aanstootgevende AI-output kunnen rapporteren ZONDER de app te verlaten; de analyse-narratief komt van de LLM, dus dit geldt. Geen mailto (verlaat de app), geen extern formulier. (2) Disclaimer.html lag sinds v26.189 in de repo maar werd NERGENS gelinkt — nu bereikbaar vanuit de analyse-modal en de dashboard-disclaimer. (3) AI-disclosure onder elke analyse: 'deels door AI gegenereerd, informatief, geen garantie op winst'. Raakt model/picks NIET. // v26.261: BUGFIX vormweging — die heeft NOOIT vorm gemeten, alleen gedempt. extractTeamGoalStats las `f.goals.for` en `f.goals.against`, maar API-Football levert `f.goals = {home, away}`. Beide velden waren altijd undefined -> `|| 0` -> recentGF=0 en recentGA=0. Met RW=0.55 werd elke teamsterkte dus met 0.45 vermenigvuldigd. Gevolg: het model verwachtte 1.36 goals voor France-Morocco waar de markt 2.58 inprijst, waardoor ALLE Under-regels, BTTS-Nee en elke Morocco-handicap tegelijk 'value' toonden (AH Morocco +1 op +19.8pp, beste EV +22.4%) — één scheve parameter, vier keer geteld, precies het patroon dat v26.253 al benoemde. Nu: teamId-parameter bepaalt per fixture of het team thuis of uit stond, alleen afgeronde wedstrijden (FT/AET/PEN) tellen mee. Gemeten over 4 WK-duels met echte odds, na de SoS-pull: gemiddeld verwacht doelpuntentotaal 1.80 -> 2.81 (markt ~2.55), MAE 4.97 -> 4.83 pp. France-Morocco 1.36 -> 2.63 tegen markt 2.58, dus binnen de deadband: geen coherentie-waarschuwing meer en de schijn-value op de Asian lines verdwijnt. Ook de truthy-checks in de vormblend (`if (base.avgConcHome)`) vervangen door `!= null` — vijfde instantie vandaag van dezelfde bugfamilie, na `!data.errors` op [], `Array.isArray` op een object, `parseFloat('0.0') || null`, en de `< 10`-league-ID-check. // v26.260: FALSY-NUL BUGFIX in extractTeamGoalStats. `parseFloat(x) || null` maakte van een gemeten 0.0 een null, want 0 is falsy in JS. Een team dat nul tegendoelpunten toeliet viel daardoor terug op avgConcTotal en vervolgens op het competitiegemiddelde. Spain hield thuis in alle 3 duels de nul en werd als PRECIES GEMIDDELD verdedigend gemodelleerd (1.40) — vandaar Belgium 47% winstkans waar de markt 17% zegt. Nu: _num() behoudt 0, _firstNum() pakt de eerste niet-null fallback (0 telt mee), shrinkStrength accepteert val===0 (die hoort juist geshrunkt te worden), en MIN_STRENGTH (0.10) is het vangnet zodat een echte 0 lambda niet naar nul stuurt met de noodrem K=0. Gemeten op 4 WK-duels met echte odds: MAE t.o.v. de de-vigde markt 8.48 -> 5.01 pp; Spain-Belgium van 30/23/47 (3.78 goals) naar 50/27/23 (2.72 goals, markt ~2.5); 0 wedstrijden zonder model, ook met de noodrem. Derde bug van dezelfde familie vandaag, naast `!data.errors` op een lege array (worker v218) en `Array.isArray` op een object-response (worker v216): een falsy waarde die inhoudelijk betekenisvol is. // v26.259: de 'GEEN VALUE — OVERSLAAN'-kaart is teruggebracht tot één compacte regel; als de Asian lines wel een positieve EV vinden, komt die op dezelfde plek als alternatief te staan. Nieuwe functie bestAsianEV() is de ENIGE bron voor die keuze — zowel de AH-tabel-footer als de tipkaart roepen haar aan, dus ze kunnen elkaar per constructie niet tegenspreken (dezelfde klasse fout als de VALUE-INDEX in v26.253). De AH-tip is expliciet gelabeld als experimenteel/shadow: hij telt niet mee in het trackrecord en de handicap-EV leunt op de doelpuntenmarge-aanname van het model. Bij een afwijkend doelpuntentotaal wordt de tip gedimd en krijgt hij 'lage betrouwbaarheid' + uitleg dat het een signaal is, geen pick. Vindt ook AH geen positieve EV binnen de betrouwbare lijnen (markt 20-80%), dan blijft het bij de compacte pass-regel. // v26.258: regularisatie AAN (Ka=5, Kd=3). Reden is niet de grid-search maar de uitrol: de leagueAvg-bugfix van v26.257 haalde twee WK-duels uit valid=false en liet ze vervolgens ONZIN tonen (Norway-England 6.50 verwachte goals, England 79% waar de markt 52% zegt; Spain-Belgium 5.94 goals). 'Geen model' werd 'kapot model' — slechter voor de gebruiker. Bugfix en regularisatie zijn twee helften van dezelfde correctie; alleen de eerste deployen was de fout. Gemeten na de SoS-pull over 4 WK-duels met echte odds: MAE t.o.v. de de-vigde markt 9.37 -> 7.18 pp, gemiddeld verwacht doelpuntentotaal 4.34 -> 3.23 (markt ~2.5), 0 wedstrijden zonder model. Bewust de RAND van het plateau (Ka=5/Kd=3) i.p.v. het optimum (Ka=8/Kd=3, MAE 6.29): de K's zijn op 4 duels gefit, dus niet op het minimum gaan zitten. Raakt GEEN picks/CLV/trackrecord — de worker berekent zijn eigen kansen en roept calcPoissonKansen nergens aan (geverifieerd: 0 treffers). Noodrem per toestel: localStorage pmx_shrink_k_att=0 en pmx_shrink_k_def=0. Hertunen op clubdata na 20 juli; n/(n+K) dooft zichzelf uit naarmate n groeit. lambda_anchor_w blijft 0 — dat zou een tweede correctie op dezelfde fout zijn, en die meet je pas als de eerste staat. // v26.257: (1) BUGFIX leagueAvg/leagueId-verwarring. calcPoissonKansen onderscheidde een doelpuntgemiddelde van een league-ID met `typeof === number && < 10`. Maar ALLE toernooi-IDs zijn eencijferig: 1=WK, 2=Champions League, 3=Europa League, 4=EK, 5=Nations League, 6=Afrika Cup, 9=Copa America. Die werden als gemiddelde gebruikt — het WK deelde door 1.0 i.p.v. 1.40, Copa America door 9.0. LEAGUE_AVG_GOALS bevat expliciet `1: 1.40` en `2: 1.45`; die regels waren onbereikbaar. Gemeten op 4 WK-duels met echte odds: lambda's tot 6.94, Norway-England 9.10 verwachte goals, 2 van de 4 wedstrijden valid=false -> 'model n.v.t.'. Nu: gehele getallen = ID, niet-gehele = gemiddelde. Dit is een bugfix, geen flag. (2) REGULARISATIE van de teamsterktes (empirical-Bayes shrinkage naar het competitiegemiddelde, gewicht n/(n+K), met de sample-size van de eigen home/away-split). Aparte K voor aanval en defensie: op 3-5 duels zijn aanvalsratio's nog plausibel (2.14x) maar defensieratio's ontsporen (0.21x). Grid met de echte functie over 4 WK-duels: MAE t.o.v. de de-vigde markt 16.05pp (huidig) -> 8.42pp bij Ka=8/Kd=3, plateau rond Ka=5-8, Kd=2-3, en 0 wedstrijden zonder model i.p.v. 1. DORMANT: beide K=0 -> lambda's ongewijzigd. Test: localStorage pmx_shrink_k_att / pmx_shrink_k_def. (3) ONTKOPPELING 1X2 vs lambda opgeheven (alleen bij shrunk): voorheen werden k1/kX/k2 gepulld uit de rauwe lambda's terwijl de vloer (1.9->2.1) en de supremacie-shift diezelfde lambda's daarna schaalden — Argentina-Switzerland toonde 48% gelijkspel uit lambda-totaal 0.80 naast doelpuntmarkten uit 2.10. Bij regularisatie schuiven we eerst de lambda's, leiden we de 1X2 daaruit af, en pullen we dan pas naar de markt; de totaal-vloer is dan overbodig en blijft uit. // v26.256: (1) VOLGORDE-FIX markt-anker. In v26.253 draaide anchorLambdasToMarket VOOR het SoS-blok, dus mat het de RAUWE lambda's (Argentina-Switzerland: 0.80 goals) terwijl de totaal-vloer (1.9->2.1) en de supremacie-shift daarna het echte totaal op 2.10 zetten. De waarschuwing zei 'model verwacht 0.80' pal naast een kop 'verw. 2.1 goals' — twee getallen voor hetzelfde, precies de fout die v26.253 juist moest oplossen. Het anker draait nu NA het correctieblok en meet de lambda's die gm/AH echt gebruiken. Gevolg: Argentina-Switzerland gap 2.10 vs 2.38 = 0.28 -> binnen de deadband -> geen waarschuwing en de Asian lines geven weer EV-advies (gedrag van vóór v26.253 hersteld); France-Morocco 2.10 vs 2.62 = 0.52 -> terecht incoherent. anchorLambdasToMarket herberekent k1/kX/k2 niet meer: die zijn hierboven al naar de 1X2-markt getrokken, opnieuw afleiden zou die pull wissen. Vloer-gate op anchor.applied teruggedraaid (vloer draait vóór het anker). (2) UI: coherentie-waarschuwing teruggebracht tot één compacte regel i.p.v. een blok; de Asian-lines-tip wordt niet meer onderdrukt bij een afwijkend doelpuntentotaal maar gedimd getoond met 'lage betrouwbaarheid' + één regel context; TOP VALUE-badge idem gedimd met waarschuwingsteken i.p.v. verborgen. Informatie kaderen, niet verbergen. // v26.255: BUGFIX 'model n.v.t.' — het model verdween stil uit 1X2 + doelpunten + Asian lines. Gemeten oorzaak: een gewone analyse-burst (9 parallelle calls) lokt reproduceerbaar 'Too many requests' uit bij API-Football; raakt dat teams/statistics, dan ging apiFetch in backoff (eerste retry 2000ms) terwijl de caller de fetch in wt(...,5000) wikkelde. De retry paste niet in het venster -> null -> hStats/aStats null -> poisson.valid=false. Drie fixes: (1) eerste backoff 2000->700ms met jitter (2200/5000 daarna), fetchTeamStats krijgt expliciet 7000ms i.p.v. de 10s-default; (2) wt-venster voor beide statistics-calls 5000->9000ms zodat retry 1 en 2 passen; (3) EERLIJKE DIAGNOSE: poisson.missReason onderscheidt 'fetch' (call afgekapt), 'thin' (<3 gespeelde wedstrijden) en 'onbruikbaar'. De UI zei voorheen bij alledrie 'te weinig vormdata voor dit team' — een bewering die de code niet kon staven. Zelfde klasse fout als de VALUE-INDEX in v26.253. Worker v216 haalt de hoofdoorzaak weg: teams/statistics werd nooit ge-edge-cacht (Array.isArray-check op een object-response). // v26.254: dubbele shrink voorkomen zodra het markt-anker aanstaat. De goal-markt- en AH-correcties legden een mismatch-term (tot 0.9 gewicht, puur op basis van hoe dominant de favoriet is) bovenop de modelkans, ongeacht divergentie. Dat was bedoeld als vervanger van een totaal-anker; nu ER een echt anker is, telt die term dubbel en trekt de kans over de markt heen. Bij poisson.anchor.applied gaat de mismatch-term naar 0 (op alle drie de plekken: goal-markt-tabel, CIJFERBRON-blok voor de LLM/candidates, Asian lines). De base-pull bij >10pp divergentie blijft als vangnet. Byte-identiek zolang LAMBDA_ANCHOR_W=0 (anchor.applied=false). // v26.253: (A) MARKT-ANKER op het doelpuntentotaal + (C) VALUE-INDEX spreekt de tipkaart niet meer tegen. (A) De lambda's zijn SoS-blind: verwachtte het model 2.10 goals waar de markt 2.62 inprijst, dan toonden Under 1.5 (+10.6pp), Under 2.5 (+14.2), Under 3.5 (+10.6) en BTTS-Nee (+11.4) allemaal 'value' — vier keer dezelfde scheve parameter, geen vier edges. solveMarketTotal lost het markt-impliciete totaal per O/U-lijn op (zelfde Poisson+Dixon-Coles-kern); marketTotalGoals middelt gewogen over 1.5/2.5/3.5 (2.5 dubbel) zodat geen enkele lijn per constructie op 0pp wordt vastgezet; anchorLambdasToMarket trekt het TOTAAL naar de markt en laat de supremacie lh:la exact ongemoeid. Deadband 0.30 goal. DORMANT: LAMBDA_ANCHOR_W=0 -> lambda's byte-identiek, alleen de diagnose (poisson.anchor) wordt gezet; per toestel te testen via localStorage pmx_lambda_anchor_w. goalOdds wordt nu vóór de SoS-pull opgehaald; de totaal-vloer (1.9) overruled een toegepast anker niet meer. (C) VALUE-INDEX volgde de grootste rauwe afwijking en riep 'sterke value' terwijl de tipkaart 'GEEN VALUE — OVERSLAAN' zei. Nu: backend-pick -> VALUE-INDEX toont die pick; geen pick -> kop 'GROOTSTE AFWIJKING', neutraal, expliciet 'geen tip'. Bij incoherent doelpuntentotaal: waarschuwingsblok onder de doelpunten-tabel en geen TOP VALUE-badge op de Asian lines. // v26.252: misleidend TIP-hoekje opgeruimd. De kaart had 3 lagen; de tussenlaag toonde de 'model-lean' uit /model-tips (scan-Poisson uit model_market_comparison) als 'TIP', terwijl die pick de drempel juist NIET haalde en uit een ander model kwam dan de losse analyse (bv. TIP 2 = Morocco 19% naast een SoS-analyse die ~10% geeft). Nu 2 lagen: de echte, getrackte backend-value-pick, anders de MARKT-favoriet als duidelijke plaatshouder. /model-tips-fetch verwijderd (scheelt ook een call per Matches-load). Samen met v26.251 is er nu 1 tipbron: kaart en analyse kunnen niet meer tegenspreken. // v26.251: EEN BRON VAN WAARHEID voor de tip. De popup herberekende de tip zelf (verse odds + eigen codepad) waardoor kaart en analyse konden verschillen, en fabriceerde bij ontbrekende value alsnog de favoriet als tip. Nu komt de tip UITSLUITEND uit de backend-pick (/picks, state._qualityPicks) — dezelfde pick die in picks/CLV/v_ai_tip_accuracy wordt gemeten. Geen backend-pick = expliciete 'Geen value — overslaan'-kaart; geen LLM-fallback (result.tip) en geen zelfgekozen favoriet. Picks worden gegarandeerd geladen voor de tipselectie (ensureWorkerPicks + fetch-fallback tegen race). // v26.250: AH-staart gerepareerd + eerlijke ranking. (1) supremacie-shift is nu TOTAAL-BEHOUDEND — blies eerder het verwachte doelpuntentotaal op (2.6->2.9) waardoor grote zeges kunstmatig waarschijnlijk werden (dikke staart = nep-value op extreme lijnen). (2) 'Meeste value' rangschikte op procentpunten, wat de odds negeert en systematisch naar de extreemste lijn wijst; nu ranking op EV met echte odds en push-correct. (3) Betrouwbaarheidsband: lijnen met markt buiten 20-80% zijn staartlijnen, gedimd + gemarkeerd en uitgesloten van de EV-keuze. (4) Staart-coherentiecheck: wijkt het model-doelpuntentotaal >0.30 af van het markt-impliciete totaal (uit de-vigde Over 2.5), dan GEEN EV-advies — dan meet je de marge-aanname, geen edge. // v26.249: BUGFIX AH losgezongen van 1X2 — asianModelProbs krijgt optioneel t1x2 en herschaalt de scorematrix zodat haar marginalen EXACT de SoS-gecorrigeerde 1X2 zijn. AH -0.5 == P(thuiswinst), DNB == P1/(P1+P2). Vervangt de losse markt-pull in BEIDE AH-weergaves (grid + per-kant), die daardoor nu identieke getallen tonen. Ook: prompt-regel dat model- en marktrij nooit gemengd mogen worden (elk drietal telt op tot ~100). // v26.248: prompt-hardening tegen intermitterende 1X2-drift — verplichte format-regel in CIJFERBRON: noem de 1X2 altijd als 'thuis X% / gelijkspel Y% / uit Z%' met getallen letterlijk uit het GECORRIGEERDE-KANSEN-blok, nooit samenvatten tot 2-weg (bv. '65 vs 35'). Ook in stats-schema herhaald. Eerlijke framing i.p.v. valse 'parser faalt'-dreiging. // v26.247: BUGFIX Asian Handicap-inversie (fetchGoalOdds) — API-Football geeft de AH-lijn altijd vanuit thuis-perspectief; 'Away +1.5' is de uit-kant van thuis-handicap +1.5, niet -1.5. De away-lijn werd ten onrechte genegeerd (raw:-raw), waardoor home-odds aan de verkeerde away-odds werden gekoppeld -> absurde overround -> Shin de-vig ontspoorde (markt telde niet op tot 100, kansen inverteerden, model 'jojode' via de pull). Nu: k=ahKey(raw) voor beide kanten. Geverifieerd tegen echte odds: markt telt overal op tot 100, fairHome strikt monotoon, matcht de 1X2-anker. Raakt de grid EN de per-kant-weergave (beide lezen goalOdds.ah). // v26.246: ASIAN LINES in de match-analyse — nieuwe buildAsianLinesHtml toont per beschikbare AH-lijn (|lijn|<=2) de SoS-verankerde modelkans vs de 2-weg de-vigde marktkans + value (home-side; away=spiegelbeeld), plus 'meeste value'-samenvatting. Rendert deterministisch (geen LLM) in rb-asian. Model wordt net als de 1X2 superlineair naar de markt getrokken bij >12pp divergentie zodat de Poisson-valkuil geen nep-value op favorieten toont. Eerlijk gelabeld: experimenteel/shadow, nog niet gevalideerd. // v26.245: BUGFIX vorm-asymmetrie in de losse analyse — bij een timeout van de aparte fixtures-vormcall (team=&last=) kreeg de uit-ploeg ten onrechte 'geen vormdata' terwijl de thuisploeg wel vorm had. Nieuwe formFromPred-fallback haalt de recente vorm uit het predictions-object (1 call, altijd beide teams), toegepast in popup- en batch-analysepad. Vorm is nu symmetrisch/robuust. // v26.244: per-bet '🔍 Check'-knop uit de tracker-rijen verwijderd — settlement loopt nu automatisch (v26.243) + de '🔍 Alles checken'-knop blijft als handmatige fallback; checkTrackerBet zelf blijft (gebruikt door auto-settle) // v26.243: automatische tracker-settlement — autoSettleTracker draait stil bij openen van de Tracker (max 1x/15 min via state.tracker._lastAutoCheck), rekent alleen duels af waarvan de aftrap voorbij is, API-vriendelijk gespreid (1,2s), niet-blokkerend/fire-and-forget, offline overgeslagen; toont een subtiele balk "X bet(s) automatisch afgerekend". De "🔍 Check alle"-knop blijft als handmatige optie // v26.242: tracker-settlement gerepareerd — (1) robuuste team-scheiding in checkTrackerBet (" v ", "vs.", dash-varianten, niet alleen " vs "), (2) Asian Handicap-regex accepteert nu ook lijn zonder teken (0.0 = level/DNB) én haakjes rond "(Asian Handicap)", (3) kale "Meer/Minder dan X.X" rekent af als doelpunten-O/U (kaarten/corners uitgesloten), (4) datum-lookup zoekt ±2 dagen rond de bet-datum tegen import/OCR-datumfouten. Open WK-bets die dagenlang bleven hangen settelen nu. Wallet-legacy (checkBetResult) bewust ongemoeid (tab verborgen sinds v26.238) // v26.241: globale error-boundary (window error + unhandledrejection) — één ongevangen JS-fout sloopt niet meer de hele UI, toont een niet-blokkerende melding i.p.v. rood scherm; plus opschoning van dode v26.237-code (settleAllWalletBets + knop). Diepere wallet/backtest-purge bewust NIET gedaan: valueBacktest voedt de validatie-pijplijn // v26.240: Tracker equity-curve gebouwd — renderTrackerChart tekent cumulatief W/V van afgerekende tracker-bets op het (voorheen verborgen) #trackerChart canvas, zelfde stijl als de wallet-chart, punten gekleurd per win/verlies; verschijnt vanaf 2 afgerekende bets // v26.239: fix Tracker-crash 'renderTrackerChart is not defined' — dode aanroep (chart-wrap was toch al display:none) veilig afgevangen; Tracker opent nu weer normaal // v26.238: bet-plaatsen (virtuele saldo-wallet) volledig verwijderd — SINGLE BET/COMBI-knoppen weg uit analyse, Matches en value-cards; Wallet-tab toont nu alleen de Tracker (saldo + Resultaten/backtest verborgen); Home OPEN BET-kaart + saldo-tegel weg; bottom-nav 'Wallet' -> 'Tracker'. Odds op Matches blijven als value-indicator // v26.237: wallet-bets rekenen nu automatisch af — settleAllWalletBets draait stil bij openen Home (max 1x/15min, alleen afgelopen duels FT/AET/PEN, API-vriendelijk gespreid) i.p.v. handmatig per bet; plus knop 'X open bets afrekenen' op wallet-scherm. Lost op dat open bets dagenlang bleven hangen // v26.236: robuustheid odds-ophalen — fetchGoalOdds timeout 6s->11s + 1 nette retry bij lege/mislukte respons, zodat een tijdelijke hapering niet stil de DOELPUNTEN- + ASIAN LINES-sectie wist; nette neutrale melding met refresh-hint i.p.v. lege plek // v26.235: ASIAN LINES tabel scanbaarder — TOP VALUE-badge op de regel met de hoogste value (alleen bij >=3pp, geen hersortering) + risicoprofiel-tags per lijn (DNB bij lijn 0, PUSH bij hele lijnen, half-win/verlies bij kwartlijnen) // v26.234: ASIAN LINES trackrecord-kaart op het Analyse-scherm (inklapbaar, naast schaduw-picks en doelpunten-markten) — toont het AH-schaduwtrackrecord uit /ah-shadow: samenvatting (win/half/push/half-verlies/verlies + ROI in eenheden) en recente rijen met model-vs-markt en value // v26.233: ASIAN LINES in de diepte-analyse — AH-odds (bet 4) meegelezen in dezelfde odds-call, genormaliseerd naar thuis-handicap + 2-weg Shin de-vig; asianModelProbs uit dezelfde Poisson+Dixon-Coles matrix (kwartlijnen gesplitst, push-conditionele kansen); mismatch-anker (SoS-valkuil) ook op AH toegepast; max 4 lijnen dichtst bij 50/50, AH-edges tellen mee in de VALUE-INDEX // v26.189: i18n-motor data-i18n-html (EN-only swap) + Disclaimer + changelog-chrome + help-skeleton (sectie/card-titels, tips, nav) tweetalig // v26.188: i18n — login.html volledig tweetalig (i18n.js ingeladen, statische tags + inline-meldingen) NL/EN // v26.187: i18n — dynamische meldingen (auth/notificaties/ui/oefenduels/wallet-confirms) NL/EN // v26.186: i18n — WK 2026-scherm (tabs, laad/lege-meldingen, NL-spotlight, koppen) NL/EN // v26.185: i18n — Analytics-scherm (koppen, KPI-labels, lege/laad-meldingen, sharp-popup) NL/EN // v26.184: Anthropic-key schoongetrokken via patroon (sk-ant-…) bij opslaan én verzenden — plak-rommel (", \, spaties) wordt genegeerd // v26.183: AI-analyse — ongeldige eigen Anthropic-key geeft 1 duidelijke melding (i.p.v. 7x cryptische 401) + geen retries // v26.182: i18n — Wallet meldingen (alerts/confirms/toasts) + analyse-popup-titel NL/EN // v26.181: i18n — Wallet subschermen (value-resultaten, bet-historie, lege staten, export-alerts) NL/EN // v26.180: i18n — Wallet hoofdscherm (saldo, tabs, filters, knoppen) NL/EN // v26.179: i18n — Wedstrijden-restjes (analyse-popup, laad-fout, retry, tik-naam, verversen) NL/EN // v26.178: i18n — Wedstrijden standen/topscorers/comp-wedstrijden laad+lege meldingen NL/EN // v26.177: i18n — Wedstrijdkaart-uitslagen (THUIS/GELIJK/UIT, meer-minder-goals) + value-picks lege staat NL/EN // v26.176: i18n — Wedstrijden eerste pass (handmatige invoer, knoppen, laad/lege-meldingen) NL/EN // v26.175: i18n — Dashboard-body (nav-tegels, deze week, trackrecord-status, disclaimer, live-sectie, comp-kiezer) NL/EN // v26.174: i18n — Instellingen onderkant compleet (backups/kosten/account/db/admin/knoppen + korte hints) NL/EN // v26.173: i18n — Instellingen-velden/hints/toggles (bovenste secties) + Dashboard eerste pass (koppen/knoppen) NL/EN // v26.172: i18n fase 2 vervolg — Instellingen-sectietitels + Opslaan + 3 modals (Bet/Tracker/Storten) vertaald (NL/EN) // v26.171: i18n fase 2 (app-chrome) — data-i18n motor + nav/login-tabs vertaald (NL ongewijzigd, EN toegevoegd) + cookievoorkeuren-knop in Instellingen // v26.170: i18n fundament (fase 1) — i18n.js met t()-helper, lang in settings, taalknop in Instellingen (NL/EN, NL=default+fallback) // v26.169: cookie-consent banner + Google Consent Mode v2 (analytics_storage standaard denied; banner accepteren/weigeren, NL/EN, heropenbaar via pmxOpenConsent) // v26.168: JSON-LD structured data (SoftwareApplication) toegevoegd aan index.html + welcome.html voor SEO — naam, categorie, zoekwoorden (value betting voetbal, AI voetbalanalyse, voetbal value picks e.a.), NL/EN, 18+

// ── v26.263: één bron van waarheid voor het trackrecord ──────────────
// Backend-picks (state._qualityPicks / /picks) HEBBEN de selectie al doorstaan (>=3pp value,
// longshot-guard, API-scepsis) en worden gemeten in picks/clv_results. Er nog eens een strengere
// frontend-drempel overheen leggen verbergt echte picks en vertekent hitrate/ROI/benchmarkteller.
// De oude drempel geldt alleen nog voor legacy scanLog-picks uit localStorage.
function pmxKwaliPicks(allPicks, fromBackend) {
  const picks = Array.isArray(allPicks) ? allPicks : [];
  if (fromBackend) return picks.filter(p => !p.isSparseData);
  const DREMPEL = { minValue: 6, minConf: 5 };
  return picks.filter(p =>
    !p.isSparseData &&
    (p.value || 0) >= DREMPEL.minValue &&
    (p.confidence || 0) >= DREMPEL.minConf
  );
}

// Tijdelijk: alleen WK 2026 tonen/scannen. Zet op false om alle competities te herstellen.
const WK_ONLY_MODE = true;

const STATE_KEY = 'totoai_state';

// ── v26.158: bankroll & uitleg ──────────────────────────────
// Vaste unit-strategie (BEWUST géén Kelly: Kelly schaalt op de geschatte edge,
// en die is nog niet gevalideerd → zou fouten vergroten). Units volgen de confidence.
function unitAdvies(confidence, value) {
  const c = Number(confidence) || 0, v = Number(value) || 0;
  let units = 1;
  if (c >= 8) units = 3;
  else if (c >= 7) units = 2.5;
  else if (c >= 6) units = 2;
  else if (c >= 5) units = 1.5;
  if (v >= 12 && units < 3) units += 0.5;
  // unitAdvies() draait pas na init; de typeof-guard is bewust omdat `state` verderop in dit
  // bestand wordt gedeclareerd. Runtime-veilig, dus de statische melding is hier een valse positieve.
  // eslint-disable-next-line no-use-before-define
  const us = (typeof state !== 'undefined' && state.settings && Number(state.settings.unitSize) > 0) ? Number(state.settings.unitSize) : 0;
  const eur = us ? ` = \u20ac${(units * us).toFixed(2)}` : '';
  return { units, eur };
}
// Value in gewone taal: model-kans vs break-even-kans uit de quote.
function valueUitleg(modelPct, odds) {
  const o = parseFloat(odds), mp = Math.round(Number(modelPct));
  if (!(o > 1) || !isFinite(mp)) return '';
  const be = Math.round(100 / o);
  const diff = mp - be;
  if (diff <= 0) return `Bij een quote van ${o} moet deze uitkomst ongeveer ${be}% kans hebben om quitte te spelen; het model schat ${mp}%. Weinig tot geen voordeel hier.`;
  return `Bij een quote van ${o} hoeft deze uitkomst maar ${be}% kans te hebben om quitte te spelen. Het model schat ${mp}% \u2014 dat is ${diff} procentpunt hoger. Dat overschot is de \u201evalue\u201d: je krijgt een betere prijs dan de kans rechtvaardigt.`;
}

// v26.145: markt-helper — vertaalt een pick-code naar markt-groep + nette badge.
// Maakt doelpunten-picks (O/U 1.5/2.5/3.5 + BTTS) naast 1X2 herkenbaar in de UI.
function pickMarket(pick) {
  pick = String(pick || '');
  if (pick === '1' || pick === 'X' || pick === '2')
    return { group: '1X2', label: 'Uitslag', badge: pick };
  if ((pick[0] === 'O' || pick[0] === 'U') && /\d/.test(pick)) {
    const line = pick.slice(1);
    return { group: 'OU' + line.replace('.', ''), label: 'Doelpunten', badge: (pick[0] === 'O' ? 'Over ' : 'Under ') + line };
  }
  if (pick === 'BTTS' || pick === 'BTTS-J')   return { group: 'BTTS', label: 'Beide scoren', badge: 'GG' };
  if (pick === 'NOBTTS' || pick === 'BTTS-N') return { group: 'BTTS', label: 'Beide scoren', badge: 'NG' };
  return { group: 'OVERIG', label: '', badge: pick };
}

// v26.149: afrekenen van een doelpunten-pick (O/U alle lijnen + BTTS), beide code-stijlen
// (O2.5 én O25, BTTS/NOBTTS én BTTS-J/BTTS-N). Geeft 'win'/'lose' of null (geen goal-markt).
function settleGoalPick(pick, hg, ag) {
  if (hg == null || ag == null) return null;
  const tot = hg + ag;
  let p = String(pick || '').toUpperCase();
  if (p === 'BTTS' || p === 'BTTS-J' || p === 'BTTSJ' || p === 'GG') return (hg >= 1 && ag >= 1) ? 'win' : 'lose';
  if (p === 'NOBTTS' || p === 'BTTS-N' || p === 'BTTSN' || p === 'NG') return (hg >= 1 && ag >= 1) ? 'lose' : 'win';
  let m = /^([OU])(\d)(\d)$/.exec(p);              // O25 / U15 / O35 → O2.5 / U1.5 / O3.5
  if (m) p = m[1] + m[2] + '.' + m[3];
  m = /^([OU])(\d+(?:\.\d+)?)$/.exec(p);           // O2.5 / U1.5 / O3.5
  if (m) { const line = parseFloat(m[2]); if (isFinite(line)) { const over = tot > line; return (m[1] === 'O') === over ? 'win' : 'lose'; } }
  return null;
}

// v26.123: bepaalt of een wedstrijd al begonnen/afgelopen is — gebruikt om value-picks
// op verleden wedstrijden te verbergen (conservatief: alleen verbergen bij zekerheid).
// Accepteert zowel match-objecten (isDone/dateISO/date/time/timestamp) als pick-objecten (matchTime).
function matchHasStarted(m) {
  if (!m) return false;
  if (m.isDone || m.isLive || m.finished) return true;
  let ts = (typeof m.timestamp === 'number' && m.timestamp > 0) ? m.timestamp : 0;
  if (!ts) {
    const isoFull = m.matchTime || m.kickoff; // volledige ISO-datetime (pick-objecten)
    if (isoFull) { const d = new Date(isoFull); if (!isNaN(d)) ts = d.getTime(); }
  }
  if (!ts) {
    const dateStr = m.dateISO || m.matchDate || m.date;
    const timeStr = (m.time && m.time !== '\u2014') ? m.time : '23:59';
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const d = new Date(dateStr + 'T' + timeStr + ':00');
      if (!isNaN(d)) ts = d.getTime();
    }
  }
  return ts > 0 && ts < Date.now() - 5 * 60 * 1000; // 5 min marge
}

// v26.136: bevroren live-status detecteren. Een wedstrijd in 1e helft/rust kan nooit >75 min
// na aftrap nog live zijn; een hele wedstrijd zelden >150 min. Voorkomt vastzittende '45'-kaarten.
function isStaleLive(statusShort, kickoffMs) {
  if (!kickoffMs) return false;
  const ageMin = (Date.now() - kickoffMs) / 60000;
  if (['1H','HT'].includes(statusShort) && ageMin > 75) return true;
  if (ageMin > 150) return true;
  return false;
}

const state = {
  // Navigatie
  activeScreen: 'dashboard',
  activeTab: 'dashboard',

  // Wedstrijden
  activeComp: 'eredivisie',
  matches: [],
  bookmakerOdds: {},
  openingOdds: {},
  lastScanResults: [],
  favoriteComps: [],
  scheduledScanPicks: [],
  valueScans: [],
  backtestPicks: [],
  scanLog: [],
  trackerBets: [],

  // Combi builder
  combiBuilder: [],

  // Wallet
  wallet: {
    balance: 500,
    startBalance: 500,
    totalStaked: 0,
    totalWon: 0,
    bets: []
  },

  // Tracker (echte bets buiten de app)
  tracker: { bets: [] },

  // Backtest (automatisch bijgehouden value picks)
  valueBacktest: { picks: [] },

  // Kosten tracker
  costs: { calls: 0, tokensIn: 0, tokensOut: 0, totalUSD: 0 },

  // Instellingen
  settings: {
    lang: 'nl',
    anthropicKey: '',
    footballKey: '',
    fdKey: '',
    defaultComp: 'eredivisie',
    startBalance: 500,
    defaultBet: 10,
    defaultBookmaker: 'Bet365',
    oddsSource: 'manual',
    notifEnabled: false,
    notifThreshold: 15,
    autoDark: false,
    autoValueAlerts: false,
    vapidPublicKey: '',
    autoScan: false,
    scanSkipDate: null,
    scanWindowFrom: 14,
    scanWindowTo: 18,
    tripleMinOdds: 1.6,
    _preAutoDarkTheme: null
  }
};

function saveState() {
  try {
    // Beperk matches voor opslag — max 100, geen live wedstrijden
    const stateToSave = {...state};
    if (state.matches?.length > 100) {
      stateToSave.matches = state.matches.slice(0, 100);
    }
    localStorage.setItem(STATE_KEY, JSON.stringify(stateToSave));
    scheduleFirebaseSync();
  } catch(e) {
    console.warn('[State] saveState fout:', e.message);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    // Deep merge — bewaar structuur, overschrijf met opgeslagen waarden
    if (saved.wallet)        Object.assign(state.wallet, saved.wallet);
    if (saved.tracker)       Object.assign(state.tracker, saved.tracker);
    if (saved.valueBacktest) Object.assign(state.valueBacktest, saved.valueBacktest);
    if (saved.settings)      Object.assign(state.settings, saved.settings);

    // ── Migreer oude Triple Lock standaardwaarden naar nieuwe defaults ──
    if (!state.settings.tripleMinValue || state.settings.tripleMinValue < 10) {
      state.settings.tripleMinValue = 12;
    }
    if (!state.settings.tripleMinConf || state.settings.tripleMinConf < 8) {
      state.settings.tripleMinConf = 8;
    }
    if (!state.settings.tripleMinOdds || state.settings.tripleMinOdds < 1.55) {
      state.settings.tripleMinOdds = 1.6;
    }

    // Kosten tracker laden
    if (saved.costs) Object.assign(state.costs, saved.costs);

    const scalarFields = [
      'activeComp','activeScreen','favoriteComps','combiBuilder',
      'openingOdds','lastScanResults','scheduledScanPicks',
      'backtestPicks','trackerBets','scanLog','matches','valueScans'
    ];
    scalarFields.forEach(key => {
      if (saved[key] !== undefined) state[key] = saved[key];
    });

    // Oude wedstrijden opruimen — verwijder matches van vóór vandaag
    const _todayISO = new Date().toISOString().split('T')[0];
    if (Array.isArray(state.matches)) {
      const before = state.matches.length;
      state.matches = state.matches.filter(m => {
        const d = m.dateISO || m.date || '';
        return !d || d >= _todayISO; // bewaar als geen datum of datum >= vandaag
      });
      if (state.matches.length < before) {
        console.log(`[State] ${before - state.matches.length} oude wedstrijden opgeruimd`);
      }
    }
  } catch(e) {
    console.warn('[State] loadState fout:', e.message);
  }
}

// Stub — wordt overschreven door firebase.js
function scheduleFirebaseSync() {}


