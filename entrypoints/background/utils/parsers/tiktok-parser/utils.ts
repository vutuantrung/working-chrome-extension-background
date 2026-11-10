import SparkMD5 from "spark-md5";
import { TiktokPostLocalStorageInfo, TiktokUserLocalStorageInfo } from "../types";

const MAXIMUM_USERS = 30, MAXIMUM_POSTS = 50;
export const TIKTOK_POST_INFO_KEY = "tiktok_posts_info";
export const TIKTOK_USER_INFO_KEY = "tiktok_user_info";

export function parseTiktokPostInfo(tiktokPostsOwnersStr = ""): TiktokPostLocalStorageInfo[] {
  if (!tiktokPostsOwnersStr) {
    return [];
  }
  return tiktokPostsOwnersStr
    .split("::")
    .map((s) => {
      const [postEntryRowkey, postId, ownerId, ownerName] = s.trim().split("|");
      if (!postEntryRowkey || !postId || !ownerId || !ownerName) return null;
      return {
        entry_rowkey: postEntryRowkey,
        post_id: postId,
        owner_id: ownerId,
        owner_name: ownerName,
      };
    })
    .filter((item) => item !== null);
}
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

export function parseTiktokUserInfo(tiktokUserInfoStr = ""): TiktokUserLocalStorageInfo[] {
  if (!tiktokUserInfoStr) {
    return [];
  }
  return JSON.parse(tiktokUserInfoStr);
}
