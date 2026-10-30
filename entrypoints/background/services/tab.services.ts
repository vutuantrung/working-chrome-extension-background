export enum TabStatus {
    UNLOADED = "unloaded",
    LOADING = "loading",
    COMPLETE = "complete",
}

export interface UpdateProperties {
    pinned?: boolean | undefined;
    openerTabId?: number | undefined;
    url?: string | undefined;
    active?: boolean | undefined;
    muted?: boolean | undefined;
    [key: string]: any;
}

export interface ImageDetails {
    format?: "jpeg" | "png" | undefined | string;
    quality?: number | undefined;
    [key: string]: any;
}

export interface QueryTabInfo {
    active?: boolean | undefined;
    windowId?: number | undefined;
    url?: string | string[] | undefined;
    [key: string]: any;
}

export interface Tab {
    id?: number | undefined;
    openerTabId?: number | undefined;
    windowId: number;
    status?: `${TabStatus}` | undefined;
    title?: string | undefined;
    active: boolean;
    [key: string]: any;
}

export interface ITabService {
    getTab: (tabId: number) => Promise<Tab>;
    queryTabs: (query: QueryTabInfo) => Promise<Tab[]>;
    sendTabMessage: (tabId: number, message: unknown, callback: (response: any) => void) => void;
    captureVisibleTab: (options: ImageDetails, callback: (dataUrl?: string) => void) => void;
    updateTab: (tabId: number, properties: UpdateProperties) => Promise<void>;
}

export class TabService {
    constructor(private browserTabService: ITabService) { }
    getTab(tabId: number): Promise<Tab> {
        return this.browserTabService.getTab(tabId);
    }

    queryTabs(query: QueryTabInfo): Promise<Tab[]> {
        return this.browserTabService.queryTabs(query);
    }

    sendTabMessage(tabId: number, message: unknown, callback: (response: any) => void): void {
        this.browserTabService.sendTabMessage(tabId, message, callback);
    }

    captureVisibleTab(options: ImageDetails, callback: (dataUrl?: string) => void): void {
        this.browserTabService.captureVisibleTab(options, callback);
    }

    updateTab(tabId: number, properties: UpdateProperties): Promise<void> {
        return this.browserTabService.updateTab(tabId, properties);
    }
}