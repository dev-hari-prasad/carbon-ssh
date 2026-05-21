import { DEFAULT_THEME_ID, THEMES } from "@/config/themes";
import { AI_PROVIDERS, DEFAULT_AI_SETTINGS, type AISettings } from "./ai";
import type { Bang, Connection, HostGroup, ThemeId } from "./types";
import {
  getCredentialStorageAdapter,
  normalizeAuthType,
  pickConnectionSecrets,
} from "./credentials";
import { stripConnectionSecrets, stripConnectionsSecrets } from "./secret-stripping";
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
const TAB_BAR_ORIENTATION_KEY = "ssh.tab-bar-orientation.v1";
const SIDEBAR_COLLAPSED_KEY = "ssh.sidebar-collapsed.v1";
const SIDEBAR_WIDTH_KEY = "ssh.sidebar-width.v1";
const CLOSED_TABS_KEY = "ssh.closed-tabs.v1";
const ONBOARDING_COMPLETED_KEY = "ssh.onboarding-completed.v1";

const APP_LOCK_BROWSER_PREFIX = "apw1:";
const PBKDF2_ITERATIONS_BROWSER = 310_000;

type BrowserPwEnvelopeV1 = {
  v: 1;
  alg: "PBKDF2-SHA256";
  iterations: number;
  saltHex: string;
  hashHex: string;
};

const VALID_LOG_RETENTION = new Set<LogRetention>(["24h", "3d", "7d", "30d", "90d", "1y", "off"]);

async function syncConnectionMetadataToElectron(connections: Connection[]): Promise<void> {
  if (!window.electron?.saveConnectionMetadata) return;
  for (const connection of connections) {
    try {
      await window.electron.saveConnectionMetadata(connection.id, {
        id: connection.id,
        name: connection.name,
        host: connection.host,
        port: connection.port,
        username: connection.username,
        authType: normalizeAuthType(connection.authType as any),
      });
    } catch {
      // Best effort sync. Connection metadata still lives in local storage.
    }
  }
}

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

function hexFromBytes(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array | null {
  if (typeof hex !== "string" || !/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function timingSafeHexEqual(left: string, right: string): boolean {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (!/^[0-9a-f]+$/.test(a) || !/^[0-9a-f]+$/.test(b)) return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function serializeBrowserEnvelope(env: BrowserPwEnvelopeV1): string {
  return APP_LOCK_BROWSER_PREFIX + btoa(JSON.stringify(env));
}

function parseBrowserEnvelope(raw: string): BrowserPwEnvelopeV1 | null {
  if (!raw.startsWith(APP_LOCK_BROWSER_PREFIX)) return null;
  try {
    const json = JSON.parse(atob(raw.slice(APP_LOCK_BROWSER_PREFIX.length))) as unknown;
    if (!json || typeof json !== "object") return null;
    const obj = json as Record<string, unknown>;
    if (obj.v !== 1 || obj.alg !== "PBKDF2-SHA256") return null;
    if (
      typeof obj.saltHex !== "string" ||
      typeof obj.hashHex !== "string" ||
      typeof obj.iterations !== "number"
    ) {
      return null;
    }
    return json as BrowserPwEnvelopeV1;
  } catch {
    return null;
  }
}

async function hashPasswordBrowser(password: string): Promise<BrowserPwEnvelopeV1> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder().encode(password);
  const imported = await crypto.subtle.importKey("raw", enc, "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS_BROWSER,
    },
    imported,
    256,
  );
  return {
    v: 1,
    alg: "PBKDF2-SHA256",
    iterations: PBKDF2_ITERATIONS_BROWSER,
    saltHex: hexFromBytes(salt),
    hashHex: hexFromBytes(new Uint8Array(derived)),
  };
}

async function verifyPasswordBrowser(candidate: string, storedEnvelopeRaw: string): Promise<boolean> {
  const envelope = parseBrowserEnvelope(storedEnvelopeRaw);
  if (!envelope) return false;
  const salt = hexToBytes(envelope.saltHex);
  if (!salt) return false;
  const enc = new TextEncoder().encode(candidate);
  const imported = await crypto.subtle.importKey("raw", enc, "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt as unknown as BufferSource,
      iterations: envelope.iterations,
    },
    imported,
    256,
  );
  return timingSafeHexEqual(hexFromBytes(new Uint8Array(derived)), envelope.hashHex);
}

export async function savePasswordAccess(password: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.electron?.setAppLockPassword) {
    await window.electron.setAppLockPassword(password);
    window.localStorage.removeItem(TEMP_PASSWORD_KEY);
  } else {
    const env = await hashPasswordBrowser(password);
    window.localStorage.setItem(TEMP_PASSWORD_KEY, serializeBrowserEnvelope(env));
  }
  saveAccessSettings({ appLockEnabled: true, method: "password" });
}

export async function verifyAppLockPassword(candidate: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.electron?.verifyAppLockPassword) {
    return window.electron.verifyAppLockPassword(candidate);
  }
  const stored = window.localStorage.getItem(TEMP_PASSWORD_KEY);
  if (!stored) return false;
  return verifyPasswordBrowser(candidate, stored);
}

export async function clearStoredAppPassword(): Promise<void> {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TEMP_PASSWORD_KEY);
  try {
    if (window.electron?.clearAppLockPassword) {
      await window.electron.clearAppLockPassword();
    }
  } catch {
    /* ignore */
  }
}

export function saveAccessSettings(settings: AccessSettings) {
  if (typeof window === "undefined") return;
  if (!settings.appLockEnabled) {
    window.localStorage.setItem(VAULT_SETUP_KEY, "disabled");
    void clearStoredAppPassword();
    return;
  }
  window.localStorage.setItem(
    VAULT_SETUP_KEY,
    settings.method === "password" ? "password" : "biometric",
  );
}

export async function migrateAppLockPasswordIfNeeded(): Promise<void> {
  if (typeof window === "undefined") return;
  const raw = window.localStorage.getItem(TEMP_PASSWORD_KEY);
  if (!raw) return;

  if (raw.startsWith(APP_LOCK_BROWSER_PREFIX)) {
    if (parseBrowserEnvelope(raw)) return;
    console.warn("[storage] Corrupt app-lock browser envelope; skipping migration.");
    return;
  }

  if (window.localStorage.getItem(VAULT_SETUP_KEY) !== "password") return;

  try {
    if (window.electron?.setAppLockPassword) {
      await window.electron.setAppLockPassword(raw);
      window.localStorage.removeItem(TEMP_PASSWORD_KEY);
    } else {
      const env = await hashPasswordBrowser(raw);
      window.localStorage.setItem(TEMP_PASSWORD_KEY, serializeBrowserEnvelope(env));
    }
  } catch (e) {
    console.error("App lock password migration failed", e);
  }
}

export async function savePasskeyAccess(provider: "electron" | "webauthn", credentialId?: string) {
  if (typeof window === "undefined") return;
  await clearStoredAppPassword();
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

    const adapter = getCredentialStorageAdapter();
    if (adapter.kind === "local-development") {
      const connections = parsed
        .filter((rawConnection) => rawConnection && typeof rawConnection === "object")
        .map((rawConnection) => {
          const candidate = rawConnection as Connection;
          return {
            ...candidate,
            authType: normalizeAuthType(candidate.authType as any),
          } as Connection;
        })
        .filter((connection) => typeof connection.id === "string" && connection.id.length > 0);
      await syncConnectionMetadataToElectron(connections);
      return connections;
    }

    const sanitizedConnections: Connection[] = [];
    let migratedLegacySecrets = false;

    for (const rawConnection of parsed) {
      if (!rawConnection || typeof rawConnection !== "object") continue;

      const candidate = rawConnection as Connection;
      if (typeof candidate.id !== "string" || !candidate.id) continue;

      const normalizedConnection: Connection = {
        ...candidate,
        authType: normalizeAuthType(candidate.authType as any),
      };
      const hadLegacySecrets = Boolean(
        normalizedConnection.password ||
          normalizedConnection.privateKey ||
          normalizedConnection.passphrase,
      );

      if (hadLegacySecrets && adapter.kind === "os-secure-storage") {
        try {
          await adapter.saveConnectionSecrets(
            normalizedConnection.id,
            pickConnectionSecrets(normalizedConnection),
          );
          migratedLegacySecrets = true;
          sanitizedConnections.push(stripConnectionSecrets(normalizedConnection));
        } catch (e) {
          console.error("Migration failed for connection", normalizedConnection.id, e);
          // push the unstripped connection so it is not corrupted and can be retried
          sanitizedConnections.push(normalizedConnection);
        }
      } else {
        sanitizedConnections.push(stripConnectionSecrets(normalizedConnection));
      }
    }

    if (migratedLegacySecrets) {
      await saveConnectionsAsync(sanitizedConnections);
    }
    await syncConnectionMetadataToElectron(sanitizedConnections);

    return sanitizedConnections;
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
    const adapter = getCredentialStorageAdapter();
    const normalizedConnections = list.map((connection) => ({
      ...connection,
      authType: normalizeAuthType(connection.authType as any),
    }));

    const raw =
      adapter.kind === "local-development"
        ? JSON.stringify(
            normalizedConnections.map((connection) => ({
              ...connection,
              ...pickConnectionSecrets(connection),
            })),
          )
        : JSON.stringify(stripConnectionsSecrets(normalizedConnections));
    let encrypted = raw;
    if (window.electron?.encryptString) {
      encrypted = await window.electron.encryptString(raw);
    }
    window.localStorage.setItem(KEY, encrypted);
    await syncConnectionMetadataToElectron(normalizedConnections);
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
  const raw = window.localStorage.getItem(FONT_KEY) ?? "manrope";
  if (raw === "geist") {
    window.localStorage.setItem(FONT_KEY, "manrope");
    return "manrope";
  }
  return raw;
}

export function saveFont(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FONT_KEY, id);
}

export function loadTerminalFont(): string {
  if (typeof window === "undefined") return "jetbrains-mono";
  const raw = window.localStorage.getItem(TERMINAL_FONT_KEY) ?? "jetbrains-mono";
  if (raw === "google-sans-code") {
    window.localStorage.setItem(TERMINAL_FONT_KEY, "geist-mono");
    return "geist-mono";
  }
  return raw;
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
    if (typeof parsed.apiKey === "string" && parsed.apiKey && window.electron?.saveAiApiKey) {
      window.electron
        .saveAiApiKey(
          typeof parsed.provider === "string" ? parsed.provider : DEFAULT_AI_SETTINGS.provider,
          parsed.apiKey,
          typeof parsed.baseUrl === "string" ? parsed.baseUrl : ""
        )
        .then(() => {
          const { apiKey: _migrated, ...publicSettings } = parsed;
          window.localStorage.setItem(AI_KEY, JSON.stringify(publicSettings));
        })
        .catch((e) => {
          console.error("AI Key migration failed", e);
        });
    }
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
      apiKey: "",
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
  const { apiKey: _ignoredApiKey, ...publicSettings } = s;
  window.localStorage.setItem(AI_KEY, JSON.stringify(publicSettings));
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

export type TabBarOrientation = "horizontal" | "vertical";

export function loadTabBarOrientation(): TabBarOrientation {
  if (typeof window === "undefined") return "horizontal";
  const v = window.localStorage.getItem(TAB_BAR_ORIENTATION_KEY);
  if (v === "vertical") return "vertical";
  return "horizontal";
}

export function saveTabBarOrientation(o: TabBarOrientation): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TAB_BAR_ORIENTATION_KEY, o);
}

export function loadSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
}

export function saveSidebarCollapsed(v: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(v));
}

export function loadSidebarWidth(orientation?: TabBarOrientation): number {
  if (typeof window === "undefined") return orientation === "vertical" ? 200 : 140;
  const v = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY));
  if (orientation === "vertical") {
    return v >= 140 && v <= 400 ? v : 200;
  }
  return v >= 60 && v <= 400 ? v : 140;
}

export function saveSidebarWidth(w: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w));
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

export function loadClosedTabs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CLOSED_TABS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => typeof id === "string");
  } catch {
    return [];
  }
}

export function saveClosedTabs(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CLOSED_TABS_KEY, JSON.stringify(ids));
}

export function loadOnboardingCompleted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ONBOARDING_COMPLETED_KEY) === "true";
}

export function saveOnboardingCompleted(completed: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ONBOARDING_COMPLETED_KEY, String(completed));
}

/** localStorage key prefixes owned by Carbon / bundled analytics on this origin (factory reset). */
const WIPE_LOCAL_PREFIXES = ["ssh.", "carbon.", "ph_"] as const;

/** Removes all Carbon app data from localStorage (and sessionStorage). Reload the app after calling. */
export function wipeAllCarbonLocalData(): void {
  if (typeof window === "undefined") return;
  try {
    const keys = Object.keys(window.localStorage);
    for (const k of keys) {
      if (WIPE_LOCAL_PREFIXES.some((p) => k.startsWith(p))) {
        window.localStorage.removeItem(k);
      }
    }
  } catch {
    /* ignore */
  }
  try {
    window.sessionStorage.clear();
  } catch {
    /* ignore */
  }
}
