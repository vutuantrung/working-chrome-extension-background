import {
  isTaskCanceled,
  randomIntFromInterval,
  sendRequest,
  sleep,
} from "../init-task";

type Result = {
  success: boolean;
  data: any;
  errMsg?: string;
};
type Inputs = {
  currentIdx: number;
  groupUrls: string[];
  joinedFbGIds?: string[];
  waitingTime: number | string;
  accountId: string;
};
type Message = {
  activityName?: string;
  taskId?: string;
  tabId?: number;
  nextTask?: string;
  inputs: Inputs;
};
type QInfoTextarea = {
  id: number;
  type: "textarea";
  ele: HTMLElement | null;
  question?: string;
};
type QInfoRadio = {
  id: number;
  type: "radio";
  question: string;
  ele: { idx: number; optionVal: string; optionEle: HTMLInputElement }[];
};
type QInfoCheckbox = {
  id: number;
  type: "checkbox";
  question: string;
  ele: { idx: number; optionVal: string; optionEle: HTMLInputElement }[];
};
type QInfoGroupInfo = {
  type: "groupInfo";
  name: string;
  desc: string;
};
type QInfo = QInfoTextarea | QInfoRadio | QInfoCheckbox | QInfoGroupInfo;

type RequestResponseResult =
  | { id: number; type: "textarea"; response: string }
  | { id: number; type: "radio"; response: number }
  | { id: number; type: "checkbox"; response: number[] };

function getRecommendationUrl(url: string): string {
  const randNumber = randomIntFromInterval(1, 10);
  if (randNumber % 2 === 0) {
    return url + "?action_source=group_mall_recommendation_affordance";
  }
  return url;
}

// function findSeeMoreButton_backup(element: any): HTMLElement | null {
//   if (!element || !element.childNodes) return null;
//   for (const e of element.childNodes) {
//     if (e.innerHTML === "See more" || e.innerHTML === "Xem thêm") {
//       return e as HTMLElement;
//     }
//     const found = findSeeMoreButton(e);
//     if (found) return found;
//   }
//   return null;
// }

function findSeeMoreButton(element: any): HTMLElement | null {
  const match = [...element.querySelectorAll("*")].find((node) =>
    ["see more", "xem thêm"].includes(node.innerHTML.trim().toLowerCase()),
  );
  return match as HTMLElement | null;
}

// Recursively extract text from group description DOM element
function extractGroupDesc(element: any): string {
  let text = "";
  if (!element || !element.childNodes) return text;
  element.childNodes.forEach((node: any) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent + ". ";
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      text += extractGroupDesc(node) + ". ";
    }
  });
  return text;
}

function respondQuestions(
  responses: Array<RequestResponseResult>,
  qInfo: Array<QInfo>,
): boolean {
  try {
    // Agree group button
    const agreeToGroupRuleCheckbox: HTMLElement | null = document.querySelector(
      "input[name='agree-to-group-rules'][type='checkbox']",
    );
    if (agreeToGroupRuleCheckbox) {
      agreeToGroupRuleCheckbox.click();
    }
    // console.log("[qInfo]", qInfo);

    /**
     * Response format: { id: number, type: string, response: string|number[] }[]
     *
     * id: id question
     * type: "textarea"|"radio"|"checkbox"
     * response:
     * - if text: string - text res
     * - if checkbox/radio: number[] - array of position
     */
    for (const response of responses) {
      const question = qInfo.find(
        (q: QInfo) => q.type !== "groupInfo" && q.id === response.id,
      );
      if (!question) {
        console.warn("Question not found for response", response);
        continue;
      }

      // console.log("[question]", question, '[response]', response);
      if (response.type === "textarea" && question.type === "textarea") {
        // console.log("[textarea e]", question.ele, response.response);
        // document.querySelector(`textarea[class='${question.e.attributes.class.value}']`).value = r.response;
        question.ele?.focus();
        // question.ele.value = r.response;
        document.execCommand("insertText", false, response.response);
      }

      if (response.type === "checkbox" && question.type === "checkbox") {
        for (const pos of response.response) {
          // checkbox response can have multiple options, so we choose the answer(s) based on the position(s) in the response array
          const findingOpt = question.ele.find((o: any) => o.idx === pos);
          if (findingOpt) {
            // console.log("[checkbox][findingOpt]", findingOpt);
            findingOpt.optionEle.click();
          }
        }
      }

      if (response.type === "radio" && question.type === "radio") {
        // radio response only has one option, so we choose only the postion equal to the response
        const findingOpt = question.ele.find(
          (q: any) => q.idx === response.response,
        );
        if (findingOpt) {
          // console.log("[radio][findingOpt]", findingOpt);
          findingOpt.optionEle.click();
        }
      }
    }

    // Click send button
    const sendButton =
      document.querySelector("div[aria-label='Gửi'][role='button']") ||
      document.querySelector("div[aria-label='Send'][role='button']") ||
      document.querySelector("div[aria-label='Submit'][role='button']");
    if (!sendButton) {
      throw new Error("Send button not found");
    }

    (sendButton as HTMLElement).click();
    return true;
  } catch (error) {
    console.log("Error responding questions", error);
    return false;
  }
}

async function collectQuestions(): Promise<Result> {
  // helpers
  const collectTextAreaQuestionData = (
    qEle: HTMLElement,
    id: number,
  ): QInfoTextarea | null => {
    const allSpanElements = qEle.querySelectorAll("span");
    let questionElement: HTMLElement | null = null;
    for (const span of allSpanElements) {
      if (
        span.innerHTML.toLowerCase().includes("write an answer...") ||
        span.innerHTML.toLowerCase().includes("viết câu trả lời...")
      ) {
        questionElement = span as HTMLElement;
        break;
      }
    }

    if (!questionElement) {
      console.warn("Question element not found for textarea question", qEle);
      return null;
    }

    const ele = questionElement.parentElement?.querySelector("textarea");
    const question = ele?.parentElement?.parentElement
      ?.querySelector("span")
      ?.getAttribute("aria-label")
      ?.replace(/\n/g, "")
      ?.replace(/\s+/g, " ")
      ?.trim();
    // console.log("[JOIN_GROUPS] Collected textarea question", { id, ele, question });
    if (!ele || !question) return null;
    return {
      id,
      type: "textarea",
      ele,
      question,
    };
  };

  const collectRadioQuestionData = (
    qEle: HTMLElement,
    id: number,
  ): QInfoRadio | null => {
    const allSpanElements = qEle.querySelectorAll("span");
    let questionElement: HTMLElement | null = null;
    for (const span of allSpanElements) {
      const spanInnerHtml = span.innerHTML.toLowerCase();
      if (
        spanInnerHtml.includes("bạn có thể chọn 1 mục") ||
        spanInnerHtml.includes("you can choose one option")
      ) {
        questionElement = span as HTMLElement;
        break;
      }
    }

    const questionWrapper = questionElement?.parentElement?.parentElement
      ?.parentElement?.childNodes[0] as HTMLElement | null;
    if (!questionWrapper) {
      console.warn("Question wrapper not found for radio question", qEle);
      return null;
    }
    const question = questionWrapper.innerText.trim();

    const ele = [];
    const radioElements = Array.from(
      qEle.querySelectorAll("input[type='radio']"),
    ) as HTMLInputElement[];
    for (const [idx, radio] of radioElements.entries()) {
      const radioLabel = radio.parentElement
        ?.parentElement as HTMLElement | null;
      const optionVal = radioLabel?.innerText.trim() || "";
      const optionEle = radio;
      ele.push({ idx, optionVal, optionEle });
    }
    return {
      id,
      type: "radio",
      ele,
      question,
    };
  };

  const collectCheckBoxQuestionData = (
    qEle: HTMLElement,
    id: number,
  ): QInfoCheckbox | null => {
    const allSpanElements = qEle.querySelectorAll("span");
    let questionElement: HTMLElement | null = null;
    for (const span of allSpanElements) {
      const spanInnerHtml = span.innerHTML.toLowerCase();
      if (
        spanInnerHtml.includes("bạn có thể chọn nhiều đáp án") ||
        spanInnerHtml.includes("you can choose multiple options")
      ) {
        questionElement = span as HTMLElement;
        break;
      }
    }

    const questionWrapper = questionElement?.parentElement?.parentElement
      ?.parentElement?.childNodes[0] as HTMLElement | null;
    if (!questionWrapper) {
      console.warn("Question wrapper not found for checkbox question", qEle);
      return null;
    }
    const question = questionWrapper.innerText.trim();

    const ele = [];
    const checkboxElements = Array.from(
      qEle.querySelectorAll("input[type='checkbox']"),
    ) as HTMLInputElement[];
    for (const [idx, checkbox] of checkboxElements.entries()) {
      const checkBoxLabel = checkbox.parentElement
        ?.parentElement as HTMLElement | null;
      const optionVal = checkBoxLabel?.innerText.trim() || "";
      const optionEle = checkbox;
      ele.push({ idx, optionVal, optionEle });
    }
    return {
      id,
      type: "checkbox",
      ele,
      question,
    };
  };

  try {
    // 1. Collect group name and descriptions
    let groupDescription = "";
    // let groupType = "";
    const roleListElements = Array.from(
      document.querySelectorAll("div[role='list']"),
    );
    for (const e of roleListElements) {
      const roleParent = e.parentNode;
      const gDescNode =
        roleParent?.childNodes[1]?.childNodes[0]?.childNodes[0]?.childNodes[0]
          ?.childNodes[0];
      if (!gDescNode) {
        continue;
      }
      groupDescription = extractGroupDesc(gDescNode);
    }

    // 2. Collect questions
    const qInfo = [];
    let qRootElement =
      document.querySelector(
        'div[aria-label="Answer questions"][role="dialog"]',
      ) ||
      document.querySelector(
        'div[aria-label="Trả lời câu hỏi"][role="dialog"]',
      );

    if (!qRootElement) {
      const answerQuestionBtn =
        document.querySelector(
          'div[aria-label="Answer questions"][role="button"]',
        ) ||
        document.querySelector(
          'div[aria-label="Trả lời câu hỏi"][role="button"]',
        );

      if (answerQuestionBtn) {
        (answerQuestionBtn as HTMLElement).click();
      }
      await sleep(5000);
    }

    qRootElement =
      document.querySelector(
        'div[aria-label="Answer questions"][role="dialog"]',
      ) ||
      document.querySelector(
        'div[aria-label="Trả lời câu hỏi"][role="dialog"]',
      );
    if (!qRootElement) {
      throw new Error("Question section not found");
    }

    // group info
    {
      const formatTextarea: QInfoGroupInfo = {
        type: "groupInfo",
        name: "",
        desc: "",
      };
      // groupname
      // const groupRootInfo = qRootElement.childNodes[2].childNodes[0].childNodes[0].childNodes[0].childNodes[1].childNodes[0];
      // const groupNameElement = groupRootInfo.childNodes[0].childNodes[0];
      // @ts-ignore
      // const groupName = groupNameElement.innerHTML.trim().replace(/\n/g, "");
      // const groupTypeElement = groupRootInfo.childNodes[1].childNodes[0].childNodes[0].childNodes[0].childNodes[0].childNodes[1];
      // @ts-ignore
      // const groupTypeInnterHtml = groupTypeElement.innerHTML.trim().replace(/\n/g, "");

      // if public group => return null
      // if (groupTypeInnterHtml.toLowerCase() === "public group" || groupTypeInnterHtml.toLowerCase() === "nhóm công khai") {
      //   groupType = "public_group";
      //   return { success: true, data: { groupType } };
      // }
      // if (groupTypeInnterHtml.toLowerCase() === "private group" || groupTypeInnterHtml.toLowerCase() === "nhóm riêng tư") {
      //   groupType = "private_group";
      // }

      // formatTextarea.name = groupName;
      formatTextarea.desc = groupDescription;
      qInfo.push(formatTextarea);
    }

    // questions
    {
      const questionsRootElement =
        qRootElement.childNodes[2]?.childNodes[0]?.childNodes[0]?.childNodes[1]
          ?.childNodes[0]?.childNodes[1];
      const questionElements = questionsRootElement
        ? Array.from(questionsRootElement.childNodes)
        : [];
      let qIdx = 0;
      for (const qE of questionElements) {
        qIdx++;
        // get only div (it still has text elements)
        if (qE.nodeName.toLowerCase() !== "div") {
          continue;
        }

        // type textarea
        {
          const textAreaQuestionData = collectTextAreaQuestionData(
            qE as HTMLElement,
            qIdx,
          );
          if (textAreaQuestionData) {
            // console.log("[JOIN_GROUPS] Collected textarea question", textAreaQuestionData);
            qInfo.push(textAreaQuestionData);
            continue;
          }
        }

        // type radio
        {
          const radioQuestionElements = collectRadioQuestionData(
            qE as HTMLElement,
            qIdx,
          );
          if (radioQuestionElements) {
            // console.log("[JOIN_GROUPS] Collected radio question", radioQuestionElements);
            qInfo.push(radioQuestionElements);
            continue;
          }
        }

        // type checkbox
        {
          const checkBoxQuestionData = collectCheckBoxQuestionData(
            qE as HTMLElement,
            qIdx,
          );
          if (checkBoxQuestionData) {
            // console.log("[JOIN_GROUPS] Collected checkbox question", checkBoxQuestionData);
            qInfo.push(checkBoxQuestionData);
            continue;
          }
        }
      }
    }

    return { success: true, data: { qInfo } };
  } catch (error: any) {
    console.log("error get questions", error.message);
    return { success: false, data: null, errMsg: error.message };
  }
}

async function requestResponse(
  qInfo: QInfo[],
): Promise<RequestResponseResult[]> {
  const runtimeReq = await sendRequest({
    type: "FETCH_JG_RESPONSE",
    inputs: { qInfo: qInfo },
  });
  const dataContent = runtimeReq.data?.choices?.[0]?.message?.content;
  if (!dataContent) {
    throw new Error(runtimeReq.error || "Cannot get response from Assistant");
  }

  const res: RequestResponseResult[] = [];
  const treatedRes = dataContent.split("::");
  for (const r of treatedRes) {
    const [id, typeQ, response] = r.split("|");

    let fetchedRes = null;
    if (typeQ === "textarea") fetchedRes = response;
    if (typeQ === "radio") fetchedRes = parseInt(response);
    if (typeQ === "checkbox")
      fetchedRes = response.split(",").map((e: any) => parseInt(e));

    res.push({
      id: parseInt(id),
      type: typeQ,
      response: fetchedRes,
    });
  }
  return res;
}

export const handleJoinGroupsMessage = async (message: Message) => {
  const scriptName = "JOIN_GROUPS";
  const { activityName, taskId, tabId } = message;

  console.log("[JOIN_GROUPS]", "Message received:", {
    activityName,
    taskId,
    tabId,
  });

  // Filter: only handle JOIN_GROUPS messages
  if (activityName !== scriptName) {
    return;
  }

  if (isTaskCanceled(taskId)) {
    console.warn("[JOIN_GROUPS] Canceled; ignoring message", { taskId, tabId });
    return;
  }

  // const { groupUrls, waitingTime } = message.inputs;
  const currentIdx = parseInt(message?.inputs?.currentIdx as any) || 0;
  const waitingTime = parseInt(message?.inputs?.waitingTime as any) || 10000;
  const idOrUrls = message?.inputs?.groupUrls || [];
  const joinedFbGIds = message?.inputs?.joinedFbGIds || [];
  const currentTask = message.nextTask;

  // console.log(">>>>>>> [JOIN_GROUPS]", "Current state:", {
  //   currentIdx,
  //   waitingTime,
  //   idOrUrls,
  //   joinedFbGIds,
  //   currentTask
  // });

  try {
    // Task 1: start + get essential data
    if (currentTask === "start" || currentTask === "go_to_group_url") {
      if (isTaskCanceled(taskId)) return;
      if (idOrUrls.length === 0) {
        throw new Error("Group urls is empty");
      }

      const runtimeReq = await chrome.runtime.sendMessage({ type: "FETCH_JG_PREPARATION_DATA" });
      const joinedCount = runtimeReq?.data?.joinedCount || 0;
      const joinedFbGIds = runtimeReq?.data?.joinedFbGIds || [];
      const maximumJoiningGroupDaily = runtimeReq?.data?.maximumJoiningGroupDaily || 5;
      // console.log('[runtimeReq]', runtimeReq);
      // console.log('[joinedCount]', joinedCount);
      // console.log('[joinedFbGIds]', joinedFbGIds);
      // console.log('[maximumJoiningGroupDaily]', maximumJoiningGroupDaily);
      const remainingJoiningGroup = maximumJoiningGroupDaily - joinedCount;
      // const remainingJoiningGroup = 3;

      let count = 0;
      const inputGroupsUrl: string[] = [];
      for (const idOrUrl of idOrUrls) {
        if (count >= remainingJoiningGroup) break;
        const groupUrl = idOrUrl.startsWith("http") ? idOrUrl : `https://www.facebook.com/groups/${idOrUrl}`;

        // check if group is joined already
        let isAlreadyJoined = false;
        for (const joinedGroupId of joinedFbGIds) {
          if (groupUrl.includes(joinedGroupId)) {
            isAlreadyJoined = true;
            break;
          }
        }
        if (isAlreadyJoined) continue;

        inputGroupsUrl.push(groupUrl);
        count++;
      }

      console.log('[inputGroupsUrl]', inputGroupsUrl);

      // sendRequest({
      //   type: "SCRIPT_EXECUTE_RESULT",
      //   inputs: {
      //     taskId: taskId,
      //     tabId: tabId,
      //     error: "Stop for testing",
      //   },
      // });
      // return;

      const openUrl = inputGroupsUrl[currentIdx];
      if (!openUrl) {
        throw new Error("Url invalid");
      }

      await sleep(waitingTime);
      sendRequest({
        type: "CHANGE_TAB_URL",
        inputs: {
          tabId: tabId,
          taskId: taskId,
          url: openUrl,
          updateInputs: { currentIdx: currentIdx, groupUrls: inputGroupsUrl, joinedFbGIds: joinedFbGIds },
          nextTask: "join",
        },
      });
      return;
    }

    // Task 2 (4 cases)
    // 0. Group is not available
    // 1. Group is already joined
    // 2. Group joining is requested, waiting for approval
    // 3. Group is not joined, and we need to click "Join group" button and answer questions
    if (currentTask === "join") {
      await sleep(10_000);
      if (isTaskCanceled(taskId)) return;

      console.log(">>>>>>>>>>> *", idOrUrls, currentIdx);
      // [End condition] Reach end of urls
      if (currentIdx >= idOrUrls.length) {
        if (isTaskCanceled(taskId)) {
          return;
        }
        console.log("[JOIN_GROUPS] Reached end of group urls", { taskId, tabId });
        sendRequest({
          type: "SCRIPT_EXECUTE_RESULT",
          inputs: {
            taskId: taskId,
            tabId: tabId,
          },
        });

        // update archive here
        let joinedGroups = joinedFbGIds;
        idOrUrls.forEach(idOrUrl => {
          const groupId = idOrUrl.startsWith("https")
            ? idOrUrl.replace("https://www.facebook.com/groups/", "")
            : idOrUrl;
          if (!joinedGroups.includes(groupId)) {
            joinedGroups.push(groupId);
          }
        });

        console.log(">>>>>> joinedGroups", joinedGroups);
        sendRequest({
          type: "UPDATE_ARCHIVE",
          inputs: { updateArchive: { joinedFbGIds: joinedGroups } }
        });
        return;
      }

      let joinGroupStatus = "unknown";
      let questionCollected = null;
      let responsesRetrieved = null;
      let groupType = null;
      let groupName = null;

      // CASE 0: Group is not available
      if (joinGroupStatus === "unknown") {
        const allH2Elements = document.querySelectorAll("h2");
        for (const h2Ele of allH2Elements) {
          const h2InnerHtml = h2Ele.innerHTML.toLowerCase();
          if (
            h2InnerHtml.includes("bạn hiện không xem được nội dung này") ||
            h2InnerHtml.includes("this content isn't available right now")
          ) {
            joinGroupStatus = "request_not_available";
            break;
          }
        }
      }

      if (joinGroupStatus === "unknown") {
        const groupInfoElement = document.querySelector('div[role="main"]')
          ?.childNodes[1]?.childNodes[1] as HTMLElement | null;
        const groupNameEle = groupInfoElement?.querySelector("h1[dir='auto']");
        const groupTypeEle =
          groupNameEle?.parentElement?.parentElement?.childNodes[1]
            ?.childNodes[0]?.childNodes[0]?.childNodes[0]?.childNodes[0]
            ?.childNodes[0]?.childNodes[0]?.childNodes[0];

        const groupTypeValue =
          groupTypeEle?.textContent?.trim()?.toLowerCase() || null;
        if (
          groupTypeValue === "public group" ||
          groupTypeValue === "nhóm công khai"
        )
          groupType = "public_group";
        if (
          groupTypeValue === "private group" ||
          groupTypeValue === "nhóm riêng tư"
        )
          groupType = "private_group";
        groupName = groupNameEle?.textContent?.trim() || null;

        if (!groupName || !groupType) {
          console.log("[JOIN_GROUPS] Not a group", { taskId, tabId });
          joinGroupStatus = "request_not_available";
        }
      }

      // CASE 1: Group is joined
      if (joinGroupStatus === "unknown") {
        const joinedElement =
          document.querySelector(
            'div[aria-label="Đã tham gia"][role="button"]',
          ) ||
          document.querySelector('div[aria-label="Joined"][role="button"]');
        if (joinedElement) {
          console.log("[JOIN_GROUPS] Group is already joined", {
            taskId,
            tabId,
          });
          joinGroupStatus = "joined";
        }
      }

      // CASE 2: Group joining is requested, waiting for approval
      if (joinGroupStatus === "unknown") {
        const answerQuestionElement =
          document.querySelector(
            'div[aria-label="Answer questions"][role="button"]',
          ) ||
          document.querySelector(
            'div[aria-label="Trả lời câu hỏi"][role="button"]',
          );
        const cancelRequestElement =
          document.querySelector(
            'div[aria-label="Hủy yêu cầu"][role="button"]',
          ) ||
          document.querySelector(
            'div[aria-label="Cancel request"][role="button"]',
          );
        if (!answerQuestionElement && cancelRequestElement) {
          joinGroupStatus = "requested";
        }
      }

      // CASE 3: Group is not joined, we need to click "Join group" button and answer questions
      if (joinGroupStatus === "unknown") {
        let seeMoreBtn = null;
        const nodes = Array.from(
          document.querySelectorAll("div[style='text-align:start']"),
        );
        for (const n of nodes) {
          seeMoreBtn = findSeeMoreButton(n);
        }
        if (seeMoreBtn) seeMoreBtn.click();

        const answerQuestionElement =
          document.querySelector(
            'div[aria-label="Answer questions"][role="button"]',
          ) ||
          document.querySelector(
            'div[aria-label="Trả lời câu hỏi"][role="button"]',
          );
        const joinGroupElement =
          document.querySelector(
            'div[aria-label="Tham gia nhóm"][role="button"]',
          ) ||
          document.querySelector('div[aria-label="Join group"][role="button"]');
        const joinGroupBtnVisible = answerQuestionElement || joinGroupElement;
        if (joinGroupBtnVisible) {
          (joinGroupBtnVisible as HTMLElement).click();
        }

        await sleep(10_000);
        if (isTaskCanceled(taskId)) return;

        // *** QUESTIONS TASKS
        const dataCollected = await collectQuestions();
        // console.log("[JOIN_GROUPS] Collected questions", dataCollected);

        if (!dataCollected.success) {
          console.warn("[JOIN_GROUPS] Failed to collect questions", {
            taskId,
            tabId,
            errMsg: dataCollected.errMsg,
          });
          joinGroupStatus = "join_failed";
        } else {
          // groupType = dataCollected.data.groupType;
          questionCollected = dataCollected.data.qInfo;
        }

        if (Array.isArray(questionCollected)) {
          responsesRetrieved = await requestResponse(questionCollected);
          const success = respondQuestions(
            responsesRetrieved,
            questionCollected,
          );
          // console.log("[JOIN_GROUPS] Response", responsesRetrieved);
          // console.log("[JOIN_GROUPS] Responded questions (not sending yet)", success ? "success" : "join_failed");
          await sleep(15_000);

          joinGroupStatus = success ? "requested" : "join_failed";

          const joinedElement =
            document.querySelector(
              'div[aria-label="Đã tham gia"][role="button"]',
            ) ||
            document.querySelector('div[aria-label="Joined"][role="button"]');
          if (joinedElement) {
            joinGroupStatus = "joined";
          }
        }
      }

      // joinGroupStatus = "requested" | "joined" | "join_failed" | "request_not_available" | "unknown"
      // Task 3: Report back joining status (just for requested/joined)
      if (joinGroupStatus === "requested" || joinGroupStatus === "joined") {
        const inputs = {
          taskId: taskId,
          tabId: tabId,
          groupId: idOrUrls[currentIdx].replace(
            "https://www.facebook.com/groups/",
            "",
          ),
          groupType: groupType,
          groupName: groupName,
          questions: questionCollected,
          responses: responsesRetrieved,
          responseStatus: joinGroupStatus,
          url: idOrUrls[currentIdx],
        }
        console.log(">>>> [JOIN_GROUPS] Sending report to background", JSON.stringify(inputs));
        // *** Send questions + response status to background for logging
        sendRequest({
          type: "REPORT_JG_RESPONSE",
          inputs: inputs,
        });
      }

      await sleep(waitingTime);
      sendRequest({
        type: "CHANGE_TAB_URL",
        inputs: {
          tabId: tabId,
          taskId: taskId,
          url: getRecommendationUrl(idOrUrls[currentIdx]),
          updateInputs: { currentIdx: currentIdx + 1 },
          nextTask: "join",
        },
      });
    }
  } catch (error: any) {
    console.log("[JOIN_GROUP] Error occurred:", error);
    if (isTaskCanceled(taskId)) {
      console.warn("[JOIN_GROUPS] Canceled; stopping execution", {
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
