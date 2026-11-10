export interface CookieDetails {
    url: string;
    name: string;
    storeId?: string;
}

export interface GetAllDetails {
    domain?: string;
    name?: string;
    url?: string;
    storeId?: string;
    session?: boolean;
    path?: string;
    secure?: boolean;
}

export interface CookiePartitionKey {
    hasCrossSiteAncestor?: boolean;
    topLevelSite?: string;
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
    remove(details: CookieDetails): Promise<CookieDetails>;
    remove(details: CookieDetails, callback?: (details: CookieDetails) => void): void;
    remove(details: CookieDetails, callback?: (details: CookieDetails) => void): Promise<CookieDetails> | void;

    getAll(details: GetAllDetails): Promise<Cookie[]>;
    getAll(details: GetAllDetails, callback: (cookies: Cookie[]) => void): void;
    getAll(details: GetAllDetails, callback?: (cookies: Cookie[]) => void): Promise<Cookie[]> | void;

    get(details: CookieDetails): Promise<Cookie | null>;
    get(details: CookieDetails, callback: (details: Cookie) => void): void;
    get(details: CookieDetails, callback?: (details: Cookie) => void): Promise<Cookie | null> | void;
}

export class BrowserApplicationCookieApi {
    constructor(private browserApi: ICookieApi) { }

    getAll(details: GetAllDetails, callback?: (cookies: Cookie[]) => void): Promise<Cookie[]> | void {
        return this.browserApi.getAll(details, callback);
    }

    get(details: CookieDetails, callback?: (details: Cookie) => void): Promise<Cookie | null> | void {
        return this.browserApi.get(details, callback);
    }

    remove(details: CookieDetails, callback?: (details: CookieDetails) => void): Promise<CookieDetails> | void {
        return this.browserApi.remove(details, callback);
    }
}