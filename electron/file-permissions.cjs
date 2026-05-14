/**
 * File-permission hardening for Carbon's app-data directory (D3.1).
 *
 * Sets restrictive permissions so only the current OS user can read
 * the localStorage LevelDB, SQLite logs, and other config files.
 *
 * Called from the main process on app startup.
 */
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

function setRestrictivePermissions(appDataPath) {
  if (process.platform === "win32") {
    // On Windows, we skip chmod (not meaningful) but ensure the directory exists
    try {
      fs.mkdirSync(appDataPath, { recursive: true });
    } catch {
      /* already exists */
    }
    return;
  }

  try {
    fs.mkdirSync(appDataPath, { recursive: true, mode: 0o700 });
  } catch {
    /* already exists */
  }

  try {
    fs.chmodSync(appDataPath, 0o700);
    console.log(`[security] Set 0o700 permissions on ${appDataPath}`);

    // Recursively chmod all files
    function walk(dir) {
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        try {
          if (entry.isDirectory()) {
            fs.chmodSync(full, 0o700);
            walk(full);
          } else {
            fs.chmodSync(full, 0o600);
          }
        } catch {
          /* best effort */
        }
      }
    }
    walk(appDataPath);
  } catch (e) {
    console.warn(`[security] Could not set restrictive permissions: ${e.message}`);
  }
}

module.exports = { setRestrictivePermissions };
