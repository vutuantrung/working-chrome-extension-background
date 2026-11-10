import { ApplicationServices } from "@/entrypoints/background/application-services";
import {
    TiktokCommentData,
    TiktokImageData,
    TiktokPostData,
    TiktokUserProfileData,
    TiktokUserFollowData,
    TiktokPostLocalStorageInfo,
    TiktokUserLocalStorageInfo
} from "../types";
import { parseDataComment } from "./parse-data-comment";
import { parseDataPost } from "./parse-data-post";
import { parseDataUserProfile } from "./parse-data-user-profile";
import { parseTiktokPostInfo, parseTiktokUserInfo, TIKTOK_POST_INFO_KEY, TIKTOK_USER_INFO_KEY } from "./utils";

export async function parseTiktokData(
    dataString: string,
    requestInfo: any,
    applicationServices: ApplicationServices
): Promise<{
    postData: TiktokPostData[];
    imageData: TiktokImageData[];
    commentData: TiktokCommentData[];
    userData: TiktokUserProfileData[];
    followData: TiktokUserFollowData[];
}> {

    const MAXIMUM_POSTS = 50;
    async function storeTiktokPostInfo(newGroupPost: TiktokPostData[] = []): Promise<TiktokPostLocalStorageInfo[]> {
        const localStoragePostOwner = await applicationServices.storage?.getStorageByKeys([TIKTOK_POST_INFO_KEY]);
        const tiktokPostsOwnersStr = localStoragePostOwner?.[TIKTOK_POST_INFO_KEY] || "";
        const currentGroupPosts = parseTiktokPostInfo(tiktokPostsOwnersStr);
        const tmpCurrentGroupPosts = [...currentGroupPosts];

        for (const newPost of newGroupPost) {
            const index = tmpCurrentGroupPosts.findIndex(
                (p) => p.post_id === newPost.post_id,
            );
            if (index !== -1) continue; // Already have this post info -> pass

            if (tmpCurrentGroupPosts.length >= MAXIMUM_POSTS) {
                tmpCurrentGroupPosts.shift();
            }
            const newSavingPosts: TiktokPostLocalStorageInfo = {
                entry_rowkey: newPost.entry_rowkey,
                post_id: newPost.post_id,
                owner_id: newPost.owner_id,
                owner_name: newPost.owner_name,
            };
            tmpCurrentGroupPosts.push(newSavingPosts);
        }

        const updatingPostsString = tmpCurrentGroupPosts
            .map((p) => `${p.entry_rowkey}|${p.post_id}|${p.owner_id}|${p.owner_name}`)
            .join("::");
        applicationServices.storage?.setStorageCached({
            [TIKTOK_POST_INFO_KEY]: updatingPostsString,
        });

        return tmpCurrentGroupPosts;
    }

    const MAXIMUM_USERS = 30;
    async function storeTiktokUserInfo(newUsers: TiktokUserProfileData[] = []): Promise<TiktokUserLocalStorageInfo[]> {
        const localStorageUserInfo = await applicationServices.storage?.getStorageByKeys([TIKTOK_USER_INFO_KEY]);
        const tiktokUserInfoStr = localStorageUserInfo?.[TIKTOK_USER_INFO_KEY] || "";
        const currentUserInfo = parseTiktokUserInfo(tiktokUserInfoStr);
        const tmpCurrentUserInfo = [...currentUserInfo];
        for (const user of newUsers) {
            const index = tmpCurrentUserInfo.findIndex(
                (u) => u.id === user.id && u.uniqueId === user.uniqueId,
            );
            if (index !== -1) continue;

            if (tmpCurrentUserInfo.length >= MAXIMUM_USERS) {
                tmpCurrentUserInfo.shift();
            }
            const newSavingUser = {
                secUid: user.secUid,
                avatar: user.avatar,
                id: user.id,
                name: user.name,
                uniqueId: user.uniqueId,
                signature: user.signature,
            };
            tmpCurrentUserInfo.push(newSavingUser);
        }

        const updatingUserInfoString = tmpCurrentUserInfo.map((u) => {
            const user: any = {
                secUid: u.secUid,
                avatar: u.avatar,
                id: u.id,
                name: u.name,
                uniqueId: u.uniqueId,
                signature: u.signature,
            };
            return user;
        });
        applicationServices.storage?.setStorageCached({ [TIKTOK_USER_INFO_KEY]: JSON.stringify(updatingUserInfoString) });

        return updatingUserInfoString;
    }


    const rawDataArray = {
        postData: [] as { data: any, getMethod: string }[],
        imageData: [] as { data: any, getMethod: string }[],
        commentData: [] as { data: any, getMethod: string }[],
        userProfileData: [] as { data: any, getMethod: string }[],
    };

    const postDataArray: TiktokPostData[] = [];
    const imageDataArray: TiktokImageData[] = [];
    const commentDataArray: TiktokCommentData[] = [];
    const userProfileDataArray: TiktokUserProfileData[] = [];
    const userFollowsDataArray: TiktokUserFollowData[] = [];

    const extras: any = {};

    // 1. FITLERING & SPLIT dataString to multiple raw data (for post, comment, user profile, etc.)
    if (dataString.includes("__UNIVERSAL_DATA_FOR_REHYDRATION__")) {
        try {
            // console.log("__UNIVERSAL_DATA_FOR_REHYDRATION__"); // server side rendered data
            const regScript = /<script\b[^>]\b[^>]*id=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/;
            const match = dataString.match(regScript);
            if (match && match[1]) {
                const jsonData = JSON.parse(match[1]);

                // For post profile info
                const itemStruct = jsonData?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct;
                if (itemStruct) {
                    rawDataArray.postData.push({ data: itemStruct, getMethod: "page" });
                }
                const updatedItems = jsonData?.__DEFAULT_SCOPE__?.["webapp.updated-items"];
                if (updatedItems) {
                    rawDataArray.postData.push(...updatedItems.map((item: any) => ({ data: item, getMethod: "page" })));
                }

                // For user profile info
                const userInfo = jsonData?.__DEFAULT_SCOPE__?.["webapp.user-detail"]?.userInfo;
                if (userInfo) {
                    rawDataArray.userProfileData.push({ data: userInfo, getMethod: "page" });
                    extras.webAppContext = jsonData?.__DEFAULT_SCOPE__?.["webapp.app-context"];
                }
            }
        } catch { }
    } else {
        let stringArr = dataString.split("\n");
        try {
            // console.log("__OTHERS__"); // api response data
            for (const s of stringArr) {
                const jsonData = JSON.parse(s);

                // For posts info
                const itemStruct = jsonData?.itemStruct;
                if (itemStruct) {
                    rawDataArray.postData.push({ data: itemStruct, getMethod: "api" });
                }
                const itemList = jsonData?.itemList || jsonData?.userInfoList?.map((e: any) => (Array.isArray(e.itemList) ? e.itemList : [])).flat();
                if (itemList && Array.isArray(itemList) && itemList.length > 0) {
                    rawDataArray.postData.push(...itemList.map((item: any) => ({ data: item, getMethod: "api" })));
                }

                // For comments info
                const comments = jsonData?.comments;
                if (comments && Array.isArray(comments) && comments.length > 0) {
                    rawDataArray.commentData.push(...comments.map((comment: any) => ({ data: comment, getMethod: "api" })));
                }

                // For user profile info
                const userInfo = jsonData?.userInfo;
                if (userInfo) {
                    rawDataArray.userProfileData.push({ data: userInfo, getMethod: "api" });
                }
                const userList = jsonData?.userList || jsonData?.userInfoList;
                if (userList && Array.isArray(userList) && userList.length > 0) {
                    rawDataArray.userProfileData.push(...userList.map((user: any) => ({ data: user, getMethod: "api" })));
                }
            }
        } catch { }

        // free-up variable
        stringArr = null as any;
    }

    // 2. PARSE
    {
        const parsedResult = parseDataPost(rawDataArray.postData, { ...extras });
        if (parsedResult.ok) {
            postDataArray.push(...parsedResult.data.tiktokPostData);
            imageDataArray.push(...parsedResult.data.tiktokImageData);

            // update current posts in localstorage
            storeTiktokPostInfo(postDataArray);
        }
    }

    {
        // 1. get owner info of posts from localstorage
        // format: postEntryRowkey|postId|ownerId|ownerName, split by comma for multiple records
        const localStoragePostOwner = await applicationServices.storage?.getStorageByKeys([TIKTOK_POST_INFO_KEY]);
        const tiktokPostsCached = localStoragePostOwner?.[TIKTOK_POST_INFO_KEY] || "";
        const tiktokPostsCachedArr = parseTiktokPostInfo(tiktokPostsCached);

        const parsedResult = await parseDataComment(rawDataArray.commentData, { cachedPostArray: tiktokPostsCachedArr });
        if (parsedResult.ok) {
            commentDataArray.push(...parsedResult.data);
        }
    }

    {
        const onPageUserUniqueId = requestInfo?.tabUrl?.replace("https://www.tiktok.com/@", "");
        const localStorageUserProfile = await applicationServices.storage?.getStorageByKeys([TIKTOK_USER_INFO_KEY]);
        const tiktokUserInfoArr = parseTiktokUserInfo(localStorageUserProfile?.[TIKTOK_USER_INFO_KEY] || "");
        const tiktokLocalStorageUser = tiktokUserInfoArr.find((u) => u.uniqueId === onPageUserUniqueId);

        const metaData = { ...extras, requestInfo: { ...requestInfo, cachedUserInfo: tiktokLocalStorageUser } };

        const parsedResult = await parseDataUserProfile(rawDataArray.userProfileData, metaData);
        if (parsedResult.ok) {
            userProfileDataArray.push(...parsedResult.data.userProfiles);
            userFollowsDataArray.push(...parsedResult.data.followers);

            storeTiktokUserInfo(parsedResult.data.localStorageNewUser);
        }
    }

    // 4. RETURN PARSED DATA
    const dataArray = {
        postData: postDataArray,
        imageData: imageDataArray,
        commentData: commentDataArray,
        userData: userProfileDataArray,
        followData: userFollowsDataArray,
    };

    return dataArray;
}

