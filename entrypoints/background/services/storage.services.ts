import * as services from ".";
import * as helpers from "../utils/helpers";

import { Archive, Settings, StorageData } from "../types/types";
import { DefaultValues } from "../utils/constants";
import { isValidArrayAct } from "../utils/tools";
import { BrowserApplicationStorageApi } from "./storage.api";

export class StorageService {
    private _cachedStorage: StorageData = {};
    private _storageInFlight: Promise<StorageData> | null = null;

    constructor(private browserStorageApi: BrowserApplicationStorageApi) { }

    getCachedStorage() {
        return this._cachedStorage;
    }

    setCachedStorage(newValue: StorageData) {
        this._cachedStorage = {
            ...this._cachedStorage,
            ...newValue
        }
    }

    async getStorageByKeys(keys: string[]): Promise<Record<string, any>> {
        return this.browserStorageApi.get(keys);
    }

    async getStorageCachedByKeys(keys: string[]): Promise<StorageData> {
        if (this._cachedStorage) {
            if (!keys) {
                return this._cachedStorage;
            }

            const out: any = {};
            let allPresent = true;
            for (const k of keys) {
                if (!Object.prototype.hasOwnProperty.call(this._cachedStorage, k)) {
                    allPresent = false;
                    break;
                }
                out[k] = (this._cachedStorage as any)[k];
            }
            if (allPresent) {
                return out;
            }
        }

        if (this._cachedStorage) {
            await this._storageInFlight;
            return this.getStorageCachedByKeys(keys);
        }

        const fetchArg = isValidArrayAct(keys) ? keys : undefined;
        if (!fetchArg) {
            return {};
        }

        this._storageInFlight = this.browserStorageApi.get(fetchArg)
            .then((vals) => {
                if (this._cachedStorage) {
                    Object.assign(this._cachedStorage, vals);
                } else {
                    this._cachedStorage = vals;
                }
                return this._cachedStorage;
            })
            .finally(() => {
                this._storageInFlight = null;
            });
        await this._storageInFlight;

        const out: any = {};
        for (const k of keys) {
            out[k] = (this._cachedStorage as any)[k];
        }
        return out;
    }

    async setStorageCached(patchObj: Record<string, any>): Promise<void> {
        if (this._cachedStorage) Object.assign(this._cachedStorage, patchObj);
        await this.browserStorageApi.set(patchObj);
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
            const normalizedSettingsData = helpers.tabControl.normalizeTabSpecificSetting(
                currentSettingsInputs?.data || {},
            );
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

            const storageProxy = JSON.stringify(storageSettings?.proxy);
            const updatedProxy = JSON.stringify(normalizedSettingsData.proxy);
            if (updatedProxy && updatedProxy !== storageProxy) {
                updatedSettings = { ...updatedSettings, proxy: updatedProxy };
                const proxyData = JSON.parse(updatedProxy);
                if (proxyData === "system") {
                    services.proxyService.clearProxy();
                } else {
                    const { http, https } = proxyData;
                    const httpProxy = http.host && http.port ? http : null;
                    const httpsProxy = https.host && https.port ? https : null;
                    services.proxyService.setProxy(httpProxy, httpsProxy);
                }
            }

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
        const updatedSettingsInputs = helpers.tabControl.normalizeTabSpecificSetting(
            message.inputs?.updateSetting || {},
        );

        const updatedSettings = {
            ...storageSettings,
            ...updatedSettingsInputs,
        };
        await this.browserStorageApi.set({ settings: updatedSettings });
        if (sendResponse) {
            sendResponse({ success: true });
        }
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