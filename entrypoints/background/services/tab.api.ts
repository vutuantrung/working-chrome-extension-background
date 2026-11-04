export enum TabStatus {
    UNLOADED = "unloaded",
    LOADING = "loading",
    COMPLETE = "complete",
}

export interface UpdateProperties {
    pinned?: boolean;
    openerTabId?: number;
    url?: string;
    active?: boolean;
    muted?: boolean;
    [key: string]: any;
}

export interface ImageDetails {
    format?: "jpeg" | "png" | string;
    quality?: number;
    [key: string]: any;
}

export interface QueryTabInfo {
    active?: boolean;
    windowId?: number;
    url?: string | string[];
    [key: string]: any;
}

export interface Tab {
    id?: number;
    openerTabId?: number;
    windowId: number;
    status?: `${TabStatus}`;
    title?: string;
    active: boolean;
    [key: string]: any;
}

export interface IBrowserTabApi {
    get(tabId: number): Promise<Tab>;
    get(tabId: number, callback: (tab: Tab) => void): void;
    get(tabId: number, callback?: (tab: Tab) => void): Promise<Tab> | void;

    query(queryInfo: QueryTabInfo): Promise<Tab[]>;
    query(queryInfo: QueryTabInfo, callback: (tabs: Tab[]) => void): void;
    query(queryInfo: QueryTabInfo, callback?: (tabs: Tab[]) => void): Promise<Tab[]> | void;

    sendMessage(tabId: number, message: unknown): Promise<any>;
    sendMessage(tabId: number, message: unknown, callback: (response: any) => void): void;
    sendMessage(tabId: number, message: unknown, callback?: (response: any) => void): Promise<any> | void;

    captureVisibleTab(options: ImageDetails): Promise<string>;
    captureVisibleTab(options: ImageDetails, callback: (dataUrl: string) => void): void;
    captureVisibleTab(options: ImageDetails, callback?: (dataUrl: string) => void): Promise<string> | void;

    update(tabId: number, properties: UpdateProperties): Promise<any>;
    update(tabId: number, properties: UpdateProperties, callback: (tab?: Tab) => void): void;
    update(tabId: number, properties: UpdateProperties, callback?: (tab?: Tab) => void): Promise<any> | void;
}

export class BrowserApplicationTabApi {
    constructor(private browserApi: IBrowserTabApi) { }
    get(tabId: number): Promise<Tab> {
        return this.browserApi.get(tabId);
    }

    query(queryInfo: QueryTabInfo): Promise<Tab[]> {
        return this.browserApi.query(queryInfo);
    }

    sendMessage(tabId: number, message: unknown, callback?: (response: any) => void): Promise<any> | void {
        return this.browserApi.sendMessage(tabId, message, callback);
    }

    captureVisibleTab(options: ImageDetails, callback?: (dataUrl: string) => void): Promise<string> | void {
        return this.browserApi.captureVisibleTab(options, callback);
    }

    update(tabId: number, properties: UpdateProperties, callback?: (tab?: Tab) => void): Promise<any> | void {
        return this.browserApi.update(tabId, properties, callback);
    }
}