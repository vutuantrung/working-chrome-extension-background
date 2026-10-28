import { bgState } from "../../state";
import { Message, Settings, Archive } from "../../types/types";
import { Constants, DefaultValues, State } from "../../utils/constants";
import { delayMs } from "../../utils/tools";
import {
  bootstrapExistingFacebookTabs,
  cleanupFacebookTabs,
} from "../../scriptInjection";
import * as services from "../../services";
import * as helpers from "../../utils/helpers";

// ========================================
// INTERNAL HELPERS
// ========================================
async function waitForUserInfoDescription(
  maxWaitMs: number,
): Promise<{ found: boolean; info?: any } | null> {
  const startedAt = Date.now();
  let lastParsed: any = undefined;

  while (Date.now() - startedAt < maxWaitMs) {
    const { pendingUserInfo } = (await services.storageServices.getStorageCachedByKeys(["pendingUserInfo"])) || {};
    const parsed = pendingUserInfo?.parsed;
    if (parsed) lastParsed = parsed;
    if (helpers.userInfo.hasUserDescription(parsed)) return { found: true, info: parsed };
    await delayMs(Constants.USERINFO_DESCRIPTION_POLL_MS);
  }

  return { found: false, info: lastParsed };
}

// ========================================
// MESSAGE HANDLERS
// ========================================

export async function handleGetUserInfo(message: any, sendResponse: (resp: any) => void) {
  const { user } = await services.storageServices.getStorageCachedByKeys(["user"]);
  if (sendResponse) {
    sendResponse({ data: user });
  }
}

export async function handleInitializeAfterLogin(
  message: any,
  sendResponse: (resp: any) => void,
) {
  try {
    const keys = ["settings", "taskList", "activities", "automationByUser"];
    const { settings, taskList, activities, automationByUser } = await services.storageServices.getStorageCachedByKeys(keys);

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
        : DefaultValues.SETTINGS_DATA.facebookTopic;
      settingsFromAPI.tiktokTopic = extensionConfig.tiktokTopic
        ? extensionConfig.tiktokTopic
        : DefaultValues.SETTINGS_DATA.tiktokTopic;
      settingsFromAPI.xTopic = extensionConfig.xTopic
        ? extensionConfig.xTopic
        : DefaultValues.SETTINGS_DATA.xTopic;
      settingsFromAPI.threadsTopic = extensionConfig.threadsTopic
        ? extensionConfig.threadsTopic
        : DefaultValues.SETTINGS_DATA.threadsTopic;
      settingsFromAPI.youtubeTopic = extensionConfig.youtubeTopic
        ? extensionConfig.youtubeTopic
        : DefaultValues.SETTINGS_DATA.youtubeTopic;

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
    const useExtensionConfig = helpers.proxy.hasExtensionConfigId(extensionConfigId);
    const { personaProxy, personaFacebookAccounts, fbLoginMode } =
      await services.storageServices.getStorageCachedByKeys([
        "personaProxy",
        "personaFacebookAccounts",
        "fbLoginMode",
      ]);

    let extensionAccountProxy: Record<string, unknown> | null = null;
    let personaAccountProxy: Record<string, unknown> | null = null;
    if (fbLoginMode?.mode === "auto") {
      if (useExtensionConfig) {
        const { allSocialAccounts: storedSocialAccounts } = await services.storageServices.getStorageCachedByKeys(["allSocialAccounts"]);
        const savedPlatform = (fbLoginMode as any)?.platform ?? "facebook";
        extensionAccountProxy = helpers.proxy.findExtensionAccountProxyByPlatform(
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
          await services.storageServices.getStorageCachedByKeys([
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

        personaAccountProxy = helpers.proxy.findPersonaSocialAccountProxy(
          accountList,
          fbLoginMode.account_id,
        );

        if (accountsFromMessage.length > 0) {
          await services.storageServices.setStorageCached({
            allSocialAccounts: accountsFromMessage,
            personaFacebookAccounts: accountsFromMessage.filter(
              (a: any) => a.platform === "facebook",
            ),
          });
        }
      }
    }

    const { effective: effectiveProxy } = helpers.proxy.resolveEffectiveProxy({
      hasExtensionConfig: useExtensionConfig,
      extensionProxy: extensionConfigProxy,
      extensionAccountProxy,
      personaProxy: useExtensionConfig ? undefined : personaProxy,
      personaAccountProxy,
    });

    if (helpers.proxy.isActiveProxy(effectiveProxy)) {
      settingsFromAPI.proxy = "manual";
      settingsFromAPI.proxyOption = "manual";
      const { httpProxy, httpsProxy } = helpers.proxy.getProxyEndpoints(effectiveProxy);
      if (httpProxy || httpsProxy) {
        services.proxyServices.setProxy(
          httpProxy ?? undefined,
          httpsProxy ?? undefined,
        );
      }
      try {
        await services.storageServices.setStorageCached({
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
      services.proxyServices.clearProxy();
      try {
        await services.storageServices.setStorageCached({
          activeProxy: {},
        });
      } catch { }
    }

    services.storageServices.clearStorageCache();

    const finalSettings = settings
      ? {
        ...settings,
        ...settingsFromAPI,
        archive: settings.archive || {},
      }
      : {
        ...DefaultValues.SETTINGS_DATA,
        ...settingsFromAPI,
      };

    await services.storageServices.setStorageCached({
      settings: finalSettings,
      taskList: taskList || [],
      activities: activities || [],
      ...((automationByUser === null || automationByUser === undefined) && {
        automationByUser: true,
      }),
    });

    await services.alarmService.clearAlarm(Constants.SETTINGS_SYNC_ALARM);
    services.alarmService.createAlarm(Constants.SETTINGS_SYNC_ALARM, {
      delayInMinutes: 2,
      periodInMinutes: 2,
    });

    const initialScheduleTime = extensionConfig?.joinedGroupScheduleTime;
    if (typeof initialScheduleTime === "number" && initialScheduleTime > 0) {
      await services.storageServices.setStorageCached({
        joinedGroupScheduleTime: initialScheduleTime,
      });
    }
    await services.syncServices.ensureJoinedGroupsAlarmSchedule(
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

    services.storageServices.clearStorageCache();

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
      void services.alarmService.clearAllAlarms().then(() => resolve());
    });

    setTimeout(() => {
      cleanupFacebookTabs().catch(() => { });
    }, 0);

    services.proxyServices.clearProxy();

    services.actionService.setBadgeText({ text: "0" });
    services.actionService.setBadgeBackgroundColor({ color: "#0000FF" });

    if (!skipCookies) {
      await helpers.cookie.clearSocialPlatformCookies();
    }

    await services.storageServices.removeStorageByKeys([
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

    services.actionService.setBadgeText({ text: "0" });
    services.actionService.setBadgeBackgroundColor({ color: "#0000FF" });

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
    const existingAlarm = await services.alarmService.getAlarm("periodicCheck");
    const periodicTimeCheck = 3;
    const shouldRecreate =
      !existingAlarm || existingAlarm.periodInMinutes !== periodicTimeCheck;

    if (shouldRecreate) {
      if (existingAlarm) {
        await services.alarmService.clearAlarm("periodicCheck");
      }
      services.alarmService.createAlarm("periodicCheck", {
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

    await services.syncServices.ensureJoinedGroupsAlarmSchedule();

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
  services.actionService.setBadgeText({
    text: badgeValue.toString(),
  });
  services.actionService.setBadgeBackgroundColor({ color: "#0000FF" });

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
      await services.storageServices.getStorageCachedByKeys(["taskList"]);
    if (!storageTaskList || !Array.isArray(storageTaskList)) {
      sendResponse?.({ success: false, error: "No taskList" });
      return;
    }

    const task = storageTaskList.find((t: any) => t.taskId === taskId);
    if (!task) {
      sendResponse?.({ success: false, error: "Task not found" });
      return;
    }

    if (![State.TaskState.PENDING, State.TaskState.RUNNING].includes(task.state)) {
      sendResponse?.({ success: true, unchanged: true });
      return;
    }

    task.state = State.TaskState.CANCELED;
    task.result = "Canceled. Reason: Canceled by user.";
    task.endTime = Date.now();

    await services.storageServices.setStorageCached({
      taskList: storageTaskList,
    });

    // Ask the content script (if any) to stop this task loop immediately.
    if (typeof task.tabId === "number" && task.tabId > 0) {
      try {
        services.tabService.sendTabMessage(
          task.tabId,
          { type: "STOP_TASK", taskId },
          () => {
            void services.runtimeService.getRuntimeLastError();
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
  await services.downloadService.download({
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
  const {
    settings: storageSettings,
    taskList: storageTaskList,
    user: storageUser,
  } = await services.storageServices.getStorageCachedByKeys([
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

  if (runningTask && ![State.TaskState.FINISHED, State.TaskState.CANCELED].includes(runningTask.state)) {
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
    runningTask.state = State.TaskState.FINISHED;

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
    services.storageServices.clearStorageCache();
    await services.storageServices.setStorageCached(localUpdating);
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
    await services.storageServices.getStorageCachedByKeys([
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

    await services.storageServices.setStorageCached({ taskList: storageTaskList });
    services.tabService.updateTab(parseInt(message.inputs.tabId), {
      url: message.inputs.url,
    });
  }
  if (sendResponse) {
    sendResponse({ success: true });
  }
}
