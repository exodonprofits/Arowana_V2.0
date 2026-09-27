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
- `market-intelligence.html` is currently a thin/placeholder implementation relative to the 2.0 vision

## Next gate

Complete the Phase 0 classification and dependency audit before building new trading features.
