# ATD-008 — Frontend navigation implementation specification

Status: **specification owner-approved 2026-10-02, including the recommendations for decisions D1–D13 (section 12); documentation only; no implementation started**. Date: 2026-10-02. Branch: `claude/ATD-008-navigation-implementation-spec`. Baseline: `origin/main` at `ca625bb`.

**Correction and implementation log (2026-10-03).** `options-hub-creator.html` was misclassified as an N1 consumer: it is a developer utility whose script *contains the text* of a `nav-rail.js` tag (it writes that tag into other files) and does not load the rail itself. N1 is therefore 26 pages, not 27, and wave 2 is 18 pages, not 19; counts elsewhere in this document that derive from 27 are off by one. Slice 1 (P1 plus the registry and renderer on `tools.html`) and wave 2 (`js/nav-loader.js`, default-on per D10 with `localStorage.ap_nav_v2 = "0"` as a per-browser opt-out, on `tools.html` plus the 18 pages) are implemented on `claude/ATD-008-nav-slice-1` and `claude/ATD-008-nav-wave-2`; wave 3 (`trading-command.html`) on `claude/ATD-008-nav-wave-3`; wave 4 (five core pages) on `claude/ATD-008-nav-wave-4`. Correction: a plain `options-hub.html` visit shows Covered Calls, so it maps to Wheel › Covered Calls, not the Options desk as §4.3 originally stated.

Inputs: [ATD-003 canonical navigation map](ATD-003_CANONICAL_NAVIGATION_MAP.md) (owner-approved labels and grouping), [Architecture 2.1](ARCHITECTURE_2_1.md), [ATD-001 audit](ATD-001_REPOSITORY_AUDIT.md), [ATD-007 work record](ATD-007_SECURITY_DEV_BASELINE.md) and static inspection of the frontend source listed in section 2.

This document turns the approved ATD-003 map into an implementation plan. It changes no HTML, JavaScript, CSS, URL, redirect, Supabase, credential, Docker or production configuration. Every behavioral statement about existing pages comes from **reading source files**; no page was opened in a browser, no route was requested and no authentication flow was exercised. Where a finding says a link "does not" or "cannot" work, it means the handling code is absent from the inspected source, not that a browser test failed.

## 1. Approved decisions this specification must honor

These are owner-approved (ATD-003, 2026-09-29) and are not reopened here.

| Area | Approved decision |
|---|---|
| Primary destinations, in order | Trading Command, Research, Strategy Desks, Portfolio & Risk, Watchlists, Journal & Review |
| Strategy desks | Swing, Wheel, Options, Growth, Long-Term. AI is a theme/filter within Growth, not a desk |
| Strategy Desks route | A logical group; no new landing route is invented |
| Mobile shortcuts | Command, Watchlists, Portfolio, Journal, More. More contains Research, Strategy Desks and utilities |
| Options / Wheel boundary | Options owns shared option-chain, pricing and analysis tools. Wheel owns the cash-secured put → assignment → covered call workflow |
| Portfolio / Journal boundary | Portfolio & Risk owns account returns, allocation and exposure. Journal & Review owns trade expectancy, execution quality and discipline |
| Coaching and tools | Contextual: one coaching entry from Trading Command and relevant desks; tools placed in the workflows they support, plus a secondary searchable directory reachable from Research |
| Internal AI roles | No Market Agent, Technical Agent, Devil's Advocate or Chief Trading Agent page becomes a navigation destination |
| Availability | Nothing is shown as clickable until a working, authorized route or clearly labeled existing workflow exists; planned capabilities are shown as non-interactive "Planned" |
| Compatibility | Every existing file and URL stays. Redirects only after parity, query/hash translation, auth and loop tests |
| Utilities | Account, connection status, help and sign-out in a utility menu; `settings.html` (Salon) is not Arowana settings; admin tools are not trader navigation |

## 2. Current navigation implementations and consumers

Static inspection covered all 174 HTML files in the repository root and the three navigation scripts in `js/`. Every page falls into exactly one family below; the full per-page list is in [Appendix A](#appendix-a--every-html-page-by-navigation-family).

### 2.1 Navigation implementations

| ID | Implementation | Consumers | Notes from source |
|---|---|---|---|
| N1 | Shared rail script `js/nav-rail.js` (600 lines) | 27 pages via `<script src>` (25 as `./js/nav-rail.js`, 2 as `/js/nav-rail.js`: `scanner.html`, `watchlist.html`) | Renders five groups (Trading Command, Portfolio Command, Ticker Research, Options Hub, Tools; 29 links) into `#railMount`, plus a fixed mobile bottom bar appended to `<body>`. No consumer adds a cache-busting version to its `src`. |
| N2 | Inline copy of the same script, plus a "Rail correction, inline and last" patch | 8 pages: `trading-command.html`, `portfolio-command.html`, `options-hub.html`, `analysis-central.html`, `trade-journal-pro.html`, `intrinsic-value.html`, `portfolio-advisor.html`, `arowana-trader.html` | The inline script body is identical to `js/nav-rail.js` apart from one trailing newline (compared after removing the leading HTML comment). The patch (`trading-command.html:10698`, `trade-journal-pro.html:10414`, and equivalents) rewrites the rendered DOM: removes `market-intelligence`/`momentum-hunter` entries, renames old labels, repoints `features-tools-directory` to `tools.html` and appends a Tools group if missing. The inline comment ("Delete js/nav-rail.js; nothing loads it now") is wrong: 27 pages load it. |
| N2a | Stale rail in `js/auth-guard.js` (430 lines) | `trade-journal-pro.html:13` (`<script defer src="/js/auth-guard.js">`) | Despite its name, the file is an older copy of the rail: it lists `market-intelligence.html` and `features-tools-directory.html`, has no Tools group and no mobile bottom bar. Because it is `defer`, it should execute after the page's inline rail and re-render `#railMount` with the older rail, which the correction patch then edits. That ordering is inferred from HTML script semantics, not observed. `login.html:871` still describes auth-guard.js as the session-expired redirect source, so its auth role needs ATD-007 review before anyone removes it (section 9). |
| N3 | Hand-built static rail markup | `whale-tracker.html` | Static `.rail-*` markup with its own collapse and account code (comment near line 2703: "This page has no nav-rail.js"), plus a separate `nav-links` top bar. |
| N4 | `ap-nav-main` / `ap-nav-top` template header | 14 pages (copied markup) | Older Arowana template header; e.g. `features-tools-directory.html`, `long-term-dashboard.html`, `master-journal.html`, `broker-connections.html`. |
| N5 | `nav-links` / `navbar` top bar | 52 pages (copied markup) | Mostly public/marketing, auth and older tool pages (`index.html` uses its own `topnav`, see N7). Includes `login.html`, `pricing.html`, `account.html`, `billing.html`, `support.html`, `swing-trader.html`, `short-term-dashboard.html`. |
| N7 | Page-local header or no shared navigation | 67 pages | Page-specific `<nav class="nav">` headers, minimal headers or none. Includes `index.html`, `dashboard.html`, `my-rules.html`, `data-hygiene-audit.html`, admin pages. |
| N8 | Salon `js/bottom-nav.js` ("Salon Genie — Shared Bottom Navigation") | `settings.html` | Belongs to another product. Out of scope; must not be reused for Arowana. |
| N9 | Compatibility redirects | `market-intelligence.html` (4-second meta refresh to `trading-command.html`), `options-recommender.html` and `options-strategies.html` (0-second refresh plus `location.replace` that appends only `location.hash`) | Query strings are dropped by the two options redirects. |
| N10 | OAuth callback | `schwab-callback.html` | Not navigation. Never registered, redirected or wrapped by the nav shell. |

### 2.2 Shared rail internals that the new implementation replaces

All references are to `js/nav-rail.js`; the eight inline copies are identical.

| Behavior | Source | Consequence for ATD-008 |
|---|---|---|
| Single hard-coded `TOOLS` array | lines 25–166 | Replace with a versioned registry (section 3). |
| Active detection strips `-`, `_` and case before comparing filenames | `normalizeFilename` 178–180, `isActiveHref` 182–184 | `tradingcommand.html` and `trading-command.html` are treated as the same page. ATD-003 requires explicit aliases instead. |
| Only a group's main link can be active; sub-items never are; query and fragment are ignored | 182–184, 208–227 | `options-hub.html?tab=puts` highlights "Options Hub" only. No `aria-current` anywhere. |
| "Live Scan & Positions" uses an inline `onclick` calling the page's global `switchTab('positions')` when `#positionsTab` exists | 192–196 | Couples the rail to page globals and requires inline script. `trading-command.html` already accepts `?tab=positions` (line 7314), so a plain link can replace this. |
| HTML assembled as strings and assigned with `innerHTML`; inline `onclick` on account buttons | 192–311, 483 | New renderer uses `document.createElement` and `addEventListener` only. This also removes a blocker for a future Content-Security-Policy without `unsafe-inline`. |
| Mobile bottom bar takes the first five groups whose `bottomNav !== false` | 361–383 | The comment (348–360) says Tools is excluded, but Tools sets `bottomNav: true` (152) and all five groups qualify, so the bar shows Trading, Portfolio, Research, Options, Tools. It does not match the approved Command, Watchlists, Portfolio, Journal, More. |
| Mobile bottom bar renders on every consumer, even without `#railMount` | 459–469 | Rendering is decoupled from the rail; keep that property. |
| Collapse state in `localStorage` key `ap_rail_collapsed_v1` | 23, 313–334 | Keep the key so user preference survives migration. |
| Account menu: plan line from `ap_plan_v1`, user name from `gs_auth_user_v1` then `supabaseClient.auth.getUser()` (retried at 900 ms) | 229–263, 525–558 | Presentation only. Plan and identity cached in the browser are not authorization (section 7). |
| Account menu claims `aria-haspopup="menu"` but items are plain links/buttons without menu roles or arrow-key handling | 560–598 | Use a disclosure pattern instead of an ARIA menu (section 6). |
| Skips the account block when the page has `#user-menu-toggle` (auth-header.js convention) | 477–483 | Among rail pages, only `scanner.html` and `watchlist.html` contain `id="user-menu-toggle"` in their markup (other matches are comment text). Utility menu ownership must be settled per page before migration. |

### 2.3 Mobile drawer (page-owned, not in the shared script)

The hamburger drawer is implemented in each page, not in `js/nav-rail.js`. 31 pages contain `#sidebarTrigger`; 8 contain the `openSidebar` implementation seen in `trading-command.html:5480–5520`. That implementation:

- toggles `body.sidebar-open`, a backdrop and `aria-expanded` on the trigger;
- closes on the close button, backdrop click, any Escape keypress, any rail link click and when the viewport grows past 768 px;
- does **not** move focus into the drawer, trap focus, make the page behind it inert, or return focus to the trigger on close.

Pages without `#sidebarTrigger` that still load the rail (`ai-morning-brief.html`, `position-sizer.html`, `trade-plan-builder.html`) get the bottom bar but no drawer, so the rail's sub-items are unreachable at mobile widths unless the page provides another route. This is a static finding to confirm in DEV.

### 2.4 Deep-link handlers used by navigation

| Page | Accepts | Writes URL on tab change | Restores on refresh | Source |
|---|---|---|---|---|
| `trading-command.html` | `?tab=` or `#` = `positions`, `coach`; `journal` and `watchlist` forward to other pages via `TC_MOVED_TABS` unless `?add=` is present | No | `tc_active_tab_v1` in localStorage | 7308–7322, 7372–7381 |
| `options-hub.html` | `?tab=` = `calls`, `puts`, `roll`, `watchlist`, `quality`, `analyzer`, `strategies` | No | `oh_active_tab_v1` (ignored when the remembered tab is `calls`) | 8690–8712 |
| `portfolio-command.html` | **Nothing.** The page never reads `location.search` apart from building the login `next=` value at line 32 | No | `pc_active_tab_v1`, else `holdings` | 6255–6283 |
| `trade-journal-pro.html` | `?tab=` = `stock`, `option`, `stats`; `?from=` resolved through the `ALLOWED_FROM` allow-list (falls back to `trading-command.html`); option prefill parameters | Yes, `history.replaceState` (no new history entries) | Saved tab | 2911–2945, 6070–6090 |
| `arowana-trader.html` | `#brief`, `#positions`, `#chat`, `#journal`; `?tab=` as fallback | Yes, `history.pushState` per tab switch; `replaceState` when restoring | `ap_coach_last_tab_v1` | 1450–1536 |

Consequence: the rail link `portfolio-command.html?tab=performance` ("Performance Analytics") cannot open the Performance tab, because nothing on the page reads that parameter. It lands on the remembered tab or Holdings. The registry must not ship that link as "Performance" until `portfolio-command.html` accepts the parameter (first-slice prerequisite, section 8).

All 29 rail destinations and all `js/auth-guard.js` destinations exist as files. Existence is not evidence that they load or work.

## 3. Proposed shared navigation registry

### 3.1 Files

| File | Responsibility |
|---|---|
| `js/arowana-nav-registry.js` (new) | Data only: destinations, children, routes, aliases, query rules, availability, mobile slots, utility items. No DOM code. Exposes one frozen object on `window.ArowanaNavRegistry`. |
| `js/arowana-nav.js` (new) | Renderer and behavior: desktop rail, mobile bar, More sheet, utility menu, active-state resolution, drawer focus management. Reads only the registry and the current `location`. Built with `document.createElement`, no `innerHTML` with interpolated data, no inline handlers. |

New file names, rather than editing `js/nav-rail.js`, keep the 27 current consumers and 8 inline copies untouched until each is migrated, and avoid stale browser copies under the old unversioned URL. Script tags for the new files carry a version query (`?v=YYYYMMDDx`) consistent with the existing `?v=20260918c` convention used for `app-config.js` and others. No framework, bundler or package manager is introduced.

### 3.2 Logical schema

Each entry has:

- `id`: stable identifier, never shown to users (`command`, `research`, `desks`, `portfolio`, `watchlists`, `journal`, and children such as `desk-wheel`).
- `label` and optional `shortLabel` (mobile).
- `parent` and `order`.
- `status`: `available`, `legacy` (existing workflow, labeled as such until parity is verified), `planned` (non-interactive), or `restricted` (not rendered for trader navigation).
- `route`: `{ path, query }` for `available`/`legacy` entries; absent for `planned` entries and the Strategy Desks group.
- `aliases`: exact paths that also mark this entry active. No pattern or punctuation normalization.
- `activeWhen`: optional query/hash rules for pages that host several destinations (section 4.2).
- `requires`: `auth` when sign-in is required. This only controls presentation; servers still enforce access (section 7).
- `mobile`: slot (`command`, `watchlists`, `portfolio`, `journal`) or `more`.
- `note`: short reason shown for `planned`/`legacy` states.

### 3.3 Illustrative example (not final values)

```js
// Illustrative only. Final ids, labels and routes come from section 4 after review.
window.ArowanaNavRegistry = Object.freeze({
  version: '2026-10-02.1',
  entries: [
    { id: 'command', label: 'Trading Command', shortLabel: 'Command', order: 1,
      status: 'available', route: { path: 'trading-command.html' },
      requires: 'auth', mobile: 'command' },
    { id: 'command-whatchanged', parent: 'command', label: 'What Changed', order: 3,
      status: 'planned', note: 'Planned: depends on ATD-107' },
    { id: 'desks', label: 'Strategy Desks', order: 3, mobile: 'more' },
    { id: 'desk-wheel', parent: 'desks', label: 'Wheel', order: 2,
      status: 'available', route: { path: 'options-hub.html', query: { tab: 'puts' } },
      activeWhen: { path: 'options-hub.html', query: { tab: ['calls', 'puts', 'roll'] } } }
  ],
  utilities: [
    { id: 'account', label: 'Account settings', status: 'available',
      route: { path: 'account.html' } }
  ]
});
```

## 4. Route mapping

### 4.1 Approved destinations to existing routes

Status meanings: **available** = existing working entry point to keep; **legacy** = existing page shown with a "Legacy" marker until parity is verified; **planned** = non-interactive.

| Destination / child | Route | Status | Basis |
|---|---|---|---|
| **Trading Command** | `trading-command.html` | available | ATD-003 primary source |
| ↳ Overview / Positions | `trading-command.html?tab=positions` | available | Accepted by page (7314); replaces the `onclick` hack |
| ↳ Morning Brief | `ai-morning-brief.html` | legacy | ATD-003 migration source |
| ↳ What Changed | — | planned | ATD-107 |
| ↳ Decision queue | — | planned | ATD-106 and proposal-bound records (Architecture 2.1 §7) |
| ↳ Coach (contextual) | `trading-command.html?tab=coach` | available | Accepted by page (7314); the one coaching entry, not a primary item (D2) |
| **Research** | `analysis-central.html` | available | Approved Research label, existing source |
| ↳ Instrument Research | `analysis-central.html` | available | |
| ↳ Technical Analysis | `technical-analysis.html` | available | Current rail |
| ↳ Fundamentals & Valuation | `intrinsic-value.html` | available | Current rail |
| ↳ Scanners | `scanner.html` | available | Current rail |
| ↳ Backtesting | `strategy-backtesting.html` | available | Current rail |
| ↳ Tool Directory (secondary) | `tools.html` | available | Approved secondary directory reachable from Research |
| **Strategy Desks** (group, no route) | — | — | Approved logical group |
| ↳ Swing | `swing-trader.html` | legacy | ATD-003 source; N5 top-bar page, not yet on the rail shell |
| ↳ Wheel | `options-hub.html?tab=puts` (children: `?tab=puts`, `?tab=calls`, `?tab=roll`) | available | Wheel owns the CSP → assignment → covered-call workflow; those tabs exist today. Landing approved (D1); `wheel-strategy.html` is a Legacy child until its parity review |
| ↳ Options | `options-hub.html?tab=analyzer` (children: `?tab=analyzer`, `?tab=strategies`, `?tab=watchlist`, `?tab=quality`; `credit-spread-planner.html`) | available | Options owns shared chain/pricing/analysis tools |
| ↳ Growth | — | planned | No verified Growth route; AI appears as a filter inside Growth when built. Do not reuse `ai-*` pages |
| ↳ Long-Term | `long-term-dashboard.html` | legacy | ATD-003 source; N4 template page |
| **Portfolio & Risk** | `portfolio-command.html` | available | |
| ↳ Portfolio Overview | `portfolio-command.html` | available | Lands on remembered tab or Holdings today |
| ↳ Performance | `portfolio-command.html?tab=performance` | blocked until fixed | Page ignores `?tab=` (section 2.4). Ship only with prerequisite P1 |
| ↳ Portfolio Advisor | `portfolio-advisor.html` | available | Current rail |
| ↳ Risk Rules | `my-rules.html` | legacy | ATD-003 source; N7 page |
| ↳ Position Sizing | `position-sizer.html` | available | Current rail (Tools group) |
| ↳ Tax-Loss Harvester (contextual tool) | `tax-loss-harvester.html` | available | Current rail (Tools group); account-level tool |
| ↳ Accounts & Cash | — | planned | Behind ATD-007/ATD-005 ownership fixes |
| **Watchlists** | `watchlist.html` | available | Current rail (inside Portfolio group today) |
| **Journal & Review** | `trade-journal-pro.html` | available | |
| ↳ Trade Journal | `trade-journal-pro.html` | available | |
| ↳ Journal Stats | `trade-journal-pro.html?tab=stats` | available | Accepted by page (2911) |
| ↳ Expectancy Matrix (contextual tool) | `expectancy-matrix.html` | available | Journal owns expectancy |
| ↳ Data Quality | `data-hygiene-audit.html` | available | Currently under Options Hub; its own description is "Check journal data quality" |
| ↳ Decision history | — | planned | Target capability (ATD-003) |
| **Utilities** | `account.html`, `billing.html`, `broker-connections.html` (read-only status), Help & Support (existing `openSupport()` or `support.html`), Sign out (existing `signOut()`), plan upgrade link to `pricing.html` | available | Utility menu; not a primary destination |

### 4.2 Current rail links → target placement

Every one of the 29 current links has an explicit target. "Removed from primary" means the URL keeps working and stays reachable from `tools.html` or its workflow; it just leaves the rail.

| Current rail link | Current group | Target |
|---|---|---|
| `trading-command.html` | Trading Command | Trading Command |
| `trading-command.html` + `switchTab('positions')` | Trading Command | Trading Command ↳ Positions (`?tab=positions`) |
| `scanner.html` | Trading Command | Research ↳ Scanners (desks may cross-link) |
| `trade-journal-pro.html?from=trading-command` | Trading Command | Journal & Review (primary link has no `from`; `from` only on contextual links) |
| `arowana-trader.html?from=trading-command` ("Wheel Coach") | Trading Command | Reachable from the Wheel desk until merged. The single contextual coaching entry is "Coach" → `trading-command.html?tab=coach` (D2) |
| `portfolio-command.html` (×2) | Portfolio Command | Portfolio & Risk / Overview |
| `portfolio-advisor.html` | Portfolio Command | Portfolio & Risk ↳ Portfolio Advisor |
| `watchlist.html` | Portfolio Command | Watchlists (primary) |
| `analysis-central.html` | Ticker Research | Research |
| `technical-analysis.html` | Ticker Research | Research ↳ Technical Analysis |
| `intrinsic-value.html` | Ticker Research | Research ↳ Fundamentals & Valuation |
| `strategy-backtesting.html` | Ticker Research | Research ↳ Backtesting |
| `portfolio-command.html?tab=performance` | Ticker Research | Portfolio & Risk ↳ Performance (after P1) |
| `options-hub.html` (×2) | Options Hub | Strategy Desks ↳ Options |
| `options-hub.html?tab=calls` | Options Hub | Strategy Desks ↳ Wheel ↳ Covered Calls |
| `options-hub.html?tab=puts` | Options Hub | Strategy Desks ↳ Wheel ↳ Cash-Secured Puts |
| `options-hub.html?tab=roll` | Options Hub | Strategy Desks ↳ Wheel ↳ Roll Coach |
| `options-hub.html?tab=watchlist` ("Vol Watchlist") | Options Hub | Strategy Desks ↳ Options ↳ Vol Watchlist |
| `data-hygiene-audit.html` | Options Hub | Journal & Review ↳ Data Quality |
| `tools.html` (×2) | Tools | Research ↳ Tool Directory (Tools stops being a primary group) |
| `options-hub.html?tab=analyzer` | Tools | Strategy Desks ↳ Options ↳ Strategy Recommender |
| `options-hub.html?tab=strategies` | Tools | Strategy Desks ↳ Options ↳ Strategy Matrix |
| `credit-spread-planner.html` | Tools | Strategy Desks ↳ Options (contextual tool) |
| `position-sizer.html` | Tools | Portfolio & Risk ↳ Position Sizing |
| `expectancy-matrix.html` | Tools | Journal & Review (contextual tool) |
| `tax-loss-harvester.html` | Tools | Portfolio & Risk (contextual tool) |
| `index.html` (brand link) | Rail header | Signed-in users go to `trading-command.html`; signed-out users keep `index.html` (D6) |
| Utility links `account.html`, `billing.html`, `pricing.html` | Account menu | Utility menu |

### 4.3 Aliases, query parameters and fragments

Rules:

1. Match the current path against registry `route.path` and `aliases` **exactly** after lower-casing and removing the leading `./` or `/`. No hyphen/underscore stripping.
2. Then apply `activeWhen` query/hash rules for multi-destination pages.
3. Never rewrite, add or drop parameters on the current page. The nav only builds outbound links from registry data.
4. Unknown pages show no active primary item rather than a guess.

| Path / parameter | Treatment |
|---|---|
| `tradingcommand.html` | **Not** an alias of Trading Command (ATD-003: merge only after inventory). Gets no active item until the ATD-003 merge inventory (D5) |
| `options-hub.html` with no `?tab=` | Active desk is Options. The page may restore a remembered Wheel tab from `oh_active_tab_v1` without changing the URL, so the URL alone cannot identify the visible tab. The renderer exposes an optional `ArowanaNav.setActive(id)` hook the page can call from its `switchTab`; until the page calls it, the URL decides |
| `options-hub.html?tab=calls|puts|roll` | Wheel desk and the matching child |
| `options-hub.html?tab=analyzer|strategies|watchlist|quality` | Options desk and the matching child |
| `trading-command.html?tab=positions|coach` or `#positions|#coach` | Trading Command and matching child |
| `trading-command.html?tab=journal|watchlist` | Not a nav target; the page forwards it itself (`TC_MOVED_TABS`). The registry never emits these |
| `portfolio-command.html?tab=…` | Ignored by the page today. Registry emits only after P1 |
| `trade-journal-pro.html?tab=stock|option|stats` | Journal & Review and matching child |
| `trade-journal-pro.html?from=<key>` | Return context resolved by the page's allow-list; never authorization. Primary nav links omit `from` |
| `arowana-trader.html#brief|positions|chat|journal` | Coaching surface; active state recomputed on `hashchange`/`popstate` |
| `options-recommender.html`, `options-strategies.html` | Keep as-is. Before any change, forward supported query parameters as well as the hash (today only the hash survives) |
| `market-intelligence.html` | Keep the current redirect; never registered |
| Prefill/workflow parameters (`?add=`, `?prefillOption=`, `?setup=`, `?signal=`, `?account=`, `?broker=`, `?strike=` …) | Page-owned. The nav never builds, copies or forwards them. `?account=` carries no access; ownership is checked by the server |
| `login.html?next=`, `?expired=1` | Auth contract, not nav. Never registered or rewritten |

## 5. Active state, Back/Forward and refresh

**Active state**

- Exactly one primary destination is active, or none. The current child gets `aria-current="page"`; its parent group shows a visual "contains current page" marker without `aria-current`.
- Contextual links (coaching, tools inside workflows) never make a second primary destination active.
- Recompute on `DOMContentLoaded`, `hashchange`, `popstate` and `pageshow` (covers back-forward cache restores), and whenever a page calls `ArowanaNav.setActive`.
- Page title, rail label and any breadcrumb use the same registry label.

**Back/Forward**

- Navigation items are plain `<a href>` links causing full page loads; the browser owns history. The nav never calls `pushState`/`replaceState`.
- Opening or closing the desktop group toggles, the mobile drawer or the More sheet adds no history entry. Back while the drawer is open leaves the page, as today. Back does not close the drawer (D7); doing so would require adding history entries.
- On `pageshow` with `persisted === true`, close any open drawer/sheet so a restored page is never stuck in an open state.
- Tab-level history behavior stays page-owned and differs today: `arowana-trader.html` pushes history per tab (Back steps through tabs); `trade-journal-pro.html` replaces (Back leaves the page); `trading-command.html`, `options-hub.html`, `portfolio-command.html` don't touch the URL (Back leaves the page; refresh restores from localStorage). ATD-008 documents but does not unify this; unification is a separate task (D8).

**Refresh**: active state comes from the URL plus the optional page hook. Desktop collapse state persists through `ap_rail_collapsed_v1`. Group expansion is per-page-load (as today); persisting it is optional and not required.

## 6. Desktop rail, mobile navigation and accessibility

### 6.1 Desktop (≥ 769 px, matching the current breakpoint)

- `<nav aria-label="Primary">` containing six destinations in approved order; utilities in a separate region at the foot of the rail.
- Destinations with a route render as links. Strategy Desks has no route and renders as a disclosure button.
- Each group with children has its own toggle button (`aria-expanded`, `aria-controls`), as today. The group containing the current page starts expanded.
- Collapsed mode keeps icons, gives every link an accessible name (visually hidden text, not only `title`), and shows labels in a tooltip on hover and focus.

### 6.2 Mobile (≤ 768 px)

- Fixed bottom bar with five slots in this order: Command, Watchlists, Portfolio, Journal, More. Labels are the approved short labels; accessible names are the full labels ("Trading Command", "Portfolio & Risk", "Journal & Review").
- More is a `<button>` (not a link, no route) that opens a sheet containing Research with its children, Strategy Desks with each desk, then utilities.
- When the current page is in Research or Strategy Desks, More shows the active marker and the sheet opens with that section expanded. The page heading names the exact destination.
- The bar is built from registry `mobile` slots, never by slicing the destination list, so no destination can disappear silently. Missing a required slot is a render-time error logged to the console and caught by tests.
- The hamburger drawer becomes redundant once More exists. During migration a page keeps its current drawer until it adopts the new shell; afterwards `#sidebarTrigger` is removed from that page (D9).

### 6.3 Keyboard and focus requirements

| Interaction | Requirement |
|---|---|
| Tab order | Brand → collapse toggle → primary destinations and their toggles in order → utilities. No positive `tabindex` |
| Group toggles | Enter/Space toggles; state in `aria-expanded`; focus stays on the toggle |
| More sheet / drawer open | Move focus to the sheet heading or first item; make the content behind it `inert` (with an `aria-hidden` fallback); trap Tab within the sheet |
| More sheet / drawer close | Escape, close button, backdrop, or choosing a link. Return focus to the More button (or the trigger) unless navigation happens |
| Utility menu | Disclosure pattern: button with `aria-expanded`, list of links/buttons, Escape closes and returns focus. Drop `aria-haspopup="menu"` unless full menu keyboard behavior is built |
| Focus visibility | Visible `:focus-visible` outline meeting WCAG 2.2 contrast and not hidden by the fixed bottom bar |
| Current page | `aria-current="page"` on the current item; indicated by more than color (weight, marker or icon) |
| Touch targets | At least 44 × 44 CSS px for bottom-bar and sheet items |
| Layout | No horizontal scroll at 320 px; body padding for the fixed bar includes `env(safe-area-inset-bottom)` (as today) |

### 6.4 Planned, legacy, unavailable and restricted states

| State | Rendering | Keyboard |
|---|---|---|
| `planned` | Text with a visible "Planned" badge and `note`; no `href`; included in the accessible name ("What Changed, planned") | Not focusable |
| `legacy` | Normal link with a visible "Legacy" marker until parity is verified | Normal |
| Requires sign-in, user signed out | Link kept; destination page's existing auth redirect applies. Nav does not hide private destinations to imply security | Normal |
| Unavailable (e.g. entitlement missing) | Reserved state; shows the reason text. Not populated until ATD-004/101 entitlements exist | Not focusable |
| `restricted` (admin) | Not rendered in trader navigation | — |

Color is never the only indicator for any state.

## 7. Security and data boundaries for the nav shell

- Navigation is presentation only. Hiding an entry is never access control; server identity, ownership and entitlement checks remain mandatory (ATD-003 §6, Architecture 2.1 §8).
- The registry holds static same-origin relative paths only. The renderer refuses to output absolute URLs, `javascript:` URLs or anything not listed in the registry. It never reads a destination from the query string.
- The nav never puts tokens, provider keys, account IDs or other private payloads in URLs, and never forwards page query parameters.
- Plan (`ap_plan_v1`) and cached identity (`gs_auth_user_v1`) may drive display text only, never which features are allowed.
- The shell makes no network calls of its own. The existing `auth.getUser()` name refresh moves into the utility menu unchanged; whether it stays is part of the ATD-007 boundary (section 9).
- `schwab-callback.html`, `login.html`, `reset-password.html` and other auth/OAuth handlers are never wrapped, redirected or registered.

## 8. Recommended first migration slice

**Goal:** prove the registry and renderer on one low-risk page without touching the 34 other rail consumers.

**Prerequisite P1 (separate, small, can ship first or in the same PR):** make `portfolio-command.html` honor `?tab=` for its five existing tabs (`overview`, `holdings`, `income`, `performance`, `analysis`) with precedence over the remembered tab, matching `options-hub.html`'s pattern. Without it, the Performance link in both the old and new nav lands on the wrong tab. This is the one edit to a large legacy page in the plan, and it is limited to the tab-restore block at lines 6255–6283.

**Slice 1 — exact files**

| File | Change |
|---|---|
| `js/arowana-nav-registry.js` | New. Full registry from section 4 |
| `js/arowana-nav.js` | New. Renderer, active-state resolver, mobile bar, More sheet, focus management, injected styles built from existing tokens (`--brand`, `--border`, `--card`, `--text`, `--text-muted`), as `nav-rail.js` does today |
| `tools.html` | Replace its single `<script src="./js/nav-rail.js">` (line 4959) with the two new versioned scripts. Remove its page-owned drawer trigger only once the More sheet is verified |

**Why `tools.html`**

- It is an N1 consumer: no inline rail copy, no correction patch, no `MutationObserver`, no `#user-menu-toggle` account menu of its own, and it has the standard `#railMount` / `#sidebarDrawer` / `#sidebarTrigger` shell.
- In the approved hierarchy it is the Research ↳ Tool Directory child, so it exercises a child-level active state, a non-primary page and the More sheet's Research section in one page.
- It is a directory, not a trading workflow: no positions, journal data or broker state, so a regression costs least.
- The other 34 rail consumers (the remaining 26 N1 pages and the 8 N2 pages) are untouched, which keeps rollback to a one-line revert.

Slice 1 ships behind an opt-in (D10): on `tools.html` the new scripts load only when `localStorage.ap_nav_v2 === '1'`; otherwise the page keeps loading `js/nav-rail.js`, so ordinary users see no mixed navigation. From wave 2 the new navigation is on by default for migrated pages.

**Not in slice 1:** `js/nav-rail.js`, any N2 inline page, `js/auth-guard.js`, route redirects, any page outside `tools.html` (except P1).

## 9. Incremental rollout, compatibility checks and rollback

| Wave | Pages | Entry conditions | Notes |
|---|---|---|---|
| 0 | P1 on `portfolio-command.html` | — | Tab parameter only |
| 1 | `tools.html` | Acceptance tests (section 10) pass in a non-production environment | Section 8 |
| 2 | The 18 N1 pages with the standard shell and no `MutationObserver` or own account menu (corrected: `options-hub-creator` does not load the rail): `ai-moat-finder`, `atr-stop-planner`, `credit-spread-planner`, `dcf-analyzer`, `discipline-scorecard`, `dividend-tracker`, `expectancy-matrix`, `kelly-calculator`, `money-flow-alert`, `options-analyzer`, `r-multiple`, `risk-comfort`, `strategy-backtesting`, `tax-loss-harvester`, `technical-analysis`, `tool-audit`, `volatility-guardrails`, `trading-journal-analysis` | Wave 1 stable | Script-tag swap per page; can be grouped per PR. `tradingcommand.html` excluded (D5) |
| 3 | `trading-command.html` | Wave 2 stable | Remove inline rail **and** its correction patch together; replace `switchTab('positions')` coupling with `?tab=` links; call `ArowanaNav.setActive` from `switchTab` |
| 4 | `portfolio-command.html`, `options-hub.html`, `analysis-central.html`, `intrinsic-value.html`, `portfolio-advisor.html` | Wave 3 stable | Same pattern; `options-hub.html` must call `setActive` so Wheel vs Options highlights the visible tab |
| 5 | `arowana-trader.html` (hash tabs), `watchlist.html`, `scanner.html` (own account menu, absolute script path), `position-sizer.html`, `trade-plan-builder.html`, `wheel-strategy.html` (`MutationObserver` patches), `ai-morning-brief.html` (no drawer), `whale-tracker.html` (N3) | Per-page inventory of local nav code | Each needs a short per-page note in the compatibility ledger |
| 6 | `trade-journal-pro.html` | ATD-007 confirms what `js/auth-guard.js` still does for auth/session expiry | Remove inline rail + patch; `auth-guard.js` stays until ATD-007 owns its replacement |
| 7 | `tradingcommand.html` (N1, see D5), N4/N5/N7 families, legacy routes, desk landings, redirects | Route-family decisions (ATD-003 §3) and parity evidence | Out of ATD-008's first implementation task |
| Final | Retire `js/nav-rail.js` | No page loads it (verified by repository search) | Replace with a stub that loads the new scripts for any stale external reference, or delete if none exist |

**Compatibility checks per wave**

- Repository search shows the expected consumers of each nav script before and after the change.
- Every registry route resolves to an existing file (scripted check).
- Every one of the 29 current rail targets is still reachable from the migrated page through the new nav or `tools.html`, checked against the §4.2 mapping.
- `ap_rail_collapsed_v1` honored; account/support/sign-out still reachable.
- Each migrated page keeps its own tab deep links working (§2.4 table).
- No new console errors in DEV; no new entries in the ATD-001 missing-target list.

**Rollback**

- Per page: revert the script-tag change; the page returns to `js/nav-rail.js` (or its inline copy if the wave removed it, restored from Git). No data migration is involved, so rollback is a code revert only.
- The registry and renderer are new files; removing their script tags disables them completely.
- Never roll back by restoring browser-held provider keys, insecure credential paths or the stale `auth-guard.js` rail.

## 10. Acceptance tests

Run in a non-production environment only (section 11). None of these were executed by this documentation task.

**Registry and routing**

1. Every registry route path exists as a file; every `planned` entry has no route.
2. Six primary destinations render in approved order with approved labels; all five desks render under Strategy Desks; Growth renders as Planned.
3. Each of the 29 current rail links is reachable through the new nav or `tools.html` per §4.2.
4. `tradingcommand.html` does not mark Trading Command active (D5).
5. `options-hub.html?tab=puts` marks Wheel ↳ Cash-Secured Puts; `?tab=analyzer` marks Options ↳ Strategy Recommender; plain `options-hub.html` marks Options, then follows `setActive` once the page restores a remembered tab.
6. `portfolio-command.html?tab=performance` opens Performance (after P1) and marks Portfolio & Risk ↳ Performance.
7. `trade-journal-pro.html?from=trading-command` still returns to Trading Command; an unknown `from` value falls back to the default target.
8. `options-recommender.html#x` and `options-strategies.html#x` still forward with the hash (unchanged behavior).
9. Unregistered pages show no active primary item.

**History and state**

10. Back/Forward between two migrated pages restores the correct active item, including from back-forward cache, with the drawer/sheet closed.
11. On `arowana-trader.html`, Back after switching tabs updates the active state from the hash.
12. Refresh preserves active item and desktop collapse state.

**Desktop and mobile**

13. Desktop at 1280 px and 769 px: rail, collapse toggle, group toggles, utility menu.
14. Mobile at 320, 375 and 768 px: bottom bar shows Command, Watchlists, Portfolio, Journal, More in that order; no horizontal scroll; More reaches Research, all desks and utilities.
15. On a Research or Strategy Desks page, More shows the active marker.

**Accessibility**

16. Keyboard-only: reach every destination; open/close groups, More and utility menu; Escape closes and returns focus; focus trapped while the sheet is open.
17. Screen reader (one desktop and one mobile reader): landmark name, `aria-current`, `aria-expanded`, Planned/Legacy states announced.
18. Automated accessibility scan (e.g. axe) shows no new violations on migrated pages.

**Security and private data** (depend on ATD-007)

19. Signed-out user: private destinations follow the page's existing login redirect with a correct `next=`; no loop.
20. Two synthetic users: a private deep link opened by the other user shows not-found/forbidden without disclosure.
21. Account switching does not leave the previous account's context in nav state.
22. The renderer emits only registry paths; injected `?next=https://…` or `javascript:` values never become nav links.
23. No network requests from the nav shell other than the existing identity refresh.

## 11. Dependencies on ATD-007 (Codex-owned)

ATD-008 does not touch ATD-007 scope. These items block specific waves or tests:

| Dependency | Why | Blocks |
|---|---|---|
| Frontend DEV configuration that points at local Supabase instead of the hosted project | `js/config.json` and hard-coded fallbacks in `js/app-config.js` / `js/supabase-init.js` target the hosted `*.supabase.co` project. Opening rail pages as-is contacts it (`auth.getUser()` in the rail; page auth checks). The assignment forbids runtime testing against production | All browser acceptance tests with auth (tests 19–21) and any signed-in rendering; signed-out static rendering can be tested with network access to `*.supabase.co` blocked |
| Local Supabase restarted after credential regeneration, PostgreSQL security-version baseline resolved | ATD-007 currently has the local stack stopped and the image flagged | Same as above |
| Synthetic two-user accounts and reviewed ownership fixes (ATD-005 findings) | Private deep-link and account-switch tests | Tests 20–21; Accounts & Cash leaving Planned |
| Decision on `js/auth-guard.js` | It is loaded by `trade-journal-pro.html` and named in `login.html`'s session-expired flow, but now contains a stale rail | Wave 6 |
| Confirmation that the nav shell may keep the `auth.getUser()` name refresh | Identity code inside presentation code | Utility menu final form |

Test tooling: the repository has no package manager and must not gain one. Browser tests should run from tooling outside the repository (for example a separately installed Playwright against `python -m http.server`), with external network blocked unless a DEV backend is available. Choosing that tooling is D11.

## 12. Product decisions (approved 2026-10-02)

The owner approved the recommendation for every decision below on 2026-10-02. The "Approved resolution" column is now binding for implementation; reopening one needs a new owner decision.

| ID | Decision | Approved resolution |
|---|---|---|
| D1 | Wheel desk landing: `options-hub.html?tab=puts`, `wheel-strategy.html` or `arowana-trader.html` | `options-hub.html?tab=puts` now (working workflow), with `wheel-strategy.html` as a Legacy child until its parity review |
| D2 | Coaching surface: `trading-command.html?tab=coach` vs `arowana-trader.html`, and its label ("Wheel Coach" vs "Coach") | One entry labeled "Coach" pointing to `trading-command.html?tab=coach` from Command; `arowana-trader.html` reachable from Wheel until merged |
| D3 | Should Legacy pages (Swing, Long-Term, Morning Brief, Risk Rules) appear in the primary nav before they adopt the new shell? | Yes, with the Legacy marker, so desks are not empty |
| D4 | Accounts & Cash placement before ownership remediation | Planned until ATD-007/005 ownership fixes land |
| D5 | Treat `tradingcommand.html` as a legacy alias of Trading Command for highlighting | No; leave unhighlighted until ATD-003 merge inventory |
| D6 | Brand link for signed-in users: `index.html` (marketing) or `trading-command.html` | `trading-command.html` for signed-in users |
| D7 | Should Back close an open drawer/More sheet? | No; do not add history entries |
| D8 | Unify per-page tab history behavior (push vs replace vs none) | Separate task; out of ATD-008 |
| D9 | Remove the hamburger drawer once the More sheet exists | Yes, per page as it migrates |
| D10 | Slice 1 visible to everyone or behind `ap_nav_v2` opt-in | Opt-in for slice 1, default-on from wave 2 |
| D11 | Browser test tooling outside the repository | Separately installed Playwright + static server, network blocked; no repo dependency |
| D12 | Icons: keep emoji icons or move to an inline SVG set | Keep emoji for slice 1; decide before wave 3 |
| D13 | Tools group retirement: are all six current Tools-group links acceptable as contextual/Directory entries only? | Yes, per §4.2 |

## 13. Proposed task/status updates (for integration after review)

Not applied: the assignment forbids editing `PROJECT_STATUS.md` and `TASKS.md` during this parallel task.

**Proposed `TASKS.md` entry**

```markdown
### ATD-008 — Frontend navigation implementation specification

**Owner:** Claude Code

**Status:** Specification completed and owner-approved 2026-10-02, including decisions D1–D13. No navigation implemented.

**Branch:** `claude/ATD-008-navigation-implementation-spec`

**Result:** [Navigation implementation spec](docs/ATD-008_NAVIGATION_IMPLEMENTATION_SPEC.md): inventory of all 174 pages by navigation family, registry design, route/alias/query mapping, active-state and history rules, desktop/mobile/accessibility requirements, first slice (registry + renderer on `tools.html`, prerequisite `portfolio-command.html` `?tab=` support), rollout waves, acceptance tests, ATD-007 dependencies and open decisions D1–D13.

**Verification:** Static source inspection only; documentation links and referenced source paths checked; repository secret scan and whitespace checks. No browser, auth or production tests.

**Next:** Separately assigned implementation task for P1 and slice 1. Browser testing with auth waits for ATD-007's DEV frontend configuration.
```

**Proposed `PROJECT_STATUS.md` entry**

```markdown
## ATD-008 navigation implementation spec — owner-approved

Prepared [the implementation specification](docs/ATD-008_NAVIGATION_IMPLEMENTATION_SPEC.md) on `claude/ATD-008-navigation-implementation-spec` from `ca625bb`, in parallel with Codex's ATD-007. Static inspection found the shared rail in `js/nav-rail.js` (27 pages), byte-identical inline copies plus DOM correction patches on 8 core pages, an older rail inside `js/auth-guard.js` on `trade-journal-pro.html`, and a mobile bar that does not match the approved shortcuts. `portfolio-command.html` ignores `?tab=`, so the current Performance link cannot open Performance. Documentation only; no application, URL, Supabase or production changes. ATD-101 remains gated.
```

## 14. Verification performed for this document

- Read, in order: `PROJECT_STATUS.md`, `PROJECT_RULES.md`, `docs/ARCHITECTURE.md`, `TASKS.md`, `AGENTS.md`, `CLAUDE.md`, `docs/ARCHITECTURE_2_1.md`, `docs/ATD-003_CANONICAL_NAVIGATION_MAP.md`; also `docs/ATD-007_SECURITY_DEV_BASELINE.md` for dependencies.
- Static inspection: full read of `js/nav-rail.js`; targeted reads of `js/auth-guard.js`, `js/bottom-nav.js`, `js/app-config.js`, and the handler regions cited in §2 of `trading-command.html`, `options-hub.html`, `portfolio-command.html`, `trade-journal-pro.html`, `arowana-trader.html`, `whale-tracker.html`, `options-recommender.html`, `options-strategies.html`, `market-intelligence.html`.
- Scripted checks (results stated in §2): classification of all 174 HTML files into one family each; comparison of the 8 inline rail scripts against `js/nav-rail.js`; existence check of all 29 rail destinations and all `js/auth-guard.js` destinations; consumer counts for each nav script; search for `?tab=`/`from=`/history API handlers.
- Documentation checks: relative links and in-page anchors in this file resolve; every source path cited in this file exists; repository secret scan and Git whitespace check run on the branch.
- Not performed: browser rendering, mobile/desktop UI, keyboard or screen-reader behavior, authentication, deployed routes, any Supabase or provider call. All behavioral claims are from source reading.

## Appendix A — Every HTML page by navigation family

Generated by script from the 174 `*.html` files at `ca625bb`. Families are defined in §2.1. N6 is unused (the four `navbar` pages also carry `nav-links` and are counted in N5).

| Family | Count | Pages |
|---|---|---|
| N1 — Shared rail loaded from `js/nav-rail.js` | 27 | `ai-moat-finder.html`, `ai-morning-brief.html`, `atr-stop-planner.html`, `credit-spread-planner.html`, `dcf-analyzer.html`, `discipline-scorecard.html`, `dividend-tracker.html`, `expectancy-matrix.html`, `kelly-calculator.html`, `money-flow-alert.html`, `options-analyzer.html`, `options-hub-creator.html`, `position-sizer.html`, `r-multiple.html`, `risk-comfort.html`, `scanner.html`, `strategy-backtesting.html`, `tax-loss-harvester.html`, `technical-analysis.html`, `tool-audit.html`, `tools.html`, `trade-plan-builder.html`, `trading-journal-analysis.html`, `tradingcommand.html`, `volatility-guardrails.html`, `watchlist.html`, `wheel-strategy.html` |
| N2 — Inline copy of the rail plus "Rail correction" patch | 8 | `analysis-central.html`, `arowana-trader.html`, `intrinsic-value.html`, `options-hub.html`, `portfolio-advisor.html`, `portfolio-command.html`, `trade-journal-pro.html`, `trading-command.html` |
| N3 — Hand-built static rail | 1 | `whale-tracker.html` |
| N4 — `ap-nav-main`/`ap-nav-top` template header (inline copies) | 14 | `arowana-template.html`, `broker-connections.html`, `features-tools-directory.html`, `gap-and-go.html`, `intraday-breakout.html`, `long-term-dashboard.html`, `long-term-portfolio.html`, `master-journal.html`, `opening-drive.html`, `option-roll-tracker.html`, `position-sizer_fresh.html`, `short-term-template.html`, `trade-journal.html`, `trendline-break.html` |
| N5 — `nav-links` / `navbar` top bar (inline copies) | 52 | `about.html`, `account.html`, `advanced-trading-tools.html`, `ai-trading-agent.html`, `ai-valuation.html`, `asset-allocation-builder.html`, `assignment-risk.html`, `automated-trading-plan.html`, `base-breakout .html`, `base-breakout.html`, `bb-snapback.html`, `billing.html`, `blog.html`, `buy-sell-signal.html`, `checkout.html`, `contact.html`, `discipline-checklist.html`, `disclosures.html`, `dividend-screener.html`, `feature_body.html`, `features.html`, `guide-claude-tradingview-windows.html`, `learn-investing.html`, `login.html`, `momentum-hunter-complete.html`, `momentum-hunter.html`, `news-trading.html`, `option-trader.html`, `options-journal.html`, `orb-scanner.html`, `pattern-scanner.html`, `portfolio-tracker.html`, `pricing-revolutionary.html`, `pricing.html`, `privacy.html`, `refunds.html`, `reset-password.html`, `risk-disclosure.html`, `rvol-scanner.html`, `security.html`, `short-term-dashboard.html`, `short-term-watchlist.html`, `signup.html`, `sma-cross-scanner.html`, `stock-analyzer.html`, `support.html`, `swing-trader.html`, `template.html`, `template_new.html`, `terms.html`, `updated-navigation.html`, `wheel-calculator.html` |
| N7 — Page-local header or no shared navigation | 67 | `404.html`, `admin-usage.html`, `admin.html`, `ai_valuation.html`, `api-diagnostics.html`, `buy-a-home.html`, `chart-analysis-form.html`, `college-savings.html`, `cover-call-option-recommentor.html`, `daily-bias.html`, `daily-summary.html`, `daily-trading-post.html`, `dashboard.html`, `data-hygiene-audit.html`, `day-trade-scanner.html`, `daytrade.html`, `dca-planner.html`, `earning-watcher.html`, `education-529-planner.html`, `ema-snapback.html`, `etf-core-screener.html`, `factor-tilt-planner.html`, `feature_new.html`, `fee-analyzer.html`, `gap-fade-scanner.html`, `high-shortfloat-screener.html`, `hod-scanner.html`, `index.html`, `intrinsic-value-rsi.html`, `ips-builder.html`, `iv-watchlist-module.html`, `lap-pullback.html`, `long-term-intrinsic-value.html`, `long-term-watchlist.html`, `my-rules-long.html`, `my-rules-short.html`, `my-rules.html`, `my-watchlist.html`, `onboarding.html`, `option-recommender.html`, `option-roll-analyzer.html`, `overview.html`, `pick-my-mix.html`, `post-earnings-drift.html`, `quality-screener.html`, `real-estate-analyzer.html`, `retirement-calculator.html`, `retirement-planner.html`, `risk-calculator.html`, `risk-quiz.html`, `rsi-reversal-scanner.html`, `scalp-trading-screener.html`, `sector-sentiment-gauge.html`, `sector-sentiment.html`, `short-entry-screener.html`, `short-squeeze-scanner.html`, `stock-checker.html`, `task-template.html`, `tax-advantaged-guide.html`, `test_webhook.html`, `trade-ideas-ai.html`, `trade-scanner.html`, `volume-spike.html`, `vwap-pullback.html`, `weekly-swing-trade-post.html`, `wheel_strategy_web_tool.html`, `withdrawal-planner.html` |
| N8 — Salon `js/bottom-nav.js` | 1 | `settings.html` |
| N9 — Compatibility redirect | 3 | `market-intelligence.html`, `options-recommender.html`, `options-strategies.html` |
| N10 — OAuth callback | 1 | `schwab-callback.html` |
