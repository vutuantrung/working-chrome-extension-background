import { BrowserApplicationDownloadApi } from "./download.api";

export class DownloadService {
    constructor(private browserDownloadApi: BrowserApplicationDownloadApi) { }

    getBrowserApi() {
        return this.browserDownloadApi;
    }
}