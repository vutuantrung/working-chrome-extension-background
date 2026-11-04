import { Cookie, CookieDetails, ICookieApi } from "../../services/cookie.api";
import { chromeApi } from "./chrome-api";

export class ChromeCookieApi implements ICookieApi {
    get(details: CookieDetails): Promise<Cookie | null>;
    get(details: CookieDetails, callback: (details: Cookie | null) => void): void;
    get(details: CookieDetails, callback?: (details: Cookie | null) => void): Promise<Cookie | null> | void {
        let cookieDetails = {} as chrome.cookies.CookieDetails;
        try {
            cookieDetails = details as chrome.cookies.CookieDetails;
        } catch (error: any) {
            throw new Error("Failed to cast to Chrome cookie details: " + error.message);
        }

        if (callback) {
            return chromeApi.cookies.get(cookieDetails, callback);
        }
        return chromeApi.cookies.get(cookieDetails);
    }
}