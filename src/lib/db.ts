import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import os from "os";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

const dbPath =
  process.env.NODE_ENV === "production"
    ? path.join(process.cwd(), "database.sqlite")
    : path.join(os.tmpdir(), "carbon-database.sqlite");

let dbInstance: ReturnType<typeof Database> | null = null;

/** Opens SQLite on first use so `next build` never loads the native addon (wrong ABI vs Electron). */
export function getDb(): ReturnType<typeof Database> {
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
    throw new Error("SQLite is not initialized during Next.js production build");
  }
  if (dbInstance) return dbInstance;
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    dbInstance = new Database(dbPath);
    dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS logs (
            id TEXT PRIMARY KEY,
            ts INTEGER NOT NULL,
            level TEXT NOT NULL,
            source TEXT NOT NULL,
            message TEXT NOT NULL
        )
    `);
    return dbInstance;
  } catch (error) {
    console.error("Failed to initialize SQLite database:", error);
    throw error;
  }
}
