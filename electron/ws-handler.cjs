// Production-ready WebSocket handler for Electron (compiled from ws-handler.ts logic)
const { Client } = require("ssh2");

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
    if (shell) { try { shell.end(); } catch {} shell = null; }
    if (client) { try { client.end(); } catch {} client = null; }
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
      if (shell) { try { shell.end(); } catch {} shell = null; }
      if (client) { try { client.end(); } catch {} client = null; }
      closed = false;

      const { host, port, username, password, privateKey, passphrase, cols, rows } = message.data;
      const sshClient = new Client();
      client = sshClient;

      sshClient.on("keyboard-interactive", (_n, _i, _l, prompts, finish) => {
        if (prompts.length > 0 && prompts[0].prompt.toLowerCase().includes("password") && password) {
          finish([password]);
        } else {
          finish([]);
        }
      });

      sshClient.on("ready", () => {
        sshClient.shell({ term: "xterm-256color", cols: cols ?? 80, rows: rows ?? 24 }, (err, stream) => {
          if (err) {
            sendMsg({ type: "error", message: err.message });
            sshClient.end();
            return;
          }
          shell = stream;
          sendMsg({ type: "connected" });
          stream.on("data", (data) => sendMsg({ type: "data", data: data.toString("utf8") }));
          stream.on("close", () => handleClose());
          if (stream.stderr) {
            stream.stderr.on("data", (data) => sendMsg({ type: "data", data: data.toString("utf8") }));
          }
        });
      });

      sshClient.on("error", (err) => {
        if (!shell) {
          sendMsg({ type: "error", message: err.message });
          handleClose();
        } else {
          sendMsg({ type: "error", message: err.message });
        }
      });

      sshClient.on("close", () => handleClose());

      const config = { host, port, username, readyTimeout: 20000, keepaliveInterval: 10000, tryKeyboard: true };
      if (password) config.password = password;
      if (privateKey) config.privateKey = privateKey.replace(/\\n/g, "\n");
      if (passphrase) config.passphrase = passphrase;

      sshClient.connect(config);
      return;
    }

    if (message.type === "input" && shell) { shell.write(message.data); return; }
    if (message.type === "resize" && shell) { shell.setWindow(message.data.rows, message.data.cols, 0, 0); return; }
    if (message.type === "close") { handleClose(); return; }
  });

  ws.on("close", () => handleClose());
  ws.on("error", () => handleClose());
}

module.exports = { handleWsConnection };
