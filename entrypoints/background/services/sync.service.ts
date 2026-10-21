import * as services from "../services";
import * as helpers from "../utils/helpers";
import { DefaultValues } from "../utils/constants";
import {
  getSocialAccountsByPersona,
  getProxyInfo,
  getExtensionConfigInfo
} from "../infrastructure/api/user.api";
import { bgState } from "../state";
import { Constants } from "../utils/constants";
import { FacebookGroupJoinedData } from "@/entrypoints/background/utils/parsers/types";
import {
  sendFacebookJoinedGroupsCachedData,
  sendFacebookPendingGroupsCachedData,
} from "../dataPublishers/facebookPublisher";
import { chromeApi } from "../infrastructure/chrome-api/chrome-api";


export async function handleSyncExtensionInfo(hasSyncActivity?: boolean): Promise<void> {
  try {

    const { settings, user, activities, fbLoginMode } = await services.storageServices.getStorageCachedByKeys(["settings", "user", "activities", "fbLoginMode"]);
    const extensionConfigId = user?.extension_session?.extension_config_id;
    const useExtensionConfig = helpers.proxy.hasExtensionConfigId(extensionConfigId);

    if (!settings || !user) {
      console.warn("[handleSyncExtensionInfo] Missing settings or user data");
      return;
    }

    const { personaProxy, personaFacebookAccounts } = await services.storageServices.getStorageCachedByKeys(["personaProxy", "personaFacebookAccounts"]);

    if (!useExtensionConfig) {
      let personaAccountProxy: Record<string, unknown> | null = null;
      if (fbLoginMode?.mode === "auto") {
        let freshAccounts: any[] | null = null;
        const getPersonaIdResult = await services.storageServices.getStorageCachedByKeys(["selectedPersonaId"]);
        const selectedPersonaId: string | undefined = getPersonaIdResult?.selectedPersonaId;

        if (selectedPersonaId) {
          try {
            const response = await getSocialAccountsByPersona(selectedPersonaId);
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

              await services.storageServices.setStorageCached({
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

        const { allSocialAccounts } = await services.storageServices.getStorageCachedByKeys(["allSocialAccounts"]);
        const accountList = freshAccounts ?? allSocialAccounts ?? personaFacebookAccounts ?? [];

        personaAccountProxy = helpers.proxy.findPersonaSocialAccountProxy(
          accountList,
          fbLoginMode.account_id,
        );
        console.log("[handleSyncExtensionInfo] personaAccountProxy:", personaAccountProxy);
      }

      const { effective: proxyInfo } = helpers.proxy.resolveEffectiveProxy({
        hasExtensionConfig: false,
        personaProxy,
        personaAccountProxy,
      });
      const hasEffectiveProxy = helpers.proxy.isActiveProxy(proxyInfo);
      if (hasEffectiveProxy) {
        const { httpProxy, httpsProxy } = helpers.proxy.getProxyEndpoints(proxyInfo);
        if (httpProxy || httpsProxy) {
          services.proxyServices.setProxy(
            httpProxy ?? undefined,
            httpsProxy ?? undefined,
          );
        }
      } else {
        services.proxyServices.clearProxy();
      }

      try {
        await services.storageServices.setStorageCached({
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
    if (typeof joinedGroupScheduleTime === "number" && joinedGroupScheduleTime > 0) {
      await services.storageServices.setStorageCached({ joinedGroupScheduleTime });
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
      extensionAccountProxy = helpers.proxy.findExtensionAccountProxyByPlatform(
        extensionConfigInfo?.social_accounts ?? [],
        savedPlatform,
        fbLoginMode.account_id,
      );
    }
    const { effective: proxyInfo } = helpers.proxy.resolveEffectiveProxy({
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
    const hasEffectiveProxy = helpers.proxy.isActiveProxy(proxyInfo);
    const configIsTabSpecific = helpers.tabControl.extractIsTabSpecific(extensionConfigInfo);

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
      const { httpProxy, httpsProxy } = helpers.proxy.getProxyEndpoints(proxyInfo);
      if (httpProxy || httpsProxy) {
        services.proxyServices.setProxy(
          httpProxy ?? undefined,
          httpsProxy ?? undefined,
        );
      }
    } else {
      services.proxyServices.clearProxy();
    }

    try {
      await services.storageServices.setStorageCached({
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
        await services.scheduleServices.handleUpdateScheduleActivities(scheduledActivities);
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

    await services.storageServices.setStorageCached({
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

export async function ensureJoinedGroupsAlarmSchedule(targetScheduleTime?: number): Promise<void> {
  let periodMin = targetScheduleTime;
  if (typeof periodMin !== "number" || periodMin <= 0) {
    const { joinedGroupScheduleTime } = await services.storageServices.getStorageCachedByKeys(["joinedGroupScheduleTime"]);
    periodMin = typeof joinedGroupScheduleTime === "number" && joinedGroupScheduleTime > 0
      ? joinedGroupScheduleTime
      : 20;
  }

  const existingAlarm = await chromeApi.alarms.get(Constants.SYNC_FB_JOINED_GROUPS_ALARM);
  if (!existingAlarm || existingAlarm.periodInMinutes !== periodMin) {
    if (existingAlarm) {
      await chromeApi.alarms.clear(Constants.SYNC_FB_JOINED_GROUPS_ALARM);
    }
    chromeApi.alarms.create(Constants.SYNC_FB_JOINED_GROUPS_ALARM, {
      delayInMinutes: 1,
      periodInMinutes: periodMin,
    });
    console.log(`SYNC_FB_JOINED_GROUPS_ALARM set to ${periodMin} min (delay: 1 min).`);
  }
}

export async function syncFacebookJoinedGroups(): Promise<void> {
  const TAG = "[FB Group Sync]";
  console.log(new Date().toLocaleTimeString(), TAG, "Starting background synchronization...");
  try {
    // 1. Get current c_user cookie to verify login state and obtain Facebook account ID
    let accountId = "";
    try {
      const cookie = await chromeApi.cookies.get({ url: Constants.FB_WEB_URL, name: "c_user" });
      accountId = cookie?.value || "";
    } catch (e: any) {
      console.warn(TAG, "Failed to get c_user cookie:", e.message);
    }

    if (!accountId) {
      console.warn(TAG, "User not logged into Facebook (no c_user cookie). Skipping.");
      return;
    }

    // 2. Find an active Facebook tab to delegate fetching to
    const tabId = await helpers.tabControl.getCorrectFacebookTabId();
    if (!tabId || tabId === -1) {
      console.warn(TAG, "No Facebook tab available to delegate fetch. Skipping.");
      return;
    }

    console.log(TAG, `Delegating GraphQL fetch to Facebook tab ${tabId}...`);

    // 3. Ask content script to perform the fetch and return all groups
    const response = await helpers.tabControl.safeTabsSendMessage(tabId, { type: "FETCH_FB_JOINED_GROUPS", accountId });
    if (!response?.ok) {
      console.error(TAG, "Content script returned error:", response?.error || "Unknown error");
      return;
    }

    const allGroups: FacebookGroupJoinedData[] = response.groups || [];

    console.log(new Date().toLocaleTimeString(), TAG, `Completed fetching. Found ${allGroups.length} groups.`);

    if (allGroups.length > 0) {
      // 4. Store fetched groups in distinct state cache
      bgState.cachedFacebookSyncGroupsData = allGroups;

      // 5. Direct publish and schedule alarm as a retry fallback
      try {
        await sendFacebookJoinedGroupsCachedData();
      } catch (err: any) {
        console.error(TAG, "Failed direct publish, scheduling alarm for retry:", err.message);
        chromeApi.alarms.create(Constants.SEND_FB_JOINED_GROUPS_ALARM, {
          delayInMinutes: 0.05,
        });
      }
    }
  } catch (error: any) {
    console.error(
      TAG, "Error during background synchronization:",
      error.message,
    );
  }
}

export async function syncFacebookPendingGroups(): Promise<void> {
  const TAG = "[FB Pending Groups Sync]";
  console.log(new Date().toLocaleTimeString(), TAG, "Starting background synchronization...");
  try {
    // 1. Get current c_user cookie to verify login state and obtain Facebook account ID
    let accountId = "";
    try {
      const cookie = await chromeApi.cookies.get({ url: Constants.FB_WEB_URL, name: "c_user" });
      accountId = cookie?.value || "";
    } catch (e: any) {
      console.warn(TAG, "Failed to get c_user cookie:", e.message);
    }

    if (!accountId) {
      console.warn(TAG, "User not logged into Facebook (no c_user cookie). Skipping.");
      return;
    }

    // 2. Find an active Facebook tab to delegate fetching to
    const tabId = await helpers.tabControl.getCorrectFacebookTabId();
    if (!tabId || tabId === -1) {
      console.warn(TAG, "No Facebook tab available to delegate fetch. Skipping.");
      return;
    }

    console.log(TAG, `Delegating GraphQL fetch to Facebook tab ${tabId}...`);

    // 3. Ask content script to perform the fetch and return all pending groups
    const response = await helpers.tabControl.safeTabsSendMessage(tabId, { type: "FETCH_FB_PENDING_GROUPS", accountId });

    if (!response?.ok) {
      console.error(TAG, "Content script returned error:", response?.error || "Unknown error");
      return;
    }

    const allGroups: FacebookGroupJoinedData[] = response.groups || [];

    console.log(new Date().toLocaleTimeString(), TAG, `Completed fetching. Found ${allGroups.length} pending groups.`);

    if (allGroups.length > 0) {
      // 4. Store fetched groups in distinct state cache
      bgState.cachedFacebookSyncPendingGroupsData = allGroups;

      // 5. Direct publish and schedule alarm as a retry fallback
      try {
        await sendFacebookPendingGroupsCachedData();
      } catch (err: any) {
        console.error(TAG, "Failed direct publish, scheduling alarm for retry:", err.message);
        chromeApi.alarms.create(Constants.SEND_FB_PENDING_GROUPS_ALARM, {
          delayInMinutes: 0.05,
        });
      }
    }
  } catch (error: any) {
    console.error(TAG, "Error during background synchronization:", error.message);
  }
}
