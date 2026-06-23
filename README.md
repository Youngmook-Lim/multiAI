# MultiAI

A personal macOS desktop app (Electron) that embeds **ChatGPT, Gemini, Grok, and Claude**
in one window. Type a single prompt and it is injected into all four at once;
follow-up prompts continue each conversation in place. Each site keeps its own
persistent login session, so you log in once.

> Personal, local tool — not for distribution.

## Run it

```bash
npm install      # installs Electron locally (nothing global)
npm start        # launches the app
```

**Or just double-click `MultiAI.command`** in Finder — it installs deps on first
run if needed and launches the app, no terminal typing required. To launch it
from the Dock, drag `MultiAI.command` onto the right-hand side of the Dock.

On **first launch** every pane will show each site's login screen. Log into each
one once — sessions persist across restarts (each site uses its own
`persist:<site>` partition), so you won't need to log in again unless you clear
that pane's session from the Settings drawer (the gear icon).

## How it works

- `main.js` — creates one `BrowserWindow` (`contextIsolation: true`,
  `nodeIntegration: false`, `webviewTag: true`) and loads `renderer.html`.
  Standard macOS lifecycle (stays in the dock when the window closes, re-opens
  on dock click). Also handles the one privileged action — clearing a site's
  stored session — over IPC.
- `preload.js` — exposes exactly one thing to the page via `contextBridge`:
  `window.multiAI.clearSession(paneId)`. No raw Node reaches the renderer or the
  embedded sites.
- `renderer.html` — the UI shell (built separately). Mostly untouched; six
  `<script>` tags were appended at the bottom to load the integration. It stays
  runnable in a plain browser (the integration detects "not Electron" and
  no-ops, leaving the placeholders visible).
- `electron-integration.js` — replaces each pane's placeholder with a persistent
  `<webview>`, then wires the shell's hooks:
  `onPromptSubmit`, `onPaneReload`, `onPaneExpand`, `onSettingsChange`, and the
  status dots via `setPaneStatus`.
- `adapters/*.js` — one module per site. Each holds that site's URL, partition,
  and **CSS selectors** for its message box and send button. `adapters/_shared.js`
  holds the generic "set text + send" logic shared by all four.

The four webviews are created once and **never removed from the DOM** — expand
and the narrow-window tab switcher only toggle CSS `display`, so live login
sessions are never torn down.

## ⚠️ The fragile part: per-site selectors

Injecting into someone else's web app means guessing the DOM. The selectors in
`adapters/*.js` are **best-effort guesses** and **will break** when a site
redesigns. They're isolated in one small file per site so you can fix them
independently. Each adapter exposes:

- `input` — an ordered list of candidate selectors for the message box
  (first **visible** match wins).
- `send` — candidate selectors for the send button (first visible match wins;
  if none is found/enabled, the injector falls back to dispatching **Enter**).

Where to look and verify against the live sites:

| Site | File | Best-guess message box | Best-guess send button |
|------|------|------------------------|------------------------|
| ChatGPT | `adapters/chatgpt.js` | `#prompt-textarea` (contenteditable) | `button[data-testid="send-button"]` |
| Gemini  | `adapters/gemini.js`  | `rich-textarea .ql-editor` | `button[aria-label*="Send"]` |
| Grok    | `adapters/grok.js`    | `textarea` | `button[type="submit"]` |
| Claude  | `adapters/claude.js`  | `div.ProseMirror[contenteditable="true"]` | `button[aria-label="Send message"]` |

To correct one: open that pane, right-click the message box → **Inspect**
(DevTools opens for the embedded site), copy a reliable selector, and put it
first in that adapter's `input` array. Do the same for the send button →
`send`. No rebuild needed — just restart `npm start`.

The injector handles two input types automatically: rich contenteditable editors
(ProseMirror/Quill/Lexical — ChatGPT, Claude, Gemini) via
`execCommand('insertText')`, and plain `<textarea>`/`<input>` behind React via
the native value setter plus `input`/`change` events. A naive `el.value = …`
does **not** work on these framework-controlled inputs, which is why this dance
is necessary.

## Known caveats

- **Google sign-in (Gemini)** may be refused inside an embedded view
  ("this browser or app may not be secure"). This is a Google restriction on
  embedded/automation browsers, not a bug here. It sometimes works; if it
  doesn't, Gemini is the one pane that may not stay logged in.
- Status dots reflect best-effort signals: `sending` while injecting/loading,
  `loaded` when the injection ran (or the page finished loading), `error` if the
  input/button couldn't be found or the load failed. "loaded" means the prompt
  was *submitted*, not that a full answer has rendered.
- A `<webview>` hidden via `display:none` (collapsed/inactive panes) keeps its
  session alive but doesn't paint; it repaints when shown again.
