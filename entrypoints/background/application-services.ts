import { BrowserApplicationAlarmApi } from "./services/alarm.api";
import { BrowserApplicationDownloadApi } from "./services/download.api";
import { BrowserApplicationWindowApi } from "./services/window.api";
import { BrowserApplicationProxyApi } from "./services/proxy.api";
import { BrowserApplicationRuntimeApi } from "./services/runtime.api";
import { BrowserApplicationSidePanelApi } from "./services/side-panel.api";
import { BrowserApplicationTabApi } from "./services/tab.api";
import { BrowserApplicationCookieApi } from "./services/cookie.api";
import { BrowserApplicationActionApi } from "./services/action.api";


export interface ApplicationServices {
    // each service need to be optional and initialized based on the browser environment and priority
    proxy?: BrowserApplicationProxyApi;
    runtime?: BrowserApplicationRuntimeApi;
    tab?: BrowserApplicationTabApi;
    sidePanel?: BrowserApplicationSidePanelApi;
    cookie?: BrowserApplicationCookieApi;
    action?: BrowserApplicationActionApi;
    alarm?: BrowserApplicationAlarmApi;
    download?: BrowserApplicationDownloadApi;
    window?: BrowserApplicationWindowApi;
}
