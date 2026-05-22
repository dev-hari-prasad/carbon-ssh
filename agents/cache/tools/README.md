# Advanced Security Audit Tools

Companion to `agents/cache/pocs/` (52 exploit scripts). These tools **fuzz**, **scan**, and **audit** at a deeper level.

## Quick start

```bash
# Offline (no running app)
node agents/cache/tools/run-advanced-audit.mjs

# With dev server + WS token
pnpm dev
# extract token: node agents/cache/pocs/exploit-08-ws-token-extract-dev.js
set WS_TOKEN=<token>
set RUN_LIVE_FUZZ=1
node agents/cache/tools/run-advanced-audit.mjs
```

## Tools

| Tool | Purpose |
|------|---------|
| `run-advanced-audit.mjs` | Orchestrates all automated steps |
| `fuzz-ws-messages.cjs` | Malformed WS JSON / types / oversized payloads |
| `fuzz-ipc-renderer.js` | Print DevTools driver for IPC arg fuzzing |
| `ssh2-security-probe.cjs` | Timeouts, log injection host, weak algorithms |
| `static-secret-scan.mjs` | Repo grep for keys, .env, patterns |
| `electron-hardening-audit.mjs` | contextIsolation, sandbox, fuses, asar |
| `supply-chain-audit.mjs` | pnpm audit, SBOM, verify-deps, checksums |
| `applock-concurrency.test.ts` | Vitest race on grant/consume |
| `known-host-race-notes.md` | Manual TOCTOU procedure |
| `prod-packaged-audit.mjs` | Post `build:electron` checklist |

## Reports

Output under `agents/cache/reports/`:

- `supply-chain-audit.json`
- `security-audit-report.md` (fill after runs)

## Packaged prod workflow

```bash
pnpm build:electron
node agents/cache/tools/prod-packaged-audit.mjs
node agents/cache/pocs/exploit-24-factory-reset-secure-store-remnants.js
```
