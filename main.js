// MultiAI — Electron main process.
// One BrowserWindow that loads renderer.html (the UI shell). The shell mounts
// four <webview> tags (one per AI site). Security posture: context isolation ON,
// node integration OFF in the renderer; the only privileged capability handed to
// the renderer is a single `clearSession` IPC channel (via preload.js).

const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: '#0c0d10',
    title: 'MultiAI',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // renderer cannot touch preload internals or Node
      nodeIntegration: false,   // no Node in the renderer (or in the embedded sites)
      webviewTag: true,         // required so renderer.html can mount <webview>s
      spellcheck: true,
    },
  });

  win.loadFile('renderer.html');

  win.on('closed', () => { win = null; });
}

app.whenReady().then(() => {
  createWindow();

  // macOS: re-create a window when the dock icon is clicked and none are open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// macOS convention: keep the app alive when all windows are closed (stays in the
// dock); quit outright on Windows/Linux.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---- IPC: clear a single site's persisted session ----------------------------
// Wipes cookies/localStorage/etc. for one partition so you can log out / switch
// accounts for just that pane. Invoked from the renderer via the preload bridge
// (window.multiAI.clearSession). paneId maps to the "persist:<paneId>" partition
// that the matching <webview> uses.
ipcMain.handle('multiai:clear-session', async (_event, paneId) => {
  if (typeof paneId !== 'string' || !/^[a-z0-9_-]+$/i.test(paneId)) {
    throw new Error('clear-session: invalid paneId');
  }
  const partition = 'persist:' + paneId;
  const ses = session.fromPartition(partition);
  await ses.clearStorageData();
  return { ok: true, partition };
});
