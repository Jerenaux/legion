const { contextBridge, ipcRenderer } = require('electron');

try {
  contextBridge.exposeInMainWorld('electronAPI', {
    isFullscreen: async () => {
      const result = await ipcRenderer.invoke('is-fullscreen');
      return result;
    },
    toggleFullscreen: async () => {
      const result = await ipcRenderer.invoke('toggle-fullscreen');
      return result;
    },
  });
  
} catch (error) {
  console.error('Preload: Error exposing electronAPI:', error);
}

try {
  window.electronAPI = {
    isFullscreen: async () => {
      const result = await ipcRenderer.invoke('is-fullscreen');
      return result;
    },
    toggleFullscreen: async () => {
      const result = await ipcRenderer.invoke('toggle-fullscreen');
      return result;
    },
  };
} catch (error) {
  console.error('Preload: Error setting window.electronAPI directly:', error);
}
