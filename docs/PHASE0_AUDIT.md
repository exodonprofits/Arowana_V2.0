# Phase 0 Audit — Initial Findings

This is a preliminary stabilization note, not the final page-by-page audit.

## Strong core candidates

- `trading-command.html`
- `portfolio-command.html`
- `analysis-central.html`
- `options-hub.html`
- `watchlist.html`
- `position-sizer.html`
- `trade-journal-pro.html` / `master-journal.html`
- `arowana-trader.html`
- `ai-morning-brief.html`
- `broker-connections.html`
- `intrinsic-value.html`
- `wheel-strategy.html` / `wheel-calculator.html` (legacy baseline; newer Wheel repo is expected to supersede selected pieces)

## Known overlap / canonical-version work needed

- `trading-command.html` vs `tradingcommand.html`
- `index.html` plus multiple `index_v*.html` generations
- `position-sizer.html` vs `position-sizer_fresh.html`
- `js/setup-scorecard.js` vs `js/setup-scorecard_v9.js`
- `js/strategy-analyzers.js` vs `js/strategy-analyzers_v1.js`
- root `theme.css` vs `js/theme.css` and `css/theme.css` variants

## Architecture observations

- Major core pages are currently monolithic; refactor incrementally rather than rewrite wholesale.
- Data-provider logic is fragmented across pages and should move toward a shared Data Hub.
- `market-intelligence.html` is much thinner than the planned 2.0 Market Engine.
- Existing Supabase/auth/journal infrastructure is valuable and should be audited before replacement.

## Security observations

- A hard-coded OpenAI secret existed in the uploaded baseline and was removed from this package.
- A hard-coded Twelve Data key existed in multiple legacy pages and was removed from this package.
- Legacy browser/localStorage provider-key workflows should be retired.
- Supabase anon configuration is not itself a private secret, but RLS must be verified.

## Next deliverable

Produce the full page/module matrix: **KEEP / MODIFY / MERGE / PORT / ARCHIVE / DELETE / SECURITY FIX**, including canonical file, dependencies, data providers, Supabase tables, and migration priority.
