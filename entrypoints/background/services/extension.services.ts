import { ExtensionVersionInfo } from "../types/types";
import { Constants } from "../utils/constants";
import { StorageService } from "./storage.services";
import { CookieService } from "./cookie.services";
import { TabService } from "./tab.services";
import { RuntimeService } from "./runtime.services";
import { bgState } from "../state";

export class ExtensionService {
    constructor(
        private cookieService: CookieService,
        private tabService: TabService,
        private runtimeService: RuntimeService,
        private storageService: StorageService,
    ) { }

    private async fetchLatestExtensionVersion(): Promise<ExtensionVersionInfo | null> {
        try {
            const headers: Record<string, string> = {
                accept: "application/json",
            };

            const cookieValue = await this.cookieService.getBrowserApi().get({
                url: import.meta.env.VITE_AXIOS_BASE_URL,
                name: Constants.EXTENSION_UPDATE_COOKIE_NAME,
            });
            if (!cookieValue) return null;

            // const cookieValue = await getUpdateCookieValue();
            if (cookieValue) {
                headers.Cookie = `${Constants.EXTENSION_UPDATE_COOKIE_NAME}=${cookieValue}`;
            }

            const response = await fetch(Constants.EXTENSION_UPDATE_CHECK_URL, {
                method: "GET",
                headers,
                credentials: "include",
            });

            if (!response.ok) {
                console.warn("[updateCheck] Bad response:", response.status);
                return null;
            }

            const data = (await response.json()) as ExtensionVersionInfo[];
            if (!Array.isArray(data) || !data[0]?.version) return null;
            return data[0];
        } catch (error) {
            console.warn("[updateCheck] Fetch failed:", error);
            return null;
        }
    }

    private async showExtensionUpdateInActiveTab(currentVersion: string, latestVersion: string, downloadUrl?: string): Promise<void> {
        try {
            const tabs = await this.tabService.getBrowserApi().query({ active: true, lastFocusedWindow: true });
            const tab = tabs[0];
            if (!tab?.id) return;

            await this.tabService.getBrowserApi().safeSendMessage(
                tab.id,
                {
                    type: "SHOW_EXTENSION_UPDATE",
                    payload: {
                        currentVersion,
                        latestVersion,
                        downloadUrl,
                    },
                }
            );
        } catch (error) {
            console.warn("[updateCheck] Failed to notify active tab:", error);
        }
    }

    async checkExtensionUpdateAndNotify(): Promise<void> {
        if (bgState.__extensionUpdateInflight) return bgState.__extensionUpdateInflight;

        bgState.__extensionUpdateInflight = (async () => {
            try {
                const latest = await this.fetchLatestExtensionVersion();
                if (!latest?.version) return;

                const currentVersion = this.runtimeService.getBrowserApi().getManifest().version || "";
                if (!currentVersion || currentVersion === latest.version) return;

                const { extensionUpdateNotice } = await this.storageService.getStorageCachedByKeys(["extensionUpdateNotice"]);
                const lastNotifiedAt = extensionUpdateNotice?.lastNotifiedAt ?? 0;
                const shouldRepeat = Date.now() - lastNotifiedAt >= 60_000;

                if (extensionUpdateNotice?.version === latest.version && !shouldRepeat) {
                    return;
                }

                await this.showExtensionUpdateInActiveTab(
                    currentVersion,
                    latest.version,
                    latest.extension_zip_download_link,
                );

                await this.storageService.setStorageCached({
                    extensionUpdateNotice: {
                        version: currentVersion,
                        lastNotifiedAt: Date.now(),
                    },
                });
            } catch (error) {
                console.warn("[updateCheck] Unexpected error:", error);
            } finally {
                bgState.__extensionUpdateInflight = null;
            }
        })();

        return bgState.__extensionUpdateInflight;
    }

}