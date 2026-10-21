import { bgState } from "../state";
import { Constants } from "../utils/constants";
import { FacebookGroupJoinedData } from "@/entrypoints/background/utils/parsers/types";
import {
  sendFacebookJoinedGroupsCachedData,
  sendFacebookPendingGroupsCachedData,
} from "../dataPublishers/facebookPublisher";
import * as helpers from "../utils/helpers";
import { getStorageCachedByKeys } from "./storageServices";
import { chromeApi } from "../infrastructure/chrome-api/chrome-api";

export async function ensureJoinedGroupsAlarmSchedule(targetScheduleTime?: number): Promise<void> {
  let periodMin = targetScheduleTime;
  if (typeof periodMin !== "number" || periodMin <= 0) {
    const { joinedGroupScheduleTime } = await getStorageCachedByKeys(["joinedGroupScheduleTime"]);
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
