"use strict";

const path = require("path");
const fs = require("fs");

/**
 * After electron-builder assembles the app, copy the standalone node_modules
 * into the resources/standalone directory.
 *
 * electron-builder respects .gitignore, which excludes `node_modules`,
 * so `extraResources` alone cannot copy the standalone dependency tree.
 * This hook copies the full node_modules using Node's fs.cpSync
 * (which ignores .gitignore), preserving the complete standalone structure.
 */
module.exports = async function afterPack(context) {
  const { appOutDir } = context;

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
