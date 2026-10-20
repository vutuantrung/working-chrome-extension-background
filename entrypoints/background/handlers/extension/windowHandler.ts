import { handleMaybeFacebookTab } from "./tabHandler";

export async function windowOnFocusChangedHandler(windowId: number) {
    if (windowId === chrome.windows.WINDOW_ID_NONE) return;
    const [activeTab] = await chrome.tabs.query({ active: true, windowId });
    if (activeTab?.id) await handleMaybeFacebookTab(activeTab.id);
}