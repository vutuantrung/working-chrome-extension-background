import { IBrowserProxyApi, SettingClearDetails, SettingGetDetails, SettingGetResult, SettingSetDetails } from "../../services/proxy.api";
import { chromeApi } from "./chrome-api";

export class ChromeProxyApi implements IBrowserProxyApi {
    constructor() { }

    getProxySettings() {
        const settings = chrome.proxy.settings as any;
        // Todo: Match with Proxy settings defined in application
        return settings;
    }

    set(details: SettingSetDetails): Promise<void>;
    set(details: SettingSetDetails, callback: () => void): void;
    set(details: SettingSetDetails, callback?: () => void): Promise<void> | void {
        let chromeSettingsDetails = {} as chrome.types.ChromeSettingSetDetails<chrome.proxy.ProxyConfig>;
        try {
            chromeSettingsDetails = details as chrome.types.ChromeSettingSetDetails<chrome.proxy.ProxyConfig>;
        } catch (error: any) {
            throw new Error("Failed casting Chrome details settings: " + error.message);
        }

        if (callback) {
            return chromeApi.proxy.settings.set(chromeSettingsDetails, callback);
        }
        return chromeApi.proxy.settings.set(chromeSettingsDetails);
    }

    get(details: SettingGetDetails): Promise<SettingGetResult>;
    get(details: SettingGetDetails, callback: (details: SettingGetResult) => void): void;
    get(details: SettingGetDetails, callback?: (details: SettingGetResult) => void): Promise<SettingGetResult> | void {
        let chromeSettingsDetails = {} as chrome.types.ChromeSettingGetDetails;
        try {
            chromeSettingsDetails = details as chrome.types.ChromeSettingGetDetails;
        } catch (error: any) {
            throw new Error("Failed casting Chrome details settings: " + error.message);
        }

        if (callback) {
            return chromeApi.proxy.settings.get(chromeSettingsDetails, callback);
        }
        return chromeApi.proxy.settings.get(chromeSettingsDetails);
    }

    clear(details: SettingClearDetails): Promise<void>;
    clear(details: SettingClearDetails, callback: () => void): void;
    clear(details: SettingClearDetails, callback?: () => void): Promise<void> | void {
        let chromeSettingsDetails = {} as chrome.types.ChromeSettingClearDetails;
        try {
            chromeSettingsDetails = details as chrome.types.ChromeSettingClearDetails;
        } catch (error: any) {
            throw new Error("Failed casting Chrome details settings: " + error.message);
        }

        if (callback) {
            return chromeApi.proxy.settings.clear(chromeSettingsDetails, callback);
        }
        return chromeApi.proxy.settings.clear(chromeSettingsDetails);
    }
}