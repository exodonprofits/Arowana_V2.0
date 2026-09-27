# Arowana 2.0 Task Board

## READY

### ATD-001 — Full repository feature audit
**Owner:** Unassigned  
**Goal:** Classify existing pages/modules as KEEP / MODIFY / MERGE / PORT / ARCHIVE / DELETE / SECURITY FIX; identify dependency clusters and canonical versions.

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
