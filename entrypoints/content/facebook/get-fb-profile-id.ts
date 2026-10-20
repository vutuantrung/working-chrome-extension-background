import { RunningTaskInfo, sendRequest } from "../init-task";

export const extractProfileId = async (
  maxRetries = 5,
  delayMs = 1000,
): Promise<string | null> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const rawData = localStorage.getItem(
        "screen_time_period_logging_facebook",
      );

      if (rawData) {
        try {
          const localStorageActorData = JSON.parse(rawData) as {
            actorId?: string;
          };
          if (localStorageActorData?.actorId) {
            return String(localStorageActorData.actorId);
          }
        } catch {}
      }

      // Check cookie fallback
      const cUserMatch = document.cookie.match(/c_user=(\d+)/);
      if (cUserMatch?.[1]) {
        return cUserMatch[1];
      }

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  return null;
};

export const autoFetchProfileId = async () => {
  try {
    // Check if we already have a profileId saved
    const response = await chrome.runtime.sendMessage({
      type: "GET_SETTINGS",
    });

    if (response?.data?.archive?.profileId) {
      return;
    }

    const profileId = await extractProfileId(3, 1000);
    if (!profileId) return;

    await sendRequest({
      type: "UPDATE_ARCHIVE",
      inputs: { updateArchive: { profileId: profileId } },
    });
  } catch (error: any) {
    console.debug(
      "[GET_FB_PROFILE_ID] Auto-fetch skipped:",
      error?.message || error,
    );
  }
};

export const handleGetFbProfileIdMessage = async (
  message: RunningTaskInfo & { taskId?: string },
) => {
  console.log("[GET_FB_PROFILE_ID]", "Message Received:", message);

  if (message.taskId !== "getFbProfileId") {
    return false; // Let other listeners handle this message
  }

  const runningTaskInfo = message;
  const tabId = runningTaskInfo.tabId;

  try {
    const profileId = await extractProfileId();
    if (!profileId) {
      sendRequest({
        type: "SCRIPT_EXECUTE_RESULT",
        inputs: {
          taskId: runningTaskInfo.taskId,
          tabId: tabId,
        },
      });
      return true;
    }

    const response = await sendRequest({
      type: "UPDATE_ARCHIVE",
      inputs: { updateArchive: { profileId: profileId } },
    });

    if (!response?.success) {
      console.warn("[GET_FB_PROFILE_ID] Failed to save profile ID:", response);
    }
  } catch (error: any) {
    console.warn("[GET_FB_PROFILE_ID] Warning:", error?.message || error);
    sendRequest({
      type: "SCRIPT_EXECUTE_RESULT",
      inputs: {
        taskId: runningTaskInfo.taskId,
        tabId: tabId,
        error: error?.message || String(error),
      },
    });
  }

  return true;
};
