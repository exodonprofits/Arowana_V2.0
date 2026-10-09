# Launch readiness (ATD-109 pre-launch, 2026-10-09)

## Decision: **NO-GO today → CONDITIONAL GO once the P0/P1 gate items below are closed**

Reason for NO-GO:
- There is one confirmed P0: a reflected XSS that can take a signed-in member's session from a crafted link.
- Paid checkout has not been verified end to end.

Neither is large. R-1 (the XSS) is a small change, and R-6 (checkout) is a test the owner runs at L3.

## Health score: **62 / 100**

The rubric is fixed in advance. Each category has a maximum, and each deduction cites a finding.

| Category | Max | Score | Deductions |
|---|---|---|---|
| Core functionality | 30 | 22 | −4 checkout/Stripe unverified end to end (R-6); −3 two scans broken (D-4); −1 Options Hub NaN chart (D-10) |
| Security | 20 | 9 | −7 P0 reflected XSS (D-1); −2 webhook table anon-readable, n8n caller checks unknown (D-2); −1 stale duplicates published (D-5); −1 BYOK/direct provider leftovers (R-9) |
| UX: desktop + mobile + tablet | 15 | 10 | −3 public header overflow 701-1160px on 12 pages incl. both acquisition pages (D-3); −1 sub-16px inputs on auth pages (D-7); −1 small tap targets / two brief cards |
| Design-system consistency | 10 | 8 | −1 H1 sizes vary; −1 public header duplicated inline in 12 files |
| Reliability and test coverage | 10 | 8 | −1 one red browser check on `main` (D-9); −1 no Firefox/Safari/real-device coverage |
| Content and launch hygiene | 15 | 5 | −4 blog with no posts; −2 pricing says the live positions brief is "coming soon"; −2 orphan pages published; −2 broken/stale links (D-11, market-intelligence stub) |
| **Total** | **100** | **62** | |

**Expected score after the P0/P1 gate:** about 80. That counts the security, functionality and hygiene points the gate items remove. It is an estimate from this rubric, not a measurement.

## Launch gate checklist

| # | Gate | Status | Owner |
|---|---|---|---|
| G-1 | XSS on `technical-analysis.html` fixed + browser check added (R-1) | ✅ fixed (quick-fix PR; `prelaunch_quickfix_check.mjs`) | Claude |
| G-2 | `arowana.webhooks` no longer anon-readable (R-2) | ❌ open | Claude migration + owner approval |
| G-3 | n8n workflows behind public URLs verify the caller; n8n token rotated | ❓ unknown | Owner |
| G-4 | Public header usable at 768/1024 (R-3) | ✅ fixed (quick-fix PR) | Claude |
| G-5 | My Movers / Gap Scan return quotes (R-4) | ✅ fixed (quick-fix PR) | Claude |
| G-6 | `tradingcommand.html`, `whale-tracker.html` retired (R-5) | ❌ open | Owner approval |
| G-7 | Stripe test purchase + cancel on the deployed checkout; $299 price switched in the same window; live v14 compared with repo before deploy (R-6) | ❓ not run | Owner (L3) |
| G-8 | Supabase Auth redirect URLs include apex, www and `/staging/` | ❓ owner item | Owner |
| G-9 | `.htaccess` rules + `MANAGE_HTACCESS=true` | ❓ owner item | Owner |
| G-10 | All automated suites green on the release commit (fix D-9) | ✅ D-9 fixed (quick-fix PR); re-run on the release commit | Claude |
| G-11 | Owner smoke test on staging on a phone (iOS Safari) and a tablet | ❓ not run | Owner |
| G-12 | Morning brief generator still writing daily (production had briefs through 2026-10-07 per `TASKS.md:575`; not re-checked today) | ⚠️ re-check | Owner |
| ✅ | Market data through `arowana-research` v9 (owner confirmed NVDA, AMD on staging) | done | — |
| ✅ | AI cases via `arowana-explain` v4 (owner confirmed on staging) | done | — |
| ✅ | Expired-session handling (#87) | done | — |
| ✅ | No provider secrets in browser code; edge functions derive user and plan server-side | code-reviewed | — |

**CONDITIONAL GO** once G-1, G-2, G-4, G-5, G-7 and G-10 are closed, and G-3 is answered.
G-6, G-11 and G-12 are strongly recommended. Everything else can follow launch.

## Top 10 issues

| # | Issue | Sev | Ref |
|---|---|---|---|
| 1 | Reflected XSS via `?from=` on Technical Analysis (session theft by link) | P0 | D-1 / R-1 |
| 2 | Webhook URLs readable with the public anon key; n8n caller checks unknown | P1 | D-2 / R-2 |
| 3 | Paid checkout not verified end to end (the planned $299 switch happens at cutover) | P1 | R-6 |
| 4 | Public header breaks between 701 and 1160px (Sign up off-screen on tablets) | P1 | D-3 / R-3 |
| 5 | My Movers and Gap Scan say "Sign in" to signed-in members | P1 | D-4 / R-4 |
| 6 | Stale published duplicates (`tradingcommand.html`, `whale-tracker.html`) | P1 | D-5 / R-5 |
| 7 | BYOK leftovers: FMP key prompt; direct FMP / Alpha Vantage / Twelve Data calls with old keys; client-asserted plan headers to n8n | P2 | R-9, R-10 |
| 8 | Blog with no posts; pricing "coming soon" for a shipped brief; two brief cards | P2 | R-15, R-16 |
| 9 | Auth inputs below 16px (iOS zoom) and small phone tap targets | P2 | D-7 / R-7, R-30 |
| 10 | Red `schwab_coming_soon_check` on `main` (font link added by `a356ebb`) | P2 | D-9 / R-8 |

## Verification summary

**Run here, with results:**
- Python unit tests: 117 OK.
- Node tests: 61/61.
- Browser checks: 35, of which 34 are green and 1 red.
- New pre-launch sweep: 442 page loads at 320-1920px, signed in and signed out.
- Three targeted local probes:
  - XSS: reproduced with a harmless flag.
  - Scanner run.
  - Header overflow at 700-1024.
- Read-only production Supabase queries: policies, grants, function definitions, security and performance advisors.

**Owner-verified on staging this week:** market data (NVDA, AMD), AI thesis cases, expired-session sign-in.

**Code-reviewed only:** checkout, billing portal, Stripe webhook, digest, admin console writes, n8n call sites.

**Not tested:**
- live production site (blocked from this environment);
- Firefox, Safari/iOS, real devices;
- real Stripe;
- n8n workflow internals;
- load/performance under real traffic.

No product code, database objects, edge functions or production data were changed during this audit.
