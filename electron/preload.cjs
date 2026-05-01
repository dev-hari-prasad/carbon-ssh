const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  setZoomLevel: (level) => {
    const factor = level / 100;
    ipcRenderer.send("set-zoom-factor", factor);
  },
});
