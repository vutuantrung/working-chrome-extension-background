import { BrowserApplicationProxyApi } from "./services/proxy.api";
import { BrowserApplicationTabApi } from "./services/tab.api";
import { BrowserApplicationStorageApi } from "./services/storage.api";
import { BrowserApplicationActionApi } from "./services/action.api";
import { BrowserApplicationAlarmApi } from "./services/alarm.api";
import { BrowserApplicationCookieApi } from "./services/cookie.api";
import { BrowserApplicationDownloadApi } from "./services/download.api";
import { BrowserApplicationRuntimeApi } from "./services/runtime.api";
import { BrowserApplicationWindowApi } from "./services/window.api";

import { ApplicationServices } from "./application-services";

import { TabService } from "./services/tab.services";
import { ProxyService } from "./services/proxy.services";
import { StorageService } from "./services/storage.services";
import { AlarmService } from "./services/alarm.services";
import { CookieService } from "./services/cookie.services";
import { ActionService } from "./services/action.services";
import { DownloadService } from "./services/download.services";
import { RuntimeService } from "./services/runtime.services";
import { WindowService } from "./services/window.services";
import { SyncService } from "./services/sync.services";
import { ScheduleService } from "./services/schedule.services";
import { BrowserApplicationScriptingApi } from "./services/scripting.api";
import { ScriptingService } from "./services/scripting.services";

export async function createApplicationServices(currentBrowser: "chrome" | "firefox"): Promise<ApplicationServices> {

    let applicationProxyApi: BrowserApplicationProxyApi;
    let applicationTabApi: BrowserApplicationTabApi;
    let applicationActionApi: BrowserApplicationActionApi;
    let applicationAlarmApi: BrowserApplicationAlarmApi;
    let applicationCookieApi: BrowserApplicationCookieApi;
    let applicationDownloadApi: BrowserApplicationDownloadApi;
    let applicationRuntimeApi: BrowserApplicationRuntimeApi;
    let applicationStorageApi: BrowserApplicationStorageApi;
    let applicationWindowApi: BrowserApplicationWindowApi;
    let applicationScriptingApi: BrowserApplicationScriptingApi;

    let applicationTabService = undefined;
    let applicationProxyService = undefined;
    let applicationStorageService = undefined;
    let applicationAlarmService = undefined;
    let applicationCookieService = undefined;
    let applicationActionService = undefined;
    let applicationDownloadService = undefined;
    let applicationRuntimeService = undefined;
    let applicationWindowService = undefined;
    let applicationSyncService = undefined;
    let applicationScheduleService = undefined;
    let applicationScriptingService = undefined;

    if (currentBrowser === "chrome") {
        const { ChromeTabApi } = (await import("./infrastructure/chrome-api/ChromeTabApi"));
        applicationTabApi = new BrowserApplicationTabApi(new ChromeTabApi());

        const { ChromeProxyApi } = (await import("./infrastructure/chrome-api/ChromeProxyApi"));
        applicationProxyApi = new BrowserApplicationProxyApi(new ChromeProxyApi());

        const { ChromeActionApi } = (await import("./infrastructure/chrome-api/ChromeActionApi"));
        applicationActionApi = new BrowserApplicationActionApi(new ChromeActionApi());

        const { ChromeAlarmApi } = (await import("./infrastructure/chrome-api/ChromeAlarmApi"));
        applicationAlarmApi = new BrowserApplicationAlarmApi(new ChromeAlarmApi());

        const { ChromeCookieApi } = (await import("./infrastructure/chrome-api/ChromeCookieApi"));
        applicationCookieApi = new BrowserApplicationCookieApi(new ChromeCookieApi());

        const { ChromeDownloadApi } = (await import("./infrastructure/chrome-api/ChromeDownloadApi"));
        applicationDownloadApi = new BrowserApplicationDownloadApi(new ChromeDownloadApi());

        const { ChromeRuntimeApi } = (await import("./infrastructure/chrome-api/ChromeRuntimeApi"));
        applicationRuntimeApi = new BrowserApplicationRuntimeApi(new ChromeRuntimeApi());

        const { ChromeStorageApi } = (await import("./infrastructure/chrome-api/ChromeStorageApi"));
        applicationStorageApi = new BrowserApplicationStorageApi(new ChromeStorageApi());

        const { ChromeWindowApi } = (await import("./infrastructure/chrome-api/ChromeWindowApi"));
        applicationWindowApi = new BrowserApplicationWindowApi(new ChromeWindowApi());

        const { ChromeScriptingApi } = (await import("./infrastructure/chrome-api/ChromeScriptingApi"));
        applicationScriptingApi = new BrowserApplicationScriptingApi(new ChromeScriptingApi());

    } else if (currentBrowser === "firefox") {
        throw new Error("Firefox is not supported yet");
    } else {
        throw new Error("Unsupported browser API setup");
    }

    applicationStorageService = new StorageService(applicationStorageApi);
    applicationTabService = new TabService(applicationTabApi);
    applicationProxyService = new ProxyService(
        applicationProxyApi,
        applicationStorageService
    );
    applicationAlarmService = new AlarmService(applicationAlarmApi);
    applicationCookieService = new CookieService(applicationCookieApi);
    applicationActionService = new ActionService(applicationActionApi);
    applicationDownloadService = new DownloadService(applicationDownloadApi);
    applicationRuntimeService = new RuntimeService(applicationRuntimeApi);
    applicationWindowService = new WindowService(applicationWindowApi);
    applicationScriptingService = new ScriptingService(
        applicationScriptingApi,
        applicationRuntimeApi,
        applicationTabApi
    );

    applicationScheduleService = new ScheduleService(
        applicationStorageService,
        applicationAlarmService
    );
    applicationSyncService = new SyncService(
        applicationStorageService,
        applicationProxyService,
        applicationAlarmService,
        applicationCookieService,
        applicationScheduleService,
        applicationTabService,
    );

    return {
        tab: applicationTabService,
        proxy: applicationProxyService,
        alarm: applicationAlarmService,
        cookie: applicationCookieService,
        schedule: applicationScheduleService,
        action: applicationActionService,
        download: applicationDownloadService,
        runtime: applicationRuntimeService,
        window: applicationWindowService,
        storage: applicationStorageService,
        sync: applicationSyncService,
        script: applicationScriptingService,
    };
}