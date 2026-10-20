import { chromeApi } from "../infrastructure/chrome-api/chrome-api";
import { Activity } from "../types/types";
import { parseDelayAndPeriodInMinutes } from "../helpers/tools";
import { StorageService } from "./storageServices";
import { getExtensionConfigInfo } from "../infrastructure/api/source-member.api";
import { User } from "@/entrypoints/sidepanel/types/types";

export async function handleUpdateScheduleActivities(scheduledActivities: Activity[]): Promise<void> {
  if (!Array.isArray(scheduledActivities)) return;

  const { taskList } = await StorageService.getInstance().getStorageCachedByKeys(["taskList"]);
  const activities = [];
  for (const activity of scheduledActivities) {
    let alarmName = null;
    let scheduledTime = null;

    // Normalize snake_case fields from API response, but preserve existing camelCase values
    activity.scheduleTime = activity.schedule_time || activity.scheduleTime || "";
    activity.scheduleType = activity.schedule_type || activity.scheduleType || "";
    delete activity.schedule_time;
    delete activity.schedule_type;

    activities.push(activity);

    if (
      activity.scheduleType === "period" &&
      activity.type === "auto-scripts"
    ) {
      alarmName = "scheduleTask_" + activity.id;
      scheduledTime = parseDelayAndPeriodInMinutes(activity.scheduleTime);
      const alarm = await chromeApi.alarms.get(alarmName);
      if (alarm) {
        // If the alarm already has the correct period, leave it alone.
        if (Math.abs((alarm.periodInMinutes ?? 0) - (scheduledTime.periodInMinutes ?? 0)) < 1) {
          continue;
        }
        // Period mismatch — clear the stale alarm so it gets recreated below.
        await chromeApi.alarms.clear(alarmName);
        // When recreating after a mismatch, delay = 1 period so the first fire is on schedule.
        scheduledTime = {
          ...scheduledTime,
          delayInMinutes: scheduledTime.periodInMinutes,
        };
      }
    }

    if (activity.scheduleType === "alarm" && activity.type === "auto-scripts") {
      alarmName = "scheduleTask_" + activity.id;
      let alarm = await chromeApi.alarms.get(alarmName);
      if (alarm) continue;

      let assignedTask = taskList?.find((task) => task.activityId === activity.id);
      if (assignedTask) continue;

      scheduledTime = parseDelayAndPeriodInMinutes(activity.scheduleTime);
    }

    if (activity.scheduleType === "system-scripts") {
      alarmName = activity?.name?.toLowerCase();
      if (!alarmName) continue;
      let alarm = await chromeApi.alarms.get(alarmName);
      if (alarm) continue;

      scheduledTime = parseDelayAndPeriodInMinutes(activity.scheduleTime);
    }

    if (alarmName && scheduledTime) {
      chromeApi.alarms.create(alarmName, scheduledTime);
      console.log("Alarm created:", alarmName);
    }
  }

  await StorageService.getInstance().setStorageCached({
    activities: activities,
  });
}

export async function fetchScheduledActivities(settings: User): Promise<Activity[] | any> {
  try {
    const { extension_session } = settings;
    if (!extension_session?.extension_config_id) return;

    const fetchReq = await getExtensionConfigInfo(
      extension_session.extension_config_id,
      {
        include: [{ relation: "extension_activities" }],
      },
    );

    const jsonData = fetchReq.extension_activities;
    console.log(
      "[fetchScheduledActivities] Got JSON data:",
      Array.isArray(jsonData)
        ? `${jsonData.length} activities`
        : typeof jsonData,
    );

    const data = jsonData ? jsonData : [];
    return data;
  } catch (error: any) {
    console.error(
      "[fetchScheduledActivities] Exception:",
      error.message,
      error.stack,
    );
    return [];
  }
}
