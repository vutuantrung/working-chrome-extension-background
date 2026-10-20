import { randomFromPair } from "@/utils/random-interval";
import {
  isTaskCanceled,
  randomIntFromInterval,
  sendRequest,
  sleep,
} from "../init-task";

type Inputs = {
  currentIdx?: number;
  urls?: string[] | string;
  waitingTime?: number | string;
  scrollTimes?: string | number;
};

type Message = {
  activityName?: string;
  taskId?: string;
  tabId?: number;
  nextTask?: string;
  inputs: Inputs;
};

export const handleScrollUrlsMessage = async (message: Message) => {
  const scriptName = "SCROLL_URLS";
  const { activityName, taskId, tabId } = message;

  console.log("[SCROLL_URLS]", "Message received:", {
    activityName,
    taskId,
    tabId,
  });

  // Filter: only handle SCROLL_URLS messages
  if (activityName !== scriptName) {
    return;
  }

  if (isTaskCanceled(taskId)) {
    console.warn("[SCROLL_URLS] Canceled; ignoring message", { taskId, tabId });
    return;
  }

  const urls = Array.isArray(message?.inputs?.urls) ? message?.inputs?.urls : [];
  const currentIdx = parseInt(String(message?.inputs?.currentIdx)) || 0;
  const waitingTime = parseInt(String(message?.inputs?.waitingTime)) || 0;
  let scrollTimes = 0;
  if (typeof message.inputs?.scrollTimes === "string" && message.inputs?.scrollTimes.includes(",")) {
    scrollTimes = randomFromPair(message.inputs?.scrollTimes) || 0;
  } else {
    scrollTimes = parseInt(String(message.inputs?.scrollTimes)) || 0;
  }

  const currentTask = message.nextTask;
  try {
    // Task 1
    if (currentTask === "start" || currentTask === "go_to_group_url") {
      if (isTaskCanceled(taskId)) return;
      // Verify reach urls is empty
      if (Array.isArray(urls) && urls.length === 0) {
        throw new Error("Urls is empty");
      }

      // Verify opening url is valid
      const openUrl = urls[currentIdx];
      if (!openUrl) {
        throw new Error("Url invalid");
      }

      // Wait and sending request
      await sleep(parseInt(String(waitingTime)));
      if (isTaskCanceled(taskId)) return;
      sendRequest({
        type: "CHANGE_TAB_URL",
        inputs: {
          tabId: tabId,
          taskId: taskId,
          url: openUrl,
          updateInputs: { currentIdx: currentIdx + 1 },
          nextTask: "scroll",
        },
      });
      return;
    }

    // Task 2
    if (currentTask === "scroll") {
      // 2.1.Scroll
      await sleep(1000); // wait for loading
      if (isTaskCanceled(taskId)) return;
      const scrollTimesVal = scrollTimes ?? 10;
      for (let i = 0; i < scrollTimesVal; i++) {
        if (isTaskCanceled(taskId)) return;
        const scrollLength =
          window.innerHeight + (i <= 5 ? 0 : randomIntFromInterval(400, 1000));
        window.scrollBy({ behavior: "smooth", top: scrollLength });
        await sleep(1000 + randomIntFromInterval(500, 2000));
        if (isTaskCanceled(taskId)) return;
        if (i <= 3) {
          window.scrollBy({ behavior: "smooth", top: -window.innerHeight / 2 });
        }
      }

      // Verify reach end of urls
      if (currentIdx >= urls.length) {
        if (isTaskCanceled(taskId)) return;
        sendRequest({
          type: "SCRIPT_EXECUTE_RESULT",
          inputs: { taskId, tabId },
        });
        return;
      }

      await sleep(parseInt(String(waitingTime)));
      if (isTaskCanceled(taskId)) return;
      sendRequest({
        type: "CHANGE_TAB_URL",
        inputs: {
          tabId: tabId,
          taskId: taskId,
          url: urls[currentIdx],
          updateInputs: { currentIdx: currentIdx + 1 },
          nextTask: "scroll",
        },
      });
      return;
    }
  } catch (error: any) {
    if (isTaskCanceled(taskId)) {
      console.warn("[SCROLL_URLS] Canceled; stopping execution", {
        taskId,
        tabId,
      });
      return;
    }
    console.log("handleScrollUrlsMessage[SCCR]", error);
    sendRequest({
      type: "SCRIPT_EXECUTE_RESULT",
      inputs: {
        taskId: taskId,
        tabId: tabId,
        error: error.message,
      },
    });
  }
};
