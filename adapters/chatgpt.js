// ChatGPT adapter — https://chatgpt.com
//
// ⚠️ FRAGILE SELECTORS — verify these against the LIVE site.
//    Open the ChatGPT pane, right-click the message box → Inspect, and confirm
//    the `input` selector; do the same for the send button → `send`. OpenAI
//    redesigns periodically and these will eventually break. First match that is
//    visible wins, so it's safe to list several candidates from specific → loose.
//    As of late 2025 the composer is a contenteditable ProseMirror div whose
//    container has id="prompt-textarea".

(function () {
  window.MULTIAI = window.MULTIAI || {};
  window.MULTIAI.adapters = window.MULTIAI.adapters || {};
  window.MULTIAI.adapters.chatgpt = {
    url: 'https://chatgpt.com',
    partition: 'persist:chatgpt',
    input: [
      '#prompt-textarea',                 // current contenteditable composer
      'div[contenteditable="true"]',      // generic ProseMirror fallback
      'textarea',                         // legacy textarea fallback
    ],
    send: [
      'button[data-testid="send-button"]',
      'button[aria-label*="Send" i]',
    ],
    inject: function (text) { return window.MULTIAI.buildInjection(text, this); },
  };
})();
