import { DEFAULT_THEME_ID, THEMES } from "@/config/themes";
import {
  AI_PROVIDERS,
  DEFAULT_AI_SETTINGS,
  type AISettings,
} from "./ai";
import type { Bang, Connection, HostGroup, ThemeId } from "./types";
import {
  DEFAULT_LOG_RETENTION,
  type LogRetention,
} from "./log-retention";

const KEY = "ssh.connections.v1";
const GROUPS_KEY = "ssh.groups.v1";
const BANGS_KEY = "ssh.bangs.v1";
const THEME_KEY = "ssh.theme.v1";
const FONT_KEY = "ssh.font.v1";
const TERMINAL_FONT_KEY = "ssh.terminalFont.v1";
const AI_KEY = "ssh.ai.v1";
const LOG_RETENTION_KEY = "ssh.logRetention.v1";

const VALID_LOG_RETENTION = new Set<LogRetention>(["6h", "24h", "3d", "7d", "off"]);

export const MOCK_GROUPS: HostGroup[] = [
  { id: "admins", name: "Admins" },
  { id: "production", name: "Production" },
  { id: "backup", name: "Backup" },
];

export const MOCK_CONNECTIONS: Connection[] = [
  {
    id: "mock-admin-devops",
    name: "Admin Devops Team",
    host: "10.0.0.15",
    port: 22,
    username: "stan",
    authType: "key",
    createdAt: Date.now(),
    tags: ["ssh", "admin", "personal"],
    groupId: "admins",
    iconKind: "ubuntu",
    iconColor: "#0ea5b7",
  },
  {
    id: "mock-dev-scheduler",
    name: "Dev Scheduler",
    host: "10.0.4.21",
    port: 22,
    username: "ops",
    authType: "key",
    createdAt: Date.now() - 1,
    tags: ["ssh", "dev"],
    groupId: "admins",
    iconKind: "centos",
    iconColor: "#ef6a1d",
  },
  {
    id: "mock-lb-us",
    name: "Load Balancer US",
    host: "lb-us-1.acme.io",
    port: 22,
    username: "deploy",
    authType: "key",
    createdAt: Date.now() - 2,
    tags: ["ssh", "prod", "balancer"],
    groupId: "production",
    iconKind: "alpine",
    iconColor: "#3b82f6",
  },
  {
    id: "mock-web-us-1",
    name: "Web Server us-1",
    host: "web1.us.acme.io",
    port: 22,
    username: "deploy",
    authType: "key",
    createdAt: Date.now() - 3,
    tags: ["ssh", "dev", "cash"],
    groupId: "production",
    iconKind: "centos",
    iconColor: "#ef6a1d",
  },
  {
    id: "mock-pg-2",
    name: "Postgresql Replica-2",
    host: "pg2.acme.io",
    port: 22,
    username: "postgres",
    authType: "password",
    createdAt: Date.now() - 4,
    tags: ["ssh", "prod", "db"],
    groupId: "production",
    iconKind: "debian",
    iconColor: "#d6336c",
  },
  {
    id: "mock-pg-1",
    name: "Postgresql Replica-1",
    host: "pg1.acme.io",
    port: 22,
    username: "postgres",
    authType: "password",
    createdAt: Date.now() - 5,
    tags: ["ssh", "prod", "db"],
    groupId: "production",
    iconKind: "debian",
    iconColor: "#d6336c",
  },
  {
    id: "mock-lb-eu",
    name: "Load Balancer EU",
    host: "lb-eu-1.acme.io",
    port: 22,
    username: "deploy",
    authType: "key",
    createdAt: Date.now() - 6,
    tags: ["ssh", "prod", "balancer"],
    groupId: "production",
    iconKind: "alpine",
    iconColor: "#3b82f6",
  },
  {
    id: "mock-web-us-0",
    name: "Web Server us-0",
    host: "web0.us.acme.io",
    port: 22,
    username: "deploy",
    authType: "key",
    createdAt: Date.now() - 7,
    tags: ["ssh", "dev", "cash"],
    groupId: "production",
    iconKind: "centos",
    iconColor: "#b8542d",
  },
  {
    id: "mock-dev-redis",
    name: "Dev Redis",
    host: "redis.dev.acme.io",
    port: 22,
    username: "redis",
    authType: "password",
    createdAt: Date.now() - 8,
    tags: ["ssh", "dev", "cache"],
    groupId: "backup",
    iconKind: "debian",
    iconColor: "#9b1c1c",
  },
  {
    id: "mock-terraform",
    name: "Terraform Host",
    host: "tf.acme.io",
    port: 22,
    username: "terra",
    authType: "key",
    createdAt: Date.now() - 9,
    tags: ["ssh", "ops"],
    groupId: "backup",
    iconKind: "linux",
    iconColor: "#7c3aed",
  },
];

export function loadConnections(): Connection[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) {
      window.localStorage.setItem(KEY, JSON.stringify(MOCK_CONNECTIONS));
      return MOCK_CONNECTIONS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Connection[];
  } catch {
    return [];
  }
}

export function saveConnections(list: Connection[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function loadGroups(): HostGroup[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GROUPS_KEY);
    if (raw === null) {
      window.localStorage.setItem(GROUPS_KEY, JSON.stringify(MOCK_GROUPS));
      return [...MOCK_GROUPS];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...MOCK_GROUPS];
    return parsed as HostGroup[];
  } catch {
    return [...MOCK_GROUPS];
  }
}

export function saveGroups(list: HostGroup[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GROUPS_KEY, JSON.stringify(list));
}

const SAMPLE_BANGS: Bang[] = [
  {
    id: "sample-update",
    trigger: "update",
    command: "apt update && apt upgrade -y",
    description: "Update & upgrade packages",
    createdAt: Date.now(),
  },
  {
    id: "sample-ports",
    trigger: "ports",
    command: "ss -tulpn",
    description: "List listening ports",
    createdAt: Date.now(),
  },
  {
    id: "sample-disk",
    trigger: "disk",
    command: "df -h",
    description: "Disk usage (human readable)",
    createdAt: Date.now(),
  },
  {
    id: "sample-logs",
    trigger: "logs",
    command: "journalctl -xe --no-pager | tail -n 100",
    description: "Tail recent system logs",
    createdAt: Date.now(),
  },
];

export function loadBangs(): Bang[] {
  if (typeof window === "undefined") return SAMPLE_BANGS;
  try {
    const raw = window.localStorage.getItem(BANGS_KEY);
    if (!raw) return SAMPLE_BANGS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return SAMPLE_BANGS;
    return parsed as Bang[];
  } catch {
    return SAMPLE_BANGS;
  }
}

export function saveBangs(list: Bang[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BANGS_KEY, JSON.stringify(list));
}

export function loadTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME_ID;
  const v = window.localStorage.getItem(THEME_KEY);
  if (v === "dark") return DEFAULT_THEME_ID;
  if (v === "light") return "light_modern";
  const known = THEMES.find((theme) => theme.id === v);
  return known?.id ?? DEFAULT_THEME_ID;
}

export function saveTheme(t: ThemeId) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_KEY, t);
}

export function loadFont(): string {
  if (typeof window === "undefined") return "manrope";
  return window.localStorage.getItem(FONT_KEY) ?? "manrope";
}

export function saveFont(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FONT_KEY, id);
}

export function loadTerminalFont(): string {
  if (typeof window === "undefined") return "jetbrains-mono";
  return window.localStorage.getItem(TERMINAL_FONT_KEY) ?? "jetbrains-mono";
}

export function saveTerminalFont(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TERMINAL_FONT_KEY, id);
}

export function loadAISettings(): AISettings {
  if (typeof window === "undefined") return { ...DEFAULT_AI_SETTINGS };
  try {
    const raw = window.localStorage.getItem(AI_KEY);
    if (!raw) return { ...DEFAULT_AI_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AISettings> & { model?: string };
    const legacy =
      typeof parsed.model === "string" && parsed.model.trim() !== ""
        ? parsed.model
        : "";
    const chatModel =
      typeof parsed.chatModel === "string"
        ? parsed.chatModel
        : legacy || DEFAULT_AI_SETTINGS.chatModel;
    const autocompleteModel =
      typeof parsed.autocompleteModel === "string"
        ? parsed.autocompleteModel
        : legacy || DEFAULT_AI_SETTINGS.autocompleteModel;
    return {
      ...DEFAULT_AI_SETTINGS,
      provider:
        parsed.provider &&
        AI_PROVIDERS.some((p) => p.id === parsed.provider)
          ? parsed.provider
          : DEFAULT_AI_SETTINGS.provider,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : "",
      chatModel,
      autocompleteModel,
      autocompleteEnabled: Boolean(parsed.autocompleteEnabled),
      chatEnabled: Boolean(parsed.chatEnabled),
    };
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export function saveAISettings(s: AISettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AI_KEY, JSON.stringify(s));
}

export function loadLogRetention(): LogRetention {
  if (typeof window === "undefined") return DEFAULT_LOG_RETENTION;
  try {
    const v = window.localStorage.getItem(LOG_RETENTION_KEY);
    if (v && VALID_LOG_RETENTION.has(v as LogRetention)) return v as LogRetention;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOG_RETENTION;
}

export function saveLogRetention(r: LogRetention) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOG_RETENTION_KEY, r);
  } catch {
    /* ignore */
  }
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
