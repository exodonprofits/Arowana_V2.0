# Arowana Trading Desk 2.0 — Project Rules

## Source of truth

GitHub `main` is the only integration source of truth. Product decisions belong in version-controlled docs, not only in chat histories.

## Branch discipline

- Never work directly on `main`.
- Codex branches: `codex/<task-id>-<slug>`
- Claude branches: `claude/<task-id>-<slug>`
- Human/manual branches: `feature/<task-id>-<slug>`
- One active owner per task.
- Avoid parallel edits to the same large legacy HTML file.

## Product architecture

Arowana follows: **Data -> deterministic engines -> AI analysis -> risk -> strategy -> execution plan**.

LLMs are not sources of truth for prices, indicators, positions, options Greeks, POC, earnings estimates, financial statements, or risk calculations. Those facts must be produced by trusted providers or deterministic code with freshness metadata.

## User scope

Initial deployment is private beta (owner + small approved family/friend group). Build multi-user isolation now, but do not assume personal market-data subscriptions can be redistributed to every user.

## Security

- No private provider key in HTML, browser JavaScript, localStorage, source control, screenshots, or client logs.
- Use server-side secrets / Supabase Edge Functions for private credentials.
- Supabase client anon keys are not private secrets, but every exposed table must have correct RLS.
- Broker connections are read-only until explicitly redesigned and approved.
- Production credentials must never be given to AI coding agents by default.

## Development

- Preserve behavior unless the assigned task explicitly changes it.
- Prefer shared modules/services over additional copy-pasted implementations.
- New database changes require version-controlled migrations.
- Document API contracts before frontend/backend are developed independently.
- No demo/fabricated market data may silently appear as live data.
- Every data record used for trading decisions should carry source and freshness metadata when feasible.

## Definition of done

A task is not done until relevant checks pass, desktop/mobile behavior is verified when applicable, no new console errors are introduced, no secret is exposed, database/API changes are documented, and `PROJECT_STATUS.md` / `TASKS.md` are updated.
