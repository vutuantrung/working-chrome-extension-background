import { createRunTimeOnInstalledHandler, createRunTimeOnMessageHandler } from "./runtimeHandler";
import { createOnProxyErrorHandler } from './proxyHandler';
import { createAlarmsOnAlarmHandler } from "./alarmHandler";

import { createActionOnClickedHandler } from "./clickHandler";
import { createTabsOnUpdatedHandler, createTabsOnRemovedHandler, createTabsOnActivatedHandler } from "./tabHandler";
import { createStorageOnChangedHandler } from "./storageHandler";
import { createWindowOnFocusChangedHandler } from './windowHandler';
import { createwebRequestOnAuthRequiredHandler } from './webRequestHandler';

export {
    createActionOnClickedHandler,
    createRunTimeOnMessageHandler,
    createRunTimeOnInstalledHandler,
    createOnProxyErrorHandler,
    createTabsOnUpdatedHandler,
    createAlarmsOnAlarmHandler,
    createTabsOnActivatedHandler,
    createWindowOnFocusChangedHandler,
    createwebRequestOnAuthRequiredHandler,
    createTabsOnRemovedHandler,
    createStorageOnChangedHandler,
};