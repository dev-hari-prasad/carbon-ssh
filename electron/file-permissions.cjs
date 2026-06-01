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

async function setRestrictivePermissions(appDataPath) {
  if (process.platform === "win32") {
    // On Windows, we skip chmod (not meaningful) but ensure the directory exists
    try {
      await fs.promises.mkdir(appDataPath, { recursive: true });
    } catch {
      /* already exists */
    }
    return;
  }

  try {
    await fs.promises.mkdir(appDataPath, { recursive: true, mode: 0o700 });
  } catch {
    /* already exists */
  }

  try {
    await fs.promises.chmod(appDataPath, 0o700);
    console.log(`[security] Set 0o700 permissions on ${appDataPath}`);

    // Recursively chmod all files
    async function walk(dir) {
      let entries;
      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      await Promise.all(entries.map(async (entry) => {
        const full = path.join(dir, entry.name);
        try {
          if (entry.isDirectory()) {
            await fs.promises.chmod(full, 0o700);
            await walk(full);
          } else {
            await fs.promises.chmod(full, 0o600);
          }
        } catch {
          /* best effort */
        }
      }));
    }
    await walk(appDataPath);
  } catch (e) {
    console.warn(`[security] Could not set restrictive permissions: ${e.message}`);
  }
}

module.exports = { setRestrictivePermissions };
