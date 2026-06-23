// MultiAI — preload bridge.
// Runs in an isolated context before the renderer page loads. The ONLY thing we
// expose to the page (and never to the embedded sites, which run in their own
// <webview> guests) is a tiny, explicit API surface. No raw Node, no ipcRenderer.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('multiAI', {
  // Clear one site's persisted session (cookies/storage for its partition).
  // Resolves with { ok, partition }.
  clearSession: (paneId) => ipcRenderer.invoke('multiai:clear-session', paneId),

  // Subscribe to zoom-% updates pushed from main when a pane is zoomed via
  // the keyboard. callback receives { webContentsId, percent }.
  onZoom: (callback) => ipcRenderer.on('multiai:zoom', (_event, data) => callback(data)),
});
