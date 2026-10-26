import * as sidePanelService from "../../services/side-panel.service";

export function actionOnClickedHandler(tab: chrome.tabs.Tab) {
    if (tab.windowId !== undefined) {
        sidePanelService.openSidePanel(tab.windowId);
    }
}