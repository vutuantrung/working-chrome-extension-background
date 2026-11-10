import { ApplicationServices } from "@/entrypoints/background/application-services";
import {
  YoutubeCommentData,
  YoutubeImageData,
  YoutubePostData,
  YoutubeProfileLocalStorageInfo,
  YoutubePostLocalStorageInfo,
  YoutubeUserProfileData
} from "../types";
import { parseCommentData } from "./parse-data-comment";
import { parseTranscriptData } from "./parse-data-transcript";
import { parseDataUserProfile } from "./parse-data-user-profile";
import { parsePostData } from "./parse-data-video";
import {
  parseYoutubePostsInfo,
  parseYoutubeProfilesInfo,
  YOUTUBE_POST_INFO_KEY,
  YOUTUBE_PROFILE_INFO_KEY
} from "./utils";
import { parseDataUserChannel } from "./parse-data-user-channel";

export async function parseYoutubeData(
  dataString: string,
  requestInfo: any,
  applicationServices: ApplicationServices
): Promise<{
  postData: YoutubePostData[];
  commentData: YoutubeCommentData[];
  userProfiles: YoutubeUserProfileData[];
  imageData: YoutubeImageData[];
}> {
  const MAXIMUM_USERS = 10;
  async function storeYoutubeProfileData(newProfiles: YoutubeProfileLocalStorageInfo[] = []): Promise<YoutubeProfileLocalStorageInfo[]> {
    const localStoragePostInfo = await applicationServices.storage?.getStorageByKeys([YOUTUBE_PROFILE_INFO_KEY]);
    const youtubeProfileInfoStr = localStoragePostInfo?.[YOUTUBE_PROFILE_INFO_KEY] || "";
    const currentProfileInfo = parseYoutubeProfilesInfo(youtubeProfileInfoStr);
    const tmpCurrentProfileInfo = [...currentProfileInfo];

    for (const newProfile of newProfiles) {
      const index = tmpCurrentProfileInfo.findIndex((p) => p.profile_id === newProfile.profile_id);
      if (index !== -1) {
        console.log("Profile info already exists in local storage, skip saving. Profile ID:", newProfile.profile_id);
        continue;
      }
      if (tmpCurrentProfileInfo.length >= MAXIMUM_USERS) {
        tmpCurrentProfileInfo.shift();
      }
      const newPostLocalStorageInfo: YoutubeProfileLocalStorageInfo = { ...newProfile };
      tmpCurrentProfileInfo.push(newPostLocalStorageInfo);
    }

    applicationServices.storage?.setStorageCached({ [YOUTUBE_PROFILE_INFO_KEY]: JSON.stringify(tmpCurrentProfileInfo) });
    return tmpCurrentProfileInfo;
  }

  async function storeYoutubePostData(newPosts: YoutubePostData[] = []): Promise<YoutubePostLocalStorageInfo[]> {
    const localStoragePostInfo = await applicationServices.storage?.getStorageByKeys([YOUTUBE_POST_INFO_KEY]);
    const youtubePostInfoStr = localStoragePostInfo?.[YOUTUBE_POST_INFO_KEY] || "";
    const currentPostInfo = parseYoutubePostsInfo(youtubePostInfoStr);
    const tmpCurrentPostInfo = [...currentPostInfo];

    for (const newPost of newPosts) {
      const index = tmpCurrentPostInfo.findIndex((p) => p.post_id === newPost.post_id);
      if (index !== -1) {
        console.log("Post info already exists in local storage, skip saving. Post ID:", newPost.post_id, "Profile ID:", newPost.owner_id);
        continue;
      }
      if (tmpCurrentPostInfo.length >= MAXIMUM_USERS) {
        tmpCurrentPostInfo.shift();
      }
      const newPostLocalStorageInfo: YoutubePostLocalStorageInfo = {
        entry_rowkey: newPost.entry_rowkey,
        post_id: newPost.post_id,
        owner_id: newPost.owner_id,
        owner_name: newPost.owner_name || newPost.author_name,
      };
      tmpCurrentPostInfo.push(newPostLocalStorageInfo);
    }

    applicationServices.storage?.setStorageCached({ [YOUTUBE_POST_INFO_KEY]: JSON.stringify(tmpCurrentPostInfo) });
    return tmpCurrentPostInfo;
  }

  const postDataArray: YoutubePostData[] = []
  const commentDataArray: YoutubeCommentData[] = []
  const userProfileDataArray: YoutubeUserProfileData[] = []
  const imageDataArray: YoutubeImageData[] = []

  const requestUrl = new URL(requestInfo.requestUrl);
  switch (requestUrl.pathname) {
    case "/":
    case "/youtubei/v1/search":
    case "/youtubei/v1/get_watch": {
      const parsedResult = parsePostData(dataString, requestUrl.pathname);
      if (parsedResult.ok) {
        postDataArray.push(...parsedResult.data.youtubePostData);
        imageDataArray.push(...parsedResult.data.youtubeImageData);

        storeYoutubePostData(parsedResult.data.youtubePostData)
      }

      break;
    }

    case "/youtubei/v1/next": {
      const localStoragePostOwner = await applicationServices.storage?.getStorageByKeys([YOUTUBE_POST_INFO_KEY]);
      const cachedPostArray = parseYoutubePostsInfo(localStoragePostOwner?.[YOUTUBE_POST_INFO_KEY] || "");
      const parsedResult = await parseCommentData(dataString, { cachedPostArray });
      if (parsedResult.ok) {
        commentDataArray.push(...parsedResult.data.commentArray);
        if (parsedResult.data.updatingPost) {
          postDataArray.push(parsedResult.data.updatingPost);
        }
      }
      break;
    }

    case "/youtubei/v1/browse": {
      const parsed = parseBrowseResponse(dataString);

      if (parsed.type === "videoList") {
        const parsedResult = parsePostData(dataString, requestUrl.pathname, parsed.items);
        if (parsedResult.ok) {
          postDataArray.push(...parsedResult.data.youtubePostData);
          imageDataArray.push(...parsedResult.data.youtubeImageData);

          storeYoutubePostData(parsedResult.data.youtubePostData)
        }
      }

      if (parsed.type === "channelAbout") {
        const localStorageProfile = await applicationServices.storage?.getStorageByKeys([YOUTUBE_PROFILE_INFO_KEY]);
        const youtubeProfilesCached = localStorageProfile?.[YOUTUBE_PROFILE_INFO_KEY] || "";
        const cachedProfileArray = parseYoutubeProfilesInfo(youtubeProfilesCached);
        const parsedResult = await parseDataUserProfile(parsed.data, { cachedProfileArray });
        if (parsedResult.ok) {
          userProfileDataArray.push(...parsedResult.data);
        }
      }

      if (parsed.type === "channelPage") {
        const parsedResult = await parseDataUserChannel(parsed.data);
        if (parsedResult.ok) {
          const localStorageNewProfile = parsedResult.data;
          storeYoutubeProfileData(localStorageNewProfile);
        }
      }
      break;
    }

    case "/youtubei/v1/get_panel": {
      const parsedResult = await parseTranscriptData(dataString);
      if (parsedResult.ok) {
        postDataArray.push(parsedResult.data);
      }
      break;
    }
  }

  return {
    postData: postDataArray,
    commentData: commentDataArray,
    userProfiles: userProfileDataArray,
    imageData: imageDataArray,
  };
}

type BrowseParseResult =
  | { type: "videoList"; items: any[] }
  | { type: "channelPage"; data: any }
  | { type: "channelAbout"; data: any }
  | { type: "unknown"; raw: any };

function parseBrowseResponse(dataString: string): BrowseParseResult {
  let data: any;
  try {
    data = JSON.parse(dataString);
  } catch {
    return { type: "unknown", raw: dataString };
  }

  // --- Case 1: Video list ---
  const actionEntry = data?.onResponseReceivedActions?.[0];
  if (actionEntry) {
    const { appendContinuationItemsAction, reloadContinuationItemsCommand } = actionEntry;

    const continuationItems =
      appendContinuationItemsAction?.continuationItems ??
      reloadContinuationItemsCommand?.continuationItems?.[0]?.richShelfRenderer?.contents;

    if (Array.isArray(continuationItems)) {
      const richItemRenderers = continuationItems
        .filter((item: any) => item?.hasOwnProperty("richItemRenderer"))
        .map((item: any) => item.richItemRenderer);

      if (richItemRenderers.length > 0) {
        return { type: "videoList", items: richItemRenderers };
      }
    }
  }

  // --- Case 2: Channel page ---
  const channelRenderer = data?.metadata?.channelMetadataRenderer;

  if (channelRenderer) {
    return { type: "channelPage", data: data };
  }

  // --- Case 3: Channel about ---
  const aboutRenderer =
    data?.onResponseReceivedEndpoints?.[0]?.appendContinuationItemsAction
      ?.continuationItems?.[0]?.aboutChannelRenderer;

  if (aboutRenderer) {
    return { type: "channelAbout", data: aboutRenderer };
  }

  return { type: "unknown", raw: data };
}