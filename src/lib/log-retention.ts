import type { LogEntry } from "@/lib/types";

export type LogRetention = "6h" | "24h" | "3d" | "7d" | "off";

export const DEFAULT_LOG_RETENTION: LogRetention = "3d";

export const LOG_RETENTION_OPTIONS: readonly { id: LogRetention; label: string }[] = [
  { id: "6h", label: "6 hours" },
  { id: "24h", label: "24 hours" },
  { id: "3d", label: "3 days" },
  { id: "7d", label: "7 days" },
  { id: "off", label: "Turn off (not recommended)" },
];

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** Duration to keep logs; `null` when logging is off (no retention window applies to new writes). */
export function retentionCutoffMs(choice: LogRetention, nowMs: number): number | null {
  switch (choice) {
    case "off":
      return null;
    case "6h":
      return nowMs - 6 * HOUR_MS;
    case "24h":
      return nowMs - 24 * HOUR_MS;
    case "3d":
      return nowMs - 3 * DAY_MS;
    case "7d":
      return nowMs - 7 * DAY_MS;
    default:
      return nowMs - 3 * DAY_MS;
  }
}

export function pruneLogsToRetention(
  logs: LogEntry[],
  choice: LogRetention,
  nowMs = Date.now(),
): LogEntry[] {
  if (choice === "off") return logs;
  const min = retentionCutoffMs(choice, nowMs);
  if (min == null) return logs;
  return logs.filter((l) => l.ts >= min);
}
