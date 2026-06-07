/**
 * Electron Fuses — compile-time security flags (D4.7)
 *
 * These permanently disable dangerous Electron features at the binary level.
 * Once set, they cannot be reversed without re-signing the binary.
 *
 * Run this script as part of the build pipeline:
 *   node electron/fuses.cjs <path-to-electron-binary>
 */
const { flipFuses, FuseV1Options, FuseVersion } = require("@electron/fuses");
const path = require("path");

const electronPath = process.argv[2];
if (!electronPath) {
  console.error("Usage: node electron/fuses.cjs <path-to-electron-binary>");
  process.exit(1);
}

flipFuses(electronPath, {
  version: FuseVersion.V1,
  [FuseV1Options.RunAsNode]: false, // CRITICAL: prevents ELECTRON_RUN_AS_NODE
  [FuseV1Options.EnableCookieEncryption]: true, // Encrypt cookies
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false, // Block NODE_OPTIONS injection
  [FuseV1Options.EnableNodeCliInspectArguments]: false, // Block --inspect/--inspect-brk
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true, // Verify asar integrity
  [FuseV1Options.OnlyLoadAppFromAsar]: true, // Prevent loose-file code injection
})
  .then(() => {
    console.log("[fuses] Security fuses flipped successfully for:", path.basename(electronPath));
  })
  .catch((err) => {
    console.error("[fuses] Failed to flip fuses:", err);
    process.exit(1);
  });
