import { ApplicationServices } from "../../application-services";
import { handleMaybeFacebookTab } from "./tabHandler";

export function createWindowOnFocusChangedHandler(applicationServices: ApplicationServices) {
    return (windowId: number) => {
        return windowOnFocusChangedHandlerInternal(applicationServices, windowId)
    }
}

async function windowOnFocusChangedHandlerInternal(
    applicationServices: ApplicationServices,
    windowId: number
) {
    if (applicationServices.window?.getBrowserApi().isWindowClosed(windowId)) return;
    const activeTabs = await applicationServices.tab?.getBrowserApi().query({ active: true, windowId });
    const firstActiveTab = activeTabs?.[0];
    if (firstActiveTab?.id) await handleMaybeFacebookTab(applicationServices, firstActiveTab.id);
}