import {
  ParseType,
  FacebookUserFriendData,
  FacebookDataType,
} from "@/entrypoints/background/utils/parsers/types";
import { HandlerContext } from "../../types/handle";
import {
  decodeUnicodeEscapes,
  normalizeFacebookUserInfoMap,
} from "./user-info-map";
import * as services from "../../services";

const FB_FRIEND_FLUSH_IMMEDIATE_LIMIT = 30;
const FB_FRIEND_FLUSH_DEBOUNCE_MS = 10_000;
const FB_USER_NAME_MAP_KEY = "facebook_user_info_map";
const FB_COLLECTION_OWNER_MAP_KEY = "facebook_friend_collection_owner_map";
const FB_PENDING_FRIEND_KEY = "facebook_pending_friend_data";

export type FacebookFriendCollectionOwnerEntry = {
  id: string;
  name?: string;
  list_kind?: string;
  rows?: FacebookUserFriendData[];
};

function isFriendRecord(record: unknown): boolean {
  return (
    !!record &&
    typeof record === "object" &&
    String((record as { docType?: string }).docType || "").toLowerCase() ===
    "friend"
  );
}

function getPrimaryCollectionOwner(
  map: Record<string, FacebookFriendCollectionOwnerEntry>,
): { id: string; name: string } | null {
  const owners = Object.values(map);
  if (!owners.length) return null;
  const last = owners[owners.length - 1];
  if (!last?.id) return null;
  return { id: last.id, name: last.name || "" };
}

function mergePendingFriends(
  existing: FacebookUserFriendData[],
  incoming: FacebookUserFriendData[],
): FacebookUserFriendData[] {
  const byKey = new Map<string, FacebookUserFriendData>();
  for (const row of existing) {
    const key = row.friend_rowkey || `${row.user_id}_${row.friend_id}`;
    if (key) byKey.set(key, row);
  }
  for (const row of incoming) {
    const key = row.friend_rowkey || `${row.user_id}_${row.friend_id}`;
    if (key) byKey.set(key, row);
  }
  return Array.from(byKey.values());
}

function normalizeCollectionOwnerMap(
  raw: Record<string, FacebookFriendCollectionOwnerEntry> | null | undefined,
): Record<string, FacebookFriendCollectionOwnerEntry> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, FacebookFriendCollectionOwnerEntry> = {};
  for (const [collectionId, entry] of Object.entries(raw)) {
    const key = (collectionId || "").trim();
    if (!key || !entry?.id) continue;
    out[key] = {
      id: entry.id,
      name: entry.name || "",
      list_kind: entry.list_kind || "friends",
      rows: Array.isArray(entry.rows) ? [...entry.rows] : [],
    };
  }
  return out;
}

function resolveFriendFromMaps(
  row: FacebookUserFriendData,
  collectionId: string,
  userNameMap: Record<string, string>,
  collectionOwnerMap: Record<string, FacebookFriendCollectionOwnerEntry>,
): FacebookUserFriendData {
  const next = { ...row };
  const owner =
    (collectionId && collectionOwnerMap[collectionId]) ||
    getPrimaryCollectionOwner(collectionOwnerMap);

  if (!next.user_id && owner?.id) {
    next.user_id = owner.id;
  }
  if (!next.user_name && next.user_id) {
    next.user_name =
      userNameMap[next.user_id] || owner?.name || next.user_name || "";
  }
  if (next.user_name) {
    next.user_name = decodeUnicodeEscapes(next.user_name);
  }
  if (next.friend_name) {
    next.friend_name = decodeUnicodeEscapes(next.friend_name);
  }
  return next;
}

function registerCollectionOwner(
  map: Record<string, FacebookFriendCollectionOwnerEntry>,
  collectionId: string,
  userId: string,
  userName: string,
  listKind = "friends",
): void {
  if (!collectionId || !userId) return;
  const prev = map[collectionId];
  map[collectionId] = {
    id: userId,
    name: userName || prev?.name || "",
    list_kind: listKind,
    rows: prev?.rows || [],
  };
}

function appendRowsToKnownCollection(
  map: Record<string, FacebookFriendCollectionOwnerEntry>,
  collectionId: string,
  rows: FacebookUserFriendData[],
): boolean {
  if (!collectionId || !map[collectionId] || !rows.length) return false;
  map[collectionId].rows = mergePendingFriends(
    map[collectionId].rows || [],
    rows,
  );
  return true;
}

function flattenCollectionRows(
  map: Record<string, FacebookFriendCollectionOwnerEntry>,
): FacebookUserFriendData[] {
  let merged: FacebookUserFriendData[] = [];
  for (const entry of Object.values(map)) {
    if (entry.rows?.length) {
      merged = mergePendingFriends(merged, entry.rows);
    }
  }
  return merged;
}

function clearCollectionRowBuffers(
  map: Record<string, FacebookFriendCollectionOwnerEntry>,
): void {
  for (const entry of Object.values(map)) {
    entry.rows = [];
  }
}

export async function clearFacebookFriendStagingState(
  cachedFacebookData: FacebookDataType[],
): Promise<void> {
  const cached = await services.storageServices.getStorageCachedByKeys([
    FB_COLLECTION_OWNER_MAP_KEY,
  ]);
  const collectionOwnerMap = normalizeCollectionOwnerMap(
    cached[FB_COLLECTION_OWNER_MAP_KEY] as Record<
      string,
      FacebookFriendCollectionOwnerEntry
    >,
  );
  clearCollectionRowBuffers(collectionOwnerMap);

  await services.storageServices.setStorageCached({
    [FB_COLLECTION_OWNER_MAP_KEY]: collectionOwnerMap,
    [FB_PENDING_FRIEND_KEY]: [],
  });

  for (let i = cachedFacebookData.length - 1; i >= 0; i--) {
    if (isFriendRecord(cachedFacebookData[i])) {
      cachedFacebookData.splice(i, 1);
    }
  }

  console.log(
    "[FB Friend Trace][clearFacebookFriendStagingState] cleared pending buffer; kept user/collection maps",
  );
}

export function hasFacebookFriendRecordsInQueue(
  records: FacebookDataType[],
): boolean {
  return records.some(isFriendRecord);
}

async function loadPendingFriends(): Promise<FacebookUserFriendData[]> {
  const cached = await services.storageServices.getStorageCachedByKeys([
    FB_PENDING_FRIEND_KEY,
  ]);
  const pending = cached[FB_PENDING_FRIEND_KEY];
  return Array.isArray(pending) ? [...pending] : [];
}

async function savePendingFriends(
  rows: FacebookUserFriendData[],
): Promise<void> {
  await services.storageServices.setStorageCached({
    [FB_PENDING_FRIEND_KEY]: rows,
  });
}

export async function flushFacebookFriendStaging(
  cachedFacebookData: FacebookDataType[],
  sendFacebookCachedData: () => Promise<void>,
): Promise<void> {
  const pending = await loadPendingFriends();
  if (!pending.length) {
    console.log(
      "[FB Friend Trace][flushFacebookFriendStaging] skip: empty pending",
    );
    return;
  }

  console.log(
    "[FB Friend Trace][flushFacebookFriendStaging] pushing",
    pending.length,
    "friend rows",
  );

  await savePendingFriends([]);
  cachedFacebookData.push(...pending);
  await sendFacebookCachedData();
}

function scheduleFacebookFriendFlushInternal(
  ctx: Pick<
    HandlerContext,
    "cachedFacebookData" | "sendFacebookCachedData" | "debounce"
  >,
  pendingCount: number,
): void {
  const { cachedFacebookData, sendFacebookCachedData, debounce } = ctx;

  if (!pendingCount) return;

  const scheduleFlush = () => {
    void flushFacebookFriendStaging(cachedFacebookData, sendFacebookCachedData);
  };

  if (pendingCount >= FB_FRIEND_FLUSH_IMMEDIATE_LIMIT) {
    scheduleFlush();
    return;
  }

  debounce(
    scheduleFlush,
    FB_FRIEND_FLUSH_DEBOUNCE_MS,
    "fb_friend_flush_debounce",
  );
}

export async function refreshPendingFriendsFromUserInfoMap(
  ctx: Pick<
    HandlerContext,
    "cachedFacebookData" | "sendFacebookCachedData" | "debounce"
  >,
): Promise<void> {
  const pending = await loadPendingFriends();
  if (!pending.length) return;

  const cachedMaps = await services.storageServices.getStorageCachedByKeys([
    FB_USER_NAME_MAP_KEY,
    FB_COLLECTION_OWNER_MAP_KEY,
  ]);
  const userNameMap = normalizeFacebookUserInfoMap(
    cachedMaps[FB_USER_NAME_MAP_KEY] as Record<string, string> | undefined,
  );
  const collectionOwnerMap = normalizeCollectionOwnerMap(
    cachedMaps[FB_COLLECTION_OWNER_MAP_KEY] as Record<
      string,
      FacebookFriendCollectionOwnerEntry
    >,
  );

  const refreshed: FacebookUserFriendData[] = [];
  for (const row of pending) {
    const collectionId = (row.collection_id || "").trim();
    const next = resolveFriendFromMaps(
      row,
      collectionId,
      userNameMap,
      collectionOwnerMap,
    );
    if (
      !next.user_id ||
      !next.friend_id ||
      !next.user_name ||
      !next.friend_name
    ) {
      continue;
    }
    next.friend_rowkey = `${next.user_id}_${next.friend_id}`;
    next.entry_rowkey = next.friend_rowkey;
    refreshed.push(next);
  }

  if (!refreshed.length) return;

  await savePendingFriends(refreshed);
  scheduleFacebookFriendFlushInternal(ctx, refreshed.length);
}

export const handleFbFriendInfo = async (
  dt: ParseType,
  ctx: HandlerContext,
) => {
  const { cachedFacebookData, sendFacebookCachedData, debounce } = ctx;

  const crawledFriendData = dt.data as FacebookUserFriendData[];
  if (!Array.isArray(crawledFriendData) || !crawledFriendData.length) {
    console.log("[FB Friend Trace][handleFbFriendInfo] skip: empty dt.data");
    return;
  }

  console.log(
    "[Facebook Interceptor] Found crawled friends - Friends:",
    crawledFriendData.length,
  );

  const cachedMaps = await services.storageServices.getStorageCachedByKeys([
    FB_USER_NAME_MAP_KEY,
    FB_COLLECTION_OWNER_MAP_KEY,
    "facebook_follow_collection_owner_map",
  ]);

  const userNameMap = normalizeFacebookUserInfoMap(
    cachedMaps[FB_USER_NAME_MAP_KEY] as Record<string, string> | undefined,
  );
  const collectionOwnerMap = normalizeCollectionOwnerMap(
    cachedMaps[FB_COLLECTION_OWNER_MAP_KEY] as Record<
      string,
      FacebookFriendCollectionOwnerEntry
    >,
  );
  const followOwnerMap = normalizeCollectionOwnerMap(
    cachedMaps["facebook_follow_collection_owner_map"] as any,
  );

  const followRowsToRedirect: any[] = [];
  const friendRowsToKeep: FacebookUserFriendData[] = [];

  for (const row of crawledFriendData) {
    const collectionId = (row.collection_id || "").trim();
    if (collectionId && followOwnerMap[collectionId]) {
      const entry = followOwnerMap[collectionId];
      const listKind = entry.list_kind || "following";
      const now = Date.now();

      let followerId = "";
      let followerName = "";
      let followerUrl = "";
      let followerAvatar = "";
      let followedId = "";
      let followedName = "";

      if (listKind === "followers") {
        followerId = row.friend_id;
        followerName = row.friend_name;
        followerUrl = row.friend_url;
        followerAvatar = row.friend_avatar;
        followedId = row.user_id || entry.id;
        followedName = row.user_name || entry.name || "";
      } else {
        followerId = row.user_id || entry.id;
        followerName = row.user_name || entry.name || "";
        followedId = row.friend_id;
        followedName = row.friend_name;
      }

      const rowkey = `${followerId}_${followedId}`;

      followRowsToRedirect.push({
        follow_id: row.friend_id,
        follow_rowkey: rowkey,
        follower_id: followerId,
        follower_name: followerName,
        follower_url: followerUrl,
        follower_avatar: followerAvatar,
        followed_id: followedId,
        followed_name: followedName,
        entry_rowkey: rowkey,
        source_type: listKind,
        updated_time: row.updated_time || now,
        inserted_time: row.inserted_time || now,
        created_time: row.created_time || now,
        type: "person",
        docType: "Follow",
        channel_name: "facebook",
        platform: "facebook",
        collection_id: collectionId,
      });
    } else {
      friendRowsToKeep.push(row);
    }
  }

  if (followRowsToRedirect.length > 0) {
    console.log(
      `[FB Friend Trace][handleFbFriendInfo] redirecting ${followRowsToRedirect.length} rows to handleFbFollowInfo (collection ID registered as follow/followers)`,
    );
    const { handleFbFollowInfo } = await import("./follow-info");
    void handleFbFollowInfo(
      { typeName: "FacebookUserFollowerData", data: followRowsToRedirect },
      ctx,
    );
  }

  if (!friendRowsToKeep.length) {
    console.log(
      "[FB Friend Trace][handleFbFriendInfo] stop: all rows redirected",
    );
    return;
  }

  const normalized: FacebookUserFriendData[] = [];
  let droppedMissingIds = 0;
  let linkedPaginationCollection = 0;
  let appendedToKnownCollection = 0;

  for (const row of friendRowsToKeep) {
    const collectionId = (row.collection_id || "").trim();
    let next = resolveFriendFromMaps(
      row,
      collectionId,
      userNameMap,
      collectionOwnerMap,
    );

    const primaryOwner = getPrimaryCollectionOwner(collectionOwnerMap);
    if (
      collectionId &&
      next.user_id &&
      next.user_name &&
      !collectionOwnerMap[collectionId]
    ) {
      registerCollectionOwner(
        collectionOwnerMap,
        collectionId,
        next.user_id,
        next.user_name,
        "friends",
      );
      linkedPaginationCollection++;
    } else if (
      collectionId &&
      !collectionOwnerMap[collectionId] &&
      primaryOwner
    ) {
      registerCollectionOwner(
        collectionOwnerMap,
        collectionId,
        primaryOwner.id,
        primaryOwner.name,
        "friends",
      );
      next = resolveFriendFromMaps(
        next,
        collectionId,
        userNameMap,
        collectionOwnerMap,
      );
      linkedPaginationCollection++;
    }

    if (collectionId && next.user_id) {
      registerCollectionOwner(
        collectionOwnerMap,
        collectionId,
        next.user_id,
        next.user_name || userNameMap[next.user_id] || "",
        "friends",
      );
    }

    if (!next.user_name && next.user_id && userNameMap[next.user_id]) {
      next.user_name = userNameMap[next.user_id];
    }

    if (
      !next.user_id ||
      !next.friend_id ||
      !next.user_name ||
      !next.friend_name
    ) {
      droppedMissingIds++;
      continue;
    }

    next.friend_rowkey = `${next.user_id}_${next.friend_id}`;
    next.entry_rowkey = next.friend_rowkey;
    normalized.push(next);
  }

  if (!normalized.length) {
    console.log(
      "[FB Friend Trace][handleFbFriendInfo] stop: no normalized friend records (maps unchanged except prior state)",
    );
    return;
  }

  for (const row of normalized) {
    const collectionId = (row.collection_id || "").trim();
    if (appendRowsToKnownCollection(collectionOwnerMap, collectionId, [row])) {
      appendedToKnownCollection++;
    }
  }

  await services.storageServices.setStorageCached({
    [FB_COLLECTION_OWNER_MAP_KEY]: collectionOwnerMap,
  });

  console.log(
    "[FB Friend Trace][handleFbFriendInfo] normalized:",
    normalized.length,
    "droppedMissingIds:",
    droppedMissingIds,
    "linkedPaginationCollection:",
    linkedPaginationCollection,
    "appendedToKnownCollection:",
    appendedToKnownCollection,
  );

  const collectionBuffered = flattenCollectionRows(collectionOwnerMap);
  const pending = mergePendingFriends(
    mergePendingFriends(await loadPendingFriends(), normalized),
    collectionBuffered,
  );
  await savePendingFriends(pending);

  console.log(
    "[FB Friend Trace][handleFbFriendInfo] pending buffer size:",
    pending.length,
  );

  scheduleFacebookFriendFlushInternal(ctx, pending.length);
};
