import { useSyncExternalStore } from "react";
import { getThemeById, THEMES, DEFAULT_THEME_ID } from "@/config/themes";
import {
  getFontById,
  getTerminalFontById,
  DEFAULT_FONT_ID,
  DEFAULT_TERMINAL_FONT_ID,
} from "@/config/fonts";
import { applyThemeToDocument } from "@/lib/theme-document";
import { DEFAULT_AI_SETTINGS, type AISettings } from "./ai";
import {
  getCredentialStorageAdapter,
  normalizeAuthType,
  type ConnectionSecrets,
} from "./credentials";
import {
  DEFAULT_LOG_RETENTION,
  pruneLogsToRetention,
  retentionCutoffMs,
  type LogRetention,
} from "./log-retention";
import type {
  Bang,
  Connection,
  ConnectionRuntimeStatus,
  HostGroup,
  LogEntry,
  SplitLayout,
  Tab,
  ThemeId,
} from "./types";
import { SPLIT_LAYOUT_SLOTS } from "./types";
import {
  applyTelemetryPreference,
  trackFeatureUsed,
} from "./telemetry";
import { grantAppUnlock, consumeUnlockGrant } from "./app-lock-gate";
import {
  DEFAULT_ACCESS_SETTINGS,
  loadAccessSettings,
  loadConnectionsAsync,
  saveConnectionsAsync,
  loadAISettings,
  loadBangs,
  loadConnections,
  loadFont,
  loadTerminalFont,
  loadGroups,
  loadLogRetention,
  loadTerminalCursorStyle,
  loadTheme,
  saveAISettings,
  saveBangs,
  saveConnections,
  saveFont,
  saveTerminalFont,
  saveTerminalCursorStyle,
  saveGroups,
  saveLogRetention,
  saveAccessSettings,
  saveTheme,
  type AccessSettings,
  uid,
  loadTelemetryEnabled,
  saveTelemetryEnabled,
  loadTabBarOrientation,
  saveTabBarOrientation,
  loadSidebarCollapsed,
  saveSidebarCollapsed,
  loadSidebarWidth,
  saveSidebarWidth,
  loadClosedTabs,
  saveClosedTabs,
  wipeAllCarbonLocalData,
  clearStoredAppPassword,
  type TabBarOrientation,
  loadOnboardingCompleted,
  saveOnboardingCompleted,
  loadPinchZoomEnabled,
  savePinchZoomEnabled,
} from "./storage";

interface State {
  connections: Connection[];
  connectionStatus: Record<string, ConnectionRuntimeStatus>;
  tabSessionStatus: Record<string, ConnectionRuntimeStatus>;
  groups: HostGroup[];
  tabs: Tab[];
  activeTabId: string | null;
  logs: LogEntry[];
  bottomOpen: boolean;
  bangs: Bang[];
  theme: ThemeId;
  font: string;
  terminalFont: string;
  settingsOpen: boolean;
  largeSettingsOpen: boolean;
  ai: AISettings;
  logRetention: LogRetention;
  settingsTab: "general" | "shortcuts" | "logs" | "bangs" | "display" | "ai" | "security" | "about";
  settingsOpenCount: number;
  selectedHostId: string | null;
  closedTabs: string[];
  zoomLevel: number;
  autoOpenTabs: boolean;
  terminalCursorStyle: string;
  isUnlocked: boolean;
  access: AccessSettings;
  telemetryEnabled: boolean;
  tabBarOrientation: TabBarOrientation;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  splitTabIds: string[];
  splitLayout: SplitLayout;
  splitColRatio: number;
  splitRowRatio: number;
  onboardingCompleted: boolean;
  pinchZoomEnabled: boolean;
}

/** Default UI scale: 100% in Electron; 110% in the browser. */
export function getDefaultInterfaceZoom(): number {
  if (typeof window === "undefined") return 110;
  return (window as any).electron?.setZoomLevel ? 105 : 110;
}

let state: State = {
  connections: [],
  connectionStatus: {},
  tabSessionStatus: {},
  groups: [],
  tabs: [],
  activeTabId: null,
  logs: [],
  bottomOpen: false,
  bangs: [],
  theme: DEFAULT_THEME_ID,
  font: DEFAULT_FONT_ID,
  terminalFont: DEFAULT_TERMINAL_FONT_ID,
  settingsOpen: false,
  largeSettingsOpen: false,
  ai: { ...DEFAULT_AI_SETTINGS },
  logRetention: DEFAULT_LOG_RETENTION,
  settingsTab: "display",
  settingsOpenCount: 0,
  selectedHostId: null,
  closedTabs: [],
  zoomLevel: 105,
  autoOpenTabs: true,
  terminalCursorStyle: "blinking-underline",
  isUnlocked: false,
  access: { ...DEFAULT_ACCESS_SETTINGS },
  telemetryEnabled: true,
  tabBarOrientation: "horizontal",
  sidebarCollapsed: false,
  sidebarWidth: 140,
  splitTabIds: [],
  splitLayout: "two-columns" as SplitLayout,
  splitColRatio: 0.5,
  splitRowRatio: 0.5,
  onboardingCompleted: false,
  pinchZoomEnabled: false,
};

const SETTINGS_OPEN_COUNT_KEY = "ssh.settings-open-count.v1";

let initialized = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const next = typeof patch === "function" ? patch(state) : patch;
  const oldTabs = state.tabs;
  state = { ...state, ...next };

  if (state.autoOpenTabs && next.tabs !== undefined && next.tabs !== oldTabs) {
    const ids = state.tabs.map((t) => t.connectionId);
    localStorage.setItem("ssh.last-tabs.v1", JSON.stringify(ids));
  }

  emit();
}

function getDefaultSettingsTabForCount(count: number) {
  return count < 3 ? "display" : ("general" as const);
}

function applyTheme(t: ThemeId) {
  applyThemeToDocument(t);
}

function applyFont(id: string) {
  if (typeof document === "undefined") return;
  const font = getFontById(id);
  document.documentElement.style.setProperty("--font-sans", font.stack);
}

function applyTerminalFont(id: string) {
  if (typeof document === "undefined") return;
  const font = getTerminalFontById(id);
  document.documentElement.style.setProperty("--font-mono", font.stack);
}

function getRestoredTabsState(connections: Connection[], currentState: State) {
  if (!currentState.autoOpenTabs || currentState.tabs.length > 0) return {};
  try {
    const last = JSON.parse(localStorage.getItem("ssh.last-tabs.v1") || "[]") as string[];
    const restoredTabs: Tab[] = last
      .map((cid) => {
        const c = connections.find((x) => x.id === cid);
        if (!c) return null;
        return {
          id: uid(),
          connectionId: c.id,
          title: c.name,
          startedAt: Date.now(),
          commandCount: 0,
        };
      })
      .filter((t): t is Tab => t !== null);

    if (restoredTabs.length > 0) {
      return { tabs: restoredTabs, activeTabId: restoredTabs[0].id };
    }
  } catch (e) {
    console.error("Failed to parse restored tabs", e);
  }
  return {};
}

function ensureInit() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  const theme = loadTheme();
  const font = loadFont();
  const terminalFont = loadTerminalFont();
  const access = loadAccessSettings();
  const tabBarOrientation = loadTabBarOrientation();
  state = {
    ...state,
    connections: [],
    groups: loadGroups(),
    bangs: loadBangs(),
    theme,
    font,
    terminalFont,
    ai: loadAISettings(),
    zoomLevel: Number(localStorage.getItem("ssh.zoom.v1")) || getDefaultInterfaceZoom(),
    autoOpenTabs: localStorage.getItem("ssh.auto-open.v1") !== "false",
    terminalCursorStyle: loadTerminalCursorStyle(),
    settingsOpenCount: Number(localStorage.getItem(SETTINGS_OPEN_COUNT_KEY)) || 0,
    access,
    isUnlocked: !access.appLockEnabled,
    telemetryEnabled: loadTelemetryEnabled(),
    tabBarOrientation,
    sidebarCollapsed: loadSidebarCollapsed(),
    sidebarWidth: loadSidebarWidth(tabBarOrientation),
    closedTabs: loadClosedTabs(),
    onboardingCompleted: loadOnboardingCompleted(),
    pinchZoomEnabled: loadPinchZoomEnabled(),
  };
  applyTheme(theme);
  applyFont(font);
  applyTerminalFont(terminalFont);

  actions.initializeLogs();

  if (typeof window !== "undefined" && (window as any).electron?.setZoomLevel) {
    (window as any).electron.setZoomLevel(state.zoomLevel);
    if ((window as any).electron.setVisualZoomLevelLimits) {
      (window as any).electron.setVisualZoomLevelLimits(1, state.pinchZoomEnabled ? 3 : 1);
    }
  }

  if (!access.appLockEnabled) {
    loadConnectionsAsync().then((connections) => {
      const tabState = getRestoredTabsState(connections, state);
      setState({ connections, ...tabState });
    });
  }

  emit();
}

async function finishUnlock(extra?: Partial<State>) {
  const connections = await loadConnectionsAsync();
  const tabState = getRestoredTabsState(connections, state);
  setState({ isUnlocked: true, connections, ...tabState, ...extra });
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      ensureInit();
      return () => listeners.delete(cb);
    },
    () => selector(state),
    () => selector(state),
  );
}

export const actions = {
  async unlockApp() {
    ensureInit();
    if (state.isUnlocked) return;
    if (state.access.appLockEnabled && !consumeUnlockGrant()) {
      console.warn("[app-lock] unlockApp rejected: authorization required");
      return;
    }
    await finishUnlock();
  },

  /** Call only after password, passkey, or biometric verification succeeded. */
  async unlockAfterVerifiedAuth() {
    ensureInit();
    if (state.isUnlocked) return;
    grantAppUnlock();
    await actions.unlockApp();
  },

  /** Confirmed skip-app-lock flow (onboarding or first-time vault setup). */
  async skipAppLock() {
    ensureInit();
    const access: AccessSettings = { appLockEnabled: false, method: state.access.method };
    saveAccessSettings(access);
    await finishUnlock({ access });
  },

  lockApp() {
    ensureInit();
    if (!state.access.appLockEnabled) return;
    setState({ isUnlocked: false });
  },
  completeOnboarding() {
    ensureInit();
    saveOnboardingCompleted(true);
    setState({ onboardingCompleted: true });
  },
  setAccessSettings(access: AccessSettings) {
    ensureInit();
    if (!state.isUnlocked && state.access.appLockEnabled && !access.appLockEnabled) {
      console.warn("[app-lock] setAccessSettings rejected: cannot disable lock while vault is locked");
      return;
    }
    saveAccessSettings(access);
    setState({ access });
  },
  async upsertConnection(input: Omit<Connection, "id" | "createdAt"> & { id?: string }) {
    ensureInit();
    const adapter = getCredentialStorageAdapter();
    const normalizedAuthType = normalizeAuthType(input.authType as any);
    const normalizedInput = {
      ...input,
      authType: normalizedAuthType,
    };
    const existing = normalizedInput.id
      ? state.connections.find((c) => c.id === normalizedInput.id)
      : null;

    const nextId = existing?.id ?? uid();
    const nextConnection: Connection = {
      ...(existing ?? { createdAt: Date.now() }),
      ...normalizedInput,
      id: nextId,
      createdAt: existing?.createdAt ?? Date.now(),
    };

    const hasExplicitSecretInput =
      normalizedAuthType === "password"
        ? typeof normalizedInput.password === "string" && normalizedInput.password.length > 0
        : (typeof normalizedInput.privateKey === "string" && normalizedInput.privateKey.length > 0) || 
          typeof normalizedInput.passphrase === "string";

    let secretsToPersist: ConnectionSecrets | undefined;
    
    if (adapter.kind === "os-secure-storage" && hasExplicitSecretInput) {
      secretsToPersist = {
        authType: normalizedAuthType,
        password: normalizedAuthType === "password" ? normalizedInput.password : undefined,
        privateKey: normalizedAuthType === "privateKey" ? normalizedInput.privateKey : undefined,
        passphrase: normalizedAuthType === "privateKey" ? normalizedInput.passphrase : undefined,
      };

      // Merge with existing secrets if modifying an existing connection without providing all secrets
      if (existing) {
        try {
          const existingSecrets = await adapter.loadConnectionSecrets(existing);
          if (normalizedAuthType === "password") {
            secretsToPersist.password = secretsToPersist.password || existingSecrets.password;
          } else {
            secretsToPersist.privateKey = secretsToPersist.privateKey || existingSecrets.privateKey;
            secretsToPersist.passphrase = secretsToPersist.passphrase ?? existingSecrets.passphrase;
          }
        } catch (e) {
          console.warn("Failed to load existing secrets for merge", e);
        }
      }
      
      try {
        await adapter.saveConnectionSecrets(nextId, secretsToPersist);
      } catch (error) {
        console.error("Failed to persist connection secrets", error);
        actions.log(
          "error",
          "connections",
          "Failed to persist credentials in secure storage. Please retry.",
        );
        return; // Prevent dropping credentials if secure write fails
      }
    }

    const connectionForState =
      adapter.kind === "os-secure-storage"
        ? {
            ...nextConnection,
            password: undefined,
            privateKey: undefined,
            passphrase: undefined,
          }
        : nextConnection;

    let next: Connection[];
    if (existing) {
      next = state.connections.map((c) =>
        c.id === existing.id ? connectionForState : c,
      );
    } else {
      next = [...state.connections, connectionForState];
    }

    if (window.electron?.saveConnectionMetadata) {
      try {
        await window.electron.saveConnectionMetadata(nextId, {
          id: nextId,
          name: nextConnection.name,
          host: nextConnection.host,
          port: nextConnection.port,
          username: nextConnection.username,
          authType: nextConnection.authType,
        });
      } catch (error) {
        console.error("Failed to persist connection metadata for secure connect flow", error);
      }
    }

    setState({ connections: next });
    void saveConnectionsAsync(next);
    actions.log(
      "info",
      "connections",
      existing ? `Updated ${normalizedInput.name}` : `Saved ${normalizedInput.name}`,
    );
  },

  addGroup(input: { name: string }) {
    ensureInit();
    const name = input.name.trim();
    if (!name) return;
    const group: HostGroup = { id: uid(), name };
    const next = [...state.groups, group];
    setState({ groups: next });
    saveGroups(next);
    actions.log("info", "groups", `Created group "${name}"`);
  },

  updateGroup(id: string, name: string) {
    ensureInit();
    const trimmed = name.trim();
    if (!trimmed) return;
    const next = state.groups.map((g) => (g.id === id ? { ...g, name: trimmed } : g));
    setState({ groups: next });
    saveGroups(next);
    actions.log("info", "groups", `Renamed group to "${trimmed}"`);
  },

  /** Drop the group and unassign its hosts (hosts remain). */
  removeGroupOnly(groupId: string) {
    ensureInit();
    const g = state.groups.find((x) => x.id === groupId);
    if (!g) return;
    const nextGroups = state.groups.filter((x) => x.id !== groupId);
    const nextConnections = state.connections.map((c) =>
      c.groupId === groupId ? { ...c, groupId: undefined } : c,
    );
    setState({ groups: nextGroups, connections: nextConnections });
    saveGroups(nextGroups);
    saveConnectionsAsync(nextConnections);
    actions.log("warn", "groups", `Removed group "${g.name}" (hosts kept)`);
  },

  /** Delete the group and every host that belonged to it. */
  removeGroupAndDeleteHosts(groupId: string) {
    ensureInit();
    const adapter = getCredentialStorageAdapter();
    const g = state.groups.find((x) => x.id === groupId);
    if (!g) return;
    const removedConnections = state.connections.filter((c) => c.groupId === groupId);
    const toRemove = new Set(removedConnections.map((c) => c.id));
    let connections = state.connections.filter((c) => !toRemove.has(c.id));
    let tabs = state.tabs.filter((t) => !toRemove.has(t.connectionId));
    let activeTabId = state.activeTabId;
    if (activeTabId && !tabs.find((t) => t.id === activeTabId)) {
      activeTabId = tabs[tabs.length - 1]?.id ?? null;
    }
    const nextGroups = state.groups.filter((x) => x.id !== groupId);
    setState({
      groups: nextGroups,
      connections,
      tabs,
      activeTabId,
    });
    saveGroups(nextGroups);
    void saveConnectionsAsync(connections);
    if (adapter.kind === "os-secure-storage") {
      for (const connection of removedConnections) {
        void adapter.deleteConnectionSecrets(connection.id).catch((error) => {
          console.error("Failed to delete secure secret for removed connection", error);
        });
        if (window.electron?.deleteConnectionMetadata) {
          void window.electron.deleteConnectionMetadata(connection.id).catch((error) => {
            console.error("Failed to delete secure metadata for removed connection", error);
          });
        }
      }
    }
    actions.log("warn", "groups", `Removed group "${g.name}" and deleted its hosts`);
  },

  deleteConnection(id: string) {
    ensureInit();
    const adapter = getCredentialStorageAdapter();
    const conn = state.connections.find((c) => c.id === id);
    const next = state.connections.filter((c) => c.id !== id);
    const tabs = state.tabs.filter((t) => t.connectionId !== id);
    let activeTabId = state.activeTabId;
    if (activeTabId && !tabs.find((t) => t.id === activeTabId)) {
      activeTabId = tabs[tabs.length - 1]?.id ?? null;
    }
    setState({ connections: next, tabs, activeTabId });
    void saveConnectionsAsync(next);
    if (adapter.kind === "os-secure-storage") {
      void adapter.deleteConnectionSecrets(id).catch((error) => {
        console.error("Failed to delete secure secret for connection", error);
      });
      if (window.electron?.deleteConnectionMetadata) {
        void window.electron.deleteConnectionMetadata(id).catch((error) => {
          console.error("Failed to delete secure metadata for connection", error);
        });
      }
    }
    if (conn) actions.log("warn", "connections", `Deleted ${conn.name}`);
  },

  openTab(connectionId: string) {
    ensureInit();
    const conn = state.connections.find((c) => c.id === connectionId);
    if (!conn) return;
    if (state.connectionStatus[connectionId]?.state === "connecting") {
      actions.log("warn", conn.name, "Connection attempt already in progress");
      return;
    }
    const tab: Tab = {
      id: uid(),
      connectionId,
      title: conn.name,
      startedAt: Date.now(),
      commandCount: 0,
    };
    setState({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
      settingsOpen: false,
      connectionStatus: {
        ...state.connectionStatus,
        [connectionId]: { state: "connecting", updatedAt: Date.now() },
      },
      tabSessionStatus: {
        ...state.tabSessionStatus,
        [tab.id]: { state: "connecting", updatedAt: Date.now() },
      },
    });
    actions.log("info", conn.name, `Opening session ${tab.title}`);
  },

  setConnectionStatus(connectionId: string, status: Omit<ConnectionRuntimeStatus, "updatedAt">) {
    setState({
      connectionStatus: {
        ...state.connectionStatus,
        [connectionId]: { ...status, updatedAt: Date.now() },
      },
    });
  },

  setTabSessionStatus(tabId: string, status: Omit<ConnectionRuntimeStatus, "updatedAt">) {
    setState({
      tabSessionStatus: {
        ...state.tabSessionStatus,
        [tabId]: { ...status, updatedAt: Date.now() },
      },
    });
  },

  closeTab(id: string) {
    const idx = state.tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const tab = state.tabs[idx];
    const tabs = state.tabs.filter((t) => t.id !== id);
    let activeTabId = state.activeTabId;
    if (activeTabId === id) {
      activeTabId = tabs[idx]?.id ?? tabs[idx - 1]?.id ?? null;
    }
    const connectionId = tab.connectionId;
    const stillOpenForConn = tabs.some((t) => t.connectionId === connectionId);
    const connectionStatus = { ...state.connectionStatus };
    if (!stillOpenForConn) {
      delete connectionStatus[connectionId];
    }
    const tabSessionStatus = { ...state.tabSessionStatus };
    delete tabSessionStatus[id];
    const splitTabIds = state.splitTabIds.filter((sid) => sid !== id);
    const closedTabs = [tab.connectionId, ...state.closedTabs].slice(0, 20);
    setState({
      tabs,
      activeTabId,
      splitTabIds,
      closedTabs,
      connectionStatus,
      tabSessionStatus,
      ...(splitTabIds.length < 2
        ? { splitLayout: "two-columns" as SplitLayout, splitColRatio: 0.5, splitRowRatio: 0.5 }
        : {}),
    });
    saveClosedTabs(closedTabs);
  },

  restoreTab() {
    ensureInit();
    const [lastId, ...rest] = state.closedTabs;
    if (!lastId) return;
    actions.openTab(lastId);
    setState({ closedTabs: rest });
    saveClosedTabs(rest);
  },

  setZoomLevel(level: number) {
    setState({ zoomLevel: level });
    localStorage.setItem("ssh.zoom.v1", String(level));
    if (typeof window !== "undefined" && (window as any).electron?.setZoomLevel) {
      (window as any).electron.setZoomLevel(level);
    }
  },

  resetZoomLevel() {
    ensureInit();
    actions.setZoomLevel(getDefaultInterfaceZoom());
  },

  setAutoOpenTabs(enabled: boolean) {
    setState({ autoOpenTabs: enabled });
    localStorage.setItem("ssh.auto-open.v1", String(enabled));
    if (!enabled) {
      localStorage.removeItem("ssh.last-tabs.v1");
    } else {
      const ids = state.tabs.map((t) => t.connectionId);
      localStorage.setItem("ssh.last-tabs.v1", JSON.stringify(ids));
    }
  },

  setPinchZoomEnabled(enabled: boolean) {
    ensureInit();
    savePinchZoomEnabled(enabled);
    setState({ pinchZoomEnabled: enabled });
    if (typeof window !== "undefined" && (window as any).electron?.setVisualZoomLevelLimits) {
      (window as any).electron.setVisualZoomLevelLimits(1, enabled ? 3 : 1);
    }
  },

  incrementCommandCount(tabId: string) {
    setState((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, commandCount: (t.commandCount || 0) + 1 } : t,
      ),
    }));
  },

  setActiveTab(id: string) {
    setState({ activeTabId: id });
  },

  nextTab() {
    const { tabs, activeTabId } = state;
    const items: (string | null)[] = [null, ...tabs.map((t) => t.id)];
    const idx = items.indexOf(activeTabId);
    const nextIdx = (idx + 1) % items.length;
    setState({ activeTabId: items[nextIdx] });
  },

  prevTab() {
    const { tabs, activeTabId } = state;
    const items: (string | null)[] = [null, ...tabs.map((t) => t.id)];
    const idx = items.indexOf(activeTabId);
    const prevIdx = (idx - 1 + items.length) % items.length;
    setState({ activeTabId: items[prevIdx] });
  },

  goHome() {
    setState({ activeTabId: null, settingsOpen: false });
  },

  toggleBottom() {
    setState((s) => ({ bottomOpen: !s.bottomOpen }));
  },

  toggleSettings() {
    setState((s) => {
      if (s.settingsOpen) {
        return { settingsOpen: false, selectedHostId: null };
      }

      const nextCount = s.settingsOpenCount + 1;
      if (typeof window !== "undefined") {
        localStorage.setItem(SETTINGS_OPEN_COUNT_KEY, String(nextCount));
      }

      return {
        settingsOpen: true,
        settingsTab: getDefaultSettingsTabForCount(nextCount),
        settingsOpenCount: nextCount,
        selectedHostId: null,
      };
    });
  },

  toggleLargeSettings() {
    setState((s) => ({
      largeSettingsOpen: !s.largeSettingsOpen,
      settingsOpen: s.largeSettingsOpen ? s.settingsOpen : false,
    }));
  },

  setSettingsOpen(open: boolean) {
    setState((s) => {
      if (!open || s.settingsOpen) {
        return { settingsOpen: open, selectedHostId: open ? null : s.selectedHostId };
      }

      const nextCount = s.settingsOpenCount + 1;
      if (typeof window !== "undefined") {
        localStorage.setItem(SETTINGS_OPEN_COUNT_KEY, String(nextCount));
      }

      return {
        settingsOpen: true,
        settingsTab: getDefaultSettingsTabForCount(nextCount),
        settingsOpenCount: nextCount,
        selectedHostId: null,
      };
    });
  },

  openSettingsTab(tab: State["settingsTab"]) {
    setState({ settingsOpen: true, settingsTab: tab, selectedHostId: null });
    trackFeatureUsed("settings_tab_opened", { tab });
  },

  setSelectedHostId(id: string | null) {
    setState((s) => ({
      selectedHostId: id,
      settingsOpen: id ? false : s.settingsOpen,
    }));
  },

  async initializeLogs() {
    try {
      const res = await fetch(`/api/logs?retention=${state.logRetention}`);
      const data = await res.json();
      if (data.logs) {
        setState({ logs: data.logs });
      }
    } catch (e) {
      console.error("Failed to load logs from db:", e);
    }
  },

  log(level: LogEntry["level"], source: string, message: string) {
    ensureInit();
    if (state.logRetention === "off") return;
    const now = Date.now();
    const min = retentionCutoffMs(state.logRetention, now);
    if (min == null) return;
    const entry: LogEntry = { id: uid(), ts: now, level, source, message };

    // Save to server SQLite
    fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    }).catch((e) => console.error("Failed to save log:", e));

    setState((s) => {
      const merged = [...s.logs, entry].filter((l) => l.ts >= min);
      return { logs: merged.slice(-499) };
    });
  },

  clearLogs() {
    fetch("/api/logs", { method: "DELETE" }).catch((e) =>
      console.error("Failed to clear logs:", e),
    );
    setState({ logs: [] });
  },

  setLogRetention(r: LogRetention) {
    ensureInit();
    saveLogRetention(r);
    setState((s) => ({
      logRetention: r,
      logs: pruneLogsToRetention(s.logs, r),
    }));
  },

  upsertBang(input: Omit<Bang, "id" | "createdAt"> & { id?: string }) {
    ensureInit();
    const trigger = input.trigger.replace(/^!/, "").trim();
    if (!trigger || !input.command.trim()) return;
    const existing = input.id ? state.bangs.find((b) => b.id === input.id) : null;
    let next: Bang[];
    if (existing) {
      next = state.bangs.map((b) =>
        b.id === existing.id ? { ...existing, ...input, trigger, id: existing.id } : b,
      );
    } else {
      next = [
        ...state.bangs,
        {
          id: uid(),
          trigger,
          command: input.command,
          description: input.description,
          createdAt: Date.now(),
        },
      ];
    }
    setState({ bangs: next });
    saveBangs(next);
  },

  deleteBang(id: string) {
    const next = state.bangs.filter((b) => b.id !== id);
    setState({ bangs: next });
    saveBangs(next);
  },

  setTheme(t: ThemeId) {
    setState({ theme: t });
    saveTheme(t);
    applyTheme(t);
  },

  toggleTheme() {
    const current = getThemeById(state.theme);
    const next = THEMES.find((theme) => theme.type !== current.type)?.id ?? state.theme;
    actions.setTheme(next);
  },

  setFont(id: string) {
    setState({ font: id });
    saveFont(id);
    applyFont(id);
  },

  setTerminalFont(id: string) {
    setState({ terminalFont: id });
    saveTerminalFont(id);
    applyTerminalFont(id);
  },

  setTerminalCursorStyle(style: string) {
    setState({ terminalCursorStyle: style });
    saveTerminalCursorStyle(style);
  },
  updateAI(patch: Partial<AISettings>) {
    ensureInit();
    const next = { ...state.ai, ...patch };
    const provider = (patch.provider ?? state.ai.provider) as string;
    const apiKeyPatch = patch.apiKey;

    if (typeof apiKeyPatch === "string" && window.electron?.saveAiApiKey) {
      void window.electron.saveAiApiKey(provider, apiKeyPatch, next.baseUrl).catch((error) => {
        console.error("Failed to save AI API key in secure storage", error);
      });
      next.apiKey = "";
    }

    setState({ ai: next });
    saveAISettings(next);
  },

  setTelemetryEnabled(enabled: boolean) {
    ensureInit();
    saveTelemetryEnabled(enabled);
    setState({ telemetryEnabled: enabled });
    applyTelemetryPreference();
  },

  setTabBarOrientation(o: TabBarOrientation) {
    ensureInit();
    saveTabBarOrientation(o);
    if (o === "vertical" && state.sidebarWidth < 170) {
      setState({ tabBarOrientation: o, sidebarWidth: 170 });
    } else {
      setState({ tabBarOrientation: o });
    }
  },

  setSidebarCollapsed(v: boolean) {
    ensureInit();
    saveSidebarCollapsed(v);
    setState({ sidebarCollapsed: v });
  },

  toggleSidebarCollapsed() {
    ensureInit();
    const next = !state.sidebarCollapsed;
    saveSidebarCollapsed(next);
    setState({ sidebarCollapsed: next });
  },

  setSidebarWidth(w: number) {
    ensureInit();
    const isVertical = state.tabBarOrientation === "vertical";
    const minW = isVertical ? 100 : 60;
    const clamped = Math.max(minW, Math.min(400, Math.round(w)));
    saveSidebarWidth(clamped);
    setState({ sidebarWidth: clamped });
  },

  /** Browser-style reorder: move one tab to a new index. Split membership is preserved — tabs stay in/out of the split group regardless of where they move. */
  moveTab(tabId: string, rawInsertIndex: number) {
    ensureInit();
    const oldTabs = state.tabs;
    const fromIdx = oldTabs.findIndex((t) => t.id === tabId);
    if (fromIdx === -1) return;

    const tabs = [...oldTabs];
    const [moved] = tabs.splice(fromIdx, 1);
    const clampedRaw = Math.max(0, Math.min(rawInsertIndex, tabs.length));
    const insertAt = fromIdx < clampedRaw ? clampedRaw - 1 : clampedRaw;
    tabs.splice(insertAt, 0, moved);

    // Keep split membership for tabs that were already in the split — just in their new positions.
    // If a non-split tab is dragged between two split tabs it doesn't join.
    const splitSet = new Set(state.splitTabIds);
    const nextSplitIds = tabs.map((t) => t.id).filter((id) => splitSet.has(id));
    if (nextSplitIds.length < 2) {
      setState({
        tabs,
        splitTabIds: [],
        splitLayout: "two-columns",
        splitColRatio: 0.5,
        splitRowRatio: 0.5,
      });
    } else {
      setState({ tabs, splitTabIds: nextSplitIds });
    }
  },

  addToSplit(tabId: string) {
    if (state.splitTabIds.includes(tabId)) return;
    const ids = [...state.splitTabIds, tabId];
    setState({ splitTabIds: ids, activeTabId: tabId });
  },

  removeFromSplit(tabId: string) {
    const ids = state.splitTabIds.filter((id) => id !== tabId);
    let activeTabId = state.activeTabId;
    if (activeTabId === tabId) {
      activeTabId = ids[0] ?? state.tabs[0]?.id ?? null;
    }
    const exitingSplit = ids.length < 2;
    setState({
      splitTabIds: ids,
      activeTabId,
      ...(exitingSplit
        ? { splitLayout: "two-columns" as SplitLayout, splitColRatio: 0.5, splitRowRatio: 0.5 }
        : {}),
    });
  },

  toggleSplit(tabId: string) {
    if (state.splitTabIds.includes(tabId)) {
      actions.removeFromSplit(tabId);
    } else {
      actions.addToSplit(tabId);
    }
  },

  splitAllTabs() {
    actions.applySplitLayout("two-columns");
  },

  applySplitLayout(layout: SplitLayout) {
    ensureInit();
    const slots = SPLIT_LAYOUT_SLOTS[layout];
    const ids = state.tabs.slice(0, slots).map((t) => t.id);
    if (ids.length < 2) return;
    setState({
      splitTabIds: ids,
      splitLayout: layout,
      splitColRatio: 0.5,
      splitRowRatio: 0.5,
      activeTabId: state.activeTabId ?? ids[0],
    });
  },

  clearSplit() {
    setState({
      splitTabIds: [],
      splitLayout: "two-columns" as SplitLayout,
      splitColRatio: 0.5,
      splitRowRatio: 0.5,
    });
  },

  setSplitLayout(layout: SplitLayout) {
    setState({ splitLayout: layout });
  },

  setSplitColRatio(ratio: number) {
    setState({ splitColRatio: Math.max(0.15, Math.min(0.85, ratio)) });
  },

  setSplitRowRatio(ratio: number) {
    setState({ splitRowRatio: Math.max(0.15, Math.min(0.85, ratio)) });
  },

  /** Full local wipe + server activity logs, then reload (fresh onboarding). */
  async fullFactoryResetAndReload() {
    if (typeof window === "undefined") return;
    try {
      await fetch("/api/logs", { method: "DELETE" }).catch(() => {});
    } catch {
      /* ignore */
    }
    try {
      await clearStoredAppPassword();
    } catch {
      /* ignore */
    }
    wipeAllCarbonLocalData();
    window.location.reload();
  },
};
