# Arowana 2.0 Task Board

## COMPLETED — AWAITING REVIEW

### ATD-001 — Full repository feature audit
**Owner:** Codex

**Status:** Audit completed 2026-09-27; awaiting owner review of recommendations.

**Branch:** `codex/ATD-001-full-repository-audit`

**Goal:** Classify existing pages/modules as KEEP / MODIFY / MERGE / PORT / ARCHIVE / DELETE / SECURITY FIX; identify dependency clusters and canonical versions.

**Result:** [Repository audit](docs/ATD-001_REPOSITORY_AUDIT.md) inventories all 249 baseline files, including 211 individual HTML/JS/CSS/configuration rows, canonical recommendations, integrations, implied data models and migration priorities. No application functionality or production configuration changed; no legacy files deleted.

**Verification:** Existing secret check passed its limited patterns; a remaining credential-like Twelve Data literal was separately identified without reproducing its value. All 32 standalone JS files passed syntax checks; 477 inline blocks produced four existing syntax failures. Static HTML paths identified 80 missing targets across 230 occurrences. Full evidence and limitations are in the audit.

**Next:** Review ATD-001, then assign ATD-002 if approved. No follow-on task started.

## READY

### ATD-002 — Secret and client-key migration inventory
**Owner:** Unassigned  
**Goal:** Find every private provider credential path, localStorage key workflow, webhook exposure, and server-side migration requirement.

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
