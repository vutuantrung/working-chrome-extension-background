import { chromeApi } from "./chrome-api";

export const getTab = (tabId: number) => chromeApi.tabs.get(tabId);
export const queryTabs = (query: chrome.tabs.QueryInfo) => chromeApi.tabs.query(query);
export const sendTabMessage = (
    tabId: number,
    message: unknown,
    callback: (response: any) => void
) => chromeApi.tabs.sendMessage(tabId, message, callback);

export const captureVisibleTab = (
    options: {
        format: "png" | "jpeg";
        quality?: number
    },
    callback: (dataUrl?: string) => void
) => chromeApi.tabs.captureVisibleTab(options, callback);

export const updateTab = (
    tabId: number,
    properties: chrome.tabs.UpdateProperties
) => chromeApi.tabs.update(tabId, properties);
