# ATD-001 — Full repository feature audit

Audit date: 2026-09-27. Baseline: `e2a9cc3` (`main` at inspection). Working branch: `codex/ATD-001-full-repository-audit`. Author: Codex. Status: completed static audit; recommendations await owner review.

## Executive summary

This is a substantial legacy application, not a greenfield repository: 249 baseline tracked files, including 174 root-level HTML files, 32 JavaScript modules, four CSS files, and one JSON configuration file. Several core pages contain 8,000–13,639 lines. The repository has only two import-style commits, so commit history cannot establish which implementation is authoritative.

Preserve the useful journal, holdings/account infrastructure, deterministic calculators, watchlist analysis, options workflows, CSV imports, and shared registries. Use Trading Command, Portfolio Command, Ticker Research, Options Hub, Watchlist, and Trade Journal Pro as migration entry points. These are recommended canonical *sources*, not certified production-ready implementations. Extract their calculations and data access behind contracts before replacing page shells.

The source contradicts the description of a purely pre-Wheel baseline: `index.html` advertises a Wheel Strategy Desk, `arowana-trader.html` is a Wheel Coach, and Market Intelligence is a retired redirect. Unrelated Salon Genie and GenieSphere business pages are also present. Arowana 2.0 needs a deliberate product boundary rather than adopting the current navigation wholesale.

Immediate blockers are browser credential workflows, a remaining credential-like Twelve Data literal in `js/option-roll-analyzer.js:9`, missing backend definitions/migrations, inconsistent data ownership, and missing client dependencies. The existing secret scanner passes but does not detect the Twelve Data literal format. Its validity was not tested and its value is deliberately omitted here. Historical rotation claims are not proof that the current source is clean.

No application functionality, credentials, deployment configuration, or legacy files were changed. ATD-002 and the other follow-on tasks were not started. All classifications below are migration recommendations, not permission to delete or deploy anything.

## Scope, method, and classification legend

Inventory covers every baseline HTML, JS, CSS, and JSON file individually, then all remaining assets, documentation, and tooling by explicit file or bounded group. Source inspection included titles, executable inline scripts, shared includes, imports, functions, fetch/SDK call sites, storage conventions, duplicate hashes, and local URL resolution. Deeper inspection focused on the functional groups requested in ATD-001. Binary artwork and historical Word documents were inventoried, not rendered or treated as implementation contracts.

This is a static migration audit, not a full security penetration test or line-by-line correctness certification. No browser sessions, production API calls, database queries, credential validation, dependency downloads, or external repository access were performed. No current provider entitlement or endpoint availability is inferred from source comments. Unreferenced means no matching static HTML include was found; imports, generated markup, and external consumers can still exist.

| Classification | Meaning in this audit |
|---|---|
| KEEP | Preserve purpose and current source as a useful baseline; normal verification still required. |
| MODIFY | Preserve the feature, but extract, normalize, or adapt its implementation. |
| MERGE | Preserve useful behavior/data within the named canonical page/service; retire the competing entry point only after parity and migration checks. |
| PORT | Bring selected behavior into the future architecture or from the separate Wheel source, after comparison and tests; no port performed here. |
| ARCHIVE | Keep historical source outside the future active product once ownership and retention are approved. |
| DELETE | Future deletion candidate with narrow evidence of redundancy; not deleted in this task. |
| SECURITY FIX | Security work is the prerequisite to reuse; the survival/target column specifies the intended eventual disposition. |

Priority: **P0** = before real-user/secret-connected reuse; **P1** = foundation and core migration; **P2** = strategy/research consolidation; **P3** = deferred product scope or cleanup. Priority is migration order, not a claim that every issue is an exploitable vulnerability. An archived page can still require P0 removal from public deployment or credential cleanup. Each inventory row has one primary classification; security signals can coexist with MERGE/ARCHIVE.

## Current-system map

```text
174 independent HTML pages (inline CSS, DOM state, calculations, fetch calls)
  + shared browser globals: config/auth, journal, account, risk, scanner registries
  + localStorage/sessionStorage: identity cache, keys, trades, watchlists, preferences
  + Supabase JS / direct REST: auth, user records, cached research, billing state
  + Finnhub fetch interception -> arowana-research Edge Function
  + direct provider calls: Finnhub / Twelve Data / Alpha Vantage / FMP / Yahoo / Stooq
  + configurable n8n webhooks and AI endpoints
  + referenced broker/billing/AI server functions (implementations absent here)
```

The target remains the existing architecture document: providers -> normalized Data Hub -> deterministic engines -> AI analysis -> risk/strategy/execution plan. Alpaca, FMP, FRED, and SEC are target choices, not an implemented ingestion stack in this checkout. TradingView and brokers remain external charting/execution systems.

| Subsystem | Current sources and behavior | Classification / future boundary |
|---|---|---|
| Trading Command | `trading-command.html`: market read, brief, setups, positions, coaching, POC; competitor `tradingcommand.html` | MODIFY; preserve command surface, extract market/POC/position/brief services. |
| Arowana Trader / AI Coach | `arowana-trader.html` has watchlist/setup/journal context and server coach calls; now titled Wheel Coach. `whale-tracker.html` is another coach, not whale-flow infrastructure. | MODIFY main coach; MERGE competitors; broaden routing only after product approval. |
| Morning Brief | `ai-morning-brief.html` runs a configurable webhook; Trading Command consumes cached `ai_briefs`; old daily summaries overlap. | MODIFY one brief contract; distinguish generated report from cache and unavailable output. |
| Market Intelligence | 47-line retirement/redirect page; sector pages mix Supabase placeholders and demos; command page has actual market-read logic. | MODIFY/reintroduce product capability later, not revive a nonexistent current engine. |
| Portfolio | Portfolio Command combines lots, option exposure, cash, deployment plans, and legacy portfolio fallbacks. | MODIFY; journal-derived positions plus one account/holdings service. |
| Watchlists | `watchlist.html` richer registry-based analysis; short/long-term lists and command/coach use competing storage shapes. | MODIFY main watchlist; MERGE others through a lossless data adapter. |
| Position/risk | Position Sizer, Trade Plan Builder, `position-math.js`, `risk.js`, R/Kelly/ATR/expectancy tools. | MODIFY shared Risk Engine; KEEP pure arithmetic as extraction baseline. |
| Journals | Trade Journal Pro + sync/context/fields; older journals read other tables or local keys. | MODIFY main journal; MERGE/import older records before retiring UIs. |
| Options/Wheel | Options Hub, Wheel history parser, standalone arithmetic, roll pages, candidate caches. | MODIFY hub; PORT selected tested Wheel functionality; options data availability remains a separate blocker. |
| Technical scanners | Shared scanner registry plus many independent mock/webhook pages; strategy registry computes daily-bar indicators/proxies. | MERGE under `scanner.html`; use declared data requirements and explicit unavailable states. |
| Fundamental/valuation | Ticker Research, Intrinsic Value, DCF, quality/moat/dividend tools. | MODIFY deterministic research services; AI explains inputs/results, does not supply authoritative facts. |
| Long-term tools | Allocation, DCA, IPS, dividend/retirement/tax calculators and old dashboard. | Preserve investment-planning kernels selectively; defer household/tax advice products. |
| Identity/account | Multiple Supabase clients, cached user repair, browser entitlements, BYOK synchronization. | SECURITY FIX; one session authority and server-enforced isolation/entitlements. |
| Navigation/theme | Shared rail plus many inline copies, a mislabeled auth-guard, three token files. | MERGE into shared rail and CSS source while maintaining URL compatibility. |

## Canonical-page recommendations

Canonical means the best *in-repository migration source* based on implemented behavior and dependencies. It does not mean the largest file wins or that a deployed page was verified. Existing URLs remain untouched.

| Family | Recommended canonical source / target | Evidence and competing implementations |
|---|---|---|
| Command dashboards | `trading-command.html` | Has cached brief/snapshot consumption and POC functions absent from the older 8,228-line `tradingcommand.html`; merge short-term/daytrade dashboards. |
| Coaching | `arowana-trader.html` | Shared session, journal sync, watchlists, server coach integration; merge `whale-tracker.html` and `ai-trading-agent.html`. Preserve broad coach use cases rather than copying Wheel-only positioning. |
| Briefs | `ai-morning-brief.html` + command cached-brief view | One future server report contract; merge `daily-summary.html`/`daily-bias.html` relevant context. Their current payloads are not proven interchangeable. |
| Market intelligence | Future Market Engine surfaced through `market-intelligence.html`/Command | Current file is only a redirect. Neither sector-sentiment variant is an authoritative engine. |
| Portfolio | `portfolio-command.html` | Integrates journal lots, cash and deployment plans; merge `portfolio-advisor.html`, `long-term-portfolio.html`, `portfolio-tracker.html` useful behavior. |
| Watchlist | `watchlist.html` | Strategy registry, modes, journal conversion and richer review UI; merge `short-term-watchlist.html`, `long-term-watchlist.html`, `my-watchlist.html`, `iv-watchlist-module.html`. |
| Position sizing | `position-sizer.html`; math in `js/position-math.js` | Focused 339-line current page; `_fresh` is a large mixed dashboard/template. Current sizer still duplicates arithmetic rather than importing position-math. |
| Journals | `trade-journal-pro.html` with `js/journal-sync.js` | Stock/options lots, import and dossier workflows; `master-journal.html` is a view over different tables, not a drop-in replacement. Merge trade/options journals and analysis carefully. |
| Options | `options-hub.html` | Candidate/roll/position context and risk module; already receives redirects from `options-recommender.html` and `options-strategies.html`. Missing layout script is a migration blocker. |
| Wheel | `wheel-strategy.html` and `wheel-calculator.html` as local baseline | History parsing/chain calculation versus a pure educational calculator; `wheel_strategy_web_tool.html` is an earlier parser. Future Wheel repo is uninspected and cannot yet supersede either automatically. |
| Scanners | `scanner.html`, `js/scanners.js`, `js/scanner-defs.js` | Registry declares unavailable scans instead of pretending broad-market browser scans work. Preserve individual filter/CSV ideas as strategy definitions. |
| Momentum variants | `momentum-hunter-complete.html` as comparison source, then shared scanner | Complete variant has explicit data-mode handling and different data acquisition; no evidence either legacy version supports a licensed market-wide scan. Both merge, neither becomes a new canonical route. |
| Base breakout variants | `base-breakout.html` as behavior source, then shared scanner | Non-space filename has webhook configuration; `base-breakout .html` competes and is not byte-identical. Compare filters before retiring it. |
| Fundamental research | `analysis-central.html` | Fundamental/technical/sentiment research context and portfolio/watchlist links; merge `stock-analyzer.html`, `stock-checker.html` relevant behavior. |
| Intrinsic valuation | `intrinsic-value.html`; extract DCF kernels from `dcf-analyzer.html` | Merge `ai-valuation.html`, `ai_valuation.html`, `long-term-intrinsic-value.html`, `intrinsic-value-rsi.html`; preserve model assumptions and units, not invented live data. |
| Risk policies | `my-rules.html` as rules UI source, shared future Risk Engine | `my-rules-short.html` overlaps closely; long-term rules retain horizon-specific settings. Wheel-only `risk.js` does not replace a general risk policy. |
| Sector sentiment | `sector-sentiment-gauge.html` as richer display reference only | Both variants contain mock-history and placeholder database configuration; merge visual ideas into Market Intelligence. |
| Retirement | `retirement-planner.html` as workflow reference; calculator as math reference | Broader roadmap versus projection calculator. Defer product/legal assumptions rather than declaring formulas authoritative. |
| Marketing/tools | `index.html`, `features.html`, `tools.html`, `pricing.html` | Modify Wheel branding/private-beta scope; merge old feature directories and pricing variant. Tools catalog is not a backend feature registry. |
| Navigation | `js/nav-rail.js` | `js/auth-guard.js` actually contains an older rail; inline rails and `updated-navigation.html` compete. `js/bottom-nav.js` is Salon-oriented. |
| Theme | `css/theme.css` | Contains the same token baseline plus opt-in layout additions; `theme.css` and `js/theme.css` are byte-identical. 17 HTML stylesheet references use css/theme; 12 use js/theme. Port needed rules, then redirect/replace includes deliberately. |
| Analyzer registry | `js/strategy-analyzers.js` | Adds POC and expanded Wheel analysis versus `_v1`; credential paths still require replacement. |
| Setup scorecard | `js/setup-scorecard.js` | Byte-identical to `_v9`, with active current-name consumers. Versioned copy is a narrow future DELETE candidate. |

## Duplicate/obsolete-page matrix

| Sources | Recommendation | Retirement condition |
|---|---|---|
| `tradingcommand.html`, `short-term-dashboard.html`, `daytrade.html` | MERGE into Trading Command | Inventory unique widgets, saved state, inbound links and user workflows first. |
| `whale-tracker.html`, `ai-trading-agent.html` | MERGE into Arowana Trader | Preserve useful coaching context, eliminate direct browser AI credentials and demo ambiguity. |
| Old watchlists, journals, portfolio pages | MERGE as above | Export/import reconciliation across every data model; no data deletion based on UI overlap. |
| `ai_valuation.html` | ARCHIVE incomplete shell | Missing `valuation-logic.js`; no standalone engine to preserve. |
| `options-recommender.html`, `options-strategies.html` | KEEP compatibility redirects | Keep until link telemetry/owner confirms old URLs can retire. |
| `market-intelligence.html` | MODIFY retired route in a later feature task | Product owner must approve broad market desk restoration. |
| `orb-scanner.html` | MERGE placeholder into registry | Its title explicitly says Coming Soon; do not count it as a working ORB engine. |
| `dashboard.html`, `settings.html`, `overview.html`, `js/bottom-nav.js` | ARCHIVE unrelated Salon/GenieSphere modules | Confirm separate product ownership and deploy routing; do not migrate business/OAuth tables into trading. |
| `feature_body.html`, `feature_new.html`, `pricing-revolutionary.html` | MERGE/ARCHIVE old marketing | Preserve relevant copy only after product/pricing decisions. |
| `arowana-template.html`, `short-term-template.html`, `task-template.html`, `template.html`, `template_new.html`, `updated-navigation.html` | ARCHIVE old scaffolds | Extract any required style/layout reference; not production routes. |
| `options-hub-creator.html` | ARCHIVE one-off HTML rewriting utility | It downloads modified HTML, not a trading feature; syntax check also fails. |
| `cover-call-option-recommentor.html` | ARCHIVE prototype workflow | Despite extension it is valid n8n workflow JSON with a mock option chain and ChatGPT node, not an HTML page or production backend. |
| `test_webhook.html` | ARCHIVE external webhook test form | Keep out of future public product routing. |
| `js/dividend-screener.js`, `js/invest-helper-logic.js`, `js/option-roll-analyzer.js` | ARCHIVE or SECURITY FIX before archive | No matching static script includes found; do not equate that with safe credential exposure. Current dividend page uses a different storage feed. |
| `js/setup-scorecard_v9.js`, root `theme.css` | DELETE candidates after reference audit | Byte-identical replacements exist; no deletion authorized by this report. |
| `index_v*.html` mentioned in prior audit | Documentation correction only | No such files exist in the inspected tree. |

## Integration inventory

| Integration / classification | Current callers and contract evidence | Missing/reconciliation work |
|---|---|---|
| Supabase — SECURITY FIX | SDK, raw REST, auth and storage across core pages; hardcoded project/anon configuration duplicated | No migrations, table definitions, RLS policies, Edge Function sources or environment deployment definitions. Public anon key is not a private secret; access safety is unverified. |
| Finnhub — MODIFY | Quote/profile/metrics/candle calls in pages and registries; `js/market-data.js` intercepts fetch URLs containing Finnhub API and posts `{path, query}` with user JWT to `arowana-research` | Shim is loaded on selected pages only; BYOK preconditions remain elsewhere. It is a global fetch patch, not a normalized provider contract. Source comments about entitlement limits are not current verification. |
| Twelve Data — SECURITY FIX | `strategy-analyzers.js` daily bars, legacy ticker strips, valuation, roll helper; query-string API keys | Remaining literal and browser BYOK workflows. Normalize bars, timezone/session boundaries and errors in future Data Hub. |
| Alpha Vantage — SECURITY FIX | Analyzer fallback daily bars, technical analysis, valuation, weekly report and legacy RSI page | Key handling and differing history lengths/frequency; fallback provenance not uniformly carried through computations. |
| FMP — MODIFY | Trading Command POC, research, intrinsic valuation and some lookup helpers | Adopt versioned fundamental/intraday contracts only after entitlements, estimates and required granularity are decided. |
| Yahoo / Stooq — MODIFY | `earning-watcher.html`, `weekly-swing-trade-post.html`; `post-earnings-drift.html`, `short-entry-screener.html` | Browser CORS, endpoint stability, market calendars and licensing are unverified. No ingestion jobs are supplied. |
| OpenAI — SECURITY FIX | `js/invest-helper-logic.js:166` directly calls chat completions with removed-key placeholder; mock n8n covered-call workflow references ChatGPT | Keep no browser private-key flow; archived helper is not a functional backend. |
| Anthropic — SECURITY FIX | Direct browser request in `ai-trading-agent.html`; provider/config references in app-config and portfolio advisor; other tools use coach/webhook abstractions | Server broker should accept validated user context and deterministic facts, with clear uncertainty and prompt/data boundaries. A mention in copied shell code is not proof of a live AI feature. |
| AI coach Edge Function — MODIFY | `arowana-ai-coach` referenced by Command, Trader, whale clone, plan builder and diagnostics | Source absent; authorization, model, tools, prompt, quotas and retention cannot be verified. |
| n8n — SECURITY FIX | Literal endpoints, config keys and user-specified webhook URLs, sometimes with user/provider headers | No production workflow exports/contracts except one mock JSON prototype. Browser editable URLs and data destinations need review; configured URL is not evidence of access control. |
| Schwab — MODIFY | Static connection mockup plus callback page posting `{code,state}` with JWT | Callback uses same-origin `/functions/v1/schwab-auth-callback`; no hosting proxy or exchange/refresh/sync implementation. Validate OAuth state/PKCE, token storage and redirect policy server-side later. Remain read-only. |
| Stripe / entitlement — MODIFY | Checkout/billing endpoints; `profiles.arowana_plan`; `js/plan.js` assumes Stripe webhook authority | Checkout/portal implementations and Stripe webhook source absent. Browser plan/cache/dev overrides cannot authorize server access. Private-beta billing scope is undecided. |
| TradingView / Stocktwits — KEEP | Chart widgets, links, sentiment widget in Ticker Research | Preserve optional chart confirmation; do not treat third-party widgets as normalized data sources. |
| CDN/vendor assets — MODIFY | Supabase bundled 2.45.3, CDN 2.45.4 and floating @2; Chart.js floating and 4.4.0; Font Awesome/fonts; dynamically loaded SheetJS for Wheel spreadsheets | No lockfile or build system. Standardize intentional versions and integrity/dependency strategy later without introducing tooling in this task. |
| Alpaca / FRED / SEC EDGAR — PORT (planned integrations) | Architecture targets only; no implemented ingestion service found | Establish sources, licensing, freshness and contracts through ATD-004 before implementation. |

### Missing backend components

Literal Edge Function references: `arowana-ai-coach`, `arowana-research`, `arowana-checkout`, `arowana-billing-portal`, `arowana-founders-count`, `schwab-auth-callback`. `morning-brief` also appears in comments as a server-only route; the brief page actually resolves `st_scan`, a local override, then an n8n URL. RPC `ap_usage_summary` is invoked by `admin-usage.html`. Billing also resolves configurable function URLs. None has source here.

Absent producers include `ai_briefs`, `daily_setups`, `market_snapshots`, CC/CSP candidate and roll-coach caches; public dividend-screen JSON; scheduled broker sync/token refresh; Stripe entitlement synchronization; broad-market candle/universe scans; normalized fundamental/estimate history. The broker page names `connect-schwab`, `schwab-callback`, `sync-broker-now`, scheduled sync and auto-journal workflows as endpoints **to wire**, not implemented features.

Webhook names found include morning scan/daily brief, moat inference, six momentum scan variants, bulk quotes, symbol lookup, market status, chart analysis, position sizing, risk calculation, dividend screening, CLAP pullback, stock checker, option roll, quality screening, retirement narrative, and trade scans. Several are placeholders (`YOUR-*` hosts) or user-supplied. No network requests were made to establish which are deployed.

### Data models implied by the frontend

These are observed client expectations, **not verified database schema**. A literal `.from()`/REST reference can name an absent table. Field lists are illustrative, not migration DDL.

| Model family | Implied data and sources | Migration implication |
|---|---|---|
| Auth/profiles | Supabase Auth; `gs_auth_user_v1` cached identity; `profiles` with plan/status; `ap_usage`; `ap_usage_summary` RPC | Server owns identity/entitlements; cache supports UI only. |
| Provider keys | `user_api_keys` rows `{user_id, service, api_key}`; `ap_user_api_keys` browser object | Replace credential distribution to browsers; do not port schema blindly. |
| Stock journal | `tj_stocks_v2` -> `tj_stocks`: `id`, `user_id`, full JSON `payload`, `symbol`, `status`, entry/exit dates, setup/mistakes/emotions/R-multiple, `updated_at` | Preserve lot IDs and user ownership; determine authoritative store/conflict policy before migration. |
| Option journal | `tj_options_v2` -> `tj_options`: payload plus underlying, strategy, status, dates, manage-by, DTE, entry IV/delta/theta, assignment and behavioral fields | Preserve rolls/assignments/multipliers/cashflows; distinguish manual marks from feed marks. |
| Legacy journals | `journal_trades`, `trading_journal`, `option_chains`, `option_roll_chains` plus older local journals | Not synonyms for tj tables. Define import mappings and reconcile totals before consolidation. |
| Holdings | Journal lots aggregated by symbol and broker; `portfolio`, `portfolio_options` still referenced | `holdings-source.js` excludes shorts and uses weighted cost; this is not a complete exposure model. Source comment declares old portfolio stale, but current data was not queried. |
| Accounts/entities | `ap_accounts_v1`; old `tj_accounts_v1`/`pc_accounts_v1`; `arowana.entities`, `arowana.financial_accounts` | Normalize account IDs versus names/broker labels; account registry currently syncs best-effort and can remain local-only. |
| Cash/plans/risk | `user_cash_balances`, `user_deployment_plans`, `ap_risk_settings` | Separate actual cash, planned allocation, and risk limits; enforce ownership and timestamps. |
| Watchlists | `watchlists` plus `watchlist_items`; older pages persist JSON/local arrays while other callers expect child rows | Define one list/item contract and migration preserving notes, setup/target/horizon and list IDs. |
| Research outputs | `daily_setups`, `daily_bias_runs`, `ai_briefs`, `market_snapshots`, `sector_sentiment` | Need source/as-of/staleness and deterministic-versus-AI distinction; ingestion missing. |
| Options candidates | `cc_candidates`, `csp_candidates`, `ap_roll_coach` | Server producer/entitlement contract absent; cannot infer live option-chain coverage from table names. |
| Public screen data | Supabase Storage `public-data/dividend-screener/stocks.json`: `stocks`, `generated_at`, `stock_count` | Retain freshness UI; configuration shape currently disagrees with app-config. |
| Admin/commercial | `app_config`, `arowana_tools`, `arowana_webhooks`, `ap_founders_waitlist` | Separate admin authorization/configuration from user controls and public signups. |
| Deferred planning | `retirement_inputs`, local allocation/DCA/IPS/tax/retirement scenarios | Preserve exportable scenarios if feature retained; assumptions need human ownership. |
| Unrelated products | `business_profiles`, `business_settings`, `finance_transactions`, finance summary views, `user_preferences`, `check_ins`, Google/Meta OAuth tables; `salon.*` employee/task views | Archive pages from trading scope; never copy these tables merely because they appear in source. |

## Security findings

This section records ATD-001 migration blockers and evidence only. It does not perform ATD-002 credential migration or ATD-005 RLS work.

| ID | Evidence | Impact and recommended disposition |
|---|---|---|
| SEC-01 / P0 | `js/option-roll-analyzer.js:9` assigns a 32-character credential-like literal used in Twelve Data requests at line 19 | Treat as potentially exposed; owner should revoke/rotate if real. Later authorized task removes literal and expands detection. No value copied here and no validity test performed. |
| SEC-02 / P0 | `js/app-config.js` hydrates `user_api_keys` into localStorage and adds provider keys to webhook headers; `account.html` saves these keys; analyzers read them | Violates current no-private-keys-in-browser rule. Migrate provider access server-side before reuse. |
| SEC-03 / P0 | `ai-trading-agent.html` direct Anthropic request; `js/invest-helper-logic.js` direct OpenAI call; configurable webhook destinations | Potential credential/context exposure. Replace private browser calls, constrain destinations and review payload consent/retention in follow-on work. |
| SEC-04 / P0 | `js/auth-guard.js` is navigation rendering code; browser identity/plan caches and dev-unlock flags are widespread | Filename and UI gates provide no backend authorization guarantee. Confirm RLS and endpoint authorization; do not assert data is exposed without server evidence. |
| SEC-05 / P0 | Journal/accounts/watchlists stored under legacy browser keys; sync has ownership quarantine/repair logic in `session-user.js` and `journal-sync.js` | Valuable mitigations exist, but not all pages use them. Preserve safeguards and audit cross-user browser transitions before migration. |
| SEC-06 / P1 | `js/option-roll-analyzer.js:67` inserts `result.advice` into innerHTML; old dividend helper also interpolates returned strings | Unescaped external output is an injection sink if that orphan helper is revived. Validate/escape output; no exploit test performed. |
| SEC-07 / P0 | `admin.html` exposes configuration/user management actions; `admin-usage.html` calls an RPC | Client-side checks are insufficient evidence of restricted access; admin policies/functions are absent. |
| SEC-08 / P1 | Schwab callback accepts code/state and server return URL; exchange source absent | Cannot verify state binding, refresh storage, redirect validation or read-only scopes. Keep broker integration disabled/untrusted until reviewed. |
| SEC-09 / P0 | Secret check patterns cover OpenAI keys, service-role assignment hints, PEM keys only | A passing scan is not proof of no secrets. Existing security docs overstate cleanup relative to current source. |

Inventory security signals below additionally mark local storage, key paths, HTML rendering, external endpoints and demo code. Those signals identify review surfaces, not separate proven vulnerabilities.

## Architectural debt and extraction targets

1. **Competing sources of truth.** Journal sync explicitly describes localStorage as authoritative and Supabase as a mirror. The target architecture centers normalized Supabase data. Adopt an explicit offline/conflict policy and reconcile existing records before changing authority.
2. **Provider fragmentation and global interception.** Finnhub fetch interception does not normalize FMP/Twelve Data/Alpha Vantage data, does not remove all browser BYOK checks, and depends on script order. A typed/versioned quote/bar/fundamental/options contract must carry source, currency, session, as-of and stale/error states.
3. **POC and volatility semantics.** `strategy-analyzers.js:1052` allocates each daily candle's volume evenly across touched bins; its VWAP uses typical daily price. This is an approximation, not observed tick volume-at-price. Command has separate POC calculation/fetch code. Wheel/CSP rankings use HV proxies, not live IV/option chains. Preserve labels and explicitly choose the target method/data before merging.
4. **Large inline business logic.** Extract lot aggregation/FIFO/imports/roll cashflows from Journal/Portfolio; sizing/Kelly/ATR/expectancy from calculators; indicators/POC from Command/Research/registry; DCF/valuation from research pages; risk policies from my-rules/risk/guardrails. Add meaningful deterministic tests in the future owning tasks.
5. **Repeated shell code.** Authentication, menus, footer, copied CSS tokens and mode handling dominate many 5,000-line tools. Shared modules already offer an incremental path; no framework conversion is required for this audit.
6. **AI and fact boundaries.** Preserve manual plan acceptance and journal context; route AI to explanation/challenge. Chart screenshots, generated ideas and mock market data must not become verified trade inputs. Backtesting needs deterministic strategy/execution rules, fees, slippage, adjusted-data and look-ahead tests before trust.
7. **Misleading capability indicators.** Broker Connections displays static Connected/last-sync/account examples and has unwired buttons. ORB is Coming Soon. Many scanners have explicit mock switches; `Math.random` also generates harmless IDs, so its presence alone does not prove fabricated live prices. Some tools have already replaced silent demo fallback with explicit unavailable states; retain those improvements.
8. **Session/config drift.** `window.AP_WEBHOOKS`, `AP_CONFIG`, `SUPABASE`, `sbClient`, `supabaseClient`, `GSClient`, and older module clients coexist. Dividend Screener reads `window.APP_CONFIG.SUPABASE_URL`, while current configuration exposes a different shape; fallback points at a placeholder project. Morning Brief's source comment and actual JSON disagree on endpoint meaning.
9. **No reproducible backend or test harness.** No package manifest, migrations, SQL/RLS files, server function source, hosting rewrite configuration, or automated application test suite. Only the Python secret scan runs in CI. This limits claims about working production behavior.
10. **Documentation/product drift.** Prior audit lists absent `index_v*` files; deploy notes describe deleting Market Intelligence; current architecture requires it. Old public pricing/founder flows and broad private-beta scope need reconciliation.

### Broken and inconsistent paths

The static HTML check parsed actual `src`/`href` attributes, resolved URLs as a browser would with the repository served at `/`, removed query strings and fragments, and checked local targets. It found **80 distinct missing normalized targets across 230 attribute occurrences**. This includes unrelated-product routes and stale navigation, not 80 distinct runtime crashes. It excludes JS-generated links/fetches, CSS URLs, external URLs and inline event-handler targets. A nested deployment may have different results. Root-page `../index.html` normalizes to `/index.html` and was not incorrectly counted as missing.

High-impact missing script targets: `js/supabase.min.js` (9 actual tags; available file is `js/supabase_min.js`), root `app-config.js` (4), `js/options-hub-trading-layout.js` (1), `valuation-logic.js` (1), and six `/shared/js/` targets. The complete missing-target appendix follows the feature inventory.

Additional runtime/configuration mismatches: `js/supabase-init.js` dynamically requests the missing dotted SDK filename; `js/config.json` redirects to absent `/dashboard/short-term-dashboard.html`; `auth-header.js` has an old onboarding login default; Schwab callback assumes a same-origin functions proxy. These are separate from the HTML attribute counts. Some auth defaults are overridden by pages, so not every consumer necessarily fails.

## Proposed KEEP/MODIFY/MERGE/PORT/ARCHIVE/DELETE map

The per-file inventory below is the authoritative proposed map, with SECURITY FIX taking precedence for selected credential/auth modules. High-level disposition:

- **KEEP:** useful pure formatting/math, small educational arithmetic, current compatibility redirects, security/governance scaffolding.
- **MODIFY:** core command/research/portfolio/watchlist/journal/options surfaces, trusted-data calculators, session/account integrations and shared registries.
- **MERGE:** competing dashboards, journals/watchlists, scanners, valuation variants, duplicated styles/navigation and narrow planning screens.
- **PORT:** tested Wheel history/strategy behavior into a strategy desk after inspecting the separate source; planned provider adapters are future work.
- **ARCHIVE:** Salon/GenieSphere pages, disconnected templates, obsolete prototypes, unrelated household planning and old marketing/report generators.
- **DELETE:** only the byte-identical versioned scorecard and unused root theme copy are proposed narrow candidates, after final consumer checks; nothing deleted now.
- **SECURITY FIX:** embedded credential helper, provider-key distribution/configuration, direct private browser integrations and identity/admin entry points before reuse.

## Recommended migration order

1. Review ATD-001 canonical recommendations, scope and data-retention decisions. Preserve baseline exports/snapshots before future data migration.
2. **ATD-002 next:** complete credential/client-key/webhook inventory and containment plan. The literal finding is an input, not completed ATD-002 work.
3. **ATD-005:** obtain DEV schema/function/RLS evidence; resolve identity, account ownership and journal/watchlist authority before moving records. No production access needed for this audit.
4. **ATD-004:** define provider/Data Hub contracts, including actual options-chain availability, source/freshness and POC methodology; confirm per-user entitlements.
5. **ATD-003:** approve canonical navigation and URL compatibility using this matrix. Keep redirects and saved-state migration requirements explicit.
6. Implement foundation work only under newly assigned tasks: secure session/config/provider boundaries, backend migrations, shared holdings/journal/watchlist contracts and tests.
7. Extract deterministic engines, then migrate Command/Portfolio/Research/Options surfaces incrementally; connect grounded AI brief/coach flows after facts are reliable.
8. Compare the separate Wheel repo for ATD-108; port selected features after parity tests, not a wholesale replacement of the platform.
9. Archive obsolete routes and remove exact duplicate assets only after owner approval, link review and data reconciliation. Defer household/tax/retirement products until explicitly selected.

## Unknowns requiring human decision

1. Confirm the broad Trading Desk 2.0 product supersedes current Wheel-only landing/coach messaging and restores Market Intelligence as a first-class capability.
2. Approve canonical pages and consolidation targets; identify any legacy routes actively used by the beta group that must remain accessible.
3. Decide whether retirement, tax, household-goal planning, public pricing/founders and Stripe billing belong in the initial private beta. Recommendation: defer household tools and public commercial expansion.
4. Identify the separate Wheel repository and authoritative version for later comparison. It was not available in this checkout.
5. Confirm which deployed Supabase/n8n/broker components actually exist and arrange sanitized DEV schema/workflow exports for later tasks. Source absence does not prove deployed absence.
6. Decide journal authority/offline behavior and record retention; approve lossless reconciliation across local storage, tj tables, old journal/portfolio tables and account name/ID variants.
7. Confirm licensed provider entitlements and required POC/options fidelity. Recommendations do not assume one personal data license can serve all users.
8. Handle the exposed-looking Twelve Data literal with the account owner; decide authorized rotation/revocation. No credential value or service access is needed in this chat.

## Verification

Validation results and complete per-file/static-reference appendices are recorded below. Application runtime, desktop/mobile behavior, deployed RLS, API availability and secret validity were not tested. Documentation-only changes do not justify connecting the legacy app to production.


## Feature inventory — every HTML file

All 174 HTML-extension files are classified, including fragments and misnamed workflow JSON. **Deps** refers to exact script/style sets below; global/storage coupling also appears in module rows. **API** lists source references, not proven live calls (copied code/comments can mention providers). **Supabase** lists literal direct references plus known dynamic journal/storage dependencies; inspect referenced modules for inherited auth/config. No direct table literal is not proof of no backend.

Security signals: **K** = key/config reference (including public anon config); **L** = browser storage/ownership review; **H** = HTML-writing sink requiring contextual escaping review, not automatically vulnerable; **E** = external/backend boundary; **D** = demo/mock generator/control, not proof of unlabeled fabricated data; **SYNTAX** = confirmed parse failure. SEC IDs refer to findings above. Survival is feature/data preservation, not permission to retain unsafe code.

### 0-A

| File / current purpose | Decision / priority / survival | Canonical / competitors / rationale | Deps | Backend/API refs | Supabase expectation | Inline business logic | Security |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `404.html` — Page Not Found — Arowana Profits | **KEEP** / P3 / Yes | 404.html. Static not-found page; reconcile links later | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | No trading logic; static/redirect/shell only | No specific static signal; not security clearance |
| `about.html` — About — Arowana Profits | **MODIFY** / P3 / Yes | same route subject to product scope. Align copy/learning/disclosures with private beta and real capability | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | No trading logic; static/redirect/shell only | L, H |
| `account.html` — Account Settings — Arowana Profits | **SECURITY FIX** / P0 / After security work | secure account/admin services. Key storage or privileged actions require server enforcement | D01 | EF:arowana-billing-portal; webhook/config; Stripe ref | ap_usage; profiles; user_api_keys | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `admin-usage.html` — Usage — Arowana Profits admin | **MODIFY** / P0 / Yes | shared auth/onboarding/admin boundary. Preserve recovery/setup; UI cache is not authorization | D02 | RPC:ap_usage_summary | Auth/config via deps | Yes: calculation/workflow/data orchestration | H, SEC-07 |
| `admin.html` — Admin — Arowana Profits | **SECURITY FIX** / P0 / After security work | secure account/admin services. Key storage or privileged actions require server enforcement | D00 | webhook/config | app_config; arowana_tools; arowana_webhooks; profiles | Yes: calculation/workflow/data orchestration | H, E, SEC-07 |
| `advanced-trading-tools.html` — 🧰 Advanced Trading Tools — Arowana Profits | **MERGE** / P3 / Behavior/data only | tools.html / features.html. Competing catalogs; preserve selected copy and consolidate routing | D01 | No direct provider literal; see deps | Auth/config via deps | No trading logic; static/redirect/shell only | L |
| `ai-moat-finder.html` — Moat Finder — Arowana Profits | **MODIFY** / P2 / Yes | Fundamental Engine definitions and research views. Preserve filters/scores with normalized metrics/source/freshness | D03 | Finnhub; webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | K, L, H, E, D |
| `ai-morning-brief.html` — AI Morning Brief — Arowana Profits | **MODIFY** / P1 / Yes | ai-morning-brief.html + brief contract. Webhook generation differs from Command cached ai_briefs | D04 | EF:morning-brief; webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | L, H, E |
| `ai-trading-agent.html` — Short-Term Agent — Arowana Profits | **MERGE** / P1 / Behavior/data only | arowana-trader.html. Competing coach, not whale-flow infrastructure | D05 | Anthropic; webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | L, H, E, D |
| `ai-valuation.html` — AI Stock Valuation — Arowana Profits | **MERGE** / P2 / Behavior/data only | intrinsic-value.html + valuation service. Overlapping DCF/Graham/manual models; reconcile units/assumptions | D06 | Twelve Data; Alpha Vantage; FMP | Auth/config via deps | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `ai_valuation.html` — 📊 AI Valuation Engine | **ARCHIVE** / P3 / No active route / deferred | intrinsic-value.html. Incomplete shell; missing valuation-logic.js | D07 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | No trading logic; static/redirect/shell only | No specific static signal; not security clearance |
| `analysis-central.html` — 🔍 Ticker Research — Arowana Profits | **MODIFY** / P1 / Yes | analysis-central.html + Fundamental/Technical engines. Canonical ticker research, price history and holdings context | D08 | Finnhub; Twelve Data; Alpha Vantage; FMP; webhook/config; Schwab ref | tj_options; tj_stocks; watchlist_items; watchlists | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `api-diagnostics.html` — API Diagnostics — Arowana Profits | **MODIFY** / P1 / Yes | DEV/admin diagnostics. API/coach/RLS probes not executed against production | D02 | Finnhub; Alpha Vantage; FMP; EF:arowana-ai-coach; webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `arowana-template.html` — Arowana Profits — Template | **ARCHIVE** / P3 / No active route / deferred | historical reference only. Scaffolds/mock ideas/reports/webhook tests, not canonical features | D09 | Twelve Data | Auth/config via deps | Yes: ticker quote-strip fetch/render within template | K, H, E |
| `arowana-trader.html` — Wheel Coach — Arowana Profits | **MODIFY** / P1 / Yes | arowana-trader.html + server coach. Wheel Coach with watchlist/journal context; preserve broader desk use cases | D10 | Finnhub; EF:arowana-ai-coach; webhook/config | daily_setups; watchlist_items; watchlists | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `asset-allocation-builder.html` — Asset Allocation Builder — Arowana Profits | **MODIFY** / P2 / Yes | shared long-term planning / Portfolio desk. Preserve planning/exportable assumptions; consolidate allocation/risk | D11 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | L, H, E |
| `assignment-risk.html` — Assignment Risk Checker — Will My Option Get Assigned? | **KEEP** / P2 / Yes | shared Wheel/Options math and educational views. Focused arithmetic; assumptions are not observed broker probabilities | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | L, H |
| `atr-stop-planner.html` — ATR Stop Planner — Arowana Profits | **MODIFY** / P2 / Yes | shared Risk/Options engines with focused views. Preserve deterministic formulas/assumptions; remove copied shell/providers | D03 | FMP | Auth/config via deps | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `automated-trading-plan.html` — Automated Trading Plan — Arowana Profits | **MERGE** / P2 / Behavior/data only | trade-plan-builder.html + strategy services. Overlapping generated plans/signals; separate demo and verified inputs | D12 | webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | L, H, E, D |

### B-D

| File / current purpose | Decision / priority / survival | Canonical / competitors / rationale | Deps | Backend/API refs | Supabase expectation | Inline business logic | Security |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `base-breakout .html` — Base Breakout Scanner — Arowana Profits | **MERGE** / P2 / Behavior/data only | base-breakout.html then scanner.html. Space-name competitor not identical; compare filters | D06 | webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | L, H, E, D |
| `base-breakout.html` — Base Breakout Scanner — Arowana Profits | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D06 | webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | L, H, E, D |
| `bb-snapback.html` — BB Snapback Scanner — Arowana Profits | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D06 | webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | L, H, E, D |
| `billing.html` — Billing — Arowana Profits | **MODIFY** / P2 / Yes | server billing if beta requires it. Client shells; Stripe backend absent and beta billing undecided | D01 | webhook/config; Stripe ref | profiles | Yes: calculation/workflow/data orchestration | L, E |
| `blog.html` — Blog — Arowana Profits | **MODIFY** / P3 / Yes | same route subject to product scope. Align copy/learning/disclosures with private beta and real capability | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | No trading logic; static/redirect/shell only | L, H |
| `broker-connections.html` — Broker Connections — Arowana Profits | **MODIFY** / P1 / Yes | server-side read-only broker integration. Static connection prototype; exchange/refresh/proxy absent | D09 | webhook/config; Schwab ref | raw_broker_fills/journal_trade_candidates (design text) | No trading logic; static/redirect/shell only | H |
| `buy-a-home.html` — Buy a Home — Arowana Profits | **ARCHIVE** / P3 / No active route / deferred | outside initial trading product. Household/real-estate planning; preserve for separate scope | D13 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H |
| `buy-sell-signal.html` — Buy/Sell Signal AI — Arowana Profits | **MERGE** / P2 / Behavior/data only | trade-plan-builder.html + strategy services. Overlapping generated plans/signals; separate demo and verified inputs | D05 | webhook/config | journal_trades | Yes: calculation/workflow/data orchestration | K, L, H, E, D |
| `chart-analysis-form.html` — Chart Analyzer — Arowana Profits | **MERGE** / P2 / Behavior/data only | analysis-central.html. Overlapping research/chart tools; AI/screenshots are not verified facts | D05 | webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | L, H, E, SYNTAX |
| `checkout.html` — Checkout — Arowana Profits | **MODIFY** / P2 / Yes | server billing if beta requires it. Client shells; Stripe backend absent and beta billing undecided | D01 | EF:arowana-checkout; webhook/config; Stripe ref | Auth/config via deps | Yes: calculation/workflow/data orchestration | L, E |
| `college-savings.html` — College Savings — Arowana Profits | **ARCHIVE** / P3 / No active route / deferred | outside initial trading product. Household/real-estate planning; preserve for separate scope | D13 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H |
| `contact.html` — Contact — Arowana Profits | **MODIFY** / P3 / Yes | same route subject to product scope. Align copy/learning/disclosures with private beta and real capability | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | No trading logic; static/redirect/shell only | L, H |
| `cover-call-option-recommentor.html` — Mock n8n covered-call JSON (not HTML) | **ARCHIVE** / P3 / No active route / deferred | historical reference only. One-off HTML updater or mock n8n JSON, not operational feature | D00 | webhook/config | No direct table literal; dynamic/config use may apply | Mock function node in JSON | No specific static signal; not security clearance |
| `credit-spread-planner.html` — Credit Spread Planner — Arowana Profits | **MODIFY** / P2 / Yes | shared Risk/Options engines with focused views. Preserve deterministic formulas/assumptions; remove copied shell/providers | D03 | Finnhub | Auth/config via deps | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `daily-bias.html` — Arowana Profits • Daily Bias (Watchlist) | **MERGE** / P2 / Behavior/data only | ai-morning-brief.html + Market Engine. Overlapping daily summary/bias; preserve watchlist scope | D14 | webhook/config | daily_bias_runs; watchlist_items; watchlists | Yes: calculation/workflow/data orchestration | H, E |
| `daily-summary.html` — Daily Summary • GenieSphere | **MERGE** / P2 / Behavior/data only | ai-morning-brief.html + Market Engine. Overlapping daily summary/bias; preserve watchlist scope | D00 | webhook/config | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | L, H, E, D |
| `daily-trading-post.html` — Daily Trading Post Generator | **ARCHIVE** / P3 / No active route / deferred | historical reference only. Scaffolds/mock ideas/reports/webhook tests, not canonical features | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | No specific static signal; not security clearance |
| `dashboard.html` — Salon Genie — Dashboard | **ARCHIVE** / P0 / No active route / deferred | none in trading product. Unrelated Salon/GenieSphere data/OAuth domains; exclude future deployment | D15 | No direct provider literal; see deps | salon.employees; salon.task_assignments; salon.task_comments; salon.v_task_assignments_live | Yes: calculation/workflow/data orchestration | L, H, E |
| `data-hygiene-audit.html` — Trade Journal — Data Hygiene Audit | **KEEP** / P1 / Yes | internal journal reconciliation tooling. Useful local consistency report/CSV; not schema audit | D00 | Schwab ref | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | L, H |
| `day-trade-scanner.html` — Day Trade Scanner • GenieSphere | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D00 | webhook/config | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H, E, D |
| `daytrade.html` — Short-Term Dashboard | **MERGE** / P1 / Behavior/data only | trading-command.html. Competing dashboard; preserve unique saved-state/widgets | D00 | webhook/config | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H, E |
| `dca-planner.html` — DCA Planner — Arowana Profits | **MODIFY** / P2 / Yes | shared long-term planning / Portfolio desk. Preserve planning/exportable assumptions; consolidate allocation/risk | D16 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | L, H |
| `dcf-analyzer.html` — DCF Analyzer — Arowana Profits | **MERGE** / P2 / Behavior/data only | intrinsic-value.html + valuation service. Overlapping DCF/Graham/manual models; reconcile units/assumptions | D03 | Finnhub | Auth/config via deps | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `discipline-checklist.html` — Discipline Checklist – GenieSphere | **MERGE** / P2 / Behavior/data only | my-rules.html + journal/risk context. Consolidate checklist/scoring; preserve horizon-specific fields | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | L, H |
| `discipline-scorecard.html` — Discipline Scorecard — Arowana Profits | **MERGE** / P2 / Behavior/data only | my-rules.html + journal/risk context. Consolidate checklist/scoring; preserve horizon-specific fields | D17 | No direct provider literal; see deps | Auth/config via deps | Yes: calculation/workflow/data orchestration | L, H |
| `disclosures.html` — Disclosures — Arowana Profits | **MODIFY** / P3 / Yes | same route subject to product scope. Align copy/learning/disclosures with private beta and real capability | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | No trading logic; static/redirect/shell only | L, H |
| `dividend-screener.html` — 💰 Dividend Screener — Arowana Profits | **MODIFY** / P2 / Yes | Fundamental Engine definitions and research views. Preserve filters/scores with normalized metrics/source/freshness | D18 | Supabase Storage | Storage public-data/dividend-screener/stocks.json | Yes: calculation/workflow/data orchestration | L, H, E |
| `dividend-tracker.html` — Dividend Tracker — Arowana Profits | **MODIFY** / P2 / Yes | shared long-term planning / Portfolio desk. Preserve planning/exportable assumptions; consolidate allocation/risk | D03 | Finnhub; webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | K, L, H, E |

### E-I

| File / current purpose | Decision / priority / survival | Canonical / competitors / rationale | Deps | Backend/API refs | Supabase expectation | Inline business logic | Security |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `earning-watcher.html` — Earnings Watcher | **MERGE** / P2 / Behavior/data only | Market Engine earnings service. Browser earnings lookup; preserve held/watchlisted-symbol focus | D00 | Yahoo | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H, E |
| `education-529-planner.html` — Education / 529 Planner • Long-Term Dashboard | **ARCHIVE** / P3 / No active route / deferred | outside initial trading product. Household/real-estate planning; preserve for separate scope | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H |
| `ema-snapback.html` — 📌 EMA Snapback Scanner | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D13 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | L, H, D |
| `etf-core-screener.html` — 🧺 ETF Core Screener | **MODIFY** / P2 / Yes | shared long-term planning / Portfolio desk. Preserve planning/exportable assumptions; consolidate allocation/risk | D00 | Schwab ref | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | L |
| `expectancy-matrix.html` — Expectancy Matrix — Arowana Profits | **MODIFY** / P2 / Yes | shared Risk/Options engines with focused views. Preserve deterministic formulas/assumptions; remove copied shell/providers | D03 | No direct provider literal; see deps | Auth/config via deps | Yes: calculation/workflow/data orchestration | H |
| `factor-tilt-planner.html` — Factor Tilt Planner • Long-Term Dashboard | **MODIFY** / P2 / Yes | shared long-term planning / Portfolio desk. Preserve planning/exportable assumptions; consolidate allocation/risk | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H |
| `feature_body.html` — Arowana Profits — Features | **MERGE** / P3 / Behavior/data only | tools.html / features.html. Competing catalogs; preserve selected copy and consolidate routing | D13 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | E |
| `feature_new.html` — ✨ Features • Arowana Profits — Smarter Investing & Trading Tools | **MERGE** / P3 / Behavior/data only | tools.html / features.html. Competing catalogs; preserve selected copy and consolidate routing | D19 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | No trading logic; static/redirect/shell only | No specific static signal; not security clearance |
| `features-tools-directory.html` — All Tools • Arowana Profits | **MERGE** / P3 / Behavior/data only | tools.html / features.html. Competing catalogs; preserve selected copy and consolidate routing | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | No trading logic; static/redirect/shell only | L, H |
| `features.html` — Platform Features — Arowana Profits | **MODIFY** / P3 / Yes | same route subject to product scope. Align copy/learning/disclosures with private beta and real capability | D00 | Schwab ref | No direct table literal; dynamic/config use may apply | No trading logic; static/redirect/shell only | L, H |
| `fee-analyzer.html` — 💳 Fee Impact Analyzer | **MODIFY** / P2 / Yes | shared long-term planning / Portfolio desk. Preserve planning/exportable assumptions; consolidate allocation/risk | D20 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | L, H |
| `gap-and-go.html` — Arowana Profits — Template | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D09 | No direct provider literal; see deps | Auth/config via deps | Yes: calculation/workflow/data orchestration | L, H, D |
| `gap-fade-scanner.html` — Gap Fade Scanner — Arowana Profits | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D13 | webhook/config | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H, D |
| `guide-claude-tradingview-windows.html` — Connect Claude to TradingView on Windows — Arowana Profits | **MODIFY** / P3 / Yes | same route subject to product scope. Align copy/learning/disclosures with private beta and real capability | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | No trading logic; static/redirect/shell only | L |
| `high-shortfloat-screener.html` — High Short Float Screener — Overbought + Outflow | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H, E |
| `hod-scanner.html` — HOD Scanner — Arowana Profits | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D13 | webhook/config | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H, E, D, SYNTAX |
| `index.html` — Wheel Strategy Desk — Arowana Profits | **MODIFY** / P3 / Yes | same route subject to product scope. Align copy/learning/disclosures with private beta and real capability | D02 | EF:arowana-founders-count | ap_founders_waitlist | Yes: calculation/workflow/data orchestration | L, H, E |
| `intraday-breakout.html` — 🚀 Intraday Breakout Scanner — Arowana Profits | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D09 | Twelve Data | Auth/config via deps | Yes: calculation/workflow/data orchestration | K, L, H, E, D |
| `intrinsic-value-rsi.html` — Intrinsic Value – RSI Screener Layout | **MERGE** / P2 / Behavior/data only | intrinsic-value.html + valuation service. Overlapping DCF/Graham/manual models; reconcile units/assumptions | D00 | Alpha Vantage | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | K, E |
| `intrinsic-value.html` — Intrinsic Value Calculator — Arowana Profits | **MODIFY** / P2 / Yes | intrinsic-value.html + valuation service. Preserve model assumptions/comparisons and unavailable-data states | D21 | Finnhub; Twelve Data; Alpha Vantage; FMP | Auth/config via deps | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `ips-builder.html` — 📝 IPS Builder (Investment Policy Statement) | **MODIFY** / P2 / Yes | shared long-term planning / Portfolio desk. Preserve planning/exportable assumptions; consolidate allocation/risk | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | L |
| `iv-watchlist-module.html` — HTML fragment / embedded module | **MERGE** / P1 / Behavior/data only | watchlist.html. Competing saved lists; preserve notes, horizons, IDs | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | L, H |

### J-O

| File / current purpose | Decision / priority / survival | Canonical / competitors / rationale | Deps | Backend/API refs | Supabase expectation | Inline business logic | Security |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `kelly-calculator.html` — Kelly Calculator — Arowana Profits | **MODIFY** / P2 / Yes | shared Risk/Options engines with focused views. Preserve deterministic formulas/assumptions; remove copied shell/providers | D03 | No direct provider literal; see deps | Auth/config via deps | Yes: calculation/workflow/data orchestration | H |
| `lap-pullback.html` — CLAP Pullback • GenieSphere | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D00 | webhook/config | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H, E, D |
| `learn-investing.html` — Learn Investing — Arowana Profits | **MODIFY** / P3 / Yes | same route subject to product scope. Align copy/learning/disclosures with private beta and real capability | D05 | No direct provider literal; see deps | Auth/config via deps | Yes: calculation/workflow/data orchestration | L, H, E |
| `login.html` — Sign In — Arowana Profits | **MODIFY** / P0 / Yes | shared auth/onboarding/admin boundary. Preserve recovery/setup; UI cache is not authorization | D22 | No direct provider literal; see deps | Auth/config via deps | Yes: calculation/workflow/data orchestration | L, H, E |
| `long-term-dashboard.html` — 🏦 Long-Term Investing — Smart Dashboard | **MERGE** / P2 / Behavior/data only | portfolio-command.html + long-term strategy view. Old dashboard overlaps portfolio/research/tools | D05 | Twelve Data; webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `long-term-intrinsic-value.html` — 🧮 Intrinsic Value Calculator | **MERGE** / P2 / Behavior/data only | intrinsic-value.html + valuation service. Overlapping DCF/Graham/manual models; reconcile units/assumptions | D13 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | L |
| `long-term-portfolio.html` — Long-Term Portfolio — Arowana Profits | **MERGE** / P1 / Behavior/data only | portfolio-command.html. Overlapping advice/holdings/tracker; reconcile legacy data first | D09 | Finnhub; webhook/config | portfolio | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `long-term-watchlist.html` — Long-Term Watchlist — Arowana Profits | **MERGE** / P1 / Behavior/data only | watchlist.html. Competing saved lists; preserve notes, horizons, IDs | D13 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | L, H |
| `market-intelligence.html` — Market Intelligence has moved — Arowana Profits | **MODIFY** / P1 / Yes | future Market Engine. Currently retired redirect, not an implemented engine | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | No trading logic; static/redirect/shell only | No specific static signal; not security clearance |
| `master-journal.html` — Master Journal — Arowana Profits | **MERGE** / P1 / Behavior/data only | trade-journal-pro.html. Different journal tables/local keys need lossless adapters | D09 | No direct provider literal; see deps | journal_trades; option_chains | Yes: calculation/workflow/data orchestration | H, E |
| `momentum-hunter-complete.html` — 🚀 Momentum Hunter — Arowana Profits | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D23 | Finnhub; webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `momentum-hunter.html` — 🚀 Momentum Hunter — Arowana Profits | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D18 | Finnhub; webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `money-flow-alert.html` — Money Flow Alert — Arowana Profits | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D17 | webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | H, E, D |
| `my-rules-long.html` — ✅ My Rules (Long‑Term Investing) | **MERGE** / P2 / Behavior/data only | my-rules.html + journal/risk context. Consolidate checklist/scoring; preserve horizon-specific fields | D13 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | L, H |
| `my-rules-short.html` — ✅ My Rules – Risk & Sizing | **MERGE** / P2 / Behavior/data only | my-rules.html + journal/risk context. Consolidate checklist/scoring; preserve horizon-specific fields | D13 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | L, H |
| `my-rules.html` — ✅ My Rules – Risk & Sizing | **MODIFY** / P1 / Yes | my-rules.html + Risk Engine. Canonical short-term rules source; extract shared policies | D13 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | L, H |
| `my-watchlist.html` — My Watchlist — Arowana Profits | **MERGE** / P1 / Behavior/data only | watchlist.html. Competing saved lists; preserve notes, horizons, IDs | D13 | Twelve Data | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `news-trading.html` — News Trading Strategy — Arowana Profits | **MERGE** / P2 / Behavior/data only | trade-plan-builder.html + strategy services. Overlapping generated plans/signals; separate demo and verified inputs | D12 | webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | L, H, E, D |
| `onboarding.html` — Set up your desk — Arowana Profits | **MODIFY** / P0 / Yes | shared auth/onboarding/admin boundary. Preserve recovery/setup; UI cache is not authorization | D02 | webhook/config; Schwab ref | ap_risk_settings; watchlist_items; watchlists | Yes: calculation/workflow/data orchestration | H, E |
| `opening-drive.html` — 🏁 Opening Drive Scanner | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D09 | Twelve Data | Auth/config via deps | Yes: calculation/workflow/data orchestration | K, L, H, E, D |
| `option-recommender.html` — Covered Call Finder | **MERGE** / P2 / Behavior/data only | options-hub.html + journal roll model. Overlapping advice/rolls; preserve chains and cashflow semantics | D00 | webhook/config | No direct table literal; dynamic/config use may apply | No trading logic; static/redirect/shell only | No specific static signal; not security clearance |
| `option-roll-analyzer.html` — Option Roll Analyzer • GenieSphere | **MERGE** / P2 / Behavior/data only | options-hub.html + journal roll model. Overlapping advice/rolls; preserve chains and cashflow semantics | D00 | webhook/config | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H, E, D |
| `option-roll-tracker.html` — Option Roll Tracker — Arowana Profits | **MERGE** / P2 / Behavior/data only | options-hub.html + journal roll model. Overlapping advice/rolls; preserve chains and cashflow semantics | D09 | Twelve Data | option_roll_chains; trading_journal | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `option-trader.html` — 🧠 AI Option Strategy Advisor | **MERGE** / P2 / Behavior/data only | options-hub.html + journal roll model. Overlapping advice/rolls; preserve chains and cashflow semantics | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H |
| `options-analyzer.html` — Options Analyzer — Arowana Profits | **MODIFY** / P2 / Yes | shared Risk/Options engines with focused views. Preserve deterministic formulas/assumptions; remove copied shell/providers | D03 | Finnhub; FMP | Auth/config via deps | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `options-hub-creator.html` — Arowana Options Hub Updater | **ARCHIVE** / P3 / No active route / deferred | historical reference only. One-off HTML updater or mock n8n JSON, not operational feature | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | SYNTAX |
| `options-hub.html` — 📈 Options Hub — Arowana Profits | **MODIFY** / P1 / Yes | options-hub.html + Options/Risk services. Candidate/roll/holdings context; layout script missing | D24 | Finnhub; Alpha Vantage; FMP; webhook/config | ap_roll_coach; cc_candidates; csp_candidates; market_snapshots; tj_options; tj_stocks; watchlist_items; watchlists | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `options-journal.html` — Options Journal — Arowana Profits | **MERGE** / P1 / Behavior/data only | trade-journal-pro.html. Different journal tables/local keys need lossless adapters | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | L, H |
| `options-recommender.html` — Redirecting to Options Hub — Arowana Profits | **KEEP** / P3 / Yes | options-hub.html redirects. Existing compatibility redirects; keep until URL retirement approved | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | No trading logic; static/redirect/shell only | No specific static signal; not security clearance |
| `options-strategies.html` — Redirecting to Options Hub — Arowana Profits | **KEEP** / P3 / Yes | options-hub.html redirects. Existing compatibility redirects; keep until URL retirement approved | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | No trading logic; static/redirect/shell only | No specific static signal; not security clearance |
| `orb-scanner.html` — ORB Scanner — Coming Soon — Arowana Profits | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | No trading logic; static/redirect/shell only | No specific static signal; not security clearance |
| `overview.html` — GenieSphere — My Overview | **ARCHIVE** / P0 / No active route / deferred | none in trading product. Unrelated Salon/GenieSphere data/OAuth domains; exclude future deployment | D25 | No direct provider literal; see deps | business_profiles; finance_transactions; v_finance_month_summary_all; v_finance_top_categories_month_all | Yes: calculation/workflow/data orchestration | L, H, E |

### P-S

| File / current purpose | Decision / priority / survival | Canonical / competitors / rationale | Deps | Backend/API refs | Supabase expectation | Inline business logic | Security |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `pattern-scanner.html` — Pattern Scanner — Arowana Profits | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D01 | Finnhub; Alpha Vantage | Auth/config via deps | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `pick-my-mix.html` — Pick My Mix — Arowana Profits | **MODIFY** / P2 / Yes | shared long-term planning / Portfolio desk. Preserve planning/exportable assumptions; consolidate allocation/risk | D13 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H |
| `portfolio-advisor.html` — Portfolio Advisor — Arowana Profits | **MERGE** / P1 / Behavior/data only | portfolio-command.html. Overlapping advice/holdings/tracker; reconcile legacy data first | D26 | Finnhub; Anthropic; webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `portfolio-command.html` — 🏦 Portfolio Command — Arowana Profits | **MODIFY** / P1 / Yes | portfolio-command.html + holdings/accounts/cash. Journal lots and plans coexist with old portfolio fallbacks | D27 | Finnhub; webhook/config; Schwab ref | market_snapshots; portfolio; portfolio_options; tj_options; tj_stocks; user_cash_balances; user_deployment_plans | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `portfolio-tracker.html` — 📈 Portfolio Tracker – Arowana Profits | **MERGE** / P1 / Behavior/data only | portfolio-command.html. Overlapping advice/holdings/tracker; reconcile legacy data first | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | No trading logic; static/redirect/shell only | No specific static signal; not security clearance |
| `position-sizer.html` — Position Sizer — Arowana Profits | **MODIFY** / P1 / Yes | position-sizer.html + js/position-math.js. Focused current sizer still duplicates arithmetic inline | D28 | webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | K, L, H |
| `position-sizer_fresh.html` — Arowana Profits — Page Template | **MERGE** / P1 / Behavior/data only | position-sizer.html + js/position-math.js. Competing sizing; fresh is a mixed dashboard/template | D29 | Twelve Data; webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | K, L, H, E, D |
| `post-earnings-drift.html` — Post‑Earnings Drift (PED) — Arowana Profits | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D13 | Stooq | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H, E |
| `pricing-revolutionary.html` — Revolutionary Pricing — Arowana Profits | **ARCHIVE** / P3 / No active route / deferred | pricing.html if billing retained. Competing commercial model and broken script paths | D30 | No direct provider literal; see deps | Auth/config via deps | No trading logic; static/redirect/shell only | L, H |
| `pricing.html` — Pricing — Wheel Strategy Desk — Arowana Profits | **MODIFY** / P3 / Yes | same route subject to product scope. Align copy/learning/disclosures with private beta and real capability | D01 | EF:arowana-checkout; webhook/config; Stripe ref; Schwab ref | Auth/config via deps | Yes: calculation/workflow/data orchestration | L, H, E |
| `privacy.html` — Privacy Policy — Arowana Profits | **MODIFY** / P3 / Yes | same route subject to product scope. Align copy/learning/disclosures with private beta and real capability | D00 | Stripe ref | No direct table literal; dynamic/config use may apply | No trading logic; static/redirect/shell only | L, H |
| `quality-screener.html` — Quality Screener • Long‑Term Dashboard | **MODIFY** / P2 / Yes | Fundamental Engine definitions and research views. Preserve filters/scores with normalized metrics/source/freshness | D00 | webhook/config | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H, E |
| `r-multiple.html` — R-Multiple Calculator — Arowana Profits | **MODIFY** / P2 / Yes | shared Risk/Options engines with focused views. Preserve deterministic formulas/assumptions; remove copied shell/providers | D03 | No direct provider literal; see deps | Auth/config via deps | Yes: calculation/workflow/data orchestration | L, H |
| `real-estate-analyzer.html` — Real Estate Analyzer • Long-Term Dashboard | **ARCHIVE** / P3 / No active route / deferred | outside initial trading product. Household/real-estate planning; preserve for separate scope | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H |
| `refunds.html` — Refund Policy — Arowana Profits | **MODIFY** / P3 / Yes | same route subject to product scope. Align copy/learning/disclosures with private beta and real capability | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | No trading logic; static/redirect/shell only | L, H |
| `reset-password.html` — Reset password — Arowana Profits | **MODIFY** / P0 / Yes | shared auth/onboarding/admin boundary. Preserve recovery/setup; UI cache is not authorization | D22 | webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | L, H, E |
| `retirement-calculator.html` — Retirement Calculator — Arowana Profits | **ARCHIVE** / P3 / No active route / deferred | deferred planning if owner approves. Preserve source; tax/retirement assumptions need separate ownership | D13 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | L, H |
| `retirement-planner.html` — Retirement Roadmap — Arowana Pro Desk | **ARCHIVE** / P3 / No active route / deferred | deferred planning if owner approves. Preserve source; tax/retirement assumptions need separate ownership | D00 | webhook/config | retirement_inputs | Yes: calculation/workflow/data orchestration | L, H, E |
| `risk-calculator.html` — Risk Calculator | **MERGE** / P1 / Behavior/data only | position-sizer.html + js/position-math.js. Competing sizing; fresh is a mixed dashboard/template | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H |
| `risk-comfort.html` — Risk Comfort — Arowana Profits | **MODIFY** / P2 / Yes | shared Risk/Options engines with focused views. Preserve deterministic formulas/assumptions; remove copied shell/providers | D03 | No direct provider literal; see deps | Auth/config via deps | Yes: calculation/workflow/data orchestration | H |
| `risk-disclosure.html` — Risk Disclosure — Arowana Profits | **MODIFY** / P3 / Yes | same route subject to product scope. Align copy/learning/disclosures with private beta and real capability | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | No trading logic; static/redirect/shell only | L, H |
| `risk-quiz.html` — Risk Tolerance Quiz • Long-Term Dashboard | **MODIFY** / P2 / Yes | shared long-term planning / Portfolio desk. Preserve planning/exportable assumptions; consolidate allocation/risk | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H |
| `rsi-reversal-scanner.html` — RSI Reversal Scanner — Arowana Profits | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D13 | webhook/config | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H, D |
| `rvol-scanner.html` — RVOL Scanner — Arowana Profits | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D09 | Twelve Data; webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | K, L, H, E, D |
| `scalp-trading-screener.html` — Scalp Trading Screener (Webhook + CSV) | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D00 | webhook/config | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H, E |
| `scanner.html` — Scanners — Arowana Profits | **MODIFY** / P2 / Yes | scanner.html + registry/backend scans. Canonical registry UI declares unavailable data requirements | D31 | No direct provider literal; see deps | Auth/config via deps | Yes: calculation/workflow/data orchestration | H |
| `schwab-callback.html` — Schwab Callback — Arowana Profits | **MODIFY** / P1 / Yes | server-side read-only broker integration. Static connection prototype; exchange/refresh/proxy absent | D06 | EF:schwab-auth-callback; Schwab ref | Auth via supabase-init; token store unknown | Yes: calculation/workflow/data orchestration | E |
| `sector-sentiment-gauge.html` — Sector Sentiment Meter | **MERGE** / P2 / Behavior/data only | market-intelligence.html. Mock/placeholder sector displays; gauge is richer reference | D00 | No direct provider literal; see deps | sector_sentiment | Yes: calculation/workflow/data orchestration | K, H, E, D |
| `sector-sentiment.html` — Sector Sentiment Meter | **MERGE** / P2 / Behavior/data only | market-intelligence.html. Mock/placeholder sector displays; gauge is richer reference | D00 | No direct provider literal; see deps | sector_sentiment | Yes: calculation/workflow/data orchestration | K, H, E, D |
| `security.html` — Security — Arowana Profits | **MODIFY** / P3 / Yes | same route subject to product scope. Align copy/learning/disclosures with private beta and real capability | D00 | Stripe ref | No direct table literal; dynamic/config use may apply | No trading logic; static/redirect/shell only | L, H |
| `settings.html` — Settings — Salon Genie | **ARCHIVE** / P0 / No active route / deferred | none in trading product. Unrelated Salon/GenieSphere data/OAuth domains; exclude future deployment | D32 | Stripe ref | business_profiles; business_settings; check_ins; google_oauth_tokens; meta_oauth_tokens; user_preferences | Yes: calculation/workflow/data orchestration | L, H, E |
| `short-entry-screener.html` — Short Entry Screener — Arowana Profits | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D13 | Stooq | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H, E |
| `short-squeeze-scanner.html` — Short Squeeze Scanner — Arowana Profits | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D13 | webhook/config | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H, D |
| `short-term-dashboard.html` — Short-Term Trading — Dashboard | **MERGE** / P1 / Behavior/data only | trading-command.html. Competing dashboard; preserve unique saved-state/widgets | D05 | Twelve Data; webhook/config | journal_trades | Yes: calculation/workflow/data orchestration | K, L, H, E, D |
| `short-term-template.html` — Arowana Profits — Short-Term Template | **ARCHIVE** / P3 / No active route / deferred | historical reference only. Scaffolds/mock ideas/reports/webhook tests, not canonical features | D09 | No direct provider literal; see deps | Auth/config via deps | No trading logic; static/redirect/shell only | H |
| `short-term-watchlist.html` — Short-Term Watchlist — Arowana Profits | **MERGE** / P1 / Behavior/data only | watchlist.html. Competing saved lists; preserve notes, horizons, IDs | D33 | Finnhub; webhook/config | watchlists | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `signup.html` — Create Account — Arowana Profits | **MODIFY** / P0 / Yes | shared auth/onboarding/admin boundary. Preserve recovery/setup; UI cache is not authorization | D01 | webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | L, H |
| `sma-cross-scanner.html` — SMA Cross Scanner — Arowana Profits | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D00 | Finnhub | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | K, L, H, E, D |
| `stock-analyzer.html` — Stock Analyzer — Arowana Profits | **MERGE** / P2 / Behavior/data only | analysis-central.html. Overlapping research/chart tools; AI/screenshots are not verified facts | D34 | webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | L, H, E, D |
| `stock-checker.html` — Stock Value Checker | **MERGE** / P2 / Behavior/data only | analysis-central.html. Overlapping research/chart tools; AI/screenshots are not verified facts | D00 | webhook/config | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H, E |
| `strategy-backtesting.html` — Strategy Backtesting — Arowana Profits | **MODIFY** / P2 / Yes | deterministic backtesting service. Preserve UI/export; validate timing, fees/slippage, data and demos | D17 | Finnhub; webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | K, L, H, E, D |
| `support.html` — Support — Arowana Profits | **MODIFY** / P3 / Yes | same route subject to product scope. Align copy/learning/disclosures with private beta and real capability | D00 | Schwab ref | No direct table literal; dynamic/config use may apply | No trading logic; static/redirect/shell only | L, H |
| `swing-trader.html` — Swing Trader — Arowana Profits | **MERGE** / P2 / Behavior/data only | trade-plan-builder.html + strategy services. Overlapping generated plans/signals; separate demo and verified inputs | D12 | webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | L, H, E, D |

### T-Z

| File / current purpose | Decision / priority / survival | Canonical / competitors / rationale | Deps | Backend/API refs | Supabase expectation | Inline business logic | Security |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `task-template.html` — ⚡ Short‑Term Trading — Smart Dashboard | **ARCHIVE** / P3 / No active route / deferred | historical reference only. Scaffolds/mock ideas/reports/webhook tests, not canonical features | D13 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | No trading logic; static/redirect/shell only | No specific static signal; not security clearance |
| `tax-advantaged-guide.html` — Tax‑Advantaged Guide • Long‑Term Dashboard | **ARCHIVE** / P3 / No active route / deferred | deferred planning if owner approves. Preserve source; tax/retirement assumptions need separate ownership | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H |
| `tax-loss-harvester.html` — Tax-Loss Harvester — Arowana Profits | **ARCHIVE** / P3 / No active route / deferred | deferred planning if owner approves. Preserve source; tax/retirement assumptions need separate ownership | D03 | No direct provider literal; see deps | Auth/config via deps | Yes: calculation/workflow/data orchestration | L, H |
| `technical-analysis.html` — Technical Analysis Expert — Arowana Profits | **MERGE** / P2 / Behavior/data only | analysis-central.html. Overlapping research/chart tools; AI/screenshots are not verified facts | D17 | Finnhub; Alpha Vantage | Auth/config via deps | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `template.html` — Portfolio Analyzer | **ARCHIVE** / P3 / No active route / deferred | historical reference only. Scaffolds/mock ideas/reports/webhook tests, not canonical features | D20 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | No trading logic; static/redirect/shell only | No specific static signal; not security clearance |
| `template_new.html` — Portfolio Analyzer | **ARCHIVE** / P3 / No active route / deferred | historical reference only. Scaffolds/mock ideas/reports/webhook tests, not canonical features | D20 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | No trading logic; static/redirect/shell only | No specific static signal; not security clearance |
| `terms.html` — Terms of Service — Arowana Profits | **MODIFY** / P3 / Yes | same route subject to product scope. Align copy/learning/disclosures with private beta and real capability | D00 | Stripe ref | No direct table literal; dynamic/config use may apply | No trading logic; static/redirect/shell only | L, H |
| `test_webhook.html` — Webhook Test | **ARCHIVE** / P3 / No active route / deferred | historical reference only. Scaffolds/mock ideas/reports/webhook tests, not canonical features | D00 | webhook/config | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | E |
| `tool-audit.html` — Tool Audit — Arowana Profits | **KEEP** / P1 / Yes | internal tool inventory diagnostics. Useful availability/probe UI; no production probes executed | D35 | No direct provider literal; see deps | Auth/config via deps | Yes: calculation/workflow/data orchestration | L, H, E |
| `tools.html` — Tools — Arowana Profits | **MODIFY** / P1 / Yes | tools.html. Canonical directory; only approved capability metadata | D35 | No direct provider literal; see deps | Auth/config via deps | No trading logic; static/redirect/shell only | No specific static signal; not security clearance |
| `trade-ideas-ai.html` — Trade Ideas AI • GenieSphere | **ARCHIVE** / P3 / No active route / deferred | historical reference only. Scaffolds/mock ideas/reports/webhook tests, not canonical features | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H |
| `trade-journal-pro.html` — Trade Journal Pro — Arowana Profits | **MODIFY** / P1 / Yes | trade-journal-pro.html + journal modules. Stock/options lots/imports/dossier; preserve IDs and ownership | D36 | Finnhub; webhook/config; Schwab ref | tj_stocks/tj_options via sync | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `trade-journal.html` — Trade Journal — Arowana Profits | **MERGE** / P1 / Behavior/data only | trade-journal-pro.html. Different journal tables/local keys need lossless adapters | D09 | No direct provider literal; see deps | Auth/config via deps | Yes: calculation/workflow/data orchestration | L, H |
| `trade-plan-builder.html` — Trade Plan Builder — Arowana Profits | **MODIFY** / P1 / Yes | trade-plan-builder.html + Risk Engine. Thesis, sizing and optional AI draft with manual acceptance | D37 | Finnhub; EF:arowana-ai-coach; webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `trade-scanner.html` — Short-Term Trade Scanner | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D00 | webhook/config | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H, E |
| `trading-command.html` — ⚡ Trading Command — Arowana Profits | **MODIFY** / P1 / Yes | trading-command.html + shared engines. Market read/POC/brief/positions; extract engines | D38 | Finnhub; FMP; EF:arowana-ai-coach; webhook/config | ai_briefs; daily_setups; market_snapshots; tj_options; tj_stocks; watchlist_items; watchlists | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `trading-journal-analysis.html` — Trading Journal Analysis — Arowana Profits | **MERGE** / P1 / Behavior/data only | trade-journal-pro.html. Different journal tables/local keys need lossless adapters | D04 | webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | K, L, H, E, D |
| `tradingcommand.html` — ⚡ Trading Command — Arowana Profits | **MERGE** / P1 / Behavior/data only | trading-command.html. Competing dashboard; preserve unique saved-state/widgets | D39 | Finnhub; EF:arowana-ai-coach; webhook/config; Schwab ref | daily_setups; tj_stocks; watchlists | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `trendline-break.html` — Trendline Break Scanner — Arowana Profits | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D09 | Twelve Data; webhook/config | Auth/config via deps | Yes: calculation/workflow/data orchestration | K, H, E, D |
| `updated-navigation.html` — HTML fragment / embedded module | **ARCHIVE** / P3 / No active route / deferred | historical reference only. Scaffolds/mock ideas/reports/webhook tests, not canonical features | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | No trading logic; static/redirect/shell only | L |
| `volatility-guardrails.html` — Volatility Guardrails — Arowana Profits | **MODIFY** / P2 / Yes | shared Risk/Options engines with focused views. Preserve deterministic formulas/assumptions; remove copied shell/providers | D03 | No direct provider literal; see deps | Auth/config via deps | Yes: calculation/workflow/data orchestration | L, H |
| `volume-spike.html` — Volume Spike Scanner • GenieSphere | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D00 | webhook/config | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H, E, D |
| `vwap-pullback.html` — VWAP Pullback — Arowana Profits | **MERGE** / P2 / Behavior/data only | scanner.html + scanner-defs/strategy engine. Preserve filters/CSV/real math; supply actual data and label demos | D13 | webhook/config | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H, E, D, SYNTAX |
| `watchlist.html` — Watchlist — Arowana Profits | **MODIFY** / P1 / Yes | watchlist.html + list/item contract. Rich strategy review and journal conversion; normalize storage | D40 | Finnhub; webhook/config | watchlists; watchlists payload model; compare child-item callers | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `weekly-swing-trade-post.html` — Weekly Swing Trade Post Generator — Arowana Profits | **ARCHIVE** / P3 / No active route / deferred | historical reference only. Scaffolds/mock ideas/reports/webhook tests, not canonical features | D41 | Alpha Vantage; Yahoo | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | K, E |
| `whale-tracker.html` — Arowana AI Trading Coach — Arowana Profits | **MERGE** / P1 / Behavior/data only | arowana-trader.html. Competing coach, not whale-flow infrastructure | D42 | Finnhub; EF:arowana-ai-coach; webhook/config | daily_setups; watchlist_items; watchlists | Yes: calculation/workflow/data orchestration | K, L, H, E |
| `wheel-calculator.html` — Wheel Strategy Calculator — Free Cash-Secured Put & Covered Call Math | **KEEP** / P2 / Yes | shared Wheel/Options math and educational views. Focused arithmetic; assumptions are not observed broker probabilities | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | L, H |
| `wheel-strategy.html` — 🎠 Wheel Strategy — Arowana Profits | **PORT** / P2 / Behavior/data only | Wheel desk; compare separate Wheel repo later. Preserve history parser/chain math/rule decisions | D43 | No direct provider literal; see deps | Auth/config via deps | Yes: calculation/workflow/data orchestration | L, H |
| `wheel_strategy_web_tool.html` — Wheel Strategy / Option Chain Tracker | **MERGE** / P2 / Behavior/data only | wheel-strategy.html. Earlier parser; compare import edge cases before retirement | D00 | Schwab ref | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H |
| `withdrawal-planner.html` — Withdrawal Planner • Long-Term Dashboard | **ARCHIVE** / P3 / No active route / deferred | deferred planning if owner approves. Preserve source; tax/retirement assumptions need separate ownership | D00 | No direct provider literal; see deps | No direct table literal; dynamic/config use may apply | Yes: calculation/workflow/data orchestration | H |

### HTML classification totals

ARCHIVE: 26, KEEP: 7, MERGE: 77, MODIFY: 61, PORT: 1, SECURITY FIX: 2 (174 files).

### Dependency-set dictionary

Include order is preserved; query strings stripped. Remote entries show host/path without secrets. Fonts/icons are styling dependencies. Empty sets do not exclude inline/dynamically loaded code.

- **D00**: No external script/style tags or static imports; inline/self-contained.
- **D01**: `js/app-config.js`; `js/supabase_min.js`; `js/auth-header.js`
- **D02**: `js/app-config.js`; `js/supabase_min.js`
- **D03**: `css/theme.css`; `js/interface-mode.js`; `js/format.js`; `js/session-user.js`; `js/journal-context.js`; `js/supabase_min.js`; `js/app-config.js`; `js/auth-header.js`; `js/workspace-footer.js`; `js/nav-rail.js`
- **D04**: `js/theme.css`; `js/format.js`; `js/session-user.js`; `js/nav-rail.js`; `js/supabase_min.js`; `js/app-config.js`; `js/auth-header.js`; `js/workspace-footer.js`
- **D05**: `js/supabase.min.js`; `js/app-config.js`; `js/auth-header.js`
- **D06**: `js/supabase-init.js`
- **D07**: `valuation-logic.js`
- **D08**: `js/format.js`; `js/app-config.js`; `js/supabase_min.js`; `js/market-data.js`; `js/auth-header.js`; `js/theme.css`; `widgets-api.stocktwits-cdn.com/loader.js`; `js/session-user.js`; `js/account-switcher.js`; `js/workspace-footer.js`
- **D09**: `cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css`; `js/supabase-init.js`
- **D10**: `js/format.js`; `js/theme.css`; `js/session-user.js`; `js/supabase_min.js`; `js/app-config.js`; `js/market-data.js`; `js/plan.js`; `js/auth-header.js`; `js/journal-sync.js`; `js/workspace-footer.js`
- **D11**: `cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js`
- **D12**: `app-config.js`
- **D13**: `cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css`
- **D14**: `shared/js/app-config.js`; `shared/js/auth-header.js`; `shared/js/hub-badges.js`; `shared/js/gs-client.js`
- **D15**: `shared/js/salon-dashboard.js`
- **D16**: `cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css`; `cdn.jsdelivr.net/npm/chart.js`
- **D17**: `js/theme.css`; `js/interface-mode.js`; `js/format.js`; `js/session-user.js`; `js/nav-rail.js`; `js/supabase_min.js`; `js/app-config.js`; `js/auth-header.js`; `js/workspace-footer.js`
- **D18**: `js/app-config.js`
- **D19**: `cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css`
- **D20**: `cdn.jsdelivr.net/npm/chart.js`
- **D21**: `css/theme.css`; `js/format.js`; `js/session-user.js`; `js/journal-context.js`; `js/supabase_min.js`; `js/market-data.js`; `js/app-config.js`; `js/auth-header.js`; `js/workspace-footer.js`
- **D22**: `js/session-user.js`; `js/supabase_min.js`; `js/auth-header.js`
- **D23**: `unpkg.com/@supabase/supabase-js@2.45.4/dist/umd/supabase.js`; `js/app-config.js`
- **D24**: `js/format.js`; `js/options-hub-trading-layout.js`; `js/theme.css`; `js/session-user.js`; `js/journal-context.js`; `js/app-config.js`; `js/supabase_min.js`; `js/market-data.js`; `js/plan.js`; `js/risk.js`; `js/auth-header.js`; `js/workspace-footer.js`
- **D25**: `shared/js/app-config.js`; `cdn.jsdelivr.net/npm/@supabase/supabase-js@2`; `shared/js/gs-client.js`; `shared/js/auth-header.js`
- **D26**: `js/format.js`; `js/theme.css`; `js/session-user.js`; `js/portfolio-breadth.js`; `js/holdings-source.js`; `js/account-switcher.js`; `js/account-registry.js`; `js/market-data.js`; `js/app-config.js`; `js/supabase_min.js`; `js/auth-header.js`; `js/workspace-footer.js`
- **D27**: `js/theme.css`; `js/session-user.js`; `js/portfolio-breadth.js`; `js/holdings-source.js`; `js/app-config.js`; `js/supabase_min.js`; `js/market-data.js`; `js/plan.js`; `js/account-registry.js`; `js/auth-header.js`; `js/strategy-analyzers.js`; `js/workspace-footer.js`
- **D28**: `js/interface-mode.js`; `js/session-user.js`; `js/nav-rail.js`; `js/app-config.js`; `js/supabase_min.js`; `js/auth-header.js`; `js/workspace-footer.js`
- **D29**: `cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css`; `js/supabase.min.js`; `js/app-config.js`; `js/auth-header.js`
- **D30**: `js/supabase.min.js`; `app-config.js`; `js/auth-header.js`
- **D31**: `js/interface-mode.js`; `js/session-user.js`; `js/scanners.js`; `js/scanner-defs.js`; `unpkg.com/@supabase/supabase-js@2.45.4/dist/umd/supabase.js`; `js/nav-rail.js`; `js/app-config.js`; `js/auth-header.js`
- **D32**: `shared/js/bottom-nav.js`; `shared/js/core/auth.js`
- **D33**: `unpkg.com/@supabase/supabase-js@2.45.4/dist/umd/supabase.js`; `js/app-config.js`; `js/auth-header.js`
- **D34**: `js/supabase.min.js`; `js/app-config.js`; `js/auth-header.js`; `cdn.jsdelivr.net/npm/@supabase/supabase-js@2`
- **D35**: `css/theme.css`; `js/interface-mode.js`; `js/format.js`; `js/session-user.js`; `js/supabase_min.js`; `js/app-config.js`; `js/auth-header.js`; `js/workspace-footer.js`; `js/nav-rail.js`
- **D36**: `js/format.js`; `js/auth-guard.js`; `js/journal-sync.js`; `js/account-registry.js`; `js/journal-fields.js`; `js/price-fetcher.js`; `css/theme.css`; `js/session-user.js`; `unpkg.com/@supabase/supabase-js@2.45.4/dist/umd/supabase.js`; `js/app-config.js`; `js/market-data.js`; `js/auth-header.js`; `js/workspace-footer.js`
- **D37**: `js/session-user.js`; `js/nav-rail.js`; `js/interface-mode.js`; `js/position-math.js`; `js/app-config.js`; `js/supabase_min.js`; `js/auth-header.js`
- **D38**: `js/theme.css`; `js/journal-sync.js`; `js/session-user.js`; `js/account-switcher.js`; `js/setup-scorecard.js`; `js/app-config.js`; `js/supabase_min.js`; `js/market-data.js`; `js/auth-header.js`; `js/plan.js`; `js/workspace-footer.js`
- **D39**: `js/journal-sync.js`; `js/nav-rail.js`; `js/setup-scorecard.js`; `js/app-config.js`; `js/supabase_min.js`; `js/auth-header.js`
- **D40**: `js/format.js`; `css/theme.css`; `js/interface-mode.js`; `js/session-user.js`; `unpkg.com/@supabase/supabase-js@2.45.4/dist/umd/supabase.js`; `js/nav-rail.js`; `js/app-config.js`; `js/auth-header.js`; `js/strategy-analyzers.js`; `js/workspace-footer.js`
- **D41**: `cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css`; `s3.tradingview.com/tv.js`
- **D42**: `js/format.js`; `js/session-user.js`; `js/supabase_min.js`; `js/app-config.js`; `js/auth-header.js`; `js/journal-sync.js`; `js/interface-mode.js`; `js/workspace-footer.js`
- **D43**: `js/nav-rail.js`; `js/app-config.js`; `js/supabase_min.js`; `js/auth-header.js`

## Complete missing HTML-target appendix

Browser-root resolution; 80 targets / 230 occurrences. Sample locations (up to three) accompany totals. Dynamic JS/CSS links and external services are outside this count. Do not recreate unrelated-product routes.

| Missing normalized target | Occurrences | Sample source locations |
| --- | --- | --- |
| `all-assigned-tasks.html` | 1 | dashboard.html:855 (a) |
| `api.html` | 1 | features.html:717 (a) |
| `app-config.js` | 4 | automated-trading-plan.html:936 (script); news-trading.html:945 (script); pricing-revolutionary.html:640 (script) |
| `appointment.html` | 5 | dashboard.html:583 (a); dashboard.html:642 (a); dashboard.html:676 (a) |
| `atr-stop.html` | 4 | ema-snapback.html:238 (a); gap-and-go.html:514 (a); intraday-breakout.html:376 (a) |
| `business/expense-receipt-scanner.html` | 1 | overview.html:607 (a) |
| `careers.html` | 14 | arowana-template.html:372 (a); gap-and-go.html:543 (a); long-term-dashboard.html:2472 (a) |
| `check-in-queue.html` | 4 | dashboard.html:588 (a); dashboard.html:653 (a); dashboard.html:787 (a) |
| `checkin-kiosk.html` | 2 | dashboard.html:812 (a); settings.html:650 (a) |
| `contact.htm` | 4 | option-trader.html:187 (a); portfolio-tracker.html:172 (a); template.html:266 (a) |
| `customer-review-tracker.html` | 1 | dashboard.html:796 (a) |
| `customers.html` | 3 | dashboard.html:593 (a); dashboard.html:818 (a); dashboard.html:986 (a) |
| `dashboard/business.html` | 5 | overview.html:434 (a); overview.html:610 (a); overview.html:661 (a) |
| `dashboard/finance.html` | 9 | overview.html:437 (a); overview.html:490 (a); overview.html:584 (a) |
| `dashboard/household.html` | 4 | overview.html:433 (a); overview.html:640 (a); overview.html:641 (a) |
| `dashboard/investment.html` | 5 | overview.html:435 (a); overview.html:605 (a); overview.html:682 (a) |
| `dashboard/leisure.html` | 5 | overview.html:436 (a); overview.html:606 (a); overview.html:703 (a) |
| `dashboard/overview.html` | 4 | overview.html:432 (a); overview.html:554 (a); overview.html:555 (a) |
| `docs.html` | 2 | features.html:716 (a); index.html:346 (a) |
| `economic-calendar.html` | 7 | long-term-dashboard.html:1842 (a); long-term-dashboard.html:1981 (a); long-term-portfolio.html:198 (a) |
| `education.html` | 3 | guide-claude-tradingview-windows.html:225 (a); guide-claude-tradingview-windows.html:240 (a); guide-claude-tradingview-windows.html:844 (a) |
| `event-planner.html` | 1 | dashboard.html:914 (a) |
| `feature.html` | 1 | feature_body.html:256 (a) |
| `front-desk.html` | 1 | dashboard.html:815 (a) |
| `help.html` | 1 | dashboard.html:966 (a) |
| `hiring.html` | 1 | dashboard.html:858 (a) |
| `import-weekly-commissions.html` | 1 | dashboard.html:861 (a) |
| `index.htm` | 3 | portfolio-tracker.html:160 (a); template.html:254 (a); template_new.html:137 (a) |
| `inventory.html` | 1 | dashboard.html:933 (a) |
| `investment.html` | 1 | ai_valuation.html:95 (a) |
| `js/options-hub-trading-layout.js` | 1 | options-hub.html:15 (script) |
| `js/supabase.min.js` | 9 | ai-trading-agent.html:291 (script); buy-sell-signal.html:345 (script); chart-analysis-form.html:624 (script) |
| `kelly-sizer.html` | 4 | long-term-dashboard.html:1980 (a); master-journal.html:249 (a); position-sizer_fresh.html:1588 (a) |
| `manage-agent-tasks.html` | 1 | dashboard.html:849 (a) |
| `manage-employees.html` | 2 | dashboard.html:846 (a); settings.html:292 (a) |
| `marketing.html` | 1 | dashboard.html:908 (a) |
| `momentum-hunter-sidebar.html` | 1 | momentum-hunter.html:1208 (a) |
| `onboarding/login.html` | 1 | dashboard.html:544 (a) |
| `payment-tracker.html` | 2 | dashboard.html:883 (a); dashboard.html:936 (a) |
| `portfolio-analyzer.htm` | 3 | portfolio-tracker.html:166 (a); template.html:260 (a); template_new.html:143 (a) |
| `portfolio-analyzer.html` | 1 | option-trader.html:183 (a) |
| `portfolio-holdings.html` | 2 | long-term-dashboard.html:2110 (a); long-term-dashboard.html:2291 (a) |
| `portfolio-review.html` | 3 | long-term-dashboard.html:2111 (a); long-term-dashboard.html:2290 (a); long-term-dashboard.html:2323 (a) |
| `portfolio-setup.html` | 2 | long-term-dashboard.html:2109 (a); long-term-dashboard.html:2309 (a) |
| `portfolio.html` | 1 | feature_body.html:460 (a) |
| `pos.html` | 3 | dashboard.html:652 (a); dashboard.html:675 (a); dashboard.html:790 (a) |
| `position-planner.html` | 3 | my-rules-short.html:200 (a); my-rules.html:213 (a); r-multiple.html:4817 (a) |
| `position-size.html` | 3 | gap-and-go.html:513 (a); intraday-breakout.html:375 (a); opening-drive.html:425 (a) |
| `reports.html` | 3 | dashboard.html:674 (a); dashboard.html:877 (a); dashboard.html:991 (a) |
| `review-response-templates.html` | 1 | dashboard.html:917 (a) |
| `rsi-screener.html` | 6 | feature_body.html:356 (a); feature_new.html:235 (a); long-term-dashboard.html:1946 (a) |
| `salon-analytics-agent.html` | 3 | dashboard.html:527 (a); dashboard.html:626 (a); dashboard.html:737 (a) |
| `salon-booking-agent.html` | 6 | dashboard.html:524 (a); dashboard.html:545 (a); dashboard.html:623 (a) |
| `salon-briefing-agent.html` | 4 | dashboard.html:523 (a); dashboard.html:622 (a); dashboard.html:707 (a) |
| `salon-dashboard.html` | 5 | dashboard.html:512 (a); dashboard.html:522 (a); dashboard.html:983 (a) |
| `salon-inventory-agent.html` | 3 | dashboard.html:598 (a); dashboard.html:624 (a); dashboard.html:713 (a) |
| `salon-loyalty-agent.html` | 3 | dashboard.html:631 (a); dashboard.html:761 (a); dashboard.html:821 (a) |
| `salon-marketing-agent.html` | 4 | dashboard.html:526 (a); dashboard.html:625 (a); dashboard.html:641 (a) |
| `salon-payroll-agent.html` | 5 | dashboard.html:628 (a); dashboard.html:664 (a); dashboard.html:743 (a) |
| `salon-reception-agent.html` | 4 | dashboard.html:525 (a); dashboard.html:627 (a); dashboard.html:725 (a) |
| `salon-reviews-agent.html` | 3 | dashboard.html:630 (a); dashboard.html:755 (a); dashboard.html:824 (a) |
| `salon-staff-agent.html` | 4 | dashboard.html:629 (a); dashboard.html:663 (a); dashboard.html:749 (a) |
| `shared/images/arowanalogo.png` | 4 | buy-a-home.html:87 (img); college-savings.html:86 (img); dca-planner.html:84 (img) |
| `shared/js/app-config.js` | 2 | daily-bias.html:280 (script); overview.html:804 (script) |
| `shared/js/auth-header.js` | 2 | daily-bias.html:281 (script); overview.html:807 (script) |
| `shared/js/bottom-nav.js` | 1 | settings.html:1720 (script) |
| `shared/js/gs-client.js` | 2 | daily-bias.html:283 (script); overview.html:806 (script) |
| `shared/js/hub-badges.js` | 1 | daily-bias.html:282 (script) |
| `shared/js/salon-dashboard.js` | 1 | dashboard.html:996 (script) |
| `shift-notes-inbox.html` | 1 | dashboard.html:880 (a) |
| `sma-crossover.html` | 1 | feature_body.html:376 (a) |
| `social-media.html` | 2 | dashboard.html:793 (a); dashboard.html:911 (a) |
| `status.html` | 1 | dashboard.html:967 (a) |
| `stocks-screener.htm` | 3 | portfolio-tracker.html:165 (a); template.html:259 (a); template_new.html:142 (a) |
| `stocks-screener.html` | 1 | option-trader.html:182 (a) |
| `strategy-backtester.html` | 5 | long-term-dashboard.html:1979 (a); long-term-portfolio.html:197 (a); master-journal.html:248 (a) |
| `swing-breakout-pb.html` | 4 | long-term-dashboard.html:1954 (a); master-journal.html:226 (a); position-sizer_fresh.html:1562 (a) |
| `swing_trade_scanner.html` | 1 | feature_body.html:396 (a) |
| `task-assigner.html` | 1 | dashboard.html:852 (a) |
| `valuation-logic.js` | 1 | ai_valuation.html:8 (script) |

## JavaScript module inventory

All 32 modules are classified individually. Business logic is in external scripts rather than HTML-inline code; UI/session modules are called out. Global interfaces/events should survive as temporary adapters while implementation moves.

| Module / purpose | Decision / priority / survival | Canonical / competitors | Dependencies | Supabase | Backend/API | Business logic / security |
| --- | --- | --- | --- | --- | --- | --- |
| `js/account-registry.js` — Account registry with legacy-name merge and best-effort cloud sync | **MODIFY** / P1 / Yes | One account service; merge inline registries | ap_accounts_v1, tj_accounts_v1, pc_accounts_v1; shared client | arowana.entities and arowana.financial_accounts | Supabase SDK | External module (not inline). L/E; account names versus IDs, user ownership |
| `js/account-switcher.js` — Enhances native account select while preserving change listeners | **KEEP** / P1 / Yes | Same module; merge inline widget copies | DOM select/page change handlers | None direct | None | External module (not inline). DOM escaping; retain page event compatibility |
| `js/app-config.js` — Config, REST wrapper, key hydration, webhook headers and auth bootstrap | **SECURITY FIX** / P0 / Selected logic after fixes | Secure config/session/provider services; competing inline configs | config.json, Supabase SDK, storage, browser globals | user_api_keys; generic REST wrapper and Auth | Configured n8n/provider headers; Supabase | External module (not inline). SEC-02/03/04; browser key distribution, cached tokens, client rate limits |
| `js/auth-guard.js` — Misnamed old navigation rail, not authentication guard | **MERGE** / P0 / Selected logic after fixes | js/nav-rail.js; real auth boundary separately | railMount, DOM, cached plan/user | None direct | None | External module (not inline). SEC-04; name must not be treated as security control |
| `js/auth-header.js` — Cached identity display, live session verification and sign-out UI | **MODIFY** / P0 / Yes | Shared session service; inline header competitors | gs_auth_user_v1, GSClient/shared client, old login default | Auth/session | Supabase SDK | External module (not inline). L; display cache is not identity authority |
| `js/bottom-nav.js` — Salon multi-product mobile navigation/preferences | **ARCHIVE** / P3 / No active copy | js/nav-rail.js for trading | SGBottomNav, product/role pools and DOM | Auth user_metadata.bottom_nav | Supabase user update | External module (not inline). Unrelated product roles, metadata access |
| `js/dividend-screener.js` — Old n8n dividend renderer, no current static include | **ARCHIVE** / P1 / No active copy | dividend-screener.html storage-fed implementation | Legacy form IDs; no matching script include | None direct | n8n ai-dividend-screener | External module (not inline). SEC-06-like raw external HTML interpolation; not current page implementation |
| `js/format.js` — Currency/percent/share/date formatting | **KEEP** / P1 / Yes | Same module; merge inline formatter copies | Intl and browser globals | None | None | External module (not inline). Preserve missing-value semantics; no specific security issue found |
| `js/holdings-source.js` — Aggregates open long lots by symbol/broker and weighted cost | **MODIFY** / P1 / Yes | One holdings service; merge Portfolio inline copy | JWT/user ID, payload quantities/prices | tj_stocks REST | Supabase REST | External module (not inline). L/E; excludes shorts, not complete exposure engine |
| `js/interface-mode.js` — Normalizes beginner/guided/full modes across CSS dialects | **KEEP** / P1 / Yes | Same module; replace inline mode variants | ap_interface_mode_v1, URL, DOM/events | None | None | External module (not inline). L; mode visibility is not authorization |
| `js/invest-helper-logic.js` — Orphan learning wizard with direct OpenAI request | **SECURITY FIX** / P0 / Selected logic after fixes | Archive helper; learning UI in learn-investing.html | Modal DOM and saved progress; removed-key placeholder | None | OpenAI chat completions | External module (not inline). SEC-03; no active private key proven here, direct-browser architecture unsafe |
| `js/journal-context.js` — Personal trade history summaries for tool feedback | **MODIFY** / P1 / Yes | Shared read-only journal analytics | tj_stocks_v2/tj_options_v2; optional TJSync | Indirect via journal-sync | None direct | External module (not inline). L; user ownership and provenance of local records |
| `js/journal-fields.js` — Mistake/emotion/entry-Greek journal form fields | **KEEP** / P1 / Yes | Same module until forms extracted | Global stocks/options arrays and journal modal IDs | Indirect via journal payload/sync | None direct | External module (not inline). L; optional fields preserve old-record compatibility |
| `js/journal-sync.js` — Local-authoritative mirror, retry/backfill and cache quarantine | **MODIFY** / P0 / Yes | Explicit journal/offline authority contract | Supabase client, local keys, IDs/payloads, user scope | tj_stocks and tj_options (dynamic table arguments) | Supabase SDK | External module (not inline). SEC-05; preserve quarantine/retry while resolving conflict/deletion policy |
| `js/market-data.js` — Global Finnhub fetch interception to research function | **MODIFY** / P0 / Yes | Normalized Data Hub; replace global patch incrementally | Shared client/session; window.fetch and script order | Auth only directly | arowana-research with JWT and path/query | External module (not inline). E; selected-page coverage, upstream/key checks remain elsewhere |
| `js/nav-rail.js` — Shared rail, account menu and mobile nav | **MODIFY** / P1 / Yes | Canonical rail; inline copies and auth-guard compete | railMount, DOM, cached user/plan, local collapse state | Auth indirectly | None direct | External module (not inline). L/H; navigation visibility not authorization |
| `js/option-roll-analyzer.js` — Orphan quote/n8n advice helper with embedded credential-like literal | **SECURITY FIX** / P0 / Selected logic after fixes | Remove exposure in later task, then archive into Options service | Legacy form IDs; no matching HTML include | None direct | Twelve Data; placeholder n8n option-roll-analyzer | External module (not inline). SEC-01/06; literal omitted, unescaped result.advice |
| `js/plan.js` — Cached/server subscription and feature display | **MODIFY** / P0 / Yes | Shared entitlement client, server authoritative | Shared session; ap_plan_v1/ap_plan_state_v1 | profiles incl arowana_plan/status | Supabase; assumes Stripe webhook producer | External module (not inline). L/E; browser cached plan/dev flags cannot authorize data |
| `js/portfolio-breadth.js` — Fund/sector-aware breadth and allocation weights | **MODIFY** / P2 / Yes | Portfolio Engine; inline calculations overlap | Holdings and static fund/security metadata | None direct | None | External module (not inline). Static classification freshness and calculation assumptions need validation |
| `js/position-math.js` — Pure sizing arithmetic, warnings, summary, journal link | **KEEP** / P1 / Yes | Canonical kernel; position-sizer still has inline copy | Numeric inputs; no DOM/storage/network | None | None | External module (not inline). Validate formulas in future extraction task; not certified by syntax check |
| `js/price-fetcher.js` — BYOK Finnhub refresh of stock marks for journal | **MODIFY** / P0 / Yes | Shared quote service; inline journal fetcher competes | User key/cache, fetch; market-data shim may intercept | None direct; marks stored in journal | Finnhub quotes | External module (not inline). K/L/E; key precondition and timestamp/source consistency |
| `js/risk.js` — Wheel capital/concentration/earnings guardrails | **MODIFY** / P1 / Yes | General Risk Engine with Wheel-specific policies | Shared session; option payloads; settings | ap_risk_settings, tj_options | Supabase SDK | External module (not inline). E; deterministic warnings not server trade authorization |
| `js/scanner-defs.js` — Personal movers/gap plus pending scan definitions | **MODIFY** / P2 / Yes | Canonical definitions + Data Hub | Scanner registry, personal universe, Finnhub key | None direct; local watchlist universe | Finnhub quote | External module (not inline). K/L/E; pending candle/backend scans are not implemented |
| `js/scanners.js` — Scanner registry, availability/mode/plan and results | **KEEP** / P2 / Yes | Canonical registry; backend authorization separate | AP_PLAN/AP_MODE/dev flags and definitions | None direct | No direct fetch | External module (not inline). Browser capability/plan gates are UX only |
| `js/session-user.js` — Repairs cached user ID and quarantines cross-user data | **MODIFY** / P0 / Yes | Shared session/ownership boundary | gs_auth_user_v1, storage prefixes, session discovery | Auth session | Supabase SDK | External module (not inline). SEC-05; preserve ownership protections, unify consumers |
| `js/setup-scorecard.js` — Rubrics, quote autofill, R:R grade and UI | **MODIFY** / P2 / Yes | Canonical scorecard; extract pure grading/quote adapter | Registry/DOM, Finnhub BYOK | None direct | Finnhub quote | External module (not inline). K/L/E; same file as _v9; scoring requires deterministic tests |
| `js/setup-scorecard_v9.js` — Byte-identical versioned scorecard copy | **DELETE** / P3 / No active copy | js/setup-scorecard.js after final reference check | Same as canonical; no static HTML include | None direct | Finnhub quote | External module (not inline). Same key path as canonical; no separate future copy |
| `js/strategy-analyzers.js` — Indicator/zone/Wheel/HV/POC registry with BYOK bars | **SECURITY FIX** / P0 / Selected logic after fixes | Preserve algorithms in Technical/Strategy engines | AP user keys, OHLCV, registry/cache; _v1 competitor | None direct | Twelve Data daily bars + Alpha Vantage fallback | External module (not inline). K/L/E; daily proxies, no live chain/IV; POC approximates volume distribution |
| `js/strategy-analyzers_v1.js` — Older registry missing later POC/Wheel additions | **MERGE** / P2 / Selected logic after fixes | js/strategy-analyzers.js | Same providers/keys; no static HTML include | None direct | Twelve Data + Alpha Vantage | External module (not inline). K/L/E; retire after parity comparison |
| `js/supabase-init.js` — Competing ES-module auth/recovery client | **MODIFY** / P0 / Yes | One shared Supabase client | Callback import; dynamically requests missing dotted SDK filename | Auth; hardcoded public project/anon config | Supabase | External module (not inline). K/E; client duplication and missing SDK path, anon is public |
| `js/supabase_min.js` — Vendored Supabase JS 2.45.3 UMD | **KEEP** / P1 / Yes | One deliberately versioned SDK; CDN 2.45.4/@2 compete | Vendor SDK/browser | Generic Auth/PostgREST/storage SDK | Supabase | External module (not inline). Dependency/version review; do not edit minified internals |
| `js/workspace-footer.js` — Slim signed-in footer retaining risk statement | **KEEP** / P1 / Yes | Same module; merge inline footer copies | Auth display state, DOM, marketing exclusions | None direct | None | External module (not inline). L; display-only gating |

### JavaScript classification totals

ARCHIVE: 2, DELETE: 1, KEEP: 8, MERGE: 2, MODIFY: 15, SECURITY FIX: 4 (32 files).

## CSS and configuration inventory

| File / purpose | Decision / priority | Survival / canonical | Dependencies / duplicates | API / Supabase | Inline logic / security |
| --- | --- | --- | --- | --- | --- |
| `css/theme.css` — tokens plus opt-in tab/layout rules | **MODIFY** / P1 | Yes; consolidate here | theme.css/js/theme.css token overlap; 17 actual HTML stylesheet includes | None | No business logic; cascade compatibility |
| `js/theme.css` — token-only legacy theme | **MERGE** / P1 | Rules survive in css/theme.css | Byte-identical to root theme.css; 12 actual HTML includes | None | No business logic; migrate includes deliberately |
| `theme.css` — duplicate root token file | **DELETE** / P3 | No separate copy after reference review | Byte-identical to js/theme.css; no actual HTML stylesheet include | None | No business logic; future removal only |
| `css/arowana-ui.css` — emoji/icon alignment helpers | **KEEP** / P3 | Keep reference; archive later if unused | No actual HTML stylesheet include; compare inline icon styles | None | No business logic; no specific security concern |
| `js/config.json` — project/anon, webhooks, branding, redirect | **SECURITY FIX** / P0 | Keep public config concept; use environment-specific boundary | app-config.js plus hardcoded fallbacks; absent dashboard redirect path | Supabase public config; n8n morning_brief/moat_inference | No business logic; production-looking coupling/webhook destinations; anon key is public |

### Complete primary-source classification totals

211 rows: **KEEP 16; MODIFY 77; MERGE 80; PORT 1; ARCHIVE 28; DELETE 2; SECURITY FIX 7**. These totals count 174 HTML, 32 JS, four CSS and one JSON file, without double-counting subsystem recommendations.

## Supporting files and assets

These 38 baseline files complete the 249-file repository inventory. They have no HTML-inline business logic, API calls or Supabase runtime dependencies unless explicitly noted below. Image/Word contents were not rendered; their future use is subject to owner confirmation. `.git` internals are version-control state, not product source.

| File(s) / purpose | Classification / priority / survival | Dependencies, competing sources and concerns |
|---|---|---|
| `AGENTS.md`, `CLAUDE.md` — coding roles and task discipline | KEEP / P1 / Yes | Govern agent work; no application/API dependency. Reconcile only if owner supplies replacement instructions. |
| `PROJECT_RULES.md`, `docs/ARCHITECTURE.md` — product/security direction | KEEP / P1 / Yes | Canonical intended direction; current pages conflict with it. Future blueprint changes require explicit owner decision. |
| `PROJECT_STATUS.md`, `TASKS.md` — status and task board | MODIFY / P1 / Yes | Updated only to record this audit; other tasks remain unstarted. |
| `README.md`, `SETUP.md` — onboarding/local preview | MODIFY / P1 / Yes | Static Python server instructions useful; baseline/security assumptions need later reconciliation with findings. |
| `SECURITY.md` — security rules/rotation notice | MODIFY / P0 / Yes | Rules remain valuable, but known-key cleanup statement does not cover remaining literal. No credentials belong in docs. |
| `LICENSE.md` — proprietary notice | KEEP / P1 / Yes | Owner/legal authority; no technical rewrite proposed. |
| `docs/PHASE0_AUDIT.md` — preliminary findings | MERGE / P3 / Historical reference | This report supersedes initial inventory recommendations; absent index variants and thin-versus-retired Market Intelligence wording are stale. File preserved. |
| `.github/pull_request_template.md` — review checklist | KEEP / P1 / Yes | Links task scope, checks, documentation and rollback; no runtime dependency. |
| `.github/workflows/secret-check.yml` — push/PR CI | MODIFY / P0 / Yes | Runs Python 3.12 secret scanner; scanner coverage incomplete. No application tests/build configured. |
| `scripts/check-secrets.py` — regex credential check | MODIFY / P0 / Yes | Python standard library only; scans text files, excludes vendor/build folders and env template; add provider coverage in later authorized security task. |
| `.env.example` — blank server-side secret names | KEEP / P1 / Yes | Template only; no dotenv loader/backend exists here. A static browser app does not automatically consume this file. |
| `.gitignore` — secrets/artifacts/editor exclusions | KEEP / P1 / Yes | Useful guardrail, not retroactive credential removal or access control. |
| `sitemap.xml` — public URL index | MODIFY / P3 / Yes | Reconcile canonical/public-only URLs after navigation/product decisions; do not advertise archived/protected screens. |
| `documents/robots.txt` — crawl directives | MODIFY / P3 / Yes | Stored under documents rather than served root; verify hosting mapping. Robots rules do not authorize access. |
| `documents/DEPLOY-README.txt` — old deployment instructions | ARCHIVE / P3 / No active instructions | Includes server cleanup and Stripe/Market Intelligence directions that conflict with new architecture. Treat as history, not commands. |
| `documents/Arowana Profits #U2014 Business Plan.docx`, `documents/Wheel Strategy Desk #U2014 Project Plan.docx` — historical plans | ARCHIVE / P3 / Reference only | Inventoried, not rendered; cannot establish authority over current architecture or forthcoming blueprint. |
| `images/arowanalogo.png`, `images/arowanalogo.psd` — logo and editable source | KEEP / P3 / Yes, provisional | Branding assets; confirm preferred variant before future design changes. No binary visual evaluation performed. |
| `images/arowanalogo-OLD.png`, `images/arowanalogo2.png`, `images/arowanalogo3.png`, `images/arowanalogo4.png`, `images/arowanalogo5.png`, `images/NEW-LOGO.png` — competing logo variants | ARCHIVE / P3 / Reference only | Proposed canonical logo above is provisional; do not delete referenced variants without owner review. |
| `images/header-bg.png`, `images/hero-bg.png`, `images/hero-bg2.png`, `images/hero-bg3.png` — page artwork | KEEP / P3 / Conditional | Preserve existing references; visual/brand consolidation later. |
| `images/29fa88cd-e9a9-4751-8b57-47de015a2d39.png`, `images/2c9e1075-37d0-487a-b231-43d9438a42dc.png`, `images/May 4, 2025, 08_50_25 AM.png`, `images/May 4, 2025, 08_50_34 AM.png` — unnamed/dated artwork | ARCHIVE / P3 / Reference only | Purpose/rights/canonical selection unknown without visual review; preserve files. |
| `images/top-10-most-powerfull-candlestick-260nw-2492670569.webp` — candlestick education graphic | KEEP / P3 / Conditional | Retain only if educational use and asset rights confirmed; not a data source. |

## Validation results and limits

| Check | Exact scope | Result |
|---|---|---|
| Git baseline | Branch/status/history before edits | Clean `main` at `e2a9cc3`, two commits. Created requested `codex/ATD-001-full-repository-audit`; no production/configuration writes. |
| Inventory coverage | Every tracked baseline `.html`, `.js`, `.css`, and `js/config.json`; remaining files listed above | 174 + 32 + 4 + 1 = 211 individual source/config rows; 38 supporting files = 249 baseline files. |
| Duplicate hashes | SHA-256 comparison of HTML/JS/CSS source files | Two exact pairs: setup-scorecard/_v9 and root theme/js/theme. Other competing pages are not assumed identical. |
| Secret check | `python -B scripts/check-secrets.py` | PASS for its configured patterns. **Does not detect remaining Twelve Data-like literal**; no claim of secret-free repository. |
| Credential-like literal inspection | In-memory source search for assigned key/token-like strings, reported by path/line/length without value | Found `js/option-roll-analyzer.js:9`; no validity or rotation check. Not a comprehensive credential inventory. |
| Standalone JavaScript syntax | `node --check` for all 32 `.js` files, Node v22.15.1 | 32 passed. Parsing does not establish DOM correctness, mathematical correctness or live dependencies. |
| Inline JavaScript syntax | Python HTMLParser extracted 477 nonempty executable script blocks from all 174 HTML-extension files; piped each to `node --check --input-type=commonjs` or `module` according to tag | 473 passed; four existing failures listed below. JSON/non-executable script blocks and event-handler attributes excluded. No scripts executed. |
| Local HTML paths | Parsed src/href, browser-root URL resolution, normalized path existence | 80 missing targets / 230 occurrences; appendix lists each. Not a network/link crawler; dynamic JS/CSS paths excluded. |
| JSON/XML | Parse `js/config.json`, JSON workflow in cover-call file, and `sitemap.xml` | PASS for all three documents; parsing does not verify semantics or endpoint existence. |
| Documentation integrity | Inventory row coverage/counts, dependency IDs, Markdown table column counts, `git diff --check` | PASS: 211 unique primary rows, 38 supporting filenames, 44 dependency sets with no undefined references, consistent table columns; final git diff whitespace check passed. |
| Scope protection | Compare baseline tracked file hashes and Git changed-path list | PASS: baseline tracked contents compared with CRLF/LF normalization; only TASKS.md and PROJECT_STATUS.md differ, plus the new audit document. No application changes. |

### Existing syntax failures (left unchanged)

| File:line | Failure | Migration action |
|---|---|---|
| `chart-analysis-form.html:965` | Template literals used as uncomputed object property keys in `tfLabel`; Unexpected template string | Repair only in a separately assigned implementation task if preserving Chart Analyzer behavior. |
| `hod-scanner.html:369` | Literal backslash-r/backslash-n sequences in executable DOMContentLoaded code; Invalid or unexpected token | Merge useful scanner behavior into registry; do not treat current page as runnable. |
| `vwap-pullback.html:367` | Same literal escape-sequence parse problem | Same migration gate as HOD. |
| `options-hub-creator.html:83` | Overescaped regex produces Invalid regular expression flags | Archive one-off updater; do not run it against canonical pages. |

No application test suite, package manager, framework, database migrations or frontend runtime was introduced. No fixes to these failures were attempted. ATD-001 ends at this report and the two tracking updates; review is required before assigning the next task.
