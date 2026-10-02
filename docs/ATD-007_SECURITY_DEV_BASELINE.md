# ATD-007 â€” Security remediation and DEV baseline

Status: in progress. Authorized 2026-09-29 after architecture/navigation review completion. Branch: `codex/ATD-007-security-dev-baseline`.

## First implemented slice

ATD-002 CK-01: removed the credential-like provider literal and the direct Twelve Data quote request from the orphan option-roll helper. Manual price entry remains; the placeholder explicitly says it is not a live quote. The existing analysis webhook flow is unchanged and is not certified safe or functional by this fix.

ATD-002 CK-12: expanded the existing offline scanner for contextual hex-key assignments/query literals, privileged JWT roles and Supabase secret keys. `.env.example` is scanned rather than exempted. Findings contain location/classification only. Added seven synthetic regression tests and CI execution. No private value is copied into a fixture or report.

Removal does not revoke the credential, clean reachable history or change deployed files. Owner/provider revocation and deployed-copy containment remain open; no credential was used or validated.

## DEV dependency and remaining scope

The owner selected local Supabase on 2026-09-30. Docker Desktop 28.0.4 and WSL2 are available. The official standalone Supabase CLI 2.118.0 was downloaded to temporary tool storage and verified against its release SHA-256 checksum; no package manager was introduced. Local initialization is recorded in `supabase/config.toml` with project identity `arowana-atd007-local`, explicit Data API grants required, and no seed imports. Do not use the repository-matched production project as a substitute. Runtime verification is recorded below. See [local setup](../supabase/README.md).

After DEV selection, verify isolation, establish versioned backend definitions/migrations and synthetic fixtures, then test positive/negative two-user ownership cases before claiming a secure baseline. Existing backend implementations are not in this repository; do not invent production schema from similar table names or copy production records/secrets into fixtures.

Outstanding security work includes browser key hydration/alternate stores and credential-bearing workflow forwarding (ATD-002), watchlist parent/item ownership and account/entity invariants (ATD-005), and exposed-field/grant reviews. Each needs tested migration/compatibility behavior in DEV; current scanner success does not close these findings. No production changes are authorized by this task.

ATD-101 remains gated. Architecture/navigation review completion does not establish provider licenses, entitlement decisions, ATD-004 contract acceptance or security readiness.

## Verification

Seven offline Python regression tests pass; expanded repository scan passes; the changed JavaScript parses with Node. No provider requests, database writes or credential validation. Browser rendering and a secure database baseline are not verified. The task remains in progress while the DEV target and remaining remediation are unresolved.

## Local runtime verification - 2026-09-30

- CLI start completed successfully. Docker Linux engine 28.0.4 runs under WSL2.
- All published container ports bind to 127.0.0.1 on the dedicated `arowana-atd007-local` network: API 54321, database 54322, Studio 54323, local mail 54324. All containers with health checks reported healthy; REST and Edge runtime reported running.
- Auth health and Studio returned HTTP 200. Local SQL reported zero public base tables and zero Auth users. No production data or schema was imported, and no hosted project link exists.
- CLI-selected database image `17.6.1.171` reports PostgreSQL 17.6. The [current upstream advisory](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) identifies security fixes in 17.11. Resolve the supported local image upgrade before calling this a secure baseline or introducing private data. No unsupported image override was guessed.
- TOML parsing, local identity/no-link/explicit-grant assertions, all seven scanner regression tests, repository secret scan and Git whitespace checks passed.

The runtime remains running for local development. No application schema, migration, two-user RLS tests or browser credential remediation was completed in this setup slice. Next: resolve the database image security baseline, recover reviewed schema definitions without production records/secrets, then implement and test scoped ownership fixes. ATD-007 remains in progress; ATD-101 remains gated.

Final scan clarification: after startup, the full working-directory scanner reports two credential patterns in the CLI-generated, Git-ignored `supabase/.temp/start-secrets/` runtime environment file. Values were not printed. The separate scan of all Git-tracked and non-ignored candidate source files passed. Scanner behavior was not weakened or changed. Earlier scan passes occurred before runtime credential generation.

## Runtime credential containment - 2026-10-01

Continuation found generated local Supabase runtime files tracked in merged baseline `dcf83ea`, including `.temp/start-secrets/.../docker.env`. This supersedes the earlier statement that runtime credentials were only ignored local files. No values were reproduced in this report.

Removed three generated paths from the Git index and added `scripts/check_runtime_tracking.py` to CI. The guard rejects any indexed file under `supabase/.temp/` or `supabase/.branches/`, even if force-added or its content does not match a secret pattern. Two synthetic tests cover rejection and allowed source paths.

Stopped only `arowana-atd007-local` using the CLI's project-specific stop with backups enabled. Data volumes were preserved; production was not contacted or changed. Local Studio is intentionally unavailable until containment is resolved. No history rewrite or credential rotation was performed. Previously committed values remain in reachable history and must not be considered confidential or reused.

Verification: nine offline tests passed; runtime tracking guard and full working-directory secret scan passed after shutdown; Git whitespace checks passed. The runtime removals are staged, while code/documentation updates remain uncommitted. No schema/RLS runtime tests were run. PostgreSQL upgrade and schema recovery were deferred to address this newly discovered prerequisite.

Remaining work: verify safe local credential regeneration/rotation before restart, decide repository-history containment with the owner, resolve the PostgreSQL security-version baseline, and recover reviewed schema definitions for synthetic ownership tests. ATD-007 remains in progress; ATD-101 remains gated.
