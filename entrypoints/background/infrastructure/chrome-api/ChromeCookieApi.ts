import { Cookie, CookieDetails, GetAllDetails, ICookieApi } from "../../services/cookie.api";
import { chromeApi } from "./chrome-api";

export class ChromeCookieApi implements ICookieApi {
    remove(details: CookieDetails): Promise<CookieDetails>;
    remove(details: CookieDetails, callback?: (details: CookieDetails) => void): void;
    remove(details: CookieDetails, callback?: (details: CookieDetails) => void): Promise<CookieDetails> | void {
        let cookieDetails = {} as chrome.cookies.CookieDetails;
        try {
            cookieDetails = details as chrome.cookies.CookieDetails;
        } catch (error: any) {
            throw new Error("Failed to cast to Chrome cookie details: " + error.message);
        }

        if (callback) {
            return chromeApi.cookies.remove(cookieDetails, callback);
        }
        return chromeApi.cookies.remove(cookieDetails);
    }

    getAll(details: GetAllDetails): Promise<Cookie[]>;
    getAll(details: GetAllDetails, callback: (cookies: Cookie[]) => void): void;
    getAll(details: GetAllDetails, callback?: (cookies: Cookie[]) => void): Promise<Cookie[]> | void {
        let getAllDetails = {} as chrome.cookies.GetAllDetails;
        try {
            getAllDetails = details as chrome.cookies.GetAllDetails;
        } catch (error: any) {
            throw new Error("Failed to cast to Chrome getAll details: " + error.message);
        }

        if (callback) {
            return chromeApi.cookies.getAll(getAllDetails, callback);
        }
        return chromeApi.cookies.getAll(getAllDetails);
    }


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