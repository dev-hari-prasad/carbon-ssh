const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  platform: process.platform,
  setZoomLevel: (level) => {
    const factor = level / 100;
    ipcRenderer.send("set-zoom-factor", factor);
  },
  setVisualZoomLevelLimits: (min, max) => ipcRenderer.send("set-visual-zoom-limits", min, max),
  biometricUnlock: (reason) => ipcRenderer.invoke("biometric-unlock", reason),
  encryptString: (text) => ipcRenderer.invoke("encrypt-string", text),
  decryptString: (encrypted) => ipcRenderer.invoke("decrypt-string", encrypted),
  setAppLockPassword: (password) => ipcRenderer.invoke("set-app-lock-password", password),
  verifyAppLockPassword: (candidate) =>
    ipcRenderer.invoke("verify-app-lock-password", candidate),
  clearAppLockPassword: () => ipcRenderer.invoke("clear-app-lock-password"),
  factoryReset: () => ipcRenderer.invoke("factory-reset"),
  getWsToken: () => ipcRenderer.invoke("get-ws-token"),
  saveConnectionSecret: (connectionId, secrets) =>
    ipcRenderer.invoke("save-connection-secret", connectionId, secrets),
  loadConnectionSecret: (connectionId) => ipcRenderer.invoke("load-connection-secret", connectionId),
  deleteConnectionSecret: (connectionId) => ipcRenderer.invoke("delete-connection-secret", connectionId),
  saveConnectionMetadata: (connectionId, metadata) =>
    ipcRenderer.invoke("save-connection-metadata", connectionId, metadata),
  deleteConnectionMetadata: (connectionId) =>
    ipcRenderer.invoke("delete-connection-metadata", connectionId),
  saveAiApiKey: (provider, apiKey) => ipcRenderer.invoke("save-ai-api-key", provider, apiKey),
  hasAiApiKey: (provider) => ipcRenderer.invoke("has-ai-api-key", provider),
  trustKnownHost: (payload) => ipcRenderer.invoke("trust-known-host", payload),
  aiAutocomplete: (payload) => ipcRenderer.invoke("ai-autocomplete", payload),
  aiTestConnection: (payload) => ipcRenderer.invoke("ai-test-connection", payload),
  setTitleBarOverlay: (overlay) => ipcRenderer.send("set-title-bar-overlay", overlay),
  pinToTaskbar: () => ipcRenderer.send("pin-to-taskbar"),
  maximizeWindow: () => ipcRenderer.send("maximize-window"),
});
