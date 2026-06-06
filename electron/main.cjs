// --- SECURITY: Defense-in-depth must load FIRST (D5.1, D3.4) ---
require("./defense.cjs").installMain();
// --- END defense ---

const {
  app,
  BrowserWindow,
  shell,
  Menu,
  ipcMain,
  safeStorage,
  systemPreferences,
  session,
} = require("electron");

// Set identity early for taskbar/icon attribution
app.setName("Carbon");
if (process.platform === "win32") {
  app.setAppUserModelId("com.carbon.ssh");
}

const crypto = require("crypto");
const secureStore = require("./secure-store.cjs");

const HOP_BY_HOP_REQUEST_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

const BLOCKED_PROXY_REQUEST_HEADERS = new Set([
  "x-carbon-internal-ai",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-original-url",
  "x-rewrite-url",
  "x-real-ip",
]);

const MIN_UI_ZOOM_FACTOR = 0.75;
const MAX_UI_ZOOM_FACTOR = 1.35;
const MIN_VISUAL_ZOOM_LEVEL = 1;
const MAX_VISUAL_ZOOM_LEVEL = 3;
const APP_LOCK_VERIFY_WINDOW_MS = 10 * 60 * 1000;
const APP_LOCK_VERIFY_BASE_DELAY_MS = 250;
const APP_LOCK_VERIFY_MAX_DELAY_MS = 8000;

function ensureMainSender(event) {
  if (event.sender.id !== mainWindow?.webContents?.id) {
    throw new Error("Unauthorized sender");
  }
}

function internalApiHeaders(extraHeaders = {}) {
  return wsToken
    ? { "x-api-token": wsToken, ...extraHeaders }
    : { ...extraHeaders };
}

function sanitizeProxyRequestHeaders(rawHeaders) {
  const sanitized = {};
  for (const [name, value] of Object.entries(rawHeaders || {})) {
    const key = String(name).toLowerCase();
    if (HOP_BY_HOP_REQUEST_HEADERS.has(key)) continue;
    if (BLOCKED_PROXY_REQUEST_HEADERS.has(key)) continue;
    sanitized[key] = value;
  }
  return sanitized;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toSafePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return port;
}

function normalizeKnownHostFingerprint(raw) {
  return String(raw || "").trim().replace(/^SHA256:/i, "");
}

function allowedAppOrigins() {
  const ports = new Set([DEFAULT_PORT, appEntryPort].filter((p) => Number.isInteger(p) && p > 0));
  const origins = new Set();
  for (const port of ports) {
    origins.add(`http://localhost:${port}`);
    origins.add(`http://127.0.0.1:${port}`);
  }
  return origins;
}

function isAllowedAppNavigation(navigationUrl) {
  try {
    const parsed = new URL(navigationUrl);
    return allowedAppOrigins().has(parsed.origin);
  } catch {
    return false;
  }
}

async function postLocalJson(pathname, body, extraHeaders = {}) {
  const port = appEntryPort || DEFAULT_PORT;
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method: "POST",
    headers: internalApiHeaders({ "Content-Type": "application/json", ...extraHeaders }),
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || `HTTP ${response.status}` };
  }
  if (!response.ok) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }
  return data;
}

ipcMain.on("set-zoom-factor", (event, factor) => {
  ensureMainSender(event);
  const normalized = Number(factor);
  if (!Number.isFinite(normalized)) {
    return;
  }
  const webContents = event.sender;
  if (webContents) {
    webContents.setZoomFactor(clampNumber(normalized, MIN_UI_ZOOM_FACTOR, MAX_UI_ZOOM_FACTOR));
  }
});

ipcMain.on("set-visual-zoom-limits", (event, min, max) => {
  ensureMainSender(event);
  const minNumber = Number(min);
  const maxNumber = Number(max);
  if (!Number.isFinite(minNumber) || !Number.isFinite(maxNumber)) {
    return;
  }
  const safeMin = clampNumber(Math.min(minNumber, maxNumber), MIN_VISUAL_ZOOM_LEVEL, MAX_VISUAL_ZOOM_LEVEL);
  const safeMax = clampNumber(Math.max(minNumber, maxNumber), MIN_VISUAL_ZOOM_LEVEL, MAX_VISUAL_ZOOM_LEVEL);
  const webContents = event.sender;
  if (webContents) {
    webContents.setVisualZoomLevelLimits(safeMin, safeMax);
  }
});

ipcMain.on("set-title-bar-overlay", (event, overlay) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.setTitleBarOverlay(overlay);
  }
});

ipcMain.on("maximize-window", () => {
  if (mainWindow) {
    console.log("[main] maximize-window received");
    mainWindow.show();
    mainWindow.focus();
    mainWindow.maximize();
  }
});

ipcMain.on("pin-to-taskbar", () => {
  // Programmatic pinning is unreliable/restricted on modern OSes.
  // We keep this as a silent preference for now to avoid intrusive popups.
  console.log("[main] Pin to taskbar preference toggled.");
});

// Biometrics and Safe Storage IPC Handlers
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

ipcMain.handle("encrypt-string", (event, text) => {
  if (typeof text !== "string") {
    throw new Error("Invalid input: expected string");
  }
  if (text.length > 10 * 1024 * 1024) {
    throw new Error("Input too large");
  }
  ensureMainSender(event);

  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(text).toString("base64");
  }
  // Never fall back to base64 — refuse to persist secrets in plaintext
  throw new Error("Encryption not available: safeStorage is required for secret persistence");
});

const APP_LOCK_PASSWORD_MAX_CHARS = 1024;
let appLockVerifyState = {
  failures: 0,
  lastFailureAt: 0,
  blockedUntil: 0,
};

function resetAppLockVerifyState() {
  appLockVerifyState = { failures: 0, lastFailureAt: 0, blockedUntil: 0 };
}

function noteAppLockFailureAndGetDelayMs() {
  const now = Date.now();
  if (now - appLockVerifyState.lastFailureAt > APP_LOCK_VERIFY_WINDOW_MS) {
    appLockVerifyState.failures = 0;
  }
  appLockVerifyState.failures += 1;
  appLockVerifyState.lastFailureAt = now;
  const delay = Math.min(
    APP_LOCK_VERIFY_MAX_DELAY_MS,
    APP_LOCK_VERIFY_BASE_DELAY_MS * 2 ** Math.max(0, appLockVerifyState.failures - 1),
  );
  appLockVerifyState.blockedUntil = now + delay;
  return delay;
}

ipcMain.handle("set-app-lock-password", async (event, password) => {
  ensureMainSender(event);
  if (typeof password !== "string") {
    throw new Error("Invalid input: password must be a string");
  }
  if (password.length > APP_LOCK_PASSWORD_MAX_CHARS) {
    throw new Error("Password exceeds maximum allowed length");
  }
  await secureStore.saveAppLockHash(app, safeStorage, password);
  resetAppLockVerifyState();
  return true;
});

ipcMain.handle("verify-app-lock-password", async (event, candidate) => {
  ensureMainSender(event);
  if (typeof candidate !== "string") return false;
  if (candidate.length > APP_LOCK_PASSWORD_MAX_CHARS) return false;
  const now = Date.now();
  if (appLockVerifyState.blockedUntil > now) {
    await sleep(appLockVerifyState.blockedUntil - now);
    return false;
  }

  const ok = await secureStore.verifyAppLockPassword(app, safeStorage, candidate);
  if (ok) {
    resetAppLockVerifyState();
    return true;
  }

  const delayMs = noteAppLockFailureAndGetDelayMs();
  await sleep(delayMs);
  return false;
});

ipcMain.handle("factory-reset", async (event) => {
  ensureMainSender(event);
  secureStore.factoryReset(app);
  resetAppLockVerifyState();
  return true;
});

ipcMain.handle("clear-app-lock-password", async (event) => {
  ensureMainSender(event);
  await secureStore.clearAppLockHash(app);
  resetAppLockVerifyState();
  return true;
});

ipcMain.handle("save-recovery-metadata", async (event, metadata) => {
  ensureMainSender(event);
  if (!metadata || typeof metadata !== "object") {
    throw new Error("Invalid metadata payload");
  }
  await secureStore.saveRecoveryMetadata(app, metadata);
  return true;
});

ipcMain.handle("load-recovery-metadata", async (event) => {
  ensureMainSender(event);
  return secureStore.loadRecoveryMetadata(app);
});

ipcMain.handle("delete-recovery-metadata", async (event) => {
  ensureMainSender(event);
  await secureStore.deleteRecoveryMetadata(app);
  return true;
});

ipcMain.handle("decrypt-string", (event, encryptedBase64) => {
  if (!encryptedBase64) return "";
  if (typeof encryptedBase64 !== "string") {
    throw new Error("Invalid input: expected string");
  }
  if (encryptedBase64.length > 10 * 1024 * 1024) {
    throw new Error("Input too large");
  }

  if (safeStorage.isEncryptionAvailable()) {
    try {
      const buffer = Buffer.from(encryptedBase64, "base64");
      return safeStorage.decryptString(buffer);
    } catch (e) {
      console.error("Decryption failed:", e);
      return "";
    }
  }
  throw new Error("Encryption not available: safeStorage is required for secret decryption");
});

// Provide WS token to renderer for WebSocket auth (D7.2)
ipcMain.handle("get-ws-token", (event) => {
  ensureMainSender(event);
  return wsToken;
});

ipcMain.handle("save-connection-secret", async (event, connectionId, secrets) => {
  ensureMainSender(event);
  if (typeof connectionId !== "string" || !connectionId.trim()) {
    throw new Error("Invalid connectionId");
  }
  if (!secrets || typeof secrets !== "object") {
    throw new Error("Invalid secrets payload");
  }
  const payload = {
    authType: secrets.authType === "privateKey" ? "privateKey" : "password",
    password: typeof secrets.password === "string" ? secrets.password : undefined,
    privateKey: typeof secrets.privateKey === "string" ? secrets.privateKey : undefined,
    passphrase: typeof secrets.passphrase === "string" ? secrets.passphrase : undefined,
  };
  await secureStore.saveConnectionSecrets(app, safeStorage, connectionId, payload);
  return true;
});

ipcMain.handle("load-connection-secret", (event, connectionId) => {
  ensureMainSender(event);
  if (typeof connectionId !== "string" || !connectionId.trim()) {
    throw new Error("Invalid connectionId");
  }
  return secureStore.loadConnectionSecrets(app, safeStorage, connectionId);
});

ipcMain.handle("delete-connection-secret", async (event, connectionId) => {
  ensureMainSender(event);
  if (typeof connectionId !== "string" || !connectionId.trim()) {
    throw new Error("Invalid connectionId");
  }
  await secureStore.deleteConnectionSecrets(app, connectionId);
  return true;
});

ipcMain.handle("save-connection-metadata", async (event, connectionId, metadata) => {
  ensureMainSender(event);
  if (typeof connectionId !== "string" || !connectionId.trim()) {
    throw new Error("Invalid connectionId");
  }
  if (!metadata || typeof metadata !== "object") {
    throw new Error("Invalid metadata payload");
  }
  await secureStore.saveConnectionMetadata(app, connectionId, metadata);
  return true;
});

ipcMain.handle("delete-connection-metadata", async (event, connectionId) => {
  ensureMainSender(event);
  if (typeof connectionId !== "string" || !connectionId.trim()) {
    throw new Error("Invalid connectionId");
  }
  await secureStore.deleteConnectionMetadata(app, connectionId);
  return true;
});

ipcMain.handle("save-ai-api-key", async (event, provider, apiKey, baseUrl) => {
  ensureMainSender(event);
  if (typeof provider !== "string" || !provider.trim()) {
    throw new Error("Invalid provider");
  }
  if (typeof apiKey !== "string") {
    throw new Error("Invalid apiKey");
  }
  await secureStore.saveAiApiKey(app, safeStorage, provider, apiKey, baseUrl);
  return true;
});

ipcMain.handle("has-ai-api-key", (event, provider) => {
  ensureMainSender(event);
  if (typeof provider !== "string" || !provider.trim()) {
    throw new Error("Invalid provider");
  }
  return secureStore.hasAiApiKey(app, safeStorage, provider);
});

ipcMain.handle("trust-known-host", async (event, payload) => {
  ensureMainSender(event);
  const host = payload?.host;
  const safePort = toSafePort(payload?.port);
  const algorithm = payload?.algorithm;
  const fingerprint = normalizeKnownHostFingerprint(payload?.fingerprint);
  if (typeof host !== "string" || !host.trim()) {
    throw new Error("Invalid host");
  }
  if (!safePort) {
    throw new Error("Invalid port");
  }
  if (typeof fingerprint !== "string" || !fingerprint.trim()) {
    throw new Error("Invalid fingerprint");
  }
  await secureStore.trustKnownHost(
    app,
    safeStorage,
    host,
    safePort,
    String(algorithm || "default"),
    fingerprint,
  );
  return true;
});

ipcMain.handle("ai-autocomplete", async (event, payload) => {
  ensureMainSender(event);
  const provider = payload?.settings?.provider;
  if (typeof provider !== "string" || !provider.trim()) {
    throw new Error("Invalid AI provider");
  }
  const { apiKey, baseUrl } = secureStore.loadAiApiKey(app, safeStorage, provider);
  const body = {
    ...payload,
    settings: {
      ...(payload?.settings || {}),
      apiKey,
      ...(baseUrl ? { baseUrl } : {}) // Override renderer baseUrl if we safely stored one
    },
  };
  return postLocalJson("/api/ai/autocomplete", body);
});

ipcMain.handle("ai-test-connection", async (event, payload) => {
  ensureMainSender(event);
  const provider = payload?.provider;
  if (typeof provider !== "string" || !provider.trim()) {
    throw new Error("Invalid AI provider");
  }
  const { apiKey, baseUrl } = secureStore.loadAiApiKey(app, safeStorage, provider);
  return postLocalJson(
    "/api/ai/test",
    {
      ...payload,
      apiKey,
      ...(baseUrl ? { baseUrl } : {}) // Override renderer baseUrl if we safely stored one
    },
  );
});
const { createServer } = require("http");
const http = require("http");
const { parse } = require("url");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const net = require("net");

const isDev = !app.isPackaged;
const DEFAULT_PORT = parseInt(process.env.PORT || "3000", 10);

if (!isDev) {
  const Module = require("module");
  const extraModulePath = app.isPackaged
    ? path.join(process.resourcesPath, "standalone", "node_modules")
    : path.join(__dirname, "..", ".next", "standalone", "node_modules");
  Module.globalPaths.unshift(extraModulePath);
}

let mainWindow = null;
let nextProcess = null;
let wsToken = process.env.INTERNAL_API_TOKEN || null; // Shared internal API token (dev may inject via env)
let appEntryPort = DEFAULT_PORT;

function renderSplashHtml() {
  const logoDir = isDev
    ? path.join(__dirname, "..", "public", "logo")
    : path.join(process.resourcesPath, "standalone", "public", "logo");

  let logoB64 = "";
  try {
    const logoPath = path.join(logoDir, "Carbon logo light.png");
    logoB64 = fs.readFileSync(logoPath).toString("base64");
  } catch {
    // If logo can't be read, splash still works without it
  }

  const logoTag = logoB64
    ? `<img src="data:image/png;base64,${logoB64}" alt="" class="logo" />`
    : "";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Loading</title>
  <style>
    body {
      margin: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #0d1117;
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
      overflow: hidden;
      -webkit-app-region: drag;
    }
    .logo {
      width: 48px;
      height: 48px;
      object-fit: contain;
      margin-bottom: 28px;
      opacity: 0.92;
    }
    .track {
      width: 120px;
      height: 2px;
      border-radius: 1px;
      background: rgba(255, 255, 255, 0.06);
      position: relative;
      overflow: hidden;
    }
    .dash {
      position: absolute;
      top: 0;
      left: 0;
      width: 36px;
      height: 100%;
      border-radius: 1px;
      background: rgba(255, 255, 255, 0.28);
      animation: bounce 1.2s ease-in-out infinite alternate;
    }
    @keyframes bounce {
      0%   { transform: translateX(0); }
      100% { transform: translateX(84px); }
    }
  </style>
</head>
<body>
  ${logoTag}
  <div class="track"><div class="dash"></div></div>
</body>
</html>`;
}

function renderFatalHtml(title, details, logs = "") {
  const safeTitle = String(title || "Failed to start");
  const safeDetails = String(details || "");
  const safeLogs = String(logs || "");
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; background: #0d1117; color: #c9d1d9; padding: 24px; margin: 0; }
      .container { max-width: 1000px; margin: 0 auto; }
      h1 { font-size: 20px; color: #f85149; margin: 0 0 16px; }
      .section { margin-bottom: 24px; }
      .label { font-size: 12px; color: #8b949e; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
      pre { white-space: pre-wrap; background: #161b22; border: 1px solid #30363d; padding: 16px; border-radius: 8px; font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace; font-size: 13px; line-height: 1.5; color: #e6edf3; overflow-x: auto; }
      .logs { color: #8b949e; border-color: #21262d; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="section">
        <h1>${safeTitle}</h1>
        <pre>${safeDetails}</pre>
      </div>
      ${
        safeLogs
          ? `<div class="section">
               <div class="label">Startup Logs (stdout/stderr)</div>
               <pre class="logs">${safeLogs}</pre>
             </div>`
          : ""
      }
    </div>
  </body>
</html>`;
}

function createWindow() {
  const iconPath = isDev
    ? path.join(__dirname, "..", "public", "logo", "Carbon logo light.png")
    : path.join(process.resourcesPath, "standalone", "public", "logo", "Carbon logo light.png");

  mainWindow = new BrowserWindow({
    width: 1050,
    height: 650,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0d1117",
    icon: iconPath,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#00000000",
      symbolColor: "#a0a0a0",
      height: 36, // sync with src/config/titlebar.ts TITLE_BAR_HEIGHT
    },
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      enableRemoteModule: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  // Show splash screen immediately
  const splashHtml = renderSplashHtml();
  mainWindow
    .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`)
    .then(() => {
      if (mainWindow && !mainWindow.isVisible()) mainWindow.show();
    })
    .catch(() => {
      if (mainWindow) mainWindow.show();
    });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Only allow https:// URLs in external browser
    if (url.startsWith("https://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // Restrict navigation to the app's exact local origin.
  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    if (!isAllowedAppNavigation(navigationUrl)) {
      console.warn(`[security] Blocked navigation to: ${navigationUrl}`);
      event.preventDefault();
    }
  });

  // Disable DevTools in production
  if (!isDev) {
    mainWindow.webContents.on("devtools-opened", () => {
      mainWindow.webContents.closeDevTools();
    });
  }

  // Prevent core dumps on Linux (D3.5)
  if (process.platform === "linux") {
    try {
      const { execSync } = require("child_process");
      execSync(`prlimit --pid ${process.pid} --core=0:0`);
      console.log(`[security] Core dumps disabled for PID ${process.pid}`);
    } catch {
      // Best effort — may not have prlimit available
    }
  }

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error("[main] did-fail-load", { errorCode, errorDescription, validatedURL });
    if (!mainWindow) return;
    const html = renderFatalHtml(
      "Failed to load UI",
      `URL: ${validatedURL}\nError: ${errorDescription} (${errorCode})`,
    );
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).catch(() => {});
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "localhost", () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

function waitForUrl(url, timeout = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        if (res.statusCode === 200 || res.statusCode === 302 || res.statusCode === 404) {
          resolve();
        } else {
          setTimeout(check, 250);
        }
      });
      req.on("error", () => {
        if (Date.now() - start > timeout) {
          reject(new Error(`Timeout waiting for server at ${url}`));
        } else {
          setTimeout(check, 250);
        }
      });
    };
    check();
  });
}

async function startProductionServer(preferredPort) {
  const isPackaged = app.isPackaged;
  const standaloneDir = isPackaged
    ? path.join(process.resourcesPath, "standalone")
    : path.join(app.getAppPath(), ".next", "standalone");

  const serverScript = path.join(standaloneDir, "server.js");

  console.log("--- STANDALONE SERVER STARTUP ---");
  console.log(`[path] script: ${serverScript}`);
  console.log(`[path] cwd:    ${standaloneDir}`);

  const scriptExists = fs.existsSync(serverScript);
  const staticExists = fs.existsSync(path.join(standaloneDir, ".next", "static"));
  const publicExists = fs.existsSync(path.join(standaloneDir, "public"));

  console.log(`[fs] server.js:     ${scriptExists ? "EXISTS" : "MISSING"}`);
  console.log(`[fs] .next/static:  ${staticExists ? "EXISTS" : "MISSING"}`);
  console.log(`[fs] public:        ${publicExists ? "EXISTS" : "MISSING"}`);

  if (!scriptExists) {
    throw new Error(`CRITICAL: server.js missing at ${serverScript}`);
  }

  const nextPort = await getFreePort();
  const logs = [];

  // Generate WebSocket auth token early to pass to Next.js
  const wsTokenLocal = crypto.randomBytes(32).toString("hex");

  const addLog = (msg) => {
    const line = msg.toString().trim();
    if (!line) return;
    console.log(`[standalone] ${line}`);
    logs.push(line);
  };

  return new Promise((resolve, reject) => {
    try {
      nextProcess = spawn(process.execPath, [serverScript], {
        cwd: standaloneDir,
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: "1",
          PORT: nextPort.toString(),
          HOSTNAME: "127.0.0.1",
          NODE_ENV: "production",
          INTERNAL_API_TOKEN: wsTokenLocal,
          DB_PATH: path.join(app.getPath("userData"), "carbon-database.sqlite"),
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (err) {
      return reject(new Error(`Spawn error: ${err.message}`));
    }

    let isResolved = false;

    nextProcess.stdout.on("data", addLog);
    nextProcess.stderr.on("data", addLog);

    nextProcess.on("error", (err) => {
      if (isResolved) return;
      reject(new Error(`Process error: ${err.message}`));
    });

    nextProcess.on("exit", (code, signal) => {
      if (isResolved) return;
      const errorMsg = `Next.js process exited unexpectedly.\nCode: ${code}\nSignal: ${signal}\n\nRecent Logs:\n${logs.slice(-20).join("\n")}`;
      reject(new Error(errorMsg));
    });

    // Monitor for readiness
    const checkInterval = setInterval(async () => {
      if (isResolved) {
        clearInterval(checkInterval);
        return;
      }

      // Quick check if process is still alive
      if (nextProcess.exitCode !== null) {
        clearInterval(checkInterval);
        return;
      }

      try {
        const req = http.get(`http://127.0.0.1:${nextPort}`, (res) => {
          if (res.statusCode === 200 || res.statusCode === 302 || res.statusCode === 404) {
            isResolved = true;
            clearInterval(checkInterval);
            console.log(`[main] Next.js ready on port ${nextPort}`);
            
            // Proxy Setup
            const { WebSocketServer } = require("ws");
            const { handleWsConnection } = require("./ws-handler.cjs");

            console.log("[main] WebSocket auth token prepared for proxy");

            const srv = createServer((req, res) => {
              const safeRequestHeaders = sanitizeProxyRequestHeaders(req.headers);
              const proxyReq = http.request(
                {
                  hostname: "127.0.0.1",
                  port: nextPort,
                  path: req.url,
                  method: req.method,
                  headers: safeRequestHeaders,
                },
                (proxyRes) => {
                  // Strip X-Frame-Options for Electron (not needed)
                  const headers = { ...proxyRes.headers };
                  delete headers["x-frame-options"];
                  res.writeHead(proxyRes.statusCode, headers);
                  proxyRes.pipe(res);
                },
              );
              proxyReq.on("error", (err) => {
                console.error("[proxy] Request error:", err);
                res.statusCode = 502;
                res.end("Bad Gateway");
              });
              req.pipe(proxyReq);
            });

            const wss = new WebSocketServer({ noServer: true });
            wss.on("connection", (ws, req) => {
              // Validate WebSocket token
              try {
                const url = new URL(req.url, "http://localhost");
                if (url.searchParams.get("token") !== wsTokenLocal) {
                  console.warn("[security] WebSocket connection rejected: invalid token");
                  ws.close(4001, "Unauthorized");
                  return;
                }
              } catch {
                ws.close(4001, "Unauthorized");
                return;
              }
              handleWsConnection(ws);
            });

            srv.on("upgrade", (req, socket, head) => {
              const { pathname } = parse(req.url || "", true);
              if (pathname === "/api/ws") {
                wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
              } else {
                socket.destroy();
              }
            });

            srv.listen(preferredPort, "127.0.0.1", () => {
              const actualPort = srv.address().port;
              console.log(`[main] Entry proxy: http://127.0.0.1:${actualPort}`);
              wsToken = wsTokenLocal;
              appEntryPort = actualPort;
              resolve({ server: srv, port: actualPort, wsToken: wsTokenLocal });
            });
          }
        });
        req.on("error", () => {}); // Ignore until ready
      } catch {
        // Ignore errors during polling
      }
    }, 500);

    // Timeout if it takes too long
    setTimeout(() => {
      if (isResolved) return;
      clearInterval(checkInterval);
      reject(new Error(`Timeout waiting for Next.js to start.\n\nLogs:\n${logs.join("\n")}`));
    }, 20000);
  });
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);

  // --- SECURITY: Restrict file permissions on app data (D3.1) ---
  if (!isDev) {
    const { setRestrictivePermissions } = require("./file-permissions.cjs");
    void setRestrictivePermissions(app.getPath("userData"));
  }

  // --- SECURITY: Web preferences (nodeIntegration: false, contextIsolation: true, sandbox)
  // are set explicitly on BrowserWindow in createWindow(). Electron removed
  // WebContents#getWebPreferences(), so runtime introspection is not available.

  // --- SECURITY: Network egress allowlist (D6.1) ---
  const ALLOWED_ORIGINS = new Set([
    "localhost",
    "127.0.0.1",
    "api.openai.com",
    "api.anthropic.com",
    "api.groq.com",
    "api.deepseek.com",
    "api.together.xyz",
    "api.mistral.ai",
    "generativelanguage.googleapis.com",
    "gateway.ai.cloudflare.com",
    "bedrock-runtime.us-east-1.amazonaws.com",
    "bedrock-runtime.us-west-2.amazonaws.com",
    "bedrock-runtime.eu-west-1.amazonaws.com",
    "bedrock-runtime.ap-northeast-1.amazonaws.com",
    "bedrock-runtime.ap-southeast-1.amazonaws.com",
    "posthog.com",
    "eu.posthog.com",
    "us.posthog.com",
  ]);

  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ["*://*/*"] },
    (details, callback) => {
      try {
        const url = new URL(details.url);
        // Loopback egress is restricted to app-owned local ports only.
        if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1" || url.hostname === "[::1]") {
          const safePort = toSafePort(url.port);
          const allowedPorts = new Set(
            [DEFAULT_PORT, appEntryPort].filter((p) => Number.isInteger(p) && p > 0),
          );
          if (safePort && allowedPorts.has(safePort)) {
            callback({});
          } else {
            console.warn(`[security] Blocked loopback egress to ${url.hostname}:${url.port || "(default)"}`);
            callback({ cancel: true });
          }
          return;
        }
        // Only allow HTTPS for external traffic
        if (url.protocol !== "https:") {
          console.warn(`[security] Blocked non-HTTPS request to: ${details.url}`);
          callback({ cancel: true });
          return;
        }
        // Check against allowlist
        if (!ALLOWED_ORIGINS.has(url.hostname)) {
          console.warn(`[security] Blocked outbound request to: ${url.hostname}`);
          callback({ cancel: true });
          return;
        }
        callback({});
      } catch {
        callback({ cancel: true });
      }
    },
  );

  // --- SECURITY: IPC channel lockdown ---
  const ALLOWED_IPC_CHANNELS = new Set([
    "encrypt-string",
    "decrypt-string",
    "biometric-unlock",
    "set-zoom-factor",
    "set-visual-zoom-limits",
    "get-ws-token",
    "save-connection-secret",
    "load-connection-secret",
    "delete-connection-secret",
    "save-connection-metadata",
    "delete-connection-metadata",
    "save-ai-api-key",
    "has-ai-api-key",
    "trust-known-host",
    "ai-autocomplete",
    "ai-test-connection",
    "set-title-bar-overlay",
    "pin-to-taskbar",
    "maximize-window",
    "factory-reset",
    "clear-app-lock-password",
    "save-recovery-metadata",
    "load-recovery-metadata",
    "delete-recovery-metadata",
  ]);

  const originalHandle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = (channel, handler) => {
    if (!ALLOWED_IPC_CHANNELS.has(channel)) {
      throw new Error(`Unauthorized IPC channel registration: ${channel}`);
    }
    return originalHandle(channel, handler);
  };

  // Also lock down ipcMain.on
  const originalOn = ipcMain.on.bind(ipcMain);
  ipcMain.on = (channel, handler) => {
    if (!ALLOWED_IPC_CHANNELS.has(channel)) {
      throw new Error(`Unauthorized IPC channel registration: ${channel}`);
    }
    return originalOn(channel, handler);
  };
  // --- END IPC lockdown ---

  createWindow();

  if (isDev) {
    const url = `http://localhost:${DEFAULT_PORT}`;
    console.log(`> Dev UI on ${url}`);
    mainWindow.loadURL(url);
    return;
  }

  // Production: start standalone Next server via proxy first, then load it.
  const MAX_RETRIES = 5;
  let lastError = null;

  for (let i = 0; i < MAX_RETRIES; i++) {
    const portToTry = i === 0 && Number.isFinite(DEFAULT_PORT) ? DEFAULT_PORT : 0;
    try {
      const { port: actualPort } = await startProductionServer(portToTry);
      await mainWindow.loadURL(`http://127.0.0.1:${actualPort}`);
      return;
    } catch (e) {
      lastError = e;
      console.error(`[startup] Attempt ${i + 1} failed:`, e.message);
      if (nextProcess) {
        nextProcess.kill();
        nextProcess = null;
      }
      if (!e.message.includes("EADDRINUSE")) break;
    }
  }

  const html = renderFatalHtml("Next.js Standalone Boot Failed", lastError?.message || String(lastError), "");
  await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  mainWindow.show();
});

app.on("quit", () => {
  if (nextProcess) nextProcess.kill();
});

app.on("window-all-closed", () => app.quit());

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
