# ATD-005 — Supabase schema/RLS audit

Date: 2026-09-28. Branch: `codex/ATD-005-supabase-schema-rls-audit`. Application-code baseline: `47fe1ca`; final branch HEAD: `784d6d7` (ATD-002 documentation). Status: audit complete, awaiting review; no remediation started.

## Executive summary

The connected **Exodon Profits** Supabase project matches the project reference in `js/app-config.js`. Read-only catalog inspection establishes actual schema, policy, grant and function evidence beyond ATD-001/002's repository-only findings. The database serves Arowana, Salon and other applications; a blanket schema cleanup would affect unrelated systems.

All inspected base tables in `public`, `arowana` and `salon` have RLS enabled. That is a useful baseline, **not an isolation pass**. The principal findings are conflicting watchlist ownership policies, missing cross-owner account/entity constraints, browser-readable private-key storage, publicly readable configuration/webhook metadata, legacy schema mismatches and shared-project security debt. No user records or stored secrets were read, no attack was executed and no database was modified.

Several controls already exist and should be preserved: owner predicates on journal/portfolio tables, a profile trigger protecting admin and billing fields, restricted usage-writing RPCs, an admin-checked usage summary, and explicit user-token validation inside the sampled Edge Functions. In particular, `verify_jwt=false` on research/billing does not mean those functions are unauthenticated.

## Scope, method and limits

- Required project instructions and ATD-001/002 reports were read before changes. No separate ATD-005 contract exists in the checkout.
- ATD-002's three documentation changes were uncommitted at entry and preserved on branch creation. During the audit, the checkout was externally changed to main after commit `784d6d7` and merge `f45f652`. Final Git verification detected that transition; the audit changes were returned intact to `codex/ATD-005-supabase-schema-rls-audit`. ATD-002 is now committed in the branch base; its report was not edited by this task.
- Local first-party HTML/JS/JSON references were searched for literal and dynamic tables, RPCs, schema headers, auth, Storage and Realtime calls. Comments/stubs are distinguished from executable dependencies.
- Live inspection used the connected Supabase tools: project discovery; catalog-only SELECTs; migration and Edge Function listings; security advisors; source retrieval for three relevant Edge Functions. Only the matching project was queried after discovery.
- Catalog scope: 470 relations across `public` (338), `arowana` (7) and `salon` (125). Detailed policies, column names/types/nullability, grants and constraints were collected for frontend-referenced relations and selected dependencies. Appendix tables preserve scoped metadata, not application rows or credential values.
- The project records 122 migrations. No `.sql` migrations or Edge Function implementations are versioned in this repository. Migration names alone do not reconstruct database history.
- This is a metadata/source audit. No anon/authenticated runtime requests, impersonation, two-user fixtures, inserts/updates/deletes, endpoint invocation, deployments, secret reads, Auth user listing, or production configuration changes were performed. No DEV environment was provisioned.
- SQL inspection did not return a `pgrst.db_schemas` role setting; absence there does not establish the API's exposed-schema configuration. Grants and RLS findings are confirmed database facts; actual Data API reachability still needs configuration evidence and DEV tests.

## Current system and ownership map

| Boundary | Current evidence | Intended rule / migration implication |
|---|---|---|
| Auth and profiles | Supabase Auth session; `public.profiles.id`; `gs_role`, plan/billing fields | Authenticated identity must come from verified JWT. Keep ordinary profile edits separate from role/billing administration. |
| Trading records | `tj_stocks`, `tj_options`, `journal_trades`, `trading_journal`, `option_chains`, `option_roll_chains`, `portfolio` | Private per-user records. Consolidate under explicit contracts; preserve existing IDs and ownership during migration. |
| Accounts | `arowana.entities` and `arowana.financial_accounts`, plus competing `public` names | Account registry explicitly uses `arowana`; never resolve these by unqualified name during migration. Enforce same-owner parent relationships. |
| Watchlists | `public.watchlists` and `watchlist_items` with two ownership paths | One canonical ownership invariant required; current permissive policies accept either path. |
| Shared market data | `daily_setups`, `market_snapshots`; personalized `cc_candidates`/`csp_candidates` | Keep provider/entitlement rules distinct from private user results and server-authoritative data. |
| AI/usage | `ai_briefs`, `ap_usage`, `ai_coach_usage`, `ap_provider_calls`, `ap_roll_coach` | Preserve owner reads and server-only usage writes; distinguish user-authored versus engine-produced results. |
| Credentials | `user_api_keys`; Salon JSON settings and OAuth tables | Owner isolation does not make browser-delivered provider secrets acceptable. Migrate secret handling separately from record authorization. |
| Admin/config | `profiles`, `app_config`; public compatibility views into `arowana.tools/webhooks` | Admin writers, deliberately scoped public metadata, one canonical admin authority. |
| Legacy Salon/finance | `salon.*`, `business_profiles`, `user_preferences`, finance summary views | Shared production boundary. Do not modify or remove these while migrating Arowana without ownership decisions. |

## Findings and recommended disposition

### RLS-01 — P1: watchlist ownership paths combine with OR

**Confirmed metadata defect.** `public.watchlist_items` has seven permissive policies. `watchlist_items_own_rows` permits all operations where the row's `user_id` equals the caller. `items modify via own watchlist` permits all operations when the parent watchlist belongs to the caller. These paths are alternatives, not a requirement that both agree. The table allows nullable `user_id`; its FK checks only `watchlist_id -> watchlists.id`, with cascade delete. There is no non-internal trigger on this table in the inspected catalog.

A caller-owned item can therefore reference another user's known watchlist ID without the ownership predicate rejecting that combination; a parent-owned item can also carry another user's ID. Exact end-to-end impact was not exercised. This creates cross-user visibility/integrity risks through the alternative read/delete rules and parent deletion. Source consumers include `watchlist.html:3372`, `daily-bias.html:515` and `arowana-trader.html:1077`.

**Recommendation:** define a single invariant tying item user to parent owner, enforce it in both write authorization and relational constraints, and inspect existing mismatches in an approved remediation environment. Remove redundant policies only after equivalent allow/deny tests pass. Do not merely add another permissive policy.

### RLS-02 — P1: account/entity ownership is not relationally enforced

**Confirmed metadata gap.** `arowana.financial_accounts` policies check only the account `user_id`. Its FK references `arowana.entities(id)` and does not bind the parent's `user_id`; its only inspected non-internal trigger updates timestamps. A known entity ID from another user can satisfy the FK while an account row satisfies its own owner policy. The account registry normally chooses an owned entity (`js/account-registry.js:207`), but client selection is bypassable.

**Recommendation:** enforce same-owner entity/account associations, then extend that invariant to downstream positions and imports. Keep `arowana` and `public` account models separate until a canonical model is approved.

### RLS-03 — P1: private provider keys remain readable by their owners

**Confirmed grants and policies; stored values not inspected.** `public.user_api_keys` has owner CRUD policies and authenticated table-level SELECT. `api_key` is a text column. `account.html:1539` and `js/app-config.js:390` retrieve it into the browser. This verifies the mechanism behind ATD-002 without asserting that a currently stored key is valid or that other users can read it.

`salon.business_settings` allows business members to SELECT the settings row and managers to manage it; the schema has `settings_json`. `settings.html:1026`/`:1034` puts OpenAI/Stripe secret fields in that JSON. Thus the page's manager UI gate is narrower than the table's member read policy. OAuth tables have manager ALL policies and authenticated SELECT grants; selecting only status fields in the UI does not prevent an authorized manager from requesting token columns directly. No token values were retrieved.

**Recommendation:** remove private values from browser-accessible data models and expose status-only responses. Treat this as the ATD-002 migration requirement, not an RLS-only fix. Salon authorization helpers have additional shared-system dependencies outside the Arowana core.

### RLS-04 — P1: public configuration includes webhook destinations

**Confirmed metadata.** `arowana.webhooks` grants anon SELECT with a true read policy; public `arowana_webhooks` is a security-invoker compatibility view exposing `url`, `notes` and other fields. `app_config` also has public read policy and anon table SELECT. No row contents were fetched, so this is not evidence that those rows contain live credentials.

**Recommendation:** explicitly allowlist safe public configuration fields. Capability URLs and internal notes should not be assumed public. Backend-authenticated workflow access must not depend on keeping a publicly delivered URL obscure. Relate this to ATD-002's credential-bearing configurable destinations.

### RLS-05 — existing protection: profile update is guarded; admin models differ

The owner-update policy alone permits updating one's profile, but the active BEFORE UPDATE trigger `ap_protect_profile_columns` blocks ordinary changes to ID, plan/billing fields, and transitions into/out of `gs_admin` or `arowana_admin`. `ap_is_admin()` uses stored profile roles; it is a SECURITY DEFINER helper with an explicit search path. Do not report an unproven self-admin escalation solely from the table grant.

`ap_usage_summary(p_days)` separately checks membership in `ap_admins`, clamps days to 1–90, rejects non-admins, and is not executable by anon. The admin page instead gates on profile roles (`admin.html:639`). These authorities can disagree. Profile DELETE has no applicable policy among the inspected policies, while `admin.html:1258` attempts it; deleting a profile also is not equivalent to deleting an Auth user.

**Recommendation:** choose one trusted admin authority and preserve field protections in versioned migrations. Test role/plan changes and deletion lifecycle in DEV. Non-admin role values and other shared-app authorization uses require separate review.

### RLS-06 — P1: confirmed legacy schema/API drift

| Source | Expected dependency | Live metadata / implication |
|---|---|---|
| `daily-bias.html:539` | `public.daily_bias_runs` | Not present in inspected schemas; save path cannot target this table in the matching project. |
| `sector-sentiment.html:268`, `sector-sentiment-gauge.html:364` | `public.sector_sentiment` | Not present; `sector_snapshots` exists but is not established as a compatible replacement. |
| `retirement-planner.html:769` | `retirement_inputs` | Comment-only example inside a no-op stub; absent table is a planned dependency, not a demonstrated failed request. |
| `daily-bias.html:491`/`:516` | `watchlists.is_default`; items `ticker,sort_order` | `is_default` is absent from watchlists. Items use `symbol,position`; `ticker,sort_order` are absent. |
| `settings.html:792` | `user_preferences.display_name` | Live compatibility view exposes `full_name`, not `display_name`; current query is inconsistent. |
| `portfolio-advisor.html:2124`/`:2227` | Goals sync | Requests use anon bearer despite a cached user ID. `goals` owner RLS requires `auth.uid()`; inserts lack anon grant. Locally generated timestamp ID strings also conflict with live UUID IDs. |
| `portfolio-command.html:12092` | `portfolio_options` in `arowana` | Explicit Accept-/Content-Profile headers explain this schema. Do not call the absent `public.portfolio_options` a missing backend. |
| `dashboard.html:1128` etc. | `.from('salon.task_assignments')` | Dot-qualified table strings need client/schema resolution verification; canonical SDK use is `.schema('salon').from('task_assignments')`. No runtime routing test performed. |
| `ai-morning-brief.html:1916`, `schwab-callback.html:65` | Edge slugs `morning-brief`, `schwab-auth-callback` | Neither appears in current deployment listing. `morning-brief-generate` exists; not assumed drop-in compatible. |

**Recommendation:** ATD-004 should capture exact table/schema/column and endpoint contracts before ports. Preserve honest unavailable/sync-error states rather than loosening RLS to make legacy calls succeed.

### RLS-07 — P1: shared public account policies contain incorrect correlations

The competing `public.financial_accounts` insert/update policies compare `m.entity_id = m.entity_id` inside an entity-membership subquery; `public.entities` update compares `m.entity_id = m.id`. The related `entity_memberships` policies repeat the self-comparison. These do not correlate membership to the target account/entity as intended. `user_can_access_entity` is an invoker function reading the same membership table that calls it from its own policy, creating a potential recursive-policy failure as well.

**Confirmed expressions, untested runtime impact.** A broad-write interpretation may be limited by SELECT policies or recursion errors; no cross-tenant exploit was demonstrated. Arowana's current account registry uses the separate `arowana` schema. **Recommendation:** route this defect to the shared account-system owner; never copy these policies into the new trading architecture.

### RLS-08 — P1: broad SQL grants exceed browser needs

Many scoped public tables grant authenticated TRUNCATE, REFERENCES and TRIGGER as well as CRUD. RLS does not make every SQL privilege row-scoped; the presence of TRUNCATE is unnecessary privilege even though a normal PostgREST table route does not provide a TRUNCATE operation. This audit did not find or invoke a path that exposes that SQL command to a browser.

**Recommendation:** inventory all SQL/RPC ingress and reduce grants to required operations in a separate migration. Do not confuse an anon SELECT grant with unrestricted rows where owner RLS still denies access.

### RLS-09 — P1/P2: security-advisor findings require scoped ownership

The project-wide security advisor returned 10 categories, summarized in Appendix D. Not all belong to Arowana. `public.affiliate_links` has a confirmed policy trusting editable JWT `user_metadata.role`; it must not be reused for authorization. The advisor flags `salon.v_user_role_context` for auth-user access and definer behavior, but its inspected definition includes `WHERE o.user_id = auth.uid()`. That limits the result and prevents concluding that the view exposes every user merely from the warning. Its output and definer dependencies still need deliberate approval. `public.public_listings` is another flagged definer view outside the trading scope.

Warnings also include mutable function search paths, executable SECURITY DEFINER functions, leaked-password protection and a vulnerable Postgres version. Enabled RLS with no policies can be deliberate deny-by-default: `ap_provider_calls` is one such server-owned table. Preserve this restriction rather than adding client policies to silence an informational warning.

### RLS-10 — P1: session-local data ownership needs runtime tests

Database owner policies do not isolate shared browser storage or async queues. `js/journal-sync.js:109` installs its auth listener only in the initially signed-out path; the already-signed-in path sets a cached user ID and starts synchronization. Pending maps/retries and local journal mirrors need two-user testing together with `js/session-user.js` quarantine behavior. See ATD-002 for retained key copies.

The diagnostic page compares total and own row counts (`api-diagnostics.html:576`/`:583`). Matching counts cannot prove write isolation, parent ownership, absence of another user's data, or proper privilege escalation defenses. No diagnostic page was run against the live service.

## RPC and Edge Function boundaries

- Frontend RPC `ap_usage_summary` was verified in deployed SQL source and grants. `ap_claim_usage`, `ap_add_usage_cost`, and `ap_record_provider_call` deny execution to both anon and authenticated in the inspected metadata; preserve their server-only boundary.
- `arowana-research` v7 (`verify_jwt=false`) explicitly calls `auth.getUser(token)` before deriving user ID, reads the stored profile for limits, allowlists provider paths and uses an environment-sourced provider key. The browser cannot supply the effective user through a body field in this reviewed path.
- `arowana-ai-coach` v18 (`verify_jwt=true`) additionally validates the token with `auth.getUser`, derives user ID and enforces server-side quota. Client-supplied context remains untrusted trading context, not authoritative account data.
- `arowana-billing-portal` v3 (`verify_jwt=false`) validates the token and looks up the Stripe customer by verified user ID. Source inspection only; no billing action invoked.
- Other Arowana deployments are listed in Appendix C. Their JWT flags alone do not prove safe or unsafe authorization. Checkout, Stripe webhook signatures, digest/scheduler auth, other coach paths and broker callbacks require scoped source/runtime verification before migration.
- No first-party `.storage.from` or `postgres_changes` calls were found by the targeted source search. This does not certify the shared project's Storage buckets or Realtime publications. No storage objects, auth records or application rows were queried.

## Target RLS contract and DEV acceptance matrix

The replacement contract must define grants, row predicates, field restrictions, parent ownership and privileged RPC behavior together. RLS applies after SQL privileges; private user data should not become public to work around a failing client. See [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api) and [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

Permissive policies combine with OR. For UPDATE/ALL, an omitted WITH CHECK uses the USING expression, so null `with_check` alone is not an ownership-reassignment vulnerability. Explicit checks improve reviewability, but findings must evaluate effective policies and triggers. See [PostgreSQL 15 CREATE POLICY](https://www.postgresql.org/docs/15/sql-createpolicy.html).

| DEV test | Expected result |
|---|---|
| Anon reads/writes private journal, account, keys or cash records | Denied/empty as appropriate; never another user's data |
| User A CRUDs own records; user B queries known A IDs | A allowed per contract; B denied, including upsert/conflict paths |
| A creates/updates item under B watchlist; reverse row-owner combination | Both rejected; reassignment also rejected |
| A links account to B entity | Rejected independently of client filters |
| Ordinary user updates own role/plan/billing fields | Rejected by server; allowed profile fields still work |
| Non-admin calls usage summary or global config mutation | Denied; test each admin authority until unified |
| Client requests raw key/token/settings-secret columns | No private credentials returned after remediation |
| Owner policy UPDATE with no separate SELECT policy / wrong grants | Validate real result, including silent zero-row updates |
| Read via compatibility views, direct underlying schema and RPC | Same intended access contract; no alternate bypass |
| Auth switch with queued journal writes and local caches | No data from previous user attached to new user |
| Missing/expired JWT on private Edge endpoints | Rejected before privileged queries or provider calls |
| Shared market feed / waitlist | Only approved public data; waitlist inserts do not allow email listing |

These are required future tests, **not tests executed during this audit**. Run them with synthetic users and records in DEV, with positive and negative assertions; an elevated catalog session is not a substitute.

## Migration order and owner decisions

1. Review ATD-002 credential containment and this audit's P1 ownership findings before adding private-beta users.
2. Decide whether Arowana 2.0 stays in this shared project or receives a separate project/schema boundary. Decide canonical admin authority and private versus shared market-data access.
3. Assign ATD-004 to document exact provider/data contracts; explicitly include schema-qualified account/journal/watchlist models and legacy mismatch handling.
4. Separately authorize scoped remediation for watchlist/account invariants, secrets, grants and approved shared-project findings. Capture deployed definitions as reviewed migrations and establish DEV tests before applying changes.
5. Decide whether Salon/legacy routes remain in deployment and who owns shared-system fixes, account retention, credential cleanup and database maintenance.

No follow-on task, migration, feature work or deployment has started. Recommended next existing task: **ATD-004 — Data source inventory and contract**, after review of urgent containment decisions. Production changes require a separately scoped assignment.

## Verification record

- Live read-only metadata and source inspection completed as described above; this supersedes earlier repository-only unknowns only where explicit evidence is recorded here.
- Security advisor findings were retrieved, not remediated. No claim of an RLS security pass or clean production deployment is made.
- Completion checks passed: `python -B scripts/check-secrets.py` (exit 0; known ATD-002 scanner limitations remain), `git diff --check`, 51 relation inventory rows, source references present/in range, known source JWT/credential values absent from this report, and exactly three ATD-005 documentation changes. Application HTML/JS/CSS/JSON is unchanged from `47fe1ca`; final branch is the required ATD-005 branch at `784d6d7`.
- Desktop/mobile and console checks are not applicable to this documentation-only change; no browser runtime or two-user tests were performed.

## Appendix A — Live relation, column and grant inventory

Snapshot: 2026-09-28. All 411 inspected base tables have RLS enabled; 59 inspected relations are views. View RLS flags are not a table-policy verdict. The following 51 relations match the scoped name inventory, including same-name objects in different schemas and selected dependencies. Missing names are described in RLS-06. `S/I/U/D` below mean SELECT/INSERT/UPDATE/DELETE; other privileges are written in full. Grants list direct catalog entries for browser roles; policy evaluation remains separate.

| Relation | Kind / RLS or view option | Policy count | Browser grants | Columns (nullable marked ?) |
|---|---|---|---|---|
| `arowana.entities` | table; RLS true | 4 | authenticated: D,I,S,U | `id`: uuid; `user_id`: uuid; `legal_name`: text; `entity_type`: text; `color`?: text; `status`: text; `created_at`: timestamp with time zone; `updated_at`: timestamp with time zone |
| `arowana.financial_accounts` | table; RLS true | 4 | authenticated: D,I,S,U | `id`: uuid; `entity_id`: uuid; `user_id`: uuid; `nickname`: text; `broker`?: text; `account_kind`: text; `status`: text; `created_at`: timestamp with time zone; `updated_at`: timestamp with time zone |
| `arowana.portfolio_options` | table; RLS true | 4 | authenticated: D,I,S,U | `id`: uuid; `user_id`: uuid; `account_type`: text; `underlying`: text; `strike`: numeric; `expiry`: date; `opt_type`: text; `qty`: integer; `is_credit`: boolean; `cost_basis`?: numeric; `est_premium`?: numeric; `current_price`?: numeric; `source`: text; `created_at`: timestamp with time zone; `updated_at`: timestamp with time zone |
| `arowana.tools` | table; RLS true | 2 | anon: S; authenticated: D,I,S,U | `slug`: text; `label`: text; `emoji`: text; `href`: text; `category`: text; `is_live`: boolean; `sort_order`?: integer; `updated_at`?: timestamp with time zone |
| `arowana.webhooks` | table; RLS true | 2 | anon: S; authenticated: D,I,S,U | `key`: text; `url`: text; `label`: text; `group_name`: text; `is_live`: boolean; `notes`?: text; `updated_by`?: uuid; `updated_at`?: timestamp with time zone |
| `public.ai_briefs` | table; RLS true | 4 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `user_id`: uuid; `date`: date; `payload`: jsonb; `ai_summary`?: text; `ai_summary_html`?: text; `bias`?: text; `confidence`?: integer; `mode`?: text; `risk`?: text; `universe`?: text; `provider_used`?: text; `model_used`?: text; `tokens_in`?: integer; `tokens_out`?: integer; `cost_usd`?: numeric; `generated_at`: timestamp with time zone |
| `public.ai_coach_usage` | table; RLS true | 1 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `user_id`: uuid; `usage_date`: date; `message_count`: integer; `updated_at`: timestamp with time zone |
| `public.ap_admins` | table; RLS true | 1 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `user_id`: uuid; `added_at`: timestamp with time zone; `note`?: text |
| `public.ap_founders_waitlist` | table; RLS true | 1 | No scoped table grants returned | `id`: uuid; `email`: text; `experience`?: text; `source`: text; `created_at`: timestamp with time zone |
| `public.ap_provider_calls` | table; RLS true | 0 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `day`: date; `provider`: text; `path`: text; `user_id`: uuid; `calls`: integer; `errors`: integer; `updated_at`: timestamp with time zone |
| `public.ap_risk_settings` | table; RLS true | 1 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `user_id`: uuid; `wheel_capital`?: numeric; `max_ticker_pct`: numeric; `max_total_pct`: numeric; `max_puts_per_ticker`: integer; `warn_earnings`: boolean; `updated_at`: timestamp with time zone; `rules`: jsonb |
| `public.ap_roll_coach` | table; RLS true | 2 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `user_id`: uuid; `position_id`: text; `underlying`: text; `opt_type`: text; `strike`?: numeric; `expiry`?: date; `contracts`?: numeric; `premium_received`?: numeric; `current_mid`?: numeric; `current_bid`?: numeric; `current_ask`?: numeric; `delta`?: numeric; `dte`?: integer; `moneyness_pct`?: numeric; `stock_price`?: numeric; `status`?: text; `captured_pct`?: numeric; `choices`?: jsonb; `rules`?: jsonb; `next_earnings_date`?: date; `data_source`?: text; `quote_time`?: timestamp with time zone; `computed_at`: timestamp with time zone |
| `public.ap_usage` | table; RLS true | 1 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `user_id`: uuid; `feature`: text; `period`: text; `used`: integer; `cost_usd`: numeric; `updated_at`: timestamp with time zone |
| `public.app_config` | table; RLS true | 2 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `id`: uuid; `scope`: text; `key`: text; `value`: jsonb; `updated_by`?: uuid; `updated_at`?: timestamp with time zone |
| `public.arowana_tools` | view; security_invoker=true | 0 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `slug`?: text; `label`?: text; `emoji`?: text; `href`?: text; `category`?: text; `is_live`?: boolean; `sort_order`?: integer; `updated_at`?: timestamp with time zone |
| `public.arowana_webhooks` | view; security_invoker=true | 0 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `key`?: text; `url`?: text; `label`?: text; `group_name`?: text; `is_live`?: boolean; `notes`?: text; `updated_by`?: uuid; `updated_at`?: timestamp with time zone |
| `public.business_profiles` | table; RLS true | 6 | authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `id`: uuid; `owner_id`?: uuid; `business_name`: text; `location`?: text; `created_at`?: timestamp with time zone; `notes`?: text; `industry`?: text; `business_type`?: text; `employee_count`?: integer; `services`?: text; `hours`?: text; `phone`?: text; `email`?: text; `website`?: text; `logo_url`?: text; `owner_user_id`?: uuid; `updated_at`: timestamp with time zone; `business_hours`?: jsonb; `business_google_email`?: text; `google_place_id`?: text; `is_listed`: boolean; `operating_type`?: text; `genie_product`?: text; `status`: text; `tagline`?: text; `company_id`?: uuid |
| `public.cc_candidates` | table; RLS true | 4 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `user_id`: uuid; `underlying`: text; `shares_owned`?: integer; `cost_basis`?: numeric; `current_price`?: numeric; `suggested_strike`?: numeric; `suggested_expiration`?: date; `suggested_dte`?: integer; `delta`?: numeric; `premium`?: numeric; `premium_pct`?: numeric; `annualized_yield`?: numeric; `assignment_prob`?: numeric; `resistance_level`?: numeric; `iv_percentile`?: numeric; `earnings_in_dte`?: integer; `score`?: integer; `computed_at`: timestamp with time zone; `option_symbol`?: text; `contracts_available`?: integer; `bid`?: numeric; `ask`?: numeric; `open_interest`?: integer; `reasons`?: jsonb; `data_source`?: text; `quote_time`?: timestamp with time zone |
| `public.csp_candidates` | table; RLS true | 4 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `user_id`: uuid; `underlying`: text; `target_buy_price`?: numeric; `suggested_strike`?: numeric; `suggested_expiration`?: date; `suggested_dte`?: integer; `delta`?: numeric; `premium`?: numeric; `breakeven`?: numeric; `cash_required`?: numeric; `roi_pct`?: numeric; `annualized_yield`?: numeric; `assignment_prob`?: numeric; `support_level`?: numeric; `iv_percentile`?: numeric; `earnings_in_dte`?: integer; `score`?: integer; `computed_at`: timestamp with time zone; `current_price`?: numeric; `option_symbol`?: text; `bid`?: numeric; `ask`?: numeric; `open_interest`?: integer; `discount_pct`?: numeric; `open_puts`?: jsonb; `reasons`?: jsonb; `data_source`?: text; `quote_time`?: timestamp with time zone |
| `public.daily_setups` | table; RLS true | 2 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `id`: uuid; `date`: date; `market_bias`?: text; `risk_today`?: text; `mode`?: text; `watch`?: jsonb; `setups`?: jsonb; `generated_at`?: timestamp with time zone; `source`?: text; `created_at`?: timestamp with time zone |
| `public.entities` | table; RLS true | 3 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `id`: uuid; `legal_name`: text; `dba_name`?: text; `entity_type`: text; `tax_classification`?: text; `jurisdiction`?: text; `country`?: text; `ein_last4`?: text; `start_date`?: date; `status`: text; `metadata`: jsonb; `created_at`: timestamp with time zone; `created_by`?: uuid; `updated_at`: timestamp with time zone |
| `public.finance_transactions` | table; RLS true | 4 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `id`: uuid; `workspace_id`: uuid; `agent_id`: text; `source_type`: text; `source_id`?: text; `direction`: USER-DEFINED; `amount`: numeric; `currency`: text; `occurred_on`: date; `description`?: text; `category_id`?: uuid; `metadata`: jsonb; `created_by`?: uuid; `created_at`: timestamp with time zone; `updated_at`: timestamp with time zone; `vendor`?: text; `category`?: text; `source`?: text; `confidence`?: numeric; `needs_review`?: boolean; `raw_text`?: text; `business_id`?: uuid |
| `public.financial_accounts` | table; RLS true | 3 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `id`: uuid; `entity_id`: uuid; `account_kind`: text; `provider_name`?: text; `nickname`?: text; `last4`?: text; `currency`: text; `status`: text; `metadata`: jsonb; `created_at`: timestamp with time zone; `created_by`?: uuid |
| `public.goals` | table; RLS true | 1 | anon: S,REFERENCES,TRIGGER; authenticated: I,S,U,D,TRUNCATE,REFERENCES,TRIGGER | `id`: uuid; `user_id`?: uuid; `name`: text; `target_amount`?: numeric; `years`?: integer; `annual_return`?: numeric; `created_at`?: timestamp with time zone |
| `public.gs_user_preferences` | table; RLS true | 8 | anon: S,REFERENCES,TRIGGER; authenticated: I,S,U,D,TRUNCATE,REFERENCES,TRIGGER | `id`: uuid; `user_id`: uuid; `categories`?: ARRAY; `agents`?: ARRAY; `created_at`?: timestamp with time zone; `updated_at`?: timestamp with time zone; `full_name`?: text; `default_agent`?: text; `created_via`?: text; `preferred_agent`?: text; `business_id`?: uuid; `role`?: text; `active_business_id`?: uuid; `last_seen_reviews_at`?: timestamp with time zone |
| `public.journal_trades` | table; RLS true | 4 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `id`: uuid; `user_id`: uuid; `asset_type`: text; `ticker`: text; `strategy`?: text; `direction`?: text; `status`: text; `opened_at`?: date; `closed_at`?: date; `qty`?: numeric; `entry_price`?: numeric; `exit_price`?: numeric; `fees`?: numeric; `pnl`?: numeric; `account`?: text; `notes`?: text; `source_id`?: text; `meta`?: jsonb; `created_at`: timestamp with time zone; `updated_at`: timestamp with time zone; `broker`?: text; `external_trade_id`?: text; `source`?: text; `raw_payload`?: jsonb; `synced_at`?: timestamp with time zone; `underlying`?: text; `option_type`?: text; `strike`?: numeric; `expiry`?: date; `multiplier`?: integer |
| `public.market_snapshots` | table; RLS true | 1 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `symbol`: text; `tf`: text; `ts`: timestamp with time zone; `ohlcv`?: jsonb; `indicators`?: jsonb |
| `public.option_chains` | table; RLS true | 4 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `id`: uuid; `user_id`: uuid; `ticker`: text; `strategy`?: text; `status`: text; `start_date`?: date; `end_date`?: date; `expiry`?: date; `account`?: text; `fees`?: numeric; `close_today_cost`?: numeric; `totals`?: jsonb; `chain_json`: jsonb; `created_at`: timestamp with time zone; `updated_at`: timestamp with time zone |
| `public.option_roll_chains` | table; RLS true | 1 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `id`: uuid; `user_id`?: uuid; `name`?: text; `state`: jsonb; `created_at`: timestamp with time zone; `updated_at`: timestamp with time zone |
| `public.portfolio` | table; RLS true | 4 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `id`: uuid; `user_id`?: uuid; `symbol`: text; `shares_owned`: numeric; `avg_cost_basis`?: numeric; `last_updated`?: timestamp with time zone; `risk_level`?: text; `account_type`?: text; `sector`?: text; `notes`?: text; `purchase_date`?: date; `created_at`?: timestamp with time zone; `account`: text |
| `public.profiles` | table; RLS true | 4 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `id`: uuid; `email`?: text; `full_name`?: text; `avatar_url`?: text; `gs_role`: text; `arowana_plan`: text; `created_at`?: timestamp with time zone; `updated_at`?: timestamp with time zone; `arowana_plan_status`?: text; `arowana_stripe_customer_id`?: text; `arowana_stripe_subscription_id`?: text; `arowana_plan_renews_at`?: timestamp with time zone; `arowana_plan_updated_at`?: timestamp with time zone |
| `public.tj_options` | table; RLS true | 5 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `id`: text; `user_id`: uuid; `payload`: jsonb; `underlying`?: text; `strategy`?: text; `status`?: text; `entry_date`?: date; `exit_date`?: date; `manage_by`?: date; `dte_entry`?: integer; `iv_at_entry`?: numeric; `delta_at_entry`?: numeric; `theta_at_entry`?: numeric; `assignment`?: boolean; `mistakes`?: ARRAY; `r_multiple`?: numeric; `created_at`: timestamp with time zone; `updated_at`: timestamp with time zone |
| `public.tj_stocks` | table; RLS true | 5 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `id`: text; `user_id`: uuid; `payload`: jsonb; `symbol`?: text; `status`?: text; `entry_date`?: date; `exit_date`?: date; `setup_type`?: text; `mistakes`?: ARRAY; `emotion_pre`?: integer; `emotion_post`?: integer; `r_multiple`?: numeric; `created_at`: timestamp with time zone; `updated_at`: timestamp with time zone |
| `public.trading_journal` | table; RLS true | 4 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `id`: uuid; `user_id`: uuid; `ticker`: text; `asset_type`: text; `strategy`?: text; `option_strategy`?: text; `quantity`?: numeric; `open_date`?: date; `open_price`?: numeric; `current_price`?: numeric; `open_net_amt`?: numeric; `current_net_amt`?: numeric; `stop_price`?: numeric; `target_price`?: numeric; `close_date`?: date; `close_price`?: numeric; `close_net_amt`?: numeric; `strike`?: numeric; `expiry_date`?: date; `entry_debit`?: numeric; `exit_debit`?: numeric; `cost_exit`?: numeric; `fee`?: numeric; `pnl`?: numeric; `remain_shares`?: numeric; `brokerage_account`?: text; `notes`?: text; `created_at`?: timestamp with time zone; `updated_at`?: timestamp with time zone; `setup`?: text; `tags`?: text |
| `public.user_api_keys` | table; RLS true | 5 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `id`: uuid; `user_id`: uuid; `service`: text; `api_key`: text; `label`?: text; `is_valid`?: boolean; `last_tested`?: timestamp with time zone; `created_at`?: timestamp with time zone; `updated_at`?: timestamp with time zone |
| `public.user_cash_balances` | table; RLS true | 1 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `user_id`: uuid; `account`: text; `amount`: numeric; `source`?: text; `updated_at`: timestamp with time zone |
| `public.user_deployment_plans` | table; RLS true | 1 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `user_id`: uuid; `payload`: jsonb; `updated_at`: timestamp with time zone |
| `public.user_preferences` | view; security_invoker=true | 0 | anon: REFERENCES,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `user_id`?: uuid; `full_name`?: text; `role`?: text; `active_business_id`?: uuid; `selected_business_id`?: uuid; `primary_agent`?: text; `default_agent`?: text; `last_seen_reviews_at`?: timestamp with time zone |
| `public.v_finance_month_summary_all` | view; security_invoker=true | 0 | authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `user_id`?: uuid; `month_start`?: date; `income_total`?: numeric; `expense_total`?: numeric |
| `public.v_finance_top_categories_month_all` | view; security_invoker=true | 0 | authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `user_id`?: uuid; `month_start`?: date; `kind`?: text; `category_name`?: text; `total_amount`?: numeric |
| `public.watchlist_items` | table; RLS true | 7 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `id`: uuid; `watchlist_id`: uuid; `symbol`: text; `note`?: text; `position`?: integer; `created_at`: timestamp with time zone; `updated_at`: timestamp with time zone; `user_id`?: uuid; `signal`?: text; `status`?: text; `current_price`?: numeric; `entry_price`?: numeric; `screener_source`?: text; `date_added`?: timestamp with time zone; `notes`?: text; `inserted_at`: timestamp with time zone; `horizon`: text; `sector`?: text; `target_allocation`?: numeric; `valuation_status`?: text; `category`?: text; `want_to_own`: boolean; `target_buy_price`?: numeric; `want_to_own_at`?: timestamp with time zone |
| `public.watchlists` | table; RLS true | 9 | anon: REFERENCES,S,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `id`: uuid; `user_id`: uuid; `name`: text; `created_at`: timestamp with time zone; `updated_at`: timestamp with time zone |
| `salon.business_settings` | table; RLS true | 2 | anon: REFERENCES,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `id`: uuid; `business_id`: uuid; `setting_key`: text; `settings_json`: jsonb; `updated_at`?: timestamp with time zone |
| `salon.check_ins` | table; RLS true | 1 | anon: REFERENCES,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `id`: uuid; `client_name`: text; `service`: text; `preferred_technician`?: text; `assigned_technician`?: text; `checkin_time`?: timestamp with time zone; `source`?: text; `status`?: text; `checkout_token_hash`?: text; `checkout_token_expires_at`?: timestamp with time zone; `business_id`: uuid; `created_at`: timestamp with time zone; `updated_at`: timestamp with time zone; `started_at`?: timestamp with time zone; `completed_at`?: timestamp with time zone; `requested_employee_id`?: uuid; `customer_id`?: uuid; `assigned_employee_id`?: uuid; `location_id`?: uuid; `client_id`?: uuid; `client_phone`?: text; `services_json`: jsonb; `notes`?: text; `ticket_id`?: uuid; `called_at`?: timestamp with time zone; `seated_at`?: timestamp with time zone; `done_at`?: timestamp with time zone |
| `salon.employees` | table; RLS true | 5 | anon: REFERENCES,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `id`: uuid; `role`: text; `created_at`?: timestamp with time zone; `role_id`?: uuid; `full_name`?: text; `email`?: text; `phone`?: text; `photo_url`?: text; `start_date`?: date; `address`?: text; `birthday`?: date; `emergency_contact`?: text; `notes`?: text; `status`?: text; `wage_type`?: text; `hourly_rate`?: numeric; `commission_pct`?: numeric; `business_id`: uuid; `nick_name`?: text; `display_name`?: text; `job_title`?: text; `employee_id`?: text; `preferred_hours`?: jsonb; `rate`?: numeric; `rate_1099`?: numeric; `min_1099_cover`?: numeric; `default_commission_mode`?: text; `default_w2_paytype`?: text; `login_username`?: text; `login_pin`?: text; `commission_split_check_pct`?: numeric; `w2_method`?: text; `w2_percent`?: numeric; `w2_hourly_rate`?: numeric; `is_service_provider`: boolean; `default_availability`?: jsonb; `user_id`?: uuid; `allowed_services`?: text; `employment_type`?: text; `primary_role`?: text; `skill_notes`?: text; `claim_code`?: text; `updated_at`: timestamp with time zone; `is_available`?: boolean; `access_role`?: text; `work_role`?: text; `compensation_role`?: text; `w2_check_pct`?: numeric; `hybrid_w2_rate`?: numeric; `hybrid_w2_portion`?: numeric; `hybrid_1099_portion`?: numeric; `default_weekly_hours`?: numeric; `hybrid_w2_hourly_rate`?: numeric; `hybrid_w2_hours`?: numeric; `bonus_threshold`?: numeric; `bonus_amount`?: numeric; `min_1099_cover_rate`?: numeric; `cleaning_default`?: numeric; `weekly_salary`?: numeric; `pay_frequency`?: text; `overtime_eligible`?: boolean; `timekeeping_system`?: text; `pay_structure`?: text; `current_ticket_id`?: uuid; `auto_assign_enabled`: boolean; `auto_assign_disabled_reason`?: text; `auto_assign_disabled_at`?: timestamp with time zone; `avatar_url`?: text; `additional_roles`?: ARRAY; `has_pin`: boolean |
| `salon.google_oauth_tokens` | table; RLS true | 1 | anon: REFERENCES,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `business_id`: uuid; `access_token`: text; `refresh_token`?: text; `expires_at`: timestamp with time zone; `scope`?: text; `google_email`?: text; `created_at`: timestamp with time zone; `updated_at`: timestamp with time zone; `google_account_id`?: text; `google_location_id`?: text; `google_location_name`?: text |
| `salon.meta_oauth_tokens` | table; RLS true | 1 | anon: REFERENCES,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `business_id`: uuid; `fb_user_id`?: text; `fb_page_id`: text; `fb_page_name`?: text; `page_access_token`: text; `ig_user_id`?: text; `ig_username`?: text; `scope`?: text; `token_refreshed_at`: timestamp with time zone; `created_at`: timestamp with time zone; `updated_at`: timestamp with time zone |
| `salon.task_assignments` | table; RLS true | 1 | anon: REFERENCES,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `id`: uuid; `business_id`: uuid; `task_id`?: uuid; `assignee_id`: uuid; `assigned_by`?: uuid; `title_snapshot`: text; `detail_snapshot`?: text; `category_snapshot`?: text; `priority`?: text; `status`?: text; `due_date`?: date; `due_at`?: timestamp with time zone; `assigned_at`?: timestamp with time zone; `started_at`?: timestamp with time zone; `completed_at`?: timestamp with time zone; `note`?: text; `completion_note`?: text; `genie_context`?: text; `source`?: text; `is_recurring_instance`?: boolean; `recurrence_key`?: text; `created_at`?: timestamp with time zone; `updated_at`?: timestamp with time zone |
| `salon.task_comments` | table; RLS true | 1 | anon: REFERENCES,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `id`: uuid; `business_id`: uuid; `assignment_id`: uuid; `author_id`: uuid; `comment_text`: text; `created_at`?: timestamp with time zone |
| `salon.v_task_assignments_live` | view; security_invoker=true | 0 | anon: REFERENCES,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `id`?: uuid; `business_id`?: uuid; `task_id`?: uuid; `assignee_id`?: uuid; `assigned_by`?: uuid; `title_snapshot`?: text; `detail_snapshot`?: text; `category_snapshot`?: text; `priority`?: text; `status`?: text; `due_date`?: date; `due_at`?: timestamp with time zone; `assigned_at`?: timestamp with time zone; `started_at`?: timestamp with time zone; `completed_at`?: timestamp with time zone; `note`?: text; `completion_note`?: text; `genie_context`?: text; `source`?: text; `is_recurring_instance`?: boolean; `recurrence_key`?: text; `created_at`?: timestamp with time zone; `updated_at`?: timestamp with time zone; `status_live`?: text |
| `salon.v_user_role_context` | view; default definer | 0 | anon: REFERENCES,TRIGGER; authenticated: D,I,REFERENCES,S,TRIGGER,TRUNCATE,U | `user_id`?: uuid; `business_id`?: uuid; `business_name`?: text; `location`?: text; `is_owner`?: boolean; `staff_role`?: text; `effective_role`?: text |

## Appendix B — Exact policy evidence and ownership constraints

The 131 scoped policies below preserve catalog predicates. Null WITH CHECK is shown as an em dash; see effective-policy semantics above. All retrieved scoped policies are permissive. This is not a complete policy export for the shared project.

| Relation / policy | Roles / command | USING | WITH CHECK |
|---|---|---|---|
| arowana.entities / entities_delete_own | {public} / DELETE | (auth.uid() = user_id) | — |
| arowana.entities / entities_insert_own | {public} / INSERT | — | (auth.uid() = user_id) |
| arowana.entities / entities_select_own | {public} / SELECT | (auth.uid() = user_id) | — |
| arowana.entities / entities_update_own | {public} / UPDATE | (auth.uid() = user_id) | (auth.uid() = user_id) |
| arowana.financial_accounts / financial_accounts_delete_own | {public} / DELETE | (auth.uid() = user_id) | — |
| arowana.financial_accounts / financial_accounts_insert_own | {public} / INSERT | — | (auth.uid() = user_id) |
| arowana.financial_accounts / financial_accounts_select_own | {public} / SELECT | (auth.uid() = user_id) | — |
| arowana.financial_accounts / financial_accounts_update_own | {public} / UPDATE | (auth.uid() = user_id) | (auth.uid() = user_id) |
| arowana.portfolio_options / portfolio_options_delete_own | {public} / DELETE | (auth.uid() = user_id) | — |
| arowana.portfolio_options / portfolio_options_insert_own | {public} / INSERT | — | (auth.uid() = user_id) |
| arowana.portfolio_options / portfolio_options_select_own | {public} / SELECT | (auth.uid() = user_id) | — |
| arowana.portfolio_options / portfolio_options_update_own | {public} / UPDATE | (auth.uid() = user_id) | (auth.uid() = user_id) |
| arowana.tools / admin write tools | {public} / ALL | (EXISTS ( SELECT 1    FROM profiles   WHERE ((profiles.id = auth.uid()) AND (profiles.gs_role = ANY (ARRAY['gs_admin'::text, 'arowana_admin'::text]))))) | — |
| arowana.tools / public read tools | {public} / SELECT | true | — |
| arowana.webhooks / admin write webhooks | {public} / ALL | (EXISTS ( SELECT 1    FROM profiles   WHERE ((profiles.id = auth.uid()) AND (profiles.gs_role = ANY (ARRAY['gs_admin'::text, 'arowana_admin'::text]))))) | — |
| arowana.webhooks / public read webhooks | {public} / SELECT | true | — |
| public.ai_briefs / ai_briefs_delete_own | {public} / DELETE | (auth.uid() = user_id) | — |
| public.ai_briefs / ai_briefs_insert_own | {public} / INSERT | — | (auth.uid() = user_id) |
| public.ai_briefs / ai_briefs_select_own | {public} / SELECT | (auth.uid() = user_id) | — |
| public.ai_briefs / ai_briefs_update_own | {public} / UPDATE | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public.ai_coach_usage / Users can view their own AI coach usage | {public} / SELECT | (auth.uid() = user_id) | — |
| public.ap_admins / ap_admins_read_self | {authenticated} / SELECT | (auth.uid() = user_id) | — |
| public.ap_founders_waitlist / ap_fw_insert_only | {anon,authenticated} / INSERT | — | (source = 'landing'::text) |
| public.ap_risk_settings / ap_risk_settings_own | {authenticated} / ALL | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public.ap_roll_coach / ap_roll_coach_delete_own | {authenticated} / DELETE | (auth.uid() = user_id) | — |
| public.ap_roll_coach / ap_roll_coach_select_own | {authenticated} / SELECT | (auth.uid() = user_id) | — |
| public.ap_usage / ap_usage_select_own | {authenticated} / SELECT | (auth.uid() = user_id) | — |
| public.app_config / admin write app_config | {public} / ALL | (EXISTS ( SELECT 1    FROM profiles   WHERE ((profiles.id = auth.uid()) AND (profiles.gs_role = ANY (ARRAY['gs_admin'::text, 'arowana_admin'::text]))))) | — |
| public.app_config / public read app_config | {public} / SELECT | true | — |
| public.business_profiles / Allow insert for owner | {public} / INSERT | — | (owner_id = auth.uid()) |
| public.business_profiles / Allow update for owner | {public} / UPDATE | (owner_id = auth.uid()) | — |
| public.business_profiles / Owner can update own business profile | {public} / UPDATE | (owner_id = auth.uid()) | (owner_id = auth.uid()) |
| public.business_profiles / bp_anon_public_read | {anon} / SELECT | true | — |
| public.business_profiles / bp_owner_manage | {public} / ALL | (EXISTS ( SELECT 1    FROM agent_memberships m   WHERE ((m.business_id = business_profiles.id) AND (m.user_id = auth.uid()) AND (m.agent_slug = 'salon_genie'::text) AND (m.status = 'active'::text) AND (m.role = 'owner'::text)))) | (EXISTS ( SELECT 1    FROM agent_memberships m   WHERE ((m.business_id = business_profiles.id) AND (m.user_id = auth.uid()) AND (m.agent_slug = 'salon_genie'::text) AND (m.status = 'active'::text) AND (m.role = 'owner'::text)))) |
| public.business_profiles / bp_select_member | {authenticated} / SELECT | ((owner_id = auth.uid()) OR (EXISTS ( SELECT 1    FROM salon.employees e   WHERE ((e.business_id = business_profiles.id) AND (e.user_id = auth.uid())))) OR (EXISTS ( SELECT 1    FROM agent_memberships m   WHERE ((m.business_id = business_profiles.id) AND (m.user_id = auth.uid()) AND (m.status = 'active'::text))))) | — |
| public.cc_candidates / cc_delete_own | {public} / DELETE | (auth.uid() = user_id) | — |
| public.cc_candidates / cc_insert_own | {public} / INSERT | — | (auth.uid() = user_id) |
| public.cc_candidates / cc_select_own | {public} / SELECT | (auth.uid() = user_id) | — |
| public.cc_candidates / cc_update_own | {public} / UPDATE | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public.csp_candidates / csp_delete_own | {public} / DELETE | (auth.uid() = user_id) | — |
| public.csp_candidates / csp_insert_own | {public} / INSERT | — | (auth.uid() = user_id) |
| public.csp_candidates / csp_select_own | {public} / SELECT | (auth.uid() = user_id) | — |
| public.csp_candidates / csp_update_own | {public} / UPDATE | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public.daily_setups / Anyone can read daily setups | {public} / SELECT | true | — |
| public.daily_setups / Service role can insert/update daily setups | {public} / ALL | (auth.role() = 'service_role'::text) | — |
| public.entities / entities: insert for authenticated | {public} / INSERT | — | (auth.uid() IS NOT NULL) |
| public.entities / entities: select if member | {public} / SELECT | user_can_access_entity(id) | — |
| public.entities / entities: update if owner/admin | {public} / UPDATE | (EXISTS ( SELECT 1    FROM entity_memberships m   WHERE ((m.entity_id = m.id) AND (m.user_id = auth.uid()) AND (m.is_active = true) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))) | — |
| public.finance_transactions / ft_delete_owner_manager | {authenticated} / DELETE | (fin_business_role(workspace_id) = ANY (ARRAY['owner'::text, 'manager'::text])) | — |
| public.finance_transactions / ft_insert_workspace_members | {authenticated} / INSERT | — | (fin_is_business_member(workspace_id) AND ((agent_id = 'geniesphere'::text) OR fin_is_agent_member(workspace_id, agent_id))) |
| public.finance_transactions / ft_read_workspace_members | {authenticated} / SELECT | (fin_is_business_member(workspace_id) AND ((agent_id = 'geniesphere'::text) OR fin_is_agent_member(workspace_id, agent_id))) | — |
| public.finance_transactions / ft_update_owner_manager | {authenticated} / UPDATE | (fin_business_role(workspace_id) = ANY (ARRAY['owner'::text, 'manager'::text])) | (fin_business_role(workspace_id) = ANY (ARRAY['owner'::text, 'manager'::text])) |
| public.financial_accounts / accounts: insert if owner/admin | {public} / INSERT | — | (EXISTS ( SELECT 1    FROM entity_memberships m   WHERE ((m.entity_id = m.entity_id) AND (m.user_id = auth.uid()) AND (m.is_active = true) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))) |
| public.financial_accounts / accounts: select if entity member | {public} / SELECT | user_can_access_entity(entity_id) | — |
| public.financial_accounts / accounts: update if owner/admin | {public} / UPDATE | (EXISTS ( SELECT 1    FROM entity_memberships m   WHERE ((m.entity_id = m.entity_id) AND (m.user_id = auth.uid()) AND (m.is_active = true) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))) | — |
| public.journal_trades / jt_delete_own | {public} / DELETE | (auth.uid() = user_id) | — |
| public.journal_trades / jt_insert_own | {public} / INSERT | — | (auth.uid() = user_id) |
| public.journal_trades / jt_select_own | {public} / SELECT | (auth.uid() = user_id) | — |
| public.journal_trades / jt_update_own | {public} / UPDATE | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public.market_snapshots / market_snapshots_read_all | {authenticated} / SELECT | true | — |
| public.option_chains / oc_delete_own | {public} / DELETE | (auth.uid() = user_id) | — |
| public.option_chains / oc_insert_own | {public} / INSERT | — | (auth.uid() = user_id) |
| public.option_chains / oc_select_own | {public} / SELECT | (auth.uid() = user_id) | — |
| public.option_chains / oc_update_own | {public} / UPDATE | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public.option_roll_chains / option_roll_chains_own_rows | {authenticated} / ALL | (user_id = auth.uid()) | (user_id = auth.uid()) |
| public.portfolio / portfolio_delete_own | {public} / DELETE | (auth.uid() = user_id) | — |
| public.portfolio / portfolio_insert_own | {public} / INSERT | — | (auth.uid() = user_id) |
| public.portfolio / portfolio_select_own | {public} / SELECT | (auth.uid() = user_id) | — |
| public.portfolio / portfolio_update_own | {public} / UPDATE | (auth.uid() = user_id) | — |
| public.profiles / admins read any profile | {authenticated} / SELECT | ap_is_admin() | — |
| public.profiles / admins update any profile | {authenticated} / UPDATE | ap_is_admin() | ap_is_admin() |
| public.profiles / users read own profile | {public} / SELECT | (auth.uid() = id) | — |
| public.profiles / users update own profile | {public} / UPDATE | (auth.uid() = id) | — |
| public.tj_options / own rows only - options | {public} / ALL | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public.tj_options / tj_options_delete_own | {public} / DELETE | (auth.uid() = user_id) | — |
| public.tj_options / tj_options_insert_own | {public} / INSERT | — | (auth.uid() = user_id) |
| public.tj_options / tj_options_select_own | {public} / SELECT | (auth.uid() = user_id) | — |
| public.tj_options / tj_options_update_own | {public} / UPDATE | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public.tj_stocks / own rows only - stocks | {public} / ALL | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public.tj_stocks / tj_stocks_delete_own | {public} / DELETE | (auth.uid() = user_id) | — |
| public.tj_stocks / tj_stocks_insert_own | {public} / INSERT | — | (auth.uid() = user_id) |
| public.tj_stocks / tj_stocks_select_own | {public} / SELECT | (auth.uid() = user_id) | — |
| public.tj_stocks / tj_stocks_update_own | {public} / UPDATE | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public.trading_journal / Users can delete their journal | {public} / DELETE | (auth.uid() = user_id) | — |
| public.trading_journal / Users can insert into their journal | {public} / INSERT | — | (auth.uid() = user_id) |
| public.trading_journal / Users can update their journal | {public} / UPDATE | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public.trading_journal / Users can view their own journal | {public} / SELECT | (auth.uid() = user_id) | — |
| public.user_api_keys / Users can manage their own API keys | {public} / ALL | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public.user_api_keys / Users delete own API keys | {public} / DELETE | (auth.uid() = user_id) | — |
| public.user_api_keys / Users insert own API keys | {public} / INSERT | — | (auth.uid() = user_id) |
| public.user_api_keys / Users read own API keys | {public} / SELECT | (auth.uid() = user_id) | — |
| public.user_api_keys / Users update own API keys | {public} / UPDATE | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public.user_cash_balances / cash_balances_user_owns | {public} / ALL | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public.user_deployment_plans / deployment_plans_user_owns | {public} / ALL | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public.watchlist_items / delete own items | {public} / DELETE | (user_id = auth.uid()) | — |
| public.watchlist_items / items modify via own watchlist | {public} / ALL | (EXISTS ( SELECT 1    FROM watchlists w   WHERE ((w.id = watchlist_items.watchlist_id) AND (w.user_id = auth.uid())))) | (EXISTS ( SELECT 1    FROM watchlists w   WHERE ((w.id = watchlist_items.watchlist_id) AND (w.user_id = auth.uid())))) |
| public.watchlist_items / items select via own watchlist | {public} / SELECT | (EXISTS ( SELECT 1    FROM watchlists w   WHERE ((w.id = watchlist_items.watchlist_id) AND (w.user_id = auth.uid())))) | — |
| public.watchlist_items / read own items | {public} / SELECT | (user_id = auth.uid()) | — |
| public.watchlist_items / update own items | {public} / UPDATE | (user_id = auth.uid()) | (user_id = auth.uid()) |
| public.watchlist_items / watchlist_items_own_rows | {public} / ALL | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public.watchlist_items / write own items | {public} / INSERT | — | (user_id = auth.uid()) |
| public.watchlists / Users can read their watchlist | {public} / SELECT | ((user_id)::text = (auth.uid())::text) | — |
| public.watchlists / Users can update their watchlist | {public} / UPDATE | ((user_id)::text = (auth.uid())::text) | ((user_id)::text = (auth.uid())::text) |
| public.watchlists / Users can upsert their watchlist | {public} / INSERT | — | ((user_id)::text = (auth.uid())::text) |
| public.watchlists / delete own watchlists | {public} / DELETE | (user_id = auth.uid()) | — |
| public.watchlists / read own watchlists | {public} / SELECT | (user_id = auth.uid()) | — |
| public.watchlists / update own watchlists | {public} / UPDATE | (user_id = auth.uid()) | (user_id = auth.uid()) |
| public.watchlists / watchlists modify own | {public} / ALL | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public.watchlists / watchlists select own | {public} / SELECT | (auth.uid() = user_id) | — |
| public.watchlists / write own watchlists | {public} / INSERT | — | (user_id = auth.uid()) |
| salon.business_settings / business_settings_manager_write | {authenticated} / ALL | salon.can_manage_business(business_id) | salon.can_manage_business(business_id) |
| salon.business_settings / business_settings_member_read | {authenticated} / SELECT | salon.sg_has_access(business_id) | — |
| salon.check_ins / check_ins_member_all | {authenticated} / ALL | salon.sg_has_access(business_id) | salon.sg_has_access(business_id) |
| salon.employees / emp_anon_public_read | {anon} / SELECT | (COALESCE(status, 'active'::text) <> 'inactive'::text) | — |
| salon.employees / emp_member_read | {authenticated} / SELECT | salon.sg_has_access(business_id) | — |
| salon.employees / employees_manager_write | {authenticated} / ALL | salon.can_manage_business(business_id) | salon.can_manage_business(business_id) |
| salon.employees / employees_select_self | {public} / SELECT | (user_id = auth.uid()) | — |
| salon.employees / employees_self_update | {authenticated} / UPDATE | (user_id = auth.uid()) | (user_id = auth.uid()) |
| salon.google_oauth_tokens / google_oauth_manager_all | {authenticated} / ALL | salon.can_manage_business(business_id) | salon.can_manage_business(business_id) |
| salon.meta_oauth_tokens / meta_oauth_manager_all | {authenticated} / ALL | salon.can_manage_business(business_id) | salon.can_manage_business(business_id) |
| salon.task_assignments / task_assignments_member_all | {authenticated} / ALL | salon.sg_has_access(business_id) | salon.sg_has_access(business_id) |
| salon.task_comments / task_comments_member_all | {authenticated} / ALL | salon.sg_has_access(business_id) | salon.sg_has_access(business_id) |
| public.goals / Users own goals | public / ALL | (auth.uid() = user_id) | — |
| public.gs_user_preferences / Admin can insert/delete preferences | public / ALL | (is_admin(auth.uid()) = true) | — |
| public.gs_user_preferences / Admin can update all preferences | public / UPDATE | (is_admin(auth.uid()) = true) | — |
| public.gs_user_preferences / Admin read all | public / SELECT | ((auth.role() = 'authenticated'::text) AND is_admin(auth.uid())) | — |
| public.gs_user_preferences / Self read | public / SELECT | (auth.uid() = user_id) | — |
| public.gs_user_preferences / Users can upsert own preferences | public / ALL | (auth.uid() = user_id) | (auth.uid() = user_id) |
| public.gs_user_preferences / user_preferences_insert_own | public / INSERT | — | (auth.uid() = user_id) |
| public.gs_user_preferences / user_preferences_select_own | public / SELECT | (auth.uid() = user_id) | — |
| public.gs_user_preferences / user_preferences_update_own | public / UPDATE | (auth.uid() = user_id) | (auth.uid() = user_id) |

### Scoped key and relational constraints

All 132 returned constraints are recorded for reproducibility; check expressions contain schema literals, not stored application data. Indexes not represented by constraints and all shared-system trigger bodies were not exhaustively reviewed.

| Relation | Constraint | Definition |
|---|---|---|
| arowana.entities | entities_entity_type_check | CHECK ((entity_type = ANY (ARRAY['personal'::text, 'llc'::text]))) |
| arowana.entities | entities_pkey | PRIMARY KEY (id) |
| arowana.entities | entities_status_check | CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text]))) |
| arowana.entities | entities_user_id_fkey | FOREIGN KEY (user_id) REFERENCES auth.users(id) |
| arowana.entities | entities_user_id_legal_name_key | UNIQUE (user_id, legal_name) |
| arowana.financial_accounts | financial_accounts_account_kind_check | CHECK ((account_kind = ANY (ARRAY['brokerage'::text, 'ira'::text, 'roth'::text, '401k'::text]))) |
| arowana.financial_accounts | financial_accounts_entity_id_fkey | FOREIGN KEY (entity_id) REFERENCES arowana.entities(id) ON DELETE CASCADE |
| arowana.financial_accounts | financial_accounts_pkey | PRIMARY KEY (id) |
| arowana.financial_accounts | financial_accounts_status_check | CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text]))) |
| arowana.financial_accounts | financial_accounts_user_id_fkey | FOREIGN KEY (user_id) REFERENCES auth.users(id) |
| arowana.financial_accounts | financial_accounts_user_id_nickname_key | UNIQUE (user_id, nickname) |
| arowana.portfolio_options | portfolio_options_opt_type_check | CHECK ((opt_type = ANY (ARRAY['call'::text, 'put'::text]))) |
| arowana.portfolio_options | portfolio_options_pkey | PRIMARY KEY (id) |
| arowana.portfolio_options | portfolio_options_source_check | CHECK ((source = ANY (ARRAY['csv_import'::text, 'manual'::text]))) |
| arowana.portfolio_options | portfolio_options_user_id_account_type_underlying_strike_ex_key | UNIQUE (user_id, account_type, underlying, strike, expiry, opt_type) |
| arowana.portfolio_options | portfolio_options_user_id_fkey | FOREIGN KEY (user_id) REFERENCES auth.users(id) |
| arowana.tools | tools_pkey | PRIMARY KEY (slug) |
| arowana.webhooks | webhooks_pkey | PRIMARY KEY (key) |
| arowana.webhooks | webhooks_updated_by_fkey | FOREIGN KEY (updated_by) REFERENCES auth.users(id) |
| public.ai_briefs | ai_briefs_pkey | PRIMARY KEY (user_id, date) |
| public.ai_briefs | ai_briefs_user_id_fkey | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE |
| public.ai_coach_usage | ai_coach_usage_pkey | PRIMARY KEY (user_id, usage_date) |
| public.ai_coach_usage | ai_coach_usage_user_id_fkey | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE |
| public.ap_admins | ap_admins_pkey | PRIMARY KEY (user_id) |
| public.ap_admins | ap_admins_user_id_fkey | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE |
| public.ap_founders_waitlist | ap_founders_waitlist_pkey | PRIMARY KEY (id) |
| public.ap_founders_waitlist | ap_fw_email_format | CHECK ((((char_length(email) >= 5) AND (char_length(email) <= 254)) AND (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'::text))) |
| public.ap_founders_waitlist | ap_fw_experience_values | CHECK (((experience IS NULL) OR (experience = ANY (ARRAY['new_to_wheel'::text, 'running_wheel'::text, 'other_options'::text])))) |
| public.ap_provider_calls | ap_provider_calls_pkey | PRIMARY KEY (day, provider, path, user_id) |
| public.ap_provider_calls | ap_provider_calls_user_id_fkey | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL |
| public.ap_risk_settings | ap_risk_capital_check | CHECK (((wheel_capital IS NULL) OR ((wheel_capital > (0)::numeric) AND (wheel_capital < (1000000000)::numeric)))) |
| public.ap_risk_settings | ap_risk_puts_check | CHECK (((max_puts_per_ticker >= 1) AND (max_puts_per_ticker <= 20))) |
| public.ap_risk_settings | ap_risk_settings_pkey | PRIMARY KEY (user_id) |
| public.ap_risk_settings | ap_risk_settings_user_id_fkey | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE |
| public.ap_risk_settings | ap_risk_ticker_pct_check | CHECK (((max_ticker_pct > (0)::numeric) AND (max_ticker_pct <= (100)::numeric))) |
| public.ap_risk_settings | ap_risk_total_pct_check | CHECK (((max_total_pct > (0)::numeric) AND (max_total_pct <= (100)::numeric))) |
| public.ap_roll_coach | ap_roll_coach_pkey | PRIMARY KEY (user_id, position_id, computed_at) |
| public.ap_roll_coach | ap_roll_coach_user_id_fkey | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE |
| public.ap_usage | ap_usage_feature_check | CHECK ((feature = ANY (ARRAY['research'::text, 'coach'::text]))) |
| public.ap_usage | ap_usage_pkey | PRIMARY KEY (user_id, feature, period) |
| public.ap_usage | ap_usage_used_check | CHECK ((used >= 0)) |
| public.ap_usage | ap_usage_user_id_fkey | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE |
| public.app_config | app_config_pkey | PRIMARY KEY (id) |
| public.app_config | app_config_scope_key_key | UNIQUE (scope, key) |
| public.app_config | app_config_updated_by_fkey | FOREIGN KEY (updated_by) REFERENCES auth.users(id) |
| public.business_profiles | business_profiles_company_id_fkey | FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL |
| public.business_profiles | business_profiles_owner_id_fkey | FOREIGN KEY (owner_id) REFERENCES auth.users(id) |
| public.business_profiles | business_profiles_pkey | PRIMARY KEY (id) |
| public.cc_candidates | cc_candidates_pkey | PRIMARY KEY (user_id, underlying, computed_at) |
| public.cc_candidates | cc_candidates_user_id_fkey | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE |
| public.csp_candidates | csp_candidates_pkey | PRIMARY KEY (user_id, underlying, computed_at) |
| public.csp_candidates | csp_candidates_user_id_fkey | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE |
| public.daily_setups | daily_setups_date_key | UNIQUE (date) |
| public.daily_setups | daily_setups_pkey | PRIMARY KEY (id) |
| public.entities | entities_created_by_fkey | FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL |
| public.entities | entities_entity_type_check | CHECK ((entity_type = ANY (ARRAY['llc'::text, 'corporation'::text, 'sole_prop'::text, 'partnership'::text, 'trust'::text, 'nonprofit'::text, 'other'::text]))) |
| public.entities | entities_pkey | PRIMARY KEY (id) |
| public.entities | entities_status_check | CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'archived'::text]))) |
| public.entities | entities_tax_classification_check | CHECK ((tax_classification = ANY (ARRAY['disregarded'::text, 'partnership'::text, 's_corp'::text, 'c_corp'::text, 'nonprofit'::text, 'other'::text]))) |
| public.finance_transactions | finance_transactions_amount_chk | CHECK ((amount >= (0)::numeric)) |
| public.finance_transactions | finance_transactions_category_id_fkey | FOREIGN KEY (category_id) REFERENCES finance_categories(id) ON DELETE SET NULL |
| public.finance_transactions | finance_transactions_pkey | PRIMARY KEY (id) |
| public.financial_accounts | financial_accounts_account_kind_check | CHECK ((account_kind = ANY (ARRAY['bank'::text, 'credit'::text, 'brokerage'::text, 'other'::text]))) |
| public.financial_accounts | financial_accounts_created_by_fkey | FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL |
| public.financial_accounts | financial_accounts_entity_id_fkey | FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE |
| public.financial_accounts | financial_accounts_pkey | PRIMARY KEY (id) |
| public.financial_accounts | financial_accounts_status_check | CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'closed'::text]))) |
| public.journal_trades | journal_trades_asset_type_check | CHECK ((asset_type = ANY (ARRAY['stock'::text, 'option'::text]))) |
| public.journal_trades | journal_trades_pkey | PRIMARY KEY (id) |
| public.journal_trades | journal_trades_status_check | CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text]))) |
| public.journal_trades | journal_trades_user_id_fkey | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE |
| public.market_snapshots | market_snapshots_pkey | PRIMARY KEY (symbol, tf, ts) |
| public.option_chains | option_chains_pkey | PRIMARY KEY (id) |
| public.option_chains | option_chains_status_check | CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text]))) |
| public.option_chains | option_chains_user_id_fkey | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE |
| public.option_roll_chains | option_roll_chains_pkey | PRIMARY KEY (id) |
| public.portfolio | portfolio_pkey | PRIMARY KEY (id) |
| public.portfolio | portfolio_user_id_fkey | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE |
| public.portfolio | portfolio_user_symbol_account_unique | UNIQUE (user_id, symbol, account_type) |
| public.profiles | profiles_arowana_plan_check | CHECK (((arowana_plan IS NULL) OR (arowana_plan = ANY (ARRAY['free'::text, 'pro'::text, 'elite'::text, 'founders'::text])))) |
| public.profiles | profiles_arowana_plan_status_check | CHECK (((arowana_plan_status IS NULL) OR (arowana_plan_status = ANY (ARRAY['active'::text, 'trialing'::text, 'past_due'::text, 'canceled'::text, 'incomplete'::text])))) |
| public.profiles | profiles_id_fkey | FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE |
| public.profiles | profiles_pkey | PRIMARY KEY (id) |
| public.tj_options | tj_options_pkey | PRIMARY KEY (id) |
| public.tj_options | tj_options_user_id_fkey | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE |
| public.tj_stocks | tj_stocks_pkey | PRIMARY KEY (id) |
| public.tj_stocks | tj_stocks_user_id_fkey | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE |
| public.trading_journal | trading_journal_asset_type_check | CHECK ((asset_type = ANY (ARRAY['share'::text, 'option'::text]))) |
| public.trading_journal | trading_journal_pkey | PRIMARY KEY (id) |
| public.trading_journal | trading_journal_user_id_fkey | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE |
| public.user_api_keys | user_api_keys_pkey | PRIMARY KEY (id) |
| public.user_api_keys | user_api_keys_user_id_fkey | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE |
| public.user_api_keys | user_api_keys_user_id_service_key | UNIQUE (user_id, service) |
| public.user_cash_balances | user_cash_balances_pkey | PRIMARY KEY (user_id, account) |
| public.user_cash_balances | user_cash_balances_user_id_fkey | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE |
| public.user_deployment_plans | user_deployment_plans_pkey | PRIMARY KEY (user_id) |
| public.user_deployment_plans | user_deployment_plans_user_id_fkey | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE |
| public.watchlist_items | watchlist_items_horizon_check | CHECK ((horizon = ANY (ARRAY['trade_idea'::text, 'long_term_hold'::text]))) |
| public.watchlist_items | watchlist_items_pkey | PRIMARY KEY (id) |
| public.watchlist_items | watchlist_items_target_buy_price_check | CHECK (((target_buy_price IS NULL) OR ((target_buy_price > (0)::numeric) AND (target_buy_price < (1000000)::numeric)))) |
| public.watchlist_items | watchlist_items_valuation_status_check | CHECK (((valuation_status IS NULL) OR (valuation_status = ANY (ARRAY['buy'::text, 'hold'::text, 'sell'::text])))) |
| public.watchlist_items | watchlist_items_watchlist_id_fkey | FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE CASCADE |
| public.watchlist_items | watchlist_items_watchlist_id_symbol_key | UNIQUE (watchlist_id, symbol) |
| public.watchlists | watchlists_pkey | PRIMARY KEY (id) |
| public.watchlists | watchlists_user_id_fkey | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE |
| salon.business_settings | business_settings_business_id_setting_key_key | UNIQUE (business_id, setting_key) |
| salon.business_settings | business_settings_pkey | PRIMARY KEY (id) |
| salon.check_ins | check_ins_business_fk | FOREIGN KEY (business_id) REFERENCES business_profiles(id) ON DELETE CASCADE |
| salon.check_ins | check_ins_business_id_fkey | FOREIGN KEY (business_id) REFERENCES business_profiles(id) ON DELETE CASCADE |
| salon.check_ins | check_ins_pkey | PRIMARY KEY (id) |
| salon.check_ins | fk_check_ins_business | FOREIGN KEY (business_id) REFERENCES business_profiles(id) ON DELETE CASCADE |
| salon.check_ins | fk_checkins_assigned_employee | FOREIGN KEY (assigned_employee_id) REFERENCES salon.employees(id) ON DELETE SET NULL |
| salon.check_ins | fk_checkins_customer | FOREIGN KEY (customer_id) REFERENCES _deprecated_customers(id) ON DELETE SET NULL |
| salon.check_ins | fk_checkins_requested_employee | FOREIGN KEY (requested_employee_id) REFERENCES salon.employees(id) ON DELETE SET NULL |
| salon.employees | employees_business_fk | FOREIGN KEY (business_id) REFERENCES business_profiles(id) ON DELETE CASCADE |
| salon.employees | employees_commission_pct_check | CHECK (((commission_pct >= (0)::numeric) AND (commission_pct <= (100)::numeric))) |
| salon.employees | employees_current_ticket_id_fkey | FOREIGN KEY (current_ticket_id) REFERENCES salon.tickets(id) |
| salon.employees | employees_full_name_not_email | CHECK (((full_name IS NULL) OR (full_name !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text))) |
| salon.employees | employees_wage_type_check | CHECK ((wage_type = ANY (ARRAY['1099'::text, 'W2'::text, 'Hybrid'::text, 'w2'::text, 'hybrid'::text, 'commission'::text, 'hourly'::text, 'salary'::text]))) |
| salon.employees | fk_employees_business | FOREIGN KEY (business_id) REFERENCES business_profiles(id) ON DELETE CASCADE |
| salon.employees | salon_employees_pkey | PRIMARY KEY (id) |
| salon.google_oauth_tokens | google_oauth_tokens_business_id_fkey | FOREIGN KEY (business_id) REFERENCES business_profiles(id) ON DELETE CASCADE |
| salon.google_oauth_tokens | google_oauth_tokens_pkey | PRIMARY KEY (business_id) |
| salon.meta_oauth_tokens | meta_oauth_tokens_business_id_fkey | FOREIGN KEY (business_id) REFERENCES business_profiles(id) ON DELETE CASCADE |
| salon.meta_oauth_tokens | meta_oauth_tokens_pkey | PRIMARY KEY (business_id) |
| salon.task_assignments | task_assignments_pkey | PRIMARY KEY (id) |
| salon.task_assignments | task_assignments_priority_check | CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text]))) |
| salon.task_assignments | task_assignments_source_check | CHECK ((source = ANY (ARRAY['manual'::text, 'recurring'::text, 'genie'::text, 'system'::text]))) |
| salon.task_assignments | task_assignments_status_check | CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text, 'skipped'::text, 'overdue'::text]))) |
| salon.task_assignments | task_assignments_task_id_fkey | FOREIGN KEY (task_id) REFERENCES salon.tasks(id) ON DELETE SET NULL |
| salon.task_comments | task_comments_assignment_id_fkey | FOREIGN KEY (assignment_id) REFERENCES salon.task_assignments(id) ON DELETE CASCADE |
| salon.task_comments | task_comments_pkey | PRIMARY KEY (id) |

## Appendix C — Deployment and privileged-function inventory

35 deployed Edge Functions were listed project-wide. Only Arowana/morning-brief deployments are included here; all were ACTIVE at inspection. Missing source-referenced slugs are recorded above. Three source implementations were sampled; no endpoints were invoked.

| Function | Version | Gateway verify_jwt | Source reviewed |
|---|---|---|---|
| morning-brief-generate | 18 | false | No |
| arowana-ai-coach | 18 | true | Yes |
| arowana-checkout | 14 | false | No |
| arowana-stripe-webhook | 11 | false | No |
| arowana-billing-portal | 3 | false | Yes |
| arowana-founders-count | 3 | false | No |
| arowana-research | 7 | false | Yes |
| arowana-coach | 4 | false | No |
| arowana-digest | 1 | false | No |
| arowana-explain | 2 | true | No |

| SQL function | SECURITY DEFINER | Explicit config | Anon EXECUTE | Authenticated EXECUTE |
|---|---|---|---|---|
| public.user_can_access_entity(eid uuid) | false | — | true | true |
| public.approve_journal_trade_candidate(p_candidate_id uuid) | false | — | true | true |
| public.ap_add_usage_cost(p_user uuid, p_feature text, p_period text, p_cost numeric) | true | search_path=public | false | false |
| public.ap_usage_summary(p_days integer) | true | search_path=public | false | true |
| public.ap_is_admin() | true | search_path=public | true | true |
| public.ap_protect_profile_columns() | false | search_path=public | true | true |
| public.ap_record_provider_call(p_day date, p_provider text, p_path text, p_user uuid, p_error boolean) | true | search_path=public | false | false |
| public.ap_claim_usage(p_user uuid, p_feature text, p_period text, p_limit integer, p_cost numeric) | true | search_path=public | false | false |

The function-name query used SQL `LIKE 'ap_%'`, whose underscore is a wildcard; it also returned `approve_journal_trade_candidate`. Its privilege metadata is recorded but its full business behavior was not audited. Helpers `salon.sg_has_access` and `salon.can_manage_business` were also inspected; both are SECURITY DEFINER with an explicit `public, salon` search path. The latter includes a `business_users` membership branch without a role restriction and employee role branches; full shared membership/employee mutation security remains outside this core audit.

### Arowana-related migration evidence

122 migration version/name records were returned. Relevant named entries below are evidence of deployed history, not migration SQL exports.

- `20260816033658` — daily_setups_unique_date
- `20260816033738` — morning_brief_cron_schedule
- `20260818115849` — watchlist_items_add_horizon_sector_longterm_fields
- `20260830025019` — create_ai_coach_usage_table
- `20260917140914` — ap_founders_waitlist
- `20260917164811` — watchlist_items_want_to_own
- `20260917193838` — arowana_billing_columns
- `20260917221443` — ap_risk_settings
- `20260917223345` — ap_roll_coach
- `20260918195140` — ap_usage_quotas
- `20260918195311` — ap_add_usage_cost
- `20260918195356` — ap_claim_usage_fix_ambiguity
- `20260918205447` — ap_provider_calls
- `20260918205502` — ap_usage_summary_rpc
- `20260925114036` — 20260927_security_profiles_config
- `20260925125913` — 20260925_ap_risk_settings_rules
- `20260925125919` — 20260926_ap_email
- `20260925130140` — views_security_invoker
- `20260926142054` — shared_views_security_invoker
- `20260926150054` — salon_views_security_invoker
- `20260926152934` — revoke_default_function_grants

## Appendix D — Security-advisor summary

Project-wide findings returned at inspection; counts are notices, not independently demonstrated exploits. Shared-app findings are included for owner routing rather than silently expanding this task into their remediation.

| Category | Level | Count | Guidance |
|---|---|---|---|
| auth_users_exposed | ERROR | 1 | [Supabase remediation](https://supabase.com/docs/guides/database/database-linter?lint=0002_auth_users_exposed) |
| rls_enabled_no_policy | INFO | 59 | [Supabase remediation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) |
| security_definer_view | ERROR | 2 | [Supabase remediation](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view) |
| function_search_path_mutable | WARN | 118 | [Supabase remediation](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable) |
| extension_in_public | WARN | 1 | [Supabase remediation](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public) |
| rls_references_user_metadata | ERROR | 1 | [Supabase remediation](https://supabase.com/docs/guides/database/database-linter?lint=0015_rls_references_user_metadata) |
| anon_security_definer_function_executable | WARN | 30 | [Supabase remediation](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) |
| authenticated_security_definer_function_executable | WARN | 70 | [Supabase remediation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) |
| auth_leaked_password_protection | WARN | 1 | [Supabase remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) |
| vulnerable_postgres_version | WARN | 1 | [Supabase remediation](https://supabase.com/docs/guides/platform/upgrading) |

Current [Supabase changelog](https://supabase.com/changelog) and official RLS/API docs were consulted. The changelog's PostgreSQL security update reinforces the advisor maintenance finding; no upgrade or extension repair was attempted. Project listing reported PostgreSQL 15.8.1.121; verify supported upgrade planning separately.


## Appendix E — Repository reference ledger

Literal call/URL references plus reviewed dynamic aliases for goals, journals and watchlist items. Line numbers refer to unchanged application source. Relation names alone do not select schemas; consult Appendix A and explicit headers/client configuration. Comment-only `retirement_inputs` is included as a planned dependency. Diagnostic `spec.table` and journal table variables are covered by the named model inventory, not claimed as exhaustive runtime resolution.

| Kind | Name | Source references |
|---|---|---|
| Edge | `arowana-ai-coach` | `api-diagnostics.html:277`, `arowana-trader.html:2333`, `trade-plan-builder.html:791`, `trading-command.html:7914`, `tradingcommand.html:6871`, `whale-tracker.html:2081` |
| Edge | `arowana-billing-portal` | `account.html:1731` |
| Edge | `arowana-checkout` | `checkout.html:875`, `pricing.html:1024` |
| Edge | `arowana-founders-count` | `index.html:415` |
| Edge | `arowana-research` | `js/market-data.js:17` |
| Edge | `morning-brief` | `ai-morning-brief.html:1916` |
| Edge | `schwab-auth-callback` | `schwab-callback.html:65` |
| RPC | `ap_usage_summary` | `admin-usage.html:214` |
| Relation | `ai_briefs` | `trading-command.html:10257` |
| Relation | `ap_founders_waitlist` | `index.html:397` |
| Relation | `ap_risk_settings` | `js/risk.js:119`, `js/risk.js:83`, `onboarding.html:312` |
| Relation | `ap_roll_coach` | `options-hub.html:5195`, `options-hub.html:5200` |
| Relation | `ap_usage` | `account.html:2397` |
| Relation | `app_config` | `admin.html:1014`, `admin.html:980` |
| Relation | `arowana_tools` | `admin.html:1182`, `admin.html:1188`, `admin.html:1203`, `admin.html:817`, `admin.html:860` |
| Relation | `arowana_webhooks` | `admin.html:1094`, `admin.html:1096`, `admin.html:1100`, `admin.html:1108`, `admin.html:1123`, `admin.html:696`, `admin.html:757`, `admin.html:776` |
| Relation | `business_profiles` | `overview.html:958`, `settings.html:1366`, `settings.html:1394` |
| Relation | `business_settings` | `settings.html:1040`, `settings.html:913` |
| Relation | `cc_candidates` | `options-hub.html:4548`, `options-hub.html:4553` |
| Relation | `check_ins` | `settings.html:1147` |
| Relation | `csp_candidates` | `options-hub.html:4898`, `options-hub.html:4903` |
| Relation | `daily_bias_runs` | `daily-bias.html:539` |
| Relation | `daily_setups` | `arowana-trader.html:1722`, `trading-command.html:7076`, `tradingcommand.html:6091`, `whale-tracker.html:1699` |
| Relation | `entities` | `js/account-registry.js:142`, `js/account-registry.js:207`, `js/account-registry.js:214` |
| Relation | `finance_transactions` | `overview.html:1036` |
| Relation | `financial_accounts` | `js/account-registry.js:147`, `js/account-registry.js:232`, `js/account-registry.js:239`, `js/account-registry.js:246`, `js/account-registry.js:255`, `js/account-registry.js:278` |
| Relation | `goals` | `portfolio-advisor.html:2122`, `portfolio-advisor.html:2227`, `portfolio-advisor.html:2231` |
| Relation | `google_oauth_tokens` | `settings.html:1464`, `settings.html:1493` |
| Relation | `journal_trades` | `buy-sell-signal.html:546`, `master-journal.html:925`, `short-term-dashboard.html:3547` |
| Relation | `market_snapshots` | `options-hub.html:4567`, `options-hub.html:4928`, `options-hub.html:6811`, `options-hub.html:7551`, `portfolio-command.html:5764`, `trading-command.html:10369` |
| Relation | `meta_oauth_tokens` | `settings.html:1636`, `settings.html:1662` |
| Relation | `option_chains` | `master-journal.html:937` |
| Relation | `option_roll_chains` | `option-roll-tracker.html:1399`, `option-roll-tracker.html:1411`, `option-roll-tracker.html:1439` |
| Relation | `portfolio` | `long-term-portfolio.html:578`, `long-term-portfolio.html:587`, `long-term-portfolio.html:590`, `long-term-portfolio.html:596`, `long-term-portfolio.html:703`, `portfolio-command.html:11973`, `portfolio-command.html:12025`, `portfolio-command.html:12056`, `portfolio-command.html:12060`, `portfolio-command.html:6981`, `portfolio-command.html:8688`, `portfolio-command.html:8696`, `portfolio-command.html:8717` |
| Relation | `portfolio_options` | `portfolio-command.html:12124`, `portfolio-command.html:12145`, `portfolio-command.html:12156` |
| Relation | `profiles` | `account.html:1635`, `admin.html:1242`, `admin.html:1258`, `admin.html:632`, `admin.html:879`, `admin.html:924`, `admin.html:932`, `admin.html:948`, `admin.html:949`, `billing.html:667`, `js/plan.js:161` |
| Relation | `retirement_inputs` | `retirement-planner.html:771` |
| Relation | `salon.employees` | `dashboard.html:1152` |
| Relation | `salon.task_assignments` | `dashboard.html:1128` |
| Relation | `salon.task_comments` | `dashboard.html:1137` |
| Relation | `salon.v_task_assignments_live` | `dashboard.html:1156` |
| Relation | `sector_sentiment` | `sector-sentiment-gauge.html:364`, `sector-sentiment-gauge.html:372`, `sector-sentiment.html:268`, `sector-sentiment.html:277` |
| Relation | `tj_options` | `analysis-central.html:9498`, `js/journal-sync.js:277`, `js/journal-sync.js:59`, `js/risk.js:96`, `options-hub.html:4560`, `portfolio-command.html:5738`, `portfolio-command.html:7373`, `trading-command.html:10342`, `trading-command.html:10449`, `trading-command.html:10670` |
| Relation | `tj_stocks` | `analysis-central.html:9485`, `js/holdings-source.js:89`, `js/journal-sync.js:264`, `js/journal-sync.js:58`, `options-hub.html:4559`, `portfolio-command.html:5750`, `portfolio-command.html:7062`, `trading-command.html:10351`, `trading-command.html:10453`, `trading-command.html:8831`, `tradingcommand.html:7675` |
| Relation | `trading_journal` | `option-roll-tracker.html:1351` |
| Relation | `user_api_keys` | `account.html:1495`, `account.html:1505`, `account.html:1539`, `account.html:1918`, `js/app-config.js:390` |
| Relation | `user_cash_balances` | `portfolio-command.html:12192`, `portfolio-command.html:8861` |
| Relation | `user_deployment_plans` | `portfolio-command.html:10605`, `portfolio-command.html:10677` |
| Relation | `user_preferences` | `settings.html:791` |
| Relation | `v_finance_month_summary_all` | `overview.html:969` |
| Relation | `v_finance_top_categories_month_all` | `overview.html:973` |
| Relation | `watchlist_items` | `analysis-central.html:6815`, `arowana-trader.html:1077`, `arowana-trader.html:1095`, `arowana-trader.html:1097`, `arowana-trader.html:1102`, `arowana-trader.html:1108`, `arowana-trader.html:1111`, `arowana-trader.html:1170`, `daily-bias.html:515`, `onboarding.html:289`, `options-hub.html:4912`, `options-hub.html:6794`, `options-hub.html:7543`, `options-hub.html:7659`, `options-hub.html:7664`, `options-hub.html:7676`, `options-hub.html:8331`, `short-term-watchlist.html:1070`, `trading-command.html:10360`, `trading-command.html:10460`, `watchlist.html:3163`, `watchlist.html:3416`, `whale-tracker.html:1035`, `whale-tracker.html:1053`, `whale-tracker.html:1055`, `whale-tracker.html:1060`, `whale-tracker.html:1066`, `whale-tracker.html:1069`, `whale-tracker.html:1128` |
| Relation | `watchlists` | `analysis-central.html:6810`, `arowana-trader.html:1068`, `arowana-trader.html:1072`, `daily-bias.html:490`, `onboarding.html:278`, `onboarding.html:282`, `options-hub.html:4909`, `options-hub.html:6791`, `options-hub.html:7538`, `options-hub.html:7642`, `options-hub.html:8326`, `short-term-watchlist.html:1162`, `short-term-watchlist.html:1165`, `trading-command.html:10357`, `trading-command.html:10457`, `trading-command.html:8066`, `trading-command.html:8068`, `tradingcommand.html:7004`, `tradingcommand.html:7006`, `watchlist.html:3372`, `watchlist.html:3377`, `watchlist.html:3389`, `watchlist.html:3401`, `watchlist.html:3417`, `whale-tracker.html:1026`, `whale-tracker.html:1030` |
