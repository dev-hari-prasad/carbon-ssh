/**
 * ssh2 / ws-handler security probes
 *
 * Tests: connection timeout abuse, banner-like host strings (log injection),
 * weak/disabled algorithm negotiation (if target sshd allows), rapid reconnect.
 *
 * RUN: node agents/cache/tools/ssh2-security-probe.cjs
 * PREREQ: pnpm dev, WS_TOKEN, optional SSH_TARGET=127.0.0.1:22
 */

const WebSocket = require("ws");
const { Client } = require("ssh2");

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.WS_TOKEN || "";
const SSH_TARGET = process.env.SSH_TARGET || "127.0.0.1:22";
const [DEFAULT_HOST, DEFAULT_PORT] = SSH_TARGET.split(":");
const PORT_NUM = parseInt(DEFAULT_PORT || "22", 10);

async function wsConnect() {
  const url = `ws://127.0.0.1:${PORT}/api/ws?token=${TOKEN}`;
  const ws = new WebSocket(url);
  await new Promise((res, rej) => {
    ws.on("open", res);
    ws.on("error", rej);
    setTimeout(() => rej(new Error("ws timeout")), 5000);
  });
  return ws;
}

function wsOnce(ws, payload) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve({ timeout: true }), 25000);
    ws.on("message", (raw) => {
      clearTimeout(t);
      try {
        resolve(JSON.parse(raw.toString()));
      } catch {
        resolve({ raw: raw.toString().slice(0, 200) });
      }
    });
    ws.send(JSON.stringify(payload));
  });
}

/** Direct ssh2 — algorithm probe (no Carbon WS) */
async function probeAlgorithms(host, port) {
  console.log("\n[ssh2-direct] Algorithm negotiation probe");
  const algorithms = {
    kex: ["diffie-hellman-group1-sha1", "ecdh-sha2-nistp256"],
    cipher: ["aes128-cbc", "aes256-ctr"],
    serverHostKey: ["ssh-rsa", "ssh-ed25519"],
  };

  return new Promise((resolve) => {
    const client = new Client();
    const timer = setTimeout(() => {
      client.end();
      resolve({ status: "timeout" });
    }, 15000);

    client.on("ready", () => {
      clearTimeout(timer);
      client.end();
      resolve({ status: "connected_weak_allowed" });
    });
    client.on("error", (err) => {
      clearTimeout(timer);
      resolve({ status: "rejected", message: err.message });
    });

    try {
      client.connect({
        host,
        port,
        username: "probe",
        password: "probe",
        readyTimeout: 12000,
        algorithms,
        hostVerifier: () => true,
      });
    } catch (e) {
      clearTimeout(timer);
      resolve({ status: "throw", message: e.message });
    }
  });
}

async function main() {
  console.log("=== ssh2 Security Probe ===\n");

  // 1) Log injection via host field through WS
  if (TOKEN) {
    let ws;
    try {
      ws = await wsConnect();
    } catch (e) {
      console.log("WS skip:", e.message);
    }

    if (ws) {
      console.log("[1] Banner / log injection in host field (WS connect)");
      const xssHost = '127.0.0.1\\n<script>alert(1)</script>';
      const r = await wsOnce(ws, {
        type: "connect",
        data: {
          host: xssHost,
          port: PORT_NUM,
          username: "probe",
          password: "x",
          authMethod: "password",
          cols: 80,
          rows: 24,
        },
      });
      console.log("   Response:", JSON.stringify(r).slice(0, 300));
      console.log("   Check server logs for unescaped host in errors\n");

      console.log("[2] readyTimeout abuse — blackhole port");
      const t0 = Date.now();
      const r2 = await wsOnce(ws, {
        type: "connect",
        data: {
          host: "192.0.2.1",
          port: 22,
          username: "probe",
          password: "x",
          authMethod: "password",
        },
      });
      console.log(`   Elapsed ${Date.now() - t0}ms`, JSON.stringify(r2).slice(0, 120));

      console.log("\n[3] Rapid reconnect (5x)");
      for (let i = 0; i < 5; i++) {
        ws.send(
          JSON.stringify({
            type: "connect",
            data: { host: DEFAULT_HOST, port: PORT_NUM, username: "z", password: "z", authMethod: "password" },
          }),
        );
        await new Promise((r) => setTimeout(r, 200));
      }
      ws.close();
    }
  } else {
    console.log("Set WS_TOKEN for WS-path probes\n");
  }

  const algo = await probeAlgorithms(DEFAULT_HOST, PORT_NUM);
  console.log("[4] Weak algorithms toward", SSH_TARGET, algo);

  console.log("\n=== IMPACT ===");
  console.log("• Error messages may leak raw host strings into logs/UI");
  console.log("• No rate limit on connect attempts → resource exhaustion");
  console.log("• If weak algos connect → downgrade risk on permissive sshd");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
