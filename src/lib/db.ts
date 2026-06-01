import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import os from "os";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

import type { LogEntry } from "@/lib/types";

const dbPath = process.env.DB_PATH || (
  process.env.NODE_ENV === "production"
    ? path.join(process.cwd(), "database.sqlite")
    : path.join(os.tmpdir(), "carbon-database.sqlite")
);

const jsonFallbackPath = dbPath.replace(/\.sqlite$/i, "-logs.json");

/** Max rows kept on disk (matches GET limit behaviour). */
const MAX_STORED_LOGS = 500;

export interface LogsPersistence {
  selectOrdered(limit: number): LogEntry[];
  insert(entry: LogEntry): void;
  deleteAll(): void;
}

let persistence: LogsPersistence | null = null;
let jsonLogsCache: LogEntry[] | null = null;
let jsonWriteQueue: Promise<void> = Promise.resolve();

function isBindingsMissingError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("Could not locate the bindings file") ||
    msg.includes("better_sqlite3.node") ||
    msg.includes("NODE_MODULE_VERSION")
  );
}

type SqliteDatabase = InstanceType<typeof Database>;

function tryOpenSqlite(): SqliteDatabase {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const db = new Database(dbPath);
  db.exec(`
        CREATE TABLE IF NOT EXISTS logs (
            id TEXT PRIMARY KEY,
            ts INTEGER NOT NULL,
            level TEXT NOT NULL,
            source TEXT NOT NULL,
            message TEXT NOT NULL
        )
    `);
  return db;
}

function readJsonLogs(): LogEntry[] {
  if (jsonLogsCache) return [...jsonLogsCache];
  try {
    if (!fs.existsSync(jsonFallbackPath)) {
      jsonLogsCache = [];
      return [];
    }
    const raw = fs.readFileSync(jsonFallbackPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    jsonLogsCache = Array.isArray(parsed) ? (parsed as LogEntry[]) : [];
    return [...jsonLogsCache];
  } catch {
    jsonLogsCache = [];
    return [];
  }
}

function writeJsonLogs(logs: LogEntry[]) {
  jsonLogsCache = [...logs];
  const dir = path.dirname(jsonFallbackPath);
  const serialized = JSON.stringify(logs);
  const tmp = `${jsonFallbackPath}.tmp`;

  jsonWriteQueue = jsonWriteQueue
    .catch(() => {})
    .then(async () => {
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(tmp, serialized, "utf8");
      await fs.promises.rename(tmp, jsonFallbackPath);
    })
    .catch((error) => {
      console.error("[db] Failed to persist JSON logs:", error);
    });
}

function sqlitePersistence(db: SqliteDatabase): LogsPersistence {
  return {
    selectOrdered(limit: number) {
      return db.prepare("SELECT * FROM logs ORDER BY ts ASC LIMIT ?").all(limit) as LogEntry[];
    },
    insert(entry: LogEntry) {
      db
        .prepare(
          `INSERT INTO logs (id, ts, level, source, message)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(entry.id, entry.ts, entry.level, String(entry.source), String(entry.message));
    },
    deleteAll() {
      db.prepare("DELETE FROM logs").run();
    },
  };
}

function jsonPersistence(): LogsPersistence {
  return {
    selectOrdered(limit: number) {
      const logs = readJsonLogs().sort((a, b) => a.ts - b.ts);
      return logs.slice(-limit);
    },
    insert(entry: LogEntry) {
      const next = [...readJsonLogs(), entry].sort((a, b) => a.ts - b.ts);
      writeJsonLogs(next.slice(-MAX_STORED_LOGS));
    },
    deleteAll() {
      writeJsonLogs([]);
    },
  };
}

/**
 * Log storage: prefers SQLite via better-sqlite3 when native bindings load.
 * Falls back to a JSON file (same tmpdir / cwd as the DB path) when bindings
 * are missing or compilation failed — common on Windows without VS Build Tools.
 */
export function getLogsPersistence(): LogsPersistence {
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
    throw new Error("Logs persistence is not initialized during Next.js production build");
  }
  if (persistence) return persistence;

  try {
    persistence = sqlitePersistence(tryOpenSqlite());
    return persistence;
  } catch (err) {
    if (!isBindingsMissingError(err)) {
      console.error("Failed to initialize SQLite database:", err);
      throw err;
    }
    console.warn(
      "[db] better-sqlite3 native addon unavailable; using JSON log store at",
      jsonFallbackPath,
      "(install Visual Studio Build Tools + run `pnpm rebuild better-sqlite3` to use SQLite)",
    );
    persistence = jsonPersistence();
    return persistence;
  }
}
