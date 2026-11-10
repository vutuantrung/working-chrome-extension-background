import type { Alarm, AlarmCreateInfo, IAlarmApi } from "../../services/alarm.api";
import { chromeApi } from "./chrome-api";

export class ChromeAlarmApi implements IAlarmApi {
    constructor() { }

    get(name: string): Promise<Alarm | undefined>;
    get(name: string, callback: (alarm?: Alarm) => void): void;
    get(name: string, callback?: (alarm?: Alarm) => void): Promise<Alarm | undefined> | void {
        if (callback) {
            return chromeApi.alarms.get(name, callback);
        }
        return chromeApi.alarms.get(name);
    }
    
    clear(name: string): Promise<boolean>;
    clear(name: string, callback: (wasCleared: boolean) => void): void;
    clear(name: string, callback?: (wasCleared: boolean) => void): void | Promise<boolean> {
        if (callback) {
            return chromeApi.alarms.clear(name, callback);
        }
        return chromeApi.alarms.clear(name);
    }

    create(name: string, options: AlarmCreateInfo): Promise<void>;
    create(name: string, options: AlarmCreateInfo, callback: () => void): void;
    create(name: string, options: AlarmCreateInfo, callback?: () => void): void | Promise<void> {
        if (callback) {
            return chromeApi.alarms.create(name, options, callback);
        }
        return chromeApi.alarms.create(name, options);
    }

    clearAll(): Promise<boolean>;
    clearAll(callback: (wasCleared: boolean) => void): void;
    clearAll(callback?: (wasCleared: boolean) => void): void | Promise<boolean> {
        if (callback) {
            return chromeApi.alarms.clearAll(callback);
        }
        return chromeApi.alarms.clearAll();
    }

}