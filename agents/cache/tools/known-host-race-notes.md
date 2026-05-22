# Known-host TOCTOU (manual)

**Hypothesis:** Attacker tampering `secure-store.v1.json` `knownHosts` while user connects may race `readKnownHost` vs `trustKnownHost`.

## Steps

1. `pnpm dev:electron` — connect once to `127.0.0.1:22` and trust host.
2. Terminal A: `node agents/cache/pocs/exploit-19-known-host-store-tamper.js` (strip MAC mid-connect).
3. Terminal B: trigger reconnect from UI.
4. Observe: mismatch block vs silent trust vs error.

## Expected secure behavior

- MAC failure → treat as untrusted, block or prompt.
- No crash in `electron/ws-handler.cjs`.

Record in `agents/cache/reports/security-audit-report.md`.
