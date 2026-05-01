import type { Server as HttpServer } from "http";
import type { NextApiRequest, NextApiResponse } from "next";
import { WebSocketServer, type WebSocket } from "ws";
import { connectSsh, type SshSession } from "@/lib/ssh";

export const config = {
  api: {
    bodyParser: false,
  },
};

type ClientMessage =
  | {
      type: "connect";
      data: {
        host: string;
        port: number;
        username: string;
        password?: string;
        privateKey?: string;
        passphrase?: string;
        cols?: number;
        rows?: number;
      };
    }
  | { type: "input"; data: string }
  | { type: "resize"; data: { cols: number; rows: number } }
  | { type: "close" };

type ServerMessage =
  | { type: "data"; data: string }
  | { type: "error"; message: string }
  | { type: "connected" }
  | { type: "closed" };

type ServerWithWss = HttpServer & {
  wss?: WebSocketServer;
};

function parseClientMessage(raw: WebSocket.RawData): ClientMessage | null {
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as ClientMessage;
  } catch {
    return null;
  }
}

function send(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(message));
}

function normalizePrivateKey(key?: string) {
  return key ? key.replace(/\\n/g, "\n") : undefined;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!res.socket) {
    res.status(500).end();
    return;
  }

  const socket = res.socket as typeof res.socket & { server: ServerWithWss };
  const server = socket.server;

  if (!server.wss) {
    const wss = new WebSocketServer({ server, path: "/api/ws" });
    server.wss = wss;

    wss.on("connection", (ws) => {
      let session: SshSession | null = null;
      let closed = false;

      const handleClose = () => {
        if (closed) return;
        closed = true;
        session?.disconnect();
        send(ws, { type: "closed" });
      };

      const handleError = (error: Error) => {
        send(ws, { type: "error", message: error.message });
      };

      ws.on("message", async (raw) => {
        const message = parseClientMessage(raw);
        if (!message) {
          send(ws, { type: "error", message: "Invalid message format." });
          return;
        }

        if (message.type === "connect") {
          session?.disconnect();
          const { host, port, username, password, privateKey, passphrase, cols, rows } =
            message.data;
          try {
            session = await connectSsh(
              {
                host,
                port,
                username,
                password,
                privateKey: normalizePrivateKey(privateKey),
                passphrase,
                cols,
                rows,
              },
              {
                onData: (data) => send(ws, { type: "data", data: data.toString("utf8") }),
                onClose: handleClose,
                onError: handleError,
              },
            );
            send(ws, { type: "connected" });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Failed to connect to SSH.";
            send(ws, { type: "error", message });
          }
          return;
        }

        if (!session) {
          send(ws, { type: "error", message: "SSH session not connected." });
          return;
        }

        switch (message.type) {
          case "input":
            session.send(message.data);
            break;
          case "resize":
            session.resize(message.data.cols, message.data.rows);
            break;
          case "close":
            session.disconnect();
            break;
        }
      });

      ws.on("close", handleClose);
      ws.on("error", (error) => handleError(error as Error));
    });
  }

  res.end();
}
