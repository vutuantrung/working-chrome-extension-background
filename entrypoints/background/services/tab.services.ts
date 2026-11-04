import { IBrowserTabApi } from "./tab.api";

export class TabService {
    constructor(private browserTabApi: IBrowserTabApi) { }

    getBrowserApi() {
        return this.browserTabApi;
    }
}