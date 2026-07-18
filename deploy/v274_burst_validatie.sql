-- ============================================================================
-- v274 BURST-VALIDATIE  —  draaien op 07-08-2026 (eerste volle domestic batch)
-- ============================================================================
-- CONTEXT: v274 (18-07) spreidt odds/fixtures-calls in chunks van 6 (350ms gap)
-- i.p.v. tot 36 parallelle calls, tegen de IP-burst-throttle van api-sports.
-- Op de zomerdagen (max 8 fixtures) bleef api_refused vanzelf 0 — te weinig om
-- de chunking onder druk te zetten. Vanaf 07-08 (Eredivisie/KKD + top-5 later)
-- lopen er 24+ fixtures per run; dan pas is het een echte test.
--
-- SLAAGT als: geweigerd_totaal = 0 EN geweigerd_piek_run = 0, terwijl
-- max_fixtures_in_run duidelijk > 8 en gem_met_odds meegroeit.
-- FAALT als: api_refused > 0 verschijnt op runs met veel fixtures.
--   -> dan is chunk-grootte 6 nog te groot; verlaag `size` in apifChunked (cw.js)
--      naar 4 of verhoog gapMs, en hermeet. NB: de rl_*-breakdown (competitie/
--      bulk/fallback/goals) staat NIET in scan_runs, alleen in de live worker-logs
--      (runScanTest). api_refused is het persistente totaalsignaal.
-- ============================================================================
select
  run_at::date                            as dag,
  worker_version                          as versie,
  count(*)                                as runs,
  max(matches_total)                      as max_fixtures_in_run,
  round(avg(with_odds)::numeric,1)        as gem_met_odds,
  sum(api_calls)                          as calls_totaal,
  sum(api_refused)                        as geweigerd_totaal,    -- MOET 0 zijn
  max(api_refused)                        as geweigerd_piek_run,  -- MOET 0 zijn
  round(avg(duration_ms)::numeric/1000,1) as gem_duur_sec
from scan_runs
where run_at >= '2026-08-07' and run_at < '2026-08-09'
group by run_at::date, worker_version
order by dag desc, versie desc;
