# ATD-004 — Proposed Data Hub contract v0.1

Status: **proposed for owner review, not deployed or approved**. Companion: [source inventory](ATD-004_DATA_SOURCE_INVENTORY.md). This document specifies future behavior; MUST/SHOULD describe the proposed contract, not existing guarantees. No database objects, routes or adapters are created by this task.

## Boundary and invariants

The flow is provider/broker -> server adapter -> normalized versioned observations -> deterministic engine -> AI explanation -> risk/strategy/execution plan. TradingView remains a research surface; broker integration remains read-only. An execution plan is a document, never an order.

- Browser callers authenticate with a user JWT. The server derives user identity and entitlements; supplied user/plan headers are not authority. Public datasets still require licensed access where applicable.
- Provider credentials and broker tokens remain server-side. Requests cannot supply provider URLs, raw secrets, SQL, schema names or a workflow destination.
- Every returned fact identifies its source, time, unit, revision and quality. Missing/unknown values are null with a reason, never a fabricated zero. Manual, imported and demo data have explicit origins; demo is forbidden in production fact responses.
- Private data is isolated by verified user and account ownership at every entry point, including cache, jobs, storage, RPC and RLS. Shared market data may be cached across users only where the rights policy allows it.
- Consumers use stable logical datasets, not provider response shapes or physical table names. Adapters own provider differences; engines own deterministic calculations. AI cannot author market facts.

## Identity, numbers and time

| Field/concept | Contract |
|---|---|
| Instrument | Stable internal `instrument_id`; asset class, canonical symbol, currency, exchange/MIC where known; provider symbol mappings with validity periods. Uppercasing a ticker alone is insufficient identity. |
| Option | Underlying instrument ID, expiry date, call/put, decimal strike, currency, multiplier, deliverable/adjustment identity and provider contract IDs. Never assume all contracts have multiplier 100. |
| Account | Immutable private `account_id`; owner derived server-side. Broker name/nickname is display metadata, not a grouping key. |
| Monetary/quantity values | Decimal strings in JSON with documented units; no binary-floating-point money persisted as authoritative totals. Null is unknown; zero is permitted only where valid. Calculations define rounding at their boundary. |
| Event time | `observed_at` RFC3339 UTC for market events; `observation_date` for date-only economics/accounting facts. Do not fabricate midnight to imply an exact publication instant. Preserve original timezone/session metadata. |
| Lifecycle time | `received_at` = adapter receipt; `ingested_at` = storage acceptance; `computed_at` for derived records. Refetching must not advance `observed_at`. |
| Point-in-time | `available_at` = earliest known publication/availability time; revision/vintage retained. Backtests require records available at decision time, not latest restatements. Unknown availability makes that record ineligible for point-in-time tests. |
| Calendar | Exchange calendar/version, trading date, timezone and `pre/regular/post/closed/unknown` session. DST, half-days, holidays and halts handled explicitly. |

## Common response envelope

All proposed read endpoints return this envelope. `status` is `ok`, `partial` or `unavailable`. A partial response contains per-item outcomes; no item is silently dropped. `schema_version` is a semantic version. `snapshot_id` identifies an immutable result/input set; null when no dataset was produced. `next_cursor` is opaque, query-bound and user-bound for private datasets.

```json
{
  "schema_version": "1.0.0",
  "request_id": "example-request",
  "snapshot_id": "example-snapshot",
  "generated_at": "2026-09-28T14:00:05Z",
  "status": "partial",
  "data": [
    {
      "instrument_id": "example-equity",
      "status": "ok",
      "value": {"last": "100.25", "currency": "USD"},
      "provenance": {
        "origin": "provider",
        "provider": "alpaca",
        "feed": "iex",
        "dataset": "equity_last_trade",
        "adapter_version": "1.0.0",
        "source_record_id": "example-trade",
        "revision": "1",
        "observed_at": "2026-09-28T14:00:00Z",
        "observation_date": null,
        "available_at": "2026-09-28T14:00:00Z",
        "received_at": "2026-09-28T14:00:02Z",
        "ingested_at": "2026-09-28T14:00:03Z"
      },
      "quality": {
        "freshness": "fresh",
        "market_session": "regular",
        "delay_class": "realtime",
        "coverage": "single_exchange",
        "age_seconds": 5,
        "policy_id": "equity-quote-beta-v1",
        "warnings": []
      }
    },
    {"instrument_id": "example-unavailable", "status": "unavailable", "value": null,
     "error": {"code": "ENTITLEMENT_DENIED", "retryable": false}}
  ],
  "errors": [],
  "next_cursor": null
}
```

This is a synthetic documentation fixture, not actual market data. Successful observations require provenance and quality. Unavailable items require an error and null value; they do not fabricate observation timestamps. A record can be fresh for its limited feed while still being ineligible for a consumer requiring consolidated data.

Additional provenance fields where applicable: source endpoint family (no credential-bearing URL), provider request ID, original timezone, adjustment policy, corporate-action revision, entitlement-policy version and source payload hash. Raw payload references are internal and access-controlled. `origin` is `provider`, `broker`, `manual`, `import` or `derived`; production responses never use demo fixtures.

## Dataset contracts

Each dataset uses the envelope and immutable instrument/account identity above. Required business fields and eligibility constraints follow; optional unsupported fields remain null with a reason.

| Logical dataset | Required business fields / semantics | Key validation and consumer eligibility |
|---|---|---|
| Equity quote / last trade | Bid/ask and sizes with their event times; last trade price/size/time separately; currency, venue/feed, conditions, session | Last trade is not bid/ask or NBBO. Do not imply consolidated coverage from IEX. Crossed/invalid quotes are flagged; halted/closed states remain explicit. |
| Bars | Instrument, interval, start/end, session, O/H/L/C, volume/unit, complete flag, adjustment basis | Ascending unique bars; low <= O/C <= high; high >= low; valid nonnegative volume; reject missing values. Gaps and current incomplete bar explicit. Raw/split/total-return adjusted series never silently mixed. |
| Option quote/chain | Full contract identity; bid/ask sizes/times, last trade/time, OI with as-of date, volume/session; underlying observation ref | A chain is paginated and reports completeness. Zero bid differs from missing bid. Indicative/delayed data cannot be labeled OPRA realtime. Mark policy identifies bid/ask midpoint, last trade or manual mark and age. |
| IV / Greeks | IV as annualized decimal; delta/gamma/theta/vega/rho with method and units; input refs, risk-free/dividend assumptions, model version | Provider values retain provider conventions. Engine normalization defines theta/day and vega/rho scaling explicitly; unavailable inputs yield unavailable output. Historical volatility is a separate metric, never IV. |
| Corporate actions/calendar | Action/event ID, instrument, event type, announced/available time, effective/ex/record/pay dates as applicable; split ratio, amount/currency, confirmation status | No duplicate dividend/split application. Estimated earnings date is not confirmed. Calendars and price adjustment revisions are linked. |
| Fundamentals | Instrument/CIK, metric identifier, value/unit, fiscal year/period, period start/end, instant vs duration, filing/acceptance date, accession, restatement/version | Do not combine quarterly and TTM values as equivalent. Currency/scale explicit. Ratios carry formula and input refs; source conflicts preserved. |
| Estimates/revisions | Metric, target fiscal period, snapshot time, consensus value/range, analyst count, currency/unit and provider coverage | Revision requires comparable earlier/later snapshots and definition; missing historical snapshots means unavailable revision, not zero revision. |
| Macro | Series ID, observation date, value/unit, frequency, seasonal adjustment, release/availability time if known, vintage/realtime interval | Preserve revisions; no interpolation or forward-fill without a named transformation. Release freshness differs from quote age. |
| SEC filing/fact | CIK, accession, form, filing/acceptance time, document reference; taxonomy/tag, unit, context and period for facts | Amendments retained; calendar and fiscal periods distinguished. Do not treat all company facts for one tag as one current value. |
| Position/cash snapshot | User/account, instrument, signed quantity, cost basis/currency, cash categories, broker/manual source, snapshot time, completeness, reconciliation state | One authoritative source per account snapshot; no journal/mirror double counting. Distinguish settled cash, buying power and available-to-trade; missing account is not zero. |
| Journal event | User/account, stable event/lot ID, instrument, side/action, quantity, money, event time, import/source ID, correction link | Immutable imported event identity and idempotent import; corrections explicit. User annotations separate from broker facts. |
| Watchlist | User/list/item IDs, instrument, user notes/preferences and version | Same-owner list/item invariant; market enrichment is a referenced observation, not user-authored source data. |
| Engine result | Engine/version, parameter hash, input snapshot IDs, computation time, output units, eligibility and explanations | Reproducible from immutable inputs. Missing/stale/insufficient history prevents actionable output; no fabricated defaults. |
| AI analysis | Model/prompt versions, authorized fact snapshot refs, generated time, narrative, claim-to-fact references | No authority over prices/indicators/positions. Unsupported numbers blocked or clearly treated as user assumptions; refresh does not rewrite input history. |

## Proposed read API surface

Routes are logical `/api/data/v1` contracts; a future gateway may map them to Edge Functions. No route is implemented here. All require authentication except a separately approved public catalog; no public exception is assumed by this document.

| Method / route | Query/body | Response / bounds |
|---|---|---|
| GET `/instruments` | `query`, `asset_class`, `cursor`, `limit` | Instrument mappings; max 100/page, stable sort and opaque cursor |
| POST `/quotes/query` | `instrument_ids`, `required_coverage`, `max_age_seconds`, `session` | Max 100 IDs; per-instrument outcomes; last trade and quote fields distinct |
| POST `/bars/query` | IDs, start/end, interval, adjustment, session, `as_of`, cursor | Max 10 instruments and 10,000 bars/page; explicit coverage/gaps; approved interval allowlist |
| GET `/options/chain` | underlying ID, expiry range, cursor, required feed class | Max 500 contracts/page; completeness and underlying snapshot reference |
| GET `/fundamentals` | instrument ID, metric set, fiscal periods, `as_of`, cursor | Max 100 records/page; versioned metric catalog |
| GET `/estimates` | instrument ID, metric, target periods, snapshot range, cursor | Max 100 records/page; exact historical availability declared |
| GET `/macro` | approved series IDs, start/end, vintage, cursor | Max 20 series and 10,000 observations/page |
| GET `/filings` | instrument/CIK, forms, start/end, cursor | Max 100 filings/page; original document references |
| GET `/portfolio/snapshot` | authorized account IDs, `as_of` | Max 20 accounts; immutable private snapshot, per-account completeness |
| GET `/capabilities` | dataset optional | Safe availability/feed/delay/entitlement metadata; no keys, subscription IDs or internal URLs |

Caller limits may be stricter than server policy, never loosen it. Unknown IDs return `NOT_FOUND`; malformed/oversized requests reject before provider calls. No implicit ticker coercion between instruments. Dates and ranges are validated, empty batches rejected, duplicate IDs normalized deterministically. Pagination maintains snapshot consistency or returns `SNAPSHOT_EXPIRED`; it cannot silently cross revisions.

User CRUD belongs to separately authorized portfolio/journal/watchlist services, not this market read API. Ingestion endpoints are internal worker contracts; browser callers cannot submit provider-trusted facts. Broker reads do not authorize trades.

## Freshness and display policy

Proposed beta defaults below require owner approval and empirical tuning; they are not provider SLAs or current guarantees. `freshness` is `fresh`, `stale`, `unknown` or `not_applicable`. Feed delay and market coverage are separate fields. `age_seconds` is null without an exact event time; caching never makes old data young.

| Dataset/use | Proposed rule | If unmet |
|---|---|---|
| Intraday equity quote display | Event age <= 60s during active selected session; show coverage/delay | Stale badge and as-of time; cannot satisfy realtime action inputs |
| Option decision snapshot | Quote age <= 30s and underlying age <= 60s; synchronized within declared skew budget | No actionable premium/risk result; display separately as stale/indicative if allowed |
| Completed 1-minute bars | Last expected complete bar ends within 2 minutes in active session | Gap/stale status; current bar excluded from completed-bar engines |
| Daily bar engine | Most recent expected completed exchange session present, corporate-action basis known | Do not use four-hour TTL alone; block if history/session requirements fail |
| Fundamentals/estimates | Refresh target 24h; retain fiscal period and last known publication; release-trigger invalidation | Show last-checked and reported period; no claim that old fiscal facts are current intraday data |
| Macro / filings | Publication-aware freshness; poll/schedule subject to source rules | Preserve observation/vintage; distinguish no new release from failed refresh |
| Broker portfolio | Snapshot age <= 5 minutes for risk/position-sizing inputs | Mark stale and require refresh/explicit manual workflow; never assume zero exposure |

Closed markets display the last eligible session observation as such; they do not get an artificial realtime label. Manual marks require user-entered as-of time and cannot satisfy realtime-feed requirements. Engines can set stricter preconditions. UI must show source/feed, as-of time, delay and stale/unavailable status where decisions rely on values.

## Cache, fallback and source conflicts

- Cache identity includes dataset/schema version, instrument mapping version, provider/feed, adjustment, session, parameters, vintage/as-of and entitlement partition. Private snapshots additionally include owner/account; shared cache access rechecks authorization.
- Separate cache expiry (when to refresh) from fact freshness (whether usable). A cached result retains original provenance, errors and coverage. Browser cache is not the source of truth for private records.
- Provider selection is server registry policy, not a client URL. Alternate sources require approved licensing and equivalent dataset semantics. Record selected source, fallback reason and policy version. Never silently downgrade realtime/consolidated to delayed/single-exchange or full history to compact.
- Do not stitch an OHLCV window across providers without a versioned reconciliation rule. Cross-provider disagreements are retained with tolerance/method; never average incompatible prices, fiscal facts or estimates by default.
- Stale data may be returned only with explicit status and consumer permission. Entitlement failures cannot be bypassed by stale cache, alternate user key or another user's subscription.

## Errors, quotas and observability

| Code | Typical HTTP | Retry policy |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Refresh auth once outside adapter; no anonymous private fallback |
| `ENTITLEMENT_DENIED` / `FORBIDDEN` | 403 | No retry or provider bypass |
| `INVALID_REQUEST` / `NOT_FOUND` | 400 / 404 | Correct input; no retries |
| `RATE_LIMITED` | 429 | Honor Retry-After, bounded backoff with jitter |
| `UPSTREAM_UNAVAILABLE` / `UPSTREAM_TIMEOUT` | 503 / 504 | Bounded retry for idempotent reads only |
| `INVALID_UPSTREAM_DATA` | 502 | Quarantine invalid response; do not normalize errors as data |
| `INSUFFICIENT_HISTORY`, `STALE_DATA`, `UNSUPPORTED_DATASET` | Per-item error in 200 batch; unavailable envelope for single reads | No fabricated output; refresh only where appropriate |
| `SNAPSHOT_EXPIRED` | 409 | Restart pagination explicitly |

200 is valid for a processed batch even if all items are unavailable; top-level status then is unavailable. Request-level auth/input/rate failures use non-200 and `data: []`, `snapshot_id: null`, with the same envelope and top-level errors. Empty verified datasets use `ok` plus coverage/completeness metadata, not unavailable.

Adapters must detect provider error payloads even on HTTP 200. Server quotas coordinate per-provider account, per-user entitlement and global budget across interactive requests, jobs and retries. Configure limits from verified subscriptions; do not copy legacy comments. Proposed defaults: at most two retries, bounded request deadline, circuit breaker and concurrency control, all configurable by dataset. No retry storm on 401/403 or malformed data.

Log request/job IDs, provider family, latency, result/error counts, quota and freshness metrics. Never log keys, raw bearer headers, OAuth codes, capability URLs or unrestricted private payloads. Metrics include stale rate, missing bars, feed switches, ingestion lag, schema drift and reconciliation failures.

## Ingestion, storage and orchestration

- Internal acquisition request: version, job ID, dataset, instrument/account scope, range/as-of, registry adapter ID, deadline and deduplication key. Authenticated worker identity must have only necessary dataset/account scope. Scheduling does not accept arbitrary URLs.
- n8n may orchestrate jobs but is not the original provider of market facts. Worker result carries job ID, source records, provenance, completeness and version. Verify signature/token, timestamp/replay window and job ownership before accepting; secrets never travel as browser-supplied workflow parameters.
- Idempotency key derives from provider/feed, instrument, event/period identity and revision, plus user/account for private data. Same key/same hash is a no-op; changed payload is a recorded revision/conflict, not silent overwrite. Bulk partial failures return exact item outcomes and retry only failed items.
- Logical stores: instrument mappings; normalized observations; immutable input snapshots; engine results; private account/trade/position records; ingestion/quality/job metadata; internal raw payload references. Physical schema/table names and migrations remain a separate assignment.
- Raw payload retention is bounded by license/privacy policy; no unapproved indefinite archive. Normalize only needed fields; support provider deletion/retention obligations. Keep audit metadata separate from credential material. No retention duration is silently chosen by this contract.
- Supabase exposed tables need reviewed grants/RLS and field restrictions. Ownership includes parent relationships identified by ATD-005. Privileged service-role adapters derive and validate user/account scope even though RLS may be bypassed.
- OAuth broker tokens remain in a private server boundary with rotation/revocation handling. Callback state, redirect and account ownership are verified. No order-write scope or endpoint is included.

## Versioning, rollout and acceptance gate

Version API major paths for breaking changes; additive nullable fields may be minor revisions. Version adapters, metrics, engine formulas, policy and symbol mappings independently. Unknown enum values fail safe; raw provider additions do not automatically become public fields. Deprecations require documented consumer migration and rollback.

Before any consumer migration, implement synthetic fixtures for: ascending bars; splits/dividends; holiday/DST sessions; stale versus closed-market data; delayed/indicative feeds; provider 200-error payloads; insufficient compact history; nullable metrics versus zero; changed fiscal periods; estimate/vintage revisions; duplicate ingestion; partial pagination; two-user ownership; revoked entitlements; account switching; broker/manual reconciliation; quota exhaustion; and AI claims linked to immutable facts.

Acceptance requires schema validation, deterministic golden calculations, adapter mapping tests, DEV positive/negative authorization tests, approved entitlements, secrets remediation, and consumer UI tests for fresh/stale/partial/unavailable states. These are future requirements; no implementation tests are claimed by this document. ATD-004 verifies documentation structure and fixtures only.

Open decisions: provider/feed licenses and universe, approved freshness budgets, private data canonical model, shared-project boundary, workflow ownership and retention. Review these before assigning ATD-101. No follow-on work started.
