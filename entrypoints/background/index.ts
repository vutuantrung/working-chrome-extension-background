import { chromeApi } from "./infrastructure/chrome-api/chrome-api";
import { browser } from "wxt/browser";
import { PROXY_HEALTH_CHECK_ALARM } from "./state";
import { setProxyHealth, handleProxyHealthCheck } from "./services/proxyServices";

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
  chromeApi.action.onClicked.addListener(extensionHandlers.actionOnClickedHandler);

  // Setup side panel - open when extension icon clicked
  extensionHandlers.setupSidePanelBehavior();

  // ========================================
  // RUNTIME HANDLERS
  // ========================================
  chromeApi.runtime.onMessage.addListener(extensionHandlers.runTimeOnMessageHandler);
  chromeApi.runtime.onInstalled.addListener(extensionHandlers.runTimeOnInstalledHandler);

  // ========================================
  // TAB HANDLERS
  // ========================================
  chromeApi.tabs.onUpdated.addListener(extensionHandlers.tabsOnUpdatedHandler);
  chromeApi.tabs.onRemoved.addListener(extensionHandlers.tabsOnRemovedHandler);
  chromeApi.tabs.onActivated.addListener(extensionHandlers.tabsOnActivatedHandler);

  // ========================================
  // ALARMS HANDLERS
  // ========================================
  chromeApi.alarms.onAlarm.addListener(extensionHandlers.alarmsOnAlarmHandler);
  try {
    chromeApi.alarms.get(PROXY_HEALTH_CHECK_ALARM, (existing) => {
      if (existing) return;
      chromeApi.alarms.create(PROXY_HEALTH_CHECK_ALARM, {
        delayInMinutes: 0.2,
        periodInMinutes: 1,
      });
    });
  } catch { }

  // ========================================
  // STORAGE HANDLERS
  // ========================================
  chromeApi.storage.onChanged.addListener(extensionHandlers.storageOnChangedHandler);

  // ========================================
  // WINDOWS HANDLERS
  // ========================================
  chromeApi.windows.onFocusChanged.addListener(extensionHandlers.windowOnFocusChangedHandler);

  // ========================================
  // WEB REQUEST HANDLERS
  // ========================================
  chromeApi.webRequest.onAuthRequired.addListener(
    extensionHandlers.webRequestOnAuthRequiredHandler,
    { urls: ["<all_urls>"] },
    ["asyncBlocking"],
  );

  // Provide proxy auth credentials (username/password) to avoid browser prompt.
  // NOTE: chromeApi.proxy.settings cannot apply credentials; must use webRequest.onAuthRequired.
  // registerProxyAuthProvider();

  // ========================================
  // PROXY HANDLERS
  // ========================================
  chromeApi.proxy.onProxyError.addListener(extensionHandlers.onProxyErrorHandler);
  try {
    setProxyHealth({
      state: "ok",
      reason: "sw_boot",
      lastOkAt: Date.now(),
      lastErrorAt: undefined,
      error: undefined,
      details: undefined,
      consecutiveFailures: 0,
    });

    Promise.resolve(handleProxyHealthCheck());
  } catch { }
}
