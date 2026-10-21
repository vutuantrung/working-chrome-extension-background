import SparkMD5 from "spark-md5";
import { ThreadsPostData, ThreadsPostLocalStorageInfo, ThreadsUserLocalStorageInfo, ThreadsUserProfileData } from "../types";
import { getStorageByKeys, setStorageCached } from "@/entrypoints/background/services/storageServices";
export const MAXIMUM_USERS = 10;
export const THREADS_USER_INFO_KEY = "threads_user_info";
export const THREADS_POST_INFO_KEY = "threads_post_info";

export function generateKey(timestamp: number, uniqueString: string): string | null {
    if (!uniqueString) {
        return null;
    }

    if (timestamp >= 0 && timestamp <= 9999999999999) {
        const reversedSecondTimestamp = 9999999999999 - timestamp;
        const md5HexString = SparkMD5.hash(uniqueString);
        const md5DecimalString = BigInt("0x" + md5HexString).toString(10);
        const truncated = md5DecimalString.slice(0, 14);

        return `${reversedSecondTimestamp}${truncated}`;
    }

    return null;
}

export function parseThreadsUserInfo(threadsUserInfoStr = ""): ThreadsUserLocalStorageInfo[] {
    if (!threadsUserInfoStr) {
        return [];
    }
    return JSON.parse(threadsUserInfoStr);
}

export async function storeThreadsProfileData(newUsers: ThreadsUserProfileData[] = []): Promise<ThreadsUserLocalStorageInfo[]> {
    const localStorageUserInfo = await getStorageByKeys([THREADS_USER_INFO_KEY]);
    const threadsUserInfoStr = localStorageUserInfo[THREADS_USER_INFO_KEY] || "";
    const currentUserInfo = parseThreadsUserInfo(threadsUserInfoStr);
    const tmpCurrentUserInfo = [...currentUserInfo];
    for (const user of newUsers) {
        const index = tmpCurrentUserInfo.findIndex((u) => u.profile_id === user.profile_id && u.username === user.username);
        if (index !== -1) continue;

        if (tmpCurrentUserInfo.length >= MAXIMUM_USERS) {
            tmpCurrentUserInfo.shift();
        }
        const newSavingUser: ThreadsUserLocalStorageInfo = {
            profile_id: user.profile_id,
            username: user.username,
            full_name: user.name,
            profile_pic_url: user.profile_pic_url,
        };
        tmpCurrentUserInfo.push(newSavingUser);
    }
    setStorageCached({ [THREADS_USER_INFO_KEY]: JSON.stringify(tmpCurrentUserInfo) });
    return tmpCurrentUserInfo;
}

export function parseThreadsPostsInfo(threadsPostsInfoStr = ""): ThreadsPostLocalStorageInfo[] {
    if (!threadsPostsInfoStr) {
        return [];
    }
    return JSON.parse(threadsPostsInfoStr);
}

export async function storeThreadsPostData(postsData: ThreadsPostData[] = []): Promise<ThreadsPostLocalStorageInfo[]> {
    const localStoragePostInfo = await getStorageByKeys([THREADS_POST_INFO_KEY]);
    const threadsPostInfoStr = localStoragePostInfo[THREADS_POST_INFO_KEY] || "";
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

    setStorageCached({ [THREADS_POST_INFO_KEY]: JSON.stringify(tmpCurrentPostInfo) });
    return tmpCurrentPostInfo;
}
