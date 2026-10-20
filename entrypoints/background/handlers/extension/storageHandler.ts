import { StorageService } from "../../services/storageServices";

export function storageOnChangedHandler(changes: any, area: string) {
        console.log("[storageOnChangedHandler] Changes detected:", changes);
        const storageService = StorageService.getInstance();

        if (area !== "local") return;

        if (!storageService.storageCache) {
            storageService.storageCache = {};
        }

        for (const [k, delta] of Object.entries(changes)) {
            const newValue = (delta as any).newValue;

            // Deep merge for settings to preserve nested objects like archive
            if (k === "settings" && typeof newValue === "object" && newValue !== null) {
                // Preserve existing settings and merge new values
                const existingSettings = storageService.storageCache[k];
                const existingArchive = existingSettings?.archive || {};
                const newArchive = newValue.archive || {};

                storageService.storageCache[k] = {
                    ...existingSettings,
                    ...newValue,
                    archive: {
                        ...existingArchive,
                        ...newArchive,
                    },
                };
            } else {
                Object.assign(storageService.storageCache, { [k]: newValue });
            }
        }
    }