# ATD-003 — Canonical navigation map

Status: **map completed; labels and grouping owner-approved 2026-09-29**. Date: 2026-09-29. Branch: `codex/ATD-003-canonical-navigation-map`. Baseline: `c1542bf`.

The owner approved Architecture 2.1 including ATD-006A and authorized ATD-003 on 2026-09-29. This task defines the navigation contract; it changes no HTML, JavaScript, CSS, redirects, account data or production configuration. Architecture approval does not approve the ATD-004 child contract or unblock ATD-101's remaining gates.

Sources: [Architecture 2.1](ARCHITECTURE_2_1.md), [ATD-001 canonical-source recommendations](ATD-001_REPOSITORY_AUDIT.md), [ATD-004 inventory](ATD-004_DATA_SOURCE_INVENTORY.md), and static inspection of the shared rail, inline navigation and compatibility pages. Existing source files are migration candidates, not claims of tested functionality.

## 1. Navigation decisions

Use six primary destinations in this order. Strategy desks share the Data Hub, engines, risk policies and proposal-bound decision records defined by the architecture; approval of the Data Hub child contract remains separate. No internal Market Agent, Technical Agent, Devil's Advocate or Chief Trading Agent top-level page is introduced.

| Primary destination | User purpose | Child workflows | Existing entry/source and target availability |
|---|---|---|---|
| Trading Command | Decide what needs attention now | Overview, Morning Brief, What Changed, decision queue | `trading-command.html`; `ai-morning-brief.html` is a brief migration source. What Changed and the proposal-bound decision queue are target capabilities, not verified current screens. |
| Research | Research an instrument or discover a setup | Instrument Research, Technical/POC, Fundamentals & Valuation, Scanners, Backtesting | `analysis-central.html`; `technical-analysis.html`, `intrinsic-value.html`, `scanner.html`, `strategy-backtesting.html`. Existing capabilities need data/security/parity validation. |
| Strategy Desks | Evaluate an opportunity within a strategy | Swing, Wheel, Options, Growth, Long-Term | A logical group, not a new invented route. See desk mapping below; no separate data pipeline per desk. |
| Portfolio & Risk | Understand holdings, exposure and permitted risk | Portfolio Overview, Accounts & Cash, Risk Rules, Position Sizing, Performance | `portfolio-command.html`; `my-rules.html`, `position-sizer.html`, existing performance deep link. Account/cash workflows remain behind verified ownership. |
| Watchlists | Maintain and evaluate tracked opportunities | Shared list workflow with strategy/horizon filters | `watchlist.html`; consolidate competing lists only after lossless migration. |
| Journal & Review | Record activity and review decisions/results | Trade Journal, decision history, performance review links, data quality | `trade-journal-pro.html`; decision history is a target capability. Own trade expectancy, execution quality and discipline; link to Portfolio account returns and share calculations. |

Account, connection status, help and sign-out belong in a utility menu. Use `account.html`, `broker-connections.html`, `support.html` as existing sources; do not route Arowana settings to the unrelated `settings.html`. Broker status remains read-only. Admin tools remain restricted utilities, not trader navigation. `tools.html` is a secondary curated directory reachable from Research, not a seventh primary destination. Marketing, pricing, legal and authentication routes remain outside the signed-in primary navigation.

The six entries are an owner-approved information hierarchy, not six new HTML files. Do not display a clickable destination until a working, authorized route or clearly labeled existing workflow is available. Planned capabilities can be shown as non-interactive “Planned” information; they must not appear live because an old file shares their name.

### Strategy desk mapping

| Desk | Existing source / compatibility entry | Target placement and limitation |
|---|---|---|
| Swing | `swing-trader.html`, `short-term-dashboard.html`, shared scanner workflows | Swing workflow within Strategy Desks. Preserve unique saved state and scanner parameters before consolidation. |
| Wheel | `wheel-strategy.html`, `wheel-calculator.html`, `arowana-trader.html`, Options Hub calls/puts/roll workflows | Wheel remains one strategy desk. Coach output is contextual; it does not rename the whole platform or become the Chief's independent factual authority. |
| Options | `options-hub.html` | Options workflow with existing calls, puts, roll, watchlist, analyzer and strategies tabs. Shared widgets may be linked from Wheel; their data/results are not duplicated. |
| Growth | Research/valuation and watchlist source capabilities; no dedicated verified desk route identified | Planned desk. Do not invent a working growth URL or reuse unrelated AI-chat pages as its implementation. |
| Long-Term | `long-term-dashboard.html`, `long-term-portfolio.html`, `long-term-watchlist.html`, valuation sources | Long-Term workflow backed by shared portfolio/watchlist records. Preserve horizon preferences; do not create a second holdings authority. |

### Approved grouping boundaries

The owner approved these display labels and boundaries on 2026-09-29. Research replaces the proposed Analysis navigation label while retaining `analysis-central.html` as its existing source. Growth is the display label for the architecture's Growth/AI logical desk; AI is a sector/theme filter, not a separate desk identity. No route, service or architectural responsibility is renamed by this documentation change.

- Options owns shared option-chain, pricing and analysis tools. Wheel owns the cash-secured put → assignment → covered call workflow. Cross-link shared tools without duplicating records or calculations.
- Portfolio & Risk owns account returns, allocation and exposure. Journal & Review owns trade expectancy, execution quality and discipline. Both use shared calculations and cross-link relevant results.
- Provide one contextual coaching entry from Trading Command and relevant desks. Internal AI roles do not become primary destinations.
- Place tools within the workflows they support. Keep a searchable secondary directory for discovery, reachable from Research.

## 2. Current navigation evidence

- `js/nav-rail.js` declares five current groups: Trading Command, Portfolio Command, Ticker Research, Options Hub and Tools. Its comments still describe a Wheel-oriented product and several historical changes; comments are not evidence that a destination works.
- `trading-command.html` contains an inline copy of the rail configuration. ATD-001 identifies other inline/older rails, including `js/auth-guard.js` (a navigation script despite its name) and Salon-oriented `js/bottom-nav.js`. A later implementation must inventory consumers before consolidating these; replacing one file is not a site-wide migration.
- The rail uses punctuation-stripped filename matching, so `trading-command.html` and `tradingcommand.html` appear equivalent even though both are distinct files. A target registry must use explicit aliases rather than treating all hyphen/underscore differences as interchangeable.
- Current deep links include `options-hub.html?tab=calls`, `?tab=puts`, `?tab=roll`, `?tab=watchlist`, `?tab=analyzer`, `?tab=strategies` and `portfolio-command.html?tab=performance`. These are observed links, not browser-verified assertions about the destination handlers.
- The Trading Command positions shortcut uses a same-page `switchTab('positions')` handler. Its cross-page URL alone does not encode that tab; future migration needs an explicit, tested deep-link contract before promising identical behavior.
- `market-intelligence.html` is a retired page with a timed redirect to Trading Command, not an implemented Market Engine surface. The two options compatibility pages preserve hashes through JavaScript but do not forward the original query string.

## 3. Legacy route disposition

These are proposed future dispositions. **Every existing file and URL remains unchanged in ATD-003.** KEEP means retain the entry; MERGE means preserve behavior/data before introducing a compatibility mapping, not immediate deletion or redirect. For all routes not specifically listed, default to KEEP AS-IS and use ATD-001's full file inventory before making any retirement decision.

| Existing route or family | Intended canonical home | Compatibility requirement |
|---|---|---|
| `trading-command.html` | Trading Command | KEEP primary source URL. |
| `tradingcommand.html`, `daytrade.html`, `short-term-dashboard.html` | Trading Command / Swing as appropriate | MERGE only after feature/state inventory; no blanket dashboard redirect. |
| `ai-morning-brief.html`, `daily-summary.html`, `daily-bias.html` | Trading Command → Morning Brief / market context | Preserve distinct data and parameters; workflow payloads are not proven equivalent. |
| `market-intelligence.html` | Trading Command → market context | KEEP current redirect; new Market Engine output appears through Command/Research after implementation. |
| `analysis-central.html`, `technical-analysis.html`, `intrinsic-value.html`, `scanner.html` | Corresponding Research child | KEEP existing URLs as migration anchors. |
| `stock-analyzer.html`, `stock-checker.html`, valuation variants | Research → research/valuation | MERGE after feature and assumption parity; do not route fabricated/demo output into live research. |
| Individual scanner pages and momentum variants | Research → Scanners; contextual links from desks | Preserve named scan, filters and export workflows before registry mapping. Unknown scans show unavailable, not unrelated results. |
| `options-hub.html` and its tab links | Strategy Desks → Options | KEEP tabs and semantics; alias labels may differ by entry workflow, data must not. |
| `options-recommender.html` | Options analyzer tab | KEEP existing compatibility page; future redirect must explicitly preserve supported instrument/context queries and hash. |
| `options-strategies.html` | Options strategies tab | Same preservation rule; current script only retains hash. |
| `option-recommender.html`, `option-trader.html`, `options-journal.html`, roll tools | Options / Wheel / Journal by workflow | These similar names are distinct sources; do not infer equivalence from spelling. Review each before mapping. |
| `wheel-strategy.html`, `wheel-calculator.html`, `wheel_strategy_web_tool.html` | Strategy Desks → Wheel | Preserve parser/calculator functions and imports; external Wheel port is separately gated ATD-108. |
| `arowana-trader.html`, `whale-tracker.html`, `ai-trading-agent.html` | Contextual coaching within Command/desks | MERGE after evidence/security review; no standalone top-level agent destination. |
| `portfolio-command.html`, `portfolio-advisor.html`, `long-term-portfolio.html`, `portfolio-tracker.html` | Portfolio & Risk | Keep canonical overview source; reconcile account/holdings and unique goals before consolidating others. |
| `watchlist.html`, `short-term-watchlist.html`, `long-term-watchlist.html`, `my-watchlist.html`, `iv-watchlist-module.html` | Watchlists | Preserve list identity, notes, preferences and ownership; no silent overwrite or duplicate holdings. |
| `trade-journal-pro.html`, `trade-journal.html`, `master-journal.html`, `trading-journal-analysis.html` | Journal & Review | Preserve/import records across distinct models before any route retirement. |
| `my-rules.html`, `my-rules-short.html`, `my-rules-long.html`, `position-sizer.html`, `position-sizer_fresh.html` | Portfolio & Risk | Preserve strategy/horizon policy scope; no navigation action changes risk approval. |
| `tools.html` and specialist calculators | Research → tool directory or contextual action | Keep direct URLs; curate directory against existing working destinations before promotion. |
| `dashboard.html`, `settings.html`, `overview.html` and Salon navigation | Outside Arowana primary navigation | Preserve files; separate-product ownership/deployment decision required before archival. |
| Marketing, legal, login/signup/recovery, broker callback and admin URLs | Public/utility/operational boundaries | Preserve contracts; never redirect auth/OAuth callbacks as ordinary content pages. |

Existing broken links documented by ATD-001 remain pre-existing debt. This task preserves the baseline; it does not claim all current links resolve or repair all 80 previously reported missing targets.

## 4. Future route/registry contract

A later implementation should have one versioned navigation registry consumed by desktop and mobile. Each logical destination defines a stable identity, label, parent/order, verified route or explicit planned state, exact legacy aliases, active-state rules, availability and authorization requirements. This is a logical contract, not a code/schema change.

- Resolve exact path aliases first, then a destination's validated query/tab and fragment rules. Do not normalize unrelated names into the same destination.
- Inventory existing query parameters, fragments and callers per migrating route. Preserve supported instrument, strategy, list, account and return-context semantics. Reject or explain unsupported values; never silently switch to another instrument/account.
- Return destinations must be validated same-origin application destinations, not arbitrary URLs. Do not introduce provider keys, session tokens or private account payloads into navigation URLs. Auth/OAuth handlers retain their separately reviewed security contracts.
- Private resource identifiers never confer access. Resolve them under authenticated ownership; cross-user links show forbidden/not found without disclosure. Account switching invalidates incompatible private context.
- Preserve browser Back/Forward and refresh behavior. A redirect may be enabled only after destination parity, query/hash translation, authentication and loop tests pass. Where parity is incomplete, keep the old route operational and label the migration explicitly.
- `from=trading-command` is existing return-context evidence, not authorization. New proposal/snapshot/record deep links must use the later approved contract; this map invents no parameter names for them.
- A stale Decision Record remains historical evidence; navigation must not relabel it READY. Material edits return through the ATD-006A evaluation cycle. Human review and read-only broker boundaries apply everywhere.

## 5. Desktop, mobile and accessibility

Desktop uses the ordered six-section rail with expandable children and a separate utility menu. Only one destination is active; contextual cross-links do not create duplicate primary sections. Labels are consistent across page title, rail and breadcrumb.

Mobile uses four direct entries—Command, Watchlists, Portfolio, Journal—and a fifth **More** control containing Research, Strategy Desks and utilities. Command, Portfolio and Journal are compact labels for Trading Command, Portfolio & Risk and Journal & Review respectively. More opens a menu, not a fabricated route. All six destinations remain reachable; no array truncation may silently remove one. On a Research/Strategy Desks route, More indicates the active group while the page heading identifies the exact destination.

Future implementation must support keyboard focus, visible focus indicators, semantic links/buttons, current-page indication, Escape-to-close and focus return for the mobile drawer, readable labels in collapsed mode, and no horizontal overflow at narrow widths. Disabled/planned destinations must explain their state rather than relying solely on color.

## 6. Availability and permissions

Navigation is presentation, not authorization. Server identity/ownership and entitlement checks remain mandatory even when menu items are hidden. Separate unavailable data, missing entitlement, unauthenticated access and planned functionality. Show source/time/staleness on decision surfaces; avoid a global “Live” label that implies all inputs are current.

Market-data entitlement does not determine whether a user may view their own journal. Restrict the specific licensed enrichment/action while preserving authorized private workflows. Admin-only utilities require server authorization. No provider-key entry flow or arbitrary webhook destination is added by the navigation plan. ATD-002 and ATD-005 blockers remain prerequisites for affected migrations.

## 7. Incremental rollout and acceptance

1. Completed: the owner approved the six primary labels, grouping boundaries and mobile priorities on 2026-09-29. Implementation requires a separate assignment; this approval does not start it.
2. Assign a separate navigation implementation task. Inventory all rail consumers and exact deep-link handling, establish DEV and capture representative desktop/mobile baseline workflows.
3. Implement the shared registry and one consumer behind a controlled rollout; preserve all other pages. Compare behavior before extending the registry to remaining shells.
4. Migrate route families only after functional/data parity and relevant security gates pass. Keep a compatibility ledger of source, target, parameter translation and verification evidence.
5. Retire aliases only under a separately approved policy with bookmark/backlink evidence. Rollback restores the prior secure navigation/version and preserved data; it must not restore insecure credential paths.

Future acceptance cases include all six primary entries; every desk including planned states; each observed options tab; portfolio performance; same-page/cross-page positions navigation; options aliases with query and fragment; old command spellings; authenticated return paths; two-user private links; account switching; denied entitlements; stale decision records; revision after review; browser history/refresh; desktop rail and mobile More; keyboard and screen-reader labels; no new missing targets or redirect loops. Run no production write tests.

## 8. Verification and scope

ATD-003 verifies the documentation's local links and named existing-file references, whitespace, repository secret check, and documentation-only diff. Static source inspection supports the current-navigation findings; no browser UI, deployed routes, auth, provider or database behavior was tested. Desktop/mobile requirements above are acceptance criteria for future implementation, not completed UI tests. No runtime file changed, so no existing link was changed by this task.

Labels, grouping Strategy Desks without a new landing route, and mobile shortcut priorities are owner-approved. The ordering of later route-family migrations remains open for the separately assigned implementation task. Provider licensing, Data Hub contract approval, canonical private records, security remediation and secure DEV remain independently gated; ATD-101 is not started.
