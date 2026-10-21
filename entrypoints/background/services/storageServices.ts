import { normalizeTabSpecificSetting } from "../utils/helpers/tabControl";
import { isValidArrayAct } from "../utils/tools";
import { Archive, Settings, StorageData } from "../types/types";
import { setProxy, clearProxy } from "./proxyServices";
import { chromeApi } from "../infrastructure/chrome-api/chrome-api";
import { DefaultValues } from "../utils/constants";

export type LocalStorageAdapter = Pick<typeof chrome.storage.local, "get" | "set">;

let currentStorageAdapter: LocalStorageAdapter | undefined;
let storageCache: StorageData = {};
let storageInFlight: Promise<StorageData> | null = null;

function storage(): LocalStorageAdapter { return currentStorageAdapter ?? chromeApi.storage.local; }
export function setStorageAdapter(adapter?: LocalStorageAdapter): void {
    currentStorageAdapter = adapter;
    clearStorageCache();
}
export function getStorageCache(): StorageData { return storageCache; }
export function setStorageCache(value: StorageData): void { storageCache = value; }

export async function getStorageByKeys(keys: string[]): Promise<Record<string, any>> {
    return storage().get(keys);
}

export async function getStorageCachedByKeys(keys: string[]): Promise<StorageData> {
    if (storageCache) {
        if (!keys) {
            return storageCache;
        }

        const out: any = {};
        let allPresent = true;
        for (const k of keys) {
            if (!Object.prototype.hasOwnProperty.call(storageCache, k)) {
                allPresent = false;
                break;
            }
            out[k] = (storageCache as any)[k];
        }
        if (allPresent) {
            return out;
        }
    }

    if (storageInFlight) {
        await storageInFlight;
        return getStorageCachedByKeys(keys);
    }

    const fetchArg = isValidArrayAct(keys) ? keys : undefined;

    storageInFlight = storage().get(fetchArg)
        .then((vals) => {
            if (storageCache) {
                Object.assign(storageCache, vals);
            } else {
                storageCache = vals;
            }
            return storageCache;
        })
        .finally(() => {
            storageInFlight = null;
        });
    await storageInFlight;

    const out: any = {};
    for (const k of keys) {
        out[k] = (storageCache as any)[k];
    }
    return out;
}

export async function setStorageCached(patchObj: Record<string, any>): Promise<void> {
    if (storageCache) Object.assign(storageCache, patchObj);
    await storage().set(patchObj);
}

export function clearStorageCache() {
    storageCache = {};
    storageInFlight = null;
}

export async function handleUpdateArchive(message: any, sendResponse?: (resp: any) => void) {
    try {
        const storageData = await storage().get(["settings"]);
        const currentSettings: any = storageData.settings || DefaultValues.SETTINGS_DATA;

        const updatedArchive: Archive = {
            ...(currentSettings.archive || {}),
            ...message.inputs.updateArchive,
        };
        const updatedSettings: Settings = {
            ...currentSettings,
            archive: updatedArchive,
        };

        clearStorageCache();

        await storage().set({ settings: updatedSettings });

        await new Promise((resolve) => setTimeout(resolve, 100));

        const verification = await storage().get(["settings"]);

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

export async function handleUpdateSettings(message: any, sendResponse?: (resp: any) => void) {
    const { settings: storageSettings } = await getStorageCachedByKeys(["settings"]);
    const updatedSettingsInputs = normalizeTabSpecificSetting(
        message.inputs?.updateSetting || {},
    );

    const updatedSettings = {
        ...storageSettings,
        ...updatedSettingsInputs,
    };
    await storage().set({ settings: updatedSettings });
    if (sendResponse) {
        sendResponse({ success: true });
    }
}

export async function handleGetSettings(message: any, sendResponse: (resp: any) => void) {
    const { settings } = (await getStorageCachedByKeys(["settings"])) ?? DefaultValues.SETTINGS_DATA;
    if (sendResponse) {
        sendResponse({ data: settings });
    }
}

export async function handleSetSettings(message: any, sendResponse?: (resp: any) => void) {
    try {
        const { settings: storageSettings } = await getStorageCachedByKeys(["settings"]);

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

        clearStorageCache();

        await storage().set({ settings: updatedSettings });

        console.log("[handleSetSettings] Settings saved successfully");

        const storageProxy = JSON.stringify(storageSettings?.proxy);
        const updatedProxy = JSON.stringify(normalizedSettingsData.proxy);
        if (updatedProxy && updatedProxy !== storageProxy) {
            updatedSettings = { ...updatedSettings, proxy: updatedProxy };
            const proxyData = JSON.parse(updatedProxy);
            if (proxyData === "system") {
                clearProxy();
            } else {
                const { http, https } = proxyData;
                const httpProxy = http.host && http.port ? http : null;
                const httpsProxy = https.host && https.port ? https : null;
                setProxy(httpProxy, httpsProxy);
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
