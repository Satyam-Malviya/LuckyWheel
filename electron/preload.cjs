const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('orbitAPI', {
  isElectron: true,
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return file?.path || '';
    }
  },
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  minimizeToBackground: () => ipcRenderer.send('window:hideToTray'),
  hideOverlay: () => ipcRenderer.send('overlay:hide'),
  toggleOverlayMode: (enable) => ipcRenderer.invoke('window:toggleOverlay', enable),
  pickFiles: (options) => ipcRenderer.invoke('dialog:pickFiles', options),
  processFiles: (payload) => ipcRenderer.invoke('files:process', payload),
  revealInExplorer: (filePath) => ipcRenderer.invoke('shell:reveal', filePath),
  openInTerminal: (filePath) => ipcRenderer.invoke('shell:terminal', filePath),
  copyToClipboard: (data) => ipcRenderer.invoke('clipboard:write', data),
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  createWifiShare: (filePath) => ipcRenderer.invoke('share:wifiQr', filePath),
  getSystemStatus: () => ipcRenderer.invoke('system:status'),
  getExplorerSelection: () => ipcRenderer.invoke('explorer:selection'),
  onProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('files:progress', listener);
    return () => ipcRenderer.removeListener('files:progress', listener);
  },
  onGlobalWheelTrigger: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('wheel:globalTrigger', listener);
    return () => ipcRenderer.removeListener('wheel:globalTrigger', listener);
  },
  onOverlayEvent: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('overlay:event', listener);
    return () => ipcRenderer.removeListener('overlay:event', listener);
  },
});
