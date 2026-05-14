/**
 * Renderer-process defense-in-depth runtime protections (D5.1, D7.5).
 *
 *
 * Usage:
 *   import "@/lib/defense-renderer";
 */

let installed = false;

/**
 * Freeze standard prototypes to prevent prototype pollution (D5.1).
 * CAREFUL: This can break libraries that mutate prototypes.
 */

function freezePrototypes(): void {
  if (process.env.NODE_ENV === "development") return;

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
 * Store references to critical globals at install time (D7.5).
 * Used to detect monkey-patching at runtime.
 */

const criticalRefs = new Map<string, unknown>();

function snapshotCriticalGlobals(): void {
  if (typeof globalThis === "undefined") return;

  const targets: Record<string, unknown> = {
    fetch: (globalThis as Record<string, unknown>).fetch,
    WebSocket: (globalThis as Record<string, unknown>).WebSocket,
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
export function checkCriticalIntegrity(): string[] {
  const tampered: string[] = [];

  for (const [key, original] of criticalRefs) {
    let current: unknown;
    switch (key) {
      case "fetch":
        current = (globalThis as Record<string, unknown>).fetch;
        break;
      case "WebSocket":
        current = (globalThis as Record<string, unknown>).WebSocket;
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
 * Install renderer-process defenses.
 * Called on import.
 */
if (!installed) {
  installed = true;
  freezePrototypes();
  snapshotCriticalGlobals();
}
