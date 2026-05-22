/**
 * WebSocket message fuzzer — /api/ws
 *
 * Sends malformed JSON, wrong types, oversized payloads, prototype pollution,
 * and unknown message types. Watches for crashes, hangs, or error leaks.
 *
 * RUN: node agents/cache/tools/fuzz-ws-messages.cjs
 * PREREQ: pnpm dev (or Electron proxy), WS_TOKEN from exploit-08
 * ENV: PORT=3000 WS_TOKEN=... FUZZ_ROUNDS=50
 */

const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.WS_TOKEN || "";
const ROUNDS = Number(process.env.FUZZ_ROUNDS || 40);
const TIMEOUT_MS = 3000;

const PAYLOADS = [
  "not json",
  "",
  "{",
  '{"type":null}',
  '{"type":"connect"}',
  '{"type":"connect","data":null}',
  '{"type":"connect","data":{"host":"127.0.0.1","port":"not-a-number","username":"x"}}',
  '{"type":"connect","data":{"host":"127.0.0.1","port":22,"username":"x","password":"x","authMethod":"password","cols":99999,"rows":99999}}',
  '{"type":"connect","data":{"host":"' + "A".repeat(50000) + '","port":22,"username":"x","password":"x"}}',
  '{"type":"input","data":"' + "\\n".repeat(500) + '"}',
  '{"type":"resize","data":{"cols":-1,"rows":-1}}',
  '{"type":"resize","data":{}}',
  '{"type":"__proto__","data":{"polluted":true}}',
  '{"type":"connect","data":{"__proto__":{"isAdmin":true},"host":"127.0.0.1","port":1,"username":"x","password":"x"}}',
  '{"type":"close"}',
  '{"type":"close","extra":1}',
  ...Array.from({ length: 8 }, (_, i) => `{"type":"unknown_${i}","data":{}}`),
  Buffer.alloc(256 * 1024, 0x41).toString(), // huge binary-as-string
];

function connect() {
  const url = `ws://127.0.0.1:${PORT}/api/ws${TOKEN ? `?token=${TOKEN}` : ""}`;
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const t = setTimeout(() => reject(new Error("connect timeout")), 5000);
    ws.on("open", () => {
      clearTimeout(t);
      resolve(ws);
    });
    ws.on("error", (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

function sendAndWait(ws, payload, label) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ label, status: "timeout" }), TIMEOUT_MS);
    const onMsg = (raw) => {
      clearTimeout(timer);
      ws.off("message", onMsg);
      let parsed;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        parsed = raw.toString().slice(0, 120);
      }
      resolve({ label, status: "response", parsed });
    };
    ws.on("message", onMsg);
    try {
      ws.send(payload);
    } catch (e) {
      clearTimeout(timer);
      resolve({ label, status: "send_error", error: e.message });
    }
  });
}

async function main() {
  console.log("=== WS Message Fuzzer ===\n");
  if (!TOKEN) {
    console.log("⚠️  Set WS_TOKEN (exploit-08) — connection may be rejected\n");
  }

  let ws;
  try {
    ws = await connect();
    console.log("✅ WebSocket connected\n");
  } catch (e) {
    console.error("❌ Cannot connect:", e.message);
    console.log("Start: pnpm dev\n");
    process.exit(1);
  }

  const results = { error: 0, timeout: 0, response: 0, send_error: 0, leaked_stack: 0 };

  const queue = [];
  for (let i = 0; i < ROUNDS; i++) {
    queue.push(PAYLOADS[i % PAYLOADS.length]);
  }

  for (let i = 0; i < queue.length; i++) {
    const payload = queue[i];
    const label = `round-${i + 1}`;
    const r = await sendAndWait(ws, payload, label);
    results[r.status] = (results[r.status] || 0) + 1;

    const snippet = JSON.stringify(r.parsed ?? r.error ?? "").slice(0, 200);
    const leak = /stack|at\s+\w+\.|\.ts:\d|ENOENT|internal/i.test(snippet);
    if (leak) results.leaked_stack++;

    console.log(
      `[${String(i + 1).padStart(2)}] ${r.status.padEnd(10)} ${typeof payload === "string" && payload.length > 60 ? payload.slice(0, 60) + "…" : payload}`,
    );
    if (r.parsed?.message) console.log(`       → ${String(r.parsed.message).slice(0, 100)}`);

    if (ws.readyState !== WebSocket.OPEN) {
      console.log("\n⚠️  Socket closed — server may have crashed");
      break;
    }
  }

  ws.close();
  console.log("\n--- Summary ---");
  console.log(results);
  console.log("\nWrite findings to agents/cache/reports/ws-fuzz-results.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
