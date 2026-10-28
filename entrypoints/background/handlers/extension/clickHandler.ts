import * as services from "../../services";

export function actionOnClickedHandler(tab: chrome.tabs.Tab) {
    if (tab.windowId !== undefined) {
        services.sidePanelService.openSidePanel(tab.windowId);
    }
}