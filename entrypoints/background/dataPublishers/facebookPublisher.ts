import * as services from "../services";
import * as helpers from "../utils/helpers";
import { bgState } from "../state";
import { _runKafkaPublish } from "./kafkaPublisher";
import { FacebookPostData } from "@/entrypoints/background/utils/parsers/types";
import { PendingUserInfo, UserInfoPublishStatus } from "../types/types";
import { PublishFacebookUserInfoOptions } from "../types/handle";
import { Constants } from "../utils/constants";

export async function sendFacebookCachedData(): Promise<void> {
  return _runKafkaPublish({
    platform: "facebook",
    retryAlarm: Constants.SEND_FACEBOOK_DATA_ALARM,
    logTag: "[sendFacebookCachedData]",

    resolveTopics(settings) {
      return {};
    },

    async publishPayloads(ctx) {
      const { settings, tenantObjs, publish, incrementBadge } = ctx;
      const { facebookTopic } = settings;

      if (!facebookTopic) {
        console.warn(
          this.logTag,
          "topics missing or invalid — skip publish",
          facebookTopic,
        );
        return;
      }

      // Append tenants info
      let postCount = 0;
      for (const rawRecord of bgState.cachedFacebookData) {
        const record = rawRecord as FacebookPostData;
        if (!record.entry_rowkey) {
          continue;
        }

        if (
          ["post", "profile", "photo", "comment", "joinedgroup"].includes(
            record?.docType?.toLowerCase(),
          )
        ) {
          postCount++;
          record._tenants = tenantObjs;
          record.tenant_ids = tenantObjs.map(
            (t: any) => t.id,
          );
        }
      }

      // Filtered all data if focus is private, otherwise send all data
      let treatedFacebookData = [];
      if (settings.focus === "private") {
        console.log("[sendFacebookCachedData] Focus is private, filtering data to only include private group posts and their related photos");


        const isPrivateGroupPost = (e: any) => e?.owner_type === "private_group" && e?.docType?.toLowerCase() === "post";
        const filteredEntryRowkeys = bgState.cachedFacebookData
          .filter(isPrivateGroupPost)
          .map((e: any) => e.entry_rowkey);

        treatedFacebookData = bgState.cachedFacebookData.filter((e: any) => {
          if (e?.docType?.toLowerCase() === "post") {
            return isPrivateGroupPost(e);
          }
          if (e?.docType?.toLowerCase() === "photo") {
            return filteredEntryRowkeys.includes(e.entry_rowkey);
          }

          return true;
        });
      } else {
        treatedFacebookData = bgState.cachedFacebookData;
      }

      const hasUserPending = typeof bgState.cachedFacebookUserInfoToPublish === "string" && bgState.cachedFacebookUserInfoToPublish.length > 0;
      if (treatedFacebookData.length === 0 && !hasUserPending) return;

      // Sending task
      if (treatedFacebookData.length) {
        await publish(facebookTopic, treatedFacebookData, true);
        console.log(new Date().toLocaleTimeString(), "[Facebook Post] Sent successfully!");
        await incrementBadge(postCount);

        // Clear cached data after successful publish
        bgState.cachedFacebookData = [];
        treatedFacebookData = [];
        try {
          await services.syncServices.handleSyncExtensionInfo(true);
        } catch (e) {
          console.warn("[sendFacebookCachedData] handleSyncExtensionInfo failed:", e);
        }
      }
    }
  })
}

export async function sendFacebookUserData(): Promise<void> {
  return _runKafkaPublish({
    platform: "facebook",
    retryAlarm: Constants.SEND_FACEBOOK_DATA_ALARM,
    logTag: "[sendFacebookUserData]",

    resolveTopics(settings) {
      return {};
    },

    async publishPayloads(ctx) {
      const { settings, tenantObjs, publish, incrementBadge } = ctx;
      const { facebookTopic } = settings;

      if (!facebookTopic) {
        console.warn(this.logTag, "topics missing or invalid — skip publish", facebookTopic);
        return;
      }

      const hasUserPending = typeof bgState.cachedFacebookUserInfoToPublish === "string" && bgState.cachedFacebookUserInfoToPublish.length > 0;
      if (!hasUserPending) {
        return;
      }

      let userPayload: any = null;
      try {
        userPayload = JSON.parse(String(bgState.cachedFacebookUserInfoToPublish));
      } catch {
        console.warn(this.logTag, "userInfo pending but payload is invalid JSON — skip user publish");
        return;
      }

      userPayload._tenants = tenantObjs;
      userPayload.tenant_ids = tenantObjs.map((t: any) => t.id);
      userPayload.entry_rowkey = userPayload.id;
      userPayload.platform = "facebook";
      userPayload.crawler_system = "extension";
      await publish(facebookTopic, [userPayload], false);
      console.log(new Date().toLocaleTimeString(), "[User] Sent successfully!");

      try {
        await incrementBadge(1);
      } catch (e) {
        console.warn(this.logTag, "failed to update badge for userInfo:", e);
      }
      bgState.cachedFacebookUserInfoToPublish = null;

    },
  });
}

export async function saveFacebookGroupData(): Promise<void> {
  let settings: any = null;
  try {
    const runtimeReq: any = await services.storageServices.getStorageCachedByKeys(["settings"]);
    settings = runtimeReq?.settings || null;
  } catch (error) {
    console.log("[Error]", "Cannot get settings:", error);
    return;
  }
  const fbGUrl: string = settings?.archive?.fbGUrl ?? "";
  const currentJoinedGroups: { id: string; data: string }[] = [];
  if (fbGUrl) {
    currentJoinedGroups.push(
      ...fbGUrl
        .split(",")
        .filter((e: string) => e)
        .map((e: string) => ({ id: e.split("|")[0], data: e })),
    );
  }

  const newJoinedGroups: string[] = [];
  for (const newGroupUrl of bgState.cachedFacebookJoinedGroupsData) {
    const existingUrl = currentJoinedGroups.find((e: { id: string; data: string }) => e.id === newGroupUrl.id);
    if (existingUrl) {
      continue;
    }

    // treat data
    const newGUType = newGroupUrl.type === "public" ? "1" : "0"; // public: 1, private: 0
    const newGU: string = `${newGroupUrl.id}|${newGUType}|-1`;
    newJoinedGroups.push(newGU);
  }

  const updatedArchiveGroups: string[] = [
    ...currentJoinedGroups.map((e: { id: string; data: string }) => e.data),
    ...newJoinedGroups,
  ];
  await services.storageServices.handleUpdateArchive({ inputs: { updateArchive: { fbGUrl: updatedArchiveGroups.join(",") } } });
  bgState.cachedFacebookJoinedGroupsData = [];
}

export async function saveFacebookUserData(): Promise<void> {
  if (!bgState.cachedFacebookUserInfo) return;
  await services.storageServices.handleUpdateArchive({ inputs: { updateArchive: bgState.cachedFacebookUserInfo } });
  bgState.cachedFacebookUserInfo = null;
}

export async function publishFacebookUserInfo(options: PublishFacebookUserInfoOptions = {})
  : Promise<{
    ok: boolean;
    error?: string;
    userInfoPublishStatus?: UserInfoPublishStatus;
    pendingUserInfoList?: PendingUserInfo[];
    pendingUserInfo?: PendingUserInfo | null;
  }> {
  const {
    overrideRaw = "",
    overrideParsed,
    overrideId,
    overrideTs,
    waitForDescription = true,
  } = options;

  let { pendingUserInfo, pendingUserInfoList } = await services.storageServices.getStorageCachedByKeys(["pendingUserInfo", "pendingUserInfoList"]);

  let candidateParsed = overrideParsed || (overrideRaw ? undefined : pendingUserInfo?.parsed);
  if (!candidateParsed && overrideRaw) {
    try {
      candidateParsed = JSON.parse(overrideRaw);
    } catch {
      candidateParsed = undefined;
    }
  }
  if (!candidateParsed && pendingUserInfo?.raw) {
    try {
      candidateParsed = JSON.parse(pendingUserInfo.raw);
    } catch {
      candidateParsed = pendingUserInfo?.parsed;
    }
  }

  const filtered = helpers.userInfo.filterUserProfilePayload(candidateParsed);
  if (!filtered) {
    const failStatus: UserInfoPublishStatus = {
      status: "failed",
      ts: Date.now(),
      message: "User profile data is missing required fields (id, name).",
    };
    await services.storageServices.setStorageCached({ userInfoPublishStatus: failStatus });
    return { ok: false, error: failStatus.message, userInfoPublishStatus: failStatus };
  }

  let profileToPublish = filtered;

  const shouldWaitForDescription = waitForDescription && !helpers.userInfo.hasUserDescription(profileToPublish);
  if (shouldWaitForDescription) {
    await services.storageServices.setStorageCached({
      userInfoPublishStatus: {
        status: "pending",
        ts: Date.now(),
        message: "Waiting for profile description...",
      },
    });

    await helpers.userInfo.waitForUserInfoDescription(Constants.USERINFO_DESCRIPTION_WAIT_MS);
    const refreshed = (await services.storageServices.getStorageCachedByKeys(["pendingUserInfo"])) || {};
    pendingUserInfo = refreshed.pendingUserInfo || pendingUserInfo;
    const refreshedParsed =
      pendingUserInfo?.parsed ||
      (() => {
        try {
          return pendingUserInfo?.raw ? JSON.parse(pendingUserInfo.raw) : undefined;
        } catch {
          return undefined;
        }
      })();
    profileToPublish = helpers.userInfo.filterUserProfilePayload(refreshedParsed) || profileToPublish;
  }

  if (!helpers.userInfo.isUserProfileCollectReady(profileToPublish)) {
    const missingBeforeWait = helpers.userInfo.getMissingUserProfileCollectFields(profileToPublish);
    await services.storageServices.setStorageCached({
      userInfoPublishStatus: {
        status: "pending",
        ts: Date.now(),
        message: `Waiting for profile fields: ${missingBeforeWait.join(", ")}`,
      },
    });

    const afterWait = await helpers.userInfo.waitForUserInfoCollectReady(Constants.USERINFO_COLLECT_WAIT_MS);
    if (afterWait && helpers.userInfo.isUserProfileCollectReady(afterWait)) {
      profileToPublish = afterWait;
      const refreshed = (await services.storageServices.getStorageCachedByKeys(["pendingUserInfo"])) || {};
      pendingUserInfo = refreshed.pendingUserInfo || pendingUserInfo;
    }
  }

  if (!helpers.userInfo.isUserProfileCollectReady(profileToPublish)) {
    const missing = helpers.userInfo.getMissingUserProfileCollectFields(profileToPublish);
    const pendingStatus: UserInfoPublishStatus = {
      status: "pending",
      ts: Date.now(),
      message: `Waiting for profile fields: ${missing.join(", ")}`,
    };
    await services.storageServices.setStorageCached({ userInfoPublishStatus: pendingStatus });
    return {
      ok: false,
      error: pendingStatus.message,
      userInfoPublishStatus: pendingStatus,
      pendingUserInfoList,
      pendingUserInfo,
    };
  }

  bgState.cachedFacebookUserInfoToPublish = JSON.stringify(profileToPublish);

  await services.storageServices.setStorageCached({
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

    const list = Array.isArray(pendingUserInfoList) ? pendingUserInfoList : [];
    const removeId = overrideId || pendingUserInfo?.id || undefined;
    const removeTs =
      typeof overrideTs === "number"
        ? overrideTs
        : pendingUserInfo?.ts;
    const nextList = helpers.userInfo.removePendingUserInfo(list, {
      id: removeId,
      ts: typeof removeTs === "number" ? removeTs : undefined,
    });
    const nextPending = nextList.length ? nextList[nextList.length - 1] : null;

    await services.storageServices.setStorageCached({
      pendingUserInfo: nextPending,
      pendingUserInfoList: nextList,
      userInfoPublishStatus: status,
    });

    return {
      ok: true,
      userInfoPublishStatus: status,
      pendingUserInfoList: nextList,
      pendingUserInfo: nextPending,
    };
  }

  if (bgState.cachedFacebookUserInfoToPublish) {
    try {
      const parsed = JSON.parse(bgState.cachedFacebookUserInfoToPublish);
      const filtered = helpers.userInfo.filterUserProfilePayload(parsed);
      if (filtered && !helpers.userInfo.isUserProfileCollectReady(filtered)) {
        const missing = helpers.userInfo.getMissingUserProfileCollectFields(filtered);
        bgState.cachedFacebookUserInfoToPublish = null;
        const pendingStatus: UserInfoPublishStatus = {
          status: "pending",
          ts: Date.now(),
          message: `Waiting for profile fields: ${missing.join(", ")}`,
        };
        await services.storageServices.setStorageCached({ userInfoPublishStatus: pendingStatus });
        return {
          ok: false,
          error: pendingStatus.message,
          userInfoPublishStatus: pendingStatus,
          pendingUserInfoList,
          pendingUserInfo,
        };
      }
    } catch {
      // fall through to generic failure
    }
  }

  const failStatus: UserInfoPublishStatus = {
    status: "failed",
    ts: Date.now(),
    message: "User data not published. Check topics/config.",
  };

  bgState.cachedFacebookUserInfoToPublish = null;

  await services.storageServices.setStorageCached({ userInfoPublishStatus: failStatus });
  return {
    ok: false,
    error: failStatus.message,
    userInfoPublishStatus: failStatus,
  };
}

export async function sendFacebookJoinedGroupsCachedData(): Promise<void> {
  return _runKafkaPublish({
    platform: "facebook",
    retryAlarm: Constants.SEND_FB_JOINED_GROUPS_ALARM,
    logTag: "[sendFacebookJoinedGroupsCachedData]",

    resolveTopics(settings) {
      return {};
    },

    async publishPayloads(ctx) {
      const { tenantObjs, publish } = ctx;

      const recordCount = bgState.cachedFacebookSyncGroupsData.length;
      if (recordCount === 0) return;

      const recordsToPublish = bgState.cachedFacebookSyncGroupsData.map((record) => {
        return {
          ...record,
          _tenants: tenantObjs,
          tenant_ids: tenantObjs.map((t: any) => t.id),
        };
      });

      // Batch publish to avoid heavy single-request payloads for large group lists
      const CHUNK_SIZE = 50;
      const totalChunks = Math.ceil(recordsToPublish.length / CHUNK_SIZE);
      for (let i = 0; i < totalChunks; i++) {
        const chunk = recordsToPublish.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        await publish("facebook-joined-groups-crawled-data", chunk, true);
        console.log(
          new Date().toLocaleTimeString(),
          `[Facebook Sync Groups] Sent chunk ${i + 1}/${totalChunks} (${chunk.length} groups)`,
        );
      }

      console.log(
        new Date().toLocaleTimeString(),
        `[Facebook Sync Groups] All ${recordCount} groups sent in ${totalChunks} batch(es).`,
      );

      bgState.cachedFacebookSyncGroupsData = [];
    },
  });
}

export async function sendFacebookPendingGroupsCachedData(): Promise<void> {
  return _runKafkaPublish({
    platform: "facebook",
    retryAlarm: Constants.SEND_FB_PENDING_GROUPS_ALARM,
    logTag: "[sendFacebookPendingGroupsCachedData]",

    resolveTopics(settings) {
      return {};
    },

    async publishPayloads(ctx) {
      const { tenantObjs, publish } = ctx;

      const recordCount = bgState.cachedFacebookSyncPendingGroupsData.length;
      if (recordCount === 0) return;

      const recordsToPublish = bgState.cachedFacebookSyncPendingGroupsData.map((record) => {
        return {
          ...record,
          _tenants: tenantObjs,
          tenant_ids: tenantObjs.map((t: any) => t.id),
        };
      });

      // Batch publish to avoid heavy single-request payloads for large group lists
      const CHUNK_SIZE = 50;
      const totalChunks = Math.ceil(recordsToPublish.length / CHUNK_SIZE);
      for (let i = 0; i < totalChunks; i++) {
        const chunk = recordsToPublish.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        await publish("facebook-joined-groups-crawled-data", chunk, true);
        console.log(
          new Date().toLocaleTimeString(),
          `[Facebook Pending Groups] Sent chunk ${i + 1}/${totalChunks} (${chunk.length} groups)`,
        );
      }

      console.log(
        new Date().toLocaleTimeString(),
        `[Facebook Pending Groups] All ${recordCount} groups sent in ${totalChunks} batch(es).`,
      );

      bgState.cachedFacebookSyncPendingGroupsData = [];
    },
  });
}