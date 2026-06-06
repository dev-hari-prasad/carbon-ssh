import { execFileSync } from "node:child_process";
import { existsSync, rmSync, statSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STAGING_DIR_NAMES = ["dist-electron", "dist-electron-out"];

const ISCC_CANDIDATES = [
  join(process.env.ProgramFiles ?? "", "Inno Setup 6", "ISCC.exe"),
  join(process.env["ProgramFiles(x86)"] ?? "", "Inno Setup 6", "ISCC.exe"),
  join(process.env.LOCALAPPDATA ?? "", "Programs", "Inno Setup 6", "ISCC.exe"),
  "ISCC.exe",
];

function findISCC() {
  for (const candidate of ISCC_CANDIDATES) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  try {
    execFileSync("where", ["ISCC.exe"], { stdio: "pipe" });
    return "ISCC.exe";
  } catch {
    return null;
  }
}

function cleanElectronStaging() {
  for (const name of STAGING_DIR_NAMES) {
    const directory = join(ROOT, name);
    if (!existsSync(directory)) continue;

    try {
      rmSync(directory, { recursive: true, force: true });
      console.log(`[inno-build] ✓ Removed ${name}/`);
    } catch (error) {
      console.warn(`[inno-build] ⚠ Could not fully remove ${name}: ${error.message}`);
    }
  }
}

async function main() {
  const appPackage = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
  const version = appPackage.version || "0.1.0";
  const mode =
    process.argv.find((argument) => argument.startsWith("--mode="))?.slice(7) ?? "production";
  const releaseChannel = mode === "production" ? "prod" : "dev";
  const unpackedDirectory = join(ROOT, "dist-electron", "win-unpacked");
  const iconFile = join(ROOT, "build", "icon.ico");
  const releaseDirectory = join(ROOT, "releases", releaseChannel);
  const outputFile = join(releaseDirectory, `CarbonSSH-Setup-${version}.exe`);
  const issFile = join(ROOT, "installer", "carbon-ssh.iss");

  if (!existsSync(unpackedDirectory)) {
    throw new Error(`Unpacked directory not found: ${unpackedDirectory}`);
  }

  if (!existsSync(iconFile)) {
    throw new Error(`Icon file not found: ${iconFile}. Run "npm run build:ico" first.`);
  }

  const iscc = findISCC();
  if (!iscc) {
    throw new Error(
      "ISCC.exe not found. Install Inno Setup 6: winget install JRSoftware.InnoSetup",
    );
  }

  await mkdir(releaseDirectory, { recursive: true });

  const args = [
    `/DAppVersion=${version}`,
    `/DAppReleaseChannel=${releaseChannel}`,
    `/DAppCompression=${mode === "production" ? "lzma2/ultra64" : "zip"}`,
    `/DAppSolidCompression=${mode === "production" ? "yes" : "no"}`,
    issFile,
  ];

  console.log(`[inno-build] Building ${mode} installer for version ${version}`);
  execFileSync(iscc, args, { cwd: ROOT, stdio: "inherit", windowsHide: false });

  if (!existsSync(outputFile)) {
    throw new Error(`Expected installer not found: ${outputFile}`);
  }

  const sizeMB = (statSync(outputFile).size / 1024 / 1024).toFixed(1);
  console.log(
    `[inno-build] ✓ releases/${releaseChannel}/CarbonSSH-Setup-${version}.exe (${sizeMB} MB)`,
  );
}

try {
  await main();
} catch (error) {
  console.error(`[inno-build] ✗ ${error.message}`);
  process.exitCode = typeof error.status === "number" ? error.status : 1;
} finally {
  cleanElectronStaging();
}
