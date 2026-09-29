# ATD-007 — Security remediation and DEV baseline

Status: in progress. Authorized 2026-09-29 after architecture/navigation review completion. Branch: `codex/ATD-007-security-dev-baseline`.

## First implemented slice

ATD-002 CK-01: removed the credential-like provider literal and the direct Twelve Data quote request from the orphan option-roll helper. Manual price entry remains; the placeholder explicitly says it is not a live quote. The existing analysis webhook flow is unchanged and is not certified safe or functional by this fix.

ATD-002 CK-12: expanded the existing offline scanner for contextual hex-key assignments/query literals, privileged JWT roles and Supabase secret keys. `.env.example` is scanned rather than exempted. Findings contain location/classification only. Added seven synthetic regression tests and CI execution. No private value is copied into a fixture or report.

Removal does not revoke the credential, clean reachable history or change deployed files. Owner/provider revocation and deployed-copy containment remain open; no credential was used or validated.

## DEV dependency and remaining scope

No isolated DEV target has been selected yet. Docker and Supabase CLI were not found on the current shell PATH. The owner was asked to choose local DEV or an existing separate DEV project. Do not use the repository-matched production project as a substitute.

After DEV selection, verify isolation, establish versioned backend definitions/migrations and synthetic fixtures, then test positive/negative two-user ownership cases before claiming a secure baseline. Existing backend implementations are not in this repository; do not invent production schema from similar table names or copy production records/secrets into fixtures.

Outstanding security work includes browser key hydration/alternate stores and credential-bearing workflow forwarding (ATD-002), watchlist parent/item ownership and account/entity invariants (ATD-005), and exposed-field/grant reviews. Each needs tested migration/compatibility behavior in DEV; current scanner success does not close these findings. No production changes are authorized by this task.

ATD-101 remains gated. Architecture/navigation review completion does not establish provider licenses, entitlement decisions, ATD-004 contract acceptance or security readiness.

## Verification

Seven offline Python regression tests pass; expanded repository scan passes; the changed JavaScript parses with Node. No provider requests, database writes or credential validation. Browser rendering and a secure database baseline are not verified. The task remains in progress while the DEV target and remaining remediation are unresolved.
