import { bgState, PROXY_HEALTH_CHECK_ALARM, SEND_FACEBOOK_DATA_ALARM, SEND_TIKTOK_DATA_ALARM, SETTINGS_SYNC_ALARM, MAX_TASK_LIST_LENGTH, SYNC_FB_JOINED_GROUPS_ALARM, SEND_FB_JOINED_GROUPS_ALARM, SEND_FB_PENDING_GROUPS_ALARM } from "../../state";
import { Task } from "../../types/types";
import { DEFAULT_SCHEDULED_DATA, DEFAULT_SETTINGS_JSON, State } from "../../helpers/constants";
import { generateTaskFromActivity, isTimePassed, isValidArrayAct } from "../../helpers/tools";
import { safeTabsSendMessage } from "../../helpers/tabUtils";
import { getActiveFacebookTabId } from "../../helpers/tabUtils";
import { sendFacebookCachedData, sendFacebookUserData, sendFacebookJoinedGroupsCachedData, sendFacebookPendingGroupsCachedData } from "../../dataPublishers/facebookPublisher";
import { sendTiktokCachedData } from "../../dataPublishers/tiktokPublisher";
import { checkExtensionUpdateAndNotify } from "../../updateChecker";
import { handleSyncExtensionInfo } from "../../services/syncService";
import { handleProxyHealthCheck } from "../../services/proxyServices";
import { chromeApi } from "../../infrastructure/chrome-api/chrome-api";
import { handleUpdateScheduleActivities, fetchScheduledActivities } from "../../services/scheduleService";
import { syncFacebookJoinedGroups, syncFacebookPendingGroups } from "../../services/fbGroupSyncService";
import { getStorageCachedByKeys, setStorageCached, clearStorageCache } from "../../services/storageServices";

export async function alarmsOnAlarmHandler(alarm: chrome.alarms.Alarm) {
  try {
    if (alarm.name === PROXY_HEALTH_CHECK_ALARM) {
      await handleProxyHealthCheck();
      return;
    }

    if (alarm.name === SEND_FACEBOOK_DATA_ALARM) {
      await sendFacebookCachedData();
      await sendFacebookUserData();
      return;
    }

    if (alarm.name === SEND_TIKTOK_DATA_ALARM) {
      await sendTiktokCachedData();
      return;
    }

    if (alarm.name === SYNC_FB_JOINED_GROUPS_ALARM) {
      await syncFacebookJoinedGroups();
      await syncFacebookPendingGroups();
      return;
    }

    if (alarm.name === SEND_FB_JOINED_GROUPS_ALARM) {
      await sendFacebookJoinedGroupsCachedData();
      return;
    }

    if (alarm.name === SEND_FB_PENDING_GROUPS_ALARM) {
      await sendFacebookPendingGroupsCachedData();
      return;
    }

    const keys = [
      "settings",
      "activities",
      "taskList",
      "user",
      "automationByUser",
    ];
    const {
      settings: storageSettings,
      activities: storageActivities,
      taskList: storageTaskList,
      user: storageUser,
      automationByUser: automationByUser,
    } = await getStorageCachedByKeys(keys);

    if (alarm.name === "periodicCheck") {
      try {
        await checkExtensionUpdateAndNotify();
      } catch { }

      if (!storageUser) {
        return;
      }

      console.log(
        new Date().toLocaleTimeString(),
        "Performing periodic check.. .",
        bgState.__periodicServerCheckCount++,
      );

      // [LOCAL] API reporter
      let scheduledActivities = null;
      const actArr = await fetchScheduledActivities(
        storageUser || DEFAULT_SETTINGS_JSON,
      );
      // Priority: EXTERNAL > LOCAL > CACHED > DEFAULT
      if (isValidArrayAct(actArr)) {
        scheduledActivities = actArr;
      } else if (isValidArrayAct(storageActivities)) {
        scheduledActivities = storageActivities;
      } else {
        scheduledActivities = DEFAULT_SCHEDULED_DATA;
        console.log("Using DEFAULT_SCHEDULED_DATA (no cached data available)");
      }

      await handleUpdateScheduleActivities(scheduledActivities);
    }

    if (alarm.name === "reset") {
      console.log(new Date().toLocaleTimeString(), "Performing reset task...");
      bgState.__periodicServerCheckCount = 0;
      await setStorageCached({ activities: [], taskList: [] });
    }

    if (alarm.name.includes("scheduleTask") && automationByUser === true) {
      if (!storageSettings?.activatingAutomation) {
        return;
      }

      const [_, activityId] = alarm?.name?.split("_");
      const activity = storageActivities?.find((t) => t.id === activityId);
      if (!activity) {
        chromeApi.alarms.clear(alarm.name, (wasCleared) => { });
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

      console.log(
        new Date().toLocaleTimeString(),
        `[SCHEDULE CHECK] Activity: ${activity.name}, Start: ${startPeriodVal}, End: ${endPeriodVal}`,
      );

      if (isTimePassed(endPeriodVal)) {
        console.log(
          new Date().toLocaleTimeString(),
          `Task already passed the end time (${endPeriodVal})`,
        );
        return;
      }

      if (!isTimePassed(startPeriodVal)) {
        console.log(
          new Date().toLocaleTimeString(),
          `Task have not yet passed the start time (${startPeriodVal})`,
        );
        return;
      }

      console.log(
        new Date().toLocaleTimeString(),
        `Task time is valid - creating task for ${activity.name}`,
      );

      const activeTabId = await getActiveFacebookTabId();
      if (!activeTabId) {
        console.warn(
          "[SCHEDULE CHECK] Active tab is not a Facebook page — skipping activity:",
          activity.name,
        );
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
        const { taskList: freshTaskListRaw } = await getStorageCachedByKeys(["taskList"]);
        const taskList: Task[] | any = freshTaskListRaw || [];

        for (const tabId of automationTabIds) {
          const task = generateTaskFromActivity(activity, tabId);

          // Check for an existing running/pending task on THIS specific tab.
          const lastTask: Task | null = [...taskList].reverse().find((t: Task) => t.tabId === tabId) ?? null;
          if (lastTask && [State.RUNNING, State.PENDING].includes(lastTask.state)) {
            if (lastTask.priority > task.priority) {
              continue;
            }

            lastTask.state = State.CANCELED;
            lastTask.result = "Canceled. Reason: Higher or equal priority task replaced."
            chromeApi.tabs.sendMessage(
              lastTask.tabId,
              { type: "STOP_TASK", taskId: lastTask.taskId },
              () => { void chromeApi.runtime.lastError; },
            );
          }

          // Remove the last task if the task list exceeds the maximum length
          taskList.push(task);
          if (taskList.length > MAX_TASK_LIST_LENGTH) taskList.shift();

          bgState.injectedTabs.delete(tabId);
          await safeTabsSendMessage(tabId, task);
        }

        // Invalidate cache before writing so subsequent reads get fresh data.
        clearStorageCache();
        await setStorageCached({ taskList });
      } finally {
        releaseLock();
      }
    }

    if (alarm.name === SETTINGS_SYNC_ALARM) {
      await handleSyncExtensionInfo();
      return;
    }
  } catch (error) {
    console.warn("[ERROR ALARM] error:", error);
  }
}
