# ATD-004 — Data source inventory

Date: 2026-09-28. Branch: `codex/ATD-004-data-source-inventory-contract`. Application baseline: `47fe1ca`; branch created from `784d6d7` with ATD-005 documentation preserved. Status: inventory complete; proposed contract awaiting review. No implementation or follow-on work started.

## Executive summary

The legacy application has multiple competing acquisition paths: browser provider calls, a Finnhub interception shim, Supabase queries, configurable n8n webhooks, local journal mirrors and manual inputs. These do not yet form one normalized Data Hub. Provider success does not prove a complete dataset, realtime entitlement or consistent adjustment/freshness semantics.

The target remains the architecture's Alpaca market data, FMP fundamentals/estimates, FRED macro and SEC filings, with Schwab read-only later. These are target adapters, not confirmed subscriptions or implemented repository integrations. Finnhub/Twelve Data/Alpha Vantage remain legacy migration sources. The [proposed v0.1 contract](ATD-004_DATA_HUB_CONTRACT.md) defines the boundary for future implementation without changing current behavior.

## Evidence and limits

- Read project governance and ATD-001, ATD-002 and ATD-005 evidence before changes. Source traces below refer to unchanged application files.
- Searched all 206 first-party HTML/JS/JSON files, excluding the vendored Supabase SDK from custom-logic analysis. The appendix records provider/workflow signals, including links and comments; matches do not prove execution.
- Reused ATD-005's dated live metadata and sampled deployed-source findings. No fresh database, provider, webhook or broker calls were made in ATD-004. No secrets, user records, OAuth codes or account data were retrieved.
- Official provider documentation was consulted for target feed semantics and API families. Subscription terms, redistribution rights, credentials, endpoint entitlements and operational quotas were not validated. Rates asserted in legacy comments are not a current service contract.
- No application code, database schema, production configuration or package management changed. ATD-005's uncommitted report is inherited work and remains unchanged.

## Current source and integration inventory

| Source | Current purpose and representative consumers | Access / response handling | Migration disposition |
|---|---|---|---|
| Finnhub | Quotes, company profile/metrics, candles, earnings/news/sentiment; `analysis-central.html:6990`, `options-hub.html:3572`, `js/price-fetcher.js:88`, `trading-command.html:7174` | Browser key query parameters in legacy calls. Pages loading `js/market-data.js:58` intercept matching fetch URLs and POST `{path,query}` with user JWT to `arowana-research`. Returned provider shape remains unchanged. Local no-key gates can still stop calls before interception. | Transitional adapter only where approved. Normalize quote event time and feed; replace call sites with explicit Hub calls. Do not expand global fetch interception. |
| Twelve Data | Quote/time-series and valuation inputs; `js/strategy-analyzers.js:58`, `intrinsic-value.html:6594`, `position-sizer_fresh.html:1854` | Direct browser `apikey`; time series mapped from `values` newest-first into ascending bars. Central and alternate key aliases coexist. Remaining credential-like literal in `js/option-roll-analyzer.js:9` is tracked in ATD-002. | Legacy bridge only; private key migration required. Bars must preserve adjustment/session/timezone and history completeness. |
| FMP | Statements, valuation, earnings, quotes and historical closes; `intrinsic-value.html:6642`, `analysis-central.html:7905`, `options-hub.html:3452` | Browser credentials; legacy `/api/v3` and `/stable` coexist. Options Hub attempts stable daily history, legacy history, then Alpha Vantage. | Target fundamentals/estimates adapter. Pin endpoint versions, units and fiscal periods; do not assume the legacy API matches stable responses. Prices remain a separately selected feed. |
| Alpha Vantage | Daily bars, quote, overview, earnings/indicators; `js/strategy-analyzers.js:67`, `intrinsic-value.html:6684`, `weekly-swing-trade-post.html:291` | Browser keys; function-selected query endpoint. HTTP 200 may contain `Note`/`Information` rather than a series; some consumers handle this explicitly. | Legacy fallback subject to approved capability/entitlement parity. No silent switch from full to compact history or between adjusted and unadjusted series. |
| Yahoo Finance | Earnings/quote lookups and navigation links; `earning-watcher.html:204`, `weekly-swing-trade-post.html:277`, watchlist links | Direct query endpoint references coexist with ordinary chart links. An external link is not an ingestion adapter. | Do not make an undocumented Yahoo query route a canonical dependency. Preserve deliberate research links separately. |
| Supabase | Auth, private records, market/result caches, configuration and server API | Browser SDK/REST plus deployed Edge Functions. Source and actual schema diverge in places; see ATD-005. Supabase is a storage/access boundary, not proof of an upstream market source. | Keep target backend role; schema-qualified contracts, RLS, provenance and migrations required. |
| n8n / configurable webhooks | Morning Brief, scans, research, AI, summaries and notifications; `js/app-config.js:267`, `ai-morning-brief.html:2188` | Multiple aliases and storage overrides; some flows send provider headers or user JWTs. Payload/response variants are embedded in pages; workflow implementations are not versioned here. | Server-owned orchestration behind authenticated, versioned jobs. No arbitrary destination or client key forwarding. Workflow output must identify original providers and engine versions. |
| OpenAI / Anthropic | Coach and narrative analysis, not deterministic market facts | Deployed coach uses server auth/quota per ATD-005; legacy direct Anthropic calls lack API credentials and other paths contain removed placeholders. | Narrative layer consumes immutable fact snapshots and cites record IDs. Never fills missing prices, Greeks, financials or positions. |
| TradingView | Embedded charts and deep research/navigation | External presentation/tool surface; not an established machine-readable source contract. | Preserve chart handoff; do not scrape widgets as a fallback feed. |
| Schwab | OAuth callback shell, later broker holdings/balances | `schwab-callback.html:65` sends code/state to relative `/functions/v1/schwab-auth-callback`; no matching deployed slug in ATD-005. Routing and server implementation unverified. | Later read-only adapter. No order submission contract; no current working connection claimed. |
| Manual / CSV / browser journal | User trade records, valuations, account labels and cash; `js/journal-sync.js`, `js/holdings-source.js:43` | Browser storage is legacy journal authority; Supabase mirror; aggregation groups long positions by symbol/account label and skips shorts. Imported/manual values lack uniform provenance. | Preserve data with explicit manual/import provenance. Reconcile to canonical account IDs and private records; never sum mirror and source as separate holdings. |

## Target provider capability decisions

| Target | Initial contract coverage | Conditions before enabling |
|---|---|---|
| Alpaca | Equity quote/trade/bar and option quote/chain adapters | Explicit stock feed and option feed, timeframe/session/adjustment rules, history availability and user redistribution rights. IEX and SIP have different coverage; indicative option data is not OPRA. [Market Data FAQ](https://docs.alpaca.markets/us/docs/market-data-faq), [option quote feed definitions](https://docs.alpaca.markets/us/reference/optionlatestquotes). |
| FMP | Statements, ratios, analyst consensus/estimates, earnings events and corporate actions as separately verified capabilities | Validate selected stable endpoints and licensed history. Retain fiscal period and estimate snapshot time; do not treat a current estimate as historical revision evidence. [FMP quickstart](https://site.financialmodelingprep.com/developer/docs/quickstart). |
| FRED | Macro series observations and vintage-aware retrieval | Series catalog with unit/frequency/seasonal-adjustment metadata; retain realtime/vintage periods. Current revised observations must not leak into a past backtest. [FRED realtime periods](https://fred.stlouisfed.org/docs/api/fred/realtime_period.html), [observations](https://fred.stlouisfed.org/docs/api/fred/series_observations.html). |
| SEC EDGAR | Filing metadata, accession-linked XBRL facts and document links | CIK identity mapping; context/unit/period/amendment handling; identified server requests under SEC access guidance. Data APIs have no API-key requirement and do not support browser CORS. [SEC API documentation](https://www.sec.gov/search-filings/edgar-application-programming-interfaces). |
| Schwab | Broker account, position, balance and transaction snapshots, read-only later | Approved OAuth scopes, callback/state validation, stable account mapping, reconciliation and freshness. No execution permissions. |

Alpaca, FRED and SEC calls were not identified as implemented first-party acquisition paths by this inventory. Mentions in architecture are not implementation evidence. Provider acceptance testing and commercial decisions remain open; this task does not purchase subscriptions or authorize redistribution.

## Functional consumers and canonical datasets

| Consumer group | Needed Hub datasets | Current overlap / migration concern |
|---|---|---|
| Trading Command / Morning Brief | Quote/bars, calendar, market snapshot, engine results, private portfolio snapshot | Duplicate command pages and workflow-backed briefs; must share fact snapshot IDs and freshness. |
| Trader / AI Coach / Market Intelligence | Deterministic facts and private context references | AI narrative is downstream; reject invented or unsupported numeric claims. Retired Market Intelligence redirect is not a market engine. |
| Portfolio / Watchlist / Position Sizer | Private positions/cash, account IDs, quotes, validated risk inputs | Several journals and portfolio tables compete. Cached local user IDs and empty anon results are not verified account state. |
| Journal / Options Journal / Master Journal | Trade events, lots, options contracts, manual marks, account ownership | `tj_stocks/tj_options` JSON mirror versus `journal_trades/trading_journal/option_chains`; explicit mapping, deduplication and reconciliation required. |
| Options Hub / Wheel | Underlying quotes, full contract identity, bid/ask, OI/volume, IV/Greeks, earnings/dividends | Historical volatility/rank must remain distinct from implied volatility/rank. Wheel-focused external repository remains an uninspected future source. |
| Technical scanners | Complete bars, exchange calendar, indicators with input revisions | Daily-bar approximations cannot be presented as measured intraday VWAP/POC. Proper volume-at-price requires suitable trade data or a clearly labeled approximation. |
| Fundamental/quality screens | Point-in-time statements, metrics, estimates, sector classification | Different provider fields and units are currently mixed inside HTML. Missing values must not pass screens as zero. |
| Intrinsic valuation / long-term planning | Financial facts, assumptions, corporate actions, user contributions | User growth/discount assumptions must be separate from measured facts; demo fields must never inherit a live price label. |

## Concrete fragmentation and integrity findings

1. **Quote metadata is discarded.** `js/price-fetcher.js:96` recognizes Finnhub's timestamp field, but returns only numeric `c` at line 100. Retrieval time elsewhere cannot replace the quote event time.
2. **Cache identity is incomplete.** `js/strategy-analyzers.js:80` caches by symbol for four hours; feed, provider, adjustment and user entitlement are not encoded in that key. Options Hub separately caches quotes for five minutes and RV rank for 24 hours (`options-hub.html:3521`, `:3567`). No common freshness rule exists.
3. **History depth changes with fallback.** Twelve Data versus Alpha Vantage compact data may yield different usable lookbacks. Engine preconditions must declare minimum bars and completed sessions; a fallback is not success merely because it returned an array.
4. **Rate limits are scattered assumptions.** `js/app-config.js:617`/`:628` carries local rate constants. `js/price-fetcher.js:47` delays 120 ms between requests; sustained pacing at that interval is roughly 500/minute, not the comment's claimed compliance with 60/minute. Real server quotas must govern all concurrent users and workflows.
5. **Live/demo contamination exists.** `ai-valuation.html:509` builds demo fundamentals, overlays a possible live price, then announces live data at line 517. This path cannot become a trusted valuation input. A successful fetch is not a complete live dataset.
6. **Holdings can falsely appear empty.** `js/holdings-source.js:98` falls back to anon bearer; its comment acknowledges owner RLS can return an empty result. Missing authentication and a verified zero-position account need different statuses. Aggregation by account label must migrate to immutable IDs.
7. **A server proxy is not yet normalization.** The Finnhub shim passes provider-shaped results through. It applies only where loaded, and does not cover other providers or remove upstream client-side key gates.
8. **Backend source and contracts are missing from Git.** ATD-005 found deployed services and 122 migrations, but the checkout has neither implementations nor migrations. Read-only review of selected deployed functions does not reconstruct n8n pipelines or broker connections.
9. **Schema mismatches are known.** Daily Bias/sector sentiment tables and some columns do not match live metadata; retirement sync is a stub. `arowana.portfolio_options` is intentionally selected through schema headers. See ATD-005 rather than inventing replacements based on similar names.
10. **Licensing and provenance are independent.** Platform plan names, a working API key, or a public Supabase cache do not establish redistribution permission. A delayed/indicative/single-exchange feed must remain labeled throughout engines and UI.

## Supabase and workflow boundary mapping

Existing relation names remain legacy storage adapters; this task does not rename or create them. Future dataset contracts use logical names until a reviewed schema migration is assigned.

| Logical contract | Existing evidence | Required mapping |
|---|---|---|
| Private account registry | `arowana.entities`, `arowana.financial_accounts` | Preserve owner IDs; enforce same-owner parent relationship identified in ATD-005. |
| Private watchlists | `public.watchlists`, `watchlist_items` | Resolve permissive ownership alternatives before new consumers rely on them. |
| Positions/trades/cash | Journal families, `portfolio`, `arowana.portfolio_options`, `user_cash_balances` | Canonical source per account, migration manifest, immutable external IDs and conflict reporting. |
| Market observations | `market_snapshots`, `daily_setups` | Original provider/feed, observed time, trading session, revision, completeness and entitlement; table presence alone establishes none of these. |
| Derived outputs | `cc_candidates`, `csp_candidates`, `ap_roll_coach`, `ai_briefs` | Input snapshot IDs, engine/schema versions, calculation time and status. Separate generated facts from user edits. |
| Usage | `ap_usage`, `ap_provider_calls`, restricted usage RPCs | Server-side metering; retain existing privilege boundaries and verified identity. |
| Workflow jobs | n8n aliases, Edge routes and page overrides | Registry-owned destination; authenticated internal job requests; idempotent result ingestion; no public arbitrary URL field. |

## Migration sequence and review decisions

1. Approve the proposed contract and provider/feed entitlements, including beta-user access and shared-project versus separate-project boundary.
2. Resolve ATD-002 secrets and ATD-005 ownership blockers through separately assigned remediation. Preserve old user data and recovery copies; do not mass-delete legacy storage.
3. Establish versioned DEV backend/migrations and synthetic fixtures. Add one approved quote/bar adapter and a narrow consumer compatibility layer before broad page migration.
4. Add private portfolio reconciliation, fundamentals/estimates, macro and filings in reviewed slices. Move deterministic engines behind snapshot contracts before wiring AI summaries.
5. Retire legacy provider/workflow paths only after parity and error-state checks; keep rollback inside the secure server boundary.

Owner decisions: licensed Alpaca stock/options feeds; FMP endpoint/history availability; distribution scope; initial instrument universe; freshness policies; canonical account/journal model; point-in-time history needs; approved n8n owners/destinations; retention and deployment boundary. No raw credentials are needed to answer these.

Recommended next existing Phase 0 task: **ATD-003 — Canonical navigation map**, after reviewing this contract. ATD-101 implementation remains gated on security remediation, provider decisions and an approved contract. No follow-on work started.

## Verification

Completion checks passed: `python -B scripts/check-secrets.py` (limited existing patterns; ATD-002 finding remains), `git diff --check`, exact 206-file coverage (153 signal files and 53 without matches), referenced source paths/line bounds, JSON example parsing and freshness/status invariants, known credential/JWT redaction, unchanged ATD-005 report SHA-256, required branch, and documentation-only changed-file comparison. Application HTML/JS/CSS/JSON remains unchanged from `47fe1ca`. No live provider, broker, workflow or database requests were issued in this task. Official documentation browsing does not validate account entitlements. Prior audit reports remain unchanged.

## Appendix — Full first-party source coverage

Searched 206 first-party HTML/JS/JSON files. 153 files have provider/integration signals; 53 have none under these patterns. Signals include comments, labels, copied navigation and links, not just network calls. Line numbers are navigation evidence, not executed-call counts. Dynamic server workflows are not inferred from strings. Supabase vendor code is excluded from custom-logic counts.

Provider/group file counts: Finnhub 52, Twelve Data 20, FMP 9, Alpha Vantage 18, Yahoo 5, Supabase 105, Workflow 80, AI 34, TradingView 14, Schwab 14, Target-source signals 1. Counts overlap.

| File | Source signals (line numbers) |
|---|---|
| `about.html` | Finnhub: 169; AI: 169 |
| `account.html` | Finnhub: 1386, 1412, 1527, 1937, 1943, 1944; FMP: 1386, 1412; Alpha Vantage: 1386, 1412, 1527; Supabase: 1374, 1381, 1414, 1419, 1423, 1425, 1427, 1428, 1438, 1441, 1447, 1452, 1456, 1457, 1459, 1499, 1511, 1517, 1521, 1526, 1530, 1531, 1544, 1556, 1559, 1566, 1582, 1589, 1610, 1612, 1613, 1618, 1625, 1627, 1727, 1731, 1912, 1913, 1923, 1929, 2069, 2073, 2078, 2257, 2360; Workflow: 1414, 1425, 1633, 2246; AI: 1386, 1412, 1940 |
| `admin-usage.html` | Supabase: 132, 143 |
| `admin.html` | Supabase: 545, 553, 554, 558, 560, 569, 570, 589, 591, 592, 600, 615, 1269; Workflow: 73, 194, 209, 215, 218, 226, 235, 236, 240, 244, 245, 246, 249, 250, 393, 394, 396, 397, 409, 410, 429, 430, 574, 656, 677, 680, 693, 694, 696, 700, 701, 702, 706, 707, 708, 710, 711, 722, 733, 741, 744, 745, 755, 757, 762, 765, 766, 769, 776, 782, 783, 786, 788, 792, 802, 808, 809, 810, 953, 958, 960, 963, 973, 1050, 1052, 1053, 1061, 1064, 1065, 1067, 1075, 1078, 1088, 1094, 1095, 1096, 1098, 1100, 1103, 1105, 1108, 1110, 1111, 1114, 1115, 1116, 1120, 1121, 1123, 1126, 1131, 1132, 1272, 1273, 1274, 1275, 1276, 1293 |
| `advanced-trading-tools.html` | Supabase: 4406 |
| `ai-moat-finder.html` | Finnhub: 4804, 4969, 4987, 4988, 5004, 5010, 5011, 5064, 5097, 5124; Supabase: 5300; Workflow: 4956, 4957, 5124, 5269, 5270; AI: 1716; TradingView: 5127 |
| `ai-morning-brief.html` | Supabase: 1752, 1855, 1884, 1915, 1916, 2080, 2104, 2106, 2107, 2110, 2112, 2113, 2116, 2130, 2192, 2402; Workflow: 1732, 1826, 1904, 1907, 1909, 1911, 1912, 1914, 1915, 1919, 1920, 2084, 2088, 2104, 2106, 2140, 2141, 2142, 2186, 2188, 2204, 2205, 2223, 2229, 2256, 2257, 2281, 2303, 2320; AI: 2305 |
| `ai-trading-agent.html` | Supabase: 291; Workflow: 310, 311, 314, 348; AI: 372 |
| `ai-valuation.html` | Twelve Data: 164, 485; FMP: 165, 486, 512; Alpha Vantage: 166, 487; Supabase: 323, 324, 325; TradingView: 473 |
| `analysis-central.html` | Finnhub: 2950, 5318, 5594, 5824, 5826, 5861, 5878, 5911, 5937, 6070, 6129, 6522, 6547, 6562, 6586, 6588, 6599, 6601, 6757, 6759, 6955, 6956, 6957, 6969, 6990, 6994, 6998, 7002, 7039, 7078, 7081, 7083, 7086, 7101, 7102, 7138, 7169, 7170, 7171, 7176, 7185, 7202, 7204, 7386, 7388, 7389, 7420, 7664, 7757, 7765, 7848, 7849, 7874, 7875, 7876, 7879, 7880, 7883, 7884, 7885, 7893, 7896, 7969, 7970, 8030, 8035, 8040, 8046, 8052, 8053, 8054, 8160, 8161, 8166, 8167, 8185, 8190, 8195, 8212, 8213, 8273, 8277, 8278, 8294, 8295, 8297, 8298, 8300, 8309, 8344, 8345, 8373, 8376, 8377, 8378, 8379, 8423, 8437, 8440, 8447, 8448, 8450, 8452, 8453, 8457, 8459, 8460, 8495, 8504, 8507, 8508, 8509, 8510, 8512, 8528, 8563, 8567, 8572, 8577, 8582, 8595, 8599, 8874, 9129, 9340, 9343, 9347, 9989, 10011, 10967, 10984; Twelve Data: 6522, 6536, 7031, 7161, 9991, 9994, 10020, 10024, 10025, 10027, 10056, 10057, 10065, 10067, 10106; FMP: 5703, 6522, 6536, 6555, 6556, 7901, 7902, 7904, 7905, 7907, 7911, 7919, 7933, 7935, 7942, 7949, 7955, 7958, 7960, 7964, 7966, 7973, 7974, 7981, 7982, 7983, 7986, 8040, 8042, 8046; Alpha Vantage: 5878, 5937, 5976, 6208, 6522, 6536, 6551, 6552, 6599, 6601, 6602, 7030, 7105, 7106, 7108, 7110, 7114, 7134, 7135, 7140, 7161, 7171, 7172, 7991, 7992, 7993, 7996, 7998, 8003, 8006, 8040, 8054, 8056, 8058, 8274, 8278, 8316, 8319, 8322, 8325, 8338, 8347, 8348, 8377, 8379, 8381, 8438, 8464, 8467, 8469, 8470, 8473, 8475, 8477, 8478, 8505, 8508, 8510, 8512, 8549, 8556, 8558, 8641, 8642, 8654, 8672, 8679, 8680, 8716, 8833, 8854, 8958, 8961, 9994, 10020, 10033, 10034, 10037, 10060, 10061, 10065, 10067, 10107, 10109; Supabase: 45, 47, 6391, 6392, 6393, 6394, 6448, 6515, 6643, 6705, 6708, 6715, 6716, 6717, 6723, 6724, 6729, 6730, 6738, 6739, 6740, 6741, 6742, 6751, 6786, 6787, 6792, 6793, 6796, 6809, 6814, 9226, 9331, 9390, 9420, 9421, 9423, 9426, 9432, 9434, 9440, 9445, 9469, 9470, 9471, 9475, 9476, 9485, 9487, 9488, 9498, 9500, 9501, 9871, 11392, 11419; Workflow: 6708, 6715, 6716, 6717; Schwab: 9932 |
| `api-diagnostics.html` | Finnhub: 83, 134, 152, 153, 154, 163, 164, 165, 168, 174, 175, 176, 188, 189, 193, 337; FMP: 83, 85, 136, 206, 207, 208, 211, 337, 489; Alpha Vantage: 83, 84, 135, 214, 224, 225, 227, 232, 337, 493; Supabase: 63, 66, 137, 245, 247, 251, 252, 253, 254, 255, 277, 328, 634; Workflow: 251 |
| `arowana-template.html` | Twelve Data: 385, 387, 392; Supabase: 336, 476, 478, 497, 505, 521 |
| `arowana-trader.html` | Finnhub: 952, 1735, 1739, 1845, 1846, 1847, 1849, 1852, 1883, 1884, 1886, 1889, 1905, 1906, 1907, 1921, 1925, 1945, 1947, 1957, 1962, 1966, 2879, 2880, 2881, 2884, 2892, 3173, 3190; Supabase: 974, 986, 994, 995, 1045, 1046, 1047, 1120, 1128, 1135, 1168, 1240, 1319, 1412, 1419, 1431, 1432, 1433, 1714, 1728, 1729, 1735, 1737, 1813, 1818, 1905, 2321, 2333, 2341, 3005, 3007, 3598, 3625; Workflow: 992, 993, 996, 997, 1000, 1045, 1570, 1735, 1738, 1814, 1822, 1833, 1836, 1837, 1838, 1840, 1877, 2321, 2768, 3005 |
| `atr-stop-planner.html` | Finnhub: 5296; FMP: 5268, 5296, 5303, 5304, 5305, 5328; Supabase: 5235; AI: 1717; TradingView: 5248 |
| `automated-trading-plan.html` | Workflow: 424, 635, 636 |
| `base-breakout .html` | Supabase: 236, 237, 238; Workflow: 78, 171, 174, 257, 258, 260, 331, 335 |
| `base-breakout.html` | Supabase: 282, 283, 284; Workflow: 79, 215, 217, 218, 303, 304, 307, 372, 376 |
| `bb-snapback.html` | Supabase: 223, 224, 225; Workflow: 156, 159, 244, 246, 320 |
| `billing.html` | Supabase: 633, 635, 637, 638, 662, 805, 975, 978; Workflow: 635, 781, 789 |
| `broker-connections.html` | Supabase: 357; Workflow: 316, 317, 318; Schwab: 153, 156, 200, 207, 257, 259, 264, 266, 289, 296, 303, 316, 317, 319 |
| `buy-sell-signal.html` | Supabase: 345, 507, 515, 516, 546; Workflow: 406, 407, 408, 602, 613, 615, 616, 618, 620, 624, 629, 689, 690, 722; TradingView: 179, 223, 227, 312, 314, 583, 586, 590, 609, 681, 716 |
| `chart-analysis-form.html` | Supabase: 624, 724; Workflow: 194, 195, 196, 478, 480, 481, 672, 722, 724, 726, 727, 728, 732, 750, 847, 850, 851, 891, 895, 898, 900, 1066, 1071, 1176, 1177, 1183, 1184; TradingView: 342 |
| `checkout.html` | Supabase: 713, 715, 717, 718, 872, 875, 890, 1059, 1062; Workflow: 715, 873, 941 |
| `contact.html` | Supabase: 261 |
| `cover-call-option-recommentor.html` | Workflow: 9, 10, 19, 29, 35; AI: 29 |
| `credit-spread-planner.html` | Finnhub: 4927, 5241, 5242, 5243, 5244, 5254, 5256, 5260, 5265; Supabase: 5154, 5156, 5524; AI: 1717 |
| `daily-bias.html` | Supabase: 360, 474; Workflow: 357, 577, 585 |
| `daily-summary.html` | Workflow: 88, 104, 105, 174, 186, 284, 313 |
| `dashboard.html` | Supabase: 1066 |
| `data-hygiene-audit.html` | Schwab: 215, 321, 322 |
| `day-trade-scanner.html` | Workflow: 212, 355, 372; TradingView: 213 |
| `daytrade.html` | Workflow: 218, 224, 225, 278, 340, 352 |
| `dcf-analyzer.html` | Finnhub: 5238, 5264, 5265, 5270, 5271, 5276, 5291, 5296; Supabase: 5215; AI: 1716 |
| `discipline-scorecard.html` | Supabase: 5042; AI: 1720 |
| `dividend-screener.html` | Supabase: 272, 273, 274, 332, 344, 552 |
| `dividend-tracker.html` | Finnhub: 5015, 5022, 5032, 5035, 5036, 5053, 5054, 5061, 5062, 5199, 5205, 5210, 5525; Supabase: 5507; Workflow: 4851, 4870, 4878, 4905, 4906, 5138, 5148, 5152, 5180, 5185, 5192, 5193, 5195, 5196, 5199, 5200, 5226; AI: 1716 |
| `earning-watcher.html` | Yahoo: 204 |
| `etf-core-screener.html` | Schwab: 99 |
| `expectancy-matrix.html` | Supabase: 4915, 4916, 5056; AI: 1717 |
| `features.html` | Supabase: 742; Schwab: 592 |
| `gap-and-go.html` | Supabase: 555, 557, 576, 584, 601 |
| `gap-fade-scanner.html` | Workflow: 264, 358, 374, 377 |
| `guide-claude-tradingview-windows.html` | AI: 345, 749, 750, 831; TradingView: 6, 7, 8, 12, 13, 241, 245, 263, 265, 272, 274, 300, 306, 308, 337, 357, 359, 365, 372, 374, 375, 382, 387, 397, 401, 407, 414, 415, 416, 430, 433, 444, 518, 533, 534, 569, 578, 582, 584, 600, 704, 707, 712, 720, 724, 749, 755, 756, 760, 762, 763, 770, 771, 811, 831 |
| `high-shortfloat-screener.html` | Finnhub: 165; Twelve Data: 165 |
| `hod-scanner.html` | Workflow: 228, 332, 352, 361 |
| `index.html` | Supabase: 373, 415, 449 |
| `intraday-breakout.html` | Twelve Data: 396, 399, 404; Supabase: 607, 609, 628, 636, 652 |
| `intrinsic-value-rsi.html` | Alpha Vantage: 131, 323 |
| `intrinsic-value.html` | Finnhub: 5673, 5829, 6796, 6797, 6819, 6889, 6890, 6892, 6898, 6899, 6900, 6901, 6902, 6908, 6909, 6911, 6915, 6916, 6918, 6921, 6975, 6993, 6995, 7060, 7085, 7114, 7148, 7153, 7172, 7209, 7246, 7247, 7248, 7502, 7519; Twelve Data: 6574, 6589, 6594, 6911; FMP: 5809, 5814, 5816, 6575, 6637, 6639; Alpha Vantage: 6576, 6678, 6681, 6696, 6911; Supabase: 6880, 6881, 7265, 7285, 7289, 7292, 7927, 7954; AI: 1715 |
| `iv-watchlist-module.html` | Finnhub: 473 |
| `js/account-registry.js` | Supabase: 8, 19, 125, 128, 134, 189, 266, 273, 282, 290, 297, 352; Schwab: 367 |
| `js/app-config.js` | Finnhub: 84, 342, 422, 615, 616; Alpha Vantage: 86, 342, 626, 627; Supabase: 3, 8, 37, 41, 58, 59, 70, 75, 91, 92, 93, 94, 101, 102, 108, 109, 110, 111, 115, 116, 117, 121, 126, 133, 140, 147, 154, 161, 167, 343, 344, 348, 355, 383, 384, 387, 390, 403, 424, 455, 456, 464, 465, 466, 473, 481, 506, 508, 514, 520, 523, 528, 529, 531, 532, 537, 539, 541, 542, 546, 548, 555, 559, 564, 569, 575, 589, 592, 606, 642, 651, 654, 657, 668, 669, 670; Workflow: 3, 42, 62, 63, 180, 181, 183, 184, 185, 186, 187, 188, 191, 192, 193, 196, 197, 198, 201, 260, 262, 267, 276, 277, 278, 281, 295, 301, 586, 588, 589, 592, 595, 596, 598, 601, 604, 607, 608, 610, 612, 613, 640, 641, 646, 652, 653; AI: 623 |
| `js/auth-guard.js` | Finnhub: 77 |
| `js/auth-header.js` | Supabase: 2, 138, 157, 162, 179, 309 |
| `js/bottom-nav.js` | Supabase: 22, 23 |
| `js/config.json` | Supabase: 3, 4; Workflow: 7, 8, 9 |
| `js/dividend-screener.js` | Workflow: 19 |
| `js/holdings-source.js` | Supabase: 27, 28, 89 |
| `js/invest-helper-logic.js` | AI: 166 |
| `js/journal-sync.js` | Supabase: 10, 16, 20, 44, 66, 87, 91, 94, 106, 129, 134, 135, 155, 156, 157, 158, 159, 160, 163, 170, 227, 232, 236, 487, 696, 782, 814, 983; Workflow: 135, 158 |
| `js/market-data.js` | Finnhub: 4, 6, 60; Supabase: 10, 17, 21 |
| `js/nav-rail.js` | Finnhub: 97, 114; Supabase: 522, 549 |
| `js/option-roll-analyzer.js` | Twelve Data: 8, 19; Workflow: 58, 64 |
| `js/plan.js` | Supabase: 8, 72, 78, 90, 91, 92, 118; Workflow: 6, 70, 90 |
| `js/price-fetcher.js` | Finnhub: 6, 12, 22, 25, 29, 46, 52, 62, 88, 96; Supabase: 15, 111 |
| `js/risk.js` | Supabase: 9, 36, 37, 38, 39; Workflow: 37, 38, 39 |
| `js/scanner-defs.js` | Finnhub: 10, 32, 35, 57, 59, 89, 131, 160; Supabase: 16; Workflow: 16 |
| `js/scanners.js` | Finnhub: 21, 78, 82, 85, 91; Supabase: 109; Workflow: 109, 112, 114 |
| `js/session-user.js` | Finnhub: 138; Supabase: 21, 49, 53, 54, 55, 145 |
| `js/setup-scorecard.js` | Finnhub: 24, 25, 113, 118, 124, 347, 348, 448, 462, 465, 466, 467; Twelve Data: 36; Alpha Vantage: 36 |
| `js/setup-scorecard_v9.js` | Finnhub: 24, 25, 113, 118, 124, 347, 348, 448, 462, 465, 466, 467; Twelve Data: 36; Alpha Vantage: 36 |
| `js/strategy-analyzers.js` | Finnhub: 10, 44; Twelve Data: 12, 15, 53, 57, 58, 60, 89, 90, 98, 100, 139; Alpha Vantage: 15, 32, 53, 66, 67, 70, 93, 94, 98, 100, 140, 142, 359 |
| `js/strategy-analyzers_v1.js` | Finnhub: 10, 32; Twelve Data: 12, 15, 41, 45, 46, 48, 77, 78, 86, 88, 127; Alpha Vantage: 15, 41, 54, 55, 58, 81, 82, 86, 88, 128, 130 |
| `js/supabase-init.js` | Supabase: 1, 2, 4, 5, 7, 8, 9, 13, 24, 30, 31, 33, 36, 41, 49, 50 |
| `kelly-calculator.html` | Supabase: 5059; AI: 1716 |
| `lap-pullback.html` | Workflow: 143, 144, 170, 182 |
| `learn-investing.html` | Supabase: 410 |
| `login.html` | Supabase: 716, 774, 775, 778, 779, 780, 783, 784, 785, 786, 796, 797, 905, 989, 1000, 1205 |
| `long-term-dashboard.html` | Twelve Data: 2084, 2490, 2492, 2493, 2494, 2495, 2497, 2499, 2502, 2505, 2517, 2534, 4414, 4415, 4416, 4424, 4427, 4436; Supabase: 3525, 3998, 4419; Workflow: 2087, 2088, 2089, 2227, 2447, 2674, 2677, 2678, 2810, 2811, 2815, 2831, 2839, 2975, 2976, 3174, 3195, 3196, 3230, 3231, 3237, 3322, 3324, 3354, 3364, 3391, 3398, 3399, 3400, 3402, 3523, 3525, 3527, 3528, 3529, 3719, 3721, 3731, 3738, 3757, 3840, 3849, 3851, 4322, 4418, 4419, 4420, 4421, 4425, 4440, 4441, 4442, 4449, 4852, 4854, 4855 |
| `long-term-portfolio.html` | Finnhub: 229, 235, 378, 514, 516, 517, 518, 523, 527, 531, 632, 695, 697, 707, 720; Supabase: 404, 405, 577, 697, 709; Workflow: 229, 377, 566, 570, 640, 708, 709, 711, 715, 718, 720, 732 |
| `long-term-watchlist.html` | Yahoo: 385 |
| `market-intelligence.html` | Finnhub: 9 |
| `master-journal.html` | Supabase: 498, 901 |
| `momentum-hunter-complete.html` | Finnhub: 612, 1317, 1320, 1488, 1500, 1611, 1696, 1743, 1749, 1953, 1954, 1957, 1964, 2008, 2211, 2215, 2253, 2254, 2272, 2300, 2318, 2329, 2330, 2335, 2336, 2408, 2453; Supabase: 12, 13, 15, 1744; Workflow: 1337, 1774, 1783, 1785, 1795, 2008, 2033, 2037, 2046, 2052, 2078, 2081, 2172, 2355 |
| `momentum-hunter.html` | Finnhub: 608, 1287, 1290, 1656, 1695, 1859, 1860, 1863, 1870, 1914, 2113, 2117, 2155, 2156, 2190, 2191, 2204, 2238, 2239, 2252, 2280, 2281, 2286, 2287; Workflow: 1307, 1712, 1721, 1729, 1934, 1938, 1948, 1954, 1979, 1982, 2072 |
| `money-flow-alert.html` | Supabase: 4989, 4991, 4992, 5022, 5245; Workflow: 5073, 5193, 5195, 5198, 5199, 5221, 5223, 5227, 5228, 5244, 5252; AI: 1717; TradingView: 5074 |
| `my-watchlist.html` | Twelve Data: 83, 84, 138 |
| `news-trading.html` | Workflow: 410, 733, 737, 738 |
| `onboarding.html` | Supabase: 176, 189, 190, 191; Workflow: 190, 191; Schwab: 142 |
| `opening-drive.html` | Twelve Data: 464, 466, 471, 483; Supabase: 551, 570, 578, 594 |
| `option-recommender.html` | Workflow: 16 |
| `option-roll-analyzer.html` | Workflow: 216, 420, 425 |
| `option-roll-tracker.html` | Twelve Data: 659, 661, 666, 674; Supabase: 89, 91, 93, 95, 100, 106, 107, 108, 112, 113, 114, 748, 832, 1297, 1300, 1304, 1306, 1307, 1308, 1311, 1312, 1313, 1318, 1319, 1330, 1333, 1334, 1335, 1340, 1349, 1392, 1405, 1431, 1434, 1490, 1514, 1527, 1555, 1568, 1590, 1598, 1616 |
| `options-analyzer.html` | Finnhub: 4945, 4965, 5290, 5291, 5292, 5302, 5304, 5307, 5311, 5574, 5575, 5576, 5579, 5583, 5586; FMP: 5666, 5667, 5672, 5673; Supabase: 5596; AI: 1716 |
| `options-hub.html` | Finnhub: 3117, 3374, 3375, 3378, 3510, 3512, 3550, 3554, 3556, 3572, 3573, 3574, 3582, 3587, 3592, 3598, 3624, 3935, 3937, 3938, 3944, 3945, 3949, 3950, 3953, 4374, 4386, 7829, 7909, 7910, 7911, 7913, 7917, 7924, 7925, 7947, 8082, 8115, 8139, 8141, 8170, 8449, 8452, 8750, 8990, 9007; FMP: 3409, 3438, 3447, 3452, 3454, 3465, 3471, 3475; Alpha Vantage: 3399, 3402, 3413, 3430, 3438, 3439, 3475, 3479, 3488, 3493, 3503, 3514, 3516, 4023; Supabase: 4508, 4509, 4510, 4859, 4860, 4861, 5159, 5160, 5161, 6755, 6756, 6757, 7510, 7511, 7512, 8257, 8262, 8263, 8265, 8266, 8267, 8268, 8273, 8287, 8289, 8294, 8296, 8304, 8306, 8622, 8625, 8626, 8634, 8883, 9415, 9442, 9497; Workflow: 4509, 4510, 4860, 4861, 5160, 5161, 6756, 6757, 7511, 7512, 7958, 7960, 7976, 8265, 8267, 8268, 8625 |
| `overview.html` | Supabase: 805 |
| `pattern-scanner.html` | Finnhub: 247, 293, 295, 315, 350, 608; Alpha Vantage: 247, 293, 295, 315, 332, 335, 581, 582, 607; Supabase: 618 |
| `portfolio-advisor.html` | Finnhub: 786, 789, 1652, 1942, 1965, 1968, 1972, 1985, 1986, 2162, 2163, 2164, 2165, 2171, 2178, 2185, 2189, 2190, 2195, 2198, 2201, 2459, 2572, 2589; Supabase: 690, 1020, 1021, 1022, 1023, 1028, 1029, 1033, 1205, 1206, 1215, 1231, 1268, 1274, 2115, 2117, 2118, 2123, 2124, 2181, 2219, 2224, 2225, 2227, 2229, 2231, 2251, 2253, 2260, 2997, 3024, 3113, 3115; Workflow: 3113; AI: 1931, 2420 |
| `portfolio-command.html` | Finnhub: 5895, 5900, 6014, 6444, 6453, 6459, 6906, 6911, 6917, 6930, 6932, 6945, 7033, 7157, 7167, 7183, 7185, 7595, 9446, 9447, 9453, 9457, 9458, 9459, 9462, 9466, 9589, 9593, 9594, 9599, 9618, 9667, 9819, 9821, 9853, 9856, 9882, 10344, 12944, 12961; Twelve Data: 5943; Alpha Vantage: 5943; Supabase: 4893, 5406, 5407, 5408, 5734, 6122, 6166, 6169, 6170, 6178, 6291, 6428, 6437, 6439, 6447, 6452, 6467, 6488, 6564, 6580, 6811, 6830, 6835, 6837, 6838, 6853, 6861, 6874, 6885, 6889, 6890, 6898, 6899, 6900, 6901, 6902, 6918, 6924, 6976, 6977, 6979, 6981, 7015, 7020, 7036, 7045, 7057, 7061, 7062, 7091, 7290, 7353, 7373, 7390, 7468, 7481, 7489, 7494, 7502, 7507, 7636, 8279, 8323, 8646, 8647, 8650, 8652, 8688, 8696, 8712, 8714, 8717, 8855, 8861, 9459, 10537, 10560, 10569, 10591, 10592, 10593, 10595, 10597, 10605, 10630, 10647, 10649, 10650, 10665, 10667, 10669, 10677, 10710, 10734, 10771, 11458, 11467, 11546, 11552, 11568, 11579, 11941, 11956, 11957, 11960, 11962, 11968, 11973, 12025, 12041, 12056, 12060, 12077, 12078, 12085, 12124, 12145, 12156, 12172, 12175, 12192, 12698, 12721, 12728, 12741, 12743, 13369, 13396, 13475, 13477; Workflow: 5407, 5408, 5894, 6169, 6217, 6900, 6902, 9439, 9448, 9629, 9631, 9633, 9650, 9659, 9662, 9894, 11552; Schwab: 4463, 5206, 5673, 11501, 11538, 11578, 11586, 11649, 11651, 11653, 11672, 11676, 11780, 11836, 12171, 12180, 12299, 12320, 12607 |
| `position-sizer.html` | Supabase: 262, 263, 268, 312, 314; Workflow: 262, 312 |
| `position-sizer_fresh.html` | Twelve Data: 1841, 1845, 1847, 1854, 1871; Supabase: 2210, 3147; Workflow: 2035, 2036, 2037, 2067, 2109, 2168, 2171, 2173, 2264, 2265, 2393, 2397, 2413, 2421, 2606, 2804, 2825, 2826, 2869, 2954, 2956, 2986, 2996, 3023, 3030, 3031, 3032, 3034 |
| `post-earnings-drift.html` | TradingView: 275 |
| `pricing-revolutionary.html` | Finnhub: 534; Supabase: 638 |
| `pricing.html` | Supabase: 773, 784, 1021, 1024, 1076, 1095, 1096, 1097, 1098, 1114; Workflow: 1097, 1098; Schwab: 471 |
| `privacy.html` | Finnhub: 128, 148; Alpha Vantage: 128, 148; Supabase: 144, 148, 164; Workflow: 144, 148; AI: 148; Target-source signals: 148 |
| `quality-screener.html` | Workflow: 119, 124, 140, 141, 301, 316, 324, 443 |
| `r-multiple.html` | Supabase: 5225; AI: 1716 |
| `reset-password.html` | Supabase: 702, 760, 761, 764, 765, 766, 769, 770, 771, 772, 782, 783, 798, 799, 801, 856, 858, 865, 866, 871, 876; Workflow: 852 |
| `retirement-planner.html` | Supabase: 714, 715, 763, 769, 771; Workflow: 1914, 1915, 1917, 1918, 1919, 1941, 1942, 1952, 1971, 1973, 1975, 1978, 1983, 1991; AI: 1941 |
| `risk-comfort.html` | Supabase: 4983; AI: 1716 |
| `rsi-reversal-scanner.html` | Workflow: 266, 370, 385, 388 |
| `rvol-scanner.html` | Finnhub: 406, 443, 444, 702, 703, 704, 737, 738, 739, 742, 746, 749, 756; Twelve Data: 439, 450; Supabase: 504, 506, 523, 531, 547; Workflow: 560, 657, 670, 684 |
| `scalp-trading-screener.html` | Workflow: 6, 58, 78, 79, 87, 108, 109, 110, 114, 143, 268, 269, 319, 321, 322, 328, 330, 347, 349, 350, 465, 466, 467, 470, 483, 484, 507, 514, 516 |
| `scanner.html` | Supabase: 1448, 1449, 1452, 1774 |
| `schwab-callback.html` | Supabase: 28, 65; Schwab: 6, 19, 65, 77 |
| `sector-sentiment-gauge.html` | Supabase: 148, 149, 150, 362, 364, 365, 366, 369, 372, 373, 374, 392, 405; Workflow: 143 |
| `sector-sentiment.html` | Supabase: 150, 151, 152, 153, 266, 268, 269, 270, 274, 277, 278, 279, 365, 392; Workflow: 146 |
| `security.html` | Finnhub: 162, 173, 195; Supabase: 160, 162, 172, 174 |
| `settings.html` | Supabase: 1281, 1286, 1557, 1602; AI: 539, 542, 543, 1026 |
| `short-entry-screener.html` | TradingView: 333 |
| `short-squeeze-scanner.html` | Workflow: 255, 348, 361, 364 |
| `short-term-dashboard.html` | Finnhub: 2040, 4860, 4861, 4862, 4865, 4869, 4872; Twelve Data: 2588, 2592, 2594, 2601, 2618; Supabase: 2722, 3332, 3334, 3538, 3540, 3547, 3554, 3750, 3838, 4216, 4218, 4224, 4406; Workflow: 2544, 2548, 2553, 2594, 2720, 2722, 2724, 2725, 2726, 2727, 2793, 2794, 2795, 2825, 2899, 2958, 2961, 2963, 3013, 3048, 3083, 3085, 3126, 3139, 3332, 3333, 3343, 3345, 3510, 3595, 3597, 3601, 3602, 3610, 3616, 3624, 3859, 3860, 3865, 4063, 4084, 4085, 4128, 4216, 4220, 4223, 4224, 4242, 4249, 4254, 4275, 4284, 4289, 4290, 4291, 4293, 4506, 4620, 4622, 4623; TradingView: 2305, 3211 |
| `short-term-template.html` | Supabase: 1317, 1319, 1320 |
| `short-term-watchlist.html` | Finnhub: 343, 1289, 1293, 1300, 1305, 1310, 1311, 1335, 1337, 1342, 1438; Yahoo: 700; Supabase: 344, 500, 501, 505, 506, 515, 771, 1055, 1058, 1060, 1071, 1115, 1118, 1119, 1122, 1126, 1127, 1132, 1141, 1146, 1217, 1269, 1275, 1277, 1296, 1395, 1410, 1433, 1454; Workflow: 506, 1118, 1122, 1126 |
| `signup.html` | Supabase: 781, 807, 815, 822, 824, 825, 827, 828, 829; Workflow: 804, 807, 810, 815 |
| `sma-cross-scanner.html` | Finnhub: 242, 263, 265, 440, 497, 498, 499, 503, 508, 511, 562, 564, 565, 576, 725, 763, 795, 1179 |
| `stock-analyzer.html` | Supabase: 460, 485, 521, 556, 558, 561, 562, 569, 570, 655, 668, 676, 678, 685, 692, 699, 701, 717, 724, 728, 736; Workflow: 144, 323, 376, 378, 379, 383, 389, 400, 567, 577, 638, 641, 642, 643, 644, 645, 647, 650, 654, 655, 657, 661, 663, 734 |
| `stock-checker.html` | Workflow: 110 |
| `strategy-backtesting.html` | Finnhub: 5424, 5601, 5612, 5615, 5649, 5660, 5661, 5662, 5664, 5674, 5691, 5855, 6142, 6144, 6150; Supabase: 5259, 5304, 5305; Workflow: 6096, 6097; AI: 1717; TradingView: 5174 |
| `support.html` | Finnhub: 160; Alpha Vantage: 160; Schwab: 157 |
| `swing-trader.html` | Workflow: 216, 417, 592, 597, 598 |
| `tax-loss-harvester.html` | Supabase: 5254; AI: 1716 |
| `technical-analysis.html` | Finnhub: 4931, 4991, 4995, 5344, 5356, 5358, 5366, 5381, 5385, 5390, 5396, 5397, 5399, 5402, 5409, 5417, 5440, 5448, 5449, 5456, 5464, 5466, 5467, 5469, 5483, 5488, 5493, 5496, 5503, 5510, 5512, 5538, 5616, 5643, 5724; Alpha Vantage: 5410, 5456, 5458, 5473, 5475, 5476, 5478, 5483, 5492, 5508, 5509, 5515, 5519, 5528, 5723, 5724; Supabase: 5171, 5222, 5223, 5245, 5265; AI: 1717 |
| `test_webhook.html` | Workflow: 5, 8, 9, 14, 20, 24 |
| `tool-audit.html` | Finnhub: 5041; Supabase: 4855, 4885, 5098; AI: 1717 |
| `tools.html` | Finnhub: 4857; Supabase: 4924; AI: 1716 |
| `trade-ideas-ai.html` | Workflow: 114; AI: 114 |
| `trade-journal-pro.html` | Finnhub: 1691, 2671, 2674, 2693, 2695, 2697, 2701, 2721, 2724, 2736, 2750, 4375, 4380, 4381, 4391, 4655, 4665, 4731, 4761, 4763, 6213, 7117, 7134; Supabase: 2573, 2622, 4447, 4657, 6156, 6168, 6750, 6754, 6762, 6774, 6784, 6787, 6802, 6814, 6819, 6832, 6833, 6834, 6856, 6857, 6861, 6862, 6874, 6876, 6878, 6881, 7006, 7542, 7569, 8065, 9333, 9482, 9855, 10401; Workflow: 6834; Schwab: 1514, 3562, 6234, 6273, 8332, 8333, 8338, 8346, 8396, 8424, 8491, 8494, 8532, 8539, 8560, 8561, 8573, 8671, 8685, 8686, 8711, 8729, 8740, 8792, 8797, 8830, 8849, 8867, 8893, 8909, 9279, 9281, 9592, 10349, 10353 |
| `trade-journal.html` | Supabase: 1004, 1028, 1041, 1069, 1082, 1104, 1112, 1130 |
| `trade-plan-builder.html` | Finnhub: 617, 670, 673, 678, 681; Supabase: 561, 573, 574, 576, 791, 879, 919, 921; Workflow: 550, 551, 563, 565, 566, 573, 919 |
| `trade-scanner.html` | Workflow: 225 |
| `trading-command.html` | Finnhub: 5043, 5047, 5087, 5098, 5949, 5952, 5958, 5963, 5968, 6006, 6011, 6035, 6037, 6169, 6588, 6610, 6637, 7105, 7125, 7170, 7174, 7176, 7181, 7187, 7191, 7255, 7418, 7423, 8618, 8626, 8627, 8643, 8658, 8660, 8664, 8746, 8757, 8789, 8932, 9034, 9041, 9312, 9432, 9674, 9691; FMP: 5103, 5139, 5672, 5678, 5679, 5683, 5684, 5856, 5865, 5886; Supabase: 4526, 4527, 4528, 5282, 5626, 5631, 5632, 5636, 5639, 5935, 7005, 7007, 7068, 7223, 7226, 7229, 7230, 7256, 7260, 7262, 7786, 7787, 7907, 7914, 7983, 7985, 7986, 7989, 8008, 8014, 8033, 8036, 8037, 8043, 8049, 8192, 8287, 8289, 8555, 8566, 8603, 8807, 8822, 8827, 8831, 8853, 8856, 8911, 8922, 8923, 8924, 9419, 9567, 10099, 10126, 10212, 10228, 10229, 10230, 10307, 10308, 10309, 10423, 10489; Workflow: 4527, 5047, 5161, 6633, 6644, 6645, 6661, 6670, 6672, 7102, 7103, 7113, 7114, 7115, 7116, 7117, 7118, 7119, 7122, 7171, 7218, 7223, 7230, 7621, 7907, 7986, 7997, 8036, 8554, 8566, 8603, 8755, 8924, 10229, 10230, 10308, 10309; AI: 1778, 5284 |
| `trading-journal-analysis.html` | Supabase: 1327, 1371, 1372; Workflow: 1611, 2159, 2160 |
| `tradingcommand.html` | Finnhub: 4439, 4443, 4483, 4494, 5136, 5139, 5145, 5150, 5155, 5193, 5198, 5222, 5224, 5356, 5712, 5715, 5734, 5761, 6174, 6178, 6180, 6185, 6191, 6195, 6257, 6398, 6403, 7530, 7538, 7539, 7555, 7568, 7570, 7574, 7641, 7776, 8056, 8057, 8099; Supabase: 4221, 4222, 4223, 4740, 5090, 5093, 5094, 5102, 6037, 6039, 6083, 6227, 6230, 6233, 6234, 6258, 6262, 6264, 6383, 6743, 6744, 6864, 6871, 6940, 6942, 6943, 6946, 6965, 6971, 6979, 6980, 6987, 7114, 7209, 7211, 7477, 7488, 7651, 7666, 7671, 7675, 7697, 7700, 7755, 7766, 7767, 7768, 8086, 8224; Workflow: 4222, 4443, 4552, 5093, 5757, 5768, 5769, 5785, 5794, 5796, 6116, 6121, 6122, 6123, 6124, 6125, 6126, 6127, 6130, 6175, 6222, 6227, 6234, 6599, 6864, 6943, 6954, 6979, 7476, 7488, 7768; AI: 1677, 4742; Schwab: 4596 |
| `trendline-break.html` | Twelve Data: 522, 524, 529, 541; Supabase: 609, 628, 636, 652; Workflow: 682, 733, 795, 814 |
| `volatility-guardrails.html` | Supabase: 5024; AI: 1716 |
| `volume-spike.html` | Workflow: 86, 213, 340, 351; TradingView: 201, 215 |
| `vwap-pullback.html` | Workflow: 228, 330, 350, 359 |
| `watchlist.html` | Finnhub: 1351, 3626, 3630, 3637, 3642, 3647, 3648, 3672, 3674, 3679, 3912; Yahoo: 2114; Supabase: 1352, 1639, 1640, 1644, 1645, 1654, 1771, 1773, 2201, 3147, 3150, 3152, 3164, 3172, 3178, 3249, 3252, 3253, 3256, 3273, 3275, 3282, 3284, 3285, 3292, 3295, 3300, 3306, 3307, 3312, 3325, 3334, 3338, 3347, 3352, 3507, 3559, 3565, 3567, 3598, 3633, 3732, 3747, 3762, 3768, 3892, 3928; Workflow: 1645, 1771, 3252, 3256, 3306 |
| `weekly-swing-trade-post.html` | Alpha Vantage: 175, 176, 288, 291, 292, 293; Yahoo: 277; TradingView: 223, 224, 245, 315, 317, 318 |
| `whale-tracker.html` | Finnhub: 913, 1712, 1716, 1816, 1817, 1818, 1820, 1823, 1833, 1857, 1858, 1860, 1863, 1879, 1880, 1881, 1894, 1895, 1898, 1901, 1907, 2589, 2590, 2591, 2594, 2602; Supabase: 935, 944, 952, 953, 1003, 1004, 1005, 1078, 1086, 1093, 1126, 1198, 1277, 1370, 1377, 1389, 1390, 1391, 1691, 1705, 1706, 1712, 1714, 1784, 1789, 1879, 2069, 2081, 2089, 2750, 2752; Workflow: 950, 951, 954, 955, 958, 1003, 1547, 1712, 1715, 1785, 1793, 1804, 1807, 1808, 1809, 1811, 1851, 2069, 2516, 2750 |
| `wheel-strategy.html` | Supabase: 2045 |
| `wheel_strategy_web_tool.html` | Schwab: 23 |

Files with no matching signal:

`404.html`, `ai_valuation.html`, `asset-allocation-builder.html`, `assignment-risk.html`, `blog.html`, `buy-a-home.html`, `college-savings.html`, `daily-trading-post.html`, `dca-planner.html`, `discipline-checklist.html`, `disclosures.html`, `education-529-planner.html`, `ema-snapback.html`, `factor-tilt-planner.html`, `feature_body.html`, `feature_new.html`, `features-tools-directory.html`, `fee-analyzer.html`, `ips-builder.html`, `js/account-switcher.js`, `js/format.js`, `js/interface-mode.js`, `js/journal-context.js`, `js/journal-fields.js`, `js/portfolio-breadth.js`, `js/position-math.js`, `js/workspace-footer.js`, `long-term-intrinsic-value.html`, `my-rules-long.html`, `my-rules-short.html`, `my-rules.html`, `option-trader.html`, `options-hub-creator.html`, `options-journal.html`, `options-recommender.html`, `options-strategies.html`, `orb-scanner.html`, `pick-my-mix.html`, `portfolio-tracker.html`, `real-estate-analyzer.html`, `refunds.html`, `retirement-calculator.html`, `risk-calculator.html`, `risk-disclosure.html`, `risk-quiz.html`, `task-template.html`, `tax-advantaged-guide.html`, `template.html`, `template_new.html`, `terms.html`, `updated-navigation.html`, `wheel-calculator.html`, `withdrawal-planner.html`.
