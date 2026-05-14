# Immediate Hardening

## Goal

Block the most impactful attacks (supply chain exfiltration, renderer RCE, local process WebSocket hijack) with minimal code changes. This is the P0/P1 triage phase.

## Architectural Analysis

The focus here is entirely on structural barricades that offer the highest return on investment. 
- Network egress filtering acts as a safety net: even if an attacker executes code, they cannot phone home.
- Electron's native security flags (nodeIntegration, contextIsolation, Fuses) provide the strongest boundary against renderer escalation.
- Disabling `npm install` scripts closes the most common avenue for supply chain attacks.
- Securing the WebSocket prevents trivial local hijacking.
These changes are foundational and should not require massive refactoring, though strict CSP and egress filters may temporarily break legitimate features if not carefully allowlisted.

## Dependencies

- None. This is the starting point.

## Risks

- Egress filtering might block legitimate telemetry, AI provider calls, or auto-updater checks if the allowlist is incomplete.
- Disabling npm scripts might break native module compilation (e.g., `better-sqlite3`, `electron`) requiring careful allowlisting.
- CSP might break inline styles or external fonts if not tested thoroughly.

## Epics

### Epic: Network & Configuration Lockdown

#### Tasks

- [ ] Implement Network Egress Allowlist (D6.1)
  - [ ] Intercept outbound requests via `session.defaultSession.webRequest.onBeforeRequest` in the main process.
  - [ ] Define the allowlist (localhost, api.openai.com, api.anthropic.com, update server, etc.).
- [ ] Verify Electron Security Configuration (D4.1, D4.5)
  - [ ] Explicitly set `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webSecurity: true`, and `enableRemoteModule: false`.
  - [ ] Add runtime assertion in `app.on('web-contents-created')` to verify preferences and quit on violation.
- [ ] Implement strict Content Security Policy (D4.4)
  - [ ] Inject CSP header: `default-src 'self'`, `script-src 'self'`, `connect-src 'self' ws://localhost:* wss://localhost:*`, etc.
  - [ ] Verify that inline scripts and `eval()` are successfully blocked.
- [ ] Restrict Navigation & Window Creation (D4.2)
  - [ ] Intercept `will-navigate` in the main process and block all external navigation.
  - [ ] Set `setWindowOpenHandler` to intercept window creation and use `shell.openExternal` for legitimate links.
- [ ] IPC Channel Lockdown (D7.1)
  - [ ] Limit IPC communication to a fixed `Set` of named channels using a Proxy on `ipcMain.handle`.
  - [ ] Reject and log any unknown IPC channels.

#### Acceptance Criteria
- Carbon boots correctly, all AI and SSH features work.
- Outbound requests to non-allowlisted domains are blocked at the Electron network layer.
- `eval()` and inline scripts are blocked by CSP.
- Clicking external links opens in the default OS browser, not within the Electron app.

#### Rollback Plan
- Revert CSP and webRequest interception commits. 
- Publish a hotfix if legitimate traffic is blocked in production.

#### Testing Requirements
- E2E tests verifying AI requests succeed.
- Automated tests confirming requests to dummy domains (e.g., `http://evil.com`) fail.

### Epic: Local & Supply Chain Quick Fixes

#### Tasks

- [ ] Enable Electron Fuses (D4.7)
  - [ ] Configure `@electron/fuses` in the build process.
  - [ ] Flip `RunAsNode`, `EnableNodeOptionsEnvironmentVariable`, and `EnableNodeCliInspectArguments` to `false`.
  - [ ] Flip `OnlyLoadAppFromAsar` to `true`.
- [ ] Disable untrusted npm install scripts (D2.3)
  - [ ] Set `ignore-scripts=true` in `.npmrc`.
  - [ ] Define `allow-scripts` (or `pnpm.onlyBuiltDependencies`) for `electron`, `better-sqlite3`, and other strictly required native modules.
- [ ] Implement WebSocket session tokens (D7.2)
  - [ ] Generate a cryptographically random 32-byte token in the main process at startup.
  - [ ] Require the token in the URL query parameters for all WebSocket connections.
- [ ] SSH Host Key Verification (D8.3)
  - [ ] Replace `hostVerifier: () => true` with proper `known_hosts` verification logic to prevent SSH MITM attacks.

#### Acceptance Criteria
- App cannot be run as a Node process (`ELECTRON_RUN_AS_NODE=1` fails).
- `pnpm install` succeeds without running extraneous scripts.
- SSH connections fail if host keys change unexpectedly.

#### Rollback Plan
- Revert Electron fuses configuration.
- Add an explicit user-override flag for SSH host key verification if users encounter issues.

#### Testing Requirements
- Manual testing of `ELECTRON_RUN_AS_NODE`.
- Try connecting to WebSocket via a separate script without the token; ensure connection is rejected.
