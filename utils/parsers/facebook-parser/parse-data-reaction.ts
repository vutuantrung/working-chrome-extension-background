import { StorageService } from "@/entrypoints/background/services/storageServices";
import { FacebookPostLocalStorageInfo, FacebookReactionData, Result } from "../types";
import { FACEBOOK_POST_INFO_KEY, generateReactionKey, parseFacebookPostInfo } from "./utils";

const REACTION_TYPE_MAP: Record<string, string> = {
    "478547315650144": "WOW",
    "908563459236466": "SAD",
    "115940658764963": "HAHA",
    "1678524932434102": "LOVE",
    "1635855486666999": "LIKE",
}

export async function parseDataReaction(payload: any): Promise<Result<FacebookReactionData[]>> {
    try {
        const edgesReactions = payload?.data?.node?.reactors?.edges;
        const articleIdDecoded = payload?.data?.node?.id ? atob(payload.data.node.id)?.replace("feedback:", "") : null;
        if (!articleIdDecoded || !Array.isArray(edgesReactions)) {
            return { ok: false, error: new Error("No reactions found") };
        }

        const localStoragePostOwner = await StorageService.getInstance().getStorageByKeys([FACEBOOK_POST_INFO_KEY]);
        const cachedPostArray: FacebookPostLocalStorageInfo[] = parseFacebookPostInfo(localStoragePostOwner[FACEBOOK_POST_INFO_KEY] || "");

        const cachedPost = cachedPostArray.find((o) => o.post_id === articleIdDecoded);
        if (!cachedPost) {
            console.warn("Post info not found for article id:", articleIdDecoded);
            return { ok: false, error: new Error(`Post info not found for article id: ${articleIdDecoded}`) };
        }

        const reactions: FacebookReactionData[] = [];
        for (const reactionData of edgesReactions) {
            const reactionLogoId = reactionData.feedback_reaction_info?.id;
            if (!reactionLogoId) {
                console.warn("Reaction ID not found for reaction data:", reactionData);
                continue;
            }

            const reactionId = `${cachedPost.owner_id}_${cachedPost.post_id}_${reactionData.node.id}_${REACTION_TYPE_MAP[reactionLogoId]}`;
            const reactionRowKey = generateReactionKey(reactionId);
            if (!reactionRowKey) {
                console.warn("Failed to generate reaction row key for reaction ID:", reactionId);
                continue;
            }

            const parsedData = {
                "source_type": "",
                "article_id": articleIdDecoded,// ok
                "post_id": cachedPost.owner_id + "_" + cachedPost.post_id,// ok
                "profile_url": reactionData.node.profile_url,// ok
                "profile_id": reactionData.node.id,// ok
                "profile_name": reactionData.node.name,// ok
                "owner_id": cachedPost.owner_id,// ok
                "owner_name": cachedPost.owner_name,
                "owner_type": cachedPost.owner_type,// ok
                "owner_ids": [cachedPost.owner_id],
                "reaction_rowkey": reactionRowKey,
                "created_time": Date.now(),// ok
                "entry_rowkey": cachedPost.entry_rowkey,
                "reaction_id": reactionId,// 100006923491286_4468803010027105
                "type": REACTION_TYPE_MAP[reactionLogoId],// ok
                "docType": "Reaction",// ok
                "_tenants": [],
                "tenant_ids": [],
                "tenants": [],
                "channel_name": "facebook"
            }

            reactions.push(parsedData);
        }

        return { ok: true, data: reactions };

    } catch (error: any) {
        console.error("Error parsing Facebook reaction data:", error);
        return { ok: false, error };
    }
}