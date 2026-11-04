export interface CookieDetails {
    url: string;
    name: string;
    storeId?: string;
}

export interface CookiePartitionKey {
    hasCrossSiteAncestor?: boolean | undefined;
    topLevelSite?: string | undefined;
}

export enum SameSiteStatus {
    NO_RESTRICTION = "no_restriction",
    LAX = "lax",
    STRICT = "strict",
    UNSPECIFIED = "unspecified",
}

export interface Cookie {
    domain: string;
    name: string;
    partitionKey?: CookiePartitionKey;
    storeId: string;
    value: string;
    session: boolean;
    hostOnly: boolean;
    expirationDate?: number;
    path: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: `${SameSiteStatus}`;
}

export interface ICookieApi {
    get(details: CookieDetails): Promise<Cookie | null>;
    get(details: CookieDetails, callback: (details: Cookie) => void): void;
    get(details: CookieDetails, callback?: (details: Cookie) => void): Promise<Cookie | null> | void;
}

export class BrowserApplicationCookieApi {
    constructor(private browserApi: ICookieApi) { }

    get(details: CookieDetails, callback?: (details: Cookie) => void): Promise<Cookie | null> | void {
        return this.browserApi.get(details, callback);
    }
}