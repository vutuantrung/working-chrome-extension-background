import { ISidePanelApi } from "./side-panel.api";

export class SidePanelService {
    constructor(private browserSidePanelApi: ISidePanelApi) { }

    getBrowserApi() {
        return this.browserSidePanelApi;
    }
}