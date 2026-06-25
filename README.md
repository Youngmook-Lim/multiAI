# MultiAI

A desktop app that runs **ChatGPT, Gemini, Grok, and Claude** side by side in a single
window. A prompt typed in the shared composer is sent to all four services at once, and
each pane keeps its own ongoing conversation. You sign in to each service once; sessions
persist between launches.

Built with Electron. This is a personal, local tool — it is not packaged or distributed.

## Requirements

- Windows, macOS, or Linux (Electron is cross-platform). The app was developed and used on
  macOS; the `MultiAI.command` launcher is macOS-only, but every platform can run it with
  `npm start`.
- [Node.js](https://nodejs.org) 18 or newer (the LTS release is recommended).

Check whether Node.js is already installed:

```bash
node --version
```

If the command is not found, install Node.js using the official installer from
[nodejs.org](https://nodejs.org), or a package manager:

- **macOS** (Homebrew): `brew install node`
- **Windows** (winget): `winget install OpenJS.NodeJS.LTS`
- **Linux**: use your distribution's package manager, or [nvm](https://github.com/nvm-sh/nvm)

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Youngmook-Lim/multiAI.git
cd multiAI
npm install
```

Alternatively, download the repository as a ZIP from GitHub and unzip it, then run
`npm install` inside the folder. Note that ZIP archives do not preserve the executable
flag on `MultiAI.command`; if you plan to use the launcher (below), run
`chmod +x MultiAI.command` once.

## Usage

Start the app from the project directory:

```bash
npm start
```

On macOS, you can instead double-click **`MultiAI.command`** in Finder, which runs the steps
above and launches the app; drag it onto the Dock for quick access. Because the script is
unsigned, the first launch may require right-clicking it and choosing **Open** to clear
macOS Gatekeeper. (This launcher is macOS-only; on Windows and Linux, use `npm start`.)

On first launch, each pane shows the corresponding service's sign-in page. Sign in to each
one; logins are stored per service and persist across restarts.

Day-to-day controls:

- **Send to all services** — type in the bottom composer and press Enter (Shift+Enter
  inserts a newline). The prompt is delivered to every enabled pane.
- **Zoom a pane** — focus a pane, then use `Ctrl +` / `Ctrl -` to zoom and `Ctrl 0` to
  reset (the ⌘ equivalents also work). Each pane displays its current zoom level in its
  header; clicking that value resets it to 100%.
- **Reload or expand a pane** — use the controls in each pane's header.
- **Settings** — the gear icon opens a drawer to enable/disable individual services or
  clear a service's stored session.
- **Quit** — closing the window quits the app.

## Configuration: per-site selectors

Sending a prompt requires locating each site's message box and send button in the DOM, so
the app uses a small adapter per service. Because these target third-party markup, the
selectors can break when a site changes its layout. Each adapter lives in its own file
under `adapters/` and exposes two ordered lists of candidate selectors — `input` for the
message box and `send` for the send button — where the first visible match is used. If no
send button is found, the injector falls back to dispatching Enter.

| Service | File | Message box | Send button |
|---------|------|-------------|-------------|
| ChatGPT | `adapters/chatgpt.js` | `#prompt-textarea` | `button[data-testid="send-button"]` |
| Gemini  | `adapters/gemini.js`  | `rich-textarea .ql-editor` | `button[aria-label*="Send"]` |
| Grok    | `adapters/grok.js`    | `textarea` | `button[type="submit"]` |
| Claude  | `adapters/claude.js`  | `div.ProseMirror[contenteditable="true"]` | `button[aria-label="Send message"]` |

To update a selector, open the relevant pane, inspect the message box or send button, and
place a reliable selector first in that adapter's list. Changes take effect on the next
launch; no build step is required.

The injector supports two input types: rich contenteditable editors (ProseMirror, Quill,
Lexical) via `execCommand('insertText')`, and plain `<textarea>`/`<input>` elements via the
native value setter followed by `input` and `change` events. Assigning `element.value`
directly does not work with these framework-controlled inputs.

## Architecture

- **`main.js`** — the Electron main process. Creates a single `BrowserWindow`
  (`contextIsolation: true`, `nodeIntegration: false`, `webviewTag: true`), loads
  `renderer.html`, and quits when the window closes. It intercepts the per-pane zoom keys
  (`Ctrl +/-/0`) before the embedded sites receive them, and clears a service's stored
  session over IPC.
- **`preload.js`** — exposes a minimal API to the page via `contextBridge`:
  `clearSession(paneId)` and a zoom-update subscription. No Node APIs are exposed to the
  renderer or the embedded sites.
- **`renderer.html`** — the UI shell. Six `<script>` tags load the integration layer; the
  shell remains usable in a plain browser, where the integration detects the absence of
  Electron and leaves placeholders in place.
- **`electron-integration.js`** — replaces each pane's placeholder with a persistent
  `<webview>` and wires the shell's hooks (`onPromptSubmit`, `onPaneReload`, `onPaneExpand`,
  `onSettingsChange`), the status indicators, and the zoom-level badges.
- **`adapters/*.js`** — one module per service, each defining its URL, session partition,
  and selectors. `adapters/_shared.js` contains the shared injection logic.

The four webviews are created once and never removed from the DOM; expanding a pane and the
narrow-window tab switcher only toggle CSS visibility, so sessions are never torn down. Each
service uses a dedicated `persist:<service>` partition, which is what allows logins to
survive restarts.

## Limitations

- Google may decline sign-in within an embedded view ("this browser or app may not be
  secure"). This is a Google restriction on embedded browsers; when it occurs, the Gemini
  pane may not stay signed in.
- The status indicators are heuristic: a pane reads as loading while a page or injection is
  in progress, loaded once it settles or a prompt is submitted, and error if a selector
  cannot be found or a page fails to load. "Loaded" indicates the prompt was submitted, not
  that a response has finished rendering.
- A webview hidden with `display:none` (a collapsed or inactive pane) retains its session
  but does not render until shown again.

## Disclaimer

This is an unofficial, personal project. It is not affiliated with, endorsed by, or
sponsored by OpenAI, Google, xAI, or Anthropic. "ChatGPT", "Gemini", "Grok", and "Claude"
are trademarks of their respective owners. Automating these services' web interfaces may be
contrary to their terms of service; use this software at your own risk.

## License

Released under the [MIT License](LICENSE).
