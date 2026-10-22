import { chromeApi } from "../../infrastructure/chrome-api/chrome-api";

export function actionOnClickedHandler(tab: chrome.tabs.Tab) {
    if (tab.windowId !== undefined) {
        chromeApi.sidePanel.open({ windowId: tab.windowId });
    }
}