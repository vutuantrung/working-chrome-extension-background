import { isSupportedPlatformUrl } from "../tools";
import { Platform } from "../../types/types";

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