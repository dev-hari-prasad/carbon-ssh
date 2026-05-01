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
  DEFAULT_LOG_RETENTION,
  pruneLogsToRetention,
  retentionCutoffMs,
  type LogRetention,
} from "./log-retention";
import type { Bang, Connection, HostGroup, LogEntry, Tab, ThemeId } from "./types";
import {
  loadAISettings,
  loadBangs,
  loadConnections,
  loadFont,
  loadTerminalFont,
  loadGroups,
  loadLogRetention,
  loadTheme,
  saveAISettings,
  saveBangs,
  saveConnections,
  saveFont,
  saveTerminalFont,
  saveGroups,
  saveLogRetention,
  saveTheme,
  uid,
} from "./storage";

interface State {
  connections: Connection[];
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
  ai: AISettings;
  logRetention: LogRetention;
  settingsTab: "general" | "shortcuts" | "logs" | "bangs" | "display" | "ai";
  selectedHostId: string | null;
  closedTabs: string[];
  zoomLevel: number;
  autoOpenTabs: boolean;
}

let state: State = {
  connections: [],
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
  ai: { ...DEFAULT_AI_SETTINGS },
  logRetention: DEFAULT_LOG_RETENTION,
  settingsTab: "display",
  selectedHostId: null,
  closedTabs: [],
  zoomLevel: 110,
  autoOpenTabs: true,
};

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

function ensureInit() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  const theme = loadTheme();
  const font = loadFont();
  const terminalFont = loadTerminalFont();
  state = {
    ...state,
    connections: loadConnections(),
    groups: loadGroups(),
    bangs: loadBangs(),
    theme,
    font,
    terminalFont,
    ai: loadAISettings(),
    zoomLevel: Number(localStorage.getItem("ssh.zoom.v1")) || 110,
    autoOpenTabs: localStorage.getItem("ssh.auto-open.v1") !== "false",
  };
  applyTheme(theme);
  applyFont(font);
  applyTerminalFont(terminalFont);
  
  if (typeof window !== "undefined" && (window as any).electron?.setZoomLevel) {
    (window as any).electron.setZoomLevel(state.zoomLevel);
  }

  // Restore last tabs if enabled
  if (state.autoOpenTabs) {
    const last = JSON.parse(localStorage.getItem("ssh.last-tabs.v1") || "[]") as string[];
    const connections = state.connections;
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
    state.tabs = restoredTabs;
    if (restoredTabs.length > 0) {
      state.activeTabId = restoredTabs[0].id;
    }
  }

  emit();
}

export function useStore<T>(selector: (s: State) => T): T {
  ensureInit();
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(state),
    () => selector(state),
  );
}

export const actions = {
  upsertConnection(input: Omit<Connection, "id" | "createdAt"> & { id?: string }) {
    ensureInit();
    const existing = input.id ? state.connections.find((c) => c.id === input.id) : null;
    let next: Connection[];
    if (existing) {
      next = state.connections.map((c) =>
        c.id === existing.id ? { ...existing, ...input, id: existing.id } : c,
      );
    } else {
      const conn: Connection = { ...input, id: uid(), createdAt: Date.now() };
      next = [...state.connections, conn];
    }
    setState({ connections: next });
    saveConnections(next);
    actions.log("info", "connections", existing ? `Updated ${input.name}` : `Saved ${input.name}`);
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
    saveConnections(nextConnections);
    actions.log("warn", "groups", `Removed group "${g.name}" (hosts kept)`);
  },

  /** Delete the group and every host that belonged to it. */
  removeGroupAndDeleteHosts(groupId: string) {
    ensureInit();
    const g = state.groups.find((x) => x.id === groupId);
    if (!g) return;
    const toRemove = new Set(
      state.connections.filter((c) => c.groupId === groupId).map((c) => c.id),
    );
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
    saveConnections(connections);
    actions.log("warn", "groups", `Removed group "${g.name}" and deleted its hosts`);
  },

  deleteConnection(id: string) {
    ensureInit();
    const conn = state.connections.find((c) => c.id === id);
    const next = state.connections.filter((c) => c.id !== id);
    const tabs = state.tabs.filter((t) => t.connectionId !== id);
    let activeTabId = state.activeTabId;
    if (activeTabId && !tabs.find((t) => t.id === activeTabId)) {
      activeTabId = tabs[tabs.length - 1]?.id ?? null;
    }
    setState({ connections: next, tabs, activeTabId });
    saveConnections(next);
    if (conn) actions.log("warn", "connections", `Deleted ${conn.name}`);
  },

  openTab(connectionId: string) {
    ensureInit();
    const conn = state.connections.find((c) => c.id === connectionId);
    if (!conn) return;
    const tab: Tab = {
      id: uid(),
      connectionId,
      title: conn.name,
      startedAt: Date.now(),
      commandCount: 0,
    };
    setState({ tabs: [...state.tabs, tab], activeTabId: tab.id, settingsOpen: false });
    actions.log("info", conn.name, `Opening session ${tab.title}`);
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
    setState({
      tabs,
      activeTabId,
      closedTabs: [tab.connectionId, ...state.closedTabs].slice(0, 20),
    });
  },

  restoreTab() {
    ensureInit();
    const [lastId, ...rest] = state.closedTabs;
    if (!lastId) return;
    actions.openTab(lastId);
    setState({ closedTabs: rest });
  },

  setZoomLevel(level: number) {
    setState({ zoomLevel: level });
    localStorage.setItem("ssh.zoom.v1", String(level));
    if (typeof window !== "undefined" && (window as any).electron?.setZoomLevel) {
      (window as any).electron.setZoomLevel(level);
    }
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
    setState((s) => ({ settingsOpen: !s.settingsOpen, selectedHostId: null }));
  },

  setSettingsOpen(open: boolean) {
    setState((s) => ({ settingsOpen: open, selectedHostId: open ? null : s.selectedHostId }));
  },

  openSettingsTab(tab: State["settingsTab"]) {
    setState({ settingsOpen: true, settingsTab: tab });
  },

  setSelectedHostId(id: string | null) {
    setState((s) => ({
      selectedHostId: id,
      settingsOpen: id ? false : s.settingsOpen,
    }));
  },

  log(level: LogEntry["level"], source: string, message: string) {
    ensureInit();
    if (state.logRetention === "off") return;
    const now = Date.now();
    const min = retentionCutoffMs(state.logRetention, now);
    if (min == null) return;
    const entry: LogEntry = { id: uid(), ts: now, level, source, message };
    setState((s) => {
      const merged = [...s.logs, entry].filter((l) => l.ts >= min);
      return { logs: merged.slice(-499) };
    });
  },

  clearLogs() {
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

  updateAI(patch: Partial<AISettings>) {
    ensureInit();
    const next = { ...state.ai, ...patch };
    setState({ ai: next });
    saveAISettings(next);
  },
};
