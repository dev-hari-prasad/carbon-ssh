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
  tags?: string[];
  groupId?: string;
  iconColor?: string;
  iconKind?:
    | "linux"
    | "ubuntu"
    | "debian"
    | "centos"
    | "alpine"
    | "arch"
    | "macos"
    | "windows"
    | "generic";
  iconBrand?: string;
  /** When false, AI autocomplete and assistant are disabled for this host's sessions (default allows AI). */
  aiFeaturesEnabled?: boolean;
}

export interface HostGroup {
  id: string;
  name: string;
  description?: string;
}

export interface Tab {
  id: string;
  connectionId: string;
  title: string;
  startedAt: number;
  commandCount: number;
}

export interface LogEntry {
  id: string;
  ts: number;
  level: "info" | "warn" | "error";
  source: string;
  message: string;
}

export interface Bang {
  id: string;
  trigger: string; // e.g. "update"
  command: string; // e.g. "apt update && apt upgrade"
  description?: string;
  createdAt: number;
}

export type ThemeId = string;
