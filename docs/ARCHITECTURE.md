# Arowana Trading Desk 2.0 Architecture

Proposed expansion: [Architecture 2.1](ARCHITECTURE_2_1.md), prepared as an ATD-004 follow-up from the data source inventory and proposed contract. It remains subject to owner review; this baseline and the ATD-004 contract are not implicitly approved or replaced.

## Product boundary

Arowana is a private-beta trading research and decision-support system. TradingView remains the deep visual charting tool; the broker remains the execution/custody system. Arowana becomes the first-stop command center.

## Target flow

```text
Providers / broker data
        |
        v
Arowana Data Hub
        |
        v
Normalized Supabase data + freshness metadata
        |
        +--> Market Engine
        +--> Fundamental / Valuation Engine
        +--> Technical / POC Engine
        +--> Portfolio Engine
        +--> Risk Engine
        +--> Strategy Engine
        |
        v
AI analyst layer
        |
        v
Chief Trading Agent
        |
        v
Trading Command / Morning Brief / What Changed
        |
        +--> Swing
        +--> Wheel
        +--> Growth/AI
        +--> Options
        +--> Long-Term
        |
        v
Trader -> optional TradingView -> broker execution
```

## Core rule

Structured/deterministic systems calculate facts. AI explains, challenges, synthesizes, and routes decisions.

## Private-beta users

Design tables and access around `user_id`. Owner/family/beta users may have different market-data entitlements. Do not assume one personal market-data license can be redistributed to all users.

## Initial providers (target, subject to implementation audit)

- Equities/options: Alpaca as primary normalized realtime feed
- Fundamentals/estimates: FMP
- Macro: FRED
- Filings: SEC EDGAR
- Broker: Schwab read-only later
- Database/backend: Supabase

Legacy providers remain in source during Phase 0 and are not considered the final provider architecture.

## Strategy hierarchy

Wheel is a strategy desk **inside** Arowana, not the identity of the whole platform. The existing Wheel-focused repo should later provide selected, tested modules to port into this core.
