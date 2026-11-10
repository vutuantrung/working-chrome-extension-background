import { isSupportedPlatformUrl } from "../tools";
import { Platform } from "../../types/types";

// export function safeTabsSendMessage(tabId: number, message: any): Promise<any | null> {
//   return new Promise((resolve) => {
//     try {
//       chromeApi.tabs.sendMessage(tabId, message, (response) => {
//         const err = chromeApi.runtime.lastError;
//         if (!err) {
//           resolve(response ?? null);
//           return;
//         }

//         // Common, non-fatal: tab has no content script (closed/reloaded/not matching).
//         if (err.message?.includes("Receiving end does not exist")) {
//           resolve(null);
//           return;
//         }

//         console.warn(`SendMessage failed for tab ${tabId}:`, err);
//         resolve(null);
//       });
//     } catch (error) {
//       console.warn(`SendMessage threw for tab ${tabId}:`, error);
//       resolve(null);
//     }
//   });
// }

// export async function getActiveFacebookTabId(): Promise<number | null> {
//   try {
//     const allActiveTabs = await chromeApi.tabs.query({ active: true });
//     const activeFacebook = allActiveTabs.find((tab) => tab?.id && tab?.url && Constants.SUPPORTED_PLATFORM_URL_PATTERNS.facebook.test(tab.url));
//     if (activeFacebook?.id) return activeFacebook.id;

//     const allFacebookTabs = await chromeApi.tabs.query({ url: "*://*.facebook.com/*" });
//     return allFacebookTabs[0]?.id ?? null;
//   } catch (error) {
//     console.warn("[getActiveFacebookTabId] query error:", error);
//     return null;
//   }
// }

// export async function findDeterministicFacebookTabId(): Promise<number | null> {
// try {
//   const tabs = await chromeApi.tabs.query({ url: Constants.SUPPORTED_PLATFORM_URLS });

//   const fbTabs = (tabs || []).filter((t) => t.id && isSupportedPlatformUrl(t.url));
//   if (fbTabs.length === 0) return null;

//   // Deterministic choice: smallest tab id (oldest tab in this browser session)
//   const chosen = fbTabs.reduce((min, cur) => {
//     if (!min?.id) return cur;
//     if (!cur?.id) return min;
//     return cur.id < min.id ? cur : min;
//   }, fbTabs[0]);

//   return chosen?.id ?? null;
// } catch (error) {
//   console.warn("[findDeterministicFacebookTabId] query error:", error);
//   return null;
// }
// }

// export async function getCorrectFacebookTabId(): Promise<number> {
//   const { settings } = await services.storageService.getStorageCachedByKeys(["settings"]);
//   const isTabSpecific = settings?.isTabSpecific ?? false;

//   if (isTabSpecific) {
//     // Mode 1: Use the manually bound tab (openingDevtoolsTabId)
//     const boundTabId = settings?.openingDevtoolsTabId;

//     if (boundTabId && boundTabId > 0) {
//       try {
//         // Only verify the tab still exists.
//         // Don't reject it based on URL because during reload/navigation the URL can temporarily differ,
//         // which caused unstable "jumping" to other tabs.
//         await services.tabService.get(boundTabId);
//         console.debug(`Using bound tab: ${boundTabId}`);

//         return boundTabId;
//       } catch (error) {
//         console.warn(`Bound tab ${boundTabId} no longer exists`);
//       }
//     }

//     console.warn("isTabSpecific=true but no valid bound tab");
//     return -1;
//   } else {
//     // Mode 2: Use the first Facebook tab
//     let targetTabId = bgState.firstFacebookTabId ?? settings?.firstFacebookTabId ?? null;
//     if (targetTabId) {
//       try {
//         // Only verify the tab still exists; don't reset based on URL.
//         await services.tabService.get(targetTabId);
//         return targetTabId;
//       } catch (error) {
//         console.warn(`First tab ${targetTabId} no longer exists`);
//         // Reset and find new first tab
//         bgState.firstFacebookTabId = null;
//         targetTabId = null;
//       }
//     }

//     // If no first tab is set, find any Facebook tab to become the first
//     let fbTabId = null;
//     if (!targetTabId) {
//       const tabs = await services.tabService.query({ url: Constants.SUPPORTED_PLATFORM_URLS });

//       const fbTabs = (tabs || []).filter((t) => t.id && isSupportedPlatformUrl(t.url));
//       if (fbTabs.length !== 0) {
//         // Deterministic choice: smallest tab id (oldest tab in this browser session)
//         const chosen = fbTabs.reduce((min, cur) => {
//           if (!min?.id) return cur;
//           if (!cur?.id) return min;
//           return cur.id < min.id ? cur : min;
//         }, fbTabs[0]);

//         fbTabId = chosen?.id ?? null;
//       }

//       // const fbTabId = await findDeterministicFacebookTabId();
//       if (fbTabId) {
//         bgState.firstFacebookTabId = fbTabId;

//         // Persist to settings (UI persistence + SW restart persistence)
//         const updatedSettings = {
//           ...settings,
//           firstFacebookTabId: fbTabId,
//         };
//         await services.storageService.setStorageCached({ settings: updatedSettings });
//         return fbTabId;
//       }
//     }

//     console.warn("No Facebook tabs available");
//     return -1;
//   }
// }

export function getSmallestSupportedTabId(tabs: Array<{ id?: number; url?: string }>): number | null {
  const platformSupportedTabs = (tabs || []).filter((t) => t.id && isSupportedPlatformUrl(t.url));
  if (platformSupportedTabs.length === 0) return null;
  const chosen = platformSupportedTabs.reduce((min, cur) => {
    if (!min?.id) return cur;
    if (!cur?.id) return min;
    return cur.id < min.id ? cur : min;
  }, platformSupportedTabs[0]);
  return chosen?.id ?? null;
}

// export async function getCorrectFacebookTabId(firstFacebookTabId: number): Promise<number> {
//   // const { settings } = await services.storageService.getStorageCachedByKeys(["settings"]);
//   // const firstFacebookTabId = bgState.firstFacebookTabId ?? settings?.firstFacebookTabId ?? null;

//   // Use the first Facebook tab
  
//   // First attempt: try to use the first Facebook tab if available
//   let targetTabId = null;
//   if (firstFacebookTabId) {
//     const tab = await services.tabService.get(firstFacebookTabId);
//     if (tab) {
//       targetTabId = firstFacebookTabId;
//     }

//     // if (!tab) {
//     //   console.warn(`First tab ${firstFacebookTabId} no longer exists`);
//     //   // Reset and find new first tab
//     //   bgState.firstFacebookTabId = null;
//     //   targetTabId = null;
//     // } 
//   }

//   // Second attempt: If no first tab is set, find any Facebook tab to become the first
//   if (!targetTabId) {
//     const queriedTabs = await services.tabService.query({ url: Constants.SUPPORTED_PLATFORM_URLS });
//     if (queriedTabs) targetTabId = getSmallestSupportedTabId(queriedTabs);
//   }

//   return targetTabId;
// }

export function normalizeTabSpecificSetting(settingsData: any) {
  if (!settingsData || typeof settingsData !== "object") return settingsData;
  if (
    typeof settingsData.isTabSpecific !== "boolean" &&
    typeof settingsData.is_tab_specific === "boolean"
  ) {
    return { ...settingsData, isTabSpecific: settingsData.is_tab_specific };
  }
  return settingsData;
};

export function extractIsTabSpecific(configLike: any): boolean | undefined {
  if (typeof configLike?.is_tab_specific === "boolean") {
    return configLike.is_tab_specific;
  }
  if (typeof configLike?.isTabSpecific === "boolean") {
    return configLike.isTabSpecific;
  }
  if (typeof configLike?.extension_config?.is_tab_specific === "boolean") {
    return configLike.extension_config.is_tab_specific;
  }
  if (typeof configLike?.data?.is_tab_specific === "boolean") {
    return configLike.data.is_tab_specific;
  }
  return undefined;
};

export function distinctPlatformByRequestUrl(requestUrl?: string, tabUrl?: string): Platform | null {
  // console.log(">>>>>> distinctPlatformByRequestUrl - requestUrl:", requestUrl, "tabUrl:", tabUrl);
  if (!requestUrl || !tabUrl) return null;

  if (tabUrl.includes("facebook.com") && requestUrl.includes("/api/graphql")) return "facebook";
  if (tabUrl.includes("tiktok.com")) return "tiktok";
  if (tabUrl.includes("x.com") && requestUrl.includes("/api/graphql")) return "x";
  if (tabUrl.includes("threads.com") && requestUrl.includes("/graphql/query")) return "threads";
  if (tabUrl.includes("youtube.com")) return "youtube";

  return null;
}