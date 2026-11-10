import { ApplicationServices } from "@/entrypoints/background/application-services";
import { XAttachment, XPostData, XUserFollowData, XUserLocalStorageInfo, XUserProfileData } from "../types";
import { parsePostData } from "./parse-data-post";
import { parseDataUserProfile } from "./parse-data-user-profile";
import { parseXUserInfo, X_USER_INFO_KEY } from "./utils";

export async function parseXData(
    dataString: string,
    requestInfo: any,
    applicationServices: ApplicationServices
): Promise<{
    postData: XPostData[];
    attachment: XAttachment[];
    userProfiles: XUserProfileData[];
    followData: XUserFollowData[];
}> {
    const MAXIMUM_USERS = 10;

    async function storeXProfileData(newUsers: XUserProfileData[] = []): Promise<XUserLocalStorageInfo[]> {
        const localStorageUserInfo = await applicationServices.storage?.getStorageByKeys([X_USER_INFO_KEY]);
        const xUserInfoStr = localStorageUserInfo?.[X_USER_INFO_KEY] || "";
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
        await applicationServices.storage?.setStorageCached({ [X_USER_INFO_KEY]: JSON.stringify(tmpCurrentUserInfo) });
        return tmpCurrentUserInfo;
    }

    const dataStringArr: string[] = dataString.split("\n");

    console.log('[requestInfo]', requestInfo)

    const dataArray = {
        postData: [] as XPostData[],
        attachment: [] as XAttachment[],
        userProfiles: [] as XUserProfileData[],
        followData: [] as XUserFollowData[],
    };

    for (let i = 0; i < dataStringArr.length; i++) {
        const tmpDataJSONValue: any = JSON.parse(dataStringArr[i]);

        // POSTS & ATTACHMENTS
        {
            const parsedResult = parsePostData(tmpDataJSONValue);
            if (parsedResult.ok) {
                dataArray.postData.push(...parsedResult.data.postArray);
                dataArray.attachment.push(...parsedResult.data.attachmentArray);
            }
        }

        // USER PROFILES & FOLLOWERS
        {
            const requestUrlParams = new URLSearchParams(decodeURIComponent(requestInfo?.requestUrl || "").split("?")[1] || "");
            const variablesPart = requestUrlParams.get("variables");
            const onPageUserId = variablesPart ? JSON.parse(variablesPart)?.userId : null;
            const localStorageUserProfile = await applicationServices.storage?.getStorageByKeys([X_USER_INFO_KEY]);
            const xUserInfoArr = parseXUserInfo(localStorageUserProfile?.[X_USER_INFO_KEY] || "");
            const cachedUserInfo = xUserInfoArr.find((u) => u.profile_id === onPageUserId);

            const metaData = { ...requestInfo, cachedUserInfo: cachedUserInfo };

            const parsedResult = await parseDataUserProfile(tmpDataJSONValue, metaData);
            if (parsedResult.ok) {
                dataArray.userProfiles.push(...parsedResult.data.userProfiles);
                dataArray.followData.push(...parsedResult.data.followers);

                storeXProfileData(parsedResult.data.localStorageNewUser)
            }
        }
    }

    return dataArray;
}