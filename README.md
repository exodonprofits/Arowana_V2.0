# Arowana Trading Desk 2.0

Private-beta AI trading research and decision-support platform for a small group of approved users.

## Repository status

This repository is based on the broad **pre-Wheel-focused Arowana Profits** codebase. Existing pages are intentionally preserved during Phase 0 so internal links and working tools are not broken before the formal audit. The newer Wheel-focused repository should be treated as a **module source**, not as the core architecture.

## Product direction

Arowana 2.0 is not an AI stock picker or automated broker. It is a decision-support desk built around:

- Market regime and macro intelligence
- News and catalyst analysis
- Fundamental, earnings-revision, and valuation research
- Technical setup and 5-day / 20-day swing POC
- Portfolio and risk intelligence
- Strategy routing (Swing, Wheel, Growth/AI, Options, Long-Term)
- Trade journal and personal performance feedback

Target workflow:

`Arowana -> optional TradingView confirmation -> broker execution`

## AI development roles

- **ChatGPT / Work**: product architecture, research, cross-system review, implementation planning
- **Codex**: backend, Supabase, APIs, integrations, tests, complex repository changes
- **Claude Code**: frontend/UI, refactors, isolated features, tests, cross-review
- **GitHub**: source of truth

Both coding agents work through separate branches and pull requests. Neither edits `main` directly. See `PROJECT_RULES.md`, `AGENTS.md`, and `CLAUDE.md`.

## Start here

1. Read `PROJECT_STATUS.md`.
2. Read `PROJECT_RULES.md`.
3. Review `docs/ARCHITECTURE.md`.
4. Review `SECURITY.md` before connecting any API.
5. Work only from an assigned task in `TASKS.md`.

## Local preview

This is currently a mostly static HTML/JS application. From the repository root:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080/`.

Some pages require Supabase or market-data configuration and will not be fully functional until provider configuration is supplied.

## Security status

Known hard-coded private API credentials from the uploaded baseline were removed from this package. **Rotate the previously exposed OpenAI and Twelve Data credentials before reusing those accounts.** Supabase anon configuration remains part of the legacy client architecture; access must be protected with Row Level Security. Private provider keys must be migrated behind server-side functions.

## Phase 0 policy

Do not broadly rename, move, or delete legacy pages yet. The repository contains overlapping generations of tools. First classify each feature as **KEEP / MODIFY / MERGE / PORT / ARCHIVE / DELETE / SECURITY FIX**.
