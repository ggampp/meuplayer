const { contextBridge, ipcRenderer } = require('electron');

/**
 * Desktop bridge for Super Player (BrowserView host).
 * Streaming sites need a real Chromium view with correct bounds — not a nested <webview>.
 */
contextBridge.exposeInMainWorld('meuplayerDesktop', {
  isDesktop: true,
  openStream: (url, bounds) =>
    ipcRenderer.invoke('stream:open', { url, bounds }),
  resizeStream: (bounds) => ipcRenderer.invoke('stream:resize', { bounds }),
  closeStream: () => ipcRenderer.invoke('stream:close'),
  navigateStream: (url) => ipcRenderer.invoke('stream:navigate', { url }),
  streamGoBack: () => ipcRenderer.invoke('stream:go-back'),
  streamGoForward: () => ipcRenderer.invoke('stream:go-forward'),
  streamReload: () => ipcRenderer.invoke('stream:reload'),
  streamGetUrl: () => ipcRenderer.invoke('stream:get-url'),
});
