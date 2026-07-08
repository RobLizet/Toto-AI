# Security — ProMatchXI

Kort overzicht van de database-beveiliging van de Supabase-backend
(`gtmzznlknmpjcwuyupjv`, eu-north-1) en het ingebouwde vangnet dat een
herhaling van een RLS-gat binnen een dag signaleert.

## Architectuur-uitgangspunt

De frontend praat **niet rechtstreeks** met Supabase voor de interne
model-tabellen. Alles loopt via de Cloudflare Worker (`api.promatchxi.app`),
die de **service_role**-key gebruikt. De anon-key hoeft die interne tabellen
dus nooit te lezen of te schrijven.

Gevolg: interne tabellen krijgen **RLS aan** met **alleen een service_role-policy**.
`anon` en `authenticated` krijgen geen policy en geen table-grants.

> Let op (bekende valkuil): RLS aanzetten **zonder** policy blokkeert ook
> service_role via PostgREST. Zet dus altijd een service_role-policy neer:
> `for all to service_role using (true) with check (true)`.

## Incident (juli 2026) — wat er mis was en de fix

Supabase meldde *"Table publicly accessible"*. Oorzaak: meerdere interne
tabellen waren via de anon-key benaderbaar.

Gedicht (database-only, geen app-deploy):

- **RLS aangezet** op 4 tabellen zonder RLS: `team_ratings`, `elo_history`,
  `model_config`, `calibration_tune_log` — plus service_role-policy en
  `revoke all ... from anon, authenticated`.
- **Policy teruggeschroefd** op 3 tabellen waar de policy per ongeluk op
  `{public}` stond (ondanks de naam `service_role_all`) met `using(true)`:
  `market_consensus`, `model_market_comparison`, `sharp_signal_results`.
  Dit was het stiekemste lek — anon had daar in theorie schrijfrechten.
- **8 SECURITY DEFINER-views** omgezet naar `security_invoker = on`.
- **1 functie** (`increment_user_cost`) een vaste `search_path` gegeven.

Resultaat: de Supabase security-advisor is schoon (0 meldingen).

Controle achteraf op ongeautoriseerde schrijfacties: geen spoor gevonden.
De vier RLS-loze tabellen waren leeg; de tabellen met data hadden uitsluitend
legitieme worker-rijen binnen het normale scan-venster. De tabellen bevatten
bovendien alleen voetbal-modeldata (odds, model-vergelijkingen, Elo) —
geen persoonsgegevens.

## Vangnet — automatische detectie

Om te voorkomen dat zoiets weer maandenlang open blijft staan:

- **View `v_rls_audit`** (`security_invoker = on`, alleen leesbaar door
  service_role) scant de Postgres-catalogus op twee gevaren:
  1. `rls_uit` — een publieke tabel zonder RLS.
  2. `policy_open:<naam>` — een permissive policy op
     `public`/`anon`/`authenticated` met `using(true)` of `with check(true)`.
- **`/health`** (Worker) leest `v_rls_audit` en zet bij een gat een
  waarschuwing `rls_gat(tabel/probleem)`. Elke waarschuwing maakt `/health`
  `ok: false`.
- **health-monitor.yml** (GitHub Actions cron) alarmeert automatisch zodra
  `/health` `ok: false` teruggeeft.

Zo verschijnt een RLS-gat binnen ~24 uur als alarm in plaats van pas na
maanden via een Supabase-mail. Beide varianten zijn end-to-end getest
(gat aangemaakt → `/health` meldde het → opgeruimd → weer schoon).

## Checklist bij een nieuwe tabel

1. `alter table public.<naam> enable row level security;`
2. `create policy <naam>_service_all on public.<naam> for all to service_role using (true) with check (true);`
3. `revoke all on public.<naam> from anon, authenticated;`
4. Alleen als de frontend het écht direct met de anon-key moet lezen: een
   aparte, restrictieve `select`-policy — nooit `using(true)` voor `public`.
5. Controleer: `select * from public.v_rls_audit;` moet leeg blijven.

## Secrets

- Anthropic-, API-Football- en service_role-keys leven uitsluitend in de
  Worker-secrets, nooit in de frontend of de repo.
- De API-Football-proxy (`/apif/`) zorgt dat de client de API-key nooit ziet.
