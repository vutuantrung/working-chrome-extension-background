import { chromeApi } from "./infrastructure/chrome-api/chrome-api";
import { browser } from "wxt/browser";
import * as services from "./services";
import { Constants } from "./utils/constants";

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
    chromeApi.alarms.get(Constants.PROXY_HEALTH_CHECK_ALARM, (existing) => {
      if (existing) return;
      chromeApi.alarms.create(Constants.PROXY_HEALTH_CHECK_ALARM, {
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
    services.proxyServices.setProxyHealth({
      state: "ok",
      reason: "sw_boot",
      lastOkAt: Date.now(),
      lastErrorAt: undefined,
      error: undefined,
      details: undefined,
      consecutiveFailures: 0,
    });

    Promise.resolve(services.proxyServices.handleProxyHealthCheck());
  } catch { }

  // Setup side panel - open when extension icon clicked
  chromeApi.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((e) => {
    console.warn("[sidePanel] setPanelBehavior not supported:", e);
  });
}
