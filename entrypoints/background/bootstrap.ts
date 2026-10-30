import { ProxyService } from "./services/proxy.services";
import { ChromeProxyService } from "./infrastructure/chrome-api/ChromeProxyService";
import { TabService } from "./services/tab.services";
import { ChromeTabService } from "./infrastructure/chrome-api/ChromeTabService";

import type { ApplicationServices } from "./application-services";

function detectBrowser(): string {
    if (typeof chrome !== "undefined" && typeof chrome.runtime !== "undefined") {
        return "chrome";
    }
    throw new Error("Unsupported browser");
}


export function createApplicationServices(): ApplicationServices {
    const currentBrowser = detectBrowser();

    let browserProxyService = undefined;
    let applicationProxyService = undefined;
    let browserTabService = undefined;
    let applicationTabService = undefined;
    if (currentBrowser === "chrome") {
        // Proxy
        browserProxyService = new ChromeProxyService();
        applicationProxyService = new ProxyService(browserProxyService);

        // Tab
        browserTabService = new ChromeTabService();
        applicationTabService = new TabService(browserTabService);
    }

    return {
        proxy: applicationProxyService,
        tab: applicationTabService
    };
}