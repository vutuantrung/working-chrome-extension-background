import { BrowserApplicationActionApi } from "./action.api";

export class ActionService {
    constructor(private chromeApi: BrowserApplicationActionApi) { }

    getBroserApi() {
        return this.chromeApi;
    }
}