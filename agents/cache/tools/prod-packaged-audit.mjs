/**
 * Packaged production audit — paths PoCs miss in dev-only runs
 *
 * RUN:
 *   pnpm build:electron   # or build:electron-release
 *   node agents/cache/tools/prod-packaged-audit.mjs
 */

import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const USER_DATA_DIRS = [
  path.join(os.homedir(), "AppData", "Roaming", "Carbon"),
  path.join(os.homedir(), "AppData", "Roaming", "Carbon SSH"),
];

function main() {
  console.log("=== Packaged Production Audit ===\n");

  console.log("[1] Build output");
  const dist = path.join(ROOT, "dist-electron-out");
  if (!fs.existsSync(dist)) {
    console.log("  ❌ dist-electron-out missing");
    console.log("  Run: pnpm build:electron\n");
  } else {
    const exe = fs.readdirSync(dist).filter((n) => /\.(exe|dmg|AppImage|deb)$/i.test(n));
    console.log("  Artifacts:", exe.join(", ") || "(dir build only)");
  }

  console.log("\n[2] secure-store after factory reset test");
  console.log("  1. Launch packaged app, save connection");
  console.log("  2. Factory reset from UI");
  console.log("  3. Run: node agents/cache/pocs/exploit-24-factory-reset-secure-store-remnants.js\n");

  for (const dir of USER_DATA_DIRS) {
    const store = path.join(dir, "secure-store.v1.json");
    const db = path.join(dir, "database.sqlite");
    console.log(`[3] userData: ${dir}`);
    console.log(`    secure-store: ${fs.existsSync(store) ? "yes" : "no"}`);
    console.log(`    database.sqlite in userData: ${fs.existsSync(db) ? "yes" : "no"}`);
  }

  console.log("\n[4] Production sqlite cwd (exploit-35)");
  const cwdDb = path.join(ROOT, "database.sqlite");
  console.log(`    ${cwdDb}: ${fs.existsSync(cwdDb) ? "yes" : "no"}`);

  console.log("\n[5] Entry proxy port");
  console.log("  Launch app; grep main log for:");
  console.log('    [main] Entry proxy: http://127.0.0.1:PORT');
  console.log("  Then:");
  console.log("    CARBON_PORT=PORT WS_TOKEN=<from DevTools getWsToken> node agents/cache/pocs/exploit-42-ws-token-session-fixation.cjs\n");

  console.log("[6] Electron fuses on binary");
  const winUnpacked = path.join(dist, "win-unpacked");
  if (fs.existsSync(winUnpacked)) {
    const electronExe = fs
      .readdirSync(winUnpacked)
      .find((n) => n === "Carbon SSH.exe" || n === "electron.exe");
    if (electronExe) {
      console.log(`  Binary: ${path.join(winUnpacked, electronExe)}`);
      console.log("  Verify fuses flipped in CI after-pack (electron/after-pack.cjs)");
    }
  }

  console.log("\n[7] Re-run PoCs against packaged proxy");
  const r = spawnSync(
    "node",
    ["agents/cache/pocs/exploit-28-loopback-http-surface-scan.js"],
    {
      cwd: ROOT,
      encoding: "utf8",
      shell: true,
      env: { ...process.env, PORT: process.env.CARBON_PORT || "3000" },
    },
  );
  if (r.stdout) console.log(r.stdout.slice(0, 1500));

  console.log("\nDone — log results in agents/cache/reports/security-audit-report.md");
}

main();
