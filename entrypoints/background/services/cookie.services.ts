import { BrowserApplicationCookieApi } from "./cookie.api";

export class CookieService {
    constructor(private chromeApi: BrowserApplicationCookieApi) { }

    getBroserApi() {
        return this.chromeApi;
    }
}