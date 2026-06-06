import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";

const ROOT = join(import.meta.dirname, "..");
const STAGING_DIR_NAMES = ["dist-electron", "dist-electron-out"];
const ACTIVE_STAGING_DIR = join(ROOT, "dist-electron");

const color = {
  cyan: (text) => `\u001b[36m${text}\u001b[0m`,
  green: (text) => `\u001b[32m${text}\u001b[0m`,
  magenta: (text) => `\u001b[35m${text}\u001b[0m`,
  red: (text) => `\u001b[31m${text}\u001b[0m`,
  yellow: (text) => `\u001b[33m${text}\u001b[0m`,
};

const platformChoices = [
  { label: "All platforms", value: "all" },
  { label: "Windows (Inno Setup)", value: "windows" },
  { label: "macOS (DMG)", value: "mac" },
  { label: "Linux (AppImage, DEB, RPM)", value: "linux" },
];

const modeChoices = [
  { label: "Development (fast, low compression)", value: "dev" },
  { label: "Production (maximum compression)", value: "production" },
];

function printHeader() {
  console.log("");
  console.log(color.magenta("╭────────────────────────────╮"));
  console.log(color.magenta("│  Carbon SSH build utility  │"));
  console.log(color.magenta("╰────────────────────────────╯"));
  console.log("");
}

function cleanStaging(strict = false) {
  const errors = [];
  for (const directoryName of STAGING_DIR_NAMES) {
    try {
      rmSync(join(ROOT, directoryName), { recursive: true, force: true });
    } catch (error) {
      errors.push(error);
    }
  }

  if (strict && errors.length > 0) {
    throw errors[0];
  }
}

function run(command, args, label) {
  console.log(color.cyan(`\n▶ ${label}`));
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const error = new Error(`${label} failed with exit code ${result.status ?? 1}`);
    error.exitCode = result.status ?? 1;
    throw error;
  }
}

function runNodePackage(binaryPath, args, label) {
  run(process.execPath, [join(ROOT, "node_modules", binaryPath), ...args], label);
}

function packageWithElectronBuilder(platform, mode) {
  const args = [
    "--config",
    "electron-builder.yml",
    `--${platform}`,
    `--config.compression=${mode === "production" ? "maximum" : "store"}`,
  ];

  if (platform === "win") {
    args.push("--dir");
  }

  runNodePackage("electron-builder/out/cli/cli.js", args, `Packaging ${platform}`);
}

function getReleaseDirectory(mode) {
  return join(ROOT, "releases", mode === "production" ? "prod" : "dev");
}

function copyPackagedArtifacts(mode) {
  const releaseDirectory = getReleaseDirectory(mode);
  mkdirSync(releaseDirectory, { recursive: true });

  for (const name of readdirSync(ACTIVE_STAGING_DIR)) {
    const source = join(ACTIVE_STAGING_DIR, name);
    if (!statSync(source).isFile() || name === "builder-effective-config.yaml") {
      continue;
    }

    copyFileSync(source, join(releaseDirectory, name));
    console.log(color.green(`  ✓ releases/${mode === "production" ? "prod" : "dev"}/${name}`));
  }
}

function buildWindows(mode) {
  if (process.platform !== "win32") {
    throw new Error("Windows Inno Setup builds must run on Windows.");
  }

  cleanStaging(true);
  packageWithElectronBuilder("win", mode);
  run(
    process.execPath,
    [join(ROOT, "scripts", "build-inno-installer.mjs"), `--mode=${mode}`],
    "Building Inno installer",
  );
}

function buildMac(mode) {
  cleanStaging(true);
  packageWithElectronBuilder("mac", mode);
  copyPackagedArtifacts(mode);
}

function buildLinux(mode) {
  cleanStaging(true);
  packageWithElectronBuilder("linux", mode);
  copyPackagedArtifacts(mode);
}

function parseArgument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function isAutomaticProductionBuild() {
  return (
    process.argv.includes("-y") ||
    process.argv.includes("--yes") ||
    process.argv.includes("--y") ||
    process.env.npm_config_yes === "true" ||
    process.env.npm_config_y === "true"
  );
}

async function choose(reader, question, choices) {
  console.log(color.yellow(question));
  choices.forEach((choice, index) => {
    console.log(`  ${color.cyan(String(index + 1))}. ${choice.label}`);
  });

  while (true) {
    const answer = (await reader.question(color.green("› "))).trim().toLowerCase();
    const selected =
      choices[Number(answer) - 1] ?? choices.find((choice) => choice.value === answer);
    if (selected) {
      return selected.value;
    }
    console.log(color.red("Please enter a listed number or name."));
  }
}

async function getBuildOptions() {
  if (isAutomaticProductionBuild()) {
    return { mode: "production", platform: "all" };
  }

  const platformArg = parseArgument("platform");
  const modeArg = parseArgument("mode");
  const validPlatform = platformChoices.some((choice) => choice.value === platformArg);
  const validMode = modeChoices.some((choice) => choice.value === modeArg);

  if (validPlatform && validMode) {
    return { platform: platformArg, mode: modeArg };
  }

  if (!process.stdin.isTTY) {
    throw new Error(
      "Interactive input is unavailable. Pass -y, or use --platform=<name> --mode=<name>.",
    );
  }

  const reader = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return {
      platform: validPlatform ? platformArg : await choose(reader, "Build for:", platformChoices),
      mode: validMode ? modeArg : await choose(reader, "Build mode:", modeChoices),
    };
  } finally {
    reader.close();
  }
}

async function main() {
  printHeader();

  if (process.argv.includes("--help")) {
    console.log("npm run build:electron");
    console.log("npm run dev:electron --y");
    console.log("npm run build:electron -- --platform=windows --mode=production");
    return;
  }

  const { platform, mode } = await getBuildOptions();
  const allTargets =
    process.platform === "win32"
      ? ["windows", "linux", "mac"]
      : process.platform === "darwin"
        ? ["mac", "linux", "windows"]
        : ["linux", "windows", "mac"];
  const targets = platform === "all" ? allTargets : [platform];
  const releaseChannel = mode === "production" ? "prod" : "dev";

  console.log(color.cyan(`Platform: ${platform}`));
  console.log(color.cyan(`Mode: ${mode}`));
  console.log(color.cyan(`Output: releases/${releaseChannel}`));

  cleanStaging(true);
  mkdirSync(getReleaseDirectory(mode), { recursive: true });
  runNodePackage("next/dist/bin/next", ["build", "--turbopack"], "Building Next.js application");

  for (const target of targets) {
    if (target === "windows") buildWindows(mode);
    if (target === "mac") buildMac(mode);
    if (target === "linux") buildLinux(mode);
  }

  console.log(color.green(`\n✓ Build complete: releases/${releaseChannel}`));
}

try {
  await main();
} catch (error) {
  console.error(color.red(`\n✗ ${error.message}`));
  process.exitCode = error.exitCode ?? 1;
} finally {
  cleanStaging();
  if (STAGING_DIR_NAMES.some((name) => existsSync(join(ROOT, name)))) {
    console.warn(color.yellow("Warning: an Electron staging directory could not be removed."));
  } else {
    console.log(color.green("✓ Electron staging directories cleaned."));
  }
}
