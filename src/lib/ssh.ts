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
      handlers.onClose();
    };

    const handleError = (error: Error) => {
      handlers.onError(error);
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

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
          resize(nextCols: number, nextRows: number) {
            shell?.setWindow(nextRows, nextCols, 0, 0);
          },
          disconnect() {
            if (shell) {
              shell.end("exit\n");
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
