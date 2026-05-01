import { createServer, type IncomingMessage } from "http";
import { parse } from "url";
import type { Duplex } from "stream";
import next from "next";
import { WebSocketServer } from "ws";
import { handleWsConnection } from "./src/lib/ws-handler";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

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
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ws ok");
      return;
    }

    handle(req, res, parsedUrl);
  });

  // Use prependListener to ensure our upgrade handler fires BEFORE
  // any listener Next.js might register (e.g. for HMR websocket)
  server.prependListener(
    "upgrade",
    (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      const { pathname } = parse(req.url || "", true);
      console.log("[server] Upgrade request for:", pathname);

      if (pathname === "/api/ws") {
        wss.handleUpgrade(req, socket, head, (ws) => {
          console.log("[server] WebSocket upgrade completed for /api/ws");
          wss.emit("connection", ws, req);
        });
      }
      // Non-matching paths: do nothing — Next.js HMR handler will pick them up
    },
  );

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
