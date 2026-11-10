import { bgState } from "../../state";
import { Task } from "../../types/types";
import { Constants, DefaultValues, State } from "../../utils/constants";
import { generateTaskFromActivity, isTimePassed, isValidArrayAct } from "../../utils/tools";
import { ApplicationServices } from "../../application-services";
import { publishTiktokCachedData } from "../../dataPublishers/publishTiktokCachedData";
import { publishFacebookCachedData } from "../../dataPublishers/publishFacebookCachedData";
import { publishFacebookUserData } from "../../dataPublishers/publishFacebookUserData";
import { publishFacebookJoinedGroupsCachedData } from "../../dataPublishers/publishFacebookJoinedGroups";
import { publishFacebookPendingGroupsCachedData } from "../../dataPublishers/publishFacebookPendingGroup";

export function createAlarmsOnAlarmHandler(applicationServices: ApplicationServices) {
  return (alarm: chrome.alarms.Alarm) => alarmsOnAlarmHandlerInternal(applicationServices, alarm)
}

async function alarmsOnAlarmHandlerInternal(
  applicationServices: ApplicationServices,
  alarm: chrome.alarms.Alarm
) {
  try {
    if (alarm.name === Constants.PROXY_HEALTH_CHECK_ALARM) {
      await applicationServices.proxy?.checkProxyStatus();
      return;
    }

    if (alarm.name === Constants.SEND_FACEBOOK_DATA_ALARM) {
      await publishFacebookCachedData(applicationServices);
      await publishFacebookUserData(applicationServices);
      return;
    }

    if (alarm.name === Constants.SEND_TIKTOK_DATA_ALARM) {
      await publishTiktokCachedData(applicationServices);
      return;
    }

    if (alarm.name === Constants.SYNC_FB_JOINED_GROUPS_ALARM) {
      await applicationServices.sync?.syncFacebookGroups(
        "FETCH_FB_JOINED_GROUPS",
        "cachedFacebookSyncGroupsData",
        () => publishFacebookJoinedGroupsCachedData(applicationServices)
      );
      await applicationServices.sync?.syncFacebookGroups(
        "FETCH_FB_PENDING_GROUPS",
        "cachedFacebookSyncPendingGroupsData",
        () => publishFacebookPendingGroupsCachedData(applicationServices)
      );
      return;
    }

    if (alarm.name === Constants.SEND_FB_JOINED_GROUPS_ALARM) {
      await publishFacebookJoinedGroupsCachedData(applicationServices);
      return;
    }

    if (alarm.name === Constants.SEND_FB_PENDING_GROUPS_ALARM) {
      await publishFacebookPendingGroupsCachedData(applicationServices);
      return;
    }

    const keys = ["settings", "activities", "taskList", "user", "automationByUser"];
    const {
      settings: storageSettings,
      activities: storageActivities,
      taskList: storageTaskList,
      user: storageUser,
      automationByUser: automationByUser,
    } = await applicationServices.storage?.getStorageCachedByKeys(keys) || {};

    if (alarm.name === "periodicCheck") {
      try { await applicationServices.extension?.checkExtensionUpdateAndNotify(); } catch { }

      if (!storageUser) {
        return;
      }

      console.log(new Date().toLocaleTimeString(), "Performing periodic check.. .", bgState.__periodicServerCheckCount++);

      // [LOCAL] API reporter
      let scheduledActivities = null;
      const actArr = await applicationServices.schedule?.fetchScheduledActivities(storageUser || DefaultValues.SETTINGS_DATA);

      // Priority: EXTERNAL > LOCAL > CACHED > DEFAULT
      if (isValidArrayAct(actArr)) {
        scheduledActivities = actArr;
      } else if (isValidArrayAct(storageActivities)) {
        scheduledActivities = storageActivities;
      } else {
        scheduledActivities = DefaultValues.SCHEDULED_TASK_DATA;
        console.log("Using SCHEDULED_TASK_DATA (no cached data available)");
      }

      await applicationServices.schedule?.handleUpdateScheduleActivities(scheduledActivities);
    }

    if (alarm.name.includes("scheduleTask") && automationByUser === true) {
      if (!storageSettings?.activatingAutomation) {
        return;
      }

      const [_, activityId] = alarm?.name?.split("_");
      const activity = storageActivities?.find((t) => t.id === activityId);
      if (!activity) {
        void applicationServices.alarm?.getBrowserApi().clear(alarm.name);
        return;
      }

      // Check if task is already assigned (for alarm type), avoid duplicate
      if (activity.scheduleType === "alarm") {
        const assignedTask = (storageTaskList || []).find((task: any) => task.activityId === activity.id);
        if (assignedTask) return;
      }

      const [_startTime, _duration, startPeriod, endPeriod] = activity?.scheduleTime?.split("|");
      // Default to full day if not specified: 00:00:00 to 23:59:59
      const endPeriodVal = endPeriod ? endPeriod : storageSettings?.scheduleEndTime || "23:59:59";
      const startPeriodVal = startPeriod ? startPeriod : storageSettings?.scheduleStartTime || "00:00:00";
      if (isTimePassed(endPeriodVal)) {
        console.log(new Date().toLocaleTimeString(), `Task already passed the end time (${endPeriodVal})`);
        return;
      }
      if (!isTimePassed(startPeriodVal)) {
        console.log(new Date().toLocaleTimeString(), `Task have not yet passed the start time (${startPeriodVal})`);
        return;
      }

      console.log(new Date().toLocaleTimeString(), `Task time is valid - creating task for ${activity.name}`);

      let activeTabId = null;
      const allActiveTabs = await applicationServices.tab?.getBrowserApi().query({ active: true });
      const activeFacebook = allActiveTabs?.find((tab) => tab?.id && tab?.url && Constants.SUPPORTED_PLATFORM_URL_PATTERNS.facebook.test(tab.url));
      if (activeFacebook?.id) activeTabId = activeFacebook.id;

      if (!activeTabId) {
        const allFacebookTabs = await applicationServices.tab?.getBrowserApi().query({ url: "*://*.facebook.com/*" });
        activeTabId = allFacebookTabs?.[0]?.id ?? null;
      }

      if (!activeTabId) {
        console.warn("[SCHEDULE CHECK] Active tab is not a Facebook page — skipping activity:", activity.name);
        return;
      }

      const automationTabIds = [activeTabId];
      console.log(`[SCHEDULE CHECK] Task will run on active Facebook tab: ${activeTabId}`);

      // ---- Serialize from here so concurrent alarm handlers don't race ----
      const acquireLock = bgState.__scheduleTaskLock;
      let releaseLock!: () => void;
      bgState.__scheduleTaskLock = new Promise<void>((resolve) => { releaseLock = resolve });
      try {
        await acquireLock;

        // Re-read taskList directly from storage (bypass cache) so we always
        // see any write performed by a concurrent alarm handler that just finished.
        const { taskList: freshTaskListRaw } = await applicationServices.storage?.getStorageCachedByKeys(["taskList"]) || {};
        const taskList: Task[] | any = freshTaskListRaw || [];

        for (const tabId of automationTabIds) {
          const task = generateTaskFromActivity(activity, tabId);

          // Check for an existing running/pending task on THIS specific tab.
          const lastTask: Task | null = [...taskList].reverse().find((t: Task) => t.tabId === tabId) ?? null;
          if (lastTask && [State.TaskState.RUNNING, State.TaskState.PENDING].includes(lastTask.state)) {
            if (lastTask.priority > task.priority) {
              continue;
            }

            lastTask.state = State.TaskState.CANCELED;
            lastTask.result = "Canceled. Reason: Higher or equal priority task replaced."
            applicationServices.tab?.getBrowserApi().sendMessage(
              lastTask.tabId,
              { type: "STOP_TASK", taskId: lastTask.taskId },
              () => { void applicationServices.runtime?.getBrowserApi().getRuntimeLastError(); },
            );
          }

          // Remove the last task if the task list exceeds the maximum length
          taskList.push(task);
          if (taskList.length > Constants.MAX_TASK_LIST_LENGTH) taskList.shift();

          bgState.injectedTabs.delete(tabId);
          await applicationServices.tab?.getBrowserApi().safeSendMessage(tabId, task);
        }

        // Invalidate cache before writing so subsequent reads get fresh data.
        applicationServices.storage?.clearStorageCache();
        applicationServices.storage?.setStorageCached({ taskList });
      } finally {
        releaseLock();
      }
    }

    if (alarm.name === Constants.SETTINGS_SYNC_ALARM) {
      await applicationServices.sync?.handleSyncExtensionInfo();
      return;
    }

    if (alarm.name === "reset") {
      console.log(new Date().toLocaleTimeString(), "Performing reset task...");
      bgState.__periodicServerCheckCount = 0;
      await applicationServices.storage?.setStorageCached({ activities: [], taskList: [] });
    }
  } catch (error) {
    console.warn("[ERROR ALARM] error:", error);
  }
}
