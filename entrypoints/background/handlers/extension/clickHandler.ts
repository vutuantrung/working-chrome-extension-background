export function actionOnClickedHandler(tab: chrome.tabs.Tab) {
    if (tab.windowId !== undefined) {
        (chrome as any).sidePanel.open({ windowId: tab.windowId });
    }
}

export function setupSidePanelBehavior() {
    try {
        (chrome as any).sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch (e) {
        console.warn("[sidePanel] setPanelBehavior not supported:", e);
    }
}