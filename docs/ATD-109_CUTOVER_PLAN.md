# ATD-109: launch V2.0 on arowanaprofits.com

**Status:** plan, 2026-10-05. Nothing deployed. Detail and file:line evidence: [cutover gap inventory](ATD-109_CUTOVER_INVENTORY.md).

## Where things are

- **arowanaprofits.com** serves the Wheel Strategy Desk (`exodonprofits/arowanaprofits`, `219e61f`, unchanged since the ATD-108 port). It is hosted on **Bluehost**, deployed over FTPS by that repo's `Deploy to Bluehost` workflow, which has two targets: `staging` (`arowanaprofits.com/staging/`) and `production`. Its `_redirects` file is turned into an `.htaccess` by the workflow.
- **V2.0** (this repository) is not deployed anywhere and has no deploy workflow.
- Both use **one Supabase project and the same edge functions.** Deploying a function affects the live Wheel site immediately.

What carries over by itself: all 33 public Wheel pages exist in V2.0 under the same names; password reset and Google sign-in work the same way; the digest email's links resolve, apart from `account.html#email` (below); Stripe success, cancel and portal return pages exist; the Supabase Auth URLs need no change because the domain stays the same.

## Owner decisions

**Decided 2026-10-05: all five as recommended.** Founders $299 at launch; the Free plan change stands and is stated on pricing and support before launch; V2.0's pages keep the old Wheel paths; `/lab/*` redirects to the root pages; `documents/` leaves the repository (its files stay in Git history).

| # | Decision | Recommendation |
|---|---|---|
| D1 | Founders price at launch. Live today: $229. V2.0: $299 (#48). | Keep $299 if that is still the intent; it switches in the cutover window (C3). |
| D2 | Free plan. V2.0 makes CSV import, income/campaigns and export Pro-only (ATD-108 Q4); Wheel's Free plan has them. Existing Free users lose them at launch. | Confirm, and say so on pricing/support before launch; or keep them Free for existing accounts. |
| D3 | Old Wheel URLs that V2.0 now uses for other pages: `wheel-strategy.html` (Wheel sent it to the coach), `portfolio-advisor.html`, `options-recommender.html`, `options-strategies.html`. | Accept: V2.0's pages at those paths are the intended features. |
| D4 | `/lab/*` (29 owner-only pages behind Cloudflare Access). | 301 `/lab/<page>` to the root page of the same name; put the root admin/diagnostic pages under an Access rule. |
| D5 | `documents/` holds the business and project plans (.docx). | Move them out of the repository; the deploy must never upload them either way. |

## Work before staging (Claude Code unless noted)

**Must (blockers in the inventory):** items 1–4 and the `docs.html` link (item 9) are done in `claude/ATD-109-deploy`.
1. **Deploy workflow for V2.0**, adapted from Wheel's: same `staging`/`production` targets and secrets, an explicit allowlist (top-level pages, `robots.txt`, `sitemap.xml`, `css/`, `js/`, `images/`), never `documents/`, `docs/`, `supabase/`, `scripts/`, `tests/`; `_redirects` → `.htaccess`, `ErrorDocument 404 /404.html`.
2. **`_redirects`** for `/lab/*` (D4) and the extensionless `/market-intelligence`.
3. **Root `robots.txt`** (V2.0 only has `documents/robots.txt`).
4. **Relative asset paths on six pages** (`learn-investing`, `long-term-dashboard`, `portfolio-advisor`, `scanner`, `trade-journal-pro`, `watchlist`) that load `/js/...` from the site root. Under `/staging/` they would run the live Wheel scripts, including Wheel's `journal-sync.js`.
5. **Done in `claude/ATD-109-email-prefs`.** **Email preferences on Account** (`account.html#email`): port Wheel's section (three opt-in toggles saved to `ap_email_prefs`, preview through `arowana-digest`). The digest's "Email settings" link lands there; without it nobody can opt in, or back in.
6. **Done in `claude/ATD-109-legal` (wording approved by owner).** **Legal pages:** bring Privacy (Resend as processor), Terms (Founders annual only; real cancellation route) and Disclosures (Explain and Argue both sides) up to date from Wheel's newer text. **Claude drafts, owner approves the wording.**

**Should:**
7. **Done in `claude/ATD-109-signup-next`.** Sign-up during checkout: carry `next` from login to signup and restore Wheel's same-site check on it (V2.0's signup currently follows any `next`, an open redirect); fix the "$19/mo" banner.
8. **Done in `claude/ATD-109-onboarding`.** Onboarding: allow re-running setup, stop resetting two risk settings, fix the CSV import link (`?action=import`).
9. Remove the dead `docs.html` link (sitemap and home footer); remove or wire the "Keep me signed in" box.

## Staging test (owner, about an hour)

Run the V2.0 workflow with target `staging`, then at `https://arowanaprofits.com/staging/`: sign in; journal loads and an edit syncs (it is the real journal); Portfolio Command holdings; import the holdings on `long-term-portfolio.html`; Options Hub tabs, Check a Trade and Roll Coach; Arowana Trader "Your wheel today"; Account email toggles and a preview; password reset email; Pro checkout to the Stripe page (cancel there). Do not test Founders checkout until C3. Known before staging: `watchlist.html` throws on an account with no saved watchlist (same on `main`; check a brand-new account on staging).

Same origin as production, so no Supabase Auth or CORS change is needed. Staging and the live site share data: anything saved on staging is saved for real.

## Cutover window (owner, with Claude on hand)

- C1. Look at the production `.htaccess` in cPanel and copy any existing rules into the workflow's "kept" block before enabling `MANAGE_HTACCESS`.
- C2. Run the V2.0 workflow with target `production`. Check `ap-version.txt` shows the V2.0 commit.
- C3. Founders (D1): create the $299/year Stripe price, set `STRIPE_PRICE_FOUNDERS`, deploy `arowana-checkout` from `main`. Not before C2: the live Wheel page would show $229 against a $299 check and refuse every Founders checkout.
- C4. Deploy `arowana-explain` from `main` (can also go earlier; it is additive).
- C4b. Deploy `arowana-ai-coach` from `main` (Portfolio Advisor's AI; additive, the Wheel Desk uses the unchanged default mode, so it can also go earlier).
- C5. Smoke test on production: home, sign-in, journal, checkout page loads, a digest preview from Account, `/lab/watchlist.html` redirects, `robots.txt`.
- C6. Turn off the Wheel repo's `DEPLOY_ON_PUSH` so a Wheel push cannot overwrite V2.0. Remove Wheel-only leftovers on the server that V2.0's deploy did not upload (`lab/`, `ap-version.txt` is rewritten).

**Rollback:** run the Wheel repo's workflow with target `production` (redeploys the Wheel site); if C3 ran, also point `STRIPE_PRICE_FOUNDERS` back to the $229 price and redeploy `arowana-checkout` from the Wheel repo.

## After

Archive `exodonprofits/arowanaprofits` read-only once V2.0 has run cleanly for a couple of weeks. Keep it: it is the reference for what was live.
