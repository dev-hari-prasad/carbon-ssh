const {
  app,
  BrowserWindow,
  shell,
  Menu,
  ipcMain,
  safeStorage,
  systemPreferences,
} = require("electron");

ipcMain.on("set-zoom-factor", (event, factor) => {
  const webContents = event.sender;
  if (webContents) {
    webContents.setZoomFactor(factor);
  }
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
const { createServer } = require("http");
const { parse } = require("url");
const path = require("path");

const isDev = !app.isPackaged;
const DEFAULT_PORT = parseInt(process.env.PORT || "3000", 10);

let mainWindow = null;

function renderFatalHtml(title, details) {
  const safeTitle = String(title || "Failed to start");
  const safeDetails = String(details || "");
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; background: #0d1117; color: #c9d1d9; padding: 24px; }
      h1 { font-size: 18px; margin: 0 0 12px; }
      pre { white-space: pre-wrap; background: #161b22; border: 1px solid #30363d; padding: 12px; border-radius: 8px; }
      .hint { color: #8b949e; margin-top: 12px; }
    </style>
  </head>
  <body>
    <h1>${safeTitle}</h1>
    <pre>${safeDetails}</pre>
    <div class="hint">Check Windows Firewall, port conflicts, and logs in the console.</div>
  </body>
</html>`;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0d1117",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  // If the UI never becomes "ready", still show the window so users aren't stuck with a background process.
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) mainWindow.show();
  }, 3000);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

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

async function startProductionServer(preferredPort) {
  const next = require("next");
  const { WebSocketServer } = require("ws");
  const { handleWsConnection } = require("./ws-handler.cjs");

  const appDir = path.join(__dirname, "..");
  const port = typeof preferredPort === "number" ? preferredPort : 0;
  const nextApp = next({ dev: false, dir: appDir, hostname: "localhost", port });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || "", true);
    if (parsedUrl.pathname === "/api/ws") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ws ok");
      return;
    }
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });
  wss.on("connection", (ws) => handleWsConnection(ws));

  const nextListeners = server.listeners("upgrade").slice(0);
  server.removeAllListeners("upgrade");

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url || "", true);
    if (pathname === "/api/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      for (const listener of nextListeners) {
        listener(req, socket, head);
      }
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      const address = server.address();
      const actualPort = address && typeof address === "object" ? address.port : preferredPort;
      console.log(`> Production server on http://localhost:${actualPort}`);
      resolve({ server, port: actualPort });
    });
  });
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  createWindow();

  if (isDev) {
    const url = `http://localhost:${DEFAULT_PORT}`;
    console.log(`> Dev UI on ${url}`);
    mainWindow.loadURL(url);
    return;
  }

  // Production: start embedded Next server first, then load it.
  const MAX_RETRIES = 20;
  let lastError = null;

  for (let i = 0; i < MAX_RETRIES; i++) {
    const portToTry = i === 0 && Number.isFinite(DEFAULT_PORT) ? DEFAULT_PORT : 0;
    try {
      const { port: actualPort } = await startProductionServer(portToTry);
      await mainWindow.loadURL(`http://localhost:${actualPort}`);
      return; // Success!
    } catch (e) {
      lastError = e;
      console.error(`[main] Failed to start production server on port ${portToTry}:`, e);
      // If it's a port error, try again. Otherwise, fail fast.
      if (e.code !== "EADDRINUSE" && i === 0 && portToTry !== 0) {
        // Continue to retry with port 0 (random port)
      } else if (e.code !== "EADDRINUSE") {
        break;
      }
    }
  }

  const html = renderFatalHtml("Failed to start server", lastError?.stack || String(lastError));
  await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  mainWindow.show();
});

app.on("window-all-closed", () => app.quit());

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
