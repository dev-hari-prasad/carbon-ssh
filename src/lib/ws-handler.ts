import { Client, type ClientChannel, type ConnectConfig } from "ssh2";
import type { WebSocket } from "ws";

interface ConnectPayload {
  host: string;
  port: number;
  username: string;
  authMethod?: "password" | "privateKey";
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

function resolveAuthMethod(data: ConnectPayload): "password" | "privateKey" {
  if (data.authMethod === "privateKey") return "privateKey";
  if (!data.authMethod && data.privateKey) return "privateKey";
  return "password";
}

function normalizePrivateKey(privateKey?: string): string {
  return (privateKey ?? "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function formatSshError(error: Error, authMethod: "password" | "privateKey"): string {
  const details = error as Error & { code?: string; level?: string };
  const message = error.message || "";
  const lower = message.toLowerCase();

  if (
    details.level === "client-authentication" ||
    lower.includes("all configured authentication methods failed") ||
    lower.includes("authentication failed")
  ) {
    return "Authentication failed";
  }

  if (
    authMethod === "privateKey" &&
    (lower.includes("privatekey") ||
      lower.includes("private key") ||
      lower.includes("key format") ||
      lower.includes("parse") ||
      lower.includes("encrypted"))
  ) {
    return "Invalid private key";
  }

  if (
    details.code === "ECONNREFUSED" ||
    lower.includes("econnrefused") ||
    lower.includes("connection refused")
  ) {
    return "Connection refused";
  }

  if (lower.includes("connection closed") || lower.includes("connection lost")) {
    return "SSH connection closed";
  }

  return message || "SSH connection failed";
}

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
    console.error("[ws-handler] SSH error stack trace:\n", error.stack || error);
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
      const authMethod = resolveAuthMethod(message.data);
      const normalizedPrivateKey = normalizePrivateKey(privateKey);

      if (authMethod === "privateKey" && !normalizedPrivateKey) {
        sendMsg({ type: "error", message: "Invalid private key" });
        handleClose();
        return;
      }

      const sshClient = new Client();
      client = sshClient;

      sshClient.on("keyboard-interactive", (_name, _instructions, _lang, prompts, finish) => {
        if (
          authMethod === "password" &&
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
              console.error("[ws-handler] Shell error full trace:\n", err.stack || err);
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
        console.error("[ws-handler] SSH client error full trace:\n", err.stack || err);
        if (!shell) {
          // Connection failed before shell was established
          sendMsg({ type: "error", message: formatSshError(err, authMethod) });
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
        hostVerifier: (hashedKey: any) => {
          if (hashedKey) {
            const crypto = require("crypto");
            const fingerprint = crypto
              .createHash("sha256")
              .update(hashedKey)
              .digest("base64");
            console.log(`[ws-handler] Host key fingerprint: SHA256:${fingerprint}:${host}`);
          }
          return true;
        },
      };

      if (authMethod === "password") {
        config.password = password ?? "";
      }
      if (authMethod === "privateKey") {
        config.privateKey = normalizedPrivateKey;
        if (passphrase) config.passphrase = passphrase;
      }

      console.log(`[ws-handler] Connecting to ${username}@${host}:${port}...`);
      try {
        sshClient.connect(config);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        sendMsg({ type: "error", message: formatSshError(err, authMethod) });
        handleClose();
      }
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
