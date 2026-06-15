# ProMatchXI — Databronnen & pick-flow

> Referentiedoc. Houdt bij welke bron wat voedt, zodat "klopt dit niet?"-verwarring voorkomen wordt.
> Laatst bijgewerkt: v26.120 / worker v154.

## 1. De drie pick-bronnen

| # | Bron | Wat is het | Persistentie |
|---|------|-----------|--------------|
| 1 | **Supabase `picks`-tabel** | Productie-trackrecord — picks van de **worker cron-scan** | Server (primair) |
| 2 | **Lokale `state.scanLog`** | Jouw **handmatige** scans (SCAN VALUE / 3 DAGEN) | Browser (per device) |
| 3 | **Value Picks-tab** | Combinatie: worker `/picks` + lokale scanLog | Samengevoegd in beeld |

## 2. Wat gebruikt welke bron

| Onderdeel | Bron | Filter |
|-----------|------|--------|
| HOME "VOORTGANG NAAR 100 PICKS" | Supabase `/picks` | kwaliteit: value ≥6 & conf ≥5 |
| HOME gem. CLV (regel onder KPI's) | worker `/analytics` → `clvSummary` | — |
| Analyse-tab analytics (KPI's, ROI, uitslagtype, CLV) | Supabase `/picks` + `/analytics` | kwaliteit: value ≥6 & conf ≥5 |
| Insight-modal ("?") | Supabase `/picks` | kwaliteit: value ≥6 & conf ≥5 |
| Picks-overzicht-modal | Supabase `/picks` | kwaliteit: value ≥6 & conf ≥5 |
| LIVE-tab (live scores pending picks) | Supabase `/picks` (pending) | kwaliteit: value ≥6 & conf ≥5 |
| HOME "LAATSTE SCAN" | **lokale scanLog** | laatste scan |
| HOME "BESTE VALUE PICK" | **lokale scanLog** | beste pick laatste scan |
| Value Picks-tab | worker `/picks` + scanLog | pending, value ≥5, geen draws (pick≠X) |

**Regel:** alles wat **trackrecord/statistiek** is = Supabase (kwaliteit 6/5). Alles wat **"wat heb ik net gescand / wat kan ik nu spelen"** is = lokaal + worker gecombineerd. Dat is bewust verschillend, geen bug.

## 3. Drempels (de tune-knoppen)

| Wat | Waarde | Waar |
|-----|--------|------|
| Kwaliteitspick (statistiek) | value ≥6 & conf ≥5 | `DREMPEL` in `analytics.js` én `dashboard.js` |
| Sharp/steam % (client) | `SHARP_PCT = 6` | `wedstrijden.js` |
| Sharp-tier (worker, score 0-100) | `SHARP_TIERS = {elite:75, strong:55, moderate:35, weak:15}` | `cloudworker.js` |
| Odds-pijltjes (▲▼) | ≥2% | `renderOddsArrow` in `wedstrijden.js` |

## 4. CLV-engine

- `odds_snapshots` (append-only, time-series) → views → worker `/analytics` → app.
- Views: `v_clv_summary`, `v_clv_recent`, `v_clv_trend`, `v_clv_per_league`, `v_clv_per_market`, `v_odds_open_close`.
- Zichtbaar in: **HOME-widget** (gem. CLV + % beat close) en **Analyse-tab** (volledige CLV-sectie + trend).
- CLV = jouw odds vs. de slotkoers. Structureel >0% = je verslaat de markt → de sterkste vroege kwaliteitsmeter.

## 5. Worker cron-scan

- **FASE 1** (WK-zomer, t/m 20 jul): **alleen World Cup** (league 1).
- **FASE 2** (vanaf 20 jul): Europees seizoen — automatische seizoenswissel.
- Cron: `0 6 * * *` + `0 12-16 * * *` UTC (08:00 + 14:00–18:00 NL).
- Batch: max 12 wedstrijden/scan (Cloudflare 50-subrequest-limiet).

## 6. Versies

| Component | Constante | Bestand |
|-----------|-----------|---------|
| App | `APP_VERSION` | `state.js` |
| Service worker | `SW_VERSION` | `sw.js` |
| Worker | `VERSION` | `cloudworker.js` |
