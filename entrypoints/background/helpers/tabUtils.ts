import { bgState } from "../state";
import { isSupportedPlatformUrl, PLATFORM_URL_PATTERNS } from "./tools";
import { PLATFORM_TAB_GLOBS } from "./constants";
import { StorageService } from "../services/storageServices";

export function safeTabsSendMessage(tabId: number, message: any, context: string): void {
  try {
    chrome.tabs.sendMessage(tabId, message, () => {
      const err = chrome.runtime.lastError;
      if (!err) return;

      // Common, non-fatal: tab has no content script (closed/reloaded/not matching).
      if (err.message?.includes("Receiving end does not exist")) {
        console.debug(`[${context}] No receiver on tab ${tabId}`);
        return;
      }

      console.warn(`[${context}] sendMessage failed for tab ${tabId}:`, err);
    });
  } catch (error) {
    console.warn(`[${context}] sendMessage threw for tab ${tabId}:`, error);
  }
}

export function safeTabsSendMessageWithResponse(tabId: number, message: any, context: string): Promise<any | null> {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        const err = chrome.runtime.lastError;
        if (!err) {
          resolve(response ?? null);
          return;
        }

        // Common, non-fatal: tab has no content script (closed/reloaded/not matching).
        if (err.message?.includes("Receiving end does not exist")) {
          console.debug(`[${context}] No receiver on tab ${tabId}`);
          resolve(null);
          return;
        }

        console.warn(`[${context}] sendMessage failed for tab ${tabId}:`, err);
        resolve(null);
      });
    } catch (error) {
      console.warn(`[${context}] sendMessage threw for tab ${tabId}:`, error);
      resolve(null);
    }
  });
}

export async function getActiveFacebookTabId(): Promise<number | null> {
  try {
    const allActiveTabs = await chrome.tabs.query({ active: true });
    const activeFacebook = allActiveTabs.find((tab) => tab?.id && tab?.url && PLATFORM_URL_PATTERNS.facebook.test(tab.url));
    if (activeFacebook?.id) return activeFacebook.id;

    const allFacebookTabs = await chrome.tabs.query({ url: "*://*.facebook.com/*" });
    return allFacebookTabs[0]?.id ?? null;
  } catch (error) {
    console.warn("[getActiveFacebookTabId] query error:", error);
    return null;
  }
}

export async function findDeterministicFacebookTabId(): Promise<number | null> {
  try {
    const tabs = await chrome.tabs.query({ url: PLATFORM_TAB_GLOBS });

    const fbTabs = (tabs || []).filter((t) => t.id && isSupportedPlatformUrl(t.url));
    if (fbTabs.length === 0) return null;

    // Deterministic choice: smallest tab id (oldest tab in this browser session)
    const chosen = fbTabs.reduce((min, cur) => {
      if (!min?.id) return cur;
      if (!cur?.id) return min;
      return cur.id < min.id ? cur : min;
    }, fbTabs[0]);

    return chosen?.id ?? null;
  } catch (error) {
    console.warn("[findDeterministicFacebookTabId] query error:", error);
    return null;
  }
}

export async function getCorrectFacebookTabId(): Promise<number> {
  const { settings } = await StorageService.getInstance().getStorageCachedByKeys(["settings"]);
  const isTabSpecific = settings?.isTabSpecific ?? false;

  if (isTabSpecific) {
    // Mode 1: Use the manually bound tab (openingDevtoolsTabId)
    const boundTabId = settings?.openingDevtoolsTabId;

    if (boundTabId && boundTabId > 0) {
      try {
        // Only verify the tab still exists.
        // Don't reject it based on URL because during reload/navigation the URL can temporarily differ,
        // which caused unstable "jumping" to other tabs.
        await chrome.tabs.get(boundTabId);
        console.debug(`[getCorrectFacebookTabId] Using bound tab: ${boundTabId}`);

        return boundTabId;
      } catch (error) {
        console.warn(
          `[getCorrectFacebookTabId] Bound tab ${boundTabId} no longer exists`,
        );
      }
    }

    console.warn(
      "[getCorrectFacebookTabId] isTabSpecific=true but no valid bound tab",
    );
    return -1;
  } else {
    // Mode 2: Use the first Facebook tab
    let targetTabId = bgState.firstFacebookTabId ?? settings?.firstFacebookTabId ?? null;
    if (targetTabId) {
      try {
        // Only verify the tab still exists; don't reset based on URL.
        await chrome.tabs.get(targetTabId);
        console.debug(
          `[getCorrectFacebookTabId] Using first tab: ${targetTabId}`,
        );
        return targetTabId;
      } catch (error) {
        console.warn(
          `[getCorrectFacebookTabId] First tab ${targetTabId} no longer exists`,
        );
        // Reset and find new first tab
        bgState.firstFacebookTabId = null;
        targetTabId = null;
      }
    }

    // If no first tab is set, find any Facebook tab to become the first
    if (!targetTabId) {
      const fbTabId = await findDeterministicFacebookTabId();
      if (fbTabId) {
        bgState.firstFacebookTabId = fbTabId;
        console.debug(
          `[getCorrectFacebookTabId] Set deterministic first tab: ${fbTabId}`,
        );

        // Persist to settings (UI persistence + SW restart persistence)
        const updatedSettings = {
          ...settings,
          firstFacebookTabId: fbTabId,
        };
        await StorageService.getInstance().setStorageCached({
          settings: updatedSettings as any,
        });

        return fbTabId;
      }
    }

    console.warn("[getCorrectFacebookTabId] No Facebook tabs available");
    return -1;
  }
}
