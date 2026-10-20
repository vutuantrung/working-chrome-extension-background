import { runTimeOnMessageHandler, runTimeOnInstalledHandler } from "./runtimeHandler";
import { actionOnClickedHandler, setupSidePanelBehavior } from "./clickHandler";
import { tabsOnUpdatedHandler, tabsOnRemovedHandler, tabsOnActivatedHandler } from "./tabHandler";
import { alarmsOnAlarmHandler } from "./alarmHandler";
import { storageOnChangedHandler } from "./storageHandler";
import { windowOnFocusChangedHandler } from './windowHandler';
import { webRequestOnAuthRequiredHandler } from './webRequestHandler';
import { onProxyErrorHandler } from './proxyHandler';

export {
    actionOnClickedHandler,
    setupSidePanelBehavior,
    runTimeOnMessageHandler,
    runTimeOnInstalledHandler,
    tabsOnUpdatedHandler,
    tabsOnRemovedHandler,
    tabsOnActivatedHandler,
    alarmsOnAlarmHandler,
    storageOnChangedHandler,
    windowOnFocusChangedHandler,
    webRequestOnAuthRequiredHandler,
    onProxyErrorHandler
};