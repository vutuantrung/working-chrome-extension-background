import { BrowserApplicationTabApi } from "./tab.api";
import { BrowserApplicationRuntimeApi } from "./runtime.api";
import { getSmallestSupportedTabId } from "../utils/helpers/tabControl";
import { Constants } from "../utils/constants";

export class TabService {
    constructor(private browserTabApi: BrowserApplicationTabApi) { }

    getBrowserApi() {
        return this.browserTabApi;
    }

    async getSupportedTabs(
        firstFacebookTabId?: number,
        queryUrls: string[] = Constants.SUPPORTED_PLATFORM_URLS,
    ) {
        let targetTabId = null;

        // First attempt: try to use the first Facebook tab if available
        if (firstFacebookTabId) {
            const checkingTab = await this.browserTabApi.get(firstFacebookTabId);
            if (checkingTab) targetTabId = firstFacebookTabId;
        }

        // Second attempt: If no first tab is set, find any Facebook tab to become the first
        if (!targetTabId) {
            const queriedTabs = await this.browserTabApi.query({ url: queryUrls });
            if (queriedTabs) targetTabId = getSmallestSupportedTabId(queriedTabs);
        }

        return targetTabId;
    }

    async cleanupFacebookTabs(): Promise<void> {
        try {
            const tabs = await this.browserTabApi.query({ url: ["*://*.facebook.com/*", "*://*.fb.com/*"] });
            for (const tab of tabs) {
                if (!tab.id) continue;
                this.browserTabApi
                    .sendMessage(tab.id, { type: "CLEANUP_AFTER_LOGOUT" })
                    .catch(() => { });
            }
        } catch (error) {
            console.warn("[cleanupFacebookTabs] Failed:", error);
        }
    }

}