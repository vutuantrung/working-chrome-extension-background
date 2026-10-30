export interface IAlarmService {
    getAlarm(name: string): Promise<chrome.alarms.Alarm | undefined>;
    clearAlarm(name: string): Promise<boolean>;
    createAlarm(name: string, options: chrome.alarms.AlarmCreateInfo): Promise<void>;
    clearAllAlarms(): Promise<boolean>;
}

export class AlarmService implements IAlarmService {
    constructor() { }
    getAlarm(name: string): Promise<chrome.alarms.Alarm | undefined> {
        throw new Error("Method not implemented.");
    }
    clearAlarm(name: string): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    createAlarm(name: string, options: chrome.alarms.AlarmCreateInfo): Promise<void> {
        throw new Error("Method not implemented.");
    }
    clearAllAlarms(): Promise<boolean> {
        throw new Error("Method not implemented.");
    }

}