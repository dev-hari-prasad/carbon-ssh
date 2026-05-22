/**
 * Static secret scan — repo + optional dev bundle paths
 *
 * RUN: node agents/cache/tools/static-secret-scan.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist-electron-out",
  "agents/cache/reports",
]);

const PATTERNS = [
  { name: "AWS key", re: /AKIA[0-9A-Z]{16}/g },
  { name: "GitHub PAT", re: /ghp_[a-zA-Z0-9]{36,}/g },
  { name: "OpenAI sk-", re: /sk-[a-zA-Z0-9]{20,}/g },
  { name: "Private key block", re: /-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----/g },
  { name: "Bearer token", re: /Bearer\s+[a-zA-Z0-9._-]{20,}/g },
  { name: "password assignment", re: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi },
  { name: "NEXT_PUBLIC secret-ish", re: /NEXT_PUBLIC_[A-Z_]*(KEY|TOKEN|SECRET)/g },
];

const ENV_FILES = [".env", ".env.local", ".env.development", ".env.production"];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = path.join(dir, name);
    let st;
    try {
      st = fs.statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, out);
    else if (st.isFile() && st.size < 2_000_000) out.push(p);
  }
  return out;
}

function scanFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if ([".png", ".jpg", ".ico", ".woff", ".woff2", ".sqlite"].includes(ext)) return [];

  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch {
    return [];
  }

  const rel = path.relative(ROOT, filePath);
  const hits = [];
  for (const { name, re } of PATTERNS) {
    re.lastIndex = 0;
    const m = text.match(re);
    if (m) hits.push({ rule: name, count: m.length, sample: m[0].slice(0, 40) });
  }
  return hits.length ? { file: rel, hits } : null;
}

function main() {
  console.log("=== Static Secret Scan ===\n");
  console.log(`Root: ${ROOT}\n`);

  console.log("[1] Env files on disk:");
  for (const f of ENV_FILES) {
    const p = path.join(ROOT, f);
    console.log(`  ${f}: ${fs.existsSync(p) ? "⚠️  EXISTS" : "ok"}`);
  }

  console.log("\n[2] Pattern scan (excludes node_modules, .next, dist):\n");
  const files = walk(ROOT);
  const findings = [];
  for (const f of files) {
    const r = scanFile(f);
    if (r) findings.push(r);
  }

  if (!findings.length) {
    console.log("  No pattern matches in scanned tree.");
  } else {
    for (const f of findings.slice(0, 40)) {
      console.log(`  ${f.file}`);
      for (const h of f.hits) console.log(`    ${h.rule}: ${h.count}x e.g. ${h.sample}`);
    }
    if (findings.length > 40) console.log(`  … and ${findings.length - 40} more files`);
  }

  console.log("\n[3] Tracked .env in git:");
  console.log("    Run: git ls-files '*.env*' '.env*'\n");

  console.log("=== Next ===");
  console.log("  exploit-46 for runtime bundle harvest");
  console.log("  Report: agents/cache/reports/static-secret-scan.json");
}

main();
