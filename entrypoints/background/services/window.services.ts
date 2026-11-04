import { IBrowserWindowApi } from "./window.api";

export class WindowService {
    constructor(private browserWindowApi: IBrowserWindowApi) { }

    getBrowserApi() {
        return this.browserWindowApi;
    }
}