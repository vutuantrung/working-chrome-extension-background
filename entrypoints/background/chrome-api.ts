/**
 * Single gateway for browser APIs used by the extension background.
 * Getters resolve lazily so this module can be imported by Node.js tests.
 * The facade is intentionally small: existing Chrome signatures/events are preserved.
 *
 * Future refactors should depend on narrower injected interfaces for business logic.
 */
export const chromeApi = {
  get action() { return chrome.action; },
  get runtime() { return chrome.runtime; },
  get tabs() { return chrome.tabs; },
  get alarms() { return chrome.alarms; },
  get storage() { return chrome.storage; },
  get windows() { return chrome.windows; },
  get webRequest() { return chrome.webRequest; },
  get proxy() { return chrome.proxy; },
  get cookies() { return chrome.cookies; },
  get scripting() { return chrome.scripting; },
  get downloads() { return chrome.downloads; },
  get notifications() { return chrome.notifications; },
  get webNavigation() { return chrome.webNavigation; },
  get sidePanel() { return chrome.sidePanel; },
} as const;
