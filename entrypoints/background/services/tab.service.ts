import { chromeApi } from "../infrastructure/chrome-api/chrome-api";
export const queryTabs = (query: chrome.tabs.QueryInfo) => chromeApi.tabs.query(query);
export const captureVisibleTab = (options: chrome.tabs.CaptureVisibleTabOptions, callback: (dataUrl?: string) => void) => chromeApi.tabs.captureVisibleTab(options, callback);
export const sendTabMessage = (tabId: number, message: unknown, callback?: (response: any) => void) => chromeApi.tabs.sendMessage(tabId, message, callback);
