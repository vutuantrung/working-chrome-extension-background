import { ApplicationServices } from "../../application-services";
import { Tab } from "../../services/tab.api";

export function createActionOnClickedHandler(applicationServices: ApplicationServices) {
    return (tab: Tab) => actionOnClickedHandler(applicationServices, tab);
}

function actionOnClickedHandler(applicationServices: ApplicationServices, tab: Tab) {
    if (tab.windowId !== undefined) {
        applicationServices.sidePanel?.getBrowserApi().openSidePanel(tab.windowId);
    }
}