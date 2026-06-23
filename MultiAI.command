#!/bin/zsh
# MultiAI launcher — double-click in Finder (or keep it in the Dock) to start the
# app without opening a terminal yourself. Runs from this script's own folder
# (no hardcoded paths) and auto-closes its Terminal window after the app quits.

# Load your shell config so node/npm are on PATH (covers Homebrew, nvm, etc.).
[ -f "$HOME/.zshrc" ] && source "$HOME/.zshrc" >/dev/null 2>&1

cd "$(dirname "$0")" || exit 1

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found. Install Node.js from https://nodejs.org (or fix your PATH)."
  echo "Press any key to close…"
  read -k1
  exit 1
fi

# Remember THIS Terminal window so we can close only it later. First run shows a
# one-time macOS prompt ("Terminal wants to control Terminal") — click OK/Allow.
WIN_ID=$(osascript -e 'tell application "Terminal" to id of front window' 2>/dev/null)

# Install dependencies on first run, then launch and wait until the app quits.
[ -d node_modules ] || npm install
npm start
RC=$?

# On a clean exit (you closed the app window), close THIS Terminal window a few
# seconds later. The closer daemonizes via perl (fork + setsid) so it runs in its
# own session with no controlling terminal — by the time it fires, this window has
# no live process, so Terminal closes it silently (no "processes running?" prompt).
# On a non-zero exit (a crash) we leave the window open so you can read the error.
if [ "$RC" -eq 0 ] && [ -n "$WIN_ID" ]; then
  echo ""
  echo "MultiAI closed — this window will close automatically in 3 seconds..."
  # Close the window 3s later from a detached helper (fork + setsid). The script
  # exits right after, so "[Process completed]" prints just below this message and
  # the tab has no live process left — Terminal closes it with no "processes are
  # running?" prompt.
  perl -e 'use POSIX qw(setsid); exit if fork; setsid; sleep 3;
           system("osascript","-e","tell application \"Terminal\" to close (every window whose id is '"$WIN_ID"')");' \
    >/dev/null 2>&1 </dev/null &
fi

exit $RC
