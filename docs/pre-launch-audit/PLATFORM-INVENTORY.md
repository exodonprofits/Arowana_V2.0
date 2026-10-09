# Platform inventory (ATD-109 pre-launch audit, 2026-10-09)

Repository state: `main` at `8fd53f3` (after PR #87). Everything below comes from
the files in the repository, the nav registry (`js/arowana-nav-registry.js`,
version `2026-10-08.1`), the deploy workflow, and read-only queries against the
production Supabase project. No usage analytics were available, so **"User value"
is a judgement from what the page does, not a measured number.**

## Shape of the site

| Fact | Value | Source |
|---|---|---|
| Top-level `.html` files | 157 | `ls *.html` |
| Redirect stubs (meta refresh / `location.replace`, under 6 KB) | 68 | `scripts/browser/prelaunch_sweep.mjs` `realPages()` |
| Real pages | 89 | same |
| Nav registry routes | 50 ids, 5 marked `hidden: true` | `js/arowana-nav-registry.js` |
| Pages published by the deploy | **all** root `*.html` (no per-page exclusion) | `.github/workflows/deploy-bluehost.yml:62` |
| Pages disallowed in robots.txt | `admin.html`, `admin-usage.html`, `api-diagnostics.html` | `robots.txt:27-30` |
| Sitemap | 2 pages (`wheel-calculator`, `assignment-risk`) | `sitemap.xml` |
| Edge functions in repo | research, explain, coach, ai-coach, checkout, billing-portal, stripe-webhook, digest, founders-count | `supabase/functions/` |
| Design base | Plus Jakarta Sans, shared shell (`js/arowana-nav.js`) on registry pages | sweep results, see UI-UX-AUDIT.md |

## Module inventory

Status key: **Live** = in the nav registry and reachable from the menu.
**Hidden** = registry entry with `hidden: true` (reachable by link only).
**Orphan** = not in the registry, no inbound links. **Stub** = retirement page
that imports old data and moves on. "Links" = number of other pages that link to it.

### Trading Command desk

| Module | Purpose | Location | Status | User value | Recommendation | Priority |
|---|---|---|---|---|---|---|
| Trading Command | Positions, live scan, coach, what changed, decision queue | `trading-command.html` (366 KB) | Live, 38 links | High: daily home | KEEP | — |
| Morning Brief | Pro daily brief from `ai_briefs` (12:30 UTC generator) | `trading-command.html?view=brief`; `ai-morning-brief.html` redirects there | Live (#84) | High | KEEP | — |
| Old Trading Command copy | Pre-rebuild duplicate, 2,822 diff lines from the live page | `tradingcommand.html` (251 KB) | **Orphan but published** | None (stale) | REMOVE (needs approval) | P1 |

### Research

| Module | Purpose | Location | Status | User value | Recommendation | Priority |
|---|---|---|---|---|---|---|
| Ticker Research | Company profile, metrics, peers, news | `analysis-central.html` (423 KB) | Live, 20 links | High | IMPROVE (BYOK FMP prompt, unescaped peers) | P2 |
| Thesis Builder | Numbers → note → AI scenarios → decision log | `thesis-builder.html` | Live (#82/#83) | High | KEEP | — |
| Intrinsic Value | DCF-style valuation | `intrinsic-value.html` | Live | Medium-high | IMPROVE (legacy key reads) | P3 |
| Technical Analysis | Indicator read-out | `technical-analysis.html` | Hidden | Medium | **FIX XSS** before launch | **P0** |
| Scanners | Scanner framework (`js/scanners.js`, `js/scanner-defs.js`) | `scanner.html` | Hidden in nav, 28 links | Medium-high | IMPROVE (2 scans broken, see FUNCTIONAL-AUDIT) | P1 |
| Strategy Backtesting | Backtest a rule set | `strategy-backtesting.html` | Hidden | Medium | INVESTIGATE (mock strings in source) | P3 |
| Tool Directory | Card list of tools | `tools.html` | Live | Medium | KEEP | — |
| Moat Finder, DCF Analyzer, Options Analyzer | Single-purpose calculators | `ai-moat-finder.html`, `dcf-analyzer.html`, `options-analyzer.html` | Linked from tools only | Medium | KEEP; consider MERGE into Research later | P3 |

### Strategy desks

| Module | Purpose | Location | Status | User value | Recommendation | Priority |
|---|---|---|---|---|---|---|
| Options Hub (Wheel desk) | Want-to-own, CSP/CC scanners, check a trade, roll coach | `options-hub.html` (469 KB) | Live, 31 links | High: core paid feature | KEEP | — |
| Wheel Coach | AI coach for the wheel | `arowana-trader.html` | Live | High | IMPROVE (reads user-typed webhook URLs) | P2 |
| Wheel Strategy | Guide + tracker | `wheel-strategy.html` | Live | Medium | IMPROVE (unpinned `xlsx-latest`) | P2 |
| Credit Spread Planner | Spread planning | `credit-spread-planner.html` | Live | Medium | KEEP | — |
| Swing desk | Swing trader page | `swing-trader.html` | Hidden | Low today (mock strings) | INVESTIGATE | P3 |
| Long-Term desk | 6-step hub with 20 tool cards (#80) | `long-term-dashboard.html` + 19 planner pages | Live | High for the owner's investing | KEEP | — |
| Whale tracker | Misnamed old fork of the AI Trading Coach | `whale-tracker.html` | **Orphan but published** | None | REMOVE or redirect to `arowana-trader.html` | P1 |
| Money Flow Alert | Alias page with mock data | `money-flow-alert.html` | Not in registry, 0 links | Low | INVESTIGATE / REMOVE | P2 |

### Portfolio & Risk

| Module | Purpose | Location | Status | User value | Recommendation | Priority |
|---|---|---|---|---|---|---|
| Portfolio Command | Overview and performance | `portfolio-command.html` (434 KB) | Live | High | KEEP | — |
| Portfolio Advisor | AI portfolio read | `portfolio-advisor.html` | Live | Medium-high | KEEP | — |
| Risk Rules / Position Sizer / Tax-Loss / Dividends | Risk and income tools | `my-rules.html`, `position-sizer.html`, `tax-loss-harvester.html`, `dividend-tracker.html` | Live | High | KEEP | — |
| Watchlists | Cloud watchlists | `watchlist.html` | Live | High | IMPROVE (phone tap targets) | P2 |
| Calculators | ATR stop, Kelly, R-multiple, risk comfort, volatility guardrails | 5 pages | Tools directory only | Medium | KEEP; MERGE candidates post-launch | P3 |

### Journal & Review

| Module | Purpose | Location | Status | User value | Recommendation | Priority |
|---|---|---|---|---|---|---|
| Trade Journal Pro | Cloud journal (stocks/options), CSV import | `trade-journal-pro.html` (463 KB) | Live, 25 links | High: core paid feature | KEEP | — |
| Expectancy Matrix, Data Hygiene, Discipline Scorecard | Review tools | 3 pages | Live / tools | Medium | KEEP | — |
| Trading Journal Analysis | Older analysis page | `trading-journal-analysis.html` | Not in registry, 0 links | Low | INVESTIGATE (duplicate of Stats?) | P3 |
| Retirement stubs | Import old localStorage data, then redirect | `options-journal`, `trade-journal`, `long-term-portfolio`, `option-roll-tracker` | Stub, noindex | Migration only | KEEP until migration window ends | P3 |

### Account, billing, public and admin

| Module | Purpose | Location | Status | User value | Recommendation | Priority |
|---|---|---|---|---|---|---|
| Sign in / sign up / reset | Supabase auth | `login.html`, `signup.html`, `reset-password.html` | Live | Critical | KEEP | — |
| Account, Billing, Checkout | Profile, Stripe portal, checkout | `account.html`, `billing.html`, `checkout.html` | Live | Critical | KEEP (checkout deploy waits for L3) | — |
| Onboarding | First-run watchlist and risk rules | `onboarding.html` | Auto-redirect for new users | High | KEEP | — |
| Pricing | Plans ($299 Founders) | `pricing.html` | Public | Critical | IMPROVE (stale "coming soon" on brief) | P2 |
| Free calculators | Wheel calculator, assignment risk | `wheel-calculator.html`, `assignment-risk.html` | Public, in sitemap | High (acquisition) | KEEP | — |
| Legal | Privacy, terms, disclosures, refunds, risk, security | 6 pages | Public | Required | KEEP | — |
| Blog | 5 cards that all link back to `blog.html` | `blog.html` | Public, 7 links | Negative (looks unfinished) | REMOVE or fill | P2 |
| TradingView guide | Claude + TradingView on Windows | `guide-claude-tradingview-windows.html` | Orphan; links to missing `education.html` | Low | INVESTIGATE | P3 |
| Admin console | Webhooks, tools, users | `admin.html` | Orphan, robots-disallowed | Owner only | IMPROVE (missing local supabase file) | P2 |
| Admin usage | Provider usage summary (server-checked admin) | `admin-usage.html` | Orphan, noindex | Owner only | KEEP | — |
| API diagnostics | Provider self-test | `api-diagnostics.html` | Orphan, no admin gate | Owner only | Restrict or REMOVE | P3 |
| Tool audit | Internal tool audit | `tool-audit.html` | Orphan, noindex | Owner only | Restrict to admin | P3 |
| Schwab callback | OAuth return page ("coming soon") | `schwab-callback.html` | noindex | Needed later | KEEP | — |

## Back end (read-only inspection)

| Component | State | Source |
|---|---|---|
| `arowana-research` | Live v9 = repo (`supabase/functions/arowana-research/index.ts`) | #86, `supabase/baselines/ATD108_functions.json` |
| `arowana-explain` | Live v4, `verify_jwt` true | #87 baseline note |
| `arowana-checkout` | Live v14; repo checks $299 vs live Wheel site at $229. **Do not deploy before L3.** | owner notes |
| Tables used by Arowana | `profiles`, `watchlists`, `watchlist_items`, `trade_journal_options/stocks`, `tj_*`, `journal_trades`, `ap_*`, `ai_briefs`, `arowana.*` | baseline migration |
| Shared project | `pbojacnagutipfhcxltj` also serves Salon and Rental | — |
