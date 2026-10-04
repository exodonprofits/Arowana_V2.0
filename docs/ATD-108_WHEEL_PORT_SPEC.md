# ATD-108 — Wheel module port: specification

**Status:** Draft for owner review. Documentation only; nothing is ported until this is approved.
**Owner:** Claude Code (frontend). Backend items are marked **Codex lane** and are not done here.
**Sources compared:**
- Wheel repository `exodonprofits/arowanaprofits` at `219e61f` (2026-10-03). Its README says "The product is the Wheel Strategy Desk".
- This repository at `be89628` (main after PR #31).

## 1. What you are approving

- **Port selected, tested pieces** of the Wheel repository into Arowana V2.0. Do **not** replace pages wholesale. This matches `docs/ARCHITECTURE.md`: Wheel is a desk inside Arowana, not the platform.
- **Keep everything V2.0 added since the two repos split:**
  - the registry navigation and its `?tab=` handling
  - the ATD-009 merges, including scanner deep links, the AI Analysis tab, Signal check and Saved signals
  - the platform pages the Wheel product removed
- **Implement in six slices** (section 4), each a normal PR with the usual checks.
- **Answer the decisions in section 6.** Defaults are given, so "go with your recommendations" works.

## 2. How the two repositories differ

The two repositories share an origin and diverged in both directions. Wheel cut the platform down to a wheel-only product and fixed several real bugs. V2.0 kept the platform and rebuilt navigation and the legacy pages.

**Shared JavaScript, 31 files in Wheel's `js/`:**
- 8 are byte-identical to V2.0.
- 6 exist only in Wheel: `sb.js`, `wheel-ledger.js`, `wheel-status.js`, `trade-check.js`, `explain.js`, `lab.js`.
- 16 differ:
  - Wheel is ahead in `app-config.js`, `journal-sync.js`, `market-data.js`, `risk.js`, `supabase-init.js`, `price-fetcher.js`, `setup-scorecard.js`, `workspace-footer.js` and `plan.js`.
  - V2.0 is ahead in `scanner-defs.js`.
  - `nav-rail.js` and `scanners.js` conflict.
  - The rest differ only in comments or wording.

**Pages:**
- V2.0's copy is larger on nearly every shared page.
- Most of Wheel's extra page code is an inlined copy of the old rail, which must **not** come over. V2.0 uses `js/nav-loader.js`.
- The real Wheel additions are listed in section 3.

**Backend:**
- Wheel carries the source for four edge functions (`arowana-ai-coach`, `arowana-explain`, `arowana-checkout`, `arowana-digest`, plus `_shared/number-guard.js`) and five migrations.
- V2.0 has none in Git. Its `supabase/` holds only the ATD-007 local-stack config and is on containment hold.
- ATD-005 shows the deployed project already has `ap_risk_settings.rules` (jsonb), the profile-protection trigger, `ap_is_admin()` and these function slugs.

**Tests:**
- Wheel has five `node:test` files with no package manager. They cover the wheel ledger, trade check, digest, number guard and price guard.
- V2.0's CI runs Python only.

**Deployment:**
- Wheel deploys to Bluehost over FTPS with an explicit allowlist (top-level pages, `css/`, `js/`, `images/`, `lab/`). `_redirects` is converted to `.htaccess` there.
- V2.0 has no deployment workflow in the repository, so ATD-009 Q3 (what gets published) is still open.

## 3. What to port, and what not to

### 3.1 Port

| # | Piece | Why | Depends on |
|---|---|---|---|
| P1 | **Single Supabase client:** `js/sb.js`, plus Wheel's `app-config.js` hunks (adopt the shared client, live `apGetAccessToken()`, single-flight refresh, `headers` getter, dead Anthropic config removed) and `supabase-init.js` | Fixes two auth bugs in V2.0. Several modules create their own GoTrue clients, which race over rotating refresh tokens and sign users out. `getSupabaseHeaders()` uses the cached `gs_auth_user_v1.access_token`, which goes stale within an hour, so RLS queries then return nothing. | Every page that loads a migrated module needs `supabase_min.js` then `sb.js` first. |
| P2 | `market-data.js`, `price-fetcher.js`, `setup-scorecard.js` | 401 refresh-and-retry. Finnhub calls work through the authenticated `arowana-research` proxy without a personal key, which moves users off browser-held keys (ATD-002). | P1; the deployed `arowana-research` function |
| P3 | **`journal-sync.js` manifest sync** | Replaces "pull only rows newer than my newest edit" with an id/`updated_at` diff. That fixes deleted trades coming back and missed edits from other devices. It has a safety cap: it skips a remote-delete sweep larger than max(5, 20% of local rows). | P1 |
| P4 | **Trade journal fixes** in `trade-journal-pro.html`: expired/assigned settlement (`exitDate`, `premiumOut = 0`, P&L from premium); chunked Delete All scoped to the session user (fixes HTTP 400 at about 2k rows); token from `apGetAccessToken`; deep links `?q=SYMBOL` and the option prefill `?asset=option&ticker&type&strike&expiry&premium&contracts&account` | Data correctness and reliability | P1, P3 |
| P5 | **`wheel-ledger.js`** (pure) | Builds wheel campaigns from journal rows: basis bought down by premium, capital, return, and assignments inferred from journal rows (with a warning) | none; tested |
| P6 | **Portfolio Command:** wheel campaigns panel on the Income tab; multi-lot holding edit notice with a link to the journal | Uses P5 | P5 |
| P7 | **`risk.js` rules + `trade-check.js` + Options Hub "Check a trade" tab** (`?tab=check`, rules editor, "log it" link into the journal) | Pre-trade check of a short put or covered call against your own rules: yield, DTE, want-to-own, put at or below target, call above basis, ex-dividend. Nothing is blocked; it reports pass, fail or skip. | `ap_risk_settings.rules` (already deployed; falls back to localStorage `ap_risk_rules_v1`); `watchlist_items.want_to_own` / `target_buy_price` |
| P8 | **`explain.js`** "Explain in plain English" / "Argue both sides" buttons on Options Hub and Portfolio Command | Text comes from the deployed `arowana-explain` function. The server rejects any reply containing numbers that are not in the facts it was sent, and the result renders as text. | P1; deployed `arowana-explain` |
| P9 | **Wheel Calculator fix** | The "expires worthless" row measured from the current price instead of your cost basis, so the result jumped at the strike. Also adds the explanatory note. | none |
| P10 | **Merge, don't replace:** from `nav-rail.js`, only the mechanics still relevant to the `ap_nav_v2 = "0"` fallback; from `scanners.js`, the `AP_PLAN` plan-authority hunk | Small fixes | Keep V2.0's menus, `listForMode()` and `scanner-defs.js` |

### 3.2 Defer until the backend source is in Git (Codex lane)

| Piece | Why it waits |
|---|---|
| `wheel-status.js` ("Your wheel today" on Arowana Trader and the Trading Command coach context) | It imports `supabase/functions/arowana-digest/digest.js` **as a static file from the site**, and reads `market_snapshots` and `ap_risk_settings.wheel_capital`. V2.0 has no function source, and its `supabase/` is on containment hold. |
| Node tests for digest, number-guard and price-guard | Need the edge-function source in the tree. |
| Email digest preferences (`ap_email_prefs` / `ap_email_log`), checkout price guard, cron/Vault migrations | Backend schema and secrets. Not frontend work. |

### 3.3 Do not port

- **Wheel's inlined nav rail and "Rail correction" scripts.** V2.0 uses the registry navigation.
- **Wheel's `_redirects`.** It retires pages V2.0 keeps or has already routed elsewhere: `wheel-strategy.html` → Arowana Trader, `options-strategies` → Puts.
- **Wheel's removals.** These are V2.0 features Wheel deleted:
  - Options Hub's analyzer and strategies tabs
  - Trading Command's guided desk, POC, morning brief and movers
  - Arowana Trader's swing scanner
  - Portfolio Command's deployment tracker, sector rotation, income overlay and technical check
- **Wheel's shorter `scanner-defs.js`.** V2.0's has the ATD-009 scans and Quality Compounders. Wheel's one extra pending scan can be added.
- **`lab/` restructuring and `lab.js` owner gating** (decision Q3).
- **`plan.js` free-tier change** that makes CSV, income and export free (decision Q4).

## 4. Slices

Each slice is one PR. They run in order because later slices build on the auth foundation.

| Slice | Contents | Main risk | Rollback |
|---|---|---|---|
| **S1 Auth foundation** | P1 + P2. Add `sb.js` to pages in waves, starting with the journal, portfolio, options and trading pages. | Touches login on every page it reaches. | Restore the previous `app-config.js` and page script tags. |
| **S2 Journal reliability** | P3 + P4 | Sync rules change; a bad delete sweep would remove rows. Covered by Wheel's cap, plus tests on synthetic data. | Restore `journal-sync.js` and `trade-journal-pro.html`. |
| **S3 Wheel ledger** | P5 + P6, plus Node tests (decision Q2) | Campaign maths shown to users | Remove the panel; the ledger is pure. |
| **S4 Check a trade** | P7, plus the `trade-check` tests | Rule fields stored in `ap_risk_settings.rules` | Hide the tab; rules fall back to localStorage. |
| **S5 Explanations + fixes** | P8 + P9 + P10. Also: remove `option-roll-tracker.html`'s dead Twelve Data ticker block (placeholder key, polled every 60 s) and fix `options-hub.html`'s 404 script tag (`js/options-hub-trading-layout.js` does not exist). | AI text on financial pages: server-side number guard, text rendering | Remove the buttons. |
| **S6 Wheel today** | `wheel-status.js` panels | Blocked on the backend source (section 3.2) | — |

**What stays as it is:**
- **`wheel-strategy.html`** is kept. Wheel's ledger and journal import cover campaigns and broker CSV, but not its OCR screenshot import or explicit roll chains.
- **`option-roll-tracker.html`** is also kept, apart from the S5 cleanup. It remains the roll ledger, with its saved `option_roll_tracker_v1` and `option_roll_chains` data, until a later slice can fold roll chains into the wheel ledger without losing records.

## 5. Checks for every slice

- **Existing CI:** Python unit tests, the runtime-tracking guard and the secret scan.
- **Browser suite:** `scripts/browser/nav_v2_check.mjs`, extended per slice. External network is blocked; Supabase and the edge functions are mocked at the network layer; synthetic users only.
- **Slice-specific checks:**
  - S1 adds a single-client check, a port of Wheel's `scripts/check-supabase-client.mjs` idea. It confirms each page creates exactly one GoTrue client.
  - S2 adds sync tests with two synthetic devices: a delete propagates; an empty server list does not wipe local rows.
  - S3 and S4 bring over Wheel's `wheel-ledger` and `trade-check` tests unchanged and run them (Q2).
- **Before/after console-error comparison** on every touched page.
- **No production data, no live keys, and no schema or edge-function changes** in any slice.

## 6. Decisions

| # | Question | Recommendation |
|---|---|---|
| Q1 | Who owns S1 (auth plumbing)? It is frontend code but sits next to ATD-007's security work. | **Claude Code does S1 as frontend-only, and Codex reviews the PR.** No schema or policy changes. |
| Q2 | How do the Node tests run in CI? V2.0 CI is Python-only and no package manager is allowed. | **Add a `node --test tests/*.test.js` step** (GitHub's Ubuntu runners include Node) in a new workflow file. No dependencies are added. |
| Q3 | Adopt Wheel's `lab/` folder and owner gating? | **No.** V2.0's registry already decides what is on the menu. Wheel's gate only hides links; its own docs say the real lock is Cloudflare Access. |
| Q4 | Make CSV, income and export free, as Wheel did? | **Keep V2.0's plan rules for now.** It is a pricing decision. |
| Q5 | Accept the journal settlement change for expired and assigned options (sets `exitDate`, `premiumOut = 0`, P&L from premium)? | **Yes.** It changes stats from that point on; existing rows are not rewritten. |
| Q6 | Ask Codex (ATD-007) to bring the deployed edge-function source into Git, so S6 and the remaining tests can follow? | **Yes, as an ATD-007 follow-up.** |

## 7. Security notes from the comparison

- **No service-role or private provider key is in the Wheel frontend.** The embedded JWTs decoded so far are `role: anon`.
- **`sb.js` adds another copy of the public anon key.** S1 should read it from config rather than hardcode a second copy.
- **Wheel's `js/app-config.js` still carries public n8n webhook URLs.** That is the same class of issue that retired `stock-checker`. S1 does not port them.
- **Wheel's `20260926_ap_email_cron.sql` hardcodes the production project URL.** That is a Codex-lane concern, not ported.
- **Open items from Wheel's own trust audit:**
  - rotate two Twelve Data keys that remain in its git history
  - rotate the cron secret used by older jobs
  - confirm market-data display licences

  These are owner and backend actions, recorded here so they are not lost.

## 8. Verification for this document

- Both repositories were read at the commits above. The Wheel repository was added to this session read-only and nothing was pushed to it.
- Shared `js/` files were compared byte-for-byte; the differing ones were compared by diff.
- Page pairs were compared by targeted reading of the differing sections.
- Spot-checked by hand:
  - the Wheel Calculator diff
  - the missing `js/options-hub-trading-layout.js`
  - the journal settlement line
  - `apGetAccessToken` being absent from V2.0's `app-config.js`
  - `wheel-status.js` importing `digest.js` from the site
- `ap_risk_settings.rules` was confirmed from ATD-005's deployed-schema tables.
- **Not done:** no code was run against Supabase, no page from the Wheel repository was opened in a browser, and no deployed function was called.
