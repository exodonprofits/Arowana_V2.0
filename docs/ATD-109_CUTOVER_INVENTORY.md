# ATD-109 cutover gap inventory: arowanaprofits.com, Wheel (219e61f) → Arowana V2.0 (d2c421c)

W = the Wheel repo `exodonprofits/arowanaprofits` at `219e61f` (its current main); V = this repository at `d2c421c`. Read-only; nothing run against Supabase, Stripe or the live site.

**Main finding.** Every top-level Wheel page has a V2.0 file with the same name, so most URLs keep resolving. The cutover risk is elsewhere:
- Founders checkout will be refused (price mismatch).
- Users cannot manage their email preferences.
- The legal pages are older than the features they describe.
- V2.0 has no root `robots.txt` and no `_redirects`.
- `/lab/*` URLs will 404.

---

## 1. URL map

How Wheel is served: Bluehost over FTPS. The deploy copies the top-level `*.html` pages, `robots.txt`, `sitemap.xml`, `*.png`, `css/`, `js/`, `images/` and `lab/` (W `.github/workflows/deploy-bluehost.yml:27,67-70`). It also writes `ap-version.txt` (`:71`). `_redirects` becomes `.htaccess` RedirectMatch rules, plus `ErrorDocument 404 /404.html` (`:107-126`).

V2.0 has no deploy workflow (V `docs/ATD-108_WHEEL_PORT_SPEC.md:48`).

Ext = likely linked from outside. S = in sitemap. E = digest email. $ = Stripe. A = auth redirect. L = legal or footer.

### 1a. Top-level pages (33). All exist in V2.0 under the same path.

| Wheel URL | Ext | V2.0 same feature? |
|---|---|---|
| `/` `index.html` | S, L | Yes. The landing page differs in copy (W index.html vs V index.html: 50 diff lines). The V2.0 footer links `docs.html`, which does not exist (V index.html:346). |
| `wheel-calculator.html` | S | Yes. V2.0 has the P9 fix (spec :280-283). |
| `assignment-risk.html` | S | Yes, byte-identical. |
| `pricing.html` | S, $ (cancel) | Yes. Founders is **$299** in V2.0 (V pricing.html:508) and $229 in Wheel (W pricing.html:504). Checkout is open in both (`AP_CHECKOUT_OPEN = true`, W :1008, V :1024). Handles `?checkout=cancelled` (W :1120, V :1140). |
| `tools.html` | S | Yes. The catalogue differs (108 diff lines). |
| `support.html` | S, L | Yes. The scan times and the Free-plan FAQ differ (W/V support.html:155-160). |
| `privacy.html` | S, L | Yes, but an **older text**. It does not list Resend (W privacy.html:148). See §2. |
| `terms.html` | S, L | Yes, but an **older text** (lines 124/132/144/176). See §2. |
| `disclosures.html` | L | Yes, but an **older text** on AI features (W :152 vs V :152). |
| `refunds.html`, `risk-disclosure.html`, `security.html` | L | Yes. The nav and wording differ. `risk-disclosure` describes models such as Black-Scholes and Graham that the wheel product does not centre on. |
| `about.html` | L | Byte-identical. |
| `contact.html`, `blog.html`, `learn-investing.html` | – | Yes, with nav and copy differences. Blog's "Subscribe" is a no-op in both (W blog.html:209-213). |
| `login.html` | A | Yes. See §4. |
| `signup.html` | A | Yes, with **regressions**. See §4. |
| `reset-password.html` | A | Yes. Same token handling (W :878-894, V :877-893). |
| `onboarding.html` | A (first run) | Yes, with small regressions. See §2. |
| `account.html` | E (`#email`), $ (success, portal return) | Page exists, **but has no `#email` section** (W account.html:1263-1302 has no V2.0 counterpart). |
| `billing.html` | $ (portal return) | Yes. Returns to `window.location.href` (V :815). |
| `checkout.html` | $ (success/cancel) | Yes. Handles `?status=success/cancelled` (V :911-912, :935). The Founders amount is 29900 (V :697). Wheel's is 22900 (W :696). |
| `404.html` | – | Yes. Links `short-term-dashboard` and `long-term-dashboard` instead of Trading Command and Options Hub (V 404.html diff). |
| `trading-command.html`, `options-hub.html`, `portfolio-command.html`, `arowana-trader.html`, `analysis-central.html`, `trade-journal-pro.html`, `credit-spread-planner.html`, `intrinsic-value.html`, `tax-loss-harvester.html` | E (options-hub, portfolio-command) | Yes. V2.0 is a superset that ported the Wheel pieces (spec §3.1, §9). All Wheel deep links resolve in V2.0: `options-hub ?tab=roll/puts/calls/watchlist/quality/check`, `portfolio-command ?tab=income/performance`, `trade-journal-pro ?action=import` (V trade-journal-pro.html:9818), `?q=`, the option prefill. |

Other files Wheel serves:
- `disc-ai.png` (nothing references it) and `ap-version.txt`: not in V2.0.
- `css/`: same set.
- `images/`: same set.
- `js/`: Wheel-only `lab.js` is absent.

### 1b. `lab/*` (29 pages, owner-only, behind Cloudflare Access per W docs/26-LAB.md:17-19). None exist under `/lab/` in V2.0, so all would 404.

| `/lab/…` | Closest V2.0 |
|---|---|
| admin, admin-usage, ai-moat-finder, ai-morning-brief, api-diagnostics, atr-stop-planner, dcf-analyzer, discipline-scorecard, dividend-tracker, expectancy-matrix, kelly-calculator, money-flow-alert, options-analyzer, position-sizer, r-multiple, risk-comfort, scanner, strategy-backtesting, technical-analysis, tool-audit, trade-plan-builder, trading-journal-analysis, volatility-guardrails, watchlist, whale-tracker | The same feature at root `/<name>.html`. Each is the same page or a newer one. |
| `lab/chart-analysis-form.html`, `lab/stock-analyzer.html` | Redirect stubs to `analysis-central.html?tab=ai` (V chart-analysis-form.html:8, stock-analyzer.html:8) |
| `lab/short-term-watchlist.html` | Stub to `watchlist.html` (V short-term-watchlist.html:8) |
| `lab/option-roll-tracker.html` (full roll ledger) | V `option-roll-tracker.html` offers a CSV/JSON export of saved chains, then redirects to `trade-journal-pro.html?tab=option` (V :55, :137) |

### 1c. `_redirects` rules (W _redirects:2-7)

| Rule | V2.0 today |
|---|---|
| `/market-intelligence.html` → `/trading-command.html` | Stub page with a **4-second** meta refresh to trading-command (V market-intelligence.html:11). Works. |
| `/market-intelligence` (no extension) → trading-command | **404**. There is no file and no rule. |
| `/options-recommender.html` → `options-hub.html?tab=puts` | Stub to `?tab=analyzer` (V options-recommender.html:7). Works, but lands on a different tab. |
| `/options-strategies.html` → `?tab=puts` | Stub to `?tab=strategies` (V options-strategies.html:7). Works, different tab. |
| `/portfolio-advisor.html` → portfolio-command | V2.0 serves a full **Portfolio Advisor** page, a different feature. |
| `/wheel-strategy.html` → arowana-trader | V2.0 serves the full **Wheel Strategy** page, a different feature (kept on purpose, spec :79, :102). |

### 1d. robots.txt and sitemap.xml
- **robots.txt**:
  - Wheel serves it at the root (W robots.txt; `Disallow: /lab/` :18; Sitemap :30).
  - **V2.0 has no root robots.txt.** The only copy is `documents/robots.txt` (V documents/robots.txt:1-28), which adds `/watchlist.html` (:14) and drops `/lab/`.
- **sitemap.xml**:
  - Wheel lists 8 URLs (W sitemap.xml:6-48). All exist in V2.0.
  - V2.0's sitemap adds `https://arowanaprofits.com/docs.html` (V sitemap.xml:42), **which does not exist**.

---

## 2. Wheel features with no or partial V2.0 equivalent

| Area | What Wheel users can do | V2.0 status |
|---|---|---|
| **Email preferences** (`account.html#email`) | Three opt-in toggles: weekday morning, expiration week, monthly statement. They are saved to `ap_email_prefs` (W account.html:1265-1302, 2435-2481). Preview builds each email through `arowana-digest` (W :2440, :2483-2505). There is also a "Pro only" note (W :2465-2470). | **Missing.** V account.html has no `#email` section and makes no `ap_email_prefs` calls. The digest's "Email settings" link points at `/account.html#email` (V supabase/functions/arowana-digest/index.ts:145). The emails are opt-in only, so **new users cannot sign up for them**. Users who unsubscribed cannot turn them back on, even though the unsubscribe page tells them to use account settings (index.ts:182). Spec §3.2 deferred this as "backend" (spec :73), but the table and function are already deployed. Only the UI is missing. |
| **One-click unsubscribe** | The link points at the function URL `…/arowana-digest?unsubscribe=<token>`, with GET and POST One-Click (index.ts:135, :145, :173-182). | **Unaffected.** It does not depend on the site. The cron and `ap_email_log` are server-side and unchanged. |
| Digest CTA links | `/portfolio-command.html?tab=income`, `/options-hub.html?tab=roll`, `/options-hub.html` (digest.js:326) | All exist in V2.0. |
| **Free plan** | Free includes CSV import, income and campaigns, and export (W js/plan.js:33-34; Wheel support FAQ W support.html:158). | **Lost.** V js/plan.js:33 sets `csv:false, income:false, export:false`. Spec decision Q4 (spec :86, :123). Free users lose import, income and export at cutover. |
| Free single-account Income view | Wheel shows Free users one account's income. | Not ported (spec :233). |
| **Onboarding** | 3 steps: want-to-own list, limits, journal. Re-running it with an existing list is allowed (W onboarding.html:95, :231, :297). Limits are saved through `AP_RISK`, which keeps rules. | V onboarding.html:233 disables Continue unless *new* tickers are picked, so re-running setup is blocked. Its direct upsert also resets `max_puts_per_ticker` to 2 and `warn_earnings` to true (V :313-318). The "Import a CSV" link uses `?import=1` (V :148), which trade-journal-pro does not handle; it reads `action=import` (V trade-journal-pro.html:9818). The schedule copy says ET times plus a 7:30 brief, where Wheel says Central. |
| Account usage | Has a "Plain-English explanations" monthly meter (W account.html:1225-1232). | V2.0 shows "Custom alerts" and "AI analyses today" meters instead. There is no explain-allowance meter, though Explain is ported (spec :271-279). |
| **Legal: Privacy** | Lists Resend as the email processor (W privacy.html:148). Dated "26 September 2026" (:124). | Older text with **no Resend** (V privacy.html:148) and an undated "September 2026". Emails keep sending after cutover, so the policy would omit a processor that receives positions and income data. |
| **Legal: Terms** | Says Check a Trade and explanations are not advice (:132). Gives Pro and Founders billing cycles and automatic renewal (:144). Cancellation is through the billing portal, then deletion by email (:176). | Older text. It omits Check a Trade and the explanations. It says "monthly or annual" for Founders, which contradicts Founders being annual only (price-guard.js:23-24). It says the account can be closed "from the Account page" (V terms.html:176), which no flow supports. |
| **Legal: Disclosures** | Names the three LLM features: AI Coach, Explain in plain English, Argue both sides (W disclosures.html:152). | Mentions only the AI Coach (V :152), although V2.0 now ships Explain and Argue both sides (spec :277-279). |
| `lab/` owner gating | `js/lab.js` role gate, `noindex`, and Cloudflare Access on `/lab/` (W docs/26-LAB.md). | Not ported (Q3, spec :85, :122). The admin and diagnostic pages are at the root (`admin.html`, `admin-usage.html`, `api-diagnostics.html`) and gated only in the page (V admin.html:571), outside any Access rule on `/lab/`. |
| `lab/option-roll-tracker` | A full roll-chain ledger. | V2.0 converts it to export-then-redirect (V option-roll-tracker.html:45-55). Spec :103 says it would be kept; PROJECT_STATUS.md:44 records the later retirement. |
| `lab/chart-analysis-form`, `lab/stock-analyzer`, `lab/short-term-watchlist` | Standalone pages. | Merged into the Analysis Central AI tab and Watchlist (§1b). |
| Wheel Calculator | The same tool. | Same, plus fixes. It scrolls sideways at 375px (spec :304). |
| Assignment Risk | — | Identical. |
| Deliberately not ported (spec §3.3) | — | None of these lose a Wheel *user* feature: the inlined rail, Wheel's `_redirects`, Wheel's removals (V2.0 keeps more), the shorter scanner-defs, the lab restructure and the plan.js free tier. The exceptions are the plan.js free tier (above) and `_redirects` (§5). |

---

## 3. Hard-coded domains and URLs

| Location | Value | Cutover implication |
|---|---|---|
| W & V `supabase/functions/arowana-checkout/index.ts:23` | `AROWANA_SITE_URL` env | CORS allows only exactly SITE or localhost (:24-28). `safeUrl` accepts only SITE-prefixed or localhost URLs (:50-56). The default success URL is `SITE/account.html?checkout=success&plan=` (:122) and the default cancel URL is `SITE/pricing.html?checkout=cancelled` (:123). **V2.0 needs `account.html` and `pricing.html`; both exist.** checkout.html sends its own `checkout.html?status=…` URLs (V :911-912). |
| V `arowana-billing-portal/index.ts:12, :65` | `AROWANA_SITE_URL`; default return `SITE/account.html` | Exists. account.html sends `origin + '/account.html'` (V :1734) and billing.html sends its own URL (V :815). |
| V `arowana-research/index.ts:15`, `arowana-coach/index.ts:12` | `AROWANA_SITE_URL` | CORS only. A pre-cutover V2.0 staging host (e.g. `*.pages.dev`) would fail CORS for market data, checkout and the portal. |
| W & V `arowana-digest/index.ts:21, :144-145` | `APP_URL`, default `https://arowanaprofits.com` | Builds `/account.html#email` (missing section) and the CTA paths in digest.js:326 (exist). Unsubscribe uses the function URL. |
| `arowana-ai-coach`, `arowana-explain`, `arowana-digest`, `arowana-founders-count` | CORS `*` (ai-coach :24, explain :25, digest :34, founders-count :9) | No site dependency. |
| W `supabase/migrations/20260926_ap_email_cron.sql` | Production project URL; secrets `RESEND_API_KEY`, `DIGEST_FROM`, `APP_URL` (:4) | Server-side and unchanged by cutover. V2.0 does not carry the cron migrations (V supabase/baselines/README.md:26). |
| Both: `pricing.html:1009/1025`, `checkout.html:870/875`, `account.html:1757/1731`, `index.html:419/415`, `js/explain.js:24`, `js/market-data.js:17` | `https://pbojacnagutipfhcxltj.supabase.co/functions/v1/...` | Same project, so no change. |
| Both: `index.html:9,14`, `wheel-calculator.html:8`, `assignment-risk.html:8`; V also `guide-claude-tradingview-windows.html:8`, `market-intelligence.html:12`, `swing-trader.html:162` | `https://arowanaprofits.com/...` canonical/og | Fine on the same domain. |
| W `.github/workflows/deploy-bluehost.yml:144` | `https://arowanaprofits.com/` and `/staging/` | The Wheel deploy verifies `ap-version.txt`. V2.0 needs its own deploy (§5). |
| V `supabase/config.toml:98, :158, :162, :194` | `127.0.0.1` site_url and redirect URLs | Local stack only. The hosted Auth Site URL and Redirect URLs are set in the dashboard and are not in either repo. |
| Both `js/supabase_min.js:7` | `localhost:9999` | SDK default; harmless. |
| Both `js/supabase-init.js:67-80, :106` | `emailRedirectTo` / `redirectTo` = current page; `location.replace(redirect?next=)` | The current origin, so it works on the same domain. |
| Both `login.html` (W :1194, V :1185; W :1230, V :1221), `signup.html` (W :894, V :876; W :947, V :929) | `redirectTo` built from `location.origin` | See §4. |
| Both `blog.html:209/211` | "Unsubscribe anytime" | Cosmetic. The form does not submit anywhere. |
| No `*.pages.dev` or `*.netlify*` in either repo. W `_redirects:1` says "Cloudflare redirects", but the actual host is Bluehost. | | |

---

## 4. Auth flows

| Flow | Wheel | V2.0 | Gap |
|---|---|---|---|
| Password reset | `redirectTo: origin/reset-password.html` (W login.html:1194). The page handles `?code=` through `exchangeCodeForSession` and legacy `#access_token` through `setSession` (W reset-password.html:870-894). | Identical (V login.html:1185; reset-password.html:869-893). | None. |
| Google OAuth (login) | `redirectTo: origin/login.html?next=…` (W :1230). login handles `#access_token`, `provider_token` and `?code` (W :1035-1036). | Identical (V :1221, :1031-1032). | None. |
| Google OAuth (signup) | `redirectTo: signup.html?next=…` (W :947) | Same (V :929) | None. |
| Email-confirm signup | `emailRedirectTo: origin/<next>`. `next` is sanitised by `apSafeNext` (same-origin `.html` only) (W signup.html:705-717, :852, :894). | `next = params.get('next') || 'trading-command.html'` is **unsanitised** (V signup.html:834) and used in `emailRedirectTo` (:876) and `location.replace(next)` (:839, :911). | Security regression: an open redirect on the signup page, including after sign-in. Supabase's allowlist would only stop the email-link part. |
| Checkout → login → signup | login carries `?next=` into the "Create one" link (`#signupLink`, W login.html:686, :850-854). signup shows a "One step before checkout" banner (W :594, :721). | No `id="signupLink"` (V login.html:682) and no carry-over code. The banner appears only for `?plan=pro` and says "**$19/mo**" (V signup.html:594, :706). | **A new buyer who has to create an account lands on Trading Command, not checkout.** The banner shows the wrong price. |
| "Keep me signed in" | Removed because it was never wired (W login.html comment in diff). | The checkbox is present (V login.html:665-666) and does nothing. | Misleading on shared computers. |
| Shared client | `sb.js` everywhere. | login, signup, checkout, billing and onboarding still call `createClient` (V checkout.html:715-720, signup diff), which `sb.js` turns into the shared client where it is loaded (spec :167, :183). | Low risk. |
| Supabase dashboard | Site URL and Redirect URLs must allow `https://arowanaprofits.com/**` (reset-password.html, login.html?next, signup.html?next, any `.html` next). | The same paths exist in V2.0. | No change needed **if served on the same domain**. Any staging domain must be added to Redirect URLs and to `AROWANA_SITE_URL` for CORS. |

---

## 5. Site config

| File | Wheel | V2.0 | Needed |
|---|---|---|---|
| `_redirects` / `.htaccess` | 6 rules (W _redirects:2-7) → generated `.htaccess` with `ErrorDocument 404 /404.html` (W deploy-bluehost.yml:107-126) | None | See below. |
| `404.html` | Exists | Exists (links differ) | Wire `ErrorDocument 404 /404.html` on the host. |
| `robots.txt` | Root | Only `documents/robots.txt` | Move it to the root. Decide on `/lab/`: either keep the Disallow while old lab files linger, or redirect. |
| `sitemap.xml` | 8 URLs | 9 URLs, including the nonexistent `docs.html` (:42) | Remove `docs.html` or create the page. |
| `_headers` | None | None | — |
| Deploy | Bluehost FTPS with an allowlist (no `supabase/`, `docs/`, `.md`) | No workflow. `documents/` holds business-plan `.docx` files and `DEPLOY-README.txt`. | A V2.0 deploy must exclude `documents/`, `docs/`, `supabase/`, `scripts/`, `tests/`. FTP-Deploy-Action removes only the files it uploaded (W deploy-bluehost.yml:29-30). Deploying V2.0 another way leaves Wheel's old `lab/` and `ap-version.txt` on the server, still served with Wheel-era code. |

**Redirect rules V2.0 needs:**
1. `/market-intelligence` (no extension) → `/trading-command.html` 301. The `.html` form is covered by a 4-second stub; a server 301 is better.
2. `/lab/(.*)` → `/$1` 301 for the 25 lab pages with a root twin, including `chart-analysis-form`, `stock-analyzer` and `short-term-watchlist`, which have root stubs. `lab/option-roll-tracker.html` → `/option-roll-tracker.html`, so saved chains are still offered for export. Alternatively, keep `/lab/` closed under Cloudflare Access and point it at the root.
3. **Do not** port `/portfolio-advisor.html`, `/wheel-strategy.html`, `/options-recommender.html` or `/options-strategies.html`. V2.0 serves real pages or stubs at those paths (spec :78-79). Owner decision: Wheel users bookmarked `wheel-strategy.html` → Wheel Coach, and will now get a different page.

---

## 6. Prioritised list

### BLOCKER
1. **Founders checkout will be refused.** The deployed `arowana-checkout` v14 guard expects 22900 (V supabase/baselines/README.md:58, :68-70). V2.0 checkout and pricing show and send $299 (V checkout.html:697; pricing.html:508), and the repo guard is 29900 (V price-guard.js:23-24). Before or at cutover: create a $299/year Stripe Price, set `STRIPE_PRICE_FOUNDERS`, and redeploy `arowana-checkout` from V main (V PROJECT_STATUS.md:9). Otherwise keep $229 for now. Pro is unaffected.
2. **No email preference UI.** The digest "Email settings" link (`/account.html#email`, digest index.ts:145) lands on an account page with no Email section. Nobody can opt in to emails or turn them back on. Port W account.html:1263-1302 plus the script at :2435-2513 into V2.0's account.html. The table and function are already live.
3. **Legal pages are behind the product.**
   - Privacy omits Resend, which receives position and income data (W privacy.html:148).
   - Disclosures omits two shipped LLM features (V disclosures.html:152).
   - Terms misstates the Founders cycle and the account-closure route (V terms.html:144, :176).
   - Fix: port Wheel's privacy, terms and disclosures text, adjusted for V2.0's extra features (and the $299 Founders price, if chosen).
4. **No root `robots.txt`** (V documents/robots.txt only). Crawlers would get a 404 and index the signed-in desk, account and checkout pages. Blocker if robots is treated as site config; otherwise treat it as SHOULD.

### SHOULD
5. Checkout → login → signup loses `next`, so new buyers miss checkout (V login.html:682; signup.html:834). Port `#signupLink`, `apSafeNext` and the checkout banner from W login.html:686, :850-854 and signup.html:594, :705-721. This also closes the open-redirect regression.
6. `_redirects` equivalent for `/lab/*` and `/market-intelligence`, plus `ErrorDocument 404` (§5).
7. Free-plan downgrade: CSV import, income and export become Pro (V js/plan.js:33 vs W :33-34). Existing Free users lose access. This needs an owner decision (Q4) and matching pricing and support copy.
8. A V2.0 deploy process that excludes `documents/` (business plans), `docs/` and `supabase/`, and removes the stale Wheel `lab/`.
9. Onboarding regressions: re-run blocked (V onboarding.html:233), risk settings overwritten (:313-318), broken `?import=1` link (:148 vs trade-journal-pro.html:9818).
10. Sitemap and homepage link to the nonexistent `docs.html` (V sitemap.xml:42; index.html:346).
11. Wheel-era bookmarks for `wheel-strategy.html` and `portfolio-advisor.html` now open different V2.0 pages. Decide whether this is intended.

### NICE
12. Signup banner says "$19/mo" (V signup.html:594). The unwired "Keep me signed in" checkbox (V login.html:665).
13. Explain usage meter missing on Account (W account.html:1225-1232).
14. `risk-disclosure` and `security` copy describe the broad platform rather than the wheel desk. Review the wording.
15. Blog newsletter form is a no-op in both (W blog.html:213).
16. Root admin and diagnostic pages sit outside the old `/lab/` Cloudflare Access lock. They are gated in the page and by RLS only; consider adding Access rules for them.
17. Before cutover, test any staging host by adding it to `AROWANA_SITE_URL` and the Supabase Auth Redirect URLs. Edge-function CORS (checkout, billing-portal, research, coach) accepts only that exact origin or localhost.
