import { Message } from "../../types/types";
import { simulateHumanClick } from "../../../content/helpers/simulate-click";
import {
  bootstrapExistingFacebookTabs,
  ensureFacebookGraphInterceptorInstalled,
} from "../../scriptInjection";
// Message handler imports
import {
    handleGetUserInfo,
    handleGetPendingUserInfo,
    handleConfirmGatherUserInfo,
    handleRemovePendingUserInfo,
    handleInitializeAfterLogin,
    handleClearDataAfterLogout,
    handleStartPeriodicCheck,
    handleSetBadgeText,
    handleCancelTask,
    handleDownloadImage,
    handleScriptExecuteResult,
    handleChangeTabUrl,
} from "./systemHandlers";
import {
    handleGetFacebookAccount,
    handleGetFacebookAccountCache,
    handleSendAddSourceRequest,
    handleFetchJoinGroupResponse,
    handleReportJoinGroupResponse,
    handleFetchJoinGroupPreparationData
} from "../facebook/facebookMessageHandlers";
import { DEFAULT_SETTINGS_JSON } from "../../helpers/constants";
import { getStorageCachedByKeys, setStorageCached, handleUpdateArchive, handleUpdateSettings, handleGetSettings, handleSetSettings, getStorageCache, setStorageCache } from "../../services/storageServices";
import { handleProxy } from "../../services/proxyServices";
import { getCorrectFacebookTabId } from "../../helpers/tabUtils";
import { isLikelyProfilePageUrl } from "../../helpers/user-info";
import { HandlerContext } from "../../types/handle";

import {
  sendFacebookCachedData,
  sendFacebookUserData,
  saveFacebookUserData,
  saveFacebookGroupData,
  publishFacebookUserInfo,
} from "../../dataPublishers/facebookPublisher";
import { sendTiktokCachedData } from "../../dataPublishers/tiktokPublisher";
import { sendXCachedData } from "../../dataPublishers/xPublisher";
import { sendThreadsCachedData } from "../../dataPublishers/threadsPublisher";
import {
  bgState,
  debounce,
  MAXIMUM_TIME_WAIT_SECOND,
  MAXIMUM_RECORD_ARCHIVED,
  MAX_PENDING_USERINFO,
  SEND_X_DATA_ALARM,
  SEND_TIKTOK_DATA_ALARM,
  SEND_THREADS_DATA_ALARM,
  SEND_FACEBOOK_DATA_ALARM,
  USERINFO_PUBLISH_DEBOUNCE_MS,
  SEND_YOUTUBE_DATA_ALARM,
} from "../../state";
import * as tiktokHandlers from "../../handlers/tiktok";
import * as facebookHandlers from "../../handlers/facebook";
import * as xHandlers from "../../handlers/x";
import * as threadsHandlers from "../../handlers/threads";
import * as youtubeHandlers from "../../handlers/youtube";
import {
  handleCaptureScreenshot,
  handleScreenshotCropped,
} from "../eviden-collection";
import { sendYoutubeCachedData } from "../../dataPublishers/youtubePublisher";
import { chromeApi } from "../../infrastructure/chrome-api/chrome-api";

function blockNotificationPopup() {
  const maxAttempts = 10;
  let attempts = 0;

  const interval = setInterval(() => {
    attempts++;

    const blockButton = Array.from(
      document.querySelectorAll('button, div[role="button"]'),
    ).find((el) => {
      const text = el.textContent?.trim().toLowerCase();
      return text === "block" || text === "chặn";
    });

    if (blockButton) {
      simulateHumanClick(blockButton as HTMLElement);
      clearInterval(interval);
      return;
    }

    const closeButton = document.querySelector('div[aria-label="Close"]');
    if (closeButton) {
      simulateHumanClick(closeButton as HTMLElement);
      clearInterval(interval);
      return;
    }

    if (attempts >= maxAttempts) {
      clearInterval(interval);
    }
  }, 500);
}

async function handleBodyDataIntercepted(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse?: (resp: any) => void,
): Promise<void> {
  try {
    console.debug(
      "[App Interceptor] Received intercepted data from tab",
      sender.tab?.id,
    );
    const senderTabId = sender.tab?.id;

    if (!senderTabId) {
      console.warn("[App Interceptor] No sender tab ID");
      if (sendResponse) {
        sendResponse({ ok: false, message: "No sender tab ID" });
      }
      return;
    }

    const allowedTabId = await getCorrectFacebookTabId();
    if (!allowedTabId || allowedTabId === -1) {
      console.warn(
        "[App Interceptor] No valid allowed tab for current mode - ignoring data",
      );
      sendResponse?.({ ok: false, message: "No valid allowed tab" });
      return;
    }

    let tabUrl = "",
      isProfileTab = false;
    try {
      const tab = await chromeApi.tabs.get(senderTabId);
      isProfileTab = isLikelyProfilePageUrl(tab?.url || "");
      tabUrl = tab?.url || "";
    } catch {
      isProfileTab = false;
    }

    const { responseText, url: requestUrl, postData } = message.data;
    if (!responseText) {
      console.debug("[App Interceptor] No response text found");
      return;
    }

    const dataParsed = await parseData(responseText, {
      requestUrl: requestUrl,
      tabUrl: tabUrl,
      postData,
    });

    const context: HandlerContext = {
      senderTabId,
      isProfileTab,
      debounce,
      // facebook
      saveFacebookUserData: saveFacebookUserData,
      saveFacebookGroupData: saveFacebookGroupData,
      sendFacebookUserData: sendFacebookUserData,
      publishFacebookUserInfo: publishFacebookUserInfo,
      sendFacebookCachedData: sendFacebookCachedData,
      // tiktok
      sendTiktokCachedData: sendTiktokCachedData,
      // threads
      sendThreadsCachedData: sendThreadsCachedData,
      // x
      sendXCachedData: sendXCachedData,
      // youtube
      sendYoutubeCachedData: sendYoutubeCachedData,

      MAXIMUM_TIME_WAIT_SECOND,
      MAXIMUM_RECORD_ARCHIVED,
      MAX_PENDING_USERINFO,
      USERINFO_PUBLISH_DEBOUNCE_MS,

      SEND_X_DATA_ALARM,
      SEND_TIKTOK_DATA_ALARM,
      SEND_THREADS_DATA_ALARM,
      SEND_FACEBOOK_DATA_ALARM,
      SEND_YOUTUBE_DATA_ALARM,

      facebookJoinedGroupsData: bgState.cachedFacebookJoinedGroupsData,

      cachedXData: bgState.cachedXData,
      cachedTiktokData: bgState.cachedTiktokData,
      cachedThreadsData: bgState.cachedThreadsData,
      cachedFacebookData: bgState.cachedFacebookData,
      cachedYoutubeData: bgState.cachedYoutubeData,
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
      if (dt.typeName === "XPostData") handler = xHandlers.handleXPostInfo;
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

export function runTimeOnMessageHandler(
  message: Message,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void,
): boolean {

  if (message.type === "GET_MY_TAB_ID") {
    sendResponse?.({ success: true, tabId: sender.tab?.id });
    return false;
  }

  if (message.type === "AUTO_BLOCK_NOTIFICATION") {
    blockNotificationPopup();
    return false;
  }

  if (message.type === "ENSURE_FB_INTERCEPTOR") {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse?.({ ok: false, error: "No sender tabId" });
      return false;
    }
    console.log("[ENSURE_FB_INTERCEPTOR] request from tab", tabId);
    ensureFacebookGraphInterceptorInstalled(tabId)
      .then((result) => sendResponse?.({ ok: true, ...result }))
      .catch((err) => {
        console.warn("[ENSURE_FB_INTERCEPTOR] failed for tab", tabId, err);
        sendResponse?.({ ok: false, error: String(err) });
      });
    return true;
  }

  if (message.type === "CONTENT_READY") {
    console.log(
      "[CONTENT_READY] Content script loaded:",
      message.name,
      "on tab",
      sender.tab?.id,
    );
    if (message.name === "getFbProfileId" && sender.tab?.id) {
      storageService
        .getStorageCachedByKeys(["settings"])
        .then(({ settings }) => {
          if (settings?.openingDevtoolsTabId === sender.tab?.id) {
            setTimeout(() => {
              chromeApi.tabs.sendMessage(
                sender?.tab!.id as any,
                {
                  platform: "facebook",
                  taskId: "getFbProfileId",
                  tabId: sender.tab?.id,
                },
                (response: any) => {
                  void chromeApi.runtime.lastError;
                },
              );
            }, 1000);
          }
        });
    }

        if (message.name === "clickAboutButton" && sender.tab?.id) {
            chromeApi.tabs.sendMessage(
                sender?.tab!.id as any,
                {
                    type: "CLICK_ABOUT_BUTTON",
                    platform: "youtube",
                    tabId: sender.tab?.id,
                },
                (response: any) => {
                    void chromeApi.runtime.lastError;
                },
            );
        }

        if (message.name === "clickTranscriptButton" && sender.tab?.id) {
            chromeApi.tabs.sendMessage(
                sender?.tab!.id as any,
                {
                    type: "CLICK_TRANSCRIPT_BUTTON",
                    platform: "youtube",
                    tabId: sender.tab?.id,
                },
                (response: any) => {
                    void chromeApi.runtime.lastError;
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
                return handleFetchJoinGroupResponse(message, sendResponse);
            case "FETCH_JG_PREPARATION_DATA":
                return handleFetchJoinGroupPreparationData(message, sendResponse);
            case "REPORT_JG_RESPONSE":
                return handleReportJoinGroupResponse(message, sendResponse);
            case "SEND_ADD_SOURCE_REQUEST":
                return handleSendAddSourceRequest(message, sendResponse);
            case "GET_FB_ACCOUNT_CACHE":
                return handleGetFacebookAccountCache(message, sendResponse);
            case "GET_FB_ACCOUNT":
                return handleGetFacebookAccount(message, sendResponse);

      // DATA INTERCEPTED
      case "BODY_DATA_INTERCEPTED":
        return handleBodyDataIntercepted(message, sender, sendResponse);

            // SYSTEM REQUESTS
            case "SET_SETTINGS":
                return handleSetSettings(message, sendResponse);
            case "GET_SETTINGS":
                return handleGetSettings(message, sendResponse);
            case "GET_USERINFO":
                return handleGetUserInfo(message, sendResponse);
            case "GET_PENDING_USERINFO":
                return handleGetPendingUserInfo(message, sendResponse);
            case "UPDATE_SETTINGS":
                return handleUpdateSettings(message, sendResponse);
            case "UPDATE_ARCHIVE":
                return handleUpdateArchive(message, sendResponse);
            case "REMOVE_PENDING_USERINFO":
                return handleRemovePendingUserInfo(message, sendResponse);
            case "CONFIRM_GATHER_USERINFO":
                return handleConfirmGatherUserInfo(message, sendResponse);
            case "INITIALIZE_AFTER_LOGIN":
                return handleInitializeAfterLogin(message, sendResponse);
            case "CLEAR_DATA_AFTER_LOGOUT":
                return handleClearDataAfterLogout(message, sendResponse);
            case "SET_PROXY":
                return handleProxy(message, sendResponse);
            case "SET_BADGE_TEXT":
                return handleSetBadgeText(message, sendResponse);
            case "CANCEL_TASK":
                return handleCancelTask(message, sendResponse);
            case "SCRIPT_EXECUTE_RESULT":
                return handleScriptExecuteResult(message, sender, sendResponse);
            case "CHANGE_TAB_URL":
                return handleChangeTabUrl(message, sender, sendResponse);
            case "START_PERIODIC_CHECK":
                return handleStartPeriodicCheck(message, sendResponse);
            case "DOWNLOAD_IMAGE":
                return handleDownloadImage(message, sendResponse);
            case "CAPTURE_SCREENSHOT":
                return handleCaptureScreenshot(sendResponse);
            case "SCREENSHOT_CROPPED":
                return handleScreenshotCropped(message, sendResponse);

      // DEPRECATED
      case "BIND_TO_DEVTOOL_TAB":
        return () => {
          console.log("Implementation Exception");
        };
      default:
        console.warn(
          "[runTimeOnMessageHandler] Unhandled message type:",
          message.type,
        );
    }
  };

  dispatch().catch((err) => {
    console.error(
      "[runTimeOnMessageHandler] Unhandled error for",
      message.type,
      err,
    );
    sendResponse?.({ success: false, error: String(err) });
  });

  return true;
}

export async function runTimeOnInstalledHandler(
  details: chrome.runtime.InstalledDetails,
): Promise<void> {
  console.log("Extension installed/updated", details);
  bgState.manifests = chromeApi.runtime.getManifest();

  if (details.reason === "install") {
  } else if (details.reason === "update") {
    const { settings } =
      await getStorageCachedByKeys(["settings"]);
    if (settings) {
      const mergedSettings = {
        ...DEFAULT_SETTINGS_JSON,
        ...settings,
        archive: settings.archive || {},
      };
      await setStorageCached({
        settings: mergedSettings,
      });
    }
  }

  chromeApi.action.setBadgeText({ text: "0" });
  chromeApi.action.setBadgeBackgroundColor({ color: "#0000FF" });

  try {
    await bootstrapExistingFacebookTabs();
  } catch (e) {
    console.warn("[SETUP] bootstrapExistingFacebookTabs failed:", e);
  }
}
