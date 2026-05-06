// Production-ready WebSocket handler for Electron (compiled from ws-handler.ts logic)
const { Client } = require("ssh2");

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

  function sendMsg(message) {
    if (ws.readyState === 1) ws.send(JSON.stringify(message));
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

      const { host, port, username, password, privateKey, passphrase, cols, rows } = message.data;
      const authMethod = resolveAuthMethod(message.data);
      const normalizedPrivateKey = normalizePrivateKey(privateKey);

      if (authMethod === "privateKey" && !normalizedPrivateKey) {
        sendMsg({ type: "error", message: "Invalid private key" });
        handleClose();
        return;
      }

      const sshClient = new Client();
      client = sshClient;

      sshClient.on("keyboard-interactive", (_n, _i, _l, prompts, finish) => {
        if (
          authMethod === "password" &&
          prompts.length > 0 &&
          prompts[0].prompt.toLowerCase().includes("password") &&
          password
        ) {
          finish([password]);
        } else {
          finish([]);
        }
      });

      sshClient.on("ready", () => {
        sshClient.shell(
          { term: "xterm-256color", cols: cols ?? 80, rows: rows ?? 24 },
          (err, stream) => {
            if (err) {
              console.error("[ws-handler] Shell error full trace:\n", err.stack || err);
              sendMsg({ type: "error", message: err.message });
              sshClient.end();
              return;
            }
            shell = stream;
            sendMsg({ type: "connected" });
            stream.on("data", (data) => sendMsg({ type: "data", data: data.toString("utf8") }));
            stream.on("close", () => handleClose());
            if (stream.stderr) {
              stream.stderr.on("data", (data) =>
                sendMsg({ type: "data", data: data.toString("utf8") }),
              );
            }
          },
        );
      });

      sshClient.on("error", (err) => {
        console.error("[ws-handler] SSH client error full trace:\n", err.stack || err);
        if (!shell) {
          sendMsg({ type: "error", message: formatSshError(err, authMethod) });
          handleClose();
        } else {
          sendMsg({ type: "error", message: formatSshError(err, authMethod) });
        }
      });

      sshClient.on("close", () => handleClose());

      const config = {
        host,
        port,
        username,
        readyTimeout: 20000,
        keepaliveInterval: 10000,
        tryKeyboard: true,
        hostVerifier: () => true,
      };
      if (authMethod === "password") {
        config.password = password || "";
      }
      if (authMethod === "privateKey") {
        config.privateKey = normalizedPrivateKey;
        if (passphrase) config.passphrase = passphrase;
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
