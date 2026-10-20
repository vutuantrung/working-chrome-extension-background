import { YoutubeCommentData, YoutubeImageData, YoutubePostData, YoutubeUserProfileData } from "../types";
import { parseCommentData } from "./parse-data-comment";
import { parseTranscriptData } from "./parse-data-transcript";
import { parseDataUserProfile } from "./parse-data-user-profile";
import { parsePostData } from "./parse-data-video";

export async function parseYoutubeData(dataString: string, requestInfo: any): Promise<{
    postData: YoutubePostData[];
    commentData: YoutubeCommentData[];
    userProfiles: YoutubeUserProfileData[];
    imageData: YoutubeImageData[];
}> {
    const postDataArray: YoutubePostData[] = []
    const commentDataArray: YoutubeCommentData[] = []
    const userProfileDataArray: YoutubeUserProfileData[] = []
    const imageDataArray: YoutubeImageData[] = []

    const requestUrl = new URL(requestInfo.requestUrl);
    switch(requestUrl.pathname) {
        case "/":
        case "/youtubei/v1/search":
        case "/youtubei/v1/get_watch": {
          const parsedResult = parsePostData(dataString, requestUrl.pathname);
          if(parsedResult.ok) {
            postDataArray.push(...parsedResult.data.youtubePostData);
            imageDataArray.push(...parsedResult.data.youtubeImageData);
          }
          break;
        }
        
        case "/youtubei/v1/next": {
            const parsedResult = await parseCommentData(dataString);
            if(parsedResult.ok) {
                commentDataArray.push(...parsedResult.data.commentArray);
                if(parsedResult.data.updatingPost) {
                  postDataArray.push(parsedResult.data.updatingPost);
                }
            }
            break;
        }

        case "/youtubei/v1/browse": {
          const parsed = parseBrowseResponse(dataString);
          
          if(parsed.type === "videoList") {
              const parsedResult = parsePostData(dataString, requestUrl.pathname, parsed.items);
              if(parsedResult.ok) {
                postDataArray.push(...parsedResult.data.youtubePostData);
                imageDataArray.push(...parsedResult.data.youtubeImageData);
              }
          }
          if(parsed.type === "channelAbout" || parsed.type === "channelPage") {
              const parsedResult = await parseDataUserProfile(parsed.data, parsed.type);
              if(parsedResult.ok) {
                  userProfileDataArray.push(...parsedResult.data);
              }
          }
          break;
        }

        case "/youtubei/v1/get_panel": {
          const parsedResult = await parseTranscriptData(dataString);
          if(parsedResult.ok) {
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