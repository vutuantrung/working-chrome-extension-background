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
} from "../types";
import { parseDataJoinedGroup } from "./parse-data-joined-group";
import { parseDataPost } from "./parse-data-post";
import { parseDataUserProfile } from "./parse-data-user-profile";
import { parseDataComment } from "./parse-data-comment";
import { parseDataReaction } from "./parse-data-reaction";
import { parseDataGroupHover } from "./parse-data-group";
import { parseDataFollow } from "./parse-data-follow";
import { parseDataFriend } from "./parse-data-friend";
import { parseDataFriendFollowMap } from "./parse-data-follow-friend-map";

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
            const userProfileParseResult = parseDataUserProfile(tmpDataJSONValue);
            const friendFollowParseResult = parseDataFriendFollowMap(tmpDataJSONValue);
            if (userProfileParseResult.ok) {
                const userProfileData = userProfileParseResult.data;
                if (friendFollowParseResult.ok) {
                    userProfileData.followMap = friendFollowParseResult.data.followMap;
                    userProfileData.friendMap = friendFollowParseResult.data.friendMap;
                }
                dataArray.userData.push(userProfileData);

                dataStringArr[i] = null as any;
                continue;
            }
        }

        //*** CHECK IF DATA IS REACTION INFO ***//
        {
            const reactionParseResult = await parseDataReaction(tmpDataJSONValue);
            if (reactionParseResult.ok) {
                dataArray.reactionData.push(...reactionParseResult.data);

                dataStringArr[i] = null as any;
                continue;
            }
        }

        //*** CHECK IF DATA IS FRIEND LIST ***//
        {
            const friendParseResult = parseDataFriend(tmpDataJSONValue);
            if (friendParseResult.ok) {
                dataArray.friendData.push(...friendParseResult.data);

                dataStringArr[i] = null as any;
                continue;
            }
        }

        //*** CHECK IF DATA IS FOLLOW / FOLLOWERS INFO ***//
        {
            const followParseResult = parseDataFollow(tmpDataJSONValue);
            if (followParseResult.ok) {
                dataArray.followData.push(...followParseResult.data);

                dataStringArr[i] = null as any;
                continue;
            }
        }

        //*** CHECK IF DATA IS JOINED GROUP INFO ***//
        {
            const joinedGroupParseResult = await parseDataJoinedGroup(tmpDataJSONValue);
            if (joinedGroupParseResult.ok) {
                dataArray.groupData.push(...joinedGroupParseResult.data.fbGroupJoined);

                dataStringArr[i] = null as any;
                continue;
            }
        }

        //*** CHECK IF DATA IS COMMENT INFO ***//
        {
            const commentParseResult = await parseDataComment(tmpDataJSONValue);
            if (commentParseResult.ok) {
                dataArray.commentData.push(...commentParseResult.data);

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

            const postParseResult = await parseDataPost(tmpDataJSONValue, attachementType);
            if (postParseResult.ok) {
                dataArray.postData.push(...postParseResult.data.postDataArray);
                dataArray.imageData.push(...postParseResult.data.imageDataArray);
                dataArray.commentData.push(...postParseResult.data.commentDataArray);

                dataStringArr[i] = null as any;
                continue;
            }
        }

        //*** CHECK IF DATA GROUP HOVER ***//
        {
            const groupHoverParseResult = await parseDataGroupHover(tmpDataJSONValue);
            if (groupHoverParseResult.ok) {
                dataArray.profileData.push(groupHoverParseResult.data);

                dataStringArr[i] = null as any;
                continue;
            }
        }
    }

    // save to localstorage for later use (e.g. when parse comment, get post owner info from localstorage)
    await storeFacebookPostInfo(dataArray.postData);

    return dataArray;
}
