# ATD-109 launch-day runbook: V2.0 on arowanaprofits.com

**Written 2026-10-07** from `main` at `1bc2f1e` and the live Supabase project. It replaces the cutover window in the [cutover plan](ATD-109_CUTOVER_PLAN.md). That plan still holds the decisions and background.

Allow about 90 minutes, at a quiet hour (evening or weekend, not market hours). **You** run steps that need your logins: GitHub, Stripe, cPanel, Supabase dashboard, Cloudflare. **Claude** runs the function deploy and the checks. Do the steps in order. Each step says what "done" looks like and what to do if it isn't.

## Where things stand

| | Now | After launch |
|---|---|---|
| arowanaprofits.com | Wheel Strategy Desk (`exodonprofits/arowanaprofits`, `219e61f`) | V2.0 (this repo) |
| arowanaprofits.com/staging/ | V2.0 `1bc2f1e` | V2.0, kept for testing |
| `arowana-checkout` | v14, checks Founders against **$229** | Redeployed from `main`, checks **$299/year** |
| `STRIPE_PRICE_FOUNDERS` | the $229 price | the new $299/year price |
| `arowana-explain`, `arowana-ai-coach` | v3, v19 (already from `main`) | unchanged |
| `arowana-stripe-webhook`, `-billing-portal`, `-digest`, `-research`, `-coach`, `-founders-count` | live, shared by both sites | unchanged |
| Wheel repo's deploy | push-deploy off; manual only | kept enabled for rollback; disable after a clean week |

The webhook decides the plan from checkout's metadata (`plan: founders`), not the price ID. A new Founders price therefore needs no webhook change.

## Before the day

Do these any time beforehand. None of them changes the live site.

1. **Staging test passes.** At `arowanaprofits.com/staging/`, signed in:
   - journal edit syncs;
   - Watchlist add;
   - Options Hub, Check a Trade, Roll Coach;
   - Explain and Argue both sides;
   - Retirement write-up;
   - Portfolio Advisor;
   - Account usage meters move;
   - LTP CSV import;
   - Billing shows your real plan;
   - Pro checkout reaches the Stripe page (cancel there).
2. **Supabase Auth redirect URLs.** Go to Supabase → Authentication → URL Configuration → Redirect URLs.
   - Make sure both `https://arowanaprofits.com/**` and `https://arowanaprofits.com/staging/**` are listed. Site URL stays `https://arowanaprofits.com`.
   - Why: V2.0 sends Google sign-in, password reset and email confirmation back to the exact page (#71). The Wheel sent them to the bare domain. If the pattern is missing, Google sign-in on the live site lands on the home page instead of returning you.
3. **Create the Founders price in Stripe**, live mode, but don't use it yet:
   - Go to Products → the Founders product → Add price.
   - Recurring, **$299.00 USD, yearly**. Checkout refuses any other amount, currency or interval.
   - Copy the new `price_…` ID. Leave the $229 price active until launch is done, because the live Wheel site uses it.
4. **Look at the production `.htaccess`.** Go to cPanel → File Manager → document root → `.htaccess` (show hidden files).
   - Copy any rules you want to keep (for example a forced-HTTPS rule) and send them to Claude. Claude adds them to the workflow's "Kept from the server" block in a small PR, before launch.
   - Then set the repository variable **`MANAGE_HTACCESS` = `true`** in Arowana_V2.0 (Settings → Secrets and variables → Actions → Variables).
   - Without it, the `/lab/*` redirects and the 404 page don't go live on production.
5. **Rotate the n8n token** (open item). It isn't tied to launch, but do it before more people sign up.
6. **Optional:** send a short note to existing Free users. CSV import, income/campaigns and export become Pro at launch (decision D2). The pricing and support pages already say so.

## Launch

### L1. Deploy V2.0 to production (you, 5 min)
- Go to Arowana_V2.0 → Actions → **Deploy to Bluehost** → **Run workflow ▾**, set branch `main` and target **production**, then press the green **Run workflow** inside the panel.
- **Done when:** the run is green and its last step prints `OK: https://arowanaprofits.com/ serves <sha>`. Tell Claude, who checks the log and spot-checks pages.
- **Founders checkout is refused from here until L3.** The new pages show $299 while checkout v14 still expects $229. The buyer sees "This plan is being updated. You have not been charged." So go straight on to L2 and L3.
- **If it fails:** the old Wheel site is still being served, because the upload runs as one job. Send Claude the log. Nothing else needs undoing.

### L2. Point Founders at the new price (you, 2 min)
- Go to Supabase → Edge Functions → Secrets.
- Set **`STRIPE_PRICE_FOUNDERS`** = the `price_…` ID from step 3 before the day.
- Check **`AROWANA_SITE_URL`** = `https://arowanaprofits.com`. It's unchanged, so this is just a look.

### L3. Deploy the $299 checkout (Claude, 2 min, after you say go)
- Claude deploys `arowana-checkout` from `main` (the $299/year check) and confirms the new version number.
- **Done when:** the function is ACTIVE with a version above v14.

### L4. Purge the cache (you, 1 min, only if Cloudflare proxies the site)
- Go to Cloudflare → arowanaprofits.com → Caching → Configuration → **Purge Everything**.
- Without it, some visitors keep getting old Wheel pages for a while.

### L5. Smoke test (you and Claude, 20 min)
Use a private browser window, then your phone.

| # | Check | Expected |
|---|---|---|
| 1 | `arowanaprofits.com` | V2.0 home ("Wheel Strategy Desk", Founders $299) |
| 2 | `arowanaprofits.com/ap-version.txt` | the commit from L1 |
| 3 | Sign in with email, then sign out, then sign in with Google | each lands back where you started; Sign Out goes to sign-in |
| 4 | Trading Command, Watchlist, Portfolio, Journal | your real data; the journal edit you made on staging is there |
| 5 | Account | your plan, usage meters, Experience level, email toggles; a digest preview opens |
| 6 | Billing | your real plan; "Open billing portal" opens Stripe (this button was dead before this PR; Account's "Manage billing" always worked) |
| 7 | Pricing → **Start Pro** with a new test account | Stripe checkout at $29/month. Cancel on the Stripe page. |
| 8 | Pricing → **Become a founding member** | Stripe checkout at **$299/year**. Pay with a real card, check Account shows Founding Member within a minute, then refund in Stripe. |
| 9 | `arowanaprofits.com/lab/watchlist.html` | redirects to `/watchlist.html` |
| 10 | `arowanaprofits.com/no-such-page` | the Arowana 404 page |
| 11 | `arowanaprofits.com/robots.txt` | V2.0's file (disallows `/staging/`, `/lab/`) |
| 12 | Phone: delete the old home-screen icon, open the site in Safari, Share → Add to Home Screen ("Open as Web App" on) | opens full screen on Trading Command, bottom bar, no address bar |

Claude checks alongside you:
- the Supabase function logs for `arowana-checkout` (no "price mismatch") and `arowana-stripe-webhook` (the Founders test wrote `arowana_plan = founders`);
- that the live pages serve the new commit.

**If check 8 is refused:** the price ID or its amount, currency or interval is off. Claude reads the exact reason from the log. Fix the price in Stripe or the secret, then retry. No redeploy is needed.

## After launch

- **First 48 hours:** Claude checks the function logs once a day for checkout refusals, webhook errors and AI function errors, and reports back.
- **The old $229 price:** once check 8 passes, archive it in Stripe. Existing Founders keep their own subscription price; archiving only stops new sales of it.
- **After a clean week or two:** disable the Wheel repo's deploy workflow (`exodonprofits/arowanaprofits` → Actions → Deploy to Bluehost → ⋯ → Disable workflow), then archive that repo read-only. Keep it as the record of what was live.
- **Deploy-on-push for V2.0:** leave `DEPLOY_ON_PUSH` off. Production deploys stay a deliberate **Run workflow → production**, as they have been for staging.

## Rollback

Use this if V2.0 is badly broken on production and can't be fixed in minutes.

1. **Site:** go to `exodonprofits/arowanaprofits` → Actions → Deploy to Bluehost → Run workflow → **production**. This puts the Wheel Desk back. Its run checks the served commit the same way.
2. **Founders price** (only if L2 and L3 ran): set `STRIPE_PRICE_FOUNDERS` back to the $229 price ID. Claude redeploys `arowana-checkout` from the Wheel repo (the $229 check).
3. **Cache:** purge Cloudflare again.
4. **Data:** nothing to undo. Both sites use the same tables, and V2.0 made no schema change at launch.

The `ap_usage` "explain" migration and the `arowana-explain` / `arowana-ai-coach` deploys don't need rolling back. The Wheel site doesn't call the new parts.
