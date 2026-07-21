// ProMatchXI WORKER v131
// v104: No retry Anthropic, max 5 scans/dag, scan calls naar Haiku (10x goedkoper)
// v101: Push naar owner player ID
// v100: Rate limiting /anthropic — max 15/dag per user, 150 globaal
//       Kosten tracking per call in Supabase user_costs (input/output tokens)
// v99: POST /picks endpoint, UTC timezone fix, altijd push na scan
// v98: Firebase → Supabase migratie, leagueConfig uitgebreid

const VERSION = 'v278'; // v278: bookmaker_odds als echt jsonb-OBJECT opgeslagen i.p.v. JSON.stringify (de kolom IS jsonb; stringify propte een JSON-string in jsonb = dubbel-geencodeerd, niet querybaar met ->). Direct na v277 gemeten op de eerste per-boek-rijen: bookmaker_odds kwam binnen als "{\\"Bet365\\":...}" i.p.v. {"Bet365":...}. Nu wordt raw als object aan sb() meegegeven -> proper jsonb. De ~handvol dubbel-geencodeerde rijen van vandaag zijn eenmalig genormaliseerd via SQL (#>>'{}' ::jsonb). Puur opslagformaat, geen gedrag/model/API. Rollback: raw terug naar JSON.stringify(raw) + versie -> v277. // // v277: ODDSVERGELIJKER-FUNDERING (variant C). market_consensus.bookmaker_odds was 885/885 NULL: parseConsensus haalt elke bookmaker op (tot 14) maar bewaarde alleen de mediaan en gooide de losse prijzen weg; de aanroep saveMarketConsensusSnapshot(...,null,...) gaf geen rawBooksMap door. Nu: parseConsensus bouwt _perBook {boeknaam:{h,d,a}} en schrijft naar een NIEUWE aparte param rawBooks (net als de stats-param uit v248 -- BEWUST geen veld op oddsMap, want die wordt met Object.keys/entries geteld en geitereerd = de v245-bug); runScan geeft rawBooksMap door aan fetchOddsForFixtures en aan saveMarketConsensusSnapshot. bookmaker_odds JSONB (kolom bestond al) vult zich nu per scan met de per-boek 1X2. Puur additief: geen modelwijziging, geen extra API-calls (data werd al opgehaald), geen nieuwe kolom/tabel. Alleen de runScan-collectie (3414->3433) verzamelt; de andere fetchOddsForFixtures-aanroepers (r270, r4216) geven geen rawBooks mee en zijn onaangeroerd. Dit ontgrendelt A (best-prijs-weergave) en B (vergelijkerscherm) -- die konden niet gebouwd worden op nul historie. O/U/AH-per-boek is fase 2. Rollback: de 4e param terug naar null + versie -> v276 (kolom mag gevuld blijven, additief). // // v276: API-FOUTMELDINGEN WORDEN NU GETELD EN GEMELD. De verwisseling FB_API_KEY/FOOTBALL_KEY van 19-07 legde een gat bloot: 'You are not subscribed to this API' komt van api-sports als HTTP 200 met {message:...} en ZONDER response-veld. errors.token/key (r1365) en errors.rateLimit (r1366) vingen die vorm niet, dus viel hij door naar `out = data.response || []` = [] -- niet te onderscheiden van 'geen wedstrijden'. GEMETEN 19-07 live: /apif/status, /timezone en /fixtures gaven alle drie 'not subscribed' toen de FOOTBALL_KEY-secret niet de geldige key bevatte, terwijl scan_status 'calls 5, geweigerd 0' meldde -- de gefaalde calls telden als geslaagd (0 fixtures, geen warning). Directe test tegen api-sports bewees dat de KEY zelf geldig was (Pro, 304/7500); het zat in de secret. Fix: als data.response===undefined EN data.message een niet-lege string is -> _apifApiErrors++ (alleen api-sports, net als _apifWeigeringen), luide console.warn, leeg.apiError gezet. Nieuwe kolommen scan_status.last_api_errors + scan_runs.api_errors (nullable zonder default: NULL=niet gemeten, 0=gemeten geen fout, consistent met last_refused v265). /health toont api_fouten onder apif_proxy.laatste_scan en pusht warning 'api_fout(n)' zodra n>0. Zo kan een verlopen/verkeerde/verkeerd-geplakte key nooit meer dagen stil doorlopen. GEEN modelwijziging, geen extra API-calls, alleen observability. Rollback: blob terug -> v275 (de twee kolommen mogen blijven -- nullable en additief). // // v275: PUSH + PICK-KAART TOONDEN DE VALUE-EDGE IN '%' TERWIJL HET PROCENTPUNTEN ZIJN. De value-metriek is modelkans - faire (vig-vrije) marktkans in pp (calculateValue r2114: modelProb - fairImpliedPct). Zes gebruikersgerichte plekken schreven een getal met '%' naast value/edge (worker r4006/4019 push '% value', r4028 push '% edge'; frontend v26.318 2x analyse-kaart + 2x dashboard-kaart). Een getal met '%' naast 'value' leest als rendement/EV, en dat is het NIET: +10pp is geen +10% inzetrendement (dat zou 0,69x1,83-1=+26% zijn). Alle andere schermen tonen dit al eerlijk als 'Npp' (analyse-detail, analytics 'gem. value +Npp'). GEMETEN 18-07 op de live Viking-Sandefjord Triple Lock (fixture 1494707): value 9,7 = ai_kans 69% - faire markt ~59,3% = 9,7pp; de push zei '+10% value'. Fix: eenheid '%'->'pp' op alle zes, woord 'value' behouden; r4028 tegelijk van '% edge' naar 'pp value' zodat de drie push-bodies gelijk zijn. RETRACTIE: ik stelde eerst 'edge' voor; meting toonde dat de app dit metriek al overal als 'value ...pp' schrijft, dus 'edge' zou een derde term zijn -> pp gekozen. GEEN modelwijziging: selectie/staking/opslag onaangeroerd, alleen weergavetekst. NIET AANGERAAKT (buiten scope, apart gemeld): drempel-/instellingen-/help-teksten met 'value %'; r4358 scan-test-log; calcKellyW-staking op de ruwe aiKans; de || 0-fallbacks op deze weergaveregels. Rollback: blob terug -> v274. // // v274: BURST-SPREIDING tegen de IP-throttle van api-sports. GEMETEN 18-07 op verzoek: scan_runs geeft 0,8-1,7 calls/sec GEMIDDELD per run en 0 weigeringen vandaag, maar dat gemiddelde verbergt de piek. De odds- en fixtures-collectie deed `Promise.all(ids.map(id=>apif()))` = ALLE calls in een tick. Met maxCalls=36 kon een odds-burst 36 parallelle calls worden zodra de domestic leagues starten (07-08, 24+ fixtures); dat is precies het scenario achter de stille odds-gaten van v242-v247. Vandaag onzichtbaar want maar 8 fixtures. Nieuwe helper apifChunked(items,fn,{size=6,gapMs=350}): chunks van 6 calls, dan 350ms pauze -> piek-burst 36->6, scanduur +~2s bij 36 calls. Vervangen op 5 plekken: 2x odds (fallback + goal-markten, de grootste), 3x /fixtures-settle (shadow, ah-shadow, ai-tips). VOLGORDE strikt behouden (result[i]<->items[i]) want de settle-forEach indexeert met [i]; de drie /fixtures-plekken mappen {status,value} terug naar de rauwe data-array zodat hun bestaande forEach onveranderd blijft. API_MIN_GAP hielp hier nooit tegen: dat is een gap tussen SERIELE calls, deze waren parallel. Feature-gate n.v.t. -- geen modelwijziging, alleen het aflevertempo van bestaande calls. Rollback: blob terug -> v273. // // v273: SETTLESHADOWPICKS REKENDE ALLE GOAL-MARKTEN FOUT AF. GEMETEN 18-07 tijdens de ijkslag op 114 afgerekende shadow-picks (verificatiequery rekende status onafhankelijk na tegen de opgeslagen score): 11 fout, ALLE 11 goal-markten die 'win' waren maar op 'lose' stonden, geen enkele 1X2-fout, geen enkele andersom. Oorzaak in de settle-lus: `const winner = res.home>res.away?'1':res.home<res.away?'2':'X'; const won=(r.pick===winner)`. Die kent maar drie uitkomsten; een goal-pick (O2.5/U1.5/BTTS/NOBTTS/...) is nooit gelijk aan '1'/'X'/'2', dus won was ALTIJD false -> elke goal-shadowpick werd lose ongeacht de score (28/28 op lose). Bestond sinds de goal-markten bestaan; onzichtbaar tot de varchar(1)-bug (tot v254) opgeheven werd en er echt goal-picks in shadow_picks kwamen. Fix: resolveShadowPick(pick,h,a) -> 'win'|'lose'|null met dezelfde regels als de verificatiequery; null (onbekende markt) wordt NIET afgerekend maar blijft pending met een luide warning -- een lose wegschrijven voor een markt die de code niet kent is een onware bewering over de uitkomst. Score-definitie: 90 min (score.fulltime met terugval op goals), bewust gelijkgetrokken met de AH-tak -- O/U en BTTS rekenen op reguliere speeltijd, niet op AET/PEN. DATA: de 11 fout-afgerekende picks los gecorrigeerd via SQL (lose->win), narekenbaar per rij uit de opgeslagen score, geen schatting. 1X2-tak ongemoeid (was correct). Raakt de meetketen die v_shadow_performance voedt, dus vooraf gemeld en akkoord (Rob: fix + 11 corrigeren + eindstand zonder verlenging). Geen modelwijziging. // // v272: SCAN_RUNS ONDERSCHEIDT NU 'OVERGESLAGEN' VAN 'MISLUKT'. GEMETEN 18-07 06:49 UTC (force-scan onder v271): with_odds=8 maar matches_analysed=0 en picks_saved=0, fout=null. Uitgezocht in de bron, niet geraden: de cron van 06:00 had die 8 duels al geanalyseerd en per stuk een rij in ai_analysis_log gezet; 49 min later zag selecteerTeAnalyseren dezelfde odds (gelijk() op home/draw/away) en een analyse < MAX_AGE (49 < 360 min) en sloeg alle 8 over -> teAnalyseren leeg -> analyseBatch.length=0. Correct gedrag (temperature 0: zelfde input, zelfde antwoord, geen AI-call verspild), GEEN bug. Maar de telemetrie kon 'niets te doen' niet onderscheiden van 'alles gefaald': beide waren matches_analysed=0. Nieuwe kolom scan_runs.analysis_skipped = kandidatenAlles.length - teAnalyseren.length, precies het 'over'-getal dat tot nu toe alleen in een logregel binnen selecteerTeAnalyseren stond -- dezelfde blinde vlek als candidates_removed voor v269, nu de vierde keer. Nullable zonder default (NULL=niet gemeten voor oude rijen, 0=gemeten niets overgeslagen); in het geen-wedstrijden-pad expliciet 0 want daar draait de filter niet maar zijn er ook nul kandidaten. Geschreven via dezelfde gedeelde g als de rest van scan_runs. LEESREGEL vanaf nu: matches_analysed=0 met analysis_skipped=with_odds is 'niets te doen'; matches_analysed=0 met analysis_skipped=0 EN with_odds>0 is verdacht -- dan is er iets stroomopwaarts gevallen. Geen modelwijziging, geen extra API-calls, alleen observability. // // v271: TWEE REPARATIES, ALLEBEI IN DE MEETKETEN. (1) HANDMATIGE SCAN KEEK MINDER VER VOORUIT DAN DE AUTOMATISCHE. `timeWindow = force ? endOfDay : nowMs + 24u` -- de force-tak stopte bij het einde van vandaag, de cron-tak keek 24 uur vooruit. GEMETEN 17-07 23:09 UTC (01:09 NL, force-scan onder v269): scan_runs zegt matches_total=0 bij 2 api-calls en 0 weigeringen, terwijl dezelfde vraag aan de echte API (via de proxy, 18-07 04:40) 8 fixtures in het 24u-venster gaf: 7x Eliteserien, 1x Allsvenskan (AIK-Gais) en WK France-England. De 17-07-fixtures waren om 01:09 NL al FT, die van 18-07 beginnen >= 12:00 UTC en vielen dus buiten endOfDay(17-07). Strikt genomen geen onware bewering -- 0 IS het aantal in dat venster -- maar wel een venster dat de handmatige scan waardeloos maakt op precies het moment dat je verifieert, en het maakte de tweede meting ('draait de scan nog?') onnodig verwarrend. Bijvangst: `new Date(today + 'T23:59:59')` werd als UTC geparsed terwijl de fixtures als Europe/Amsterdam binnenkomen -- twee tijdzones in een vergelijking, de familie waar v254 uit voortkwam. endOfDay is weg, er is nu EEN venster. (2) FALSY-ZERO IN sbUpdateScanStatus: last_pick_count/last_match_count/last_with_odds/last_without_odds/scans_today gingen met `|| 0` de database in. Dat maakt undefined (niet gemeten) en een gemeten 0 ononderscheidbaar, en de nul is de kant die een bewering doet zonder bron. De scan_runs-schrijf eronder deed dit sinds v269 al goed met Number.isFinite; nu delen beide dezelfde module-brede _g -- twee kopieen van dezelfde regel lopen uit elkaar (les van v265). Alle vijf kolommen zijn nullable (geverifieerd in information_schema), beide aanroepplekken geven altijd een echt getal mee, dus dit is een vangnet en geen gedragswijziging. NIET AANGERAAKT (buiten scope): de lezers doen zelf nog `|| 0` (sbGetScanStatus r~472, /health r~4993) -- null-veilig, maar dezelfde familie. GEMETEN EN GOED, geen actie: de odds-only crons van 23-04 UTC draaiden alle zes vannacht (odds_snapshots: 7 fixtures per uur op 23/00/01/02/03/04). Dat last_scan 's nachts stilstaat is by design -- snapshotOddsOnly schrijft scan_status bewust niet weg. // // v270: 'VERWIJDER CONFLICTERENDE PICK' VERWIJDERDE NIETS. De code deed `delete cleanedExisting[k]` -- puur geheugen -- terwijl sbSavePicks UITSLUITEND upsert (on_conflict=id) en nooit verwijdert. De rij bleef in Supabase staan, werd gewoon afgerekend, en de logregel 'Verwijder conflicterende bestaande pick' was een onware bewering over de buitenwereld. v136 ('max 1 pick per wedstrijd') werkte daardoor alleen BINNEN een scan, nooit tegen wat er al stond. GEMETEN 17-07: Acassuso vs Central Norte en Atlanta vs Gimnasia Jujuy hebben allebei 1=win EN 2=lose -- thuis en uit tegelijk, 4 van de 21 picks, 2 bij voorbaat kansloos. Opgevallen doordat Rob vroeg waarom een wedstrijd 2x in de analyse stond. Fix: status 'replaced' i.p.v. verwijderen -- het spoor blijft herleidbaar, handleGetPicks filtert al op pending/win/lose dus de app ziet hem niet, settle pakt alleen 'pending' dus hij rekent niet af. PATCH staat NA sbSavePicks, anders schrijft de upsert de status er weer overheen, en filtert op status=eq.pending zodat een al afgerekende pick nooit geraakt wordt. v_clv_gaps aangepast van 'status <> pending' naar 'status in (win,lose)': anders had elke replaced-pick wekelijks vals CLV-alarm gegeven. v_health telt picks_replaced apart, zodat picks_total = pending + settled blijft kloppen. De 4 bestaande picks van 06-06 zijn NIET aangeraakt: die zijn afgerekend, en dat terugdraaien is geschiedenis herschrijven. // // v269: SCAN-TELEMETRIE BEWAARD. scan_status is 1 rij die elke scan wordt overschreven, dus 'is het rate-limitprobleem weg?' en 'zakt de odds-dekking op zaterdagmiddag?' waren alleen met giswerk te beantwoorden -- precies wat er in de wekelijkse doorlichting onder 'niet kunnen controleren' bleef staan terwijl het meetbaar had gekund. Nieuwe tabel scan_runs: 1 rij per scan met wedstrijden, odds-dekking, opgeslagen picks, VERWORPEN kandidaten, api-calls, weigeringen, route en duur. candidates_removed is het getal dat de v268-bug onthulde en daarna in een ongelezen logregel verdween -- dezelfde blinde vlek als odds_dekking, nu de derde keer. Wegschrijven gebeurt IN sbUpdateScanStatus, niet op de twee aanroepplekken apart: die mogen niet uit elkaar lopen (les van v265). Alle kolommen nullable zonder default: NULL = niet gemeten, 0 = gemeten. In het geen-wedstrijden-pad zijn de nullen GEMETEN en dus 0, niet NULL. Ontkoppelde catch met console.error: telemetrie mag een scan nooit laten mislukken, maar moet wel luid falen -- een stille catch maakt 'geen data' en 'schrijffout' ononderscheidbaar. RLS aan, geen policies: alleen de worker komt erbij, de app leest gewoon scan_status. Observability, geen modelwinst. // // v268: PUSHBERICHTEN NOEMDEN PICKS DIE NIET BESTONDEN. GEMETEN 17-07 21:00 op France vs England (fixture 1591865): de push zei 'Minder dan 2.5 goals @ 2.75 · +7% edge', maar in `picks` stond U3.5 @ 1.73 en in `shadow_picks` NOBTTS @ 2.75 -- het gepushte label bestond in GEEN van beide. Oorzaak: alle push-takken en newCount lazen uit `newPicks` (ALLE kandidaten), terwijl sbSavePicks alleen `deduplicatedNew` wegschrijft (r3720: max 1 pick per wedstrijd). Erger: de push sorteerde op `value` alleen, de opslag op `confidenceFinal × value` -- twee criteria, dus twee verschillende winnaars. U2.5 won op value (gepusht), U3.5 op conf×value (opgeslagen). De gebruiker kreeg een markt en quotering te zien die het model bewust had VERWORPEN: een bewering over de buitenwereld zonder bron, dus een CIJFERBRON-schending. Tweede gevolg: newCount telde verworpen kandidaten mee ('2 picks toegevoegd' bij 1 opgeslagen) en ging via lastPickCount de database in -- scan_status.last_pick_count stond structureel te hoog, en daarmee elke afgeleide telling. Beide sets bestonden al sinds v136; alleen de verkeerde werd geconsumeerd, en dat is nooit opgevallen omdat het pas zichtbaar wordt als één wedstrijd meerdere kandidaten oplevert -- wat door de varchar(1)-bug (tot v254) bij goal-markten nooit gebeurde. Alle publicatie leest nu uit `opgeslagenNieuw` = deduplicatedNew. // // v267: TWEE REPARATIES. (1) v266 kwam nooit live: ik pushte wrangler.toml en cloudworker.js 1,5s na elkaar, wat TWEE deploys gaf. De deploy van de wrangler-commit bevatte nog de OUDE cloudworker (v265), startte eerder maar eindigde 9s later, en overschreef v266. Live stond daardoor de nieuwe cron (06-22) MET de oude code (fullScan = 6 || 12-22): de uren 07-11 UTC vuurden wel maar vielen in de else-tak en draaiden als odds-only snapshots -- precies het 'lijkt gefixt maar is het niet' dat in de v266-changelog als risico stond. LES: meerdere bestanden nooit als losse commits pushen als ze samen moeten deployen; gebruik één commit (Git Trees API) of zet concurrency op de workflow. (2) Lint faalde sinds v265: de api-tellers stonden onder apiSportsHost (r~1200) maar worden al op r~395 gebruikt door sbUpdateScanStatus (no-use-before-define). Werkt op runtime, maar de workflow brak erop en dat had ik moeten zien. Tellers staan nu boven hun eerste gebruiker. Inhoudelijk identiek aan v266: fullScan = hour >= 6 && hour <= 22. // // v266: SCANGAT 07:00-11:00 UTC GEDICHT. De cron draaide 06:00 en 12:00-22:00 UTC; tussen 07:00 en 11:00 UTC (09:00-13:00 NL) gebeurde er niets. GEMETEN 17-07 op echte fixtures van het openingsweekend: het VASTE Eredivisie/KKD-blok van zondag 12:15 NL ligt op 10:00 UTC, dus middenin dat gat (Sparta-Feyenoord, MVV-Jong Utrecht op 09-08). Laatste scan ervoor was 06:00 UTC -- ruim 4 uur eerder -- en de volgende kwam pas toen de wedstrijd al liep. Twee gevolgen: late waarde werd gemist EN de CLV-closing voor die wedstrijden was een lijn van 4 uur oud, wat geen closing line is en juist het beoordelingscijfer van het model vervuilt. Elk weekend opnieuw, want dat 12:15-slot is vast. Nu fullScan = hour >= 6 && hour <= 22 (17 scans/dag, was 12) + wrangler crons '0 6-22 * * *'. CRON EN CODE MOETEN SAMEN: alleen de cron verruimen zou 07-11 UTC als odds-only snapshots laten draaien -- dat lijkt gefixt maar is het niet. Ook het /health-venster (activeHours) gelijkgetrokken, anders meldt health 'scan te laat' op uren die niet bestaan. Kosten: ~+125 calls/dag op een verbruik van ~250 van 7500. Bijvangst: één doorlopend bereik haalt de 'twee betekenissen van dezelfde variabele'-val weg waar de v254-bug uit voortkwam. // // v265: WEIGERINGEN WORDEN NU GETELD. Tot nu toe stonden de api-sports-weigeringen alleen als console.warn in de worker-logs: achteraf onleesbaar en dus niet te vergelijken voor/na de proxy. Precies dezelfde blinde vlek als bij odds_dekking, dat maandenlang wel werd weggeschreven maar door niemand bekeken werd. scan_status krijgt last_refused / last_api_calls / last_via; /health toont ze onder apif_proxy.laatste_scan. Kolommen bewust NULLABLE ZONDER DEFAULT: NULL = 'deze scan heeft niet geteld' (scans van voor v265), 0 = 'geteld, niets geweigerd'. Een default 0 zou over oude scans beweren dat er niets geweigerd was -- een stille onwaarheid over de buitenwereld. sbUpdateScanStatus leest de tellers ZELF uit i.p.v. via het meegegeven object, want er zijn twee aanroepplekken (r3160 en r3719) en die mogen niet uit elkaar lopen. resetApifTellers() staat als eerste regel van runScan: isolates worden hergebruikt, dus zonder reset tellen de cijfers van de vorige scan mee. GEMETEN 17-07 21:01 (eerste scan onder v264, via de proxy): 6 wedstrijden, 8/8 odds, 0 zonder odds, 2 picks, geen warnings -- maar of er weigeringen waren was NIET vast te stellen, en dat gat dicht deze versie. // // v264: api-sports loopt nu via onze eigen proxy (apif.promatchxi.app, Hetzner, vast IP 138.201.189.10) ZODRA env.PROXY_SECRET bestaat; zonder dat secret verandert er niets en gaat alles rechtstreeks -- dat is meteen het rollback-pad. AANLEIDING: api-sports support (Kevin, 17-07-2026) bevestigde dat hun anti-abuse op het UITGAANDE IP telt, niet op de key. Cloudflare Workers delen hun egress-IP's met vreemden, dus werden onze calls geweigerd op 2,1% van de daglimiet (gemeten 17-07 13:00: 4 van 8 parallelle calls geweigerd met dezelfde key). Verhoging van API_MIN_GAP hielp aantoonbaar niet -- het was nooit ons volume. Eén helper apiSportsHost() voor beide aanroepplekken (apif + handleAPIFootball), zodat ze niet uit elkaar kunnen lopen. Nieuw: header X-APIF-Via (proxy|direct) -- bewust naast X-APIF-Host i.p.v. die te wijzigen, want daar kan iets op lezen. /health toont apif_proxy met een SHA-256-vingerafdruk (8 tekens) van het secret, zodat te meten is of beide kanten dezelfde waarde hebben zonder het secret ergens te tonen. De proxy kent de api-key NIET: die gaat mee in de header en wordt ongewijzigd doorgezet; het X-Proxy-Secret wordt eraf gehaald voor het naar api-sports gaat. Foutstatussen gaan ongewijzigd door (429 blijft 429 incl. Retry-After) -- geen fout die als 200-met-tekst aankomt. RapidAPI-fallback ONGEMOEID (buiten scope; die werkt nog steeds niet, apart abonnement nodig). // // v263: /push STOND WAGENWIJD OPEN. Gemeten live 17-07: POST /push met een leeg body gaf HTTP 400 ('title en body verplicht') en geen 401 -- de route verwerkte dus een anonieme POST en weigerde die alleen op ontbrekende velden. Met titel+tekst erin kon iedereen op internet een melding met vrije tekst op het toestel van ELKE gebruiker zetten. Nu requireAdmin. Gevonden terwijl ik een simpele vraag beantwoordde ('welke knop moet ik testen?'); de derde open/misgerichte push op rij, na /scan-now (v259) en de scan-test-push (v260). TWEEDE HELFT, in de frontend (v26.314): sendOneSignalValuePush() is weg. Die werd aangeroepen vanuit de LOKALE analyse van elke gebruiker en POSTte naar /push, dat naar included_segments ['Total Subscriptions'] stuurt -- dus vond een willekeurige gebruiker een value-pick, dan kreeg het hele gebruikersbestand daar een melding van. De meegestuurde player_id las handlePush niet eens uit. Bovendien dubbelop: de lus erboven stuurde al sendValueNotification() voor ELKE sterke pick. En het commentaar 'ook als app dicht' klopte niet -- die code draait alleen mét de app open, dus een lokale notificatie volstaat. Dat is nu het enige pad: service worker, alleen dit toestel, geen server. De else-tak wees naar toto-ai.zweetzakken.workers.dev (gemeten: HTTP 404, dood). Owner-only i.p.v. de route slopen: even veilig, omkeerbaar, en ik kan niet uitsluiten dat er een oude client op zit. NOG DOOD, niet aangeraakt (buiten scope): notifications.js roept /push/subscribe en /push/send aan -- die routes bestaan niet in de worker.

// v225: omhoog verplaatst. snapshotOddsOnly (r157) las hem, terwijl de declaratie op r1617 stond.
// Runtime veilig (de cron draait na module-init), maar dezelfde vorm als de TDZ-bug van v26.265 --
// en eslint no-use-before-define kan die twee niet uit elkaar houden. Declaratie boven het gebruik.
const ENABLE_GOAL_MARKETS = true; // productie-cron: goal-markten (O/U 1.5/2.5/3.5 + BTTS) als volwaardige picks
const FB_DB = 'https://toto-ai-397cb-default-rtdb.europe-west1.firebasedatabase.app';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key, anthropic-version, Authorization, x-user-anthropic-key',
};

// v115: jeugd-/onder-teams (U15–U23) hebben vrijwel nooit weddenschapsmarkten en
// verdringen bettable wedstrijden uit de analyse-slots → uitsluiten in scans.
const YOUTH_RE = /\bU-?(1[5-9]|2[0-3])\b/i;
const isYouthMatch = (home, away) => YOUTH_RE.test(home || '') || YOUTH_RE.test(away || '');

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS }
  });
}

// ── HMAC token verificatie ────────────────────────────────
// Token = HMAC-SHA256(SCAN_SECRET + timestamp_minute)
// Geldig binnen TOKEN_WINDOW_MINUTES minuten
const TOKEN_WINDOW_MINUTES = 2;

async function generateHMAC(secret, timestampMinute) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(String(timestampMinute));
  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, msgData);
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyHMAC(token, secret) {
  if (!token || !secret) return false;
  const nowMinute = Math.floor(Date.now() / 60000);
  // Check huidige minuut + vorige window (TOKEN_WINDOW_MINUTES)
  for (let i = 0; i <= TOKEN_WINDOW_MINUTES; i++) {
    const expected = await generateHMAC(secret, nowMinute - i);
    if (token === expected) return true;
  }
  return false;
}

// ── Firebase ID-token verificatie (v259) ──────────────────
// Waarom naast HMAC en niet in plaats daarvan: een HMAC-token is afgeleid van SCAN_SECRET, dus
// alles wat mag scannen moet die secret kennen. In een frontend betekent dat: de secret in publieke
// JS zetten. Precies dat deed dashboard.js r234, en het sneuvelde stil toen de secret geroteerd
// werd — de knoppen geven sindsdien 401. Gemeten 17-07: de constante in dashboard.js geeft 401 op
// /app-users, de waarde uit Cloudflare env geeft 200. De publieke constante is dus een DODE secret,
// geen lek — maar ook geen werkende knop. Een Firebase ID-token heeft dat probleem niet: door
// Google ondertekend, kortlevend, en de frontend hoeft geen enkel geheim te kennen.
//
// Live geverifieerd bij de bron vóór dit geschreven werd (17-07):
//   /toto-ai-397cb/.well-known/openid-configuration -> iss = https://securetoken.google.com/toto-ai-397cb,
//   id_token_signing_alg_values_supported = ['RS256'], jwks_uri = onderstaande FB_JWK_URL
//   FB_JWK_URL -> 4 sleutels, alle RS256/RSA/use=sig, cache-control max-age=19945
//
// OWNER_UIDS staat bewust als constante, niet in env: een Firebase-UID is een identifier, geen
// credential. Wie hem kent kan er niets mee — het token is door Google ondertekend, niet door ons.
// Hij staat trouwens al publiek in dashboard.js (ADMIN_UIDS). Scheelt een env-wijziging.
const FB_PROJECT_ID = 'toto-ai-397cb';
const FB_JWK_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const OWNER_UIDS = new Set(['NpbaXO16xwha4Dm4Jgn9RqTM9Fq1']);
let _jwkCache = { keys: null, exp: 0 };

async function fbAuthJwks() {
  const now = Date.now();
  if (_jwkCache.keys && now < _jwkCache.exp) return _jwkCache.keys;
  const res = await fetch(FB_JWK_URL);
  if (!res.ok) throw new Error(`JWKS ophalen mislukt: HTTP ${res.status}`); // v259: GEEN lege array/false hier.
  // Een mislukte JWKS-fetch is geen "token ongeldig" — dat zou een fetch-fout vermommen als een
  // uitspraak over de gebruiker. Dit gooit, de aanroeper vertaalt het naar 503, niet naar 401.
  const data = await res.json();
  if (!Array.isArray(data?.keys) || !data.keys.length) throw new Error('JWKS leeg');
  const cc = res.headers.get('cache-control') ?? '';
  const m = /max-age=(\d+)/.exec(cc);
  const maxAge = m ? parseInt(m[1], 10) : 3600; // ternair op de match, niet `maxAge || 3600`: max-age=0 is geldig
  _jwkCache = { keys: data.keys, exp: now + maxAge * 1000 };
  return data.keys;
}

function _b64urlBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function verifyFirebaseIdToken(idToken) {
  if (!idToken) return { ok: false, reason: 'geen token' };
  const parts = idToken.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'geen JWT' };

  let header, payload;
  try {
    header  = JSON.parse(new TextDecoder().decode(_b64urlBytes(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(_b64urlBytes(parts[1])));
  } catch { return { ok: false, reason: 'header/payload onleesbaar' }; }

  // alg vastpinnen: anders is 'none' of HS256-met-de-publieke-sleutel een klassieke bypass.
  if (header.alg !== 'RS256') return { ok: false, reason: `alg=${header.alg}, RS256 verwacht` };
  if (!header.kid) return { ok: false, reason: 'geen kid' };

  const jwk = (await fbAuthJwks()).find(k => k.kid === header.kid);
  if (!jwk) return { ok: false, reason: 'kid onbekend bij Google' };

  const key = await crypto.subtle.importKey('jwk', jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key,
    _b64urlBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!ok) return { ok: false, reason: 'handtekening ongeldig' };

  // Claims pas NA de handtekening: op een onondertekend payload is elke claim waardeloos.
  const now = Math.floor(Date.now() / 1000);
  const SKEW = 60;
  if (typeof payload.exp !== 'number' || payload.exp + SKEW < now) return { ok: false, reason: 'verlopen' };
  if (typeof payload.iat !== 'number' || payload.iat - SKEW > now) return { ok: false, reason: 'iat in de toekomst' };
  if (payload.aud !== FB_PROJECT_ID) return { ok: false, reason: 'aud klopt niet' };
  if (payload.iss !== `https://securetoken.google.com/${FB_PROJECT_ID}`) return { ok: false, reason: 'iss klopt niet' };
  if (!payload.sub) return { ok: false, reason: 'geen sub' };

  return { ok: true, uid: payload.sub, email: payload.email ?? null };
}

// v259: één poort voor de beheer-endpoints. Twee paden, want ze lossen verschillende dingen op:
// HMAC/secret = handmatige curl met de waarde uit Cloudflare env; Firebase = de knoppen in de app,
// zónder enig geheim in de frontend. Volgorde is bewust: HMAC is lokaal en kost niets, de
// owner-check kan een JWKS-fetch kosten (gecached op Google's eigen max-age).
// allowSecret alleen waar de route dat al accepteerde (/scan-test) — geen surface erbij.
async function requireAdmin(request, env, url, allowSecret) {
  const token = url.searchParams.get('token');
  if (token && await verifyHMAC(token, env.SCAN_SECRET)) return { ok: true, via: 'hmac' };
  if (allowSecret) {
    const secret = url.searchParams.get('secret');
    if (secret && secret === env.SCAN_SECRET) return { ok: true, via: 'secret' };
  }
  const h = request.headers.get('Authorization') ?? '';
  if (!h.startsWith('Bearer ')) return { ok: false, reason: 'geen geldige token en geen Bearer-header' };
  let r;
  try {
    r = await verifyFirebaseIdToken(h.slice(7).trim());
  } catch (e) {
    // JWKS onbereikbaar: dat is ONZE storing, niet "jij mag niet". 503, geen 401.
    return { ok: false, reason: `tokencontrole niet uitvoerbaar: ${e.message}`, status: 503 };
  }
  if (!r.ok) return { ok: false, reason: r.reason };
  if (!OWNER_UIDS.has(r.uid)) return { ok: false, reason: 'geen owner' };
  return { ok: true, via: 'firebase', uid: r.uid };
}

async function fb(env, path, method = 'GET', body = null) {
  try {
    const res = await fetch(`${FB_DB}/${path}.json?auth=${env.FB_API_KEY}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : null
    });
    return await res.json();
  } catch(e) {
    console.error('FB error', e);
    return null;
  }
}

// ── Supabase helper ──────────────────────────────────────
async function sb(env, table, method = 'GET', body = null, query = '') {
  try {
    const url = `${env.SUPABASE_URL}/rest/v1/${table}${query}`;
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_KEY}`,
        'Prefer': query.includes('on_conflict')
          ? 'return=minimal,resolution=merge-duplicates'
          : method === 'POST' ? 'return=minimal' : 'return=representation',
      },
      body: body ? JSON.stringify(body) : null,
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[SB] ${method} ${table} fout ${res.status}:`, err);
      return null;
    }
    if (method === 'POST' || method === 'DELETE') return true;
    return await res.json();
  } catch(e) {
    console.error('[SB] fetch fout:', e);
    return null;
  }
}

// ── Supabase: odds snapshots opslaan ─────────────────────
async function saveOddsSnapshots(oddsMap, matches, env) {
  const today = new Date().toISOString().split('T')[0];
  const rows = [];
  matches.forEach(m => {
    const odds = oddsMap[m.fixtureId];
    if (!odds) return;
    const row = {
      fixture_id: m.fixtureId,
      bookmaker: 8,
      home_odds: odds.home,
      draw_odds: odds.draw,
      away_odds: odds.away,
      match_date: m.matchDate || today,
      league_id: m.leagueId || null,
      captured_at: new Date().toISOString(),
    };
    // v175: closing O/U + BTTS meeschrijven (voor CLV op doelpunten-markten) — alleen indien aanwezig
    if (odds.ou || odds.btts || odds.ah) {
      const ou = {};
      for (const line of ['1.5', '2.5', '3.5']) if (odds.ou?.[line]) ou[line] = { over: odds.ou[line].over, under: odds.ou[line].under };
      // v220: AH-curve meeschrijven. parseGoalConsensus (v205/v213) bouwt odds.ah al op uit dezelfde
      // per-fixture call, maar hij werd nooit gepersisteerd -> AH-shadow kon per definitie geen CLV krijgen,
      // juist de metriek die moet beslissen of AH uit shadow mag. Nul extra API-calls.
      const ah = {};
      if (odds.ah) for (const k of Object.keys(odds.ah)) ah[k] = { home: odds.ah[k].home, away: odds.ah[k].away };
      row.goal_odds = {
        ou,
        btts: odds.btts ? { yes: odds.btts.yes, no: odds.btts.no } : null,
        ah: Object.keys(ah).length ? ah : null,
      };
    }
    rows.push(row);
  });
  if (!rows.length) return;
  await sb(env, 'odds_snapshots', 'POST', rows); // v122: append -> oddshistorie (opening->closing)
  console.log(`[SB] ${rows.length} odds snapshots opgeslagen`);
}

// ── Lichte snapshot-run voor late kickoffs (cron-gap 23-05 UTC) ──
// v156: WK 2026 (Amerika's) trapt vaak 23:00-05:00 UTC af — buiten de hoofd-cron (06 + 12-22).
// Deze run ververst alleen de odds van fixtures die de hoofdscan AL volgt (zelfde league-set,
// geen drift), zodat hun slotkoers vers blijft. Geen AI, geen picks, geen settlement.
async function snapshotOddsOnly(env) {
  try {
    const today    = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const rows = await sb(env, 'odds_snapshots', 'GET', null,
      `?match_date=in.(${today},${tomorrow})&select=fixture_id,league_id,match_date`);
    const seen = new Set();
    const matches = (rows || [])
      .filter(r => r.fixture_id && !seen.has(r.fixture_id) && seen.add(r.fixture_id))
      .map(r => ({ fixtureId: r.fixture_id, leagueId: r.league_id, matchDate: r.match_date }));
    if (!matches.length) { console.log('[Snapshot-only] geen getrackte fixtures'); return; }
    const ids = matches.map(m => m.fixtureId);
    // v219: enableGoals AAN — deze run levert de slotkoers voor late kickoffs (23-05 UTC).
    // Zonder deze vlag bleef goal_odds NULL en was CLV op O/U + BTTS onmogelijk voor juist die fixtures.
    const oddsMap = await fetchOddsForFixtures(ids, env, 20, ENABLE_GOAL_MARKETS); // geen AI; ruim binnen subrequest-budget
    await saveOddsSnapshots(oddsMap, matches, env);
    console.log(`[Snapshot-only] ${Object.keys(oddsMap).length}/${ids.length} fixtures ververst`);
  } catch(e) { console.error('[Snapshot-only] fout:', e.message); }
}

// ── Supabase: picks ophalen ──────────────────────────────
async function sbGetPicks(env) {
  const rows = await sb(env, 'picks', 'GET', null,
    '?select=*&order=last_scan_at.desc&limit=200'
  ) || [];
  const result = {};
  rows.forEach(r => {
    result[r.id] = {
      fixtureId: r.fixture_id, home: r.home, away: r.away,
      matchName: r.match_name, matchDate: r.match_date, matchTime: r.match_time,
      leagueId: r.league_id, leagueName: r.league_name,
      pick: r.pick, pickLabel: r.pick_label,
      odds: r.odds ? parseFloat(r.odds) : null,
      value: r.value ? parseFloat(r.value) : null,
      aiKans: r.ai_kans, confidence: r.confidence ? parseFloat(r.confidence) : null,
      confidenceRaw: r.confidence_raw ? parseFloat(r.confidence_raw) : null,
      confidenceFinal: r.confidence_final,
      leagueFactor: r.league_factor ? parseFloat(r.league_factor) : null,
      bucketFactor: r.bucket_factor ? parseFloat(r.bucket_factor) : null,
      oddsMovement: r.odds_movement ? parseFloat(r.odds_movement) : null,
      marketSignal: r.market_signal, elite: r.elite,
      calibFactor: r.calib_factor ? parseFloat(r.calib_factor) : null,
      poissonK1: r.poisson_k1, poissonKX: r.poisson_kx, poissonK2: r.poisson_k2,
      scanCount: r.scan_count, lockLevel: r.lock_level,
      lastScanAt: r.last_scan_at, firstScanAt: r.first_scan_at,
      status: r.status, score: r.score, processed: r.processed,
      verifiedAt: r.verified_at, source: r.source,
    };
  });
  return result;
}

// ── Supabase: picks opslaan (upsert) ─────────────────────
async function sbSavePicks(picksObj, env) {
  const rows = Object.entries(picksObj).map(([key, p]) => ({
    id: key,
    fixture_id: p.fixtureId, home: p.home, away: p.away,
    match_name: p.matchName, match_date: p.matchDate || null,
    match_time: p.matchTime || null, league_id: p.leagueId || null,
    league_name: p.leagueName || null, pick: p.pick, pick_label: p.pickLabel || null,
    odds: p.odds || null, value: p.value || null, ai_kans: p.aiKans || null,
    confidence: p.confidence || null, confidence_raw: p.confidenceRaw || null,
    confidence_final: p.confidenceFinal || null,
    league_factor: p.leagueFactor || null, bucket_factor: p.bucketFactor || null,
    odds_movement: p.oddsMovement || null, market_signal: p.marketSignal || null,
    elite: p.elite || false, calib_factor: p.calibFactor || null,
    poisson_k1: p.poissonK1 || null, poisson_kx: p.poissonKX || null, poisson_k2: p.poissonK2 || null,
    scan_count: p.scanCount || 1, lock_level: p.lockLevel || 'single',
    last_scan_at: p.lastScanAt || new Date().toISOString(),
    first_scan_at: p.firstScanAt || new Date().toISOString(),
    status: p.status || 'pending', score: p.score || null,
    processed: p.processed || false, verified_at: p.verifiedAt || null,
    source: p.source || 'scheduled', updated_at: new Date().toISOString(),
    // v135: sharp engine velden
    sharp_score: p.sharpScore || null, sharp_tier: p.sharpTier || null, sharp_divergence: p.sharpDivergence || null,
  }));
  if (!rows.length) return;
  // v105: fixture_id extraheren uit id als het NULL is (legacy picks)
  rows.forEach(r => {
    if (!r.fixture_id && r.id) {
      const m = String(r.id).match(/^(\d+)_/);
      if (m) r.fixture_id = parseInt(m[1]);
    }
  });
  await sb(env, 'picks', 'POST', rows, '?on_conflict=id');
  console.log('[SB] ' + rows.length + ' picks upserted');
}

// ── Supabase: calibration ophalen ────────────────────────
async function sbGetCalibration(env) {
  const rows = await sb(env, 'league_calibration', 'GET', null, '?select=*') || [];
  const result = {};
  rows.forEach(r => {
    result[r.league_id] = {
      leagueName: r.league_name, wins: r.wins, total: r.total,
      roi: parseFloat(r.roi), avgValue: parseFloat(r.avg_value),
      avgConf: parseFloat(r.avg_conf), clvSum: parseFloat(r.clv_sum),
      clvCount: r.clv_count, factor: parseFloat(r.factor),
      historicalHitrate: r.historical_hitrate ? parseFloat(r.historical_hitrate) : null,
      historicalRoi: r.historical_roi ? parseFloat(r.historical_roi) : null,
      totalPicks: r.total_picks, weeklyUpdatedAt: r.weekly_updated_at,
      lastUpdated: r.last_updated,
    };
  });
  return result;
}

// ── Supabase: calibration opslaan (upsert) ───────────────
async function sbSaveCalibration(calibObj, env) {
  const rows = Object.entries(calibObj).map(([lid, c]) => ({
    league_id: lid, league_name: c.leagueName || null,
    wins: c.wins || 0, total: c.total || 0, roi: c.roi || 0,
    avg_value: c.avgValue || 0, avg_conf: c.avgConf || 0,
    clv_sum: c.clvSum || 0, clv_count: c.clvCount || 0, factor: c.factor || 1.0,
    historical_hitrate: c.historicalHitrate || null,
    historical_roi: c.historicalRoi || null,
    total_picks: c.totalPicks || 0, weekly_updated_at: c.weeklyUpdatedAt || null,
    last_updated: new Date().toISOString(),
  }));
  if (!rows.length) return;
  await sb(env, 'league_calibration', 'POST', rows, '?on_conflict=league_id');
  console.log('[SB] ' + rows.length + ' league calibraties opgeslagen');
}

// v265: TELLERS voor wat api-sports met ons doet binnen één scan.
// v267: naar boven verplaatst -- stonden onder apiSportsHost (r~1200) maar worden
// al op r~395 gebruikt door sbUpdateScanStatus. Werkt op runtime (modulescope, en
// de functie draait pas na module-evaluatie), maar ESLint keurt het terecht af
// (no-use-before-define) en de Lint-workflow faalde erop sinds v265.
// Waarom modulescope: één scan draait in één worker-invocatie, dus deze tellers
// overspannen precies die scan. resetApifTellers() MOET aan het begin van elke
// scan draaien -- een isolate wordt hergebruikt en zou anders de cijfers van de
// vorige scan meetellen.
// NULL vs 0: `_apifGemeten` blijft false tot er geteld is. 0 weigeringen is een
// meting; "niet gemeten" is dat niet. Die twee mogen nooit hetzelfde lijken.
let _apifWeigeringen = 0;   // elke geweigerde poging (3 per call mogelijk)
let _apifCalls = 0;         // aantal api-sports-calls
let _apifVia = null;        // 'proxy' | 'direct'
let _apifApiErrors = 0;     // v276: api-sports gaf een message-fout i.p.v. data (bv. 'not subscribed')
let _apifGemeten = false;
let _scanStart = null;      // v269: voor duration_ms in scan_runs

function resetApifTellers() {
  _apifWeigeringen = 0;
  _apifCalls = 0;
  _apifApiErrors = 0; // v276
  _apifVia = null;
  _apifGemeten = true;
  _scanStart = Date.now();
}

// v269: bewaartermijn scan_runs. Zonder dit groeit de tabel eeuwig door (17 scans/dag
// ~ 6.200 rijen/jaar -- klein, maar ongelimiteerd groeien is geen ontwerp).
// 90 dagen dekt de doorlichting, de proxy-bewijsvoering (23-07, 07-08) en de
// draw-evaluatie van eind augustus ruimschoots.
async function opruimenScanRuns(env) {
  const grens = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const ok = await sb(env, 'scan_runs', 'DELETE', null, `?run_at=lt.${grens}`);
  // sb() geeft null terug bij een fout: dat expliciet melden, niet stil doorgaan.
  if (ok === null) console.error('[ScanRuns] opruimen mislukt');
  else console.log(`[ScanRuns] rijen ouder dan ${grens.slice(0, 10)} opgeruimd`);
}

// ── Supabase: scan_status updaten ────────────────────────
// v271: NULL = niet gemeten, 0 = gemeten. Bewust boven de eerste gebruiker (v267: const is niet
// gehoist, en eslint no-use-before-define brak de workflow toen de api-tellers eronder stonden).
const _g = (v) => (Number.isFinite(v) ? v : null);

async function sbUpdateScanStatus(data, env) {
  await sb(env, 'scan_status', 'POST', [{
    id: 'current',
    last_run: data.lastRun || new Date().toISOString(),
    scan_date: data.scanDate || null,
    // v271: `|| 0` weg. Op een numeriek veld maakt dat een NIET-gemeten waarde (undefined) en een
    // GEMETEN nul ononderscheidbaar -- en de nul is de kant die een bewering over de buitenwereld
    // doet ('deze scan vond 0 wedstrijden') zonder dat er iets gemeten is. Zelfde semantiek als de
    // scan_runs-schrijf hieronder, die dit al goed deed met Number.isFinite: NULL = niet gemeten,
    // 0 = gemeten. Alle vijf kolommen zijn nullable (geverifieerd in information_schema), en de twee
    // aanroepplekken (het geen-wedstrijden-pad en het einde van runScan) geven allebei altijd een
    // echt getal mee -- dit is dus een vangnet, geen gedragswijziging. De lezers zijn null-veilig:
    // sbGetScanStatus en de /health-tak vangen null al af.
    last_pick_count: _g(data.lastPickCount),
    last_match_count: _g(data.lastMatchCount),
    last_with_odds: _g(data.lastWithOdds),
    last_without_odds: _g(data.lastWithoutOdds),
    scans_today: _g(data.scansToday),
    version: data.version || VERSION,
    // v265: uit de tellers zelf, niet via het meegegeven object -- er zijn twee
    // aanroepplekken en die mogen niet uit elkaar lopen.
    // NULL als er niet gemeten is; 0 betekent 'gemeten, niets geweigerd'.
    last_refused: _apifGemeten ? _apifWeigeringen : null,
    last_api_calls: _apifGemeten ? _apifCalls : null,
    last_api_errors: _apifGemeten ? _apifApiErrors : null, // v276
    last_via: _apifVia,
    updated_at: new Date().toISOString(),
  }], '?on_conflict=id');

  // v269: BEWAAR ELKE SCAN. scan_status is 1 rij die elk uur wordt overschreven, dus elke vraag
  // over een patroon ("is het rate-limitprobleem echt weg?", "zakt de odds-dekking op zaterdag-
  // middag?") was alleen met giswerk te beantwoorden. Hier ingebouwd en niet op de twee
  // aanroepplekken apart, want die mogen niet uit elkaar lopen -- dezelfde les als v265.
  // Ontkoppelde catch: telemetrie mag een scan nooit laten mislukken. Maar wel luid falen:
  // een stille catch zou "geen data" en "schrijffout" ononderscheidbaar maken.
  try {
    // Overal expliciet Number.isFinite i.p.v. `|| null`: een gemeten 0 is een meting.
    // v271: gebruikt nu dezelfde module-brede _g als scan_status hierboven -- twee kopieen van
    // dezelfde regel kunnen uit elkaar lopen (les van v265).
    const g = _g;
    await sb(env, 'scan_runs', 'POST', [{
      run_at: data.lastRun || new Date().toISOString(),
      worker_version: data.version || VERSION,
      matches_total: g(data.matchesTotal),
      matches_analysed: g(data.lastMatchCount),
      with_odds: g(data.lastWithOdds),
      without_odds: g(data.lastWithoutOdds),
      picks_saved: g(data.lastPickCount),
      candidates_removed: g(data.removedCount),
      analysis_skipped: g(data.analysisSkipped), // v271: 0=overgeslagen gemeten, NULL=niet gemeten
      shadow_saved: g(data.shadowSaved),
      api_calls: _apifGemeten ? _apifCalls : null,
      api_refused: _apifGemeten ? _apifWeigeringen : null,
      api_errors: _apifGemeten ? _apifApiErrors : null, // v276
      api_via: _apifVia,
      duration_ms: _scanStart === null ? null : (Date.now() - _scanStart),
      fout: data.fout || null,
    }]);
  } catch (e) {
    console.error('[ScanRuns] telemetrie niet weggeschreven:', e.message);
  }
}

// ── Supabase: scan_status lezen (R1-fase2: bron = Supabase i.p.v. Firebase) ──
async function sbGetScanStatus(env) {
  const rows = await sb(env, 'scan_status', 'GET', null, '?id=eq.current&select=scan_date,scans_today&limit=1');
  const r = rows && rows[0];
  return { scanDate: r?.scan_date || null, scansToday: r?.scans_today || 0 };
}

// ── Supabase: daily tip opslaan ──────────────────────────
async function sbSaveDailyTip(tipData, env) {
  if (!tipData) return;
  const today = new Date().toISOString().split('T')[0];
  await sb(env, 'daily_tips', 'POST', [{
    id: tipData.date || today,
    tip_date: tipData.date || today,
    fixture_id: tipData.fixtureId || null,
    home: tipData.home || null, away: tipData.away || null,
    pick: tipData.pick || null, odds: tipData.odds || null,
    confidence: tipData.confidence || null,
    reasoning: tipData.reasoning || tipData.tipText || null,
    status: tipData.status || 'pending',
    is_no_tip: tipData.noTip || false,
  }], '?on_conflict=id');
}

// ══════════════════════════════════════════════════════════
// v135: ELITE SHARP MONEY ENGINE
// Drie lagen:
//   1. saveMarketConsensusSnapshot  — sla multi-book consensus op (elke scan)
//   2. detectSharpMoney             — vergelijk Poisson vs markt, bereken sharpScore
//   3. saveSharpSignalResult        — post-settlement validatie
// ══════════════════════════════════════════════════════════

// ── Statische std-deviatie helper ────────────────────────
function stdDev(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const sq = arr.map(x => Math.pow(x - mean, 2));
  return parseFloat(Math.sqrt(sq.reduce((a, b) => a + b, 0) / arr.length).toFixed(4));
}

// ── Sharp tier toewijzen o.b.v. score (0-100) ────────────
// v154: sharp-tier drempels (sharpScore 0-100) als constanten — tune hier, gedrag ongewijzigd
const SHARP_TIERS = { elite: 75, strong: 55, moderate: 35, weak: 15 };
function sharpTier(score) {
  if (score >= SHARP_TIERS.elite)    return 'elite';
  if (score >= SHARP_TIERS.strong)   return 'strong';
  if (score >= SHARP_TIERS.moderate) return 'moderate';
  if (score >= SHARP_TIERS.weak)     return 'weak';
  return 'none';
}

// ── 1. Sla multi-bookmaker consensus snapshot op ─────────
// Aangeroepen direct na fetchOddsForFixtures (die al alle books parset).
// oddsMap heeft per fixture: { home, draw, away, books, fair:{home,draw,away} }
// rawBooksMap optioneel: { fixtureId: { bookName: {h,d,a} } } voor variance + JSONB
async function saveMarketConsensusSnapshot(oddsMap, matches, rawBooksMap, env) {
  const today = new Date().toISOString().split('T')[0];
  const now   = new Date().toISOString();
  const rows  = [];

  matches.forEach(m => {
    const o = oddsMap[m.fixtureId];
    if (!o || !o.home) return;

    const raw    = rawBooksMap?.[m.fixtureId] || {};
    const hArr   = Object.values(raw).map(b => b.h).filter(x => x > 1);
    const dArr   = Object.values(raw).map(b => b.d).filter(x => x > 1);
    const aArr   = Object.values(raw).map(b => b.a).filter(x => x > 1);

    rows.push({
      fixture_id:          m.fixtureId,
      league_id:           m.leagueId || null,
      match_date:          m.matchDate || today,
      captured_at:         now,
      home_odds_consensus: o.home,
      draw_odds_consensus: o.draw,
      away_odds_consensus: o.away,
      home_implied_pct:    o.fair?.home ?? null,
      draw_implied_pct:    o.fair?.draw ?? null,
      away_implied_pct:    o.fair?.away ?? null,
      home_variance:       stdDev(hArr) || null,
      draw_variance:       stdDev(dArr) || null,
      away_variance:       stdDev(aArr) || null,
      bookmaker_count:     o.books || 0,
      bookmaker_odds:      Object.keys(raw).length ? raw : null, // v278: object i.p.v. JSON.stringify -> echte jsonb (querybaar met ->, geen dubbele parse voor A/B)
    });
  });

  if (!rows.length) return;
  await sb(env, 'market_consensus', 'POST', rows);
  console.log(`[Sharp] ${rows.length} consensus snapshots opgeslagen`);
}

// ── 2. Elite detectSharpMoney ─────────────────────────────
// Combineert:
//   a) Odds movement (opening vs huidig) — legacy steam/drift
//   b) Poisson divergence vs markt fair implied
//   c) Consensus sterkte (minder variance = meer boekmakers het eens)
// Geeft sharpSignals terug voor gebruik in confidence-berekening
async function detectSharpMoney(oddsMap, matches, env, poissonMap) {
  const today = new Date().toISOString().split('T')[0];

  // Haal opening odds op uit market_consensus (vroegste snapshot vandaag)
  const existingConsensus = await sb(env, 'market_consensus', 'GET', null,
    `?match_date=eq.${today}&select=fixture_id,home_odds_consensus,draw_odds_consensus,away_odds_consensus,home_variance,draw_variance,away_variance,bookmaker_count,home_implied_pct,draw_implied_pct,away_implied_pct,captured_at&order=captured_at.asc`
  ) || [];

  // Fallback: ook legacy odds_snapshots voor opening
  const existingLegacy = await sb(env, 'odds_snapshots', 'GET', null,
    `?match_date=eq.${today}&select=fixture_id,home_odds,draw_odds,away_odds,captured_at&order=captured_at.asc`
  ) || [];

  // Bouw opening map — consensus heeft prioriteit, anders legacy
  const openMap = {};
  existingLegacy.forEach(r => {
    if (openMap[r.fixture_id]) return;
    openMap[r.fixture_id] = {
      home: parseFloat(r.home_odds), draw: parseFloat(r.draw_odds), away: parseFloat(r.away_odds),
      homeVar: null, drawVar: null, awayVar: null, books: 0,
      homeFair: null, drawFair: null, awayFair: null,
    };
  });
  existingConsensus.forEach(r => {
    openMap[r.fixture_id] = {
      home:     parseFloat(r.home_odds_consensus),
      draw:     parseFloat(r.draw_odds_consensus),
      away:     parseFloat(r.away_odds_consensus),
      homeVar:  r.home_variance  ? parseFloat(r.home_variance)  : null,
      drawVar:  r.draw_variance  ? parseFloat(r.draw_variance)  : null,
      awayVar:  r.away_variance  ? parseFloat(r.away_variance)  : null,
      books:    r.bookmaker_count || 0,
      homeFair: r.home_implied_pct ? parseFloat(r.home_implied_pct) : null,
      drawFair: r.draw_implied_pct ? parseFloat(r.draw_implied_pct) : null,
      awayFair: r.away_implied_pct ? parseFloat(r.away_implied_pct) : null,
    };
  });

  const STEAM_THRESHOLD = 6;   // v26.89: 4→6% — alleen significante steam bewegingen
  const DRIFT_THRESHOLD = 5;   // % odds stijging = drift signaal
  const DIVERG_STRONG   = 10;  // pp: Poisson vs markt kloof als sterk
  const DIVERG_MODERATE = 6;   // pp: kloof als matig

  const sharpSignals  = {};
  const movements     = [];
  const mmmRows       = []; // model_market_comparison upserts

  matches.forEach(m => {
    const current = oddsMap[m.fixtureId];
    const opening = openMap[m.fixtureId];
    if (!current || !current.home) return;

    // Poisson kansen van deze scan (optioneel meegegeven)
    const poisson = poissonMap?.[m.fixtureId] || null;

    const picks = [
      { p: '1', open: opening?.home, curr: current.home,
        openVar: opening?.homeVar, currFair: current.fair?.home, openFair: opening?.homeFair,
        poissonPct: poisson?.h ?? null },
      { p: 'X', open: opening?.draw, curr: current.draw,
        openVar: opening?.drawVar, currFair: current.fair?.draw, openFair: opening?.drawFair,
        poissonPct: poisson?.x ?? null },
      { p: '2', open: opening?.away, curr: current.away,
        openVar: opening?.awayVar, currFair: current.fair?.away, openFair: opening?.awayFair,
        poissonPct: poisson?.a ?? null },
    ];

    picks.forEach(({ p, open, curr, openVar, currFair, openFair, poissonPct }) => {
      if (!curr || curr <= 1) return;

      // A) Odds movement
      let movPct      = null;
      let isSteam     = false;
      let isDrift     = false;
      if (open && open > 1) {
        movPct  = parseFloat((((curr - open) / open) * 100).toFixed(1));
        isSteam = movPct <= -STEAM_THRESHOLD;
        isDrift = movPct >=  DRIFT_THRESHOLD;
        if (Math.abs(movPct) >= STEAM_THRESHOLD) {
          movements.push({
            fixture_id: m.fixtureId, pick: p,
            from_odds: open, to_odds: curr,
            movement_pct: movPct,
            direction: isSteam ? 'steam' : 'drift',
            detected_at: new Date().toISOString(),
          });
        }
      }

      // B) Poisson vs markt divergentie
      let divergence      = null;
      let poissonOdds     = null;
      const marketFair    = currFair ?? openFair ?? null;  // % markt implied
      if (poissonPct !== null && marketFair !== null) {
        divergence  = parseFloat(Math.abs(poissonPct - marketFair).toFixed(2));
        poissonOdds = poissonPct > 0 ? parseFloat((100 / poissonPct).toFixed(2)) : null;
      }

      // C) Consensus sterkte (inverse variance → hoger = boekmakers het meer eens)
      let consensusStrength = 50; // default neutraal
      if (openVar !== null && openVar !== undefined) {
        // variance 0 = perfect consensus (100), variance >0.3 = chaotisch (0)
        consensusStrength = parseFloat(Math.max(0, Math.min(100, 100 - openVar * 333)).toFixed(1));
      } else if (current.books > 0) {
        // Schat consensus sterkte op basis van aantal bookmakers
        consensusStrength = Math.min(100, 30 + current.books * 5);
      }

      // ── FINAL SHARP SCORE (0-100) ──────────────────────
      // Gewichten: divergentie 40%, steam 30%, consensus 20%, boeken 10%
      let score = 0;

      // Divergentie component (0-40)
      if (divergence !== null) {
        if (divergence >= DIVERG_STRONG)   score += 40;
        else if (divergence >= DIVERG_MODERATE) score += 25;
        else if (divergence >= 3)          score += 12;
      }

      // Steam component (0-30)
      if (isSteam) {
        const steamStrength = movPct !== null ? Math.min(30, Math.abs(movPct) * 2) : 15;
        score += steamStrength;
      } else if (isDrift) {
        score += 5; // drift is minder sterk signaal
      }

      // Consensus sterkte component (0-20)
      score += (consensusStrength / 100) * 20;

      // Boeken component (0-10)
      score += Math.min(10, (current.books || 0) * 0.8);

      score = parseFloat(Math.min(100, score).toFixed(1));
      const tier = sharpTier(score);

      // Steam signaal naar scan engine — alleen bij voldoende kwaliteit
      if (isSteam || score >= 55) {
        sharpSignals[m.fixtureId] = sharpSignals[m.fixtureId] || {};
        sharpSignals[m.fixtureId][p] = {
          movement:          movPct,
          sharpScore:        score,
          sharpTier:         tier,
          divergence:        divergence,
          consensusStrength: consensusStrength,
          isSteam,
          isDrift,
        };
        if (isSteam) console.log(`[Sharp] ${m.home} vs ${m.away} — ${p} ${movPct}% steam | score ${score} (${tier}) | div ${divergence}pp`);
        else         console.log(`[Sharp] ${m.home} vs ${m.away} — ${p} score ${score} (${tier}) | div ${divergence}pp`);
      }

      // model_market_comparison row (upsert per fixture+pick)
      mmmRows.push({
        fixture_id:           m.fixtureId,
        pick:                 p,
        poisson_win_pct:      poissonPct ?? null,
        poisson_odds:         poissonOdds,
        market_implied_pct:   marketFair,
        market_consensus_odds: curr,
        bookmaker_count:      current.books || 0,
        divergence_pct:       divergence,
        opening_odds:         open ?? null,
        movement_pct:         movPct,
        movement_momentum:    null,          // uitbreiden met tijdsvenster later
        consensus_strength:   consensusStrength,
        is_steam:             isSteam,
        is_drift:             isDrift,
        steam_bookmakers:     0,             // uitbreiden via per-book analyse later
        sharp_score:          score,
        sharp_tier:           tier,
        league_id:            m.leagueId || null,
        match_date:           m.matchDate || today,
        match_time:           m.matchTime || null,
        home:                 m.home,
        away:                 m.away,
        updated_at:           new Date().toISOString(),
      });
    });
  });

  // Sla movements op in bestaande tabel
  if (movements.length) {
    await sb(env, 'odds_movements', 'POST', movements);
    console.log(`[SB] ${movements.length} odds bewegingen opgeslagen`);
  }

  // Sla model_market_comparison op (upsert op fixture_id+pick)
  if (mmmRows.length) {
    await sb(env, 'model_market_comparison', 'POST', mmmRows, '?on_conflict=fixture_id,pick');
    console.log(`[Sharp] ${mmmRows.length} model-markt vergelijkingen opgeslagen`);
  }

  const eliteCount = Object.values(sharpSignals).flatMap(s => Object.values(s)).filter(v => v.sharpTier === 'elite').length;
  console.log(`[Sharp] ${Object.keys(sharpSignals).length} fixtures met signaal, ${eliteCount} elite`);
  return sharpSignals;
}

// ── 3. Post-settlement: sla sharp signal resultaat op ─────
// Aangeroepen vanuit verifyYesterdayPicks na settlement
async function saveSharpSignalResult(pick, result, closingOdds, env) {
  // Haal opgeslagen sharp data op uit model_market_comparison
  const rows = await sb(env, 'model_market_comparison', 'GET', null,
    `?fixture_id=eq.${pick.fixtureId}&pick=eq.${pick.pick}&select=*&limit=1`
  );
  const sharp = rows?.[0] || null;

  // Haal opening odds op uit market_consensus
  const snapRows = await sb(env, 'market_consensus', 'GET', null,
    `?fixture_id=eq.${pick.fixtureId}&order=captured_at.asc&limit=1`
  );
  const snap     = snapRows?.[0] || null;
  const openOdds = snap
    ? (pick.pick === '1' ? snap.home_odds_consensus
       : pick.pick === 'X' ? snap.draw_odds_consensus
       : snap.away_odds_consensus)
    : null;

  const closingO  = closingOdds || pick.odds;
  const clvPct    = openOdds && closingO
    ? parseFloat(((pick.odds - closingO) / closingO * 100).toFixed(2))
    : null;
  const won       = result === 'win';
  const signalCorrect = sharp?.is_steam ? won : null;  // only steam signals zijn binair correct/incorrect

  await sb(env, 'sharp_signal_results', 'POST', [{
    fixture_id:           pick.fixtureId,
    pick:                 pick.pick,
    sharp_score_at_pick:  sharp?.sharp_score    ?? null,
    sharp_tier_at_pick:   sharp?.sharp_tier     ?? null,
    poisson_vs_market_pct: sharp?.divergence_pct ?? null,
    was_steam:            sharp?.is_steam       ?? false,
    movement_at_pick:     sharp?.movement_pct   ?? null,
    consensus_strength:   sharp?.consensus_strength ?? null,
    our_odds:             pick.odds,
    our_ai_kans:          pick.aiKans,
    opening_odds:         openOdds ? parseFloat(openOdds) : null,
    closing_odds:         closingO,
    clv_pct:              clvPct,
    result,
    signal_correct:       signalCorrect,
    league_id:            pick.leagueId || null,
    match_date:           pick.matchDate || null,
    home:                 pick.home,
    away:                 pick.away,
    settled_at:           new Date().toISOString(),
  }], '?on_conflict=fixture_id,pick');
}


// ── Supabase: CLV opslaan na settlement ──────────────────
// v155: robuust — opening = vroegste snapshot, closing = live API of laatste snapshot.
// Bailt niet meer op lege live-CLV (die ontbreekt vaak omdat de API-odds na aftrap weg zijn);
// dan komt de slotkoers uit de odds_snapshots-tijdreeks. Geen slot = overslaan i.p.v. ruis schrijven.
async function saveCLV(pick, clv, won, closingOdds, env) {
  const pickOf = (s) => {
    const pk = pick.pick;
    if (pk === '1') return s.home_odds;
    if (pk === 'X') return s.draw_odds;
    if (pk === '2') return s.away_odds;
    // v203: goal-markt-slotkoers uit goal_odds JSONB — voorheen viel dit fout terug op away_odds (absurde CLV op O/U + BTTS)
    const g = s.goal_odds; if (!g) return null;
    const mm = String(pk).match(/^([OU])(\d\.\d)$/i);
    if (mm) return g.ou?.[mm[2]]?.[mm[1].toUpperCase()==='O'?'over':'under'] ?? null;
    if (/^(btts|btts_?y|gg)$/i.test(pk)) return g.btts?.yes ?? null;
    if (/^(nobtts|btts_?n|ng)$/i.test(pk)) return g.btts?.no ?? null;
    return null;
  };

  let openingOdds = null, snapClose = null;
  try {
    const [first, last] = await Promise.all([
      sb(env, 'odds_snapshots', 'GET', null,
        `?fixture_id=eq.${pick.fixtureId}&order=captured_at.asc&limit=1`),
      sb(env, 'odds_snapshots', 'GET', null,
        `?fixture_id=eq.${pick.fixtureId}&order=captured_at.desc&limit=1`),
    ]);
    if (first?.length) { const v = parseFloat(pickOf(first[0])); if (v > 1) openingOdds = v; }
    if (last?.length)  { const v = parseFloat(pickOf(last[0]));  if (v > 1) snapClose   = v; }
  } catch(e) { console.warn('[CLV] Snapshot ophalen mislukt:', e.message); }

  // Slotkoers: live API > laatste snapshot. Geen betrouwbaar slot = niet schrijven.
  const closeO = (closingOdds && closingOdds > 1) ? parseFloat(closingOdds) : snapClose;
  if (!closeO || !(pick.odds > 1)) {
    console.warn(`[CLV] Geen slotkoers voor fixture ${pick.fixtureId} (${pick.pick}) — overgeslagen`);
    return;
  }

  const clvPct = (clv !== null && clv !== undefined)
    ? clv
    : parseFloat(((pick.odds / closeO - 1) * 100).toFixed(2));

  await sb(env, 'clv_results', 'POST', [{
    fixture_id: pick.fixtureId,
    pick: pick.pick,
    our_odds: pick.odds,
    opening_odds: openingOdds,
    closing_odds: closeO,
    clv_pct: clvPct,
    status: won ? 'win' : 'lose',
    match_date: pick.matchDate || null,
    league_id: pick.leagueId || null,
    settled_at: new Date().toISOString(),
  }], '?on_conflict=fixture_id,pick');
}

// ── Supabase: analytics endpoint ─────────────────────────
async function handleAnalytics(env) {
  try {
    const clvData = await sb(env, 'clv_results', 'GET', null,
      '?select=clv_pct,status,league_id,match_date&order=settled_at.desc&limit=200'
    ) || [];
    const sevenDaysAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0];
    const sharpData = await sb(env, 'odds_movements', 'GET', null,
      `?detected_at=gte.${sevenDaysAgo}T00:00:00Z&direction=eq.steam&pick=neq.X&order=movement_pct.asc&limit=50`
    ) || [];

    const withCLV = clvData.filter(r => r.clv_pct !== null);
    const avgCLV = withCLV.length
      ? parseFloat((withCLV.reduce((s,r) => s + parseFloat(r.clv_pct), 0) / withCLV.length).toFixed(1))
      : null;

    const _sumRow = await sb(env, 'v_clv_summary', 'GET', null, '?limit=1') || [];
    const _sum = _sumRow[0] || null;
    const _byLeague = await sb(env, 'v_clv_per_league', 'GET', null, '?order=picks.desc&limit=8') || [];

    // v124: extra views voor dashboard-wiring
    const _rating = await sb(env, 'v_league_rating', 'GET', null, '?order=reliability.desc&limit=12') || [];
    const _trend  = await sb(env, 'v_clv_trend', 'GET', null, '?order=settled_at.asc&limit=120') || [];
    const _market = await sb(env, 'v_clv_per_market', 'GET', null, '?order=picks.desc&limit=8') || [];
    const _recent = await sb(env, 'v_clv_recent', 'GET', null, '?limit=4') || [];

    return json({
      leagueRating: _rating.map(r => ({
        leagueId: r.league_id, picks: r.picks, wins: r.wins, losses: r.losses,
        hitrate: r.hitrate, avgCLV: r.avg_clv, roiPct: r.roi_pct,
        reliability: r.reliability, label: r.betrouwbaarheid_label,
      })),
      clvTrend: _trend.map(r => ({
        dag: r.dag, n: r.n, clvPct: r.clv_pct, cumAvgCLV: r.cum_avg_clv,
      })),
      clvPerMarket: _market.map(r => ({
        markt: r.markt, picks: r.picks, hitrate: r.hitrate,
        avgCLV: r.avg_clv, roiPct: r.roi_pct,
      })),
      clvRecent: _recent.map(r => ({
        periode: r.periode, picks: r.picks, avgCLV: r.avg_clv,
        roiPct: r.roi_pct, pctBeatClose: r.pct_beat_close,
      })),
      clvSummary: _sum ? {
        picks: _sum.picks, avgCLV: _sum.avg_clv_pct, pctBeatClose: _sum.pct_beat_close,
        winRate: _sum.win_rate, wins: _sum.wins, losses: _sum.losses,
        avgPosCLV: _sum.avg_pos_clv, bestCLV: _sum.best_clv, worstCLV: _sum.worst_clv,
      } : null,
      clvByLeague: _byLeague.map(r => ({ leagueId: r.league_id, picks: r.picks,
        avgCLV: r.avg_clv_pct, pctBeatClose: r.pct_beat_close, wins: r.wins, losses: r.losses })),
      clv: {
        total: clvData.length,
        avgCLV,
        positiveCLVPct: withCLV.length
          ? Math.round(withCLV.filter(r => parseFloat(r.clv_pct) > 0).length / withCLV.length * 100)
          : null,
      },
      // v144: pick tier performance + league tier data
      pickTierPerformance: await (async () => {
        try {
          const rows = await sb(env, 'picks', 'GET', null,
            `?status=in.(win,lose)&select=lock_level,elite,status,value,confidence,sharp_score,sharp_tier,league_name,pick,odds&limit=500`
          ) || [];
          const tiers = {};
          rows.forEach(r => {
            const tier = r.elite ? 'elite' : (r.lock_level || 'single');
            if (!tiers[tier]) tiers[tier] = { total:0, wins:0, valueSum:0, confSum:0, sharpSum:0, sharpN:0 };
            tiers[tier].total++;
            if (r.status === 'win') tiers[tier].wins++;
            tiers[tier].valueSum += parseFloat(r.value||0);
            tiers[tier].confSum  += parseFloat(r.confidence||0);
            if (r.sharp_score) { tiers[tier].sharpSum += parseFloat(r.sharp_score); tiers[tier].sharpN++; }
          });
          return Object.entries(tiers).map(([tier, s]) => ({
            tier,
            total:        s.total,
            wins:         s.wins,
            hitrate:      s.total ? parseFloat((s.wins/s.total*100).toFixed(1)) : 0,
            avgValue:     s.total ? parseFloat((s.valueSum/s.total).toFixed(1)) : 0,
            avgConf:      s.total ? parseFloat((s.confSum/s.total).toFixed(1)) : 0,
            avgSharp:     s.sharpN ? parseFloat((s.sharpSum/s.sharpN).toFixed(1)) : null,
          }));
        } catch(e) { return []; }
      })(),
      leagueTiers: await (async () => {
        try {
          const rows = await sb(env, 'league_calibration', 'GET', null,
            `?total=gt.0&select=league_id,league_name,wins,total,roi,factor,tier,avg_clv,clv_count&order=total.desc&limit=20`
          ) || [];
          return rows.map(r => ({
            leagueId:   r.league_id,
            leagueName: r.league_name,
            wins:       r.wins,
            total:      r.total,
            hitrate:    r.total ? parseFloat((r.wins/r.total*100).toFixed(1)) : 0,
            // v222: r.roi is de SOM van unit-rendementen x100, geen percentage. hitrate hierboven werd wel
            // door total gedeeld, roi niet -> League Ratings toonde Primera +77.0% i.p.v. +11.0% (7 picks).
            roi:        parseFloat(((parseFloat(r.roi)||0) / (r.total || 1)).toFixed(1)),
            factor:     parseFloat(r.factor||1).toFixed(3),
            tier:       r.tier || 'onbekend',
            avgClv:     r.avg_clv ? parseFloat(r.avg_clv).toFixed(2) : null,
          }));
        } catch(e) { return []; }
      })(),
      sharpMoney: await (async () => {
        // v135b: teamnamen ophalen uit picks tabel via fixture IDs
        const steamTop = sharpData.slice(0, 8);
        const steamFixIds = [...new Set(steamTop.map(r => r.fixture_id))];

        // Haal teamnamen + datum op uit picks tabel
        let picksLookup = {};
        if (steamFixIds.length) {
          const pRows = await sb(env, 'picks', 'GET', null,
            `?fixture_id=in.(${steamFixIds.join(',')})&select=fixture_id,home,away,match_date,match_time,league_name&limit=50`
          ) || [];
          pRows.forEach(p => {
            if (!picksLookup[p.fixture_id]) {
              picksLookup[p.fixture_id] = {
                home: p.home, away: p.away,
                matchDate: p.match_date, matchTime: p.match_time,
                leagueName: p.league_name,
              };
            }
          });
        }

        // topSharpScores uit model_market_comparison (heeft teamnamen al)
        let topSharpScores = [];
        try {
          const sevenAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0];
          const rows = await sb(env, 'model_market_comparison', 'GET', null,
            `?match_date=gte.${sevenAgo}&sharp_score=gte.55&pick=neq.X&order=sharp_score.desc&limit=8`
          ) || [];
          // Verrijk ook model_market_comparison rijen met picks data als home/away leeg is
          topSharpScores = rows.map(r => {
            const pk = picksLookup[r.fixture_id] || {};
            return {
              fixtureId:         r.fixture_id,
              pick:              r.pick,
              home:              r.home || pk.home || null,
              away:              r.away || pk.away || null,
              matchDate:         r.match_date || pk.matchDate || null,
              matchTime:         r.match_time || pk.matchTime || null,
              leagueName:        pk.leagueName || null,
              sharpScore:        r.sharp_score,
              sharpTier:         r.sharp_tier,
              divergence:        r.divergence_pct,
              movementPct:       r.movement_pct,
              isSteam:           r.is_steam,
              isDrift:           r.is_drift,
              poissonPct:        r.poisson_win_pct,
              marketPct:         r.market_implied_pct,
              openingOdds:       r.opening_odds,
              consensusOdds:     r.market_consensus_odds,
              consensusStrength: r.consensus_strength,
            };
          });
        } catch(e) { console.error('[Sharp] topSharpScores fout:', e.message); }

        return {
          steamMovements7d: sharpData.length,
          topSteam: steamTop.map(r => {
            const pk = picksLookup[r.fixture_id] || {};
            return {
              fixtureId:  r.fixture_id,
              pick:       r.pick,
              movement:   r.movement_pct,
              detectedAt: r.detected_at,
              fromOdds:   r.from_odds  || null,
              toOdds:     r.to_odds    || null,
              direction:  r.direction  || 'steam',
              // v135b: teamnamen + datum vanuit picks tabel
              home:       pk.home      || null,
              away:       pk.away      || null,
              matchDate:  pk.matchDate || null,
              leagueName: pk.leagueName || null,
            };
          }),
          topSharpScores,
        };
      })(),
    });
  } catch(e) {
    console.error('[Analytics] fout:', e);
    return json({ error: 'Analytics mislukt' }, 500);
  }
}


// ═══════════════════════════════════════════════════════
// v20 INTELLIGENCE CORE
// ═══════════════════════════════════════════════════════

// League kwaliteitsfactoren (hogere factor = betrouwbaardere data)
const LEAGUE_FACTORS = {
  // ── Top 5 Europa ──
  39: 1.10,  // Premier League
  140: 1.08, // La Liga
  78: 1.08,  // Bundesliga
  135: 1.07, // Serie A
  61: 1.05,  // Ligue 1
  // ── Europese toernooien ──
  2: 1.12,   // Champions League
  3: 1.10,   // Europa League
  848: 1.05, // Conference League
  // ── Europese (sub)top ──
  88: 1.00,  // Eredivisie
  94: 0.95,  // Primeira Liga Portugal
  144: 0.95, // Jupiler Pro League België
  203: 0.95, // Süper Lig Turkije
  179: 0.92, // Scottish Premiership
  207: 0.90, // Super League Zwitserland
  // ── Tweede/derde niveaus ──
  40: 0.98,  // Championship (Engeland)
  79: 0.95,  // 2. Bundesliga (Duitsland)
  89: 0.90,  // Keuken Kampioen Divisie (NL) — VVV-Venlo
  80: 0.90,  // 3. Liga (Duitsland)
  41: 0.90,  // League One (Engeland)
  // ── Zomercompetities (buiten FASE 2; scan-test / seizoensoverlap) ──
  119: 0.90, // Superliga Denemarken
  113: 0.88, // Allsvenskan Zweden (apr–nov, seizoen 2026)
  103: 0.88, // Eliteserien Noorwegen (apr–nov, seizoen 2026)
};

// Odds bucket factoren (meest value zit in 1.5-3.5)
const ODDS_BUCKET_FACTORS = {
  '1.0-1.5': 0.75,
  '1.5-2.0': 0.95,
  '2.0-2.5': 1.05,
  '2.5-3.0': 1.08,
  '3.0-3.5': 1.05,
  '3.5-5.0': 0.90,
  '5.0+':    0.70,
};

function getOddsBucket(odds) {
  if (odds < 1.5) return '1.0-1.5';
  if (odds < 2.0) return '1.5-2.0';
  if (odds < 2.5) return '2.0-2.5';
  if (odds < 3.0) return '2.5-3.0';
  if (odds < 3.5) return '3.0-3.5';
  if (odds < 5.0) return '3.5-5.0';
  return '5.0+';
}

// Confidence Engine v1
// v127: landenteam-/toernooi-competities — dunne statistische data, ook al is de markt scherp.
// WK (1), WK-kwal (4 UEFA, 6 CONMEBOL, 29 CAF, 36 AFC), Nations League (5), Vriendschappelijk (10).
const TOURNAMENT_LEAGUES = new Set([1, 4, 5, 6, 10, 29, 36]);
function isTournamentLeague(leagueId) { return TOURNAMENT_LEAGUES.has(Number(leagueId)); }

// ── v144: calculateConfidenceV30 ──────────────────────────
// Nieuwe gewichtsverdeling — AI maximaal 10% directe invloed
//
// Gewichten:
//   40% fairImplied    — Shin de-vigged marktodds (objectieve prior, bookmaker consensus)
//   20% valueScore     — Edge model vs markt (hoe groot is de kloof)
//   20% dataQuality    — Spread AI-schattingen + league calibratie kwaliteit
//   10% aiAdjustment   — AI-afwijking van markt, gecapped op ±20pp (nuancering, niet basis)
//   10% marketSignal   — Sharp money + odds beweging
//
// Poisson/AI kansen zijn nu ALLEEN input voor value en aiAdjustment.
// De markt (fairImplied) is de dominante factor.
function calculateConfidenceV20({ modelProb, value, dataQuality, marketSignal, leagueId, odds, calibFactor, pick, fairImplied: fairImpliedInput }) {
  const staticFactor = LEAGUE_FACTORS[leagueId] || 0.92;
  const leagueFactor = calibFactor ? (staticFactor * 0.30 + calibFactor * 0.70) : staticFactor;
  const bucketFactor = ODDS_BUCKET_FACTORS[getOddsBucket(odds)] || 0.90;
  const drawPenalty  = pick === 'X' ? 0.90 : 1.0; // v161: iets verzacht (was 0.85)

  // 1. fairImplied: marktodds als objectieve prior (40%)
  // Gebruik meegegeven fairImplied, anders bereken uit bookOdds
  const marketBase = fairImpliedInput != null
    ? Math.min(Math.max(fairImpliedInput, 5), 95)
    : Math.min(Math.max(impliedProb(odds) * 100 * 0.95, 5), 95); // 0.95 = ruwe Shin benadering

  // 2. valueScore: edge als % van markt, gecapped op 20pp = 100 (20%)
  const valueScore = Math.min(Math.max(value, 0), 20) / 20 * 100;

  // 3. dataQuality: spread van kansen + league kwaliteit (20%) — ongewijzigd
  const dq = Math.min(dataQuality, 100);

  // 4. aiAdjustment: hoeveel wijkt AI af van markt? Gecapped op ±20pp.
  // Grote afwijking én in goede richting = kleine bonus. AI heeft max 10% gewicht.
  // aiKans (modelProb) vs fairImplied → afwijking als signaal, niet als basis.
  const aiDivergence = modelProb - marketBase; // positief = AI bullisher dan markt
  // Converteer naar 0-100 score: 0pp afwijking = 50, +20pp = 100, -20pp = 0
  const aiAdj = Math.min(100, Math.max(0, 50 + aiDivergence * 2.5));

  // 5. marketSignal: sharp + beweging (10%) — ongewijzigd
  const ms = Math.min(marketSignal, 100);

  const raw =
    (marketBase   * 0.40) +   // Markt als objectieve prior
    (valueScore   * 0.20) +   // Edge/value
    (dq           * 0.20) +   // Datakwaliteit
    (aiAdj        * 0.10) +   // AI als nuancering (max 10%)
    (ms           * 0.10);    // Sharp/beweging

  const final = Math.max(0, Math.min(100, raw * leagueFactor * bucketFactor * drawPenalty));

  return {
    raw:         parseFloat(raw.toFixed(1)),
    final:       parseFloat(final.toFixed(1)),
    leagueFactor,
    bucketFactor,
    score:       Math.max(1, Math.min(10, Math.round(final / 10))),
    // Debug info
    _weights: { marketBase: parseFloat((marketBase*0.40).toFixed(1)), valueScore: parseFloat((valueScore*0.20).toFixed(1)),
                dq: parseFloat((dq*0.20).toFixed(1)), aiAdj: parseFloat((aiAdj*0.10).toFixed(1)), ms: parseFloat((ms*0.10).toFixed(1)) }
  };
}

// Elite pick detectie — v31: gelijkspel nooit auto-elite, strengere criteria
function isElitePick({ confidenceFinal, value, odds, pick, poissonUsed }) {
  // v144: drempel herijkt voor nieuwe confidence formule (markt-dominant)
  // Old: confidenceFinal >= 68 (AI-zwaar). New: >= 62 want markt is meer gedempt.
  return (
    confidenceFinal >= 62 &&
    value >= 8 &&
    odds >= 1.55 &&
    odds <= 4.80 &&
    pick !== 'X' &&                          // gelijkspel nooit auto-elite
    (poissonUsed || value >= 15)             // Poisson of hoge value vereist
  );
}

// Odds movement berekenen
function calcOddsMovement(openingOdds, currentOdds) {
  if (!openingOdds || !currentOdds) return null;
  const movement = ((currentOdds - openingOdds) / openingOdds) * 100;
  return parseFloat(movement.toFixed(1));
}

// Marktsignaal op basis van odds beweging
function calcMarketSignal(movement, pick) {
  if (movement === null) return 50;
  if (movement < -10) return 80;
  if (movement < -5)  return 70;
  if (movement < -2)  return 60;
  if (movement > 10)  return 30;
  if (movement > 5)   return 40;
  return 50;
}

// ── Fetch met retry ──────────────────────────────────────
async function fetchWithRetry(url, options, retries = 2) {
  // v103: geen retry op Anthropic API — elke retry kost geld
  const isAnthropic = url.includes('anthropic.com');
  const maxRetries = isAnthropic ? 0 : retries;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (i === maxRetries) return res;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    } catch(e) {
      if (i === maxRetries) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

// ── Route naar api-sports: rechtstreeks of via onze eigen proxy ──────────
// WAAROM: api-sports weigert bursts op grond van het UITGAANDE IP, niet op de
// key. Bevestigd door hun support (Kevin, 17-07-2026). Cloudflare Workers delen
// hun egress-IP's met vreemden, dus werden onze calls geweigerd terwijl we op
// 2,1% van de daglimiet zaten (gemeten 17-07 13:00: 4 van 8 parallelle calls).
// apif.promatchxi.app is een eigen server (Hetzner, vast IP 138.201.189.10) die
// het verzoek ongewijzigd doorzet. De proxy kent onze key niet: die gaat gewoon
// mee in de header en wordt doorgegeven.
// Zonder PROXY_SECRET verandert er niets — dan blijft alles rechtstreeks gaan.
// Dat is meteen het rollback-pad: secret weghalen = oude gedrag terug.
function apiSportsHost(cleanPath, env) {
  const key = env.FOOTBALL_KEY || '';
  const secret = env.PROXY_SECRET;
  // Bewust geen `secret || ...`: een lege string is 'niet ingesteld', maar de
  // check moet expliciet zijn en niet op toevallige falsy-heid leunen.
  const viaProxy = typeof secret === 'string' && secret.length > 0;
  return {
    name: 'api-sports',
    viaProxy,
    url: (viaProxy ? 'https://apif.promatchxi.app/v3' : 'https://v3.football.api-sports.io') + cleanPath,
    headers: viaProxy
      ? { 'x-apisports-key': key, 'X-Proxy-Secret': secret }
      : { 'x-apisports-key': key }
  };
}

// v264: /health moet kunnen laten zien OF de proxy aanstaat en of het secret
// aan beide kanten hetzelfde is. Daarom een vingerafdruk: de eerste 8 tekens van
// de SHA-256 van het secret. Genoeg om te vergelijken, onbruikbaar om mee in te
// loggen. Het secret zelf komt nooit in een respons of een log terecht.
async function apifProxyStatus(env) {
  const secret = env.PROXY_SECRET;
  const aan = typeof secret === 'string' && secret.length > 0;
  if (!aan) return { ingeschakeld: false, reden: 'PROXY_SECRET niet ingesteld -> rechtstreeks naar api-sports' };
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  const uit = { ingeschakeld: true, host: 'apif.promatchxi.app', secret_vingerafdruk: hex.slice(0, 8), secret_lengte: secret.length };
  // v265: wat api-sports bij de LAATSTE scan werkelijk deed. Dit is de meting
  // waarmee de proxy zich moet bewijzen op 23-07 en 07-08.
  try {
    const sc = await sb(env, 'scan_status', 'GET', null, '?id=eq.current&select=last_refused,last_api_calls,last_api_errors,last_via&limit=1');
    const r = sc?.[0];
    if (r) {
      // Bewust === null: 0 weigeringen is een METING, geen ontbrekende waarde.
      uit.laatste_scan = {
        via: r.last_via === null ? 'niet gemeten' : r.last_via,
        calls: r.last_api_calls === null ? 'niet gemeten' : r.last_api_calls,
        geweigerd: r.last_refused === null ? 'niet gemeten' : r.last_refused,
        // v276: getal als gemeten (zodat de /health-warning erop kan filteren), anders de string.
        api_fouten: r.last_api_errors === null ? 'niet gemeten' : r.last_api_errors
      };
    }
  } catch (e) {
    // Geen stille [] : zeg dat de meting mislukte, niet dat er niets geweigerd is.
    uit.laatste_scan = { fout: 'scan_status niet leesbaar: ' + (e && e.message ? e.message.slice(0, 80) : 'onbekend') };
  }
  return uit;
}

// ── API-Football helper ──────────────────────────────────
// v274: spreidt een lijst apif-calls over kleine chunks i.p.v. alles in één tick af te vuren.
// AANLEIDING (gemeten 18-07): de odds- en fixtures-collectie deed `Promise.all(ids.map(id=>apif(...)))`,
// wat ALLE calls gelijktijdig de deur uit stuurt. Op de rustige zomerdagen (8 fixtures) gaf dat 0
// weigeringen, maar de IP-burst-throttle van api-sports (gedeelde egress, geen quotaprobleem — zie
// changelog v245/v247) kijkt naar de PIEK, niet het gemiddelde. maxCalls=36 betekent dat één odds-burst
// tot 36 parallelle calls kon worden zodra de domestic leagues starten (07-08, 24+ fixtures) — precies
// het scenario achter de stille odds-gaten van v242-v247. API_MIN_GAP hielp daar nooit tegen want dat is
// een gap tussen SERIELE calls; deze waren parallel.
// GEDRAG: chunks van `size` (default 6) calls tegelijk, dan `gapMs` (default 350ms) pauze. Piek-burst
// zakt van 36 naar 6; de scanduur stijgt met ~ceil(n/6)*350ms (bij 36 calls ~2s extra). VOLGORDE blijft
// exact behouden — result[i] hoort bij items[i] — want de drie fixtures-settle-plekken indexeren met [i].
// Retourneert een Promise.allSettled-achtige array ({status,value|reason}) zodat de bestaande
// rateLimited/failed/empty-afhandeling onveranderd blijft.
async function apifChunked(items, fn, { size = 6, gapMs = 350 } = {}) {
  const out = new Array(items.length);
  for (let start = 0; start < items.length; start += size) {
    const slice = items.slice(start, start + size);
    const settled = await Promise.allSettled(slice.map((it, k) => fn(it, start + k)));
    for (let k = 0; k < settled.length; k++) out[start + k] = settled[k];
    if (start + size < items.length && gapMs > 0) await new Promise(r => setTimeout(r, gapMs));
  }
  return out;
}

async function apif(path, env) {
  const key = env.FOOTBALL_KEY || '';
  const PAGE_CAP = 5; // v129: max pagina's voor drukke date-queries (subrequest-budget)
  // v249: VANGNET, en het moet HIER staan — boven de hosts-array, want die bakt het pad in de URL.
  // Aanleiding: `&_cb=${Date.now()}` (v152, cache-bust) ging via apif ongestript naar API-Football, want
  // de strip zat alleen in handleAPIFootball (de proxy). API-Football weigert onbekende velden met
  // {"_cb": "The _cb field do not exist."} -> response=[] -> `if (!r?.length) break` -> nul odds, zonder
  // fout en zonder rate-limit, niet te onderscheiden van 'geen data'. De echte fix is de parameter niet
  // meer meesturen (gedaan in fetchOddsForFixtures); dit voorkomt dat een volgende debug-parameter
  // opnieuw stil elke call sloopt. Bewust ALLEEN _cb: elke andere onbekende parameter hoort hard te
  // falen i.p.v. weggepoetst te worden, anders verbergen we precies de fouten die we willen zien.
  const cleanPath = path.replace(/[&?]_cb=[^&]*/g, '').replace(/\?&/, '?');
  const isDateFixtures = /^\/fixtures\?date=/.test(cleanPath); // alleen hier pagineren
  const hosts = [
    apiSportsHost(cleanPath, env),
    {
      name: 'rapidapi',
      url: 'https://api-football-v1.p.rapidapi.com/v3' + cleanPath,
      headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': 'api-football-v1.p.rapidapi.com' }
    }
  ];
  let _rateLimited = false; // v245
  let _rlHost = null;       // v254: WELKE host weigerde — niet afleiden, vastleggen op het moment zelf
  let _apiErrMsg = null;    // v276: api-sports gaf {message:...} zonder response-veld
  _apifCalls++;             // v265
  _apifVia = hosts[0].viaProxy === true ? 'proxy' : 'direct'; // v265: hosts[0] = api-sports
  for (const host of hosts) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetchWithRetry(host.url, {
          headers: host.headers,
          cf: { cacheTtl: 0, cacheEverything: false }
        });
        const data = await res.json();
        if (data.errors?.token || data.errors?.key) break; // auth-fout → volgende host
        if (data.errors?.rateLimit) {                       // v114: niet stilletjes als [] teruggeven
          // v245: 2 -> 3 pogingen met oplopende backoff. Gemeten: api-sports weigert bursts ook als de
          // minuutteller nog op 293-299/300 staat, en die weigeringen dragen GEEN rate-limit-headers —
          // het is dus een burst/IP-throttle (gedeelde Cloudflare-egress), geen quotaprobleem.
          // v256: leg vast wat api-sports ZELF zegt, in plaats van het af te leiden. Stand 16-07: het
          // abonnement is API-FOOTBALL Pro RECHTSTREEKS bij api-sports.io (dashboard: v3.football.api-sports.io
          // Active, 7500/dag, tot 18-08) en het dagverbruik stond op 94 van 7500 = 1,25% toen deze weigeringen
          // vielen. Dagquotum is daarmee uitgesloten en 450/min haal je met twee parallelle calls niet — dus
          // weigert api-sports om iets dat NIET aan de key hangt. Vermoeden: telling per IP, en Workers gaan
          // uit via gedeelde Cloudflare-egress. Dat is een HYPOTHESE; deze regel moet hem bevestigen of
          // slopen. Elke poging apart loggen is bewust: staan de headers/teksten bij poging 1, 2 en 3 exact
          // gelijk, dan verandert de backoff niets en is 4,5s wachten kansloos. Dit citaat gaat naar
          // api-sports support -- vandaar hun letterlijke tekst en niet mijn samenvatting.
          if (host.name === 'api-sports') _apifWeigeringen++; // v265: elke geweigerde poging telt
          const _rl = String(data.errors.rateLimit).slice(0, 160);
          const _h = (n) => { const v = res.headers.get(n); return v === null ? '-' : v; };
          // v257: HONOREER RETRY-AFTER. Gemeten 17-07 05:01 UTC (nachtelijke snapshot-cron, geen ruis van
          // ons): http=429, rateLimit="Too many requests. You have exceeded the maximum number of requests
          // allowed.", dag=-/- min=-/- retry-after=6 cf-ray=...-FRA. Api-sports zégt hoelang we moeten
          // wachten en v245 gooide dat weg voor een blinde 1500/3000ms. Uitkomst: poging 1 om 07:01:09.669
          // (mag pas weer om :15.669), poging 2 om :11.194 (4,2s te vroeg), poging 3 om :14.221 (1,4s te
          // vroeg), opgegeven om :17.481 — 1,8s VOORDAT het weer mocht. Alle drie de pogingen vielen binnen
          // het venster dat zij zelf aangaven. Daarom hielpen 'retries met backoff' nooit: niet kansloos,
          // maar te vroeg. Cap op 10,5s: bij 80 odds-calls die allemaal weigeren zou honoreren zonder cap
          // de scan minutenlang laten hangen. Geen `_ra || fallback` — een Retry-After van 0 is een
          // geldige waarde en mag geen fallback triggeren.
          const _raRuw = res.headers.get('retry-after');
          const _ra = _raRuw === null ? null : Number(_raRuw);
          const _raBruikbaar = _ra !== null && Number.isFinite(_ra) && _ra > 0;
          const _wachtMs = _raBruikbaar ? Math.min(_ra * 1000 + 500, 10500) : 1500 * (attempt + 1);
          console.warn(`[apif] api-sports WEIGERT (poging ${attempt + 1}/3) pad=${cleanPath.slice(0, 60)} `
            + `http=${res.status} rateLimit="${_rl}" `
            + `dag=${_h('x-ratelimit-requests-remaining')}/${_h('x-ratelimit-requests-limit')} `
            + `min=${_h('X-RateLimit-Remaining')}/${_h('X-RateLimit-Limit')} `
            + `retry-after=${_h('retry-after')} cf-ray=${_h('cf-ray')} `
            + `→ ${attempt < 2 ? `wacht ${_wachtMs}ms (${_raBruikbaar ? 'hun Retry-After' : 'eigen backoff, geen header'})` : 'geen poging meer over'}`);
          if (attempt < 2) { await new Promise(r => setTimeout(r, _wachtMs)); continue; }
          _rateLimited = true; // onthouden: hieronder mag dit géén schone [] worden
          _rlHost = host.name; // v254
          break;
        }
        // v276: 'You are not subscribed to this API' (verlopen/verkeerde/verkeerd-geplakte key) en
        // soortgelijke api-sports-foutmeldingen komen als HTTP 200 met {message:...} en ZONDER een
        // response-veld. Tot nu toe viel dat recht door naar `out = data.response || []` = [], niet te
        // onderscheiden van 'geen wedstrijden'. Precies zo had de FB_API_KEY/FOOTBALL_KEY-verwisseling
        // van 19-07 dagenlang stil kunnen doorlopen: elke scan 0 fixtures, geen fout, geen warning.
        // errors.token/key (r1365) en errors.rateLimit (r1366) vangen deze vorm NIET. Detectie is
        // specifiek: response ontbreekt (undefined, niet []) EN er staat een niet-lege message.
        if (data.response === undefined && typeof data.message === 'string' && data.message) {
          if (host.name === 'api-sports') _apifApiErrors++; // alleen api-sports telt, net als _apifWeigeringen
          _apiErrMsg = data.message.slice(0, 120);
          console.warn(`[apif] API-FOUT — host '${host.name}' gaf een message i.p.v. data: `
            + `"${_apiErrMsg}" pad=${cleanPath.slice(0, 60)} http=${res.status}`);
          break; // volgende host proberen (net als bij errors.token); rapidapi is dood -> valt naar `leeg`
        }
        let out = data.response || [];
        // v252: de vlag moet aan ELKE lege uitgang hangen, niet alleen aan de laatste. apif probeert twee
        // hosts. Wordt api-sports geweigerd (3 pogingen), dan staat _rateLimited=true en valt hij door naar
        // rapidapi; geeft DIE een andere fout of een lege respons, dan loopt het naar `return out` — een
        // kale [] — en is de vlag weg. De `leeg`-constructie onderaan is alleen bereikbaar als GEEN van
        // beide hosts iets returnt. Gemeten: de droogloop van 16-07 04:00 UTC meldde fixturesGeweigerd=0 en
        // 0 fixtures, terwijl dezelfde call om 08:00 gewoon 114 fixtures gaf (29 in league 2/3/848) — de
        // data was er dus, de call gaf niets terug, en de vlag zei 'niet geweigerd'. Dit is exact het gat
        // dat v245 dacht te dichten: ik zette de vlag toen op één uitgang en zag de andere over het hoofd,
        // waardoor v251 een meter is die zelf 0 kan melden terwijl het antwoord 'geweigerd' is.
        // v129: API-Football pagineert /fixtures?date= op drukke dagen (bv. WK-warm-up).
        // Zonder dit vielen friendlies/Scandinavische leagues buiten pagina 1 → "geen wedstrijden".
        const totalPages = data.paging?.total || 1;
        if (isDateFixtures && totalPages > 1) {
          for (let p = 2; p <= Math.min(totalPages, PAGE_CAP); p++) {
            try {
              const r2 = await fetchWithRetry(host.url + '&page=' + p, {
                headers: host.headers, cf: { cacheTtl: 0, cacheEverything: false }
              });
              const d2 = await r2.json();
              if (Array.isArray(d2.response) && d2.response.length) out = out.concat(d2.response);
              else break;
            } catch (e) { break; }
          }
        }
        // v252: zie boven. v254: deze uitgang ZWEEG — de console.warn hangt aan de `leeg`-constructie
        // onderaan, en die is alleen bereikbaar als GEEN van beide hosts returnt. Gemeten 16-07: de scan
        // van 13:00 UTC meldde 'FIXTURES GEWEIGERD: 2 van 2', maar een zoekopdracht op 'rate-limited' in
        // de Cloudflare-logs gaf NUL treffers. Dat sluit routes uit: geen exception (dan was hij naar
        // `leeg` gevallen) en geen errors.key/token (idem) -> host 2 antwoordde met een LEGE array en het
        // liep hier langs. De vlag werkte dus, de melder niet, en daardoor is niet te zien WELKE host
        // weigert en WAAROM de fallback niets levert. Puur diagnostisch: geen gedragswijziging.
        if (!out.length && _rateLimited) {
          out.rateLimited = true;
          const _err = data.errors === undefined ? 'undefined'
                     : JSON.stringify(data.errors).slice(0, 120);
          console.warn(`[apif] GEWEIGERD — host '${_rlHost}' gaf rate-limit na 3 pogingen; `
            + `host '${host.name}' antwoordde met ${out.length} items. `
            + `pad=${cleanPath.slice(0, 60)} http=${res.status} errors=${_err} `
            + `results=${data.results === undefined ? 'ontbreekt' : data.results} `
            + `msg=${String(data.message ?? '').slice(0, 80)}`);
        }
        return out;
      } catch(e) { break; }
    }
  }
  // v245: KRITISCH ONDERSCHEID. Voorheen gaf apif bij een opgegeven rate-limit gewoon [] terug, precies
  // zoals bij "geen data". De pagineerlus in fetchOddsForFixtures leest `if (!r?.length) break;` en stopte
  // dus bij een gewéigerde call alsof de laatste pagina bereikt was -> dekking viel stil weg, zonder enige
  // fout. Ik had dat gat in v242/v243 zelf ingebouwd terwijl ik dacht het te dichten.
  // De vlag hangt aan de array zelf: alle bestaande aanroepers zien nog steeds length 0 en veranderen niet
  // van gedrag; alleen wie het wil weten, kan `.rateLimited` uitlezen.
  const leeg = [];
  if (_rateLimited) { leeg.rateLimited = true; console.warn(`[apif] rate-limited na retries op host '${_rlHost}', geen enkele host returnde: ${path.slice(0, 60)}`); }
  if (_apiErrMsg) { leeg.apiError = _apiErrMsg; } // v276: warning al gelogd bij detectie; vlag mee voor aanroepers
  return leeg;
}

// v246: welke wedstrijden moeten deze ronde ECHT door de AI?
// De scan-prompt bevat per wedstrijd alleen namen/competitie/datum/1X2-odds en draait op temperature 0,
// dus bij identieke odds is het antwoord gegarandeerd identiek. Gemeten: 64% van de opeenvolgende
// odds-metingen is ongewijzigd -> twee van de drie heranalyses leverden letterlijk hetzelfde op.
// Dat kostte geen geld (12 gebundelde calls/dag, ~$5/mnd) maar wel BATCH-PLEKKEN: de cap van 24 met
// soonest-first pakte elk uur dezelfde kop van de lijst, terwijl wedstrijd 25+ moest wachten tot de
// eerste 24 waren afgetrapt. Op een zaterdag met 50 duels werd de staart dus nooit tijdig geanalyseerd.
// Nu: alleen analyseren bij (a) nog nooit geanalyseerd, (b) odds bewogen, of (c) ouder dan MAX_AGE.
// (c) is er omdat het Poisson-deel wél op teamstatistieken leunt die na gespeelde duels verschuiven,
// terwijl de odds gelijk kunnen blijven — zonder die grens zou een duel met stilstaande koers na één
// analyse nooit meer opnieuw bekeken worden.
// Faalt de lookup, dan analyseren we ALLES (oude gedrag): liever dubbel werk dan een gemiste wedstrijd.
async function selecteerTeAnalyseren(kandidaten, oddsMap, env, enableGoals) {
  const MAX_AGE_MIN = 360; // 6 uur
  if (!kandidaten.length) return kandidaten;
  try {
    const ids = kandidaten.map(m => m.fixtureId).filter(Boolean);
    if (!ids.length) return kandidaten;
    const rows = await sb(env, 'ai_analysis_log', 'GET', null,
      `?fixture_id=in.(${ids.join(',')})&select=fixture_id,home_odds,draw_odds,away_odds,goals_enabled,analysed_at`);
    const log = {};
    (rows || []).forEach(r => { log[r.fixture_id] = r; });
    const nu = Date.now();
    const gelijk = (a, b) => a !== null && a !== undefined && b !== null && b !== undefined && Number(a) === Number(b);
    const nodig = kandidaten.filter(m => {
      const r = log[m.fixtureId];
      if (!r) return true;                                   // nooit geanalyseerd
      if (!!r.goals_enabled !== !!enableGoals) return true;   // andere prompt-vorm
      const o = oddsMap[m.fixtureId];
      if (!o) return true;                                    // geen odds nu -> laat de bestaande logica beslissen
      if (!gelijk(o.home, r.home_odds) || !gelijk(o.draw, r.draw_odds) || !gelijk(o.away, r.away_odds)) return true; // koers bewogen
      if ((nu - new Date(r.analysed_at).getTime()) / 60000 > MAX_AGE_MIN) return true; // te oud (stat-drift)
      return false;                                           // ongewijzigd -> zelfde antwoord, overslaan
    });
    const over = kandidaten.length - nodig.length;
    if (over > 0) console.log(`[Scan] ${over} van ${kandidaten.length} wedstrijden overgeslagen (odds ongewijzigd sinds vorige analyse) — plekken vrij voor nieuwe duels`);
    return nodig;
  } catch(e) {
    console.error('[Scan] ai_analysis_log lookup faalde, analyseer alles:', e.message);
    return kandidaten;
  }
}

async function logAiAnalyse(matches, oddsMap, env, enableGoals) {
  try {
    const rows = matches.filter(m => m && m.fixtureId && oddsMap[m.fixtureId]).map(m => ({
      fixture_id: m.fixtureId,
      home_odds: oddsMap[m.fixtureId].home ?? null,
      draw_odds: oddsMap[m.fixtureId].draw ?? null,
      away_odds: oddsMap[m.fixtureId].away ?? null,
      goals_enabled: !!enableGoals,
      analysed_at: new Date().toISOString(),
    }));
    if (rows.length) await sb(env, 'ai_analysis_log', 'POST', rows, '?on_conflict=fixture_id');
  } catch(e) { console.error('[Scan] ai_analysis_log schrijven faalde (non-fataal):', e.message); }
}

// ── API-Football proxy (/apif/*) ─────────────────────────
async function handleAPIFootball(path, env, bypassCache = false) {
  const key = env.FOOTBALL_KEY || '';

  // v249: was /[&?]_cb=\d+/ — een NIET-numerieke _cb ontsnapte aan de strip en ging door naar
  // API-Football, dat onbekende velden weigert. Precies waarmee de v152-bug aantoonbaar werd
  // (_cb=abc -> "The _cb field do not exist."). Zelfde patroon als in apif: [^&]* + globaal.
  const cleanPath = path.replace(/[&?]_cb=[^&]*/g, '').replace(/\?&/, '?');

  // v216: niet-lege payload, ongeacht of API-Football een array of een object teruggeeft
  // v199: edge-caching voor traag-veranderende data (vorm/stats/predictions/stand/h2h/blessures) —
  // bespaart fors op de API-Football daglimiet bij herhaalde analyses van dezelfde wedstrijd.
  // Odds (met _cb -> bypassCache) blijven altijd vers.
  const _lc = cleanPath.toLowerCase();
  const CACHE_TTL = 21600; // 6 uur
  const cacheable = !bypassCache && (
    _lc.includes('/predictions') || _lc.includes('/standings') ||
    _lc.includes('/injuries') || _lc.includes('headtohead') ||
    _lc.includes('/statistics') ||
    (_lc.includes('/fixtures') && _lc.includes('team=') && _lc.includes('last='))
  );
  const _cache = caches.default;
  const _cacheKey = new Request('https://apif-cache.internal' + cleanPath);
  let _cacheDbg = cacheable ? 'miss' : 'skip:not-cacheable';
  if (cacheable) {
    try { const hit = await _cache.match(_cacheKey); if (hit) return hit; }
    catch(e) { _cacheDbg = 'match-fail:' + (e && e.message ? e.message.slice(0,80) : 'onbekend'); }
  }

  const hosts = [
    apiSportsHost(cleanPath, env),
    {
      url: 'https://api-football-v1.p.rapidapi.com/v3' + cleanPath,
      headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': 'api-football-v1.p.rapidapi.com' }
    }
  ];

  for (const host of hosts) {
    try {
      const fetchOptions = { headers: host.headers };
      if (bypassCache) {
        fetchOptions.cf = { cacheEverything: false, cacheTtl: 0 };
      }

      const res = await fetchWithRetry(host.url, fetchOptions);
      let data = await res.json();
      if (data.errors?.token || data.errors?.key) continue;
      // v245: de proxy retryde NIET bij een rate-limit en gaf de fout rechtstreeks door aan de frontend —
      // vandaar het "model n.v.t." dat v216 al beschreef: de statistics-calls die het Poisson-model voeden
      // vielen weg. Gemeten: bursts worden geweigerd terwijl de minuutteller op 293-299/300 staat, dus een
      // korte backoff volstaat meestal. Interne apif() deed dit al (v114); de proxy bleef achter.
      for (let rl = 0; rl < 2 && data.errors?.rateLimit; rl++) {
        await new Promise(r => setTimeout(r, 1500 * (rl + 1)));
        try {
          const res2 = await fetchWithRetry(host.url, fetchOptions);
          data = await res2.json();
        } catch(e) { break; }
      }

      const responseHeaders = { 'Content-Type': 'application/json', ...CORS };
      // v244: DIAGNOSE — API-Football stuurt zijn limieten mee als response-headers, maar de proxy gooide
      // ze weg. Daardoor was 'Too many requests' alleen een symptoom zonder cijfer, en citeerde ik de
      // limiet uit mijn geheugen (450/min bij Pro) i.p.v. hem te lezen. Aanleiding: ik liep bij ~8 calls
      // per minuut al tegen de limiet aan terwijl het dagverbruik op 102/7500 stond -- dat rijmt niet, en
      // het is niet academisch: v243 vuurt op een drukke dag tot 80 odds-calls in een burst.
      // x-ratelimit-limit/remaining = PER MINUUT, x-ratelimit-requests-limit/remaining = PER DAG.
      const _rlMin  = res.headers.get('x-ratelimit-limit');
      const _rlMinL = res.headers.get('x-ratelimit-remaining');
      const _rlDay  = res.headers.get('x-ratelimit-requests-limit');
      const _rlDayL = res.headers.get('x-ratelimit-requests-remaining');
      responseHeaders['X-APIF-Minuut'] = `${_rlMinL ?? '?'}/${_rlMin ?? '?'}`;
      responseHeaders['X-APIF-Dag']    = `${_rlDayL ?? '?'}/${_rlDay ?? '?'}`;
      responseHeaders['X-APIF-Host']   = host.url.includes('rapidapi') ? 'rapidapi' : 'api-sports';
      // v264: aparte header, want X-APIF-Host bestond al en er kan iets op lezen.
      // Zegt of deze call langs de eigen proxy ging (vast IP) of rechtstreeks.
      responseHeaders['X-APIF-Via']    = host.viaProxy === true ? 'proxy' : 'direct';
      if (bypassCache) {
        responseHeaders['Cache-Control'] = 'no-store, no-cache, must-revalidate';
        responseHeaders['X-Cache-Bypass'] = '1';
      }

      // v199: alleen geldige, niet-lege responses cachen (nooit rate-limit/lege fouten voor 6u vastzetten)
      // v216: ...maar `response` is niet altijd een array. teams/statistics geeft een OBJECT terug, waardoor
      // de Array.isArray-check daar altijd false was: het endpoint stond wél in `cacheable`, maar werd nooit
      // gecacht. Elke analyse deed dus 2 verse statistics-calls — precies de calls die het Poisson-model
      // voeden. Bij een rate-limit viel het model daardoor stil weg ("model n.v.t.").
      if (cacheable && data && !_hasErrors(data.errors) && _hasPayload(data.response)) {
        try {
          const toCache = new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...CORS, 'Cache-Control': `max-age=${CACHE_TTL}`, 'X-Cache-Policy': 'edge-6h' }
          });
          await _cache.put(_cacheKey, toCache);
          _cacheDbg = 'put-ok';
        } catch(e) { _cacheDbg = 'put-fail:' + (e && e.message ? e.message.slice(0,90) : 'onbekend'); }
      } else if (cacheable) {
        _cacheDbg = _hasErrors(data?.errors) ? 'skip:errors' : (!_hasPayload(data?.response) ? 'skip:empty-payload' : 'skip:onbekend');
      }
      responseHeaders['X-Cache-Debug'] = _cacheDbg;
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: responseHeaders
      });
    } catch(e) { continue; }
  }
  return json({ errors: { token: 'No valid API key' }, response: [] }, 401);
}

// ── Football-data.org proxy (/fd/*) ──────────────────────
async function handleFD(path, env) {
  const url = 'https://api.football-data.org' + path;
  const res = await fetchWithRetry(url, {
    headers: { 'X-Auth-Token': env.FD_KEY || '' }
  });
  const data = await res.json();
  return json(data);
}

// v181: kosten van directe (cron/systeem-)Anthropic-calls bijhouden in user_costs,
// zodat het in-app totaal de echte Anthropic-rekening benadert (niet alleen app-analyses).
// Schatting o.b.v. claude-sonnet-4-6 ($3/M in, $15/M uit); met prompt-caching is dit een lichte overschatting.
async function trackAnthropicCost(env, uid, usage) {
  try {
    if (!usage) return;
    const ti = usage.input_tokens || 0;
    const to = usage.output_tokens || 0;
    const cost = (ti * 3 + to * 15) / 1_000_000;
    await sb(env, 'rpc/increment_user_cost', 'POST', { p_uid: uid, p_tokens_in: ti, p_tokens_out: to, p_cost: cost });
  } catch(e) { console.warn('[Cost] tracking fout:', e.message); }
}

// ── Anthropic proxy (/anthropic) ────────────────────────
async function handleAnthropic(request, env) {
  // ── Rate limiting — beschermt tegen kosteninflatie ────
  // Geldt ALLEEN voor app-gebruikers die de gedeelde (worker-)key gebruiken.
  // Cron-scans + /scan-now lopen rechtstreeks met env.ANTHROPIC_KEY en worden NIET geteld.
  // v179: pre-launch strak — andere gebruikers beperkt tot we met testers gaan testen.
  const MAX_USER_CALLS_PER_DAY  = 25;  // v189: per gebruiker per dag (testfase, na Workers Paid — was 5)
  const MAX_GLOBAL_CALLS_PER_DAY = 300; // v189: totaal per dag over alle gedeelde-key-gebruikers (testfase — was 60)

  // v178: eigen Anthropic-key van de gebruiker → loopt op HUN tegoed; dan geen daglimiet en geen kostentracking op jou
  const clientKey = request.headers.get('x-user-anthropic-key') || '';
  const useOwnKey = clientKey.startsWith('sk-ant-');
  const apiKey = useOwnKey ? clientKey : env.ANTHROPIC_KEY;

  // Gebruiker UID uit Authorization header
  let uid = 'anonymous';
  const authHeader = request.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    // Gebruik eerste 16 chars van token als anonieme identifier
    uid = authHeader.slice(7, 23) || 'anonymous';
  }

  const today = new Date().toISOString().split('T')[0];
  const monthKey = today.slice(0, 7); // YYYY-MM

  // Daglimieten gelden alleen op de gedeelde (worker-)key. Eigen-key-gebruikers betalen zelf → geen limiet.
  if (!useOwnKey) {
    try {
      const globalKey = `usage/daily/${today}`;
      const globalCount = (await fb(env, globalKey)) || 0;
      if (globalCount >= MAX_GLOBAL_CALLS_PER_DAY) {
        console.warn(`[Anthropic] Globale daglimiet bereikt: ${globalCount}/${MAX_GLOBAL_CALLS_PER_DAY}`);
        return json({ error: 'Daglimiet bereikt — probeer morgen opnieuw of voeg je eigen Anthropic-key toe in Instellingen', type: 'rate_limit', limit: MAX_GLOBAL_CALLS_PER_DAY }, 429);
      }

      // Check gebruiker daglimiet
      if (uid !== 'anonymous') {
        const userKey = `usage/users/${uid}/${today}`;
        const userCount = (await fb(env, userKey)) || 0;
        if (userCount >= MAX_USER_CALLS_PER_DAY) {
          console.warn(`[Anthropic] User daglimiet bereikt: ${uid} ${userCount}/${MAX_USER_CALLS_PER_DAY}`);
          return json({ error: `Jouw daglimiet van ${MAX_USER_CALLS_PER_DAY} analyses bereikt — morgen weer, of voeg je eigen Anthropic-key toe in Instellingen voor onbeperkt gebruik`, type: 'rate_limit', limit: MAX_USER_CALLS_PER_DAY }, 429);
        }
        // Teller ophogen
        await fb(env, userKey, 'PUT', userCount + 1);
      }

      // Globale teller ophogen
      await fb(env, globalKey, 'PUT', globalCount + 1);
    } catch(e) {
      console.warn('[Anthropic] Rate limit check fout (doorgaan):', e.message);
    }
  }

  // v97: valideer body vóór doorsturen naar Anthropic — voorkomt 400-loop bij multiscan
  let body;
  try {
    body = await request.text();
    const parsed = JSON.parse(body);
    if (!parsed.messages || !Array.isArray(parsed.messages) || parsed.messages.length === 0) {
      console.error('[Anthropic] Body afgewezen: messages array leeg of ontbreekt');
      return json({ error: 'messages array leeg of ontbreekt', type: 'invalid_request' }, 400);
    }
    const firstMsg = parsed.messages[0];
    if (!firstMsg.content || (typeof firstMsg.content === 'string' && !firstMsg.content.trim())) {
      console.error('[Anthropic] Body afgewezen: eerste message heeft lege content');
      return json({ error: 'message content is leeg', type: 'invalid_request' }, 400);
    }
  } catch(e) {
    console.error('[Anthropic] Body afgewezen: invalide JSON —', e.message);
    return json({ error: 'Invalide JSON body: ' + e.message, type: 'invalid_request' }, 400);
  }

  const res = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body
  });
  const data = await res.json();

  if (res.status === 400) {
    console.error('[Anthropic] 400 van Anthropic API:', JSON.stringify(data).substring(0, 300));
  }

  // ── Kosten bijhouden in Supabase (alleen op de gedeelde key — eigen-key-gebruik is hun kost) ──
  if (res.status === 200 && data.usage && !useOwnKey) {
    try {
      const inputTokens  = data.usage.input_tokens  || 0;
      const outputTokens = data.usage.output_tokens || 0;
      // claude-sonnet-4-6: $3/M input, $15/M output
      const costUSD = (inputTokens * 3 + outputTokens * 15) / 1_000_000;
      // v180: atomair ophogen via RPC — juiste kolommen (calls/tokens_in/tokens_out/total_usd), uid is PK.
      // Loste de kapotte upsert op die naar niet-bestaande kolommen (month/ai_calls/total_cost) schreef.
      await sb(env, 'rpc/increment_user_cost', 'POST', {
        p_uid: uid,
        p_tokens_in: inputTokens,
        p_tokens_out: outputTokens,
        p_cost: costUSD,
      });
      console.log(`[Anthropic] ${uid} — ${inputTokens}in/${outputTokens}out — $${costUSD.toFixed(5)}`);
    } catch(e) {
      console.warn('[Anthropic] Kosten tracking fout:', e.message);
    }
  }

  return json(data, res.status);
}

// ── Generic URL proxy (?url=...) ────────────────────────
async function handleProxy(urlParam, request, env) {
  const targetUrl = decodeURIComponent(urlParam);
  const isAnthropic = targetUrl.includes('api.anthropic.com');
  const headers = { 'Content-Type': 'application/json' };
  if (isAnthropic) {
    headers['x-api-key'] = env.ANTHROPIC_KEY;
    headers['anthropic-version'] = '2023-06-01';
  }
  const init = { method: request.method, headers };
  if (request.method !== 'GET') init.body = await request.text();
  const res = await fetchWithRetry(targetUrl, init);
  const data = await res.text();
  return new Response(data, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/json',
      ...CORS
    }
  });
}

// ── Odds ophalen voor wedstrijden ────────────────────────
// v248: optioneel `stats`-object om de rate-limit-telling naar buiten te krijgen. BEWUST een aparte
// parameter en GEEN veld op oddsMap: die map wordt op 8 plekken geteld met Object.keys().length en in
// runScan geitereerd met Object.entries() -- een vlag daarin komt binnen als een wedstrijd met odds.
// Dat was precies de v245-bug die v246 moest opruimen; hem hier opnieuw invoeren zou die les weggooien.
// Aanleiding: de droogloop van 16-07 gaf 1/24 dekking terwijl de API aantoonbaar odds heeft voor
// league 3 (6 fixtures) en 848 (~26). De rlHits-telling bestond al sinds v245/v247 maar ging alleen naar
// console.log, dus buiten de scan-test om onzichtbaar -- ik kon alleen AFLEIDEN dat het de throttle was.
// Dit maakt het meetbaar: geweigerd of echt geen odds, zwart op wit.
async function fetchOddsForFixtures(fixtureIds, env, maxCalls = 36, enableGoals = false, matches = null, stats = null, rawBooks = null) {
  const _st = stats && typeof stats === 'object' ? stats : null;
  const _bump = (k, n = 1) => { if (_st) _st[k] = (_st[k] || 0) + n; };
  const _rb = rawBooks && typeof rawBooks === 'object' ? rawBooks : null; // v277: per-boek 1X2 -> oddsvergelijker (aparte param, GEEN veld op oddsMap; zie v248-regel hierboven)
  const oddsMap = {};
  let oddsCallsUsed = 0; // bewaak Cloudflare 50-subrequest-budget

  const median = arr => {
    const s = arr.filter(x => x > 1).sort((a, b) => a - b);
    if (!s.length) return 0;
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  // v118: consensus over ALLE bookmakers in 1 call per match (i.p.v. 1 bookmaker + fallbackketen).
  // Mediaan per uitkomst = robuust tegen uitschieters/stale prijzen -> minder valse value-picks.
  function parseConsensus(data, fid) {
    if (!data || !data.length) return false;
    const books = data[0]?.bookmakers || [];
    const H = [], D = [], A = [];
    const _perBook = {};
    for (const bm of books) {
      const bet = bm.bets?.find(b => b.id === 1);
      if (!bet) continue;
      const h = parseFloat(bet.values?.find(v => v.value === 'Home')?.odd || 0);
      const d = parseFloat(bet.values?.find(v => v.value === 'Draw')?.odd || 0);
      const a = parseFloat(bet.values?.find(v => v.value === 'Away')?.odd || 0);
      if (h > 1 && d > 1 && a > 1) { H.push(h); D.push(d); A.push(a); if (bm.name) _perBook[bm.name] = { h, d, a }; }
    }
    if (!H.length) return false;
    if (_rb && Object.keys(_perBook).length) _rb[fid] = _perBook; // v277: per-boek 1X2 -> market_consensus.bookmaker_odds
    const home = parseFloat(median(H).toFixed(2));
    const draw = parseFloat(median(D).toFixed(2));
    const away = parseFloat(median(A).toFixed(2));
    // v128: Shin de-vig i.p.v. proportioneel — corrigeert favorite-longshot bias
    const [fh, fd, fa] = shinDevig([home, draw, away]);
    oddsMap[fid] = {
      home, draw, away,
      books: H.length,
      fair: {
        home: parseFloat((fh * 100).toFixed(1)),
        draw: parseFloat((fd * 100).toFixed(1)),
        away: parseFloat((fa * 100).toFixed(1))
      }
    };
    return true;
  }

  // v173: O/U (bet 5) + BTTS (bet 8) — vult bestaande 1X2-entry aan met consensus + 2-weg de-vig.
  function parseGoalConsensus(data, fid) {
    if (!data || !data.length || !oddsMap[fid]) return;
    const books = data[0]?.bookmakers || [];
    const ouRaw = { '1.5': { O: [], U: [] }, '2.5': { O: [], U: [] }, '3.5': { O: [], U: [] } };
    const bttsRaw = { Y: [], N: [] };
    const ahRaw = {}; // v205: Asian Handicap (bet 4), genormaliseerd naar THUIS-handicap
    for (const bm of books) {
      for (const bet of (bm.bets || [])) {
        if (bet.id === 5) {
          for (const v of (bet.values || [])) {
            const mt = /^(Over|Under)\s+(\d+\.\d)$/.exec(v.value || '');
            if (!mt || !ouRaw[mt[2]]) continue;
            const od = parseFloat(v.odd || 0);
            if (od > 1) ouRaw[mt[2]][mt[1] === 'Over' ? 'O' : 'U'].push(od);
          }
        } else if (bet.id === 8) {
          for (const v of (bet.values || [])) {
            const od = parseFloat(v.odd || 0);
            if (od <= 1) continue;
            if (/^yes$/i.test(v.value)) bttsRaw.Y.push(od);
            else if (/^no$/i.test(v.value)) bttsRaw.N.push(od);
          }
        } else if (bet.id === 4) {
          // v213: API-Football geeft de AH-lijn ALTIJD vanuit thuis-perspectief; "Away +1.5" is de
          // uit-kant van thuis-handicap +1.5 (niet -1.5). Home én Away met dezelfde waarde = het paar.
          // Was een tekenflip-bug (raw:-raw) -> verkeerde odds-koppeling -> kapotte de-vig in de AH-shadow.
          for (const v of (bet.values || [])) {
            const mt = /^(Home|Away)\s*([+-]?\d+(?:\.\d+)?)$/.exec(v.value || '');
            if (!mt) continue;
            const od = parseFloat(v.odd || 0); if (!(od > 1)) continue;
            const raw = parseFloat(mt[2]);
            const k = (Math.round(raw * 4) / 4).toFixed(2);
            if (!ahRaw[k]) ahRaw[k] = { H: [], A: [] };
            ahRaw[k][mt[1] === 'Home' ? 'H' : 'A'].push(od);
          }
        }
      }
    }
    const ou = {};
    for (const line of ['1.5', '2.5', '3.5']) {
      const O = median(ouRaw[line].O), U = median(ouRaw[line].U);
      if (O > 1 && U > 1) {
        const f = devig2(O, U);
        ou[line] = { over: parseFloat(O.toFixed(2)), under: parseFloat(U.toFixed(2)), fairOver: f.a, fairUnder: f.b };
      }
    }
    const Y = median(bttsRaw.Y), N = median(bttsRaw.N);
    if (Object.keys(ou).length) oddsMap[fid].ou = ou;
    if (Y > 1 && N > 1) {
      const f = devig2(Y, N);
      oddsMap[fid].btts = { yes: parseFloat(Y.toFixed(2)), no: parseFloat(N.toFixed(2)), fairYes: f.a, fairNo: f.b };
    }
    // v205: AH-consensus per lijn (mediaan + 2-weg Shin de-vig), alleen lijnen met beide kanten
    const ah = {};
    for (const k of Object.keys(ahRaw)) {
      const Hm = median(ahRaw[k].H), Am = median(ahRaw[k].A);
      if (Hm > 1 && Am > 1) { const f = devig2(Hm, Am); ah[k] = { home: parseFloat(Hm.toFixed(2)), away: parseFloat(Am.toFixed(2)), fairHome: f.a, fairAway: f.b }; }
    }
    if (Object.keys(ah).length) oddsMap[fid].ah = ah;
  }

  // v146: datum-bulk odds fetch — 1-2 calls i.p.v. 1 per fixture
  // /odds?date=YYYY-MM-DD haalt alle odds voor die dag in 1 call op (paginated)
  // Veel minder API-calls, voorkomt rate limiting
  try {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const fixtureSet = new Set(fixtureIds);

    // v243: ODDS PER COMPETITIE i.p.v. de hele wereld doorbladeren.
    // v242 liet de datum-bulk doorpagineren, maar dat plafond (12 pagina's) is niet genoeg: 15-07 --
    // ongeveer de rustigste dag van het jaar, tussen WK en clubseizoen -- had er al ACHT. Een zaterdag
    // in het seizoen heeft er veel meer, en dan valt de dekking opnieuw stil. Meten kan niet: API-Football
    // gooit odds weg zodra een wedstrijd gespeeld is, dus een drukke zaterdag is niet na te bootsen.
    // Bovendien is >90% van die wereldwijde lijst irrelevant (Braziliaanse regionale competities e.d.)
    // die wij niet scannen -- we bladerden dus vooral door ballast op zoek naar onze eigen fixtures.
    // Nu: alleen (datum, competitie)-combinaties opvragen waar we ECHT wedstrijden hebben. Dat is
    // begrensd door ons eigen programma i.p.v. door het wereldaanbod, en elk resultaat is relevant.
    // Het seizoen komt uit de fixture zelf (f.league.season), niet uit een aparte tabel: leagueConfig
    // (alles 2026) en de SEASON_2026-set in runScanTest (top-5 -> 2025) spreken elkaar tegen, en een
    // derde bron toevoegen zou dat alleen erger maken. Zonder season weigert /odds ("The Season field
    // is required"), dus zonder bruikbare matches vallen we terug op de datum-bulk van v242.
    const _perLeague = Array.isArray(matches) && matches.some(m => m && m.leagueId && m.leagueSeason);
    if (_perLeague) {
      const plan = new Map(); // "datum|league|season" -> true
      matches.forEach(m => {
        if (!m || !m.fixtureId || !m.leagueId || !m.leagueSeason) return;
        const d = (m.matchDate || today);
        if (d !== today && d !== tomorrow) return; // odds bestaan alleen voor vandaag/morgen
        plan.set(`${d}|${m.leagueId}|${m.leagueSeason}`, true);
      });
      const ODDS_PAGE_SIZE = 10;
      const ODDS_MAX_PAGES = 6; // per (datum, competitie) ruim voldoende; 848 had er 3 op de drukste dag
      let rlHits = 0, comboFouten = 0;
      for (const key of plan.keys()) {
        if (oddsCallsUsed >= maxCalls) { console.warn(`[Odds] maxCalls ${maxCalls} bereikt — ${plan.size} combinaties gepland, rest ONGEDEKT`); break; }
        if (fixtureIds.every(id => oddsMap[id])) break;
        const [date, lg, seizoen] = key.split('|');
        try {
          for (let page = 1; page <= ODDS_MAX_PAGES; page++) {
            if (oddsCallsUsed >= maxCalls) break;
            // v249: `&_cb=${Date.now()}` stond hier sinds v152. apif() gebruikt het pad RECHTSTREEKS —
            // de _cb-strip zit alleen in handleAPIFootball (de proxy) — dus die parameter ging mee naar
            // API-Football, en die weigert onbekende velden: {"_cb": "The _cb field do not exist."}.
            // Gevolg: data.response = [] -> out = [] -> `if (!r?.length) break` -> NUL odds, zonder fout
            // en zonder rate-limit. Precies zoals 'geen data'. Buit niets in: apif zet op elke fetch al
            // cf:{cacheTtl:0,cacheEverything:false}, dus er was geen cache om te bustten.
            const r = await apif(`/odds?date=${date}&league=${lg}&season=${seizoen}&bet=1&page=${page}`, env);
            oddsCallsUsed++;
            // v245: een geweigerde call is GEEN lege pagina. Voorheen liep dit in `!r?.length` en brak de
            // lus af alsof de data op was -> stille onderdekking. Nu apart geteld en zichtbaar.
            if (r && r.rateLimited) { rlHits++; comboFouten++; _bump('rl_competitie'); break; }
            if (!r?.length) break;
            r.forEach(item => {
              const fid = item.fixture?.id;
              if (fid && fixtureSet.has(fid) && !oddsMap[fid]) parseConsensus([item], fid);
            });
            if (r.length < ODDS_PAGE_SIZE) break;
          }
        } catch(e) { comboFouten++; console.error(`[Odds] ${date} league ${lg} fout:`, e.message); }
      }
      if (_st) { _st.combinaties_gepland = plan.size; _st.pad = 'per_competitie'; }
      const _dek = fixtureIds.filter(id => oddsMap[id]).length;
      console.log(`[Odds] per-competitie klaar: ${_dek}/${fixtureIds.length} gedekt na ${oddsCallsUsed} calls over ${plan.size} combinaties`);
      if (rlHits) console.error(`[Odds] ⚠️ ${rlHits} van ${plan.size} competitie-combinaties afgebroken door rate-limit — dekking is ONVOLLEDIG, niet 'geen odds'`);
      // v246: hier stond `oddsMap._onvolledig = comboFouten` — een vlag ALS SLEUTEL in de oddsMap.
      // Fout van mezelf in v245: op 8 plekken wordt Object.keys(oddsMap).length geteld (die zouden
      // allemaal 1 te hoog zijn) en runScan doet Object.entries(oddsMap).forEach(([fid, odds]) => ...),
      // waar die vlag als een wedstrijd met odds zou binnenkomen. De console.error hierboven en de
      // dekkingsmetriek van v243 dekken de zichtbaarheid al; een sleutel in de datastructuur is
      // daarvoor de verkeerde plek.
    } else {
      // Terugval: datum-bulk met doorpaginering (v242). Gebruikt zodra we geen competitie+seizoen per
      // wedstrijd hebben (bv. snapshotOddsOnly, dat zijn lijst uit odds_snapshots haalt zonder seizoen).
      const ODDS_PAGE_SIZE = 10;
      const ODDS_MAX_PAGES = 12;
      // v247: de rateLimited-vlag van v245 werd hier NIET gelezen — de fix zat alleen in de
      // per-competitie-lus hierboven. Dit is niet de dode tak: snapshotOddsOnly heeft geen seizoen per
      // wedstrijd en valt dus ALTIJD hier binnen. Dat is de 23:00-05:00-run die de SLOTKOERS vormt, de
      // ruggengraat van CLV. Een burst-throttle las daar als 'laatste pagina' -> slotkoers viel stil weg
      // en de CLV van die dag was onvolledig zonder enig spoor. Exact de bug die v245 dacht te dichten.
      if (_st) _st.pad = 'datum_bulk';
      let bulkRlHits = 0;
      for (const date of [today, tomorrow]) {
        if (oddsCallsUsed >= maxCalls) break;
        try {
          for (let page = 1; page <= ODDS_MAX_PAGES; page++) {
            if (oddsCallsUsed >= maxCalls) break;
            const r = await apif(`/odds?date=${date}&bet=1&page=${page}`, env); // v249: zie boven — _cb brak de call
            oddsCallsUsed++;
            if (r && r.rateLimited) { bulkRlHits++; _bump('rl_bulk'); break; }
            if (!r?.length) break;
            r.forEach(item => {
              const fid = item.fixture?.id;
              if (fid && fixtureSet.has(fid) && !oddsMap[fid]) parseConsensus([item], fid);
            });
            if (r.length < ODDS_PAGE_SIZE) break;
            if (fixtureIds.every(id => oddsMap[id])) break;
          }
        } catch(e) { console.error(`[Odds] Bulk datum ${date} fout:`, e.message); }
      }
      console.log(`[Odds] datum-bulk klaar: ${fixtureIds.filter(id => oddsMap[id]).length}/${fixtureIds.length} gedekt na ${oddsCallsUsed} calls`);
      if (bulkRlHits) console.error(`[Odds] ⚠️ datum-bulk ${bulkRlHits}x afgebroken door rate-limit — dekking is ONVOLLEDIG, niet 'geen odds'`);
    }

    // Fallback: nog ontbrekende fixtures individueel ophalen (max 5)
    const missing = fixtureIds.filter(id => !oddsMap[id]);
    if (missing.length && oddsCallsUsed < maxCalls) {
      console.log(`[Odds] Fallback: ${missing.length} fixtures individueel ophalen`);
      const toFetch = missing.slice(0, Math.min(5, maxCalls - oddsCallsUsed));
      oddsCallsUsed += toFetch.length;
      const rs = await apifChunked(toFetch, (id) => apif(`/odds?fixture=${id}&bet=1`, env)); // v274: gechunkt i.p.v. Promise.allSettled
      // v247: een geweigerde call gaf hier een lege array die niet van 'geen odds' te onderscheiden was.
      let fbRl = 0;
      rs.forEach((r, j) => {
        if (r.status !== 'fulfilled') return;
        if (r.value && r.value.rateLimited) { fbRl++; _bump('rl_fallback'); return; }
        parseConsensus(r.value, toFetch[j]);
      });
      if (fbRl) console.error(`[Odds] ⚠️ fallback: ${fbRl}/${toFetch.length} fixtures afgebroken door rate-limit (geen odds-uitspraak mogelijk)`);
    }

    // v173b: doelpunten-markten per-fixture ophalen (datum-bulk mist WK-fixtures diep in paginatie).
    // Eén call zonder bet-filter levert bet 5 (O/U) én bet 8 (BTTS) tegelijk → 1 call per fixture.
    if (enableGoals) {
      const covered = fixtureIds.filter(id => oddsMap[id]); // alleen waar 1X2-consensus al lukte
      const budget = Math.max(0, maxCalls - oddsCallsUsed);
      const toFetch = covered.slice(0, budget);
      oddsCallsUsed += toFetch.length;
      if (covered.length > toFetch.length) console.warn(`[Odds] Goal-budget krap: ${covered.length - toFetch.length} fixtures zonder goal-odds (budget ${budget})`);
      const rs = await apifChunked(toFetch, (id) => apif(`/odds?fixture=${id}`, env)); // v274: gechunkt — dit was de grootste burst (tot maxCalls)
      // v219: gefaalde/lege goal-calls niet langer stil inslikken — dit was de blinde vlek
      // achter de wisselende goal_odds-dekking (0-63% per dag) in odds_snapshots.
      // v247: rateLimited apart van 'leeg' — beide gaven [] en waren dus niet te onderscheiden.
      let failed = 0, empty = 0, rl = 0;
      rs.forEach((r, j) => {
        if (r.status === 'fulfilled') {
          if (r.value && r.value.rateLimited) { rl++; _bump('rl_goals'); return; }
          if (!r.value || !r.value.length) { empty++; return; }
          parseGoalConsensus(r.value, toFetch[j]);
        } else { failed++; console.error(`[Odds] Goal-call fixture ${toFetch[j]} faalde: ${r.reason?.message || r.reason}`); }
      });
      if (rl) console.error(`[Odds] ⚠️ Goal-markten: ${rl}/${toFetch.length} calls rate-limited — goal_odds ONVOLLEDIG, niet 'geen goal-odds'`);
      const withGoals = Object.values(oddsMap).filter(o => o.ou || o.btts).length;
      console.log(`[Odds] Goal-markten: ${withGoals}/${Object.keys(oddsMap).length} fixtures met O/U of BTTS (${toFetch.length} calls, ${failed} gefaald, ${empty} leeg, ${rl} rate-limited)`);
    }
  } catch (e) {
    console.error('[Odds] Fout bij ophalen:', e);
  }
  const n = Object.keys(oddsMap).length;
  if (_st) { _st.calls = oddsCallsUsed; _st.gedekt = n; _st.van = fixtureIds.length; }
  const avgBooks = n ? (Object.values(oddsMap).reduce((s, o) => s + (o.books || 0), 0) / n).toFixed(1) : 0;
  console.log(`[Odds] ${n}/${fixtureIds.length} fixtures met consensus-odds (gem. ${avgBooks} bookmakers)`);
  return oddsMap;
}

// ── Poisson value berekening ─────────────────────────────
function impliedProb(odds) {
  if (!odds || odds <= 1) return 0;
  return 1 / odds;
}

// v157: value-hardening tegen favorite-longshot-bias
const MARKET_SHRINK_BASE       = 0.45; // v161: iets lichter (was 0.50) — meer thuis/uit-value laten doorkomen
const MARKET_SHRINK_TOURNAMENT = 0.55; // v161: iets lichter (was 0.65) — toernooi nog steeds scherper richting markt
// v190: tier-gebaseerde bias-correctie (ALLEEN 1X2). WK-backtest toonde dat het model lage
// kansen overschat (13,4%→10,5% werkelijk; 26%→23%) en favorieten onderschat. Extra shrinkage
// naar de markt in het lage-kansgebied dempt de valse "value" op overschatte longshots/draws.
// Conservatief + instelbaar; hertunen op clubdata na 20-07 (zet op 0 om uit te schakelen).
const LOWPROB_EXTRA_SHRINK_1_DEFAULT = 0.15; // aiKans < 20%  (v194: default, runtime-overschrijfbaar)
const LOWPROB_EXTRA_SHRINK_2_DEFAULT = 0.08; // aiKans 20–35% (v194: default, runtime-overschrijfbaar)
let TUNE = { s1: LOWPROB_EXTRA_SHRINK_1_DEFAULT, s2: LOWPROB_EXTRA_SHRINK_2_DEFAULT }; // v194: geladen uit model_config bij scan-start (auto-kalibratie)

// v208: Elo/SoS-blend (bouwplan stap 5). DORMANT: raakt picks pas als elo_blend_w>0 in model_config.
const ELO_MIN_GAMES         = 6;     // blend pas als BEIDE teams >= zoveel gespeelde duels (rijpheid)
const ELO_MAX_W             = 0.5;   // veiligheidsbovengrens op het blend-gewicht
const ENABLE_ELO_FOUNDATION = true;  // team-ID plumbing + markt-seeding + rijping — raakt picks NIET
let ELO_BLEND_W = 0;                 // geladen uit model_config bij scan-start; 0 = geen invloed op picks
const ELO_SHADOW_W = 0.30;           // v211: referentiegewicht voor de schaduw-blend (backtest-log), onafhankelijk van de live-vlag
const ELO_VALIDATE_MIN_N = 40;       // v212: vanaf zoveel gerijpte schaduw-duels meldt /health dat de blend te valideren is

// v215: MARKT-ANKER OP HET DOELPUNTENTOTAAL. De Poisson-lambda's zijn SoS-blind; wijkt het model-totaal
// materieel af van het markt-impliciete totaal (uit de de-vigde Over 2.5), dan zijn ALLE goal-markten
// systematisch dezelfde fout (Under 1.5/2.5/3.5 + BTTS-Nee allemaal "value"). Dat is geen edge maar een
// scheve parameter. Het anker trekt het TOTAAL naar de markt en laat de supremacie (verhouding lh:la)
// ongemoeid. DORMANT: raakt picks pas als lambda_anchor_w > 0 in model_config.
const LAMBDA_ANCHOR_DEADBAND = 0.30; // < 0.30 goal verschil = ruis, niet corrigeren
const LAMBDA_ANCHOR_MAX_W    = 1.0;  // veiligheidsbovengrens
let   LAMBDA_ANCHOR_W        = 0;    // geladen uit model_config; 0 = picks byte-identiek
// v194: auto-kalibratie — instelbaar, veilig, dry-run-first
const AUTOTUNE_ENABLED  = true;          // analyse + logging aan
const AUTOTUNE_APPLY    = true;          // v195: ACTIEF — past aanbevelingen toe. Rem blijft: alleen clubdata >= CLUB_ERA_START (20-07) en n >= AUTOTUNE_MIN_N; stappen klein/begrensd/gelogd.
const AUTOTUNE_MIN_N    = 40;            // min. afgerekende tips per band voordat er iets gebeurt
const AUTOTUNE_TOL      = 3;             // tolerantie in procentpunten (binnen = geen aanpassing)
const AUTOTUNE_STEP     = 0.02;          // stapgrootte per run (klein = stabiel)
const AUTOTUNE_MAX      = 0.30;          // bovengrens extra-shrink
const CLUB_ERA_START    = '2026-07-20';  // alleen clubdata (WK uitgesloten)
const LONGSHOT_ODDS            = 3.5;  // odds >= dit = longshot
const LONGSHOT_MIN_SHARP       = 55;   // longshot-value alleen toegestaan mét sharpScore >= dit
const SHADOW_MIN_RAW_DIV       = 3;    // v172: schaduw-vangnet — min. RUWE divergentie (pp) om sub-3% kandidaat alsnog te loggen

// v125: value = de-vigde procentpunt-edge (modelkans% − faire consensus-implied%).
// v157: model eerst richting de markt schrinken zodat AI-ruis niet als value op longshots verschijnt.
// Intern consistent met CLV — we meten tegen de faire (vig-vrije) marktkans, niet tegen de ruwe odds.
function calculateValue(aiKans, fairImpliedPct, pick, marketShrink = 0) {
  if (fairImpliedPct == null || fairImpliedPct <= 0) return 0;
  // v190: tier-correctie alleen op 1X2 — extra shrink waar het model lage kansen overschat
  let extra = 0;
  if (pick === '1' || pick === 'X' || pick === '2') {
    if (aiKans < 20)      extra = TUNE.s1;
    else if (aiKans < 35) extra = TUNE.s2;
  }
  const w = Math.min(Math.max(marketShrink + extra, 0), 0.9);
  const modelProb = w * fairImpliedPct + (1 - w) * aiKans; // shrinkage naar markt-prior (v190: tier-versterkt)
  let value = modelProb - fairImpliedPct;
  if (pick === 'X') value = value * 0.88; // v161: gelijkspel-straf iets verzacht (was 0.80)
  return parseFloat(value.toFixed(1));
}

// v125: EV% en half-Kelly o.b.v. werkelijk verkrijgbare odds (mét vig) — voor staking, niet voor selectie.
function calcEV(aiKans, odds) {
  if (!odds || odds <= 1) return 0;
  return parseFloat((((aiKans / 100) * odds - 1) * 100).toFixed(1));
}
function calcKellyW(aiKans, odds) {
  if (!aiKans || !odds || odds <= 1) return 0;
  const p = aiKans / 100, b = odds - 1;
  const k = (b * p - (1 - p)) / b;
  return Math.max(0, parseFloat((k * 50).toFixed(2))); // half-Kelly in %
}
// v128: faire consensus-implied kans (%) voor de gekozen uitslag
function fairImpliedFor(odds, pick) {
  if (!odds || !odds.fair) return null;
  return pick === '1' ? odds.fair.home : pick === 'X' ? odds.fair.draw : odds.fair.away;
}

// v128: Shin de-vig — corrigeert favorite-longshot bias (underdog-prijs draagt relatief meer marge).
// Geeft ware kansen (0-1) terug; valt terug op proportioneel als er nauwelijks marge is.
function shinDevig(oddsArr) {
  const b = oddsArr.map(o => (o > 1 ? 1 / o : 0));
  const B = b.reduce((s, x) => s + x, 0);
  if (B <= 1.0001) return b.map(x => x / (B || 1)); // geen marge -> proportioneel
  const probs = (z) => b.map(bi => (Math.sqrt(z * z + 4 * (1 - z) * bi * bi / B) - z) / (2 * (1 - z)));
  let lo = 0, hi = 0.5; // Σp is monotoon dalend in z; zoek z zodat Σp = 1
  for (let it = 0; it < 60; it++) {
    const z = (lo + hi) / 2;
    const sum = probs(z).reduce((s, x) => s + x, 0);
    if (sum > 1) lo = z; else hi = z;
  }
  return probs((lo + hi) / 2);
}

// ── v173: doelpunten-markten (O/U + BTTS) uit verwachte goals ─────────────
// Onafhankelijke Poisson op lambdaHome/lambdaAway → modelkansen per markt.
const ENABLE_AH_SHADOW = true; // v205: Asian Handicap schaduw-trackrecord (puur datacollectie, geen picks)
const MAX_AI_ANALYSES_PER_SCAN = 24; // v196: 12->24 — meer wedstrijden vooruit scannen zodat MARKT-plaatshouders sneller een echte AI-tip krijgen. Ruim binnen subrequest-budget (Paid=1000) en kosten (Haiku). Rest schuift door naar de volgende uur-run.
const GOAL_LINES = ['1.5', '2.5', '3.5'];

function poissonPmf(k, lambda) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logp = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) logp -= Math.log(i);
  return Math.exp(logp);
}

// Geeft modelkansen (0-100) voor O/U 1.5/2.5/3.5 + BTTS uit lambdaHome/lambdaAway.
function goalMarkets(lh, la, maxGoals = 10) {
  lh = Math.max(0.05, Math.min(6, lh));
  la = Math.max(0.05, Math.min(6, la));
  if (!isFinite(lh) || !isFinite(la)) return null;
  const ph = [], pa = [];
  for (let i = 0; i <= maxGoals; i++) { ph[i] = poissonPmf(i, lh); pa[i] = poissonPmf(i, la); }
  let pO15 = 0, pO25 = 0, pO35 = 0, pBTTS = 0;
  for (let i = 0; i <= maxGoals; i++) for (let j = 0; j <= maxGoals; j++) {
    const p = ph[i] * pa[j], tot = i + j;
    if (tot >= 2) pO15 += p;
    if (tot >= 3) pO25 += p;
    if (tot >= 4) pO35 += p;
    if (i >= 1 && j >= 1) pBTTS += p;
  }
  const pct = x => parseFloat((x * 100).toFixed(1));
  return {
    ou: {
      '1.5': { over: pct(pO15), under: pct(1 - pO15) },
      '2.5': { over: pct(pO25), under: pct(1 - pO25) },
      '3.5': { over: pct(pO35), under: pct(1 - pO35) },
    },
    btts: { yes: pct(pBTTS), no: pct(1 - pBTTS) },
  };
}

// 2-weg Shin de-vig (over/under of yes/no). Geeft faire kansen (0-100).
function devig2(a, b) {
  const [fa, fb] = shinDevig([a, b]);
  return { a: parseFloat((fa * 100).toFixed(1)), b: parseFloat((fb * 100).toFixed(1)) };
}

// v205: Asian Handicap model-kansen — zelfde Poisson-basis als goalMarkets, plus Dixon-Coles tau
// (lage scores wegen zwaar bij AH-pushes rond lijn 0/±1). homeLine = handicap vanuit THUIS.
// Kwartlijnen splitsen in twee halve lijnen. Push-conditioneel: home = pWin/(pWin+pLoss),
// direct vergelijkbaar met de 2-weg de-vigde markt.
function ahTau(h, a, lh, la, rho = -0.13) {
  if (h === 0 && a === 0) return 1 - lh * la * rho;
  if (h === 0 && a === 1) return 1 + lh * rho;
  if (h === 1 && a === 0) return 1 + la * rho;
  if (h === 1 && a === 1) return 1 - rho;
  return 1;
}
// v214: optioneel t1x2 = {p1,pX,p2} (gecorrigeerde 1X2 in %). Dan wordt de scorematrix herschaald zodat
// haar marginalen exact die 1X2 zijn -> AH consistent met de 1X2 (AH -0.5 == P1, DNB == P1/(P1+P2)).
function asianProbsW(lh, la, homeLine, maxGoals = 10, t1x2 = null) {
  lh = Math.max(0.05, Math.min(6, lh)); la = Math.max(0.05, Math.min(6, la));
  if (!isFinite(lh) || !isFinite(la) || !isFinite(homeLine)) return null;
  const grid = []; let tot = 0;
  for (let h = 0; h <= maxGoals; h++) for (let a = 0; a <= maxGoals; a++) {
    const p = poissonPmf(h, lh) * poissonPmf(a, la) * ahTau(h, a, lh, la);
    grid.push([h, a, p]); tot += p;
  }
  if (tot <= 0) return null;
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
  let pW = 0, pL = 0;
  for (const c of comps) for (const [h, a, p0] of grid) {
    const adj = (h - a) + c;
    if (adj > 0.001) pW += p0 / tot; else if (adj < -0.001) pL += p0 / tot;
  }
  pW /= comps.length; pL /= comps.length;
  if (pW + pL <= 0) return null;
  return { home: parseFloat((pW / (pW + pL) * 100).toFixed(1)), away: parseFloat((pL / (pW + pL) * 100).toFixed(1)) };
}

// v205: beste AH-schaduwrij per wedstrijd — puur datacollectie voor validatie, GEEN invloed op picks.
// Mismatch-anker (SoS-valkuil) zit erop, net als bij 1X2/goals; raw_model_pct bewaart de ongeankerde
// kans zodat het anker zelf ook geëvalueerd kan worden.
function buildAhShadowRow(m, ai, odds, today) {
  const ahBook = odds?.ah; if (!ahBook) return null;
  const _anA = anchorLambdas(ai?.gh, ai?.ga, odds); // v215: zelfde totaal-anker als de goal-markten
  const gh = _anA.lh, ga = _anA.la;
  if (!(gh > 0) || !(ga > 0)) return null;
  // v214: AH afgeleid van de (SoS-gecorrigeerde, evt. Elo-geblende) 1X2 via matrix-herschaling — zelfde
  // bron als de frontend v26.249. Vervangt de losse markt-pull: AH is nu per constructie consistent met
  // de 1X2 (AH -0.5 == P1, DNB == P1/(P1+P2)), i.p.v. een tweede, afwijkende schatting van dezelfde wedstrijd.
  const _p1 = parseFloat(ai?.h), _pX = parseFloat(ai?.x), _p2 = parseFloat(ai?.a);
  const t1x2 = (_p1 > 0 && _pX > 0 && _p2 > 0) ? { p1: _p1, pX: _pX, p2: _p2 } : null;
  let best = null;
  for (const k of Object.keys(ahBook)) {
    const ln = parseFloat(k), o = ahBook[k];
    if (!(o.fairHome >= 15 && o.fairHome <= 85)) continue; // extreme lijnen overslaan
    const mdl = asianProbsW(gh, ga, ln, 10, t1x2); if (!mdl) continue;
    const rawMdl = asianProbsW(gh, ga, ln);        // ongeankerd, puur Poisson — bewaard voor anker-evaluatie
    const sides = [
      { side: 'H', line: ln,  odds: o.home, mdl: mdl.home, raw: rawMdl ? rawMdl.home : mdl.home, mkt: o.fairHome, label: `AH ${m.home} ${ln > 0 ? '+' : ''}${ln}` },
      { side: 'A', line: -ln, odds: o.away, mdl: mdl.away, raw: rawMdl ? rawMdl.away : mdl.away, mkt: o.fairAway, label: `AH ${m.away} ${-ln > 0 ? '+' : ''}${-ln}` },
    ];
    for (const s of sides) {
      if (!(s.odds > 1)) continue;
      const anchored = s.mdl; // v214: al 1X2-consistent; geen aparte pull meer nodig
      const val = parseFloat((anchored - s.mkt).toFixed(1));
      if (!best || val > best.value_pct) best = {
        fixture_id: m.fixtureId, league_id: m.leagueId || null, home: m.home, away: m.away,
        side: s.side, line: s.line, pick_label: s.label, odds: s.odds,
        model_pct: anchored, raw_model_pct: s.raw, market_pct: s.mkt, value_pct: val,
        match_date: m.matchDate || today, match_time: m.matchTime || null, status: 'pending'
      };
    }
  }
  return best;
}

// Marktgroep van een pick — bepaalt of twee picks elkaar mogen verdringen (consistency).
function marketGroup(pick) {
  if (pick === '1' || pick === 'X' || pick === '2') return '1X2';
  if (pick === 'BTTS' || pick === 'NOBTTS') return 'BTTS';
  if (pick && (pick[0] === 'O' || pick[0] === 'U')) return 'OU' + pick.slice(1).replace('.', '');
  return 'OVERIG';
}

// Afrekenen van een doelpunten-pick vanuit eindstand. Geeft 'win'/'lose' of null (geen goal-markt).
function settleGoalMarket(pick, gh, ga) {
  if (gh == null || ga == null) return null;
  const tot = gh + ga;
  if (pick && (pick[0] === 'O' || pick[0] === 'U')) {
    const line = parseFloat(pick.slice(1));
    if (!isFinite(line)) return null;
    const over = tot > line;
    return (pick[0] === 'O') === over ? 'win' : 'lose';
  }
  if (pick === 'BTTS' || pick === 'BTTS-J')   return (gh >= 1 && ga >= 1) ? 'win' : 'lose';
  if (pick === 'NOBTTS' || pick === 'BTTS-N') return (gh >= 1 && ga >= 1) ? 'lose' : 'win';
  return null;
}

// v215: markt-impliciet doelpuntentotaal per O/U-lijn, opgelost met dezelfde Poisson+Dixon-Coles-kern
// als het model en met behoud van de supremacie-verhouding lh:la.
function solveMarketTotal(lh, la, line, fairOver) {
  if (!(fairOver > 0 && fairOver < 100)) return null;
  if (!(lh > 0) || !(la > 0) || !isFinite(line)) return null;
  const share = lh / (lh + la), thr = Math.floor(line);
  const pOver = T => {
    const A = T * share, B = T * (1 - share);
    let under = 0;
    for (let h = 0; h <= 12; h++) for (let a = 0; a <= 12; a++) {
      if (h + a <= thr) under += poissonPmf(h, A) * poissonPmf(a, B) * ahTau(h, a, A, B);
    }
    return (1 - under) * 100;
  };
  let lo = 0.5, hi = 6;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (pOver(mid) < fairOver) lo = mid; else hi = mid; }
  const t = (lo + hi) / 2;
  return (t > 0.51 && t < 5.99) ? t : null; // bisectie tegen de rand geplakt = onbetrouwbaar
}

// Gewogen markt-totaal over alle beschikbare O/U-lijnen. Bewust NIET alleen 2.5: kalibreren op één lijn
// zet die lijn per constructie op 0pp value, waardoor je hem nooit meer als pick kunt vinden.
const LINE_ANCHOR_WEIGHTS = { '1.5': 1, '2.5': 2, '3.5': 1 }; // 2.5 is het liquiedst -> zwaarder
function marketTotalGoals(lh, la, odds) {
  let num = 0, den = 0;
  for (const line of GOAL_LINES) {
    const fo = odds?.ou?.[line]?.fairOver;
    const t = solveMarketTotal(lh, la, parseFloat(line), fo);
    if (t != null) { const w = LINE_ANCHOR_WEIGHTS[line] || 1; num += t * w; den += w; }
  }
  return den > 0 ? num / den : null;
}

// v215: trekt het model-doelpuntentotaal naar het markt-impliciete totaal (gewicht LAMBDA_ANCHOR_W),
// zonder de supremacie te raken. Geeft altijd de diagnose terug, ook als het anker uit staat (w=0),
// zodat coherentie gemeten/gelogd kan worden zonder de picks te veranderen.
function anchorLambdas(gh, ga, odds) {
  const lh = parseFloat(gh), la = parseFloat(ga);
  const base = { lh, la, modelTot: (lh > 0 && la > 0) ? lh + la : null, mktTot: null, gap: null, coherent: true, applied: false, w: LAMBDA_ANCHOR_W };
  if (!(lh > 0) || !(la > 0)) return base;
  const mktTot = marketTotalGoals(lh, la, odds);
  if (mktTot == null) return base;
  base.mktTot = mktTot;
  base.gap = base.modelTot - mktTot;
  base.coherent = Math.abs(base.gap) <= LAMBDA_ANCHOR_DEADBAND;
  if (base.coherent || !(LAMBDA_ANCHOR_W > 0)) return base;
  const target = base.modelTot + (mktTot - base.modelTot) * LAMBDA_ANCHOR_W;
  const f = target / base.modelTot;
  base.lh = Math.max(0.05, lh * f);
  base.la = Math.max(0.05, la * f);
  base.applied = true;
  return base;
}

// Bouwt de goal-markt-kandidaten voor één wedstrijd (leeg als AI geen goals gaf of geen odds).
function buildGoalCandidates(m, ai, odds) {
  const out = [];
  if (!ai || ai.gh == null || ai.ga == null) return out;
  const _an = anchorLambdas(ai.gh, ai.ga, odds); // v215: totaal-anker (dormant bij lambda_anchor_w=0)
  const gm = goalMarkets(_an.lh, _an.la);
  if (!gm) return out;
  for (const line of GOAL_LINES) {
    const o = odds?.ou?.[line];
    if (!o) continue;
    const grp = 'OU' + line.replace('.', '');
    if (o.over > 1)  out.push({ pick: 'O' + line, label: `Meer dan ${line} goals`,   aiKans: gm.ou[line].over,  bookOdds: o.over,  fairImplied: o.fairOver,  marketGroup: grp });
    if (o.under > 1) out.push({ pick: 'U' + line, label: `Minder dan ${line} goals`, aiKans: gm.ou[line].under, bookOdds: o.under, fairImplied: o.fairUnder, marketGroup: grp });
  }
  const b = odds?.btts;
  if (b) {
    if (b.yes > 1) out.push({ pick: 'BTTS',   label: 'Beide teams scoren',     aiKans: gm.btts.yes, bookOdds: b.yes, fairImplied: b.fairYes, marketGroup: 'BTTS' });
    if (b.no  > 1) out.push({ pick: 'NOBTTS', label: 'Niet beide teams scoren', aiKans: gm.btts.no,  bookOdds: b.no,  fairImplied: b.fairNo,  marketGroup: 'BTTS' });
  }
  return out;
}

// v218: API-Football zet `errors` bij SUCCES op een lege array ([]). In JS is [] truthy, dus de
// v199-check `!data.errors` was altijd false -> er werd nooit iets gecacht. Bij een echte fout is
// `errors` een niet-leeg object ({rateLimit: "..."}). Deze helper onderscheidt die twee.
function _hasErrors(e) {
  if (e == null) return false;
  if (Array.isArray(e)) return e.length > 0;
  if (typeof e === 'object') return Object.keys(e).length > 0;
  return !!e;
}

// v216: API-Football geeft `response` soms als array (fixtures, standings, predictions) en soms als
// object (teams/statistics). Deze check bepaalt of er echte inhoud is, ongeacht het type.
function _hasPayload(r) {
  if (r == null) return false;
  if (Array.isArray(r)) return r.length > 0;
  if (typeof r === 'object') return Object.keys(r).length > 0;
  return false;
}

// ── Datum normalisatie helper ─────────────────────────────
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const parts = String(dateStr).split('-');
  if (parts.length === 3 && parts[2].length === 4) {
    const day   = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year  = parts[2];
    return `${year}-${month}-${day}`;
  }
  try {
    return new Date(dateStr).toISOString().split('T')[0];
  } catch(e) { return null; }
}

// ── Auto-verificatie: pending picks van afgelopen 7 dagen checken ─────────
async function verifyYesterdayPicks(env) {
  // Supabase keepalive — voorkomt automatisch pauzeren gratis project
  try {
    await sb(env, 'clv_results', 'GET', null, '?limit=1&select=id');
    console.log('[Keepalive] Supabase ping OK');
  } catch(e) {
    console.log('[Keepalive] Supabase ping mislukt (non-fatal):', e.message);
  }

  const today = new Date();
  today.setHours(0,0,0,0);

  const picks = await sbGetPicks(env);

  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 30); // uitgebreid naar 30 dagen
  const cutoffStr = cutoff.toISOString().split('T')[0];
  // todayStr + 1 dag zodat wedstrijden van vandaag ook gesettled worden
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const toVerify = Object.entries(picks).filter(([id, p]) => {
    // processed !== false EN processed !== undefined (pakt ook picks zonder processed veld)
    if (p.processed === true) return false;
    if (p.status !== 'pending') return false;
    const normalized = normalizeDate(p.matchDate);
    if (!normalized) return false;
    return normalized >= cutoffStr && normalized < tomorrowStr;
  });

  if (!toVerify.length) {
    console.log('[Verify] Geen pending picks om te verifiëren');
    return;
  }

  console.log(`[Verify] ${toVerify.length} picks te verifiëren`);

  // Max 10 picks per run
  const batch = toVerify.slice(0, 10);
  const fixtureIds = [...new Set(batch.map(([, p]) => p.fixtureId).filter(Boolean))];

  // Parallel fixture resultaten ophalen
  const fixtureResults = await Promise.all(
    fixtureIds.map(id => apif(`/fixtures?id=${id}`, env))
  );

  const resultMap = {};
  fixtureResults.forEach((data, i) => {
    const fid = String(fixtureIds[i]);
    const f = data?.[0];
    if (!f) return;
    const status = f.fixture?.status?.short;
    if (!['FT','AET','PEN'].includes(status)) return;
    resultMap[fid] = { home: f.goals?.home ?? 0, away: f.goals?.away ?? 0, status };
  });

  console.log(`[Verify] ${Object.keys(resultMap).length}/${fixtureIds.length} fixtures met resultaat`);
  if (!Object.keys(resultMap).length) return;

  // CLV odds parallel ophalen voor picks met resultaat
  const picksWithResult = batch.filter(([, p]) => resultMap[String(p.fixtureId)]);
  const clvOdds = await Promise.all(
    picksWithResult.map(([, p]) => apif(`/odds?fixture=${p.fixtureId}&bookmaker=8&bet=1`, env))
  );

  let updated = 0;
  const updatedIds = [];

  for (let i = 0; i < picksWithResult.length; i++) {
    const [id, pick] = picksWithResult[i];
    const result = resultMap[String(pick.fixtureId)];
    if (!result) continue;

    const hg = result.home, ag = result.away;
    let won = false;
    const p = pick.betType || pick.pick || '1';
    const gm = settleGoalMarket(p, hg, ag); // v173: O/U (alle lijnen) + BTTS
    if (gm !== null) won = (gm === 'win');
    else if (p === '1') won = hg > ag;
    else if (p === '2') won = ag > hg;
    else if (p === 'X') won = hg === ag;

    let clv = null;
    let closingOdd = null; // v103: buiten try voor scope bij saveCLV
    try {
      const closingOdds = clvOdds[i];
      if (closingOdds?.length > 0) {
        const bm = closingOdds[0]?.bookmakers?.[0];
        const bet = bm?.bets?.find(b => b.id === 1);
        if (bet) {
          closingOdd = parseFloat(
            bet.values?.find(v =>
              (p === '1' && v.value === 'Home') ||
              (p === 'X' && v.value === 'Draw') ||
              (p === '2' && v.value === 'Away')
            )?.odd || 0
          );
          if (closingOdd > 1 && pick.odds > 1) {
            clv = parseFloat(((pick.odds / closingOdd - 1) * 100).toFixed(1));
          }
        }
      }
    } catch(e) {}

    picks[id] = {
      ...pick,
      score: `${hg}-${ag}`,
      status: won ? 'win' : 'lose',
      processed: true,
      verifiedAt: new Date().toISOString(),
      clv,
    };

    try { await saveCLV(pick, clv, won, closingOdd || null, env); } catch(e) { console.error('[SB] CLV fout:', e.message); }
    // v135: sla sharp signal resultaat op voor post-WK calibratie
    try { await saveSharpSignalResult(pick, won ? 'win' : 'lose', closingOdd || null, env); } catch(e) { console.error('[SB] SharpResult fout:', e.message); }
    updated++;
    updatedIds.push(id);
  }

  if (updated > 0) {
    await sbSavePicks(picks, env);
    // v119 (R1): Firebase 'picks'-fallback verwijderd — niet gelezen (worker leest Supabase, client leest per-user backup). Bespaart subrequest + voorkomt drift.
    console.log(`[Verify] ${updated} picks gesetteld`);
    await updateLeagueCalibration(env, picks, updatedIds);
  }
}

// ── League calibratie bijwerken na settlement ─────────────
// v273: uitkomstbepaling voor schaduw-picks — 1X2 EN goal-markten in één plek.
// Dezelfde regels als de verificatiequery van 18-07 die de 11 fout-afgerekende picks vond.
// Retourneert 'win' | 'lose' | null; null = onbekende markt, en de aanroeper rekent die NIET af
// (liever pending dan een verzonnen lose). h/a zijn de doelpunten op de gehanteerde speeltijd.
function resolveShadowPick(pick, h, a) {
  const tot = h + a;
  switch (pick) {
    case '1':     return h > a ? 'win' : 'lose';
    case '2':     return a > h ? 'win' : 'lose';
    case 'X':     return h === a ? 'win' : 'lose';
    case 'O1.5':  return tot >= 2 ? 'win' : 'lose';
    case 'U1.5':  return tot <= 1 ? 'win' : 'lose';
    case 'O2.5':  return tot >= 3 ? 'win' : 'lose';
    case 'U2.5':  return tot <= 2 ? 'win' : 'lose';
    case 'O3.5':  return tot >= 4 ? 'win' : 'lose';
    case 'U3.5':  return tot <= 3 ? 'win' : 'lose';
    case 'BTTS':  return (h >= 1 && a >= 1) ? 'win' : 'lose';
    case 'NOBTTS':return (h === 0 || a === 0) ? 'win' : 'lose';
    default:      return null;
  }
}

async function settleShadowPicks(env) {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const rows = await sb(env, 'shadow_picks', 'GET', null,
      `?status=eq.pending&match_date=gte.${cutoffStr}&match_date=lt.${tomorrowStr}&select=id,fixture_id,pick&limit=40`);
    if (!rows || !rows.length) { console.log('[Shadow] geen pending schaduw-picks'); return; }
    const fixtureIds = [...new Set(rows.map(r => r.fixture_id).filter(Boolean))].slice(0, 15);
    // v274: gechunkt tegen IP-burst-throttle. apifChunked geeft {status,value} terug; we mappen terug
    // naar de rauwe data-array (null bij een gefaalde call — data?.[0] hieronder vangt null al veilig af),
    // zodat de bestaande forEach((data,i)=>...) onveranderd blijft en de volgorde behouden is.
    const _rs = await apifChunked(fixtureIds, (id) => apif(`/fixtures?id=${id}`, env));
    const results = _rs.map(r => r.status === 'fulfilled' ? r.value : null);
    const resultMap = {};
    // v255: hier stond ook `const finishedFx = []` + een push (v202). Die array werd gevuld maar in deze
    // functie NOOIT gelezen — de enige lezer stond in settleModelTips, een andere functie, waar hij dus
    // niet bestond. Beide regels kwamen uit dezelfde v202-commit; de declaratie belandde in de verkeerde
    // functie. Nu de lezer weg is (zie settleModelTips), is dit dode code die eruitzag alsof ze werkte.
    results.forEach((data, i) => {
      const fx = data?.[0]; if (!fx) return;
      const st = fx.fixture?.status?.short;
      if (!['FT','AET','PEN'].includes(st)) return;
      // v273: eindstand ZONDER verlenging (90 min) = score.fulltime, met terugval op goals voor
      // competitieduels zonder aparte fulltime-node. Bewuste keuze, gelijk aan de AH-tak: O/U en
      // BTTS rekenen op de reguliere speeltijd, niet op AET/PEN. `?? 0` (null-coalescing, GEEN ||):
      // een gemeten 0-0 blijft 0-0, alleen echt ontbrekende data valt terug.
      const h90 = fx.score?.fulltime?.home, a90 = fx.score?.fulltime?.away;
      resultMap[String(fixtureIds[i])] = {
        home: (h90 != null) ? h90 : (fx.goals?.home ?? 0),
        away: (a90 != null) ? a90 : (fx.goals?.away ?? 0)
      };
    });
    let settled = 0, overgeslagen = 0;
    for (const r of rows) {
      const res = resultMap[String(r.fixture_id)];
      if (!res) continue;
      // v273: settelt nu 1X2 EN goal-markten. Tot v272 kende deze lus alleen 1/X/2:
      //   const winner = res.home>res.away?'1':res.home<res.away?'2':'X'; const won = (r.pick===winner);
      // Een goal-markt-pick (O2.5, U1.5, BTTS, NOBTTS, ...) is nooit gelijk aan '1'/'X'/'2', dus
      // won was ALTIJD false -> elke goal-pick werd 'lose', ongeacht de score. GEMETEN 18-07:
      // 28 van 28 afgerekende goal-shadowpicks stonden op lose, waarvan 11 in werkelijkheid gewonnen
      // (o.a. U2.5 bij 0-2, NOBTTS bij 1-0, O3.5 bij 3-3). De 1X2-tak was correct en blijft ongemoeid.
      const uitkomst = resolveShadowPick(r.pick, res.home, res.away);
      if (uitkomst === null) {
        // Onbekende markt: NIET afrekenen. Een pick als 'lose' wegschrijven omdat de code de markt
        // niet kent, is een onware bewering over de uitkomst -- laat hem pending en meld het luid.
        console.warn(`[Shadow] pick ${r.id}: onbekende markt '${r.pick}' — niet afgerekend (liever pending dan een valse lose)`);
        overgeslagen++;
        continue;
      }
      await sb(env, 'shadow_picks', 'PATCH',
        { status: uitkomst, score: `${res.home}-${res.away}`, settled_at: new Date().toISOString() },
        `?id=eq.${r.id}`);
      settled++;
    }
    console.log(`[Shadow] ${settled} schaduw-picks afgerekend${overgeslagen ? `, ${overgeslagen} overgeslagen (onbekende markt)` : ''}`);
  } catch(e) { console.error('[Shadow] settle fout:', e.message); }
}

// v205: AH-uitslagbepaling — win / half_win / push / half_loss / lose + profit per 1 eenheid inzet.
// LET OP: AH rekent af op de REGULIERE speeltijd (90 min), niet op verlenging/penalty's.
function settleAhResult(side, line, gh, ga, odds) {
  const diff = side === 'H' ? (gh - ga) : (ga - gh);
  const q = Math.round(line * 4);
  const comps = (q % 2 === 0) ? [line] : [line - 0.25, line + 0.25];
  let profit = 0, w = 0, p = 0, l = 0;
  for (const c of comps) {
    const adj = diff + c;
    if (adj > 0.001) { profit += (odds - 1); w++; }
    else if (adj < -0.001) { profit -= 1; l++; }
    else p++;
  }
  profit /= comps.length;
  const n = comps.length;
  const status = (w === n) ? 'win' : (l === n) ? 'lose' : (p === n) ? 'push' : (w > 0) ? 'half_win' : 'half_loss';
  return { status, profit: parseFloat(profit.toFixed(3)) };
}
async function settleAhShadow(env) {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const rows = await sb(env, 'ah_shadow_picks', 'GET', null,
      `?status=eq.pending&match_date=gte.${cutoffStr}&match_date=lt.${tomorrowStr}&select=id,fixture_id,side,line,odds&limit=40`);
    if (!rows || !rows.length) { console.log('[AH-Shadow] geen pending rijen'); return; }
    const fixtureIds = [...new Set(rows.map(r => r.fixture_id).filter(Boolean))].slice(0, 15);
    // v274: gechunkt tegen IP-burst-throttle. apifChunked geeft {status,value} terug; we mappen terug
    // naar de rauwe data-array (null bij een gefaalde call — data?.[0] hieronder vangt null al veilig af),
    // zodat de bestaande forEach((data,i)=>...) onveranderd blijft en de volgorde behouden is.
    const _rs = await apifChunked(fixtureIds, (id) => apif(`/fixtures?id=${id}`, env));
    const results = _rs.map(r => r.status === 'fulfilled' ? r.value : null);
    const resultMap = {};
    results.forEach((data, i) => {
      const fx = data?.[0]; if (!fx) return;
      const st = fx.fixture?.status?.short;
      if (!['FT','AET','PEN'].includes(st)) return;
      // v205: AH settelt op 90 minuten — score.fulltime, met terugval op goals (competitieduels)
      const h90 = fx.score?.fulltime?.home, a90 = fx.score?.fulltime?.away;
      resultMap[String(fixtureIds[i])] = {
        home: (h90 != null) ? h90 : (fx.goals?.home ?? 0),
        away: (a90 != null) ? a90 : (fx.goals?.away ?? 0)
      };
    });
    let settled = 0;
    for (const r of rows) {
      const res = resultMap[String(r.fixture_id)];
      if (!res) continue;
      const out = settleAhResult(r.side, parseFloat(r.line), res.home, res.away, parseFloat(r.odds));
      await sb(env, 'ah_shadow_picks', 'PATCH',
        { status: out.status, profit: out.profit, score: `${res.home}-${res.away}`, settled_at: new Date().toISOString() },
        `?id=eq.${r.id}`);
      settled++;
    }
    console.log(`[AH-Shadow] ${settled} AH-schaduwrijen afgerekend`);
  } catch(e) { console.error('[AH-Shadow] settle fout:', e.message); }
}

// v194: runtime bias-config laden uit model_config (overschrijft code-defaults)
async function loadTuneConfig(env) {
  try {
    const rows = await sb(env, 'model_config', 'GET', null, '?select=config_key,config_value') || [];
    const map = {}; rows.forEach(r => { map[r.config_key] = Number(r.config_value); });
    if (map.lowprob_extra_shrink_1 != null && isFinite(map.lowprob_extra_shrink_1)) TUNE.s1 = map.lowprob_extra_shrink_1;
    if (map.lowprob_extra_shrink_2 != null && isFinite(map.lowprob_extra_shrink_2)) TUNE.s2 = map.lowprob_extra_shrink_2;
    if (map.elo_blend_w != null && isFinite(map.elo_blend_w)) ELO_BLEND_W = Math.min(Math.max(map.elo_blend_w, 0), ELO_MAX_W); // v208
    if (map.lambda_anchor_w != null && isFinite(map.lambda_anchor_w)) LAMBDA_ANCHOR_W = Math.min(Math.max(map.lambda_anchor_w, 0), LAMBDA_ANCHOR_MAX_W); // v215
    console.log(`[Tune] config geladen: s1=${TUNE.s1} s2=${TUNE.s2} elo_blend_w=${ELO_BLEND_W} lambda_anchor_w=${LAMBDA_ANCHOR_W}`);
  } catch(e) { console.error('[Tune] config laden mislukt (defaults blijven):', e.message); }
}

// v194: auto-kalibratie — leest club-era 1X2-kalibratie, stelt de lage-kans shrink conservatief bij.
// DRY-RUN tot AUTOTUNE_APPLY=true. Draait niets tot er >= AUTOTUNE_MIN_N clubtips per band zijn.
async function autoTuneCalibration(env) {
  if (!AUTOTUNE_ENABLED) return;
  try {
    await loadTuneConfig(env);
    const rows = await sb(env, 'model_market_comparison', 'GET', null,
      `?won=not.is.null&pick=in.(1,X,2)&match_date=gte.${CLUB_ERA_START}&select=poisson_win_pct,won&limit=5000`) || [];
    if (!rows.length) { console.log('[Tune] geen clubdata — overslaan'); return; }
    const bands = [
      { key: 'lowprob_extra_shrink_1', label: '00-20%', lo: 0,  hi: 20, cur: TUNE.s1 },
      { key: 'lowprob_extra_shrink_2', label: '20-35%', lo: 20, hi: 35, cur: TUNE.s2 },
    ];
    for (const b of bands) {
      const inB = rows.filter(r => r.poisson_win_pct >= b.lo && r.poisson_win_pct < b.hi);
      const n = inB.length;
      if (n < AUTOTUNE_MIN_N) { console.log(`[Tune] ${b.label}: n=${n} < ${AUTOTUNE_MIN_N} — geen aanpassing`); continue; }
      const modelKans = inB.reduce((a,r)=>a+Number(r.poisson_win_pct),0)/n;
      const actual = 100*inB.reduce((a,r)=>a+(r.won?1:0),0)/n;
      const gap = modelKans - actual; // + = overschatting
      let newVal = b.cur, reason = 'binnen tolerantie';
      if (gap > AUTOTUNE_TOL)      { newVal = Math.min(b.cur + AUTOTUNE_STEP, AUTOTUNE_MAX); reason = 'model overschat \u2192 shrink omhoog'; }
      else if (gap < -AUTOTUNE_TOL) { newVal = Math.max(b.cur - AUTOTUNE_STEP, 0);           reason = 'model onderschat \u2192 shrink omlaag'; }
      let applied = false;
      if (newVal !== b.cur && AUTOTUNE_APPLY) {
        await sb(env, 'model_config', 'POST',
          { config_key: b.key, config_value: newVal, updated_at: new Date().toISOString(), note: reason },
          '?on_conflict=config_key');
        if (b.key.endsWith('_1')) TUNE.s1 = newVal; else TUNE.s2 = newVal;
        applied = true;
      }
      await sb(env, 'calibration_tune_log', 'POST', {
        band: b.label, n, model_kans: +modelKans.toFixed(1), actual: +actual.toFixed(1), gap: +gap.toFixed(1),
        config_key: b.key, old_value: b.cur, new_value: newVal, applied,
        reason: (AUTOTUNE_APPLY ? reason : '[DRY-RUN] ' + reason)
      }, '');
      console.log(`[Tune] ${b.label}: n=${n} model=${modelKans.toFixed(1)} actueel=${actual.toFixed(1)} gap=${gap.toFixed(1)} ${b.cur}\u2192${newVal} ${applied?'TOEGEPAST':'(dry-run)'}`);
    }
  } catch(e) { console.error('[Tune] autoTune fout:', e.message); }
}

// v208: Elo scan-helpers (bouwplan stap 2) — pure functies, geen side-effects.
function eloExpected(eloA, eloB, homeAdv = 0) { return 1 / (1 + Math.pow(10, (eloB - eloA - homeAdv) / 400)); }
function eloImplied1X2(homeElo, awayElo, homeAdv = 0) {
  const eH = eloExpected(homeElo, awayElo, homeAdv);          // verwachte score thuis (0..1)
  let pDraw = 0.28 - 0.20 * Math.abs(eH - 0.5);               // draw-model uit het bouwplan
  pDraw = Math.min(Math.max(pDraw, 0.08), 0.32);
  let pHome = eH - 0.5 * pDraw;
  let pAway = 1 - pHome - pDraw;
  pHome = Math.max(pHome, 0.02); pAway = Math.max(pAway, 0.02);
  const s = pHome + pDraw + pAway;
  return { h: pHome / s * 100, x: pDraw / s * 100, a: pAway / s * 100 };
}
function marketToEloDiff(marketEHome) { const e = Math.min(Math.max(marketEHome, 0.02), 0.98); return -400 * Math.log10(1 / e - 1); } // voor het zaaien (stap 3)
function eloHomeAdv(leagueId) { return isTournamentLeague(leagueId) ? 0 : 65; } // neutraal veld voor toernooien/WK, 65 voor clubs

// v202: Elo-rating bijwerken na een afgeronde wedstrijd (SoS-fundament). Weegt elk resultaat naar de
// STERKTE van de tegenstander (via diens Elo) i.p.v. rauwe doelsaldi -> lost de klasse-valkuil structureel op.
// Nu alleen accumuleren (rijpt met data); integratie in het model volgt na de clubswitch (20 juli).
async function updateEloForFixture(env, fx, skipDup = false) {
  try {
    const fid = fx.fixture?.id;
    const hId = fx.teams?.home?.id, aId = fx.teams?.away?.id;
    const hName = fx.teams?.home?.name, aName = fx.teams?.away?.name;
    const hG = fx.goals?.home, aG = fx.goals?.away;
    if (!fid || hId == null || aId == null || hG == null || aG == null) return;
    // al verwerkt? (dubbeltelling voorkomen) — sweep dedupt in batch en geeft skipDup=true
    if (!skipDup) {
      const dup = await sb(env, 'elo_history', 'GET', null, `?fixture_id=eq.${fid}&team_id=eq.${hId}&select=id&limit=1`);
      if (dup && dup.length) return;
    }
    const rows = await sb(env, 'team_ratings', 'GET', null, `?team_id=in.(${hId},${aId})&select=team_id,elo,games`) || [];
    const map = {}; rows.forEach(r => { map[r.team_id] = r; });
    const hElo = map[hId] ? Number(map[hId].elo) : 1500;
    const aElo = map[aId] ? Number(map[aId].elo) : 1500;
    const hGames = map[hId] ? Number(map[hId].games) : 0;
    const aGames = map[aId] ? Number(map[aId].games) : 0;
    const homeAdv = eloHomeAdv(fx.league?.id); // v210: 0 bij toernooi/neutraal veld (WK), 65 bij clubs — consistent met blend + seeding (was vast 40)
    const expH = 1 / (1 + Math.pow(10, (aElo - hElo - homeAdv) / 400));
    const actH = hG > aG ? 1 : hG < aG ? 0 : 0.5;
    const gd = Math.abs(hG - aG);
    const G = gd <= 1 ? 1 : gd === 2 ? 1.5 : (11 + gd) / 8; // World-Football-Elo doelsaldo-multiplier
    const kH = hGames < 8 ? 45 : 30; // snellere convergentie voor nieuwe teams
    const kA = aGames < 8 ? 45 : 30;
    const d = G * (actH - expH);
    const newH = Math.round((hElo + kH * d) * 10) / 10;
    const newA = Math.round((aElo - kA * d) * 10) / 10;
    const resH = hG > aG ? 'W' : hG < aG ? 'L' : 'D';
    const now = new Date().toISOString();
    await sb(env, 'team_ratings', 'POST', { team_id: hId, team_name: hName, elo: newH, games: hGames + 1, seeded: false, last_result_at: now, updated_at: now }, '?on_conflict=team_id');
    await sb(env, 'team_ratings', 'POST', { team_id: aId, team_name: aName, elo: newA, games: aGames + 1, seeded: false, last_result_at: now, updated_at: now }, '?on_conflict=team_id');
    await sb(env, 'elo_history', 'POST', [
      { fixture_id: fid, team_id: hId, opponent_id: aId, elo_before: hElo, elo_after: newH, delta: Math.round(kH * d * 10) / 10, result: resH, gd: hG - aG },
      { fixture_id: fid, team_id: aId, opponent_id: hId, elo_before: aElo, elo_after: newA, delta: Math.round(-kA * d * 10) / 10, result: (resH === 'W' ? 'L' : resH === 'L' ? 'W' : 'D'), gd: aG - hG },
    ], '');
  } catch(e) { console.error('[Elo] update fout:', e.message); }
}

// v209: Elo-accumulatie LOSGEKOPPELD van schaduw-picks. Werkt de ratings bij uit ALLE afgeronde
// wedstrijden in de actieve competities via een eigen dagelijkse sweep. Dit laat de Elo volgroeien
// tot een betrouwbare SoS-maat (voorheen zag hij enkel schaduw-pick-fixtures = scheve sliver).
// Raakt de picks NIET — alleen datacollectie. Dagelijks getthrottled + gecapt op subrequest-budget.
const ELO_SWEEP_MAX = 60; // max nieuwe fixtures per sweep (Cloudflare-subrequestbudget)
function activeLeagueIds(today) {
  // spiegelt leagueConfig in runScan (FASE 1 vs FASE 2 op 20-07)
  const postWK = new Date(today) >= new Date('2026-07-20');
  return postWK
    ? [39, 140, 78, 135, 61, 88, 94, 144, 179, 207, 203, 2, 3, 848, 89, 79, 80, 40, 41]
    : [1, 103, 113];
}
async function markEloSweep(env, dateStr) {
  try { await sb(env, 'model_config', 'POST', { config_key: 'elo_last_sweep', config_value: 0, note: dateStr, updated_at: new Date().toISOString() }, '?on_conflict=config_key'); } catch(e) {}
  // v228: bij een geslaagde sweep de foutstatus wissen zodat een oude fout niet blijft alarmeren
  try { await sb(env, 'model_config', 'POST', { config_key: 'elo_sweep_status', config_value: 0, note: 'ok', updated_at: new Date().toISOString() }, '?on_conflict=config_key'); } catch(e) {}
}
async function sweepEloFromResults(env) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    // dagelijkse throttle: draai hooguit 1x/dag ongeacht hoe vaak /settle vuurt
    const cfg = await sb(env, 'model_config', 'GET', null, '?config_key=eq.elo_last_sweep&select=note&limit=1');
    if (cfg?.[0]?.note === today) { console.log('[EloSweep] vandaag al gedraaid — overslaan'); return; }

    // venster: gisteren + eergisteren (afgeronde wedstrijden; vandaag kan nog lopen)
    const now = new Date();
    const days = [-1, -2].map(off => { const x = new Date(now); x.setUTCDate(x.getUTCDate() + off); return x.toISOString().slice(0, 10); });
    const leagues = activeLeagueIds(today);

    const finished = [];
    for (const dd of days) {
      for (const lg of leagues) {
        try {
          const resp = await apif(`/fixtures?date=${dd}&league=${lg}&season=2026`, env);
          (resp || []).forEach(fx => {
            const st = fx.fixture?.status?.short;
            if (['FT', 'AET', 'PEN'].includes(st) && fx.teams?.home?.id && fx.teams?.away?.id && fx.goals?.home != null && fx.goals?.away != null) finished.push(fx);
          });
        } catch(e) { /* per league/dag stil overslaan */ }
      }
    }
    if (!finished.length) { console.log('[EloSweep] geen afgeronde fixtures in venster'); await markEloSweep(env, today); return; }

    // batch-dedup tegen elo_history (1 query) — al verwerkte fixtures overslaan
    const ids = [...new Set(finished.map(f => f.fixture.id))];
    const done = await sb(env, 'elo_history', 'GET', null, `?fixture_id=in.(${ids.join(',')})&select=fixture_id`) || [];
    const doneSet = new Set(done.map(r => String(r.fixture_id)));
    let todo = finished.filter(f => !doneSet.has(String(f.fixture.id)));
    // chronologisch (aftraptijd oplopend) zodat de Elo in matchvolgorde bijwerkt
    todo.sort((a, b) => new Date(a.fixture?.date || 0) - new Date(b.fixture?.date || 0));
    if (todo.length > ELO_SWEEP_MAX) { console.log(`[EloSweep] ${todo.length} nieuw > cap ${ELO_SWEEP_MAX} — rest volgt morgen`); todo = todo.slice(0, ELO_SWEEP_MAX); }

    let n = 0;
    for (const fx of todo) { await updateEloForFixture(env, fx, true); n++; } // skipDup: batch al gededupt
    console.log(`[EloSweep] ${n} nieuwe fixtures verwerkt (${leagues.length} leagues, venster ${days.join('/')})`);

    // v211: elo_shadow-backtestrijen settelen met dezelfde uitslagen (geen extra API-calls)
    try {
      const resMap = {}; finished.forEach(f => { const g = f.goals; resMap[f.fixture.id] = g.home > g.away ? '1' : g.home < g.away ? '2' : 'X'; });
      const pend = await sb(env, 'elo_shadow', 'GET', null, `?result=is.null&fixture_id=in.(${ids.join(',')})&select=fixture_id`) || [];
      let sset = 0;
      for (const r of pend) { const res = resMap[r.fixture_id]; if (res) { await sb(env, 'elo_shadow', 'PATCH', { result: res, settled_at: new Date().toISOString() }, `?fixture_id=eq.${r.fixture_id}`); sset++; } }
      if (sset) console.log(`[EloShadow] ${sset} backtestrijen gesetteld`);
    } catch(e) { console.error('[EloShadow] settle fout:', e.message); }

    await markEloSweep(env, today);
  } catch(e) {
    console.error('[EloSweep] fout:', e.message);
    // v228: echte foutmelding persisteren zodat /health + de eerstvolgende run de oorzaak tonen (was 2x weggeslikt)
    try { await sb(env, 'model_config', 'POST', { config_key: 'elo_sweep_status', config_value: 0, note: ('ERR: ' + (e && e.message ? e.message : String(e))).slice(0, 280), updated_at: new Date().toISOString() }, '?on_conflict=config_key'); } catch(_) {}
  }
}

// v191: AI/model-tip-afrekening — uitslag opslaan bij model_market_comparison voor
// continue accuraatheids-meting (view v_ai_tip_accuracy). Gemodelleerd op settleShadowPicks.
async function settleModelTips(env) {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const rows = await sb(env, 'model_market_comparison', 'GET', null,
      `?won=is.null&match_date=gte.${cutoffStr}&match_date=lt.${tomorrowStr}&select=fixture_id,pick&limit=60`);
    if (!rows || !rows.length) { console.log('[AI-tips] geen onafgerekende tips'); return; }
    const fixtureIds = [...new Set(rows.map(r => r.fixture_id).filter(Boolean))].slice(0, 20);
    // v274: gechunkt tegen IP-burst-throttle. apifChunked geeft {status,value} terug; we mappen terug
    // naar de rauwe data-array (null bij een gefaalde call — data?.[0] hieronder vangt null al veilig af),
    // zodat de bestaande forEach((data,i)=>...) onveranderd blijft en de volgorde behouden is.
    const _rs = await apifChunked(fixtureIds, (id) => apif(`/fixtures?id=${id}`, env));
    const results = _rs.map(r => r.status === 'fulfilled' ? r.value : null);
    const resultMap = {};
    results.forEach((data, i) => {
      const fx = data?.[0]; if (!fx) return;
      const st = fx.fixture?.status?.short;
      if (!['FT','AET','PEN'].includes(st)) return;
      resultMap[String(fixtureIds[i])] = { home: fx.goals?.home ?? 0, away: fx.goals?.away ?? 0 };
    });
    let settled = 0;
    for (const r of rows) {
      const res = resultMap[String(r.fixture_id)];
      if (!res) continue;
      let won;
      if (r.pick === '1' || r.pick === 'X' || r.pick === '2') {
        const winner = res.home > res.away ? '1' : res.home < res.away ? '2' : 'X';
        won = (r.pick === winner) ? 1 : 0;
      } else {
        won = (settleGoalMarket(r.pick, res.home, res.away) === 'win') ? 1 : 0; // v192: O/U + BTTS
      }
      await sb(env, 'model_market_comparison', 'PATCH',
        { won, settled_at: new Date().toISOString() },
        `?fixture_id=eq.${r.fixture_id}&pick=eq.${encodeURIComponent(r.pick)}`);
      settled++;
    }
    console.log(`[AI-tips] ${settled} model-tips afgerekend (accuraatheids-tracking)`);
    // v255: hier stond `for (const fx of finishedFx) { await updateEloForFixture(env, fx); }` (v202).
    // `finishedFx` is nooit in deze functie gedeclareerd — hij staat in settleShadowPicks. Elke run gooide
    // dus een ReferenceError, opgevangen door de catch hieronder, die dan '[AI-tips] settle fout' logde
    // terwijl de afrekening zélf al klaar was: de PATCHes en de regel hierboven komen ervóór. De melding
    // wees dus naar het verkeerde probleem. v202's commit-tekst ('Team-ID-koppeling via fixture-object in
    // settleModelTips') laat zien dat de declaratie in de verkeerde functie belandde; git log -S bevestigt
    // dat beide regels uit diezelfde commit komen. Deze lus heeft dus NOOIT gedraaid — wat meteen verklaart
    // waarom v209 constateerde dat de Elo leeg bleef.
    // Niet gerepareerd maar geschrapt: sinds v239 vult sweepEloFromResults team_ratings/elo_history op de
    // cron via dezelfde updateEloForFixture (r2495, met skipDup). Die functie blijft dus in gebruik; alleen
    // deze dubbele, dode aanroep gaat eruit. Terugbouwen zou de sweep dubbel werk geven.
  } catch(e) { console.error('[AI-tips] settle fout:', e.message); }
}

async function updateLeagueCalibration(env, picks, updatedIds) {
  try {
    const calibration = await sbGetCalibration(env);

    let _zonderLeague = 0;
    updatedIds.forEach(id => {
      const pick = picks[id];
      if (!pick || pick.status === 'pending') return;

      // v223: picks zonder league-id NIET meer samenvoegen onder de bucket 'unknown'.
      // Die rij vulde zich met vreemde kalibratie (108 picks, factor 1.022) en werd vervolgens
      // geerfd door elke volgende pick zonder league-id -> factor stuurt via leagueFactor (70%)
      // rechtstreeks de score. Overslaan + loggen is eerlijker dan een verkeerde bucket.
      if (pick.leagueId === undefined || pick.leagueId === null || pick.leagueId === '') {
        _zonderLeague++;
        return;
      }
      const leagueId = String(pick.leagueId);
      if (!calibration[leagueId]) {
        calibration[leagueId] = {
          leagueName: pick.leagueName || '',
          wins: 0, total: 0, roi: 0,
          avgValue: 0, avgConf: 0,
          clvSum: 0, clvCount: 0,
          factor: 1.0,
          lastUpdated: new Date().toISOString()
        };
      }

      const cal = calibration[leagueId];
      cal.total++;
      if (pick.status === 'win') {
        cal.wins++;
        cal.roi += (pick.odds - 1) * 100;
      } else {
        cal.roi -= 100;
      }
      cal.avgValue = ((cal.avgValue * (cal.total - 1)) + (pick.value || 0)) / cal.total;
      cal.avgConf  = ((cal.avgConf  * (cal.total - 1)) + (pick.confidence || 5)) / cal.total;

      if (pick.clv !== null && pick.clv !== undefined) {
        cal.clvSum += pick.clv;
        cal.clvCount++;
      }

      if (cal.total >= 5) {
        const actualHitrate  = cal.wins / cal.total;
        const expectedHitrate = 1 / (cal.avgValue / 100 + 1) * (1 + cal.avgConf / 10);
        const ratio = actualHitrate / Math.max(0.1, expectedHitrate);
        cal.factor = parseFloat(Math.max(0.70, Math.min(1.30,
          cal.factor * 0.8 + ratio * 0.2
        )).toFixed(3));
      }

      cal.lastUpdated = new Date().toISOString();
      calibration[leagueId] = cal;
    });

    if (_zonderLeague) console.warn(`[Calib] ${_zonderLeague} pick(s) zonder league_id overgeslagen`);
    await sbSaveCalibration(calibration, env);
    await fb(env, 'calibration', 'PUT', calibration); // FB fallback
    console.log('[Calibratie] Bijgewerkt voor', updatedIds.length, 'picks');
  } catch(e) {
    console.error('[Calibratie] Fout:', e.message);
  }
}

// ── Weekly calibratie job (zondag 06:00 UTC) ─────────────
async function runWeeklyCalibration(env) {
  console.log('[WeeklyCalib] Start wekelijkse calibratie...');
  try {
    const calibration = await sbGetCalibration(env);
    const picks = await sbGetPicks(env);

    const leagueStats = {};
    let _zonderLeagueWk = 0;
    Object.values(picks).forEach(p => {
      if (p.status === 'pending') return;
      // v223: zelfde 'unknown'-bucket als in updateLeagueCalibration. Deze wekelijkse job zou de
      // verwijderde rij elke zondag opnieuw aanmaken. Overslaan + tellen.
      if (p.leagueId === undefined || p.leagueId === null || p.leagueId === '') { _zonderLeagueWk++; return; }
      const lid = String(p.leagueId);
      if (!leagueStats[lid]) leagueStats[lid] = { wins: 0, total: 0, roi: 0, name: p.leagueName || '' };
      leagueStats[lid].total++;
      if (p.status === 'win') {
        leagueStats[lid].wins++;
        leagueStats[lid].roi += (p.odds - 1) * 100;
      } else {
        leagueStats[lid].roi -= 100;
      }
    });

    if (_zonderLeagueWk) console.warn(`[WeeklyCalib] ${_zonderLeagueWk} pick(s) zonder league_id overgeslagen`);
    Object.entries(leagueStats).forEach(([lid, stats]) => {
      if (stats.total < 5) return;
      const hitrate = stats.wins / stats.total;
      const avgRoi = stats.roi / stats.total;
      const roiFactor = 1 + (avgRoi / 1000);
      const newFactor = parseFloat(Math.max(0.70, Math.min(1.30, roiFactor)).toFixed(3));

      if (!calibration[lid]) calibration[lid] = { leagueName: stats.name };
      calibration[lid].factor = newFactor;
      calibration[lid].historicalHitrate = parseFloat((hitrate * 100).toFixed(1));
      calibration[lid].historicalRoi = parseFloat((avgRoi).toFixed(1));
      calibration[lid].totalPicks = stats.total;
      calibration[lid].weeklyUpdatedAt = new Date().toISOString();
    });

    // v144: automatische tier berekening per league
    const tierUpdates = [];
    Object.entries(leagueStats).forEach(([lid, stats]) => {
      if (stats.total < 10) return; // te weinig data
      const hitrate = stats.wins / stats.total;
      const avgClv = calibration[lid]?.clvSum && calibration[lid]?.clvCount
        ? calibration[lid].clvSum / calibration[lid].clvCount : null;

      let tier = 'neutraal';
      if (hitrate >= 0.45 && (avgClv === null || avgClv >= 2))  tier = 'elite';
      else if (hitrate >= 0.35 && (avgClv === null || avgClv >= 0)) tier = 'goed';
      else if (hitrate < 0.25 || (avgClv !== null && avgClv < -3))  tier = 'risico';

      // Factor aanpassen op basis van tier
      if (!calibration[lid]) calibration[lid] = { leagueName: stats.name };
      calibration[lid].tier = tier;
      calibration[lid].tierUpdatedAt = new Date().toISOString();

      // Extra penalty voor risico leagues
      if (tier === 'risico' && calibration[lid].factor > 0.75) {
        calibration[lid].factor = parseFloat(Math.max(0.70, calibration[lid].factor * 0.90).toFixed(3));
        console.log(`[WeeklyCalib] ${stats.name} (${lid}) → RISICO tier, factor verlaagd naar ${calibration[lid].factor}`);
      }
      if (tier === 'elite' && calibration[lid].factor < 1.10) {
        calibration[lid].factor = parseFloat(Math.min(1.30, calibration[lid].factor * 1.05).toFixed(3));
        console.log(`[WeeklyCalib] ${stats.name} (${lid}) → ELITE tier, factor verhoogd naar ${calibration[lid].factor}`);
      }

      // Supabase tier update
      tierUpdates.push({
        league_id: lid,
        tier,
        tier_updated_at: new Date().toISOString(),
        avg_clv: avgClv ? parseFloat(avgClv.toFixed(2)) : null,
      });
    });

    // Sla tier updates op in Supabase
    if (tierUpdates.length) {
      for (const t of tierUpdates) {
        await sb(env, 'league_calibration', 'POST', [t], '?on_conflict=league_id');
      }
      console.log(`[WeeklyCalib] ${tierUpdates.length} league tiers bijgewerkt`);
    }

    await sbSaveCalibration(calibration, env);
    await fb(env, 'calibration', 'PUT', calibration); // FB fallback
    console.log(`[WeeklyCalib] ${Object.keys(leagueStats).length} leagues gecalibreerd`);

    const totalPicks = Object.values(picks).filter(p => p.status !== 'pending').length;
    const wins = Object.values(picks).filter(p => p.status === 'win').length;
    const hitrate = totalPicks > 0 ? Math.round(wins / totalPicks * 100) : 0;
    // v261: ging naar ALLE abonnees. Interne onderhoudsmelding — een gebruiker heeft niets aan
    // 'leagues bijgewerkt'.
    await sendPushNotification(env,
      `📊 Wekelijkse calibratie klaar`,
      `${totalPicks} picks · ${hitrate}% hitrate · ${Object.keys(leagueStats).length} leagues bijgewerkt`,
      { type: 'calibration' }, { adminOnly: true }
    );
  } catch(e) {
    console.error('[WeeklyCalib] Fout:', e.message);
  }
}

// ── Scheduled value scan ─────────────────────────────────
async function runScan(env, force = false) {
  resetApifTellers(); // v265: MOET hier -- isolates worden hergebruikt
  const today = new Date().toISOString().split('T')[0];
  await loadTuneConfig(env); // v194: runtime bias-config (auto-kalibratie) laden vóór de scan
  const now = new Date();
  // v254: `hour` WAS Nederlandse tijd (getUTCHours() + 2 in de zomer) maar werd getoetst tegen een venster
  // dat overal 'UTC' heet, en de cron-handler die runScan aanroept rekent in ECHTE UTC
  // (fullScan = hour === 6 || (hour >= 12 && hour <= 22), r4961). Twee functies, twee betekenissen van
  // dezelfde variabelenaam. GEMETEN, niet geredeneerd: de run met scheduledTime 1784206846000 = 13:00:46
  // UTC logde '[Scan] Start scan (15:00 UTC, ...)'. Gevolg met scanTo=23: de cron plant 12 volledige scans
  // (0 6 + 0 12-22), maar 21:00 UTC gaf hour=23 -> 23 >= 23 -> skip, en 22:00 UTC gaf hour=24 (er zat geen
  // modulo op, dus een uur dat niet bestaat) -> skip. Twee van de twaalf vielen dus elke dag stil af,
  // NADAT de cron ze correct had ingepland en na de Elo-sweep — 23:00 en 00:00 NL, en snapshotOddsOnly
  // begint pas om 23:00 UTC, dus daar zat een gat van twee uur vlak voor de slotkoers.
  // RAAKT DE GESCHIEDENIS: v238 schreef 'de scans van 20/21/22 UTC vonden geen wedstrijden' toe aan
  // MAX_SCANS_PER_DAY. Die van 21 en 22 UTC bereikten de fixture-fetch nooit — ze vielen op deze poort.
  // Nu gelijk aan de cron: 06 -> 6 (>= scanFrom), 12-22 -> allemaal < 23, dus alle 12 geplande scans
  // draaien ook echt. Dat is exact wat v188 bedoelde toen scanTo van 18 naar 23 ging.
  const hour = now.getUTCHours();

  let scanFrom = 6, scanTo = 23, autoScanEnabled = true, maxPerDay = 8; // v188: scanTo 18->23 — was niet meegewijzigd met de cron (vuurt 12-22 UTC) + /health-venster; avondscans 18-22 UTC (prime-time NL) werden overgeslagen
  try {
    const schedule = await fb(env, 'scan_schedule');
    if (schedule) {
      // Alleen enabled/maxPerDay uit Firebase — scanFrom/scanTo altijd via code defaults
      autoScanEnabled = schedule.enabled !== false;
      maxPerDay       = schedule.maxPerDay ?? 8;
      // startHour/endHour bewust NIET uit Firebase — voorkomt verkeerde configuratie
      // v254: deze regel was HARDGECODEERD op '06:00-22:00 UTC (gelijk aan cron)' terwijl scanTo op 23
      // stond en de cron 0 6 + 0 12-22 + 0 23 + 0 0-5 vuurt — drie beweringen, drie verschillende
      // vensters. Een logregel die zijn eigen variabelen niet leest, is precies hoe v238 op het verkeerde
      // spoor kwam. Nu leest hij ze wel.
      console.log(`[Scan] scan_schedule geladen (enabled=${autoScanEnabled}, maxPerDay=${maxPerDay}); scanvenster ${scanFrom}:00-${scanTo}:00 UTC uit code-defaults`);
    }
  } catch(e) {
    console.log('[Scan] scan_schedule niet geladen, gebruik defaults');
  }

  if (!autoScanEnabled && !force) {
    console.log('[Scan] Auto scan uitgeschakeld via scan_schedule, skip');
    return;
  }

  if (!force && (hour < scanFrom || hour >= scanTo)) {
    console.log(`[Scan] Buiten scanvenster (${hour}:00 UTC, venster ${scanFrom}:00-${scanTo}:00 UTC), skip`);
    return;
  }
  if (force) console.log(`[Scan] Handmatige trigger — autoScan en scanvenster overgeslagen`);
  console.log(`[Scan] Start scan (${hour}:00 UTC, venster ${scanFrom}:00-${scanTo}:00 UTC)`);

  let allMatches = [];

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  console.log(`[Scan] Fixtures ophalen voor ${today} en ${tomorrowStr}...`);

  // ── Actieve leagues (handmatig bijgehouden) ───────────────
  // WK: 11 jun – 19 jul 2026 (league 1)
  // Scandinavisch: lopen maart–december door (kleine pauze WK-periode)
  // CL/EL/ECL finales: t/m eind mei
  const dateNow = new Date(today);
  const wkStart = new Date('2026-06-11');
  const wkEnd   = new Date('2026-07-20');
  const WK_ONLY_MODE = false; // v138: alle actieve competities + WK
  const isWKActive = WK_ONLY_MODE || (dateNow >= wkStart && dateNow < wkEnd);

  let leagueConfig;
  if (false) { // uitgeschakeld — altijd volledige config
    leagueConfig = [{ id: 1, s: 2026 }];
    console.log('[Scan] 🏆 WK actief — alleen WK (ID 1)');
  } else {
    // Actieve competities buiten WK-periode:
    // 88 Eredivisie playoffs, 113 Eliteserien NO, 113→ check, 
    // 103 Allsvenskan SE, 2/3/848 CL/EL/ECL (t/m eind mei)
    // v148: automatische seizoenswisseling
    // Fase 1: WK-zomer (t/m 19 jul 2026) — WK + actieve zomercompetities
    // Fase 2: Post-WK / nieuw Europees seizoen (vanaf 20 jul 2026) — alleen Europa
    const postWK = dateNow >= new Date('2026-07-20');

    if (!postWK) {
      // ── FASE 1: WK-zomer ──────────────────────────────────
      leagueConfig = [
        { id: 1,   s: 2026 }, // FIFA World Cup 2026
        { id: 103, s: 2026 }, // Eliteserien (Noorwegen) — actieve zomercompetitie apr–nov
        { id: 113, s: 2026 }, // Allsvenskan (Zweden) — actieve zomercompetitie apr–nov
      ];
      console.log('[Scan] FASE 1 — WK + zomercompetities (WK + Eliteserien + Allsvenskan)');
    } else {
      // ── FASE 2: Post-WK — alleen Europa (nieuw seizoen 2026-27) ─
      leagueConfig = [
        // Top 5 Europa
        { id: 39,  s: 2026 }, // Premier League Engeland
        { id: 140, s: 2026 }, // La Liga Spanje
        { id: 78,  s: 2026 }, // Bundesliga Duitsland
        { id: 135, s: 2026 }, // Serie A Italië
        { id: 61,  s: 2026 }, // Ligue 1 Frankrijk
        // Europese subtop
        { id: 88,  s: 2026 }, // Eredivisie Nederland
        { id: 94,  s: 2026 }, // Primeira Liga Portugal
        { id: 144, s: 2026 }, // Jupiler Pro League België
        { id: 179, s: 2026 }, // Scottish Premiership
        { id: 207, s: 2026 }, // Super League Zwitserland
        { id: 203, s: 2026 }, // Super Lig Turkije
        // Europese toernooien
        { id: 2,   s: 2026 }, // Champions League
        { id: 3,   s: 2026 }, // Europa League
        { id: 848, s: 2026 }, // Conference League
        // Nederland
        { id: 89,  s: 2026 }, // Keuken Kampioen Divisie (VVV-Venlo)
        // Duitsland
        { id: 79,  s: 2026 }, // 2. Bundesliga
        { id: 80,  s: 2026 }, // 3. Liga
        // Engeland
        { id: 40,  s: 2026 }, // Championship
        { id: 41,  s: 2026 }, // League One
      ];
      console.log('[Scan] FASE 2 — Post-WK Europese seizoen: 19 leagues actief');
    }
  }

  // Leagues die UTC timezone gebruiken — date= werkt niet, gebruik next=15
  const NEXT_LEAGUES = new Set([1, 113, 103, 119, 129, 253, 71, 239, 292, 98, 169]); // v153: WK (1) vangnet // v146: alleen actieve zomer-leagues // 10=Friendlies, 5=NL, 6/29/36=WK kwal

  const SCAN_LEAGUES = leagueConfig.map(l => l.id);
  const SCAN_LEAGUE_SET = new Set(SCAN_LEAGUES);

  // v258: _fxRl stond met `const` BINNEN het try-blok hieronder, maar wordt ook gelezen op het
  // `if (!allMatches.length)`-pad DAARBUITEN (r~2985). const is block-scoped -> ReferenceError,
  // en wel op precies de dag waarvoor v251 hem bouwde: 0 wedstrijden. De check die moest melden
  // "dit is geen rustige dag maar een mislukte fetch" liet de scan in plaats daarvan crashen.
  // Node --check ziet dit niet (scope, geen syntax); eslint no-undef wel — gemeten, 2 treffers in
  // 5086 regels. Init op 0 is de gemeten waarde ("nul date-calls geweigerd"), geen fallback:
  // als de try faalt vóór de toewijzing is er inderdaad geen weigering vastgesteld, en dan is de
  // catch-log de plek waar dat blijkt.
  let _fxRl = 0;

  try {
    // v114: 2 globale date-calls i.p.v. ~28 per-league calls.
    // Fixt API-Football per-seconde burst-limiet (28 parallelle calls > ~5/sec op Pro)
    // én Cloudflare 50-subrequest-limiet (budget komt vrij voor odds + AI).
    const [fxToday, fxTomorrow] = await Promise.all([
      apif(`/fixtures?date=${today}&timezone=Europe/Amsterdam`, env),
      apif(`/fixtures?date=${tomorrowStr}&timezone=Europe/Amsterdam`, env),
    ]);
    // v251: een GEWEIGERDE fixtures-call was niet te onderscheiden van 'geen wedstrijden'. apif geeft bij
    // een opgegeven rate-limit een lege array terug met .rateLimited (v245) -- die vlag lag klaar maar werd
    // op dit pad nooit gelezen. Dit is de meest stroomopwaartse call die er is: geen fixtures -> geen odds
    // -> geen analyseBatch -> geen pick -> geen CLV, en het ziet eruit als een rustige speeldag.
    // Raakt ook de geschiedenis: v238 concludeerde dat de avondscans van 20/21/22 UTC 'geen wedstrijden
    // vonden' en noemde dat normaal omdat het WK voorbij was. Die conclusie steunt op exact deze blinde
    // !allMatches.length en is dus nooit hard geweest. Vanaf nu is het verschil zichtbaar.
    _fxRl = (fxToday && fxToday.rateLimited ? 1 : 0) + (fxTomorrow && fxTomorrow.rateLimited ? 1 : 0); // v258: was `const` — zie hoisting-comment boven het try-blok
    if (_fxRl) console.error(`[Scan] ⚠️ FIXTURES GEWEIGERD: ${_fxRl} van 2 date-calls rate-limited — dit is GEEN rustige dag, de data is niet opgehaald. Scan levert onvermijdelijk te weinig wedstrijden.`);
    const fixtures = [...fxToday, ...fxTomorrow].filter(f => SCAN_LEAGUE_SET.has(f.league?.id));

    const seen = new Set();
    const unique = fixtures.filter(f => {
      const id = f.fixture?.id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    console.log(`[Scan] ${unique.length} unieke fixtures gevonden over ${SCAN_LEAGUES.length} leagues${_fxRl ? ` — LET OP: ${_fxRl}/2 date-calls geweigerd, dit aantal is een ONDERGRENS` : ''}`);

    // v130: vangnet — internationale/Scandinavische leagues die date= soms mist (UTC-opslag).
    // Alleen leagues die in de date=-uitkomst ontbraken aanvullen met next= (gezonde dag = 0 extra calls).
    const seasonOf = (id) => { const l = leagueConfig.find(x => x.id === id); return l ? l.s : 2026; };
    const coveredLeagues = new Set(unique.map(f => f.league?.id));
    const missingNext = SCAN_LEAGUES.filter(id => NEXT_LEAGUES.has(id) && !coveredLeagues.has(id));
    const recovered = [];
    if (missingNext.length) {
      console.log(`[Scan] ${missingNext.length} intl/Scand. leagues niet in date=, next= ophalen: ${missingNext.join(',')}`);
      for (const lid of missingNext.slice(0, 8)) { // cap i.v.m. Cloudflare subrequest-budget
        try {
          const nx = await apif(`/fixtures?league=${lid}&season=${seasonOf(lid)}&next=10&timezone=Europe/Amsterdam`, env);
          nx.forEach(f => { const id = f.fixture?.id; if (id && !seen.has(id)) { seen.add(id); recovered.push(f); } });
        } catch(e) { console.warn(`[Scan] next= faalde voor league ${lid}`, e); }
      }
      console.log(`[Scan] ${recovered.length} extra fixtures via next=`);
    }
    const combined = [...unique, ...recovered];

    const nowMs = Date.now();
    // v271: EEN venster voor beide takken. Was `force ? endOfDay : nowMs + 24u`, waardoor een
    // HANDMATIGE scan MINDER ver vooruit keek dan de automatische -- precies omgekeerd aan wat je
    // van een handmatige trigger verwacht. GEMETEN 17-07 23:09 UTC (01:09 NL, force-scan onder v269):
    // scan_runs zegt matches_total=0 bij 2 api-calls en 0 weigeringen, terwijl de echte API voor het
    // 24u-venster 8 fixtures gaf (7x Eliteserien, 1x Allsvenskan, + WK France-England). Oorzaak: de
    // fixtures van 17-07 waren om 01:09 NL al FT, en die van 18-07 (>= 12:00 UTC) vielen buiten
    // endOfDay(17-07). De scan meldde dus 'geen wedstrijden' op een dag met wedstrijden -- geen
    // onware bewering (0 IS het aantal in dat venster), maar wel een venster dat de meting waardeloos
    // maakt op het moment dat je juist verifieert.
    // Tweede reden: `new Date(today + 'T23:59:59')` werd in de worker als UTC geparsed terwijl de
    // fixtures met timezone=Europe/Amsterdam binnenkomen -- twee tijdzones in een vergelijking, de
    // familie waar v254 uit voortkwam. Dat mengsel is nu weg, endOfDay bestaat niet meer.
    // Gevolg: /scan-now ziet nu ook de wedstrijden van morgen binnen 24u -- exact wat de cron van het
    // volgende uur sowieso zou doen. Geen modelwijziging, geen extra api-calls (dezelfde 2 date-calls).
    const timeWindow = nowMs + 24 * 60 * 60 * 1000;

    allMatches = combined
      .filter(f => {
        const status = f.fixture?.status?.short;
        const kickoff = f.fixture?.date ? new Date(f.fixture.date).getTime() : 0;
        const isLive = ['1H','2H','HT','ET','BT','P'].includes(status);
        const isNS = ['NS','TBD','PST'].includes(status);
        return isLive || (isNS && kickoff > nowMs - 60 * 60 * 1000 && kickoff < timeWindow);
      })
      .map(f => ({
        fixtureId: f.fixture?.id,
        home: f.teams?.home?.name,
        away: f.teams?.away?.name,
        homeId: f.teams?.home?.id || null, // v208: team-ID plumbing voor Elo-blend
        awayId: f.teams?.away?.id || null, // v208
        matchDate: f.fixture?.date?.split('T')[0] || today,
        matchTime: f.fixture?.date,
        leagueId: f.league?.id,
        leagueSeason: f.league?.season || null, // v243: seizoen uit de fixture zelf (zie fetchOddsForFixtures)
        leagueName: f.league?.name || '',
        venue: f.fixture?.venue?.name || '',
      }));

    console.log(`[Scan] ${allMatches.length} wedstrijden na filter (NS/live)`);
  } catch(e) {
    console.error('[Scan] Fout bij fixtures ophalen:', e);
  }

  if (!allMatches.length) {
    // v251: 'geen wedstrijden' is een CONCLUSIE, en die mag niet getrokken worden als de data geweigerd is.
    if (_fxRl) console.error(`[Scan] ⛔ STOP met 0 wedstrijden, maar ${_fxRl}/2 date-calls waren GEWEIGERD — dit is geen rustige dag maar een mislukte fetch. Niet als 'niets te doen' interpreteren.`);
    else console.log('[Scan] Geen wedstrijden gevonden voor vandaag/morgen, stop');
    // v107: reset teller als het een nieuwe dag is
    const st0 = await sbGetScanStatus(env); // R1-fase2: teller uit Supabase
    const lastScanDate = st0.scanDate;
    const rawScansToday = st0.scansToday;
    const scansToday0 = (lastScanDate !== today) ? 1 : rawScansToday + 1;
    if (lastScanDate !== today) console.log(`[Scan] Nieuwe dag — teller gereset (${lastScanDate} → ${today})`);
    // v238: de MAX_SCANS_PER_DAY=8-poort die hier stond is WEG. Drie dingen klopten er niet aan:
    // (1) de cron plant 12 volledige scans per dag (0 6 + 0 12-22), dus op elke rustige dag liepen scan
    //     9 t/m 12 (19:00-22:00 UTC = 21:00-00:00 NL, prime time) gegarandeerd tegen de limiet;
    // (2) hij stond ALLEEN in deze !allMatches.length-tak — het GOEDKOPE pad, dat geen AI aanroept —
    //     terwijl het dure pad (wedstrijden + AI-analyses) helemaal geen dagcap heeft. Precies omgekeerd;
    // (3) hij zat NA het ophalen van de fixtures, dus hij bespaarde geen enkele API-call. Het enige wat
    //     de vroege return nog deed was de hartslag-write overslaan.
    // Gevolg (waargenomen 14-07): de scans van 20/21/22 UTC vonden geen wedstrijden (WK afgelopen,
    // clubseizoen start 20-07), sloegen op de limiet aan en schreven lastRun niet weg -> last_scan
    // bevroor op 19:01 -> /health riep 'scan_verouderd' en de monitor-workflow zou bij >400 min
    // 'cron lijkt dood' melden, terwijl de cron gewoon draaide en terecht niets te doen had.
    // Een hartslag die alleen klopt als er werk is, is geen hartslag. Nu altijd wegschrijven; dat een
    // scan niets vond blijkt uit lastMatchCount=0, niet uit een ontbrekende regel.
    const scanData0 = { lastRun: new Date().toISOString(), lastMatchCount: 0,
      lastPickCount: 0, lastWithOdds: 0, lastWithoutOdds: 0,
      scanDate: today, version: VERSION, scansToday: scansToday0,
      // v269: deze nullen zijn GEMETEN (scan zag geen wedstrijden), niet onbekend.
      matchesTotal: 0, removedCount: 0, shadowSaved: 0,
      analysisSkipped: 0 }; // v271: geen kandidaten -> filter draaide niet -> gemeten 0, niet NULL
    await sbUpdateScanStatus(scanData0, env);
    // v134: geen push bij lege scan — alleen pushen bij echte picks
    console.log('[Scan] Geen wedstrijden in tijdvenster — stil afsluiten (geen push)');
    return;
  }

  allMatches.sort((a, b) => {
    // soonest-first; fixtures zonder aftraptijd naar achteren zodat ze geen batch-slot afsnoepen van imminente duels
    const ta = a.matchTime ? new Date(a.matchTime).getTime() : Infinity;
    const tb = b.matchTime ? new Date(b.matchTime).getTime() : Infinity;
    return ta - tb;
  });

  const youthBefore = allMatches.length;
  allMatches = allMatches.filter(m => !isYouthMatch(m.home, m.away));
  if (allMatches.length !== youthBefore) console.log(`[Scan] ${youthBefore - allMatches.length} jeugdwedstrijden (U15-U23) uitgefilterd`);

  const batch = allMatches.slice(0, MAX_AI_ANALYSES_PER_SCAN);
  if (allMatches.length > batch.length) {
    console.log(`[Scan] ${allMatches.length} fixtures in venster — ${batch.length} nu geanalyseerd (soonest-first), ${allMatches.length - batch.length} doorgeschoven naar de volgende uur-run`);
  }
  console.log(`[Scan] ${batch.length} wedstrijden gevonden, odds ophalen...`);

  // v155: snapshot-dekking verbreed. We halen odds op voor ALLE aankomende fixtures
  // (today+tomorrow, actieve leagues) i.p.v. alleen de 12 die we AI-analyseren.
  // De bulk date-fetch dekt de hele dag al in 2-4 calls, dus dit kost nauwelijks extra
  // subrequests. Resultaat: elke fixture krijgt meerdere snapshots over de 6 dagelijkse
  // cron-runs -> een echte opening->closing curve i.p.v. 1 losse meting (CLV-fix).
  const fixtureIds = allMatches.map(m => m.fixtureId).filter(Boolean);
  // v243: allMatches meegeven -> odds per (datum, competitie) i.p.v. de wereldlijst doorbladeren.
  // maxCalls 30 -> 80: er komen meer, maar veel gerichtere calls (op een drukke zaterdag ~15 competities
  // x 2 datums x 1-2 pagina's). 12 scans/dag x 80 = ~960 odds-calls, ruim binnen de 7500/dag van Pro
  // (gemeten dagverbruik nu: 77). Het comment 'bulk dekt alles' dat hier stond was aantoonbaar onwaar.
  const rawBooksMap = {}; // v277: per-boek odds -> market_consensus.bookmaker_odds (oddsvergelijker-fundering)
  const oddsMap = await fetchOddsForFixtures(fixtureIds, env, 80, ENABLE_GOAL_MARKETS, allMatches, null, rawBooksMap);
  console.log(`[Scan] Odds gevonden voor ${Object.keys(oddsMap).length} wedstrijden`);

  const oddsHistoryPath = `odds_history/${today}`;
  const existingHistory = await fb(env, oddsHistoryPath) || {};
  const newHistory = { ...existingHistory };
  Object.entries(oddsMap).forEach(([fid, odds]) => {
    if (!newHistory[fid]) {
      newHistory[fid] = { opening: odds, timestamp: new Date().toISOString() };
    }
    newHistory[fid].current = odds;
    newHistory[fid].updatedAt = new Date().toISOString();
  });
  await fb(env, oddsHistoryPath, 'PUT', newHistory);

  let sharpSignals = {};
  try {
    await saveOddsSnapshots(oddsMap, allMatches, env); // v155: snapshot alle aankomende fixtures, niet alleen de 12-batch
    // v135: market_consensus snapshot opslaan (multi-book variance + implied pct)
    await saveMarketConsensusSnapshot(oddsMap, batch, rawBooksMap, env);
    // v135: detectSharpMoney met Poisson map (null = eerste run, poisson komt na AI-ronde)
    sharpSignals = await detectSharpMoney(oddsMap, batch, env, null) || {};
  } catch(e) {
    console.error('[SB] fout (non-fatal):', e.message);
  }

  // withOdds/withoutOdds blijven op `batch` (de 24 eerstvolgende) — die voeden de dekkingsmetriek
  // last_with_odds/last_without_odds en het v243-alarm; van betekenis veranderen zou dat alarm breken.
  const withOdds = batch.filter(m => oddsMap[m.fixtureId]);
  const withoutOdds = batch.filter(m => !oddsMap[m.fixtureId]);

  // Internationale oefenwedstrijden (league 10/5/6) ook analyseren zonder odds
  // Ze worden gemarkeerd als isSparseData zodat confidence-drempel omhoog gaat
  const INTL_LEAGUES = new Set([5, 6, 10, 29, 36]);
  const withoutOddsIntl = withoutOdds.filter(m => INTL_LEAGUES.has(m.leagueId));

  // v246: de AI-selectie kijkt naar ALLE wedstrijden met odds, niet alleen naar de eerste 24.
  // Voorheen was analyseBatch een deelverzameling van batch (soonest-first 24), waardoor duel 25+
  // op een drukke dag pas aan de beurt kwam als de eerdere waren afgetrapt. Nu vallen duels met
  // ongewijzigde odds af (zelfde antwoord bij temperature 0) en schuiven nog-niet-geanalyseerde
  // duels dóór in de cap. Volgorde blijft soonest-first, want allMatches is al zo gesorteerd.
  const kandidatenAlles = allMatches.some(m => oddsMap[m.fixtureId])
    ? [...allMatches.filter(m => oddsMap[m.fixtureId]),
       ...allMatches.filter(m => !oddsMap[m.fixtureId] && INTL_LEAGUES.has(m.leagueId))]
    : batch;
  const teAnalyseren = await selecteerTeAnalyseren(kandidatenAlles, oddsMap, env, ENABLE_GOAL_MARKETS);
  // v271: het aantal dat de odds-ongewijzigd-filter oversloeg -- tot nu toe alleen in een logregel
  // binnen selecteerTeAnalyseren, dezelfde blinde vlek als candidates_removed voor v269. Zonder dit
  // getal is matches_analysed=0-door-overslaan niet te onderscheiden van 0-door-fetchfout in de
  // telemetrie. GEMETEN als verschil van twee lijsten die hier allebei bestaan; geen wijziging aan
  // de helper-signatuur nodig. kandidatenAlles kan in de fallback `batch` zijn -- dan is dit verschil
  // nog steeds correct 'wat de filter wegnam'.
  const analyseSkipped = kandidatenAlles.length - teAnalyseren.length;
  const analyseBatch = teAnalyseren.slice(0, MAX_AI_ANALYSES_PER_SCAN);
  if (teAnalyseren.length > analyseBatch.length) {
    console.log(`[Scan] ${teAnalyseren.length} wedstrijden hebben analyse nodig, cap is ${MAX_AI_ANALYSES_PER_SCAN} — ${teAnalyseren.length - analyseBatch.length} schuiven door naar de volgende uur-run (nu ECHT: ze staan vooraan zodra de huidige batch ongewijzigd blijft)`);
  }
  const prompt = `Je bent een kwantitatief voetbal data-analist. Analyseer ELKE wedstrijd op basis van statistische verwachtingen.

KRITISCHE REGELS:
- Baseer kansen op historische doelpuntenpatronen en competitieniveau. Vermijd blinde reputatie-weging, MAAR: de marktodds vangen het klasseverschil (Strength of Schedule) wel degelijk - gebruik ze als sterk anker (zie SoS-regel)
- GELIJKSPEL WAARSCHUWING: Gelijkspel komt voor in slechts ~25-28% van alle wedstrijden. Overschat gelijkspelkansen NIET. Wees terughoudend met kansX boven 30% tenzij teams historisch veel gelijkspeelden\n- KLASSE/SoS-VALKUIL (belangrijk): rauwe doelsaldi misleiden als een team ze opbouwde tegen zwakke tegenstanders (bv. een klein land dat weinig tegendoelpunten kreeg tegen mindere landen). De markt vangt dit klasseverschil wel. Anker je 1X2-kansen daarom binnen ~12 procentpunt van de de-vigde marktkans; wijk alleen verder af met een concrete, sterke reden. Zet een duidelijke marktfavoriet (odds < 1.30) NOOIT onder ~65% puur op basis van doelpuntenpatronen - dat is vrijwel altijd de SoS-valkuil, niet echte value
- Thuisvoordeel is reëel: gemiddeld +5-8% kansverhoging voor thuisteam in Europese competities
- Kleine competities (Noorwegen/Zweden/lagere divisies): data is onbetrouwbaarder, geef lagere confidence
- LANDENTEAMS/TOERNOOI [LANDENDUEL/TOERNOOI tag]: gebruik marktodds als sterke prior. Weeg FIFA-ranking: +20 plaatsen hoger = ca. +4% kansverhoging. Recente form laatste 3 duels zwaarder dan historisch gemiddelde. WK-groepsfase: hoge motivatie beide teams, verrassingen komen vaker voor. Confidence 5-7, nooit boven 7 voor landenduels
- Som van h+x+a moet exact 100 zijn${ENABLE_GOAL_MARKETS ? '\n- Schat OOK het verwachte aantal doelpunten per team: gh = thuis, ga = uit (realistisch 0.3-3.5, gebaseerd op aanval/verdediging en competitieniveau)' : ''}

WEDSTRIJDEN:
${analyseBatch.map((m, i) => {
  const odds = oddsMap[m.fixtureId];
  const oddsStr = odds ? ` | Odds: ${odds.home}/${odds.draw}/${odds.away}` : '';
  const isTournM = typeof isTournamentLeague === 'function' && isTournamentLeague(m.leagueId);
  const tournTag = isTournM ? ' [LANDENDUEL/TOERNOOI]' : '';
  return `${i+1}. ${m.home} vs ${m.away} (${m.leagueName}, ${m.matchDate || 'datum?'})${tournTag}${oddsStr}`;
}).join('\n')}

Antwoord ALLEEN met een JSON array — geen tekst, geen uitleg, geen markdown:
[{"h":52,"x":26,"a":22,"c":7${ENABLE_GOAL_MARKETS ? ',"gh":1.6,"ga":1.1' : ''}},...]
Exact ${analyseBatch.length} objecten, zelfde volgorde.`;

  let aiResults = [];
  try {
    const aiRes = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        // v240: 512 -> 2048. Bij een volle batch van 24 wedstrijden moet het antwoord 24 JSON-objecten
        // bevatten (met ENABLE_GOAL_MARKETS ook gh/ga), en dat past niet betrouwbaar in 512 tokens.
        // Loopt het antwoord vol, dan is de array niet afgesloten, vindt de regex geen match en blijft
        // aiResults leeg -> zie de skip-fix hieronder. Tot nu toe nooit geraakt omdat het WK 1-4 duels
        // per scan gaf (gemeten: 62 output-tokens gemiddeld over 148 calls); vanaf 20-07 met 19
        // competities zijn volle batches de norm, dus dit was een tijdbom op de competitieswitch.
        // Kost niets: Anthropic rekent af op werkelijke output, max_tokens is enkel een plafond.
        max_tokens: 2048,
        temperature: 0,
        // v182: caching verwijderd — system-blok was ~30 tokens, ver onder de 1024-token cachedrempel,
        // dus caching deed niets. Bij 1 gebundelde call per uur (cache-TTL 5 min) levert het sowieso niets op.
        system: 'Je bent een kwantitatief voetbal data-analist. Antwoord ALLEEN met een JSON array. Geen tekst, geen uitleg, geen markdown.',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const aiData = await aiRes.json();
    await trackAnthropicCost(env, 'cron-scan', aiData.usage);
    const text = aiData?.content?.[0]?.text || '[]';
    const match = text.match(/\[[\s\S]*?\]/);
    if (match) {
      aiResults = JSON.parse(match[0]);
    }
  } catch(e) {
    console.error('[Scan] AI fout:', e);
  }

  // v117: watchdog — onderscheid stille AI-mislukking (parse/API-fout) van 'geen value'
  // v246: vastleggen WELKE odds zojuist geanalyseerd zijn, zodat de volgende uur-run deze duels kan
  // overslaan zolang de koers stilstaat. Alleen loggen wat de AI daadwerkelijk terugggaf: bij een
  // mislukte of afgekapte call mag een wedstrijd niet als 'gedaan' gelden — dan komt hij volgend uur
  // gewoon terug. Non-fataal: faalt het schrijven, dan analyseren we volgende ronde dubbel, that's all.
  if (aiResults.length) await logAiAnalyse(analyseBatch.slice(0, aiResults.length), oddsMap, env, ENABLE_GOAL_MARKETS);

  const aiFailed = analyseBatch.length > 0 && aiResults.length === 0;
  if (aiFailed) console.error(`[Scan] ⚠️ AI gaf 0 resultaten voor ${analyseBatch.length} wedstrijden — mogelijk parse/API-fout`);
  // v240: gedeeltelijk antwoord is de gevaarlijkste variant — hij ziet er geslaagd uit. Sinds de
  // fabricage-fallback weg is worden die wedstrijden overgeslagen; dat mag niet stil gebeuren.
  if (aiResults.length && aiResults.length < analyseBatch.length) {
    console.error(`[Scan] ⚠️ AI gaf ${aiResults.length} van ${analyseBatch.length} objecten — ${analyseBatch.length - aiResults.length} wedstrijden overgeslagen (liever geen pick dan een verzonnen kans)`);
  }

  // v139: bouw poissonMap uit AI-resultaten voor betere sharp divergentie berekening
  // { fixtureId: { h: homeWinPct, x: drawPct, a: awayWinPct } }
  // v247: `{ h: ai.h || 33, x: ai.x || 33, a: ai.a || 34 }` verzon kansen op VELDniveau. De v240-comment
  // hieronder beweert dat deze lus het al goed deed met `if (!ai) return` — dat klopt voor het OBJECT,
  // niet voor de velden: een onvolledig antwoord ({h:62} zonder x/a, precies wat een afgekapt of half
  // geparsed JSON-object oplevert) werd stilzwijgend {h:62,x:33,a:34} = 129%, geen geldige verdeling.
  // En h:0 is een geldige kans die naar 33 werd getild — de falsy-fallback-familie, achtste instantie.
  // Niet binnenshuis: poissonMap voedt detectSharpMoney -> divergentie -> sharpScore, en die gate't de
  // longshot-guard (odds>=3.5 vereist sharpScore>=55) en vult sharp_signal_results/market_consensus.
  // Overslaan is de enige juiste uitkomst, zelfde lijn als de pick-lus: geen data = geen signaal.
  const poissonMap = {};
  let pmSkipped = 0;
  analyseBatch.forEach((m, i) => {
    const ai = aiResults[i];
    if (!ai) { pmSkipped++; return; }
    const h = Number(ai.h), x = Number(ai.x), a = Number(ai.a);
    if (!Number.isFinite(h) || !Number.isFinite(x) || !Number.isFinite(a)) { pmSkipped++; return; }
    poissonMap[m.fixtureId] = { h, x, a };
  });
  if (pmSkipped) console.warn(`[Scan] poissonMap: ${pmSkipped} van ${analyseBatch.length} wedstrijden overgeslagen (geen/onvolledige AI-kansen — liever geen divergentiesignaal dan een verzonnen kans)`);

  // Tweede detectSharpMoney aanroep met echte Poisson data (divergentie nu correct)
  if (Object.keys(poissonMap).length > 0) {
    try {
      sharpSignals = await detectSharpMoney(oddsMap, batch, env, poissonMap) || sharpSignals;
    } catch(e) { console.error('[Sharp] Tweede run fout:', e.message); }
  }

  const newPicks = {};
  const shadowRows = []; // v166: bijna-value picks voor schaduw-trackrecord
  const ahShadowRows = []; // v205: AH-schaduwrijen (beste lijn per wedstrijd, datacollectie)
  const goalMmmRows = []; // v192: goal-markt modelrijen voor AI-accuraatheids-tracking (alle goal-tips)
  const existingPicks = await sbGetPicks(env);
  const todayHistory = await fb(env, `odds_history/${today}`) || {};
  const leagueCalibration = await sbGetCalibration(env);
  console.log(`[Scan] ${Object.keys(leagueCalibration).length} league calibraties geladen`);

  // v208: Elo-fundament — ratings van alle scan-teams één keer laden (SoS-blend + markt-seeding).
  // Blend blijft dormant zolang ELO_BLEND_W===0 (picks byte-identiek); seeding rijpt de Elo alvast.
  let eloMap = {}; let eloPreloadOk = false; const eloSeedRows = []; const eloShadowRows = []; // v211: eloShadowRows = backtest-log
  if (ENABLE_ELO_FOUNDATION) {
    try {
      const ids = [...new Set(analyseBatch.flatMap(m => [m.homeId, m.awayId]).filter(Boolean))];
      if (ids.length) {
        const rows = await sb(env, 'team_ratings', 'GET', null, `?team_id=in.(${ids.join(',')})&select=team_id,elo,games,seeded`) || [];
        rows.forEach(r => { eloMap[r.team_id] = { elo: Number(r.elo), games: Number(r.games) || 0, seeded: !!r.seeded }; });
      }
      eloPreloadOk = true;
    } catch(e) { console.error('[Elo] preload fout (seeding overgeslagen):', e.message); }
  }

  // v240: geen verzonnen kansen meer. Hier stond `aiResults[i] || { h:50, x:25, a:25, c:5 }`, dus zodra
  // de AI minder objecten teruggaf dan er wedstrijden waren (parse-fout -> lege array, afgekapt antwoord,
  // of simpelweg een kortere lijst) kreeg elke resterende wedstrijd stilzwijgend een VERZONNEN 50/25/25.
  // Dat is een directe schending van de CIJFERBRON-regel, en het bleef niet binnenshuis: c.aiKans voedt
  // de candidate-vorming, model_market_comparison (v_ai_tip_accuracy) en shadow_picks -- precies de
  // datasets van de draw-evaluatie (eind augustus) en de Elo-blend-validatie (oktober). De c:5 remt niets:
  // calculateConfidenceV20 gebruikt ai.c helemaal niet en leunt voor 40% op de markt, dus een verzonnen
  // 50/25/25 kan de conf-drempel gewoon halen. De poissonMap-lus hierboven deed het al goed (`if (!ai) return`);
  // deze lus wijkt daar zonder reden van af. Zevende instantie van de falsy-fallback-familie.
  // Overslaan is de enige juiste uitkomst: geen data = geen pick, geen shadow-rij, geen tip.
  analyseBatch.forEach((m, i) => {
    let ai = aiResults[i];
    if (!ai || !Number.isFinite(Number(ai.h)) || !Number.isFinite(Number(ai.x)) || !Number.isFinite(Number(ai.a))) return;
    const odds = oddsMap[m.fixtureId] || {};
    const confidence = parseInt(ai.c) || 5;
    const tournament = isTournamentLeague(m.leagueId); // v127: landenduel-hardening

    // v208: Elo-fundament per wedstrijd. Seeding (rijpt de Elo) + optionele blend (dormant tot elo_blend_w>0).
    if (ENABLE_ELO_FOUNDATION && m.homeId && m.awayId) {
      const fH = fairImpliedFor(odds, '1'), fX = fairImpliedFor(odds, 'X'), fA = fairImpliedFor(odds, '2');
      const hAdv = eloHomeAdv(m.leagueId);
      // markt-seeding: onbekend team krijgt begin-Elo uit de markt (alleen als preload slaagde → geen clobber)
      if (eloPreloadOk && fH != null && fX != null && fA != null) {
        const eHome = (fH + 0.5 * fX) / 100;               // verwachte score thuis uit de markt (0..1)
        const diff = marketToEloDiff(eHome) - hAdv;         // geïmpliceerd Elo-verschil (thuis − uit)
        const hKnown = !!eloMap[m.homeId], aKnown = !!eloMap[m.awayId];
        const now = new Date().toISOString();
        const seed = (id, name, elo) => { const e = Math.round(elo * 10) / 10; eloMap[id] = { elo: e, games: 0, seeded: true }; eloSeedRows.push({ team_id: id, team_name: name, elo: e, games: 0, seeded: true, updated_at: now }); };
        if (!hKnown && !aKnown) { seed(m.homeId, m.home, 1500 + diff / 2); seed(m.awayId, m.away, 1500 - diff / 2); }
        else if (!hKnown && aKnown) { seed(m.homeId, m.home, eloMap[m.awayId].elo + diff); }
        else if (hKnown && !aKnown) { seed(m.awayId, m.away, eloMap[m.homeId].elo - diff); }
      }
      // v211: bij rijpheid (beide teams >=6 games) áltijd de schaduw-blend loggen voor de backtest
      // (v_elo_blend_backtest), ongeacht of de live-blend aanstaat. De live-blend past ai alleen aan als elo_blend_w>0.
      const hr = eloMap[m.homeId], ar = eloMap[m.awayId];
      if (hr && ar && hr.games >= ELO_MIN_GAMES && ar.games >= ELO_MIN_GAMES) {
        const imp = eloImplied1X2(hr.elo, ar.elo, hAdv);
        const r1 = v => Math.round(v * 10) / 10, ws = ELO_SHADOW_W;
        eloShadowRows.push({
          fixture_id: m.fixtureId, league_id: m.leagueId || null, match_date: m.matchDate || today, home: m.home, away: m.away,
          model_h: r1(ai.h), model_x: r1(ai.x), model_a: r1(ai.a),
          elo_h: r1(imp.h), elo_x: r1(imp.x), elo_a: r1(imp.a), blend_w: ws,
          blend_h: r1(ai.h * (1 - ws) + imp.h * ws), blend_x: r1(ai.x * (1 - ws) + imp.x * ws), blend_a: r1(ai.a * (1 - ws) + imp.a * ws),
          odds_h: odds?.home || null, odds_x: odds?.draw || null, odds_a: odds?.away || null
        });
        // live-blend (bouwplan stap 5): alleen als de vlag aan is
        if (ELO_BLEND_W > 0) {
          const w = ELO_BLEND_W;
          ai = { ...ai, h: ai.h * (1 - w) + imp.h * w, x: ai.x * (1 - w) + imp.x * w, a: ai.a * (1 - w) + imp.a * w };
          console.log(`[Elo] blend ${m.home}-${m.away} w=${w} -> h${ai.h.toFixed(1)} x${ai.x.toFixed(1)} a${ai.a.toFixed(1)}`);
        }
      }
    }

    const candidates = [
      // Als geen odds beschikbaar: bereken fair odds uit AI-kansen (geen edge, maar wel analyse)
      { pick: '1', label: `${m.home} wint`, aiKans: ai.h, bookOdds: odds?.home || parseFloat((100/(ai.h*0.9)).toFixed(2)) },
      { pick: 'X', label: 'Gelijkspel',     aiKans: ai.x, bookOdds: odds?.draw || parseFloat((100/(ai.x*0.9)).toFixed(2)) },
      { pick: '2', label: `${m.away} wint`, aiKans: ai.a, bookOdds: odds?.away || parseFloat((100/(ai.a*0.9)).toFixed(2)) },
    ];
    if (ENABLE_GOAL_MARKETS) candidates.push(...buildGoalCandidates(m, ai, odds)); // v173: O/U + BTTS
    if (ENABLE_AH_SHADOW) { const ahRow = buildAhShadowRow(m, ai, odds, today); if (ahRow) ahShadowRows.push(ahRow); } // v205

    const fixtureHistory = todayHistory[m.fixtureId] || {};
    const openingOdds = fixtureHistory.opening || null;

    candidates.forEach(c => {
      if (!c.bookOdds || c.bookOdds <= 1) return;
      // Markeer als sparse als er geen echte bookmaker odds waren
      const hasRealOdds = !!(odds?.home);
      // v125: edge tegen faire consensus; bij sparse (geen consensus) terugval op ruwe implied
      // v173: goal-markten leveren hun eigen 2-weg de-vigde fairImplied mee
      const fairImplied = (c.fairImplied != null) ? c.fairImplied : (fairImpliedFor(odds, c.pick) ?? (impliedProb(c.bookOdds) * 100));
      // v192: goal-markt modelrijen loggen voor accuraatheids-tracking (alle goal-tips, niet enkel value-picks)
      if (marketGroup(c.pick) !== '1X2') {
        goalMmmRows.push({
          fixture_id: m.fixtureId, pick: c.pick,
          poisson_win_pct: Math.round(c.aiKans),
          market_implied_pct: parseFloat(Number(fairImplied).toFixed(1)),
          market_consensus_odds: c.bookOdds,
          league_id: m.leagueId || null,
          match_date: m.matchDate || today,
          home: m.home, away: m.away
        });
      }
      const marketShrink = tournament ? MARKET_SHRINK_TOURNAMENT : MARKET_SHRINK_BASE; // v157
      const value = calculateValue(c.aiKans, fairImplied, c.pick, marketShrink);
      if (value < 3) {
        // v172: schaduw-vangnet — kandidaten onder de value<3-poort tóch loggen als de
        // RUWE divergentie (model - markt, vóór shrink) reëel is. Meet de hele twijfelzone
        // voor de draw-evaluatie. Raakt de echte-pick-selectie NIET (die blijft value>=3).
        const rawDiv = c.aiKans - fairImplied;
        if (rawDiv >= SHADOW_MIN_RAW_DIV && marketGroup(c.pick) === '1X2') { // v173: schaduw alleen voor 1X2 (draw-evaluatie)
          const sReason = c.pick === 'X' ? 'draw' : (c.bookOdds >= LONGSHOT_ODDS ? 'longshot' : 'below_threshold');
          shadowRows.push({ fixture_id: m.fixtureId, pick: c.pick, pick_label: c.label, reason: sReason,
            model_pct: Math.round(c.aiKans), market_pct: parseFloat(fairImplied.toFixed(1)), value_pct: parseFloat(value.toFixed(1)),
            odds: c.bookOdds, sharp_score: sharpSignals?.[m.fixtureId]?.[c.pick]?.sharpScore || 0, confidence: null,
            home: m.home, away: m.away, match_date: m.matchDate || today, match_time: m.matchTime || null });
        }
        return;
      }
      const ev = calcEV(c.aiKans, c.bookOdds);
      const kelly = calcKellyW(c.aiKans, c.bookOdds);

      const openOdds = openingOdds ? openingOdds[c.pick === '1' ? 'home' : c.pick === 'X' ? 'draw' : 'away'] : null;
      const movement = calcOddsMovement(openOdds, c.bookOdds);
      const sharpBoost = sharpSignals?.[m.fixtureId]?.[c.pick];

      // v157: favorite-longshot guardrail — value op underdogs (hoge odds) alleen toelaten
      // als sharp money bevestigt. Voorkomt dat AI-ruis een longshot als 'beste value' opvoert.
      // v161: longshot-guardrail, met uitzondering voor draws waar het model de gelijkspel
      // sterk steunt (aiKans X >= 33%). 2-scan-bevestiging + draw-minValue blijven de remmen.
      const strongDraw = (c.pick === 'X' && c.aiKans >= 33);
      if (marketGroup(c.pick) === '1X2' && c.bookOdds >= LONGSHOT_ODDS && (sharpBoost?.sharpScore || 0) < LONGSHOT_MIN_SHARP && !strongDraw) {
        console.log(`[Scan] Longshot-guard: ${m.home} vs ${m.away} ${c.pick} @${c.bookOdds} — geen sharp-bevestiging (score ${sharpBoost?.sharpScore || 0}), overgeslagen`);
        shadowRows.push({ fixture_id: m.fixtureId, pick: c.pick, pick_label: c.label, reason: 'longshot',
          model_pct: Math.round(c.aiKans), market_pct: parseFloat(fairImplied.toFixed(1)), value_pct: parseFloat(value.toFixed(1)),
          odds: c.bookOdds, sharp_score: sharpBoost?.sharpScore || 0, confidence: null,
          home: m.home, away: m.away, match_date: m.matchDate || today, match_time: m.matchTime || null });
        return;
      }

      // v135: marketSignal incorporeert sharpScore (0-100) direct als gewogen component
      const baseMarketSignal = calcMarketSignal(movement, c.pick);
      const marketSignal = sharpBoost
        ? Math.min(95, baseMarketSignal + Math.round((sharpBoost.sharpScore || 0) * 0.25))
        : baseMarketSignal;

      const spread = Math.max(ai.h, ai.x, ai.a) - Math.min(ai.h, ai.x, ai.a);
      const dataQuality = Math.min(100, 50 + spread);

      const conf = calculateConfidenceV20({
        modelProb:     c.aiKans,     // AI-kans — nu max 10% invloed
        value,
        dataQuality,
        marketSignal,
        leagueId:      m.leagueId,
        odds:          c.bookOdds,
        calibFactor:   leagueCalibration[String(m.leagueId)]?.factor || null,
        pick:          c.pick,
        fairImplied:   fairImplied,  // v144: markt als 40% prior
      });

      // v127: toernooi/landenduel — dunne data, scherpe markt → cap betrouwbaarheid + hogere edge-lat
      if (tournament) {
        conf.final = Math.min(conf.final, 70); // v138: was 60, iets soepeler voor WK
        conf.score = Math.max(1, Math.min(10, Math.round(conf.final / 10)));
      }

      // Strengere drempel voor gelijkspel picks (en voor toernooi/landenduels)
      // v144: league tier drempels — risico leagues hogere lat
      const leagueTier = leagueCalibration[String(m.leagueId)]?.tier || 'neutraal';
      const isRisico = leagueTier === 'risico';
      const isEliteLeague = leagueTier === 'elite';
      const minConf = tournament ? 5 : (isRisico ? 7 : 6);
      const minValue = c.pick === 'X'
        ? (tournament ? 7  : isRisico ? 12 : 9)   // v161: draw-drempel licht verlaagd
        : (tournament ? 6  : isRisico ? 9  : 6);
      if (conf.score < minConf || value < minValue) {
        if (value < minValue && value >= minValue * 0.6) {
          shadowRows.push({ fixture_id: m.fixtureId, pick: c.pick, pick_label: c.label, reason: 'below_threshold',
            model_pct: Math.round(c.aiKans), market_pct: parseFloat(fairImplied.toFixed(1)), value_pct: parseFloat(value.toFixed(1)),
            odds: c.bookOdds, sharp_score: sharpBoost?.sharpScore || 0, confidence: conf.score,
            home: m.home, away: m.away, match_date: m.matchDate || today, match_time: m.matchTime || null });
        }
        return;
      }

      // v140b: gelijkspel pas na 2 opeenvolgende bevestigingen (te wispelturig)
      if (c.pick === 'X') {
        const prevX = existingPicks[`${m.fixtureId}_X`];
        if (!prevX) {
          shadowRows.push({ fixture_id: m.fixtureId, pick: c.pick, pick_label: c.label, reason: 'draw',
            model_pct: Math.round(c.aiKans), market_pct: parseFloat(fairImplied.toFixed(1)), value_pct: parseFloat(value.toFixed(1)),
            odds: c.bookOdds, sharp_score: sharpBoost?.sharpScore || 0, confidence: conf.score,
            home: m.home, away: m.away, match_date: m.matchDate || today, match_time: m.matchTime || null });
          return; // eerste keer gelijkspel: blokkeer, wacht op bevestiging
        }
      }

      const elite = isElitePick({ confidenceFinal: conf.final, value, odds: c.bookOdds, pick: c.pick, poissonUsed: false }); // v138: ook WK-picks kunnen elite zijn

      const pickKey = `${m.fixtureId}_${c.pick}`;
      const existing = existingPicks[pickKey];
      const scanCount = existing ? (existing.scanCount || 1) + 1 : 1;
      const lockLevel = scanCount >= 3 ? 'triple' : scanCount >= 2 ? 'double' : 'single';

      // v140b: CONSISTENCY CHECK — pick-richting mag niet wisselen tenzij odds >10% bewogen
      // v173: alleen binnen dezelfde marktgroep (1X2, O/U-per-lijn, BTTS) — verschillende
      // markten op dezelfde wedstrijd mogen náást elkaar bestaan.
      const cGroup = marketGroup(c.pick);
      const prevFixturePick = Object.values(existingPicks).find(p =>
        p.fixtureId === m.fixtureId && p.status === 'pending' && p.pick !== c.pick && marketGroup(p.pick) === cGroup
      );
      if (prevFixturePick) {
        const oddsShift = prevFixturePick.odds
          ? Math.abs((c.bookOdds - prevFixturePick.odds) / prevFixturePick.odds * 100)
          : 0;
        if (oddsShift < 10) {
          // Odds niet genoeg bewogen — houd bestaande richting, negeer nieuwe
          console.log(`[Scan] Consistency block: ${m.home} vs ${m.away} — ${c.pick} geblokkeerd, bestaande pick ${prevFixturePick.pick} blijft`);
          return;
        }
      }

      if (!existing || value > (existing.value || 0) || scanCount > (existing.scanCount || 0)) {
        newPicks[pickKey] = {
          fixtureId: m.fixtureId,
          home: m.home,
          away: m.away,
          matchName: `${m.home} vs ${m.away}`,
          matchDate: m.matchDate || today,
          matchTime: m.matchTime,
          leagueId: m.leagueId,
          leagueName: m.leagueName,
          pick: c.pick,
          pickLabel: c.label,
          odds: c.bookOdds,
          value: parseFloat(value.toFixed(1)),
          ev,
          kelly,
          fairImplied: parseFloat(fairImplied.toFixed(1)),
          aiKans: Math.round(c.aiKans),
          confidence: conf.score,
          confidenceRaw: conf.raw,
          confidenceFinal: conf.final,
          leagueFactor: conf.leagueFactor,
          bucketFactor: conf.bucketFactor,
          oddsMovement: movement,
          marketSignal,
          elite,
          calibFactor: leagueCalibration[String(m.leagueId)]?.factor || null,
          poissonK1: Math.round(ai.h),
          poissonKX: Math.round(ai.x),
          poissonK2: Math.round(ai.a),
          scanCount,
          lockLevel,
          lastScanAt: new Date().toISOString(),
          firstScanAt: existing?.firstScanAt || new Date().toISOString(),
          status: 'pending',
          score: null,
          processed: false,
          verifiedAt: null,
          source: 'scheduled',
          sharp: !!sharpBoost,
          sharpMove: sharpBoost?.movement || null,
          sharpScore: sharpBoost?.sharpScore || null,
          sharpTier: sharpBoost?.sharpTier || null,
          sharpDivergence: sharpBoost?.divergence || null,
          isSparseData: !hasRealOdds || tournament,  // v127: landenduels altijd sparse (dunne data, ook mét odds)
        };
      }
    });
  });

  // v208: markt-seeds wegschrijven (onbekende teams → begin-Elo uit de markt). Rijpt de Elo voor de blend-fase.
  if (eloSeedRows.length) {
    try { await sb(env, 'team_ratings', 'POST', eloSeedRows, '?on_conflict=team_id'); console.log(`[Elo] ${eloSeedRows.length} team(s) geseed uit de markt`); }
    catch(e) { console.error('[Elo] seed-write fout:', e.message); }
  }

  // v211: schaduw-blend loggen (blended vs ongeblende kans per gerijpt duel) voor v_elo_blend_backtest
  if (eloShadowRows.length) {
    try { await sb(env, 'elo_shadow', 'POST', eloShadowRows, '?on_conflict=fixture_id'); console.log(`[EloShadow] ${eloShadowRows.length} gerijpte duels gelogd`); }
    catch(e) { console.error('[EloShadow] write fout:', e.message); }
  }

  // v166: schaduw-trackrecord — bijna-value picks wegschrijven (upsert op fixture_id,pick)
  let shadowOpgeslagen = 0; // v269: telemetrie -- moet buiten het if-blok leven
  if (shadowRows.length) {
    // v168: 1 schaduw-pick per wedstrijd — houd de sterkste bijna-misser (hoogste value)
    const bestPerFixture = {};
    shadowRows.forEach(r => {
      const cur = bestPerFixture[r.fixture_id];
      if (!cur || (r.value_pct || 0) > (cur.value_pct || 0)) bestPerFixture[r.fixture_id] = r;
    });
    const dedupedShadow = Object.values(bestPerFixture);
    await sb(env, 'shadow_picks', 'POST', dedupedShadow, '?on_conflict=fixture_id');
    shadowOpgeslagen = dedupedShadow.length; // v269
    console.log(`[Scan] ${dedupedShadow.length} schaduw-picks gelogd (1 per wedstrijd)`);
  }

  // v205: AH-schaduwrijen wegschrijven (1 beste lijn per wedstrijd, upsert op fixture_id)
  if (ahShadowRows.length) {
    try {
      await sb(env, 'ah_shadow_picks', 'POST', ahShadowRows, '?on_conflict=fixture_id');
      console.log(`[Scan] ${ahShadowRows.length} AH-schaduwrijen gelogd`);
    } catch(e) { console.error('[Scan] AH-schaduw log fout:', e.message); }
  }

  // v192: goal-markt modelrijen wegschrijven (upsert op fixture_id,pick) voor v_ai_tip_by_market
  if (goalMmmRows.length) {
    try {
      await sb(env, 'model_market_comparison', 'POST', goalMmmRows, '?on_conflict=fixture_id,pick');
      console.log(`[Scan] ${goalMmmRows.length} goal-markt modelrijen gelogd (accuraatheids-tracking)`);
    } catch(e) { console.error('[Scan] goal-mmm log fout:', e.message); }
  }

  // ── v136: PER WEDSTRIJD MAXIMAAL 1 PICK ─────────────────────
  // Tegenstrijdige picks (Canada wint + Bosnia wint) zijn onacceptabel.
  // Houd per fixtureId alleen de pick met de hoogste score: conf × value.
  // Bestaande picks worden alleen vervangen als de nieuwe pick significant beter is.
  const deduplicatedNew = {};
  const newByFixture = {};
  Object.entries(newPicks).forEach(([key, p]) => {
    const fid = p.fixtureId;
    const score = (p.confidenceFinal || 0) * (p.value || 0);
    if (!newByFixture[fid] || score > newByFixture[fid].score) {
      newByFixture[fid] = { key, score };
    }
  });
  // Alleen de winnende pick per fixture opnemen
  Object.values(newByFixture).forEach(({ key }) => {
    deduplicatedNew[key] = newPicks[key];
  });
  const removedCount = Object.keys(newPicks).length - Object.keys(deduplicatedNew).length;
  if (removedCount > 0) console.log(`[Scan] ${removedCount} tegenstrijdige picks verwijderd (1 pick per wedstrijd)`);

  // Vervang bestaande picks voor dezelfde wedstrijd als er een betere nieuwe pick is.
  // v270: DIT DEED NIETS AAN DE DATABASE. `delete cleanedExisting[k]` haalde de pick alleen uit
  // het geheugen, waardoor hij niet opnieuw ge-upsert werd -- maar sbSavePicks doet UITSLUITEND
  // een upsert (on_conflict=id) en verwijdert nooit. De rij bleef dus staan, werd gewoon
  // afgerekend, en de logregel "Verwijder conflicterende bestaande pick" was een onware bewering
  // over de buitenwereld. GEMETEN 17-07: 2 wedstrijden met tegenstrijdige picks (1=win + 2=lose
  // op dezelfde wedstrijd) = 4 van de 21 picks, waarvan er 2 bij voorbaat kansloos waren.
  // v136 ("max 1 pick per wedstrijd") werkte daardoor alleen binnen één scan, nooit tegen wat er
  // al stond.
  // Nu: status 'replaced' i.p.v. verwijderen. Het spoor blijft bestaan (herleidbaar wat het model
  // wilde vervangen), handleGetPicks toont alleen pending/win/lose dus de app ziet hem niet, de
  // settle-functies pakken alleen 'pending' dus hij wordt niet afgerekend, en v_clv_gaps is
  // aangepast naar win/lose zodat hij geen vals CLV-alarm geeft.
  const cleanedExisting = { ...existingPicks };
  const teVervangen = [];
  Object.values(deduplicatedNew).forEach(newPick => {
    const fid = newPick.fixtureId;
    Object.keys(cleanedExisting).forEach(k => {
      if (cleanedExisting[k].fixtureId === fid && cleanedExisting[k].pick !== newPick.pick
          && (cleanedExisting[k].status === 'pending')) {
        console.log(`[Scan] Conflicterende bestaande pick: ${k} (${cleanedExisting[k].pick}) → vervangen door ${newPick.pick}`);
        teVervangen.push(k);
        delete cleanedExisting[k];
      }
    });
  });

  const toSave = { ...cleanedExisting, ...deduplicatedNew };
  const entries = Object.entries(toSave)
    .sort((a, b) => new Date(b[1].lastScanAt || 0) - new Date(a[1].lastScanAt || 0))
    .slice(0, 200);

  await sbSavePicks(Object.fromEntries(entries), env);
  // v119 (R1): Firebase 'picks'-fallback verwijderd (vestigiaal — niet gelezen). Supabase is bron.

  // v270: NA de upsert, anders zou sbSavePicks de status er zo weer overheen schrijven.
  // Per rij een eigen PATCH: het zijn er zelden meer dan een paar, en een in.()-lijst vraagt om
  // quoting van id's als `1591865_U3.5` (punten) -- onnodig risico voor nul winst.
  for (const id of teVervangen) {
    const res = await sb(env, 'picks', 'PATCH', { status: 'replaced', updated_at: new Date().toISOString() },
      `?id=eq.${encodeURIComponent(id)}&status=eq.pending`);
    // Drie uitkomsten, drie verschillende dingen -- ze mogen niet op één hoop:
    //   null        = de call faalde (sb logt de reden). De pick staat er NOG, en rekent dus af.
    //   []          = call gelukt, maar NUL rijen geraakt. Dat betekent iets onverwachts: de pick
    //                 was al niet meer 'pending', of het id klopt niet. "Gelukt" loggen zou hier
    //                 een onware bewering zijn -- precies de fout die v270 repareert.
    //   [rij, ...]  = echt gebeurd.
    if (res === null) {
      console.error(`[Scan] pick ${id} NIET op replaced gezet (call faalde) — hij blijft meetellen`);
    } else if (Array.isArray(res) && res.length === 0) {
      console.warn(`[Scan] pick ${id}: PATCH raakte 0 rijen — niet meer pending of id onbekend. Niets gewijzigd.`);
    } else {
      console.log(`[Scan] pick ${id} op status 'replaced' gezet`);
    }
  }

  // v268: LEES UIT WAT ER IS OPGESLAGEN, NIET UIT DE KANDIDATENLIJST.
  // `newPicks` bevat ALLE kandidaten; `deduplicatedNew` is wat sbSavePicks daadwerkelijk
  // heeft weggeschreven (r3720: max 1 pick per wedstrijd, gekozen op confidenceFinal × value).
  // Tot v267 telden en pushten alle onderstaande regels uit `newPicks`. Twee gevolgen, beide
  // GEMETEN op 17-07 21:00 (France vs England, fixture 1591865):
  //  1) De push koos op `value` ALLEEN, de opslag op `confidenceFinal × value` -> twee criteria,
  //     twee winnaars. Gepusht werd "Minder dan 2.5 goals @ 2.75"; opgeslagen werd U3.5 @ 1.73.
  //     De gebruiker kreeg dus een markt en een quotering te zien die NERGENS bestonden en die
  //     het model bewust had verworpen. Dat is een CIJFERBRON-schending: een bewering over de
  //     buitenwereld zonder bron.
  //  2) newCount telde de verworpen kandidaten mee ("2 picks toegevoegd" bij 1 opgeslagen pick)
  //     en ging via lastPickCount ook de database in -> scan_status.last_pick_count stond
  //     structureel te hoog, en daarmee elke afgeleide telling.
  // Beide sets bestonden al sinds v136; alleen de consument was verkeerd gekozen.
  const opgeslagenNieuw = deduplicatedNew;
  const newCount = Object.keys(opgeslagenNieuw).length;
  const lockCount = Object.values(opgeslagenNieuw).filter(p => p.lockLevel !== 'single').length;
  console.log(`[Scan] Klaar: ${newCount} picks opgeslagen, ${lockCount} locks, ${withoutOdds.length} wedstrijden zonder odds`);

  // v162: reset de dagteller bij een nieuwe dag (deed het hoofdpad niet -> teller liep eindeloos op
  // en blokkeerde /scan-now). Gelijkgetrokken met het geen-wedstrijden-pad.
  const _stNow = await sbGetScanStatus(env);
  const scansToday1 = (_stNow.scanDate !== today) ? 1 : ((_stNow.scansToday || 0) + 1);
  const scanData1 = { lastRun: new Date().toISOString(), scanDate: today,
    lastPickCount: newCount, lastMatchCount: analyseBatch.length,
    lastWithOdds: withOdds.length, lastWithoutOdds: withoutOdds.length,
    scansToday: scansToday1, version: VERSION,
    // v269: alleen voor scan_runs; scan_status negeert deze velden.
    matchesTotal: allMatches.length, removedCount, shadowSaved: shadowOpgeslagen,
    analysisSkipped: analyseSkipped }; // v271
  await sbUpdateScanStatus(scanData1, env);

  const elitePicks = Object.values(opgeslagenNieuw).filter(p => p.elite); // v268
  const lockPicks = Object.values(opgeslagenNieuw).filter(p => p.lockLevel === 'triple' || p.lockLevel === 'double'); // v268
  const pushPicks = elitePicks.length > 0 ? elitePicks : lockPicks;

  if (elitePicks.length > 0) {
    console.log(`[Scan] ${elitePicks.length} elite picks gevonden!`);
  }

  const nowStr = new Date().toLocaleTimeString('nl-NL', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam'
  });

  if (pushPicks.length > 0) {
    const top = pushPicks.sort((a, b) => (b.value || 0) - (a.value || 0))[0];
    // v138: push alleen als wedstrijd binnen 6 uur begint (anders is push te vroeg/nutteloos)
    const kickoffMs = top.matchTime ? new Date(top.matchTime).getTime() : 0;
    const nowMs2 = Date.now();
    const hoursToKickoff = kickoffMs > 0 ? (kickoffMs - nowMs2) / (1000 * 60 * 60) : 99;
    const shouldPush = hoursToKickoff <= 6 && hoursToKickoff >= -1; // max 6u voor, tot 1u na aftrap
    if (shouldPush || top.elite) { // elite picks altijd pushen
      const icon = top.lockLevel === 'triple' ? '🔒🔒🔒' : top.elite ? '⭐' : '🔒🔒';
      const timeTag = hoursToKickoff > 0 ? ` · ${Math.round(hoursToKickoff)}u voor aftrap` : '';
      const title = top.elite
        ? `${icon} Elite pick gevonden!${timeTag}`
        : `${icon} ${top.lockLevel === 'triple' ? 'Triple' : 'Double'} Lock${timeTag}`;
      const body = `${top.matchName} · ${top.pickLabel} @ ${top.odds} · +${Math.round(top.value)}pp value`;
      await sendPushNotification(env, title, body, {
        type: 'value_alert', matchId: String(top.fixtureId),
        pick: top.pick, value: top.value, lockLevel: top.lockLevel,
      });
    } else {
      console.log(`[Push] Pick gevonden maar aftrap nog ${Math.round(hoursToKickoff)}u weg — geen push`);
    }
  } else if (newCount > 0) {
    const valuePicks = Object.values(opgeslagenNieuw).filter(p => (p.value || 0) >= 15 && (p.confidence || 0) >= 7); // v268
    if (valuePicks.length >= 1) {
      const top = valuePicks[0];
      const title = `⚡ ${valuePicks.length} sterke pick${valuePicks.length > 1 ? 's' : ''} — ${nowStr}`;
      const body = `${top.matchName} · ${top.pickLabel} @ ${top.odds} · +${Math.round(top.value)}pp value`;
      await sendPushNotification(env, title, body, {
        type: 'value_alert', matchId: String(top.fixtureId),
        pick: top.pick, value: top.value,
      });
    } else {
      const top2 = Object.values(opgeslagenNieuw).sort((a, b) => (b.value || 0) - (a.value || 0))[0]; // v268
      const title = `🔍 ${nowStr} — ${newCount} pick${newCount > 1 ? 's' : ''} toegevoegd`;
      const body = top2
        ? `${top2.matchName} · ${top2.pickLabel} @ ${top2.odds} · +${Math.round(top2.value)}pp value`
        : `${allMatches.length} wedstr gescand · ${Object.keys(oddsMap || {}).length} met odds`;
      await sendPushNotification(env, title, body, top2
        ? { type: 'scan_done', matchId: String(top2.fixtureId), pick: top2.pick }
        : { type: 'scan_done' });
    }
  } else {
    // Altijd een melding — ook bij 0 picks. v117: aparte alert bij stille AI-mislukking.
    const title = aiFailed ? `⚠️ ${nowStr} — scan zonder AI-analyse` : `⏱ ${nowStr} — scan klaar`;
    const body = aiFailed
      ? `${analyseBatch.length} wedstr mét odds, maar AI gaf geen analyse — check ANTHROPIC_KEY / limiet`
      : `${allMatches.length} wedstr gescand · geen nieuwe picks`;
    // v261: ging naar ALLE abonnees. Beide takken zijn operator-tekst: 'check ANTHROPIC_KEY / limiet'
    // is een instructie aan mij, en '⏱ scan klaar · geen nieuwe picks' vuurde bij ELKE scan zonder
    // picks — bij 12 cron-scans per dag tot 12 pushes per dag per gebruiker, met nul inhoud voor hen.
    // De pick-meldingen hierboven blijven bewust wel naar iedereen gaan: dat is het product.
    await sendPushNotification(env, title, body, { type: aiFailed ? 'ai_error' : 'scan_done' }, { adminOnly: true });
  }
}

// ── Scan test: test automatische scan pipeline — GEEN Firebase write ─────────
// Default: Eliteserien NO (113) + Allsvenskan SE (103), beide seizoen 2026
// Gebruik: /scan-test?token=HMAC&league=113,103
// Geeft volledige verbose output: fixtures, odds, AI, value picks, verdict
async function runScanTest(env, leagueIds = [1, 113, 103], enableGoals = false, maxCap = null) { // 1=WK 2026, 113=Allsvenskan, 103=Eliteserien
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // v250: hier stond een tweede seizoensbron — SEASON_2026 (v113, 'identiek aan client seasonForLeague()')
  // + getSeason(), die de top-5 op 2025 zette terwijl leagueConfig in runScan alles op 2026 heeft staan.
  // Gemeten bij de bron: /leagues?id=39 geeft seizoen 2026 = 2026-08-21 -> 2027-05-30 met current=true,
  // dus leagueConfig had gelijk en deze set was verouderd (2025 = het seizoen dat op 24-05-2026 afliep).
  // Weggehaald i.p.v. bijgewerkt: hij werd nog op precies EEN plek gebruikt, een logregel, dus bijwerken
  // zou de tegenspraak alleen verplaatsen tot de volgende seizoenswissel. De enige echte bron is
  // f.league.season uit de fixture zelf — dat is ook wat fetchOddsForFixtures sinds v243 gebruikt om de
  // (datum, competitie, seizoen)-combinaties te plannen. Zie de logregel na de fixture-fetch hieronder.
  // NB: dit was cosmetisch. Ik meldde eerder dat de scan-test 'mogelijk het verkeerde seizoen test';
  // dat was onjuist — getSeason zat in geen enkele API-call. seasonOf() in runScan (r2802) leeft nog wel
  // in een echte call, maar uitsluitend voor NEXT_LEAGUES, en die verzameling heeft nul overlap met de
  // 19 FASE 2-competities.

  const log = [`[ScanTest] Start — leagues: ${leagueIds.join(', ')}, datum: ${today} + ${tomorrowStr}`];

  // v258: de v140b-gelijkspelregel ("X pas na 2 opeenvolgende bevestigingen") is uit runScan
  // hierheen gekopieerd ZONDER deze declaratie mee te nemen — runScan haalt hem op r~3200.
  // Gevolg: elke gelijkspel-kandidaat die door minConf/minValue kwam, gooide een ReferenceError
  // en liet de scan-test vallen. Onopgemerkt omdat X-kandidaten zeldzaam zijn en de test-leagues
  // (WK/Allsvenskan/Eliteserien) er weinig produceerden. Gevonden met eslint no-undef.
  // Bewust dezelfde bron als productie: de scan-test is waardeloos als hij niet exact hetzelfde
  // gedrag reproduceert. Kost 1 Supabase-call per test-run, geen API-Football-budget.
  const existingPicks = await sbGetPicks(env);

  // ── Stap 1: Fixtures ophalen (vandaag + morgen) ──
  const allFixtures = [];
  const seen = new Set();

  // Internationale leagues: gebruik next=15 ipv date= (geeft betere resultaten)
  const NEXT_LEAGUES_TEST = new Set([10, 5, 6, 29, 36, 113, 103, 119, 129, 253, 71, 239, 292, 98]);

  // v114: 2 globale date-calls + in-code league-filter (zelfde aanpak als productiescan,
  // geen burst meer richting API-Football).
  const leagueSet = new Set(leagueIds);
  const [fxT, fxM] = await Promise.all([
    apif(`/fixtures?date=${today}&timezone=Europe/Amsterdam`, env),
    apif(`/fixtures?date=${tomorrowStr}&timezone=Europe/Amsterdam`, env),
  ]);
  // v251: zelfde onderscheid als in runScan. Aanleiding: de droogloop van 16-07 meldde '0 unieke fixtures
  // gevonden' terwijl dezelfde call een uur eerder 29 gaf -- de call was geweigerd, niet leeg, en dat was
  // aan het antwoord niet te zien. Een testroute die een geweigerde call als 'geen wedstrijden' rapporteert
  // is erger dan geen testroute: hij geeft een geruststellend antwoord op een vraag die hij niet beantwoordt.
  const _tRl = (fxT && fxT.rateLimited ? 1 : 0) + (fxM && fxM.rateLimited ? 1 : 0);
  [...fxT, ...fxM].forEach(f => {
    const id = f.fixture?.id;
    if (id && leagueSet.has(f.league?.id) && !seen.has(id)) { seen.add(id); allFixtures.push(f); }
  });

  if (_tRl) log.push(`[ScanTest] ⚠️ FIXTURES GEWEIGERD: ${_tRl}/2 date-calls rate-limited — onderstaand aantal is een ONDERGRENS, niet 'geen wedstrijden'`);
  log.push(`[ScanTest] ${allFixtures.length} unieke fixtures gevonden${_tRl ? ' (ONVOLLEDIG)' : ''}`);

  // ── Stap 2: Filter — NS/live, binnen tijdvenster ──
  const nowMs = Date.now();
  // scan-test = altijd force mode: alle wedstrijden vandaag+morgen
  const endOfTomorrow = new Date(tomorrowStr + 'T23:59:59').getTime() + 60 * 60 * 1000;

  const allMatches = allFixtures
    .filter(f => {
      const status  = f.fixture?.status?.short;
      const kickoff = f.fixture?.date ? new Date(f.fixture.date).getTime() : 0;
      const isLive  = ['1H','2H','HT','ET','BT','P'].includes(status);
      const isNS    = ['NS','TBD','PST'].includes(status);
      // v158: ondergrens op aftraptijd toegevoegd (zoals auto-scan) — geen NS-matches met aftrap in verleden
      return isLive || (isNS && kickoff > nowMs - 60 * 60 * 1000 && kickoff < endOfTomorrow);
    })
    .map(f => ({
      fixtureId:  f.fixture?.id,
      home:       f.teams?.home?.name  || '?',
      away:       f.teams?.away?.name  || '?',
      homeId:     f.teams?.home?.id || null, // v208
      awayId:     f.teams?.away?.id || null, // v208
      matchDate:  f.fixture?.date?.split('T')[0] || today,
      matchTime:  f.fixture?.date || null,
      leagueId:   f.league?.id,
      leagueSeason: f.league?.season || null, // v243
      leagueName: f.league?.name || '',
      status:     f.fixture?.status?.short || 'NS',
    }))
    .sort((a, b) => new Date(a.matchTime || 0) - new Date(b.matchTime || 0));

  log.push(`[ScanTest] ${allMatches.length} wedstrijden na NS/live filter`);
  // v250: seizoen uit de fixture zelf i.p.v. uit een tweede tabel. Dit is dezelfde bron waarmee
  // fetchOddsForFixtures de (datum, competitie, seizoen)-combinaties plant, dus wat hier staat is exact
  // wat de odds-call straks gebruikt. Een competitie met een LEEG seizoen valt hier meteen op — dat zou
  // betekenen dat de per-competitie-route hem overslaat en hij stil in de datum-bulk belandt.
  const _seizoenen = new Map();
  allMatches.forEach(m => {
    if (!m || !m.leagueId) return;
    const s = _seizoenen.get(m.leagueId) || new Set();
    s.add(m.leagueSeason === null || m.leagueSeason === undefined ? 'ONTBREEKT' : m.leagueSeason);
    _seizoenen.set(m.leagueId, s);
  });
  for (const [lid, s] of _seizoenen) log.push(`[ScanTest] League ${lid} → seizoen ${[...s].join('/')} (uit de fixture)`);

  if (!allMatches.length) {
    const _nowStr = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
    // v260: dit ging naar included_segments ['Total Subscriptions'] — ALLE abonnees. Gemeten in
    // sendPushNotification: zonder opts.adminOnly is dat de default. Een diagnoseknop die ik indruk
    // hoort nooit bij een gebruiker te landen; "🧪 Test OK · Worker actief" is voor mij, niet voor hen.
    // Vuurde alleen op het 0-wedstrijden-pad, dus zeldzaam en daarom nooit opgemerkt.
    const _pushResult = await sendPushNotification(env, `🧪 ${_nowStr} — Test OK`, `Worker actief · geen wedstrijden voor leagues ${leagueIds.join(', ')}`, { type: 'scan_test' }, { adminOnly: true });
    return {
      ok: true, version: VERSION, leagues: leagueIds, today, tomorrow: tomorrowStr,
      matchesFound: 0, withOdds: 0, aiResultsCount: 0,
      picks: [], allMatches: [], log: log.slice(-10),
      fixturesGeweigerd: _tRl,
      verdict: _tRl
        ? `⛔ ONBRUIKBAAR — ${_tRl}/2 date-calls GEWEIGERD (rate-limit). Dit zegt NIETS over het aanbod; opnieuw draaien met een rustige API.`
        : '⚠️ Geen wedstrijden gevonden — push verstuurd naar owner',
      note: '✅ TEST — push verstuurd',
      // v262: _pushResult werd toegekend en nooit gelezen — een dode variabele terwijl er precies in
      // stond wat we moeten weten. OneSignal meldt `recipients`: het aantal toestellen dat de filter
      // raakte. Bij adminOnly is dat het aantal toestellen met tag role=admin. 0 = de tag bestaat niet
      // en de melding is stilletjes nergens geland. `?? null` en niet `|| null`: 0 recipients is een
      // MEETWAARDE (namelijk: niemand), geen ontbrekende data.
      pushRecipients: _pushResult?.recipients ?? null,
      pushId: _pushResult?.id ?? null,
      pushErrors: _pushResult?.errors ?? null,
      pushResult: _pushResult
    };
  }

  // ── Stap 3: Odds ophalen (zelfde functie als productie, incl. Scandinavische bookmaker fallbacks) ──
  const bettable = allMatches.filter(m => !isYouthMatch(m.home, m.away));
  if (bettable.length !== allMatches.length) log.push(`[ScanTest] ${allMatches.length - bettable.length} jeugdwedstrijden (U15-U23) uitgefilterd`);
  // v241: was hardgecodeerd op 10, terwijl productie MAX_AI_ANALYSES_PER_SCAN (24) gebruikt. Een testroute
  // die de productie-batchgrootte niet kan nabootsen, kan batchgrootte-afhankelijke fouten per definitie
  // nooit aantonen -- precies waarom de max_tokens-afkapping uit v240 hier nooit boven water kwam. Nu
  // dezelfde constante, met ?max= om bewust te over-schrijven bij een gerichte test.
  const _testCap = Number.isFinite(maxCap) && maxCap > 0 ? Math.min(maxCap, 40) : MAX_AI_ANALYSES_PER_SCAN;
  const batch = bettable.slice(0, _testCap);
  log.push(`[ScanTest] batchcap ${_testCap} (productie gebruikt ${MAX_AI_ANALYSES_PER_SCAN})`);
  const fixtureIds = batch.map(m => m.fixtureId).filter(Boolean);
  // v248: meet de rate-limits i.p.v. ze af te leiden. Zonder dit is 'geen odds' niet te onderscheiden
  // van 'geweigerd', en dat is exact de blinde vlek waardoor de droogloop van 16-07 (1/24 dekking,
  // terwijl de API odds heeft voor league 3 en 848) niet te duiden was.
  const oddsStats = {};
  const oddsMap = await fetchOddsForFixtures(fixtureIds, env, 60, enableGoals, batch, oddsStats); // v243: per competitie
  log.push(`[ScanTest] Odds: ${Object.keys(oddsMap).length}/${batch.length} fixtures gedekt${enableGoals ? ' (incl. goal-markten)' : ''}`);
  const _rlTot = (oddsStats.rl_competitie || 0) + (oddsStats.rl_bulk || 0) + (oddsStats.rl_fallback || 0) + (oddsStats.rl_goals || 0);
  log.push(`[ScanTest] Odds-pad: ${oddsStats.pad || '?'} · ${oddsStats.calls || 0} calls · ${oddsStats.combinaties_gepland ?? '-'} combinaties gepland`);
  if (_rlTot) {
    log.push(`[ScanTest] ⚠️ RATE-LIMIT: ${_rlTot} calls geweigerd (competitie ${oddsStats.rl_competitie || 0}, bulk ${oddsStats.rl_bulk || 0}, fallback ${oddsStats.rl_fallback || 0}, goals ${oddsStats.rl_goals || 0}) — ontbrekende odds zijn GEWEIGERD, niet afwezig`);
  } else {
    log.push(`[ScanTest] Geen rate-limits — ontbrekende odds bestaan echt niet bij de bron`);
  }
  batch.forEach(m => {
    const o = oddsMap[m.fixtureId];
    log.push(`[ScanTest]   ${m.home} vs ${m.away} (${m.matchDate}) → ${o ? `${o.home}/${o.draw}/${o.away}` : 'geen odds'}`);
  });

  // ── Stap 4: AI analyse (zelfde prompt als productie) ──
  const analyseBatch = batch.filter(m => oddsMap[m.fixtureId]);
  const analyseBatchFull = analyseBatch.length > 0 ? analyseBatch : batch;

  const prompt = `Je bent een kwantitatief voetbal data-analist. Analyseer ELKE wedstrijd op basis van statistische verwachtingen.

KRITISCHE REGELS:
- Baseer kansen op historische doelpuntenpatronen en competitieniveau, NIET op teamnamen of reputatie
- GELIJKSPEL WAARSCHUWING: Gelijkspel komt voor in slechts ~25-28% van alle wedstrijden. Overschat gelijkspelkansen NIET. Wees terughoudend met kansX boven 30%
- Thuisvoordeel is reëel: gemiddeld +5-8% kansverhoging voor thuisteam in Europese competities
- Som van h+x+a moet exact 100 zijn${enableGoals ? '\n- Schat OOK het verwachte aantal doelpunten per team: gh = thuis, ga = uit (realistisch 0.3-3.5, gebaseerd op aanval/verdediging en competitieniveau)' : ''}

WEDSTRIJDEN:
${analyseBatchFull.map((m, i) => {
  const odds = oddsMap[m.fixtureId];
  const oddsStr = odds ? ` | Odds: ${odds.home}/${odds.draw}/${odds.away}` : ' | geen odds';
  return `${i+1}. ${m.home} vs ${m.away} (${m.leagueName}, ${m.matchDate})${oddsStr}`;
}).join('\n')}

Antwoord ALLEEN met een JSON array — geen tekst, geen uitleg:
[{"h":52,"x":26,"a":22,"c":7${enableGoals ? ',"gh":1.6,"ga":1.1' : ''}},...]
Exact ${analyseBatchFull.length} objecten, zelfde volgorde.`;

  let aiResults = [];
  let aiError = null;
  try {
    const aiRes = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        // v240: 512 -> 2048. Bij een volle batch van 24 wedstrijden moet het antwoord 24 JSON-objecten
        // bevatten (met ENABLE_GOAL_MARKETS ook gh/ga), en dat past niet betrouwbaar in 512 tokens.
        // Loopt het antwoord vol, dan is de array niet afgesloten, vindt de regex geen match en blijft
        // aiResults leeg -> zie de skip-fix hieronder. Tot nu toe nooit geraakt omdat het WK 1-4 duels
        // per scan gaf (gemeten: 62 output-tokens gemiddeld over 148 calls); vanaf 20-07 met 19
        // competities zijn volle batches de norm, dus dit was een tijdbom op de competitieswitch.
        // Kost niets: Anthropic rekent af op werkelijke output, max_tokens is enkel een plafond.
        max_tokens: 2048,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const aiData = await aiRes.json();
    await trackAnthropicCost(env, 'scan-test', aiData.usage);
    const text = aiData?.content?.[0]?.text || '[]';
    const matchArr = text.match(/\[[\s\S]*?\]/);
    if (matchArr) {
      aiResults = JSON.parse(matchArr[0]);
      log.push(`[ScanTest] AI: ${aiResults.length} resultaten ontvangen`);
    } else {
      aiError = 'Geen JSON array in AI response: ' + text.substring(0, 120);
      log.push(`[ScanTest] AI FOUT: ${aiError}`);
    }
  } catch(e) {
    aiError = e.message;
    log.push(`[ScanTest] AI FOUT: ${e.message}`);
  }

  // ── Stap 5: Value berekening (zelfde logica als productie, maar geen Firebase write) ──
  const leagueCalibration = await sbGetCalibration(env);
  const picks = [];

  analyseBatchFull.forEach((m, i) => {
    const ai   = aiResults[i]; // v240: geen verzonnen 50/25/25 meer — zie de hoofdscan
    if (!ai || !Number.isFinite(Number(ai.h)) || !Number.isFinite(Number(ai.x)) || !Number.isFinite(Number(ai.a))) return;
    const odds = oddsMap[m.fixtureId] || {};
    const tournament = isTournamentLeague(m.leagueId); // v127

    const candidates1x2 = [
      { pick: '1', label: `${m.home} wint`, aiKans: ai.h, bookOdds: odds.home },
      { pick: 'X', label: 'Gelijkspel',     aiKans: ai.x, bookOdds: odds.draw },
      { pick: '2', label: `${m.away} wint`,  aiKans: ai.a, bookOdds: odds.away },
    ];
    const candidates = enableGoals ? candidates1x2.concat(buildGoalCandidates(m, ai, odds)) : candidates1x2;
    candidates.forEach(c => {
      if (!c.bookOdds || c.bookOdds <= 1) return;
      const fairImplied = (c.fairImplied != null) ? c.fairImplied : (fairImpliedFor(odds, c.pick) ?? (impliedProb(c.bookOdds) * 100));
      const marketShrink = tournament ? MARKET_SHRINK_TOURNAMENT : MARKET_SHRINK_BASE; // v157
      const value = calculateValue(c.aiKans, fairImplied, c.pick, marketShrink);
      if (value < 3) return;
      const ev = calcEV(c.aiKans, c.bookOdds);
      const kelly = calcKellyW(c.aiKans, c.bookOdds);

      const spread      = Math.max(ai.h, ai.x, ai.a) - Math.min(ai.h, ai.x, ai.a);
      const dataQuality = Math.min(100, 50 + spread);
      const conf = calculateConfidenceV20({
        modelProb: c.aiKans, value, dataQuality,
        marketSignal: 50,
        leagueId: m.leagueId,
        odds: c.bookOdds,
        calibFactor: leagueCalibration[String(m.leagueId)]?.factor || null,
        pick: c.pick,
      });

      // v127: toernooi-hardening (zelfde als productie)
      if (tournament) {
        conf.final = Math.min(conf.final, 70); // v138: was 60, iets soepeler voor WK
        conf.score = Math.max(1, Math.min(10, Math.round(conf.final / 10)));
      }

      // v144: league tier drempels — risico leagues hogere lat
      const leagueTier = leagueCalibration[String(m.leagueId)]?.tier || 'neutraal';
      const isRisico = leagueTier === 'risico';
      const isEliteLeague = leagueTier === 'elite';
      const minConf = tournament ? 5 : (isRisico ? 7 : 6);
      const minValue = c.pick === 'X'
        ? (tournament ? 7  : isRisico ? 12 : 9)   // v161: draw-drempel licht verlaagd
        : (tournament ? 6  : isRisico ? 9  : 6);
      if (conf.score < minConf || value < minValue) return;

      // v140b: gelijkspel pas na 2 opeenvolgende bevestigingen (te wispelturig)
      if (c.pick === 'X') {
        const prevX = existingPicks[`${m.fixtureId}_X`];
        if (!prevX) return; // eerste keer gelijkspel: blokkeer, wacht op bevestiging
      }

      picks.push({
        match:      `${m.home} vs ${m.away}`,
        leagueName: m.leagueName,
        matchDate:  m.matchDate,
        pick:       c.pick,
        pickLabel:  c.label,
        marketGroup: marketGroup(c.pick),
        odds:       c.bookOdds,
        value:      parseFloat(value.toFixed(1)),
        ev,
        kelly,
        fairImplied: parseFloat(fairImplied.toFixed(1)),
        aiKans:     Math.round(c.aiKans),
        confidence: conf.score,
        confidenceFinal: conf.final,
        elite:      isElitePick({ confidenceFinal: conf.final, value, odds: c.bookOdds }),
      });
    });
  });

  picks.sort((a, b) => b.value - a.value);

  const strongPicks  = picks.filter(p => p.value >= 5 && p.confidence >= 5);
  const elitePicks   = picks.filter(p => p.elite);
  log.push(`[ScanTest] ${picks.length} value picks (≥3%), ${strongPicks.length} sterk (≥5%), ${elitePicks.length} elite`);

  const verdict = elitePicks.length > 0
    ? `✅ ${elitePicks.length} elite pick(s) — pipeline werkt, klaar voor productie`
    : strongPicks.length > 0
      ? `✅ ${strongPicks.length} sterke picks (≥5% value, conf≥5) — pipeline werkt correct`
      : picks.length > 0
        ? `⚠️ ${picks.length} zwakke picks (≥3%) — odds mogelijk te efficiënt vandaag`
        : Object.keys(oddsMap).length === 0
          ? `⚠️ Geen odds — bookmakers hebben nog geen quotes voor deze wedstrijden`
          : `ℹ️ Geen value gevonden — markt efficiënt vandaag`;

  // v173: diagnose — toont de berekende goal-markten ook als ze de value-poort niet halen.
  let goalsDebug;
  if (enableGoals) {
    const shrink = lid => (isTournamentLeague(lid) ? MARKET_SHRINK_TOURNAMENT : MARKET_SHRINK_BASE);
    goalsDebug = analyseBatchFull.map((m, i) => {
      const ai = aiResults[i]; const odds = oddsMap[m.fixtureId] || {};
      const cand = buildGoalCandidates(m, ai, odds);
      return {
        match: `${m.home} vs ${m.away}`,
        gh: ai?.gh ?? null, ga: ai?.ga ?? null,
        hasOU: !!odds.ou, hasBTTS: !!odds.btts,
        markten: cand.map(c => ({
          pick: c.pick, odds: c.bookOdds, model: c.aiKans, fair: c.fairImplied,
          value: calculateValue(c.aiKans, c.fairImplied, c.pick, shrink(m.leagueId)),
        })),
      };
    });
  }

  return {
    ok:              true,
    version:         VERSION,
    leagues:         leagueIds,
    today,
    tomorrow:        tomorrowStr,
    matchesFound:    allMatches.length,
    matchesAnalysed: analyseBatchFull.length,
    oddsStats,
    withOdds:        Object.keys(oddsMap).length,
    aiResultsCount:  aiResults.length,
    aiError:         aiError || null,
    totalPicks:      picks.length,
    strongPicks:     strongPicks.length,
    elitePicks:      elitePicks.length,
    goalsDebug,
    picks:           picks.slice(0, 15),
    allMatches:      batch.map(m => ({
      fixtureId: m.fixtureId,
      match:     `${m.home} vs ${m.away}`,
      league:    m.leagueName,
      date:      m.matchDate,
      status:    m.status,
      hasOdds:   !!oddsMap[m.fixtureId],
      odds:      oddsMap[m.fixtureId] || null,
    })),
    log,
    verdict,
    note: '⚠️ TEST — geen picks opgeslagen in Firebase',
  };
}

// ── Endpoint: haal picks op voor app ────────────────────
async function handleGetPicks(env) {
  const picks = await sbGetPicks(env);
  const arr = Object.values(picks)
    .filter(p => p.status === 'pending' || p.status === 'win' || p.status === 'lose')
    .sort((a, b) => (b.value || 0) - (a.value || 0));
  return json({ picks: arr, count: arr.length, version: VERSION });
}


// ═══════════════════════════════════════════════════════
// DAGELIJKSE AI TIP
// ═══════════════════════════════════════════════════════

async function generateDailyTip(env) {
  console.log('[DailyTip] Genereren dagelijkse tip...');
  const today = new Date().toISOString().split('T')[0];

  try {
    const existing = await fb(env, 'daily_tip/latest');
    if (existing?.date === today) {
      console.log('[DailyTip] Al een tip voor vandaag:', today);
      return;
    }
  } catch(e) {}

  let picks = [];
  try {
    const picksData = await sbGetPicks(env);
    picks = Object.values(picksData)
      .filter(p =>
        p.status === 'pending' &&
        p.date === today &&
        !p.isSparseData &&
        (p.value || 0) >= 8 &&
        (p.confidence || 0) >= 6 &&
        p.poissonUsed
      )
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, 5);
  } catch(e) {
    console.warn('[DailyTip] Picks ophalen mislukt:', e.message);
  }

  if (!picks.length) {
    const noTip = {
      date: today,
      qualified: false,
      tip: null,
      reason: 'Geen picks die voldoen aan de kwaliteitsdrempel vandaag.',
      generatedAt: new Date().toISOString(),
      version: VERSION
    };
    await sbSaveDailyTip(noTip, env);
    await fb(env, 'daily_tip/latest', 'PUT', noTip); // FB fallback
    console.log('[DailyTip] Geen gekwalificeerde picks vandaag.');
    return noTip;
  }

  const picksText = picks
    .map(p => `- ${p.matchName || '?'}: ${p.pickLabel} @ ${p.odds} (value: +${Math.round(p.value||0)}%, conf: ${p.confidence}/10, Poisson: ${p.poissonUsed ? 'ja' : 'nee'})`)
    .join('\n');

  const prompt = `Je bent een voetbal betting analist. Kies de BESTE pick van de dag.

Selectiecriteria (in volgorde van belang):
1. Hoogste combinatie van value% EN confidence — niet alleen de hoogste value
2. Poisson-onderbouwde picks krijgen voorkeur boven AI-only picks
3. Vermijd gelijkspel (X) tenzij conf ≥8 en value ≥15%
4. Odds tussen 1.60–3.50 zijn betrouwbaarder dan extremen

Gekwalificeerde picks (value ≥8%, conf ≥6/10):
${picksText}

Respond ONLY with valid JSON, no text outside JSON:
{
  "match": "Thuis vs Uit",
  "pick": "1",
  "pickLabel": "Thuis wint",
  "odds": 2.10,
  "value": 15,
  "confidence": 7,
  "markt": "Uitslag",
  "analyse": "2-3 zinnen CONCRETE onderbouwing met specifieke cijfers",
  "tip": "1 zin samenvatting voor de gebruiker",
  "zwakPunt": "1 zin over het grootste risico bij deze pick"
}`;

  let tipData = null;
  try {
    const res = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await res.json();
    await trackAnthropicCost(env, 'daily-tip', data.usage);
    const raw = data.content?.[0]?.text || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    tipData = {
      date: today,
      qualified: true,
      match:      parsed.match,
      pick:       parsed.pick,
      pickLabel:  parsed.pickLabel,
      odds:       parsed.odds,
      value:      parsed.value,
      confidence: parsed.confidence,
      markt:      parsed.markt || 'Uitslag',
      analyse:    parsed.analyse,
      tip:        parsed.tip,
      zwakPunt:   parsed.zwakPunt || null,
      allPicks:   picks.slice(0, 3).map(p => ({
        match: p.matchName, label: p.pickLabel,
        odds: p.odds, value: p.value, confidence: p.confidence
      })),
      generatedAt: new Date().toISOString(),
      version: VERSION
    };
  } catch(e) {
    console.error('[DailyTip] Fout:', e.message);
    const top = picks[0];
    tipData = {
      date: today,
      qualified: true,
      match:      top.matchName || '?',
      pick:       top.pick,
      pickLabel:  top.pickLabel,
      odds:       top.odds,
      value:      top.value,
      confidence: top.confidence,
      markt:      top.markt || 'Uitslag',
      analyse:    `Value pick met ${Math.round(top.value||0)}% positieve verwachte waarde en confidence ${top.confidence}/10.`,
      tip:        `${top.pickLabel} @ ${top.odds}`,
      generatedAt: new Date().toISOString(),
      version: VERSION
    };
  }

  await sbSaveDailyTip(tipData, env);
  await fb(env, 'daily_tip/latest', 'PUT', tipData);
  await fb(env, `daily_tip/archive/${today}`, 'PUT', tipData); // FB fallback
  console.log('[DailyTip] Tip opgeslagen:', tipData.match, tipData.pickLabel);
  return tipData;
}

// ── Daily tip endpoint (/daily-tip) ───────────────────────
async function handleDailyTip(env) {
  try {
    const tip = await fb(env, 'daily_tip/latest');
    if (!tip) return json({ error: 'Geen tip beschikbaar' }, 404);
    return json(tip);
  } catch(e) {
    return json({ error: e.message }, 500);
  }
}

// ── OneSignal push notificatie ────────────────────────────
async function generateOranjeNieuws(env) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      temperature: 0,
      messages: [{
        role: 'user',
        content: `Geef de 5 meest recente nieuwsberichten over het Nederlands Elftal en WK 2026 voorbereiding. 
Vandaag is ${new Date().toLocaleDateString('nl-NL')}.
Geef ALLEEN JSON terug, geen tekst erbuiten:
[{"titel":"...","samenvatting":"2-3 zinnen","bron":"bijv. NOS Sport","datum":"bijv. 2 jun 2026"},...]
Focus op: selectie, blessures, tactiek, wedstrijduitslagen, coach uitspraken.`
      }]
    })
  });
  const data = await response.json();
  await trackAnthropicCost(env, 'oranje-nieuws', data.usage);
  const text = data.content?.[0]?.text || '[]';
  const clean = text.replace(/\`\`\`json|\`\`\`/g, '').trim();
  return JSON.parse(clean);
}

async function keepSupabaseAlive(env) {
  try {
    // Ping Supabase met een simpele query om het project actief te houden
    await sb(env, 'scan_status', 'GET', null, '?select=id&limit=1');
    console.log('[Keepalive] Supabase ping OK');
  } catch(e) {
    console.warn('[Keepalive] Supabase ping mislukt:', e.message);
  }
}

// ── VVV-nieuws ophalen (v253: uit de /vvv-news-handler getild) ───────────
// Ongewijzigde logica; alleen verplaatst zodat ZOWEL het endpoint als de cron-check
// dezelfde bronnen, parser en ontdubbeling gebruiken. Een tweede kopie zou onvermijdelijk
// gaan afwijken van wat de tab toont.
async function fetchVvvNews() {
  // v234: TWEE BRONNEN. De officiele clubsite publiceert weinig en traag; Venlonaren.net is een
  // supportersplatform dat dagelijks over VVV schrijft en een echte RSS-feed aanbiedt (/feed/,
  // robots.txt staat alles toe behalve /wp-admin/). We nemen UITSLUITEND kop + datum + link over,
  // nooit de artikeltekst -- de feed levert weliswaar content:encoded (volledig artikel), maar dat
  // overnemen zou hun werk herpubliceren en het verkeer bij hen weghalen. Tikken opent de bron.
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
  const decode = (x) => x.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#8217;|&#039;|&#39;/g, "'").replace(/&#8216;/g, "'")
    .replace(/&#8220;|&#8221;|&quot;/g, '"').replace(/&#8211;|&#8212;/g, '-')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').trim();

  // Bron 1 -- officiele clubsite (HTML, ongewijzigd t.o.v. v233).
  const bronOfficieel = async () => {
    const r = await fetch('https://www.vvv-venlo.nl/nieuws', {
      redirect: 'follow',
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'nl-NL,nl;q=0.9' },
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const html = await r.text();
    const out = [];
    const seen = new Set();
    const re = /<a[^>]*href="(\/nieuws\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html)) !== null && out.length < 20) {
      const slug = m[1];
      if (seen.has(slug)) continue;
      let txt = decode(m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      if (!txt || txt.length < 9) continue;
      let pubDate = '';
      const dm = txt.match(/(\d{2})-(\d{2})-(\d{4})\s*$/);
      if (dm) {
        pubDate = dm[3] + '-' + dm[2] + '-' + dm[1];
        txt = txt.slice(0, dm.index).trim();
      }
      if (!txt || txt.length < 9) continue;
      seen.add(slug);
      out.push({ title: txt, link: 'https://www.vvv-venlo.nl' + slug, pubDate, source: 'VVV-Venlo' });
    }
    return out;
  };

  // Bron 2 -- Venlonaren.net RSS.
  const bronVenlonaren = async () => {
    const r = await fetch('https://www.venlonaren.net/feed/', {
      redirect: 'follow',
      headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml,application/xml', 'Accept-Language': 'nl-NL,nl;q=0.9' },
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const xml = await r.text();
    const tag = (b, t) => {
      const m = b.match(new RegExp('<' + t + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + t + '>'));
      return m ? decode(m[1]) : '';
    };
    const out = [];
    for (const raw of xml.split('<item>').slice(1)) {
      const b = raw.split('</item>')[0];
      const title = tag(b, 'title');
      const link = tag(b, 'link');
      if (!title || !link) continue;
      let pubDate = '';
      const d = new Date(tag(b, 'pubDate'));
      if (!isNaN(d.getTime())) pubDate = d.toISOString();
      out.push({ title, link, pubDate, source: 'Venlonaren' });
      if (out.length >= 15) break;
    }
    return out;
  };

  // v236: GEEN Google News-bron. In v235 als derde bron toegevoegd en IN PRODUCTIE gemeten:
  // sources gaf {'GoogleNews': 'fout: HTTP 503'} -- Google blokkeert Cloudflare-Worker-IP's nog
  // steeds, precies zoals v233 al vaststelde. Twee onafhankelijke bevestigingen; dit is beleid,
  // geen hapering. Een bron die gegarandeerd faalt kost per cache-miss een subrequest en vertraagt
  // de respons, dus eruit. Niet opnieuw proberen zonder eerst een 200 vanaf een Worker aan te tonen.
  // Inhoudelijk zou het bovendien Robs vraag niet oplossen: gemeten 0 items van Voetbalprimeur en
  // Voetbalzone in die feed; het voegde alleen regionale media toe (L1, Omroep Venlo, De Limburger).
  const res = await Promise.allSettled([bronOfficieel(), bronVenlonaren()]);
  const namen = ['VVV-Venlo', 'Venlonaren'];
  const bronnen = {};
  let items = [];
  res.forEach((r, i) => {
    if (r.status === 'fulfilled') { bronnen[namen[i]] = r.value.length; items = items.concat(r.value); }
    else { bronnen[namen[i]] = 'fout: ' + (r.reason && r.reason.message ? r.reason.message : 'onbekend'); }
  });
  // Ontdubbelen op link, daarna nieuwste eerst. Items zonder datum achteraan i.p.v. bovenaan:
  // een lege datum mag geen vers nieuws voorwenden.
  const gezien = new Set();
  items = items.filter(it => { if (gezien.has(it.link)) return false; gezien.add(it.link); return true; });
  items.sort((a, b) => {
    const ta = a.pubDate ? Date.parse(a.pubDate) : -Infinity;
    const tb = b.pubDate ? Date.parse(b.pubDate) : -Infinity;
    return tb - ta;
  });
  items = items.slice(0, 24);
  return { items, sources: bronnen };
}

// ── v253: melding bij nieuw VVV-Venlo-nieuws (ADMIN-ONLY) ────────────────
// Tot v252 was /vvv-news puur pull: de tab haalde de bronnen op zodra je hem opende en
// er werd niets bewaard, dus "nieuw sinds vorige keer" bestond niet en er was niets dat
// een push kon afvuren. Deze check draait op de cron, ontdubbelt tegen vvv_news_seen
// (link = enige stabiele sleutel; pub_date ontbreekt in de clubsite-bron regelmatig) en
// pusht alleen naar tag role=admin. Kost geen enkele API-Football-call.
// UITSLUITEND kop + bron + link — geen AI-samenvatting: nieuws mag net zomin verzonnen
// worden als een kans (CIJFERBRON). Raakt model/picks/CLV NIET.
const VVV_NEWS_PUSH_CAP = 2;   // meer dan dit -> één samenvattende melding i.p.v. losse
const VVV_NEWS_BURST    = 6;   // meer dan dit in één uur -> vrijwel zeker brongewijziging

async function checkVvvNews(env) {
  const { items, sources } = await fetchVvvNews();

  // Beide bronnen stuk = GEEN uitspraak doen. Een lege lijst door een 503 (de clubsite gaf
  // die eerder vanaf Cloudflare-IP's, zie v233) leest anders als "niets nieuws", en zodra de
  // bron terugkomt als "alles nieuw". Zelfde familie als v251: een geweigerde call mag niet
  // op 'geen data' lijken.
  const gelukt = Object.values(sources).filter(v => typeof v === 'number').length;
  if (!gelukt) { console.warn('[VVVNews] alle bronnen stuk, run overgeslagen:', JSON.stringify(sources)); return; }
  if (!items.length) return;

  // sb() geeft null bij een FOUT en [] bij 'geen rijen'. Die twee moeten uit elkaar: een
  // mislukte lookup zou als "nog nooit iets gezien" lezen en de hele feed pushen.
  const bekendRows = await sb(env, 'vvv_news_seen', 'GET', null, '?select=link&limit=500');
  if (bekendRows === null) { console.warn('[VVVNews] seen-lookup MISLUKT — geen push deze run'); return; }
  const bekend = new Set(bekendRows.map(r => r.link));

  const nieuw = items.filter(it => it.link && !bekend.has(it.link));
  if (!nieuw.length) return;

  const rows = nieuw.map(it => ({
    link: it.link, title: it.title, source: it.source,
    pub_date: it.pubDate || null, notified: true,
  }));

  // SEED-RUN: eerste vulling alles als gezien wegschrijven zonder melding, anders krijg je
  // 24 pushes in één klap.
  if (!bekend.size) {
    rows.forEach(r => { r.notified = false; });
    const ok = await sb(env, 'vvv_news_seen', 'POST', rows, '?on_conflict=link');
    console.log('[VVVNews] seed-run:', ok ? rows.length : 0, 'items gemarkeerd als gezien, geen push');
    return;
  }

  // BURST-GUARD: de bronnen zijn scrapers. Wijzigt de URL-vorm, dan is ALLES ineens "nieuw".
  // Dat is geen nieuws maar een defect, en het verschil is van buitenaf niet te zien — dus
  // wegschrijven, en één eerlijke waarschuwing i.p.v. een stortvloed of stilte.
  if (nieuw.length > VVV_NEWS_BURST) {
    await sb(env, 'vvv_news_seen', 'POST', rows, '?on_conflict=link');
    await sendPushNotification(env, '⚠ VVV-nieuws: bron mogelijk gewijzigd',
      `${nieuw.length} items in één run als nieuw gezien — controleer de scraper.`,
      {}, { adminOnly: true, url: 'https://promatchxi.app/#vvv' });
    console.warn('[VVVNews] BURST', nieuw.length, 'items — bron mogelijk gewijzigd');
    return;
  }

  // Eerst wegschrijven, dan pushen: mislukt de insert, dan zou de volgende run dezelfde
  // items opnieuw melden. Liever een gemiste melding (gelogd) dan een meldingslus.
  const geschreven = await sb(env, 'vvv_news_seen', 'POST', rows, '?on_conflict=link');
  if (!geschreven) { console.warn('[VVVNews] insert mislukt — geen push (voorkomt herhaling)'); return; }

  if (nieuw.length <= VVV_NEWS_PUSH_CAP) {
    for (const it of nieuw) {
      await sendPushNotification(env, '📰 VVV-Venlo', `${it.title} · ${it.source}`,
        {}, { adminOnly: true, url: it.link });
    }
  } else {
    const top = nieuw[0];
    await sendPushNotification(env, `📰 ${nieuw.length} nieuwe VVV-berichten`,
      `${top.title} · ${top.source}`, {}, { adminOnly: true, url: 'https://promatchxi.app/#vvv' });
  }
  console.log('[VVVNews]', nieuw.length, 'nieuw item(s) gemeld');
}

async function sendPushNotification(env, title, body, data = {}, opts = {}) {
  const appId  = env.ONESIGNAL_APP_ID;
  const apiKey = env.ONESIGNAL_API_KEY;
  if (!appId || !apiKey) {
    console.log('[Push] OneSignal keys niet geconfigureerd, skip');
    return;
  }
  try {
    // v227: targeting-splitsing.
    //  - adminOnly=true → alleen toestellen met tag role=admin (jij). Nieuwe
    //    gebruikers hebben die tag niet en ontvangen deze meldingen dus nooit.
    //  - anders          → alle subscribers (pick-meldingen voor iedereen).
    let targeting;
    if (opts.adminOnly) {
      targeting = { filters: [{ field: 'tag', key: 'role', relation: '=', value: 'admin' }] };
      console.log('[Push] admin-only targeting (tag role=admin)');
    } else {
      targeting = { included_segments: ['Total Subscriptions'] };
    }

    const payload = {
      app_id: appId,
      ...targeting,
      headings:  { en: title, nl: title },
      contents:  { en: body,  nl: body  },
      data,
      chrome_web_icon: 'https://promatchxi.app/icon-192.png',
      ttl:      3600,
      priority: 10,
    };
    // v126: deep-link naar de juiste pick in de scan-log bij klik op de melding
    if (data && data.matchId) payload.url = `https://promatchxi.app/#pick=${data.matchId}`;
    // v253: expliciete doel-URL (nieuwsmelding linkt naar het originele artikel bij de bron).
    // Staat NA de matchId-regel zodat een meegegeven url wint; de twee sluiten elkaar in de
    // praktijk uit (een pick heeft geen artikel-link).
    if (opts.url) payload.url = opts.url;
    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    console.log('[Push] Verstuurd naar', opts.adminOnly ? 'admin' : 'all subscribers', '—', result.id || JSON.stringify(result.errors));
    return result;
  } catch(e) {
    console.error('[Push] Fout:', e.message);
    return { error: e.message };
  }
}

// ── Endpoint: /push — stuur push vanuit app ──────────────
async function handlePush(request, env) {
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405);
  try {
    const body = await request.json();
    const { title, body: msgBody, data } = body;
    if (!title || !msgBody) return json({ error: 'title en body verplicht' }, 400);
    await sendPushNotification(env, title, msgBody, data || {});
    return json({ ok: true });
  } catch(e) {
    return json({ error: e.message }, 500);
  }
}

// ── User costs endpoint (/user-costs) ───────────────────
async function handleUserCosts(request, env) {
  const url = new URL(request.url);
  const uid = url.searchParams.get('uid');
  if (!uid) return json({ error: 'uid verplicht' }, 400);

  if (request.method === 'GET') {
    const rows = await sb(env, 'user_costs', 'GET', null, `?uid=eq.${uid}&select=*`);
    if (!rows || !rows.length) return json(null);
    const r = rows[0];
    return json({
      calls: r.calls, tokensIn: r.tokens_in, tokensOut: r.tokens_out,
      totalUSD: parseFloat(r.total_usd), lastUpdated: r.last_updated
    });
  }

  if (request.method === 'POST') {
    const body = await request.json();
    await sb(env, 'user_costs', 'POST', [{
      uid,
      calls: body.calls || 0,
      tokens_in: body.tokensIn || 0,
      tokens_out: body.tokensOut || 0,
      total_usd: body.totalUSD || 0,
      last_updated: body.lastUpdated || new Date().toISOString(),
    }], '?on_conflict=uid');
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}

// ── Main fetch handler ───────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    if (path.startsWith('/apif/') || path.startsWith('/apif?')) {
      const apiPath = path.replace('/apif', '') + (url.search || '');
      const bypassCache = url.searchParams.has('_cb');
      return handleAPIFootball(apiPath, env, bypassCache);
    }

    if (path.startsWith('/fd/') || path.startsWith('/fd?')) {
      const fdPath = path.replace('/fd', '') + (url.search || '');
      return handleFD(fdPath, env);
    }

    if (path === '/anthropic') {
      return handleAnthropic(request, env);
    }

    if (path === '/settle') {
      const _a = await requireAdmin(request, env, url, false); // v259: HMAC OF owner-ID-token
      if (!_a.ok) return json({ error: 'Unauthorized', reason: _a.reason }, _a.status ?? 401);
      // v230: sweep EERST — de automatische /settle deed zoveel settle-werk dat de Elo-sweep (voorheen
      // laatste stap) door de Cloudflare CPU-tijdlimiet werd afgekapt vóór markEloSweep: marker bevroor
      // zonder JS-fout (worker beëindigd, geen catch). Handmatig werkte 't wel (weinig te settelen). Nu
      // draait de lichte sweep eerst en advanced de marker gegarandeerd; het zware settle-werk komt daarna.
      try { await sweepEloFromResults(env); } catch(e) { console.error('[EloSweep] fout:', e.message); } // v209: Elo uit alle afgeronde wedstrijden
      await verifyYesterdayPicks(env);
      await settleShadowPicks(env);
      try { await settleAhShadow(env); } catch(e) { console.error('[Settle] AH-shadow fout:', e.message); } // v205
      return json({ status: 'settlement klaar', version: VERSION });
    }

    // v163: health-overzicht in één call — versie, laatste scan, picks, CLV, snapshot-dichtheid + warnings
    // v221: in-app melding van AI-gegenereerde analyses. Google Play's AI-Generated Content-policy
    // eist dat gebruikers aanstootgevende AI-output kunnen rapporteren ZONDER de app te verlaten.
    if (path === '/report' && request.method === 'POST') {
      try {
        const b = await request.json().catch(() => ({}));
        const clip = (v, n) => (v == null ? null : String(v).slice(0, n));
        const reason = clip(b.reason, 80);
        if (!reason) return json({ ok: false, error: 'reason ontbreekt' }, 400);
        await sb(env, 'content_reports', 'POST', [{
          fixture_id: Number.isFinite(Number(b.fixture_id)) ? Number(b.fixture_id) : null,
          match_name: clip(b.match_name, 200),
          reason,
          details: clip(b.details, 2000),
          app_version: clip(b.app_version, 40),
          user_agent: clip(request.headers.get('user-agent'), 300),
        }]);
        return json({ ok: true, worker_version: VERSION });
      } catch(e) {
        return json({ ok: false, error: e.message, worker_version: VERSION }, 500);
      }
    }

    // v226: de app toonde als "value" het RUWE model-markt-verschil, terwijl de selectie beslist op de
    // waarde NA shrinkage naar de markt-prior (+ 0.88 gelijkspel-straf). Verschilfactor ~2.7 (Spain-Belgium:
    // 4.8pp ruw -> 1.8pp opgeslagen). Drie grootheden heetten "value" op een scherm. Deze endpoint levert de
    // parameters zodat de frontend met DEZELFDE formule rekent i.p.v. de constanten te dupliceren (drift-risico
    // zodra autotune s1/s2 bijstelt).
    if (path === '/model-params') {
      return json({
        worker_version: VERSION,
        shrink: { base: MARKET_SHRINK_BASE, tournament: MARKET_SHRINK_TOURNAMENT },
        tune: { s1: TUNE.s1, s2: TUNE.s2 },   // extra shrink bij modelkans <20% resp. 20-35% (alleen 1X2)
        drawPenalty: 0.88,
        tournamentLeagues: [...TOURNAMENT_LEAGUES],
        minValue: { tournament: { X: 7, other: 6 }, base: { X: 9, other: 6 }, risico: { X: 12, other: 9 } },
        longshotOdds: LONGSHOT_ODDS,
      });
    }

    // v231: VVV-Venlo clubnieuws voor het nieuwe VVV-tabblad (verving WK 2026).
    // Proxiet Google News RSS (CORS-gesloten voor de browser) en parseert naar JSON.
    // GEEN verzonnen inhoud: elk item is een echte kop met bron + datum + link naar het
    // originele artikel bij externe media. Kort gecacht (15 min) om de bron te ontlasten.
    // v233: clubnieuws direct van de OFFICIËLE VVV-Venlo-nieuwspagina (Google News gaf 503 vanuit
    // Cloudflare-IP's). Elke nieuwslink bevat titel + datum; we parsen die en linken naar het echte
    // artikel op vvv-venlo.nl. Officiële bron = betrouwbaarder en relevanter dan een aggregator.
    // Niets verzonnen. 15 min cache.
    if (path === '/vvv-news') {
      // v253: logica staat in fetchVvvNews() zodat de cron-push exact dezelfde items ziet.
      const { items, sources: bronnen } = await fetchVvvNews();
      return new Response(JSON.stringify({ items, count: items.length, sources: bronnen }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=900', ...CORS },
      });
    }

    if (path === '/health') {
      try {
        const rows = await sb(env, 'v_health', 'GET', null, '?limit=1');
        const h = rows?.[0] || {};
        const warnings = [];
        const hour = new Date().getUTCHours();
        // v183: waarschuwen tijdens werkelijke scan-uren (cron: 06 + 12-22 UTC) — gelijkgetrokken
        // met het echte fullScan-venster (was 12-16, miste avond-aftrappen 17-21 UTC post-WK).
        // Buiten die uren zijn er geen scans gepland → geen valse "scan_verouderd" 's nachts.
        const activeHours = hour >= 6 && hour <= 22; // v266: gelijk aan het echte cron-venster in scheduled()
        if (activeHours && (h.last_scan_min_ago == null || h.last_scan_min_ago > 75)) warnings.push('scan_verouderd');
        // v237: versie_mismatch alarmeert pas als een scan de nieuwe code ECHT heeft overgeslagen.
        // De check bedoelt "worker gedeployd maar de scan draait nog oude code". Direct na een deploy
        // is een mismatch echter volstrekt normaal: de vorige scan liep nu eenmaal onder de vorige
        // versie. Toch zette hij ok=false, dus elke worker-deploy maakte de health-monitor rood tot de
        // volgende volledige scan -- en na 22:00 UTC draait die pas om 06:00, dus dan 7+ uur rood en
        // een nacht vals alarm (waargenomen: run #54 na de v235/v236-deploys van 14-07). Een vangnet dat
        // op eigen deploys afgaat wordt genegeerd; zelfde alarmmoeheid als clv_gaps in v224.
        // Precieze test: is er SINDS deze workerversie al een volledige scan geweest? Zo ja en die
        // rapporteert nog de oude versie -> de deploy is niet doorgekomen -> echt alarm. Zo nee -> we
        // wachten gewoon; wel zichtbaar in het antwoord, maar geen ok=false.
        let versieInfo = null;
        if ((h.scan_version || '') !== VERSION) {
          let sinds = null;
          try {
            const vs = await sb(env, 'model_config', 'GET', null, '?config_key=eq.worker_version_seen&select=note,updated_at&limit=1');
            const row = vs?.[0];
            if (row && row.note === VERSION) {
              sinds = row.updated_at;                 // deze versie al eerder gezien: dat moment telt
            } else {
              const nowIso = new Date().toISOString(); // nieuwe versie: nu voor het eerst gezien
              await sb(env, 'model_config', 'POST', { config_key: 'worker_version_seen', config_value: 0, note: VERSION, updated_at: nowIso }, '?on_conflict=config_key');
              sinds = nowIso;
            }
          } catch(e) { /* marker onbereikbaar => hieronder terugvallen op waarschuwen */ }
          const scanNaDeploy = !sinds || (h.last_scan && Date.parse(h.last_scan) > Date.parse(sinds));
          if (scanNaDeploy) warnings.push(`versie_mismatch(scan=${h.scan_version},worker=${VERSION})`);
          else versieInfo = `wacht_op_scan(scan=${h.scan_version},worker=${VERSION},sinds=${sinds})`;
        }
        if ((h.scans_today || 0) >= 35) warnings.push('dagcap_bijna'); // v189: gelijkgetrokken met MANUAL_SCAN_DAY_CAP 40
        if (Number(h.avg_snaps_recent || 0) < 2) warnings.push('snapshots_dun');
        // v206: security-vangnet — publieke tabellen zonder RLS worden binnen een dag gemeld
        try {
          const rlsGaps = await sb(env, 'v_rls_audit', 'GET', null, '?select=object_name,issue') || [];
          if (rlsGaps.length) warnings.push('rls_gat(' + rlsGaps.map(r => r.object_name + '/' + r.issue).join(', ') + ')');
        } catch(e) { /* audit-view niet beschikbaar => health niet laten falen */ }
        // v220: data-integriteitsvangnet — afgerekende picks zonder CLV-rij. Dit was tot nu toe alleen
        // met het blote oog te zien (clv_rows < picks_settled). Met 19 competities schaalt dat niet.
        // v224: dismiss-drempel. Een BEWUST opengelaten gat (Mexico-England 06-07: geen closing
        // goal-odds bewaard, dataset blijft eerlijk) zette ok=false en dus de health-monitor elke
        // dag op rood -> alarmmoeheid, precies wat een vangnet waardeloos maakt. Waarschuw alleen
        // boven het bevestigde aantal, zelfde patroon als elo_blend_validated. NIEUWE gaten alarmeren wel.
        let clvGaps = null;
        try {
          const gaps = await sb(env, 'v_clv_gaps', 'GET', null, '?select=id,match_name,pick&limit=20') || [];
          clvGaps = gaps.length;
          const ackRow = await sb(env, 'model_config', 'GET', null, '?config_key=eq.clv_gaps_ack&select=config_value') || [];
          const ack = Number(ackRow?.[0]?.config_value ?? 0);
          if (gaps.length > ack) {
            warnings.push(`settled_zonder_clv(${gaps.length}, bevestigd ${ack}: ${gaps.slice(0, 3).map(g => g.id).join(', ')}${gaps.length > 3 ? ', ...' : ''})`);
          }
        } catch(e) { /* view niet beschikbaar => health niet laten falen */ }
        // v212: Elo-blend validatie-signaal — zodra er genoeg gerijpte schaduw-duels zijn, toont /health
        // de model-vs-blend-cijfers + een waarschuwing die de dagelijkse health-monitor oppikt (proactieve
        // herinnering, agenda-onafhankelijk). Dismiss: model_config.elo_blend_validated=1 of de vlag omhoog.
        let eloBlend = null;
        try {
          const bt = await sb(env, 'v_elo_blend_backtest', 'GET', null, '?limit=1');
          const cfg = await sb(env, 'model_config', 'GET', null, '?config_key=in.(elo_blend_w,elo_blend_validated)&select=config_key,config_value') || [];
          const cmap = {}; cfg.forEach(r => { cmap[r.config_key] = Number(r.config_value); });
          const wNow = cmap.elo_blend_w || 0;
          const validated = (cmap.elo_blend_validated || 0) === 1;
          const b = bt?.[0] || {};
          const n = Number(b.n_duels || 0);
          const ready = n >= ELO_VALIDATE_MIN_N;
          eloBlend = { n_duels: n, brier_model: b.brier_model, brier_blend: b.brier_blend, roi_model_pct: b.roi_model_pct, roi_blend_pct: b.roi_blend_pct, hit_model_fav: b.hit_model_fav, hit_blend_fav: b.hit_blend_fav, elo_blend_w: wNow, ready };
          if (ready && wNow === 0 && !validated) warnings.push(`elo_blend_valideren(n=${n})`);
        } catch(e) { /* backtest-view niet beschikbaar => health niet laten falen */ }

        // v228: Elo-sweep-versheid — sweepEloFromResults bevroor stil sinds 08-07 (dubbele swallow-catch).
        // Warn zodra de marker ouder is dan gisteren (tolereert normale dag-timing) OF de laatste run een
        // fout logde. Vangnet-patroon als clv_gaps/rls_gat; de health-monitor pikt het automatisch op.
        try {
          const es = await sb(env, 'model_config', 'GET', null, '?config_key=in.(elo_last_sweep,elo_sweep_status)&select=config_key,note') || [];
          const emap = {}; es.forEach(r => { emap[r.config_key] = r.note; });
          const nowD = new Date();
          const yD = new Date(nowD); yD.setUTCDate(yD.getUTCDate() - 1);
          const todayStr = nowD.toISOString().slice(0, 10);
          const yestStr = yD.toISOString().slice(0, 10);
          const last = emap.elo_last_sweep || null;
          const st = emap.elo_sweep_status || null;
          if (last && last !== todayStr && last !== yestStr) warnings.push(`elo_sweep_verouderd(last=${last})`);
          if (st && st.indexOf('ERR') === 0) warnings.push(`elo_sweep_fout(${st.slice(5, 64)})`);
        } catch(e) { /* health niet laten falen */ }
        // v243: ODDSDEKKING-VANGNET. De dekking werd al sinds jaar en dag weggeschreven
        // (scan_status.last_with_odds / last_without_odds), maar niemand keek ernaar en v_health geeft
        // het veld niet door -- daarom kon de paginerings-bug (1 van 24 fixtures met odds) onzichtbaar
        // blijven tot ik er per toeval op stuitte. Zonder odds gaat een wedstrijd niet eens de AI-batch
        // in, dus lage dekking = stil minder analyses = 'geen picks', wat er precies uitziet als een
        // efficiente markt. Dat mag niet meer stil kunnen.
        // Drempel bewust laag (<15% bij >=10 wedstrijden): domestic-competities horen 80-100% te halen,
        // maar kwalificatierondes met kleine clubs halen echt maar ~20% (gemeten 15-07: 5/24 op CL/EL/ECL
        // -- Malisheva en Atert Bissen hebben simpelweg geen odds). Een strengere drempel zou daar elke
        // dag vals alarm geven, en een vangnet dat permanent rood staat wordt genegeerd (les uit v224).
        // Het veld is ALTIJD zichtbaar, ook zonder waarschuwing; hertunen zodra er clubdata is.
        let oddsDek = null;
        try {
          const sc = await sb(env, 'scan_status', 'GET', null, '?id=eq.current&select=last_match_count,last_with_odds,last_without_odds&limit=1');
          const r0 = sc?.[0];
          if (r0) {
            const wo = Number(r0.last_with_odds || 0);
            const zo = Number(r0.last_without_odds || 0);
            const tot = wo + zo;
            const pct = tot > 0 ? Math.round((wo / tot) * 100) : null;
            oddsDek = { met_odds: wo, van: tot, pct };
            if (tot >= 10 && pct !== null && pct < 15) warnings.push(`odds_dekking_laag(${wo}/${tot} = ${pct}%)`);
          }
        } catch(e) { /* health niet laten falen op een diagnoseveld */ }

        // v276: api-sports message-fout (bv. 'not subscribed') in de laatste scan wordt een zichtbare
        // warning i.p.v. stil 0 fixtures. api_fouten is een getal als het gemeten is, anders de string
        // 'niet gemeten' -> daarom expliciet typeof number. Status eenmaal berekenen zodat de
        // apif-status niet twee keer wordt opgehaald.
        const apifStatus = await apifProxyStatus(env);
        const _apifFout = apifStatus?.laatste_scan?.api_fouten;
        if (typeof _apifFout === 'number' && _apifFout > 0) warnings.push(`api_fout(${_apifFout})`);

        return json({ ok: warnings.length === 0, status: warnings.length ? 'WARN' : 'OK',
          warnings, versie_info: versieInfo, worker_version: VERSION, ...h, odds_dekking: oddsDek, clv_gaps: clvGaps, elo_blend: eloBlend, apif_proxy: apifStatus, checked_at: new Date().toISOString() });
      } catch(e) {
        return json({ ok: false, status: 'ERROR', error: e.message, worker_version: VERSION }, 500);
      }
    }

    if (path === '/shadow') {
      try {
        const summary = await sb(env, 'v_shadow_performance', 'GET', null, '') || [];
        const picks = await sb(env, 'shadow_picks', 'GET', null,
          '?select=fixture_id,pick,pick_label,reason,model_pct,market_pct,value_pct,odds,sharp_score,confidence,home,away,match_date,status,score&order=match_date.desc,id.desc&limit=60') || [];
        return json({ ok: true, summary, picks, worker_version: VERSION });
      } catch(e) {
        return json({ ok: false, error: e.message, worker_version: VERSION }, 500);
      }
    }

    if (path === '/ah-shadow') {
      // v205: AH-schaduw-trackrecord — samenvatting + laatste rijen voor de app
      try {
        const rows = await sb(env, 'ah_shadow_picks', 'GET', null,
          '?select=fixture_id,home,away,side,line,pick_label,odds,model_pct,raw_model_pct,market_pct,value_pct,match_date,status,profit,score&order=match_date.desc,id.desc&limit=200') || [];
        const settledRows = rows.filter(r => r.status !== 'pending');
        const sum = { n: settledRows.length, win: 0, half_win: 0, push: 0, half_loss: 0, lose: 0, profit: 0 };
        for (const r of settledRows) { if (sum[r.status] != null) sum[r.status]++; sum.profit += Number(r.profit || 0); }
        sum.profit = parseFloat(sum.profit.toFixed(2));
        sum.roi_pct = sum.n ? parseFloat((sum.profit / sum.n * 100).toFixed(1)) : null;
        return json({ ok: true, summary: sum, picks: rows.slice(0, 60), worker_version: VERSION });
      } catch(e) {
        return json({ ok: false, error: e.message, worker_version: VERSION }, 500);
      }
    }

    if (path === '/goal-markets') {
      try {
        const breakdown = await sb(env, 'v_goal_market_performance', 'GET', null, '?select=*') || [];
        return json({ ok: true, breakdown, worker_version: VERSION });
      } catch(e) {
        return json({ ok: false, error: e.message, worker_version: VERSION }, 500);
      }
    }

    if (path === '/autotune') {
      try {
        await loadTuneConfig(env);
        const config = await sb(env, 'model_config', 'GET', null, '?select=*') || [];
        const log = await sb(env, 'calibration_tune_log', 'GET', null, '?select=*&order=run_at.desc&limit=30') || [];
        return json({ ok: true, apply_mode: AUTOTUNE_APPLY, current: TUNE, config, log, worker_version: VERSION });
      } catch(e) {
        return json({ ok: false, error: e.message, worker_version: VERSION }, 500);
      }
    }

    if (path === '/model-tips') {
      // v198: value-pick (hoogste model - markt na de-vig) per aankomende wedstrijd — sluit aan op de value-filosofie
      // en op de losse analyse (die ook value-verankerd is). Voorheen toonde dit de model-favoriet, wat kon botsen met de analyse.
      try {
        const today = new Date().toISOString().split('T')[0];
        const rows = await sb(env, 'model_market_comparison', 'GET', null,
          `?match_date=gte.${today}&won=is.null&pick=in.(1,X,2)&select=fixture_id,pick,poisson_win_pct,market_consensus_odds&limit=4000`) || [];
        const byFix = {};
        for (const r of rows) { const fid = String(r.fixture_id); (byFix[fid] = byFix[fid] || []).push(r); }
        const tips = [];
        for (const fid in byFix) {
          const three = byFix[fid].filter(r => Number(r.market_consensus_odds) > 1 && r.poisson_win_pct != null);
          if (three.length < 2) continue;
          const invSum = three.reduce((a, r) => a + 1 / Number(r.market_consensus_odds), 0);
          // v204: gelijkspel mag nu ook een value-tip zijn, MAAR alleen bij evenwichtige duels (geen dominante favoriet)
          // — zo verschijnen valkuil-draws (opgeblazen gelijkspel in mismatches) niet op de card.
          let maxImplied = 0;
          for (const r of three) { const im = ((1/Number(r.market_consensus_odds))/invSum)*100; if (im>maxImplied) maxImplied=im; }
          const allowDraw = maxImplied < 60;
          let best = null;
          for (const r of three) {
            if (r.pick === 'X' && !allowDraw) continue;          // v204: gelijkspel alleen bij evenwichtige duels
            const implied = ((1 / Number(r.market_consensus_odds)) / invSum) * 100; // de-vig
            if (implied < 15) continue;                          // longshot-guard — extreme underdog is geen value-tip
            const value = Number(r.poisson_win_pct) - implied;
            if (!best || value > best.value) best = { fixture_id: r.fixture_id, pick: r.pick, pct: r.poisson_win_pct, value: Math.round(value * 10) / 10 };
          }
          if (best && best.value > 0) tips.push(best);           // v201: alleen echte positieve value; anders valt de card terug op MARKT
        }
        return json({ ok: true, tips, worker_version: VERSION });
      } catch(e) {
        return json({ ok: false, error: e.message, worker_version: VERSION }, 500);
      }
    }

    if (path === '/ai-accuracy') {
      try {
        const by_market = await sb(env, 'v_ai_tip_by_market', 'GET', null, '?select=*') || [];
        const by_band   = await sb(env, 'v_ai_tip_accuracy',  'GET', null, '?select=*') || [];
        return json({ ok: true, by_market, by_band, worker_version: VERSION });
      } catch(e) {
        return json({ ok: false, error: e.message, worker_version: VERSION }, 500);
      }
    }

    if (path === '/scan') {
      const _a = await requireAdmin(request, env, url, false); // v259: HMAC OF owner-ID-token
      if (!_a.ok) return json({ error: 'Unauthorized', reason: _a.reason }, _a.status ?? 401);
      await runScan(env, true);
      return json({ status: 'scan klaar', version: VERSION });
    }

    // v159: handmatige scan vanuit de app — geen HMAC, maar cooldown (60s) + bestaande daglimiet (8/dag)
    // begrenzen de kosten. Triggert dezelfde runScan als de cron, daarna leest de app /picks.
    if (path === '/scan-now') {
      // v259: hier stond NIETS. Geen token, geen secret, geen header — gemeten in de bron op 17-07:
      // nul auth-treffers in dit blok en geen globale poort ervoor. Iedereen die de URL kende kon
      // scans afvuren: Anthropic-tokens, API-Football-calls, en een push naar ALLE abonnees, tot de
      // dagcap van 40. Dat de cap er staat maakte het begrensd, niet gesloten.
      const _a = await requireAdmin(request, env, url, false);
      if (!_a.ok) return json({ error: 'Unauthorized', reason: _a.reason }, _a.status ?? 401);
      try {
        const today = new Date().toISOString().split('T')[0];
        const st = await sb(env, 'scan_status', 'GET', null, '?id=eq.current&select=last_run,scans_today,scan_date&limit=1');
        const row = st?.[0] || {};
        const last = row.last_run ? new Date(row.last_run).getTime() : 0;
        if (last && Date.now() - last < 60000) {
          return json({ ok: false, reason: 'cooldown', retryAfter: Math.ceil((60000 - (Date.now() - last)) / 1000), version: VERSION });
        }
        // v160: totaal-dagcap (cron + handmatig). Cron raakt deze niet (gaat niet via /scan-now),
        // maar zodra het totaal de cap raakt, weigert /scan-now — begrenst runaway handmatig scannen/kosten.
        const MANUAL_SCAN_DAY_CAP = 40; // v189: cron + handmatig samen (was 25)
        const scansToday = (row.scan_date === today) ? (row.scans_today || 0) : 0;
        if (scansToday >= MANUAL_SCAN_DAY_CAP) {
          return json({ ok: false, reason: 'daglimiet', scansToday, cap: MANUAL_SCAN_DAY_CAP, version: VERSION });
        }
        const result = await runScan(env, true);
        return json({ ok: true, result, version: VERSION });
      } catch(e) {
        return json({ ok: false, error: e.message, version: VERSION }, 500);
      }
    }

    if (path === '/debug-scan') {
      const token = url.searchParams.get('token');
      if (!await verifyHMAC(token, env.SCAN_SECRET)) return json({ error: 'Unauthorized' }, 401);
      const log = [];
      try {
        const schedule = await fb(env, 'scan_schedule');
        log.push({ step: 'scan_schedule', value: schedule });
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        log.push({ step: 'dates', today, tomorrowStr });

        // Test 1 league (MLS vandaag)
        const mlsToday = await apif(`/fixtures?league=253&season=2026&date=${today}&timezone=Europe/Amsterdam`, env);
        log.push({ step: 'mls_today', count: mlsToday?.length, statuses: mlsToday?.map(f => f.fixture?.status?.short) });
        const mlsTomorrow = await apif(`/fixtures?league=253&season=2026&date=${tomorrowStr}&timezone=Europe/Amsterdam`, env);
        log.push({ step: 'mls_tomorrow', count: mlsTomorrow?.length, statuses: mlsTomorrow?.map(f => f.fixture?.status?.short) });

        // Test Brasileirao
        const bra = await apif(`/fixtures?league=71&season=2026&date=${today}&timezone=Europe/Amsterdam`, env);
        log.push({ step: 'brasileirao_today', count: bra?.length, statuses: bra?.map(f => f.fixture?.status?.short) });
        const braTomorrow = await apif(`/fixtures?league=71&season=2026&date=${tomorrowStr}&timezone=Europe/Amsterdam`, env);
        log.push({ step: 'brasileirao_tomorrow', count: braTomorrow?.length, statuses: braTomorrow?.map(f => f.fixture?.status?.short) });

        // Test Argentina
        const arg = await apif(`/fixtures?league=128&season=2026&date=${today}&timezone=Europe/Amsterdam`, env);
        log.push({ step: 'argentina_today', count: arg?.length });
      } catch(e) {
        log.push({ step: 'ERROR', error: e.message });
      }
      return json({ debug: log, version: VERSION });
    }

    if (path === '/check-odds') {
      // Test welke bookmakers odds hebben voor een fixture
      // Gebruik: /check-odds?fixture=1490324
      const fixtureId = url.searchParams.get('fixture');
      if (!fixtureId) return json({ error: 'fixture parameter verplicht' }, 400);
      const BOOKMAKERS = [
        { id: 1,  name: 'Marathonbet' },
        { id: 4,  name: 'Bwin' },
        { id: 6,  name: 'William Hill' },
        { id: 8,  name: 'Bet365' },
        { id: 10, name: 'Unibet' },
        { id: 16, name: 'Betfair' },
        { id: 18, name: 'Pinnacle' },
        { id: 36, name: 'Betsson' },
        { id: 44, name: 'NordicBet' },
        { id: 54, name: 'Betway' },
      ];
      const results = await Promise.all(
        BOOKMAKERS.map(async bm => {
          try {
            const data = await apif(`/odds?fixture=${fixtureId}&bookmaker=${bm.id}&bet=1`, env);
            const bet = data?.[0]?.bookmakers?.[0]?.bets?.find(b => b.id === 1);
            const home = parseFloat(bet?.values?.find(v => v.value === 'Home')?.odd || 0);
            const draw = parseFloat(bet?.values?.find(v => v.value === 'Draw')?.odd || 0);
            const away = parseFloat(bet?.values?.find(v => v.value === 'Away')?.odd || 0);
            const hasOdds = home > 1;
            return { ...bm, hasOdds, odds: hasOdds ? { home, draw, away } : null };
          } catch(e) {
            return { ...bm, hasOdds: false, error: e.message };
          }
        })
      );
      const withOdds = results.filter(r => r.hasOdds);
      return json({ fixture: fixtureId, found: withOdds.length, bookmakers: results, version: VERSION });
    }

    if (path === '/keepalive') {
      try {
        const result = await sb(env, 'clv_results', 'GET', null, '?limit=1&select=id');
        return json({ ok: true, supabase: result !== null ? 'online' : 'geen data', version: VERSION });
      } catch(e) {
        return json({ ok: false, error: e.message }, 500);
      }
    }

    if (path === '/user-costs') {
      return handleUserCosts(request, env);
    }

    if (path === '/picks') {
      if (request.method === 'POST') {
        // Handmatige scan picks opslaan in Supabase (vanuit app)
        try {
          const body = await request.json();
          const picks = Array.isArray(body) ? body : [body];
          if (!picks.length) return json({ ok: false, error: 'Geen picks' });
          const rows = picks.map(p => ({
            id: p.id || `${p.matchDate || 'x'}_${(p.matchName || 'x').replace(/\s/g,'_').replace(/'/g,'')}_${p.pick || '1'}`,
            fixture_id: p.fixtureId || null,
            home: p.home || null, away: p.away || null,
            match_name: p.matchName || null,
            match_date: p.matchDate || null,
            match_time: p.matchTime || null,
            league_id: p.leagueId || null,
            league_name: p.leagueName || null,
            pick: p.pick || null,
            pick_label: p.pickLabel || null,
            odds: p.odds || null,
            value: p.value || null,
            ai_kans: p.aiKans || null,
            confidence: p.confidence || null,
            confidence_final: p.confidenceFinal || null,
            elite: p.elite || false,
            lock_level: p.lockLevel || 'single',
            scan_count: p.scanCount || 1,
            status: p.status || 'pending',
            source: p.source || 'manual_scan',
            first_scan_at: p.firstScanAt || new Date().toISOString(),
            last_scan_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));
          await sb(env, 'picks', 'POST', rows, '?on_conflict=id');
          console.log(`[Picks] ${rows.length} handmatige picks opgeslagen in Supabase`);
          return json({ ok: true, saved: rows.length });
        } catch(e) {
          console.error('[Picks] POST fout:', e.message);
          return json({ ok: false, error: e.message }, 500);
        }
      }
      return handleGetPicks(env);
    }

    if (path === '/daily-tip') {
      return handleDailyTip(env);
    }

    if (path === '/daily-tip/generate') {
      const tip = await generateDailyTip(env);
      return json(tip || { error: 'Genereren mislukt' });
    }

    if (path === '/analytics') {
      return handleAnalytics(env);
    }

    if (path === '/push') {
      // v263: stond WAGENWIJD open. Gemeten 17-07: POST /push met een leeg body gaf 400 ('title en
      // body verplicht'), niet 401 — de route verwerkte dus een anonieme POST en weigerde hem alleen
      // op ontbrekende velden. Met titel en tekst erin had iedereen op internet een melding met vrije
      // tekst op het toestel van ELKE gebruiker kunnen zetten. De worker heeft dit endpoint zelf niet
      // nodig (interne pushes roepen sendPushNotification rechtstreeks aan) en de app gebruikt het
      // sinds v26.314 niet meer. Owner-only i.p.v. verwijderd: sluiten is even veilig en omkeerbaar,
      // en ik weet niet zeker of er geen enkele oude client meer op zit.
      const _a = await requireAdmin(request, env, url, false);
      if (!_a.ok) return json({ error: 'Unauthorized', reason: _a.reason }, _a.status ?? 401);
      return handlePush(request, env);
    }

    // v227: nieuwe registratie → gebruiker opslaan + admin-only push naar Rob
    if (path === '/register-notify' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const uid   = (body.uid   || '').toString().trim();
        const email = (body.email || '').toString().trim().toLowerCase();
        // Backslash-vrije e-mailvalidatie (regex-escapes bleken onbetrouwbaar in de edit/push-keten):
        const at  = email.indexOf('@');
        const dot = email.lastIndexOf('.');
        const emailOk = at > 0
          && dot > at + 1
          && dot < email.length - 1
          && email.indexOf(' ') === -1
          && email.indexOf('@', at + 1) === -1;
        if (!uid || !emailOk) {
          return json({ ok: false, error: 'uid en geldig email vereist' }, 400);
        }
        const nowIso = new Date().toISOString();
        // Upsert op uid: bestaande rij → alleen last_seen bijwerken, geen dubbele push.
        const existing = await sb(env, 'app_users', 'GET', null, `?uid=eq.${encodeURIComponent(uid)}&select=uid`);
        const isNew = !(Array.isArray(existing) && existing.length > 0);
        await sb(env, 'app_users', 'POST',
          [{ uid, email, last_seen: nowIso }],
          '?on_conflict=uid');
        if (isNew) {
          await sendPushNotification(
            env,
            '👤 Nieuwe gebruiker',
            email,
            { type: 'new_user', email },
            { adminOnly: true }
          );
        }
        return json({ ok: true, isNew });
      } catch (e) {
        return json({ ok: false, error: e.message }, 500);
      }
    }

    // v227: admin-lijst van geregistreerde gebruikers (secret-beveiligd)
    if (path === '/app-users') {
      const secret = url.searchParams.get('secret');
      if (!secret || secret !== env.SCAN_SECRET) return json({ error: 'Unauthorized' }, 401);
      const rows = await sb(env, 'app_users', 'GET', null,
        '?select=uid,email,created_at,last_seen,source&order=created_at.desc&limit=1000');
      return json({ ok: true, count: Array.isArray(rows) ? rows.length : 0, users: rows || [] });
    }

    if (path === '/oranje-nieuws') {
    try {
      const nieuws = await generateOranjeNieuws(env);
      return json({ nieuws });
    } catch(e) {
      return json({ nieuws: [], error: e.message });
    }
  }

  if (path === '/scan-test') {
      // Accepteer zowel HMAC token als simpel secret wachtwoord
      // v259: HMAC OF secret (zoals hiervoor) OF owner-ID-token — allowSecret=true houdt het
      // bestaande secret-pad in stand; geen surface erbij.
      const _a = await requireAdmin(request, env, url, true);
      if (!_a.ok) return json({ error: 'Unauthorized', reason: _a.reason }, _a.status ?? 401);
      const leagueParam = url.searchParams.get('league') || '1,113,103'; // 1=WK 2026
      const leagueIds = leagueParam.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
      const enableGoals = url.searchParams.get('goals') === '1'; // v173: O/U + BTTS testen
      const maxCap = parseInt(url.searchParams.get('max') || '', 10); // v241: batchcap overschrijven voor gerichte tests
      const result = await runScanTest(env, leagueIds, enableGoals, Number.isFinite(maxCap) ? maxCap : null);
      return json(result);
    }

    if (url.searchParams.get('url')) {
      return handleProxy(url.searchParams.get('url'), request, env);
    }

    return json({
      version: VERSION,
      status: 'running',
      routes: ['/apif/*', '/fd/*', '/anthropic', '/picks', '/user-costs', '/scan', '/scan-test', '/settle', '/debug-scan', '/check-odds', '/keepalive', '/push', '/daily-tip', '/analytics', '?url=']
    });
  },

  async scheduled(event, env, ctx) {
    const now = new Date();
    const hour = now.getUTCHours();
    const isSunday = now.getUTCDay() === 0;
    ctx.waitUntil((async () => {
      // v266: was `hour === 6 || (hour >= 12 && hour <= 22)` -- een gat van 07:00-11:00 UTC
      // (09:00-13:00 NL) waarin NIETS draaide. GEMETEN 17-07 op echte fixtures: het vaste
      // Eredivisie/KKD-blok van zondag 12:15 NL valt om 10:00 UTC middenin dat gat
      // (Sparta-Feyenoord en MVV-Jong Utrecht, 09-08). Laatste scan ervoor: 06:00 UTC, ruim
      // 4 uur eerder; de volgende pas als de wedstrijd al loopt. Dat kost late waarde EN het
      // maakt de CLV-closing voor die wedstrijden een lijn van 4 uur oud -- geen closing line,
      // en dus vervuiling van juist het cijfer waarop het model beoordeeld wordt.
      // Nu één doorlopend bereik: dat haalt meteen de 'twee betekenissen van dezelfde
      // variabele'-val weg waar de v254-bug uit voortkwam.
      const fullScan = hour >= 6 && hour <= 22;
      if (fullScan) {
        // v239: Elo-sweep OP DE CRON. sweepEloFromResults stond sinds v209 uitsluitend in het
        // /settle-endpoint, en NIETS roept /settle automatisch aan (geen cron-tak, geen workflow —
        // alle vier de workflows nagelopen). De sweep liep dus alleen als iemand hem met de hand
        // aanstootte; de marker stond op 13-07 omdat ik hem toen tijdens het v230-werk zelf triggerde.
        // Gevolg: team_ratings/elo_history rijpen niet, n_duels blijft 0 en de Elo/SoS-blend-validatie
        // van medio oktober kan per definitie nooit slagen. v228 (observability) en v230 (sweep vooraan
        // tegen de CPU-limiet) repareerden een pad dat niet eens gepland stond.
        // Vooraan gezet om dezelfde reden als v230: de sweep is licht (meestal alleen de marker-read),
        // maar runScan is zwaar — draait de sweep erna, dan kapt de CPU-limiet hem af. De functie
        // throttlet zichzelf op 1x/dag via model_config.elo_last_sweep, dus de overige 16 scans van de
        // dag kosten alleen die ene read. Elk uur aanroepen geeft bovendien vanzelf een retry als de
        // 06:00-run faalt. Ontkoppelde catch: een fout hier mag de scan niet blokkeren.
        try { await sweepEloFromResults(env); } catch(e) { console.error('[Cron] EloSweep fout:', e.message); }
        // v170: stappen ontkoppeld — een fout in scan/verify blokkeert de afrekening niet meer
        try { await runScan(env); } catch(e) { console.error('[Cron] runScan fout:', e.message); }
        try { await verifyYesterdayPicks(env); } catch(e) { console.error('[Cron] verify fout:', e.message); }
        try { await settleShadowPicks(env); } catch(e) { console.error('[Cron] settleShadow fout:', e.message); }
        try { await settleAhShadow(env); } catch(e) { console.error('[Cron] settleAhShadow fout:', e.message); } // v205
        try { await settleModelTips(env); } catch(e) { console.error('[Cron] settleModelTips fout:', e.message); }
        try {
          if (hour === 6) await generateDailyTip(env);
          if (hour === 6) await keepSupabaseAlive(env);
          if (hour === 6) await opruimenScanRuns(env); // v269: bewaartermijn 90 dagen
          if (isSunday && hour === 6) await runWeeklyCalibration(env);
          if (isSunday && hour === 6) await autoTuneCalibration(env); // v194: wekelijkse auto-kalibratie (dry-run tot AUTOTUNE_APPLY=true)
        } catch(e) { console.error('[Cron] dagtaken fout:', e.message); }
      } else {
        // v156: cron-gap (23-05 UTC) — alleen odds-snapshots voor late kickoffs (WK Amerika's)
        await snapshotOddsOnly(env);
        await settleShadowPicks(env); // v169: ook in rustige uren afrekenen (ruim subrequest-budget)
        try { await settleAhShadow(env); } catch(e) { console.error('[Cron] settleAhShadow fout:', e.message); } // v205
        try { await settleModelTips(env); } catch(e) { console.error('[Cron] settleModelTips fout:', e.message); }
      }
      // v253: VVV-nieuws-melding (admin-only). BEWUST buiten beide takken en als LAATSTE stap.
      //  - buiten de takken: nieuws verschijnt ook in de cron-gap-uren (23-05 UTC).
      //  - als laatste, precies omgekeerd aan de Elo-sweep (v230/v239): die moest vooraan omdat
      //    hij essentieel is en de CPU-limiet hem anders afkapt. Dit is het tegendeel — een
      //    nieuwsmelding mag nooit een scan verdringen. Kapt de CPU-limiet hem af, dan probeert
      //    het volgende uur opnieuw: de items zijn dan nog steeds onbekend, want er wordt pas
      //    weggeschreven op het moment dat we ook echt melden.
      //  - venster 06-21 UTC = 08:00-23:00 NL: een bericht van 03:00 laat je telefoon niet
      //    trillen maar wordt om 08:00 alsnog gemeld i.p.v. stil verloren te gaan.
      if (hour >= 6 && hour <= 21) {
        try { await checkVvvNews(env); } catch(e) { console.error('[Cron] VVVNews fout:', e.message); }
      }
    })());
  }
};

