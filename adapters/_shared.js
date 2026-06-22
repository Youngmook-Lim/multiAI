// Shared injection mechanism for the per-site adapters.
//
// Loaded as a plain <script> in renderer.html (no module system, no bundler).
// The fragile, site-specific part — the CSS selectors — lives in each
// adapters/<site>.js file. This file only holds the generic "set text + send"
// logic that runs INSIDE each site's page.

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // guestInjector runs in the TARGET SITE's page (serialized via .toString()
  // and handed to <webview>.executeJavaScript). It must be fully self-contained:
  // it cannot reference anything from this renderer. cfg = { text, input[], send[] }.
  // ---------------------------------------------------------------------------
  function guestInjector(cfg) {
    function findVisible(selectors) {
      for (var i = 0; i < selectors.length; i++) {
        var els;
        try { els = document.querySelectorAll(selectors[i]); } catch (e) { continue; }
        for (var j = 0; j < els.length; j++) {
          var el = els[j];
          var r = el.getBoundingClientRect();
          var st = window.getComputedStyle(el);
          if (r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none') {
            return el;
          }
        }
      }
      return null;
    }

    try {
      var input = findVisible(cfg.input);
      if (!input) return { ok: false, reason: 'input-not-found' };

      input.focus();

      if (input.isContentEditable) {
        // Rich editors (ProseMirror / Quill / Lexical — ChatGPT, Claude, Gemini).
        // Put the caret at the end, then use execCommand('insertText'): it fires
        // the same input events the framework listens for. A naive textContent
        // assignment would be ignored by the editor's model.
        var selObj = window.getSelection();
        selObj.removeAllRanges();
        var range = document.createRange();
        range.selectNodeContents(input);
        range.collapse(false);
        selObj.addRange(range);
        document.execCommand('insertText', false, cfg.text);
      } else {
        // Plain <textarea>/<input> behind React: assign through the native value
        // setter so React's onChange fires, then dispatch input + change.
        var proto = input.tagName === 'TEXTAREA'
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
        var setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(input, cfg.text);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Let the framework re-render and enable the send button, then click it.
      return new Promise(function (resolve) {
        setTimeout(function () {
          var btn = findVisible(cfg.send);
          if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
            btn.click();
            resolve({ ok: true, method: 'click' });
            return;
          }
          // Fallback: press Enter in the input (many composers submit on Enter).
          function key(type) {
            return new KeyboardEvent(type, {
              key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
              bubbles: true, cancelable: true,
            });
          }
          input.dispatchEvent(key('keydown'));
          input.dispatchEvent(key('keypress'));
          input.dispatchEvent(key('keyup'));
          resolve({ ok: true, method: 'enter-fallback', sawButton: !!btn });
        }, 200);
      });
    } catch (e) {
      return { ok: false, reason: String((e && e.message) || e) };
    }
  }

  window.MULTIAI = window.MULTIAI || {};
  window.MULTIAI.adapters = window.MULTIAI.adapters || {};

  // Build the code string to run in a guest page for a given adapter.
  // `adapter` supplies { text, input[], send[] }.
  window.MULTIAI.buildInjection = function (text, adapter) {
    var payload = JSON.stringify({ text: text, input: adapter.input, send: adapter.send });
    return '(' + guestInjector.toString() + ')(' + payload + ');';
  };
})();
