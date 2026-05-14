/**
 * Defense-in-depth runtime protections (D5.1, D3.4, D7.5)
 *
 * Must be loaded at the very start of both main and renderer processes,
 * before any other code runs.
 *
 * Usage in main.cjs:
 *   require("./defense.cjs").installMain();
 *
 * Usage in renderer (via Next.js _app or layout):
 *   import { installRenderer } from "@/lib/defense";
 *   installRenderer();
 */

let installed = false;

/**
 * Freeze standard prototypes to prevent prototype pollution (D5.1).
 * CAREFUL: This can break libraries that mutate prototypes.
 */
function freezePrototypes() {
  const targets = [
    Object.prototype,
    Array.prototype,
    Function.prototype,
    String.prototype,
    Number.prototype,
    Boolean.prototype,
    Symbol.prototype,
  ];

  for (const proto of targets) {
    try {
      Object.freeze(proto);
    } catch {
      // Some envs block prototype freezing
    }
  }
}

/**
 * Detect debugger attachment in production (D3.4).
 * Returns true if a debugger appears to be attached.
 */
function isDebuggerAttached() {
  // Dev scripts (e.g. pnpm dev:electron) often omit NODE_ENV; only enforce when explicitly production.
  if (process.env.NODE_ENV !== "production") return false;

  // Check for --inspect / --inspect-brk flags
  const execArgv = typeof process !== "undefined" ? process.execArgv : [];
  if (execArgv.some((arg) => arg.startsWith("--inspect") || arg.startsWith("--debug"))) {
    return true;
  }

  // Check debug port (skip argv-only tools that leave debugPort set while NODE_ENV is unset)
  if (typeof process !== "undefined" && process.debugPort !== 0) {
    return true;
  }

  return false;
}

/**
 * Store references to critical globals at install time (D7.5).
 * Used to detect monkey-patching at runtime.
 */
const criticalRefs = new Map();

function snapshotCriticalGlobals() {
  if (typeof globalThis === "undefined") return;

  const targets = {
    fetch: globalThis.fetch,
    WebSocket: globalThis.WebSocket,
    JSON_stringify: JSON.stringify,
    JSON_parse: JSON.parse,
  };

  for (const [key, value] of Object.entries(targets)) {
    if (value !== undefined) {
      criticalRefs.set(key, value);
    }
  }
}

/**
 * Check if any critical global has been monkey-patched (D7.5).
 * Returns array of names of modified globals.
 */
function checkCriticalIntegrity() {
  const tampered = [];

  for (const [key, original] of criticalRefs) {
    let current;
    switch (key) {
      case "fetch":
        current = globalThis.fetch;
        break;
      case "WebSocket":
        current = globalThis.WebSocket;
        break;
      case "JSON_stringify":
        current = JSON.stringify;
        break;
      case "JSON_parse":
        current = JSON.parse;
        break;
    }
    if (current !== original) {
      tampered.push(key);
    }
  }

  return tampered;
}

/**
 * Install main-process defenses.
 * Call from Electron main.cjs before creating the window.
 */
function installMain() {
  if (installed) return;
  installed = true;

  // D5.1: Freeze prototypes
  freezePrototypes();

  // D3.4: Detect debugger in production
  if (isDebuggerAttached()) {
    console.error("[security] Debugger detected in production build. Refusing to start.");
    if (typeof process !== "undefined") {
      process.exit(1);
    }
  }

  // D7.5: Snapshot critical globals for integrity monitoring
  snapshotCriticalGlobals();

  console.log("[defense] Main process defenses installed");
}

/**
 * Install renderer-process defenses.
 * Call from Next.js layout or _app on mount.
 */
function installRenderer() {
  if (installed) return;
  installed = true;

  // D5.1: Freeze prototypes
  freezePrototypes();

  // D7.5: Snapshot critical globals for integrity monitoring
  snapshotCriticalGlobals();

  console.log("[defense] Renderer process defenses installed");
}

module.exports = { installMain, installRenderer, checkCriticalIntegrity, isDebuggerAttached };
