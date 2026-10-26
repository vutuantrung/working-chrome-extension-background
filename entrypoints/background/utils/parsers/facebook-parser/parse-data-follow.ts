import { FacebookCollectionListKind, FacebookUserFollowData, Result } from "../types";
import { extractFacebookUserIdAndName } from "./user-info-map";
import {
  extractListPersonFromEdge,
  resolveCollectionPageFromPayload
} from "./collection-list-utils";
import { readTrimmedString, decodeUnicodeEscapes } from "./utils";


function buildFollowRow(
  kind: FacebookCollectionListKind,
  listPerson: { id: string; name: string; url: string; avatar: string },
  ownerId: string,
  ownerName: string,
  collectionId: string,
): FacebookUserFollowData | null {
  if (!listPerson.id) return null;

  const listName = decodeUnicodeEscapes(listPerson.name);
  const profileName = decodeUnicodeEscapes(ownerName);
  const now = Date.now();

  let followerId = "";
  let followerName = "";
  let followerUrl = "";
  let followerAvatar = "";
  let followedId = "";
  let followedName = "";

  if (kind === "followers") {
    followerId = listPerson.id;
    followerName = listName;
    followerUrl = listPerson.url;
    followerAvatar = listPerson.avatar;
    followedId = ownerId;
    followedName = profileName;
  } else {
    followerId = ownerId;
    followerName = profileName;
    followedId = listPerson.id;
    followedName = listName;
  }

  const rowkey =
    followerId && followedId
      ? `${followerId}_${followedId}`
      : `${collectionId}_${listPerson.id}`;

  return {
    follow_id: listPerson.id,
    follow_rowkey: rowkey,
    follower_id: followerId,
    follower_name: followerName,
    follower_url: followerUrl,
    follower_avatar: followerAvatar,
    followed_id: followedId,
    followed_name: followedName,
    entry_rowkey: rowkey,
    source_type: kind,
    updated_time: now,
    inserted_time: now,
    created_time: now,
    type: "person",
    docType: "Follow",
    channel_name: "facebook",
    platform: "facebook",
    collection_id: collectionId,
  };
}

export function parseDataFollow(
  payload: any,
): Result<FacebookUserFollowData[]> {
  try {
    const resolved = resolveCollectionPageFromPayload(payload);
    if (!resolved) {
      console.debug(
        "[FB Follow Trace][parseDataFollow] skip: not a follow/followers page",
      );
      return { ok: false, error: new Error("Not a follow payload") };
    }

    if (resolved.kind === "friends") {
      console.debug(
        "[FB Follow Trace][parseDataFollow] skip: friends list — use parseDataFriend",
      );
      return { ok: false, error: new Error("Friends payload") };
    }

    const profileIdentity = extractFacebookUserIdAndName(payload);
    let ownerId = profileIdentity?.id || readTrimmedString(payload?.data?.user?.id);
    const ownerName = profileIdentity?.name || "";

    if (!ownerId && resolved.edges.length > 0) {
      for (const edge of resolved.edges) {
        const itemNode = (edge as any)?.node;
        const itemId = readTrimmedString(itemNode?.id);
        if (itemId) {
          try {
            const decoded = atob(itemId);
            const parts = decoded.split(":");
            if (parts.length >= 2 && parts[0] === "app_item" && parts[1]) {
              ownerId = parts[1];
              break;
            }
          } catch (e) {
            // Ignore base64 decoding errors
          }
        }
      }
    }

    console.log(
      "[FB Follow Trace][parseDataFollow] kind:",
      resolved.kind,
      "collectionId:",
      resolved.collectionId,
      "ownerId:",
      ownerId || "(empty)",
      "edges:",
      resolved.edges.length,
    );

    if (!ownerId) {
      console.debug(
        "[FB Follow Trace][parseDataFollow] skip: missing profile owner id",
      );
      return { ok: false, error: new Error("Missing profile owner id") };
    }

    const followData: FacebookUserFollowData[] = [];
    for (const edge of resolved.edges) {
      const person = extractListPersonFromEdge(edge);
      if (!person) continue;
      const row = buildFollowRow(
        resolved.kind,
        person,
        ownerId,
        ownerName,
        resolved.collectionId,
      );
      if (row) followData.push(row);
    }

    if (!followData.length) {
      console.debug(
        "[FB Follow Trace][parseDataFollow] skip: no valid follow records",
      );
      return { ok: false, error: new Error("No valid follow data") };
    }

    return { ok: true, data: followData };
  } catch (error: any) {
    console.error("[FB Follow Trace][parseDataFollow] error:", error);
    return {
      ok: false,
      error: new Error(
        error?.message || "Failed to parse Facebook follow data",
      ),
    };
  }
}
