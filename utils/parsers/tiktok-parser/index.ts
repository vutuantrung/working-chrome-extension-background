import { TiktokCommentData, TiktokImageData, TiktokPostData, TiktokUserProfileData, TiktokUserFollowData } from "../types";
import { parseDataComment } from "./parse-data-comment";
import { parseDataPost } from "./parse-data-post";
import { parseDataUserProfile } from "./parse-data-user-profile";
import { storeTiktokPostInfo } from "./utils";

export async function parseTiktokData(dataString: string, requestInfo: any)
    : Promise<{
        postData: TiktokPostData[];
        imageData: TiktokImageData[];
        commentData: TiktokCommentData[];
        userData: TiktokUserProfileData[];
        followData: TiktokUserFollowData[];
    }> {
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

    const extra: any = {};

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
                    extra.webAppContext = jsonData?.__DEFAULT_SCOPE__?.["webapp.app-context"];
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
        const parsedResult = parseDataPost(rawDataArray.postData, { ...extra });
        if (parsedResult.ok) {
            postDataArray.push(...parsedResult.data.tiktokPostData);
            imageDataArray.push(...parsedResult.data.tiktokImageData);

            // update current posts in localstorage
            storeTiktokPostInfo(postDataArray);
        }
    }

    {
        const parsedResult = await parseDataComment(rawDataArray.commentData);
        if (parsedResult.ok) {
            commentDataArray.push(...parsedResult.data);
        }
    }

    {
        const parsedResult = await parseDataUserProfile(rawDataArray.userProfileData, { ...extra, requestInfo });
        if (parsedResult.ok) {
            userProfileDataArray.push(...parsedResult.data.userProfiles);
            userFollowsDataArray.push(...parsedResult.data.followers);
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

