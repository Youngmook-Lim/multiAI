# MultiAI

A personal macOS desktop app that puts **ChatGPT, Gemini, Grok, and Claude** in one
window. Type a prompt once and it's sent to all four at the same time; keep chatting and
each conversation continues in its own pane. You log into each site once and stay logged
in.

> Personal, local tool for macOS — not for distribution.

---

## Getting started (first time — non-technical friendly)

You do steps 1–3 **once**. After that, launching the app is a single double-click.

**What you need:** a Mac, about 10 minutes, and your Mac password (for the installer).

### Step 1 — Install Node.js (the engine the app runs on)
1. Go to **https://nodejs.org**
2. Click the button labeled **"LTS"** (it also says *"Recommended for Most Users"*). This
   downloads an installer file ending in `.pkg`.
3. Open that file from your **Downloads** folder and click through the installer:
   **Continue → Agree → Install**, then enter your Mac password.
4. That's it — there's no app to open, it just installs in the background.

### Step 2 — Download MultiAI
1. Go to **https://github.com/Youngmook-Lim/multiAI**
2. Click the green **`< > Code`** button, then **"Download ZIP"**.
3. Open your **Downloads** folder and double-click the ZIP to unzip it. You'll get a
   folder named **`multiAI-main`**.
4. Move that folder somewhere easy to find, like **Documents**.

### Step 3 — One-time setup (copy & paste)
1. Open the **Terminal** app: press **⌘ + Space**, type **Terminal**, press **Return**.
2. In the Terminal window, type `cd ` (the letters **c**, **d**, then a **space**) — then
   **drag the `multiAI-main` folder from Finder onto the Terminal window** and press
   **Return**. (This points Terminal at the app's folder, so you don't have to type the
   path.)
3. Copy the line below, paste it into Terminal, and press **Return**:
   ```
   npm install && chmod +x MultiAI.command
   ```
   Wait about a minute while it finishes (lots of scrolling text is normal). When the
   prompt reappears, it's done — you can close Terminal.

### Step 4 — Launch the app
Open the `multiAI-main` folder and **double-click `MultiAI.command`**.

- **First time only:** macOS may say the file is *"from an unidentified developer"* or
  can't be verified. If so, **right-click** (or Control-click) `MultiAI.command` →
  **Open** → **Open**. You only do this once.
- A small Terminal window appears while the app is running and closes itself a few seconds
  after you quit the app — that's normal.
- **Tip:** drag `MultiAI.command` onto the right-hand side of the Dock for one-click
  launching.

### Step 5 — Log in (first launch only)
The four panes show each site's login page. Log into each one. Your logins are remembered,
so you won't have to sign in again next time.

---

## Using the app
- **Send to all four:** type in the bar at the bottom and press **Enter** (Shift+Enter for
  a new line). Your message goes to every enabled pane at once.
- **Zoom one pane:** click the pane, then **Ctrl +** / **Ctrl −** to zoom, **Ctrl 0** to
  reset (⌘ also works). Each pane shows its zoom % in its header — click that % to snap it
  back to 100%.
- **Reload / expand a pane:** use the buttons in that pane's header.
- **Settings (gear icon, top-right):** turn individual sites on/off, or **Clear session**
  to log out of one site.
- **Quit:** just close the window — the app fully quits.

### Updating to a newer version
Re-download the ZIP (Step 2), replace your old folder, and repeat Step 3. (If you used
`git clone` instead, run `git pull`.)

---

## Troubleshooting
- **Double-clicking `MultiAI.command` opens a text editor instead of running it.** The file
  lost its "executable" flag (common with ZIP downloads). Redo the `chmod +x MultiAI.command`
  part of Step 3.
- **Terminal says `npm: command not found`.** Node.js isn't installed yet, or Terminal was
  already open when you installed it. Finish Step 1, then quit and reopen Terminal.
- **A site won't stay logged in (usually Gemini).** Google sometimes blocks sign-in inside
  embedded windows (*"this browser may not be secure"*). That's a Google restriction, not a
  bug here.
- **A prompt didn't get typed into a site.** The sites occasionally change their page layout;
  see *Per-site selectors* below to fix it.

---

## For developers

### Run it directly
```bash
npm install      # installs Electron locally (nothing global)
npm start        # launches the app
```
(`MultiAI.command` just wraps these two steps and auto-closes its Terminal window.)

### How it works
- `main.js` — creates one `BrowserWindow` (`contextIsolation: true`,
  `nodeIntegration: false`, `webviewTag: true`) and loads `renderer.html`. **Quits when the
  window is closed** (including on macOS). Also intercepts the per-pane zoom keys
  (`Ctrl +/-/0`) before the embedded sites can swallow them, and handles the one privileged
  action — clearing a site's stored session — over IPC.
- `preload.js` — exposes exactly two things to the page via `contextBridge`:
  `window.multiAI.clearSession(paneId)` and a zoom-update subscription. No raw Node reaches
  the renderer or the embedded sites.
- `renderer.html` — the UI shell (built separately). Mostly untouched; six `<script>` tags
  were appended at the bottom to load the integration. It stays runnable in a plain browser
  (the integration detects "not Electron" and no-ops, leaving the placeholders visible).
- `electron-integration.js` — replaces each pane's placeholder with a persistent
  `<webview>`, then wires the shell's hooks (`onPromptSubmit`, `onPaneReload`,
  `onPaneExpand`, `onSettingsChange`), the status dots (`setPaneStatus`), and the zoom-%
  badges.
- `adapters/*.js` — one module per site, holding that site's URL, partition, and **CSS
  selectors** for its message box and send button. `adapters/_shared.js` holds the generic
  "set text + send" logic shared by all four.

The four webviews are created once and **never removed from the DOM** — expand and the
narrow-window tab switcher only toggle CSS `display`, so live login sessions are never torn
down. Each site uses its own `persist:<site>` partition, which is why logins survive
restarts.

### ⚠️ Per-site selectors (the fragile part)
Injecting into someone else's web app means guessing the DOM. The selectors in
`adapters/*.js` are **best-effort guesses** and **will break** when a site redesigns.
They're isolated in one small file per site so you can fix them independently. Each adapter
exposes:

- `input` — ordered list of candidate selectors for the message box (first **visible** match
  wins).
- `send` — candidate selectors for the send button (first visible match wins; if none is
  found/enabled, the injector falls back to dispatching **Enter**).

| Site | File | Best-guess message box | Best-guess send button |
|------|------|------------------------|------------------------|
| ChatGPT | `adapters/chatgpt.js` | `#prompt-textarea` (contenteditable) | `button[data-testid="send-button"]` |
| Gemini  | `adapters/gemini.js`  | `rich-textarea .ql-editor` | `button[aria-label*="Send"]` |
| Grok    | `adapters/grok.js`    | `textarea` | `button[type="submit"]` |
| Claude  | `adapters/claude.js`  | `div.ProseMirror[contenteditable="true"]` | `button[aria-label="Send message"]` |

To correct one: open that pane, right-click the message box → **Inspect** (DevTools opens
for the embedded site), copy a reliable selector, and put it first in that adapter's `input`
array. Do the same for the send button → `send`. No rebuild needed — just relaunch the app.

The injector handles two input types automatically: rich contenteditable editors
(ProseMirror/Quill/Lexical — ChatGPT, Claude, Gemini) via `execCommand('insertText')`, and
plain `<textarea>`/`<input>` behind React via the native value setter plus `input`/`change`
events. A naive `el.value = …` does **not** work on these framework-controlled inputs, which
is why this dance is necessary.

### Known caveats
- **Google sign-in (Gemini)** may be refused inside an embedded view ("this browser or app
  may not be secure"). It sometimes works; if it doesn't, Gemini is the one pane that may not
  stay logged in.
- Status dots are best-effort signals: `sending` while loading/injecting, `loaded` when the
  page settles or the prompt is submitted, `error` if the input/button couldn't be found or a
  load failed. "loaded" means the prompt was *submitted*, not that a full answer has rendered.
- A `<webview>` hidden via `display:none` (collapsed/inactive panes) keeps its session alive
  but doesn't paint; it repaints when shown again.
