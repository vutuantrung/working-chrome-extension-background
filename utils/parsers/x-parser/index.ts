import { XAttachment, XPostData, XUserFollowData, XUserProfileData } from "../types";
import { parsePostData } from "./parse-data-post";
import { parseDataUserProfile } from "./parse-data-user-profile";

export async function parseXData(dataString: string, requestInfo: any): Promise<{
    postData: XPostData[];
    attachment: XAttachment[];
    userProfiles: XUserProfileData[];
    followData: XUserFollowData[];
}> {
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
            const parsedResult = await parseDataUserProfile(tmpDataJSONValue, requestInfo);
            if (parsedResult.ok) {
                dataArray.userProfiles.push(...parsedResult.data.userProfiles);
                dataArray.followData.push(...parsedResult.data.followers);
            }
        }
    }

    return dataArray;
}