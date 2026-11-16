import _ from "lodash";

const ACCOUNT_CATALOG_KEYS = new Set(["socialAccountCatalog", "allSocialAccounts", "facebookAccounts", "personaSocialAccounts", "personaFacebookAccounts"]);
import * as helpers from "../utils/helpers";

import { Archive, Settings, StorageData } from "../types/types";
import { DefaultValues } from "../utils/constants";
import { BrowserApplicationStorageApi } from "./storage.api";

export class StorageService {
    private _cachedStorage: StorageData = {};

    constructor(private browserStorageApi: BrowserApplicationStorageApi) { }

    getBrowserApi() {
        return this.browserStorageApi;
    }

    getCachedStorage() {
        return this._cachedStorage;
    }

    setCachedStorage(newValue: StorageData) {
        this._cachedStorage = _.merge({}, this._cachedStorage, newValue);
    }

    async getStorageByKeys(keys: string[]): Promise<Record<string, any>> {
        return this.browserStorageApi.get(keys);
    }

    async getStorageCachedByKeys(keys: string[]): Promise<Partial<StorageData>> {
        if (!keys) return this._cachedStorage;
        const cache = this._cachedStorage as Record<string, any>;
        // Account resources must be read from durable storage, not stale snapshots.
        const missing = keys.filter(key => ACCOUNT_CATALOG_KEYS.has(key) ||
            !Object.prototype.hasOwnProperty.call(cache, key));
        if (missing.length) {
            const values = await this.browserStorageApi.get(missing);
            // Do not repopulate a cache that was cleared while the read was pending.
            if (this._cachedStorage === cache) {
                for (const key of missing) cache[key] = values[key];
            }
            return Object.fromEntries(keys.map(key => [key,
                missing.includes(key) ? values[key] : cache[key]]));
        }
        return Object.fromEntries(keys.map(key => [key, cache[key]]));
    }

    async removeStorageByKeys(keys: string[]): Promise<void> {
        await this.browserStorageApi.remove(keys);
        for (const key of keys) delete (this._cachedStorage as Record<string, any>)[key];
    }

    clearStorageCache() {
        this._cachedStorage = {};
    }

    async handleGetSettings(message: any, sendResponse: (resp: any) => void) {
        const { settings } = (await this.getStorageCachedByKeys(["settings"])) ?? DefaultValues.SETTINGS_DATA;
        if (sendResponse) {
            sendResponse({ data: settings });
        }
    }

    async handleSetSettings(message: any, sendResponse?: (resp: any) => void) {
        try {
            const { settings: storageSettings } = await this.getStorageCachedByKeys(["settings"]);

            const currentSettingsInputs = message.inputs;
            const normalizedSettingsData = helpers.tabControl.normalizeTabSpecificSetting(currentSettingsInputs?.data || {});
            const [sendFacebookPostData] = normalizedSettingsData.apikey
                ? normalizedSettingsData.apikey.split("|")
                : [null, null];

            let updatedSettings = {
                ...storageSettings,
                ...normalizedSettingsData,
                collaboratorId: sendFacebookPostData,
            };

            if (sendFacebookPostData) {
                updatedSettings = {
                    ...updatedSettings,
                    collaboratorId: sendFacebookPostData,
                };
            }

            this.clearStorageCache();

            await this.browserStorageApi.set({ settings: updatedSettings });

            console.log("[handleSetSettings] Settings saved successfully");

            // const storageProxy = JSON.stringify(storageSettings?.proxy);
            // const updatedProxy = JSON.stringify(normalizedSettingsData.proxy);
            // if (updatedProxy && updatedProxy !== storageProxy) {
            //     const proxyConfig = JSON.parse(updatedProxy);
            //     if (proxyConfig === "system") {
            //         this.browserProxyApi.clear({ scope: "regular" });
            //     } else {
            //         const { http, https } = proxyConfig;
            //         const httpProxy = http.host && http.port ? http : null;
            //         const httpsProxy = https.host && https.port ? https : null;
            //         this.browserProxyApi.set(httpProxy, httpsProxy);
            //     }
            // }

            if (sendResponse) {
                sendResponse({ success: true });
            }
        } catch (error) {
            console.error("[handleSetSettings] Error:", error);
            if (sendResponse) {
                sendResponse({
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }

    async handleUpdateSettings(message: any, sendResponse?: (resp: any) => void) {
        const { settings: storageSettings } = await this.getStorageCachedByKeys(["settings"]);
        const updatedSettingsInputs = helpers.tabControl.normalizeTabSpecificSetting(message.inputs?.updateSetting || {});

        const updatedSettings = {
            ...storageSettings,
            ...updatedSettingsInputs,
        };
        await this.browserStorageApi.set({ settings: updatedSettings });
        if (sendResponse) {
            sendResponse({ success: true });
        }
    }

    async setStorageCached(patchObj: any): Promise<void> {
        const keys = Object.keys(patchObj).filter(key => !ACCOUNT_CATALOG_KEYS.has(key));
        if (!keys.length) return;
        const current = await this.browserStorageApi.get(keys);
        const patch: Record<string, any> = {};
        for (const key of keys) {
            // Merge only explicitly requested legacy keys; durable values win over stale cache.
            patch[key] = _.merge({}, { value: current[key] }, { value: patchObj[key] }).value;
        }
        await this.browserStorageApi.set(patch);
        Object.assign(this._cachedStorage, patch);
    }

    async handleUpdateArchive(message: any, sendResponse?: (resp: any) => void) {
        try {
            const storageData = await this.browserStorageApi.get(["settings"]);
            const currentSettings: any = storageData.settings || DefaultValues.SETTINGS_DATA;

            const updatedArchive: Archive = {
                ...(currentSettings.archive || {}),
                ...message.inputs.updateArchive,
            };
            const updatedSettings: Settings = {
                ...currentSettings,
                archive: updatedArchive,
            };

            this.clearStorageCache();

            await this.browserStorageApi.set({ settings: updatedSettings });

            await new Promise((resolve) => setTimeout(resolve, 100));

            const verification = await this.browserStorageApi.get(["settings"]);

            const archiveKeys = Object.keys(updatedArchive);
            const savedArchiveKeys = Object.keys((verification.settings as any)?.archive || {});
            const allKeysSaved = archiveKeys.every((key) => savedArchiveKeys.includes(key));

            if (!allKeysSaved) {
                console.error("Expected keys:", archiveKeys);
                console.error("Saved keys:", savedArchiveKeys);
            }

            if (sendResponse) {
                sendResponse({
                    success: allKeysSaved,
                    archive: (verification.settings as any)?.archive,
                    error: allKeysSaved ? null : "Archive keys mismatch",
                });
            }
        } catch (error) {
            console.error("[handleUpdateArchive] ===== ERROR =====");
            console.error("[handleUpdateArchive] Error:", error);
            if (sendResponse) {
                sendResponse({
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }
}