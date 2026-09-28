# Arowana 2.0 Task Board

## COMPLETED — AWAITING REVIEW

### ATD-001 — Full repository feature audit
**Owner:** Codex

**Status:** Audit completed 2026-09-27; awaiting owner review of recommendations.

**Branch:** `codex/ATD-001-full-repository-audit`

**Goal:** Classify existing pages/modules as KEEP / MODIFY / MERGE / PORT / ARCHIVE / DELETE / SECURITY FIX; identify dependency clusters and canonical versions.

**Result:** [Repository audit](docs/ATD-001_REPOSITORY_AUDIT.md) inventories all 249 baseline files, including 211 individual HTML/JS/CSS/configuration rows, canonical recommendations, integrations, implied data models and migration priorities. No application functionality or production configuration changed; no legacy files deleted.

**Verification:** Existing secret check passed its limited patterns; a remaining credential-like Twelve Data literal was separately identified without reproducing its value. All 32 standalone JS files passed syntax checks; 477 inline blocks produced four existing syntax failures. Static HTML paths identified 80 missing targets across 230 occurrences. Full evidence and limitations are in the audit.

**Next:** Review ATD-001 recommendations alongside the separately assigned ATD-002 result below.

### ATD-002 — Secret and client-key migration inventory
**Owner:** Codex

**Status:** Inventory completed 2026-09-28; awaiting owner review. No remediation or follow-on task started.

**Branch:** `codex/ATD-002-secret-client-key-inventory`

**Goal:** Find every private provider credential path, localStorage key workflow, webhook exposure, and server-side migration requirement.

**Result:** [Secret and client-key inventory](docs/ATD-002_SECRET_CLIENT_KEY_INVENTORY.md) records credential classes, source/storage ledgers, key hydration and cleanup gaps, webhook trust boundaries, missing backend evidence, and migration requirements. Documentation only; no credentials rotated or production changes made.

**Verification:** Repository secret check passed its limited patterns. Additional redacted scans covered 250 baseline files, 16 DOCX XML/relationship members and 250 blobs across four reachable local commits; the remaining Twelve Data candidate was found in source/history. Nine source JWT literals decode to public anon role. No live credential or backend validation performed. See report for coverage and limitations.

**Next:** Owner review and credential-containment decision; recommended next assignment ATD-005 (schema/RLS audit), with ATD-004 contracts before provider migration. ATD-005 and ATD-004 were subsequently assigned separately.

### ATD-005 — Supabase schema/RLS audit
**Owner:** Codex

**Status:** Audit completed 2026-09-28; awaiting review. No remediation or follow-on task started.

**Branch:** `codex/ATD-005-supabase-schema-rls-audit`

**Goal:** Inventory tables/functions/RLS expectations referenced by the frontend and identify multi-user isolation gaps.

**Result:** [Schema/RLS audit](docs/ATD-005_SUPABASE_SCHEMA_RLS_AUDIT.md) combines source traces with read-only live metadata from the repository-matched Supabase project. Catalogued 470 relations (411 RLS-enabled base tables and 59 views); detailed inventory covers 51 scoped relations, 131 policies and 132 constraints. Identified watchlist policy composition, account-parent ownership gaps, credential storage exposure, schema drift and shared-project debt. Existing profile/usage/Edge auth protections are recorded.

**Verification:** Read-only catalog queries, security advisors, migration/deployment lists and three Edge Function source reviews; no application rows, stored secrets, production writes or endpoint invocations. Repository secret check and documentation diff checks passed; no two-user runtime isolation tests performed. See report for limitations.

**Next:** Review findings and containment decisions. Recommended next existing task ATD-004; remediation needs a separate scoped assignment. No follow-on started.

### ATD-004 — Data source inventory and contract
**Owner:** Codex

**Status:** Documentation completed 2026-09-28; proposed v0.1 contract awaiting review. No implementation or follow-on started.

**Branch:** `codex/ATD-004-data-source-inventory-contract`

**Result:** [Data source inventory](docs/ATD-004_DATA_SOURCE_INVENTORY.md) and [proposed Data Hub contract](docs/ATD-004_DATA_HUB_CONTRACT.md) map legacy provider/workflow paths to target datasets, versioned provenance, freshness, entitlements, error/fallback rules and DEV acceptance requirements. Preserved prior audit reports; no application or production changes.

**Verification:** All 206 first-party HTML/JS/JSON files covered by the source-signal inventory; official provider documentation consulted. Repository secret check, documentation fixture/redaction/reference checks and diff checks passed. No live provider, database, workflow or broker requests; no subscriptions or entitlements verified.

**Next:** Review provider/feed rights, freshness budgets, canonical data ownership and deployment/retention decisions. Recommended next existing Phase 0 task ATD-003. ATD-101 remains gated on contract approval and security remediation; no follow-on started.

## READY

### ATD-003 — Canonical navigation map
**Owner:** Unassigned  
**Depends on:** ATD-001  
**Goal:** Define Arowana 2.0 primary navigation without breaking legacy links.

## PLANNED AFTER PHASE 0

- ATD-101 Market Data Hub
- ATD-102 Market Regime Engine
- ATD-103 Technical + POC Engine
- ATD-104 EPS Revision / Fundamental Engine
- ATD-105 Portfolio & Risk Engine
- ATD-106 Trading Command 2.0 MVP
- ATD-107 Morning Brief / What Changed
- ATD-108 Wheel module port from current Wheel-focused repo
