import * as services from "../../services";
import {
  ParseType,
  FacebookUserFollowData,
  FacebookDataType,
} from "../../utils/parsers/types";
import { HandlerContext } from "../../types/handle";
import { decodeUnicodeEscapes, normalizeFacebookUserInfoMap } from "../../utils/parsers/facebook-parser/utils";

const FB_FOLLOW_FLUSH_IMMEDIATE_LIMIT = 30;
const FB_FOLLOW_FLUSH_DEBOUNCE_MS = 10_000;
const FB_USER_NAME_MAP_KEY = "facebook_user_info_map";
const FB_COLLECTION_OWNER_MAP_KEY = "facebook_follow_collection_owner_map";
const FB_PENDING_FOLLOW_KEY = "facebook_pending_follow_data";

export type FacebookCollectionOwnerEntry = {
  id: string;
  name?: string;
  list_kind?: string;
  rows?: FacebookUserFollowData[];
};

function isFollowersList(row: FacebookUserFollowData): boolean {
  return row.source_type === "followers";
}

function isFollowRecord(record: unknown): boolean {
  return (
    !!record &&
    typeof record === "object" &&
    String((record as { docType?: string }).docType || "").toLowerCase() ===
    "follow"
  );
}

function getPrimaryCollectionOwner(map: Record<string, FacebookCollectionOwnerEntry>): { id: string; name: string } | null {
  const owners = Object.values(map);
  if (!owners.length) return null;
  const last = owners[owners.length - 1];
  if (!last?.id) return null;
  return { id: last.id, name: last.name || "" };
}

function mergePendingFollows(
  existing: FacebookUserFollowData[],
  incoming: FacebookUserFollowData[],
): FacebookUserFollowData[] {
  const byKey = new Map<string, FacebookUserFollowData>();
  for (const row of existing) {
    const key = row.follow_rowkey || `${row.follower_id}_${row.followed_id}`;
    if (key) byKey.set(key, row);
  }
  for (const row of incoming) {
    const key = row.follow_rowkey || `${row.follower_id}_${row.followed_id}`;
    if (key) byKey.set(key, row);
  }
  return Array.from(byKey.values());
}

function normalizeCollectionOwnerMap(raw: Record<string, FacebookCollectionOwnerEntry> | null | undefined): Record<string, FacebookCollectionOwnerEntry> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, FacebookCollectionOwnerEntry> = {};
  for (const [collectionId, entry] of Object.entries(raw)) {
    const key = (collectionId || "").trim();
    if (!key || !entry?.id) continue;
    out[key] = {
      id: entry.id,
      name: entry.name || "",
      list_kind: entry.list_kind || "",
      rows: Array.isArray(entry.rows) ? [...entry.rows] : [],
    };
  }
  return out;
}

function resolveFollowRowFromMaps(
  row: FacebookUserFollowData,
  collectionId: string,
  userNameMap: Record<string, string>,
  collectionOwnerMap: Record<string, FacebookCollectionOwnerEntry>,
): FacebookUserFollowData {
  const next = { ...row };
  const owner = (collectionId && collectionOwnerMap[collectionId]) || getPrimaryCollectionOwner(collectionOwnerMap);
  const followers = isFollowersList(next);

  if (followers) {
    if (!next.followed_id && owner?.id) {
      next.followed_id = owner.id;
    }
    if (!next.followed_name && next.followed_id) {
      next.followed_name =
        userNameMap[next.followed_id] ||
        owner?.name ||
        next.followed_name ||
        "";
    }
    if (!next.follower_name && next.follower_id) {
      next.follower_name =
        userNameMap[next.follower_id] || next.follower_name || "";
    }
  } else {
    if (!next.follower_id && owner?.id) {
      next.follower_id = owner.id;
    }
    if (!next.follower_name && next.follower_id) {
      next.follower_name =
        userNameMap[next.follower_id] ||
        owner?.name ||
        next.follower_name ||
        "";
    }
  }

  if (next.follower_name) {
    next.follower_name = decodeUnicodeEscapes(next.follower_name);
  }
  if (next.followed_name) {
    next.followed_name = decodeUnicodeEscapes(next.followed_name);
  }
  return next;
}

/** Fix pagination rows parsed as following when collection is actually followers. */
function alignFollowRowToCollectionKind(
  row: FacebookUserFollowData,
  collectionOwnerMap: Record<string, FacebookCollectionOwnerEntry>,
): FacebookUserFollowData {
  const collectionId = (row.collection_id || "").trim();
  const entry = collectionId ? collectionOwnerMap[collectionId] : undefined;
  const kind = entry?.list_kind || row.source_type;
  if (kind !== "followers") {
    return { ...row, source_type: kind || row.source_type };
  }

  const profileId = entry?.id || "";
  if (
    profileId &&
    row.follower_id === profileId &&
    row.followed_id &&
    row.followed_id !== profileId
  ) {
    return {
      ...row,
      follower_id: row.followed_id,
      follower_name: row.followed_name,
      follower_url: "",
      follower_avatar: "",
      followed_id: row.follower_id,
      followed_name: row.follower_name,
      source_type: "followers",
    };
  }

  return { ...row, source_type: "followers" };
}

function getProfileOwnerForFollowRow(row: FacebookUserFollowData, userNameMap: Record<string, string>): { id: string; name: string } {
  if (isFollowersList(row)) {
    const id = row.followed_id;
    const name = row.followed_name || (id ? userNameMap[id] || "" : "");
    return { id, name };
  }
  const id = row.follower_id;
  const name = row.follower_name || (id ? userNameMap[id] || "" : "");
  return { id, name };
}

function registerCollectionOwner(
  map: Record<string, FacebookCollectionOwnerEntry>,
  collectionId: string,
  profileOwnerId: string,
  profileOwnerName: string,
  listKind = "",
): void {
  if (!collectionId || !profileOwnerId) return;
  const prev = map[collectionId];
  map[collectionId] = {
    id: profileOwnerId,
    name: profileOwnerName || prev?.name || "",
    list_kind: listKind || prev?.list_kind || "",
    rows: prev?.rows || [],
  };
}

function appendRowsToKnownCollection(
  map: Record<string, FacebookCollectionOwnerEntry>,
  collectionId: string,
  rows: FacebookUserFollowData[],
): boolean {
  if (!collectionId || !map[collectionId] || !rows.length) return false;
  map[collectionId].rows = mergePendingFollows(
    map[collectionId].rows || [],
    rows,
  );
  return true;
}

function flattenCollectionRows(map: Record<string, FacebookCollectionOwnerEntry>): FacebookUserFollowData[] {
  let merged: FacebookUserFollowData[] = [];
  for (const entry of Object.values(map)) {
    if (entry.rows?.length) {
      merged = mergePendingFollows(merged, entry.rows);
    }
  }
  return merged;
}

function clearCollectionRowBuffers(map: Record<string, FacebookCollectionOwnerEntry>): void {
  for (const entry of Object.values(map)) {
    entry.rows = [];
  }
}

/** Clear pending follow buffer and in-memory follow queue after publish. Keeps user/collection maps. */
export async function clearFacebookFollowStagingState(cachedFacebookData: FacebookDataType[]): Promise<void> {
  const cached = await services.storageServices.getStorageCachedByKeys([FB_COLLECTION_OWNER_MAP_KEY]);
  const cachedCollectionOwnerMap = cached[FB_COLLECTION_OWNER_MAP_KEY] as Record<string, FacebookCollectionOwnerEntry>;
  const collectionOwnerMap = normalizeCollectionOwnerMap(cachedCollectionOwnerMap);
  clearCollectionRowBuffers(collectionOwnerMap);

  await services.storageServices.setStorageCached({
    [FB_COLLECTION_OWNER_MAP_KEY]: collectionOwnerMap,
    [FB_PENDING_FOLLOW_KEY]: [],
  });

  for (let i = cachedFacebookData.length - 1; i >= 0; i--) {
    if (isFollowRecord(cachedFacebookData[i])) {
      cachedFacebookData.splice(i, 1);
    }
  }

  console.log(
    "[FB Follow Trace][clearFacebookFollowStagingState] cleared pending buffer and follow queue; kept user/collection owner maps",
  );
}

export function hasFacebookFollowRecordsInQueue(records: FacebookDataType[]): boolean {
  return records.some(isFollowRecord);
}

async function loadPendingFollows(): Promise<FacebookUserFollowData[]> {
  const cached = await services.storageServices.getStorageCachedByKeys([
    FB_PENDING_FOLLOW_KEY,
  ]);
  const pending = cached[FB_PENDING_FOLLOW_KEY];
  return Array.isArray(pending) ? [...pending] : [];
}

async function savePendingFollows(rows: FacebookUserFollowData[]): Promise<void> {
  await services.storageServices.setStorageCached({
    [FB_PENDING_FOLLOW_KEY]: rows,
  });
}

export async function flushFacebookFollowStaging(
  cachedFacebookData: FacebookDataType[],
  sendFacebookCachedData: () => Promise<void>,
): Promise<void> {
  const pending = await loadPendingFollows();
  if (!pending.length) {
    console.log(
      "[FB Follow Trace][flushFacebookFollowStaging] skip: empty pending",
    );
    return;
  }

  console.log(
    "[FB Follow Trace][flushFacebookFollowStaging] pushing",
    pending.length,
    "follow rows",
  );

  await savePendingFollows([]);
  cachedFacebookData.push(...pending);
  await sendFacebookCachedData();
}

function scheduleFacebookFollowFlushInternal(
  ctx: Pick<
    HandlerContext,
    "cachedFacebookData" | "sendFacebookCachedData" | "debounce"
  >,
  pendingCount: number,
): void {
  const { cachedFacebookData, sendFacebookCachedData, debounce } = ctx;

  if (!pendingCount) {
    console.log(
      "[FB Follow Trace][scheduleFacebookFollowFlush] skip: empty pending — no push",
    );
    return;
  }

  const scheduleFlush = () => {
    void flushFacebookFollowStaging(cachedFacebookData, sendFacebookCachedData);
  };

  if (pendingCount >= FB_FOLLOW_FLUSH_IMMEDIATE_LIMIT) {
    console.log(
      "[FB Follow Trace][scheduleFacebookFollowFlush] pending >=",
      FB_FOLLOW_FLUSH_IMMEDIATE_LIMIT,
      "— flush immediately and clear staging",
    );
    scheduleFlush();
    return;
  }

  debounce(
    scheduleFlush,
    FB_FOLLOW_FLUSH_DEBOUNCE_MS,
    "fb_follow_flush_debounce",
  );
}

function scheduleFacebookFollowFlush(ctx: Pick<HandlerContext, "cachedFacebookData" | "sendFacebookCachedData" | "debounce">)
  : void {
  void (async () => {
    const pending = await loadPendingFollows();
    scheduleFacebookFollowFlushInternal(ctx, pending.length);
  })();
}

/** Re-resolve follower names from map after profile header is captured. */
export async function refreshPendingFollowsFromUserInfoMap(ctx: Pick<HandlerContext, "cachedFacebookData" | "sendFacebookCachedData" | "debounce">): Promise<void> {
  const pending = await loadPendingFollows();
  if (!pending.length) return;

  const cachedMaps = await services.storageServices.getStorageCachedByKeys([FB_USER_NAME_MAP_KEY, FB_COLLECTION_OWNER_MAP_KEY]);
  const userNameMap = normalizeFacebookUserInfoMap(cachedMaps[FB_USER_NAME_MAP_KEY] as Record<string, string> | undefined);
  const collectionOwnerMap = normalizeCollectionOwnerMap(
    cachedMaps[FB_COLLECTION_OWNER_MAP_KEY] as Record<
      string,
      FacebookCollectionOwnerEntry
    >,
  );

  const refreshed: FacebookUserFollowData[] = [];
  for (const row of pending) {
    const collectionId = (row.collection_id || "").trim();
    const next = resolveFollowRowFromMaps(
      row,
      collectionId,
      userNameMap,
      collectionOwnerMap,
    );
    if (!next.follower_id || !next.followed_id || !next.follower_name) continue;
    if (isFollowersList(next) && !next.followed_name) continue;
    next.follow_rowkey = `${next.follower_id}_${next.followed_id}`;
    next.entry_rowkey = next.follow_rowkey;
    refreshed.push(next);
  }

  if (!refreshed.length) return;

  await savePendingFollows(refreshed);
  scheduleFacebookFollowFlush(ctx);
}

export const handleFbFollowInfo = async (
  dt: ParseType,
  ctx: HandlerContext,
) => {
  const crawledFollowData = dt.data as FacebookUserFollowData[];
  if (!Array.isArray(crawledFollowData) || !crawledFollowData.length) {
    console.log("[FB Follow Trace][handleFbFollowInfo] skip: empty dt.data");
    return;
  }

  console.log(
    "[Facebook Interceptor] Found crawled follows - Follows:",
    crawledFollowData.length,
  );

  const cachedMaps = await services.storageServices.getStorageCachedByKeys([
    FB_USER_NAME_MAP_KEY,
    FB_COLLECTION_OWNER_MAP_KEY,
    "facebook_friend_collection_owner_map",
  ]);

  const userNameMap = normalizeFacebookUserInfoMap(
    cachedMaps[FB_USER_NAME_MAP_KEY] as Record<string, string> | undefined,
  );
  const collectionOwnerMap = normalizeCollectionOwnerMap(
    cachedMaps[FB_COLLECTION_OWNER_MAP_KEY] as Record<
      string,
      FacebookCollectionOwnerEntry
    >,
  );
  const friendOwnerMap = normalizeCollectionOwnerMap(
    cachedMaps["facebook_friend_collection_owner_map"] as any,
  );

  const friendRowsToRedirect: any[] = [];
  const followRowsToKeep: FacebookUserFollowData[] = [];

  for (const row of crawledFollowData) {
    const collectionId = (row.collection_id || "").trim();
    if (collectionId && friendOwnerMap[collectionId]) {
      const entry = friendOwnerMap[collectionId];
      const now = Date.now();

      const userId = entry.id;
      const userName = entry.name || "";
      const isFollowers = row.source_type === "followers";
      const friendId = isFollowers ? row.follower_id : row.followed_id;
      const friendName = isFollowers ? row.follower_name : row.followed_name;
      const friendAvatar = isFollowers ? row.follower_avatar : "";

      const rowkey = `${userId}_${friendId}`;

      friendRowsToRedirect.push({
        friend_id: friendId,
        friend_rowkey: rowkey,
        user_id: userId,
        user_name: userName,
        user_url: "",
        user_avatar: "",
        friend_name: friendName,
        friend_url:
          row.follower_url ||
          `https://www.facebook.com/profile.php?id=${friendId}`,
        friend_avatar: friendAvatar,
        entry_rowkey: rowkey,
        source_type: "friends_all",
        updated_time: row.updated_time || now,
        inserted_time: row.inserted_time || now,
        created_time: row.created_time || now,
        type: "person",
        docType: "Friend",
        channel_name: "facebook",
        platform: "facebook",
        collection_id: collectionId,
      });
    } else {
      followRowsToKeep.push(row);
    }
  }

  if (friendRowsToRedirect.length > 0) {
    console.log(
      `[FB Follow Trace][handleFbFollowInfo] redirecting ${friendRowsToRedirect.length} rows to handleFbFriendInfo (collection ID registered as friend)`,
    );
    const { handleFbFriendInfo } = await import("./friend-info");
    void handleFbFriendInfo(
      { typeName: "FacebookUserFriendData", data: friendRowsToRedirect },
      ctx,
    );
  }

  if (!followRowsToKeep.length) {
    console.log(
      "[FB Follow Trace][handleFbFollowInfo] stop: all rows redirected",
    );
    return;
  }

  const normalized: FacebookUserFollowData[] = [];
  let droppedMissingIds = 0;
  let resolvedFollowerFromCollection = 0;
  let resolvedFollowerNameFromMap = 0;
  let linkedPaginationCollection = 0;
  let appendedToKnownCollection = 0;

  for (const row of followRowsToKeep) {
    const collectionId = (row.collection_id || "").trim();
    let next = alignFollowRowToCollectionKind(row, collectionOwnerMap);
    next = resolveFollowRowFromMaps(
      row,
      collectionId,
      userNameMap,
      collectionOwnerMap,
    );

    const profileOwner = getProfileOwnerForFollowRow(next, userNameMap);
    const listKind = next.source_type || "";

    if (
      !next.follower_id &&
      collectionId &&
      collectionOwnerMap[collectionId]?.id
    ) {
      if (!isFollowersList(next)) {
        next.follower_id = collectionOwnerMap[collectionId].id;
      }
      resolvedFollowerFromCollection++;
    }
    if (
      !next.followed_id &&
      collectionId &&
      collectionOwnerMap[collectionId]?.id
    ) {
      if (isFollowersList(next)) {
        next.followed_id = collectionOwnerMap[collectionId].id;
      }
      resolvedFollowerFromCollection++;
    }

    const primaryOwner = getPrimaryCollectionOwner(collectionOwnerMap);
    if (collectionId && profileOwner.id && !collectionOwnerMap[collectionId]) {
      registerCollectionOwner(
        collectionOwnerMap,
        collectionId,
        profileOwner.id,
        profileOwner.name,
        listKind,
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
        listKind,
      );
      next = resolveFollowRowFromMaps(
        next,
        collectionId,
        userNameMap,
        collectionOwnerMap,
      );
      linkedPaginationCollection++;
    }

    if (collectionId && profileOwner.id) {
      registerCollectionOwner(
        collectionOwnerMap,
        collectionId,
        profileOwner.id,
        profileOwner.name || userNameMap[profileOwner.id] || "",
        listKind,
      );
    }

    next = resolveFollowRowFromMaps(
      next,
      collectionId,
      userNameMap,
      collectionOwnerMap,
    );

    if (
      !next.follower_name &&
      next.follower_id &&
      userNameMap[next.follower_id]
    ) {
      next.follower_name = userNameMap[next.follower_id];
      resolvedFollowerNameFromMap++;
    }

    if (!next.follower_id || !next.followed_id) {
      droppedMissingIds++;
      continue;
    }

    if (!next.follower_name) {
      droppedMissingIds++;
      console.log(
        "[FB Follow Trace][handleFbFollowInfo] drop row: missing follower_name for",
        next.follower_id,
        "kind:",
        listKind || "(unknown)",
        "collection:",
        collectionId || "(none)",
      );
      continue;
    }

    if (isFollowersList(next) && !next.followed_name) {
      droppedMissingIds++;
      continue;
    }

    next.follow_rowkey = `${next.follower_id}_${next.followed_id}`;
    next.entry_rowkey = next.follow_rowkey;
    normalized.push(next);
  }

  if (!normalized.length) {
    console.log(
      "[FB Follow Trace][handleFbFollowInfo] stop: no normalized follow records (maps unchanged except prior state)",
    );
    return;
  }

  for (const row of normalized) {
    const collectionId = (row.collection_id || "").trim();
    if (appendRowsToKnownCollection(collectionOwnerMap, collectionId, [row])) {
      appendedToKnownCollection++;
    }
  }

  await services.storageServices.setStorageCached({ [FB_COLLECTION_OWNER_MAP_KEY]: collectionOwnerMap });

  console.log(
    "[FB Follow Trace][handleFbFollowInfo] normalized:", normalized.length,
    "droppedMissingIds:", droppedMissingIds,
    "resolvedFollowerFromCollection:", resolvedFollowerFromCollection,
    "resolvedFollowerNameFromMap:", resolvedFollowerNameFromMap,
    "linkedPaginationCollection:", linkedPaginationCollection,
    "appendedToKnownCollection:", appendedToKnownCollection,
  );

  const collectionBuffered = flattenCollectionRows(collectionOwnerMap);
  const pending = mergePendingFollows(
    mergePendingFollows(await loadPendingFollows(), normalized),
    collectionBuffered,
  );
  await savePendingFollows(pending);

  console.log(
    "[FB Follow Trace][handleFbFollowInfo] pending buffer size:",
    pending.length,
  );

  scheduleFacebookFollowFlushInternal(ctx, pending.length);
};
