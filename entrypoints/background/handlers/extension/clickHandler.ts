import { chromeApi } from "../../chrome-api";
export function actionOnClickedHandler(tab: chrome.tabs.Tab) {
    if (tab.windowId !== undefined) {
        chromeApi.sidePanel.open({ windowId: tab.windowId });
    }
}

export function setupSidePanelBehavior() {
    try {
        chromeApi.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch (e) {
        console.warn("[sidePanel] setPanelBehavior not supported:", e);
    }
}