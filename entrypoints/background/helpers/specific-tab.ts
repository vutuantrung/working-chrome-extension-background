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
