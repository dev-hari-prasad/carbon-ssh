# Defense in Depth

## Goal

Layer additional runtime protections and monitoring to minimize the attack window for secrets, deter advanced attackers, and provide forensic capabilities.

## Architectural Analysis

This phase tackles the "long tail" of security. While previous phases built walls, this phase limits what happens when an attacker gets inside. By aggressively managing secret lifecycle (clearing memory), pinning certificates, freezing prototypes, and locking memory pages, we dramatically increase the effort required for an exploit to succeed. These are advanced, high-friction security controls.

## Dependencies

- `02-credential-hardening.md` (Secrets must be in the keychain before lifecycle management makes sense).

## Risks

- Memory management in JavaScript is imprecise; manual zeroing of Buffers is error-prone.
- Certificate pinning will break if AI providers rotate their root CAs unexpectedly.
- Freezing prototypes may break third-party libraries that rely on prototype mutation.

## Epics

### Epic: Runtime & Memory Attack Mitigation

#### Tasks

- [ ] Secret Lifecycle Management (D10.1)
  - [ ] Ensure forms clear React state immediately on unmount or submit.
  - [ ] Convert critical secrets (passwords, private keys) to `Buffer` objects in the main process and implement `Buffer.fill(0)` after the SSH connection is established.
- [ ] Lock Memory Pages (D10.4)
  - [ ] Explore native implementations using `mlock()` on Linux/macOS to prevent secret-containing pages from being swapped to disk.
- [ ] Prevent Core Dumps (D3.5)
  - [ ] On Linux, use `prlimit` or equivalent to disable core dumps (`--core=0:0`) for the Carbon process.
- [ ] Freeze Prototypes (D5.1)
  - [ ] Call `Object.freeze` on standard built-in prototypes (`Object`, `Array`, `Function`, `String`, etc.) early in both main and renderer processes to prevent prototype pollution.
- [ ] Detect Debugger Attachment (D3.4)
  - [ ] Add checks (`process.debugPort !== 0` or `process.execArgv`) to detect attached debuggers. Quit if detected in production.

#### Acceptance Criteria
- App terminates if started with `--inspect` in production.
- Memory dumps taken after SSH connection do not contain the plaintext password.
- Core dumps are explicitly disabled on supported platforms.

#### Rollback Plan
- Revert prototype freezing if standard library modules fail to initialize.
- Disable `mlock` if it causes instability or permission errors.

#### Testing Requirements
- Use `lldb` or `gcore` to dump process memory and verify strings are absent.

### Epic: Network Integrity & Audit

#### Tasks

- [ ] Certificate Pinning for API Calls (D8.2)
  - [ ] Implement a custom `https.Agent` for AI API requests with hardcoded expected certificate fingerprints.
- [ ] DNS-over-HTTPS for Critical Lookups (D8.4)
  - [ ] Use `dns.promises.Resolver` configured with a DoH endpoint (e.g., Cloudflare/Google) for AI API and update checks.
- [ ] Monitor Anomalous Network Activity (D6.3)
  - [ ] Monkey-patch `net.Socket.prototype.connect` in the main process to log and alert on outbound connections to unexpected destinations.
- [ ] Binary Integrity Check on Startup (D3.7)
  - [ ] Calculate the SHA256 hashes of `main.cjs` and `preload.cjs` at build time. On startup, read the files, hash them, and compare.
- [ ] Credential Access Audit Log (D6.5)
  - [ ] Wrap keychain access functions to write to an encrypted local audit log (`access_time`, `connectionId`, `caller_stack`).
- [ ] Runtime Integrity Monitoring (D7.5)
  - [ ] Store references to critical globals at startup. Periodically check if they have been monkey-patched, and alert if modified.
- [ ] Implement Dangerous API Lint Rules (D5.5)
  - [ ] Add ESLint rules to permanently ban `eval()`, `new Function()`, `child_process.exec`, etc.

#### Acceptance Criteria
- Modifying `main.cjs` after installation causes the app to refuse to start.
- Linter strictly enforces API bans.
- Forensic log records all keychain accesses.
- Any attempt to use `net.Socket.connect` directly triggers an alert.

#### Rollback Plan
- Remove binary integrity checks if OS-level antivirus modifies files legitimately.

#### Testing Requirements
- Intercept traffic with a self-signed cert to ensure pinning rejects it.
- Monkey-patch `fetch` in the DevTools and ensure the runtime monitor catches it.
