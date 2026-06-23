// MultiAI — Electron integration layer.
//
// Bridges the renderer.html UI shell to live <webview>s. This script:
//   1) replaces each pane's placeholder with a persistent <webview>, and
//   2) reassigns the shell's window.* hooks to drive real behavior.
//
// It runs ONLY inside Electron. In a plain browser it detects no Electron and
// no-ops, so renderer.html stays runnable as-is (placeholders remain visible).
//
// Why injection happens here (renderer) rather than via main's
// webContents.executeJavaScript: with webviewTag enabled, each <webview>
// element exposes executeJavaScript()/reload() directly to the page. That's the
// idiomatic, lowest-latency path and needs no extra IPC. The one capability that
// DOES require main-process privilege — clearing a partition's storage — goes
// through the preload bridge (window.multiAI.clearSession).

(function () {
  'use strict';

  var isElectron = /electron/i.test(navigator.userAgent);
  if (!isElectron) {
    console.log('[multiai] Not running in Electron — UI shell only, webviews disabled.');
    return;
  }

  var ADAPTERS = (window.MULTIAI && window.MULTIAI.adapters) || {};
  var PANES = ['chatgpt', 'gemini', 'grok', 'claude'];
  var webviews = {};
  var enabled = { chatgpt: true, gemini: true, grok: true, claude: true };
  var zoomLabels = {}; // paneId -> zoom-% badge element
  var idToPane = {};   // guest webContents id -> paneId

  // Styles for the zoom-% badge shown in each pane header.
  var zoomStyle = document.createElement('style');
  zoomStyle.textContent =
    '.zoom-pct{font:500 11px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--text-faint);' +
    'background:rgba(255,255,255,.03);border:1px solid var(--border-soft);border-radius:6px;' +
    'padding:2px 6px;min-width:42px;text-align:center;cursor:pointer;}' +
    '.zoom-pct:hover{color:var(--text);border-color:var(--border);}';
  document.head.appendChild(zoomStyle);

  // ---- 1) Mount a <webview> into each pane body, replacing the placeholder ----
  PANES.forEach(function (id) {
    var adapter = ADAPTERS[id];
    var host = document.querySelector('.pane-body[data-pane="' + id + '"]');
    if (!adapter || !host) {
      console.warn('[multiai] missing adapter or host for pane:', id);
      return;
    }

    var placeholder = host.querySelector('.placeholder');
    if (placeholder) placeholder.remove();

    var wv = document.createElement('webview');
    wv.setAttribute('src', adapter.url);
    // persist:<id> partition → cookies/logins survive app restarts (essential).
    wv.setAttribute('partition', adapter.partition);
    // allow window.open popups used by some OAuth/login flows.
    wv.setAttribute('allowpopups', '');
    // Sit exactly where the placeholder was (pane-body is position:relative).
    wv.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; border:0; background:#fff;';
    host.appendChild(wv);
    webviews[id] = wv;

    // Add a clickable zoom-% badge to this pane's header. Each forEach iteration
    // has its own `wv`/`badge`, so the click closure binds to the right pane.
    var section = host.closest('.pane');
    var actions = section && section.querySelector('.pane-actions');
    if (actions) {
      var badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'zoom-pct';
      badge.textContent = '100%';
      badge.title = 'Zoom: Ctrl +/–/0 · click to reset to 100%';
      badge.addEventListener('click', function () {
        wv.setZoomFactor(1);
        badge.textContent = '100%';
        // Aim keyboard zoom at THIS pane: clicking the badge (host chrome) would
        // otherwise leave focus off the webview, so Ctrl+/- would hit whatever
        // guest was focused last (e.g. Claude). Re-focus this pane's webview.
        wv.focus();
      });
      actions.insertBefore(badge, actions.firstChild);
      zoomLabels[id] = badge;
    }

    wv.addEventListener('did-start-loading', function () { window.setPaneStatus(id, 'sending'); });
    wv.addEventListener('dom-ready', function () {
      window.setPaneStatus(id, 'loaded');
      try { idToPane[wv.getWebContentsId()] = id; } catch (e) { /* not attached yet */ }
      // Chromium restores each origin's zoom from the persist: partition, so the
      // real zoom on load may not be 100%. Sync the badge to the actual factor
      // instead of leaving the hardcoded default. (Re-runs on reloads too.)
      try {
        var f = wv.getZoomFactor();
        var apply = function (val) {
          if (typeof val === 'number' && zoomLabels[id]) {
            zoomLabels[id].textContent = Math.round(val * 100) + '%';
          }
        };
        if (f && typeof f.then === 'function') { f.then(apply); } else { apply(f); }
      } catch (e) { /* getZoomFactor unavailable — leave default */ }
    });
    wv.addEventListener('did-fail-load', function (e) {
      // -3 == ERR_ABORTED, fired routinely on in-page navigations; ignore it.
      if (e.errorCode !== -3) window.setPaneStatus(id, 'error');
    });
  });

  // ---- 2) Wire the shell's hooks --------------------------------------------

  // Broadcast one prompt into every enabled pane.
  window.onPromptSubmit = async function (text) {
    for (var i = 0; i < PANES.length; i++) {
      var id = PANES[i];
      if (!enabled[id]) continue;
      var wv = webviews[id];
      var adapter = ADAPTERS[id];
      if (!wv || !adapter) continue;

      window.setPaneStatus(id, 'sending');
      try {
        var code = adapter.inject(text);
        // userGesture=true lets the injected code click/submit and open popups.
        var res = await wv.executeJavaScript(code, true);
        if (res && res.ok) {
          window.setPaneStatus(id, 'loaded');
        } else {
          console.warn('[multiai] injection problem in', id, res);
          window.setPaneStatus(id, 'error');
        }
      } catch (err) {
        console.error('[multiai] injection error in', id, err);
        window.setPaneStatus(id, 'error');
      }
    }
  };

  // Reload one pane's webview.
  window.onPaneReload = function (id) {
    var wv = webviews[id];
    if (wv) { window.setPaneStatus(id, 'sending'); wv.reload(); }
  };

  // Expand/collapse is pure CSS in the shell and never unmounts a webview;
  // nothing to do here beyond a trace.
  window.onPaneExpand = function (id, expanded) {
    console.log('[multiai] expand', id, expanded);
  };

  // Settings: track enable/disable (drives which panes receive prompts) and
  // handle "clear session" (wipe that partition via the preload bridge).
  window.onSettingsChange = function (config) {
    if (!config) return;

    if (config.all) {
      for (var id in config.all) {
        if (Object.prototype.hasOwnProperty.call(config.all, id)) {
          enabled[id] = !!config.all[id].enabled;
        }
      }
    }

    if (config.type === 'clearSession') {
      var pane = config.service;
      if (window.multiAI && window.multiAI.clearSession) {
        window.setPaneStatus(pane, 'sending');
        window.multiAI.clearSession(pane).then(function () {
          if (webviews[pane]) webviews[pane].reload(); // reflect the logout
        }).catch(function (e) {
          console.error('[multiai] clearSession failed for', pane, e);
          window.setPaneStatus(pane, 'error');
        });
      } else {
        console.warn('[multiai] clearSession bridge unavailable');
      }
    }
  };

  // Reflect keyboard zoom (handled in main.js) in the right pane's header badge.
  if (window.multiAI && window.multiAI.onZoom) {
    window.multiAI.onZoom(function (data) {
      var pane = idToPane[data.webContentsId];
      if (pane && zoomLabels[pane]) zoomLabels[pane].textContent = data.percent + '%';
    });
  }

  console.log('[multiai] Electron integration ready:', Object.keys(webviews).join(', '));
})();
