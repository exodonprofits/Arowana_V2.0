# Project Status

## ATD-009 legacy page review - 2026-10-03

Owner-approved 2026-10-03 (Q1–Q5 as recommended): [legacy page review](docs/ATD-009_LEGACY_PAGE_REVIEW.md) groups the 141 pages outside the new navigation into 14 groups with one recommended action each, building on ATD-001. Almost all live links to them come from the internal `tool-audit.html`, so most can retire without affecting the menu; journal/watchlist/portfolio duplicates wait on ATD-005/007 ownership fixes because they hold saved data. Documentation only; nothing changed.

Phase 1 (groups C and L) on `claude/ATD-009-phase-1`: the four registry-linked pages without a menu now get the new navigation through a renderer-built rail (`<body data-nav-shell>`), and the four duplicate tool catalogues are redirect stubs to `tools.html` / `features.html`. Group M (archive) waits on the Cloudflare Pages build-settings check (Q3).

Phase 2 (part) on `claude/ATD-009-phase-2`: the 26 standalone scanner pages redirect to their scan in `scanner.html` (new `?scan=` deep link; 17 pending scans registered with their filters), and 4 planning/research duplicates the target already covers are redirects. 12 research/planning pages are held: their target does not cover them yet.

## ATD-008 navigation - 2026-10-03

**ATD-008 complete.** Specification and slice 1 through wave 6 are merged (PRs #14–#20); the close-out adds section highlighting for the 14 tool pages. Owner-parked items keep their defaults: `whale-tracker.html` (pending the coaching merge), `arowana-trader.html`'s desktop top link bar, `tradingcommand.html` (D5). Handed to ATD-007: delete the unused `js/auth-guard.js` and the unreachable `?expired=1` banner in `login.html`. Signed-in browser testing still waits on ATD-007's DEV frontend configuration.

The navigation implementation spec merged through PR #14 with decisions D1–D13 approved. Slice 1 is implemented on `claude/ATD-008-nav-slice-1` and awaiting review: a registry-driven rail, mobile bar and More sheet on `tools.html`, opt-in via `localStorage.ap_nav_v2 = "1"`; everyone else still gets `js/nav-rail.js`. `portfolio-command.html` now honours `?tab=`, which fixes the Performance deep link. Registry unit tests and 71 local browser checks passed with external network blocked. Wave 2 (stacked branch `claude/ATD-008-nav-wave-2`) makes it the default on `tools.html` and 18 tool pages through a shared `js/nav-loader.js`, with a per-browser opt-out; 204 browser checks passed. Wave 3 (`claude/ATD-008-nav-wave-3`) moves `trading-command.html` onto the same navigation, removing its inline rail copy and correction patch; 227 browser checks passed with no new page or console errors. Wave 4 (`claude/ATD-008-nav-wave-4`) does the same for Portfolio Command, Options Hub, Ticker Research, Intrinsic Value and Portfolio Advisor; 282 browser checks passed with no new errors. Wave 5 (`claude/ATD-008-nav-wave-5`) adds Wheel Coach, Watchlists, Scanners, Position Sizer, Trade Plan Builder, Wheel Strategy and Morning Brief; `whale-tracker.html` is excluded pending a merge decision. Wave 6 (`claude/ATD-008-nav-wave-6`) moves `trade-journal-pro.html` over and stops loading `js/auth-guard.js`, which contains only an outdated rail copy and no auth logic; the file is left for ATD-007 to delete. All 33 signed-in navigation pages except `tradingcommand.html` (D5) and `whale-tracker.html` now use the registry navigation. No Supabase, credential or production changes; signed-in testing waits on ATD-007. See [spec](docs/ATD-008_NAVIGATION_IMPLEMENTATION_SPEC.md).

## Current update - 2026-10-01

ATD-007 continuation found generated local runtime credentials tracked in merged baseline `dcf83ea`. Untracked the generated files and added a CI tracking guard. Stopped the affected local Supabase project with data volumes preserved; Studio is intentionally offline. Nine tests, tracking guard, full secret scan and whitespace checks passed. Prior runtime-ready statements are historical. Credential rotation/history containment, PostgreSQL security-version review and schema/RLS remediation remain open. See [work record](docs/ATD-007_SECURITY_DEV_BASELINE.md). No production changes; ATD-007 remains in progress.



## Local DEV update - 2026-09-30

Owner selected local Supabase for ATD-007. The local stack is running on `codex/ATD-007-security-dev-baseline`; published ports are loopback-only and Auth/Studio HTTP checks passed. Official CLI 2.118.0 was checksum-verified; no package manager was introduced. No hosted project was linked, no production data imported and no application configuration changed. Local SQL confirmed zero public application tables and zero Auth users.

This supersedes earlier DEV-target-selection uncertainty. ATD-007 remains in progress: the CLI-selected PostgreSQL 17.6 image needs security-version review/upgrade against the current 17.11 advisory, reviewed backend definitions are missing, and ownership/client-key remediation remains open. See [work record](docs/ATD-007_SECURITY_DEV_BASELINE.md) and [local setup](supabase/README.md). Seven scanner tests, repository secret scan, TOML/isolation assertions and whitespace checks passed. No secure baseline or two-user RLS validation is claimed; ATD-101 remains gated.

## Current update â€” 2026-09-29

The owner confirmed review work is complete after ATD-003 merged through PR #8; earlier awaiting-review labels below are historical. Authorized ATD-007 security remediation and DEV baseline. The first local slice removes the remaining option-roll helper key literal/direct quote request and strengthens the secret scan with seven synthetic tests in CI. See [ATD-007](docs/ATD-007_SECURITY_DEV_BASELINE.md). Task remains in progress: DEV target selection, key revocation/deployed-history containment, browser credential workflows and ownership fixes are unresolved. No secure DEV baseline or production remediation is claimed; ATD-101 remains gated.

## Current phase

**Phase 0 â€” Baseline audit and repository stabilization**

## Baseline

- Source: uploaded broad/pre-Wheel-focused Arowana Profits ZIP
- Existing functionality preserved in place
- Current Wheel-focused repository is a future port/source for Wheel improvements

## Completed during repository preparation

- Added GitHub/project governance files
- Added security and setup documentation
- Added secret-check script and CI workflow
- Removed known hard-coded OpenAI secret from uploaded baseline
- Removed known hard-coded Twelve Data credential from uploaded baseline
- Preserved legacy Supabase client configuration for compatibility; RLS/security audit remains required
- Restored `js/nav-rail.js` from the canonical inline navigation implementation embedded in `trading-command.html`, because many legacy pages reference that shared file

## Known architectural debt

- Multiple generations/duplicates exist (for example `trading-command.html` and `tradingcommand.html`)
- Several major pages are large monolithic HTML files
- Market-data providers are fragmented across legacy tools
- User provider keys have historically been stored in browser/localStorage/Supabase user tables
- Some non-core/unrelated pages may need archiving
- `market-intelligence.html` is currently a retired redirect, not an implementation of the planned Market Engine

## ATD-001 audit result â€” awaiting review

- Completed static repository audit on 2026-09-27 on `codex/ATD-001-full-repository-audit`; see [full report](docs/ATD-001_REPOSITORY_AUDIT.md).
- Inventoried all 249 baseline files, with individual classifications for 174 HTML files, 32 JavaScript files, four CSS files and one JSON configuration file.
- Recommended canonical core pages and consolidation targets; identified unrelated Salon/GenieSphere pages, competing journal/watchlist models, missing backend definitions and provider fragmentation.
- Preparation notes above describe historical cleanup, not a guarantee: audit found a remaining credential-like Twelve Data literal in `js/option-roll-analyzer.js:9`. Value omitted; validity and rotation were not tested. Browser provider-key workflows remain a migration blocker.
- Existing secret scan passed its limited patterns. Static checks found four existing inline JavaScript syntax failures and 80 missing HTML targets across 230 occurrences; all 32 standalone JS files parsed successfully. See report for scope and limitations.
- Only audit/status/task documentation changed. No application, production configuration, database, credential or legacy-file changes; no follow-on task started.

## ATD-002 inventory result â€” awaiting review

- Completed on 2026-09-28 on `codex/ATD-002-secret-client-key-inventory`, based on merged ATD-001 (`47fe1ca`); see [inventory](docs/ATD-002_SECRET_CLIENT_KEY_INVENTORY.md).
- Documented all 206 first-party HTML/JS/JSON files, credential/storage flows, provider migration requirements and backend unknowns.
- The remaining Twelve Data candidate also exists in reachable local history. Browser key hydration, alternate key stores, quarantine retention, configurable credential-bearing webhooks and Salon settings secret storage require scoped remediation.
- Nine source JWT literals decode to public anon role; no service-role literal was found by the additional scan. Public client configuration is distinct from private provider secrets; actual RLS remains unverified.
- Existing secret check passed its limited patterns. Additional scans covered 250 baseline files, 16 DOCX XML/relationship members and 250 unique blobs across four reachable commits. No credentials used or live services tested.
- Only inventory/task/status documentation changed. No remediation, production configuration change, rotation or follow-on task started.

## ATD-005 schema/RLS audit result â€” awaiting review

- Completed 2026-09-28 on `codex/ATD-005-supabase-schema-rls-audit`; see [audit](docs/ATD-005_SUPABASE_SCHEMA_RLS_AUDIT.md). ATD-002 documentation was preserved at entry and subsequently committed in the branch base (`784d6d7`); see audit for the detected checkout transition.
- Read-only inspection of the repository-matched Supabase project found 411 base tables with RLS enabled and 59 views across public/arowana/salon; detailed evidence covers 51 scoped relations, 131 policies and 132 constraints.
- Confirmed watchlist ownership policies combine as alternatives, and account/entity ownership lacks a relational invariant. Identified browser-accessible secret models, schema/API mismatches and shared-project advisor findings.
- Verified existing profile field protection, restricted usage-writing RPCs, admin-gated usage summary and user-token validation in three sampled deployed Edge Functions. RLS flags or gateway JWT settings alone are not security verdicts.
- Deployment listing contains 122 migrations and 35 Edge Functions; their implementations/migrations are absent from this checkout. Earlier repository-only unknowns are resolved only where the new audit records live evidence.
- No application records or stored credentials read, no runtime impersonation or write tests, and no production changes. Repository secret check and documentation diff checks passed. Audit only; no remediation or follow-on work started.

## ATD-004 data source inventory and contract â€” awaiting review

- Completed documentation on 2026-09-28 on `codex/ATD-004-data-source-inventory-contract`; see [inventory](docs/ATD-004_DATA_SOURCE_INVENTORY.md) and [proposed contract v0.1](docs/ATD-004_DATA_HUB_CONTRACT.md).
- Covered 206 first-party source files and mapped Finnhub/Twelve Data/FMP/Alpha Vantage/Supabase/n8n paths plus AI, broker, manual/import and chart boundaries. Target providers remain proposed capabilities, not validated subscriptions or implemented adapters.
- Contract defines logical datasets, source/feed/time provenance, point-in-time revisions, freshness, private ownership, server entitlements, API/error/pagination rules, caching/fallback, ingestion and future acceptance tests.
- Confirmed source-level gaps include discarded quote timestamps, fragmented caches, rate-limit assumptions, fallback history differences and demo/live valuation mixing.
- Prior audit reports preserved. Secret check, source coverage, synthetic documentation example, reference/redaction and diff checks passed. No application code, production configuration or service changes; no live provider/database/broker requests. No follow-on work started.

## Next gate

Architecture 2.1 was prepared as a documentation-only ATD-004 follow-up on `codex/ATD-004-architecture-2-1`; see [proposal](docs/ARCHITECTURE_2_1.md). It defines component boundaries, logical data ownership, request/job flow, engine responsibilities, rollout gates and owner decisions from the existing inventory/contract. The source baseline matches GitHub main at `bff6c52`. Contract approval, security remediation and provider rights remain open; no application or production changes were made.

## ATD-006 architecture consolidation â€” completed, awaiting owner review

- Reconciled the engineering/data/security foundation with the AI Trading Floor addendum in [Architecture 2.1](docs/ARCHITECTURE_2_1.md) on `codex/ATD-006-architecture-2-1-consolidation`, based on local commit `5620217`.
- Integrated shared specialist responsibilities, Devil's Advocate, Chief orchestration, non-bypassable deterministic risk, Decision Gate and auditable Trade Decision Records. Resolved gate ordering with initial checks and a final deterministic recheck; rejected arbitrary agent voting.
- Preserved the Data Hub/API child contract and ATD-002/005 security dependencies. Baseline architecture, addendum and audit/contract sources remain unchanged. Only the consolidated architecture and task/status documentation changed; no production changes or credential-store access.
- Verification: existing limited-pattern secret scan, Git diff/changed-file checks, relative documentation links and source-preservation checks. No runtime implementation or provider tests; ATD-003 and ATD-101 were not started.

## Owner review gate

### ATD-006A â€” final proposal review binding

Owner reports Architecture 2.1 was reviewed and ATD-006 merged through PR #5. ATD-006A adds a narrow section 7 clarification on `codex/ATD-006A-bind-final-proposal-review`: reviews and deterministic results must be valid for the same final immutable proposal version and required snapshot set. Material changes invalidate affected reviews and require recalculation, refreshed specialist assessments and final-proposal adversarial review. Non-material presentation edits preserve the original bindings without unnecessary analysis. A Claude Code follow-up on the same branch adds the explicit revision sequence and NVDA example, long/short direction as a material change, the Chief self-certification limit, carry-forward of still-applicable objections, the proposal-change versus evidence-change distinction, and matching section 9 tests and section 10 open decisions. This clarification is completed and awaiting owner review; earlier review-status statements describe the ATD-006 baseline and do not approve this new change or the ATD-004 contract.

Documentation-link, whitespace, limited-pattern secret and changed-file scope checks passed. Only architecture/task/status documentation changed; ATD-004 and the addendum remain unchanged. No application, schema or production changes. ATD-003 and ATD-101 remain unstarted; stop for owner review.

On 2026-09-29 the owner approved Architecture 2.1 including ATD-006A and authorized ATD-003. This supersedes earlier review-status statements above. ATD-004 approval, provider/feed rights, freshness, private data ownership, deployment, retention and security remediation remain separately gated. ATD-101 is not started.

## ATD-003 navigation map â€” completed, owner-approved

Prepared [the canonical navigation map](docs/ATD-003_CANONICAL_NAVIGATION_MAP.md) on `codex/ATD-003-canonical-navigation-map`: six primary destinations, shared strategy desks, legacy-route dispositions, deep-link preservation, mobile/accessibility requirements and rollout acceptance. Internal AI roles remain within trader workflows. No runtime navigation or redirects changed.

Verification: documentation links and named existing-file references, whitespace, repository secret check and documentation-only scope. No browser/UI or production tests; these remain implementation gates. The owner approved the labels and grouping on 2026-09-29: Research; Growth with AI as a theme filter; distinct Options/Wheel and Portfolio/Journal responsibilities; contextual coaching and tools; mobile Command, Watchlists, Portfolio, Journal, More. Next: separately assigned navigation implementation subject to relevant security/DEV gates; no follow-on started by this documentation update.

Final scan clarification: after startup, the full working-directory scanner reports two credential patterns in the CLI-generated, Git-ignored `supabase/.temp/start-secrets/` runtime environment file. Values were not printed. The separate scan of all Git-tracked and non-ignored candidate source files passed. Scanner behavior was not weakened or changed. Earlier scan passes occurred before runtime credential generation.
