import { readTrimmedString, extractFacebookUserIdAndName } from "./utils";
import {
    FacebookCollectionListKind,
    FacebookCollectionOwnerEntry,
    FacebookFriendCollectionOwnerEntry,
    ProfileTabCollectionRef,
    Result
} from "../types";

function detectCollectionListKind(meta: {
    name?: string;
    url?: string;
    tabKey?: string;
    edges?: unknown[];
}): FacebookCollectionListKind | null {
    const tabKey = readTrimmedString(meta.tabKey).toLowerCase();
    if (tabKey === "friends_all") return "friends";
    if (tabKey === "followers") return "followers";
    if (tabKey === "following") return "following";

    const name = readTrimmedString(meta.name).toLowerCase();
    const url = readTrimmedString(meta.url).toLowerCase();

    if (
        name.includes("đang theo dõi") ||
        name.includes("dang theo doi") ||
        url.includes("/following")
    ) {
        return "following";
    }
    if (
        name.includes("người theo dõi") ||
        name.includes("nguoi theo doi") ||
        url.includes("/followers")
    ) {
        return "followers";
    }
    if (
        name.includes("bạn bè") ||
        name.includes("ban be") ||
        url.includes("/friends")
    ) {
        return "friends";
    }

    if (Array.isArray(meta.edges) && meta.edges.length > 0) {
        for (const edge of meta.edges) {
            const node = (edge as any)?.node;
            if (!node) continue;

            const actionsRendererType = readTrimmedString(node.actions_renderer?.__typename);

            if (actionsRendererType.includes("FriendsList")) {
                return "friends";
            }
        }
    }

    return null;
}

function extractProfileTabCollections(payload: any): ProfileTabCollectionRef[] {
    const dataUser =
        payload?.data?.user ||
        payload?.data?.node?.user;

    if (!dataUser) {
        return [];
    }

    const header = dataUser.profile_header_renderer;
    const profileTabs = header?.profile_tabs || header?.user?.profile_tabs;
    const edges = profileTabs?.profile_user?.timeline_nav_app_sections?.edges;
    if (!Array.isArray(edges)) {
        return [];
    }

    const collectedResult: ProfileTabCollectionRef[] = [];
    for (const edge of edges) {
        if (!edge || !edge?.node || typeof edge?.node !== "object") continue;

        const section = edge.node;
        const collections = Array.isArray(section.all_collections?.nodes)
            ? section.all_collections.nodes
            : [];

        for (const collection of collections) {
            const tabKey = readTrimmedString(collection?.tab_key);
            const collectionId = readTrimmedString(collection?.id);
            if (!tabKey || !collectionId) continue;

            const kind = detectCollectionListKind({
                tabKey,
                name: readTrimmedString(collection?.name),
                url: readTrimmedString(collection?.url),
            });
            if (!kind) continue;

            collectedResult.push({ tabKey, collectionId, kind });
        }
    }

    return collectedResult;
}

export function parseDataFriendFollowMap(payload: any): Result<{
    followMap: Record<string, FacebookCollectionOwnerEntry>;
    friendMap: Record<string, FacebookFriendCollectionOwnerEntry>;
}> {
    try {
        const identity = extractFacebookUserIdAndName(payload);
        if (!identity) {
            return { ok: false, error: new Error("Unable to resolve user ID or name") };
        }

        const followMap: Record<string, FacebookCollectionOwnerEntry> = {};
        const friendMap: Record<string, FacebookFriendCollectionOwnerEntry> = {};

        for (const ref of extractProfileTabCollections(payload)) {
            const entry = {
                id: identity.id,
                name: identity.name,
                list_kind: ref.kind,
                rows: [],
            };

            if (ref.kind === "friends") {
                friendMap[ref.collectionId] = entry;
            } else {
                followMap[ref.collectionId] = entry;
            }
        }

        return {
            ok: true,
            data: {
                followMap,
                friendMap
            }
        }
    } catch (error: any) {
        console.error(
            "Error (Facebook User follow/friend data parser)",
            error.message
        );
        return { ok: false, error: new Error("Failed to parse Facebook user follow/friend data") };
    }
}
