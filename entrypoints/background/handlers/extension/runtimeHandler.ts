import { Message, Settings } from "../../types/types";
import {
  Constants,
  DefaultValues
} from "../../utils/constants";

// Message handler imports
import {
  handleGetUserInfo,
  handleClearDataAfterLogout,
  handleStartPeriodicCheck,
  handleSetBadgeText,
  handleCancelTask,
  handleDownloadImage,
  handleScriptExecuteResult,
  handleChangeTabUrl,
  handleInitializeAfterLogin,
} from "./systemHandlers";
import {
  handleGetFacebookAccount,
  handleGetFacebookAccountCache,
  handleSendAddSourceRequest,
  handleFetchJoinGroupResponse,
  handleReportJoinGroupResponse,
  handleFetchJoinGroupPreparationData
} from "../facebook/external-message";
import * as helpers from "../../utils/helpers";
import { HandlerContext } from "../../types/handle";

import { bgState } from "../../state";
import { debounce } from "../../utils/tools";

import { parseData } from "../../utils/parsers/parser-data";
// Publisher
// import {
//   sendFacebookCachedData,
//   sendFacebookUserData,
//   saveFacebookUserData,
//   saveFacebookGroupData,
//   publishFacebookUserInfo,
// } from "../../dataPublishers/facebookPublisher";
// import { sendTiktokCachedData } from "../../dataPublishers/tiktokPublisher";
// import { sendXCachedData } from "../../dataPublishers/xPublisher";
// import { sendThreadsCachedData } from "../../dataPublishers/threadsPublisher";
// import { sendYoutubeCachedData } from "../../dataPublishers/youtubePublisher";

// Hanlders
import * as tiktokHandlers from "../tiktok";
import * as facebookHandlers from "../facebook";
import * as xHandlers from "../x";
import * as threadsHandlers from "../threads";
import * as youtubeHandlers from "../youtube";
import * as evidenCollectionHandlers from "../eviden-collection";

import { ApplicationServices } from "../../application-services";
import { createPublishFacebookUserData } from "../../dataPublishers/publishFacebookUserData";
import { createPublishFacebookCachedData } from "../../dataPublishers/publishFacebookCachedData";
import { createPublishTiktokCachedData } from "../../dataPublishers/publishTiktokCachedData";
import { createPublishXCachedData } from "../../dataPublishers/publishXCachedData";
import { createPublishYoutubeCachedData } from "../../dataPublishers/publishYoutubeCachedData";
import { createPublishThreadsCachedData } from "../../dataPublishers/publishThreadCachedData";
import { createSaveFacebookUserData } from "../../dataPublishers/saveFacebookUserData";
import { createSaveFacebookGroupData } from "../../dataPublishers/saveFacebookGroupData";

async function handleBodyDataIntercepted(
  applicationServices: ApplicationServices,
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse?: (resp: any) => void
): Promise<void> {
  try {
    console.debug("[App Interceptor] Received intercepted data from tab", sender.tab?.id);
    const senderTabId = sender.tab?.id;

    if (!senderTabId) {
      console.warn("[App Interceptor] No sender tab ID");
      if (sendResponse) {
        sendResponse({ ok: false, message: "No sender tab ID" });
      }
      return;
    }

    const allowedTabId = await applicationServices.tab?.getSupportedTabs(senderTabId);
    if (!allowedTabId || allowedTabId === -1) {
      const updatedSettings = { firstFacebookTabId: allowedTabId };
      await applicationServices.storage?.setStorageCached({ settings: updatedSettings });
      console.warn("[App Interceptor] No valid allowed tab for current mode - ignoring data");
      sendResponse?.({ ok: false, message: "No valid allowed tab" });
      return;
    }

    let tabUrl = "", isProfileTab = false;
    try {
      const tab = await applicationServices.tab?.getBrowserApi().get(senderTabId);
      isProfileTab = helpers.userInfo.isLikelyProfilePageUrl(tab?.url || "");
      tabUrl = tab?.url || "";
    } catch {
      isProfileTab = false;
    }

    const { responseText, url: requestUrl, postData } = message.data;
    if (!responseText) {
      console.debug("[App Interceptor] No response text found");
      return;
    }

    const dataParsed = await parseData(
      responseText,
      {
        requestUrl: requestUrl,
        tabUrl: tabUrl,
        postData,
      },
      applicationServices);

    const context: HandlerContext = {
      senderTabId,
      isProfileTab,
      debounce,
      // facebook
      saveFacebookUserData: createSaveFacebookUserData(applicationServices),
      saveFacebookGroupData: createSaveFacebookGroupData(applicationServices),
      sendFacebookUserData: createPublishFacebookUserData(applicationServices),
      sendFacebookCachedData: createPublishFacebookCachedData(applicationServices),
      // publishFacebookUserInfo: publishFacebookUserInfo,

      // tiktok
      sendTiktokCachedData: createPublishTiktokCachedData(applicationServices),

      // threads
      sendThreadsCachedData: createPublishThreadsCachedData(applicationServices),

      // x
      sendXCachedData: createPublishXCachedData(applicationServices),

      // youtube
      sendYoutubeCachedData: createPublishYoutubeCachedData(applicationServices),

      MAXIMUM_TIME_WAIT_SECOND: Constants.MAXIMUM_TIME_WAIT_SECOND,
      MAXIMUM_RECORD_ARCHIVED: Constants.MAXIMUM_RECORD_ARCHIVED,
      MAX_PENDING_USERINFO: Constants.MAX_PENDING_USERINFO,
      USERINFO_PUBLISH_DEBOUNCE_MS: Constants.USERINFO_PUBLISH_DEBOUNCE_MS,

      SEND_X_DATA_ALARM: Constants.SEND_X_DATA_ALARM,
      SEND_TIKTOK_DATA_ALARM: Constants.SEND_TIKTOK_DATA_ALARM,
      SEND_THREADS_DATA_ALARM: Constants.SEND_THREADS_DATA_ALARM,
      SEND_FACEBOOK_DATA_ALARM: Constants.SEND_FACEBOOK_DATA_ALARM,
      SEND_YOUTUBE_DATA_ALARM: Constants.SEND_YOUTUBE_DATA_ALARM,

      facebookJoinedGroupsData: bgState.cachedFacebookJoinedGroupsData,

      cachedXData: bgState.cachedXData,
      cachedTiktokData: bgState.cachedTiktokData,
      cachedThreadsData: bgState.cachedThreadsData,
      cachedFacebookData: bgState.cachedFacebookData,
      cachedYoutubeData: bgState.cachedYoutubeData,

      applicationServices: applicationServices,
    };

    for (const dt of dataParsed) {
      let handler = null;
      // Facebook
      if (dt.typeName === "FacebookPostData")
        handler = facebookHandlers.handleFbPostInfo;
      if (dt.typeName === "FacebookImageData")
        handler = facebookHandlers.handleFbImageInfo;
      if (dt.typeName === "FacebookGroupJoinedData")
        handler = facebookHandlers.handleFbGroupInfo;
      if (dt.typeName === "FacebookUserProfileData")
        handler = facebookHandlers.handleFbUserInfo;
      if (dt.typeName === "FacebookUserFollowerData")
        handler = facebookHandlers.handleFbFollowInfo;
      if (dt.typeName === "FacebookUserFriendData")
        handler = facebookHandlers.handleFbFriendInfo;
      if (dt.typeName === "FacebookCommentData")
        handler = facebookHandlers.handleFbCommentInfo;
      if (dt.typeName === "FacebookReactionData")
        handler = facebookHandlers.handleFbReactionInfo;
      if (dt.typeName === "FacebookProfileData")
        handler = facebookHandlers.handleFbProfileInfo;

      // Tiktok
      if (dt.typeName === "TiktokPostData")
        handler = tiktokHandlers.handleTiktokPostInfo;
      if (dt.typeName === "TiktokImageData")
        handler = tiktokHandlers.handleTiktokImageInfo;
      if (dt.typeName === "TiktokCommentData")
        handler = tiktokHandlers.handleTiktokCommentInfo;
      if (dt.typeName === "TiktokUserProfileData")
        handler = tiktokHandlers.handleTiktokUserInfo;
      if (dt.typeName === "TiktokUserFollowerData")
        handler = tiktokHandlers.handleTiktokFollowInfo;

      // X
      if (dt.typeName === "XPostData")
        handler = xHandlers.handleXPostInfo;
      if (dt.typeName === "XAttachmentData")
        handler = xHandlers.handleXImageInfo;
      if (dt.typeName === "XUserProfileData")
        handler = xHandlers.handleXUserInfo;
      if (dt.typeName === "XUserFollowerData")
        handler = xHandlers.handleXFollowInfo;

      // Threads
      if (dt.typeName === "ThreadsPostData")
        handler = threadsHandlers.handleThreadsPostInfo;
      if (dt.typeName === "ThreadsAttachmentData")
        handler = threadsHandlers.handleThreadsImageInfo;
      if (dt.typeName === "ThreadsUserProfileData")
        handler = threadsHandlers.handleThreadsUserInfo;
      if (dt.typeName === "ThreadsUserFollowerData")
        handler = threadsHandlers.handleThreadsFollowInfo;
      if (dt.typeName === "ThreadsCommentData")
        handler = threadsHandlers.handleThreadsCommentInfo;

      // Youtube            
      if (["YoutubePostData", "YoutubeCommentData", "YoutubeUserProfileData", "YoutubeImageData"].includes(dt.typeName)) {
        handler = youtubeHandlers.handleYoutubeDataInfo;
      }

      if (!handler) continue;

      await handler(dt, context);
    }

    if (sendResponse) {
      sendResponse({ success: true });
    }
  } catch (error) {
    console.log("[handleFbGraphDataIntercepted] Error:", error);
    if (sendResponse) {
      sendResponse({ success: false, error: error });
    }
  }
}

export function createRunTimeOnMessageHandler(
  applicationServices: ApplicationServices
) {
  return (
    message: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): boolean => runTimeOnMessageHandlerInternal(applicationServices, message, sender, sendResponse)
}

function runTimeOnMessageHandlerInternal(
  applicationServices: ApplicationServices,
  message: Message,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {

  if (message.type === "GET_MY_TAB_ID") {
    sendResponse?.({ success: true, tabId: sender.tab?.id });
    return false;
  }

  if (message.type === "ENSURE_FB_INTERCEPTOR") {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse?.({ ok: false, error: "No sender tabId" });
      return false;
    }
    console.log("[ENSURE_FB_INTERCEPTOR] request from tab", tabId);
    applicationServices.script?.injectXHRNetworkCapture(tabId)
      .then((result) => sendResponse?.({ ok: true, ...result }))
      .catch((err) => {
        console.warn("[ENSURE_FB_INTERCEPTOR] failed for tab", tabId, err);
        sendResponse?.({ ok: false, error: String(err) });
      });
    return true;
  }

  if (message.type === "CONTENT_READY") {
    console.log("[CONTENT_READY] Content script loaded:", message.name, "on tab", sender.tab?.id);
    if (message.name === "getFbProfileId" && sender.tab?.id) {
      applicationServices.storage?.getStorageCachedByKeys(["settings"])
        .then(({ settings }) => {
          if (settings?.openingDevtoolsTabId === sender.tab?.id) {
            setTimeout(() => {
              applicationServices.tab?.getBrowserApi().sendMessage(
                sender?.tab!.id as any,
                {
                  platform: "facebook",
                  taskId: "getFbProfileId",
                  tabId: sender.tab?.id,
                },
                (response: any) => {
                  void applicationServices.runtime?.getBrowserApi().getRuntimeLastError();
                },
              );
            }, 1000);
          }
        });
    }

    if (message.name === "clickAboutButton" && sender.tab?.id) {
      applicationServices.tab?.getBrowserApi().sendMessage(
        sender?.tab!.id as any,
        {
          type: "CLICK_ABOUT_BUTTON",
          platform: "youtube",
          tabId: sender.tab?.id,
        },
        (response: any) => {
          void applicationServices.runtime?.getBrowserApi().getRuntimeLastError();
        },
      );
    }

    if (message.name === "clickTranscriptButton" && sender.tab?.id) {
      applicationServices.tab?.getBrowserApi().sendMessage(
        sender?.tab!.id as any,
        {
          type: "CLICK_TRANSCRIPT_BUTTON",
          platform: "youtube",
          tabId: sender.tab?.id,
        },
        (response: any) => {
          void applicationServices.runtime?.getBrowserApi().getRuntimeLastError();
        },
      );
    }

    return false;
  }

  // ── Async dispatch — all handlers below keep the channel open ────────────
  const dispatch = async () => {
    switch (message.type) {
      // FACEBOOK REQUESTS
      case "FETCH_JG_RESPONSE":
        return handleFetchJoinGroupResponse(applicationServices, message, sendResponse);
      case "FETCH_JG_PREPARATION_DATA":
        return handleFetchJoinGroupPreparationData(applicationServices, message, sendResponse);
      case "REPORT_JG_RESPONSE":
        return handleReportJoinGroupResponse(applicationServices, message, sendResponse);
      case "SEND_ADD_SOURCE_REQUEST":
        return handleSendAddSourceRequest(applicationServices, message, sendResponse);
      case "GET_FB_ACCOUNT_CACHE":
        return handleGetFacebookAccountCache(applicationServices, message, sendResponse);
      case "GET_FB_ACCOUNT":
        return handleGetFacebookAccount(applicationServices, message, sendResponse);

      // DATA INTERCEPTED
      case "BODY_DATA_INTERCEPTED":
        return handleBodyDataIntercepted(applicationServices, message, sender, sendResponse);

      // SYSTEM REQUESTS
      case "SET_SETTINGS":
        return applicationServices.storage?.handleSetSettings(message, sendResponse);
      case "GET_SETTINGS":
        return applicationServices.storage?.handleGetSettings(message, sendResponse);
      case "GET_USERINFO":
        return handleGetUserInfo(applicationServices, message, sendResponse);
      case "UPDATE_SETTINGS":
        return applicationServices.storage?.handleUpdateSettings(message, sendResponse);
      case "UPDATE_ARCHIVE":
        return applicationServices.storage?.handleUpdateArchive(message, sendResponse);
      case "INITIALIZE_AFTER_LOGIN":
        return handleInitializeAfterLogin(applicationServices, message, sendResponse);
      case "CLEAR_DATA_AFTER_LOGOUT":
        return handleClearDataAfterLogout(applicationServices, message, sendResponse);
      case "SET_PROXY":
        return applicationServices.proxy?.handleProxy(message, sendResponse);
      case "SET_BADGE_TEXT":
        return handleSetBadgeText(applicationServices, message, sendResponse);
      case "CANCEL_TASK":
        return handleCancelTask(applicationServices, message, sendResponse);
      case "SCRIPT_EXECUTE_RESULT":
        return handleScriptExecuteResult(applicationServices, message, sender, sendResponse);
      case "CHANGE_TAB_URL":
        return handleChangeTabUrl(applicationServices, message, sender, sendResponse);
      case "START_PERIODIC_CHECK":
        return handleStartPeriodicCheck(applicationServices, message, sendResponse);
      case "DOWNLOAD_IMAGE":
        return handleDownloadImage(applicationServices, message, sendResponse);
      case "CAPTURE_SCREENSHOT":
        return evidenCollectionHandlers.handleCaptureScreenshot(applicationServices, sendResponse);
      case "SCREENSHOT_CROPPED":
        return evidenCollectionHandlers.handleScreenshotCropped(applicationServices, message, sendResponse);
      default:
        console.warn(
          "[runTimeOnMessageHandler] Unhandled message type:",
          message.type,
        );
    }
  };

  dispatch().catch((err) => {
    console.error("[runTimeOnMessageHandler] Unhandled error for", message.type, err);
    sendResponse?.({ success: false, error: String(err) });
  });

  return true;
}

export function createRunTimeOnInstalledHandler(applicationServices: ApplicationServices) {
  return (
    details: chrome.runtime.InstalledDetails
  ) => runTimeOnInstalledHandlerInternal(applicationServices, details);
}

async function runTimeOnInstalledHandlerInternal(
  applicationServices: ApplicationServices,
  details: chrome.runtime.InstalledDetails
): Promise<void> {
  console.log("Extension installed/updated", details);
  bgState.manifests = applicationServices.runtime?.getBrowserApi().getManifest();

  if (details.reason === "install") {
  } else if (details.reason === "update") {
    const cachedStorage = await applicationServices.storage?.getStorageCachedByKeys(["settings"]);
    if (cachedStorage?.settings) {
      const mergedSettings = {
        ...DefaultValues.SETTINGS_DATA,
        ...cachedStorage.settings,
        archive: cachedStorage.settings.archive || {},
      };
      await applicationServices.storage?.setStorageCached({
        settings: mergedSettings,
      });
    }
  }

  applicationServices.action?.getBrowserApi().setBadgeText({ text: "0" });
  applicationServices.action?.getBrowserApi().setBadgeBackgroundColor({ color: "#0000FF" });

  try {
    await applicationServices.script?.injectDependenciesInSupportedPlatform();
  } catch (e) {
    console.warn("[SETUP] bootstrapExistingFacebookTabs failed:", e);
  }
}
