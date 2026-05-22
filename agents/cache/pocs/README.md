# Security PoC Scripts

Authorized local red-team scripts for Carbon SSH. **Do not run against systems you do not own.**

**48+ scripts** covering HTTP, WebSocket, IPC, filesystem, browser console, and Electron.

## Prerequisites

- App running: `pnpm dev` (port 3000) and/or `pnpm dev:electron`
- Node.js 18+
- WebSocket PoCs: `pnpm add -D ws` if needed
- exploit-15: `pnpm exec tsx agents/cache/pocs/exploit-15-telemetry-sanitizer-bypass.js`

## Execution

```bash
node agents/cache/tools/run-poc-list.mjs   # print full runbook

pnpm dev
node agents/cache/pocs/exploit-28-loopback-http-surface-scan.js
node agents/cache/pocs/exploit-05-ai-ssrf-via-baseurl.js
```

**Browser console:** open DevTools on `http://127.0.0.1:3000`, paste payload from script output.

**Electron DevTools:** `pnpm dev:electron`, use scripts marked `electron` or `window.electron`.

## Index (01–52)

| # | Script | Type | Target |
|---|--------|------|--------|
| 01 | api-log-injection | HTTP | `/api/logs` |
| 02 | ws-credential-sniff | WS | Dev credentials in WS |
| 03 | fatal-error-xss | Doc | `renderFatalHtml` XSS |
| 04 | ipc-decryption-oracle | Doc | `decrypt-string` |
| 05 | ai-ssrf-via-baseurl | HTTP | AI custom URL SSRF |
| 06 | ai-internal-header-forgery | HTTP | `x-carbon-internal-ai` |
| 07 | ai-prompt-injection | HTTP | LLM prompt inject |
| 08 | ws-token-extract-dev | HTTP | `NEXT_PUBLIC_WS_TOKEN` |
| 09 | logs-api-and-sqlite-probe | HTTP+FS | Logs API + sqlite |
| 10 | vault-setup-poison-console | Browser | `ssh.vault-setup` |
| 11 | onboarding-unlock-bypass | Doc | `unlockApp` no grant |
| 12 | app-lock-grant-xss-chain | Doc | In-memory grant |
| 13 | secure-store-file-exfil | FS | `secure-store.v1.json` |
| 14 | applock-browser-hash-extract | FS/Browser | `apw1:` envelope |
| 15 | telemetry-sanitizer-bypass | tsx | PostHog scrubber |
| 16 | ws-arbitrary-connect-ssrf | WS | Dev SSH pivot |
| 17 | localhost-port-scan-via-ai | HTTP | AI timing scan |
| 18 | ipc-metadata-host-poison | Electron | Wrong-host SSH |
| 19 | known-host-store-tamper | FS | knownHosts MAC |
| 20 | dependency-audit-runner | Shell | `pnpm audit` |
| 21 | localstorage-credential-dump | Browser | `ssh.connections.v2` |
| 22 | clipboard-paste-shell-inject | Doc | Paste → shell |
| 23 | ws-input-injection | WS | Session `input` hijack |
| 24 | factory-reset-secure-store-remnants | FS | Reset leaves vault file |
| 25 | ipc-biometric-no-sender-check | Doc | Touch ID / decrypt IPC |
| 26 | ipc-zoom-unbounded-factor | Electron | Zoom DoS |
| 27 | proxy-header-smuggle | HTTP | Entry proxy headers |
| 28 | loopback-http-surface-scan | HTTP | Path enumeration |
| 29 | spawn-env-inheritance | Doc | Child `process.env` |
| 30 | applock-verify-brute-hint | Electron | IPC password brute |
| 31 | bang-multiline-shell-inject | Browser | `!bang` newlines |
| 32 | tm-terminal-input-hijack | Browser | Event bus → SSH |
| 33 | ai-autocomplete-extra-fields-exfil | HTTP | Schema bypass fields |
| 34 | posthog-public-env-extract | HTTP | Telemetry keys in bundle |
| 35 | production-sqlite-cwd-exfil | FS | `cwd/database.sqlite` |
| 36 | renderer-prototype-pollution-dev | Browser | Dev no freeze |
| 37 | renderer-global-tamper-undetected | Browser | fetch hook undetected |
| 38 | dev-renderer-raw-apikey-post | HTTP | Dev apiKey in body |
| 39 | webauthn-no-crypto-verify | Doc | Passkey not verified |
| 40 | factory-reset-prefix-gaps | Browser | Incomplete LS wipe |
| 41 | theme-id-bootstrap-poison | Browser | Theme bootstrap |
| 42 | ws-token-session-fixation | WS | Long-lived token |
| 43 | preload-ai-baseurl-dropped | Doc | Preload 2 vs 3 args |
| 44 | custom-event-bus-fuzz | Browser | All `tm:*` events |
| 45 | ssh-prod-metadata-internal-pivot | Doc | Prod SSH SSRF chain |
| 46 | next-public-env-harvest | HTTP | All public env symbols |
| 47 | trust-known-host-port-confusion | Electron | Port trust confusion |
| 48 | ai-suggestion-to-shell-chain | Browser | AI → terminal RCE |
| 49 | localhost-navigation-phishing | Electron | `will-navigate` any port |
| 50 | telemetry-markdown-link-inject | FS/UI | MD `javascript:` links |
| 51 | csp-unsafe-inline-audit | Static | next.config CSP |
| 52 | renderer-localhost-egress-any-port | Electron | webRequest localhost |

## Priority chains

1. **Critical:** 03 → 04 → 21 (XSS decrypt exfil)
2. **Dev network:** 08 → 02 / 16 / 23
3. **Shell RCE on SSH:** 32 / 31 / 48 (same-origin or bang)
4. **Prod Electron:** 18 → 45 + 42
5. **Reset lies:** 24 + 40

Report: `agents/cache/reports/security-audit-report.md`

## Advanced tools (fuzz / audit / supply chain)

See `agents/cache/tools/README.md`:

- WS + IPC fuzzers, ssh2 probes, static secret scan
- Electron hardening + supply chain audit
- App-lock concurrency tests, packaged prod checklist
- `node agents/cache/tools/run-advanced-audit.mjs`
