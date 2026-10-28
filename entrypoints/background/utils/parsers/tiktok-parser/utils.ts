import SparkMD5 from "spark-md5";
import * as services from "../../../services";
import {
  TiktokPostData,
  TiktokPostLocalStorageInfo,
  TiktokUserLocalStorageInfo,
  TiktokUserProfileData,
} from "../types";

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

export async function storeTiktokPostInfo(newGroupPost: TiktokPostData[] = []): Promise<TiktokPostLocalStorageInfo[]> {
  const localStoragePostOwner = await services.storageService.getStorageByKeys([TIKTOK_POST_INFO_KEY]);
  const tiktokPostsOwnersStr = localStoragePostOwner[TIKTOK_POST_INFO_KEY] || "";
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
  services.storageService.setStorageCached({
    [TIKTOK_POST_INFO_KEY]: updatingPostsString,
  });

  return tmpCurrentGroupPosts;
}

export function parseTiktokUserInfo(tiktokUserInfoStr = ""): TiktokUserLocalStorageInfo[] {
  if (!tiktokUserInfoStr) {
    return [];
  }
  return JSON.parse(tiktokUserInfoStr);
}

export async function storeTiktokUserInfo(newUsers: TiktokUserProfileData[] = []): Promise<TiktokUserLocalStorageInfo[]> {
  const localStorageUserInfo = await services.storageService.getStorageByKeys([TIKTOK_USER_INFO_KEY]);
  const tiktokUserInfoStr = localStorageUserInfo[TIKTOK_USER_INFO_KEY] || "";
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
  services.storageService.setStorageCached({ [TIKTOK_USER_INFO_KEY]: JSON.stringify(updatingUserInfoString) });

  return updatingUserInfoString;
}
