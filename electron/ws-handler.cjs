// Production-ready WebSocket handler for Electron (compiled from ws-handler.ts logic)
const { Client } = require("ssh2");
const crypto = require("crypto");
const { app, safeStorage } = require("electron");
const secureStore = require("./secure-store.cjs");

const WS_HIGH_WATER_BYTES = 4 * 1024 * 1024;
const WS_LOW_WATER_BYTES = 512 * 1024;
const WS_DRAIN_POLL_MS = 25;

function resolveAuthMethod(data) {
  if (data.authMethod === "privateKey") return "privateKey";
  if (!data.authMethod && data.privateKey) return "privateKey";
  return "password";
}

function normalizePrivateKey(privateKey) {
  return (privateKey || "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function normalizeFingerprint(value) {
  return String(value || "").trim().replace(/^SHA256:/i, "");
}

function formatSshError(error, authMethod) {
  const message = error?.message || "";
  const lower = message.toLowerCase();

  if (
    error?.level === "client-authentication" ||
    lower.includes("all configured authentication methods failed") ||
    lower.includes("authentication failed")
  ) {
    return "Authentication failed";
  }

  if (
    authMethod === "privateKey" &&
    (lower.includes("privatekey") ||
      lower.includes("private key") ||
      lower.includes("key format") ||
      lower.includes("parse") ||
      lower.includes("encrypted"))
  ) {
    return "Invalid private key";
  }

  if (
    error?.code === "ECONNREFUSED" ||
    lower.includes("econnrefused") ||
    lower.includes("connection refused")
  ) {
    return "Connection refused";
  }

  if (lower.includes("connection closed") || lower.includes("connection lost")) {
    return "SSH connection closed";
  }

  return message || "SSH connection failed";
}

function handleWsConnection(ws) {
  let shell = null;
  let client = null;
  let closed = false;
  const pausedStreams = new Set();
  let drainTimer = null;

  function sendMsg(message) {
    if (ws.readyState === 1) ws.send(JSON.stringify(message));
  }

  function stopDrainTimerIfIdle() {
    if (pausedStreams.size > 0 || !drainTimer) return;
    clearInterval(drainTimer);
    drainTimer = null;
  }

  function resumePausedStreams() {
    if (ws.readyState !== 1) {
      for (const stream of pausedStreams) {
        try {
          stream.resume();
        } catch {}
      }
      pausedStreams.clear();
      stopDrainTimerIfIdle();
      return;
    }
    if (ws.bufferedAmount > WS_LOW_WATER_BYTES) return;
    for (const stream of pausedStreams) {
      try {
        stream.resume();
      } catch {}
    }
    pausedStreams.clear();
    stopDrainTimerIfIdle();
  }

  function pauseUntilSocketDrains(stream) {
    if (!stream || pausedStreams.has(stream)) return;
    try {
      stream.pause();
      pausedStreams.add(stream);
    } catch {
      return;
    }
    if (!drainTimer) {
      drainTimer = setInterval(resumePausedStreams, WS_DRAIN_POLL_MS);
    }
  }

  function sendStreamData(stream, data) {
    if (ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: "data", data: data.toString("utf8") }), (error) => {
      if (error) handleClose();
      else resumePausedStreams();
    });
    if (ws.bufferedAmount > WS_HIGH_WATER_BYTES) {
      pauseUntilSocketDrains(stream);
    }
  }

  function handleClose() {
    if (closed) return;
    closed = true;
    if (shell) {
      try {
        shell.end();
      } catch {}
      shell = null;
    }
    if (client) {
      try {
        client.end();
      } catch {}
      client = null;
    }
    if (drainTimer) {
      clearInterval(drainTimer);
      drainTimer = null;
    }
    pausedStreams.clear();
    sendMsg({ type: "closed" });
  }

  ws.on("message", (raw) => {
    let message;
    try {
      const text = typeof raw === "string" ? raw : Buffer.from(raw).toString("utf8");
      message = JSON.parse(text);
    } catch {
      sendMsg({ type: "error", message: "Invalid message format." });
      return;
    }

    if (message.type === "connect") {
      if (shell) {
        try {
          shell.end();
        } catch {}
        shell = null;
      }
      if (client) {
        try {
          client.end();
        } catch {}
        client = null;
      }
      closed = false;

      const { connectionId, cols, rows } = message.data || {};

      if (typeof connectionId !== "string" || !connectionId.trim()) {
        sendMsg({ type: "error", message: "Missing connection reference" });
        handleClose();
        return;
      }

      const connectionMetadata = secureStore.loadConnectionMetadata(app, connectionId);
      if (!connectionMetadata) {
        sendMsg({ type: "error", message: "Unknown connection reference" });
        handleClose();
        return;
      }

      let storedSecrets = null;
      try {
        storedSecrets = secureStore.loadConnectionSecrets(app, safeStorage, connectionId);
      } catch (error) {
        console.error("[ws-handler] Failed loading secure credentials", error);
        sendMsg({ type: "error", message: "Secure credential storage is unavailable" });
        handleClose();
        return;
      }

      const mergedSecrets = {
        authMethod: storedSecrets?.authType || connectionMetadata.authType,
        password: storedSecrets?.password,
        privateKey: storedSecrets?.privateKey,
        passphrase: storedSecrets?.passphrase,
      };

      const authMethod = resolveAuthMethod(mergedSecrets);
      const normalizedPrivateKey = normalizePrivateKey(mergedSecrets.privateKey);
      const resolvedPassword = mergedSecrets.password;

      if (authMethod === "password" && !resolvedPassword) {
        sendMsg({ type: "error", message: "Missing credentials for this connection" });
        handleClose();
        return;
      }

      if (authMethod === "privateKey" && !normalizedPrivateKey) {
        sendMsg({ type: "error", message: "Invalid private key" });
        handleClose();
        return;
      }

      const sshClient = new Client();
      client = sshClient;
      let hostTrustPromptSent = false;

      sshClient.on("keyboard-interactive", (_n, _i, _l, prompts, finish) => {
        if (
          authMethod === "password" &&
          prompts.length > 0 &&
          prompts[0].prompt.toLowerCase().includes("password") &&
          resolvedPassword
        ) {
          finish([resolvedPassword]);
        } else {
          finish([]);
        }
      });

      sshClient.on("ready", () => {
        sshClient.shell(
          { term: "xterm-256color", cols: cols ?? 80, rows: rows ?? 24 },
          (err, stream) => {
            if (err) {
              console.error("[ws-handler] Shell error:", err.message || err);
              sendMsg({ type: "error", message: err.message });
              sshClient.end();
              return;
            }
            shell = stream;
            sendMsg({ type: "connected" });
            stream.on("data", (data) => sendStreamData(stream, data));
            stream.on("close", () => handleClose());
            if (stream.stderr) {
              stream.stderr.on("data", (data) => sendStreamData(stream.stderr, data));
            }
          },
        );
      });

      sshClient.on("error", (err) => {
        console.error("[ws-handler] SSH client error:", err.message || err);
        if (hostTrustPromptSent && !shell) {
          handleClose();
          return;
        }
        if (!shell) {
          sendMsg({ type: "error", message: formatSshError(err, authMethod) });
          handleClose();
        } else {
          sendMsg({ type: "error", message: formatSshError(err, authMethod) });
        }
      });

      sshClient.on("close", () => handleClose());

      const config = {
        host: connectionMetadata.host,
        port: connectionMetadata.port,
        username: connectionMetadata.username,
        readyTimeout: 20000,
        keepaliveInterval: 10000,
        tryKeyboard: true,
        hostVerifier: (hashedKey) => {
          try {
            const keyBuffer = Buffer.isBuffer(hashedKey)
              ? hashedKey
              : Buffer.from(String(hashedKey ?? ""), "utf8");
            const fingerprint = crypto.createHash("sha256").update(keyBuffer).digest("base64");
            const known = secureStore.readKnownHost(
              app,
              safeStorage,
              connectionMetadata.host,
              connectionMetadata.port,
              "default",
            );
            if (!known) {
              hostTrustPromptSent = true;
              sendMsg({
                type: "host-key-untrusted",
                data: {
                  connectionId,
                  host: connectionMetadata.host,
                  port: connectionMetadata.port,
                  algorithm: "default",
                  fingerprint: `SHA256:${fingerprint}`,
                },
              });
              return false;
            }
            const matches = normalizeFingerprint(known.fingerprint) === normalizeFingerprint(fingerprint);
            if (!matches) {
              console.warn(
                `[security] SSH host key mismatch blocked for ${connectionMetadata.host}:${connectionMetadata.port}`,
              );
            }
            return matches;
          } catch (error) {
            console.error("[ws-handler] Host key verification failure", error);
            return false;
          }
        },
      };
      if (authMethod === "password") {
        config.password = resolvedPassword || "";
      }
      if (authMethod === "privateKey") {
        config.privateKey = normalizedPrivateKey;
        if (mergedSecrets.passphrase) config.passphrase = mergedSecrets.passphrase;
      }

      try {
        sshClient.connect(config);
      } catch (error) {
        sendMsg({ type: "error", message: formatSshError(error, authMethod) });
        handleClose();
      }
      return;
    }

    if (message.type === "input" && shell) {
      shell.write(message.data);
      return;
    }
    if (message.type === "resize" && shell) {
      shell.setWindow(message.data.rows, message.data.cols, 0, 0);
      return;
    }
    if (message.type === "close") {
      handleClose();
      return;
    }
  });

  ws.on("close", () => handleClose());
  ws.on("error", () => handleClose());
}

module.exports = { handleWsConnection };
