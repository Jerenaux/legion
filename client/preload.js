const {contextBridge, ipcRenderer} = require("electron");

contextBridge.exposeInMainWorld("electronAPI", Object.freeze({
  isFullscreen: () => ipcRenderer.invoke("is-fullscreen"),
  toggleFullscreen: () => ipcRenderer.invoke("toggle-fullscreen"),
  getPlatformAuth: () => ipcRenderer.invoke("get-platform-auth"),
}));
