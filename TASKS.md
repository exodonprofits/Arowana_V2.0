# Arowana 2.0 Task Board

## COMPLETED â€” AWAITING REVIEW

### ATD-001 â€” Full repository feature audit
**Owner:** Codex

**Status:** Audit completed 2026-09-27; awaiting owner review of recommendations.

**Branch:** `codex/ATD-001-full-repository-audit`

**Goal:** Classify existing pages/modules as KEEP / MODIFY / MERGE / PORT / ARCHIVE / DELETE / SECURITY FIX; identify dependency clusters and canonical versions.

**Result:** [Repository audit](docs/ATD-001_REPOSITORY_AUDIT.md) inventories all 249 baseline files, including 211 individual HTML/JS/CSS/configuration rows, canonical recommendations, integrations, implied data models and migration priorities. No application functionality or production configuration changed; no legacy files deleted.

**Verification:** Existing secret check passed its limited patterns; a remaining credential-like Twelve Data literal was separately identified without reproducing its value. All 32 standalone JS files passed syntax checks; 477 inline blocks produced four existing syntax failures. Static HTML paths identified 80 missing targets across 230 occurrences. Full evidence and limitations are in the audit.

**Next:** Review ATD-001 recommendations alongside the separately assigned ATD-002 result below.

### ATD-002 â€” Secret and client-key migration inventory
**Owner:** Codex

**Status:** Inventory completed 2026-09-28; awaiting owner review. No remediation or follow-on task started.

**Branch:** `codex/ATD-002-secret-client-key-inventory`

**Goal:** Find every private provider credential path, localStorage key workflow, webhook exposure, and server-side migration requirement.

**Result:** [Secret and client-key inventory](docs/ATD-002_SECRET_CLIENT_KEY_INVENTORY.md) records credential classes, source/storage ledgers, key hydration and cleanup gaps, webhook trust boundaries, missing backend evidence, and migration requirements. Documentation only; no credentials rotated or production changes made.

**Verification:** Repository secret check passed its limited patterns. Additional redacted scans covered 250 baseline files, 16 DOCX XML/relationship members and 250 blobs across four reachable local commits; the remaining Twelve Data candidate was found in source/history. Nine source JWT literals decode to public anon role. No live credential or backend validation performed. See report for coverage and limitations.

**Next:** Owner review and credential-containment decision; recommended next assignment ATD-005 (schema/RLS audit), with ATD-004 contracts before provider migration. ATD-005 and ATD-004 were subsequently assigned separately.

### ATD-005 â€” Supabase schema/RLS audit
**Owner:** Codex

**Status:** Audit completed 2026-09-28; awaiting review. No remediation or follow-on task started.

**Branch:** `codex/ATD-005-supabase-schema-rls-audit`

**Goal:** Inventory tables/functions/RLS expectations referenced by the frontend and identify multi-user isolation gaps.

**Result:** [Schema/RLS audit](docs/ATD-005_SUPABASE_SCHEMA_RLS_AUDIT.md) combines source traces with read-only live metadata from the repository-matched Supabase project. Catalogued 470 relations (411 RLS-enabled base tables and 59 views); detailed inventory covers 51 scoped relations, 131 policies and 132 constraints. Identified watchlist policy composition, account-parent ownership gaps, credential storage exposure, schema drift and shared-project debt. Existing profile/usage/Edge auth protections are recorded.

**Verification:** Read-only catalog queries, security advisors, migration/deployment lists and three Edge Function source reviews; no application rows, stored secrets, production writes or endpoint invocations. Repository secret check and documentation diff checks passed; no two-user runtime isolation tests performed. See report for limitations.

**Next:** Review findings and containment decisions. Recommended next existing task ATD-004; remediation needs a separate scoped assignment. No follow-on started.

### ATD-004 â€” Data source inventory and contract
**Owner:** Codex

**Status:** Documentation completed 2026-09-28; proposed v0.1 contract awaiting review. No implementation or follow-on started.

**Branch:** `codex/ATD-004-data-source-inventory-contract`

**Result:** [Data source inventory](docs/ATD-004_DATA_SOURCE_INVENTORY.md) and [proposed Data Hub contract](docs/ATD-004_DATA_HUB_CONTRACT.md) map legacy provider/workflow paths to target datasets, versioned provenance, freshness, entitlements, error/fallback rules and DEV acceptance requirements. Preserved prior audit reports; no application or production changes.

**Verification:** All 206 first-party HTML/JS/JSON files covered by the source-signal inventory; official provider documentation consulted. Repository secret check, documentation fixture/redaction/reference checks and diff checks passed. No live provider, database, workflow or broker requests; no subscriptions or entitlements verified.

**Next:** Review provider/feed rights, freshness budgets, canonical data ownership and deployment/retention decisions. Recommended next existing Phase 0 task ATD-003. ATD-101 remains gated on contract approval and security remediation; no follow-on started.

### ATD-004 follow-up â€” Architecture 2.1 proposal

**Owner:** Codex

**Status:** User-requested documentation follow-up prepared 2026-09-28; awaiting owner review.

**Branch:** `codex/ATD-004-architecture-2-1`

**Result:** [Architecture 2.1](docs/ARCHITECTURE_2_1.md) translates the ATD-004 inventory and proposed contract into component boundaries, logical ownership, engine/AI responsibilities, secure migration stages and explicit owner decisions. Original inventory/contract preserved; no implementation or production changes.

**Verification:** Documentation links, repository secret scan and Git whitespace/scope checks; no runtime or provider tests apply to this documentation-only follow-up.

**Next:** Owner review of Architecture 2.1 and ATD-004 decisions. ATD-101 remains gated; ATD-003 remains unassigned.

### ATD-006 â€” Architecture 2.1 consolidation

**Owner:** Codex

**Status:** Completed â€” Architecture 2.1 including ATD-006A owner-approved 2026-09-29. ATD-004 approval remains separate.

**Branch:** `codex/ATD-006-architecture-2-1-consolidation`

**Result:** Reconciled the ATD-004-driven Architecture 2.1 engineering/data design with the AI Trading Floor addendum in [the consolidated proposal](docs/ARCHITECTURE_2_1.md). Integrated shared logical specialist roles, adversarial review, Chief synthesis, initial/final deterministic gates, hard risk veto and Trade Decision Records. The addendum remains unchanged historical/source evidence; baseline architecture and ATD-004 child contract remain unchanged.

**Verification:** Existing limited-pattern secret scan, Git whitespace/three-file scope checks, relative links, preserved-source comparison and requirement review. No application or production changes, credential-store access, or runtime tests. ATD-003 and ATD-101 not started.

**Next:** Stop for owner review of Architecture 2.1 and its open decisions. No automatic follow-on assignment.

### ATD-006A â€” Bind Reviews to Final Proposal Version

**Owner:** Codex; Claude Code follow-up commit on the same branch

**Status:** Completed â€” owner-approved 2026-09-29 with Architecture 2.1. ATD-006A merged through PR #7.

**Branch:** `codex/ATD-006A-bind-final-proposal-review`

**Result:** Clarified section 7 of [Architecture 2.1](docs/ARCHITECTURE_2_1.md): immutable proposal identity, assessment/snapshot/version bindings, invalidation after material changes, required recalculation and refreshed reviews, final-record bindings and the non-material presentation exception. The follow-up adds the nine-step revision sequence, NVDA v1/v2 example, proposal-change versus evidence-change handling, objection carry-forward, and section 9 tests / section 10 open decisions. No physical schema or implementation.

**Verification:** Documentation links, whitespace, existing limited-pattern secret scan and exact documentation-only scope checks. ATD-004 and the source addendum unchanged; no application or production changes. ATD-003 and ATD-101 not started.

**Next:** Owner review; do not merge automatically or begin follow-on tasks.

## COMPLETED â€” NAVIGATION MAP APPROVED

### ATD-003 â€” Canonical navigation map
**Owner:** Codex
**Depends on:** ATD-001  
**Status:** Map completed and labels/grouping owner-approved 2026-09-29. Architecture prerequisite approved; no navigation implementation performed.
**Goal:** Define Arowana 2.0 primary navigation without breaking legacy links.

**Branch:** `codex/ATD-003-canonical-navigation-map`

**Result:** [Canonical navigation map](docs/ATD-003_CANONICAL_NAVIGATION_MAP.md): hierarchy, desk mapping, legacy compatibility, mobile/accessibility rules and rollout acceptance. No application or production changes.

**Verification:** Documentation links, existing route references, whitespace, repository secret check and documentation-only scope. No browser/UI runtime tests.

**Approved refinements:** Research label; Growth desk with AI as a theme filter; distinct Options/Wheel and Portfolio/Journal responsibilities; contextual coaching/tools; mobile Command, Watchlists, Portfolio, Journal, More.

**Next:** Separate implementation assignment subject to relevant security/DEV gates. ATD-101 remains gated and unstarted.

## PLANNED AFTER PHASE 0

### ATD-007 â€” Security remediation and DEV baseline

**Owner:** Codex

**Status:** In progress â€” first repository containment/scanner slice implemented; local Supabase running 2026-09-30 with loopback bindings; database security-version review and ownership remediation remain open.

**Branch:** `codex/ATD-007-security-dev-baseline`

**Scope/result:** [Work record](docs/ATD-007_SECURITY_DEV_BASELINE.md). Removed the remaining key-like literal/direct quote call in the option-roll helper, added contextual secret detection and seven synthetic regression tests to CI. Credential revocation/history containment, client-key workflow migration and ATD-005 ownership remediation remain open. No production changes.

**Next:** Resolve local PostgreSQL security-version baseline, establish reviewed versioned backend definitions and validate remaining fixes with synthetic two-user tests. ATD-101 remains gated.

### Later implementation tasks

- ATD-101 Market Data Hub â€” PLANNED; gated on Architecture/Data Hub contract approval, provider/feed decisions, security remediation, entitlement/licensing decisions and a secure DEV baseline. Not started.
- ATD-102 Market Regime Engine
- ATD-103 Technical + POC Engine
- ATD-104 EPS Revision / Fundamental Engine
- ATD-105 Portfolio & Risk Engine
- ATD-106 Trading Command 2.0 MVP
- ATD-107 Morning Brief / What Changed
- ATD-108 Wheel module port from current Wheel-focused repo

### ATD-007 continuation - 2026-10-01

Runtime credential containment took priority after generated secrets were found tracked in merged main. Three runtime paths removed from index; CI tracking guard added; affected local stack stopped with volumes preserved. Nine tests, guard, secret scan and whitespace checks passed. Credential rotation/history containment and PostgreSQL/schema work remain open. No production changes or ATD-101 work. Details: [ATD-007 work record](docs/ATD-007_SECURITY_DEV_BASELINE.md).
