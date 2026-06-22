// Claude adapter — https://claude.ai
//
// ⚠️ FRAGILE SELECTORS — verify against the LIVE site (Inspect the message box
//    and the send button, update the arrays). As of late 2025 the Claude
//    composer is a contenteditable ProseMirror div; the send button carries
//    aria-label="Send message".

(function () {
  window.MULTIAI = window.MULTIAI || {};
  window.MULTIAI.adapters = window.MULTIAI.adapters || {};
  window.MULTIAI.adapters.claude = {
    url: 'https://claude.ai',
    partition: 'persist:claude',
    input: [
      'div.ProseMirror[contenteditable="true"]',
      'div[contenteditable="true"]',
      'textarea',
    ],
    send: [
      'button[aria-label="Send message"]',
      'button[aria-label*="Send" i]',
    ],
    inject: function (text) { return window.MULTIAI.buildInjection(text, this); },
  };
})();
