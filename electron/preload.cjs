const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  platform: process.platform,
  setZoomLevel: (level) => {
    const factor = level / 100;
    ipcRenderer.send("set-zoom-factor", factor);
  },
  biometricUnlock: (reason) => ipcRenderer.invoke("biometric-unlock", reason),
  encryptString: (text) => ipcRenderer.invoke("encrypt-string", text),
  decryptString: (encrypted) => ipcRenderer.invoke("decrypt-string", encrypted),
  getWsToken: () => ipcRenderer.invoke("get-ws-token"),
  setTitleBarOverlay: (overlay) => ipcRenderer.send("set-title-bar-overlay", overlay),
  pinToTaskbar: () => ipcRenderer.send("pin-to-taskbar"),
  maximizeWindow: () => ipcRenderer.send("maximize-window"),
});
