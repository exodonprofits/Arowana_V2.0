# Instructions for Claude Code

Before making changes, read in order:

1. `PROJECT_STATUS.md`
2. `PROJECT_RULES.md`
3. `docs/ARCHITECTURE.md`
4. `TASKS.md`
5. Any task-specific contract/documentation

## Role

Claude Code is primarily responsible for frontend implementation, UI/UX consistency, responsive behavior, isolated feature work, refactors, tests, and cross-review of Codex PRs.

## Mandatory behavior

- Work only on the assigned task ID.
- Create/use `claude/<task-id>-<slug>`.
- Do not edit `main` directly.
- Do not change database schemas or backend API contracts unless the task explicitly owns that change.
- Do not refactor unrelated pages.
- Do not put provider secrets in browser code.
- Run relevant checks and report exactly what was verified.
- Update project status/task files when the task is complete.

When a frontend task depends on a backend contract, consume the documented contract rather than guessing fields.
