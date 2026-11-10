import * as extensionHandlers from "../../handlers/extension";
import { ApplicationServices } from "../../application-services";

// ========================================
// INITIALIZATION
// ========================================
export function registerListeners(applicationServices: ApplicationServices) {
    console.log("Initializing background services...");

    // Register all Chrome API event listeners
    // ========================================
    // ACTION HANDLERS
    // ========================================
    chrome.action.onClicked.addListener(extensionHandlers.createActionOnClickedHandler(applicationServices));


    // ========================================
    // RUNTIME HANDLERS
    // ========================================
    chrome.runtime.onMessage.addListener(extensionHandlers.createRunTimeOnMessageHandler(applicationServices));
    chrome.runtime.onInstalled.addListener(extensionHandlers.createRunTimeOnInstalledHandler(applicationServices));


    // ========================================
    // TAB HANDLERS
    // ========================================
    chrome.tabs.onUpdated.addListener(extensionHandlers.createTabsOnUpdatedHandler(applicationServices));
    chrome.tabs.onRemoved.addListener(extensionHandlers.createTabsOnRemovedHandler(applicationServices));
    chrome.tabs.onActivated.addListener(extensionHandlers.createTabsOnActivatedHandler(applicationServices));


    // ========================================
    // ALARMS HANDLERS
    // ========================================
    chrome.alarms.onAlarm.addListener(extensionHandlers.createAlarmsOnAlarmHandler(applicationServices));


    // ========================================
    // STORAGE HANDLERS
    // ========================================
    chrome.storage.onChanged.addListener(extensionHandlers.createStorageOnChangedHandler(applicationServices));


    // ========================================
    // WINDOWS HANDLERS
    // ========================================
    chrome.windows.onFocusChanged.addListener(extensionHandlers.createWindowOnFocusChangedHandler(applicationServices));


    // ========================================
    // WEB REQUEST HANDLERS
    // ========================================
    chrome.webRequest.onAuthRequired.addListener(extensionHandlers.createwebRequestOnAuthRequiredHandler(applicationServices), { urls: ["<all_urls>"] }, ["asyncBlocking"]);


    // Provide proxy auth credentials (username/password) to avoid browser prompt.
    // NOTE: chrome.proxy.settings cannot apply credentials; must use webRequest.onAuthRequired.
    // registerProxyAuthProvider();

    // ========================================
    // PROXY HANDLERS
    // ========================================
    chrome.proxy.onProxyError.addListener(extensionHandlers.createOnProxyErrorHandler(applicationServices));


    // ========================================
    // SIDE PANEL HANDLERS
    // ========================================
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((e) => {
        console.warn("[sidePanel] setPanelBehavior not supported:", e);
    });
}
