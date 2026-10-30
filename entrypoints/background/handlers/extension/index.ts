import { createRunTimeOnInstalledHandler, createRunTimeOnMessageHandler } from "./runtimeHandler";
import { actionOnClickedHandler } from "./clickHandler";
import { tabsOnUpdatedHandler, tabsOnRemovedHandler, tabsOnActivatedHandler } from "./tabHandler";
import { alarmsOnAlarmHandler } from "./alarmHandler";
import { storageOnChangedHandler } from "./storageHandler";
import { windowOnFocusChangedHandler } from './windowHandler';
import { webRequestOnAuthRequiredHandler } from './webRequestHandler';
import { onProxyErrorHandler } from './proxyHandler';

export {
    actionOnClickedHandler,
    createRunTimeOnMessageHandler,
    createRunTimeOnInstalledHandler,
    tabsOnUpdatedHandler,
    tabsOnRemovedHandler,
    tabsOnActivatedHandler,
    alarmsOnAlarmHandler,
    storageOnChangedHandler,
    windowOnFocusChangedHandler,
    webRequestOnAuthRequiredHandler,
    onProxyErrorHandler
};