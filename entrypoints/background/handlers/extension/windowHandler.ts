import * as services from "../../services";
import { handleMaybeFacebookTab } from "./tabHandler";

export async function windowOnFocusChangedHandler(windowId: number) {
    if (services.windowService.isWindowClosed(windowId)) return;
    const [activeTab] = await services.tabService.queryTabs({ active: true, windowId });
    if (activeTab?.id) await handleMaybeFacebookTab(activeTab.id);
}