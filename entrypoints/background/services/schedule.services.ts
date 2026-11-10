import { User } from "@/entrypoints/sidepanel/types/types";
import { Activity } from "../types/types";
import { parseDelayAndPeriodInMinutes } from "../utils/tools";
import { AlarmService } from "./alarm.services";
import { StorageService } from "./storage.services";
import { getExtensionConfigInfo } from "../infrastructure/api/source-member.api";

export class ScheduleService {
  constructor(
    private storageService: StorageService,
    private alarmService: AlarmService
  ) { }

  async handleUpdateScheduleActivities(scheduledActivities: Activity[]): Promise<void> {
    if (!Array.isArray(scheduledActivities)) return;

    const { taskList } = await this.storageService.getStorageCachedByKeys(["taskList"]);
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
        const alarm = await this.alarmService.getBrowserApi().get(alarmName);
        if (alarm) {
          // If the alarm already has the correct period, leave it alone.
          if (Math.abs((alarm.periodInMinutes ?? 0) - (scheduledTime.periodInMinutes ?? 0)) < 1) {
            continue;
          }
          // Period mismatch — clear the stale alarm so it gets recreated below.
          await this.alarmService.getBrowserApi().clear(alarmName);
          // When recreating after a mismatch, delay = 1 period so the first fire is on schedule.
          scheduledTime = {
            ...scheduledTime,
            delayInMinutes: scheduledTime.periodInMinutes,
          };
        }
      }

      if (activity.scheduleType === "alarm" && activity.type === "auto-scripts") {
        alarmName = "scheduleTask_" + activity.id;
        let alarm = await this.alarmService.getBrowserApi().get(alarmName);
        if (alarm) continue;

        let assignedTask = taskList?.find((task) => task.activityId === activity.id);
        if (assignedTask) continue;

        scheduledTime = parseDelayAndPeriodInMinutes(activity.scheduleTime);
      }

      if (activity.scheduleType === "system-scripts") {
        alarmName = activity?.name?.toLowerCase();
        if (!alarmName) continue;
        let alarm = await this.alarmService.getBrowserApi().get(alarmName);
        if (alarm) continue;

        scheduledTime = parseDelayAndPeriodInMinutes(activity.scheduleTime);
      }

      if (alarmName && scheduledTime) {
        this.alarmService.getBrowserApi().create(alarmName, scheduledTime);
        console.log("Alarm created:", alarmName);
      }
    }

    await this.storageService.setStorageCached({
      activities: activities,
    });
  }

  async fetchScheduledActivities(settings: User): Promise<Activity[] | any> {
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
}