import { browser } from "wxt/browser";
import { PROXY_HEALTH_CHECK_ALARM } from "./state";
import { ProxyService } from "./services/proxyServices";

import * as extensionHandlers from "./handlers/extension";

// ========================================
// WXT BACKGROUND ENTRY POINT
// ========================================
export default defineBackground(() => {
  console.log("Hello background!", { id: browser.runtime.id });

  // Initialize only in browser context (not in WXT dev shadow environment)
  if (import.meta.env.BROWSER) {
    initializeBackgroundServices();
  }
});

// ========================================
// INITIALIZATION
// ========================================
function initializeBackgroundServices() {
  console.log("Initializing background services...");
  // Register all Chrome API event listeners
  // ========================================
  // ACTION HANDLERS
  // ========================================
  chrome.action.onClicked.addListener(extensionHandlers.actionOnClickedHandler);

  // Setup side panel - open when extension icon clicked
  extensionHandlers.setupSidePanelBehavior();

  // ========================================
  // RUNTIME HANDLERS
  // ========================================
  chrome.runtime.onMessage.addListener(extensionHandlers.runTimeOnMessageHandler);
  chrome.runtime.onInstalled.addListener(extensionHandlers.runTimeOnInstalledHandler);

  // ========================================
  // TAB HANDLERS
  // ========================================
  chrome.tabs.onUpdated.addListener(extensionHandlers.tabsOnUpdatedHandler);
  chrome.tabs.onRemoved.addListener(extensionHandlers.tabsOnRemovedHandler);
  chrome.tabs.onActivated.addListener(extensionHandlers.tabsOnActivatedHandler);

  // ========================================
  // ALARMS HANDLERS
  // ========================================
  chrome.alarms.onAlarm.addListener(extensionHandlers.alarmsOnAlarmHandler);
  try {
    chrome.alarms.get(PROXY_HEALTH_CHECK_ALARM, (existing) => {
      if (existing) return;
      chrome.alarms.create(PROXY_HEALTH_CHECK_ALARM, {
        delayInMinutes: 0.2,
        periodInMinutes: 1,
      });
    });
  } catch { }

  // ========================================
  // STORAGE HANDLERS
  // ========================================
  chrome.storage.onChanged.addListener(extensionHandlers.storageOnChangedHandler);

  // ========================================
  // WINDOWS HANDLERS
  // ========================================
  chrome.windows.onFocusChanged.addListener(extensionHandlers.windowOnFocusChangedHandler);

  // ========================================
  // WEB REQUEST HANDLERS
  // ========================================
  chrome.webRequest.onAuthRequired.addListener(
    extensionHandlers.webRequestOnAuthRequiredHandler,
    { urls: ["<all_urls>"] },
    ["asyncBlocking"],
  );

  // Provide proxy auth credentials (username/password) to avoid browser prompt.
  // NOTE: chrome.proxy.settings cannot apply credentials; must use webRequest.onAuthRequired.
  // ProxyService.getInstance().registerProxyAuthProvider();

  // ========================================
  // PROXY HANDLERS
  // ========================================
  chrome.proxy.onProxyError.addListener(extensionHandlers.onProxyErrorHandler);
  try {
    ProxyService.getInstance().setProxyHealth({
      state: "ok",
      reason: "sw_boot",
      lastOkAt: Date.now(),
      lastErrorAt: undefined,
      error: undefined,
      details: undefined,
      consecutiveFailures: 0,
    });

    Promise.resolve(ProxyService.getInstance().handleProxyHealthCheck());
  } catch { }
}
