/**
 * Supply chain audit — audit, SBOM, verify-deps, release checksums
 *
 * RUN: node agents/cache/tools/supply-chain-audit.mjs
 */

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const REPORT_DIR = path.join(ROOT, "agents/cache/reports");

function run(cmd, args, label) {
  console.log(`\n--- ${label} ---\n`);
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", shell: true });
  if (r.stdout) console.log(r.stdout.slice(0, 8000));
  if (r.stderr) console.error(r.stderr.slice(0, 2000));
  console.log(`exit: ${r.status}`);
  return r.status ?? 1;
}

function main() {
  console.log("=== Supply Chain Audit ===\n");

  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

  const results = {};

  results.verifyDeps = run("node", ["scripts/verify-deps.mjs"], "verify-deps.mjs");

  results.auditHigh = run("pnpm", ["audit", "--audit-level=high"], "pnpm audit (high)");

  results.auditModerate = run(
    "pnpm",
    ["audit", "--audit-level=moderate"],
    "pnpm audit (moderate)",
  );

  const hasCdx = spawnSync("pnpm", ["exec", "cdxgen", "--version"], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
  if (hasCdx.status === 0) {
    results.sbom = run("pnpm", ["sbom"], "pnpm sbom → sbom.json");
    if (fs.existsSync(path.join(ROOT, "sbom.json"))) {
      const stat = fs.statSync(path.join(ROOT, "sbom.json"));
      console.log(`sbom.json: ${stat.size} bytes`);
    }
  } else {
    console.log("\n--- SBOM ---\nskip: cdxgen not available (pnpm sbom)");
    results.sbom = "skipped";
  }

  const dist = path.join(ROOT, "dist-electron-out");
  if (fs.existsSync(dist)) {
    console.log("\n--- Release artifacts ---");
    const names = fs.readdirSync(dist);
    console.log(names.join(", "));
    const sums = path.join(dist, "SHA256SUMS.txt");
    if (fs.existsSync(sums)) {
      console.log("\nSHA256SUMS.txt present ✅");
    } else {
      console.log("\n⚠️  No SHA256SUMS.txt — run: node scripts/release-checksums.mjs after build");
    }
    results.checksums = fs.existsSync(sums);
  } else {
    console.log("\n--- Release artifacts ---\nnot built (pnpm build:electron-release)");
    results.checksums = "no_dist";
  }

  const builder = fs.readFileSync(path.join(ROOT, "electron-builder.yml"), "utf8");
  console.log("\n--- Signing config (electron-builder.yml) ---");
  console.log(builder.includes("notarize") ? "mac notarize: configured (CI secrets)" : "mac notarize: missing");
  console.log(
    builder.includes("CSC") || builder.includes("WIN_CSC")
      ? "win/mac signing: documented for CI"
      : "signing: not documented",
  );

  fs.writeFileSync(
    path.join(REPORT_DIR, "supply-chain-audit.json"),
    JSON.stringify({ at: new Date().toISOString(), results }, null, 2),
  );
  console.log("\nWrote agents/cache/reports/supply-chain-audit.json");
}

main();
