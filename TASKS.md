# Arowana 2.0 Task Board

## COMPLETED â€” AWAITING REVIEW

### ATD-001 â€” Full repository feature audit
**Owner:** Codex

**Status:** Audit completed 2026-09-27; awaiting owner review of recommendations.

**Branch:** `codex/ATD-001-full-repository-audit`

**Goal:** Classify existing pages/modules as KEEP / MODIFY / MERGE / PORT / ARCHIVE / DELETE / SECURITY FIX; identify dependency clusters and canonical versions.

**Result:** [Repository audit](docs/ATD-001_REPOSITORY_AUDIT.md) inventories all 249 baseline files, including 211 individual HTML/JS/CSS/configuration rows, canonical recommendations, integrations, implied data models and migration priorities. No application functionality or production configuration changed; no legacy files deleted.

**Verification:** Existing secret check passed its limited patterns; a remaining credential-like Twelve Data literal was separately identified without reproducing its value. All 32 standalone JS files passed syntax checks; 477 inline blocks produced four existing syntax failures. Static HTML paths identified 80 missing targets across 230 occurrences. Full evidence and limitations are in the audit.

**Next:** Review ATD-001 recommendations alongside the separately assigned ATD-002 result below.

### ATD-002 â€” Secret and client-key migration inventory
**Owner:** Codex

**Status:** Inventory completed 2026-09-28; awaiting owner review. No remediation or follow-on task started.

**Branch:** `codex/ATD-002-secret-client-key-inventory`

**Goal:** Find every private provider credential path, localStorage key workflow, webhook exposure, and server-side migration requirement.

**Result:** [Secret and client-key inventory](docs/ATD-002_SECRET_CLIENT_KEY_INVENTORY.md) records credential classes, source/storage ledgers, key hydration and cleanup gaps, webhook trust boundaries, missing backend evidence, and migration requirements. Documentation only; no credentials rotated or production changes made.

**Verification:** Repository secret check passed its limited patterns. Additional redacted scans covered 250 baseline files, 16 DOCX XML/relationship members and 250 blobs across four reachable local commits; the remaining Twelve Data candidate was found in source/history. Nine source JWT literals decode to public anon role. No live credential or backend validation performed. See report for coverage and limitations.

**Next:** Owner review and credential-containment decision; recommended next assignment ATD-005 (schema/RLS audit), with ATD-004 contracts before provider migration. ATD-005 and ATD-004 were subsequently assigned separately.

### ATD-005 â€” Supabase schema/RLS audit
**Owner:** Codex

**Status:** Audit completed 2026-09-28; awaiting review. No remediation or follow-on task started.

**Branch:** `codex/ATD-005-supabase-schema-rls-audit`

**Goal:** Inventory tables/functions/RLS expectations referenced by the frontend and identify multi-user isolation gaps.

**Result:** [Schema/RLS audit](docs/ATD-005_SUPABASE_SCHEMA_RLS_AUDIT.md) combines source traces with read-only live metadata from the repository-matched Supabase project. Catalogued 470 relations (411 RLS-enabled base tables and 59 views); detailed inventory covers 51 scoped relations, 131 policies and 132 constraints. Identified watchlist policy composition, account-parent ownership gaps, credential storage exposure, schema drift and shared-project debt. Existing profile/usage/Edge auth protections are recorded.

**Verification:** Read-only catalog queries, security advisors, migration/deployment lists and three Edge Function source reviews; no application rows, stored secrets, production writes or endpoint invocations. Repository secret check and documentation diff checks passed; no two-user runtime isolation tests performed. See report for limitations.

**Next:** Review findings and containment decisions. Recommended next existing task ATD-004; remediation needs a separate scoped assignment. No follow-on started.

### ATD-004 â€” Data source inventory and contract
**Owner:** Codex

**Status:** Documentation completed 2026-09-28; proposed v0.1 contract awaiting review. No implementation or follow-on started.

**Branch:** `codex/ATD-004-data-source-inventory-contract`

**Result:** [Data source inventory](docs/ATD-004_DATA_SOURCE_INVENTORY.md) and [proposed Data Hub contract](docs/ATD-004_DATA_HUB_CONTRACT.md) map legacy provider/workflow paths to target datasets, versioned provenance, freshness, entitlements, error/fallback rules and DEV acceptance requirements. Preserved prior audit reports; no application or production changes.

**Verification:** All 206 first-party HTML/JS/JSON files covered by the source-signal inventory; official provider documentation consulted. Repository secret check, documentation fixture/redaction/reference checks and diff checks passed. No live provider, database, workflow or broker requests; no subscriptions or entitlements verified.

**Next:** Review provider/feed rights, freshness budgets, canonical data ownership and deployment/retention decisions. Recommended next existing Phase 0 task ATD-003. ATD-101 remains gated on contract approval and security remediation; no follow-on started.

### ATD-004 follow-up â€” Architecture 2.1 proposal

**Owner:** Codex

**Status:** User-requested documentation follow-up prepared 2026-09-28; awaiting owner review.

**Branch:** `codex/ATD-004-architecture-2-1`

**Result:** [Architecture 2.1](docs/ARCHITECTURE_2_1.md) translates the ATD-004 inventory and proposed contract into component boundaries, logical ownership, engine/AI responsibilities, secure migration stages and explicit owner decisions. Original inventory/contract preserved; no implementation or production changes.

**Verification:** Documentation links, repository secret scan and Git whitespace/scope checks; no runtime or provider tests apply to this documentation-only follow-up.

**Next:** Owner review of Architecture 2.1 and ATD-004 decisions. ATD-101 remains gated; ATD-003 remains unassigned.

### ATD-006 â€” Architecture 2.1 consolidation

**Owner:** Codex

**Status:** Completed â€” Architecture 2.1 including ATD-006A owner-approved 2026-09-29. ATD-004 approval remains separate.

**Branch:** `codex/ATD-006-architecture-2-1-consolidation`

**Result:** Reconciled the ATD-004-driven Architecture 2.1 engineering/data design with the AI Trading Floor addendum in [the consolidated proposal](docs/ARCHITECTURE_2_1.md). Integrated shared logical specialist roles, adversarial review, Chief synthesis, initial/final deterministic gates, hard risk veto and Trade Decision Records. The addendum remains unchanged historical/source evidence; baseline architecture and ATD-004 child contract remain unchanged.

**Verification:** Existing limited-pattern secret scan, Git whitespace/three-file scope checks, relative links, preserved-source comparison and requirement review. No application or production changes, credential-store access, or runtime tests. ATD-003 and ATD-101 not started.

**Next:** Stop for owner review of Architecture 2.1 and its open decisions. No automatic follow-on assignment.

### ATD-006A â€” Bind Reviews to Final Proposal Version

**Owner:** Codex; Claude Code follow-up commit on the same branch

**Status:** Completed â€” owner-approved 2026-09-29 with Architecture 2.1. ATD-006A merged through PR #7.

**Branch:** `codex/ATD-006A-bind-final-proposal-review`

**Result:** Clarified section 7 of [Architecture 2.1](docs/ARCHITECTURE_2_1.md): immutable proposal identity, assessment/snapshot/version bindings, invalidation after material changes, required recalculation and refreshed reviews, final-record bindings and the non-material presentation exception. The follow-up adds the nine-step revision sequence, NVDA v1/v2 example, proposal-change versus evidence-change handling, objection carry-forward, and section 9 tests / section 10 open decisions. No physical schema or implementation.

**Verification:** Documentation links, whitespace, existing limited-pattern secret scan and exact documentation-only scope checks. ATD-004 and the source addendum unchanged; no application or production changes. ATD-003 and ATD-101 not started.

**Next:** Owner review; do not merge automatically or begin follow-on tasks.

## COMPLETED â€” NAVIGATION MAP APPROVED

### ATD-003 â€” Canonical navigation map
**Owner:** Codex
**Depends on:** ATD-001  
**Status:** Map completed and labels/grouping owner-approved 2026-09-29. Architecture prerequisite approved; no navigation implementation performed.
**Goal:** Define Arowana 2.0 primary navigation without breaking legacy links.

**Branch:** `codex/ATD-003-canonical-navigation-map`

**Result:** [Canonical navigation map](docs/ATD-003_CANONICAL_NAVIGATION_MAP.md): hierarchy, desk mapping, legacy compatibility, mobile/accessibility rules and rollout acceptance. No application or production changes.

**Verification:** Documentation links, existing route references, whitespace, repository secret check and documentation-only scope. No browser/UI runtime tests.

**Approved refinements:** Research label; Growth desk with AI as a theme filter; distinct Options/Wheel and Portfolio/Journal responsibilities; contextual coaching/tools; mobile Command, Watchlists, Portfolio, Journal, More.

**Next:** Separate implementation assignment subject to relevant security/DEV gates. ATD-101 remains gated and unstarted.

## PLANNED AFTER PHASE 0

### ATD-007 â€” Security remediation and DEV baseline

**Owner:** Codex

**Status:** In progress â€” first repository containment/scanner slice implemented; local Supabase running 2026-09-30 with loopback bindings; database security-version review and ownership remediation remain open.

**Branch:** `codex/ATD-007-security-dev-baseline`

**Scope/result:** [Work record](docs/ATD-007_SECURITY_DEV_BASELINE.md). Removed the remaining key-like literal/direct quote call in the option-roll helper, added contextual secret detection and seven synthetic regression tests to CI. Credential revocation/history containment, client-key workflow migration and ATD-005 ownership remediation remain open. No production changes.

**Next:** Resolve local PostgreSQL security-version baseline, establish reviewed versioned backend definitions and validate remaining fixes with synthetic two-user tests. ATD-101 remains gated.

### Later implementation tasks

- ATD-101 Market Data Hub â€” PLANNED; gated on Architecture/Data Hub contract approval, provider/feed decisions, security remediation, entitlement/licensing decisions and a secure DEV baseline. Not started.
- ATD-102 Market Regime Engine
- ATD-103 Technical + POC Engine
- ATD-104 EPS Revision / Fundamental Engine
- ATD-105 Portfolio & Risk Engine
- ATD-106 Trading Command 2.0 MVP
- ATD-107 Morning Brief / What Changed
- ATD-108 Wheel module port from current Wheel-focused repo — see the ATD-108 section below

### ATD-108 — Wheel module port

**Owner:** Claude Code (frontend); backend pieces in the Codex lane

**Status:** COMPLETE 2026-10-05 (frontend). S1 #33, S2 #34, S3 #35, S4 #36, S5 #37, S6 #43; follow-ups: plan gates #38, option max risk #39, Wheel Calculator on phones #40, dead-code removal #41, Codex handover #42. Backend source in Git through Q6 (#44, Codex). Not yet checked against a live account.

**Branch:** `claude/ATD-108-wheel-port-spec` (spec); one `claude/ATD-108-*` branch per slice

**Result:** [Wheel port specification](docs/ATD-108_WHEEL_PORT_SPEC.md). Source is `exodonprofits/arowanaprofits` at `219e61f` (the Wheel Strategy Desk). The spec ports selected pieces in six slices and replaces no page wholesale:
1. single Supabase client and live access token (fixes the multi-client sign-out race and stale-token RLS reads);
2. journal manifest sync and journal fixes;
3. wheel ledger and campaigns panel;
4. Options Hub "Check a trade";
5. plain-English explanations and small fixes;
6. "Your wheel today", blocked until the edge-function source is in Git.

Wheel's nav rail, redirects and feature removals are not ported. `wheel-strategy.html` and `option-roll-tracker.html` stay. Decisions Q1–Q6 are in section 6.

**Approved:** 2026-10-04 (PR #32), Q1–Q6 as recommended.

**S1 auth foundation, branch `claude/ATD-108-s1-auth`:**
- one shared Supabase client on 41 pages (`js/sb.js`);
- live access token (`apGetAccessToken`);
- Wheel's `supabase-init`, `market-data`, `price-fetcher` and `setup-scorecard`;
- three nav pages moved off the CDN SDK.

Pages with more than one auth client: 9 on main, 0 now, apart from the parked `tradingcommand`.

**S2 journal reliability, branch `claude/ATD-108-s2-journal`:**
- `js/journal-sync.js` is Wheel's manifest sync: deletes propagate across devices, and a large unexplained gap (more than max(5, 20%) of the journal) is kept, not deleted;
- `trade-journal-pro.html`: "Delete All" deletes in chunks of 200, scoped to the session user; expired/assigned options settle with exit date and P&L; option strategies count in Setup & Strategy Performance; `?q=` and option prefill deep links; prices work without a personal Finnhub key;
- Wheel's rail, `lab/` links and nav changes are not ported.

Tests: `scripts/test_journal_sync.py`, `scripts/browser/journal_sync_check.mjs` (23 checks, synthetic data; main fails 15).

**Max-risk fix, branch `claude/ATD-108-max-risk`:** the Trade Journal option form showed "Unlimited*" risk for every credit trade (including cash-secured puts) and "Unlimited*" profit for every debit trade. It now computes both from the trade type and strategy. Tests: `scripts/test_option_preview.py`, `scripts/browser/option_preview_check.mjs` (19).

**S3 wheel ledger, branch `claude/ATD-108-s3-ledger`:**
- `js/wheel-ledger.js` and its Node tests; new `Node Tests` workflow;
- Portfolio Command Income tab: Wheel campaigns panel replaces "Cost basis after premium"; expired/assigned count as settled;
- Add / Edit / Delete Holding write journal lots (they wrote the retired `portfolio` table, so saves never showed); a holding made of several buys links to them in the journal.

Tests: `tests/wheel-ledger.test.js` (10), `scripts/browser/portfolio_ledger_check.mjs` (15). Follow-up: Portfolio Command "Import CSV" still writes `portfolio`.

**S4 check a trade, branch `claude/ATD-108-s4-trade-check`:**
- `js/trade-check.js` and its Node tests; Wheel's `js/risk.js` (rules in `ap_risk_settings.rules`, which exists in production);
- Options Hub "Check a Trade" tab (`?tab=check`), rules editor, "Check this trade" on every Calls/Puts card, "Log it" into the journal; nav entry `wheel-check`.

Tests: `tests/trade-check.test.js`, `scripts/test_trade_check.py`, `scripts/browser/trade_check_check.mjs` (16). Follow-up: `ap_risk_settings` has no migration in this repo (Q6).

**S5 explanations + fixes, branch `claude/ATD-108-s5-explain`:**
- `js/explain.js`: "Explain in plain English" (Portfolio Command Income) and "Argue both sides" (Check a Trade), via the deployed `arowana-explain` (Pro, server-side number guard, text rendering);
- Wheel Calculator: covered-call kept-shares row measured from cost basis; result column fits;
- `scanners.js` plan from `plan.js` (now loaded on `scanner.html`); `ap_is_pro_v1` shortcut removed;
- removed the dead Twelve Data ticker (`option-roll-tracker`) and the 404 script tag (`options-hub`).

Tests: `scripts/test_explain_fixes.py`, `scripts/browser/explain_fixes_check.mjs` (19). Follow-ups: seven pages still read `ap_is_pro_v1`; calculator header overflows at 375px.

**Plan gates follow-up, branch `claude/ATD-108-plan-gates`:** seven pages decided Pro from `ap_is_pro_v1`, which nothing sets (Pro users treated as Free; Pro unlockable from the console). They now use `js/plan.js`; `long-term-dashboard` loads the real SDK. Tests: `scripts/test_plan_gates.py`, `scripts/browser/plan_gates_check.mjs` (28; main fails 10).

**Phone fix, branch `claude/ATD-108-mobile-fixes`:** the Wheel Calculator scrolled sideways on phones (a plain `1fr` grid track grew to its widest no-wrap table); the scenario table now fits at 375px and 320px. Checked in `scripts/browser/explain_fixes_check.mjs`.

**Dead-code cleanup, branch `claude/ATD-108-dead-code`:** removed Portfolio Command's unused CSV wizard and old `portfolio` fetch (about 1,560 lines; Import CSV already opens Trade Journal Pro's importer) and long-term-dashboard's section locks for sections the page does not have. `scripts/test_portfolio_source.py` keeps Portfolio Command off the retired `portfolio` / `portfolio_options` tables.

**S6 "Your wheel today", branch `claude/ATD-108-s6-wheel-today`:** done on the frontend. `js/digest.js` is a copy of the deployed digest module, used by `js/wheel-status.js`. Arowana Trader gets the panel (above the Morning Brief; the scan stays), and both coaches get the wheel summary as context. Tests: `tests/digest.test.js`, `scripts/test_wheel_today.py`, `scripts/browser/wheel_today_check.mjs` (14).

**Next:** backend Q6 (Codex): bring the edge functions and migrations into Git. Handover: [ATD-108 Codex handover](docs/ATD-108_CODEX_HANDOFF.md).

### ATD-007 continuation - 2026-10-01

Runtime credential containment took priority after generated secrets were found tracked in merged main. Three runtime paths removed from index; CI tracking guard added; affected local stack stopped with volumes preserved. Nine tests, guard, secret scan and whitespace checks passed. Credential rotation/history containment and PostgreSQL/schema work remain open. No production changes or ATD-101 work. Details: [ATD-007 work record](docs/ATD-007_SECURITY_DEV_BASELINE.md).

### ATD-008 — Frontend navigation implementation

**Owner:** Claude Code

**Status:** COMPLETE 2026-10-03. Spec owner-approved 2026-10-02 (PR #14, decisions D1–D13); slice 1 and waves 2–6 merged (PRs #15–#20); close-out on `claude/ATD-008-nav-closeout`. All 33 signed-in pages that carried the rail now use the registry navigation by default, with `localStorage.ap_nav_v2 = "0"` as a per-browser fallback.

**Result:** [Implementation spec](docs/ATD-008_NAVIGATION_IMPLEMENTATION_SPEC.md). Slice 1 adds the data-only registry `js/arowana-nav-registry.js` and renderer `js/arowana-nav.js` (six approved destinations, five desks, Planned/Legacy states, mobile Command/Watchlists/Portfolio/Journal/More with a focus-managed More sheet). `tools.html` loads them only when `localStorage.ap_nav_v2 === "1"`, otherwise `js/nav-rail.js` as before. Prerequisite P1: `portfolio-command.html` now honours `?tab=` ahead of the remembered tab. `js/nav-rail.js`, the eight inline rail copies and `js/auth-guard.js` are untouched.

**Verification:** `scripts/test_nav_registry.py` (8 tests: approved structure, safe and existing routes, opt-in loader) plus existing CI tests, tracking guard and secret scan. Browser checks in `scripts/browser/nav_v2_check.mjs` (71 checks, Chromium via a separately installed Playwright, all non-localhost requests blocked): default page unchanged, desktop rail and active state, 15 active-state URLs, mobile bar at 320/375/768 px, More sheet focus trap/inert/Escape/focus return, Back navigation, `portfolio-command.html` tab precedence. No production, Supabase or signed-in session testing (waits on ATD-007's DEV frontend config).

**Wave 2 (2026-10-03, `claude/ATD-008-nav-wave-2`, stacked on slice 1):** new shared `js/nav-loader.js` makes the registry navigation the default (D10) on `tools.html` plus 18 tool pages; `localStorage.ap_nav_v2 = "0"` opts a browser back to `js/nav-rail.js`, and one constant in the loader rolls every migrated page back. `options-hub-creator.html` was excluded: it does not load the rail (spec corrected). Verified: 18 registry/loader unit tests; 204 local browser checks including, for each of the 19 pages, six primaries, expected current item, mobile bar, hidden hamburger, no new horizontal overflow and no new page errors versus the old nav, and the opt-out path. Not tested signed-in (ATD-007).

**Wave 3 (2026-10-03, `claude/ATD-008-nav-wave-3`):** `trading-command.html` now loads the navigation through `js/nav-loader.js`. Removed its inline rail copy, the post-render "Rail correction" patch and the collapse-label observer (687 lines, menu-only code). `switchTab()` reports the visible tab to the nav (the page restores the last tab without a URL change), and nav links to `?tab=positions` / `?tab=coach` switch in place as the old Positions item did. Renderer: the account toggle now tolerates pages that attach their own handler (same guard `js/nav-rail.js` used), and `window.ArowanaNavPreset` lets a page set the current item before the nav loads. Verified: 18 unit tests; 227 local browser checks including fresh, remembered-tab and `?tab=coach` highlighting, in-place tab switching without reload, account menu with both handlers attached, mobile bar; zero page or console errors before vs after on desktop and mobile. Not tested signed in (ATD-007).

**Wave 4 (2026-10-03, `claude/ATD-008-nav-wave-4`):** `portfolio-command.html`, `options-hub.html`, `analysis-central.html`, `intrinsic-value.html` and `portfolio-advisor.html` now load the navigation through `js/nav-loader.js`; their inline rail copies, correction patches and rail-label observers are removed (about 3,400 lines; `analysis-central.html` keeps its clock). `portfolio-command.html` and `options-hub.html` report their visible tab to the nav and switch tabs in place from nav links. Registry: a plain `options-hub.html` visit opens Covered Calls, so it now highlights Wheel › Covered Calls; "Portfolio Overview" links to `?tab=overview` so it never reopens a remembered tab. `portfolio-advisor.html` keeps its own `signOut()`/`openSupport()`. Verified: 18 unit tests; 282 local browser checks; page/console error counts and horizontal overflow unchanged versus `main` on all five pages, desktop and mobile. Not tested signed in (ATD-007).

**Wave 5 (2026-10-03, `claude/ATD-008-nav-wave-5`):** `arowana-trader`, `watchlist`, `scanner`, `position-sizer`, `trade-plan-builder`, `wheel-strategy` and `ai-morning-brief` now load `js/nav-loader.js`. Removed `arowana-trader`'s inline rail copy and correction patch and the rail-label observers in `watchlist` and `wheel-strategy`. Kept page-owned account code (`position-sizer`, `trade-plan-builder`, `watchlist`'s header menu). `arowana-trader.html` has no `#railMount` (its sidebar is the coach panel), so it gets the new mobile bar and More sheet while its desktop top link bar is unchanged. `ai-morning-brief`'s hamburger is hidden on mobile via a new `data-nav-drawer-trigger` opt-in. `whale-tracker.html` was excluded: its sidebar is a coach workspace panel, not navigation, and ATD-003 lists it for merge into contextual coaching.

**Wave 6 (2026-10-03, `claude/ATD-008-nav-wave-6`):** `trade-journal-pro.html` now loads `js/nav-loader.js`; its inline rail copy, correction patch and rail-label observer are removed, and it no longer loads `js/auth-guard.js`. Static review found that file contains only an outdated copy of the rail (no session check, no redirect, no `expired` handling); loaded deferred, it re-rendered the rail after the page's own. No file produces `login.html?expired=1`, so `login.html`'s session-expired banner is already unreachable. `switchTab()` reports Stock/Option vs Stats to the nav and nav links switch tabs in place. A unit test now fails if any page loads `auth-guard.js`. The file itself is left for ATD-007.

**For ATD-007 (Codex):** `js/auth-guard.js` is unused after wave 6 and can be deleted; the `?expired=1` banner in `login.html` has no producer. Neither is changed here.

**Close-out (2026-10-03, `claude/ATD-008-nav-closeout`):** the 14 tool pages that are not menu items get a registry `homes` entry, so their section (Research, Options desk, Portfolio & Risk, Journal & Review or Trading Command) is expanded and marked as containing the page, without `aria-current`. A unit test requires every migrated page to be either a menu item or have a home.

**Remaining (owner decisions, defaults kept):** `whale-tracker.html` stays as-is pending the ATD-003 coaching merge; `arowana-trader.html` keeps its desktop top link bar; `tradingcommand.html` stays unmigrated (D5). `js/nav-rail.js` remains as the `ap_nav_v2 = "0"` fallback and for `tradingcommand.html`.

### ATD-009 — Legacy page review (keep / merge / retire)

**Owner:** Claude Code

**Status:** COMPLETE 2026-10-05. Every group is done: phases 1–3c (including `option-roll-tracker`, #46), group E in 4a/4b/4c (#47, #49, #50) and group M deleted from `main` (#52). Review approved 2026-10-03 with Q1–Q5; Q3 changed to deletion on 2026-10-05.

**Branch:** `claude/ATD-009-legacy-page-review`

**Result:** [Legacy page review](docs/ATD-009_LEGACY_PAGE_REVIEW.md) assigns each of the 141 pages outside the new navigation to one of 14 groups with one recommended action per group (keep, adopt nav, merge, retire to a redirect, archive, defer), building on ATD-001's per-page proposals. Finding: almost all live links to these pages come from the internal `tool-audit.html`; the user-facing Tool Directory links to one. Standalone scanner pages show demo/random rows or depend on webhooks. Proposed order: archive scaffolds and Salon pages, retire duplicate catalogues and put four registry-linked pages on the menu first; journal/watchlist/portfolio duplicates last, after ATD-005/007 ownership fixes.

**Verification:** All 141 pages matched to ATD-001 rows and assigned to exactly one group by script; inbound links, sitemap entries and scanner capability counted from source; documentation links, secret scan and whitespace checks. No browser, data or hosting checks.

**Next (originally):** Phase 1 — archive group M (pending one hosting check, Q3), retire duplicate catalogues (L), put the four registry-linked pages on the new navigation (C).

**Phase 1 (C + L), branch `claude/ATD-009-phase-1`:** `swing-trader`, `long-term-dashboard`, `my-rules` and `data-hygiene-audit` now load the new navigation. They had no sidebar, so they mark `<body data-nav-shell>` and `js/arowana-nav.js` builds the left rail itself; their own top links are tagged `data-nav-legacy` and hidden only while the new navigation is on (`long-term-dashboard` keeps its account dropdown). Opting out (`ap_nav_v2 = "0"`) loads nothing on these pages, so they look exactly as before. The four duplicate catalogues (`advanced-trading-tools`, `features-tools-directory` → `tools.html`; `feature_body`, `feature_new` → `features.html`) are redirect stubs that keep the query string and hash; links in `watchlist`, `retirement-planner`, `guide-claude-tradingview-windows` and the `tool-audit` list now point at the targets. Rollback: restore the previous files. **Group M (archive) is not done:** it needs the Cloudflare Pages build command and output directory confirmed (Q3).

**Phase 2 (part), branch `claude/ATD-009-phase-2`:** the 26 standalone scanner pages (group F) are redirect stubs to `scanner.html?scan=<id>`. `scanner.html` now opens the scan named in `?scan=`, and `js/scanner-defs.js` registers the 16 scans that had no entry, plus `dividend_safety`, as pending scans that keep their main filters. `risk-calculator` and `position-sizer_fresh` redirect to `position-sizer`, `my-rules-short` to `my-rules` (same saved keys) and `dividend-screener` to its pending scan. Links updated in `long-term-dashboard`, `tools`, the `tool-audit` list and `trade-journal-pro`'s back button. **Held:** 9 H/I pages whose function the target does not cover (see the ATD-009 progress table). The owner approved moving their features into the target first, one PR per target page.

**Phase 2b, branch `claude/ATD-009-phase-2b`:** `automated-trading-plan` and `news-trading` (demo-only) redirect to `trade-plan-builder`; `stock-checker` redirects to `intrinsic-value` because its source carried an n8n webhook token. **Owner action:** rotate that token in n8n, since it remains in git history.

**Rules merge, branch `claude/ATD-009-rules-merge`:** `my-rules.html` gains Long-term rules and Habits tabs (`?tab=longterm|habits`) that keep `my-rules-long` and `discipline-checklist`'s saved keys. Both old pages redirect to their tab. The discipline checklist's share-link import was dropped: it was a stored XSS. Remaining held pages: 7 (Intrinsic Value models ×3, Ticker Research AI ×2, quality screener, buy/sell signal).

**Valuation models, branch `claude/ATD-009-iv-models`:** `intrinsic-value.html` gains a **More models** section with Graham Number, Residual Income, EPV, P/E multiple and FCF DCF as reference cards. `ai-valuation`, `intrinsic-value-rsi` and `long-term-intrinsic-value` redirect to it. Remaining held pages: 4 (`stock-analyzer`, `chart-analysis-form`, `quality-screener`, `buy-sell-signal`).

**Research AI tools, branch `claude/ATD-009-research-ai`:** `analysis-central.html` gains an **AI Analysis** tab (`?tab=ai`) with the AI scorecard and chart analysis. `stock-analyzer` and `chart-analysis-form` redirect to it. **Owner action:** add a `stock_analyzer` webhook to `AP_WEBHOOKS` (admin) so the scorecard works for every user. Until then it only works where a URL was saved on the old page. Remaining held pages: 2 (`quality-screener`, `buy-sell-signal`).

**Quality screen + signal, branch `claude/ATD-009-quality-signal`:** `quality-screener` becomes the **Quality Compounders** scan (real run via an n8n `quality_screener` webhook, with the old thresholds and ranking). `buy-sell-signal` becomes **Signal check** in Trade Plan Builder (`AP_WEBHOOKS.signal`, as before). Groups H and I are complete. **Owner action:** add a `quality_screener` webhook to `AP_WEBHOOKS`; until then the scan explains that it is not connected.

**Phase 3 (part), branch `claude/ATD-009-phase-3`:** the phase 3 feature and saved-data inventory is in the ATD-009 progress table. Retired: `daytrade`, `earning-watcher` (→ Trading Command), `ai-trading-agent` (→ Arowana Trader), `sector-sentiment`, `sector-sentiment-gauge` (→ Morning Brief), `option-recommender`, `option-trader` (→ Options Hub), `wheel_strategy_web_tool` (→ Wheel Strategy, which now opens `?tab=`). **Phase 3b (owner-approved), branch `claude/ATD-009-phase-3b`:** `short-term-dashboard` → Trading Command; its saved signals (`arowana_journal_v1`) are listed in Trade Plan Builder's new Saved signals card. `daily-bias` → Trade Plan Builder, `daily-summary` → Morning Brief, `option-roll-analyzer` → Options Hub Roll Coach. **Phase 3c, branch `claude/ATD-009-roll-tracker`:** `option-roll-tracker` → Trade Journal Pro's Option Trades (rolls, chain P/L, Find Rolls). Its saved chains (browser save, and 2 `option_roll_chains` rows in production) are listed with CSV/JSON downloads before the redirect; nothing is migrated or deleted. Check: `scripts/browser/roll_tracker_check.mjs` (19), `scripts/test_roll_tracker_retired.py`. **Phase 4a, branch `claude/ATD-009-phase-4`:** group E inventory done (see the ATD-009 progress table). `master-journal` → Trade Journal, `portfolio-tracker` → Portfolio Command, `short-term-watchlist` and `long-term-watchlist` → Watchlist, which already reads their saved data. Check: `scripts/browser/phase4_redirects_check.mjs` (13), `scripts/test_phase4_redirects.py`. **Open:** four browser-only pages need an export/import step; `long-term-portfolio` (37 `portfolio` rows) needs an owner decision.


**Phase 4b (owner-approved 2026-10-05: import button), branch `claude/ATD-009-ltp-import`:** `long-term-portfolio` could no longer load or save: it used `ticker`/`shares`/`avg_cost`/`price` columns that `public.portfolio` does not have. The 37 production rows (3 accounts) came from Portfolio Command's earlier Add Holding (`symbol`, `shares_owned`, `avg_cost_basis`), and nothing reads them since Portfolio Command moved to journal lots; 12 holdings across 2 accounts have no open journal lot (counts only, read-only). The page now lists the signed-in user's rows and imports the ticked ones as open stock lots through `js/journal-sync.js`, as Add Holding does; symbols already open in the journal start unticked; CSV download; the `portfolio` rows are never changed. No rows → Portfolio Command. Check: `scripts/browser/ltp_import_check.mjs` (22), `scripts/test_ltp_import.py`.

**Phase 4c, branch `claude/ATD-009-phase-4c`:** the four browser-only pages. `trade-journal` (`ap_trade_journal_v1`) and `options-journal` (`oj_trades_v1`) list the trades saved in that browser, with CSV download, and add the ticked ones to Trade Journal Pro through `js/journal-sync.js` (shared `js/legacy-journal-import.js`; fields and P&L as `saveStock`/`saveOpt`; trades matching one already in the journal start unticked; non-stock rows of the stock journal are download-only; sign-in required to import; the old saves are never changed). `my-watchlist` (`arowana_watchlist_v1`) and `iv-watchlist-module` (`ap_iv_watchlist_tickers`) redirect to Watchlist, which imports their symbols once as trade ideas, like the long-term import; the IV module was never wired into Options Hub and its IV history was demo data, so it is not carried over. Check: `scripts/browser/phase4c_check.mjs` (37), `scripts/test_phase4c.py`. Group E is complete once 4a/4b/4c merge.

**Group M (owner-approved 2026-10-05: delete), branch `claude/ATD-009-group-m`:** the 18 scaffolds, prototypes and Salon pages are deleted from `main` (`test_webhook` posted to an external webhook; `dashboard`, `overview` and `settings` are Salon Genie pages). An `archive/` folder would still be published, because the site serves the repository root with no build step. Exact-name search found no links from live pages; the `tool-audit` list drops `weekly-swing-trade-post`, and two guard tests stop reading `short-term-template`. Restore any page with `git checkout b5fc057b1309d7d855cbd0f84598811eb213d665 -- "<page>.html"`. Check: `scripts/test_group_m_deleted.py`. **ATD-009 is complete.**

### ATD-108 Q6 - Deployed backend into Git (ATD-007 lane)

**Owner:** Codex; **Reviewer:** Claude Code.

**Branch:** `codex/ATD-108-q6-backend`

**Status:** Merged (PR #44) and reviewed by Claude Code after merge on 2026-10-05. No deploys. [Report and limitations](supabase/baselines/README.md).

**Result:** Nine deployed functions, three helpers, version/hash manifest, exact frontend digest parity, scoped baseline for 28 tables/five views with RLS/grants/RPCs, unchanged Wheel guard tests, expanded backend secret scan. Schwab callback defect flagged without changing the page.

**Verification:** Python 59/59; TypeScript syntax checks 9/9; secret scan, tracking and whitespace pass. Node 38/39; existing backend/frontend Founders-price disagreement newly exposed by copied tests. No live endpoints, rows, production writes, migration replay or deployment.

**Review (Claude Code, 2026-10-05):** no keys, tokens or table rows in the capture (the only address is the public digest sender); `js/digest.js` identity check passes; the baseline migration is a non-applying snapshot that refuses to overwrite existing relations. The `verify_jwt: false` functions spot-checked (`arowana-research`, `arowana-coach`, `arowana-billing-portal`) authenticate the caller themselves; `arowana-research` also allowlists paths and meters usage.

**Founders price (superseded):** the owner first chose **$229/year** (#45), matching the deployed checkout; the later instruction is $299/year (#48, below). Branch `claude/ATD-108-founders-229` updates `checkout.html`, `pricing.html`, `index.html`, `account.html` and `billing.html`, which turns the Node Tests check green (39/39).

**Next:** dependency baselines and ATD-007 security work remain open. Before the baseline migration is ever applied, its preflight must also refuse (or match) the 16 functions it creates with `CREATE OR REPLACE`; several are shared outside Arowana (`public.set_updated_at()` runs 44 triggers, including Salon tables). Do not apply the baseline migration or deploy automatically.


### ATD-108 - Founders $299 pricing follow-up

**Owner:** Codex. **Reviewer:** Claude Code.

**Branch:** `codex/ATD-108-founders-299`

**Status:** Merged (PR #48) 2026-10-05. **Not deployed, on purpose:** `arowana-checkout` v14 in production checks Founders against 22900, which matches the live site (the Wheel Desk on arowanaprofits.com, $229). V2.0 is not public yet. Deploy the $299 guard and switch `STRIPE_PRICE_FOUNDERS` only in the ATD-109 cutover window; deploying earlier would refuse Founders checkouts on the live Wheel Desk.

**Result:** Five frontend pages and both Founders backend guard aliases aligned to $299 annually. Tests cover acceptance, legacy-price rejection and displayed-price consistency. Captured deployed hashes remain intact; the changed guard has separate repository provenance.

**Verification:** Node 40/40; Python 63/63; secret scan, runtime tracking and whitespace checks pass. No live browser checkout, Stripe or deployment tests. No production changes.

**Next:** Claude Code reviews the pricing PR. Verify Stripe's active USD $299 yearly price and coordinate backend/frontend publication separately. Do not migrate existing subscriptions or deploy automatically. ATD-007 security work remains open.

### Small fixes - 2026-10-05

**Owner:** Claude Code; **Branch:** `claude/ATD-009-typo-retirement-ai`; merged (PR #51).

- `index.html`: "Free, Pro and Pro" → "Pro at $29/month" (link to pricing); "Pro and Pro are still open" → "Free and Pro are still open". The plans are Free, Pro and Founding Member.
- `retirement-planner.html`: the managed AI write-up was a `null` webhook placeholder, and the page never loaded `plan.js`, so Pro users never reached it. It now loads `app-config.js`, `sb.js`, `plan.js` and `explain.js`, re-renders once the plan is known, and sends the computed roadmap as label/value facts (≤40; inputs, and each scenario's savings, income and gap; never the free-text location) to `arowana-explain` with kind `retirement`. Metered with the other explanations. A deployment without that kind answers "Nothing to explain.", which the page shows as "not switched on yet". BYOK is unchanged. "Pro, Elite, and Founders" → "Pro and Founding Member".
- `supabase/functions/arowana-explain/index.ts`: additive `retirement` entry in `KINDS` (the system prompt is written for traders, so the kind text says these are not trading figures). **Not deployed.** `ATD108_functions.json` records its `repository_sha256_lf` with the reason, as for the Founders guard.
- Checks: `scripts/browser/retirement_ai_check.mjs` (21), `scripts/test_retirement_ai.py`; `plan_gates_check.mjs` now expects a Pro account to get the managed tier here (28).

**Owner/Codex action:** deploy `arowana-explain` from main to turn the managed write-up on.

### Schwab connection: coming soon - 2026-10-05

**Owner:** Claude Code; **Branch:** `claude/ATD-009-status-schwab`.

- `broker-connections.html` (in the navigation as "Broker Connections") showed a sample state as if real: "Connected", "Schwab Taxable, Schwab IRA", "Last sync Today 6:12 AM", a sync history table and a "Connect Schwab" button that did nothing. Its main section now says Schwab is coming soon, that nothing is connected or read, and links to the journal's CSV import (`trade-journal-pro.html?action=import`). Header, menu, sign-in and footer are unchanged.
- `schwab-callback.html` posted to `schwab-auth-callback`, which was never deployed, at a site-relative URL, and imported `../js/supabase-init.js` from outside the site root, so no connection could complete. It is now a static notice: its only script removes any `code`/`state` from the address bar, and it sets `no-referrer`.
- The status files are brought up to date (ATD-108 and ATD-009 complete, the Founders price history, the open owner/Codex actions).
- Check: `scripts/test_schwab_coming_soon.py`, `scripts/browser/schwab_coming_soon_check.mjs`.

**When Schwab is built:** decide where the OAuth exchange runs (a Supabase function, or the n8n flow the old Broker Connections page described) and replace both pages.

### ATD-109 — Launch V2.0 on arowanaprofits.com

**Owner:** Claude Code (site changes, deploy workflow, drafts); owner (decisions D1–D5, legal wording, staging test, cutover window).

**Status:** Planned 2026-10-05. Nothing deployed. **Branch:** `claude/ATD-109-cutover`.

**Result:** [Cutover plan](docs/ATD-109_CUTOVER_PLAN.md) and [gap inventory](docs/ATD-109_CUTOVER_INVENTORY.md). arowanaprofits.com serves the Wheel Desk from Bluehost (FTPS workflow in `exodonprofits/arowanaprofits`, with a `staging` target at `/staging/`); both sites share one Supabase project and its functions. All 33 public Wheel pages exist in V2.0. Before staging: a V2.0 deploy workflow with an allowlist (never `documents/`), `_redirects` for `/lab/*`, a root `robots.txt`, relative asset paths on six pages, the Account email-preferences section the digest links to, and updated Privacy/Terms/Disclosures. Should: sign-up `next` carry-over and same-site check (open redirect today), onboarding fixes, dead `docs.html` link.

**Correction:** the Founders `$299` guard must be deployed in the cutover window, not before (see the Founders entry above).

**Decisions (2026-10-05):** D1–D5 as recommended.

**Deploy and site config, branch `claude/ATD-109-deploy`:** `.github/workflows/deploy-bluehost.yml` (adapted from the Wheel repo's: same secrets, `staging`/`production` targets, secret scan, `.htaccess` from `_redirects`, served-commit check; uploads only top-level pages, `robots.txt`, `sitemap.xml`, `css/`, `js/`, `images/`; refuses `.docx`; keeps the Wheel state-file name so the first production deploy removes Wheel's `lab/`). `_redirects`: `/market-intelligence` and the 29 `/lab/*` pages to their root twins. `robots.txt` at the root (from the old `documents/` copy, plus `/lab/`, `/staging/` and admin pages). `documents/` removed (D5). 34 root-absolute `/js/` paths on 11 pages and two JS redirects made relative, so `/staging/` never loads the live site's files. Dead `docs.html` link removed (sitemap, home footer, features). One code comment reworded: the workflow's secret scan matched the words "service_role" in `trading-command`/`tradingcommand`. Check: `scripts/test_deploy_config.py`; the workflow's build, scan and `.htaccess` steps run locally (221 files, anon keys only, 32 redirects); the built site served under `/staging/` requests nothing outside it on 16 pages.

**Email preferences, branch `claude/ATD-109-email-prefs`:** Account gets Wheel's Email section (`#email`, the target of the digest's "Email settings" link): three opt-in toggles (weekday morning, expiration week, monthly statement) saved to `ap_email_prefs`, and a preview of each built by `arowana-digest` from the user's own journal (returned, never sent) in a sandboxed frame. Ported unchanged except the plan list (no Elite plan). The browser test harness now skips frames without storage (sandboxed previews). Check: `scripts/browser/email_prefs_check.mjs` (15), `scripts/test_email_prefs.py`.

**Sign-up redirect, branch `claude/ATD-109-signup-next`:** `signup.html` followed any `?next=` (an open redirect: a signed-in visitor was sent to `https://…`, `//…` or `/\…` off-site; confirmed on `main`). It now uses Wheel's `apSafeNext` (same-origin `.html` only) for the redirect and the email-confirmation link. `login.html` carries `next` into "Create one free", so a new buyer goes from checkout through sign-up back to checkout; the banner reads "One step before checkout" instead of "Pro — $19/mo". Check: `scripts/browser/signup_next_check.mjs` (13), `scripts/test_signup_next.py`.

**Onboarding and Free-plan copy, branch `claude/ATD-109-onboarding`:** ported Wheel's onboarding fixes. Re-running setup no longer requires picking new tickers: it shows the saved Want-to-Own list and pre-fills the limits. Limits are saved through `AP_RISK`, so puts per ticker, the earnings warning and Check a Trade rules are kept (the direct upsert reset them). The CSV link uses `?action=import`. V2.0's schedule copy is kept. D2: pricing already shows CSV import, export and income as Pro; the support FAQ now says so. Check: `scripts/browser/onboarding_check.mjs` (14; fails on `main`), `scripts/test_onboarding_plan_copy.py`.

**Legal pages (wording approved by owner), branch `claude/ATD-109-legal`:** Privacy, Terms and Disclosures take the Wheel Desk's newer wording (live on arowanaprofits.com) and add V2.0's own AI features, traced in code: OpenAI through `arowana-ai-coach` (AI Coach on Arowana Trader, Trading Command, Whale Tracker; Trade Plan Builder's AI draft), Anthropic through `arowana-explain` (Explain, Argue both sides, Retirement Planner write-up; own-endpoint option), and n8n workflows (AI Morning Brief, AI scorecard, chart analysis, Signal check). Terms: Founders annual only; closing an account is billing portal plus an email to support. Owner confirmed: the n8n workflows use OpenAI (named in Privacy), `support@arowanaprofits.com` for closure requests, and the wording. Found while tracing: Portfolio Advisor's AI analysis and chat call Anthropic from the browser with no key, so they cannot work; `js/invest-helper-logic.js` is unused. Check: `scripts/test_legal_pages.py`.

**Portfolio Advisor AI, branch `claude/ATD-109-portfolio-advisor-ai`:** Analyze Stock and Ask Advisor called `api.anthropic.com` from the browser with no key, so neither ever worked. Both now go through `arowana-ai-coach`, which gains two additive modes: `investor` (the chat, with the user's holdings, goals and risk profile, under the coach's number guard) and `company` (one validated ticker in, a JSON profile out, with no figures allowed in its text; ratings clamped to 0-10). The default wheel mode is unchanged. AI on this page is Pro and uses the coach's monthly allowance; the old localStorage "5 free analyses a day" counter is gone (it gated a call that never worked). A ticker from `?analyze=` was written into the page unescaped; tickers are now validated first. Privacy and Disclosures name the new uses. **Owner:** redeploy `arowana-ai-coach` (safe at any time; the Wheel Desk uses the default mode). Checks: `tests/ai-coach-modes.test.js` (runs the function with Supabase and OpenAI faked), `scripts/browser/portfolio_advisor_ai_check.mjs` (23; 18 fail on `main`), `scripts/test_portfolio_advisor_ai.py`.

**Pricing AI allowances, branch `claude/ATD-109-pricing-ai-copy`:** Pricing said "up to 50 AI analyses per day" and "we will contact you before restricting anything"; neither is what the server does. It now states the enforced allowances: Pro gets 30 AI coach messages a month (AI Coach, Trade Plan Builder's draft, Portfolio Advisor's chat and analysis), 150 plain-English explanations a month and 25 ticker research lookups a day; Founding Members get 60, 300 and 50. No price or limit changed. Still to align (not in this change): Account's "AI analyses today" meter shows a placeholder 0 / 50 rather than a real count. Check: `scripts/test_pricing_ai_allowances.py` (reads the limits from the three edge functions).

**Account usage meters, branch `claude/ATD-109-account-ai-meter`:** removed the "AI analyses today" meter, which always showed a placeholder "0 / 50" (or 200). Data & usage now has a real **Plain-English explanations** meter read from `ap_usage` (feature `explain`, monthly; Pro 150, Founders 300) beside the coach and research meters, and the coach note says what counts (AI Coach, Trade Plan Builder drafts, Portfolio Advisor). Also fixed: the usage panel painted once from the cached plan, so a paid account on a fresh browser saw Free's limits ("Not included", "5 / 5"); it now repaints when the server plan arrives. **Found, not fixed (schema):** production `ap_usage_feature_check` allows only `research` and `coach`, so `arowana-explain`'s usage claim for `explain` fails and every Explain, Argue both sides and Retirement write-up returns "Explanations are unavailable right now." Needs a migration adding `explain` to the check. Check: `scripts/browser/account_usage_check.mjs` (13).

**Explain usage feature (migration), branch `claude/ATD-109-explain-usage-feature`:** `supabase/migrations/20261005150000_atd109_ap_usage_explain_feature.sql` replaces `ap_usage_feature_check` with one that also allows `explain`, so `arowana-explain`'s usage claim stops failing. One constraint, in a transaction, safe to re-run; no rows, functions, grants or policies change. Verified on a scratch Postgres 16 built from the captured `ap_usage` table and `ap_claim_usage`: the claim fails before, succeeds after (1/149, 2/148), unknown features are still refused. **Owner/Codex:** apply to production. Check: `scripts/test_explain_usage_migration.py` (the allowed set equals every `p_feature` the edge functions use).
