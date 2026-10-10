# ATD-110: Rules Replay and honest sample sizes (spec)

**Status:** spec only. Nothing here is built. Schedule after the ATD-109 launch gate.
**Owner request (2026-10-10):** turn two ideas from the TradeMachine discussion into a spec:
- **(A)** show the sample size beside every win rate;
- **(B)** replay your own rules against your own journal.

**Origin:** we take the *kind* of feature (rule-based backtesting, statistics with evidence). We copy none of TradeMachine's code, text, layout, strategy library, results or name. Everything below runs on the member's own recorded trades.

**Agent framing:** this is the journal's review agent. It answers one question: *what does my own history say about my rules?*

## 0. What the journal can and cannot answer

This section shapes everything below, so it comes first.

The journal stores each trade's **entry and exit**, not the option's price on the days in between. That leads to three groups of question.

**Exact.** These can be answered from the member's own fills:
- *"What if I had only taken trades that…"*: filters applied at entry, such as DTE window, strategy, earnings, how many positions were open at once, and credit size. A filter keeps or drops whole trades that really happened, so every number stays a real fill.
- *"How do I actually exit?"*: what share of the maximum profit was kept, closing early versus holding to expiry, and what happened after assignment.

**Not answerable in v1:** *"What if I had closed at 50% profit?"* or *"…rolled at 21 DTE?"*.
- These need the option's price on every day the trade was open, which we don't have.
- Reconstructing it needs daily candles. Our Finnhub plan refuses `/stock/candle` with 403, so that is a cost decision.
- It would also need a model or a historical option-chain dataset, which is expensive.
- These what-ifs are listed in §5 as v2 and stay out of v1. Faking them with assumed prices would produce exactly the kind of untrustworthy number this feature exists to avoid.

### Fields available (verified in code, 2026-10-10)

| Field | Where it comes from | Reliability |
|---|---|---|
| ticker, strategy, status, entry date, expiry, strike, qty | option payload (`trade-journal-pro.html`; columns `underlying`, `strategy`, `status`, `entry_date`, `exit_date` in `tj_options`) | Always present |
| `premiumIn`, `premiumOut` / `exitPrice`, `feeIn`, `feeOut`, `pnl` | option payload. P/L for a credit trade is `premiumIn*qty*100 - fees` when it expires, otherwise uses the close price (`trade-journal-pro.html:3433`) | Present on closed trades; missing on some imports |
| DTE at entry | `dte_entry` (from `t.dte`, `js/journal-sync.js:728`); can also be derived as expiry − entry date | Derivable for every trade |
| delta / IV at entry | `delta_at_entry`, `iv_at_entry` (`js/journal-sync.js:729-730`) | **Mostly empty**: the journal form doesn't capture them. No v1 rule may depend on them. |
| assignment | `assignment` column / payload | Partial |
| earnings inside the trade window | **Not stored on any trade.** No code writes `earningsInWindow` / `hasEarningsInWindow` to a journal trade. Only scanner candidates carry it (`options-hub.html:3624-3628`). | Must be computed (§2.3) |
| setup, mistakes, R-multiple | payload / columns | Optional, user-entered |

**Side finding.** The Options Hub note *"With earnings inside the expiry you are X%…"* (`options-hub.html:4176-4190`) filters journal trades on that never-written flag, so it can never appear today. §2.3 gives it real data. Fixing the note itself is a one-line follow-up and isn't part of this spec.

## 1. Part A: honest sample sizes (roadmap #2)

### 1.1 The rule

Every win rate, average or hit rate shown to a member about **their own trades** is drawn by one shared helper and follows one rule.

| Closed trades with a P/L (`scored`) | What the member sees |
|---|---|
| 0 | "No closed trades yet" |
| 1-7 | **Wins and losses only:** "3 wins, 2 losses (5 trades): too few to call". No percentage. |
| 8-19 | "62% win rate · 13 trades · early read" |
| 20+ | "62% win rate · 41 trades" |

- The 8-trade floor already exists as `JournalContext.MIN_MEANINGFUL = 8` (`js/journal-context.js:43`). Part A keeps it and adds the 20-trade "early read" tier.
- **Owner decision:** keep 8 and 20, or choose other thresholds.
- **Optional:** a range on hover, e.g. "likely between 41% and 79%" (a 95% Wilson interval, a few lines of maths). It makes small samples visibly wide without jargon. **Owner decision:** show it or not.

### 1.2 Where it applies (the pages found by a code search)

| Location | Today | Change |
|---|---|---|
| Trade Journal Pro dashboard win rate (`trade-journal-pro.html:5743`, `:5775`) | Plain `NN%` | Shared helper |
| Trade Journal Pro per-ticker insights (`:9538-9611`) | Its own threshold of **5** trades; "strong track record" from 5 trades | Shared helper; praise/warning wording only at 20+ |
| Trade Journal Pro stats block (`:9644-9659`) | Plain % | Shared helper |
| Options Hub journal notes (`options-hub.html:4182-4190`) | Already shows counts and a `soft` flag via `JournalContext.compare` | Align wording to the table above |
| Research / valuation journal context (`dcf-analyzer.html:5315`, `intrinsic-value.html:7572`, `options-analyzer.html:5741`) | `JournalContext.forTicker` (already count-aware) | Align wording |
| Expectancy Matrix (`expectancy-matrix.html:4837`) | The member **types** a hypothetical win rate | **Exempt**: a calculator input, not a statistic |
| Coach prompts that quote journal stats | Check during build | Pass `scored` with every rate so the coach can't overstate |

### 1.3 Implementation outline

- Add `JournalContext.describeRate(stats)` → `{ text, tier, pct|null, n, low, high }` in `js/journal-context.js`. It is pure, with no network calls.
- The pages above call it instead of formatting their own percentage.
- No database, edge function or registry changes.

### 1.4 Acceptance criteria

- No page listed in 1.2 shows a percentage for a member's own trades below 8 scored trades. A browser check covers it with synthetic journals of 0, 5, 12 and 30 closed trades.
- Every percentage shown sits next to its trade count.
- The per-ticker insight never says "strong track record" or "struggled" below 20 trades.
- Unit tests for `describeRate` cover every tier boundary (0, 1, 7, 8, 19, 20) and the interval maths.

## 2. Part B: Rules Replay v1 (roadmap #1)

### 2.1 What the member gets

A page under **Journal & Review → Rules Replay**. It is a new registry entry, `journal-replay`, on the new page `rules-replay.html`, which uses the standard shell. It is a new page because `trade-journal-pro.html` is already 463 KB.

1. **Pick a slice:** strategy (CSP, covered call, spreads, all), date range, tickers (all / list).
2. **Add rules.** Each rule is a chip that can be switched on and off:

| Rule | Keeps a trade when… | Data |
|---|---|---|
| DTE window | DTE at entry is within [min, max] | Derived |
| Skip earnings | No earnings date falls between entry and exit (or expiry, if the trade is still open) | §2.3 |
| Max open at once | Replaying in date order, taking it wouldn't exceed N open positions (all, or per ticker) | Derived |
| Minimum credit | Credit per contract ≥ $X, or credit ÷ (strike × 100) ≥ Y% | Payload |
| Entry weekday | Entered on the chosen weekdays | Derived |
| Days held cap | **Descriptive only:** shows results for trades that *happened* to close within N days, labelled "this is not an exit rule" | Derived |
| Want-to-Own only | Ticker is on the current Want-to-Own list | Watchlist. **Hindsight warning shown:** today's list may reflect what worked. |

3. **See the result, side by side:** *your actual trades* vs *your trades with these rules*.
   - Trades, and win rate (Part A rule).
   - Total P/L, and average P/L per trade.
   - Average days held, and P/L per day held.
   - Worst trade, and worst losing streak.
   - Capital tied up (CSP: strike × 100 × qty, summed per day; covered calls: the shares' cost basis if known, otherwise excluded and counted).
4. **The skipped-trades list.** This is the most useful part: every trade the rules would have removed, with its real P/L.
   - Shown as: *"These 9 trades would have been skipped: together they made −$1,240"*, or *"…made +$2,100, so this rule would have cost you money."*
5. **A cumulative P/L line**, actual vs with rules: two lines on one chart, Chart.js as used elsewhere.
6. **"How you exit"** (descriptive, no what-if):
   - share of maximum profit kept at close, as a distribution;
   - closed early vs held to expiry, with results;
   - assignment rate, and P/L after assignment where the journal links them.
   - Each figure follows the Part A rule.

### 2.2 Wording and honesty rules (fixed text, not left to the build)

- **Header line, always visible:** *"A replay of trades you actually took. It shows what these rules would have kept or skipped. It can't show trades you didn't take or different exits."*
- **No "backtest" or "would have made" headline** without the trade count next to it.
- **Results are only ever shown to the member who owns the trades.** They are never used in marketing or on public pages. If public use is ever wanted, it needs a hypothetical-performance disclosure reviewed first.
- **Trades excluded for missing data are counted and linked** to Data Hygiene Audit (`data-hygiene-audit.html`): *"4 trades left out: no close price."*

### 2.3 Earnings dates (the only external data)

- **Source:** past earnings dates per ticker in the slice, from `arowana-research` `/calendar/earnings` with `from`/`to` and `symbol`.
  - That path is already allow-listed and is a free path with no per-user quota (`supabase/functions/arowana-research/index.ts:57`).
  - It still counts toward the platform's daily ceiling.
- **Cost:** one request per ticker per replay, cached on the server for 6 hours and in the browser for the session.
- **Unverified (check first in the build):**
  - whether our Finnhub plan returns **past** earnings dates for the range we need;
  - how far back they go.
  - If it doesn't return them, "Skip earnings" ships disabled with an explanation, and the rest of v1 is unaffected.
- **Write-back (optional, owner decision):** store the computed `earnings_in_window` on each trade so Options Hub's existing earnings note (§0) starts working. That would be a payload field only, not a schema change.

### 2.4 Architecture

- `js/rules-replay.js` is a **pure** engine: `replay(trades, rules, { earningsByTicker, wantToOwn })` → `{ baseline, filtered, skipped, excluded, exits }`. No DOM or network access, so it is unit-testable in Node.
- It reads trades the way `js/journal-context.js` already does (the `tj_options_v2` / `tj_stocks_v2` cache kept by journal sync). It works offline after the first sync.
- `rules-replay.html` handles the UI and fetches earnings via `js/market-data.js` (no key in the browser).
- **Plan gating:** Pro, matching the journal stats. **Owner decision.**
- **No** new tables, migrations, edge functions or deploys in v1.
- **Stocks in v1?** The engine accepts stock trades with the DTE and credit rules hidden. **Owner decision:** options only in v1, or both.

### 2.5 Acceptance criteria

- On a fixed synthetic journal (checked into `scripts/browser/lib/`), each rule keeps and skips exactly the expected trades. `tests/rules-replay.test.js` covers one case per rule, plus rule combinations and the concurrency replay with ties on the same day.
- **Totals reconcile:** baseline P/L = filtered P/L + skipped P/L, to the cent, on every run.
- Trades with missing P/L never enter any total, and are counted under "left out".
- The header line from §2.2 is present, and every rate follows Part A.
- If no earnings dates come back, "Skip earnings" is disabled with a reason, not silently ignored.
- Phone (375px) and desktop layouts both pass the existing shell, mobile-control and sweep checks (`scripts/browser/prelaunch_sweep.mjs`) with no sideways scroll.
- No page errors, and no direct provider calls from the browser.

## 3. Build order (when scheduled)

1. **Part A:** helper, the pages in 1.2, and tests. Small, and useful on its own.
2. **Rules Replay engine and tests:** fixture journal, then `js/rules-replay.js`.
3. **Rules Replay page** without the earnings rule.
4. **Earnings rule:** after verifying past-date coverage (§2.3).
5. **"How you exit"** section.

Each step is its own PR, following the template.

## 4. Open decisions for the owner

1. Thresholds: 8 / 20 (§1.1).
2. Show the likely-range interval on hover (§1.1)?
3. Options only, or options and stocks, in v1 (§2.4)?
4. Pro-only (§2.4)?
5. Write `earnings_in_window` back onto trades (§2.3)?

## 5. Out of scope (later, each needs its own decision)

- **Exit-rule what-ifs** ("close at 50%", "roll at 21 DTE"). These need per-day option prices.
  - Either historical candles plus a pricing model (labelled as modelled), or a historical option-chain dataset.
  - Both are data-cost decisions.
- **Stock-level backtests** of technical triggers. These need candle data.
- **Structured strategy rules** (roadmap #3): saving a replay's rules as "my CSP rules", read by the scanners, Check a Trade and the coach.
- **Coach integration:** the coach quoting replay findings, with Part A wording enforced.
