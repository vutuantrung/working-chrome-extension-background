import { FacebookUserProfileData, ParseType } from "@/entrypoints/background/utils/parsers/types";
import { HandlerContext } from "../../types/handle";
import {
    buildFacebookUserInfoMapEntry,
    extractFacebookUserIdAndName,
} from "./user-info-map";
import { refreshPendingFollowsFromUserInfoMap } from "./follow-info";
import { refreshPendingFriendsFromUserInfoMap } from "./friend-info";
import { seedCollectionMapsFromProfile } from "./register-profile-collections";
import { parseDataUserProfile } from "@/entrypoints/background/utils/parsers/facebook-parser/parse-data-user-profile";
import * as services from "../../services";
import * as helpers from "../../utils/helpers";

export const handleFbUserInfo = async (dt: ParseType, ctx: HandlerContext) => {
    const {
        debounce,
        publishFacebookUserInfo,
        USERINFO_PUBLISH_DEBOUNCE_MS
    } = ctx;

    const { data } = dt;
    const crawledPostData = data as FacebookUserProfileData[];
    const rawPayload = crawledPostData?.[0]?.fbU;
    if (!rawPayload) {
        console.log("[FB Follow Trace][handleFbUserInfo] skip: no fbU payload");
        return;
    }

    let parsedPayload: unknown = null;
    try {
        parsedPayload = JSON.parse(rawPayload);
    } catch (error) {
        console.warn("[FB Follow Trace][handleFbUserInfo] parse fbU failed:", error);
        return;
    }

    const identity = extractFacebookUserIdAndName(parsedPayload);
    if (!identity) {
        console.log("[FB Follow Trace][handleFbUserInfo] skip: not ProfileCometHeader (data.user.profile_header_renderer)");
        return;
    }

    const parsedResult = parseDataUserProfile(parsedPayload);
    if (!parsedResult.ok) {
        console.warn("[FB Follow Trace][handleFbUserInfo] parseDataUserProfile failed:", parsedResult?.error);
        return;
    }

    let parsedUserObj: any = null;
    try {
        parsedUserObj = JSON.parse(parsedResult.data.fbU);
    } catch (e) {
        console.warn("[FB Follow Trace][handleFbUserInfo] parse fbU string from parseDataUserProfile failed:", e);
        return;
    }
    const filteredIncoming = helpers.userInfo.filterUserProfilePayload(parsedUserObj);
    if (!filteredIncoming) {
        console.log("[FB Follow Trace][handleFbUserInfo] skip: invalid id/name after filter");
        return;
    }

    const userInfoMap = buildFacebookUserInfoMapEntry(identity);

    const cachedMaps = await services.storageServices.getStorageCachedByKeys(["facebook_user_info_map"]);
    const prevMap = cachedMaps.facebook_user_info_map as
        | Record<string, string>
        | undefined;
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

    const { followMap: seedFollowMap, friendMap: seedFriendMap } = seedCollectionMapsFromProfile(parsedPayload, identity.id, identity.name);

    const existingMaps = await services.storageServices.getStorageCachedByKeys([
        "facebook_follow_collection_owner_map",
        "facebook_friend_collection_owner_map",
    ]);

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

    if (switchedProfile) {
        storagePatch.facebook_follow_collection_owner_map = seedFollowMap;
        storagePatch.facebook_friend_collection_owner_map = seedFriendMap;
        storagePatch.facebook_pending_follow_data = [];
        storagePatch.facebook_pending_friend_data = [];
    } else {
        storagePatch.facebook_follow_collection_owner_map = {
            ...(existingMaps.facebook_follow_collection_owner_map as object),
            ...seedFollowMap,
        };
        storagePatch.facebook_friend_collection_owner_map = {
            ...(existingMaps.facebook_friend_collection_owner_map as object),
            ...seedFriendMap,
        };
    }

    await services.storageServices.setStorageCached(storagePatch);

    void refreshPendingFollowsFromUserInfoMap(ctx);
    void refreshPendingFriendsFromUserInfoMap(ctx);

    debounce(
        () => {
            void publishFacebookUserInfo({
                overrideRaw: nextItem.raw,
                overrideParsed: nextItem.parsed,
                overrideId: nextItem.id,
                overrideTs: nextItem.ts,
                waitForDescription: false,
            });
        },
        USERINFO_PUBLISH_DEBOUNCE_MS,
        "fb_user_info_auto_publish",
    );
};
