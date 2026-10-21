import { bgState } from "./state";
import * as services from "./services";
import * as helpers from "./utils/helpers";
import { ExtensionVersionInfo } from "./types/types";
import { chromeApi } from "./infrastructure/chrome-api/chrome-api";
import { Constants } from "./utils/constants";

async function getUpdateCookieValue(): Promise<string | undefined> {
  try {
    const cookie = await chromeApi.cookies.get({
      url: import.meta.env.VITE_AXIOS_BASE_URL,
      name: Constants.EXTENSION_UPDATE_COOKIE_NAME,
    });
    if (cookie?.value) return cookie.value;
  } catch (error) {
    console.warn("[updateCheck] Failed to read cookie:", error);
  }
  return undefined;
}

async function fetchLatestExtensionVersion(): Promise<ExtensionVersionInfo | null> {
  try {
    const headers: Record<string, string> = {
      accept: "application/json",
    };

    const cookieValue = await getUpdateCookieValue();
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

export async function showExtensionUpdateInActiveTab(currentVersion: string, latestVersion: string, downloadUrl?: string): Promise<void> {
  try {
    const [tab] = await chromeApi.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    if (!tab?.id) return;

    await helpers.tabControl.safeTabsSendMessage(
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

export async function checkExtensionUpdateAndNotify(): Promise<void> {
  if (bgState.__extensionUpdateInflight) return bgState.__extensionUpdateInflight;

  bgState.__extensionUpdateInflight = (async () => {
    try {
      const latest = await fetchLatestExtensionVersion();
      if (!latest?.version) return;

      const currentVersion = chromeApi.runtime.getManifest().version || "";
      if (!currentVersion || currentVersion === latest.version) return;

      const { extensionUpdateNotice } =
        await services.storageServices.getStorageCachedByKeys(["extensionUpdateNotice"]);
      const lastNotifiedAt = extensionUpdateNotice?.lastNotifiedAt ?? 0;
      const shouldRepeat = Date.now() - lastNotifiedAt >= 60_000;

      if (extensionUpdateNotice?.version === latest.version && !shouldRepeat) {
        return;
      }

      await showExtensionUpdateInActiveTab(
        currentVersion,
        latest.version,
        latest.extension_zip_download_link,
      );

      await services.storageServices.setStorageCached({
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
