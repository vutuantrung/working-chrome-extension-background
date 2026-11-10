import { TabService } from "./services/tab.services";
import { ProxyService } from "./services/proxy.services";
import { AlarmService } from "./services/alarm.services";
import { CookieService } from "./services/cookie.services";
import { RuntimeService } from "./services/runtime.services";
import { SidePanelService } from "./services/side-panel.services";
import { StorageService } from "./services/storage.services";
import { WindowService } from "./services/window.services";
import { DownloadService } from "./services/download.services";
import { ActionService } from "./services/action.services";
import { SyncService } from "./services/sync.services";
import { ScheduleService } from "./services/schedule.services";
import { ExtensionService } from "./services/extension.services";
import { ScriptingService } from "./services/scripting.services";

export interface ApplicationServices {
    // each service need to be optional and initialized based on the browser environment and priority
    schedule?: ScheduleService;
    tab?: TabService;
    proxy?: ProxyService;
    alarm?: AlarmService;
    cookie?: CookieService;
    runtime?: RuntimeService;
    sidePanel?: SidePanelService;
    action?: ActionService;
    download?: DownloadService;
    window?: WindowService;
    storage?: StorageService;
    sync?: SyncService;
    extension?: ExtensionService;
    script?: ScriptingService;
}
