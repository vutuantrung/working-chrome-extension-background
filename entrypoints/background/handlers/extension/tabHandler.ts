import { bgState } from "../../state";
import { isSupportedPlatformUrl } from "../../utils/tools";
import { DefaultValues, State } from "../../utils/constants";
import { ApplicationServices } from "../../application-services"

export function createTabsOnActivatedHandler(applicationServices: ApplicationServices) {
  return (tabId: any) => tabsOnActivatedHandlerInternal(applicationServices, tabId);
}

async function tabsOnActivatedHandlerInternal(applicationServices: ApplicationServices, tabId: any) {
  await handleMaybeFacebookTab(applicationServices, tabId);
}

export function createTabsOnUpdatedHandler(applicationServices: ApplicationServices) {
  return (
    tabId: number,
    changeInfo: any,
    tab: chrome.tabs.Tab
  ) => tabsOnUpdatedHandlerInternal(applicationServices, tabId, changeInfo, tab);
}

// ========================================
// TAB UPDATED HANDLER
// ========================================
export async function tabsOnUpdatedHandlerInternal(
  applicationServices: ApplicationServices,
  tabId: number,
  changeInfo: any,
  tab: chrome.tabs.Tab,
) {
  const {
    settings: storageSettings,
    taskList: storageTaskList,
    user: storageUser,
  } = await applicationServices.storage?.getStorageCachedByKeys(["settings", "taskList", "user"]) || {};

  if (changeInfo.status === "complete" || changeInfo.url) {
    await handleMaybeFacebookTab(applicationServices, tabId);
  }

  // Ensure FB interceptor as early as possible (independent of tasks/settings).
  if (
    (changeInfo.status === State.TaskState.LOADING ||
      changeInfo.status === State.TaskState.COMPLETE) &&
    isSupportedPlatformUrl(tab.url || "")
  ) {
    applicationServices.script?.injectXHRNetworkCapture(tabId).catch(() => { });

    // If profileId is missing, bootstrap extraction without requiring reload.
    if (!storageSettings?.archive?.profileId) {
      applicationServices.script?.injectFacebookProfileIdCollector(tabId).catch(() => { });
    }
  }

  if (
    changeInfo.status === State.TaskState.COMPLETE &&
    tabId === storageSettings?.openingDevtoolsTabId &&
    isSupportedPlatformUrl(tab?.url || "")
  ) {
    setTimeout(() => {
      const getFbProfileIdMsgData = {
        platform: "facebook",
        taskId: "getFbProfileId",
        tabId: tabId,
      };

      applicationServices.tab?.getBrowserApi().sendMessage(tabId, getFbProfileIdMsgData, (response: any) => {
        const err = applicationServices.runtime?.getBrowserApi().getRuntimeLastError();
        if (err) {
          if (err.message?.includes("Receiving end does not exist")) {
            console.debug(
              "[tabsOnUpdatedHandler] No receiver for profile ID fetch (content script not ready)",
            );
            if (!storageSettings?.archive?.profileId) {
              applicationServices.script?.injectFacebookProfileIdCollector(tabId).catch(() => { });
            }
            return;
          }

          console.warn(
            "[tabsOnUpdatedHandler] Failed to send profile ID fetch message:",
            err.message,
          );
        } else {
          if (response) {
            console.log("[tabsOnUpdatedHandler] Response:", response);
          }
        }
      });

      const injectFbLabelingRules = {
        platform: "facebook",
        activityName: "ENHANCE_SPAN",
        taskId: "ENHANCE_SPAN",
        tabId: tabId,
      };

      applicationServices.tab?.getBrowserApi().sendMessage(tabId, injectFbLabelingRules, (response: any) => {
        const err = applicationServices.runtime?.getBrowserApi().getRuntimeLastError();
        if (err) {
          console.warn(
            "[tabsOnUpdatedHandler] Failed to send ENHANCE_SPAN message:",
            err.message,
          );
        } else {
          if (response) {
            console.log("[tabsOnUpdatedHandler] Response:", response);
          }
        }
      });
    }, 2000);

    setTimeout(() => {
      const msgData = {
        platform: "facebook",
        taskId: "getFbProfileId",
        tabId: tabId,
      };

      applicationServices.tab?.getBrowserApi().sendMessage(tabId, msgData, (response: any) => {
        const err = applicationServices.runtime?.getBrowserApi().getRuntimeLastError();
        if (err) {
          if (err.message?.includes("Receiving end does not exist")) {
            console.debug(
              "[tabsOnUpdatedHandler] No receiver for profile ID fetch (content script not ready)",
            );
            if (!storageSettings?.archive?.profileId) {
              applicationServices.script?.injectFacebookProfileIdCollector(tabId).catch(() => { });
            }
            return;
          }

          console.warn(
            "[tabsOnUpdatedHandler] Failed to send profile ID fetch message:",
            err.message,
          );
        } else {
          if (response) {
            console.log("[tabsOnUpdatedHandler] Response:", response);
          }
        }
      });
    }, 2000);
  }

  if (
    changeInfo.status === State.TaskState.COMPLETE &&
    isSupportedPlatformUrl(tab?.url || "")
  ) {
    const currentProfileId = storageSettings?.archive?.profileId;

    if (!currentProfileId) {
      setTimeout(async () => {
        const msgData = {
          platform: "facebook",
          taskId: "getFbProfileId",
          tabId: tabId,
        };

        const response = await applicationServices.tab?.getBrowserApi().safeSendMessage(tabId, msgData);
        if (response) {
          console.log("[tabsOnUpdatedHandler] Auto-fetch response:", response);
        } else {
          // If content script isn't ready, bootstrap extraction will still work.
          applicationServices.script?.injectFacebookProfileIdCollector(tabId).catch(() => { });
        }
      }, 2000);
    } else {
      console.log(
        "[tabsOnUpdatedHandler] Profile ID already exists:",
        currentProfileId,
      );
    }
  }

  // Check settings automation activating
  if (storageUser?.extension_session?.automation !== true) {
    return;
  }

  // Search running task
  const tasksWithTabIdFound = storageTaskList?.filter((e) => e.tabId === tabId);
  const runningTaskInfo =
    !Array.isArray(tasksWithTabIdFound) || tasksWithTabIdFound.length === 0
      ? null
      : tasksWithTabIdFound[tasksWithTabIdFound.length - 1];

  // Validate running task
  if (!runningTaskInfo) {
    console.log("No script running on this tab");
    return;
  }
  if (
    runningTaskInfo.state === State.TaskState.CANCELED ||
    runningTaskInfo.state === State.TaskState.FINISHED
  ) {
    console.log("Task is canceled or finished");
    return;
  }

  try {
    await applicationServices.tab?.getBrowserApi().get(runningTaskInfo.tabId);
  } catch (error) {
    runningTaskInfo.state = State.TaskState.CANCELED;
    runningTaskInfo.result = `Canceled. Reason: Tab with id ${runningTaskInfo.tabId} not found`;
    runningTaskInfo.endTime = Date.now();
    await applicationServices.storage?.setStorageCached({
      taskList: storageTaskList,
    });
    return;
  }

  // Execute scripts of task (Automation script)
  if (
    changeInfo.status === State.TaskState.COMPLETE &&
    isSupportedPlatformUrl(tab?.url || "")
  ) {
    const lastUrl = bgState.injectedTabs.get(tabId);
    if (lastUrl === tab.url) {
      return;
    }

    runningTaskInfo.wsReporter = null;
    runningTaskInfo.profileId = storageSettings?.archive?.profileId;

    const dtsTabId = parseInt(String(runningTaskInfo.tabId));
    if (dtsTabId) {
      // With WXT the content scripts are bundled/registered via defineContentScript.
      // Instead of injecting TS files by path (which won't exist at runtime),
      // simply send a message to the tab and let the content script listener pick it up.
      try {
        applicationServices.tab?.getBrowserApi().sendMessage(dtsTabId, runningTaskInfo, () => {
          const err = applicationServices.runtime?.getBrowserApi().getRuntimeLastError();
          if (err) {
            console.warn(
              "[tabsOnUpdatedHandler] sendMessage error:",
              err.message,
            );
          }
        });
      } catch (e) {
        console.warn("[tabsOnUpdatedHandler] sendMessage failed", e);
      }

      // mark this tab as injected so we don't re-send repeatedly for same URL
      bgState.injectedTabs.set(tabId, tab.url || "");
    }
  }
}

// ========================================
// TAB REMOVED HANDLER
// ========================================
export function createTabsOnRemovedHandler(applicationServices: ApplicationServices) {
  return (tabId: number) => tabsOnRemovedHandlerInternal(applicationServices, tabId);
}

async function tabsOnRemovedHandlerInternal(
  applicationServices: ApplicationServices,
  tabId: number
) {
  try {
    const { settings } = await applicationServices.storage?.getStorageCachedByKeys(["settings"]) || {};

    const storedFirstTabId = settings?.firstFacebookTabId || 0;
    const storedBoundTabId = settings?.openingDevtoolsTabId || 0;

    if (bgState.firstFacebookTabId === tabId || storedFirstTabId === tabId) {
      console.log(`[tabsOnRemovedHandler] First Facebook tab ${tabId} was closed. Resetting...`);
      bgState.firstFacebookTabId = null;

      const updatedSettings = { firstFacebookTabId: 0 };
      await applicationServices.storage?.setStorageCached({ settings: updatedSettings });

      // In first-tab mode, only when the default tab is closed, pick a new one (if any exist)
      // let replacementTabId = null;
      // if ((settings?.isTabSpecific ?? false) === false) {
      //   const queriedTabs = await applicationServices.tab?.getBrowserApi().query({ url: Constants.SUPPORTED_PLATFORM_URLS });
      //   if (queriedTabs) replacementTabId = getSmallestSupportedTabId(queriedTabs);

      //   // const replacementTabId = await helpers.tabControl.findDeterministicFacebookTabId();
      //   if (replacementTabId) {
      //     bgState.firstFacebookTabId = replacementTabId;
      //     await applicationServices.storage?.setStorageCached({
      //       settings: {
      //         ...updatedSettings,
      //         firstFacebookTabId: replacementTabId,
      //       } as any,
      //     });
      //     console.log(
      //       `[tabsOnRemovedHandler] Reassigned deterministic first tab: ${replacementTabId}`,
      //     );
      //   }
      // }

      const allowedTabId = await applicationServices.tab?.getSupportedTabs();
      if (!allowedTabId || allowedTabId === -1) {
        const updatedSettings = { firstFacebookTabId: allowedTabId };
        await applicationServices.storage?.setStorageCached({ settings: updatedSettings });
        return;
      }
    }

    // If the closed tab is the bound tab (for isTabSpecific mode), log it
    if (storedBoundTabId === tabId) {
      console.log(
        `[tabsOnRemovedHandler] Bound tab ${tabId} was closed. Clearing binding.`,
      );

      await applicationServices.storage?.setStorageCached({
        settings: {
          ...settings,
          openingDevtoolsTabId: 0,
        } as any,
      });
    }

    bgState.injectedTabs.delete(tabId);
    // Clear manual bind if that tab was closed
    if (bgState.manualBoundTabId === tabId) {
      console.log(
        `[tabsOnRemovedHandler] Manual bound tab ${tabId} closed — clearing manual bind`,
      );
      bgState.manualBoundTabId = null;
    }
  } catch (error) {
    console.warn("[tabsOnRemovedHandler] Error:", error);
  }
}


// ========================================
// HANDLE MAYBE FACEBOOK TAB
// ========================================
export async function handleMaybeFacebookTab(
  applicationServices: ApplicationServices,
  tabId: any
) {
  try {
    const tab = await applicationServices.tab?.getBrowserApi().get(tabId);
    if (!tab) return;

    const url = tab.url || "";
    if (!isSupportedPlatformUrl(url)) return;

    await applicationServices.script?.injectXHRNetworkCapture(tabId);
    await applicationServices.script?.injectFacebookProfileIdCollector(tabId);
    await applicationServices.script?.injectXHRDataForwarder(tabId);

    await applicationServices.storage?.setStorageCached({
      lastActiveFacebookTab: {
        id: tab.id,
        title: tab.title || "",
        url,
      },
    });

    const { settings } = await applicationServices.storage?.getStorageCachedByKeys(["settings"]) || {};
    const isTabSpecific = settings?.isTabSpecific ?? false;

    // ── NEW: if a manual bind is active, never auto-override it ──────────
    if (bgState.manualBoundTabId !== null) {
      // Still install scripts on any FB tab, but don't touch the binding
      return;
    }
    // ─────────────────────────────────────────────────────────────────────

    if (isTabSpecific) {
      if (settings?.openingDevtoolsTabId !== tabId) {
        console.log(
          `[Auto-bind] Updating tab-specific binding: ${settings?.openingDevtoolsTabId} -> ${tabId}`,
        );
        const updatedSettings = {
          ...settings,
          openingDevtoolsTabId: tabId,
        };
        await applicationServices.storage?.setStorageCached({ settings: updatedSettings });
      }
    } else {
      if (!settings?.openingDevtoolsTabId) {
        console.log(`[Auto-bind] Setting first Facebook tab: ${tabId}`);
        const updatedSettings = {
          ...(settings || DefaultValues.SETTINGS_DATA),
          openingDevtoolsTabId: tabId,
        };
        await applicationServices.storage?.setStorageCached({ settings: updatedSettings });
      }
    }
  } catch (e) {
    console.warn("[handleMaybeFacebookTab] error:", e);
  }
}
