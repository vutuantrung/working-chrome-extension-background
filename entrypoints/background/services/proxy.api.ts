
export interface SettingGetDetails {
    [key: string]: any;
}
export interface SettingGetResult {
    value: any;
}
export interface SettingClearDetails {
    scope?: string | undefined;
}
export interface SettingSetDetails {
    value: any;
    scope?: string | undefined;
}

export interface IBrowserProxyApi {
    getProxySettings(): any;

    set(details: SettingSetDetails): Promise<void>;
    set(details: SettingSetDetails, callback: () => void): void;
    set(details: SettingSetDetails, callback?: () => void): Promise<void> | void;

    get(details: SettingGetDetails): Promise<SettingGetResult>;
    get(details: SettingGetDetails, callback: (details: SettingGetResult) => void): void;
    get(details: SettingGetDetails, callback?: (details: SettingGetResult) => void): Promise<SettingGetResult> | void;

    clear(details: SettingClearDetails): Promise<void>;
    clear(details: SettingClearDetails, callback: () => void): void;
    clear(details: SettingClearDetails, callback?: () => void): Promise<void> | void;
}

export class BrowserApplicationProxyApi {
    constructor(private browserApi: IBrowserProxyApi) { }

    getProxySettings() {
        return this.browserApi.getProxySettings();
    }

    set(details: SettingSetDetails, callback?: () => void): Promise<void> | void {
        return this.browserApi.set(details, callback);
    }

    get(details: SettingGetDetails, callback?: (details: SettingGetResult) => void): Promise<SettingGetResult> | void {
        return this.browserApi.get(details, callback);
    }

    clear(details: SettingClearDetails, callback?: () => void): Promise<void> | void {
        return this.browserApi.clear(details, callback);
    }
}
