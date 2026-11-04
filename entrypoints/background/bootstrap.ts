import { ChromeProxyApi } from "./infrastructure/chrome-api/ChromeProxyApi";
import { ChromeTabApi } from "./infrastructure/chrome-api/ChromeTabApi";
import { ChromeDownloadApi } from "./infrastructure/chrome-api/ChromeDownloadApi";
import { BrowserApplicationProxyApi } from "./services/proxy.api";
import { BrowserApplicationTabApi } from "./services/tab.api";

import type { ApplicationServices } from "./application-services";
import { BrowserApplicationStorageApi } from "./services/storage.api";
import { ChromeStorageApi } from "./infrastructure/chrome-api/ChromeStorageApi";
import { BrowserApplicationActionApi } from "./services/action.api";
import { ChromeActionApi } from "./infrastructure/chrome-api/ChromeActionApi";
import { BrowserApplicationAlarmApi } from "./services/alarm.api";
import { ChromeAlarmApi } from "./infrastructure/chrome-api/ChromeAlarmApi";
import { BrowserApplicationCookieApi } from "./services/cookie.api";
import { ChromeCookieApi } from "./infrastructure/chrome-api/ChromeCookieApi";
import { BrowserApplicationDownloadApi } from "./services/download.api";
import { ChromeRuntimeApi } from "./infrastructure/chrome-api/ChromeRuntimeApi";
import { BrowserApplicationRuntimeApi } from "./services/runtime.api";
import { ChromeWindowApi } from "./infrastructure/chrome-api/ChromeWindowApi";
import { BrowserApplicationWindowApi } from "./services/window.api";

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
    let applicationActionApi = undefined;
    let applicationAlarmApi = undefined;
    let applicationCookieApi = undefined;
    let applicationDownloadApi = undefined;
    let applicationRuntimeApi = undefined;
    let applicationStorageApi = undefined;
    let applicationWindowApi = undefined;


    if (currentBrowser === "chrome") {
        applicationProxyApi = new BrowserApplicationProxyApi(new ChromeProxyApi());
        applicationTabApi = new BrowserApplicationTabApi(new ChromeTabApi());
        applicationActionApi = new BrowserApplicationActionApi(new ChromeActionApi());
        applicationAlarmApi = new BrowserApplicationAlarmApi(new ChromeAlarmApi());
        applicationCookieApi = new BrowserApplicationCookieApi(new ChromeCookieApi());
        applicationDownloadApi = new BrowserApplicationDownloadApi(new ChromeDownloadApi());
        applicationRuntimeApi = new BrowserApplicationRuntimeApi(new ChromeRuntimeApi());
        applicationStorageApi = new BrowserApplicationStorageApi(new ChromeStorageApi());
        applicationWindowApi = new BrowserApplicationWindowApi(new ChromeWindowApi());
    }

    return {
        proxy: applicationProxyApi,
        tab: applicationTabApi,
        action: applicationActionApi,
        alarm: applicationAlarmApi,
        cookie: applicationCookieApi,
        download: applicationDownloadApi,
        runtime: applicationRuntimeApi,
        storage: applicationStorageApi,
        window: applicationWindowApi,
    };
}