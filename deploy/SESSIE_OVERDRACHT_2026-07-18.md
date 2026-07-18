# ProMatchXI — Sessie-overdracht 18-07-2026

**Live versies na deze sessie:** Worker **v274** · Frontend **v26.317** · SW **36.273**

## Gedeployed (chronologisch, allemaal live + geverifieerd via VERSION-constante)

### Worker
- **v271** — force-scan (`/scan-now`) gebruikte een kleiner venster (`endOfDay`) dan de cron; keek
  daardoor 's nachts minder ver vooruit en meldde "0 wedstrijden" op dagen mét wedstrijden. Nu één
  24u-venster voor beide takken; UTC/Amsterdam-tijdzonemix weg. Plus falsy-zero (`|| 0`) uit
  `sbUpdateScanStatus` → gedeelde `_g`-helper (`Number.isFinite ? v : null`).
- **v272** — nieuwe kolom `scan_runs.analysis_skipped` (= `kandidatenAlles − teAnalyseren`).
  Leesregel: `matches_analysed=0` + `analysis_skipped=with_odds` = niets te doen (gezond);
  `analysed=0` + `skipped=0` + `with_odds>0` = verdacht (iets viel stroomopwaarts).
- **v273** — `settleShadowPicks` rekende álle goal-markten fout af (lus kende alleen 1/X/2, dus elke
  O/U/BTTS-pick werd altijd `lose`). Nieuwe `resolveShadowPick`-resolver, 90min-eindstand (consistent
  met AH-tak), onbekende markt → niet afrekenen (pending + warning). 11 fout-afgerekende picks in DB
  gecorrigeerd (lose→win).
- **v274** — `apifChunked`-helper: odds/fixtures-bursts gespreid in chunks van 6 met 350ms gap (was
  tot 36 parallelle calls in één tick). Tegen de IP-burst-throttle van api-sports. 5 plekken
  vervangen (2× odds, 3× /fixtures-settle), volgorde strikt behouden (settle indexeert op `[i]`).

### Frontend
- **v26.315** — dashboard TRACKER-tegel opende de in v26.238 verborgen saldo-wallet; nu de
  tracker-subtab (`setWalletSubTab('tracker')`).
- **v26.316** — Vernieuwen-knop op Analyse-tabblad deed niets (riep hard `renderAnalyticsScreen()`
  aan, die alleen `screen-analytics` vult; inline staat het blok in `analyseAnalytics`). Nu
  parametrische `refreshFn` in `_analyticsHTML`.
- **v26.317** — zichtbaarder laadstatus (spinner) voor STATS & ANALYTICS.

## Volledige ijkslag meetketen
523 afgerekende uitkomsten onafhankelijk nagerekend tegen echte score/formule, **0 fout** na correctie:
- `shadow_picks` 114 (had de bug, gefixt + 11 gecorrigeerd)
- `picks` 19 (was al correct — `settleGoalMarket`)
- `model_market_comparison` 348 (was al correct — `settleGoalMarket`)
- `clv_results` 18 (formule `(our/close − 1) × 100` klopt, waarden −2,91%…+3,33%)
- `ah_shadow_picks` 24 (status + profit, incl. kwart-lijnen)

## Rate-limiting bevinding (belangrijkste les)
De kunstmatige bursttest kon de throttle-drempel **niet** vinden: Cloudflare error 1010 blokkeerde de
externe testclient vóór de proxy. De echte burst-meting kan alleen uit de worker zelf, op een drukke
dag. v274-chunking is de juiste verdediging en staat live; bewijs volgt op 07-08.

## Openstaand / gepland
- **07-08 10:00** (agenda-event + `deploy/v274_burst_validatie.sql`): eerste echte test van
  v274-chunking op volle domestic batch. **Slaagt** als `api_refused` 0 blijft bij >8 fixtures;
  **faalt** → `size` in `apifChunked` van 6 → 4 (of `gapMs` omhoog), dan hermeten.
  NB: de `rl_*`-breakdown (competitie/bulk/fallback/goals) staat NIET in `scan_runs`, alleen in de
  live worker-logs (`runScanTest`); `api_refused` is het persistente totaalsignaal.
- **Niet geïjkt:** CLV closing-line-*capture* (alleen de formule is nagerekend, niet de
  snapshot-timing van `snapshotOddsOnly`).
- **Niet geïjkt:** AH-shadow was tegen data nagerekend (✓), maar de live `settleAhResult`-timing niet.
- **Hetzner-server:** draait alleen de Caddy-proxy, werkt. Beheertoegang kwijt (SSH-poort 22 dicht van
  buiten, private key weg, VNC blanco op mobiel). Rob herstelt later via desktop → Hetzner Cloud
  Console web-terminal. Server-uitbreiding uitgesteld tot toegang hersteld is.
- Ongewijzigde planning: draw-filter-evaluatie eind aug (`draw_evaluatie_augustus.sql`), Elo-blend bij
  ≥40 duels (`v_elo_blend_backtest`), Play Store ~dec 2026 / jan 2027.

## Werkregels (blijven gelden)
- Meet eerst, fix daarna. Nooit gokken. Eerdere foute aanname → intrekken.
- Falsy-zero verboden op numerieke velden (`=== null` / `Number.isFinite`, nooit `x || fallback`).
- Model-wijzigingen dormant achter `model_config`, pas aan na validatie.
- Worker-DoD: `node --check` → versiebump → (geen frontend nodig) → push → live geverifieerd via
  VERSION-constante (niet commit-tekst) → rollback-pad benoemd.
- Frontend-DoD: `APP_VERSION` (state.js) + `SW_VERSION` (sw.js) + cache-bust `?v=` in index.html; push
  via **Git Trees API** (alle bestanden in één commit — voorkomt de v267-deployrace).
- ESLint v9 met repo-config; bestand moet `cloudworker.js` heten.

## Commit-refs voor rollback
- Worker v274: blob `7474cfb` (terug → v273)
- Frontend v26.317: commit `4041e3f` · v26.316 `5cbd94e` · v26.315 `47eeb86`
