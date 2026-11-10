import { ApplicationServices } from "@/entrypoints/background/application-services";
import {
    ThreadsAttachment,
    ThreadsCommentData,
    ThreadsPostData,
    ThreadsPostLocalStorageInfo,
    ThreadsUserFollowData,
    ThreadsUserLocalStorageInfo,
    ThreadsUserProfileData
} from "../types";
import { parsePostData } from "./parse-data-post";
import { parseDataUserProfile } from "./parse-data-user-profile";
import { parseThreadJSONObject, parseThreadsPostsInfo, THREADS_POST_INFO_KEY, THREADS_USER_INFO_KEY } from "./utils";

export async function parseThreadsData(
    dataString: string,
    requestPostData: any,
    applicationServices: ApplicationServices
): Promise<{
    postData: ThreadsPostData[];
    attachment: ThreadsAttachment[];
    userProfileData: ThreadsUserProfileData[];
    followData: ThreadsUserFollowData[];
    commentData: ThreadsCommentData[];
}> {
    const MAXIMUM_USERS = 10;

    async function storeThreadsProfileData(newUsers: ThreadsUserProfileData[] = []): Promise<ThreadsUserLocalStorageInfo[]> {
        const localStorageUserInfo = await applicationServices.storage?.getStorageByKeys([THREADS_USER_INFO_KEY]);
        const threadsUserInfoStr = localStorageUserInfo?.[THREADS_USER_INFO_KEY] || "";
        const currentUserInfo = parseThreadJSONObject(threadsUserInfoStr);
        const tmpCurrentUserInfo = [...currentUserInfo];
        for (const user of newUsers) {
            const index = tmpCurrentUserInfo.findIndex((u) => u.profile_id === user.profile_id && u.username === user.username);
            if (index !== -1) continue;

            if (tmpCurrentUserInfo.length >= MAXIMUM_USERS) {
                tmpCurrentUserInfo.shift();
            }
            const newRecord: ThreadsUserLocalStorageInfo = {
                profile_id: user.profile_id,
                username: user.username,
                full_name: user.name,
                profile_pic_url: user.profile_pic_url,
            };
            tmpCurrentUserInfo.push(newRecord);
        }
        applicationServices.storage?.setStorageCached({ [THREADS_USER_INFO_KEY]: JSON.stringify(tmpCurrentUserInfo) });
        return tmpCurrentUserInfo;
    }

    async function storeThreadsPostData(postsData: ThreadsPostData[] = []): Promise<ThreadsPostLocalStorageInfo[]> {
        const localStoragePostInfo = await applicationServices.storage?.getStorageByKeys([THREADS_POST_INFO_KEY]);
        const threadsPostInfoStr = localStoragePostInfo?.[THREADS_POST_INFO_KEY] || "";
        const currentPostInfo = parseThreadsPostsInfo(threadsPostInfoStr);
        const tmpCurrentPostInfo = [...currentPostInfo];

        for (const newPost of postsData) {
            const newPostKey = newPost.post_id.split("_")[0];
            const index = tmpCurrentPostInfo.findIndex((p) => p.post_key === newPostKey && p.profile_id === newPost.owner_id);
            if (index !== -1) {
                console.log("Post info already exists in local storage, skip saving. Post ID:", newPost.post_id, "Profile ID:", newPost.owner_id);
                continue;
            }
            if (tmpCurrentPostInfo.length >= MAXIMUM_USERS) {
                tmpCurrentPostInfo.shift();
            }
            const newPostLocalStorageInfo: ThreadsPostLocalStorageInfo = {
                post_key: newPostKey,
                profile_id: newPost.owner_id,
                full_name: newPost.owner_name ? newPost.owner_name : newPost.owner_username,
                username: newPost.owner_username,
            };
            tmpCurrentPostInfo.push(newPostLocalStorageInfo);
        }

        applicationServices.storage?.setStorageCached({ [THREADS_POST_INFO_KEY]: JSON.stringify(tmpCurrentPostInfo) });
        return tmpCurrentPostInfo;
    }

    const dataStringArr: string[] = dataString.split("\n");

    const dataArray = {
        postData: [] as ThreadsPostData[],
        attachment: [] as ThreadsAttachment[],
        followData: [] as ThreadsUserFollowData[],
        commentData: [] as ThreadsCommentData[],
        userProfileData: [] as ThreadsUserProfileData[],
    };

    for (let i = 0; i < dataStringArr.length; i++) {
        const tmpDataJSONValue: any = JSON.parse(dataStringArr[i]);

        // POST
        {
            const localStoragePostInfo = await applicationServices.storage?.getStorageByKeys([THREADS_POST_INFO_KEY]);
            const threadsPostInfoStr = localStoragePostInfo?.[THREADS_POST_INFO_KEY] || "";
            const cachedPostInfo = parseThreadsPostsInfo(threadsPostInfoStr);
            const parsedResult = await parsePostData(tmpDataJSONValue, { requestPostData, cachedPostInfo });
            if (parsedResult.ok) {
                dataArray.postData.push(...parsedResult.data.postArray);
                dataArray.attachment.push(...parsedResult.data.attachmentArray);
                dataArray.commentData.push(...parsedResult.data.commentArray);
                if (dataArray.postData.length > 0 || dataArray.attachment.length > 0 || dataArray.commentData.length > 0) {
                    continue;
                }

                storeThreadsPostData(dataArray.postData);
            }
        }

        // USER PROFILE
        {
            const localStorageUserProfile = await applicationServices.storage?.getStorageByKeys([THREADS_USER_INFO_KEY]);
            const threadsUserInfoStr = localStorageUserProfile?.[THREADS_USER_INFO_KEY] || "";
            const threadsUserInfoArr = parseThreadJSONObject(threadsUserInfoStr);
            const parsedResult = await parseDataUserProfile(tmpDataJSONValue, { threadsUserInfoArr });
            if (parsedResult.ok) {
                dataArray.userProfileData.push(...parsedResult.data.userProfiles);
                dataArray.followData.push(...parsedResult.data.followers);
                if (dataArray.userProfileData.length > 0 || dataArray.followData.length > 0) {
                    continue;
                }

                storeThreadsProfileData(parsedResult.data.localStorageNewUser);
            }
        }
    }

    return dataArray;
}