import { StorageService } from "@/entrypoints/background/services/storageServices";
import { findAllKeyValuePairs } from "../facebook-parser/utils";
import { Result, XUserFollowData, XUserLocalStorageInfo, XUserProfileData } from "../types";
import { parseXUserInfo, storeXProfileData, X_USER_INFO_KEY } from "./utils";

function parseProfile(dataJSON: any): XUserProfileData | null {
    if (!dataJSON?.rest_id) {
        return null
    }

    const profileData: XUserProfileData = {
        active: true,// ?
        protected: dataJSON.privacy?.protected,
        verified: dataJSON.verification?.verified,
        docType: "Profile",
        type: "person",
        channel_name: "twitter",
        description: dataJSON.profile_bio?.description,
        location: dataJSON.location?.location,
        // avatar
        avatar: dataJSON.avatar?.image_url,
        profile_image_url: dataJSON.avatar?.image_url,
        profile_image_url_https: dataJSON.avatar?.image_url,
        profile_banner_url: dataJSON.legacy?.profile_banner_url,
        url: "https://x.com/" + dataJSON.core.screen_name,
        // name
        name: dataJSON.core.name,
        user_name: dataJSON.core.screen_name,
        screen_name: dataJSON.core.screen_name,
        // ids
        entry_rowkey: "",
        profile_id: dataJSON.rest_id,// ?
        hy_doc_id: dataJSON.rest_id,// ?
        id: dataJSON.rest_id,// ?
        id_str: dataJSON.rest_id,// ?
        email: "",// ?
        about_account: {},// ?
        tenant_ids: [],
        created_time: Date.now(),
        "@timestamp": new Date().toISOString(),
        created_at_text: dataJSON.core.created_at,
        profile_created_time: new Date(dataJSON.core.created_at).getTime(),
        // counts
        media_count: dataJSON.legacy.media_count,
        followers_count: dataJSON.legacy.followers_count,
        favourites_count: dataJSON.legacy.favourites_count,
        friends_count: dataJSON.legacy.friends_count,
        statuses_count: dataJSON.legacy.statuses_count,
    }

    return profileData;
}

function parseFollow(
    followerUser: Partial<XUserProfileData> | XUserLocalStorageInfo,
    followedUser: Partial<XUserProfileData> | XUserLocalStorageInfo
) {
    if (
        !followerUser.profile_id ||
        !followerUser.user_name ||
        !followerUser.profile_image_url ||
        !followedUser.profile_id ||
        !followedUser.user_name
    ) {
        console.log("Missing follower user information");
        return null;
    }
    const followerData: XUserFollowData = {
        follow_id: followerUser.profile_id,
        follow_rowkey: followedUser.profile_id + "_" + followerUser.profile_id,
        follower_id: followerUser.profile_id,
        follower_name: followerUser.user_name,
        follower_url: "https://x.com/" + followerUser.user_name,
        follower_avatar: followerUser.profile_image_url,
        entry_rowkey: followedUser.profile_id + "_" + followerUser.profile_id,
        followed_id: followedUser.profile_id,
        followed_name: followedUser.user_name,
        source_type: "",
        updated_time: Date.now(),
        inserted_time: Date.now(),
        created_time: Date.now(),
        type: "person",
        docType: "Follow",
        channel_name: "twitter"
    }
    return followerData;
}

export async function parseDataUserProfile(
    payload: any,
    extra: any,
): Promise<Result<{
    userProfiles: XUserProfileData[],
    followers: XUserFollowData[],
}>> {
    const requestUrl = extra?.requestUrl || "";

    const followerRegex = /^https:\/\/x\.com\/i\/api\/graphql\/[a-zA-Z0-9_-]+\/(Followers|FollowersYouKnow|BlueVerifiedFollowers|UserCreatorSubscriptions)\?/;
    const followingRegex = /^https:\/\/x\.com\/i\/api\/graphql\/[a-zA-Z0-9_-]+\/Following\?/;

    // [TEMPORARY DISABLE]
    // const isFollowerUrlMatch = followerRegex.test(requestUrl);
    // const isFollowingUrlMatch = followingRegex.test(requestUrl);
    const isFollowerUrlMatch = false;
    const isFollowingUrlMatch = false;

    const userProfileArray: XUserProfileData[] = [];
    const followDataArray: XUserFollowData[] = [];
    const newSavingUser: XUserProfileData[] = [];

    try {
        const userResultsObjects = [
            ...findAllKeyValuePairs(payload, "user").map(({ value }) => value?.result),
            ...findAllKeyValuePairs(payload, "user_results").map(({ value }) => value?.result),
            ...findAllKeyValuePairs(payload, "users"),
        ];

        let associateLocalStorageUser = null;
        if (isFollowerUrlMatch || isFollowingUrlMatch) {
            const requestUrlParams = new URLSearchParams(decodeURIComponent(requestUrl).split("?")[1] || "");
            const variablesPart = requestUrlParams.get("variables");
            const onPageUserId = variablesPart ? JSON.parse(variablesPart)?.userId : null;

            const localStorageUserProfile = await StorageService.getInstance().getStorageByKeys([X_USER_INFO_KEY]);
            const xUserInfoStr = localStorageUserProfile[X_USER_INFO_KEY] || "";
            const xUserInfoArr = parseXUserInfo(xUserInfoStr);
            associateLocalStorageUser = xUserInfoArr.find((u) => u.profile_id === onPageUserId);

            if (!associateLocalStorageUser) {
                console.warn("Cannot find on page user profile, followers/following data might be inaccurate:", onPageUserId);
            }
        }

        if (userResultsObjects.length > 0) {
            for (const userResult of userResultsObjects) {
                const profileData = parseProfile(userResult);
                if (!profileData) continue;
                userProfileArray.push(profileData);

                if (isFollowerUrlMatch && associateLocalStorageUser) {
                    const follower = profileData;
                    const followed = associateLocalStorageUser;
                    const followData = parseFollow(follower, followed);
                    if (followData) followDataArray.push(followData);
                }

                if (isFollowingUrlMatch && associateLocalStorageUser) {
                    const follower = associateLocalStorageUser;
                    const followed = profileData;
                    const followData = parseFollow(follower, followed);
                    if (followData) followDataArray.push(followData);
                }

                if (!isFollowerUrlMatch && !isFollowingUrlMatch) {
                    newSavingUser.push(profileData);
                }
            }

            // store parsed user profile data to local storage
            await storeXProfileData(newSavingUser);
        }

        return { ok: true, data: { userProfiles: userProfileArray, followers: followDataArray } };
    } catch (error: any) {
        console.error(
            "Error (X User data parser)",
            error.message
        );
        return { ok: false, error: new Error("Failed to parse X user data") };
    }
}