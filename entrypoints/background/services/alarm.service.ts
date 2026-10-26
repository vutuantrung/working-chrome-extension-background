import { chromeApi } from "../infrastructure/chrome-api/chrome-api";
export const getAlarm = (name: string) => chromeApi.alarms.get(name);
export const clearAlarm = (name: string) => chromeApi.alarms.clear(name);
export const createAlarm = (name: string, options: chrome.alarms.AlarmCreateInfo) => chromeApi.alarms.create(name, options);

export const clearAllAlarms = () => chromeApi.alarms.clearAll();
