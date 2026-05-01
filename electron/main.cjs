const { app, BrowserWindow, shell, Menu, ipcMain } = require("electron");

ipcMain.on("set-zoom-factor", (event, factor) => {
  const webContents = event.sender;
  if (webContents) {
    webContents.setZoomFactor(factor);
  }
});
const { createServer } = require("http");
const { parse } = require("url");
const path = require("path");

const isDev = !app.isPackaged;
const PORT = parseInt(process.env.PORT || "3000", 10);

let mainWindow = null;

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

  mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function startProductionServer() {
  const next = require("next");
  const { WebSocketServer } = require("ws");
  const { handleWsConnection } = require("./ws-handler.cjs");

  const appDir = path.join(__dirname, "..");
  const nextApp = next({ dev: false, dir: appDir, hostname: "localhost", port: PORT });
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

  server.prependListener("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url || "", true);
    if (pathname === "/api/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    }
  });

  return new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`> Production server on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

app.whenReady().then(async () => {
  if (!isDev) {
    await startProductionServer();
  }
  Menu.setApplicationMenu(null);
  createWindow();
});

app.on("window-all-closed", () => app.quit());

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
