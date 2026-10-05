# ATD-009 — Legacy page review (keep / merge / retire)

Status: **owner-approved 2026-10-03, including the recommendations for Q1–Q5 (section 4); documentation only; nothing changed, moved, redirected or deleted by this document**. Date: 2026-10-03. Branch: `claude/ATD-009-legacy-page-review`. Baseline: `origin/main` at `33af7e8` (ATD-008 complete).

Inputs: [ATD-001 repository audit](ATD-001_REPOSITORY_AUDIT.md) (per-page KEEP/MODIFY/MERGE/PORT/ARCHIVE/DELETE proposals), [ATD-003 navigation map](ATD-003_CANONICAL_NAVIGATION_MAP.md) §3 (route dispositions), [ATD-008 spec](ATD-008_NAVIGATION_IMPLEMENTATION_SPEC.md) and the navigation registry, plus fresh static evidence gathered for this review (section 2).

## 1. What this covers and what you are approving

ATD-008 moved the 33 signed-in pages that carried the shared rail onto the new navigation. The other **141 HTML pages** were out of scope. This document puts every one of them in exactly one group and recommends one action per group, so you approve 14 group decisions instead of 141 page decisions. The per-page list is in [Appendix A](#appendix-a--every-page).

Nothing here changes a file. Each approved group becomes its own small implementation task, done in the order in section 5, with the preconditions listed for that group.

### Actions used

| Action | Meaning |
|---|---|
| **KEEP** | Stays at its URL as it is. Any edits come from their own task (copy, security). |
| **ADOPT NAV** | Stays, and joins the new navigation like the ATD-008 pages. |
| **MERGE → target** | Its useful behaviour or saved data moves into the named canonical page first; only then does the old URL become a redirect. |
| **RETIRE → target** | No unique working function to preserve. Update the links pointing at it, then replace it with a redirect stub that keeps the query string and hash (same pattern as the existing `options-recommender.html`). |
| **ARCHIVE** | Remove from the deployed site. Source kept in Git history or an `archive/` folder outside the published output. No redirect needed (nothing links to it). |
| **DEFER** | Product-scope decision. URL stays working but is not promoted; revisit after the beta scope is set. |

## 2. Evidence gathered for this review

Static inspection of the repository at `33af7e8`. No page was opened against production and no data was read.

- **ATD-001 baseline:** all 141 pages have an ATD-001 row; this review follows its proposed decision unless the new evidence below changes the picture. Of the 141: 71 MERGE, 37 MODIFY, 25 ARCHIVE, 6 KEEP, 2 SECURITY FIX.
- **Who still links to them:** across the 33 pages now on the new navigation, almost every link to a legacy page comes from `tool-audit.html`, an internal page that lists the whole catalogue. `tools.html`, the user-facing Tool Directory, links to only one of them (`dividend-screener.html`). The registry links to four (group C). So for most legacy pages, retiring them changes nothing a user can reach from the menu today.
  - **Exception:** `short-term-dashboard.html` is linked from four live tool pages (`atr-stop-planner`, `kelly-calculator`, `options-analyzer`, `r-multiple`), mostly as "back" links. Those links must change before it retires.
  - `momentum-hunter-complete.html` is linked from `trade-journal-pro.html`'s `ALLOWED_FROM` return map; `features-tools-directory.html` from `watchlist.html`.
- **Public entry points:** `sitemap.xml` lists only six of these pages (`pricing`, `privacy`, `support`, `terms`, `wheel-calculator`, `assignment-risk`). All six are KEEP.
- **Scanner pages do not work as scanners today.** Of the 26 standalone scanner pages, nearly all render random or demo rows (`Math.random`, "demo"/"sample" data) or depend on n8n webhooks; `orb-scanner.html` says "Coming Soon". A few call Finnhub from the browser, which ATD-002 flags as a client-key problem. `scanner.html`'s registry (`js/scanner-defs.js`) already has two working scans (`my_movers`, `gap_scan`) and ten scans declared "pending until backend data exists". What a retired scanner page actually loses is its filter definitions and copy, not working results.
- **Saved data:** the journal, watchlist and portfolio duplicates (group E) each read and write their own browser storage keys or tables. ATD-001 and ATD-005 both require lossless reconciliation before any of them retires.

## 3. Groups and recommendations

| Group | Pages | Recommendation | Why | Precondition |
|---|---|---|---|---|
| **A. Public site and legal** | 18 | **KEEP** | Marketing, legal, help and two public calculators (`wheel-calculator`, `assignment-risk`, both in the sitemap). They keep the public top bar; the signed-in menu does not belong on them. | None. Copy updates stay with ATD-001's MODIFY notes. |
| **B. Sign-in, account and admin** | 12 | **KEEP**, owned by ATD-007 | Auth, billing, admin and broker callback pages. ATD-001 marks `account` and `admin` SECURITY FIX. `account`, `billing` and `broker-connections` are utility-menu targets and should **ADOPT NAV** after ATD-007's work on them. | ATD-007 security work; never redirect `login`, `reset-password` or `schwab-callback`. |
| **C. On the menu but missing the menu** | 4 | **ADOPT NAV** | The registry already lists `swing-trader` (Legacy), `long-term-dashboard` (Legacy), `my-rules` (Legacy) and `data-hygiene-audit` (Journal › Data Quality). Clicking them today lands on a page with no menu. | Per-page layout check, as in ATD-008 waves. `swing-trader` and `long-term-dashboard` merge into their desks later. |
| **D. Duplicate dashboards and coaches** | 10 | **MERGE** → Trading Command / Wheel Coach / Morning Brief | `tradingcommand`, `short-term-dashboard`, `daytrade` → Trading Command; `ai-trading-agent`, `whale-tracker` → Wheel Coach; `daily-bias`, `daily-summary`, `earning-watcher`, `sector-sentiment`, `sector-sentiment-gauge` → Morning Brief / future Market Engine. | Feature and saved-state inventory per page (ATD-003 §3). Update the four live links to `short-term-dashboard` first. |
| **N. Compatibility redirects** | 3 | **KEEP** | `market-intelligence`, `options-recommender`, `options-strategies` already redirect. | None. |
| **E. Duplicate journals, watchlists and portfolios** | 9 | **MERGE** with data migration | Different storage keys and tables. Retiring one before its records are migrated would lose user data. | **Blocked:** ATD-005/007 ownership fixes and the canonical private-data decision (ATD-004). Export/import with verification per data model. |
| **F. Standalone scanner pages** | 26 | **RETIRE** → `scanner.html` | Demo/random rows or webhook-dependent; the registry is the agreed home. Ten already have a registry entry (`gap-and-go`→gap scan; `rvol-scanner`, `volume-spike`→RVOL; `orb-scanner`; `sma-cross-scanner`; `rsi-reversal-scanner`; `short-squeeze-scanner`; `post-earnings-drift`; both `momentum-hunter` pages→movers). For the other 16, first register each as a "pending" scan with its filters preserved, then retire. | Update `tool-audit.html` links and `trade-journal-pro.html`'s `momentum-hunter` return entry. Real results wait on ATD-101 data. |
| **G. Options and Wheel variants** | 5 | **MERGE** → Options Hub / Wheel Strategy | `option-recommender`, `option-roll-analyzer`, `option-roll-tracker`, `option-trader`, `wheel_strategy_web_tool`. Overlaps the ATD-108 Wheel port. | Compare roll and parser edge cases first; do alongside ATD-108. |
| **H. Research and valuation variants** | 8 | **MERGE** → Intrinsic Value / Ticker Research | `ai-valuation`, `intrinsic-value-rsi`, `long-term-intrinsic-value` → Intrinsic Value; `stock-analyzer`, `stock-checker`, `chart-analysis-form` → Ticker Research; `dividend-screener`, `quality-screener` → scanner registry (fundamental scans). | Keep assumption labels (ATD-001: no demo values in live research). Update `tools.html`'s dividend-screener link. |
| **I. Planning, sizing and rules variants** | 8 | **MERGE** | `position-sizer_fresh`, `risk-calculator` → Position Sizer; `my-rules-long`, `my-rules-short`, `discipline-checklist` → Risk Rules (`my-rules`); `automated-trading-plan`, `buy-sell-signal`, `news-trading` → Trade Plan Builder. | Preserve strategy/horizon rule scope (ATD-003). |
| **J. Long-term planning tools** | 8 | **DECIDE** (owner) | `asset-allocation-builder`, `dca-planner`, `etf-core-screener`, `factor-tilt-planner`, `fee-analyzer`, `ips-builder`, `pick-my-mix`, `risk-quiz`. Fit the Long-Term desk if it is in the beta; otherwise defer. | Owner decision Q1 (section 4). |
| **K. Household and retirement planning** | 8 | **DEFER** | `buy-a-home`, `college-savings`, `education-529-planner`, `real-estate-analyzer`, `retirement-calculator`, `retirement-planner`, `tax-advantaged-guide`, `withdrawal-planner`. ATD-001: outside the initial trading product. Keep URLs working; do not promote. | Owner decision Q2. |
| **L. Duplicate tool catalogues** | 4 | **RETIRE** → `tools.html` (signed-in) / `features.html` (public) | `advanced-trading-tools`, `feature_body`, `feature_new`, `features-tools-directory`. Competing lists of the same tools. | Update links in `tool-audit.html` and `watchlist.html`. |
| **M. Scaffolds, prototypes and unrelated product** | 18 | **ARCHIVE** | Templates (`template`, `template_new`, `arowana-template`, `short-term-template`, `task-template`, `updated-navigation`), prototypes and generators (`cover-call-option-recommentor` is n8n JSON, `options-hub-creator`, `trade-ideas-ai`, `daily-trading-post`, `weekly-swing-trade-post`, `pricing-revolutionary`, `ai_valuation`, `test_webhook`), the stray `base-breakout .html` (space in the name), and Salon/GenieSphere pages (`dashboard`, `overview`, `settings`). | Owner decision Q3 on how to archive. Update `tool-audit.html`'s link to `weekly-swing-trade-post`. |

Total: 18 + 12 + 4 + 10 + 3 + 9 + 26 + 5 + 8 + 8 + 8 + 8 + 4 + 18 = **141**.

### Security notes

Two groups carry security value beyond tidiness, so they are worth doing early:

- **Group M:** `test_webhook.html` is an external webhook test form and the Salon pages belong to another product's data and OAuth domain (ATD-001 marks the Salon pages P0 ARCHIVE). While they sit in the deployed root they are publicly reachable.
- **Group F:** several scanner pages call providers from the browser, which ATD-002 lists as a client-key migration problem. Retiring them removes those call sites rather than fixing them one by one.

## 4. Decisions (approved 2026-10-03)

The owner approved the recommendation for each question on 2026-10-03; the right-hand column is now the decision.

| ID | Question | Approved decision |
|---|---|---|
| Q1 | Are the long-term planning tools (group J) part of the private beta? | Yes for `asset-allocation-builder`, `dca-planner`, `pick-my-mix`, `risk-quiz` (they fit the Long-Term desk); defer the rest. |
| Q2 | Household and retirement planning (group K): defer, or keep promoting? | Defer, per ATD-001. URLs keep working. |
| Q3 | How to archive group M: move to an `archive/` folder excluded from deployment, keep in Git history only (delete from `main`), or a separate branch? | `archive/` folder excluded from the published output, so the source stays visible in `main`. Needs one check of the Cloudflare Pages build settings. |
| Q4 | Redirect style for retired pages: a stub page (works on any static host, like `options-recommender.html`) or a Cloudflare `_redirects` file (server-side 301)? | Stub pages for now: consistent with what exists and independent of host configuration. |
| Q5 | Are pricing, billing and checkout (groups A/B) in the private beta? | Per ATD-001: defer public commercial expansion; keep the pages, no new links. |

The three items parked during ATD-008 stay parked here: `whale-tracker.html` (now in group D, merge into Wheel Coach), `tradingcommand.html` (group D), and Wheel Coach's desktop top bar.

## 5. Recommended order

| Phase | Groups | Why this order | Blocked by |
|---|---|---|---|
| 1 | **M** archive, **L** catalogue retirement, **C** adopt nav | No user data involved, removes publicly reachable junk, and fixes the four menu items that land on pages without a menu. | Q3, Q4 |
| 2 | **F** scanners, **I** planning/rules, **H** research variants | Mostly link updates plus redirects; scanner filters go into the registry as pending scans. | Q4 |
| 3 | **D** dashboards/coaches, **G** options variants | Need feature and saved-state inventories; G runs with ATD-108. | ATD-108 for G |
| 4 | **E** journals/watchlists/portfolios | Saved-data migration. | ATD-005/007 ownership fixes; ATD-004 canonical private model |
| Any time | **J**, **K** | Product scope only. | Q1, Q2 |

Each phase is one or more normal PRs with the same checks used in ATD-008: link check across all pages, CI, before/after error comparison in a local browser with external network blocked, and a rollback that restores the old file.

### Progress

| Phase | Done | Notes |
|---|---|---|
| 1 | C, L | C: `<body data-nav-shell>` makes `js/arowana-nav.js` build the rail on pages without a sidebar; page top links carry `data-nav-legacy`; opt-out loads nothing on these pages. L: redirect stubs keep query and hash; live links updated. M waits on Q3 (Cloudflare build settings). |
| 2 (part) | F; I: `risk-calculator`, `my-rules-short`, `position-sizer_fresh`; H: `dividend-screener` | F: all 26 scanner pages redirect to `scanner.html?scan=<id>` (new deep link). 16 scans registered as pending with each page's main filters, plus `dividend_safety`. Momentum Hunter maps to My Movers, which runs today. The four H/I pages are covered by their target (`my-rules-short` uses the same saved keys as `my-rules`; `position-sizer_fresh` loses only a fees input and a profit $ output; `dividend-screener` never loaded because its Supabase URL resolved to a placeholder). |
| 2 (held) | none | All group H and I pages are now merged or retired. |
| 2b | `automated-trading-plan`, `news-trading` → `trade-plan-builder`; `stock-checker` → `intrinsic-value` | Owner-approved 2026-10-03. The first two were demo-only (the live path threw). `stock-checker` is retired for security: it carried an n8n webhook token in its URL path and rendered the response with innerHTML. **Owner action:** rotate that n8n webhook token, because it stays in git history. The 9 held pages move their features into the target first, one PR per target page. |
| 2c | `my-rules-long` → `my-rules?tab=longterm`; `discipline-checklist` → `my-rules?tab=habits` | `my-rules` now has Trading / Long-term / Habits tabs, which read and write the old pages' keys (`my_rules_longterm_v1`, `my_rules_longterm_check`, `gs_discipline_v1`), so saved data carries over. Ported features: the allocation, behavior and trigger rules plus their checklist; daily, weekly and monthly habits with notes, completion percentages, the trading preset, export and import. Dropped: the share-link import (`#s=` in the URL wrote unescaped HTML into saved state, a stored XSS), the non-trading presets, and streak and carry-forward settings, which never changed anything (their saved values are kept). Rule and habit text is now rendered as text. Also fixed: the daily-meter header colour, which threw on load because `#hdr` was missing. |
| 2d | `ai-valuation`, `intrinsic-value-rsi`, `long-term-intrinsic-value` → `intrinsic-value` | `intrinsic-value` has a new **More models** section with five reference models: Graham Number √(22.5·EPS·BVPS), multi-stage Residual Income with persistence φ, Earnings Power Value with a haircut, a peer P/E multiple, and a two-stage FCF DCF with net debt and a Gordon terminal value. Like Graham and DDM, they feed nothing into the bear/base/bull headline. Formulas were checked against the originals with the same inputs. Load fills book value, ROE and payout from Finnhub. The inputs are kept in saved valuations and export. Not carried over: the EBITDA-based EPV fallback (EBITDA is not earnings), the FCFE-proxy DCF (EPS × retention, covered by the DCF and FCF DCF), ai-valuation's hardcoded demo companies and TradingView embed, and its separate history key (`arowana_ai_valuation_hist_v1`, which held demo runs). API keys share `arowana_iv_apikeys` with the target and carry over. |
| 2e | `stock-analyzer`, `chart-analysis-form` → `analysis-central?tab=ai` | Instrument Research has a new **AI Analysis** tab. The AI scorecard and the chart-screenshot analysis send the same n8n payloads and handle the same response shapes. Webhooks come from `AP_WEBHOOKS` (`stock_analyzer`, and `chart`/`st_main` as before); a URL saved on the old analyzer page is still used, https only. Dropped on purpose: the analyzer's demo scores shown when it had no webhook; its history read of the shared `stock_analysis` table with no user filter, replaced by recent scorecards kept on the device; and its add/remove buttons for the legacy `watchlist` table, which deleted rows by ticker alone. Webhook output is rendered as text. Chart history (`arowana_chart_history_v2`) and the free daily limit (`ap_chart_scan_*`) carry over. The limit is still enforced only in the browser. |
| 2f | `quality-screener` → `scanner?scan=quality_compounders`; `buy-sell-signal` → `trade-plan-builder` | **Quality Compounders** is a real scan, not a pending one. With an n8n `quality_screener` webhook it posts the old `{index, tickers, sector}` request, then applies the old page's 15 thresholds and its 60/20/20 composite rank, unchanged; parity was checked in Node on four threshold sets. Its mock mode (five hardcoded companies), settings JSON save/load and CSV export are not carried over. Trade Plan Builder gains a **Signal check** next to the AI draft. It sends the old request (`{ticker, timeframe, deep, quick}`, plus TradingView alert fields), shows signal, confidence, levels, reward:risk and warnings, checks the levels against the signal locally, and fills the plan only on "Use these levels". Dropped: the demo-price mode, the TradingView chart embed, and the direct `journal_trades` insert with a client-chosen `user_id`; the plan's journal hand-off covers that. Webhook output is rendered as text; the old page injected it as HTML. |
| 3 (part) | D: `daytrade`, `earning-watcher` → `trading-command`; `ai-trading-agent` → `arowana-trader`; `sector-sentiment`, `sector-sentiment-gauge` → `ai-morning-brief`. G: `option-recommender` → `options-hub?tab=calls`; `option-trader` → `options-hub?tab=analyzer`; `wheel_strategy_web_tool` → `wheel-strategy?tab=import` | Phase 3 inventory, from source: these eight pages lose nothing real. `daytrade`, the sector pages and `option-trader` were demo or hardcoded data. `option-recommender` posted to a placeholder webhook. `earning-watcher` called a defunct Yahoo endpoint from the browser; Trading Command has Earnings ahead. `arowana-trader` reads `ai-trading-agent`'s `ap_positions_v1` and `ap_acct_size`. `wheel-strategy` has the same import parser plus the roll window, and now opens `?tab=`. |
| 3b | `short-term-dashboard` → `trading-command`; `daily-bias` → `trade-plan-builder`; `daily-summary` → `ai-morning-brief`; `option-roll-analyzer` → `options-hub?tab=roll` | Owner-approved 2026-10-04. The short-term dashboard's saved signals (`arowana_journal_v1`, two record shapes, also written by the old buy-sell-signal page) are not moved: they are ideas, not trades, and some hold demo prices. Trade Plan Builder shows them in a **Saved signals** card (only when present), with Plan it, CSV export and Clear. The dashboard URL sends a browser that has saved signals there once, then to Trading Command. Dropped: its Lesson of the Day; the hardcoded-anon-JWT `journal_trades` insert; daily-bias's per-ticker triggers (the page was broken; `daily_bias_runs` rows become unreachable); daily-summary's mock digest; the roll analyzer's manual what-if estimate. Links updated in the six nav pages that pointed at the dashboard. |
| 3c | `option-roll-tracker` → `trade-journal-pro?tab=option` | Released after ATD-108. The target ledger already exists: Trade Journal Pro's options record rolls (`↻ Roll`, `rolledFromId` lineage, chain realized P/L, Find Rolls), and Options Hub's Roll Coach covers the decision. Saved chains are **exported, not migrated**: production holds 2 `option_roll_chains` rows (2 accounts, last saved 2025-11-21; counts only, read-only), and the tracker modelled spreads and condors as one chain with long strikes, which the journal's single-leg options cannot take without guessing. The URL lists any browser save (`option_roll_tracker_v1`) and the signed-in user's chains (owner-only RLS) with CSV (the old columns) and JSON downloads, and redirects to the journal when there are none; if the account lookup fails it stays and says so. Nothing is written or deleted. Dropped: the manual ledger and its "close now" what-if; the `?fromTrade=` prefill from the old `trading_journal`; cloud save. Links updated in three pages. `whale-tracker` and `tradingcommand` stay as decided. |
| 4a | `master-journal` → `trade-journal-pro`; `portfolio-tracker` → `portfolio-command`; `short-term-watchlist`, `long-term-watchlist` → `watchlist` | Group E inventory 2026-10-05 (source plus row counts only, read-only). These four lose nothing. `master-journal` only read `journal_trades` and `option_chains`, both empty in production. `portfolio-tracker` was a coming-soon page with no data. `watchlist` is a superset of `short-term-watchlist`: same tables (`watchlists`, `watchlist_items`), row shape and browser key (`stw_watchlist_v1`), plus multiple lists; all 9 production lists are its "Default" list. `watchlist` already imports `long-term-watchlist`'s browser save (`arowanaLongTermWatchlist`) once as long-term holds. Edge case left as is: a browser that ran that import and then kept using the old page has rows the one-time import will not pick up again. Links updated in five pages and the tool-audit list. **Remaining E:** `trade-journal` (`ap_trade_journal_v1`), `options-journal` (`oj_trades_v1`), `my-watchlist` (`arowana_watchlist_v1`), `iv-watchlist-module` (`ap_iv_watchlist_*`) are browser-only saves nothing imports (need an export or import step); `long-term-portfolio` writes `portfolio` (37 rows, 3 accounts, last 2026-09-22) while Portfolio Command builds holdings from journal lots, so it needs an owner decision. |

## 6. Proposed task/status updates (for integration after review)

Recorded in `TASKS.md` and `PROJECT_STATUS.md` as owner-approved; each phase is implemented in its own PR.

## 7. Verification for this document

- Parsed every HTML row of ATD-001's per-page inventory (174 pages) and matched all 141 non-migrated pages; each is assigned to exactly one group (checked by script).
- Inbound links: every `*.html` reference in every page, split into references from the 33 pages on the new navigation and from public pages; registry routes; `sitemap.xml`.
- Scanner capability: per page counts of `Math.random`, demo/sample wording, provider names and webhook references, plus the scan registry in `js/scanner-defs.js`.
- Documentation checks: relative links resolve; repository secret scan and Git whitespace check run on the branch.
- Not performed: opening any page in a browser for this review, reading any user data, or checking deployed hosting configuration (Q3).

## Appendix A — Every page

Groups as in section 3. "Linked from live menu pages" lists which of the 33 pages on the new navigation reference the page. "Public links" counts references from public pages (`index`, `features`, `pricing`, `about`, `learn-investing`, `blog`, `tools`, `features-tools-directory`).

| Page | Group | Recommendation | ATD-001 | Linked from live menu pages | Public links | Sitemap |
|---|---|---|---|---|---|---|
| `404.html` | A | KEEP public | Keep P3 | — | 0 |  |
| `about.html` | A | KEEP public | Modify P3 | tool-audit | 4 |  |
| `assignment-risk.html` | A | KEEP public | Keep P2 | — | 2 | yes |
| `blog.html` | A | KEEP public | Modify P3 | — | 1 |  |
| `contact.html` | A | KEEP public | Modify P3 | tool-audit | 3 |  |
| `disclosures.html` | A | KEEP public | Modify P3 | ai-moat-finder, ai-morning-brief, analysis-central, arowana-trader, atr-stop-planner, credit-spread-planner, dcf-analyzer, discipline-scorecard, dividend-tracker, expectancy-matrix, intrinsic-value, kelly-calculator, money-flow-alert, options-analyzer, options-hub, portfolio-advisor, portfolio-command, position-sizer, r-multiple, risk-comfort, strategy-backtesting, tax-loss-harvester, technical-analysis, tool-audit, tools, trade-journal-pro, trade-plan-builder, trading-command, volatility-guardrails, watchlist, wheel-strategy | 6 |  |
| `features.html` | A | KEEP public | Modify P3 | arowana-trader, atr-stop-planner, options-analyzer | 3 |  |
| `guide-claude-tradingview-windows.html` | A | KEEP public | Modify P3 | — | 0 |  |
| `index.html` | A | KEEP public | Modify P3 | ai-moat-finder, ai-morning-brief, analysis-central, arowana-trader, atr-stop-planner, credit-spread-planner, dcf-analyzer, discipline-scorecard, dividend-tracker, expectancy-matrix, intrinsic-value, kelly-calculator, money-flow-alert, options-analyzer, options-hub, portfolio-advisor, portfolio-command, position-sizer, r-multiple, risk-comfort, scanner, strategy-backtesting, tax-loss-harvester, technical-analysis, tool-audit, tools, trade-journal-pro, trade-plan-builder, trading-command, trading-journal-analysis, volatility-guardrails, watchlist, wheel-strategy | 7 |  |
| `learn-investing.html` | A | KEEP public | Modify P3 | arowana-trader, atr-stop-planner, kelly-calculator, options-analyzer, tool-audit | 2 |  |
| `pricing.html` | A | KEEP public | Modify P3 | arowana-trader, atr-stop-planner, options-analyzer, options-hub, portfolio-advisor, tool-audit, watchlist | 6 | yes |
| `privacy.html` | A | KEEP public | Modify P3 | ai-moat-finder, ai-morning-brief, analysis-central, arowana-trader, atr-stop-planner, credit-spread-planner, dcf-analyzer, discipline-scorecard, dividend-tracker, expectancy-matrix, intrinsic-value, kelly-calculator, money-flow-alert, options-analyzer, options-hub, portfolio-advisor, portfolio-command, position-sizer, r-multiple, risk-comfort, strategy-backtesting, tax-loss-harvester, technical-analysis, tool-audit, tools, trade-journal-pro, trade-plan-builder, trading-command, volatility-guardrails, watchlist, wheel-strategy | 7 | yes |
| `refunds.html` | A | KEEP public | Modify P3 | — | 2 |  |
| `risk-disclosure.html` | A | KEEP public | Modify P3 | — | 2 |  |
| `security.html` | A | KEEP public | Modify P3 | — | 1 |  |
| `support.html` | A | KEEP public | Modify P3 | ai-moat-finder, ai-morning-brief, analysis-central, arowana-trader, atr-stop-planner, credit-spread-planner, dcf-analyzer, discipline-scorecard, dividend-tracker, expectancy-matrix, intrinsic-value, kelly-calculator, money-flow-alert, options-analyzer, options-hub, portfolio-advisor, portfolio-command, position-sizer, r-multiple, risk-comfort, strategy-backtesting, tax-loss-harvester, technical-analysis, tool-audit, tools, trade-journal-pro, trade-plan-builder, trading-command, volatility-guardrails, watchlist, wheel-strategy | 5 | yes |
| `terms.html` | A | KEEP public | Modify P3 | ai-moat-finder, ai-morning-brief, analysis-central, arowana-trader, atr-stop-planner, credit-spread-planner, dcf-analyzer, discipline-scorecard, dividend-tracker, expectancy-matrix, intrinsic-value, kelly-calculator, money-flow-alert, options-analyzer, options-hub, portfolio-advisor, portfolio-command, position-sizer, r-multiple, risk-comfort, strategy-backtesting, tax-loss-harvester, technical-analysis, tool-audit, tools, trade-journal-pro, trade-plan-builder, trading-command, volatility-guardrails, watchlist, wheel-strategy | 7 | yes |
| `wheel-calculator.html` | A | KEEP public | Keep P2 | arowana-trader | 3 | yes |
| `account.html` | B | KEEP (ATD-007) | Security Fix P0 | ai-morning-brief, analysis-central, arowana-trader, atr-stop-planner, credit-spread-planner, intrinsic-value, options-analyzer, portfolio-advisor, scanner, strategy-backtesting, technical-analysis, tool-audit, trade-journal-pro, trading-command, watchlist | 7 |  |
| `admin-usage.html` | B | KEEP (ATD-007) | Modify P0 | — | 0 |  |
| `admin.html` | B | KEEP (ATD-007) | Security Fix P0 | — | 0 |  |
| `api-diagnostics.html` | B | KEEP (ATD-007) | Modify P1 | — | 0 |  |
| `billing.html` | B | KEEP (ATD-007) | Modify P2 | — | 0 |  |
| `broker-connections.html` | B | KEEP (ATD-007) | Modify P1 | — | 0 |  |
| `checkout.html` | B | KEEP (ATD-007) | Modify P2 | — | 3 |  |
| `login.html` | B | KEEP (ATD-007) | Modify P0 | ai-morning-brief, analysis-central, arowana-trader, atr-stop-planner, credit-spread-planner, intrinsic-value, money-flow-alert, options-analyzer, options-hub, portfolio-advisor, portfolio-command, position-sizer, scanner, strategy-backtesting, technical-analysis, tool-audit, trade-journal-pro, trade-plan-builder, trading-command, trading-journal-analysis, watchlist, wheel-strategy | 7 |  |
| `onboarding.html` | B | KEEP (ATD-007) | Modify P0 | trading-command | 0 |  |
| `reset-password.html` | B | KEEP (ATD-007) | Modify P0 | — | 0 |  |
| `schwab-callback.html` | B | KEEP (ATD-007) | Modify P1 | — | 0 |  |
| `signup.html` | B | KEEP (ATD-007) | Modify P0 | arowana-trader, atr-stop-planner, intrinsic-value, options-analyzer, tool-audit | 6 |  |
| `data-hygiene-audit.html` | C | ADOPT NAV | Keep P1 | — | 0 |  |
| `long-term-dashboard.html` | C | ADOPT NAV | Merge P2 | atr-stop-planner, kelly-calculator, options-analyzer, risk-comfort, tool-audit, volatility-guardrails | 2 |  |
| `my-rules.html` | C | ADOPT NAV | Modify P1 | — | 0 |  |
| `swing-trader.html` | C | ADOPT NAV | Merge P2 | — | 0 |  |
| `ai-trading-agent.html` | D | MERGE | Merge P1 | — | 0 |  |
| `daily-bias.html` | D | MERGE | Merge P2 | tool-audit | 1 |  |
| `daily-summary.html` | D | MERGE | Merge P2 | — | 0 |  |
| `daytrade.html` | D | MERGE | Merge P1 | — | 0 |  |
| `earning-watcher.html` | D | MERGE | Merge P2 | — | 0 |  |
| `sector-sentiment-gauge.html` | D | MERGE | Merge P2 | — | 0 |  |
| `sector-sentiment.html` | D | MERGE | Merge P2 | — | 0 |  |
| `short-term-dashboard.html` | D | MERGE | Merge P1 | atr-stop-planner, kelly-calculator, options-analyzer, r-multiple, tool-audit | 2 |  |
| `tradingcommand.html` | D | MERGE | Merge P1 | — | 0 |  |
| `whale-tracker.html` | D | MERGE | Merge P1 | — | 0 |  |
| `iv-watchlist-module.html` | E | MERGE (data) | Merge P1 | — | 0 |  |
| `long-term-portfolio.html` | E | MERGE (data) | Merge P1 | tool-audit | 1 |  |
| `long-term-watchlist.html` | E | MERGE (data) | Merge P1 | tool-audit | 1 | Retired 4a → `watchlist` |
| `master-journal.html` | E | MERGE (data) | Merge P1 | — | 0 | Retired 4a → `trade-journal-pro` |
| `my-watchlist.html` | E | MERGE (data) | Merge P1 | — | 0 |  |
| `options-journal.html` | E | MERGE (data) | Merge P1 | credit-spread-planner | 0 |  |
| `portfolio-tracker.html` | E | MERGE (data) | Merge P1 | — | 0 | Retired 4a → `portfolio-command` |
| `short-term-watchlist.html` | E | MERGE (data) | Merge P1 | — | 1 | Retired 4a → `watchlist` |
| `trade-journal.html` | E | MERGE (data) | Merge P1 | — | 0 |  |
| `base-breakout.html` | F | RETIRE→scanner | Merge P2 | — | 0 |  |
| `bb-snapback.html` | F | RETIRE→scanner | Merge P2 | tool-audit | 1 |  |
| `day-trade-scanner.html` | F | RETIRE→scanner | Merge P2 | — | 0 |  |
| `ema-snapback.html` | F | RETIRE→scanner | Merge P2 | tool-audit | 1 |  |
| `gap-and-go.html` | F | RETIRE→scanner | Merge P2 | tool-audit | 1 |  |
| `gap-fade-scanner.html` | F | RETIRE→scanner | Merge P2 | tool-audit | 1 |  |
| `high-shortfloat-screener.html` | F | RETIRE→scanner | Merge P2 | — | 0 |  |
| `hod-scanner.html` | F | RETIRE→scanner | Merge P2 | tool-audit | 1 |  |
| `intraday-breakout.html` | F | RETIRE→scanner | Merge P2 | tool-audit | 1 |  |
| `lap-pullback.html` | F | RETIRE→scanner | Merge P2 | — | 0 |  |
| `momentum-hunter-complete.html` | F | RETIRE→scanner | Merge P2 | tool-audit, trade-journal-pro | 1 |  |
| `momentum-hunter.html` | F | RETIRE→scanner | Merge P2 | — | 0 |  |
| `opening-drive.html` | F | RETIRE→scanner | Merge P2 | tool-audit | 1 |  |
| `orb-scanner.html` | F | RETIRE→scanner | Merge P2 | tool-audit | 1 |  |
| `pattern-scanner.html` | F | RETIRE→scanner | Merge P2 | tool-audit | 1 |  |
| `post-earnings-drift.html` | F | RETIRE→scanner | Merge P2 | tool-audit | 1 |  |
| `rsi-reversal-scanner.html` | F | RETIRE→scanner | Merge P2 | tool-audit | 1 |  |
| `rvol-scanner.html` | F | RETIRE→scanner | Merge P2 | tool-audit | 1 |  |
| `scalp-trading-screener.html` | F | RETIRE→scanner | Merge P2 | tool-audit | 1 |  |
| `short-entry-screener.html` | F | RETIRE→scanner | Merge P2 | tool-audit | 1 |  |
| `short-squeeze-scanner.html` | F | RETIRE→scanner | Merge P2 | tool-audit | 1 |  |
| `sma-cross-scanner.html` | F | RETIRE→scanner | Merge P2 | tool-audit | 1 |  |
| `trade-scanner.html` | F | RETIRE→scanner | Merge P2 | — | 0 |  |
| `trendline-break.html` | F | RETIRE→scanner | Merge P2 | tool-audit | 1 |  |
| `volume-spike.html` | F | RETIRE→scanner | Merge P2 | — | 0 |  |
| `vwap-pullback.html` | F | RETIRE→scanner | Merge P2 | tool-audit | 1 |  |
| `option-recommender.html` | G | MERGE | Merge P2 | — | 0 |  |
| `option-roll-analyzer.html` | G | MERGE | Merge P2 | — | 0 |  |
| `option-roll-tracker.html` | G | MERGE | Merge P2 | — | 0 | Retired 3c: saved-chain export, then `trade-journal-pro?tab=option` |
| `option-trader.html` | G | MERGE | Merge P2 | — | 0 |  |
| `wheel_strategy_web_tool.html` | G | MERGE | Merge P2 | — | 0 |  |
| `ai-valuation.html` | H | MERGE | Merge P2 | — | 0 |  |
| `chart-analysis-form.html` | H | MERGE | Merge P2 | atr-stop-planner | 0 |  |
| `dividend-screener.html` | H | MERGE | Modify P2 | tool-audit, tools | 2 |  |
| `intrinsic-value-rsi.html` | H | MERGE | Merge P2 | — | 0 |  |
| `long-term-intrinsic-value.html` | H | MERGE | Merge P2 | — | 0 |  |
| `quality-screener.html` | H | MERGE | Modify P2 | tool-audit | 1 |  |
| `stock-analyzer.html` | H | MERGE | Merge P2 | tool-audit | 1 |  |
| `stock-checker.html` | H | MERGE | Merge P2 | — | 0 |  |
| `automated-trading-plan.html` | I | MERGE | Merge P2 | — | 0 |  |
| `buy-sell-signal.html` | I | MERGE | Merge P2 | tool-audit | 1 |  |
| `discipline-checklist.html` | I | MERGE | Merge P2 | — | 0 |  |
| `my-rules-long.html` | I | MERGE | Merge P2 | tool-audit | 1 |  |
| `my-rules-short.html` | I | MERGE | Merge P2 | — | 0 |  |
| `news-trading.html` | I | MERGE | Merge P2 | — | 0 |  |
| `position-sizer_fresh.html` | I | MERGE | Merge P1 | — | 0 |  |
| `risk-calculator.html` | I | MERGE | Merge P1 | — | 0 |  |
| `asset-allocation-builder.html` | J | DECIDE | Modify P2 | — | 0 |  |
| `dca-planner.html` | J | DECIDE | Modify P2 | tool-audit | 1 |  |
| `etf-core-screener.html` | J | DECIDE | Modify P2 | — | 0 |  |
| `factor-tilt-planner.html` | J | DECIDE | Modify P2 | — | 0 |  |
| `fee-analyzer.html` | J | DECIDE | Modify P2 | — | 0 |  |
| `ips-builder.html` | J | DECIDE | Modify P2 | tool-audit | 1 |  |
| `pick-my-mix.html` | J | DECIDE | Modify P2 | tool-audit | 1 |  |
| `risk-quiz.html` | J | DECIDE | Modify P2 | tool-audit | 1 |  |
| `buy-a-home.html` | K | DEFER | Archive P3 | tool-audit | 1 |  |
| `college-savings.html` | K | DEFER | Archive P3 | tool-audit | 1 |  |
| `education-529-planner.html` | K | DEFER | Archive P3 | tool-audit | 1 |  |
| `real-estate-analyzer.html` | K | DEFER | Archive P3 | tool-audit | 1 |  |
| `retirement-calculator.html` | K | DEFER | Archive P3 | tool-audit | 2 |  |
| `retirement-planner.html` | K | DEFER | Archive P3 | tool-audit | 2 |  |
| `tax-advantaged-guide.html` | K | DEFER | Archive P3 | tool-audit | 2 |  |
| `withdrawal-planner.html` | K | DEFER | Archive P3 | tool-audit | 2 |  |
| `advanced-trading-tools.html` | L | RETIRE→tools | Merge P3 | — | 0 |  |
| `feature_body.html` | L | RETIRE→tools | Merge P3 | — | 0 |  |
| `feature_new.html` | L | RETIRE→tools | Merge P3 | — | 0 |  |
| `features-tools-directory.html` | L | RETIRE→tools | Merge P3 | tool-audit, watchlist | 0 |  |
| `ai_valuation.html` | M | ARCHIVE | Archive P3 | — | 0 |  |
| `arowana-template.html` | M | ARCHIVE | Archive P3 | — | 0 |  |
| `base-breakout .html` | M | ARCHIVE | Merge P2 | — | 0 |  |
| `cover-call-option-recommentor.html` | M | ARCHIVE | Archive P3 | — | 0 |  |
| `daily-trading-post.html` | M | ARCHIVE | Archive P3 | — | 0 |  |
| `dashboard.html` | M | ARCHIVE | Archive P0 | — | 0 |  |
| `options-hub-creator.html` | M | ARCHIVE | Archive P3 | — | 0 |  |
| `overview.html` | M | ARCHIVE | Archive P0 | — | 0 |  |
| `pricing-revolutionary.html` | M | ARCHIVE | Archive P3 | — | 0 |  |
| `settings.html` | M | ARCHIVE | Archive P0 | — | 0 |  |
| `short-term-template.html` | M | ARCHIVE | Archive P3 | — | 0 |  |
| `task-template.html` | M | ARCHIVE | Archive P3 | — | 0 |  |
| `template.html` | M | ARCHIVE | Archive P3 | — | 0 |  |
| `template_new.html` | M | ARCHIVE | Archive P3 | — | 0 |  |
| `test_webhook.html` | M | ARCHIVE | Archive P3 | — | 0 |  |
| `trade-ideas-ai.html` | M | ARCHIVE | Archive P3 | — | 0 |  |
| `updated-navigation.html` | M | ARCHIVE | Archive P3 | — | 0 |  |
| `weekly-swing-trade-post.html` | M | ARCHIVE | Archive P3 | tool-audit | 1 |  |
| `market-intelligence.html` | N | KEEP redirect | Modify P1 | money-flow-alert, tool-audit | 1 |  |
| `options-recommender.html` | N | KEEP redirect | Keep P3 | options-hub | 0 |  |
| `options-strategies.html` | N | KEEP redirect | Keep P3 | — | 0 |  |
