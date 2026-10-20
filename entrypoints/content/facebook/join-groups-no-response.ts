import {
  isTaskCanceled,
  randomIntFromInterval,
  sendRequest,
  sleep,
} from "../init-task";

type Inputs = {
  currentIdx: number;
  groupUrls: string[];
  waitingTime: number | string;
  reportBackApi?: string;
  getGroupsApi?: string;
};

type Message = {
  activityName?: string;
  taskId?: string;
  tabId?: number;
  wsReporter?: WebSocket;
  profileId?: string;
  nextTask?: string;
  inputs: Inputs;
};

function getRecommendationUrl(url: string): string {
  const randNumber = randomIntFromInterval(1, 10);
  if (randNumber % 2 === 0) {
    return url + "?action_source=group_mall_recommendation_affordance";
  }
  return url;
}

async function fetchGroupsUrl(apiUrl: string): Promise<string[]> {
  try {
    const runtimeReq = await chrome.runtime.sendMessage({
      type: "FETCH_DATA",
      inputs: {
        url: apiUrl,
        reqInit: {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      },
    });

    const dataContent = runtimeReq.data;
    if (dataContent.result === "failed") {
      throw new Error("Fetch joining groups failed.");
    }
    if (!Array.isArray(dataContent.urls)) {
      throw new Error("Invalid group urls");
    }
    return dataContent.urls;
  } catch (error: any) {
    console.log("[error][getGroupsUrl]", error.message);
    return [];
  }
}

async function reportJoinResult(apiUrl: string, body: any): Promise<void> {
  try {
    const runtimeReq = await chrome.runtime.sendMessage({
      type: "FETCH_DATA",
      inputs: {
        url: apiUrl,
        reqInit: {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify(body),
        },
      },
    });

    const dataContent = runtimeReq.data;
    if (dataContent.reportResult === "failed") {
      console.log("report failed");
    }
    console.log("report successfully");
  } catch (error: any) {
    console.log("[error][reportJoinResult]", error.message);
  }
}

async function executeJoining(
  document: Document,
): Promise<
  | "joined"
  | "responseRequired"
  | "invalidUrl"
  | "noResponseRequired"
  | "pausedGroup"
  | "unknown"
> {
  // 1. if joining request is sent
  {
    // 1.1 already joined
    const joinedElementsLabeled =
      document.querySelector("div[aria-label='Joined'][role='button']") ||
      document.querySelector("div[aria-label='Đã tham gia'][role='button']") ||
      document.querySelector("div[aria-label='Liked'][role='button']") ||
      document.querySelector("div[aria-label='Đã thích'][role='button']") ||
      document.querySelector("div[aria-label='Following'][role='button']") ||
      document.querySelector("div[aria-label='Đang theo dõi'][role='button']");
    if (joinedElementsLabeled) {
      return "joined";
    }
    // 1.2 need answer questions
    const answerElementLabeled =
      document.querySelector(
        "div[aria-label='Trả lời câu hỏi'][role='button']",
      ) ||
      document.querySelector(
        "div[aria-label='Answer questions'][role='button']",
      ) ||
      document.querySelector(
        "div[aria-label='Trả lời câu hỏi'][role='dialog']",
      ) ||
      document.querySelector(
        "div[aria-label='Answer questions'][role='dialog']",
      );
    if (answerElementLabeled) {
      return "responseRequired";
    }
  }

  // 2. click join group button
  {
    const joinGroupButton2 =
      document.querySelector("[aria-label='Thích']") ||
      document.querySelector("[aria-label='Like']") ||
      document.querySelector("[aria-label='Theo dõi']") ||
      document.querySelector("[aria-label='Follow']");
    if (joinGroupButton2) {
      (joinGroupButton2 as HTMLElement).click();
      await sleep(5_000);
      return "joined";
    }

    const joinGroupButton =
      document.querySelector("[aria-label='Tham gia nhóm']") ||
      document.querySelector("[aria-label='Join group']");
    if (joinGroupButton) {
      (joinGroupButton as HTMLElement).click();
      await sleep(10_000);
    }
  }

  // 3. Check type of respond question type
  {
    // 3.0 joined
    const joinedElementsLabeled =
      document.querySelector("div[aria-label='Joined'][role='button']") ||
      document.querySelector("div[aria-label='Đã tham gia'][role='button']") ||
      document.querySelector("div[aria-label='Liked'][role='button']") ||
      document.querySelector("div[aria-label='Đã thích'][role='button']");
    if (joinedElementsLabeled) {
      return "joined";
    }

    // 3.1 response required
    const answerQuestionElementLabeled =
      document.querySelector(
        "div[aria-label='Trả lời câu hỏi'][role='button']",
      ) ||
      document.querySelector(
        "div[aria-label='Answer questions'][role='button']",
      ) ||
      document.querySelector(
        "div[aria-label='Trả lời câu hỏi'][role='dialog']",
      ) ||
      document.querySelector(
        "div[aria-label='Answer questions'][role='dialog']",
      );
    if (answerQuestionElementLabeled) {
      return "responseRequired";
    }

    // 3.2 content unavailable - invalid url
    const spanDirAutoElements = [
      ...document.querySelectorAll("span[dir='auto']"),
    ];
    const contentUnavailableElement = spanDirAutoElements.find((e: any) => {
      const eInnerText = e.innerText.toLowerCase();
      return (
        eInnerText.includes("bạn hiện không xem được nội dung này") ||
        eInnerText.includes("this content isn't available right now") ||
        eInnerText.includes("trang này không hiển thị") ||
        eInnerText.includes("this page isn't available")
      );
    });
    if (contentUnavailableElement) {
      return "invalidUrl";
    }

    // 3.3 request sent - no reponse required
    const waitingAdminResNotifElement = spanDirAutoElements.find((e: any) => {
      const eInnerText = e.innerText.toLowerCase();
      return (
        eInnerText.includes("yêu cầu tham gia của bạn đang chờ xử lý") ||
        eInnerText.includes("your membership is pending")
      );
    });
    if (waitingAdminResNotifElement) {
      return "noResponseRequired";
    }

    // 3.4 group paused
    const groupPausedElement = spanDirAutoElements.find((e: any) => {
      const eInnerText = e.innerText.toLowerCase();
      return (
        eInnerText.includes("nhóm này đang tạm dừng") ||
        eInnerText.includes("this group is paused")
      );
    });
    if (groupPausedElement) {
      return "pausedGroup";
    }

    return "unknown";
  }
}

export const handleJoinGroupsNoResponseMessage = async (message: Message) => {
  const scriptName = "JOIN_GROUPS";
  const { activityName, taskId, tabId, wsReporter, profileId } = message;

  console.log("[JOIN_GROUPS_NO_RESPONSE]", "Message received:", {
    activityName,
    taskId,
    tabId,
  });

  // Filter: only handle JOIN_GROUPS messages
  if (activityName !== scriptName) {
    return;
  }

  if (isTaskCanceled(taskId)) {
    console.warn("[JOIN_GROUPS_NO_RESPONSE] Canceled; ignoring message", {
      taskId,
      tabId,
    });
    return;
  }

  const reportBackApi = message?.inputs?.reportBackApi || "";
  const waitingTime = message?.inputs?.waitingTime || 0;
  const currentIdx = message?.inputs?.currentIdx || 0;
  const getGroupsApi = message?.inputs?.getGroupsApi || "";
  const groupUrls = message?.inputs?.groupUrls || [];

  const currentTask = message.nextTask;
  try {
    if (isTaskCanceled(taskId)) return;
    let localActorId: string | undefined;
    try {
      const raw = localStorage.getItem("screen_time_period_logging_facebook");
      if (raw) localActorId = JSON.parse(raw)?.actorId;
    } catch {}
    const pId = profileId ?? localActorId;

    // Task 1
    if (currentTask === "start" || currentTask === "go_to_group_url") {
      if (isTaskCanceled(taskId)) return;
      const inputGroupsUrl = Array.isArray(groupUrls) ? groupUrls : [];
      let gUrls = [...inputGroupsUrl];

      // Check if groups is empty else fetch groups url
      if (gUrls.length === 0) {
        if (!getGroupsApi) {
          throw new Error("Group urls is empty 0");
        }
        const currentUrl = new URL(getGroupsApi);
        if (pId) {
          currentUrl.searchParams.set("profileId", pId);
        }
        // currentUrl.searchParams.set("groupsCount", 5);
        currentUrl.searchParams.set("groupsCount", "5");

        gUrls = await fetchGroupsUrl(currentUrl.toString());
      }

      if (gUrls.length === 0) {
        throw new Error("Group urls is empty 1");
      }

      // Verify opening url is valid
      const openUrl = gUrls[currentIdx];
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
          updateInputs: { currentIdx: currentIdx + 1, groupUrls: gUrls },
          nextTask: "join",
        },
      });
      return;
    }

    // Task 2
    if (currentTask === "join") {
      await sleep(3000);
      if (isTaskCanceled(taskId)) return;

      const joiningResult = await executeJoining(document);

      if (!reportBackApi) {
        console.log("[reportresult]", "no api report found");
      }

      if (wsReporter?.readyState === WebSocket.CONNECTING) {
        const reportData = {
          sender: "ext",
          msgType: "REPORT_TASK",
          editedTime: new Date().toLocaleTimeString(),
          data: {
            platform: "facebook",
            profileId: pId,
            taskName: "join_groups_no_response",
            url: document.URL,
            joiningResult: joiningResult,
          },
        };

        wsReporter.send(JSON.stringify(reportData));
      }

      // Verify reach end of urls
      if (currentIdx >= groupUrls.length) {
        if (isTaskCanceled(taskId)) return;
        sendRequest({
          type: "SCRIPT_EXECUTE_RESULT",
          inputs: {
            taskId: taskId,
            tabId: tabId,
          },
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
          url: getRecommendationUrl(groupUrls[currentIdx]),
          updateInputs: { currentIdx: currentIdx + 1 },
          nextTask: "join",
        },
      });
      return;
    }
  } catch (error: any) {
    if (isTaskCanceled(taskId)) {
      console.warn("[JOIN_GROUPS_NO_RESPONSE] Canceled; stopping execution", {
        taskId,
        tabId,
      });
      return;
    }
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
