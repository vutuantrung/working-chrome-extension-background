export interface AlarmCreateInfo {
    delayInMinutes?: number;
    periodInMinutes?: number;
    when?: number;
}

export interface Alarm {
    periodInMinutes?: number;
    scheduledTime: number;
    name: string;
}

export interface IAlarmApi {
    get(name: string): Promise<Alarm | undefined>;
    get(name: string, callback: (alarm?: Alarm) => void): void;
    get(name: string, callback?: (alarm?: Alarm) => void): Promise<Alarm | undefined> | void;

    clear(name: string): Promise<boolean>;
    clear(name: string, callback: (wasCleared: boolean) => void): void;
    clear(name: string, callback?: (wasCleared: boolean) => void): Promise<boolean> | void;

    create(name: string, options: AlarmCreateInfo): Promise<void>;
    create(name: string, options: AlarmCreateInfo, callback: () => void): void;
    create(name: string, options: AlarmCreateInfo, callback?: () => void): Promise<void> | void;

    clearAll(): Promise<boolean>;
    clearAll(callback: (wasCleared: boolean) => void): void;
    clearAll(callback?: (wasCleared?: boolean) => Promise<boolean> | void): Promise<boolean> | void;
}

export class BrowserApplicationAlarmApi {
    constructor(private browserApi: IAlarmApi) { }

    get(name: string, callback?: (alarm?: Alarm) => void): Promise<Alarm | undefined> | void {
        return this.browserApi.get(name, callback);
    }
    clear(name: string): Promise<boolean> {
        return this.browserApi.clear(name);
    }
    create(name: string, options: AlarmCreateInfo): Promise<void> {
        return this.browserApi.create(name, options);
    }
    clearAll(): Promise<boolean> {
        return this.browserApi.clearAll();
    }
}