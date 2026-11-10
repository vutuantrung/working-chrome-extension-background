import { ApplicationServices } from "../../application-services";

export function createStorageOnChangedHandler(applicationService: ApplicationServices) {
    return (changes: any, area: string) => storageOnChangedHandlerInternal(applicationService, changes, area);
}

function storageOnChangedHandlerInternal(
    applicationService: ApplicationServices,
    changes: any,
    area: string
) {
    console.log("[storageOnChangedHandler] Changes detected:", changes);

    if (area !== "local") return;

    const currentCachedStorage = applicationService.storage?.getCachedStorage() || {};

    for (const [k, delta] of Object.entries(changes)) {
        const newValue = (delta as any).newValue;

        // Deep merge for settings to preserve nested objects like archive
        if (k === "settings" && typeof newValue === "object" && newValue !== null) {
            // Preserve existing settings and merge new values
            const existingSettings = applicationService.storage?.getCachedStorage()[k];
            const existingArchive = existingSettings?.archive || {};
            const newArchive = newValue.archive || {};

            currentCachedStorage[k] = {
                ...existingSettings,
                ...newValue,
                archive: {
                    ...existingArchive,
                    ...newArchive,
                },
            };
        } else {
            Object.assign(currentCachedStorage, { [k]: newValue });
        }
    }

    applicationService.storage?.setCachedStorage(currentCachedStorage);
}