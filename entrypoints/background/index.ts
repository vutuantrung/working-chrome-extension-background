import * as services from "./services";
import { createApplicationServices } from "./bootstrap";
import * as extensionHandlers from "./handlers/extension";
import { chromeApi } from "./infrastructure/chrome-api/chrome-api";
import { browser } from "wxt/browser";
import { Constants } from "./utils/constants";
import { ApplicationServices } from "./application-services";


// ========================================
// WXT BACKGROUND ENTRY POINT
// ========================================
export default defineBackground(() => {
  console.log("Hello background!", { id: browser.runtime.id });

  // Initialize only in browser context (not in WXT dev shadow environment)
  if (import.meta.env.BROWSER) {

    const services = createApplicationServices();


    initializeBackgroundServices(services);
    initializeState();
  }
});

function initializeState() {
  // Initialize the proxy health check alarm if it doesn't already exist.
  try {
    services.alarmService.getAlarm(Constants.PROXY_HEALTH_CHECK_ALARM).then((existing) => {
      if (existing) return;
      services.alarmService.createAlarm(Constants.PROXY_HEALTH_CHECK_ALARM, {
        delayInMinutes: 0.2,
        periodInMinutes: 1,
      });
    });
  } catch { }

  // Initialize the proxy health state to "ok" on service worker boot.
  try {
    services.proxyService.storeProxyData({
      state: "ok",
      reason: "sw_boot",
      lastOkAt: Date.now(),
      lastErrorAt: undefined,
      error: undefined,
      details: undefined,
      consecutiveFailures: 0,
    });

    Promise.resolve(services.proxyService.checkProxyStatus());
  } catch { }
}

// ========================================
// INITIALIZATION
// ========================================
function initializeBackgroundServices(applicationServices: ApplicationServices) {
  console.log("Initializing background services...");

  // Register all Chrome API event listeners
  // ========================================
  // ACTION HANDLERS
  // ========================================
  chromeApi.action.onClicked.addListener(extensionHandlers.actionOnClickedHandler);


  // ========================================
  // RUNTIME HANDLERS
  // ========================================
  chromeApi.runtime.onMessage.addListener(extensionHandlers.createRunTimeOnMessageHandler(applicationServices));
  chromeApi.runtime.onInstalled.addListener(extensionHandlers.createRunTimeOnInstalledHandler(applicationServices));


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
  chromeApi.webRequest.onAuthRequired.addListener(extensionHandlers.webRequestOnAuthRequiredHandler, { urls: ["<all_urls>"] }, ["asyncBlocking"]);


  // Provide proxy auth credentials (username/password) to avoid browser prompt.
  // NOTE: chrome.proxy.settings cannot apply credentials; must use webRequest.onAuthRequired.
  // registerProxyAuthProvider();

  // ========================================
  // PROXY HANDLERS
  // ========================================
  chromeApi.proxy.onProxyError.addListener(extensionHandlers.onProxyErrorHandler);


  // Setup side panel - open when extension icon clicked
  chromeApi.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((e) => {
    console.warn("[sidePanel] setPanelBehavior not supported:", e);
  });
}
