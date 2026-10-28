import * as services from "../../../services";
import { parseThreadJSONObject, storeThreadsProfileData, THREADS_USER_INFO_KEY } from "./utils";
import { Result, ThreadsUserFollowData, ThreadsUserLocalStorageInfo, ThreadsUserProfileData } from "../types";
import { findAllKeyValuePairs } from "../commons";

function parseFollow(
    followerUser: Partial<ThreadsUserProfileData> | ThreadsUserLocalStorageInfo,
    followedUser: Partial<ThreadsUserProfileData> | ThreadsUserLocalStorageInfo,
): ThreadsUserFollowData | null {
    if (
        !followerUser.profile_id ||
        !followerUser.username ||
        !followerUser.profile_pic_url ||
        !followedUser.profile_id ||
        !followedUser.username
    ) {
        console.log("Missing follower user information");
        return null;
    }
    const followerData: ThreadsUserFollowData = {
        follow_id: "t" + followerUser.profile_id.replace("t", ""),
        follow_rowkey: "t" + followedUser.profile_id.replace("t", "") + "_" + "t" + followerUser.profile_id.replace("t", ""),
        follower_id: "t" + followerUser.profile_id.replace("t", ""),
        follower_name: followerUser.username,
        follower_url: `https://www.threads.com/@${followerUser.username}`,
        follower_avatar: followerUser.profile_pic_url,
        entry_rowkey: "t" + followedUser.profile_id.replace("t", "") + "_" + "t" + followerUser.profile_id.replace("t", ""),
        followed_id: "t" + followedUser.profile_id.replace("t", ""),
        followed_name: followedUser.username,
        source_type: "",
        updated_time: Date.now(),
        inserted_time: Date.now(),
        created_time: Date.now(),
        type: "person",
        docType: "Follow",
        channel_name: "threads",
    }
    return followerData;
}

function parseProfile(dataJSON: any) {
    if (!dataJSON?.id || !dataJSON?.username || !dataJSON?.profile_pic_url) {
        return null;
    }

    const userId = dataJSON.id;
    const userPublicView = dataJSON.text_post_app_public_views?.text_post_app_public_view_count;
    const profileData: ThreadsUserProfileData = {
        entry_rowkey: userId,
        social_id: "t" + userId.replace("t", ""),
        profile_id: "t" + userId.replace("t", ""),
        view_count: userPublicView ? parseInt(userPublicView) : 0,
        follower_count: dataJSON.follower_count ? parseInt(dataJSON.follower_count) : 0,
        profile_pic_url: dataJSON.profile_pic_url,
        created_time: Date.now(),
        inserted_time: Date.now(),
        username: dataJSON.username,
        name: dataJSON.full_name,
        url: `https://www.threads.com/@${dataJSON.username}`,
        is_verified: dataJSON.is_verified,
        docType: "Profile",
        type: "person",
        active: false,
        channel_name: "threads",
        crawler_system: "extension",
    }

    return profileData;
}

export async function parseDataUserProfile(payload: any): Promise<Result<{
    userProfiles: ThreadsUserProfileData[],
    followers: ThreadsUserFollowData[],
}>> {
    const userProfileArray: ThreadsUserProfileData[] = [];
    const followDataArray: ThreadsUserFollowData[] = [];
    const newSavingUser: ThreadsUserProfileData[] = [];

    const userKeyValues: any = findAllKeyValuePairs(payload, "user");
    let userFollowersKeyValues: any[] = []; let isFollowerUrlMatch = false;
    let userFollowingKeyValues: any[] = []; let isFollowingUrlMatch = false;

    let onPageUserData = null;
    let onPageUserId: string | null = null;

    const userResultsObjects = [];
    for (const userKeyValue of userKeyValues) {
        if (userKeyValue?.value?.followers) {
            isFollowerUrlMatch = true;
            userFollowersKeyValues = userKeyValue.value.followers.edges.map((edge: any) => edge.node);
            userResultsObjects.push(...userFollowersKeyValues);

            onPageUserId = userKeyValue.value.id;
        }
        if (userKeyValue?.value?.following) {
            isFollowingUrlMatch = true;
            userFollowingKeyValues = userKeyValue.value.following.edges.map((edge: any) => edge.node);
            userResultsObjects.push(...userFollowingKeyValues);

            onPageUserId = userKeyValue.value.id;
        }
    }

    if (!isFollowerUrlMatch && !isFollowingUrlMatch) {
        userResultsObjects.push(...findAllKeyValuePairs(payload, "user").map(({ value }) => value));
    }

    // console.log(">>>> Found user profile objects:", userResultsObjects);

    try {
        // PARSE USER PROFILE DATA
        // console.log("Found user profile objects:", userProfileKeyValues.length);
        if (userResultsObjects.length > 0) {
            // 1. get on page user information
            if (isFollowerUrlMatch || isFollowingUrlMatch) {
                const localStorageUserProfile = await services.storageService.getStorageByKeys([THREADS_USER_INFO_KEY]);
                const threadsUserInfoStr = localStorageUserProfile[THREADS_USER_INFO_KEY] || "";
                const threadsUserInfoArr = parseThreadJSONObject(threadsUserInfoStr);
                onPageUserData = threadsUserInfoArr.find((u) => u.profile_id.replace("t", "") === onPageUserId?.replace("t", ""));

                if (!onPageUserData) {
                    console.warn("Cannot find on page user profile, followers/following data might be inaccurate:", onPageUserId);
                }
            }

            for (const userProfileValue of userResultsObjects) {

                // PARSE PROFILE
                const profileData = parseProfile(userProfileValue);
                if (!profileData) {
                    console.warn("Failed to parse profile data for user:", userProfileValue);
                    continue;
                }
                userProfileArray.push(profileData);

                // PARSE FOLLOWERS/FOLLOWING
                if (isFollowerUrlMatch && onPageUserData) {
                    const followerUser = profileData;
                    const followedUser = onPageUserData;
                    const followerData = parseFollow(followerUser, followedUser);
                    if (followerData) followDataArray.push(followerData);
                }

                if (isFollowingUrlMatch && onPageUserData) {
                    const followerUser = onPageUserData;
                    const followedUser = profileData;
                    const followerData = parseFollow(followerUser, followedUser);
                    if (followerData) followDataArray.push(followerData);
                }

                if (!isFollowerUrlMatch && !isFollowingUrlMatch) {
                    newSavingUser.push(profileData);
                }
            }

            // store parsed user profile data to local storage and update the user info list
            await storeThreadsProfileData(newSavingUser);
        }

        // console.log("Total parsed user profiles:", userProfileArray.length);
        // console.log("Parsed user profile data:", profiles);
        // console.log("Parsed follow data:", followers);

        // return data
        // console.log(">>>> Parsed user profile data:", userProfileArray);
        // console.log(">>>> Parsed follow data:", followDataArray);
        return { ok: true, data: { userProfiles: userProfileArray, followers: followDataArray } };
    } catch (error: any) {
        console.error(
            "Error (Threads User data parser)",
            error.message
        );
        return { ok: false, error: new Error("Failed to parse Threads user data") };
    }
}