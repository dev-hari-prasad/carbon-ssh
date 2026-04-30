export type AuthType = "password" | "key";

export interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  createdAt: number;
}

export interface Tab {
  id: string;
  connectionId: string;
  title: string;
}

export interface LogEntry {
  id: string;
  ts: number;
  level: "info" | "warn" | "error";
  source: string;
  message: string;
}
