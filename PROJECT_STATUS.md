# Project Status

## Current phase

**Phase 0 — Baseline audit and repository stabilization**

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

## ATD-001 audit result — awaiting review

- Completed static repository audit on 2026-09-27 on `codex/ATD-001-full-repository-audit`; see [full report](docs/ATD-001_REPOSITORY_AUDIT.md).
- Inventoried all 249 baseline files, with individual classifications for 174 HTML files, 32 JavaScript files, four CSS files and one JSON configuration file.
- Recommended canonical core pages and consolidation targets; identified unrelated Salon/GenieSphere pages, competing journal/watchlist models, missing backend definitions and provider fragmentation.
- Preparation notes above describe historical cleanup, not a guarantee: audit found a remaining credential-like Twelve Data literal in `js/option-roll-analyzer.js:9`. Value omitted; validity and rotation were not tested. Browser provider-key workflows remain a migration blocker.
- Existing secret scan passed its limited patterns. Static checks found four existing inline JavaScript syntax failures and 80 missing HTML targets across 230 occurrences; all 32 standalone JS files parsed successfully. See report for scope and limitations.
- Only audit/status/task documentation changed. No application, production configuration, database, credential or legacy-file changes; no follow-on task started.

## ATD-002 inventory result — awaiting review

- Completed on 2026-09-28 on `codex/ATD-002-secret-client-key-inventory`, based on merged ATD-001 (`47fe1ca`); see [inventory](docs/ATD-002_SECRET_CLIENT_KEY_INVENTORY.md).
- Documented all 206 first-party HTML/JS/JSON files, credential/storage flows, provider migration requirements and backend unknowns.
- The remaining Twelve Data candidate also exists in reachable local history. Browser key hydration, alternate key stores, quarantine retention, configurable credential-bearing webhooks and Salon settings secret storage require scoped remediation.
- Nine source JWT literals decode to public anon role; no service-role literal was found by the additional scan. Public client configuration is distinct from private provider secrets; actual RLS remains unverified.
- Existing secret check passed its limited patterns. Additional scans covered 250 baseline files, 16 DOCX XML/relationship members and 250 unique blobs across four reachable commits. No credentials used or live services tested.
- Only inventory/task/status documentation changed. No remediation, production configuration change, rotation or follow-on task started.

## ATD-005 schema/RLS audit result — awaiting review

- Completed 2026-09-28 on `codex/ATD-005-supabase-schema-rls-audit`; see [audit](docs/ATD-005_SUPABASE_SCHEMA_RLS_AUDIT.md). ATD-002 documentation was preserved at entry and subsequently committed in the branch base (`784d6d7`); see audit for the detected checkout transition.
- Read-only inspection of the repository-matched Supabase project found 411 base tables with RLS enabled and 59 views across public/arowana/salon; detailed evidence covers 51 scoped relations, 131 policies and 132 constraints.
- Confirmed watchlist ownership policies combine as alternatives, and account/entity ownership lacks a relational invariant. Identified browser-accessible secret models, schema/API mismatches and shared-project advisor findings.
- Verified existing profile field protection, restricted usage-writing RPCs, admin-gated usage summary and user-token validation in three sampled deployed Edge Functions. RLS flags or gateway JWT settings alone are not security verdicts.
- Deployment listing contains 122 migrations and 35 Edge Functions; their implementations/migrations are absent from this checkout. Earlier repository-only unknowns are resolved only where the new audit records live evidence.
- No application records or stored credentials read, no runtime impersonation or write tests, and no production changes. Repository secret check and documentation diff checks passed. Audit only; no remediation or follow-on work started.

## ATD-004 data source inventory and contract — awaiting review

- Completed documentation on 2026-09-28 on `codex/ATD-004-data-source-inventory-contract`; see [inventory](docs/ATD-004_DATA_SOURCE_INVENTORY.md) and [proposed contract v0.1](docs/ATD-004_DATA_HUB_CONTRACT.md).
- Covered 206 first-party source files and mapped Finnhub/Twelve Data/FMP/Alpha Vantage/Supabase/n8n paths plus AI, broker, manual/import and chart boundaries. Target providers remain proposed capabilities, not validated subscriptions or implemented adapters.
- Contract defines logical datasets, source/feed/time provenance, point-in-time revisions, freshness, private ownership, server entitlements, API/error/pagination rules, caching/fallback, ingestion and future acceptance tests.
- Confirmed source-level gaps include discarded quote timestamps, fragmented caches, rate-limit assumptions, fallback history differences and demo/live valuation mixing.
- Prior audit reports preserved. Secret check, source coverage, synthetic documentation example, reference/redaction and diff checks passed. No application code, production configuration or service changes; no live provider/database/broker requests. No follow-on work started.

## Next gate

Architecture 2.1 was prepared as a documentation-only ATD-004 follow-up on `codex/ATD-004-architecture-2-1`; see [proposal](docs/ARCHITECTURE_2_1.md). It defines component boundaries, logical data ownership, request/job flow, engine responsibilities, rollout gates and owner decisions from the existing inventory/contract. The source baseline matches GitHub main at `bff6c52`. Contract approval, security remediation and provider rights remain open; no application or production changes were made.

## ATD-006 architecture consolidation — completed, awaiting owner review

- Reconciled the engineering/data/security foundation with the AI Trading Floor addendum in [Architecture 2.1](docs/ARCHITECTURE_2_1.md) on `codex/ATD-006-architecture-2-1-consolidation`, based on local commit `5620217`.
- Integrated shared specialist responsibilities, Devil's Advocate, Chief orchestration, non-bypassable deterministic risk, Decision Gate and auditable Trade Decision Records. Resolved gate ordering with initial checks and a final deterministic recheck; rejected arbitrary agent voting.
- Preserved the Data Hub/API child contract and ATD-002/005 security dependencies. Baseline architecture, addendum and audit/contract sources remain unchanged. Only the consolidated architecture and task/status documentation changed; no production changes or credential-store access.
- Verification: existing limited-pattern secret scan, Git diff/changed-file checks, relative documentation links and source-preservation checks. No runtime implementation or provider tests; ATD-003 and ATD-101 were not started.

## Owner review gate

### ATD-006A — final proposal review binding

Owner reports Architecture 2.1 was reviewed and ATD-006 merged through PR #5. ATD-006A adds a narrow section 7 clarification on `codex/ATD-006A-bind-final-proposal-review`: reviews and deterministic results must be valid for the same final immutable proposal version and required snapshot set. Material changes invalidate affected reviews and require recalculation, refreshed specialist assessments and final-proposal adversarial review. Non-material presentation edits preserve the original bindings without unnecessary analysis. This clarification is completed and awaiting owner review; earlier review-status statements describe the ATD-006 baseline and do not approve this new change or the ATD-004 contract.

Documentation-link, whitespace, limited-pattern secret and changed-file scope checks passed. Only architecture/task/status documentation changed; ATD-004 and the addendum remain unchanged. No application, schema or production changes. ATD-003 and ATD-101 remain unstarted; stop for owner review.

Review consolidated Architecture 2.1 and the proposed ATD-004 contract; neither is owner-approved. Provider/feed rights, freshness, canonical private data, deployment, retention and AI implementation decisions remain open. ATD-002/005 security findings still require separately assigned remediation. ATD-003 remains READY but blocked pending owner approval of Architecture 2.1. ATD-101 remains PLANNED, gated on Architecture/Data Hub contract approval, provider/feed decisions, security remediation, entitlement/licensing decisions and a secure DEV baseline. Stop here for owner review.
