import { normalizeTabSpecificSetting } from "../helpers/specific-tab";
import { DEFAULT_SETTINGS_JSON } from "../helpers/constants";
import { isValidArrayAct } from "../helpers/tools";
import { Archive, Settings, StorageData } from "../types/types";
import { ProxyService } from "./proxyServices";
import { chromeApi } from "../infrastructure/chrome-api/chrome-api";

export type LocalStorageAdapter = Pick<typeof chrome.storage.local, "get" | "set">;

export class StorageService {
    constructor(private readonly storage: LocalStorageAdapter = chromeApi.storage.local) {}

    private static _instance: StorageService | null = null;
    private _storageCache: StorageData = {};
    private _storageInFlight: Promise<StorageData> | null = null;

    public get storageCache() {
        return this._storageCache;
    }

    public set storageCache(value: StorageData) {
        this._storageCache = value;
    }

    static getInstance(): StorageService {
        if (!this._instance) {
            this._instance = new StorageService();
        }
        return this._instance;
    }

    public async getStorageByKeys(keys: string[]): Promise<Record<string, any>> {
        return new Promise((resolve) => this.storage.get(keys, resolve));
    }

    public async getStorageCachedByKeys(keys: string[]): Promise<StorageData> {
        if (this._storageCache) {
            if (!keys) {
                return this._storageCache;
            }
            
            const out: any = {};
            let allPresent = true;
            for (const k of keys) {
                if (!Object.prototype.hasOwnProperty.call(this._storageCache, k)) {
                    allPresent = false;
                    break;
                }
                out[k] = (this._storageCache as any)[k];
            }
            if (allPresent) {
                return out;
            }
        }

        if (this._storageInFlight) {
            await this._storageInFlight;
            return this.getStorageCachedByKeys(keys);
        }

        const fetchArg = isValidArrayAct(keys) ? keys : undefined;

        this._storageInFlight = chromeApi.storage.local
            .get(fetchArg)
            .then((vals) => {
                if (this._storageCache) {
                    Object.assign(this._storageCache, vals);
                } else {
                    this._storageCache = vals;
                }
                return this._storageCache;
            })
            .finally(() => {
                this._storageInFlight = null;
            });
        await this._storageInFlight;

        const out: any = {};
        for (const k of keys) {
            out[k] = (this._storageCache as any)[k];
        }
        return out;
    }

    public async setStorageCached(patchObj: Record<string, any>): Promise<void> {
        if (this._storageCache) Object.assign(this._storageCache, patchObj);
        await this.storage.set(patchObj);
    }

    public clearStorageCache() {
        this._storageCache = {};
        this._storageInFlight = null;
    }

    public async handleUpdateArchive(message: any, sendResponse?: (resp: any) => void) {
        try {
            const storageData = await this.storage.get(["settings"]);
            const currentSettings: any = storageData.settings || DEFAULT_SETTINGS_JSON;

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

    public async handleUpdateSettings(message: any, sendResponse?: (resp: any) => void) {
        const { settings: storageSettings } = await this.getStorageCachedByKeys(["settings"]);
        const updatedSettingsInputs = normalizeTabSpecificSetting(
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

    public async handleGetSettings(message: any, sendResponse: (resp: any) => void) {
        const { settings } = (await this.getStorageCachedByKeys(["settings"])) ?? DEFAULT_SETTINGS_JSON;
        if (sendResponse) {
            sendResponse({ data: settings });
        }
    }

    public async handleSetSettings(message: any, sendResponse?: (resp: any) => void) {
        try {
            const { settings: storageSettings } = await this.getStorageCachedByKeys(["settings"]);

            const currentSettingsInputs = message.inputs;
            const normalizedSettingsData = normalizeTabSpecificSetting(
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
                    ProxyService.getInstance().clearProxy();
                } else {
                    const { http, https } = proxyData;
                    const httpProxy = http.host && http.port ? http : null;
                    const httpsProxy = https.host && https.port ? https : null;
                    ProxyService.getInstance().setProxy(httpProxy, httpsProxy);
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