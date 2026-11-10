import { BrowserApplicationCookieApi } from "./cookie.api";
import * as helpers from "../utils/helpers";

export class CookieService {
    constructor(private browserCookieApi: BrowserApplicationCookieApi) { }

    clearCookiesForDomain(domain: string): Promise<void> {
        return new Promise((resolve) => {
            this.browserCookieApi.getAll({ domain }, (cookies) => {
                const removePromises = (cookies || []).map(
                    (cookie) =>
                        new Promise<void>((res) => {
                            this.browserCookieApi.remove(
                                { url: helpers.cookie.cookieRemovalUrl(cookie), name: cookie.name },
                                () => res(),
                            );
                        }),
                );
                Promise.all(removePromises).then(() => resolve());
            });
        });
    }

    getBrowserApi() {
        return this.browserCookieApi;
    }
}