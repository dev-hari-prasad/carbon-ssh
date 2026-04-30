import { useSyncExternalStore } from "react";
import type { Bang, Connection, LogEntry, Tab, ThemeMode } from "./types";
import {
  loadBangs,
  loadConnections,
  loadTheme,
  saveBangs,
  saveConnections,
  saveTheme,
  uid,
} from "./storage";

interface State {
  connections: Connection[];
  tabs: Tab[];
  activeTabId: string | null;
  logs: LogEntry[];
  bottomOpen: boolean;
  bangs: Bang[];
  theme: ThemeMode;
}

let state: State = {
  connections: [],
  tabs: [],
  activeTabId: null,
  logs: [],
  bottomOpen: true,
  bangs: [],
  theme: "dark",
};

let initialized = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const next = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...next };
  emit();
}

function applyTheme(t: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("light", t === "light");
}

function ensureInit() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  const theme = loadTheme();
  state = {
    ...state,
    connections: loadConnections(),
    bangs: loadBangs(),
    theme,
  };
  applyTheme(theme);
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
    actions.log(
      "info",
      "connections",
      existing ? `Updated ${input.name}` : `Saved ${input.name}`,
    );
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
      title: `${conn.username}@${conn.host}`,
    };
    setState({ tabs: [...state.tabs, tab], activeTabId: tab.id });
    actions.log("info", "session", `Opening session ${tab.title}`);
  },

  closeTab(id: string) {
    const idx = state.tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const tabs = state.tabs.filter((t) => t.id !== id);
    let activeTabId = state.activeTabId;
    if (activeTabId === id) {
      activeTabId = tabs[idx]?.id ?? tabs[idx - 1]?.id ?? null;
    }
    setState({ tabs, activeTabId });
  },

  setActiveTab(id: string) {
    setState({ activeTabId: id });
  },

  toggleBottom() {
    setState((s) => ({ bottomOpen: !s.bottomOpen }));
  },

  log(level: LogEntry["level"], source: string, message: string) {
    const entry: LogEntry = { id: uid(), ts: Date.now(), level, source, message };
    setState((s) => ({ logs: [...s.logs.slice(-499), entry] }));
  },

  clearLogs() {
    setState({ logs: [] });
  },

  upsertBang(input: Omit<Bang, "id" | "createdAt"> & { id?: string }) {
    ensureInit();
    const trigger = input.trigger.replace(/^!/, "").trim();
    if (!trigger || !input.command.trim()) return;
    const existing = input.id ? state.bangs.find((b) => b.id === input.id) : null;
    let next: Bang[];
    if (existing) {
      next = state.bangs.map((b) =>
        b.id === existing.id
          ? { ...existing, ...input, trigger, id: existing.id }
          : b,
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

  setTheme(t: ThemeMode) {
    setState({ theme: t });
    saveTheme(t);
    applyTheme(t);
  },

  toggleTheme() {
    actions.setTheme(state.theme === "dark" ? "light" : "dark");
  },
};
