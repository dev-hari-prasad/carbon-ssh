import crypto from "node:crypto";
import { createServer, type IncomingMessage } from "http";
import { parse } from "url";
import type { Duplex } from "stream";
import next from "next";
import { WebSocketServer } from "ws";
import { handleWsConnection } from "./src/lib/ws-handler";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

/** Dev-only WS upgrade secret (same-user local threat model). */
const wsToken = crypto.randomBytes(32).toString("hex");
process.env.INTERNAL_API_TOKEN = wsToken;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Create WebSocket server in noServer mode — we manually handle upgrades
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws) => {
    console.log("[server] New WebSocket connection established");
    handleWsConnection(ws);
  });

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || "", true);

    // Skip /api/ws for regular HTTP — it's handled via upgrade only
    if (parsedUrl.pathname === "/api/ws") {
      res.writeHead(426, {
        "Content-Type": "text/plain",
        Connection: "Upgrade",
        Upgrade: "websocket",
      });
      res.end("Upgrade Required");
      return;
    }

    handle(req, res, parsedUrl);
  });

  // Hijack upgrade listeners so Next.js doesn't destroy our WebSocket
  // Next.js lazily attaches its upgrade listener later, so we must monkey-patch server.on
  const nextListeners: any[] = [];
  const originalOn = server.on.bind(server);

  server.on = function (event, listener) {
    if (event === "upgrade") {
      nextListeners.push(listener);
      return this;
    }
    return originalOn(event, listener);
  } as typeof server.on;

  originalOn("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const { pathname, query } = parse(req.url || "", true);
    if (pathname === "/api/ws") {
      const raw = query.token;
      const token = Array.isArray(raw) ? raw[0] : raw;
      if (token !== wsToken) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        console.log("[server] WebSocket upgrade completed for /api/ws");
        wss.emit("connection", ws, req);
      });
    } else {
      // Pass other upgrades (like HMR) to Next.js
      for (const listener of nextListeners) {
        listener(req, socket, head);
      }
    }
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
