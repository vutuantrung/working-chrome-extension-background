import * as helpers from "../../utils/helpers";
import { bgState } from "../../state";
import { Message, Settings, Archive } from "../../types/types";
import { Constants, DefaultValues, State } from "../../utils/constants";
import { ApplicationServices } from "../../application-services";


// ========================================
// MESSAGE HANDLERS
// ========================================

export async function handleGetUserInfo(
  applicationServices: ApplicationServices,
  message: any,
  sendResponse: (resp: any) => void
) {
  const { user } = await applicationServices.storage?.getStorageCachedByKeys(["user"]) || {};
  if (sendResponse) {
    sendResponse({ data: user });
  }
}

export async function handleInitializeAfterLogin(
  applicationServices: ApplicationServices,
  message: any,
  sendResponse: (resp: any) => void,
) {
  try {
    // const keys = ["settings", "taskList", "activities", "automationByUser", "personaProxy", "personaFacebookAccounts", "fbLoginMode"];
    const cachedStorage = applicationServices.storage?.getCachedStorage();
    if (!cachedStorage) {
      throw new Error("Failed to retrieve cached storage");
    }

    const { settings, taskList, activities, automationByUser } = cachedStorage;

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

    const extensionConfigProxy = extensionConfig?.proxy || (extensionProxy && Object.keys(extensionProxy).length
      ? extensionProxy
      : undefined);

    const extensionConfigId = extensionSession?.extension_config_id ?? extensionConfig?.id;
    const useExtensionConfig = helpers.proxy.hasExtensionConfigId(extensionConfigId);
    const { personaProxy, personaFacebookAccounts, fbLoginMode } = cachedStorage;

    let extensionAccountProxy: Record<string, unknown> | null = null;
    let personaAccountProxy: Record<string, unknown> | null = null;
    if (fbLoginMode?.mode === "auto") {
      if (useExtensionConfig) {
        const { allSocialAccounts: storedSocialAccounts } = cachedStorage;
        const savedPlatform = (fbLoginMode as any)?.platform ?? "facebook";
        extensionAccountProxy = helpers.proxy.findExtensionAccountProxyByPlatform(
          extensionConfig?.social_accounts ?? storedSocialAccounts ?? [],
          savedPlatform,
          fbLoginMode.account_id,
        );
      } else {
        const accountsFromMessage: any[] = Array.isArray(message.inputs?.all_social_accounts)
          ? message.inputs.all_social_accounts
          : [];

        const { allSocialAccounts } = cachedStorage;

        const accountList = accountsFromMessage.length > 0
          ? accountsFromMessage
          : ((allSocialAccounts?.length
            ? allSocialAccounts
            : personaFacebookAccounts) ?? []);

        // console.log(
        //   "[handleInitializeAfterLogin] persona accountList:",
        //   accountList.map((a: any) => ({
        //     id: a.account_id,
        //     platform: a.platform,
        //     has_proxy: !!a.proxy && Object.keys(a.proxy || {}).length > 0,
        //   })),
        // );

        personaAccountProxy = helpers.proxy.findPersonaSocialAccountProxy(
          accountList,
          fbLoginMode.account_id,
        );

        if (accountsFromMessage.length > 0) {
          await applicationServices.storage?.setStorageCached({
            allSocialAccounts: accountsFromMessage,
            personaFacebookAccounts: accountsFromMessage.filter((a: any) => a.platform === "facebook"),
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
        applicationServices.proxy?.setProxy(
          httpProxy ?? undefined,
          httpsProxy ?? undefined,
        );
      }
      await applicationServices.storage?.setStorageCached({
        activeProxy: effectiveProxy,
        extensionProxy: extensionConfigProxy || {},
        personaProxy: personaProxy || {},
      });


    } else if (
      (extensionConfigProxy && !Object.entries(extensionConfigProxy as object).length) ||
      (extensionProxy && !Object.entries(extensionProxy).length)
    ) {

      applicationServices.proxy?.clearProxy();
      await applicationServices.storage?.setStorageCached({
        activeProxy: {}
      });
    }

    applicationServices.storage?.clearStorageCache();

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

    await applicationServices.storage?.setStorageCached({
      settings: finalSettings,
      taskList: taskList || [],
      activities: activities || [],
      ...((automationByUser === null || automationByUser === undefined) && {
        automationByUser: true,
      }),
    });

    await applicationServices.alarm?.getBrowserApi().clear(Constants.SETTINGS_SYNC_ALARM);
    applicationServices.alarm?.getBrowserApi().create(Constants.SETTINGS_SYNC_ALARM, {
      delayInMinutes: 2,
      periodInMinutes: 2,
    });

    const initialScheduleTime = extensionConfig?.joinedGroupScheduleTime;
    if (typeof initialScheduleTime === "number" && initialScheduleTime > 0) {
      await applicationServices.storage?.setStorageCached({
        joinedGroupScheduleTime: initialScheduleTime,
      });
    }
    await applicationServices.sync?.ensureJoinedGroupsAlarmSchedule(
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
      applicationServices.script?.injectDependenciesInSupportedPlatform({ forceProfileIdBootstrap: true }).catch(
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
  applicationServices: ApplicationServices,
  message: any,
  sendResponse: (resp: any) => void,
) {
  try {
    console.log("[handleClearDataAfterLogout] Starting cleanup...");

    const skipCookies = message?.inputs?.skipCookies === true;

    applicationServices.storage?.clearStorageCache();

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
      void applicationServices.alarm?.getBrowserApi().clearAll().then(() => resolve());
    });

    setTimeout(() => {
      applicationServices.tab?.cleanupFacebookTabs().catch(() => { });
    }, 0);

    applicationServices.proxy?.clearProxy();

    applicationServices.action?.getBrowserApi().setBadgeText({ text: "0" });
    applicationServices.action?.getBrowserApi().setBadgeBackgroundColor({ color: "#0000FF" });

    if (!skipCookies) {
      await Promise.all(Constants.SOCIAL_COOKIE_DOMAINS.map((domain) => applicationServices.cookie?.clearCookiesForDomain(domain)))
    }

    await applicationServices.storage?.removeStorageByKeys([
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

    applicationServices.action?.getBrowserApi().setBadgeText({ text: "0" });
    applicationServices.action?.getBrowserApi().setBadgeBackgroundColor({ color: "#0000FF" });

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
  applicationServices: ApplicationServices,
  _message: any,
  sendResponse: (resp: any) => void,
) {
  console.log("[handleStartPeriodicCheck] Starting periodic check alarm...");
  try {
    const existingAlarm = await applicationServices.alarm?.getBrowserApi().get("periodicCheck");
    const periodicTimeCheck = 3;
    const shouldRecreate = !existingAlarm || existingAlarm.periodInMinutes !== periodicTimeCheck;

    if (shouldRecreate) {
      if (existingAlarm) {
        await applicationServices.alarm?.getBrowserApi().clear("periodicCheck");
      }
      applicationServices.alarm?.getBrowserApi().create("periodicCheck", {
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

    await applicationServices.sync?.ensureJoinedGroupsAlarmSchedule();

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
  applicationServices: ApplicationServices,
  message: Message,
  sendResponse?: (resp: any) => void,
): Promise<void> {
  let badgeValue = Number(message.inputs.badgeData);
  if (!Number.isFinite(badgeValue) || badgeValue < 0) badgeValue = 0;
  applicationServices.action?.getBrowserApi().setBadgeText({ text: badgeValue.toString() });
  applicationServices.action?.getBrowserApi().setBadgeBackgroundColor({ color: "#0000FF" });

  if (sendResponse) {
    sendResponse({ success: true });
  }
}

export async function handleCancelTask(
  applicationServices: ApplicationServices,
  message: any,
  sendResponse?: (resp: any) => void,
): Promise<void> {
  try {
    const taskId = message?.inputs?.taskId;
    if (!taskId) {
      sendResponse?.({ success: false, error: "Missing taskId" });
      return;
    }

    const { taskList: storageTaskList } = await applicationServices.storage?.getStorageCachedByKeys(["taskList"]) || {};
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

    await applicationServices.storage?.setStorageCached({ taskList: storageTaskList });

    // Ask the content script (if any) to stop this task loop immediately.
    if (typeof task.tabId === "number" && task.tabId > 0) {
      try {
        applicationServices.tab?.getBrowserApi().sendMessage(
          task.tabId,
          { type: "STOP_TASK", taskId },
          () => {
            void applicationServices.runtime?.getBrowserApi().getRuntimeLastError();
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
  applicationServices: ApplicationServices,
  message: Message,
  sendResponse?: (resp: any) => void,
): Promise<void> {
  const { url, fileName = "extImgDownload.jpg" } = message.inputs;
  await applicationServices.download?.getBrowserApi().download({
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
  applicationServices: ApplicationServices,
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse?: (resp: any) => void,
): Promise<void> {
  const {
    settings: storageSettings,
    taskList: storageTaskList,
    user: storageUser
  } = await applicationServices.storage?.getStorageCachedByKeys(["settings", "taskList", "user"]) || {};
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

    const currentSettings: any = localUpdating?.settings ?? storageSettings;
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
    applicationServices.storage?.clearStorageCache();
    await applicationServices.storage?.setStorageCached(localUpdating);
    if (runningTask) {
      bgState.injectedTabs.delete(runningTask.tabId);
    }
  }

  if (sendResponse) {
    sendResponse({ success: true });
  }
}

export async function handleChangeTabUrl(
  applicationServices: ApplicationServices,
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse?: (resp: any) => void,
) {
  const {
    taskList: storageTaskList,
    user: storageUser
  } = await applicationServices.storage?.getStorageCachedByKeys(["taskList", "user"]) || {};
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

    await applicationServices.storage?.setStorageCached({ taskList: storageTaskList });
    applicationServices.tab?.getBrowserApi().update(
      parseInt(message.inputs.tabId),
      { url: message.inputs.url });
  }
  if (sendResponse) {
    sendResponse({ success: true });
  }
}
