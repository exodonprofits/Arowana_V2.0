# Feature recommendations (ATD-109 pre-launch, 2026-10-09)

Decisions are KEEP / IMPROVE / MERGE / REMOVE / INVESTIGATE. Nothing here has
been changed: every REMOVE or MERGE needs the owner's approval first. "Value"
is judged against the product goal the owner set: **each core page should work
like an agent on the owner's own trading and investing team.** No usage data
exists to weigh these, so treat them as recommendations, not findings.

## The core team (KEEP and invest)

| Feature | Decision | Why |
|---|---|---|
| Trading Command (positions, brief, coach, what changed, decision queue) | KEEP | The daily "chief of staff" page. Already pulls journal, brief and coach together. |
| Trade Journal Pro | KEEP | Source of truth for positions; every review tool reads it. |
| Options Hub (Wheel desk: want-to-own, CSP/CC scans, check, roll coach) | KEEP | The paid core on `pricing.html`; rules-based picks with reasons. |
| Thesis Builder + Decision history | KEEP | The clearest "agent" pattern on the site: numbers → AI scenarios → logged decision → what changed. |
| Ticker Research (`analysis-central.html`) | IMPROVE | High value. Remove the BYOK FMP prompt and the direct FMP/Alpha Vantage/Twelve Data calls, or route them through `arowana-research`. |
| Portfolio Command, Portfolio Advisor, Risk Rules, Position Sizer, Dividend Tracker, Tax-Loss Harvester | KEEP | The risk/portfolio agents. |
| Watchlists | KEEP (IMPROVE phone tap targets) | Feeds scanners and onboarding. |
| Long-Term desk (hub + planners) | KEEP | The investing side of the owner's goal. Fix tablet overflow on four planners. |
| Morning Brief | KEEP, but INVESTIGATE the two-card layout | Two brief cards on Command (see UI-UX-AUDIT.md). |
| Free wheel calculator and assignment-risk calculator | KEEP | The only pages in the sitemap; acquisition. Fix the tablet header first. |

## Fix or decide before launch

| Feature | Decision | Why |
|---|---|---|
| Technical Analysis (`technical-analysis.html`) | **IMPROVE now (P0 XSS)**, then INVESTIGATE whether to keep it hidden | Published and reachable by link even though it is hidden in the nav. |
| Scanners page | IMPROVE | Two personal-universe scans can't get quotes (FUNCTIONAL-AUDIT D-4). One script tag would fix it. |
| `tradingcommand.html` | **REMOVE** (or replace with a redirect stub to `trading-command.html`) | 251 KB stale copy, publicly deployable, anon key sent as Bearer, drifted auth. Nothing links to it. |
| `whale-tracker.html` | **REMOVE** (or redirect stub to `arowana-trader.html`) | Misnamed fork of the coach; POSTs to webhook URLs from localStorage. |
| `blog.html` | REMOVE from navigation/footers, or publish real posts | Five self-linking cards read as an abandoned site. |
| `money-flow-alert.html` | INVESTIGATE → likely REMOVE | Not in the registry, 0 inbound links, mock/demo data strings. |
| `pricing.html` "Daily brief … Coming soon" | IMPROVE (copy) | The positions brief is live (`TASKS.md:572-576`); drop "Coming soon". |

## Owner / admin tools

| Feature | Decision | Why |
|---|---|---|
| `admin.html` | IMPROVE | Needed. Point it at the existing `js/supabase_min.js`, drop the unpinned CDN fallback, and use `?next=` instead of `?redirect=`. |
| `admin-usage.html` | KEEP | The correct pattern: the server enforces admin. |
| `api-diagnostics.html` | INVESTIGATE → restrict to admins or REMOVE | Public, still exercises direct provider calls with user keys, spends the visitor's coach quota. |
| `tool-audit.html` | IMPROVE (admin-only) | Internal page open to any signed-in user. |

## Consolidation candidates (post-launch, MERGE)

| Candidates | Proposed home | Why |
|---|---|---|
| Kelly, R-multiple, risk comfort, volatility guardrails, ATR stop | One "Risk calculators" page with tabs | Five 135-153 KB pages with the same shell and similar inputs. |
| DCF Analyzer + Intrinsic Value | Intrinsic Value | Overlapping valuation tools. |
| Trading Journal Analysis | Journal → Stats & Analysis | Not in the registry; overlaps the journal's stats. |
| Retirement stubs (`options-journal`, `trade-journal`, `long-term-portfolio`, `option-roll-tracker`) | Remove after the migration window | They exist only to import old browser data. |
| `swing-trader.html` (hidden) | INVESTIGATE | Hidden desk with mock strings and a 404 on its config script. Decide: build it or retire it. |

## Not recommended

- A visual redesign or a new component library: the existing system is consistent (UI-UX-AUDIT.md). Converge, don't replace.
- New features before the P0/P1 list is closed.
