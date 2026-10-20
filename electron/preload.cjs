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
  detectLink: (url) => ipcRenderer.invoke('link:detect', url),
  downloadLink: (payload) => ipcRenderer.invoke('link:download', payload),
  onLinkProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('link:progress', listener);
    return () => ipcRenderer.removeListener('link:progress', listener);
  },
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
  captureScreen: (payload) => ipcRenderer.invoke('screenshot:capture', payload),
  saveScreenshot: (payload) => ipcRenderer.invoke('screenshot:save', payload),
  getSystemDirectories: () => ipcRenderer.invoke('system:directories'),
  pickDirectory: () => ipcRenderer.invoke('dialog:pickDirectory'),
  onScreenshotTrigger: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('screenshot:trigger', listener);
    return () => ipcRenderer.removeListener('screenshot:trigger', listener);
  },
  onOverlayEvent: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('overlay:event', listener);
    return () => ipcRenderer.removeListener('overlay:event', listener);
  },
});
