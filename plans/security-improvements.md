# Security Improvements Plan — Carbon SSH

## Overview

This document identifies all security weaknesses found throughout the Carbon SSH codebase and proposes concrete fixes for each. Each finding is rated by severity and includes the affected files, the vulnerability, and a fix plan.

---

## Finding 1: Plaintext passwords and private keys stored in localStorage

**Severity:** Critical
**Files:** `src/lib/storage.ts`, `src/lib/types.ts`

### Description

The `savePasswordAccess` function stores the app unlock password directly in `localStorage` as plain text:

```60:64:src/lib/storage.ts
export function savePasswordAccess(password: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TEMP_PASSWORD_KEY, password);
  saveAccessSettings({ appLockEnabled: true, method: "password" });
}
```

Similarly, the `saveConnectionsAsync` function stores connections (which include passwords, private keys, passphrases) in localStorage. While it tries to use Electron's `safeStorage`, the JSON payload includes all secrets:

```113:125:src/lib/storage.ts
export async function saveConnectionsAsync(list: Connection[]) {
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.stringify(list.map((connection) => normalizeConnectionCredentials(connection)));
    let encrypted = raw;
    if (window.electron?.encryptString) {
      encrypted = await window.electron.encryptString(raw);
    }
    window.localStorage.setItem(KEY, encrypted);
  } catch (e) {
    console.error("Failed to save/encrypt connections", e);
  }
}
```

The `Connection` type itself carries secrets as optional strings:

```11:38:src/lib/types.ts
export interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  // ...
}
```

AI settings with API keys are also stored as plain JSON in localStorage:

```275:278:src/lib/storage.ts
export function saveAISettings(s: AISettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AI_KEY, JSON.stringify(s));
}
```

### Fix Plan

1. **Remove secrets from the `Connection` type.** Create a new `ConnectionSecrets` interface that is stored separately from connection metadata (host, port, username, etc.).
2. **Use the system keychain for all secrets.** Implement a macOS Keychain / Windows Credential Manager / Linux libsecret adapter using `keytar` (or Electron's `safeStorage` if keytar is not feasible). The `CredentialStorageAdapter` interface already exists in `src/lib/credentials.ts` — implement the `"os-secure-storage"` variant.
3. **For the app lock password:** Instead of storing it in localStorage at all, hash it (using `crypto.subtle` with PBKDF2 or argon2) and only store the hash for verification.
4. **For AI API keys:** Store them in the same system keychain, not in localStorage plaintext.

---

## Finding 2: Encryption fallback to base64 — encoding, not encryption

**Severity:** Critical
**Files:** `electron/main.cjs`

### Description

The `encrypt-string` and `decrypt-string` IPC handlers fall back to plain base64 encoding when `safeStorage.isEncryptionAvailable()` returns false. Base64 is encoding, not encryption — it provides zero security:

```35:57:electron/main.cjs
ipcMain.handle("encrypt-string", (event, text) => {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(text).toString("base64");
  }
  // Fallback to base64 if not available
  return Buffer.from(text, "utf8").toString("base64");
});

ipcMain.handle("decrypt-string", (event, encryptedBase64) => {
  if (!encryptedBase64) return "";

  if (safeStorage.isEncryptionAvailable()) {
    try {
      const buffer = Buffer.from(encryptedBase64, "base64");
      return safeStorage.decryptString(buffer);
    } catch (e) {
      console.error("Decryption failed:", e);
      return "";
    }
  }
  // Fallback to base64 if encryption wasn't available
  return Buffer.from(encryptedBase64, "base64").toString("utf8");
});
```

### Fix Plan

1. **Remove the base64 fallback entirely.** If `safeStorage.isEncryptionAvailable()` is false, refuse to store encrypted data — throw an error or return null, and show the user a warning that secure storage is unavailable on their system.
2. **On the client side** (`src/lib/storage.ts` lines 94-96, 118-120), if `window.electron?.decryptString` or `encryptString` are unavailable, fall back to **not persisting secrets at all** rather than storing them unencrypted. Show a warning and require the user to re-enter credentials each session.

---

## Finding 3: AI API keys sent in plaintext over HTTP requests

**Severity:** Critical
**Files:** `src/features/terminal/AIBangPalette.tsx`

### Description

The AI autocomplete feature sends the full `apiKey` in plaintext as part of the HTTP request body to `/api/ai/autocomplete`:

```82:99:src/features/terminal/AIBangPalette.tsx
        const res = await fetch("/api/ai/autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: cleanQuery,
            settings: {
              provider: ai.provider,
              apiKey: ai.apiKey,
              baseUrl: ai.baseUrl,
              autocompleteModel: ai.autocompleteModel,
            },
            context: {
              username: conn.username,
              history: history,
              terminalOutput: terminalOutput,
            },
          }),
          signal: controller.signal,
        });
```

While this is going to a localhost Next.js server, the API key is visible in browser DevTools Network tab, could be intercepted by malicious browser extensions, and travels unencrypted through the local proxy chain.

### Fix Plan

1. **Never pass the API key from the renderer process to the Next.js server.** The API key should be managed entirely on the server side.
2. **Store API keys server-side** — either in the keychain (readable by the Electron main process) or in an encrypted server-side config.
3. **The renderer sends a session-scoped reference** (not the raw key) to the server, which looks up the key from secure storage.
4. Alternatively, move all AI SDK calls to the Electron main process via IPC, so API keys never enter the renderer process at all.

---

## Finding 4: SSH credentials pass through WebSocket in plaintext

**Severity:** Critical
**Files:** `src/features/terminal/TerminalView.tsx`, `electron/ws-handler.cjs`

### Description

The SSH auth payload (password, privateKey, passphrase) is sent through the WebSocket as a plain JSON message. While the WebSocket connects to `localhost` in the Electron app, the credentials are accessible to any process that can intercept the local WebSocket traffic, and they sit in the WebSocket frame buffers in memory:

```270:279:src/features/terminal/TerminalView.tsx
        send({
          type: "connect",
          data: {
            host: connectionSnapshot.host,
            port: connectionSnapshot.port,
            ...authPayload,
            cols: term.cols,
            rows: term.rows,
          },
        });
```

The `authPayload` is built from `connectionSnapshot` which includes the raw password, privateKey, and passphrase:

```109:133:src/features/terminal/TerminalView.tsx
  const connectionSnapshot = useMemo(
    () => ({
      id: conn.id,
      name: conn.name,
      host: conn.host,
      port: conn.port,
      username: conn.username,
      authType: conn.authType,
      password: conn.password,
      privateKey: conn.privateKey,
      passphrase: conn.passphrase,
    }),
    [
      conn.id,
      conn.name,
      conn.host,
      conn.port,
      conn.username,
      conn.authType,
      conn.password,
      conn.privateKey,
      conn.passphrase,
    ],
  );
```

### Fix Plan

1. **Do not pass credentials through the WebSocket.** Instead, have the Electron main process look up the credentials from the system keychain when the SSH connection is requested.
2. **The WebSocket `connect` message should only contain a connection ID reference**, not the secrets themselves. The ws-handler then resolves credentials from secure storage using that ID.
3. **Clear the `connectionSnapshot` secrets from memory** immediately after the WebSocket sends the connect message, by zeroing out the password/key fields in the useMemo or using a one-time read pattern.

---

## Finding 5: Sensitive data in application logs

**Severity:** High
**Files:** `src/features/terminal/TerminalView.tsx`, `electron/ws-handler.cjs`, `src/lib/store.ts`

### Description

Connection information (hostname, username) is logged to the application log system:

```214:218:src/features/terminal/TerminalView.tsx
      actions.log(
        "info",
        connectionSnapshot.name,
        `Connecting to ${connectionSnapshot.username}@${connectionSnapshot.host}`,
      );
```

SSH error messages are logged raw, which could leak hostnames or authentication details:

```328:329:src/features/terminal/TerminalView.tsx
            terminalErrorMessage = message.message;
            trackSSHConnectFailure(classifySshFailureForTelemetry(message.message));
            actions.log("error", connectionSnapshot.name, message.message);
```

In the WebSocket handler, full error stack traces are logged:

```157:158:electron/ws-handler.cjs
      sshClient.on("error", (err) => {
        console.error("[ws-handler] SSH client error full trace:\n", err.stack || err);
```

These logs are persisted to SQLite (`src/lib/db.ts`) and could be a treasure trove of sensitive information if the database file is exfiltrated.

### Fix Plan

1. **Sanitize all log messages before persistence.** Apply the existing `scrubFreeformString` from `src/lib/telemetry-sanitize.ts` to all log messages that go to the SQLite database.
2. **Never log full error stacks** in production builds. Log only classified error types (like `classifySshFailureForTelemetry` already does for telemetry).
3. **Consider encrypting the SQLite log database** at rest, or at minimum ensuring the database file permissions are 0600.
4. **Strip hostnames/usernames from log messages.** Log connection attempts as generic events — e.g., "Connecting to session X" instead of "Connecting to user@host".
5. **Do not log SSH error messages verbatim.** Use the already-existing error classification and only log the bucket name.

---

## Finding 6: SSH host key verification disabled — MITM risk

**Severity:** High
**Files:** `src/lib/ssh.ts`, `electron/ws-handler.cjs`

### Description

Both SSH connection implementations accept ANY host key without verification:

```180:180:src/lib/ssh.ts
      hostVerifier: () => true,
```

```176:176:electron/ws-handler.cjs
        hostVerifier: () => true,
```

This means a man-in-the-middle attacker can intercept SSH connections and present their own key without the user ever being warned. This is a fundamental SSH security control that is completely bypassed.

### Fix Plan

1. **Implement known_hosts management.** On first connection to a host, save the host key and show it to the user for approval (similar to how OpenSSH prompts on first connect).
2. **Store known host keys** in a dedicated store (encrypted, ideally in the keychain or a secure file with 0600 permissions).
3. **On subsequent connections, verify the host key** against the stored known_hosts entry. If it doesn't match, show a security warning and block the connection unless the user explicitly accepts the change.
4. **The `hostVerifier` should be a proper callback** that checks the stored hash:
   ```js
   hostVerifier: (key) => knownHosts.verify(host, port, key),
   ```

---

## Finding 7: No system keychain integration

**Severity:** High
**Files:** `src/lib/credentials.ts`, `src/lib/storage.ts`

### Description

The code defines a `CredentialStorageAdapter` interface that explicitly supports `"os-secure-storage"` but only implements the `"local-development"` variant:

```12:17:src/lib/credentials.ts
export interface CredentialStorageAdapter {
  kind: "local-development" | "os-secure-storage";
  loadConnectionSecrets(connection: Connection): Promise<ConnectionSecrets>;
  saveConnectionSecrets(connectionId: string, secrets: ConnectionSecrets): Promise<void>;
  deleteConnectionSecrets(connectionId: string): Promise<void>;
}
```

```19:31:src/lib/credentials.ts
export const localCredentialStorage: CredentialStorageAdapter = {
  kind: "local-development",
  async loadConnectionSecrets(connection) {
    return pickConnectionSecrets(connection);
  },
  async saveConnectionSecrets() {
    // Credentials are currently persisted with the connection payload.
    // Keep this adapter boundary so a keytar-backed implementation can replace it cleanly.
  },
  async deleteConnectionSecrets() {
    // No-op for the development local-storage adapter.
  },
};
```

The `"os-secure-storage"` variant is never implemented. The comment on line 26 even acknowledges: "Keep this adapter boundary so a keytar-backed implementation can replace it cleanly."

### Fix Plan

1. **Implement the `os-secure-storage` adapter** using:
   - **macOS:** Keychain via `security` CLI or native addon (`keytar`)
   - **Windows:** Credential Manager via `credential-manager` npm package or `cmdkey` CLI
   - **Linux:** libsecret via `keytar` (which uses gnome-keyring/kwallet)
2. **Use Electron IPC** to bridge the renderer process (which needs credentials) to the main process (which has access to the system keychain).
3. **Default to the OS secure storage adapter** in production Electron builds, and only use local-development for browser dev mode.
4. **Remove secrets from the `Connection` type** — they should live exclusively in the keychain, keyed by `connectionId`.

---

## Finding 8: Secrets persist in memory for the lifetime of the app

**Severity:** Medium
**Files:** `src/features/terminal/TerminalView.tsx`, `src/lib/store.ts`

### Description

The global `state` object holds all connections with their secrets in memory indefinitely:

```94:119:src/lib/store.ts
let state: State = {
  connections: [],
  connectionStatus: {},
  groups: [],
  tabs: [],
  activeTabId: null,
  logs: [],
  bottomOpen: false,
  // ...
};
```

The `connectionSnapshot` in `TerminalView.tsx` holds the raw password, privateKey, and passphrase in a `useMemo` for the entire lifetime of the terminal component:

```109:133:src/features/terminal/TerminalView.tsx
  const connectionSnapshot = useMemo(
    () => ({
      id: conn.id,
      name: conn.name,
      host: conn.host,
      port: conn.port,
      username: conn.username,
      authType: conn.authType,
      password: conn.password,
      privateKey: conn.privateKey,
      passphrase: conn.passphrase,
    }),
    // ...
  );
```

This means passwords and private keys stay in JavaScript heap memory as long as the app is running. They could be extracted from a memory dump or by a compromised renderer process.

### Fix Plan

1. **Remove secrets from the global state.** The `Connection` type (in `state.connections`) should not carry `password`, `privateKey`, or `passphrase`. These should live exclusively in the keychain and be fetched only when needed.
2. **One-time credential read pattern.** When establishing an SSH connection, fetch the credentials from the keychain, use them immediately, and then let them be garbage collected (or explicitly zero them out if using Buffers).
3. **After the WebSocket `connect` message is sent**, clear the `connectionSnapshot` secrets by overwriting the password/key fields with empty strings.
4. **Consider using `Buffer.alloc` instead of strings** for secrets so you can call `.fill(0)` to zero them out after use.

---

## Finding 9: React state holds plaintext credentials visible in DevTools

**Severity:** Medium
**Files:** `src/features/connections/ConnectionForm.tsx`

### Description

The connection form stores passwords, private keys, and passphrases in React state as plain strings:

```27:29:src/features/connections/ConnectionForm.tsx
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
```

These values are visible to:
- React DevTools
- Any browser extension with DOM access
- Anyone who inspects the component state

### Fix Plan

1. **Clear form state when the modal closes.** The `useEffect` on line 32 already loads values from `initial`, but when closing, the state should be explicitly cleared (set all fields to `""`).
2. **Never pre-populate password fields from stored state** in edit mode unless the user has recently authenticated. Show a "Change password" button that reveals the field only on explicit user action.
3. **For the private key textarea:** consider using a secure text editor component that doesn't keep the key in the DOM tree.

---

## Finding 10: Electron safeStorage and biometrics only work on macOS

**Severity:** Medium
**Files:** `electron/main.cjs`

### Description

Biometric unlock is hardcoded to only work on macOS:

```18:33:electron/main.cjs
ipcMain.handle("biometric-unlock", async (event, reason) => {
  if (process.platform === "darwin") {
    const canPrompt = systemPreferences.canPromptTouchID();
    if (canPrompt) {
      try {
        await systemPreferences.promptTouchID(reason);
        return true;
      } catch (e) {
        return false;
      }
    }
    return false;
  }
  return false;
});
```

Windows users have no biometric unlock path, even though Windows Hello is available.

### Fix Plan

1. **Add Windows Hello support.** Electron's `systemPreferences` doesn't directly support Windows Hello, but you can invoke it via a native addon or by shelling out to the Windows Biometric Framework API.
2. **For Linux:** explore PAM-based biometric authentication if available.
3. **As a minimum cross-platform fallback:** Keep the existing WebAuthn passkey flow, which works on all platforms with platform authenticators.

---

## Finding 11: WebSocket connection has no origin or authentication check

**Severity:** Medium
**Files:** `electron/main.cjs`, `electron/ws-handler.cjs`

### Description

The WebSocket upgrade handler only checks the pathname but does no origin verification or authentication:

```312:319:electron/main.cjs
            srv.on("upgrade", (req, socket, head) => {
              const { pathname } = parse(req.url || "", true);
              if (pathname === "/api/ws") {
                wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
              } else {
                socket.destroy();
              }
            });
```

While the server binds to `127.0.0.1`, a malicious local process could connect to the WebSocket and send `connect` messages with arbitrary SSH targets using any credentials it can guess or extract.

### Fix Plan

1. **Add an Origin header check** — only allow connections from the expected Electron renderer origin (`file://` or the localhost URL).
2. **Generate a random authentication token at app startup**, pass it to the renderer, and require it as a query parameter on WebSocket connections. Reject connections without a valid token.
3. **Rate-limit WebSocket connections** to prevent brute-force attempts.

---

## Finding 12: User commands logged — potential for sensitive command capture

**Severity:** Medium
**Files:** `src/features/terminal/TerminalView.tsx`

### Description

Every command typed in the terminal is parsed and logged, including commands that may contain sensitive arguments:

```541:550:src/features/terminal/TerminalView.tsx
        const cleanData = data.replace(/\x1b(?:\[[0-9;]*[a-zA-Z]|[O][a-zA-Z])/g, "");
        for (let i = 0; i < cleanData.length; i++) {
          const char = cleanData[i];
          if (char === "\r") {
            const cmd = commandBuffer.trim();
            if (cmd) {
              actions.log("info", connectionSnapshot.name, `$ ${cmd}`);
              actions.incrementCommandCount(tab.id);
              setHistory(prev => [cmd, ...prev].slice(0, 10));
            }
```

Commands like `export API_KEY=sk-...`, `mysql -u root -p'password'`, or `curl -H "Authorization: Bearer ..."` would all be logged in plaintext.

### Fix Plan

1. **Mark the command log as a "debug" log** that is off by default, separate from regular application logs.
2. **Add a setting** to disable command history logging entirely.
3. **Sanitize command arguments** by stripping common secret patterns (e.g., `-p'...'`, `Authorization: Bearer ...`, `export SECRET=...`) before logging. Use pattern matching similar to what `telemetry-sanitize.ts` already does.

---

## Finding 13: Vault lock status and passkey info in localStorage

**Severity:** Low
**Files:** `src/lib/storage.ts`, `src/lib/passkeys.ts`

### Description

The vault lock configuration is readable from localStorage by any process with access to the Electron user data directory:

```16:20:src/lib/storage.ts
const VAULT_SETUP_KEY = "ssh.vault-setup";
const TEMP_PASSWORD_KEY = "ssh.temp-pwd";
const PASSKEY_ID_KEY = "ssh.vault-passkey-id";
const PASSKEY_PROVIDER_KEY = "ssh.vault-passkey-provider";
```

An attacker who gains filesystem access can see:
- Whether the vault is enabled (`ssh.vault-setup`)
- What method is used (`password` vs `biometric`)
- The passkey credential ID

### Fix Plan

1. **Encrypt these metadata values** using Electron's `safeStorage` so they are not trivially readable.
2. **Store passkey credentials in the system keychain** instead of localStorage.

---

## Finding 14: SQLite logs database has no encryption at rest

**Severity:** Low
**Files:** `src/lib/db.ts`

### Description

The SQLite database used for logs is stored as a plain file:

```7:10:src/lib/db.ts
const dbPath =
  process.env.NODE_ENV === "production"
    ? path.join(process.cwd(), "database.sqlite")
    : path.join(os.tmpdir(), "terminal-muse-database.sqlite");
```

If log sanitization (Finding 5) fails, this file could contain sensitive data unencrypted on disk.

### Fix Plan

1. **Use SQLCipher or better-sqlite3 with SEE** for encrypted SQLite storage if available.
2. **Alternatively, set strict file permissions** (0600 on Unix, restricted ACL on Windows) on the database file at creation time.
3. **As part of Finding 5's fix**, ensure no raw secrets enter the database in the first place.

---

## Prioritized Implementation Order

| Priority | Finding | Effort | Impact |
|----------|---------|--------|--------|
| 1 | #6 — Enable SSH host key verification | Medium | Prevents MITM attacks |
| 2 | #2 — Remove base64 "encryption" fallback | Small | Closes data-at-rest gap |
| 3 | #1 — Remove secrets from localStorage, use keychain | Large | Eliminates biggest data leak |
| 4 | #7 — Implement OS secure storage adapter | Large | Foundation for #1, #3, #13 |
| 5 | #4 — Don't pass SSH creds through WebSocket | Medium | Reduces credential exposure |
| 6 | #3 — Don't send AI API keys from renderer | Medium | Prevents API key leak |
| 7 | #5 — Sanitize log messages | Medium | Reduces audit trail exposure |
| 8 | #8 — Clear secrets from memory after use | Small | Defense in depth |
| 9 | #12 — Sanitize/suppress command logging | Small | Prevents accidental secret logging |
| 10 | #11 — WebSocket authentication | Small | Locks down local IPC |
| 11 | #9 — Clear form state on close | Small | Reduces DevTools exposure |
| 12 | #10 — Windows/Linux biometric support | Large | Parity, not strictly required |
| 13 | #13 — Encrypt vault metadata | Small | Defense in depth |
| 14 | #14 — SQLite encryption at rest | Large | Defense in depth |

---

## Dependencies to Add

The following packages would be needed to implement these fixes:

- **`keytar`** — Cross-platform system keychain access (macOS Keychain, Windows Credential Manager, Linux libsecret)
- **`argon2`** or **`bcryptjs`** — For password hashing (vault unlock password)
- **`ssh2`** (already present) — Already used, but needs host key verification configured
- **`better-sqlite3`** (already present) — Already used for logs; consider SQLCipher variant
