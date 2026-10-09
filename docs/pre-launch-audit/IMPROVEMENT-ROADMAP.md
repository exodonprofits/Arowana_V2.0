# Improvement roadmap (ATD-109 pre-launch, 2026-10-09)

Each item gives the defect, root cause, smallest fix, affected modules,
regression risk and acceptance criteria, so it can be approved one by one.
**None of these are implemented in this PR.**

- Complexity: S = under an hour, M = a few hours, L = a day or more.
- Maintenance: does the fix add ongoing upkeep?
- IDs `D-n` refer to FUNCTIONAL-AUDIT.md.

## P0: before any public launch

### R-1 Reflected XSS on Technical Analysis (D-1)
- **Root cause:** `showIntegrationNotice()` builds `innerHTML` with the raw `?from=` value (falls through the `sourceNames` map) and `currentTicker`.
- **Smallest fix:**
  - Build the notice with `document.createElement` / `textContent`.
  - Show a source name only when `from` is in the map.
  - Validate `ticker` with the same `/^[A-Z][A-Z0-9.\-]{0,9}$/` the research function uses.
- **Affected:** `technical-analysis.html` only.
- **Risk:** very low.
- **Complexity / maintenance:** S / none.
- **Acceptance:**
  - A new browser check loads `?ticker=AAPL&from=<img src=x onerror=…>` and `?ticker=<img…>`; no handler fires and the text is shown literally.
  - `?from=trading-command` still shows "Connected from Trading Command".
- **Also:** grep the repo for the same `innerHTML` + URL-parameter pattern. The security review found only this one.

## P1: before launch

### R-2 Webhook table readable by anyone (D-2)
- **Root cause:** policy `public read webhooks` (`USING true`) on `arowana.webhooks` + `GRANT SELECT … TO anon` on `public.arowana_webhooks`.
- **Smallest fix:**
  - A migration that replaces the read policy with `ap_is_admin()` and revokes `anon` on the view.
  - Then confirm which pages still read it (the admin console only, per the code).
- **Affected:** `admin.html` webhooks tab; any page reading `arowana_webhooks`. Grep found only `admin.html:707`.
- **Risk:** low.
- **Complexity / maintenance:** S / none. **This is a DB change: it needs explicit owner approval and a migration file.**
- **Acceptance:**
  - `has_table_privilege('anon','public.arowana_webhooks','SELECT')` = false.
  - An admin still sees and edits webhooks.
  - Salon/Rental objects untouched.
- **Linked owner item:** the n8n URLs are also hard-coded in `js/app-config.js:186-204`. Check in n8n that every workflow behind a public URL verifies the caller (JWT or shared secret), and rotate the n8n token as already planned.

### R-3 Public header overflows on tablets (D-3)
- **Root cause:** `.nav-links` collapses only at `max-width:700px`, but the expanded header needs about 1160px.
- **Smallest fix:** raise the collapse breakpoint to about 1180px in the 12 affected pages, which share the same inline CSS block. Longer-term, move the public header into one shared file (R-12).
- **Affected:** about, blog, contact, disclosures, privacy, refunds, risk-disclosure, security, support, terms, wheel-calculator, assignment-risk.
- **Risk:** low; desktop at 1280 or wider is unchanged.
- **Complexity:** S.
- **Acceptance:**
  - Sweep at 768/1024: overflow 0 on those pages.
  - The burger menu opens and shows Sign in / Sign up.
  - 1280/1920 unchanged.

### R-4 Scanner quotes (D-4)
- **Root cause:** `scanner.html` loads `js/scanner-defs.js` without `js/market-data.js`, so no key placeholder is set and finnhub calls are not rerouted.
- **Smallest fix:** add `<script src="./js/market-data.js?v=20261008a"></script>` before `scanners.js`, matching the other pages.
- **Affected:** `scanner.html` (My Movers, Gap Scan).
- **Risk:** low; the same shim runs on 20 other pages.
- **Complexity:** S.
- **Acceptance:** a signed-in Pro run of `my_movers` calls `arowana-research` `/quote` and returns rows. A new browser check covers it.

### R-5 Retire the two stale duplicate pages (D-5)
- **Smallest fix:** replace `tradingcommand.html` and `whale-tracker.html` with redirect stubs (to `trading-command.html` and `arowana-trader.html`), the pattern used for the 68 existing stubs.
- **Risk:** very low. Nothing links to either page; old bookmarks still land somewhere useful.
- **Needs owner approval** (REMOVE).
- **Complexity:** S.
- **Acceptance:** `auth_client_check` no longer lists a "KNOWN" multi-client page; both URLs redirect.

### R-6 Checkout / Stripe end-to-end before L3 (unable to test here)
- **What to do:**
  - At L3, compare live `arowana-checkout` v14 with the repo before deploying.
  - Run one Stripe test-mode purchase and one cancel through `arowana-stripe-webhook`.
  - Confirm `profiles.arowana_plan` changes.
  - Switch `STRIPE_PRICE_FOUNDERS` to $299 and deploy the guard in the same window (planned, `TASKS.md:308`).
- **Owner-run;** Claude prepares the checklist.

## P2: launch week or soon after

| ID | Item | Smallest fix | Affected | Cx |
|---|---|---|---|---|
| R-7 | iOS zoom on sign-in inputs (D-7) | `@media(max-width:700px){input,select,textarea{font-size:16px}}` on login, signup, reset-password, wheel-calculator, assignment-risk, index waitlist | 6 pages | S |
| R-8 | Red `schwab_coming_soon_check` (D-9) | Remove the Google Fonts `<link>`s from `schwab-callback.html`; the callback page renders in the system font. Don't loosen the test. | 1 page | S |
| R-9 | BYOK leftovers | Remove the FMP key prompt (`analysis-central.html:8048-8077`). Clear `arowana_iv_apikeys` and `finnhub_api_key` on load as `ap_user_api_keys` already is. Stop reading `arowana_st_main_webhook` / `ap_*_webhook` localStorage URLs (`arowana-trader.html:1017-1022`). | analysis-central, intrinsic-value, options-hub, arowana-trader | M |
| R-10 | `callWebhook` sends `X-User-ID`, `X-User-Plan` and key headers to n8n | Send the Supabase JWT only; n8n verifies it. Coordinate with the n8n workflows. | `js/app-config.js:76-89` + n8n | M |
| R-11 | Return-URL prefix check | Compare `new URL(raw).origin` to the `OURS` set in checkout and billing-portal | 2 edge functions (**deploy needs approval**) | S |
| R-12 | Shared public header | One `js/public-header.js` or a CSS file used by the 12 public pages | public pages | M |
| R-13 | `admin.html` loads an unpinned CDN supabase-js (D-6) | Point it at `js/supabase_min.js`; remove the CDN fallback | admin | S |
| R-14 | Client-only scanner unlock | Remove the localStorage and LAN-hostname branches of `devUnlocked()` (`js/scanners.js:147-166`) in production | scanners | S |
| R-15 | Pricing / brief copy | The positions brief is live: remove "Coming soon" at `pricing.html:491/599`, and label or merge the two brief cards on Command. | pricing, trading-command | S |
| R-16 | Blog | Hide the link from footers until real posts exist | 7 linking pages | S |
| R-17 | Leaked-password protection off | Turn it on in Supabase Auth settings (project-wide; affects Salon/Rental sign-ups too, so owner's call) | Supabase project | S |
| R-18 | Unpinned third-party scripts | Pin `cdn.sheetjs.com/xlsx-latest` (`wheel-strategy.html:1599`) and the unversioned chart.js on `dca-planner`/`fee-analyzer` | 3 pages | S |

## P3: post-launch backlog

| ID | Item | Notes |
|---|---|---|
| R-19 | Shared sign-in guard using `supabase.auth.getSession()` instead of localStorage presence | Data is RLS-protected today; this is UX and defence in depth. |
| R-20 | Escape journal-sourced fields in `trading-command.html:7676-7681` and `trading-journal-analysis.html:1736/2308` | Self-XSS via CSV import. |
| R-21 | `swing-trader.html` `app-config.js` path (D-8); decide the Swing desk's future | Hidden page. |
| R-22 | Options Hub NaN sparkline (D-10) | Guard against a flat or empty series. |
| R-23 | `api-diagnostics.html` and `tool-audit.html` admin-only | — |
| R-24 | CORS `*` on `arowana-ai-coach` / `arowana-explain` → `OURS` allow-list | Both still require a JWT. **Deploy needs approval.** |
| R-25 | `supabase/config.toml` `[functions.*] verify_jwt` entries | Records today's deploy settings in the repo. |
| R-26 | DB performance advisor items: `auth_rls_initplan` on 57 Arowana policies, duplicate indexes on `watchlist_items`/`watchlist`, overlapping permissive policies on `trade_journal_options` | Wrap `auth.uid()` as `(select auth.uid())`. Migrations; not needed at launch volume. |
| R-27 | `search_path` on `arowana.set_updated_at`, `approve_journal_trade_candidate`; review that function's ownership logic | Migration. |
| R-28 | MERGE candidates from FEATURE-RECOMMENDATIONS.md | Five risk calculators → one; DCF → Intrinsic Value. |
| R-29 | Fix `education.html` links (D-11) and the 7+ links still pointing at the `market-intelligence.html` stub | — |
| R-30 | Phone tap targets: overflow menu for the Trade Journal Pro toolbar; 36px minimum on secondary chips | — |
