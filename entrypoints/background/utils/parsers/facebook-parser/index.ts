import { storeFacebookPostInfo } from "./utils";
import {
    FacebookCommentData,
    FacebookGroupJoinedData,
    FacebookImageData,
    FacebookPostData,
    FacebookProfileData,
    FacebookReactionData,
    FacebookUserData,
    FacebookUserFollowData,
    FacebookUserFriendData,
    FacebookUserProfileData,
} from "../types";
import { parseDataJoinedGroup } from "./parse-data-joined-group";
import { parseDataPost } from "./parse-data-post";
import { parseDataUserProfile } from "./parse-data-user-profile";
import { parseDataComment } from "./parse-data-comment";
import { parseDataReaction } from "./parse-data-reaction";
import { parseDataGroupHover } from "./parse-data-group";
import { parseDataFollow } from "./parse-data-follow";
import { parseDataFriend } from "./parse-data-friend";

export async function parseFacebookData(dataString: string): Promise<{
    userData: FacebookUserData[];
    postData: FacebookPostData[];
    imageData: FacebookImageData[];
    groupData: FacebookGroupJoinedData[];
    commentData: FacebookCommentData[];
    reactionData: FacebookReactionData[];
    profileData: FacebookProfileData[];
    followData: FacebookUserFollowData[];
    friendData: FacebookUserFriendData[];
}> {
    const dataStringArr: string[] = [];
    let stringArr = dataString.split("\n");

    const dataArray = {
        userData: {} as FacebookUserData[],
        commentData: [] as FacebookCommentData[],
        postData: [] as FacebookPostData[],
        imageData: [] as FacebookImageData[],
        groupData: [] as FacebookGroupJoinedData[],
        reactionData: [] as FacebookReactionData[],
        profileData: [] as FacebookProfileData[],
        followData: [] as FacebookUserFollowData[],
        friendData: [] as FacebookUserFriendData[],
    };

    for (const s0 of stringArr) {
        // Facebook anti-CSRF prefix: for (;;);{...}
        let s = s0;
        if (typeof s === "string" && s.trim().startsWith("for (;;);")) {
            s = s.trim().replace(/^for \(;;\);/, "");
        }
        if (s.includes("SearchRichPostRenderingStrategy")) {
            const json = JSON.parse(s);
            const edges = json?.["data"]?.["serpResponse"]?.["results"]?.["edges"];
            if (Array.isArray(edges)) {
                for (const edge of edges) {
                    dataStringArr.push(JSON.stringify(edge));
                }
            }
        } else {
            dataStringArr.push(s);
        }
    }

    for (let i = 0; i < dataStringArr.length; i++) {
        let tmpDataStringValue = dataStringArr[i];
        if (
            typeof tmpDataStringValue === "string" &&
            tmpDataStringValue.trim().startsWith("for (;;);")
        ) {
            tmpDataStringValue = tmpDataStringValue
                .trim()
                .replace(/^for \(;;\);/, "");
        }
        const tmpDataJSONValue: any = JSON.parse(tmpDataStringValue);

        // SPONSORE
        if (tmpDataJSONValue?.category === "SPONSORED") {
            dataStringArr[i] = null as any;
            continue;
        }

        //*** CHECK IF DATA IS PROFILE COMET HEADER (user id + name) ***//
        // {
        //     const identity = extractFacebookUserIdAndName(tmpDataJSONValue);
        //     if (identity) {
        //         const finalUpdate: FacebookUserProfileData = {
        //             fbU: JSON.stringify(tmpDataJSONValue),
        //             docType: "Profile",
        //             entry_rowkey: identity.id,
        //         };

        //         dataArray.userData.push(finalUpdate);

        //         dataStringArr[i] = null as any;
        //         continue;
        //     }
        // }

        //*** CHECK IF DATA IS PROFILE COMET HEADER (user id + name) ***//
        {
            const result = parseDataUserProfile(tmpDataJSONValue);
            if (result.ok) {
                dataArray.userData.push(result.data);

                dataStringArr[i] = null as any;
                continue;
            }
        }

        //*** CHECK IF DATA IS REACTION INFO ***//
        {
            const result = await parseDataReaction(tmpDataJSONValue);
            if (result.ok) {
                dataArray.reactionData.push(...result.data);

                dataStringArr[i] = null as any;
                continue;
            }
        }

        //*** CHECK IF DATA IS FRIEND LIST ***//
        {
            const result = parseDataFriend(tmpDataJSONValue);
            if (result.ok) {
                dataArray.friendData.push(...result.data);

                dataStringArr[i] = null as any;
                continue;
            }
        }

        //*** CHECK IF DATA IS FOLLOW / FOLLOWERS INFO ***//
        {
            const result = parseDataFollow(tmpDataJSONValue);
            if (result.ok) {
                dataArray.followData.push(...result.data);

                dataStringArr[i] = null as any;
                continue;
            }
        }

        //*** CHECK IF DATA IS JOINED GROUP INFO ***//
        {
            const result = await parseDataJoinedGroup(tmpDataJSONValue);
            if (result.ok) {
                dataArray.groupData.push(...result.data.fbGroupJoined);

                dataStringArr[i] = null as any;
                continue;
            }
        }

        //*** CHECK IF DATA IS COMMENT INFO ***//
        {
            const result = await parseDataComment(tmpDataJSONValue);
            if (result.ok) {
                dataArray.commentData.push(...result.data);

                dataStringArr[i] = null as any;
                continue;
            }
        }

        //*** CHECK IF DATA POST ***//
        {
            let attachementType:
                | "photo"
                | "profileMedia"
                | "album"
                | "video"
                | "reel"
                | "text" = "text";
            if (dataStringArr[i]?.includes("StoryAttachmentPhotoStyleRenderer")) {
                attachementType = "photo";
            } else if (
                dataStringArr[i]?.includes("StoryAttachmentProfileMediaStyleRenderer")
            ) {
                attachementType = "profileMedia";
            } else if (
                dataStringArr[i]?.includes("StoryAttachmentAlbumStyleRenderer")
            ) {
                attachementType = "album";
            } else if (
                dataStringArr[i]?.includes("StoryAttachmentVideoStyleRenderer")
            ) {
                attachementType = "video";
            } else if (
                dataStringArr[i]?.includes("StoryAttachmentFBReelsStyleRenderer")
            ) {
                attachementType = "reel";
            } else {
                attachementType = "text";
            }

            const result = await parseDataPost(tmpDataJSONValue, attachementType);
            if (result.ok) {
                dataArray.postData.push(...result.data.postDataArray);
                dataArray.imageData.push(...result.data.imageDataArray);
                dataArray.commentData.push(...result.data.commentDataArray);

                dataStringArr[i] = null as any;
                continue;
            }
        }

        //*** CHECK IF DATA GROUP HOVER ***//
        {
            const result = await parseDataGroupHover(tmpDataJSONValue);
            if (result.ok) {
                dataArray.profileData.push(result.data);

                dataStringArr[i] = null as any;
                continue;
            }
        }
    }

    // save to localstorage for later use (e.g. when parse comment, get post owner info from localstorage)
    await storeFacebookPostInfo(dataArray.postData);

    return dataArray;
}
