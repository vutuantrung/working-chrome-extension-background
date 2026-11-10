import SparkMD5 from "spark-md5";
import { ThreadsPostData, ThreadsPostLocalStorageInfo, ThreadsUserLocalStorageInfo, ThreadsUserProfileData } from "../types";

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

export function parseThreadJSONObject(threadsUserInfoStr = ""): ThreadsUserLocalStorageInfo[] {
    if (!threadsUserInfoStr) {
        return [];
    }
    return JSON.parse(threadsUserInfoStr);
}

export function parseThreadsPostsInfo(threadsPostsInfoStr = ""): ThreadsPostLocalStorageInfo[] {
    if (!threadsPostsInfoStr) {
        return [];
    }
    return JSON.parse(threadsPostsInfoStr);
}