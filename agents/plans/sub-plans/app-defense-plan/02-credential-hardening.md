# Credential Hardening

## Goal

Move all sensitive secrets (SSH passwords, private keys, passphrases, AI API keys) out of plaintext/weak storage and into OS-protected environments.

## Architectural Analysis

Currently, Carbon exposes high-value secrets to the renderer and stores them in localStorage, which is highly vulnerable to filesystem access, XSS, and memory dumps. The core architectural shift here is separating "metadata" from "secrets". The renderer only needs to know that a connection *has* a password, not the password itself. Furthermore, any remaining filesystem footprints must be strongly encrypted or permissions-restricted.

## Dependencies

- `01-immediate-hardening.md` (to ensure the renderer is already locked down).

## Risks

- User data loss during the migration from localStorage to the keychain.
- Platform-specific keychain issues (e.g., missing dbus on Linux headless environments).
- Breaking terminal command execution if `child_process.exec` refactoring is overly aggressive.

## Epics

### Epic: Secret Storage Migration & Encryption

#### Tasks

- [ ] Implement OS Keychain Adapter
  - [ ] Integrate a cross-platform keychain library (`keytar` or `electron-keytar`).
  - [ ] Create wrapper functions in the main process for get, set, and delete operations.
- [ ] Remove `base64` fallback for `safeStorage` (D3.2)
  - [ ] If `safeStorage.isEncryptionAvailable()` is false, throw an error or require manual credential entry per session.
  - [ ] Purge any existing base64-encoded secrets from local storage.
- [ ] Encrypt All Data at Rest (D6.4)
  - [ ] Implement SQLCipher or safeStorage-wrapped encryption for SQLite logs.
  - [ ] Ensure temp files are never used to write secrets.
- [ ] Execute Migration Strategy
  - [ ] On startup, read existing encrypted secrets from localStorage, move them securely to the system keychain, and delete from localStorage.
- [ ] Restrict File Permissions on App Data (D3.1)
  - [ ] Set `0o700` permissions on the `%APPDATA%` / `~/.config` directory at startup.

#### Acceptance Criteria
- No passwords, private keys, or passphrases remain in localStorage.
- Base64 encryption fallback is completely removed.
- SQLite logs on disk cannot be read without the runtime encryption key.

#### Rollback Plan
- Provide a recovery script to migrate keychain items back to encrypted localStorage if keychain proves unstable across platforms.

#### Testing Requirements
- Unit tests for keychain wrapper and SQLite encryption.

### Epic: Renderer Secret Minimization & Code Safety

#### Tasks

- [ ] Refactor Connection Type
  - [ ] Remove `password`, `privateKey`, and `passphrase` fields from the standard `Connection` type shared with the renderer.
- [ ] Relocate AI API Keys
  - [ ] Move storage and handling of AI keys strictly to the main process.
- [ ] Implement IPC Payload Validation (D5.3)
  - [ ] Use `zod` to create strict schemas for every IPC and WebSocket channel.
- [ ] Preload API Audit (D4.3)
  - [ ] Remove any dangerous or overly broad functions from `contextBridge.exposeInMainWorld`.
- [ ] Eliminate Shell Command Construction (D5.2)
  - [ ] Audit the codebase for `child_process.exec` and replace with programmatic SSH usage via `ssh2` or `execFile` without `shell: true`.
- [ ] Clipboard Protection (D3.6)
  - [ ] Wrap clipboard write operations to clear sensitive data after a 30-second timeout.

#### Acceptance Criteria
- React Developer Tools inspects show no secrets in component state.
- Malformed IPC payloads are rejected and logged.
- The `exec` function is completely removed from connection and execution logic.

#### Rollback Plan
- Revert the `Connection` type split if it causes massive architectural friction.

#### Testing Requirements
- Security test: Inject invalid JSON into IPC calls and ensure the app rejects the payload.
- Memory snapshot test: Ensure AI keys do not persist in renderer heap.
