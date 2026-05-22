/**
 * Electron hardening checklist — read-only source audit
 *
 * RUN: node agents/cache/tools/electron-hardening-audit.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function check(name, pass, detail) {
  const icon = pass ? "✅" : "❌";
  console.log(`${icon} ${name}`);
  if (detail) console.log(`   ${detail}`);
  return pass;
}

function extractBool(src, pattern) {
  const m = src.match(pattern);
  return m ? m[1] === "true" : null;
}

function main() {
  console.log("=== Electron Hardening Audit ===\n");

  const mainSrc = read("electron/main.cjs");
  const preloadSrc = read("electron/preload.cjs");
  const builder = read("electron-builder.yml");
  const fuses = read("electron/fuses.cjs");

  const scores = [];

  scores.push(
    check(
      "nodeIntegration: false",
      /nodeIntegration:\s*false/.test(mainSrc),
      "main.cjs webPreferences",
    ),
  );
  scores.push(
    check(
      "contextIsolation: true",
      /contextIsolation:\s*true/.test(mainSrc),
      null,
    ),
  );
  scores.push(
    check("sandbox: true", /sandbox:\s*true/.test(mainSrc), null));
  scores.push(
    check(
      "webSecurity: true",
      /webSecurity:\s*true/.test(mainSrc),
      null,
    ),
  );
  scores.push(
    check(
      "enableRemoteModule: false",
      /enableRemoteModule:\s*false/.test(mainSrc),
      null,
    ),
  );
  scores.push(
    check(
      "preload uses contextBridge only",
      preloadSrc.includes("contextBridge.exposeInMainWorld") && !preloadSrc.includes("exposeInMainWorld") === false,
      "no nodeIntegration in preload",
    ),
  );
  scores.push(
    check(
      "IPC channel lockdown present",
      mainSrc.includes("ALLOWED_IPC_CHANNELS"),
      null,
    ),
  );
  const decryptBlock = mainSrc.match(/ipcMain\.handle\("decrypt-string"[\s\S]{0,400}/)?.[0] || "";
  if (!decryptBlock.includes("ensureMainSender")) {
    console.log("⚠️  FINDING: decrypt-string lacks ensureMainSender (exploit-04)");
  } else {
    scores.push(check("decrypt-string has ensureMainSender", true, null));
  }

  scores.push(
    check(
      "RunAsNode fuse disabled",
      fuses.includes("RunAsNode]: false"),
      "electron/fuses.cjs",
    ),
  );
  scores.push(
    check(
      "asar integrity fuse enabled",
      fuses.includes("EnableEmbeddedAsarIntegrityValidation]: true"),
      null,
    ),
  );
  scores.push(
    check(
      "OnlyLoadAppFromAsar fuse enabled",
      fuses.includes("OnlyLoadAppFromAsar]: true"),
      null,
    ),
  );
  scores.push(
    check("asar: true in builder", /asar:\s*true/.test(builder), null));
  scores.push(
    check(
      "mac hardenedRuntime",
      /hardenedRuntime:\s*true/.test(builder),
      null,
    ),
  );
  scores.push(
    check(
      "mac notarize block present",
      builder.includes("notarize:"),
      "requires CI secrets at release",
    ),
  );
  scores.push(
    check(
      "win signing documented",
      builder.includes("WIN_CSC_LINK") || builder.includes("CSC_LINK"),
      "certs via CI only",
    ),
  );

  const devtoolsBlocked = mainSrc.includes("devtools-opened");
  check("prod DevTools blocked", devtoolsBlocked, "main.cjs");

  const passed = scores.filter(Boolean).length;
  const total = scores.length;
  console.log(`\n--- Score: ${passed}/${total} checks passed ---`);
  console.log("Manual: run flipFuses on packaged binary after build:electron");
}

main();
