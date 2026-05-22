#!/usr/bin/env node
/**
 * Runs automated advanced audit tools (non-destructive).
 *
 * RUN: node agents/cache/tools/run-advanced-audit.mjs
 * Optional: PORT=3000 WS_TOKEN=... (for live fuzzers)
 */

import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TOOLS = path.join(ROOT, "agents/cache/tools");

const STEPS = [
  { name: "Static secret scan", cmd: "node", args: ["agents/cache/tools/static-secret-scan.mjs"] },
  { name: "Electron hardening", cmd: "node", args: ["agents/cache/tools/electron-hardening-audit.mjs"] },
  { name: "Supply chain", cmd: "node", args: ["agents/cache/tools/supply-chain-audit.mjs"] },
  { name: "App-lock race tests", cmd: "pnpm", args: ["exec", "vitest", "run", "agents/cache/tools/applock-concurrency.test.ts"] },
  { name: "Packaged prod checklist", cmd: "node", args: ["agents/cache/tools/prod-packaged-audit.mjs"] },
];

const LIVE = process.env.RUN_LIVE_FUZZ === "1";

if (LIVE) {
  STEPS.push(
    { name: "WS fuzzer", cmd: "node", args: ["agents/cache/tools/fuzz-ws-messages.cjs"] },
    { name: "ssh2 probe", cmd: "node", args: ["agents/cache/tools/ssh2-security-probe.cjs"] },
    { name: "Loopback scan", cmd: "node", args: ["agents/cache/pocs/exploit-28-loopback-http-surface-scan.js"] },
  );
}

function main() {
  console.log("# Advanced Security Audit Runner\n");
  console.log(`Live fuzz (RUN_LIVE_FUZZ=1): ${LIVE}\n`);

  for (const step of STEPS) {
    console.log(`\n${"=".repeat(60)}\n>> ${step.name}\n`);
    const r = spawnSync(step.cmd, step.args, { cwd: ROOT, encoding: "utf8", shell: true, stdio: "inherit" });
    if (r.status !== 0) console.log(`\n⚠️  ${step.name} exited ${r.status}`);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("\nManual steps:");
  console.log("  • fuzz-ipc-renderer.js → DevTools in Electron");
  console.log("  • known-host-race-notes.md");
  console.log("  • pnpm dev + RUN_LIVE_FUZZ=1 node agents/cache/tools/run-advanced-audit.mjs");
  console.log("\nReports: agents/cache/reports/");
}

main();
