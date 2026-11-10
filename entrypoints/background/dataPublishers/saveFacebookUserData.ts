import { ApplicationServices } from "../application-services";
import { bgState } from "../state";

export function createSaveFacebookUserData(applicationServices: ApplicationServices): () => Promise<void> {
    return async () => {
        await saveFacebookUserData(applicationServices);
    };
}

export async function saveFacebookUserData(applicationServices: ApplicationServices): Promise<void> {
    if (!bgState.cachedFacebookUserInfo) return;
    await applicationServices.storage?.handleUpdateArchive({
        inputs: { updateArchive: bgState.cachedFacebookUserInfo }
    });
    bgState.cachedFacebookUserInfo = null;
}