# UI / UX audit (ATD-109 pre-launch, 2026-10-09)

Evidence comes from `scripts/browser/prelaunch_sweep.mjs`:
- 88 real pages at 375 / 768 / 1280 / 1920, signed in;
- 18 public and member pages at 320 / 375 / 768 / 1024 / 1440, signed out;
- the screenshots at 375 and 1280 that I reviewed.

Chromium only. Safari, Firefox and real devices were **not** tested.

## Desktop assessment

**Good.**
- One shell (`js/arowana-nav.js` rail + top bar) on every registry page.
- One font: Plus Jakarta Sans on 87 of 88 pages. The 88th, `login.html`, redirected away during the signed-in run.
- One light palette: `#eef3f6` / `#f6f8fb` / `#f9fafb` backgrounds.
- Buttons use a 6-8px radius on 77 of 84 pages that have a visible button.
- No uncaught page errors on any page.
- No horizontal scroll at 1280 or 1920.

**Uneven.**
- H1 sizes: 32px on 24 pages; 13 pages have no `<h1>`; 28, 30.4, 36 and 38px elsewhere.
- Two pages use a second display face (`Inter Tight`) for the H1.
- Large legacy pages (Options Hub 469 KB, Trade Journal Pro 463 KB, Portfolio Command 434 KB, Analysis Central 423 KB) carry their own inline component styles. They look consistent, but they don't share CSS, so every visual change is made four times.

## Mobile assessment (375 / 320)

**Intentional:**
- Member pages get the bottom tab bar (Command, Watchlists, Portfolio, Journal, More).
- Cards stack, tabs wrap into a grid, and the page header compresses to title + subtitle.
- The AI Coach button sits above the bar.

See `screenshots/trading-command-375.png`.

**Weak spots:**
- **Small tap targets.** Count of visible buttons/selects under 36px tall at 375px:
  - 15 or more: `learn-investing` 27; `trade-journal-pro`, `option-roll-tracker`, `options-journal` and `trade-journal` 22 each; `discipline-scorecard`, `signup` and `trading-command` 19 each; `arowana-trader` and `whale-tracker` 17 each; `analysis-central`, `watchlist` and `guide` 16 each.
  - `mobile_controls_check` already guards the critical controls. These are secondary chips and toolbar buttons.
- **Inputs under 16px** (iOS zooms on focus):
  - sign-in, sign-up and reset password (15.04px);
  - wheel calculator and assignment risk (15.2px);
  - home page waitlist form (15px; 13.3px company field).
- **Trade Journal Pro toolbar at 375.** Seven buttons wrap over four rows above the stats. It works, but it reads as a desktop toolbar squeezed down; it is the strongest candidate for an overflow menu.

## Tablet / small laptop (701-1160px): the main layout defect

The public header (inline in each public page, e.g. `about.html:21-43`) only collapses below 701px. Between 701 and about 1160px:
- the links and the Sign in / Sign up buttons run off the right edge;
- the page scrolls sideways: 395px at 768, 139px at 1024.

Affected (signed in and signed out):
- about, blog, contact, disclosures, privacy, refunds, risk-disclosure, security, support and terms;
- **wheel-calculator and assignment-risk**, which are the two sitemap / acquisition pages.

See `screenshots/about-768.png`.

Other tablet-width overflow (Long-Term planners at 700-900px):
- `factor-tilt-planner` +201px (`.row.four` grid);
- `real-estate-analyzer` +243px;
- `retirement-calculator` +60px, with 15 inputs clipped at 768;
- `education-529-planner` +43px.

## Copy and states

- **Two "brief" cards on Trading Command.** The page shows "Your brief" ("No brief yet. One is written before the open each weekday, from your open positions") and, two cards below, "Today's Brief" ("hasn't generated yet — check back after 8am ET"), each with its own wording and timing. See `screenshots/trading-command-1280.png`. A member can't tell which brief is which. "Your brief" is the live positions brief; "Today's Brief" (bias, movers, setups) is a separate market panel.
- **`blog.html`** shows five post cards that all link back to `blog.html` and promises "New posts weekly". Visitors will read this as an abandoned site.
- **`pricing.html:491` / `:599`** lists "Daily brief on your open positions — Coming soon", but that brief is live: it's written to `ai_briefs` at 12:30 UTC and shown on Command, and production had briefs through 2026-10-07 (`TASKS.md:572-576`). The copy is stale.
- **`ai-moat-finder.html` and `money-flow-alert.html`** say "Run a screen or load demo data". A demo-data button on a paid tool should be labelled as a sample, or removed.
- **"Coming soon"** appears legitimately on `broker-connections.html` and `schwab-callback.html` (Schwab).
- **Empty states seen in the sweep were clear and actionable**, e.g. "No holdings with 100+ uncovered shares… Holdings logged in the journal are scanned after each close."

## Design-system position

Do not introduce a second system. The existing one is:
- Plus Jakarta Sans;
- the slate-blue brand `#0b4f8a`;
- light surfaces, 6-8px controls and 12-16px cards;
- the `arowana-nav` shell.

The work is convergence, not replacement:
1. Move the public header into one shared include (as the member shell already is). Fix the breakpoint once instead of in 12 files.
2. Add a 16px minimum `font-size` for inputs at `max-width: 700px` in that same shared CSS.
3. Standardise H1 at 32px desktop / 26px phone across shell pages, which is the dominant existing value.
4. Leave the four large legacy pages visually as they are until they are split; restyling them now risks regressions for little visible gain.
