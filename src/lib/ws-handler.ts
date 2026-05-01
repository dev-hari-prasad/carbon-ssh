import { Client, type ClientChannel, type ConnectConfig } from "ssh2";
import type { WebSocket } from "ws";

interface ConnectPayload {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  cols?: number;
  rows?: number;
}

type ClientMessage =
  | { type: "connect"; data: ConnectPayload }
  | { type: "input"; data: string }
  | { type: "resize"; data: { cols: number; rows: number } }
  | { type: "close" };

type ServerMessage =
  | { type: "data"; data: string }
  | { type: "error"; message: string }
  | { type: "connected" }
  | { type: "closed" };

export function handleWsConnection(ws: WebSocket): void {
  let shell: ClientChannel | null = null;
  let client: Client | null = null;
  let closed = false;

  function sendMsg(message: ServerMessage): void {
    if (ws.readyState === 1 /* WebSocket.OPEN */) {
      ws.send(JSON.stringify(message));
    }
  }

  function handleClose(): void {
    if (closed) return;
    closed = true;
    console.log("[ws-handler] SSH session closed");
    if (shell) {
      try {
        shell.end();
      } catch {
        /* ignore */
      }
      shell = null;
    }
    if (client) {
      try {
        client.end();
      } catch {
        /* ignore */
      }
      client = null;
    }
    sendMsg({ type: "closed" });
  }

  function handleError(error: Error): void {
    console.error("[ws-handler] SSH error:", error.message);
    sendMsg({ type: "error", message: error.message });
  }

  ws.on("message", (raw) => {
    let message: ClientMessage;
    try {
      const text = typeof raw === "string" ? raw : Buffer.from(raw as ArrayBuffer).toString("utf8");
      message = JSON.parse(text) as ClientMessage;
    } catch {
      sendMsg({ type: "error", message: "Invalid message format." });
      return;
    }

    console.log("[ws-handler] Received:", message.type);

    if (message.type === "connect") {
      // Disconnect existing session if any
      if (shell) {
        try {
          shell.end();
        } catch {
          /* ignore */
        }
        shell = null;
      }
      if (client) {
        try {
          client.end();
        } catch {
          /* ignore */
        }
        client = null;
      }
      closed = false;

      const { host, port, username, password, privateKey, passphrase, cols, rows } = message.data;

      const sshClient = new Client();
      client = sshClient;

      sshClient.on("keyboard-interactive", (_name, _instructions, _lang, prompts, finish) => {
        if (
          prompts.length > 0 &&
          prompts[0].prompt.toLowerCase().includes("password") &&
          password
        ) {
          finish([password]);
        } else {
          finish([]);
        }
      });

      sshClient.on("ready", () => {
        console.log("[ws-handler] SSH client ready, opening shell...");
        const termCols = cols ?? 80;
        const termRows = rows ?? 24;

        sshClient.shell(
          { term: "xterm-256color", cols: termCols, rows: termRows },
          (err, stream) => {
            if (err) {
              console.error("[ws-handler] Shell error:", err.message);
              handleError(err);
              sshClient.end();
              return;
            }

            shell = stream;
            console.log("[ws-handler] Shell opened, sending connected");
            sendMsg({ type: "connected" });

            stream.on("data", (data: Buffer) => {
              sendMsg({ type: "data", data: data.toString("utf8") });
            });

            stream.on("close", () => {
              console.log("[ws-handler] Shell stream closed");
              handleClose();
            });

            if (stream.stderr) {
              stream.stderr.on("data", (data: Buffer) => {
                sendMsg({ type: "data", data: data.toString("utf8") });
              });
            }
          },
        );
      });

      sshClient.on("error", (err) => {
        console.error("[ws-handler] SSH client error:", err.message);
        if (!shell) {
          // Connection failed before shell was established
          sendMsg({ type: "error", message: err.message });
          handleClose();
        } else {
          handleError(err);
        }
      });

      sshClient.on("close", () => {
        console.log("[ws-handler] SSH client connection closed");
        handleClose();
      });

      const config: ConnectConfig = {
        host,
        port,
        username,
        readyTimeout: 20_000,
        keepaliveInterval: 10_000,
        tryKeyboard: true,
      };

      if (password) config.password = password;
      if (privateKey) {
        config.privateKey = privateKey.replace(/\\n/g, "\n");
      }
      if (passphrase) config.passphrase = passphrase;

      console.log(`[ws-handler] Connecting to ${username}@${host}:${port}...`);
      sshClient.connect(config);
      return;
    }

    if (message.type === "input" && shell) {
      shell.write(message.data);
      return;
    }

    if (message.type === "resize" && shell) {
      shell.setWindow(message.data.rows, message.data.cols, 0, 0);
      return;
    }

    if (message.type === "close") {
      handleClose();
      return;
    }
  });

  ws.on("close", () => {
    console.log("[ws-handler] WebSocket closed by client");
    handleClose();
  });

  ws.on("error", (err) => {
    console.error("[ws-handler] WebSocket error:", err.message);
    handleClose();
  });
}
