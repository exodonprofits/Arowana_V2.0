# ATD-XXX --- Charles Schwab Broker Integration

**Repository:** `exodonprofits/Arowana_V2.0`\
**Status:** Implementation specification / Codex handoff\
**Priority:** High\
**Initial scope:** Phase 1 --- read-only Schwab brokerage integration\
**Do not enable live trade submission in Phase 1.**

------------------------------------------------------------------------

## 1. Objective

Integrate Charles Schwab brokerage data into Arowana as a reusable
**broker provider layer**, not as Schwab-specific code scattered through
individual HTML pages.

The first implementation must allow an authenticated Arowana user to
connect their own eligible Schwab brokerage account through OAuth and
use Schwab as the source of truth for:

-   connected brokerage accounts
-   account balances
-   positions
-   transaction/activity history
-   order history/status (read-only)
-   quotes
-   option chains

The imported brokerage data must feed Arowana's existing canonical tools
rather than creating duplicate Schwab-specific versions of those tools.

Primary consumers:

-   `portfolio-command.html`
-   `trade-journal-pro.html`
-   `options-hub.html` or the repository's current canonical Options Hub
    page
-   `wheel-strategy.html`
-   `arowana-trader.html`
-   `trading-command.html`
-   `watchlist.html`

Do **not** create a separate "Schwab Dashboard" unless an existing
repository architecture document explicitly requires one.

------------------------------------------------------------------------

## 2. Mandatory First Step: Inspect Before Coding

Before making any implementation change, inspect the current `main`
branch and the active project documentation.

At minimum review:

-   `AGENTS.md`
-   `CLAUDE.md`
-   `PROJECT_RULES.md`
-   `PROJECT_STATUS.md`
-   `SECURITY.md`
-   `README.md`
-   `supabase/README.md`
-   relevant ATD documents under `docs/`
-   current Supabase migrations
-   current shared Supabase/auth client code
-   current provider/API abstractions
-   `portfolio-command.html`
-   `trade-journal-pro.html`
-   current canonical Options Hub page
-   `wheel-strategy.html`
-   `arowana-trader.html`
-   `trading-command.html`
-   `watchlist.html`

Also inspect current schema/table ownership before proposing new
relations.

Do not assume table names, column names, functions, authentication
helpers, or page ownership based solely on this specification.

If this document conflicts with a newer approved ATD decision or current
repository rule, preserve the newer approved repository decision and
document the conflict.

------------------------------------------------------------------------

## 3. Architectural Principle

The desired architecture is:

``` text
                         AROWANA
                            |
              +-------------+-------------+
              |                           |
        Broker Layer                 Research Layer
              |                           |
        SchwabProvider              FMP / Finnhub /
              |                    SEC / AI / others
              |
       +------+------+
       |             |
   REST/OAuth     Streaming
       |             |
 Supabase Edge   Dedicated worker
   Functions       (later)
       |
     Schwab
```

Application pages should consume normalized Arowana broker
data/services.

They should **not** contain direct Schwab authentication logic or Schwab
secrets.

------------------------------------------------------------------------

## 4. Security Requirements --- Non-Negotiable

Schwab is a brokerage integration capable of eventually placing
real-money trades. Treat it as a high-sensitivity integration.

Never put any of the following in frontend HTML/JavaScript, browser
localStorage, sessionStorage, query parameters, repository files, logs,
or public Supabase rows:

-   Schwab client secret
-   OAuth refresh token
-   OAuth access token
-   raw authorization code
-   full brokerage account number unless absolutely required and
    securely protected
-   other reusable Schwab credentials

Do not implement:

``` text
browser -> Schwab API
```

for authenticated brokerage operations.

Use:

``` text
browser
   |
   v
Arowana server-side boundary
   |
   v
Schwab
```

Private provider credentials and token refresh logic must remain
server-side.

Respect the repository's ongoing Supabase/RLS/security remediation. Do
not weaken RLS, authentication, ownership constraints, or secret
handling to make Schwab integration easier.

Do not reuse any legacy pattern that stores private provider credentials
in browser storage or user-accessible tables.

Never commit real Schwab credentials.

Add only placeholder variable names to `.env.example`.

------------------------------------------------------------------------

## 5. Phase Plan

### Phase 1 --- Read-Only Brokerage Integration

Implement:

1.  Schwab OAuth connection
2.  account discovery
3.  balances
4.  positions
5.  transactions
6.  order history/status --- GET only
7.  quotes
8.  option chains
9.  connection/sync status
10. normalized storage/adapters
11. integration with existing canonical Arowana pages

Explicitly prohibited in Phase 1:

-   placing orders
-   replacing orders
-   canceling orders
-   autonomous trading
-   AI-triggered trading
-   scheduled order submission
-   background trading rules
-   any UI button that sends an order to Schwab

### Phase 2 --- Streaming

Later add:

-   live equity quotes
-   live option quotes
-   account/order activity
-   reconnect logic
-   stale-data detection
-   server-side streaming worker

### Phase 3 --- Order Preview / Trade Ticket

Later add a broker-aware trade ticket and preview/validation workflow.

No live submission unless separately approved.

### Phase 4 --- Human-Confirmed Trading

Only after explicit owner approval:

-   place order
-   replace order
-   cancel order

Every real-money order must require explicit human confirmation.

Do not implement autonomous AI execution.

------------------------------------------------------------------------

## 6. Schwab API Surface to Support

Codex must verify the current official Schwab Developer documentation
before implementation. Do not rely blindly on endpoint paths in this
document if Schwab has changed them.

Expected Trader API capabilities include:

``` text
GET /trader/v1/accounts/accountNumbers
GET /trader/v1/accounts
GET /trader/v1/accounts/{accountHash}
GET /trader/v1/accounts/{accountHash}?fields=positions

GET /trader/v1/accounts/{accountHash}/orders
GET /trader/v1/accounts/{accountHash}/orders/{orderId}
GET /trader/v1/orders

GET /trader/v1/accounts/{accountHash}/transactions
GET /trader/v1/accounts/{accountHash}/transactions/{transactionId}

GET /trader/v1/userPreference
```

Expected Market Data capabilities include:

``` text
GET /marketdata/v1/quotes
GET /marketdata/v1/{symbol}/quotes

GET /marketdata/v1/chains
GET /marketdata/v1/expirationchain

GET /marketdata/v1/pricehistory

GET /marketdata/v1/movers/{symbol_id}

GET /marketdata/v1/markets
GET /marketdata/v1/markets/{market_id}

GET /marketdata/v1/instruments
GET /marketdata/v1/instruments/{cusip}
```

Future order endpoints may include:

``` text
POST   /trader/v1/accounts/{accountHash}/orders
PUT    /trader/v1/accounts/{accountHash}/orders/{orderId}
DELETE /trader/v1/accounts/{accountHash}/orders/{orderId}
POST   /trader/v1/accounts/{accountHash}/previewOrder
```

These are **out of scope for Phase 1 writes**.

------------------------------------------------------------------------

## 7. OAuth

Implement OAuth as a server-controlled flow.

Desired user experience:

``` text
Arowana
   |
   | Connect Schwab
   v
server-side OAuth start
   |
   v
Schwab authorization
   |
   | user authenticates/authorizes
   v
Arowana callback
   |
   v
server exchanges authorization code
   |
   v
secure token storage
   |
   v
discover authorized Schwab accounts
```

Suggested function responsibilities:

``` text
schwab-oauth-start
schwab-oauth-callback
schwab-token-refresh
schwab-disconnect
```

Names may be adjusted to fit existing repository conventions.

Requirements:

-   validate OAuth `state`
-   protect against CSRF
-   use an exact approved redirect URI
-   never expose client secret to browser
-   never return refresh token to browser
-   centralize token refresh
-   record connection health/status
-   handle expired/revoked authorization gracefully
-   provide a clean reconnect path
-   sanitize logs

Create a single server-side helper conceptually equivalent to:

``` text
getValidSchwabAccessToken(user_id)
```

It should:

``` text
if access token valid:
    return it

else if refresh is possible:
    refresh securely
    persist updated token metadata
    return new access token

else:
    mark connection reconnect_required
    return controlled authentication error
```

Do not duplicate token-refresh logic across Edge Functions.

------------------------------------------------------------------------

## 8. Broker Provider Abstraction

Create or extend a provider abstraction instead of coupling pages
directly to Schwab.

Conceptual interface:

``` text
BrokerProvider

getAccounts()
getAccount()
getBalances()
getPositions()

getOrders()
getOrder()
getTransactions()

getQuotes()
getQuote()
getOptionChain()
getExpirationChain()
getPriceHistory()
getMarketHours()

getConnectionStatus()
syncAccount()
```

Phase 1 implementation:

``` text
SchwabProvider
```

Future providers should be possible without rewriting Arowana pages:

``` text
FidelityProvider
InteractiveBrokersProvider
AlpacaProvider
```

Do not implement those providers now.

------------------------------------------------------------------------

## 9. Database Design

Before creating these tables, inspect the existing schema and ATD
ownership decisions.

If equivalent canonical relations already exist, extend/reuse them
rather than creating duplicates.

Suggested normalized model:

### `broker_connections`

Purpose: one user's authorization relationship with a broker.

Suggested fields:

``` text
id
user_id
provider
status

connected_at
updated_at
last_sync_at

access_token_expires_at
refresh_token_expires_at

reconnect_required
last_error_code
last_error_at

metadata
```

`provider` should support values such as:

``` text
schwab
```

Sensitive token material must not be exposed through normal client
selects.

Prefer a secure server-only secret mechanism appropriate to the existing
Supabase architecture rather than ordinary browser-readable columns.

------------------------------------------------------------------------

### `broker_accounts`

Suggested fields:

``` text
id
user_id
broker_connection_id

provider
provider_account_hash

display_account
nickname
account_type

is_primary
is_active

last_synced_at
created_at
updated_at
```

Use Schwab's account hash for API requests.

Do not make the raw account number the primary external identifier.

------------------------------------------------------------------------

### `broker_positions`

Suggested fields:

``` text
id
user_id
broker_account_id

provider_position_key

symbol
cusip
asset_type

quantity
long_quantity
short_quantity

average_price
market_price
market_value
cost_basis

day_pnl
day_pnl_pct

unrealized_pnl
unrealized_pnl_pct

provider_updated_at
synced_at

raw_payload
```

Use an idempotent uniqueness strategy appropriate to the actual Schwab
payload and Arowana ownership model.

------------------------------------------------------------------------

### `broker_transactions`

Suggested fields:

``` text
id
user_id
broker_account_id

provider_transaction_id

transaction_type
description

symbol
cusip
asset_type

quantity
price
net_amount

commission
fees

trade_date
settlement_date

instruction
position_effect

synced_at
raw_payload
```

Import must be idempotent.

The same Schwab transaction must never create duplicate journal activity
after repeated syncs.

------------------------------------------------------------------------

### `broker_orders`

Suggested fields:

``` text
id
user_id
broker_account_id

provider_order_id

symbol
asset_type

order_type
instruction

quantity
filled_quantity

limit_price
stop_price

status

entered_at
filled_at
canceled_at
updated_at

raw_payload
```

Phase 1 is read-only synchronization.

------------------------------------------------------------------------

## 10. Raw Payload Policy

Retaining raw Schwab payloads can help debugging and future
normalization, but do not blindly persist sensitive data.

Before storing `raw_payload`:

-   inspect the response
-   remove unnecessary account identifiers
-   remove authentication information
-   remove fields not needed for reconciliation/debugging
-   ensure RLS prevents cross-user access
-   document retention expectations

Normalized columns are the application contract.

Pages should not depend on arbitrary fields inside `raw_payload`.

------------------------------------------------------------------------

## 11. RLS / Ownership

Every broker relation must be scoped to the authenticated Arowana user.

Required guarantees:

-   User A cannot read User B's broker connection.
-   User A cannot read User B's accounts.
-   User A cannot read User B's positions.
-   User A cannot read User B's transactions.
-   User A cannot read User B's orders.
-   A browser cannot modify ownership columns to claim another user's
    broker data.
-   service/server writes must preserve correct user ownership.

Add automated two-user isolation tests if the repository's current
security baseline supports them.

Do not claim the integration secure until those tests pass in the
intended environment.

------------------------------------------------------------------------

## 12. Sync Strategy

Use an explicit synchronization model.

### Accounts

Sync:

``` text
Schwab account list
    ->
broker_accounts
```

### Positions

Positions are current-state data.

Sync:

``` text
Schwab positions
    ->
upsert broker_positions
    ->
mark/remove positions no longer returned
```

Do not leave closed positions appearing as active holdings.

### Transactions

Use incremental date windows and provider transaction IDs.

``` text
last successful transaction sync
       |
       v
Schwab transactions
       |
       v
deduplicate
       |
       v
broker_transactions
       |
       v
journal reconciliation
```

Use an overlap window if needed to catch late-settling or corrected
activity while preserving idempotency.

### Orders

Synchronize recent/current orders and statuses.

Do not assume an order is filled merely because it disappeared from a
working-order query.

------------------------------------------------------------------------

## 13. Trade Journal Integration

Do **not** create a second Schwab journal.

The repository has been consolidating around `trade-journal-pro.html` as
the canonical journal.

Desired flow:

``` text
Schwab transaction
      |
      v
broker_transactions
      |
      v
normalization / reconciliation
      |
      v
existing canonical Trade Journal model
      |
      v
trade-journal-pro.html
```

Important:

Do not blindly create one journal row per Schwab transaction.

A single logical trade may involve:

-   multiple fills
-   partial fills
-   option open/close pairs
-   assignments
-   exercises
-   expiration
-   fees
-   corrections

Design a reconciliation boundary so broker activity can be associated
with Arowana's existing logical trade model.

Preserve manual journal notes, strategy tags, thesis, screenshots,
ratings, and other user-entered metadata.

Broker sync must never overwrite user-authored journal content.

------------------------------------------------------------------------

## 14. Portfolio Command Integration

`portfolio-command.html` should consume normalized broker holdings.

Desired UX:

``` text
Portfolio Command

Account:
[ All Accounts v ]

- Schwab Individual
- Schwab Business / other authorized account
- All Accounts
```

Exact labels should come from actual authorized account metadata and
user-defined nicknames.

Portfolio Command should be able to show:

-   account value
-   cash
-   buying power where available
-   positions
-   quantities
-   market value
-   cost basis where reliable
-   unrealized P&L
-   account-level totals
-   aggregated totals across selected accounts

Do not duplicate a position merely because it also exists in the
journal.

Define clearly:

``` text
Broker positions = current brokerage truth
Journal = trade/history/strategy truth
```

Portfolio Command should reconcile the two.

------------------------------------------------------------------------

## 15. Options Hub Integration

Use Schwab option-chain data as a brokerage-aware options source.

Support normalized fields such as:

``` text
underlying
expiration
DTE

strike
put/call

bid
ask
last
mark

volume
open_interest

delta
gamma
theta
vega

implied_volatility
intrinsic_value
extrinsic_value
```

Only map fields actually available from the current Schwab response.

Do not fabricate missing Greeks.

Preserve existing Arowana calculations when they add value.

The UI should be able to distinguish:

``` text
Broker/market supplied value
Arowana calculated value
```

where ambiguity would matter.

------------------------------------------------------------------------

## 16. Wheel Strategy Integration

This is a high-value consumer of broker positions.

Example logic:

``` text
owned shares = 1,000
shares already covered by open short calls = 500

available covered-call capacity =
(1,000 - 500) / 100
= 5 contracts
```

Arowana must account for existing option positions and relevant working
orders before suggesting new covered calls.

For cash-secured puts, account for:

-   cash/buying power information available from broker
-   existing short puts
-   relevant working orders
-   strike × contract multiplier × contracts
-   Arowana's existing Wheel rules

Do not represent an options strategy as "covered" unless current broker
state supports that conclusion.

Phase 1 remains advisory/read-only.

------------------------------------------------------------------------

## 17. Arowana Trader / AI Coach

Broker data may be provided as structured context to the existing coach,
subject to existing AI safety/data boundaries.

Useful context:

``` text
selected account
positions
quantities
working orders
option positions
recent fills
cash/buying power
```

The AI must not receive reusable Schwab credentials.

The coach must distinguish between:

``` text
actual broker data
user-entered data
Arowana calculations
AI interpretation
```

AI recommendations must never directly trigger an order.

------------------------------------------------------------------------

## 18. Quotes and Market Data

Schwab may be used for brokerage-aware/current quote data.

Do not immediately delete FMP, Finnhub, Twelve Data, Alpha Vantage, SEC,
or other provider integrations.

Provider responsibilities should be explicit.

Recommended direction:

``` text
SCHWAB
- user's accounts
- balances
- positions
- transactions
- orders
- brokerage option chains
- quotes
- future streaming/account events

RESEARCH PROVIDERS
- financial statements
- long-term fundamentals
- analyst estimates
- DCF inputs
- company research
- news
- macro/economic data
```

Provider consolidation should be a separate decision.

Do not make Schwab the sole fundamental-data provider simply because it
has an instruments/fundamentals endpoint.

------------------------------------------------------------------------

## 19. Market Data Caching

Do not make every Arowana page independently request the same Schwab
quote.

Introduce an appropriate normalized/cached market-data boundary.

Consider:

``` text
symbol
provider
last_price
bid
ask
volume
quote_timestamp
received_at
stale_after
```

Avoid writing every tick into Postgres during Phase 1.

REST quote caching and WebSocket tick storage are different problems.

Streaming design belongs to Phase 2.

------------------------------------------------------------------------

## 20. Streaming --- Phase 2 Design Constraint

Expected Schwab streaming services may include:

``` text
LEVELONE_EQUITIES
LEVELONE_OPTIONS
LEVELONE_FUTURES
LEVELONE_FUTURES_OPTIONS
LEVELONE_FOREX

NYSE_BOOK
NASDAQ_BOOK
OPTIONS_BOOK

CHART_EQUITY
CHART_FUTURES

SCREENER_EQUITY
SCREENER_OPTION

ACCT_ACTIVITY
```

Verify the official current service list before implementation.

Do not implement a permanent Schwab WebSocket by keeping a normal
Supabase Edge Function alive indefinitely.

Preferred conceptual design:

``` text
Schwab WebSocket
      |
      v
Arowana Schwab Stream Worker
      |
      +--> in-memory/cache latest quotes
      |
      +--> normalized account events
      |
      v
Supabase / realtime boundary
      |
      v
Arowana browser
```

Streaming is out of scope for Phase 1 unless separately approved.

------------------------------------------------------------------------

## 21. Future Trading Guardrails

When trading is eventually implemented, preserve this flow:

``` text
AI / Arowana analysis
        |
        v
proposed trade
        |
        v
deterministic validation
        |
        v
human-readable preview
        |
        v
USER CONFIRMS
        |
        v
server-side broker action
        |
        v
Schwab
```

Never:

``` text
AI recommendation
      |
      v
automatic broker order
```

without a separately approved autonomous-trading architecture and safety
review.

For the foreseeable implementation, require explicit confirmation for
every real-money order.

------------------------------------------------------------------------

## 22. Suggested Server-Side Functions

Adjust names to current repository conventions after inspection.

Potential functions:

``` text
schwab-oauth-start
schwab-oauth-callback
schwab-token-refresh
schwab-disconnect

schwab-accounts
schwab-sync-accounts

schwab-positions
schwab-sync-positions

schwab-transactions
schwab-sync-transactions

schwab-orders
schwab-sync-orders

schwab-quotes
schwab-option-chain
schwab-expiration-chain
schwab-price-history
schwab-market-hours
```

Do not create dozens of nearly identical Edge Functions if a smaller
router/provider architecture better fits the current codebase.

Prefer maintainability over literal adherence to this suggested naming
list.

------------------------------------------------------------------------

## 23. Shared Schwab Client

Create one server-side Schwab API client/helper.

Responsibilities:

-   base URLs
-   authorization header
-   token refresh
-   account hash handling
-   request timeout
-   retries for safe/idempotent requests
-   Schwab error normalization
-   rate-limit handling
-   structured sanitized logging
-   request correlation ID
-   response parsing

Conceptually:

``` text
_shared/schwab.ts
```

but use the repository's current shared-function conventions.

Do not copy/paste fetch logic into every endpoint.

------------------------------------------------------------------------

## 24. Error Model

Normalize provider errors.

Example application-level errors:

``` text
BROKER_NOT_CONNECTED
BROKER_RECONNECT_REQUIRED
BROKER_ACCOUNT_NOT_FOUND
BROKER_PERMISSION_DENIED
BROKER_RATE_LIMITED
BROKER_TEMPORARILY_UNAVAILABLE
BROKER_INVALID_REQUEST
BROKER_SYNC_FAILED
```

Do not expose raw Schwab response bodies containing potentially
sensitive details directly to users.

Log enough sanitized context to diagnose problems.

------------------------------------------------------------------------

## 25. Connection UI

Add a broker connection area to the appropriate existing
Account/Settings surface.

Do not invent a new settings architecture if one already exists.

Conceptual UI:

``` text
Brokerage Connections

Charles Schwab

Status: Connected
Accounts: 2
Last synced: 2 minutes ago

[Sync Now]
[Reconnect]
[Disconnect]
```

Before connection:

``` text
Charles Schwab

Connect your Schwab brokerage account to import
positions, balances, transactions and orders.

[Connect Schwab]
```

Clearly communicate that Phase 1 is read-only.

------------------------------------------------------------------------

## 26. Sync UX

Pages using broker data should expose freshness.

Example:

``` text
Schwab
Updated 42 seconds ago
```

If stale:

``` text
Schwab data may be outdated.
Last successful sync: ...
```

Never silently present stale broker data as current.

------------------------------------------------------------------------

## 27. Disconnect Behavior

Disconnect must:

-   revoke/delete locally stored authorization material as appropriate
-   mark the broker connection disconnected
-   stop future synchronization
-   preserve historical Arowana journal records unless the user
    separately chooses to delete them
-   preserve user-created journal notes and analysis
-   avoid deleting canonical historical records simply because the
    broker is disconnected

Broker connection state and journal history are different concerns.

------------------------------------------------------------------------

## 28. Import/Reconciliation Rules

Critical rules:

1.  Re-running sync must not duplicate transactions.
2.  Re-running sync must not duplicate positions.
3.  Partial fills must be handled.
4.  Canceled orders must update existing records.
5.  Replaced orders must preserve useful lineage if Schwab exposes it.
6.  Closed positions must stop appearing as open holdings.
7.  Option assignment must reconcile with resulting stock activity where
    possible.
8.  Option exercise must reconcile appropriately.
9.  Expiration must not remain an open option indefinitely.
10. User-authored journal notes must never be overwritten.
11. Existing manually imported trades must not be duplicated simply
    because Schwab later reports the same trade.

Design matching/reconciliation carefully before auto-importing into the
canonical journal.

------------------------------------------------------------------------

## 29. Testing Requirements

Add tests appropriate to the repository's existing test stack.

Minimum coverage:

### OAuth

-   state mismatch rejected
-   missing authorization code
-   successful callback
-   expired access token refresh
-   refresh failure -\> reconnect required
-   no token returned to frontend

### Ownership / RLS

-   User A cannot read User B connection
-   User A cannot read User B accounts
-   User A cannot read User B positions
-   User A cannot read User B transactions
-   User A cannot read User B orders

### Sync

-   account sync idempotent
-   position sync idempotent
-   closed position removed/marked inactive
-   transaction sync idempotent
-   order status updates existing order
-   API retry does not duplicate records

### Journal reconciliation

-   repeated broker transaction does not duplicate journal trade
-   manual notes survive broker sync
-   partial fills reconcile correctly or remain explicitly unresolved
-   assignment/exercise does not silently produce incorrect P&L

### Frontend

-   disconnected state
-   connected state
-   reconnect-required state
-   loading state
-   stale-data state
-   Schwab API unavailable
-   multiple accounts
-   account selector
-   zero positions
-   option position rendering

------------------------------------------------------------------------

## 30. Observability

Record sanitized operational information such as:

``` text
connection_id
user_id or internal correlation-safe identifier
broker
operation
started_at
completed_at
success/failure
HTTP status category
normalized error code
records received
records inserted
records updated
records skipped
```

Never log:

``` text
access tokens
refresh tokens
client secret
authorization codes
full account numbers
sensitive raw payloads
```

------------------------------------------------------------------------

## 31. Rate Limits / Resilience

Verify Schwab's current rate-limit guidance.

Implement conservative behavior:

-   cache where appropriate
-   deduplicate concurrent requests
-   exponential backoff for eligible transient failures
-   do not retry non-idempotent future trading actions automatically
-   surface stale state when provider unavailable
-   do not hammer Schwab from every browser component

A single Portfolio Command load should not cause each widget to
independently request account data.

------------------------------------------------------------------------

## 32. Configuration

Expected placeholders may include:

``` text
SCHWAB_CLIENT_ID=
SCHWAB_CLIENT_SECRET=
SCHWAB_REDIRECT_URI=
```

Only add variables actually required by the verified current Schwab
OAuth implementation.

Do not put real values in:

-   `.env.example`
-   documentation
-   tests
-   screenshots
-   fixtures
-   commits

------------------------------------------------------------------------

## 33. Documentation

Implementation must update documentation with:

-   required environment variable names
-   Schwab Developer app prerequisites
-   callback URL setup
-   local development setup
-   production setup assumptions
-   connection flow
-   disconnect behavior
-   Phase 1 read-only limitations
-   troubleshooting
-   known Schwab API limitations

Do not document real account identifiers or credentials.

------------------------------------------------------------------------

## 34. Do Not Break

Preserve all current approved behavior unrelated to the integration.

In particular do not break:

-   Supabase authentication
-   current navigation
-   `portfolio-command.html`
-   `trade-journal-pro.html`
-   Options Hub
-   Wheel Strategy
-   Arowana Trader
-   Trading Command
-   Watchlist
-   existing manual/import journal workflows
-   existing AI coach behavior
-   plan/subscription gates
-   mobile navigation
-   current ATD security remediation
-   RLS
-   existing provider integrations unless replacement is explicitly
    approved

Do not opportunistically refactor unrelated pages.

------------------------------------------------------------------------

## 35. Do Not Reintroduce Retired Architecture

The repository has been consolidating duplicate tools.

Do not create:

``` text
schwab-portfolio.html
schwab-journal.html
schwab-watchlist.html
schwab-options.html
```

unless an approved architecture decision explicitly calls for them.

Integrate Schwab into canonical tools.

------------------------------------------------------------------------

## 36. Phase 1 Definition of Done

Phase 1 is complete only when an authenticated test user can:

1.  Open Arowana.
2.  Choose **Connect Schwab**.
3.  Complete Schwab OAuth.
4.  Return to Arowana successfully.
5.  See authorized Schwab account(s).
6.  See account balance information.
7.  See current positions.
8.  See transaction history.
9.  See order history/status.
10. Retrieve Schwab quotes.
11. Retrieve an option chain.
12. See broker positions in Portfolio Command.
13. Reconcile/import eligible brokerage activity into the canonical
    Trade Journal without duplicates.
14. Disconnect/reconnect safely.
15. See clear stale/error states when Schwab is unavailable.

And:

-   no Schwab secret is exposed to browser storage
-   no refresh token is exposed to normal client queries
-   RLS/ownership tests pass
-   sync is idempotent
-   existing canonical pages continue to work
-   no live order can be submitted from Arowana

------------------------------------------------------------------------

## 37. Required Codex Work Process

Do not immediately start making broad changes.

Follow this sequence:

### Step 1 --- Repository audit

Report:

-   relevant existing files
-   canonical tables
-   existing broker/provider code
-   existing Supabase auth pattern
-   existing secret-storage pattern
-   existing journal ownership model
-   existing portfolio ownership model
-   security/ATD constraints that affect implementation

### Step 2 --- Gap analysis

Compare current architecture with this specification.

Identify:

-   reusable components
-   required migrations
-   required server functions
-   frontend integration points
-   conflicts/unknowns
-   security blockers

### Step 3 --- Implementation plan

Propose a small sequence of implementation slices.

Recommended shape:

``` text
S1 OAuth + secure connection model
S2 accounts + balances + positions
S3 transactions + orders read-only
S4 Trade Journal reconciliation
S5 Portfolio Command integration
S6 quotes + option chains
S7 UX/error/freshness states
S8 security + regression tests
```

Adjust based on the actual repository.

### Step 4 --- Stop for approval if necessary

If implementation would require:

-   changing canonical ownership
-   weakening security controls
-   altering existing production data
-   linking a different Supabase project
-   deleting existing tables
-   replacing existing providers
-   enabling live trading
-   changing approved ATD decisions

stop and explain the decision required.

### Step 5 --- Implement incrementally

Keep changes scoped.

Test after every slice.

### Step 6 --- Final report

Provide:

-   files changed
-   migrations added
-   functions added
-   tests run
-   test results
-   security checks
-   unresolved issues
-   manual setup required
-   exact next recommended slice

------------------------------------------------------------------------

## 38. Important Product Principle

The purpose of this integration is not simply to display Schwab inside
Arowana.

It is to give Arowana reliable brokerage context.

Desired long-term model:

``` text
              AROWANA

Analysis / AI / Rules
        |
        v
Broker-aware intelligence
        |
        +--> Portfolio Command
        +--> Trade Journal
        +--> Options Hub
        +--> Wheel Strategy
        +--> Arowana Trader
        +--> Trading Command
        +--> Watchlist
        |
        v
Human decision
        |
        v
Broker
```

Arowana should understand:

-   what the user actually owns
-   how much they own
-   current option exposure
-   existing working orders
-   recent fills
-   cash/buying power
-   journal history

This context should improve analysis and reduce contradictory or unsafe
recommendations.

------------------------------------------------------------------------

## 39. Phase 1 Safety Boundary

Repeat this constraint in code comments and documentation where
appropriate:

> Phase 1 is a read-only Schwab integration. Arowana may retrieve and
> analyze brokerage information, but it must not place, replace, cancel,
> or automatically submit brokerage orders.

Do not add dormant order-write endpoints "for later" unless they are
completely unreachable and there is a compelling architectural reason.

Prefer not implementing them until the approved trading phase.

------------------------------------------------------------------------

## 40. Codex Final Instruction

Use this document as the target architecture, but treat the current
repository and its approved ATD/security decisions as authoritative for
implementation details.

Do not guess.

Inspect first.

Reuse canonical Arowana components.

Keep Schwab credentials server-side.

Do not create duplicate portfolio/journal systems.

Do not enable live trading in Phase 1.

Prioritize data integrity, idempotency, account isolation, and
preservation of existing Arowana behavior over implementation speed.
