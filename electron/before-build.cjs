"use strict";

const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");

const projectRoot = path.join(__dirname, "..");
const electronBuilderPkg = path.join(
  path.dirname(require.resolve("electron-builder/package.json", { paths: [projectRoot] })),
  "package.json",
);
const { rebuild } = createRequire(electronBuilderPkg)("@electron/rebuild");

/**
 * ssh2 pulls in optional `cpu-features`, which must compile with node-gyp and
 * MSVC on Windows. It is not required for SSH; skip it during Electron rebuild.
 * Returning false skips electron-builder's default @electron/rebuild pass.
 */
module.exports = async function beforeBuild(context) {
  const standaloneDir = path.join(projectRoot, ".next", "standalone");
  const buildPath = fs.existsSync(path.join(standaloneDir, "node_modules"))
    ? standaloneDir
    : context.appDir;

  await rebuild({
    buildPath,
    electronVersion: context.electronVersion,
    arch: context.arch,
    platform: context.platform.nodeName,
    projectRootPath: projectRoot,
    ignoreModules: ["cpu-features"],
    disablePreGypCopy: true,
    mode: process.platform === "win32" ? "sequential" : "parallel",
  });
  return false;
};
