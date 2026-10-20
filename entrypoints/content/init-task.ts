export type RunningTaskInfo = {
  platform?: string;
  tabId?: number;
  taskId?: string;
};

let __cancelAllTasks = false;
const __canceledTaskIds = new Set<string>();

export function cancelAllTasks(): void {
  __cancelAllTasks = true;
  __canceledTaskIds.clear();
  console.warn("[CANCEL] All tasks canceled on this tab");
}

export function cancelTask(taskId?: string): void {
  if (!taskId) return;
  __canceledTaskIds.add(taskId);
  console.warn("[CANCEL] Task canceled:", taskId);
}

export function resetCancelState(): void {
  __cancelAllTasks = false;
  __canceledTaskIds.clear();
}

export function isTaskCanceled(taskId?: string): boolean {
  if (__cancelAllTasks) return true;
  if (!taskId) return false;
  return __canceledTaskIds.has(taskId);
}

export function sendRequest({ type, inputs }: { type: string, inputs: any }): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, inputs }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(`[sendRequest] Error for ${type}:`, chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        console.log(`[sendRequest] Response for ${type}:`, response);
        resolve(response);
      }
    });
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomIntFromInterval(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export const handleInitTaskMessage = async (message: RunningTaskInfo & { activityName?: string; nextTask?: string }) => {
  console.log("[INIT TASK]", "Message Received:", message);

  // Only handle initialization messages (no activityName or nextTask is undefined/null)
  if (message.activityName || message.nextTask) {
    // This message is for other content scripts
    return;
  }

  const runningTaskInfo = message;
  const scriptName = "INIT";
  const tabId = runningTaskInfo.tabId;

  try {
    if (runningTaskInfo.platform === "facebook") {
      const url = "https://www.facebook.com";
      sendRequest({
        type: "CHANGE_TAB_URL",
        inputs: {
          taskId: runningTaskInfo.taskId,
          url: url,
          tabId: tabId,
          nextTask: "start",
        },
      });
    }
  } catch (error: any) {
    sendRequest({
      type: "SCRIPT_EXECUTE_RESULT",
      inputs: {
        taskId: runningTaskInfo.taskId,
        tabId: tabId,
        error: error.message,
      },
    });
  }
};
