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

  // Take ownership of zoom for the embedded sites. We can't rely on Chromium's
  // built-in Ctrl+/- shortcut here: a focused <webview> delivers key events to
  // the guest site first, and some sites (ChatGPT/Gemini/Grok) swallow +/- for
  // their own shortcuts — so zoom worked inconsistently (Claude happened to let
  // it through). before-input-event fires BEFORE the guest page sees the key, so
  // we intercept it and zoom that pane's webContents directly and reliably.
  win.webContents.on('did-attach-webview', (_event, contents) => {
    contents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      if (!(input.control || input.meta)) return; // Ctrl (or Cmd on macOS)

      let factor = contents.getZoomFactor();
      switch (input.key) {
        case '=': case '+': factor += 0.1; break;  // zoom in  (+10%)
        case '-': case '_': factor -= 0.1; break;  // zoom out (-10%)
        case '0':           factor = 1;   break;   // reset to 100%
        default: return;                           // not a zoom key — leave it alone
      }
      // snap to a clean 10% step and clamp to 25%–500%
      factor = Math.max(0.25, Math.min(Math.round(factor * 10) / 10, 5));
      contents.setZoomFactor(factor);
      event.preventDefault(); // stop the site from also acting on the key
      // tell the renderer so it can show the % in that pane's header badge
      win.webContents.send('multiai:zoom', { webContentsId: contents.id, percent: Math.round(factor * 100) });
    });
  });

  win.on('closed', () => { win = null; });
}

app.whenReady().then(() => {
  createWindow();

  // macOS: re-create a window when the dock icon is clicked and none are open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when the window is closed — including on macOS. This is a local dev tool
// launched via `npm start`, so closing the window should end the process instead
// of leaving the app resident in the dock (the usual macOS convention). Use
// Cmd+Q or just close the window; either way `npm start` exits.
app.on('window-all-closed', () => {
  app.quit();
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
