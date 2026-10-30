import { ITabService, Tab, QueryTabInfo, ImageDetails, UpdateProperties } from "../../services/tab.services";
import { chromeApi } from "./chrome-api";

export class ChromeTabService implements ITabService {
    getTab(tabId: number): Promise<Tab> {
        return chromeApi.tabs.get(tabId);
    }

    queryTabs(query: QueryTabInfo): Promise<Tab[]> {
        return chromeApi.tabs.query(query);
    }

    sendTabMessage(tabId: number, message: unknown, callback: (response: any) => void): void {
        return chromeApi.tabs.sendMessage(tabId, message, callback);
    }

    captureVisibleTab(options: ImageDetails, callback: (dataUrl?: string) => void, windowId?: number): void {
        const chromeOptions = {} as chrome.extensionTypes.ImageDetails;

        // Quality
        let quality = undefined;
        if (options.quality && typeof options.quality === "number") quality = options.quality;
        chromeOptions.quality = quality;


        // Format
        let format = undefined;
        try {
            if (options.format) format = options.format as chrome.extensionTypes.ImageFormat;
        } catch (error) {
            throw new Error("Chrome does not support the specified image format");
        }
        chromeOptions.format = format;


        // Window ID
        if (windowId !== undefined) {
            return chromeApi.tabs.captureVisibleTab(windowId, chromeOptions, callback);
        }
        // Or not
        return chromeApi.tabs.captureVisibleTab(chromeOptions, callback);
    }

    updateTab(tabId: number, properties: UpdateProperties): Promise<any> {
        return chromeApi.tabs.update(tabId, properties);
    }
}