# Architecture 2.1 — AI Trading Floor Addendum

**Status:** Proposed addendum for reconciliation into `ARCHITECTURE_2_1.md`  
**Date:** 2026-09-28  
**Scope:** AI Trading Floor, adversarial review, decision gate, and Trade Decision Record.  
**Base document:** Codex-created `ARCHITECTURE_2_1.md`.

## 1. Purpose

This addendum does not replace Architecture 2.1. Preserve its Data Hub, `/api/data/v1`, provider registry, provenance, immutable snapshots, authorization, entitlements, caching, fallback, deterministic-engine, security, DEV, and delivery requirements.

This addendum expands the existing **AI analysts / Chief Trading Agent** concept into an explicit trading-intelligence layer:

> Trusted data → deterministic engines → specialized AI analysis → adversarial review → deterministic risk/eligibility gates → Chief Trading Agent synthesis → human decision.

No part of this addendum authorizes autonomous broker execution.

## 2. AI Trading Floor Boundary

The AI Trading Floor sits downstream of approved immutable snapshots and deterministic engine outputs. It must not create an independent market-data architecture.

```text
Approved providers / private records
                 ↓
          Arowana Data Hub
                 ↓
       Immutable input snapshots
                 ↓
        Deterministic engines
                 ↓
        AI TRADING FLOOR
        ├─ Market Agent
        ├─ Technical Agent
        ├─ Fundamental Agent
        ├─ Portfolio Agent
        ├─ Strategy Agent
        └─ Risk Analyst
                 ↓
          Devil's Advocate
                 ↓
         Chief Trading Agent
                 ↓
          Decision / Risk Gate
                 ↓
        Trade Decision Record
                 ↓
       Trading Command / Desks
                 ↓
                User
                 ↓
       TradingView / Broker
```

These are logical responsibilities, not a requirement for a separate service or LLM call for every box.

## 3. Shared-Brain Principle

Strategy desks must share the same factual and deterministic foundation.

Do not build separate Swing, Wheel, Options, Growth, or Long-Term data pipelines. They should consume the common Market, Technical/POC, Fundamental, Portfolio, Risk, and Strategy services.

Wheel remains one strategy desk inside Arowana, not a separate platform identity.

## 4. Specialized AI Roles

### 4.1 Market Agent

Primary question: **What market environment are we operating in?**

Consumes approved Market Engine and macro outputs. It explains regime, breadth, sector leadership, macro/event context, and conflicts. It does not independently create authoritative regime measurements.

### 4.2 Technical Agent

Primary question: **Does measurable price structure support this setup?**

Consumes Technical + POC Engine outputs. It interprets trend, momentum, volume, support/resistance, 5-day and 20-day swing POC, confirmation/invalidation, and timeframe conflicts. It must not estimate authoritative indicators from screenshots when approved engine values exist.

### 4.3 Fundamental Agent

Primary question: **Do business quality, earnings evidence, valuation, and estimate behavior support the thesis?**

Consumes Fundamental / EPS Revision / Valuation outputs. It explains growth, margins, cash flow, valuation, estimates, revisions, earnings and filing risks. Missing fundamentals must not become plausible-but-unverified facts.

### 4.4 Portfolio Agent

Primary question: **Does this opportunity fit the user's existing portfolio?**

Consumes reconciled Portfolio Engine outputs. It explains exposure, concentration, sector/correlation overlap, strategy exposure, and account context. Incomplete account retrieval must not be described as zero exposure.

### 4.5 Strategy Agent

Primary question: **Which approved strategy structure best expresses the opportunity?**

Possible outcomes include Swing, Wheel, long stock, defined-risk options, Growth/AI accumulation, Long-Term, wait, or no trade. Deterministic strategy services validate eligibility and calculations.

### 4.6 Risk Analyst

Primary question: **What do deterministic risk results mean for this proposed plan?**

It explains position sizing, concentration, buying power, option assignment/exercise exposure, event risk, and liquidity. It does not own or override Risk Engine limits.

## 5. Deterministic Risk Veto

**No AI agent, including the Chief Trading Agent, may override a hard deterministic Risk Engine rejection.**

```text
Market Agent       SUPPORTIVE
Technical Agent    STRONG
Fundamental Agent  STRONG
Strategy Agent     SWING LONG

Risk Engine:
Maximum approved symbol exposure exceeded

RESULT:
BLOCKED
```

Additional AI confidence or agent agreement cannot convert `BLOCKED` into an actionable plan.

## 6. Devil's Advocate

The Devil's Advocate is a first-class adversarial review role. It is not another vote.

Its objective is:

> Attempt to invalidate the proposed trade or expose material evidence that the primary analysis underweighted.

It may challenge regime assumptions, setup quality, entry location, reward/risk, upcoming events, fundamentals, estimate revisions, concentration, liquidity, option structure, strategy fit, conflicting timeframes, or stale/incomplete evidence.

Material objections should be presented to the Chief Trading Agent and retained in the Decision Record when relevant.

## 7. No Arbitrary Multi-Agent Voting

Arowana must not authorize a trade solely because a percentage or count of AI agents agrees.

Rejected pattern:

```text
7 of 8 agents bullish
87.5% consensus
BUY
```

Agents may consume overlapping evidence, are not statistically independent, and can share the same bad/stale input. Hard risk and data-quality failures cannot be averaged away.

A future evidence/confidence score must have a documented definition and validation process. No arbitrary threshold such as `76.8%` becomes an architecture rule without evidence and validation.

## 8. Chief Trading Agent

The Chief Trading Agent is an orchestrator and synthesizer, not an unrestricted autonomous trader.

Conceptual workflow:

```text
Gather approved snapshot references
                ↓
Gather deterministic engine results
                ↓
Request relevant specialist analyses
                ↓
Identify agreement and disagreement
                ↓
Invoke Devil's Advocate
                ↓
Check data-quality / eligibility
                ↓
Check deterministic Risk Gate
                ↓
Evaluate strategy context
                ↓
Produce Trade Decision Record
```

The Chief Trading Agent must not fetch arbitrary unapproved provider data, invent prices/Greeks/financial facts, bypass freshness or entitlements, bypass deterministic eligibility, override hard risk rejection, or place broker orders under Architecture 2.1.

Possible decision-support states include:

- `BLOCKED`
- `REJECT`
- `WAIT`
- `WATCH`
- `READY FOR HUMAN REVIEW`

## 9. Decision Gate

The system should distinguish analysis from eligibility to present an actionable plan.

```text
DATA QUALITY
     ↓
FRESHNESS / ENTITLEMENT
     ↓
ENGINE INPUT ELIGIBILITY
     ↓
DETERMINISTIC RISK
     ↓
STRATEGY ELIGIBILITY
     ↓
SPECIALIST AI ANALYSIS
     ↓
DEVIL'S ADVOCATE
     ↓
CHIEF TRADING AGENT
     ↓
TRADE DECISION RECORD
     ↓
HUMAN REVIEW
```

AI narrative must never convert unavailable to available, partial to complete, delayed to realtime, unauthorized to authorized, or failed risk to passed risk.

## 10. Trade Decision Record

A primary output should be an auditable **Trade Decision Record**, not merely BUY/SELL or an AI confidence percentage.

```text
TRADE DECISION RECORD

Symbol:              NVDA
Strategy:            Swing

Market Regime:       SUPPORTIVE
Technical:           STRONG
Fundamental:         STRONG
Portfolio Fit:       MODERATE
Strategy Fit:        STRONG

Data Quality:        PASS
Freshness:           PASS
Risk:                PASS

Devil's Advocate:
2 material concerns

Chief Assessment:
WAIT FOR ENTRY

Trigger:
<defined condition / level>

Invalidation:
<defined condition / level>

Risk:
<approved account / portfolio risk>

Status:
WATCH

Input Snapshot IDs:
<immutable references>

Engine Versions:
<versions>

Policy Versions:
<versions>

AI Analysis Versions:
<model / prompt references where appropriate>

Generated:
<timestamp>
```

The record should reference facts and engine outputs, retain material disagreement and Devil's Advocate objections, preserve risk status, distinguish assumptions from facts, expose data-quality limitations, and identify generation time.

## 11. Relationship to Trader Surfaces

The AI Trading Floor should feed existing decision surfaces rather than become another disconnected application.

- **Morning Brief:** What matters before the trading day/session begins?
- **What Changed:** What materially changed between identified approved snapshots?
- **Trading Command:** What currently requires attention or a decision?
- **Strategy Desks:** How should an opportunity be evaluated within a specific strategy?

These surfaces should share snapshots, engine results, and Decision Records rather than independently acquiring market facts.

## 12. Human Execution Authority

Architecture 2.1 retains the human trader as final execution authority.

```text
Arowana detects / analyzes opportunity
               ↓
Deterministic engines calculate
               ↓
AI Trading Floor interprets/challenges
               ↓
Risk and eligibility gates
               ↓
Trade Decision Record
               ↓
USER
               ↓
Approve / Reject / Modify / Wait
               ↓
Optional TradingView review
               ↓
Manual broker execution
```

Schwab remains read-only unless a later, separately approved architecture introduces order permissions and the necessary safety, authorization, testing, and audit controls.

## 13. Implementation Guidance

Logical agents do not require six or eight separate paid LLM calls for every symbol.

Implementation should optimize correctness, traceability, latency, materiality, and cost.

Examples:

- routine watchlist refresh may use deterministic engines only;
- AI may run only after a material change;
- multiple logical roles may share one structured model invocation;
- Devil's Advocate may run only for actionable candidates;
- Chief synthesis may run only after eligibility/risk prerequisites pass.

The architecture defines separation of responsibility, not unnecessary compute.

## 14. Relationship to ATD-003

ATD-003 owns canonical navigation.

The AI Trading Floor should normally remain shared intelligence behind trader workflows rather than creating navigation clutter for every internal agent.

Agent outputs should generally surface through Trading Command, Morning Brief, What Changed, Analysis, Swing, Wheel, Options, Growth/AI, Portfolio/Risk, and Journal/Review.

## 15. Reconciliation Requirements

When reconciling this addendum into Codex's `ARCHITECTURE_2_1.md`:

**Preserve** the existing document's detailed Data Hub contract alignment, `/api/data/v1`, provider registry, provenance, immutable snapshots, authorization/entitlements, cache identity, fallback rules, point-in-time integrity, deterministic engines, security/deployment requirements, DEV acceptance gates, and ATD-002/004/005 dependencies.

**Add or strengthen:**

1. explicit AI Trading Floor;
2. specialized AI role responsibilities;
3. Devil's Advocate;
4. deterministic risk veto;
5. prohibition on arbitrary multi-agent voting;
6. Chief Trading Agent orchestration contract;
7. Decision Gate;
8. Trade Decision Record;
9. shared-brain strategy-desk principle;
10. human execution authority;
11. logical-agent/cost guidance;
12. guidance that internal agents need not become navigation items.

## 16. Acceptance Criteria

The final reconciled Architecture 2.1 should satisfy all of the following:

- ATD-004 remains the detailed Data Hub/API child contract.
- Existing security and entitlement gates are not weakened.
- Deterministic engines remain authoritative for calculated facts.
- Specialized AI responsibilities are documented.
- Hard Risk Engine rejection is non-bypassable.
- Devil's Advocate is adversarial analysis, not another vote.
- Arbitrary AI consensus thresholds are explicitly rejected.
- Chief Trading Agent authority and limitations are explicit.
- Trade Decision Record is the primary auditable decision-support artifact.
- Strategy desks share one intelligence foundation.
- Human remains final execution authority.
- No broker order capability is introduced.
- ATD-003 remains responsible for canonical navigation.

## 17. Final Architectural Principle

> **Arowana Trading Desk should not become a collection of independent AI traders voting on trades. It should be one coherent trading intelligence system: one trusted factual foundation, deterministic engines for authoritative calculations, specialized AI roles for interpretation and challenge, adversarial review to reduce confirmation bias, non-bypassable risk controls, a Chief Trading Agent for synthesis, and a human trader retaining final execution authority.**
