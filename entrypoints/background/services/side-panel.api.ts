export interface ISidePanelApi {
    openSidePanel(windowId: number): Promise<void>;
}

export class BrowserApplicationSidePanelApi {
    constructor(private browserApi: ISidePanelApi) { }

    openSidePanel(windowId: number): Promise<void> {
        return this.browserApi.openSidePanel(windowId);
    }
}