# Instructions for Codex / OpenAI coding agents

Before making changes, read in order:

1. `PROJECT_STATUS.md`
2. `PROJECT_RULES.md`
3. `docs/ARCHITECTURE.md`
4. `TASKS.md`
5. Any task-specific contract/documentation

## Role

Codex is primarily responsible for backend/integration work: Supabase schema and migrations, ingestion services, deterministic engines, security fixes, APIs, tests, and cross-module debugging. Codex may implement frontend changes only when the assigned task requires them.

## Mandatory behavior

- Work only on the assigned task ID.
- Create/use `codex/<task-id>-<slug>`.
- Do not edit `main` directly.
- Do not refactor unrelated code opportunistically.
- Do not place private credentials in client code.
- Do not write directly to production services.
- Run relevant tests/checks and report exactly what was verified.
- Update project status/task files when the task is complete.

Large legacy HTML pages are migration targets, not invitations for repo-wide rewrites. Prefer incremental extraction behind stable contracts.
