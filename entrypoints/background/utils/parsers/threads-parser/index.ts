import { ThreadsAttachment, ThreadsCommentData, ThreadsPostData, ThreadsUserFollowData, ThreadsUserProfileData } from "../types";
import { parsePostData } from "./parse-data-post";
import { parseDataUserProfile } from "./parse-data-user-profile";
import { storeThreadsPostData } from "./utils";

export async function parseThreadsData(dataString: string, requestPostData: any): Promise<{
    postData: ThreadsPostData[];
    attachment: ThreadsAttachment[];
    userProfileData: ThreadsUserProfileData[];
    followData: ThreadsUserFollowData[];
    commentData: ThreadsCommentData[];
}> {
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
            const parsedResult = await parsePostData(tmpDataJSONValue, requestPostData);
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
            const parsedResult = await parseDataUserProfile(tmpDataJSONValue);
            if (parsedResult.ok) {
                dataArray.userProfileData.push(...parsedResult.data.userProfiles);
                dataArray.followData.push(...parsedResult.data.followers);
                if (dataArray.userProfileData.length > 0 || dataArray.followData.length > 0) {
                    continue;
                }
            }
        }
    }

    return dataArray;
}