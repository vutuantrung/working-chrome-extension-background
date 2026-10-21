import { FacebookUserFriendData, Result } from "../types";
import {
  decodeUnicodeEscapes,
  extractFacebookUserIdAndName,
} from "./user-info-map";
import {
  extractListPersonFromEdge,
  readString,
  resolveCollectionPageFromPayload,
} from "./collection-list-utils";

function buildFriendRow(
  listPerson: { id: string; name: string; url: string; avatar: string },
  ownerId: string,
  ownerName: string,
  collectionId: string,
): FacebookUserFriendData | null {
  if (!listPerson.id || !ownerId) return null;

  const friendName = decodeUnicodeEscapes(listPerson.name);
  const userName = decodeUnicodeEscapes(ownerName);
  const now = Date.now();
  const rowkey = `${ownerId}_${listPerson.id}`;

  return {
    friend_id: listPerson.id,
    friend_rowkey: rowkey,
    user_id: ownerId,
    user_name: userName,
    user_url: "",
    user_avatar: "",
    friend_name: friendName,
    friend_url: listPerson.url,
    friend_avatar: listPerson.avatar,
    entry_rowkey: rowkey,
    source_type: "friends_all",
    updated_time: now,
    inserted_time: now,
    created_time: now,
    type: "person",
    docType: "Friend",
    channel_name: "facebook",
    platform: "facebook",
    collection_id: collectionId,
  };
}

export function parseDataFriend(
  payload: any,
): Result<FacebookUserFriendData[]> {
  try {
    const resolved = resolveCollectionPageFromPayload(payload);
    if (!resolved) {
      console.debug(
        "[FB Friend Trace][parseDataFriend] skip: not a friends page",
      );
      return { ok: false, error: new Error("Not a friends payload") };
    }

    if (resolved.kind !== "friends") {
      console.debug(
        "[FB Friend Trace][parseDataFriend] skip: kind is",
        resolved.kind,
        "— not friends",
      );
      return { ok: false, error: new Error("Not friends collection") };
    }

    const profileIdentity = extractFacebookUserIdAndName(payload);
    let ownerId = profileIdentity?.id || readString(payload?.data?.user?.id);
    const ownerName = profileIdentity?.name || "";

    if (!ownerId && resolved.edges.length > 0) {
      for (const edge of resolved.edges) {
        const itemNode = (edge as any)?.node;
        const itemId = readString(itemNode?.id);
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
      "[FB Friend Trace][parseDataFriend] collectionId:",
      resolved.collectionId,
      "ownerId:",
      ownerId || "(empty)",
      "edges:",
      resolved.edges.length,
    );

    if (!ownerId) {
      return { ok: false, error: new Error("Missing profile owner id") };
    }

    const friendData: FacebookUserFriendData[] = [];
    for (const edge of resolved.edges) {
      const person = extractListPersonFromEdge(edge);
      if (!person) continue;
      const row = buildFriendRow(
        person,
        ownerId,
        ownerName,
        resolved.collectionId,
      );
      if (row) friendData.push(row);
    }

    if (!friendData.length) {
      return { ok: false, error: new Error("No valid friend data") };
    }

    return { ok: true, data: friendData };
  } catch (error: any) {
    console.error("[FB Friend Trace][parseDataFriend] error:", error);
    return {
      ok: false,
      error: new Error(
        error?.message || "Failed to parse Facebook friend data",
      ),
    };
  }
}
