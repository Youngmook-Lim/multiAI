// Grok adapter — https://grok.com
//
// ⚠️ FRAGILE SELECTORS — verify against the LIVE site (Inspect the message box
//    and the send/submit button, update the arrays). As of late 2025 the Grok
//    composer is a plain <textarea>; the submit control is a button[type=submit].

(function () {
  window.MULTIAI = window.MULTIAI || {};
  window.MULTIAI.adapters = window.MULTIAI.adapters || {};
  window.MULTIAI.adapters.grok = {
    url: 'https://grok.com',
    partition: 'persist:grok',
    input: [
      'textarea',
      'div[contenteditable="true"]',
    ],
    send: [
      'button[type="submit"]',
      'button[aria-label*="Send" i]',
      'button[aria-label*="Submit" i]',
    ],
    inject: function (text) { return window.MULTIAI.buildInjection(text, this); },
  };
})();
