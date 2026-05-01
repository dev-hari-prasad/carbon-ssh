import { Client, type ClientChannel, type ConnectConfig } from "ssh2";

export interface SshConnectionOptions {
  host: string;
  port: number;
  username: string;
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

export function connectSsh(
  options: SshConnectionOptions,
  handlers: SessionHandlers,
): Promise<SshSession> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    let shell: ClientChannel | null = null;
    let settled = false;
    let closed = false;

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

    client.on("error", handleError);
    client.on("close", handleClose);

    const config: ConnectConfig = {
      host: options.host,
      port: options.port,
      username: options.username,
      readyTimeout: 20_000,
      keepaliveInterval: 10_000,
      tryKeyboard: true,
    };

    if (options.password) {
      config.password = options.password;
    }
    if (options.privateKey) {
      config.privateKey = options.privateKey;
    }
    if (options.passphrase) {
      config.passphrase = options.passphrase;
    }

    client.connect(config);
  });
}
