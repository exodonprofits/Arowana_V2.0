# ATD-108 handover to Codex

This is the backend work that remains after the frontend slices of ATD-108. The checks below were run on 2026-10-04 and were read-only:
- `information_schema` and `pg_class`/`pg_policies` queries;
- the edge-function list;
- one function's source.

Nothing in production was changed. Spec: [ATD-108_WHEEL_PORT_SPEC.md](ATD-108_WHEEL_PORT_SPEC.md); decision **Q6** asks Codex (ATD-007) to bring the deployed backend into Git.

## 1. What is already merged (frontend)

| PR | What |
|---|---|
| #33 | S1: one shared Supabase client (`js/sb.js`); `apGetAccessToken()` |
| #34 | S2: journal manifest sync (cross-device deletes, safety cap), chunked Delete All, option settlement |
| #35 | S3: `js/wheel-ledger.js`, wheel campaigns panel; Add/Edit/Delete Holding write journal lots; Node Tests workflow |
| #36 | S4: Options Hub "Check a trade", `js/risk.js` rules in `ap_risk_settings.rules` |
| #37 | S5: `js/explain.js` (calls `arowana-explain`), Wheel Calculator fix, scanner plan from `plan.js` |
| #38 | Seven pages take Pro from `plan.js` instead of `localStorage.ap_is_pro_v1` |
| #39 | Trade Journal option preview: real max risk / max profit |
| #40 | Wheel Calculator fits on phones |
| #41 | Removed Portfolio Command's unused CSV wizard and its `portfolio` table code |

## 2. The Supabase project is shared

Project `pbojacnagutipfhcxltj` ("Exodon Profits") also holds other products. It has `salon` and `service` schemas and the Salon/Rental Genie edge functions. **Migrations and function work for Arowana must be scoped to Arowana's tables and functions only.**

## 3. Edge functions the Arowana frontend calls

| Function | Deployed | Source in Git |
|---|---|---|
| `arowana-explain` | v2, `verify_jwt` on | Wheel repo only. **Deployed source checked: identical to Wheel's `supabase/functions/arowana-explain/index.ts` + `_shared/number-guard.js`.** |
| `arowana-ai-coach` | v18, `verify_jwt` on | Wheel repo only (`index.ts`), not compared with the deployed version |
| `arowana-checkout` | v14 | Wheel repo only (`index.ts`, `price-guard.js`), not compared |
| `arowana-digest` | v3 | Wheel repo only (`index.ts`, `digest.js`), not compared |
| `arowana-research` | v7 | none (market-data proxy used by `js/market-data.js`) |
| `arowana-billing-portal` | v3 | none |
| `arowana-founders-count` | v3 | none |
| `arowana-stripe-webhook` | v11 | none (no frontend caller; Stripe writes `profiles.arowana_plan`) |
| `arowana-coach` | v4 | none |
| `schwab-auth-callback` | **not deployed** | none. `schwab-callback.html` calls `/functions/v1/schwab-auth-callback` **relative to the site**, so it cannot work as written. |

Suggested order:
1. Download each deployed function (`supabase functions download <slug>`).
2. Diff it against the Wheel copy where one exists.
3. Commit the deployed version.

The Wheel repo is `exodonprofits/arowanaprofits`, read at `219e61f`.

## 4. Tables the frontend uses

All exist in production with row-level security on. The number after each table is its policy count.

- **Journal:**
  - `tj_stocks` (5)
  - `tj_options` (5)
  - `trading_journal` (4)
  - `journal_trades` (4)
- **Plan, risk, usage:**
  - `profiles` (4)
  - `ap_risk_settings` (1; has the `rules jsonb` column)
  - `ap_usage` (1)
  - `ap_founders_waitlist` (1)
- **Watchlists and scans:**
  - `watchlists` (9)
  - `watchlist_items` (7; has `want_to_own`, `target_buy_price`)
  - `market_snapshots` (1)
  - `option_chains` (4)
  - `csp_candidates` (4)
  - `cc_candidates` (4)
  - `daily_setups` (2)
  - `ap_roll_coach` (2)
  - `option_roll_chains` (1)
  - `ai_briefs` (4)
- **Portfolio and finance:**
  - `user_cash_balances` (1)
  - `user_deployment_plans` (1)
  - `financial_accounts` (`public` 3 / `arowana` 4)
  - `entities` (`public` 3 / `arowana` 4)
  - `finance_transactions` (4)
- **Config and keys:**
  - `user_api_keys` (5)
  - `app_config` (2)
  - `business_profiles` (6)
- **Views:**
  - `arowana_webhooks`
  - `arowana_tools`
  - `user_preferences`
  - `v_finance_month_summary_all`
  - `v_finance_top_categories_month_all`

**This repo has no migrations for any of them.** `supabase/` holds only `README.md` and `config.toml` and is on containment hold. The Wheel repo has five migrations:
- `20260925_ap_risk_settings_rules.sql` (already applied: the column exists)
- `20260926_ap_email.sql`
- `20260926_ap_email_cron.sql`, which hardcodes the production URL (see spec §7)
- `20260927_security_profiles_config.sql`
- `20261001_ap_email_cron_secret.sql`

Other notes:
- **Retired for Portfolio Command:** `public.portfolio` and `arowana.portfolio_options`. Nothing on that page reads or writes them since #41, and `scripts/test_portfolio_source.py` guards that. `long-term-portfolio.html` still uses `portfolio` for its own records.
- **Referenced but missing:** `retirement_inputs`, but only in a TODO comment in `retirement-planner.html`.

## 5. What is blocked on this

- **S6 "Your wheel today" is done on the frontend.** `js/digest.js` is a byte-for-byte copy of the deployed `arowana-digest/digest.js`. When you commit the function source, keep `supabase/functions/arowana-digest/digest.js` identical to `js/digest.js`; `scripts/test_wheel_today.py` checks this. Alternatively, make one the source and generate the other.
- **Node tests:** `tests/digest.test.js` already runs against `js/digest.js`. `number-guard` and `price-guard` tests run in the same `Node Tests` workflow once their sources are in the tree; Wheel's test files can be copied unchanged.

## 6. Owner and backend actions still open

- Rotate the n8n token that is in git history from the retired `stock-checker.html`.
- From Wheel's trust audit:
  - rotate two Twelve Data keys that remain in its git history;
  - rotate the old cron secret;
  - confirm market-data display licences.
- Add the `stock_analyzer` and `quality_screener` webhooks used by Analysis Central and the Quality Compounders scan.
- Run a live sign-in check of S1–S5. Every frontend test so far used synthetic data against a fake Supabase (`scripts/browser/lib/fake_supabase.mjs`).

## 7. Reusable test tools

- `scripts/browser/lib/fake_supabase.mjs` provides a synthetic session plus an in-memory PostgREST and edge-function stubs, so a page runs unmodified with no network. Every Arowana browser check since S3 uses it.
- `.github/workflows/node-tests.yml` runs Node's built-in test runner with no package manager.
