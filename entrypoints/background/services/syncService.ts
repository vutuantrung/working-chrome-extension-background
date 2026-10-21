import { setProxy, clearProxy } from "../services/proxyServices";
import { getStorageCachedByKeys, setStorageCached } from "./storageServices";
import {
  findExtensionAccountProxyByPlatform,
  findPersonaSocialAccountProxy,
  getProxyEndpoints,
  hasExtensionConfigId,
  isActiveProxy,
  resolveEffectiveProxy,
} from "@/entrypoints/background/utils/helpers/proxy";
import { extractIsTabSpecific } from "../utils/helpers/tabControl";
import { DefaultValues } from "../utils/constants";
import { handleUpdateScheduleActivities } from "./scheduleService";
import { ensureJoinedGroupsAlarmSchedule } from "./fbGroupSyncService";
import {
  getSocialAccountsByPersona,
  getProxyInfo,
  getExtensionConfigInfo
} from "../infrastructure/api/user.api";

export async function handleSyncExtensionInfo(hasSyncActivity?: boolean): Promise<void> {
  try {

    const { settings, user, activities, fbLoginMode } =
      await getStorageCachedByKeys([
        "settings",
        "user",
        "activities",
        "fbLoginMode",
      ]);
    const extensionConfigId = user?.extension_session?.extension_config_id;
    const useExtensionConfig = hasExtensionConfigId(extensionConfigId);

    if (!settings || !user) {
      console.warn("[handleSyncExtensionInfo] Missing settings or user data");
      return;
    }

    const { personaProxy, personaFacebookAccounts } = await getStorageCachedByKeys(["personaProxy", "personaFacebookAccounts"]);

    if (!useExtensionConfig) {
      let personaAccountProxy: Record<string, unknown> | null = null;
      if (fbLoginMode?.mode === "auto") {
        let freshAccounts: any[] | null = null;
        const getPersonaIdResult = await getStorageCachedByKeys(["selectedPersonaId"]);
        const selectedPersonaId: string | undefined = getPersonaIdResult?.selectedPersonaId;

        if (selectedPersonaId) {
          try {
            const response =
              await getSocialAccountsByPersona(selectedPersonaId);
            const rawAccounts: any[] = Array.isArray(response?.data)
              ? response.data
              : Array.isArray(response)
                ? response
                : [];

            if (rawAccounts.length) {
              const normalized = rawAccounts.map((a) => ({
                ...a,
                platform: a.platform === "twitter" ? "x" : a.platform,
              }));

              freshAccounts = await Promise.all(
                normalized
                  .filter((a) => a.status === "active")
                  .map(async (account) => {
                    if (account.proxy_id) {
                      try {
                        const proxyData = await getProxyInfo(account.proxy_id);
                        return { ...account, proxy: proxyData };
                      } catch {
                        return account;
                      }
                    }
                    return account;
                  }),
              );

              await setStorageCached({
                allSocialAccounts: freshAccounts,
                personaFacebookAccounts: freshAccounts.filter(
                  (a) => a.platform === "facebook",
                ),
              });
            }
          } catch (err) {
            console.warn(
              "[handleSyncExtensionInfo] Failed to refresh social accounts:",
              err,
            );
          }
        }

        const { allSocialAccounts } = await getStorageCachedByKeys(["allSocialAccounts"]);
        const accountList = freshAccounts ?? allSocialAccounts ?? personaFacebookAccounts ?? [];

        personaAccountProxy = findPersonaSocialAccountProxy(
          accountList,
          fbLoginMode.account_id,
        );
        console.log("[handleSyncExtensionInfo] personaAccountProxy:", personaAccountProxy);
      }

      const { effective: proxyInfo } = resolveEffectiveProxy({
        hasExtensionConfig: false,
        personaProxy,
        personaAccountProxy,
      });
      const hasEffectiveProxy = isActiveProxy(proxyInfo);
      if (hasEffectiveProxy) {
        const { httpProxy, httpsProxy } = getProxyEndpoints(proxyInfo);
        if (httpProxy || httpsProxy) {
          setProxy(
            httpProxy ?? undefined,
            httpsProxy ?? undefined,
          );
        }
      } else {
        clearProxy();
      }

      try {
        await setStorageCached({
          activeProxy: hasEffectiveProxy ? proxyInfo : {},
          personaProxy: personaProxy || {},
        });
      } catch { }
      return;
    }

    if (!extensionConfigId) return;
    const extensionConfigInfo = await getExtensionConfigInfo(
      extensionConfigId,
      {
        include: [
          {
            relation: "extension_sessions",
            scope: {
              where: { id: user?.extension_session?.id },
            },
          },
          {
            relation: "extension_activities",
          },
        ],
      },
    );

    // Persist joinedGroupScheduleTime from API so alarm scheduling can stay dynamic
    const joinedGroupScheduleTime = extensionConfigInfo?.joinedGroupScheduleTime;
    if (
      typeof joinedGroupScheduleTime === "number" &&
      joinedGroupScheduleTime > 0
    ) {
      await setStorageCached({ joinedGroupScheduleTime });
    }
    await ensureJoinedGroupsAlarmSchedule(
      typeof joinedGroupScheduleTime === "number" && joinedGroupScheduleTime > 0
        ? joinedGroupScheduleTime
        : undefined,
    );

    const extensionConfigProxy = extensionConfigInfo?.proxy;

    let extensionAccountProxy: Record<string, unknown> | null = null;
    if (fbLoginMode?.mode === "auto") {
      const savedPlatform = (fbLoginMode as any)?.platform ?? "facebook";
      extensionAccountProxy = findExtensionAccountProxyByPlatform(
        extensionConfigInfo?.social_accounts ?? [],
        savedPlatform,
        fbLoginMode.account_id,
      );
    }
    const { effective: proxyInfo } = resolveEffectiveProxy({
      hasExtensionConfig: true,
      extensionProxy: extensionConfigProxy,
      extensionAccountProxy,
    });

    const extensionSession =
      extensionConfigInfo?.extension_sessions?.[0] ||
      user?.extension_session ||
      {};
    const {
      id: extension_session_id = user?.extension_session?.id,
      extension_id = user?.extension_session?.extension_id,
      automation = user?.extension_session?.automation,
      status = user?.extension_session?.status,
      schedule_start_time = user?.extension_session?.schedule_start_time,
      schedule_end_time = user?.extension_session?.schedule_end_time,
    } = extensionSession;
    const scheduleStartTime = schedule_start_time
      ? schedule_start_time
      : settings.scheduleStartTime || "00:00:00";
    const scheduleEndTime = schedule_end_time
      ? schedule_end_time
      : settings.scheduleEndTime || "23:59:59";
    const hasEffectiveProxy = isActiveProxy(proxyInfo);
    const configIsTabSpecific = extractIsTabSpecific(extensionConfigInfo);

    const updatedSettings = {
      ...DefaultValues.SETTINGS_DATA,
      ...settings,
      activatingAutomation: automation === true,
      scheduleStartTime,
      scheduleEndTime,
      facebookTopic: extensionConfigInfo?.facebookTopic
        ? extensionConfigInfo.facebookTopic
        : settings.facebookTopic || DefaultValues.SETTINGS_DATA.facebookTopic,
      tiktokTopic: extensionConfigInfo?.tiktokTopic
        ? extensionConfigInfo.tiktokTopic
        : settings.tiktokTopic || DefaultValues.SETTINGS_DATA.tiktokTopic,
      xTopic: extensionConfigInfo?.xTopic
        ? extensionConfigInfo.xTopic
        : settings.xTopic || DefaultValues.SETTINGS_DATA.xTopic,
      threadsTopic: extensionConfigInfo?.threadsTopic
        ? extensionConfigInfo.threadsTopic
        : settings.threadsTopic || DefaultValues.SETTINGS_DATA.threadsTopic,
      domain: extensionConfigInfo?.server_domain,
      proxy: hasEffectiveProxy ? "manual" : "system",
      proxyOption: hasEffectiveProxy ? "manual" : "system",
      isTabSpecific: configIsTabSpecific ?? settings.isTabSpecific ?? false,
    };

    if (hasEffectiveProxy) {
      const { httpProxy, httpsProxy } = getProxyEndpoints(proxyInfo);
      if (httpProxy || httpsProxy) {
        setProxy(
          httpProxy ?? undefined,
          httpsProxy ?? undefined,
        );
      }
    } else {
      clearProxy();
    }

    try {
      await setStorageCached({
        activeProxy: hasEffectiveProxy ? proxyInfo : {},
        extensionProxy: extensionConfigProxy || {},
        personaProxy: personaProxy || {},
      });
    } catch { }

    if (hasSyncActivity === true) {
      let scheduledActivities = null;
      const isValidArrayActLocal = (arr: any) =>
        Array.isArray(arr) && arr.length > 0;
      if (extensionConfigInfo?.extension_activities) {
        const actArr = extensionConfigInfo.extension_activities;
        if (isValidArrayActLocal(actArr)) {
          scheduledActivities = actArr;
        }
      }
      if (!scheduledActivities) {
        if (isValidArrayActLocal(activities)) {
          scheduledActivities = activities;
        } else {
          scheduledActivities = DefaultValues.SCHEDULED_TASK_DATA;
        }
      }
      if (scheduledActivities) {
        await handleUpdateScheduleActivities(scheduledActivities);
      }
    }

    const updatedUser = {
      ...user,
      extension_session: {
        ...(user?.extension_session || {}),
        id: extension_session_id,
        extension_session_id,
        extension_config_id: extensionConfigId,
        extension_id,
        automation: automation ?? user?.extension_session?.automation ?? false,
        status,
        schedule_start_time,
        schedule_end_time,
      },
    };
    await setStorageCached({
      user: updatedUser,
      settings: updatedSettings as any,
    });

    console.log("[handleSyncExtensionInfo] Updated settings:", {
      automation: updatedSettings.activatingAutomation,
      scheduleStartTime,
      scheduleEndTime,
      proxy: updatedSettings.proxy,
    });
  } catch (error: any) {
    console.warn(
      "[handleSyncExtensionInfo] Sync info skipped / failed:",
      error?.response?.data || error?.message || error,
    );
  }
}
