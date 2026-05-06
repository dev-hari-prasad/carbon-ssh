"use strict";

const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

/**
 * electron-builder may skip installing dependencies when `beforeBuild` returns false.
 * We intentionally do that to control native rebuilds (skip cpu-features).
 *
 * So we copy the app's runtime dependencies into the packaged app:
 *   <appOutDir>/resources/app/node_modules
 */
module.exports = async function afterPack(context) {
  const projectDir = context.packager.projectDir;
  const appOutDir = context.appOutDir;
  const resourceAppDir = path.join(appOutDir, "resources", "app");
  const destNodeModules = path.join(resourceAppDir, "node_modules");

  console.log(`[afterPack] Checking for node_modules in: ${destNodeModules}`);

  const nextPath = path.join(destNodeModules, "next");
  const nodeModulesExists = fs.existsSync(destNodeModules);
  const nextExists = fs.existsSync(nextPath);

  if (!nodeModulesExists || !nextExists) {
    if (!nodeModulesExists) {
      console.log(`[afterPack] node_modules missing. Performing full copy...`);
    } else {
      console.log(`[afterPack] 'next' module missing in existing node_modules. Repairing...`);
    }
    
    const srcNodeModules = path.join(projectDir, "node_modules");
    
    // Use robocopy for speed on Windows. 
    const result = spawnSync("robocopy", [
      srcNodeModules,
      destNodeModules,
      "/S", "/E", "/MT:32", "/R:1", "/W:1", "/NFL", "/NDL", "/NJH", "/NJS", "/nc", "/ns", "/np",
      "/XD", ".bin" 
    ], { shell: true });

    if (result.status > 7) {
      console.error(`[afterPack] Robocopy failed with status ${result.status}`);
    } else {
      console.log(`[afterPack] Successfully synced node_modules.`);
    }
  } else {
    console.log(`[afterPack] node_modules and 'next' already exist in packaged app.`);
  }
};
