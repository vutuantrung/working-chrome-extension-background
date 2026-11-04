import { ChromeProxyApi } from "./infrastructure/chrome-api/ChromeProxyApi";
import { ChromeTabApi } from "./infrastructure/chrome-api/ChromeTabApi";
import { BrowserApplicationProxyApi } from "./services/proxy.api";
import { BrowserApplicationTabApi } from "./services/tab.api";

import type { ApplicationServices } from "./application-services";

function detectBrowser(): string {
    if (typeof chrome !== "undefined" && typeof chrome.runtime !== "undefined") {
        return "chrome";
    }
    throw new Error("Unsupported browser");
}


export function createApplicationServices(): ApplicationServices {
    const currentBrowser = detectBrowser();

    let applicationProxyApi = undefined;
    let applicationTabApi = undefined;
    if (currentBrowser === "chrome") {
        // Proxy
        applicationProxyApi = new BrowserApplicationProxyApi(new ChromeProxyApi());
        // Tab
        applicationTabApi = new BrowserApplicationTabApi(new ChromeTabApi());
    }

    return {
        proxy: applicationProxyApi,
        tab: applicationTabApi
    };
}