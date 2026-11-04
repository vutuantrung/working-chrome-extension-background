import { IBrowserRuntimeApi } from "./runtime.api";

export class RuntimeService {
    constructor(private browserRuntimeApi: IBrowserRuntimeApi) { }

    getBrowserApi() {
        return this.browserRuntimeApi;
    }
}