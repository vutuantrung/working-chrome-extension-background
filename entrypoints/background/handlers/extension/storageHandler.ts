import { getStorageCache, setStorageCache } from "../../services/storageServices";

export function storageOnChangedHandler(changes: any, area: string) {
        console.log("[storageOnChangedHandler] Changes detected:", changes);

        if (area !== "local") return;

        if (!getStorageCache()) {
            setStorageCache({});
        }

        for (const [k, delta] of Object.entries(changes)) {
            const newValue = (delta as any).newValue;

            // Deep merge for settings to preserve nested objects like archive
            if (k === "settings" && typeof newValue === "object" && newValue !== null) {
                // Preserve existing settings and merge new values
                const existingSettings = getStorageCache()[k];
                const existingArchive = existingSettings?.archive || {};
                const newArchive = newValue.archive || {};

                getStorageCache()[k] = {
                    ...existingSettings,
                    ...newValue,
                    archive: {
                        ...existingArchive,
                        ...newArchive,
                    },
                };
            } else {
                Object.assign(getStorageCache(), { [k]: newValue });
            }
        }
    }