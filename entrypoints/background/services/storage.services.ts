import * as services from "../services";
import * as helpers from "../utils/helpers";
import { isValidArrayAct } from "../utils/tools";
import { Archive, Settings, StorageData } from "../types/types";
import type { StoragePort } from "../contracts/storage.port";
import { chromeStorageAdapter } from "../infrastructure/chrome-api/chrome-storage.adapter";
import { DefaultValues } from "../utils/constants";

/** @deprecated Prefer StoragePort from contracts/storage.port. */
export type LocalStorageAdapter = StoragePort;

export class StorageService {
    private storageCache: StorageData = {};
    private storageInFlight: Promise<StorageData> | null = null;
    constructor(private readonly storage: StoragePort) {}
    getStorageCache(): StorageData { return this.storageCache; }
    setStorageCache(value: StorageData): void { this.storageCache = value; }

    async getStorageByKeys(keys: string[]): Promise<Record<string, any>> {
        return this.storage.get(keys);
    }

    async getStorageCachedByKeys(keys: string[]): Promise<StorageData> {
        if (this.storageCache) {
            if (!keys) {
                return this.storageCache;
            }

            const out: any = {};
            let allPresent = true;
            for (const k of keys) {
                if (!Object.prototype.hasOwnProperty.call(this.storageCache, k)) {
                    allPresent = false;
                    break;
                }
                out[k] = (this.storageCache as any)[k];
            }
            if (allPresent) {
                return out;
            }
        }

        if (this.storageInFlight) {
            await this.storageInFlight;
            return this.getStorageCachedByKeys(keys);
        }

        const fetchArg = isValidArrayAct(keys) ? keys : undefined;

        this.storageInFlight = this.storage.get(fetchArg)
            .then((vals) => {
                if (this.storageCache) {
                    Object.assign(this.storageCache, vals);
                } else {
                    this.storageCache = vals;
                }
                return this.storageCache;
            })
            .finally(() => {
                this.storageInFlight = null;
            });
        await this.storageInFlight;

        const out: any = {};
        for (const k of keys) {
            out[k] = (this.storageCache as any)[k];
        }
        return out;
    }

    async setStorageCached(patchObj: Record<string, any>): Promise<void> {
        if (this.storageCache) Object.assign(this.storageCache, patchObj);
        await this.storage.set(patchObj);
    }

    /** Remove persistent keys and invalidate the in-memory cache. */
    async removeStorageByKeys(keys: string[]): Promise<void> {
        await this.storage.remove(keys);
        for (const key of keys) delete (this.storageCache as Record<string, any>)[key];
    }

    clearStorageCache() {
        this.storageCache = {};
        this.storageInFlight = null;
    }

    async handleUpdateArchive(message: any, sendResponse?: (resp: any) => void) {
        try {
            const storageData = await this.storage.get(["settings"]);
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

            await this.storage.set({ settings: updatedSettings });

            await new Promise((resolve) => setTimeout(resolve, 100));

            const verification = await this.storage.get(["settings"]);

            const archiveKeys = Object.keys(updatedArchive);
            const savedArchiveKeys = Object.keys((verification.settings as any)?.archive || {});
            const allKeysSaved = archiveKeys.every((key) =>
                savedArchiveKeys.includes(key),
            );

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

    async handleUpdateSettings(message: any, sendResponse?: (resp: any) => void) {
        const { settings: storageSettings } = await this.getStorageCachedByKeys(["settings"]);
        const updatedSettingsInputs = helpers.tabControl.normalizeTabSpecificSetting(
            message.inputs?.updateSetting || {},
        );

        const updatedSettings = {
            ...storageSettings,
            ...updatedSettingsInputs,
        };
        await this.storage.set({ settings: updatedSettings });
        if (sendResponse) {
            sendResponse({ success: true });
        }
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

            await this.storage.set({ settings: updatedSettings });

            console.log("[handleSetSettings] Settings saved successfully");

            const storageProxy = JSON.stringify(storageSettings?.proxy);
            const updatedProxy = JSON.stringify(normalizedSettingsData.proxy);
            if (updatedProxy && updatedProxy !== storageProxy) {
                updatedSettings = { ...updatedSettings, proxy: updatedProxy };
                const proxyData = JSON.parse(updatedProxy);
                if (proxyData === "system") {
                    services.proxyServices.clearProxy();
                } else {
                    const { http, https } = proxyData;
                    const httpProxy = http.host && http.port ? http : null;
                    const httpsProxy = https.host && https.port ? https : null;
                    services.proxyServices.setProxy(httpProxy, httpsProxy);
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

}

// Compatibility API: existing callers share one instance during migration.
let sharedStorageService = new StorageService(chromeStorageAdapter);
export function getStorageService(): StorageService { return sharedStorageService; }
export function setStorageAdapter(adapter?: StoragePort): void {
    sharedStorageService = new StorageService(adapter ?? chromeStorageAdapter);
}
export function getStorageCache(): StorageData { return sharedStorageService.getStorageCache(); }
export function setStorageCache(value: StorageData): void { sharedStorageService.setStorageCache(value); }
export const getStorageByKeys: StorageService["getStorageByKeys"] = (...args: Parameters<StorageService["getStorageByKeys"]>) => sharedStorageService.getStorageByKeys(...args);
export const getStorageCachedByKeys: StorageService["getStorageCachedByKeys"] = (...args: Parameters<StorageService["getStorageCachedByKeys"]>) => sharedStorageService.getStorageCachedByKeys(...args);
export const setStorageCached: StorageService["setStorageCached"] = (...args: Parameters<StorageService["setStorageCached"]>) => sharedStorageService.setStorageCached(...args);
export const removeStorageByKeys: StorageService["removeStorageByKeys"] = (...args: Parameters<StorageService["removeStorageByKeys"]>) => sharedStorageService.removeStorageByKeys(...args);
export const clearStorageCache: StorageService["clearStorageCache"] = (...args: Parameters<StorageService["clearStorageCache"]>) => sharedStorageService.clearStorageCache(...args);
export const handleUpdateArchive: StorageService["handleUpdateArchive"] = (...args: Parameters<StorageService["handleUpdateArchive"]>) => sharedStorageService.handleUpdateArchive(...args);
export const handleUpdateSettings: StorageService["handleUpdateSettings"] = (...args: Parameters<StorageService["handleUpdateSettings"]>) => sharedStorageService.handleUpdateSettings(...args);
export const handleGetSettings: StorageService["handleGetSettings"] = (...args: Parameters<StorageService["handleGetSettings"]>) => sharedStorageService.handleGetSettings(...args);
export const handleSetSettings: StorageService["handleSetSettings"] = (...args: Parameters<StorageService["handleSetSettings"]>) => sharedStorageService.handleSetSettings(...args);
