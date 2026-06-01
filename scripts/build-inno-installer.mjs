/**
 * build-inno-installer.mjs
 *
 * Automates the Inno Setup compilation step and produces a clean release.
 *
 * Pipeline:
 *   1. Validates electron-builder unpacked output exists
 *   2. Compiles the .iss script → releases/{version}/CarbonSSH-Setup-{version}.exe
 *   3. Cleans up all intermediate build artifacts (win-unpacked, dist-electron-out junk)
 *
 * Prerequisites:
 *   - Inno Setup 6 installed  (winget install JRSoftware.InnoSetup)
 *   - electron-builder has produced  dist-electron-out/win-unpacked/
 *
 * Usage:  node scripts/build-inno-installer.mjs
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, statSync, rmSync, readdirSync } from "node:fs";
import { readFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ---------- Locate ISCC.exe ----------

const ISCC_CANDIDATES = [
  join(process.env.ProgramFiles ?? "", "Inno Setup 6", "ISCC.exe"),
  join(process.env["ProgramFiles(x86)"] ?? "", "Inno Setup 6", "ISCC.exe"),
  // Per-user install (winget default)
  join(process.env.LOCALAPPDATA ?? "", "Programs", "Inno Setup 6", "ISCC.exe"),
  // Fallback: maybe it's on PATH
  "ISCC.exe",
];

function findISCC() {
  for (const candidate of ISCC_CANDIDATES) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  // Last-ditch: try running ISCC from PATH
  try {
    execFileSync("where", ["ISCC.exe"], { stdio: "pipe" });
    return "ISCC.exe";
  } catch {
    return null;
  }
}

// ---------- Cleanup ----------

function cleanDistElectronOut() {
  const distDir = join(ROOT, "dist-electron-out");
  if (!existsSync(distDir)) return;

  console.log("[inno-build] Cleaning up intermediate build artifacts …");

  // Remove the entire dist-electron-out directory — it only contains
  // intermediate files (win-unpacked/, builder metadata, etc.)
  // The final .exe is already in releases/{version}/
  try {
    rmSync(distDir, { recursive: true, force: true });
    console.log("[inno-build] ✔ Removed dist-electron-out/");
  } catch (err) {
    console.warn(`[inno-build] ⚠ Could not fully remove dist-electron-out: ${err.message}`);
  }
}

// ---------- Main ----------

async function main() {
  // 1. Read version from package.json
  const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf-8"));
  const version = pkg.version || "0.1.0";
  console.log(`[inno-build] App version: ${version}`);

  // 2. Validate electron-builder output exists
  const unpackedDir = join(ROOT, "dist-electron-out", "win-unpacked");
  if (!existsSync(unpackedDir)) {
    console.error(`[inno-build] ✘ Unpacked directory not found: ${unpackedDir}`);
    console.error(`[inno-build]   Run "pnpm build:electron-release" first.`);
    process.exit(1);
  }
  console.log(`[inno-build] ✔ Found unpacked dir: ${unpackedDir}`);

  // 3. Validate icon file exists
  const iconFile = join(ROOT, "build", "icon.ico");
  if (!existsSync(iconFile)) {
    console.error(`[inno-build] ✘ Icon file not found: ${iconFile}`);
    console.error(`[inno-build]   Run "pnpm build:ico" first.`);
    process.exit(1);
  }
  console.log(`[inno-build] ✔ Found icon: ${iconFile}`);

  // 4. Locate Inno Setup compiler
  const iscc = findISCC();
  if (!iscc) {
    console.error(`[inno-build] ✘ ISCC.exe not found.`);
    console.error(`[inno-build]   Install Inno Setup 6: winget install JRSoftware.InnoSetup`);
    process.exit(1);
  }
  console.log(`[inno-build] ✔ ISCC.exe: ${iscc}`);

  // 5. Ensure the releases/{version}/ directory exists
  const releaseDir = join(ROOT, "releases", version);
  await mkdir(releaseDir, { recursive: true });
  console.log(`[inno-build] ✔ Release dir: ${releaseDir}`);

  // 6. Compile
  const issFile = join(ROOT, "installer", "carbon-ssh.iss");
  const args = [`/DAppVersion=${version}`, issFile];

  console.log(`[inno-build] Compiling installer …`);
  console.log(`[inno-build] > ${iscc} ${args.join(" ")}`);
  console.log("");

  try {
    execFileSync(iscc, args, {
      cwd: ROOT,
      stdio: "inherit",
      windowsHide: false,
    });
  } catch (err) {
    console.error(`\n[inno-build] ✘ ISCC.exe failed with exit code ${err.status}`);
    process.exit(err.status || 1);
  }

  // 7. Verify output
  const outputExe = join(releaseDir, `CarbonSSH-Setup-${version}.exe`);
  if (!existsSync(outputExe)) {
    console.error(`\n[inno-build] ✘ Expected installer not found at: ${outputExe}`);
    console.error(`[inno-build]   Check ISCC output above for the actual location.`);
    process.exit(1);
  }

  const size = statSync(outputExe).size;
  const sizeMB = (size / 1024 / 1024).toFixed(1);

  // 8. Clean up intermediate build artifacts
  cleanDistElectronOut();

  // 9. Report final output
  console.log("");
  console.log(`[inno-build] ═══════════════════════════════════════════════════════`);
  console.log(`[inno-build] ✔ Release ready!`);
  console.log(`[inno-build]`);
  console.log(`[inno-build]   releases/${version}/CarbonSSH-Setup-${version}.exe`);
  console.log(`[inno-build]   Size: ${sizeMB} MB`);
  console.log(`[inno-build]`);
  console.log(`[inno-build]   All intermediate artifacts have been cleaned up.`);
  console.log(`[inno-build] ═══════════════════════════════════════════════════════`);
}

main().catch((err) => {
  console.error("[inno-build] ✘ Unexpected error:", err);
  process.exit(1);
});
