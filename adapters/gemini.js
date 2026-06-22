// Gemini adapter — https://gemini.google.com
//
// ⚠️ FRAGILE SELECTORS — verify against the LIVE site (Inspect the message box
//    and the send button, update the arrays). As of late 2025 the composer is a
//    Quill editor: a <rich-textarea> wrapping a contenteditable `.ql-editor`.
//
// NOTE: Google often blocks sign-in inside embedded/automation browsers
//    ("this browser or app may not be secure"). See README — Gemini login is the
//    least reliable of the four for this reason.

(function () {
  window.MULTIAI = window.MULTIAI || {};
  window.MULTIAI.adapters = window.MULTIAI.adapters || {};
  window.MULTIAI.adapters.gemini = {
    url: 'https://gemini.google.com',
    partition: 'persist:gemini',
    input: [
      'rich-textarea .ql-editor',
      'div.ql-editor[contenteditable="true"]',
      'div[contenteditable="true"]',
      'textarea',
    ],
    send: [
      'button[aria-label*="Send" i]',
      'button.send-button',
      'button[mattooltip*="Send" i]',
    ],
    inject: function (text) { return window.MULTIAI.buildInjection(text, this); },
  };
})();
