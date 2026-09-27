AROWANA PROFITS — deploy bundle, 19 September 2026 (rev g)
==========================================================

REV G fixes why Tools was still missing. The inline rail correction asked
"does any link point at tools.html?" and skipped adding the group when an
older rail listed "All Tools" as a sub-item of another group. It now asks
"is there a Tools GROUP?" and adds one when there is not.

Tested against a rail with four groups, Market Intelligence among them, and
tools.html present only as a sub-item — the situation on your machine:
    Trading Command / Portfolio Command / Ticker Research /
    Options Hub / Tools

WHAT TO DO
  1. Extract over:  ...\websites\arowanaprofits\
  2. Reload.

  The rail correction repairs whatever renders, so the older rail definition
  inside the page is now harmless. No need to chase file sizes.

STILL TO DO SERVER-SIDE
  - Supabase secret FINNHUB_API_KEY  (market data returns 503/401 until set)
  - Delete the unused 'arowana-coach' edge function
  - Archive the Elite products in Stripe
  - Delete market-intelligence.html from the server if still present
