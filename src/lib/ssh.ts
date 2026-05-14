import { Client, type ClientChannel, type ConnectConfig } from "ssh2";

export interface SshConnectionOptions {
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

export interface SshSession {
  send(data: string): void;
  resize(cols: number, rows: number): void;
  disconnect(): void;
}

interface SessionHandlers {
  onData: (data: Buffer) => void;
  onClose: () => void;
  onError: (error: Error) => void;
}

function resolveAuthMethod(options: SshConnectionOptions): "password" | "privateKey" {
  if (options.authMethod === "privateKey") return "privateKey";
  if (!options.authMethod && options.privateKey) return "privateKey";
  return "password";
}

function normalizePrivateKey(privateKey?: string): string {
  return (privateKey ?? "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function formatSshError(error: Error, authMethod: "password" | "privateKey"): Error {
  const details = error as Error & { code?: string; level?: string };
  const message = error.message || "";
  const lower = message.toLowerCase();

  if (
    details.level === "client-authentication" ||
    lower.includes("all configured authentication methods failed") ||
    lower.includes("authentication failed")
  ) {
    return new Error("Authentication failed");
  }

  if (
    authMethod === "privateKey" &&
    (lower.includes("privatekey") ||
      lower.includes("private key") ||
      lower.includes("key format") ||
      lower.includes("parse") ||
      lower.includes("encrypted"))
  ) {
    return new Error("Invalid private key");
  }

  if (
    details.code === "ECONNREFUSED" ||
    lower.includes("econnrefused") ||
    lower.includes("connection refused")
  ) {
    return new Error("Connection refused");
  }

  if (lower.includes("connection closed") || lower.includes("connection lost")) {
    return new Error("SSH connection closed");
  }

  return new Error(message || "SSH connection failed");
}

export function connectSsh(
  options: SshConnectionOptions,
  handlers: SessionHandlers,
): Promise<SshSession> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    let shell: ClientChannel | null = null;
    let settled = false;
    let closed = false;
    const authMethod = resolveAuthMethod(options);
    const normalizedPrivateKey = normalizePrivateKey(options.privateKey);

    if (authMethod === "privateKey" && !normalizedPrivateKey) {
      reject(new Error("Invalid private key"));
      return;
    }

    const handleClose = () => {
      if (closed) return;
      closed = true;
      if (!settled) {
        settled = true;
        reject(
          new Error(
            "Connection closed abruptly before session was established. (Check credentials or server config)",
          ),
        );
      } else {
        handlers.onClose();
      }
    };

    const handleError = (error: Error) => {
      if (!settled) {
        settled = true;
        reject(error);
      } else {
        handlers.onError(error);
      }
    };

    client.on("keyboard-interactive", (name, instructions, instructionsLang, prompts, finish) => {
      // Automatic handling or fail if we don't have interactive response
      if (
        authMethod === "password" &&
        prompts.length > 0 &&
        prompts[0].prompt.toLowerCase().includes("password") &&
        options.password
      ) {
        finish([options.password]);
      } else {
        finish([]);
      }
    });

    client.on("ready", () => {
      const cols = options.cols ?? 80;
      const rows = options.rows ?? 24;
      client.shell({ term: "xterm-256color", cols, rows }, (err, stream) => {
        if (err) {
          handleError(err);
          client.end();
          return;
        }
        shell = stream;
        stream.on("data", (data: Buffer) => handlers.onData(data));
        stream.on("close", handleClose);
        if (stream.stderr) {
          stream.stderr.on("data", (data: Buffer) => handlers.onData(data));
        }
        const session: SshSession = {
          send(data: string) {
            shell?.write(data);
          },
          resize(cols: number, rows: number) {
            shell?.setWindow(rows, cols, 0, 0);
          },
          disconnect() {
            if (shell) {
              shell.end();
            }
            client.end();
            handleClose();
          },
        };
        settled = true;
        resolve(session);
      });
    });

    client.on("error", (error) => handleError(formatSshError(error, authMethod)));
    client.on("close", handleClose);

      const config: ConnectConfig = {
        host: options.host,
        port: options.port,
        username: options.username,
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
            console.log(`[ssh] Host key fingerprint: SHA256:${fingerprint}:${options.host}`);
          }
          return true;
        },
      };

    if (authMethod === "password") {
      config.password = options.password ?? "";
    }
    if (authMethod === "privateKey") {
      config.privateKey = normalizedPrivateKey;
      if (options.passphrase) {
        config.passphrase = options.passphrase;
      }
    }

    try {
      client.connect(config);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      handleError(formatSshError(err, authMethod));
    }
  });
}
