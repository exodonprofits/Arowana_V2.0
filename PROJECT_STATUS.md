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

## Next gate

Review ATD-001 canonical-page, scope and data-retention recommendations. Recommended next assignment is ATD-002; schema/RLS evidence, provider contracts and canonical navigation remain separate Phase 0 tasks before new trading features.
