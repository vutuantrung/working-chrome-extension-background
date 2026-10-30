export interface ICookieService {
    getCookie(details: { url: string; name: string; storeId?: string }): Promise<chrome.cookies.Cookie | undefined>;
}

export class CookieService implements ICookieService {
    constructor() { }

    getCookie(details: { url: string; name: string; storeId?: string }): Promise<chrome.cookies.Cookie | undefined> {
        throw new Error("Method not implemented.");
    }
}