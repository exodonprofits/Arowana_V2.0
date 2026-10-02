# ATD-007 local development

Owner selected local Supabase on 2026-09-30. This is an empty development substrate, not a recovered production backend or completed security remediation.

## Tooling

Use official standalone Supabase CLI **2.118.0** and Docker Desktop with its Linux engine running. This session checksum-verified the Windows AMD64 ZIP against the official release checksums and extracted it to `$env:TEMP/arowana-supabase-2.118.0`. Temporary storage may be cleared; reinstall that pinned version from the official release if needed. No npm project or package manager was added.

From the repository root in PowerShell:

```powershell
$cli = Join-Path $env:TEMP 'arowana-supabase-2.118.0/supabase.exe'
$env:SUPABASE_TELEMETRY_DISABLED = '1'
# Create once; inspect the existing network before reusing it.
docker network create --driver bridge --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 arowana-atd007-local
& $cli start --network-id arowana-atd007-local
```

After startup, inspect published ports with `docker ps` and confirm loopback bindings. The network default alone is not proof of effective isolation. CLI status/start output can contain local credentials; do not commit or share raw output. Stop only this project's stack with `supabase stop` from this directory; do not use data-deleting flags.

## Boundaries

- Never link this checkout to a hosted project or run remote push/deploy commands for this task.
- No production credentials, application rows, provider calls or broker connections belong in this baseline.
- Legacy HTML still points at its original backend. Do not open it for local isolation testing until a separate explicit local-client configuration is implemented.
- API exposure requires explicit grants. RLS and ownership tests are still required for every future exposed private relation.
- No application schema or seed data is included. Recover reviewed versioned backend definitions before adding ownership migrations; do not infer production DDL from page names.
- Runtime cache/link files are ignored by the CLI-generated `.gitignore`.

References: [CLI setup](https://supabase.com/docs/guides/local-development/cli/getting-started), [pinned release](https://github.com/supabase/cli/releases/tag/v2.118.0), [work record](../docs/ATD-007_SECURITY_DEV_BASELINE.md).
