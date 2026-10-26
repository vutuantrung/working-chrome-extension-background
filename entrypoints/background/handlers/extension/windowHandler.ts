import * as tabService from "../../services/tab.service";
import * as windowService from "../../services/window.service";
import { handleMaybeFacebookTab } from "./tabHandler";

export async function windowOnFocusChangedHandler(windowId: number) {
    if (windowService.isWindowClosed(windowId)) return;
    const [activeTab] = await tabService.queryTabs({ active: true, windowId });
    if (activeTab?.id) await handleMaybeFacebookTab(activeTab.id);
}