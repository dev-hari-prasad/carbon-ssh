import { DEFAULT_THEME_ID, THEMES } from "@/config/themes";
import { AI_PROVIDERS, DEFAULT_AI_SETTINGS, type AISettings } from "./ai";
import type { Bang, Connection, HostGroup, ThemeId } from "./types";
import { normalizeConnectionCredentials } from "./credentials";
import { DEFAULT_LOG_RETENTION, type LogRetention } from "./log-retention";

const KEY = "ssh.connections.v2";
const GROUPS_KEY = "ssh.groups.v2";
const BANGS_KEY = "ssh.bangs.v2";
const THEME_KEY = "ssh.theme.v1";
const FONT_KEY = "ssh.font.v1";
const TERMINAL_FONT_KEY = "ssh.terminalFont.v1";
const AI_KEY = "ssh.ai.v1";
const LOG_RETENTION_KEY = "ssh.logRetention.v1";
const TERMINAL_CURSOR_STYLE_KEY = "ssh.terminalCursorStyle.v1";
const VAULT_SETUP_KEY = "ssh.vault-setup";
const TEMP_PASSWORD_KEY = "ssh.temp-pwd";
const PASSKEY_ID_KEY = "ssh.vault-passkey-id";
const PASSKEY_PROVIDER_KEY = "ssh.vault-passkey-provider";
const TELEMETRY_ENABLED_KEY = "ssh.telemetry-enabled.v1";

const VALID_LOG_RETENTION = new Set<LogRetention>(["24h", "3d", "7d", "30d", "90d", "1y", "off"]);

export type AccessMethod = "passkey" | "password";

export interface AccessSettings {
  appLockEnabled: boolean;
  method: AccessMethod;
}

export const DEFAULT_ACCESS_SETTINGS: AccessSettings = {
  appLockEnabled: true,
  method: "passkey",
};

export function loadAccessSettings(): AccessSettings {
  if (typeof window === "undefined") return { ...DEFAULT_ACCESS_SETTINGS };
  const setup = window.localStorage.getItem(VAULT_SETUP_KEY);
  if (setup === "disabled") {
    return { appLockEnabled: false, method: "passkey" };
  }
  if (setup === "password") {
    return { appLockEnabled: true, method: "password" };
  }
  return { appLockEnabled: true, method: "passkey" };
}

export function saveAccessSettings(settings: AccessSettings) {
  if (typeof window === "undefined") return;
  if (!settings.appLockEnabled) {
    window.localStorage.setItem(VAULT_SETUP_KEY, "disabled");
    return;
  }
  window.localStorage.setItem(
    VAULT_SETUP_KEY,
    settings.method === "password" ? "password" : "biometric",
  );
}

export function savePasswordAccess(password: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TEMP_PASSWORD_KEY, password);
  saveAccessSettings({ appLockEnabled: true, method: "password" });
}

export function savePasskeyAccess(provider: "electron" | "webauthn", credentialId?: string) {
  if (typeof window === "undefined") return;
  if (credentialId) {
    window.localStorage.setItem(PASSKEY_ID_KEY, credentialId);
  }
  window.localStorage.setItem(PASSKEY_PROVIDER_KEY, provider);
  saveAccessSettings({ appLockEnabled: true, method: "passkey" });
}

export const MOCK_GROUPS: HostGroup[] = [];

export const MOCK_CONNECTIONS: Connection[] = [];

export function loadConnections(): Connection[] {
  // Returns empty array synchronously, use loadConnectionsAsync instead
  return [];
}

export async function loadConnectionsAsync(): Promise<Connection[]> {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      window.localStorage.setItem(KEY, JSON.stringify(MOCK_CONNECTIONS));
      return MOCK_CONNECTIONS;
    }

    let decrypted = raw;
    if (window.electron?.decryptString && !raw.trim().startsWith("[")) {
      decrypted = await window.electron.decryptString(raw);
    }

    const parsed = JSON.parse(decrypted);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((connection) =>
      normalizeConnectionCredentials(connection as Connection),
    ) as Connection[];
  } catch (e) {
    console.error("Failed to load/decrypt connections", e);
    return [];
  }
}

export function saveConnections(list: Connection[]) {
  // Use async instead to encrypt
}

export async function saveConnectionsAsync(list: Connection[]) {
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.stringify(list.map((connection) => normalizeConnectionCredentials(connection)));
    let encrypted = raw;
    if (window.electron?.encryptString) {
      encrypted = await window.electron.encryptString(raw);
    }
    window.localStorage.setItem(KEY, encrypted);
  } catch (e) {
    console.error("Failed to save/encrypt connections", e);
  }
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

export function loadTerminalCursorStyle(): string {
  if (typeof window === "undefined") return "blinking-underline";
  return window.localStorage.getItem(TERMINAL_CURSOR_STYLE_KEY) ?? "blinking-underline";
}

export function saveTerminalCursorStyle(style: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TERMINAL_CURSOR_STYLE_KEY, style);
}

export function loadAISettings(): AISettings {
  if (typeof window === "undefined") return { ...DEFAULT_AI_SETTINGS };
  try {
    const raw = window.localStorage.getItem(AI_KEY);
    if (!raw) return { ...DEFAULT_AI_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AISettings> & { model?: string };
    const legacy =
      typeof parsed.model === "string" && parsed.model.trim() !== "" ? parsed.model : "";
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
        parsed.provider && AI_PROVIDERS.some((p) => p.id === parsed.provider)
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

/** Default ON — user can disable anytime in Privacy settings */
export function loadTelemetryEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = window.localStorage.getItem(TELEMETRY_ENABLED_KEY);
  if (v === null) return true;
  return v === "true";
}

export function saveTelemetryEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TELEMETRY_ENABLED_KEY, String(enabled));
}
