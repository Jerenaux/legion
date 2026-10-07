const {contextBridge, ipcRenderer} = require("electron");

contextBridge.exposeInMainWorld("electronAPI", Object.freeze({
  isPackaged: process.argv.includes('--legion-packaged'),
  steamLanguage: process.argv.find(argument => argument.startsWith('--legion-steam-language='))?.split('=')[1] || null,
  smokeTest: process.argv.includes('--legion-smoke-test'),
  setLanguage: code => ipcRenderer.invoke("set-language", code),
  isFullscreen: () => ipcRenderer.invoke("is-fullscreen"),
  toggleFullscreen: () => ipcRenderer.invoke("toggle-fullscreen"),
  quitApp: () => ipcRenderer.invoke("quit-app"),
  getPlatformAuth: () => ipcRenderer.invoke("get-platform-auth"),
  getPendingGift: () => ipcRenderer.invoke('get-pending-gift'),
  acknowledgeGift: token => ipcRenderer.invoke('acknowledge-gift', token),
  onGiftAvailable: callback => {
    const listener = () => callback();
    ipcRenderer.on('gift-available', listener);
    return () => ipcRenderer.removeListener('gift-available', listener);
  },
  getPendingCommunity: () => ipcRenderer.invoke('get-pending-community'),
  acknowledgeCommunity: code => ipcRenderer.invoke('acknowledge-community', code),
  onCommunityAvailable: callback => {
    const listener = () => callback();
    ipcRenderer.on('community-invite-available', listener);
    return () => ipcRenderer.removeListener('community-invite-available', listener);
  },
  showGamepadTextInput: options => ipcRenderer.invoke("show-gamepad-text-input", options),
  getControllerType: () => ipcRenderer.invoke("get-controller-type"),
}));
