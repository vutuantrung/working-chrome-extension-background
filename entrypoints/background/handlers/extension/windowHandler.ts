import { chromeApi } from "../../chrome-api";
import { handleMaybeFacebookTab } from "./tabHandler";

export async function windowOnFocusChangedHandler(windowId: number) {
    if (windowId === chromeApi.windows.WINDOW_ID_NONE) return;
    const [activeTab] = await chromeApi.tabs.query({ active: true, windowId });
    if (activeTab?.id) await handleMaybeFacebookTab(activeTab.id);
}