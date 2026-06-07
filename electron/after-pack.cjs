"use strict";

const path = require("path");
const fs = require("fs");

/**
 * After electron-builder assembles the app, flip Electron Fuses
 * and copy the standalone node_modules into the resources/standalone directory.
 */
module.exports = async function afterPack(context) {
  const { appOutDir, electronPlatformName, arch } = context;

  // --- Flip Electron Fuses (D4.7) ---
  try {
    const { flipFuses, FuseV1Options, FuseVersion } = require("@electron/fuses");

    let electronBinary;
    if (electronPlatformName === "darwin") {
      electronBinary = path.join(
        appOutDir,
        `${context.packager.appInfo.productFilename}.app`,
        "Contents",
        "MacOS",
        context.packager.appInfo.productFilename,
      );
    } else if (electronPlatformName === "win32") {
      electronBinary = path.join(appOutDir, `${context.packager.appInfo.productFilename}.exe`);
    } else {
      electronBinary = path.join(appOutDir, context.packager.appInfo.productFilename);
    }

    if (fs.existsSync(electronBinary)) {
      console.log(`[after-pack] Flipping security fuses for ${electronBinary}`);
      await flipFuses(electronBinary, {
        version: FuseVersion.V1,
        [FuseV1Options.RunAsNode]: false,
        [FuseV1Options.EnableCookieEncryption]: true,
        [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
        [FuseV1Options.EnableNodeCliInspectArguments]: false,
        [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
        [FuseV1Options.OnlyLoadAppFromAsar]: true,
      });
      console.log("[after-pack] Security fuses flipped successfully");
    } else {
      console.warn(`[after-pack] Electron binary not found at ${electronBinary}, skipping fuses`);
    }
  } catch (e) {
    console.error("[after-pack] Failed to flip fuses:", e.message);
    // Non-fatal — allow build to continue
  }

  // --- Copy standalone node_modules ---
  const sourceNodeModules = path.join(__dirname, "..", ".next", "standalone", "node_modules");
  const destNodeModules = path.join(appOutDir, "resources", "standalone", "node_modules");

  console.log("[after-pack] Checking standalone node_modules copy...");
  console.log(`[after-pack] Source: ${sourceNodeModules}`);
  console.log(`[after-pack] Dest:   ${destNodeModules}`);

  if (!fs.existsSync(sourceNodeModules)) {
    console.log("[after-pack] Source node_modules not found, skipping.");
    return;
  }

  if (fs.existsSync(destNodeModules)) {
    console.log("[after-pack] node_modules already exists in packaged output, skipping.");
    return;
  }

  const destParent = path.dirname(destNodeModules);
  fs.mkdirSync(destParent, { recursive: true });

  console.log("[after-pack] Copying node_modules...");
  fs.cpSync(sourceNodeModules, destNodeModules, { recursive: true });
  console.log("[after-pack] Copy complete.");
};
