# Setup Guide

## GitHub

Create a **private** repository named `arowana-trading-desk-2` (recommended) and upload the contents of this package. Do not upload the outer ZIP as the only file; GitHub should contain these files/folders at repository root.

Recommended branch protection for `main`:

- Require pull requests before merging
- Require status checks
- Block force pushes
- Keep direct writes to `main` disabled for AI workflows

## Local development

```bash
python -m http.server 8080
```

Open `http://localhost:8080/`.

## Credentials

1. Rotate any credentials that were previously embedded in the uploaded baseline.
2. Copy `.env.example` only for server-side/dev tooling; never publish `.env`.
3. Existing legacy pages may use Supabase anon config in browser code. Confirm RLS before connecting real user data.
4. Do not reinsert private API keys into HTML/JS to make a page work. Move the call behind an Edge Function or backend endpoint.

## ChatGPT / Codex

Give Codex one task ID at a time and require it to read `AGENTS.md`. Use branches like `codex/atd-001-repo-audit`.

## Claude Code

Require Claude to read `CLAUDE.md`. Use branches like `claude/atd-003-navigation-map`.

## Parallel work rule

Codex and Claude can work simultaneously when they own different files/contracts. Avoid concurrent edits to the same monolithic legacy HTML page. Cross-review each other's pull requests when practical.
