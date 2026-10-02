const {contextBridge, ipcRenderer} = require("electron");

contextBridge.exposeInMainWorld("electronAPI", Object.freeze({
  isPackaged: process.argv.includes('--legion-packaged'),
  smokeTest: process.argv.includes('--legion-smoke-test'),
  setLanguage: code => ipcRenderer.invoke("set-language", code),
  isFullscreen: () => ipcRenderer.invoke("is-fullscreen"),
  toggleFullscreen: () => ipcRenderer.invoke("toggle-fullscreen"),
  getPlatformAuth: () => ipcRenderer.invoke("get-platform-auth"),
  showGamepadTextInput: options => ipcRenderer.invoke("show-gamepad-text-input", options),
  getControllerType: () => ipcRenderer.invoke("get-controller-type"),
}));
