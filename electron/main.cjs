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

            const srv = createServer((req, res) => {
              const proxyReq = http.request(
                {
                  hostname: "127.0.0.1",
                  port: nextPort,
                  path: req.url,
                  method: req.method,
                  headers: req.headers,
                },
                (proxyRes) => {
                  res.writeHead(proxyRes.statusCode, proxyRes.headers);
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
            wss.on("connection", (ws) => handleWsConnection(ws));

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
              resolve({ server: srv, port: actualPort });
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
