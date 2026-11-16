import _ from "lodash";
import * as helpers from "../utils/helpers";

import { Archive, Settings, StorageData } from "../types/types";
import { DefaultValues } from "../utils/constants";
import { BrowserApplicationStorageApi } from "./storage.api";

export class StorageService {
    private _cachedStorage: StorageData = {};
    private _storageInFlight: Promise<StorageData> | null = null;

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
        // Wait for an existing read, then recompute the missing keys. An empty
        // object is a valid cache, not evidence that a read is in progress.
        while (this._storageInFlight) {
            await this._storageInFlight;
        }

        const missing = keys.filter(key =>
            !Object.prototype.hasOwnProperty.call(this._cachedStorage, key));
        if (missing.length > 0) {
            const cacheAtRead = this._cachedStorage;
            const read = this.browserStorageApi.get(missing).then(values => {
                // Do not repopulate a cache that was cleared/replaced during IO.
                if (this._cachedStorage === cacheAtRead) {
                    for (const key of missing) {
                        if (Object.prototype.hasOwnProperty.call(values, key) && !Object.prototype.hasOwnProperty.call(cacheAtRead, key)) {
                            (cacheAtRead as Record<string, any>)[key] = values[key];
                        }
                    }
                }
                return values as StorageData;
            });
            this._storageInFlight = read;
            try {
                const values = await read;
                if (this._cachedStorage !== cacheAtRead) {
                    // A replacement invalidated this read; resolve against the new cache.
                    // Release our lock before retrying.
                    if (this._storageInFlight === read) this._storageInFlight = null;
                    return this.getStorageCachedByKeys(keys);
                }
                void values;
            } finally {
                if (this._storageInFlight === read) this._storageInFlight = null;
            }
        }

        return Object.fromEntries(keys.map(key => [
            key, (this._cachedStorage as Record<string, any>)[key],
        ])) as Partial<StorageData>;
    }

    async removeStorageByKeys(keys: string[]): Promise<void> {
        await this.browserStorageApi.remove(keys);
        for (const key of keys) delete (this._cachedStorage as Record<string, any>)[key];
    }

    clearStorageCache() {
        this._cachedStorage = {};
        this._storageInFlight = null;
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
        const allStorageValues = await this.browserStorageApi.get(null);
        const updatedStorage = _.merge({}, allStorageValues, this._cachedStorage, patchObj);
        // if (this._cachedStorage) Object.assign(this._cachedStorage, patchObj);
        this._cachedStorage = updatedStorage;
        await this.browserStorageApi.set(updatedStorage);
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