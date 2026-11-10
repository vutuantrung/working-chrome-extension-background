import { BrowserApplicationActionApi } from "./action.api";

export class ActionService {
    constructor(private browserActionApi: BrowserApplicationActionApi) { }

    getBrowserApi() {
        return this.browserActionApi;
    }
}