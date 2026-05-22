/**
 * IPC payload fuzzer — run inside Electron renderer DevTools
 *
 * Probes window.electron IPC handlers with malformed args.
 * Watch main process console for throws / crashes.
 *
 * RUN: pnpm dev:electron → DevTools → paste entire IIFE from output
 */

const CASES = [
  ["decryptString", [null]],
  ["decryptString", [""]],
  ["decryptString", ["not-valid-base64!!!"]],
  ["decryptString", ["A".repeat(11 * 1024 * 1024)]],
  ["encryptString", [null]],
  ["encryptString", ["x"]],
  ["verifyAppLockPassword", [""]],
  ["verifyAppLockPassword", ["A".repeat(2000)]],
  ["verifyAppLockPassword", [null]],
  ["setAppLockPassword", [""]],
  ["setAppLockPassword", ["A".repeat(2000)]],
  ["saveConnectionMetadata", ["id", null]],
  ["saveConnectionMetadata", ["../../../etc/passwd", { host: "x", port: 22, username: "x" }]],
  ["saveConnectionMetadata", ["x", { __proto__: { admin: 1 }, host: "127.0.0.1", port: 22 }]],
  ["trustKnownHost", [{}]],
  ["trustKnownHost", [{ host: "x", port: -1, fingerprint: "bad", algorithm: "ssh-rsa" }]],
  ["saveAiApiKey", ["custom", "key", "http://127.0.0.1:1/"]],
  ["aiAutocomplete", [null]],
  ["aiAutocomplete", [{ prompt: "x", settings: {}, context: { terminalOutput: "x".repeat(50000) } }]],
  ["getWsToken", []],
  ["biometricUnlock", [""]],
  ["biometricUnlock", ["A".repeat(500)]],
];

const DRIVER = `
(async () => {
  const e = window.electron;
  if (!e) { console.error("No window.electron — use Electron"); return; }
  const results = [];
  for (const [method, args] of ${JSON.stringify(CASES)}) {
    const fn = e[method];
    if (typeof fn !== "function") {
      results.push({ method, skip: "missing" });
      continue;
    }
    try {
      const t0 = performance.now();
      const out = await fn(...args);
      results.push({ method, ok: true, ms: Math.round(performance.now() - t0), out: typeof out === "string" ? out.slice(0, 80) : out });
    } catch (err) {
      results.push({ method, ok: false, error: err?.message || String(err) });
    }
  }
  console.table(results);
  return results;
})();
`;

console.log("=== IPC Renderer Fuzzer ===\n");
console.log("Paste in Electron DevTools:\n");
console.log(DRIVER);
console.log("\n=== Watch for ===");
console.log("• Main process uncaughtException");
console.log("• Unexpected decrypt success on garbage input");
console.log("• Handler hangs (Touch ID spam)");
