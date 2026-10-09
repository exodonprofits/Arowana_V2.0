# Functional audit (ATD-109 pre-launch, 2026-10-09)

## How things were tested, and what each label means

| Label | Meaning |
|---|---|
| **Verified (local)** | Run in Chromium against the repo served locally, with the fake Supabase / research / explain / coach functions in `scripts/browser/lib/`. Proves the page logic, not the live services. |
| **Verified (staging, owner)** | The owner confirmed it on `arowanaprofits.com/staging/` this week (see "Owner-confirmed" below). |
| **Code-reviewed** | Read the code; not executed. |
| **Config-verified** | Read-only query against production Supabase (policies, grants, function definitions). Nothing written. |
| **Unable to test** | Could not be exercised from this environment. |
| **Defect (confirmed)** | Reproduced. How is stated next to it. |

Environment limits:
- This container cannot reach `arowanaprofits.com` (proxy 403), so nothing here touches the live site.
- Only Chromium is installed (no Firefox or WebKit/Safari).
- No real Stripe, Finnhub, Anthropic or n8n calls were made.

## Automated suites run on `main` @ `8fd53f3`

| Suite | Result |
|---|---|
| `python3 -m unittest discover -s scripts -p 'test_*.py'` | 117 tests OK |
| `node --test tests/*.test.js` | 61 / 61 pass |
| `scripts/browser/*.mjs` (35 browser checks) | **34 green, 1 red.** 31 report "N passed, 0 failed" (1,341 assertions), `nav_v2_check` 482/482, `auth_client_check` passes (1 known multi-client page: `tradingcommand.html`), `subfolder_login_check` 12/12 when run with its documented `/staging` server. **`schwab_coming_soon_check` 10 pass, 1 FAIL** (see D-9). |
| `scripts/browser/prelaunch_sweep.mjs` (new) | 88 real pages × 375/768/1280/1920 signed in as Pro (352 loads), plus 18 public and member pages × 320/375/768/1024/1440 signed out (90 loads) |

Sweep result:
- Uncaught page errors: none.
- Real console errors on 3 pages: `admin.html`, `options-hub.html`, `swing-trader.html`.
- Missing local files: `admin.html` → `js/supabase.min.js`; `swing-trader.html` → `/app-config.js`.

## Confirmed defects

| ID | Defect | How it was confirmed | Where | Sev |
|---|---|---|---|---|
| D-1 | **Reflected DOM XSS.** The `?from=` value is put into `innerHTML`. A crafted link runs script on our origin, where the Supabase session lives in localStorage. | Local Playwright: `technical-analysis.html?ticker=AAPL&from=<img src=x onerror=…>` ran the handler (a harmless flag). The `?ticker=` variant did not fire because uppercasing breaks the script. | `technical-analysis.html:5328-5343` (`showIntegrationNotice`) | **P0** |
| D-2 | **Webhook table readable without signing in.** `arowana.webhooks` has policy `public read webhooks` = `true`. The view `public.arowana_webhooks` (security_invoker) is granted SELECT to `anon`. 10 rows, 5 live, hosts `exodonprofits.app.n8n.cloud` and the Supabase project. | Config-verified (pg_policies, `has_table_privilege('anon', …)`); repo baseline `supabase/migrations/20261004205052_atd108_arowana_deployed_baseline.sql:2207`. The REST endpoint was not called. | DB | **P1** |
| D-3 | **Public header overflows from 701 to about 1160px.** The nav links and Sign in / Sign up are pushed off-screen, and the page scrolls sideways by 395px at 768 and 139px at 1024. | Local sweep, signed out and signed in; screenshot `screenshots/about-768.png`. The cause is `@media(max-width:700px)`, the only breakpoint that collapses `.nav-links`. | about, blog, contact, disclosures, privacy, refunds, risk-disclosure, security, support, terms, wheel-calculator, assignment-risk (inline CSS in each, e.g. `about.html:21-43`) | **P1** |
| D-4 | **My Movers and Gap Scan cannot run for a signed-in member.** `scanner.html` does not load `js/market-data.js`, so `finnhubKey()` finds no key and the scan returns "Sign in to load live quotes." | Local: signed-in Pro session, `AP_SCANNERS.run('my_movers')` → `{error:true, note:"Sign in to load live quotes."}`, 0 research calls. | `scanner.html:1454-1455`, `js/scanner-defs.js:32-60` | **P1** |
| D-5 | **Stale duplicate pages are published.** `tradingcommand.html` (251 KB; sends the anon key as the Bearer token at :7685-7689) and `whale-tracker.html` (an old AI-coach fork that POSTs to webhook URLs read from localStorage). | Code-reviewed + deploy workflow (`cp ./*.html`, `.github/workflows/deploy-bluehost.yml:62`). Both pages load locally without errors. | root | **P1** |
| D-6 | **`admin.html` always loads an unpinned CDN copy of supabase-js.** The local path `./js/supabase.min.js` does not exist (the file is `js/supabase_min.js`). | Local sweep: 404 plus "Could not load Supabase from CDN either" (CDN blocked in test). | `admin.html:564-570` | P2 |
| D-7 | **Sign-in, sign-up and reset-password inputs are 15.04px on phones.** iOS Safari zooms the page when an input under 16px is focused. | Measured locally at 375px. The zoom itself was **not** observed (no Safari here). | `login.html`, `signup.html`, `reset-password.html`, `wheel-calculator.html` (15.2px), `index.html` waitlist form | P2 |
| D-8 | **`swing-trader.html` requests `app-config.js` from the root** instead of `js/app-config.js`. | Local sweep: 404 at every width. | `swing-trader.html:992` (page is hidden in nav) | P3 |
| D-9 | **`schwab_coming_soon_check` is red on `main`.** The callback page now also requests Google Fonts (added in `a356ebb`, "one site font"). There is no code leak: `<meta name="referrer" content="no-referrer">` comes first (line 8). | Re-run alone: 10 pass / 1 fail. | `schwab-callback.html:35-37` | P2 (red check) |
| D-10 | **Options Hub draws an SVG with NaN coordinates.** Two `<line>` and two `<path>` errors in the console. | Local sweep, every width, synthetic data. **Not root-caused**; likely a flat or empty series in a sparkline. | `options-hub.html` (sparkline renderer near :3851/:3891) | P3 |
| D-11 | **`guide-claude-tradingview-windows.html` links to `education.html`**, which does not exist. | File check. | `:233`, `:248`, `:852` | P3 |

## Feature-by-feature status

| Area | What was checked | Status |
|---|---|---|
| Sign in / sign up / reset / return-to-page | `auth_client_check`, `subfolder_login_check`, `stale_signin_check`, `login.html` `safeNext` code | Verified (local); safe `next` handling code-reviewed |
| Expired session UX | `stale_signin_check` (10) | Verified (local); owner confirmed on staging |
| Nav shell, phone bar, registry | `app_shell_check` (90), `nav_v2_check` (482), `mobile_controls_check` (46) | Verified (local) |
| Market data via `arowana-research` | Owner confirmed NVDA and AMD on staging after #85/#86; v9 source equals repo (#86); CORS test | Verified (staging, owner) |
| Thesis Builder + AI cases (`arowana-explain` v4) | `thesis_builder_check` (32), `tests/explain-thesis.test.js`; owner confirmed AI cases on staging | Verified (local + staging) |
| Morning Brief | Brief checks updated in #84; generator writes `ai_briefs` 12:30 UTC | Verified (local); live generator not observed today |
| Dividend Tracker | `dividend_tracker_check` (24) | Verified (local) |
| Long-Term desk | `long_term_desk_check` | Verified (local) |
| Trade Journal Pro / Command positions with real rows | Existing journal checks pass. The sweep only seeded watchlists, so journal panels showed empty states | Verified (local) via existing checks only |
| Scanners | Framework loads; D-4 for the two personal-universe scans; other scans not run | Partly defective |
| Checkout, Stripe webhook, billing portal | Code-reviewed. Live checkout v14 expects $229 (the Wheel site today); the $299 guard in the repo is deployed at cutover, as planned in `TASKS.md:308` | **Unable to test** (no Stripe test run; deploy is held until L3) |
| Daily digest email | Code-reviewed (`arowana-digest`) | Unable to test |
| n8n workflows (movers, morning-brief webhook, dividend AI) | URLs found in browser JS (`js/app-config.js:186-204`) and the DB | **Unable to test**; whether n8n checks the caller is unknown |
| Admin console | Loads; webhook and tool writes go to views granted to `authenticated` with admin-only RLS on the base table (code + config) | Code-reviewed |
| Firefox, Safari / iOS, real devices | — | **Unable to test** |

## Security review summary (code + config, no attacks run)

Confirmed or config-verified:
- D-1 and D-2 above.
- No provider secret keys in browser code. Every hard-coded JWT decodes to `role: anon`.
- Edge functions read the user from the JWT and the plan from `profiles`. None trusts a client-sent user id or plan.
- `ap_usage_summary` is admin-checked (SECURITY DEFINER + `ap_admins`). `import_watchlist_items` checks ownership. `ap_is_admin()` only reads `auth.uid()`.

Code-reviewed, worth fixing (details and lines in IMPROVEMENT-ROADMAP.md):
- **Leftover BYOK paths.** These still read keys a user pasted before and call FMP, Alpha Vantage or Twelve Data directly from the browser:
  - `analysis-central.html` prompts for an FMP key (`:8048-8077`).
  - `intrinsic-value.html` (`:5899-5926`).
  - `options-hub.html`, `options-analyzer.html`, `atr-stop-planner.html`, `trading-command.html`.
- **Client-asserted identity sent to n8n.** `window.callWebhook` (`js/app-config.js:76-89, :270`) sends `X-User-ID`, `X-User-Plan` and user key headers.
- **Wheel Coach** (`arowana-trader.html:1017-1022`) still reads webhook URLs from localStorage keys and POSTs to them.
- **Return URL check uses `startsWith(SITE)`** (`arowana-checkout/index.ts:60`, `arowana-billing-portal/index.ts:38`). It accepts `https://arowanaprofits.com.evil.tld`. The pages send fixed values today.
- **Client-only scanner unlock.** `js/scanners.js:147-166` `devUnlocked()` grants the elite plan from a localStorage flag or a LAN hostname.
- **Sign-in gates check localStorage only.** Data stays protected by RLS. About 30 member pages have no gate and show an empty member UI to strangers.
- **`arowana-ai-coach` and `arowana-explain`** answer CORS with `*` (they still require a JWT).

Supabase advisors (production project, shared with Salon/Rental; Arowana items only):
- **Security:**
  - Leaked-password protection is **off** (project setting).
  - Postgres has a pending security upgrade.
  - `arowana.set_updated_at` and `public.approve_journal_trade_candidate` have a mutable `search_path`.
  - `approve_journal_trade_candidate` runs as invoker with no ownership check of its own (RLS applies) → INVESTIGATE.
- **Performance:**
  - 57 Arowana RLS policies re-evaluate `auth.uid()` per row (`auth_rls_initplan`), e.g. `watchlists`, `watchlist_items`, `ap_roll_coach`.
  - Duplicate indexes on `watchlist_items` and `watchlist`.
  - Overlapping permissive policies on `trade_journal_options` and others.
  - Unindexed FKs on `tj` user ids and `ap_provider_calls`.
  - None of these matter at launch volume; schedule them post-launch.

## Owner-confirmed this week (from the session record)

- "It works now, NVDA numbers loaded" (after research v9 + CORS)
- "signed out and in again, AMD loads now"
- "deployed staging, AI cases work"
- Merged and deployed #84 (Morning Brief)
