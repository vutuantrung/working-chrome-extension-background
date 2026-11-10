import { BrowserApplicationActionApi } from "./action.api";
import { AppService } from "./app.services";

export class ActionService extends AppService {
    constructor(private browserActionApi: BrowserApplicationActionApi) {
        super();
    }

    getBrowserApi() {
        return this.browserActionApi;
    }
}