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

**Next:** Owner review and credential-containment decision; recommended next assignment ATD-005 (schema/RLS audit), with ATD-004 contracts before provider migration. Neither task has started here.

## READY

### ATD-003 — Canonical navigation map
**Owner:** Unassigned  
**Depends on:** ATD-001  
**Goal:** Define Arowana 2.0 primary navigation without breaking legacy links.

### ATD-004 — Data source inventory and contract
**Owner:** Unassigned  
**Goal:** Catalog current Twelve Data/Finnhub/FMP/Alpha Vantage/Supabase/n8n usage and define the future Data Hub contract.

### ATD-005 — Supabase schema/RLS audit
**Owner:** Unassigned  
**Goal:** Inventory tables/functions/RLS expectations referenced by the frontend and identify multi-user isolation gaps.

## PLANNED AFTER PHASE 0

- ATD-101 Market Data Hub
- ATD-102 Market Regime Engine
- ATD-103 Technical + POC Engine
- ATD-104 EPS Revision / Fundamental Engine
- ATD-105 Portfolio & Risk Engine
- ATD-106 Trading Command 2.0 MVP
- ATD-107 Morning Brief / What Changed
- ATD-108 Wheel module port from current Wheel-focused repo
