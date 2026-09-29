# Security

## Immediate credential action

The uploaded baseline contained a hard-coded OpenAI private API key and a hard-coded Twelve Data key in client-side source. Those literal credentials have been removed from this repository package. **Rotate/revoke the previously exposed credentials before reuse.**

## Client-side policy

Never place private credentials for OpenAI, Anthropic, Alpaca, FMP, Finnhub (when treated as private), Twelve Data, Alpha Vantage, Schwab, n8n protected endpoints, or Supabase service-role access into client HTML/JavaScript.

Supabase anon keys are designed to be public client configuration, but safety depends on correct Row Level Security and policies. Treat RLS as mandatory.

## Legacy risk

ATD-007 removes the remaining credential-like literal from `js/option-roll-analyzer.js` and disables that helper's direct quote request. It now asks for a manual price. This does not revoke the exposed value or remove it from Git history/deployed copies; the credential owner must revoke/rotate it through the provider. No replacement key belongs in this helper.

The baseline contains workflows that accept/store user provider keys in browser storage and synchronize them through Supabase. This is legacy architecture and must not be expanded. Phase 1 should replace it with server-side provider integrations.

## Broker policy

Schwab integration is read-only for the initial private beta. No automated order placement or autonomous execution is in scope.

## Environments

Use separate DEV / STAGING / PRODUCTION projects/credentials. AI coding agents should receive DEV-only access by default.

## Before every push

Run:

```bash
python scripts/check-secrets.py
```

The GitHub workflow runs the same check on pushes and pull requests.

The scanner now also checks contextual 32-hex provider assignments/query values, service-role JWT payloads and Supabase secret-key patterns, including `.env.example`. It reports locations and classifications, never matched values. Synthetic regression tests run in CI. This is a working-tree pattern check, not proof of complete credential cleanup: Git history, binary archives and runtime browser/cloud stores remain outside its scope. Public anon JWTs are not classified as private service-role credentials.
