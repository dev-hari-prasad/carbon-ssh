/**
 * Cross-platform pre-build cleanup for Electron outputs.
 * On Windows, stops running Carbon SSH processes (best-effort) before removing dist.
 */
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

if (process.platform === "win32") {
  try {
    execSync(
      'powershell -NoProfile -Command "Get-Process \'Carbon SSH*\' -ErrorAction SilentlyContinue | Stop-Process -Force"',
      { stdio: "ignore" },
    );
  } catch {
    /* ignore */
  }
}

const dir = join(process.cwd(), "dist-electron-out");
try {
  rmSync(dir, { recursive: true, force: true });
} catch {
  /* ignore */
}
