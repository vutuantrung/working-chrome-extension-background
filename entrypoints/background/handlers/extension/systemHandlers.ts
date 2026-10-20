import {
  bgState,
  USERINFO_DESCRIPTION_WAIT_MS,
  USERINFO_DESCRIPTION_POLL_MS,
  SETTINGS_SYNC_ALARM
} from "../../state";
import { Message, Settings, Archive, State } from "../../types/types";
import { hasUserDescription, removePendingUserInfo } from "../../helpers/user-info";
import { UserInfoPublishStatus } from "../../types/types";
import { DEFAULT_SETTINGS_JSON } from "../../helpers/constants";
import { delayMs } from "../../helpers/tools";
import {
  findExtensionAccountProxyByPlatform,
  findPersonaSocialAccountProxy,
  getProxyEndpoints,
  hasExtensionConfigId,
  isActiveProxy,
  resolveEffectiveProxy,
} from "@/utils/resolveEffectiveProxy";
import { sendFacebookUserData } from "../../dataPublishers/facebookPublisher";
import {
  bootstrapExistingFacebookTabs,
  cleanupFacebookTabs,
} from "../../scriptInjection";
import { clearSocialPlatformCookies } from "../../helpers/cookieUtils";
import { StorageService } from "../../services/storageServices";
import { ProxyService } from "../../services/proxyServices";
import { ensureJoinedGroupsAlarmSchedule } from "../../services/fbGroupSyncService";
import { chromeApi } from "../../chrome-api";

// ========================================
// INTERNAL HELPERS
// ========================================
async function waitForUserInfoDescription(
  maxWaitMs: number,
): Promise<{ found: boolean; info?: any } | null> {
  const startedAt = Date.now();
  let lastParsed: any = undefined;

  while (Date.now() - startedAt < maxWaitMs) {
    const { pendingUserInfo } = (await StorageService.getInstance().getStorageCachedByKeys(["pendingUserInfo"])) || {};
    const parsed = pendingUserInfo?.parsed;
    if (parsed) lastParsed = parsed;
    if (hasUserDescription(parsed)) return { found: true, info: parsed };
    await delayMs(USERINFO_DESCRIPTION_POLL_MS);
  }

  return { found: false, info: lastParsed };
}

// ========================================
// MESSAGE HANDLERS
// ========================================

export async function handleGetUserInfo(message: any, sendResponse: (resp: any) => void) {
  const { user } = await StorageService.getInstance().getStorageCachedByKeys(["user"]);
  if (sendResponse) {
    sendResponse({ data: user });
  }
}

export async function handleGetPendingUserInfo(
  message: any,
  sendResponse: (resp: any) => void,
) {
  const keys = [
    "pendingUserInfo",
    "pendingUserInfoList",
    "userInfoPublishStatus",
  ];
  const { pendingUserInfo, pendingUserInfoList, userInfoPublishStatus } =
    await StorageService.getInstance().getStorageCachedByKeys(keys);

  if (sendResponse) {
    sendResponse({
      ok: true,
      pendingUserInfo: pendingUserInfo || null,
      pendingUserInfoList: pendingUserInfoList || [],
      userInfoPublishStatus: userInfoPublishStatus || null,
    });
  }
}

export async function handleConfirmGatherUserInfo(
  message: any,
  sendResponse: (resp: any) => void,
) {
  try {
    const { inputs } = message || {};
    const overrideRaw =
      inputs && typeof inputs.raw === "string" ? inputs.raw : "";
    const overrideParsed = inputs?.parsed;
    const overrideId =
      inputs && typeof inputs.id === "string" ? inputs.id : undefined;
    const overrideTs = typeof inputs?.ts === "number" ? inputs.ts : undefined;

    const keys = ["pendingUserInfo", "pendingUserInfoList"];
    let { pendingUserInfo, pendingUserInfoList } =
      await StorageService.getInstance().getStorageCachedByKeys(keys);

    const candidateRaw = overrideRaw || pendingUserInfo?.raw;
    const candidateParsed =
      overrideParsed || (overrideRaw ? undefined : pendingUserInfo?.parsed);

    if (!candidateRaw) {
      sendResponse?.({
        ok: false,
        error: "No pending user info to publish.",
      });
      return;
    }

    const shouldWaitForDescription =
      !overrideRaw && !overrideParsed && !hasUserDescription(candidateParsed);
    if (shouldWaitForDescription) {
      await StorageService.getInstance().setStorageCached({
        userInfoPublishStatus: {
          status: "pending",
          ts: Date.now(),
          message: "Waiting for profile description...",
        },
      });

      await waitForUserInfoDescription(USERINFO_DESCRIPTION_WAIT_MS);
      const refreshed =
        (await StorageService.getInstance().getStorageCachedByKeys([
          "pendingUserInfo",
        ])) || {};
      pendingUserInfo = refreshed.pendingUserInfo || pendingUserInfo;
    }

    bgState.cachedFacebookUserInfoToPublish =
      overrideRaw || pendingUserInfo?.raw || candidateRaw;

    await StorageService.getInstance().setStorageCached({
      userInfoPublishStatus: {
        status: "pending",
        ts: Date.now(),
        message: "Publishing user data...",
      },
    });

    await sendFacebookUserData();

    const sent = bgState.cachedFacebookUserInfoToPublish === null;
    if (sent) {
      const status: UserInfoPublishStatus = {
        status: "sent",
        ts: Date.now(),
        message: "[User] Sent successfully!",
      };

      const list = Array.isArray(pendingUserInfoList)
        ? pendingUserInfoList
        : [];
      const removeId = overrideId || (pendingUserInfo as any)?.id || undefined;
      const removeTs =
        typeof overrideTs === "number"
          ? overrideTs
          : (pendingUserInfo as any)?.ts;
      const nextList = removePendingUserInfo(list, {
        id: removeId,
        ts: typeof removeTs === "number" ? removeTs : undefined,
      });
      const nextPending = nextList.length
        ? nextList[nextList.length - 1]
        : null;

      await StorageService.getInstance().setStorageCached({
        pendingUserInfo: nextPending,
        pendingUserInfoList: nextList,
        userInfoPublishStatus: status,
      });

      sendResponse?.({
        ok: true,
        userInfoPublishStatus: status,
        pendingUserInfoList: nextList,
        pendingUserInfo: nextPending,
      });
      return;
    }

    const failStatus: UserInfoPublishStatus = {
      status: "failed",
      ts: Date.now(),
      message: "User data not published. Check topics/config.",
    };

    bgState.cachedFacebookUserInfoToPublish = null;

    await StorageService.getInstance().setStorageCached({
      userInfoPublishStatus: failStatus,
    });

    sendResponse?.({
      ok: false,
      error: failStatus.message,
      userInfoPublishStatus: failStatus,
    });
  } catch (error: any) {
    const message = String(error?.message || error);
    const failStatus: UserInfoPublishStatus = {
      status: "failed",
      ts: Date.now(),
      message,
    };

    bgState.cachedFacebookUserInfoToPublish = null;

    await StorageService.getInstance().setStorageCached({
      userInfoPublishStatus: failStatus,
    });

    sendResponse?.({
      ok: false,
      error: message,
      userInfoPublishStatus: failStatus,
    });
  }
}

export async function handleRemovePendingUserInfo(
  message: any,
  sendResponse: (resp: any) => void,
) {
  try {
    const { inputs } = message || {};
    const { pendingUserInfoList } =
      await StorageService.getInstance().getStorageCachedByKeys([
        "pendingUserInfoList",
      ]);
    const list = Array.isArray(pendingUserInfoList) ? pendingUserInfoList : [];
    const nextList = removePendingUserInfo(list, {
      id: typeof inputs?.id === "string" ? inputs.id : undefined,
      ts: typeof inputs?.ts === "number" ? inputs.ts : undefined,
      index: typeof inputs?.index === "number" ? inputs.index : undefined,
    });
    const nextPending = nextList.length ? nextList[nextList.length - 1] : null;

    await StorageService.getInstance().setStorageCached({
      pendingUserInfoList: nextList,
      pendingUserInfo: nextPending,
    });

    sendResponse?.({
      ok: true,
      pendingUserInfoList: nextList,
      pendingUserInfo: nextPending,
    });
  } catch (error: any) {
    sendResponse?.({
      ok: false,
      error: String(error?.message || error),
    });
  }
}

export async function handleInitializeAfterLogin(
  message: any,
  sendResponse: (resp: any) => void,
) {
  try {
    const keys = ["settings", "taskList", "activities", "automationByUser"];
    const { settings, taskList, activities, automationByUser } = await StorageService.getInstance().getStorageCachedByKeys(keys);

    const {
      extension_session: extensionSession,
      extension_config: extensionConfig,
      extension_proxy: extensionProxy,
    } = message.inputs || {};

    const settingsFromAPI: Partial<Settings> = {};
    if (extensionSession) {
      if (extensionSession.schedule_start_time) {
        const startTime = extensionSession.schedule_start_time;
        settingsFromAPI.scheduleStartTime = startTime.includes("T")
          ? startTime.split("T")[1].split(".")[0]
          : startTime;
      }

      if (extensionSession.schedule_end_time) {
        const endTime = extensionSession.schedule_end_time;
        settingsFromAPI.scheduleEndTime = endTime.includes("T")
          ? endTime.split("T")[1].split(".")[0]
          : endTime;
      }

      if (typeof extensionSession.automation === "boolean") {
        settingsFromAPI.activatingAutomation = extensionSession.automation;
      }
    }

    if (extensionConfig && Object.entries(extensionConfig).length) {
      if (extensionConfig.server_domain) {
        settingsFromAPI.domain = extensionConfig.server_domain;
      }

      settingsFromAPI.facebookTopic = extensionConfig.facebookTopic
        ? extensionConfig.facebookTopic
        : DEFAULT_SETTINGS_JSON.facebookTopic;
      settingsFromAPI.tiktokTopic = extensionConfig.tiktokTopic
        ? extensionConfig.tiktokTopic
        : DEFAULT_SETTINGS_JSON.tiktokTopic;
      settingsFromAPI.xTopic = extensionConfig.xTopic
        ? extensionConfig.xTopic
        : DEFAULT_SETTINGS_JSON.xTopic;
      settingsFromAPI.threadsTopic = extensionConfig.threadsTopic
        ? extensionConfig.threadsTopic
        : DEFAULT_SETTINGS_JSON.threadsTopic;
      settingsFromAPI.youtubeTopic = extensionConfig.youtubeTopic
        ? extensionConfig.youtubeTopic
        : DEFAULT_SETTINGS_JSON.youtubeTopic;

      if (extensionConfig.permissions && extensionConfig.permissions.length) {
        settingsFromAPI.permissions = extensionConfig.permissions;
      }

      if (typeof extensionConfig.is_tab_specific === "boolean") {
        settingsFromAPI.isTabSpecific = extensionConfig.is_tab_specific;
      }
    }

    const extensionConfigProxy =
      extensionConfig?.proxy || (extensionProxy && Object.keys(extensionProxy).length
        ? extensionProxy
        : undefined);

    const extensionConfigId =
      extensionSession?.extension_config_id ?? extensionConfig?.id;
    const useExtensionConfig = hasExtensionConfigId(extensionConfigId);
    const { personaProxy, personaFacebookAccounts, fbLoginMode } =
      await StorageService.getInstance().getStorageCachedByKeys([
        "personaProxy",
        "personaFacebookAccounts",
        "fbLoginMode",
      ]);

    let extensionAccountProxy: Record<string, unknown> | null = null;
    let personaAccountProxy: Record<string, unknown> | null = null;
    if (fbLoginMode?.mode === "auto") {
      if (useExtensionConfig) {
        const { allSocialAccounts: storedSocialAccounts } = await StorageService.getInstance().getStorageCachedByKeys(["allSocialAccounts"]);
        const savedPlatform = (fbLoginMode as any)?.platform ?? "facebook";
        extensionAccountProxy = findExtensionAccountProxyByPlatform(
          extensionConfig?.social_accounts ?? storedSocialAccounts ?? [],
          savedPlatform,
          fbLoginMode.account_id,
        );
      } else {
        const accountsFromMessage: any[] = Array.isArray(
          message.inputs?.all_social_accounts,
        )
          ? message.inputs.all_social_accounts
          : [];

        const { allSocialAccounts } =
          await StorageService.getInstance().getStorageCachedByKeys([
            "allSocialAccounts",
          ]);

        const accountList =
          accountsFromMessage.length > 0
            ? accountsFromMessage
            : ((allSocialAccounts?.length
              ? allSocialAccounts
              : personaFacebookAccounts) ?? []);

        console.log(
          "[handleInitializeAfterLogin] persona accountList:",
          accountList.map((a: any) => ({
            id: a.account_id,
            platform: a.platform,
            has_proxy: !!a.proxy && Object.keys(a.proxy || {}).length > 0,
          })),
        );

        personaAccountProxy = findPersonaSocialAccountProxy(
          accountList,
          fbLoginMode.account_id,
        );

        if (accountsFromMessage.length > 0) {
          await StorageService.getInstance().setStorageCached({
            allSocialAccounts: accountsFromMessage,
            personaFacebookAccounts: accountsFromMessage.filter(
              (a: any) => a.platform === "facebook",
            ),
          });
        }
      }
    }

    const { effective: effectiveProxy } = resolveEffectiveProxy({
      hasExtensionConfig: useExtensionConfig,
      extensionProxy: extensionConfigProxy,
      extensionAccountProxy,
      personaProxy: useExtensionConfig ? undefined : personaProxy,
      personaAccountProxy,
    });

    if (isActiveProxy(effectiveProxy)) {
      settingsFromAPI.proxy = "manual";
      settingsFromAPI.proxyOption = "manual";
      const { httpProxy, httpsProxy } = getProxyEndpoints(effectiveProxy);
      if (httpProxy || httpsProxy) {
        ProxyService.getInstance().setProxy(
          httpProxy ?? undefined,
          httpsProxy ?? undefined,
        );
      }
      try {
        await StorageService.getInstance().setStorageCached({
          activeProxy: effectiveProxy,
          extensionProxy: extensionConfigProxy || {},
          personaProxy: personaProxy || {},
        });
      } catch { }
    } else if (
      (extensionConfigProxy &&
        !Object.entries(extensionConfigProxy as object).length) ||
      (extensionProxy && !Object.entries(extensionProxy).length)
    ) {
      ProxyService.getInstance().clearProxy();
      try {
        await StorageService.getInstance().setStorageCached({
          activeProxy: {},
        });
      } catch { }
    }

    StorageService.getInstance().clearStorageCache();

    const finalSettings = settings
      ? {
        ...settings,
        ...settingsFromAPI,
        archive: settings.archive || {},
      }
      : {
        ...DEFAULT_SETTINGS_JSON,
        ...settingsFromAPI,
      };

    await StorageService.getInstance().setStorageCached({
      settings: finalSettings,
      taskList: taskList || [],
      activities: activities || [],
      ...((automationByUser === null || automationByUser === undefined) && {
        automationByUser: true,
      }),
    });

    await chromeApi.alarms.clear(SETTINGS_SYNC_ALARM);
    chromeApi.alarms.create(SETTINGS_SYNC_ALARM, {
      delayInMinutes: 2,
      periodInMinutes: 2,
    });

    const initialScheduleTime = extensionConfig?.joinedGroupScheduleTime;
    if (typeof initialScheduleTime === "number" && initialScheduleTime > 0) {
      await StorageService.getInstance().setStorageCached({
        joinedGroupScheduleTime: initialScheduleTime,
      });
    }
    await ensureJoinedGroupsAlarmSchedule(
      typeof initialScheduleTime === "number" && initialScheduleTime > 0
        ? initialScheduleTime
        : undefined,
    );

    if (sendResponse) {
      sendResponse({
        success: true,
        initialized: !settings,
        updated: !!settings,
        settings: finalSettings,
        timestamp: new Date().toISOString(),
      });
    }

    // Delay bootstrap to avoid disrupting Facebook UI after login
    setTimeout(() => {
      bootstrapExistingFacebookTabs({ forceProfileIdBootstrap: true }).catch(
        (error) => {
          console.warn("[handleInitializeAfterLogin] Bootstrap failed:", error);
        },
      );
    }, 2000); // Wait 2 seconds to let Facebook UI fully load
  } catch (error) {
    console.error("[handleInitializeAfterLogin] Error:", error);
    if (sendResponse) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export async function handleClearDataAfterLogout(
  message: any,
  sendResponse: (resp: any) => void,
) {
  try {
    console.log("[handleClearDataAfterLogout] Starting cleanup...");

    const skipCookies = message?.inputs?.skipCookies === true;

    StorageService.getInstance().clearStorageCache();

    // Cancel any in-flight send from previous session.
    bgState.__sendDataKafkaRunId += 1;
    bgState.__sendDataKafkaInflight = null;

    bgState.firstFacebookTabId = null;

    // Clear in-memory archived queues so nothing can publish after logout
    bgState.cachedFacebookJoinedGroupsData = [];
    bgState.cachedFacebookUserInfo = null;
    bgState.cachedFacebookUserInfoToPublish = null;
    bgState.cachedFacebookData = [];

    bgState.cachedTiktokData = [];

    bgState.__debouncers.clear();

    // Clear ALL alarms (MV3-safe): periodic, scheduleTask_*, sendFacebookPostData, etc.
    await new Promise<void>((resolve) => {
      chromeApi.alarms.clearAll(() => resolve());
    });

    setTimeout(() => {
      cleanupFacebookTabs().catch(() => { });
    }, 0);

    ProxyService.getInstance().clearProxy();

    chromeApi.action.setBadgeText({ text: "0" });
    chromeApi.action.setBadgeBackgroundColor({ color: "#0000FF" });
    
    if (!skipCookies) {
      await clearSocialPlatformCookies();
    }

    await chromeApi.storage.local.remove([
      "settings",
      "taskList",
      "activities",
      "user",
      "pendingUserInfo",
      "userInfoPublishStatus",
      "automationByUser",
      "fbLoginMode",
      "fbAccountCache",
      "extensionProxy",
      "personaProxy",
      "personaFacebookAccounts",
      "selectedPersonaId",
      "profileId",
      "profile",
      "activeProxy",
      "threadsLoginMode",
      "tiktokLoginMode",
      "tiktok_posts_info",
      "xLoginMode",
      "personaSocialAccounts",
      "allSocialAccounts",
      "facebook_posts_info",
      "lastActiveFacebookTab",
      "youtube_posts_info",
      "youtube_profiles_info",
    ]);

    chromeApi.action.setBadgeText({ text: "0" });
    chromeApi.action.setBadgeBackgroundColor({ color: "#0000FF" });

    console.log("[handleClearDataAfterLogout] Cleanup completed successfully");

    if (sendResponse) {
      sendResponse({
        success: true,
        cleared: true,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("[handleClearDataAfterLogout] Error:", error);
    if (sendResponse) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export async function handleStartPeriodicCheck(
  _message: any,
  sendResponse: (resp: any) => void,
) {
  console.log("[handleStartPeriodicCheck] Starting periodic check alarm...");
  try {
    const existingAlarm = await chromeApi.alarms.get("periodicCheck");
    const periodicTimeCheck = 3;
    const shouldRecreate =
      !existingAlarm || existingAlarm.periodInMinutes !== periodicTimeCheck;

    if (shouldRecreate) {
      if (existingAlarm) {
        await chromeApi.alarms.clear("periodicCheck");
      }
      chromeApi.alarms.create("periodicCheck", {
        delayInMinutes: 0.5,
        periodInMinutes: periodicTimeCheck,
      });
      console.log(
        "[handleStartPeriodicCheck] Alarm created with",
        periodicTimeCheck,
        "minute interval",
      );
    } else {
      console.log(
        "[handleStartPeriodicCheck] Alarm already exists with",
        periodicTimeCheck,
        "minute interval",
      );
    }

    await ensureJoinedGroupsAlarmSchedule();

    if (sendResponse) {
      sendResponse({ success: true });
    }
  } catch (error) {
    console.error("[handleStartPeriodicCheck] Error:", error);
    if (sendResponse) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export async function handleSetBadgeText(
  message: Message,
  sendResponse?: (resp: any) => void,
): Promise<void> {
  let badgeValue = Number(message.inputs.badgeData);
  if (!Number.isFinite(badgeValue) || badgeValue < 0) badgeValue = 0;
  chromeApi.action.setBadgeText({
    text: badgeValue.toString(),
  });
  chromeApi.action.setBadgeBackgroundColor({ color: "#0000FF" });

  if (sendResponse) {
    sendResponse({ success: true });
  }
}

export async function handleCancelTask(
  message: any,
  sendResponse?: (resp: any) => void,
): Promise<void> {
  try {
    const taskId = message?.inputs?.taskId;
    if (!taskId) {
      sendResponse?.({ success: false, error: "Missing taskId" });
      return;
    }

    const { taskList: storageTaskList } =
      await StorageService.getInstance().getStorageCachedByKeys(["taskList"]);
    if (!storageTaskList || !Array.isArray(storageTaskList)) {
      sendResponse?.({ success: false, error: "No taskList" });
      return;
    }

    const task = storageTaskList.find((t: any) => t.taskId === taskId);
    if (!task) {
      sendResponse?.({ success: false, error: "Task not found" });
      return;
    }

    if (![State.PENDING, State.RUNNING].includes(task.state)) {
      sendResponse?.({ success: true, unchanged: true });
      return;
    }

    task.state = State.CANCELED;
    task.result = "Canceled. Reason: Canceled by user.";
    task.endTime = Date.now();

    await StorageService.getInstance().setStorageCached({
      taskList: storageTaskList,
    });

    // Ask the content script (if any) to stop this task loop immediately.
    if (typeof task.tabId === "number" && task.tabId > 0) {
      try {
        chromeApi.tabs.sendMessage(
          task.tabId,
          { type: "STOP_TASK", taskId },
          () => {
            void chromeApi.runtime.lastError;
          },
        );
      } catch { }
    }

    sendResponse?.({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[handleCancelTask] Error:", error);
    sendResponse?.({ success: false, error: msg });
  }
}

export async function handleFetchDataTask(
  message: Message,
  sendResponse?: (resp: any) => void,
): Promise<void> {
  const { url, reqInit } = message.inputs;

  let req: Response | undefined;
  try {
    req = await fetch(url, reqInit);
  } catch (error) {
    console.log("[handleFetchDataTask]", error);
  }
  let returnData = null;
  if (req?.ok) {
    returnData = await req.json();
  }

  if (sendResponse) {
    sendResponse({ data: returnData });
  }
}

export async function handleDownloadImage(
  message: Message,
  sendResponse?: (resp: any) => void,
): Promise<void> {
  const { url, fileName = "extImgDownload.jpg" } = message.inputs;
  await chromeApi.downloads.download({
    url,
    filename: fileName,
    conflictAction: "uniquify",
    saveAs: false,
  });

  if (sendResponse) {
    sendResponse({ success: true });
  }
}

export async function handleScriptExecuteResult(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse?: (resp: any) => void,
): Promise<void> {
  const storageService = StorageService.getInstance();
  const {
    settings: storageSettings,
    taskList: storageTaskList,
    user: storageUser,
  } = await storageService.getStorageCachedByKeys([
    "settings",
    "taskList",
    "user",
  ]);
  const currentSettingsInputs = message.inputs;

  if (storageUser?.extension_session?.automation !== true) {
    return;
  }

  let localUpdating: any = null;
  const runningTask = storageTaskList?.find(
    (task: any) => task.taskId === currentSettingsInputs.taskId,
  );

  if (runningTask && ![State.FINISHED, State.CANCELED].includes(runningTask.state)) {
    runningTask.state = State.FINISHED;
    if (
      currentSettingsInputs.result?.groupIds ||
      currentSettingsInputs.result?.groupLinks
    ) {
      runningTask.result = currentSettingsInputs.result;
    } else {
      runningTask.result = currentSettingsInputs.error
        ? "" + currentSettingsInputs.error
        : "success";
    }

    runningTask.nextTask = "end";
    runningTask.endTime = Date.now();

    localUpdating = {
      ...(localUpdating || {}),
      taskList: storageTaskList,
    };
    console.log(new Date().toLocaleTimeString(), "[TaskList]", storageTaskList);
  }

  const updateArchive = currentSettingsInputs.updateArchive;
  if (updateArchive) {
    const updatedArchive: Archive = {
      ...(storageSettings?.archive || {}),
      ...updateArchive,
    };

    const updatedSettings: Settings = {
      ...(localUpdating?.settings ?? storageSettings),
      archive: updatedArchive,
    };

    localUpdating = {
      ...(localUpdating || {}),
      settings: updatedSettings,
    };
  }

  if (localUpdating) {
    storageService.clearStorageCache();
    await storageService.setStorageCached(localUpdating);
    if (runningTask) {
      bgState.injectedTabs.delete(runningTask.tabId);
    }
  }

  if (sendResponse) {
    sendResponse({ success: true });
  }
}

export async function handleChangeTabUrl(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse?: (resp: any) => void,
) {
  const { taskList: storageTaskList, user: storageUser } =
    await StorageService.getInstance().getStorageCachedByKeys([
      "taskList",
      "user",
    ]);
  if (storageUser?.extension_session?.automation !== true) {
    return;
  }

  const runningTaskInfo = storageTaskList?.find((task: any) => task.taskId === message.inputs.taskId);
  const currentSettingsInputs = message.inputs;
  if (runningTaskInfo) {
    runningTaskInfo.nextTask = message.inputs.nextTask ?? "";
    if (currentSettingsInputs.updateInputs) {
      runningTaskInfo.inputs = {
        ...runningTaskInfo.inputs,
        ...currentSettingsInputs.updateInputs,
      };
    }

    await StorageService.getInstance().setStorageCached({ taskList: storageTaskList });
    chromeApi.tabs.update(parseInt(message.inputs.tabId), {
      url: message.inputs.url,
    });
  }
  if (sendResponse) {
    sendResponse({ success: true });
  }
}
