import type { Bang, Connection, ThemeMode } from "./types";

const KEY = "ssh.connections.v1";
const BANGS_KEY = "ssh.bangs.v1";
const THEME_KEY = "ssh.theme.v1";

export function loadConnections(): Connection[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
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

export function loadTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const v = window.localStorage.getItem(THEME_KEY);
  return v === "light" ? "light" : "dark";
}

export function saveTheme(t: ThemeMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_KEY, t);
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
