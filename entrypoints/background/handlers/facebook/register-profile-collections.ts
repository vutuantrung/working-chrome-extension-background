import { extractProfileTabCollections } from "@/entrypoints/background/utils/parsers/facebook-parser/collection-list-utils";
import type { FacebookCollectionOwnerEntry } from "./follow-info";
import type { FacebookFriendCollectionOwnerEntry } from "./friend-info";

export function seedCollectionMapsFromProfile(
  payload: unknown,
  profileId: string,
  profileName: string,
): {
  followMap: Record<string, FacebookCollectionOwnerEntry>;
  friendMap: Record<string, FacebookFriendCollectionOwnerEntry>;
} {
  const followMap: Record<string, FacebookCollectionOwnerEntry> = {};
  const friendMap: Record<string, FacebookFriendCollectionOwnerEntry> = {};

  for (const ref of extractProfileTabCollections(payload)) {
    const entry = {
      id: profileId,
      name: profileName,
      list_kind: ref.kind,
      rows: [],
    };
    if (ref.kind === "friends") {
      friendMap[ref.collectionId] = entry;
    } else {
      followMap[ref.collectionId] = entry;
    }
  }

  return { followMap, friendMap };
}
