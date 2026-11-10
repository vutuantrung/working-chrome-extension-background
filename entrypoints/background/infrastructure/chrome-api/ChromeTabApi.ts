import { IBrowserTabApi, Tab, QueryTabInfo, ImageDetails, UpdateProperties } from "../../services/tab.api";
import { chromeApi } from "./chrome-api";

export class ChromeTabApi implements IBrowserTabApi {
    constructor() { }

    get(tabId: number): Promise<Tab>;
    get(tabId: number, callback: (tab: Tab) => void): void;
    get(tabId: number, callback?: (tab: Tab) => void): Promise<Tab> | void {
        if (callback) {
            return chromeApi.tabs.get(tabId, callback);
        }
        return chromeApi.tabs.get(tabId);
    }

    safeGet(tabId: number): Promise<Tab | null> {
        return new Promise((resolve) => {
            try {
                chromeApi.tabs.get(tabId, (tab) => {
                    const err = chromeApi.runtime.lastError;
                    if (!err) {
                        resolve(tab ?? null);
                        return;
                    }

                    console.warn(`Get failed for tab ${tabId}:`, err);
                    resolve(null);
                });
            } catch (error) {
                console.warn(`Get threw for tab ${tabId}:`, error);
                resolve(null);
            }
        });
    }

    query(queryInfo: QueryTabInfo): Promise<Tab[]>;
    query(queryInfo: QueryTabInfo, callback: (tabs: Tab[]) => void): void;
    query(queryInfo: QueryTabInfo, callback?: (tabs: Tab[]) => void): Promise<Tab[]> | void {
        let chromeQuery = {} as chrome.tabs.QueryInfo;
        try {
            chromeQuery = queryInfo as chrome.tabs.QueryInfo;
        } catch (error: any) {
            throw new Error("Failed to cast to Chrome query: " + error.message);
        }

        if (callback) {
            return chromeApi.tabs.query(chromeQuery, callback);
        }
        return chromeApi.tabs.query(chromeQuery);
    }

    sendMessage(tabId: number, message: unknown): Promise<any>;
    sendMessage(tabId: number, message: unknown, callback: (response: any) => void): void;
    sendMessage(tabId: number, message: unknown, callback?: (response: any) => void): Promise<any> | void {
        if (callback) {
            return chromeApi.tabs.sendMessage(tabId, message, callback);
        }
        return chromeApi.tabs.sendMessage(tabId, message);
    }

    safeSendMessage(tabId: number, message: any): Promise<any | null> {
        return new Promise((resolve) => {
            try {
                chromeApi.tabs.sendMessage(tabId, message, (response) => {
                    const err = chromeApi.runtime.lastError;
                    if (!err) {
                        resolve(response ?? null);
                        return;
                    }

                    // Common, non-fatal: tab has no content script (closed/reloaded/not matching).
                    if (err.message?.includes("Receiving end does not exist")) {
                        resolve(null);
                        return;
                    }

                    resolve(null);
                });
            } catch (error) {
                resolve(null);
            }
        });
    }

    captureVisibleTab(options: ImageDetails): Promise<string>;
    captureVisibleTab(options: ImageDetails, callback: (dataUrl: string) => void): void;
    captureVisibleTab(options: ImageDetails, callback?: (dataUrl: string) => void): Promise<string> | void {
        let chromeOptions = {} as chrome.extensionTypes.ImageDetails;
        try {
            chromeOptions = options as chrome.extensionTypes.ImageDetails;
        } catch (error: any) {
            throw new Error("Failed to cast to Chrome options: " + error.message);
        }

        if (callback) {
            return chromeApi.tabs.captureVisibleTab(chromeOptions, callback);
        }
        return chromeApi.tabs.captureVisibleTab(chromeOptions);
    }

    update(tabId: number, properties: UpdateProperties): Promise<any>;
    update(tabId: number, properties: UpdateProperties, callback: (tab?: Tab) => void): void;
    update(tabId: number, properties: UpdateProperties, callback?: (tab?: Tab) => void): Promise<any> | void {
        let chromeProperties = {} as chrome.tabs.UpdateProperties;
        try {
            chromeProperties = properties as chrome.tabs.UpdateProperties;
        } catch (error: any) {
            throw new Error("Failed to cast to Chrome properties: " + error.message);
        }

        if (callback) {
            return chromeApi.tabs.update(tabId, chromeProperties, callback);
        }
        return chromeApi.tabs.update(tabId, chromeProperties);
    }
}