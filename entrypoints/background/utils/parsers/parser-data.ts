import * as helpers from "../helpers";
import { parseFacebookData } from "./facebook-parser";
import { parseThreadsData } from "./threads-parser";
import { parseTiktokData } from "./tiktok-parser";
import { parseXData } from "./x-parser";
import { ParseType } from "./types";
import { parseYoutubeData } from "./youtube-parser";

export async function parseData(dataString: string, requestInfo: any): Promise<ParseType[]> {
  const dataReturn: ParseType[] = [];

  const platform = helpers.tabControl.distinctPlatformByRequestUrl(
    requestInfo.requestUrl,
    requestInfo.tabUrl,
  );
  // console.log(">>>>>> parseData - platform:", platform, "requestUrl:", requestInfo.requestUrl);
  if (!dataString || !platform) {
    return dataReturn;
  }

  // FACEBOOK
  if (platform === "facebook") {
    const parsingResult = await parseFacebookData(dataString);
    if (parsingResult?.postData?.length) { dataReturn.push({ typeName: "FacebookPostData", data: parsingResult.postData }); }
    if (parsingResult?.imageData?.length) { dataReturn.push({ typeName: "FacebookImageData", data: parsingResult.imageData }); }
    if (parsingResult?.groupData?.length) { dataReturn.push({ typeName: "FacebookGroupJoinedData", data: parsingResult.groupData }); }
    if (parsingResult?.commentData?.length) { dataReturn.push({ typeName: "FacebookCommentData", data: parsingResult.commentData }); }
    if (parsingResult?.userData?.length) { dataReturn.push({ typeName: "FacebookUserProfileData", data: parsingResult.userData }); }
    if (parsingResult?.followData?.length) { dataReturn.push({ typeName: "FacebookUserFollowerData", data: parsingResult.followData }); }
    if (parsingResult?.friendData?.length) { dataReturn.push({ typeName: "FacebookUserFriendData", data: parsingResult.friendData }); }
    if (parsingResult?.reactionData?.length) { dataReturn.push({ typeName: "FacebookReactionData", data: parsingResult.reactionData }); }
    if (parsingResult?.profileData?.length) { dataReturn.push({ typeName: "FacebookProfileData", data: parsingResult.profileData }); }
  }

  // TIKTOK
  if (platform === "tiktok") {
    const parsingResult = await parseTiktokData(dataString, requestInfo);
    if (parsingResult?.postData?.length) { dataReturn.push({ typeName: "TiktokPostData", data: parsingResult.postData }); }
    if (parsingResult?.commentData?.length) { dataReturn.push({ typeName: "TiktokCommentData", data: parsingResult.commentData }); }
    if (parsingResult?.userData?.length) { dataReturn.push({ typeName: "TiktokUserProfileData", data: parsingResult.userData }); }
    if (parsingResult?.followData?.length) {
      //console.log(">>>>>>> parseData - followData:", parsingResult.followData);
      dataReturn.push({ typeName: "TiktokUserFollowerData", data: parsingResult.followData });
    }
    if (parsingResult?.imageData?.length) { dataReturn.push({ typeName: "TiktokImageData", data: parsingResult.imageData }); }
  }

  // X (Twitter)
  if (platform === "x") {
    const parsingResult = await parseXData(dataString, requestInfo);
    if (parsingResult?.postData?.length) { dataReturn.push({ typeName: "XPostData", data: parsingResult.postData }); }
    if (parsingResult?.attachment?.length) { dataReturn.push({ typeName: "XAttachmentData", data: parsingResult.attachment }); }
    if (parsingResult?.userProfiles?.length) { dataReturn.push({ typeName: "XUserProfileData", data: parsingResult.userProfiles }); }
    if (parsingResult?.followData?.length) { dataReturn.push({ typeName: "XUserFollowerData", data: parsingResult.followData }); }
  }

  // THREADS
  if (platform === "threads") {
    const parsingResult = await parseThreadsData(dataString, requestInfo.postData);
    if (parsingResult?.postData?.length) { dataReturn.push({ typeName: "ThreadsPostData", data: parsingResult.postData }) }
    if (parsingResult?.attachment?.length) { dataReturn.push({ typeName: "ThreadsAttachmentData", data: parsingResult.attachment, }); }
    if (parsingResult?.userProfileData?.length) { dataReturn.push({ typeName: "ThreadsUserProfileData", data: parsingResult.userProfileData }); }
    if (parsingResult?.followData?.length) { dataReturn.push({ typeName: "ThreadsUserFollowerData", data: parsingResult.followData }); }
    if (parsingResult?.commentData?.length) { dataReturn.push({ typeName: "ThreadsCommentData", data: parsingResult.commentData }); }
  }

  if (platform === "youtube") {
    const parsingResult = await parseYoutubeData(dataString, requestInfo);
    if (parsingResult?.postData?.length) { dataReturn.push({ typeName: "YoutubePostData", data: parsingResult.postData }) }
    if (parsingResult?.commentData?.length) { dataReturn.push({ typeName: "YoutubeCommentData", data: parsingResult.commentData }) }
    if (parsingResult?.userProfiles?.length) { dataReturn.push({ typeName: "YoutubeUserProfileData", data: parsingResult.userProfiles }) }
    if (parsingResult?.imageData?.length) { dataReturn.push({ typeName: "YoutubeImageData", data: parsingResult.imageData }) }
  }

  return dataReturn;
}
