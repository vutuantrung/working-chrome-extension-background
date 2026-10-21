import { Result, TiktokUserFollowData, TiktokUserLocalStorageInfo, TiktokUserProfileData } from "../types";
import { parseTiktokUserInfo, storeTiktokUserInfo, TIKTOK_USER_INFO_KEY } from "./utils";
import { getStorageByKeys } from "@/entrypoints/background/services/storageServices";

function parseProfile(dataJSON: any, extra: any): TiktokUserProfileData | null {
    if (!dataJSON.user.id) {
        return null;
    }

    const stats = dataJSON.statsV2 || dataJSON.stats || {};
    const createTime = !dataJSON.createTime
        ? null
        : dataJSON.createTime.toString().length === Date.now().toString().length
            ? parseInt(String(dataJSON.createTime))
            : parseInt(String(dataJSON.createTime)) * 1000;

    const profileData: TiktokUserProfileData = {
        // statsV2
        videosCount: stats.videosCount ?? "0",
        followingCount: stats.followingCount ?? "0",
        followerCount: stats.followerCount ?? "0",
        heartCount: stats.heart ?? "0",
        diggCount: stats.diggCount ?? "0",
        friendCount: stats.friendCount ?? "0",
        // user
        url: `https://tiktok.com/@${dataJSON.user.id}`,
        portia_spider: "",
        id: dataJSON.user.id,
        avatar: dataJSON.user.avatarLarger || dataJSON.user.avatarMedium || dataJSON.user.avatarThumb,
        social_id: dataJSON.user.id,
        profile_id: dataJSON.user.id,
        name: dataJSON.user.nickname,
        uniqueId: dataJSON.user.uniqueId,
        privateAccount: dataJSON.user.privateAccount,
        verified: dataJSON.user.verified,
        signature: dataJSON.user.signature,
        secUid: dataJSON.user.secUid,
        created_time: createTime,
        "@timestamp": createTime ? new Date(createTime).toISOString() : null,
        // others
        activity: true,
        social_site: "tiktok",
        description: "",
        type: "person",
        main_page: "",
        channel_name: "tiktok",
        is_active: true,
        seed_url: "",
        is_vip: false,
        docType: "Profile",
        active: true,
        source_type: "",
        tenant_ids: [],
        ttl: 0,
        created_by: 1,
        domain: "tiktok.com",
        phone: "",
        region: extra?.region || "",
        locations: [],
        entry_rowkey: dataJSON.user.id
    };
    return profileData;
}

function parseFollow(
    followerUser: TiktokUserProfileData | TiktokUserLocalStorageInfo,
    followedUser: TiktokUserProfileData | TiktokUserLocalStorageInfo,
): TiktokUserFollowData {
    const followerData: TiktokUserFollowData = {
        follow_id: followerUser.secUid,
        follow_rowkey: followedUser.id + "_" + followerUser.id,
        follower_id: followerUser.id,
        follower_name: followerUser.name,
        follower_url: "https://www.tiktok.com/@" + followerUser.uniqueId,
        follower_avatar: followerUser.avatar,
        follower_sub_text: followerUser.signature,
        followed_id: followedUser.id,
        followed_name: followedUser.name,
        entry_rowkey: followedUser.id + "_" + followerUser.id,
        source_type: "",
        updated_time: Date.now(),
        inserted_time: Date.now(),
        created_time: Date.now(),
        type: "person",
        docType: "Follow",
        channel_name: "tiktok"
    }
    return followerData;
}

export async function parseDataUserProfile(
    dataArr: { data: any, getMethod: string }[] = [],
    extra: any = {},
): Promise<Result<{
    userProfiles: TiktokUserProfileData[],
    followers: TiktokUserFollowData[],
}>> {
    const requestUrl = extra?.requestInfo?.requestUrl || "";

    const isFollowerList = requestUrl?.includes("/api/user/list/") && requestUrl?.includes("&scene=67");
    const isFollowingList = requestUrl?.includes("/api/user/list/") && requestUrl?.includes("&scene=21");

    const userProfileArray: TiktokUserProfileData[] = [];
    const followDataArray: TiktokUserFollowData[] = [];
    const newSavingUsers: TiktokUserProfileData[] = [];

    try {
        // Get current on page user profile (from parsed data or local storage)
        let associateLocalStorageUser = null;
        if (isFollowerList || isFollowingList) {
            const onPageUserUniqueId = extra?.requestInfo?.tabUrl?.replace("https://www.tiktok.com/@", "");
            const onPageUserProfileFromTab = userProfileArray.find((u) => u.uniqueId === onPageUserUniqueId);

            const localStorageUserProfile = await getStorageByKeys([TIKTOK_USER_INFO_KEY]);
            const tiktokUserInfoStr = localStorageUserProfile[TIKTOK_USER_INFO_KEY] || "";
            const tiktokUserInfoArr = parseTiktokUserInfo(tiktokUserInfoStr);
            const tiktokLocalStorageUser = tiktokUserInfoArr.find((u) => u.uniqueId === onPageUserUniqueId);

            associateLocalStorageUser = tiktokLocalStorageUser || onPageUserProfileFromTab;

            if (!associateLocalStorageUser) {
                console.warn("Cannot find on page user profile, followers/following data might be inaccurate:", onPageUserUniqueId);
            }
        }

        if (dataArr.length > 0) {
            for (const { data: dataJSON } of dataArr) {

                // PARSE PROFILE
                const profileData = parseProfile(dataJSON, extra);
                if (!profileData) continue;
                userProfileArray.push(profileData);


                // PARSE FOLLOWERS/FOLLOWING
                // https://www.tiktok.com/@<userUniqueId>
                if (isFollowingList && associateLocalStorageUser) {
                    const followedUser = profileData;
                    const followerUser = associateLocalStorageUser;
                    const followerData = parseFollow(followerUser, followedUser);
                    followDataArray.push(followerData);
                }

                if (isFollowerList && associateLocalStorageUser) {
                    const followerUser = profileData;
                    const followedUser = associateLocalStorageUser;
                    const followerData = parseFollow(followerUser, followedUser);
                    followDataArray.push(followerData);
                }

                if (!isFollowerList && !isFollowingList) {
                    newSavingUsers.push(profileData);
                }
            }
        }

        await storeTiktokUserInfo(newSavingUsers);

        // return data
        return { ok: true, data: { userProfiles: userProfileArray, followers: followDataArray } };

    } catch (error: any) {
        console.error(
            "Error (Tiktok User data parser)",
            error.message
        );
        return { ok: false, error: new Error("Failed to parse TikTok user data") };
    }
}