import SparkMD5 from "spark-md5";
import { XUserLocalStorageInfo, XUserProfileData } from "../types";
import { StorageService } from "@/entrypoints/background/services/storageServices";

export const X_USER_INFO_KEY = "x_user_info";
export const MAXIMUM_USERS = 10;

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

export function parseXUserInfo(xUserInfoStr = ""): XUserLocalStorageInfo[] {
    if (!xUserInfoStr) {
        return [];
    }
    return JSON.parse(xUserInfoStr);
}

export async function storeXProfileData(newUsers: XUserProfileData[] = []): Promise<XUserLocalStorageInfo[]> {
    const localStorageUserInfo = await StorageService.getInstance().getStorageByKeys([X_USER_INFO_KEY]);
    const xUserInfoStr = localStorageUserInfo[X_USER_INFO_KEY] || "";
    const currentUserInfo = parseXUserInfo(xUserInfoStr);
    const tmpCurrentUserInfo = [...currentUserInfo];
    for (const user of newUsers) {
        const index = tmpCurrentUserInfo.findIndex((u) => u.profile_id === user.profile_id && u.user_name === user.user_name);
        if (index !== -1) continue;

        if (tmpCurrentUserInfo.length >= MAXIMUM_USERS) {
            tmpCurrentUserInfo.shift();
        }
        const newSavingUser: XUserLocalStorageInfo = {
            profile_id: user.profile_id,
            user_name: user.user_name,
            name: user.name,
            profile_image_url: user.profile_image_url,
        };
        tmpCurrentUserInfo.push(newSavingUser);
    }
    StorageService.getInstance().setStorageCached({ [X_USER_INFO_KEY]: JSON.stringify(tmpCurrentUserInfo) });
    return tmpCurrentUserInfo;
}