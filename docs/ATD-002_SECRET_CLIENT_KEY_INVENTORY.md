# ATD-002 — Secret and client-key migration inventory

Completed: 2026-09-28. Baseline: `47fe1ca` (merged ATD-001 on `main`). Branch: `codex/ATD-002-secret-client-key-inventory`. Status: inventory complete; remediation and owner decisions pending.

## Executive summary

The client-key migration is **not complete**. Browser credential entry, plaintext cloud synchronization, hydration into browser globals, query-string provider keys, and credential-bearing webhook requests still coexist with newer server-proxy paths. Hiding Account's key UI and deleting one localStorage entry does not retire those paths.

The principal findings are:

1. A credential-like Twelve Data literal remains at `js/option-roll-analyzer.js:9`, used by the quote request at line 19. It also exists in reachable local Git history. Its value is deliberately not reproduced; validity and revocation were not tested.
2. `account.html` still loads/upserts `user_api_keys`, while `js/app-config.js` hydrates those values into `ap_user_api_keys` and `window.AP_USER_KEYS`. Account's later local deletion cannot guarantee cloud, closure, or global cleanup.
3. The shared webhook helper forwards Finnhub/Claude/Alpha Vantage keys to a caller-selected HTTP(S) URL. Morning Brief and Money Flow forward user access tokens to configurable webhook destinations. These are separate credential classes and require separate controls.
4. Additional key stores (`arowana_iv_apikeys`, `td_api_key`, `TWELVE_DATA_KEY`, `finnhub_api_key`) and configurable destinations survive outside the central account flow. User-switch quarantine can preserve credential values; several storage prefixes are not covered at all.
5. The unrelated `settings.html` accepts OpenAI and Stripe secrets, writes them into `salon.business_settings.settings_json`, and reads the settings JSON back into the browser. Archiving the page later does not rotate previously submitted credentials or remove stored copies.
6. The existing repository secret check passes because its patterns do not cover the remaining literal. An additional redacted in-memory scan found the same candidate in current files and Git history, not an active OpenAI/Stripe/service-role literal.

No credentials were used, validated, rotated, revoked, copied into this report, or moved. No browser session, production endpoint, database, provider account, n8n workflow, or external deployment was accessed. Only documentation is changed. No follow-on task or migration implementation started.

## Scope and evidence standard

- Read required project documents in order, ATD-001 findings, `SECURITY.md`, `.env.example`, `.gitignore`, secret-check script and CI configuration.
- Inventoried 206 first-party HTML/JS/JSON files (174 HTML, 31 non-vendored JS, one JSON). The vendored Supabase SDK was included in literal scanning but not treated as custom application credential logic.
- Scanned all 250 baseline tracked files as bytes/text for known credential formats, decoded JWT role claims locally without using the tokens, and inspected 16 XML/relationship members inside the two tracked Word documents. Binary scanning is not visual/OCR or encrypted/archive forensics.
- Scanned all 250 unique blobs reachable from four locally available commits via local Git object access. No fetch, remote secret scan, unreachable-object search, CI-log search or history rewrite was performed.
- Trace evidence uses source filenames and one-based baseline line numbers. The appended per-file and storage ledgers are search/navigation aids; matches in comments or copied shells are not proof of executed requests. Confirmed flows below were inspected at their call sites.
- No ignored files were reported by Git at inspection. Developer-machine credential stores, browser localStorage values, OS environment values and files outside this repository were not read.

Confidence labels: **confirmed code** = a literal or implemented local data flow; **conditional** = execution needs a session, user input, restored storage, optional dependency or reachable service; **unknown backend** = server enforcement/retention cannot be established from this checkout. P0 means resolve before affected real-user/credential-connected use; P1 means required migration preparation; P2 means deferred/retired feature cleanup. A P0 inventory finding does not mean a successful exploit or a valid leaked credential was demonstrated.

## Credential classes and handling decisions

| Class | Observed examples | Inventory decision |
|---|---|---|
| Private provider key | Twelve Data candidate; runtime Finnhub, FMP, Alpha Vantage, Claude/OpenAI values | No literal, localStorage, browser-readable table, request header to arbitrary URLs or log copies in the target design. Move use to server-owned provider adapters. |
| Supabase public configuration | Project URL and nine JWT literal occurrences decoding to `role=anon` | Public application configuration, not private provider secrets. Centralize by environment; verify grants/RLS separately. Decoding a claim does not validate a token signature or live privilege. |
| Supabase privileged credential | Service-role names/comments and blank env template; no matching privileged literal found | Server-only. Absence of detected literals does not prove deployed functions never expose one. |
| User authentication credential | Session access token, refresh-token/recovery handling, SDK session storage | Not a provider API key. Send access tokens only to approved app authentication boundaries; never forward refresh tokens to market-data/AI workflows. Preserve sign-in/recovery semantics during migration. |
| Webhook URL | Configured and user-entered n8n URLs, including a value named `ap_retirement_ai_key` | Destination/configuration, potentially a capability if the server relies on an unguessable URL. Not automatically an API secret; do not treat URL secrecy as authorization. |
| OAuth/public identifiers | Google client ID, Meta app ID, Stripe publishable key | Public identifiers/configuration; distinguish from client secrets, access/refresh tokens and Stripe secret keys. |
| Sensitive user context | Positions, account size, trading history, screenshots, retirement projection and chat | Not authentication credentials, but requires destination restrictions and minimal payload/retention policy. |
| Placeholder/removed marker | Removed Twelve Data marker, removed OpenAI bearer value, sample project/webhook hosts | Not working credential evidence. Do not restore by embedding new keys in the browser. |

The public/privileged distinction and server-side secret storage recommendations align with [Supabase API-key guidance](https://supabase.com/docs/guides/getting-started/api-keys) and [Edge Function environment guidance](https://supabase.com/docs/guides/functions/secrets). These references inform requirements, not a claim that this repository uses their current APIs. The skill-requested markdown changelog could not be fetched by the browser tool; the HTML [changelog](https://supabase.com/changelog) was consulted instead. No Supabase API implementation or version migration is performed here.

## Findings register

| ID / priority | Source evidence and current flow | Exposure / confidence | Required migration outcome |
|---|---|---|---|
| CK-01 / P0 | `js/option-roll-analyzer.js:9,19` embeds a 32-hex key-like value and inserts it into Twelve Data price requests | Confirmed source/history exposure; no static HTML include found for helper, but public file/history access is enough to expose a literal. Validity unknown. | Owner confirms/revokes or rotates through provider account; later authorized change removes source literal. Do not insert replacement into client. Assess deployed copies and old archives. |
| CK-02 / P0 | `account.html:1456` upserts `{user_id,service,api_key}`; line 1530 loads raw key rows; line 1606 merges cloud/local state and may upload local-only keys | Confirmed code; session and backend conditional. Commented SQL at line 1381 describes plaintext and ownership RLS, not a deployed policy. | Retire browser key read/write APIs. If per-user credentials remain a requirement, provision server-side through an approved flow and expose only connection status. |
| CK-03 / P0 | `js/app-config.js:390,430,469` reads `user_api_keys`, writes localStorage and global AP_USER_KEYS; existing-local fast path occurs before user lookup | Confirmed code; startup/session/dependency conditional. Every loading page inherits a possible hydration path, even without its own key form. | Replace hydration with non-secret capability/status metadata; do not keep a legacy fallback that repopulates keys. |
| CK-04 / P0 | `js/app-config.js:76,267` combines X-User-ID/Plan and X-Finnhub/Claude/Alpha-Key headers, then accepts an arbitrary HTTP(S) endpoint | Confirmed request construction; key presence, invocation and CORS/network affect execution. Client identity/plan headers are not authenticated authority. | Fixed operation identifiers, approved app endpoint, verified user JWT and server entitlements; never accept client-selected upstream URLs or raw provider keys in normal data requests. |
| CK-05 / P0 | `ai-morning-brief.html:1914,2188` resolves configurable URL then sends session bearer token; `money-flow-alert.html:5245,5252` does the same for its configured service | Confirmed conditional forwarding path. No client destination allowlist observed; backend JWT verification described in comments is unverified. | Browser sends JWT only to owned, allowlisted API; server calls n8n privately. If direct workflow access is retained by explicit design, constrain exact trusted destination and prove JWT/audience/ownership enforcement. |
| CK-06 / P0 | `analysis-central.html:7949,7961` validates a user-entered FMP key with direct fetch and persists it; valuation pages store provider maps under `arowana_iv_apikeys` | Confirmed browser entry/storage/direct-provider use; central Account UI removal does not cover these pages. | Replace provider entry with connection/capability status. Delete retired key copies only after approved credential migration and inventory of affected owners. |
| CK-07 / P0 | `js/session-user.js:138,152` quarantines values under `ap_quarantine_<uid>_<key>`; legacy `arowana_*`, `td_api_key`, `TWELVE_DATA_KEY` do not match its user prefixes | Confirmed prefix/retention behavior; page inclusion and user change conditional. Quarantined secrets remain readable by same-origin JS; this is not encryption or deletion. | Treat secret cleanup separately from journal recovery. Inventory quarantine copies and alternate namespaces; avoid bulk-clearing financial records. |
| CK-08 / P0 | `settings.html:543,637,913,1026,1034,1040` accepts OpenAI/Stripe secret inputs, upserts and retrieves settings JSON | Confirmed unrelated-product browser path; stored values/deployed access unknown. Password input masking does not protect the value from JS or database responses. | Exclude Salon routes from trading deployment in a later approved task; coordinate credential ownership/rotation with that product. Never migrate these secrets into Arowana client config. |
| CK-09 / P1 | `ai-trading-agent.html:372`; `portfolio-advisor.html:1931,2420` call Anthropic directly with Content-Type only; `js/invest-helper-logic.js:166` calls OpenAI with a removed bearer placeholder | Confirmed direct-client AI requests, **not evidence of a live Anthropic key sent**. Missing auth is an incomplete integration, not permission to add a browser secret. | Route through server AI boundary with verified identity, minimal context, quotas and approved models. Retire orphan helper rather than repairing its client key. |
| CK-10 / P1 | `js/market-data.js:58` intercepts selected Finnhub fetches and strips `token`, using a fixed research function with session JWT | Useful existing server boundary, but selected pages only; other provider calls and BYOK preconditions remain. Global shim is not complete migration. | Preserve/verify server proxy contract; replace caller key preconditions and other providers with normalized authenticated services. Validate endpoint/path/query allowlists server-side. |
| CK-11 / P1 | `ai-morning-brief.html:2186` logs selected webhook URL; Command/Trader variants log failed/configured workflow URLs; quality screen exports webhook in settings JSON | Confirmed URL/config leakage surfaces. Full error objects/responses may also contain sensitive upstream data; exact deployed content unknown. | Redact credentials, auth headers, URL query values/capability paths and raw upstream errors. Export connection IDs/status, not secret endpoints. |
| CK-12 / P0 | `scripts/check-secrets.py` checks OpenAI-like strings, limited service-role assignment hints and PEM only | Confirmed detection gap: repository check passes while CK-01 remains. Git history and DOCX interiors are not covered by that script. | Expand checks in a separate scoped change with synthetic fixtures, safe reporting and false-positive handling; include service-role JWT role decoding and provider-key contexts. |
| CK-13 / P1 | `schwab-callback.html:65` posts OAuth code/state and session JWT to same-origin function; source for exchange/refresh/token storage absent | Confirmed client contract; server behavior unknown. Broker Connections is a UI prototype, not proof of secure tokens or an active connection. | Server-only exchange/refresh, state binding, allowed redirect targets, encrypted token storage, read-only scopes and bounded audit logging. No direct broker private credentials in browser. |

## End-to-end credential flows

### Central key store and incomplete removal

```text
Existing browser ap_user_api_keys / FMP prompt / prior user_api_keys rows
       -> account.html sync (upsert/select/delete user_api_keys)
       -> app-config.js startup hydration
       -> localStorage ap_user_api_keys + window.AP_USER_KEYS
       -> direct provider query strings OR shared webhook credential headers
```

`account.html:1308` captures browser keys in a closure. Its DOMContentLoaded initializer at line 2157 calls `init()` and key sync. The immediate cleanup block at line 2420 removes `ap_user_api_keys`, but does not erase the earlier closure, cloud rows, or all globals/alternate stores. Async cloud sync/hydration can subsequently repopulate storage. This is a source-level ordering hazard, not a reproduced browser race. Account's visible key-entry controls have already been removed; calling this a fully active key-entry screen would overstate the current UI.

`SUPPORTED_SERVICES` at `account.html:1412` includes `finnhub`, `claude`, `openai`, `alphavantage`, `fmp`, but not Twelve Data. The hydration function accepts all service names returned by the table. The valuation store uses another property vocabulary (`twelve`, `fmp`, `av` versus provider names in the alternate page). A migration must reconcile aliases rather than assume one key schema.

### Browser storage inventory

| Storage key / shape | Writers / readers / removal evidence | Migration requirement |
|---|---|---|
| `ap_user_api_keys` provider object | Account sync; FMP prompt in Research; app-config hydration; many readers listed in appendix; some sign-outs and Account clear it | Remove all producer/consumer paths together; do not assume one logout covers all pages or globals. |
| `window.AP_USER_KEYS` and closure copies | app-config local/cloud fast paths; page-local AP_USER_KEYS/API_KEYS objects | Clear/reinitialize on user change and retirement; removing persisted storage alone leaves current-tab values. |
| `arowana_iv_apikeys` | `ai-valuation.html:345,356`; `intrinsic-value.html:5799,5813`; both read/write/clear | Independent provider map; outside `arowana_*` coverage of current session-user prefix list. Preserve valuation history separately. |
| `td_api_key` | `position-sizer_fresh.html:1843`, `short-term-dashboard.html:2590` read; no static writer found | Legacy manually provisioned Twelve Data key; remove reader, inventory prior browser copies. |
| `TWELVE_DATA_KEY` / `window.TWELVE_DATA_KEY` | `my-watchlist.html:84` read; no static writer found | Legacy storage/global injection; no assumption that absence of writer means absence of stored value. |
| `finnhub_api_key` | `options-hub.html:3378` fallback read; no static writer found | Retire fallback; current scope repair may quarantine prefix but still retain value. |
| `ap_retirement_ai_key` | `retirement-planner.html:1954` saves; 1972 reads; 1998 removes | Actually a user-entered webhook URL, not a raw Anthropic key. Posts complete retirement projection; migrate/defer destination ownership. |
| `ap_morning_brief_webhook`, `ap_ai_coach_webhook`, `arowana_st_main_webhook`, `arowana_lt_main_webhook`, `arowana_movers_webhook` | Legacy readers/config fallbacks across brief/dashboards/coaches | Replace URL overrides with approved operation IDs; no static writer for several aliases. Old values can still exist. |
| `arowana_chart_webhook_url`, `arowana_analyzer_webhook_url` | Chart/Stock Analyzer settings and readers; chart page currently has a known syntax failure | Preserve business input, not URL capabilities; fix/delete code only under a future task. Broken script does not clear prior storage. |
| `arowana_base_breakout_webhook`, `arowana_bb_snapback_webhook` | Base variant saves/reads; second variant and BB read stored/config values | Retire independent destination configuration when scanners merge. |
| `ap_st_morning_brief_url_v1` | Morning-brief widgets in long/short-term dashboards and position-sizer_fresh; separate cached result key | Include shared widgets in cleanup; cached report is separate from endpoint value. |
| `ltp_webhook` | `long-term-portfolio.html:566,570` | Remove arbitrary portfolio-refresh destination and review portfolio payload retention. |
| `daily_summary_settings_v1.webhook` | `daily-summary.html:166,189` | Nested destination within saved settings; do not only search names containing key/token. |
| `div_tracker.webhook` | `dividend-tracker.html:5146,5153` | Nested endpoint beside holdings; surgically remove secret/destination field, preserve holdings. |
| `quality-screener-settings.json` export | `quality-screener.html:443,448` gathers webhook and exports JSON | No browser storage required for exposure; sanitize future exports and assess prior shared copies. |
| `gs_auth_user_v1`, SDK `sb-*` session storage | Login/signup/session helpers plus cached access-token readers; Supabase SDK manages session persistence | Keep auth separate from provider-key cleanup. Never blanket-delete sessions/trades as an undocumented migration. |
| `ap_quarantine_<uid>_*` | `js/session-user.js:152` retains prior user-scoped values | Quarantine is recovery storage, not a secret vault. Credential copies need targeted retirement; journal recovery data must remain recoverable. |
| `sg_google_client_id`, `sg_meta_app_id`, `google_oauth_state`, `google_oauth_return`, `sg_google_<business>` | Unrelated Salon settings | IDs and OAuth state are not private provider secrets. Archive with their product; verify missing callback services separately if product retained. |

### Provider and sensitive input migration matrix

| Provider / credential | Current sources and transmission | Server-side requirement / expected client result |
|---|---|---|
| Twelve Data | Literal helper, removed-key markers in old ticker strips, two legacy key aliases, valuation provider maps, strategy-analyzer key map; `apikey` query parameter | Bar/quote adapter with owned credentials and source/freshness metadata; user sees data status, never a replacement key. Rotate CK-01 if valid. |
| Finnhub | Central map, `finnhub_api_key`, browser forms/old consumers; `token` queries; partial research shim | Authenticated quote/profile/candle capability service; remove BYOK checks even when shim would intercept request. |
| FMP | Research prompt direct test then persistence; central/valuation maps; POC and fundamental requests use `apikey` | Normalize approved FMP operations; avoid arbitrary proxy paths; server owns credential and entitlement decisions. |
| Alpha Vantage | Central and valuation maps, manual inputs in `intrinsic-value-rsi.html:319` and weekly report at line 260; query `apikey` | Shared history/fundamental adapter, central quota/error handling; manual browser entry retired. |
| OpenAI | Central key service name; orphan direct request uses removed placeholder; Salon settings secret field; mock n8n workflow node | AI credential in server/runtime credential store, not browser or general settings JSON; user context and model controls explicit. |
| Anthropic / Claude | Central map forwarded as X-Claude-Key by shared helper; direct requests in old agent/advisor have no API-key header | Server AI broker; do not fix unauthenticated legacy calls by adding client key. |
| Supabase public URL/anon | Nine decoded anon occurrences listed below; config/fallbacks and SDK clients | Central public environment config; assess publishable-key migration separately. No need to treat public anon literal as a leaked service-role secret. |
| Supabase service-role/secret | Blank env template and source comments; no detected literal | Privileged server components only; no browser JSON/config output; user-scoped operations should preserve enforceable ownership. |
| Stripe | Account/checkout/portal functions use user sessions; separate Salon settings accepts publishable and secret keys | Billing backend owns private/signing secrets; users receive hosted checkout/portal URL, not Stripe secrets. Source for billing/webhook backend absent. |
| Schwab | OAuth code/state callback; env template names client ID/secret/redirect | Server exchange/refresh and encrypted token lifecycle; UI gets connection/status data only, read-only broker scopes. |
| Google/Meta | Public client/app IDs in Salon browser; status-only selects on OAuth token tables; missing callback functions | Do not infer raw OAuth token download from table name: observed selects are metadata. If retained in separate product, enforce server-only token exchange/refresh. |
| Telegram | Setup guide references bot endpoint/token instructions, no matched secret literal | Historical documentation only; do not implement bot credential handling as part of Trading Desk migration. |
| Alpaca / FRED / SEC | Alpaca secrets named in blank env template; target provider docs, no implemented secret paths found for planned feeds | Define entitlement/auth needs under ATD-004; provision only server-side in a later implementation task. |

Public anon JWT literal locations: `admin.html:570`, `analysis-central.html:6731`, `buy-sell-signal.html:517`, `portfolio-advisor.html:2123`, `short-term-dashboard.html:3541`, `stock-analyzer.html:562`, `js/app-config.js:60`, `js/supabase-init.js:5`, `js/config.json:5`. No token values are reproduced. RLS, grants and actual project key status remain unverified.

## Webhook exposure and trust boundaries

| Family | Selection / payload / auth visible in source | Required destination boundary |
|---|---|---|
| Shared `window.callWebhook` | app-config defaults + JSON configuration or absolute caller URL; arbitrary data plus client user/plan and provider-key headers; browser-local rate counter | Named operations only; server JWT verification and authoritative quotas; strip provider keys and untrusted user/plan headers. |
| Morning Brief / Money Flow | Config/local overrides; symbols/filters/notes; session bearer JWT | Owned app API should call private workflow; verify actual workflow auth rather than trust comments. |
| Arowana Trader / whale clone | Scan/config webhook wrappers coexist with newer `arowana-ai-coach` requests | Inventory both transports. Preserve newer JWT-backed coach path; replace remaining legacy scans independently. |
| Chart / Stock Analyzer | User-entered/configured endpoints; chart images/notes or ticker/mode; some paths send only Content-Type | Prevent personal screenshots/context going to arbitrary destinations; no claim CORS alone protects data. |
| Legacy scanner pages | Fixed, placeholder or configurable URLs; scan filters/tickers; often no authenticated header in page code | Single scanner service and per-user capability checks; avoid recreating obsolete prototypes. |
| Portfolio/dividend/quality/retirement | User URL with holdings/projection/filter payloads; nested settings and downloadable config | Destination and payload minimization are required even if no provider API key is transmitted. |
| Broker prototype | Named connect/callback/sync workflow endpoints in UI design text | Unimplemented references are not deployed services; server-only tokens and jobs later. |
| Admin webhook registry | `admin.html` manages `arowana_webhooks`, `app_config`, tool/user metadata | Require verified privileged server authorization. Client controls and row names do not prove safe writes. |

Named webhook references include morning scan/daily brief, moat inference, momentum breakout/volume/HOD/fade/gap/earnings, bulk quotes, symbol lookup, market status, chart analysis, position sizing, risk calculation, dividend screening, CLAP pullback, stock checking, option roll, quality screening, retirement narrative and trade signals. Some are live-looking literals and others placeholders or comments. The appended source ledger records all matching files, without redistributing complete configured endpoint URLs.

Server components needed but absent from the repository: research/AI coach handlers, n8n workflow definitions/auth, provider credential provisioning, credential status API, secret encryption/key management and rotation jobs, broker exchange/refresh/sync, billing/signature verification, and schema/RLS definitions. The mock covered-call JSON workflow does not supply this infrastructure. `.env.example` is blank documentation; no backend env loader or automatic secret provisioning exists in this static checkout.

## Recommended migration contract (requirements, not implementation)

1. **Ownership:** identify platform-owned versus user-owned subscriptions before moving values; maintain a registry of provider, environment, owner, credential identifier/status and last rotation, never raw values in reports/issues.
2. **Server storage:** platform provider secrets belong in the selected server secret facility. If user-specific credentials remain necessary, use a private encrypted store and dedicated server credential service. RLS-protected plaintext readable by the browser does not satisfy the current project rule.
3. **Browser interface:** authenticated operations receive business inputs (symbol, range, strategy, approved context) and return normalized results/status. No arbitrary upstream URL, provider key, service-role credential, model secret or refresh token accepted in routine data calls.
4. **Identity:** verify user access tokens server-side and derive ownership there. Treat X-User-ID, X-User-Plan, local plan caches and user-editable metadata as untrusted. Prove authorization for every record/service; do not copy user IDs from the request into privileged writes unchecked.
5. **Destination control:** allowlist upstream providers/paths/query fields and workflow destinations; bound timeouts, payloads, redirects and request counts. Do not replace a browser arbitrary-URL proxy with a server SSRF/open-proxy endpoint.
6. **Response/logging:** never echo keys, upstream auth headers, full capability URLs or raw provider error bodies. Expose safe connection/entitlement status, timestamps and redacted request IDs. Separate financial context logs from security audit metadata.
7. **Removal order:** first establish replacement service and owner-approved rotation/containment; then stop cloud/local producers, migrate consumers, and perform targeted credential-copy cleanup. Prevent startup hydration/backfill from restoring removed values. Do not migrate revoked keys into the new store.
8. **Retention:** enumerate database rows, browser aliases, current-tab globals/closures, quarantine keys, exports, deployed bundles, cached files and repository history. Rewriting Git alone does not revoke a key. Preserve trade/journal/valuation records independently from secret fields.
9. **Failure behavior:** if a service is unavailable or entitlement missing, show unavailable/connection status. No silent return to BYOK, anonymous privileged request, user-supplied URL, embedded placeholder key or fabricated market data.
10. **Environments:** use DEV-only data for implementation tests. No production key rotation, table deletion, workflow rewrite or deployment without a separately authorized scope.

### Acceptance checks for a future remediation task

- Synthetic credential fixtures for the existing and expanded scanner: provider formats, contextual opaque keys, service-role JWT, public anon JWT, placeholders and benign hashes; never use an actual key as a fixture.
- Static source checks demonstrate all legacy provider-key producers/consumers and arbitrary credential-bearing destination fallbacks are removed or explicitly isolated from deployment.
- DEV network inspection shows only approved browser destinations; no provider secrets in URLs/headers/bodies, storage, downloadable exports or logs. User access JWT is allowed only at intended auth boundaries.
- Two-user tests cover logout, account switching, hydration races, same-tab globals, multi-tab updates, alternate storage aliases and quarantine retention; journal data remains isolated and recoverable.
- DEV endpoint tests reject missing/invalid users, wrong ownership, spoofed user/plan fields, unapproved upstream paths/URLs and excessive payload/rate. Secret status API returns metadata only.
- Verify actual RLS/grants and credential-table exposure with ATD-005; do not execute the diagnostic page against production as proof.
- Verify rotation/revocation with the credential owner without disclosing values; confirm old credential no longer authorizes access and rollback cannot restore insecure browser keys.

## Recommended order and owner decisions

1. Review CK-01 and arrange owner-managed revocation/rotation if the literal is real; inventory completion does not remove the exposure.
2. Approve which deprecated/Salon routes can leave future deployment and whether user-specific provider credentials remain a product requirement. Default recommendation: platform server credentials with explicit per-user entitlements, not browser BYOK.
3. **Recommended next existing task: ATD-005 — Supabase schema/RLS audit**, using sanitized DEV schema/function/workflow evidence. This establishes the actual `user_api_keys`/settings exposure and server boundaries. ATD-004 provider contracts also precedes a complete provider migration.
4. Assign a separate, narrowly scoped remediation task for credential containment, scanner coverage and replacement flows. No code changes or new task IDs are silently created by this report.
5. Stop for review. ATD-003/004/005 and feature implementation remain unstarted here.

Decisions needed: credential owner/status; approved platform versus per-user key model; approved workflow origins/ownership; whether Salon/retirement/old scanner routes remain deployed; DEV backend evidence availability; retention policy for old key rows, browser quarantine and exports. No raw credential should be supplied to the agent to answer these questions.

## Verification record

- Existing `python -B scripts/check-secrets.py`: passed (exit 0); its limited patterns do not detect CK-01.
- Additional in-memory scan patterns: OpenAI/Anthropic-style keys, Stripe secret/restricted keys, Supabase secret strings, GitHub/AWS/Google/Slack formats, PEM, contextual 32-hex key assignments, and decoded service-role JWT claims. One credential-like finding: CK-01. No matching values printed or saved.
- Current scan: 250 baseline tracked files and 16 DOCX XML/relationship members. Local history: four reachable commits, 250 unique blobs; same credential-like candidate in one blob. This is not proof that arbitrary opaque/encrypted/encoded secrets, unreachable history or external deployments are clean.
- All nine parseable JWT literals in first-party source decode to anon role. No JWT was used to access a service or cryptographically verified.
- Completion checks passed: 206/206 unique first-party source rows, 402 storage-operation references, appendix table structure, absence of the identified literal and all source JWT values from this report, and `git diff --check`. Git changed-file/untracked-file comparison confirmed only this report, `TASKS.md` and `PROJECT_STATUS.md` changed; application files remain unchanged.
- No runtime/browser/production/RLS tests. No application code changed, so ATD-001's documented syntax failures were not repaired or re-executed as part of this inventory.


## Appendix A — Complete first-party source coverage

All 206 tracked first-party HTML/JavaScript/JSON files at the baseline are listed below. Numbers are source lines, not values. These mechanically collected signals include comments, templates and unused code; the findings above distinguish confirmed flows from signals. An em dash means no match in that column, not proof of safety. Shared script columns recognize static script includes only; runtime loading and transitive behavior require later runtime checks. Vendor SDK implementation is excluded from this first-party trace ledger and remains covered by the tracked-file literal scan.

| File | Key handling signals (lines) | Provider/destination signals (lines) | Session/public-config signals (lines) | Direct shared includes |
|---|---|---|---|---|
| `404.html` | — | — | — | — |
| `about.html` | — | — | — | — |
| `account.html` | 1308, 1381, 1383, 1387, 1396, 1398, 1411, 1456, 1482, 1495, 1505, 1530, 1539, 1540, 1551, 1552, 1586, 1606, 1610, 1613, 1614, 1616, 1618, 1909, 1910, 1918, 2096, 2237, 2249, 2261, 2426, 2427 | 1414, 1425, 1633, 2246 | 1014, 1428, 1610, 1612, 1613, 1729, 1733 | `app-config.js` |
| `admin-usage.html` | — | — | — | `app-config.js` |
| `admin.html` | — | 73, 194, 209, 215, 218, 226, 235, 236, 240, 244, 245, 246, 249, 250, 393, 394, 396, 397, 409, 410, 429, 430, 574, 656, 677, 680, 693, 694, 696, 700, 701, 702, 706, 707, 708, 710, 711, 722, 733, 741, 744, 745, 755, 757, 762, 765, 766, 769, 776, 782, 783, 786, 788, 808, 809, 810, 953, 958, 960, 963, 973, 1050, 1052, 1053, 1061, 1064, 1065, 1067, 1075, 1078, 1088, 1094, 1095, 1096, 1098, 1100, 1103, 1105, 1108, 1110, 1111, 1114, 1115, 1116, 1120, 1121, 1123, 1126, 1131, 1132, 1272, 1273, 1274, 1275, 1276, 1293 | 570, 592 | — |
| `advanced-trading-tools.html` | — | — | 21 | `app-config.js` |
| `ai-moat-finder.html` | 4983 | 4956, 4957, 5010, 5124, 5269, 5270 | — | `app-config.js`, `session-user.js` |
| `ai-morning-brief.html` | — | 1904, 1907, 1909, 1911, 1912, 1914, 1915, 1919, 1920, 2088, 2104, 2106, 2140, 2141, 2142, 2186, 2188, 2205, 2256, 2257, 2320 | 2128, 2194 | `app-config.js`, `session-user.js` |
| `ai-trading-agent.html` | — | 310, 311, 314, 348, 372 | — | `app-config.js` |
| `ai-valuation.html` | 171, 175, 176, 178, 345, 349, 352, 353, 354, 356, 359, 363, 365, 369, 371, 372, 483, 485, 486, 487, 502, 504, 507, 585 | 485, 486, 487 | — | — |
| `ai_valuation.html` | — | — | — | — |
| `analysis-central.html` | 6384, 6514, 6516, 6518, 6522, 6523, 6526, 6529, 6531, 6533, 6535, 6536, 6547, 6551, 6555, 6588, 6601, 6602, 6622, 6630, 6633, 6637, 6956, 6985, 6990, 6994, 6998, 7002, 7014, 7018, 7039, 7053, 7078, 7081, 7105, 7106, 7108, 7172, 7202, 7204, 7746, 7765, 7901, 7905, 7933, 7949, 7958, 7959, 7961, 7969, 7970, 7981, 7992, 7996, 8042, 8190, 8273, 8274, 8322, 8437, 8438, 8467, 8475, 8504, 8505, 9487, 9500, 9993, 10014, 10025, 10034 | 6708, 6715, 6716, 6717, 6990, 6994, 6998, 7002, 7039, 7081, 7108, 7765, 7875, 7884, 7905, 7949, 7996, 8161, 8167, 8297, 8322, 8450, 8457, 8467, 8475, 10025, 10034 | 25, 6740, 6798, 9437, 9449, 9476, 9487, 9488, 9500, 9501 | `app-config.js`, `market-data.js`, `session-user.js` |
| `api-diagnostics.html` | 79, 142, 212, 228, 282, 535 | 134, 135, 136, 154, 165, 176, 193, 211, 227, 251 | 256, 258, 281 | `app-config.js` |
| `arowana-template.html` | 387, 394 | 392 | — | — |
| `arowana-trader.html` | 952, 2333, 2880, 2881, 2892, 3009 | 992, 993, 996, 997, 1000, 1045, 1735, 1738, 1814, 1822, 1833, 1836, 1837, 1838, 1840, 1877, 1962, 2321, 2768, 3005 | 1047, 2320, 2333, 3006 | `app-config.js`, `market-data.js`, `session-user.js` |
| `asset-allocation-builder.html` | — | — | — | — |
| `assignment-risk.html` | — | — | — | — |
| `atr-stop-planner.html` | 5281, 5305 | 5304 | — | `app-config.js`, `session-user.js` |
| `automated-trading-plan.html` | — | 424, 635, 636 | — | `app-config.js` |
| `base-breakout .html` | — | 78, 171, 174, 257, 258, 260, 335 | — | — |
| `base-breakout.html` | — | 79, 215, 218, 303, 304, 307, 376 | — | — |
| `bb-snapback.html` | — | 156, 159, 244, 246 | — | — |
| `billing.html` | — | 635, 781, 789 | 638, 808, 809 | `app-config.js` |
| `blog.html` | — | — | — | — |
| `broker-connections.html` | — | 316, 317, 318 | — | — |
| `buy-a-home.html` | — | — | — | — |
| `buy-sell-signal.html` | 549 | 406, 407, 408, 613, 615, 616, 618, 620, 624, 629, 689, 690, 722 | 550 | `app-config.js` |
| `chart-analysis-form.html` | — | 194, 195, 196, 478, 480, 672, 722, 724, 726, 727, 728, 732, 750, 847, 850, 851, 895, 898, 1066, 1071, 1176, 1177, 1183, 1184 | — | `app-config.js` |
| `checkout.html` | — | 715, 873, 941 | 718, 894, 895 | `app-config.js` |
| `college-savings.html` | — | — | — | — |
| `contact.html` | — | — | — | — |
| `cover-call-option-recommentor.html` | — | 9, 10, 35 | — | — |
| `credit-spread-planner.html` | 5243, 5244, 5260 | 5265 | — | `app-config.js`, `session-user.js` |
| `daily-bias.html` | — | 357, 577 | — | `app-config.js` |
| `daily-summary.html` | — | 88, 104, 105, 174, 186, 284, 313 | — | — |
| `daily-trading-post.html` | — | — | — | — |
| `dashboard.html` | — | — | — | — |
| `data-hygiene-audit.html` | — | — | — | — |
| `day-trade-scanner.html` | — | 212, 355, 372 | — | — |
| `daytrade.html` | — | 218, 224, 225, 278, 340, 352 | — | — |
| `dca-planner.html` | — | — | — | — |
| `dcf-analyzer.html` | 5249 | 5270 | — | `app-config.js`, `session-user.js` |
| `discipline-checklist.html` | — | — | — | — |
| `discipline-scorecard.html` | — | — | — | `app-config.js`, `session-user.js` |
| `disclosures.html` | — | — | — | — |
| `dividend-screener.html` | — | — | — | `app-config.js` |
| `dividend-tracker.html` | 5034 | 4851, 4870, 4878, 4905, 4906, 5053, 5061, 5138, 5148, 5152, 5180, 5185, 5192, 5193, 5195, 5196, 5199, 5226 | — | `app-config.js`, `session-user.js` |
| `earning-watcher.html` | — | — | — | — |
| `education-529-planner.html` | — | — | — | — |
| `ema-snapback.html` | — | — | — | — |
| `etf-core-screener.html` | — | — | — | — |
| `expectancy-matrix.html` | — | — | 4916 | `app-config.js`, `session-user.js` |
| `factor-tilt-planner.html` | — | — | — | — |
| `feature_body.html` | — | — | — | — |
| `feature_new.html` | — | — | — | — |
| `features-tools-directory.html` | — | — | — | — |
| `features.html` | — | — | — | — |
| `fee-analyzer.html` | — | — | — | — |
| `gap-and-go.html` | — | — | — | — |
| `gap-fade-scanner.html` | — | 264, 358, 374, 377 | — | — |
| `guide-claude-tradingview-windows.html` | — | — | — | — |
| `high-shortfloat-screener.html` | — | — | — | — |
| `hod-scanner.html` | — | 228, 332, 352, 361 | — | — |
| `index.html` | — | — | — | `app-config.js` |
| `intraday-breakout.html` | 399, 406 | 404 | — | — |
| `intrinsic-value-rsi.html` | 132, 319, 321, 323 | 323 | — | — |
| `intrinsic-value.html` | 5799, 6596, 6597, 6598, 6642, 6643, 6644, 6684, 6685, 6821, 6879, 6889, 7247, 7248, 7310 | 6594, 6639, 6681, 6892, 6921 | — | `app-config.js`, `market-data.js`, `session-user.js` |
| `ips-builder.html` | — | — | — | — |
| `iv-watchlist-module.html` | — | — | — | — |
| `js/account-registry.js` | — | — | — | — |
| `js/account-switcher.js` | — | — | — | — |
| `js/app-config.js` | 78, 84, 85, 86, 101, 344, 354, 361, 376, 390, 392, 403, 411, 416, 421, 430, 438, 440, 442, 448, 457, 469, 470, 479, 485, 486, 503, 662 | 3, 42, 62, 63, 180, 181, 183, 184, 185, 186, 187, 188, 191, 192, 193, 196, 197, 198, 201, 260, 262, 267, 276, 277, 278, 281, 295, 301, 586, 588, 589, 592, 595, 596, 598, 601, 604, 607, 608, 610, 612, 613, 616, 623, 627, 640, 641, 646, 652, 653 | 102, 386, 393, 519, 555, 654 | — |
| `js/auth-guard.js` | — | — | — | — |
| `js/auth-header.js` | — | — | 209, 261 | — |
| `js/bottom-nav.js` | — | — | — | — |
| `js/config.json` | — | 7, 8, 9 | — | — |
| `js/dividend-screener.js` | — | 19 | — | — |
| `js/format.js` | — | — | — | — |
| `js/holdings-source.js` | 94 | — | 28, 98 | — |
| `js/interface-mode.js` | — | — | — | — |
| `js/invest-helper-logic.js` | — | 166 | 170 | — |
| `js/journal-context.js` | — | — | — | — |
| `js/journal-fields.js` | — | — | — | — |
| `js/journal-sync.js` | — | 135, 158 | 160, 163 | — |
| `js/market-data.js` | — | 6, 60 | 28, 79 | — |
| `js/nav-rail.js` | — | — | — | — |
| `js/option-roll-analyzer.js` | 9, 19 | 19, 58, 64 | — | — |
| `js/plan.js` | — | 6, 70, 90 | 92 | — |
| `js/portfolio-breadth.js` | — | — | — | — |
| `js/position-math.js` | — | — | — | — |
| `js/price-fetcher.js` | 22, 23, 52, 53, 59 | 46 | — | — |
| `js/risk.js` | — | 37, 38, 39 | 38 | — |
| `js/scanner-defs.js` | 34, 35 | 57 | — | — |
| `js/scanners.js` | 81, 82 | 112 | — | — |
| `js/session-user.js` | — | — | — | `session-user.js` |
| `js/setup-scorecard.js` | 25, 115 | 124 | — | — |
| `js/setup-scorecard_v9.js` | 25, 115 | 124 | — | — |
| `js/strategy-analyzers.js` | 14, 47, 58, 67 | 58, 67 | — | — |
| `js/strategy-analyzers_v1.js` | 14, 35, 46, 55 | 46, 55 | — | — |
| `js/supabase-init.js` | — | — | 5, 41, 125 | — |
| `js/workspace-footer.js` | — | — | — | — |
| `kelly-calculator.html` | — | — | — | `app-config.js`, `session-user.js` |
| `lap-pullback.html` | — | 143, 144, 170, 182 | — | — |
| `learn-investing.html` | — | — | — | `app-config.js` |
| `login.html` | — | — | 784, 1031, 1206 | `session-user.js` |
| `long-term-dashboard.html` | 2084, 2492, 2494, 2495, 2497, 2501, 2506, 2507, 2515, 2519, 4415, 4416, 4436 | 2087, 2088, 2089, 2227, 2447, 2517, 2674, 2677, 2678, 2810, 2811, 2815, 2831, 2839, 2975, 2976, 3174, 3195, 3196, 3230, 3231, 3237, 3322, 3324, 3354, 3364, 3391, 3398, 3399, 3400, 3402, 3523, 3525, 3527, 3528, 3529, 3719, 3721, 3731, 3738, 3757, 3840, 3849, 3851, 4322, 4418, 4419, 4420, 4421, 4425, 4440, 4441, 4442, 4449, 4852, 4855 | — | `app-config.js` |
| `long-term-intrinsic-value.html` | — | — | — | — |
| `long-term-portfolio.html` | 235, 517, 518 | 229, 377, 531, 566, 570, 640, 708, 709, 711, 715, 718, 720, 732 | — | — |
| `long-term-watchlist.html` | — | — | — | — |
| `market-intelligence.html` | — | — | — | — |
| `master-journal.html` | — | — | — | — |
| `momentum-hunter-complete.html` | 1696, 1956, 1957, 1964, 2008, 2086, 2207, 2209, 2330, 2336, 2779 | 1337, 1774, 1785, 1795, 2008, 2033, 2037, 2046, 2052, 2078, 2081, 2172, 2330, 2336 | — | `app-config.js` |
| `momentum-hunter.html` | 1656, 1862, 1863, 1870, 1914, 1987, 2109, 2111, 2191, 2239, 2281, 2287, 2682 | 1307, 1712, 1721, 1729, 1934, 1938, 1948, 1954, 1979, 1982, 2072, 2191, 2239, 2281, 2287 | — | `app-config.js` |
| `money-flow-alert.html` | — | 5073, 5193, 5195, 5198, 5199, 5221, 5223, 5227, 5228, 5244, 5252 | 5248, 5254 | `app-config.js`, `session-user.js` |
| `my-rules-long.html` | — | — | — | — |
| `my-rules-short.html` | — | — | — | — |
| `my-rules.html` | — | — | — | — |
| `my-watchlist.html` | 138 | 138 | — | — |
| `news-trading.html` | — | 410, 733, 737, 738 | — | `app-config.js` |
| `onboarding.html` | — | 190, 191 | 191 | `app-config.js` |
| `opening-drive.html` | 466, 473 | 471 | — | — |
| `option-recommender.html` | — | 16 | — | — |
| `option-roll-analyzer.html` | — | 216, 420, 425 | — | — |
| `option-roll-tracker.html` | 661, 668 | 666 | 100, 107, 112 | — |
| `option-trader.html` | — | — | — | — |
| `options-analyzer.html` | 4945, 5291, 5292, 5307, 5575, 5576, 5583, 5586, 5632, 5673 | 5311, 5672 | — | `app-config.js`, `session-user.js` |
| `options-hub-creator.html` | — | — | — | — |
| `options-hub.html` | 3377, 3378, 3401, 3408, 3453, 3456, 3489, 3566, 3572, 3573, 3574, 3603, 8139, 8140, 8168, 8651 | 3452, 3454, 3488, 3556, 3572, 3573, 3574, 4509, 4510, 4860, 4861, 5160, 5161, 6756, 6757, 7511, 7512, 7911, 7958, 7960, 7976, 8265, 8267, 8268, 8625 | 26, 4510, 4861, 5161, 6757, 7512, 8266, 8628 | `app-config.js`, `market-data.js`, `session-user.js` |
| `options-journal.html` | — | — | — | — |
| `options-recommender.html` | — | — | — | — |
| `options-strategies.html` | — | — | — | — |
| `orb-scanner.html` | — | — | — | — |
| `overview.html` | — | — | — | `app-config.js` |
| `pattern-scanner.html` | 295, 312, 313, 333 | 332, 350 | 18 | `app-config.js` |
| `pick-my-mix.html` | — | — | — | — |
| `portfolio-advisor.html` | 789, 1231, 1968, 2124, 2164, 2165, 2178, 2181, 2458, 3117 | 1931, 1972, 2198, 2420, 3113 | 1207, 1213, 1222, 1231, 1268, 2123, 2124 | `app-config.js`, `market-data.js`, `session-user.js` |
| `portfolio-command.html` | 6195, 6444, 6908, 6923, 6927, 6936, 6939, 6984, 7065, 7376, 8656, 8720, 8864, 9446, 10609, 10688, 11975, 11990, 12089, 12196 | 5407, 5408, 5894, 6169, 6217, 6459, 6900, 6902, 9439, 9448, 9453, 9629, 9631, 9633, 9650, 9659, 9662, 9894, 11552 | 21, 5408, 6172, 6831, 6839, 6840, 6848, 6861, 6863, 6864, 6865, 6892, 6985, 7066, 7377, 8657, 8721, 8865, 10610, 10689, 11975, 11991, 12090, 12197 | `app-config.js`, `market-data.js`, `session-user.js` |
| `portfolio-tracker.html` | — | — | — | — |
| `position-sizer.html` | 316 | 262, 312 | 313 | `app-config.js`, `session-user.js` |
| `position-sizer_fresh.html` | 1843, 1846, 1847, 1852, 1856 | 1854, 2035, 2036, 2037, 2067, 2109, 2168, 2171, 2173, 2264, 2265, 2393, 2397, 2413, 2421, 2606, 2804, 2825, 2826, 2869, 2954, 2956, 2986, 2996, 3023, 3030, 3031, 3032, 3034 | — | `app-config.js` |
| `post-earnings-drift.html` | — | — | — | — |
| `pricing-revolutionary.html` | — | — | — | `app-config.js` |
| `pricing.html` | — | 1097, 1098 | 1098, 1117, 1124 | `app-config.js` |
| `privacy.html` | — | — | — | — |
| `quality-screener.html` | — | 119, 124, 140, 141, 301, 316, 324, 443 | — | — |
| `r-multiple.html` | — | — | — | `app-config.js`, `session-user.js` |
| `real-estate-analyzer.html` | — | — | — | — |
| `refunds.html` | — | — | — | — |
| `reset-password.html` | — | 852 | 770, 798, 878, 889, 891, 893 | `session-user.js` |
| `retirement-calculator.html` | — | — | — | — |
| `retirement-planner.html` | — | 1914, 1915, 1917, 1918, 1919, 1941, 1942, 1952, 1971, 1973, 1975, 1978, 1983, 1991 | — | — |
| `risk-calculator.html` | — | — | — | — |
| `risk-comfort.html` | — | — | — | `app-config.js`, `session-user.js` |
| `risk-disclosure.html` | — | — | — | — |
| `risk-quiz.html` | — | — | — | — |
| `rsi-reversal-scanner.html` | — | 266, 370, 385, 388 | — | — |
| `rvol-scanner.html` | 406, 442, 443, 444, 452, 703, 704, 738, 739, 746, 749, 754, 757 | 450, 560, 657, 670, 684 | — | — |
| `scalp-trading-screener.html` | — | 6, 58, 78, 79, 87, 108, 109, 110, 114, 143, 268, 269, 319, 321, 322, 328, 330, 347, 349, 350, 465, 466, 467, 470, 483, 484, 507, 514, 516 | 130 | — |
| `scanner.html` | — | — | — | `app-config.js`, `session-user.js` |
| `schwab-callback.html` | — | — | 62, 69 | — |
| `sector-sentiment-gauge.html` | 365, 373 | — | 149, 365, 373 | — |
| `sector-sentiment.html` | 269, 278 | — | 152, 269, 278 | — |
| `security.html` | — | — | — | — |
| `settings.html` | 1026, 1034 | — | — | — |
| `short-entry-screener.html` | — | — | — | — |
| `short-squeeze-scanner.html` | — | 255, 348, 361, 364 | — | — |
| `short-term-dashboard.html` | 2040, 2590, 2593, 2599, 2603, 3549, 4861, 4862, 4869, 4872 | 2544, 2548, 2553, 2594, 2601, 2720, 2722, 2724, 2725, 2726, 2727, 2793, 2794, 2795, 2825, 2899, 2958, 2961, 2963, 3013, 3083, 3085, 3126, 3139, 3332, 3343, 3345, 3510, 3595, 3597, 3601, 3602, 3610, 3616, 3624, 3859, 3860, 3865, 4063, 4084, 4085, 4128, 4216, 4220, 4223, 4224, 4242, 4249, 4254, 4275, 4284, 4289, 4290, 4291, 4293, 4506, 4620, 4623 | 3549 | `app-config.js` |
| `short-term-template.html` | — | — | — | — |
| `short-term-watchlist.html` | 1294, 1302, 1342 | 506, 1118, 1122, 1126, 1310 | 506, 1130 | `app-config.js` |
| `signup.html` | — | 804, 807, 810, 815 | 829 | `app-config.js` |
| `sma-cross-scanner.html` | 265, 498, 499, 508, 511 | 576 | — | — |
| `stock-analyzer.html` | — | 144, 323, 376, 378, 379, 383, 567, 577, 638, 641, 642, 643, 644, 645, 647, 654, 655, 661, 663, 734 | 562, 570 | `app-config.js` |
| `stock-checker.html` | — | 110 | — | — |
| `strategy-backtesting.html` | 5303, 5322, 5331, 5394, 5396, 5397, 5601, 5662, 5663, 5674, 6142 | 5674, 6096, 6097 | — | `app-config.js`, `session-user.js` |
| `support.html` | — | — | — | — |
| `swing-trader.html` | — | 216, 417, 592, 597, 598 | — | `app-config.js` |
| `task-template.html` | — | — | — | — |
| `tax-advantaged-guide.html` | — | — | — | — |
| `tax-loss-harvester.html` | — | — | — | `app-config.js`, `session-user.js` |
| `technical-analysis.html` | 4930, 5221, 5235, 5242, 5243, 5249, 5250, 5252, 5264, 5266, 5268, 5270, 5271, 5274, 5275, 5342, 5343, 5344, 5355, 5356, 5357, 5397, 5398, 5402, 5448, 5449, 5464, 5466, 5473, 5475, 5493, 5496, 5515, 5519 | 5449, 5496, 5519 | — | `app-config.js`, `session-user.js` |
| `template.html` | — | — | — | — |
| `template_new.html` | — | — | — | — |
| `terms.html` | — | — | — | — |
| `test_webhook.html` | — | 5, 8, 9, 14, 20, 24 | — | — |
| `tool-audit.html` | — | — | 4892 | `app-config.js`, `session-user.js` |
| `tools.html` | — | — | — | `app-config.js`, `session-user.js` |
| `trade-ideas-ai.html` | — | — | — | — |
| `trade-journal-pro.html` | 2697, 2698, 6213, 6806 | 2693, 6834 | 6769, 6779, 6807 | `app-config.js`, `market-data.js`, `session-user.js` |
| `trade-journal.html` | — | — | — | — |
| `trade-plan-builder.html` | 672, 796, 923 | 550, 563, 565, 566, 573, 681, 919 | 577, 579, 795, 920 | `app-config.js`, `session-user.js` |
| `trade-scanner.html` | — | 225 | — | — |
| `trading-command.html` | 5656, 5677, 5682, 5845, 5849, 6008, 7170, 7178, 7919, 8627, 8660, 8661, 8834, 9432 | 4527, 5047, 5161, 5672, 5968, 6633, 6644, 6645, 6661, 6670, 6672, 7102, 7113, 7114, 7115, 7116, 7117, 7118, 7119, 7122, 7171, 7174, 7218, 7223, 7230, 7621, 7907, 7986, 7997, 8036, 8554, 8566, 8603, 8643, 8924, 10229, 10230, 10308, 10309 | 21, 7875, 7918, 8024, 8044, 8835, 10230, 10309 | `app-config.js`, `market-data.js`, `session-user.js` |
| `trading-journal-analysis.html` | 1370, 1391 | 1611, 2159, 2160 | — | `app-config.js`, `session-user.js` |
| `tradingcommand.html` | 5119, 5195, 6174, 6182, 6876, 7539, 7570, 7571, 7678, 8099 | 4222, 4443, 4552, 5093, 5155, 5757, 5768, 5769, 5785, 5794, 5796, 6116, 6121, 6122, 6123, 6124, 6125, 6126, 6127, 6130, 6175, 6178, 6222, 6227, 6234, 6599, 6864, 6943, 6954, 6979, 7476, 7488, 7555, 7768 | 21, 5096, 6832, 6875, 6984, 7679 | `app-config.js` |
| `trendline-break.html` | 524, 531 | 529, 682, 733, 795, 814 | — | — |
| `updated-navigation.html` | — | — | — | — |
| `volatility-guardrails.html` | — | — | — | `app-config.js`, `session-user.js` |
| `volume-spike.html` | — | 213, 340, 351 | — | — |
| `vwap-pullback.html` | — | 228, 330, 350, 359 | — | — |
| `watchlist.html` | 1775, 3631, 3639, 3679 | 1645, 1771, 3252, 3256, 3306, 3647 | 1645, 1772, 3310 | `app-config.js`, `session-user.js` |
| `weekly-swing-trade-post.html` | 175, 176, 260, 289, 291, 292, 293 | 176, 291, 292, 293 | — | — |
| `whale-tracker.html` | 913, 2081, 2590, 2591, 2602, 2754 | 950, 951, 954, 955, 958, 1003, 1712, 1715, 1785, 1793, 1804, 1807, 1808, 1809, 1811, 1833, 1851, 1898, 2069, 2516, 2750 | 1005, 2068, 2081, 2751 | `app-config.js`, `session-user.js` |
| `wheel-calculator.html` | — | — | — | — |
| `wheel-strategy.html` | — | — | 21 | `app-config.js` |
| `wheel_strategy_web_tool.html` | — | — | — | — |
| `withdrawal-planner.html` | — | — | — | — |

## Appendix B — Browser storage operation ledger

Static localStorage/sessionStorage calls with credential, auth or destination names, plus simple string-constant resolution. Names below are storage identifiers, never stored credential values. Dynamic expressions, wrapper functions and object fields may need the source traces above; this ledger does not claim runtime reachability. `daily_summary_settings_v1` and `div_tracker` contain nested webhook settings; `ap_retirement_ai_key` holds a destination URL despite its name. Quarantine uses dynamically constructed keys and is described in the findings.

| Storage identifier | File:line | Store | Operation |
|---|---|---|---|
| `<dynamic:KEY_HISTORY>` | `iv-watchlist-module.html:404` | localStorage | getItem |
| `<dynamic:KEY_HISTORY>` | `iv-watchlist-module.html:416` | localStorage | setItem |
| `<dynamic:cacheKey>` | `analysis-central.html:10049` | sessionStorage | getItem |
| `<dynamic:cacheKey>` | `analysis-central.html:10071` | sessionStorage | setItem |
| `<dynamic:cacheKey>` | `analysis-central.html:10279` | sessionStorage | getItem |
| `<dynamic:cacheKey>` | `js/strategy-analyzers.js:82` | sessionStorage | getItem |
| `<dynamic:cacheKey>` | `js/strategy-analyzers.js:104` | sessionStorage | setItem |
| `<dynamic:cacheKey>` | `js/strategy-analyzers.js:312` | sessionStorage | getItem |
| `<dynamic:cacheKey>` | `js/strategy-analyzers_v1.js:70` | sessionStorage | getItem |
| `<dynamic:cacheKey>` | `js/strategy-analyzers_v1.js:92` | sessionStorage | setItem |
| `<dynamic:cacheKey>` | `js/strategy-analyzers_v1.js:300` | sessionStorage | getItem |
| `<dynamic:key>` | `account.html:1804` | localStorage | getItem |
| `<dynamic:key>` | `arowana-trader.html:1144` | localStorage | getItem |
| `<dynamic:key>` | `billing.html:606` | localStorage | removeItem |
| `<dynamic:key>` | `billing.html:607` | sessionStorage | removeItem |
| `<dynamic:key>` | `checkout.html:580` | localStorage | getItem |
| `<dynamic:key>` | `checkout.html:589` | localStorage | setItem |
| `<dynamic:key>` | `checkout.html:659` | localStorage | removeItem |
| `<dynamic:key>` | `checkout.html:660` | sessionStorage | removeItem |
| `<dynamic:key>` | `data-hygiene-audit.html:126` | localStorage | getItem |
| `<dynamic:key>` | `dividend-tracker.html:5093` | localStorage | getItem |
| `<dynamic:key>` | `features.html:888` | localStorage | removeItem |
| `<dynamic:key>` | `js/account-registry.js:62` | localStorage | getItem |
| `<dynamic:key>` | `js/journal-sync.js:905` | localStorage | getItem |
| `<dynamic:key>` | `js/journal-sync.js:907` | localStorage | setItem |
| `<dynamic:key>` | `long-term-dashboard.html:1444` | localStorage | getItem |
| `<dynamic:key>` | `long-term-dashboard.html:1445` | localStorage | setItem |
| `<dynamic:key>` | `options-hub.html:3387` | localStorage | getItem |
| `<dynamic:key>` | `options-hub.html:3396` | localStorage | setItem |
| `<dynamic:key>` | `portfolio-command.html:6955` | localStorage | getItem |
| `<dynamic:key>` | `portfolio-command.html:6965` | localStorage | setItem |
| `<dynamic:key>` | `position-sizer.html:140` | localStorage | getItem |
| `<dynamic:key>` | `position-sizer_fresh.html:1220` | localStorage | getItem |
| `<dynamic:key>` | `position-sizer_fresh.html:1221` | localStorage | setItem |
| `<dynamic:key>` | `pricing.html:931` | localStorage | removeItem |
| `<dynamic:key>` | `pricing.html:932` | sessionStorage | removeItem |
| `<dynamic:key>` | `trade-journal-pro.html:2647` | localStorage | getItem |
| `<dynamic:key>` | `trade-journal-pro.html:2648` | localStorage | setItem |
| `<dynamic:key>` | `trading-command.html:7450` | localStorage | getItem |
| `<dynamic:key>` | `tradingcommand.html:6430` | localStorage | getItem |
| `<dynamic:key>` | `whale-tracker.html:1102` | localStorage | getItem |
| `<dynamic:keys>` | `js/journal-context.js:55` | localStorage | getItem |
| `TWELVE_DATA_KEY` | `my-watchlist.html:84` | localStorage | getItem |
| `ap_ai_coach_webhook` | `arowana-trader.html:997` | localStorage | getItem |
| `ap_ai_coach_webhook` | `whale-tracker.html:955` | localStorage | getItem |
| `ap_morning_brief_webhook` | `ai-morning-brief.html:1920` | localStorage | getItem |
| `ap_morning_brief_webhook` | `ai-trading-agent.html:311` | localStorage | getItem |
| `ap_morning_brief_webhook` | `arowana-trader.html:996` | localStorage | getItem |
| `ap_morning_brief_webhook` | `long-term-dashboard.html:2674` | localStorage | getItem |
| `ap_morning_brief_webhook` | `long-term-dashboard.html:3230` | localStorage | getItem |
| `ap_morning_brief_webhook` | `long-term-dashboard.html:3528` | localStorage | getItem |
| `ap_morning_brief_webhook` | `short-term-dashboard.html:2726` | localStorage | getItem |
| `ap_morning_brief_webhook` | `whale-tracker.html:954` | localStorage | getItem |
| `ap_oauth_pending_v1` | `login.html:1027` | sessionStorage | getItem |
| `ap_oauth_pending_v1` | `login.html:1028` | sessionStorage | removeItem |
| `ap_oauth_pending_v1` | `login.html:1215` | sessionStorage | setItem |
| `ap_oauth_pending_v1` | `login.html:1223` | sessionStorage | removeItem |
| `ap_quarantine_` | `js/journal-sync.js:906` | localStorage | setItem |
| `ap_quarantine_` | `js/session-user.js:163` | localStorage | setItem |
| `ap_retirement_ai_key` | `retirement-planner.html:1873` | localStorage | getItem |
| `ap_retirement_ai_key` | `retirement-planner.html:1954` | localStorage | setItem |
| `ap_retirement_ai_key` | `retirement-planner.html:1972` | localStorage | getItem |
| `ap_retirement_ai_key` | `retirement-planner.html:1998` | localStorage | removeItem |
| `ap_st_morning_brief_url_v1` | `long-term-dashboard.html:3232` | localStorage | getItem |
| `ap_st_morning_brief_url_v1` | `long-term-dashboard.html:3401` | localStorage | setItem |
| `ap_st_morning_brief_url_v1` | `position-sizer_fresh.html:2860` | localStorage | getItem |
| `ap_st_morning_brief_url_v1` | `position-sizer_fresh.html:3033` | localStorage | setItem |
| `ap_st_morning_brief_url_v1` | `short-term-dashboard.html:4119` | localStorage | getItem |
| `ap_st_morning_brief_url_v1` | `short-term-dashboard.html:4292` | localStorage | setItem |
| `ap_user_api_keys` | `account.html:1308` | localStorage | getItem |
| `ap_user_api_keys` | `account.html:1614` | localStorage | setItem |
| `ap_user_api_keys` | `account.html:1909` | localStorage | removeItem |
| `ap_user_api_keys` | `account.html:2096` | localStorage | removeItem |
| `ap_user_api_keys` | `account.html:2426` | localStorage | getItem |
| `ap_user_api_keys` | `account.html:2427` | localStorage | removeItem |
| `ap_user_api_keys` | `ai-moat-finder.html:4983` | localStorage | getItem |
| `ap_user_api_keys` | `analysis-central.html:6384` | localStorage | removeItem |
| `ap_user_api_keys` | `analysis-central.html:6531` | localStorage | getItem |
| `ap_user_api_keys` | `analysis-central.html:7959` | localStorage | getItem |
| `ap_user_api_keys` | `analysis-central.html:7961` | localStorage | setItem |
| `ap_user_api_keys` | `analysis-central.html:10014` | localStorage | getItem |
| `ap_user_api_keys` | `api-diagnostics.html:142` | localStorage | getItem |
| `ap_user_api_keys` | `arowana-trader.html:2881` | localStorage | getItem |
| `ap_user_api_keys` | `arowana-trader.html:3009` | localStorage | removeItem |
| `ap_user_api_keys` | `atr-stop-planner.html:5281` | localStorage | getItem |
| `ap_user_api_keys` | `credit-spread-planner.html:5244` | localStorage | getItem |
| `ap_user_api_keys` | `dcf-analyzer.html:5249` | localStorage | getItem |
| `ap_user_api_keys` | `dividend-tracker.html:5034` | localStorage | getItem |
| `ap_user_api_keys` | `intrinsic-value.html:6879` | localStorage | removeItem |
| `ap_user_api_keys` | `intrinsic-value.html:7248` | localStorage | getItem |
| `ap_user_api_keys` | `intrinsic-value.html:7310` | localStorage | removeItem |
| `ap_user_api_keys` | `js/app-config.js:78` | localStorage | getItem |
| `ap_user_api_keys` | `js/app-config.js:376` | localStorage | getItem |
| `ap_user_api_keys` | `js/app-config.js:438` | localStorage | getItem |
| `ap_user_api_keys` | `js/app-config.js:469` | localStorage | setItem |
| `ap_user_api_keys` | `js/price-fetcher.js:59` | localStorage | getItem |
| `ap_user_api_keys` | `js/scanner-defs.js:34` | localStorage | getItem |
| `ap_user_api_keys` | `js/scanners.js:81` | localStorage | getItem |
| `ap_user_api_keys` | `js/setup-scorecard.js:115` | localStorage | getItem |
| `ap_user_api_keys` | `js/setup-scorecard_v9.js:115` | localStorage | getItem |
| `ap_user_api_keys` | `js/strategy-analyzers.js:47` | localStorage | getItem |
| `ap_user_api_keys` | `js/strategy-analyzers_v1.js:35` | localStorage | getItem |
| `ap_user_api_keys` | `long-term-dashboard.html:2495` | localStorage | getItem |
| `ap_user_api_keys` | `long-term-dashboard.html:4416` | localStorage | getItem |
| `ap_user_api_keys` | `long-term-portfolio.html:518` | localStorage | getItem |
| `ap_user_api_keys` | `momentum-hunter-complete.html:1956` | localStorage | getItem |
| `ap_user_api_keys` | `momentum-hunter-complete.html:2209` | localStorage | getItem |
| `ap_user_api_keys` | `momentum-hunter-complete.html:2779` | localStorage | removeItem |
| `ap_user_api_keys` | `momentum-hunter.html:1862` | localStorage | getItem |
| `ap_user_api_keys` | `momentum-hunter.html:2111` | localStorage | getItem |
| `ap_user_api_keys` | `momentum-hunter.html:2682` | localStorage | removeItem |
| `ap_user_api_keys` | `options-analyzer.html:5292` | localStorage | getItem |
| `ap_user_api_keys` | `options-analyzer.html:5576` | localStorage | getItem |
| `ap_user_api_keys` | `options-analyzer.html:5632` | localStorage | getItem |
| `ap_user_api_keys` | `options-hub.html:3377` | localStorage | getItem |
| `ap_user_api_keys` | `options-hub.html:3401` | localStorage | getItem |
| `ap_user_api_keys` | `options-hub.html:3408` | localStorage | getItem |
| `ap_user_api_keys` | `options-hub.html:8651` | localStorage | removeItem |
| `ap_user_api_keys` | `portfolio-advisor.html:2165` | localStorage | getItem |
| `ap_user_api_keys` | `portfolio-advisor.html:3117` | localStorage | removeItem |
| `ap_user_api_keys` | `portfolio-command.html:6195` | localStorage | removeItem |
| `ap_user_api_keys` | `portfolio-command.html:6908` | localStorage | getItem |
| `ap_user_api_keys` | `position-sizer.html:316` | localStorage | removeItem |
| `ap_user_api_keys` | `rvol-scanner.html:444` | localStorage | getItem |
| `ap_user_api_keys` | `rvol-scanner.html:704` | localStorage | getItem |
| `ap_user_api_keys` | `rvol-scanner.html:739` | localStorage | getItem |
| `ap_user_api_keys` | `short-term-dashboard.html:4862` | localStorage | getItem |
| `ap_user_api_keys` | `short-term-watchlist.html:1302` | localStorage | getItem |
| `ap_user_api_keys` | `sma-cross-scanner.html:499` | localStorage | getItem |
| `ap_user_api_keys` | `strategy-backtesting.html:5303` | localStorage | removeItem |
| `ap_user_api_keys` | `strategy-backtesting.html:5394` | localStorage | getItem |
| `ap_user_api_keys` | `technical-analysis.html:5221` | localStorage | removeItem |
| `ap_user_api_keys` | `technical-analysis.html:5274` | localStorage | getItem |
| `ap_user_api_keys` | `trade-journal-pro.html:2698` | localStorage | getItem |
| `ap_user_api_keys` | `trade-plan-builder.html:672` | localStorage | getItem |
| `ap_user_api_keys` | `trade-plan-builder.html:923` | localStorage | removeItem |
| `ap_user_api_keys` | `trading-command.html:5656` | localStorage | removeItem |
| `ap_user_api_keys` | `trading-command.html:5682` | localStorage | getItem |
| `ap_user_api_keys` | `trading-command.html:6008` | localStorage | getItem |
| `ap_user_api_keys` | `trading-command.html:7178` | localStorage | getItem |
| `ap_user_api_keys` | `trading-command.html:8661` | localStorage | getItem |
| `ap_user_api_keys` | `trading-journal-analysis.html:1370` | localStorage | removeItem |
| `ap_user_api_keys` | `tradingcommand.html:5119` | localStorage | removeItem |
| `ap_user_api_keys` | `tradingcommand.html:5195` | localStorage | getItem |
| `ap_user_api_keys` | `tradingcommand.html:6182` | localStorage | getItem |
| `ap_user_api_keys` | `tradingcommand.html:7571` | localStorage | getItem |
| `ap_user_api_keys` | `watchlist.html:1775` | localStorage | removeItem |
| `ap_user_api_keys` | `watchlist.html:3639` | localStorage | getItem |
| `ap_user_api_keys` | `whale-tracker.html:2591` | localStorage | getItem |
| `ap_user_api_keys` | `whale-tracker.html:2754` | localStorage | removeItem |
| `arowana_analyzer_webhook_url` | `stock-analyzer.html:642` | localStorage | getItem |
| `arowana_analyzer_webhook_url` | `stock-analyzer.html:643` | localStorage | getItem |
| `arowana_analyzer_webhook_url` | `stock-analyzer.html:647` | localStorage | setItem |
| `arowana_base_breakout_webhook` | `base-breakout .html:262` | localStorage | getItem |
| `arowana_base_breakout_webhook` | `base-breakout .html:330` | localStorage | getItem |
| `arowana_base_breakout_webhook` | `base-breakout.html:306` | localStorage | getItem |
| `arowana_base_breakout_webhook` | `base-breakout.html:307` | localStorage | setItem |
| `arowana_base_breakout_webhook` | `base-breakout.html:371` | localStorage | getItem |
| `arowana_bb_snapback_webhook` | `bb-snapback.html:248` | localStorage | getItem |
| `arowana_bb_snapback_webhook` | `bb-snapback.html:319` | localStorage | getItem |
| `arowana_chart_webhook_url` | `chart-analysis-form.html:728` | localStorage | getItem |
| `arowana_chart_webhook_url` | `short-term-dashboard.html:2727` | localStorage | getItem |
| `arowana_iv_apikeys` | `ai-valuation.html:350` | localStorage | getItem |
| `arowana_iv_apikeys` | `ai-valuation.html:357` | localStorage | getItem |
| `arowana_iv_apikeys` | `ai-valuation.html:362` | localStorage | setItem |
| `arowana_iv_apikeys` | `ai-valuation.html:366` | localStorage | getItem |
| `arowana_iv_apikeys` | `ai-valuation.html:368` | localStorage | setItem |
| `arowana_iv_apikeys` | `ai-valuation.html:500` | localStorage | getItem |
| `arowana_iv_apikeys` | `intrinsic-value.html:5807` | localStorage | getItem |
| `arowana_iv_apikeys` | `intrinsic-value.html:5815` | localStorage | setItem |
| `arowana_iv_apikeys` | `intrinsic-value.html:5820` | localStorage | removeItem |
| `arowana_iv_apikeys` | `intrinsic-value.html:5826` | localStorage | getItem |
| `arowana_lt_main_webhook` | `long-term-dashboard.html:2674` | localStorage | getItem |
| `arowana_lt_main_webhook` | `long-term-dashboard.html:2810` | localStorage | getItem |
| `arowana_lt_main_webhook` | `long-term-dashboard.html:2975` | localStorage | getItem |
| `arowana_lt_main_webhook` | `long-term-dashboard.html:3231` | localStorage | getItem |
| `arowana_lt_main_webhook` | `long-term-dashboard.html:3527` | localStorage | getItem |
| `arowana_lt_main_webhook` | `long-term-dashboard.html:4421` | localStorage | getItem |
| `arowana_movers_webhook` | `short-term-dashboard.html:2725` | localStorage | getItem |
| `arowana_st_main_webhook` | `ai-trading-agent.html:310` | localStorage | getItem |
| `arowana_st_main_webhook` | `arowana-trader.html:992` | localStorage | getItem |
| `arowana_st_main_webhook` | `short-term-dashboard.html:2724` | localStorage | getItem |
| `arowana_st_main_webhook` | `whale-tracker.html:950` | localStorage | getItem |
| `daily_summary_settings_v1` | `daily-summary.html:170` | localStorage | getItem |
| `daily_summary_settings_v1` | `daily-summary.html:189` | localStorage | setItem |
| `daily_summary_settings_v1` | `daily-summary.html:348` | localStorage | removeItem |
| `div_tracker` | `dividend-tracker.html:5146` | localStorage | getItem |
| `div_tracker` | `dividend-tracker.html:5153` | localStorage | setItem |
| `finnhub_api_key` | `options-hub.html:3378` | localStorage | getItem |
| `google_oauth_return` | `settings.html:1437` | localStorage | setItem |
| `google_oauth_state` | `settings.html:1436` | localStorage | setItem |
| `gs_auth_user_v1` | `about.html:232` | localStorage | getItem |
| `gs_auth_user_v1` | `account.html:1018` | localStorage | getItem |
| `gs_auth_user_v1` | `account.html:1018` | sessionStorage | getItem |
| `gs_auth_user_v1` | `account.html:1573` | localStorage | getItem |
| `gs_auth_user_v1` | `account.html:1981` | localStorage | getItem |
| `gs_auth_user_v1` | `account.html:2088` | localStorage | removeItem |
| `gs_auth_user_v1` | `account.html:2089` | sessionStorage | removeItem |
| `gs_auth_user_v1` | `account.html:2183` | localStorage | getItem |
| `gs_auth_user_v1` | `account.html:2183` | sessionStorage | getItem |
| `gs_auth_user_v1` | `account.html:2328` | localStorage | getItem |
| `gs_auth_user_v1` | `advanced-trading-tools.html:25` | localStorage | getItem |
| `gs_auth_user_v1` | `advanced-trading-tools.html:25` | sessionStorage | getItem |
| `gs_auth_user_v1` | `advanced-trading-tools.html:4391` | localStorage | removeItem |
| `gs_auth_user_v1` | `advanced-trading-tools.html:4391` | sessionStorage | removeItem |
| `gs_auth_user_v1` | `ai-morning-brief.html:2399` | localStorage | getItem |
| `gs_auth_user_v1` | `ai-trading-agent.html:329` | localStorage | getItem |
| `gs_auth_user_v1` | `ai-trading-agent.html:333` | localStorage | removeItem |
| `gs_auth_user_v1` | `analysis-central.html:33` | localStorage | getItem |
| `gs_auth_user_v1` | `analysis-central.html:33` | sessionStorage | getItem |
| `gs_auth_user_v1` | `analysis-central.html:6380` | localStorage | removeItem |
| `gs_auth_user_v1` | `analysis-central.html:6381` | sessionStorage | removeItem |
| `gs_auth_user_v1` | `analysis-central.html:6426` | localStorage | getItem |
| `gs_auth_user_v1` | `analysis-central.html:6426` | sessionStorage | getItem |
| `gs_auth_user_v1` | `analysis-central.html:9447` | localStorage | getItem |
| `gs_auth_user_v1` | `analysis-central.html:11396` | localStorage | getItem |
| `gs_auth_user_v1` | `arowana-trader.html:2854` | localStorage | getItem |
| `gs_auth_user_v1` | `arowana-trader.html:2962` | localStorage | getItem |
| `gs_auth_user_v1` | `arowana-trader.html:2962` | sessionStorage | getItem |
| `gs_auth_user_v1` | `arowana-trader.html:3008` | localStorage | removeItem |
| `gs_auth_user_v1` | `arowana-trader.html:3008` | sessionStorage | removeItem |
| `gs_auth_user_v1` | `arowana-trader.html:3602` | localStorage | getItem |
| `gs_auth_user_v1` | `asset-allocation-builder.html:549` | localStorage | getItem |
| `gs_auth_user_v1` | `assignment-risk.html:310` | localStorage | getItem |
| `gs_auth_user_v1` | `atr-stop-planner.html:5103` | localStorage | getItem |
| `gs_auth_user_v1` | `base-breakout.html:428` | localStorage | getItem |
| `gs_auth_user_v1` | `billing.html:279` | localStorage | getItem |
| `gs_auth_user_v1` | `billing.html:279` | sessionStorage | getItem |
| `gs_auth_user_v1` | `billing.html:547` | localStorage | getItem |
| `gs_auth_user_v1` | `billing.html:548` | sessionStorage | getItem |
| `gs_auth_user_v1` | `billing.html:646` | localStorage | getItem |
| `gs_auth_user_v1` | `billing.html:646` | sessionStorage | getItem |
| `gs_auth_user_v1` | `blog.html:258` | localStorage | getItem |
| `gs_auth_user_v1` | `buy-sell-signal.html:360` | localStorage | getItem |
| `gs_auth_user_v1` | `buy-sell-signal.html:537` | localStorage | getItem |
| `gs_auth_user_v1` | `chart-analysis-form.html:635` | localStorage | getItem |
| `gs_auth_user_v1` | `chart-analysis-form.html:641` | localStorage | removeItem |
| `gs_auth_user_v1` | `chart-analysis-form.html:1082` | localStorage | getItem |
| `gs_auth_user_v1` | `checkout.html:286` | localStorage | getItem |
| `gs_auth_user_v1` | `checkout.html:286` | sessionStorage | getItem |
| `gs_auth_user_v1` | `checkout.html:601` | sessionStorage | getItem |
| `gs_auth_user_v1` | `contact.html:235` | localStorage | getItem |
| `gs_auth_user_v1` | `disclosures.html:187` | localStorage | getItem |
| `gs_auth_user_v1` | `dividend-screener.html:15` | localStorage | getItem |
| `gs_auth_user_v1` | `dividend-screener.html:15` | sessionStorage | getItem |
| `gs_auth_user_v1` | `features-tools-directory.html:1012` | localStorage | getItem |
| `gs_auth_user_v1` | `features.html:743` | localStorage | getItem |
| `gs_auth_user_v1` | `guide-claude-tradingview-windows.html:864` | localStorage | getItem |
| `gs_auth_user_v1` | `guide-claude-tradingview-windows.html:864` | sessionStorage | getItem |
| `gs_auth_user_v1` | `index.html:351` | localStorage | getItem |
| `gs_auth_user_v1` | `index.html:437` | localStorage | getItem |
| `gs_auth_user_v1` | `intrinsic-value.html:5713` | localStorage | getItem |
| `gs_auth_user_v1` | `intrinsic-value.html:5739` | localStorage | removeItem |
| `gs_auth_user_v1` | `intrinsic-value.html:6838` | localStorage | getItem |
| `gs_auth_user_v1` | `intrinsic-value.html:7222` | localStorage | getItem |
| `gs_auth_user_v1` | `intrinsic-value.html:7301` | localStorage | removeItem |
| `gs_auth_user_v1` | `intrinsic-value.html:7302` | sessionStorage | removeItem |
| `gs_auth_user_v1` | `intrinsic-value.html:7931` | localStorage | getItem |
| `gs_auth_user_v1` | `js/app-config.js:77` | localStorage | getItem |
| `gs_auth_user_v1` | `js/app-config.js:98` | localStorage | getItem |
| `gs_auth_user_v1` | `js/app-config.js:366` | localStorage | getItem |
| `gs_auth_user_v1` | `js/app-config.js:367` | sessionStorage | getItem |
| `gs_auth_user_v1` | `js/auth-header.js:61` | localStorage | getItem |
| `gs_auth_user_v1` | `js/auth-header.js:66` | sessionStorage | getItem |
| `gs_auth_user_v1` | `js/auth-header.js:76` | localStorage | removeItem |
| `gs_auth_user_v1` | `js/auth-header.js:77` | sessionStorage | removeItem |
| `gs_auth_user_v1` | `js/auth-header.js:87` | localStorage | removeItem |
| `gs_auth_user_v1` | `js/auth-header.js:88` | sessionStorage | removeItem |
| `gs_auth_user_v1` | `js/journal-sync.js:701` | localStorage | getItem |
| `gs_auth_user_v1` | `js/journal-sync.js:702` | sessionStorage | getItem |
| `gs_auth_user_v1` | `js/nav-rail.js:526` | localStorage | getItem |
| `gs_auth_user_v1` | `js/scanners.js:173` | localStorage | getItem |
| `gs_auth_user_v1` | `js/session-user.js:43` | localStorage | getItem |
| `gs_auth_user_v1` | `js/session-user.js:43` | sessionStorage | getItem |
| `gs_auth_user_v1` | `js/session-user.js:96` | localStorage | setItem |
| `gs_auth_user_v1` | `js/workspace-footer.js:38` | localStorage | getItem |
| `gs_auth_user_v1` | `js/workspace-footer.js:39` | sessionStorage | getItem |
| `gs_auth_user_v1` | `learn-investing.html:426` | localStorage | getItem |
| `gs_auth_user_v1` | `login.html:918` | localStorage | setItem |
| `gs_auth_user_v1` | `login.html:935` | localStorage | getItem |
| `gs_auth_user_v1` | `login.html:938` | localStorage | setItem |
| `gs_auth_user_v1` | `login.html:941` | localStorage | setItem |
| `gs_auth_user_v1` | `login.html:1109` | localStorage | removeItem |
| `gs_auth_user_v1` | `long-term-dashboard.html:3442` | localStorage | getItem |
| `gs_auth_user_v1` | `long-term-dashboard.html:3469` | localStorage | removeItem |
| `gs_auth_user_v1` | `long-term-dashboard.html:4169` | localStorage | getItem |
| `gs_auth_user_v1` | `long-term-dashboard.html:4763` | localStorage | getItem |
| `gs_auth_user_v1` | `momentum-hunter-complete.html:1850` | localStorage | getItem |
| `gs_auth_user_v1` | `momentum-hunter-complete.html:2199` | localStorage | getItem |
| `gs_auth_user_v1` | `momentum-hunter-complete.html:2778` | localStorage | removeItem |
| `gs_auth_user_v1` | `momentum-hunter.html:1778` | localStorage | getItem |
| `gs_auth_user_v1` | `momentum-hunter.html:2101` | localStorage | getItem |
| `gs_auth_user_v1` | `momentum-hunter.html:2681` | localStorage | removeItem |
| `gs_auth_user_v1` | `options-analyzer.html:5200` | localStorage | getItem |
| `gs_auth_user_v1` | `options-hub.html:30` | localStorage | getItem |
| `gs_auth_user_v1` | `options-hub.html:30` | sessionStorage | getItem |
| `gs_auth_user_v1` | `options-hub.html:8643` | localStorage | removeItem |
| `gs_auth_user_v1` | `options-hub.html:8644` | sessionStorage | removeItem |
| `gs_auth_user_v1` | `options-hub.html:8720` | localStorage | getItem |
| `gs_auth_user_v1` | `options-hub.html:8720` | sessionStorage | getItem |
| `gs_auth_user_v1` | `options-hub.html:9419` | localStorage | getItem |
| `gs_auth_user_v1` | `options-journal.html:638` | localStorage | getItem |
| `gs_auth_user_v1` | `pattern-scanner.html:22` | localStorage | getItem |
| `gs_auth_user_v1` | `pattern-scanner.html:22` | sessionStorage | getItem |
| `gs_auth_user_v1` | `portfolio-advisor.html:1066` | localStorage | getItem |
| `gs_auth_user_v1` | `portfolio-advisor.html:1212` | localStorage | getItem |
| `gs_auth_user_v1` | `portfolio-advisor.html:2125` | localStorage | getItem |
| `gs_auth_user_v1` | `portfolio-advisor.html:3001` | localStorage | getItem |
| `gs_auth_user_v1` | `portfolio-advisor.html:3086` | localStorage | getItem |
| `gs_auth_user_v1` | `portfolio-advisor.html:3086` | sessionStorage | getItem |
| `gs_auth_user_v1` | `portfolio-advisor.html:3116` | localStorage | removeItem |
| `gs_auth_user_v1` | `portfolio-advisor.html:3116` | sessionStorage | removeItem |
| `gs_auth_user_v1` | `portfolio-command.html:25` | localStorage | getItem |
| `gs_auth_user_v1` | `portfolio-command.html:25` | sessionStorage | getItem |
| `gs_auth_user_v1` | `portfolio-command.html:6187` | localStorage | removeItem |
| `gs_auth_user_v1` | `portfolio-command.html:6188` | sessionStorage | removeItem |
| `gs_auth_user_v1` | `portfolio-command.html:6346` | localStorage | getItem |
| `gs_auth_user_v1` | `portfolio-command.html:6346` | sessionStorage | getItem |
| `gs_auth_user_v1` | `portfolio-command.html:6820` | localStorage | getItem |
| `gs_auth_user_v1` | `portfolio-command.html:6820` | sessionStorage | getItem |
| `gs_auth_user_v1` | `portfolio-command.html:13373` | localStorage | getItem |
| `gs_auth_user_v1` | `position-sizer.html:282` | localStorage | getItem |
| `gs_auth_user_v1` | `position-sizer.html:282` | sessionStorage | getItem |
| `gs_auth_user_v1` | `position-sizer.html:315` | localStorage | removeItem |
| `gs_auth_user_v1` | `position-sizer.html:315` | sessionStorage | removeItem |
| `gs_auth_user_v1` | `position-sizer_fresh.html:3074` | localStorage | getItem |
| `gs_auth_user_v1` | `position-sizer_fresh.html:3101` | localStorage | removeItem |
| `gs_auth_user_v1` | `pricing-revolutionary.html:651` | localStorage | getItem |
| `gs_auth_user_v1` | `pricing.html:785` | localStorage | getItem |
| `gs_auth_user_v1` | `pricing.html:786` | sessionStorage | getItem |
| `gs_auth_user_v1` | `privacy.html:199` | localStorage | getItem |
| `gs_auth_user_v1` | `refunds.html:255` | localStorage | getItem |
| `gs_auth_user_v1` | `reset-password.html:965` | localStorage | removeItem |
| `gs_auth_user_v1` | `reset-password.html:966` | sessionStorage | removeItem |
| `gs_auth_user_v1` | `retirement-planner.html:1857` | localStorage | getItem |
| `gs_auth_user_v1` | `retirement-planner.html:1857` | sessionStorage | getItem |
| `gs_auth_user_v1` | `risk-disclosure.html:254` | localStorage | getItem |
| `gs_auth_user_v1` | `rvol-scanner.html:711` | localStorage | getItem |
| `gs_auth_user_v1` | `security.html:239` | localStorage | getItem |
| `gs_auth_user_v1` | `short-term-dashboard.html:3543` | localStorage | getItem |
| `gs_auth_user_v1` | `short-term-dashboard.html:3807` | localStorage | getItem |
| `gs_auth_user_v1` | `short-term-dashboard.html:4278` | localStorage | getItem |
| `gs_auth_user_v1` | `short-term-dashboard.html:4333` | localStorage | getItem |
| `gs_auth_user_v1` | `short-term-dashboard.html:4360` | localStorage | removeItem |
| `gs_auth_user_v1` | `short-term-dashboard.html:4531` | localStorage | getItem |
| `gs_auth_user_v1` | `short-term-dashboard.html:4835` | localStorage | getItem |
| `gs_auth_user_v1` | `signup.html:902` | localStorage | setItem |
| `gs_auth_user_v1` | `signup.html:903` | sessionStorage | setItem |
| `gs_auth_user_v1` | `sma-cross-scanner.html:862` | localStorage | getItem |
| `gs_auth_user_v1` | `stock-analyzer.html:532` | localStorage | getItem |
| `gs_auth_user_v1` | `stock-analyzer.html:539` | localStorage | removeItem |
| `gs_auth_user_v1` | `stock-analyzer.html:745` | localStorage | getItem |
| `gs_auth_user_v1` | `strategy-backtesting.html:5271` | localStorage | getItem |
| `gs_auth_user_v1` | `strategy-backtesting.html:5387` | localStorage | getItem |
| `gs_auth_user_v1` | `support.html:191` | localStorage | getItem |
| `gs_auth_user_v1` | `swing-trader.html:838` | localStorage | getItem |
| `gs_auth_user_v1` | `technical-analysis.html:5185` | localStorage | getItem |
| `gs_auth_user_v1` | `terms.html:211` | localStorage | getItem |
| `gs_auth_user_v1` | `tool-audit.html:4897` | localStorage | getItem |
| `gs_auth_user_v1` | `trade-journal-pro.html:6826` | localStorage | getItem |
| `gs_auth_user_v1` | `trade-journal-pro.html:6826` | sessionStorage | getItem |
| `gs_auth_user_v1` | `trade-journal-pro.html:7546` | localStorage | getItem |
| `gs_auth_user_v1` | `trade-plan-builder.html:889` | localStorage | getItem |
| `gs_auth_user_v1` | `trade-plan-builder.html:889` | sessionStorage | getItem |
| `gs_auth_user_v1` | `trade-plan-builder.html:922` | localStorage | removeItem |
| `gs_auth_user_v1` | `trade-plan-builder.html:922` | sessionStorage | removeItem |
| `gs_auth_user_v1` | `trading-command.html:25` | localStorage | getItem |
| `gs_auth_user_v1` | `trading-command.html:25` | sessionStorage | getItem |
| `gs_auth_user_v1` | `trading-command.html:5648` | localStorage | removeItem |
| `gs_auth_user_v1` | `trading-command.html:5649` | sessionStorage | removeItem |
| `gs_auth_user_v1` | `trading-command.html:7338` | localStorage | getItem |
| `gs_auth_user_v1` | `trading-command.html:7338` | sessionStorage | getItem |
| `gs_auth_user_v1` | `trading-command.html:8916` | localStorage | getItem |
| `gs_auth_user_v1` | `trading-command.html:8916` | sessionStorage | getItem |
| `gs_auth_user_v1` | `trading-command.html:10103` | localStorage | getItem |
| `gs_auth_user_v1` | `trading-journal-analysis.html:1338` | localStorage | getItem |
| `gs_auth_user_v1` | `trading-journal-analysis.html:1454` | localStorage | getItem |
| `gs_auth_user_v1` | `tradingcommand.html:25` | localStorage | getItem |
| `gs_auth_user_v1` | `tradingcommand.html:25` | sessionStorage | getItem |
| `gs_auth_user_v1` | `tradingcommand.html:5111` | localStorage | removeItem |
| `gs_auth_user_v1` | `tradingcommand.html:5112` | sessionStorage | removeItem |
| `gs_auth_user_v1` | `tradingcommand.html:6321` | localStorage | getItem |
| `gs_auth_user_v1` | `tradingcommand.html:6321` | sessionStorage | getItem |
| `gs_auth_user_v1` | `tradingcommand.html:7760` | localStorage | getItem |
| `gs_auth_user_v1` | `tradingcommand.html:7760` | sessionStorage | getItem |
| `gs_auth_user_v1` | `updated-navigation.html:213` | localStorage | getItem |
| `gs_auth_user_v1` | `watchlist.html:1704` | localStorage | getItem |
| `gs_auth_user_v1` | `watchlist.html:1704` | sessionStorage | getItem |
| `gs_auth_user_v1` | `watchlist.html:1774` | localStorage | removeItem |
| `gs_auth_user_v1` | `watchlist.html:1774` | sessionStorage | removeItem |
| `gs_auth_user_v1` | `whale-tracker.html:2564` | localStorage | getItem |
| `gs_auth_user_v1` | `whale-tracker.html:2707` | localStorage | getItem |
| `gs_auth_user_v1` | `whale-tracker.html:2707` | sessionStorage | getItem |
| `gs_auth_user_v1` | `whale-tracker.html:2753` | localStorage | removeItem |
| `gs_auth_user_v1` | `whale-tracker.html:2753` | sessionStorage | removeItem |
| `gs_auth_user_v1` | `wheel-calculator.html:296` | localStorage | getItem |
| `gs_auth_user_v1` | `wheel-strategy.html:25` | localStorage | getItem |
| `gs_auth_user_v1` | `wheel-strategy.html:25` | sessionStorage | getItem |
| `ltp_webhook` | `long-term-portfolio.html:566` | localStorage | getItem |
| `ltp_webhook` | `long-term-portfolio.html:570` | localStorage | setItem |
| `td_api_key` | `position-sizer_fresh.html:1843` | localStorage | getItem |
| `td_api_key` | `short-term-dashboard.html:2590` | localStorage | getItem |
