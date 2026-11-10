import { ApplicationServices } from "../application-services";
import { bgState } from "../state";

export function createSaveFacebookGroupData(applicationServices: ApplicationServices): () => Promise<void> {
    return async () => {
        await saveFacebookGroupData(applicationServices);
    };
}

export async function saveFacebookGroupData(applicationServices: ApplicationServices): Promise<void> {
    let settings: any = null;
    try {
        const runtimeReq: any = await applicationServices.storage?.getStorageCachedByKeys(["settings"]);
        settings = runtimeReq?.settings || null;
    } catch (error) {
        console.log("[Error]", "Cannot get settings:", error);
        return;
    }
    const fbGUrl: string = settings?.archive?.fbGUrl ?? "";
    const currentJoinedGroups: { id: string; data: string }[] = [];
    if (fbGUrl) {
        currentJoinedGroups.push(
            ...fbGUrl
                .split(",")
                .filter((e: string) => e)
                .map((e: string) => ({ id: e.split("|")[0], data: e })),
        );
    }

    const newJoinedGroups: string[] = [];
    for (const newGroupUrl of bgState.cachedFacebookJoinedGroupsData) {
        const existingUrl = currentJoinedGroups.find((e: { id: string; data: string }) => e.id === newGroupUrl.id);
        if (existingUrl) {
            continue;
        }

        // treat data
        const newGUType = newGroupUrl.type === "public" ? "1" : "0"; // public: 1, private: 0
        const newGU: string = `${newGroupUrl.id}|${newGUType}|-1`;
        newJoinedGroups.push(newGU);
    }

    const updatedArchiveGroups: string[] = [
        ...currentJoinedGroups.map((e: { id: string; data: string }) => e.data),
        ...newJoinedGroups,
    ];
    await applicationServices.storage?.handleUpdateArchive({ inputs: { updateArchive: { fbGUrl: updatedArchiveGroups.join(",") } } });
    bgState.cachedFacebookJoinedGroupsData = [];
}