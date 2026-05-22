#!/usr/bin/env node
/**
 * Lists all PoC scripts (01–52). Does NOT execute them.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const pocsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../pocs");
const files = fs
  .readdirSync(pocsDir)
  .filter((f) => f.startsWith("exploit-") && (f.endsWith(".js") || f.endsWith(".cjs")))
  .sort((a, b) => {
    const na = parseInt(a.match(/exploit-(\d+)/)?.[1] || "0", 10);
    const nb = parseInt(b.match(/exploit-(\d+)/)?.[1] || "0", 10);
    return na - nb;
  });

const TAGS = {
  cjs: (f) => f.endsWith(".cjs"),
  tsx: (f) => f.includes("15-telemetry"),
  browser: (f) =>
    /console|hijack|poison|pollution|tamper|bang|theme|prefix|event-bus|suggestion|localstorage-credential/i.test(
      f,
    ) && !f.endsWith(".cjs"),
};

console.log(`# Carbon SSH PoCs — ${files.length} scripts\n`);
console.log("Prereq: pnpm dev and/or pnpm dev:electron\n");

for (const f of files) {
  let tag = "node";
  if (TAGS.cjs(f)) tag = "node (.cjs, may need ws)";
  else if (TAGS.tsx(f)) tag = "pnpm exec tsx";
  else if (TAGS.browser(f)) tag = "browser DevTools (+ optional node doc)";
  else if (/^(03|04|11|12|18|22|25|29|39|43|45)/.test(f)) tag = "documentation / manual";
  else if (/electron|ipc-|secure-store|applock|factory-reset-secure|known-host|production-sqlite|spawn-env|proxy-header|navigation|egress/i.test(f))
    tag = "electron and/or FS";

  console.log(`  node agents/cache/pocs/${f}  # ${tag}`);
}

console.log("\nReport: agents/cache/reports/security-audit-report.md");
