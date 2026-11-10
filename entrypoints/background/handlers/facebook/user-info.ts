import * as helpers from "../../utils/helpers";
import { FacebookUserData, ParseType } from "@/entrypoints/background/utils/parsers/types";
import { HandlerContext } from "../../types/handle";
import { refreshPendingFollowsFromUserInfoMap } from "./follow-info";
import { refreshPendingFriendsFromUserInfoMap } from "./friend-info";

function buildFacebookUserInfoMapEntry(identity: { id: string; name: string; }): Record<string, string> {
    return { [identity.id]: identity.name };
}

export const handleFbUserInfo = async (dt: ParseType, ctx: HandlerContext) => {
    const {
        applicationServices,
        debounce,
        sendFacebookUserData,
        USERINFO_PUBLISH_DEBOUNCE_MS
    } = ctx;

    const { data } = dt;
    const crawledUser = data as FacebookUserData[];
    const crawledUserData = crawledUser[0];
    console.log("[FB Interceptor] Found userInfo:", crawledUserData?.id, crawledUserData?.name);

    const identity = { id: crawledUserData.id, name: crawledUserData.name };

    const filteredIncoming = helpers.userInfo.filterUserProfilePayload(crawledUserData);
    if (!filteredIncoming) {
        console.log("[FB Follow Trace][handleFbUserInfo] skip: invalid id/name after filter");
        return;
    }

    const userInfoMap = buildFacebookUserInfoMapEntry(identity);

    const cachedStorage = await applicationServices.storage?.getStorageCachedByKeys(["facebook_user_info_map"]);
    const prevMap = cachedStorage?.facebook_user_info_map as Record<string, string> | undefined;
    const prevUserId = prevMap && typeof prevMap === "object"
        ? Object.keys(prevMap).find((k) => k.trim()) || ""
        : "";
    const switchedProfile = Boolean(prevUserId && prevUserId !== identity.id);

    console.log(
        "[FB Follow Trace][handleFbUserInfo] ProfileCometHeader map set (single user):",
        identity.id,
        "->",
        identity.name,
        switchedProfile ? "(replaced previous user)" : "",
    );

    const nextItem = helpers.userInfo.buildPendingUserInfoItem(JSON.stringify(filteredIncoming), filteredIncoming);
    const nextList = [nextItem];

    const storagePatch: Record<string, unknown> = {
        pendingUserInfo: nextItem,
        pendingUserInfoList: nextList,
        facebook_user_info_map: userInfoMap,
        userInfoPublishStatus: {
            status: "pending",
            ts: Date.now(),
            message: `Profile header captured for user: ${identity.name}`,
        },
    };

    const seedFollowMap = crawledUserData.followMap || {};
    const seedFriendMap = crawledUserData.friendMap || {};

    if (switchedProfile) {
        storagePatch.facebook_follow_collection_owner_map = seedFollowMap;
        storagePatch.facebook_friend_collection_owner_map = seedFriendMap;
        storagePatch.facebook_pending_follow_data = [];
        storagePatch.facebook_pending_friend_data = [];
    } else {
        const existingMaps = await applicationServices.storage?.getStorageCachedByKeys([
            "facebook_follow_collection_owner_map",
            "facebook_friend_collection_owner_map",
        ]);

        const followMap = existingMaps?.facebook_follow_collection_owner_map ?
            (existingMaps?.facebook_follow_collection_owner_map as Record<string, unknown>)
            : {};
        const friendMap = existingMaps?.facebook_friend_collection_owner_map ?
            (existingMaps?.facebook_friend_collection_owner_map as Record<string, unknown>)
            : {};

        storagePatch.facebook_follow_collection_owner_map = { ...followMap, ...seedFollowMap };
        storagePatch.facebook_friend_collection_owner_map = { ...friendMap, ...seedFriendMap };
    }

    await applicationServices.storage?.setStorageCached(storagePatch);

    void refreshPendingFollowsFromUserInfoMap(ctx);
    void refreshPendingFriendsFromUserInfoMap(ctx);

    debounce(
        () => { void sendFacebookUserData(); },
        USERINFO_PUBLISH_DEBOUNCE_MS,
        "fb_user_info_auto_publish",
    );
};