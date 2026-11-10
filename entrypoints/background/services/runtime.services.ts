import { BrowserApplicationRuntimeApi } from "./runtime.api";

export class RuntimeService {
    constructor(private browserRuntimeApi: BrowserApplicationRuntimeApi) { }

    getBrowserApi() {
        return this.browserRuntimeApi;
    }
}