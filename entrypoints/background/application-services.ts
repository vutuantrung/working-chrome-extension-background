import type { ProxyService } from "./services/proxy.services";
import type { RuntimeService } from "./services/runtime.services";
import type { ActionService } from "./services/action.services";
import type { AlarmService } from "./services/alarm.services";
import type { CookieService } from "./services/cookie.services";
import type { DownloadService } from "./services/download.services";
import type { SidePanelService } from "./services/side-panel.services";
import type { WindowService } from "./services/window.services";
import type { TabService } from "./services/tab.services";


export interface ApplicationServices {
    // each service need to be optional and initialized based on the browser environment and priority
    proxy?: ProxyService;
    runtime?: RuntimeService;
    action?: ActionService;
    alarm?: AlarmService;
    cookie?: CookieService;
    download?: DownloadService;
    sidePanel?: SidePanelService;
    window?: WindowService;
    tab?: TabService;
}
