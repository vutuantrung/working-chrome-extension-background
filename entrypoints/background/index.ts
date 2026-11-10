import { createApplicationServices } from "./bootstrap";
import { Constants } from "./utils/constants";
import { ApplicationServices } from "./application-services";

function detectBrowser(): "chrome" | "firefox" | null {
  if (typeof chrome !== "undefined" && typeof chrome.runtime !== "undefined") {
    return "chrome";
  }
  return null;
}

// ========================================
// WXT BACKGROUND ENTRY POINT
// ========================================
export default defineBackground(() => {
  try {
    // Initialize only in browser context (not in WXT dev shadow environment)
    if (import.meta.env.BROWSER) {
      const currentBrowser = detectBrowser();

      if (!currentBrowser) {
        throw new Error("Unsupported browser");
      }

      createApplicationServices(currentBrowser)
        .then(async (applicationServices) => {
          let register = null;
          if (currentBrowser === "chrome") {
            const { registerListeners } = await import("./infrastructure/chrome-api/init");
            register = registerListeners;
          }

          if (!register) {
            throw new Error("No register function available for the current browser");
          }

          register(applicationServices);
          initializeState(applicationServices);
        });
    }
  } catch (error) {
    console.error("Error initializing background services:", error);
  }
});

async function initializeState(applicationServices: ApplicationServices) {
  // Initialize the proxy health check alarm if it doesn't already exist.
  try {
    applicationServices.alarm?.getBrowserApi().get(Constants.PROXY_HEALTH_CHECK_ALARM, (existing: any) => {
      if (existing) return;
      applicationServices.alarm?.getBrowserApi().create(Constants.PROXY_HEALTH_CHECK_ALARM, {
        delayInMinutes: 0.2,
        periodInMinutes: 1,
      });
    })
  } catch { }

  // Initialize the proxy health state to "ok" on service worker boot.
  try {
    applicationServices.proxy?.storeProxyData({
      state: "ok",
      reason: "sw_boot",
      lastOkAt: Date.now(),
      lastErrorAt: undefined,
      error: undefined,
      details: undefined,
      consecutiveFailures: 0,
    });

    Promise.resolve(applicationServices.proxy?.checkProxyStatus());
  } catch { }

  // Initialize storage
  if (!applicationServices.storage?.getCachedStorage()) {
    applicationServices.storage?.setCachedStorage({});
  }
}

// // ========================================
// // INITIALIZATION
// // ========================================
// function initializeBackgroundServices(applicationServices: ApplicationServices) {
//   console.log("Initializing background services...");

//   // Register all Chrome API event listeners
//   // ========================================
//   // ACTION HANDLERS
//   // ========================================
//   chromeApi.action.onClicked.addListener(extensionHandlers.createActionOnClickedHandler(applicationServices));


//   // ========================================
//   // RUNTIME HANDLERS
//   // ========================================
//   chromeApi.runtime.onMessage.addListener(extensionHandlers.createRunTimeOnMessageHandler(applicationServices));
//   chromeApi.runtime.onInstalled.addListener(extensionHandlers.createRunTimeOnInstalledHandler(applicationServices));


//   // ========================================
//   // TAB HANDLERS
//   // ========================================
//   chromeApi.tabs.onUpdated.addListener(extensionHandlers.createTabsOnUpdatedHandler(applicationServices));
//   chromeApi.tabs.onRemoved.addListener(extensionHandlers.createTabsOnRemovedHandler(applicationServices));
//   chromeApi.tabs.onActivated.addListener(extensionHandlers.createTabsOnActivatedHandler(applicationServices));


//   // ========================================
//   // ALARMS HANDLERS
//   // ========================================
//   chromeApi.alarms.onAlarm.addListener(extensionHandlers.createAlarmsOnAlarmHandler(applicationServices));


//   // ========================================
//   // STORAGE HANDLERS
//   // ========================================
//   chromeApi.storage.onChanged.addListener(extensionHandlers.createStorageOnChangedHandler(applicationServices));


//   // ========================================
//   // WINDOWS HANDLERS
//   // ========================================
//   chromeApi.windows.onFocusChanged.addListener(extensionHandlers.createWindowOnFocusChangedHandler(applicationServices));


//   // ========================================
//   // WEB REQUEST HANDLERS
//   // ========================================
//   chromeApi.webRequest.onAuthRequired.addListener(extensionHandlers.createwebRequestOnAuthRequiredHandler(applicationServices), { urls: ["<all_urls>"] }, ["asyncBlocking"]);


//   // Provide proxy auth credentials (username/password) to avoid browser prompt.
//   // NOTE: chrome.proxy.settings cannot apply credentials; must use webRequest.onAuthRequired.
//   // registerProxyAuthProvider();

//   // ========================================
//   // PROXY HANDLERS
//   // ========================================
//   chromeApi.proxy.onProxyError.addListener(extensionHandlers.createOnProxyErrorHandler(applicationServices));


//   // Setup side panel - open when extension icon clicked
//   chromeApi.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((e) => {
//     console.warn("[sidePanel] setPanelBehavior not supported:", e);
//   });
// }
