import { Message } from "../../types/types";
import { getCorrectFacebookTabId } from "../../helpers/tabUtils";
import { StorageService } from "../../services/storageServices";
import {
  isLikelyPlaceholderFacebookName,
  parseFacebookNameFromHtml,
  getStartDayTimestamp
} from "../../helpers/tools";

export async function handleGetFacebookAccount(message: Message, sendResponse: (resp: any) => void): Promise<void> {
  try {
    const { propertyName } = message.inputs;
    if (!propertyName || !Array.isArray(propertyName)) {
      sendResponse?.({ ok: false, error: "No propertyName provided" });
      return;
    }

    const runtimeReq: any = await StorageService.getInstance().getStorageCachedByKeys(["facebookAccounts", "fbAccountCache"]);
    const facebookAccounts = runtimeReq?.facebookAccounts || [];
    const fbAccountCache = runtimeReq?.fbAccountCache || {};
    if (!facebookAccounts || !fbAccountCache) {
      console.warn("[handleReportJoinGroupResponse] Missing facebookAccounts or fbAccountCache");
      return;
    }

    if (!Array.isArray(facebookAccounts) || facebookAccounts.length === 0) {
      console.warn("[handleReportJoinGroupResponse] facebookAccounts is empty or not an array");
      return;
    }

    const account = facebookAccounts.find((acc: any) => acc.uid === fbAccountCache.userId);
    if (!account) {
      console.warn("[handleReportJoinGroupResponse] No matching account found for userId:", fbAccountCache.userId);
      return;
    }

    const result: Record<string, any> = {};
    for (const key of propertyName) {
      result[key] = account[key] || null;
    }
    sendResponse?.({ ok: true, data: result });
  } catch (error) {
    sendResponse?.({ ok: false, error: String(error) });
  }
}

export async function handleGetFacebookAccountCache(_message: any, sendResponse: (resp: any) => void): Promise<void> {
  try {
    const runtimeReq: any = await StorageService.getInstance().getStorageCachedByKeys(["fbAccountCache"]);
    const fbAccountCache = runtimeReq?.fbAccountCache || {};
    const isCacheValid = fbAccountCache?.ts && Date.now() - fbAccountCache.ts < 5 * 60 * 1000;
    const hasNameOrId = fbAccountCache?.name || fbAccountCache?.userId;
    if (isCacheValid && hasNameOrId) {
      const cachedName = typeof fbAccountCache?.name === "string" ? fbAccountCache.name : "";
      // If cache is clearly a placeholder (often "Facebook"), try to re-detect instead of returning it.
      if (!isLikelyPlaceholderFacebookName(cachedName)) {
        sendResponse({ ok: true, data: fbAccountCache });
        return;
      }
    }

    const cookie = await chrome.cookies.get({
      url: "https://www.facebook.com/",
      name: "c_user",
    });

    const userId = cookie?.value;
    if (!userId) {
      sendResponse?.({ ok: false, error: "Not logged in to Facebook" });
      return;
    }

    let name = "";
    try {
      const allowedTabId = await getCorrectFacebookTabId();
      if (allowedTabId && allowedTabId !== -1) {
        const resp = await chrome.tabs
          .sendMessage(allowedTabId, { type: "GET_FB_ACCOUNT_CONTEXT" })
          .catch(() => null);
        if (resp?.ok && typeof resp?.name === "string" && resp.name.trim()) {
          const candidate = resp.name.trim();
          if (!isLikelyPlaceholderFacebookName(candidate)) {
            name = candidate;
          }
        }
      }
    } catch { }

    try {
      if (!name) {
        const profileUrl = `https://www.facebook.com/profile.php?id=${encodeURIComponent(userId)}`;
        const resp = await fetch(profileUrl, { credentials: "include" });
        const html = await resp.text();
        const parsed = parseFacebookNameFromHtml(html);
        if (parsed && !isLikelyPlaceholderFacebookName(parsed)) {
          name = parsed;
        }
      }
    } catch { }

    const data = {
      userId,
      name: name || "",
      ts: Date.now(),
    };
    await StorageService.getInstance().setStorageCached({
      fbAccountCache: data,
    });
    sendResponse?.({ ok: true, data });
  } catch (error: any) {
    sendResponse?.({ ok: false, error: String(error?.message || error) });
  }
}

export async function handleSendAddSourceRequest(message: Message, sendResponse: (resp: any) => void): Promise<void> {
  let res: Response | undefined;
  const { profileId, profileName, profileType } = message.inputs;

  try {
    const runtimeReq: any = await StorageService.getInstance().getStorageCachedByKeys(["user"]);
    // username
    // const extensionUserNameRaw = runtimeReq?.user?.username || runtimeReq?.user?.name;
    // userid
    const extensionUserIdRaw = runtimeReq?.user?.id;
    const extensionUserId = typeof extensionUserIdRaw === "string" || typeof extensionUserIdRaw === "number"
      ? String(extensionUserIdRaw)
      : "";

    const cate = "c442c53c-1609-46b6-8a83-9334b15c6d9b";

    let ttl = 7200;
    if (profileType === "private_group") {
      ttl = 10800;
    }

    res = await fetch(`${import.meta.env.VITE_AXIOS_BASE_URL}/profiles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        "profile_id": profileId,
        "profile_ids": [profileId],
        "name": profileName,
        "type": profileType,
        "url": `https://www.facebook.com/${profileId}`,
        "created_by_id": extensionUserId,
        "updated_by_id": extensionUserId,
        "ttl": ttl,
        // default values
        "channel_name": "facebook",
        "active": true,
        "categories": [cate],
        "primary_category_ids": [cate],
        "created_from_extension": true,
      }),
    });
  } catch (error) {
    console.log("[handleSendAddSourceRequest]", error);
  }

  let returnData = null;
  if (res?.ok) {
    returnData = await res.json();
  } else {
    console.error("[handleSendAddSourceRequest] Request failed:", res);
  }

  if (sendResponse) {
    sendResponse({ data: null });
  }
}

export async function handleFetchJoinGroupResponse(message: Message, sendResponse: (resp: any) => void): Promise<void> {
  let res: Response | undefined;
  let prompt = "", groupQuestions = "";

  const { qInfo } = message.inputs;

  // 1. Prepare prompt and groupQuestions based on message.inputs
  try {
    // treat inputs
    const textAreaFormat = `#index#. Question: #question#. Type: textarea`;
    const checkboxFormat = `#index#. Question: #question#. Type: checkbox. Options: #options# (You can choose multiple options)`;
    const radioFormat = `#index#. Question: #question#. Type: radio. Options: #options# (You can choose only one option)`;
    const groupInfo = `
      - "Group name": #group_name#
      - "Group descriptions": #group_desc#
    `;

    const userMessage = `
# Group Information:
#group_info#
---
# Questions and Options:
#question_data#
---
    `;

    const systemMessage = `
You are a form-filler assistant.
You help users join groups by analyzing the group name and description, then answering onboarding questions accordingly.

Please follow these steps:

1. Read and analyze the **Group name** and **Group description** in the section **Group Information**.
2. Understand the group's purpose and activity.
3. Answer each question in the section **Questions and Options** based on that understanding.
4. Follow the rules in the section **Response Instructions** to format your answers correctly.
5. Response Instructions:
- Each question will follow one of these formats:
  1. '1. Question: "...". Type: textarea.' → Open-ended. This questionType is "textarea". You must write a free-form answer, no additional explanation. Translate answer to vietnamese if the question is in vietnamese.
  2. '2. Question: "...". Type: checkbox. Options: "1|Option A", "2|Option B", "3|Option C" (You can choose multiple options).' → Multiple-choice response(s). This questionType is "checkbox"
  3. '3. Question: "...". Type: radio. Options: "1|Option A", "2|Option B" (You can choose only one option).' → Single-choice. This questionType is "radio"
- You must **only return the index** for checkbox or radio questions — not the text of the options. If you cannot calculate the right answer, just pick random the option(s)
- Format your full response as: questionIndex|questionType|response::questionIndex|questionType|response::...
- No additional explanation. Only structured output.

# Example:
Given:
1. Question: "What is your goal for joining?. Type: textarea.".
2. Question: "What are your skills?". Type: checkbox. Options: "1|Python", "2|SQL", "3|JavaScript" (You can choose multiple options).
3. Question: "Your preferred role?". Type: radio. Options: "1|Dev", "2|PM" (You can choose only one option).
And your answers are:
- Goal: "To learn and contribute"
- Skills: Python + JavaScript
- Preferred role: Dev
Your response must be:
1|textarea|To learn and contribute::2|checkbox|1,3::3|radio|1
    `;

    let group_info = "", question_data = "";
    for (const q of qInfo) {
      if (q.type === "groupInfo") {
        group_info = groupInfo
          .replace("#group_name#", `"${q.name.trim()}"`)
          .replace("#group_desc#", `"${q.desc.trim().replace("See less", "")}"`);
      }

      if (q.type === "textarea") {
        question_data +=
          "\t" +
          textAreaFormat
            .replace("#index#", `${q.id}`)
            .replace("#question#", `"${q.question}"`) +
          "\n";
      }

      if (q.type === "radio") {
        const opts = q.ele.map((e: any) => `"${e.idx}|${e.optionVal}"`);
        question_data +=
          "\t" +
          radioFormat
            .replace("#index#", `${q.id}`)
            .replace("#question#", `"${q.question}"`)
            .replace("#options#", opts.join(",")) +
          "\n";
      }

      if (q.type === "checkbox") {
        const opts = q.ele.map((e: any) => `"${e.idx}|${e.optionVal}"`);
        question_data +=
          "\t" +
          checkboxFormat
            .replace("#index#", `${q.id}`)
            .replace("#question#", `"${q.question}"`)
            .replace("#options#", opts.join(",")) +
          "\n";
      }
    }

    if (question_data) {// group_info can be empty
      prompt = systemMessage.replace("#group_info#", group_info).replace("#question_data#", question_data);
      groupQuestions = userMessage.replace("#group_info#", group_info).replace("#question_data#", question_data);
    }
  } catch (error) {
    console.error("[handleFetchJoinGroupResponse] Error preparing prompt and groupQuestions:", error);

    prompt = "";
    groupQuestions = "";
  }


  // 2. Send request to OpenAI API with the prepared prompt and groupQuestions
  let returnData = null,
    errorMessage = "";
  try {
    if (!prompt || !groupQuestions) {
      console.warn("[handleFetchJoinGroupResponse] Missing prompt or groupQuestions");
      return;
    }

    const { settings } = await StorageService.getInstance().getStorageCachedByKeys(["settings"]);
    if (!settings) {
      throw new Error("Missing storage settings");
    }

    // model = gpt-4.1-mini, temperature = 0.5
    const openAiSettings = {
      apiUrl: settings.openAiSettings?.apiUrl || import.meta.env.VITE_OPENAI_API_URL || "",
      apiKey: settings.openAiSettings?.apiKey || import.meta.env.VITE_OPENAI_API_KEY || "",
      model: settings.openAiSettings?.model || import.meta.env.VITE_OPENAI_MODEL_NAME || "",
      temperature: parseFloat(settings.openAiSettings?.temperature || import.meta.env.VITE_OPENAI_MODEL_TEMPERATURE || ""),
    };
    if (!openAiSettings.apiUrl || !openAiSettings.apiKey || !openAiSettings.model || isNaN(openAiSettings.temperature)) {
      throw new Error("Missing settings");
    }

    // console.log("[handleFetchJoinGroupResponse] Using OpenAI settings:", settings.openAiSettings, openAiSettings);
    const body = {
      model: openAiSettings.model,
      temperature: openAiSettings.temperature,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: groupQuestions },
      ],
    }
    // console.log("[handleFetchJoinGroupResponse] Sending request to OpenAI with body:", body);

    res = await fetch(openAiSettings.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        Authorization: "Bearer " + openAiSettings.apiKey,
      },
      body: JSON.stringify(body),
    });
    console.log("[handleFetchJoinGroupResponse] OpenAI response:", res);
    returnData = await res.json();
  } catch (error: any) {
    console.log("[handleFetchJoinGroupResponse]", error);
    errorMessage = error.message || String(error);
  }

  // console.log("[handleFetchJoinGroupResponse] OpenAI response:", returnData);

  // 3. Send back the response to the caller
  if (sendResponse) {
    sendResponse({ data: returnData, error: errorMessage });
  }
}

export async function handleReportJoinGroupResponse(message: Message, sendResponse: (resp: any) => void): Promise<void> {
  // let res: Response | undefined;
  const { url, groupId, groupType, groupName, questions, responses, responseStatus } = message.inputs;
  console.log("[handleReportJoinGroupResponse] Received message:", message.inputs);
  try {
    const { facebookAccounts, fbAccountCache } = await StorageService.getInstance().getStorageCachedByKeys(["facebookAccounts", "fbAccountCache"]);
    if (!facebookAccounts || !fbAccountCache) {
      console.warn("[handleReportJoinGroupResponse] Missing facebookAccounts or fbAccountCache");
      return;
    }

    console.log("[handleReportJoinGroupResponse] facebookAccounts:", facebookAccounts);

    if (!Array.isArray(facebookAccounts) || facebookAccounts.length === 0) {
      console.warn("[handleReportJoinGroupResponse] facebookAccounts is empty or not an array");
      return;
    }

    const account = facebookAccounts.find((acc: any) => acc.uid === fbAccountCache.userId);
    if (!account) {
      console.warn("[handleReportJoinGroupResponse] No matching account found for userId:", fbAccountCache.userId);
      return;
    }

    const DOMAIN = import.meta.env.VITE_AXIOS_BASE_URL || "";
    {
      const currentDateTime = Date.now();
      fetch(`${DOMAIN}/groups`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          "account_id": account.account_id,
          "group_id": groupId,
          "name": groupName,
          "url": url,
          "type": groupType,
          "crawled_time": currentDateTime,
          "created_time": currentDateTime,
          "updated_time": currentDateTime,
          "status": [responseStatus], // joined, requested
          "channel_name": "facebook",
          "crawler_system": "extension",
        }),
      });
    }

    {
      fetch(`${DOMAIN}/profiles/${groupId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          "status": [responseStatus]
        }),
      });
    }

  } catch (error) {
    console.log("[handleReportJoinGroupResponse]", error);
  }

  if (sendResponse) {
    sendResponse({ data: null });
  }
}

export async function handleFetchJoinGroupPreparationData(message: Message, sendResponse: (resp: any) => void): Promise<void> {
  try {
    const runtimeReq: any = await StorageService.getInstance().getStorageCachedByKeys(["facebookAccounts", "fbAccountCache", "settings"]);
    const facebookAccounts = runtimeReq?.facebookAccounts || [];
    const fbAccountCache = runtimeReq?.fbAccountCache || {};
    const settings = runtimeReq?.settings || {};

    // 1. Get joined group ids
    const joinedFbGIds = settings.archive?.joinedFbGIds || [];

    // console.log('[facebookAccounts]', facebookAccounts);
    // console.log('[fbAccountCache]', fbAccountCache);
    // console.log('[settings]', settings);
    const account = facebookAccounts.find((acc: any) => acc.uid === fbAccountCache.userId);
    // 2. Get maximum group joining daily
    if (!account) {
      throw new Error("No facebook account information found");
    }
    const maximumJoiningGroupDaily = parseInt(account.max_group_joins_per_day) || 5;
    // console.log('[maximumJoiningGroupDaily]', maximumJoiningGroupDaily);

    // 3. Get saved group number from server
    // console.log('[>>> account]', account)
    const filterVal = `{"where":{"created_time":{"gte":${getStartDayTimestamp()}}}}`;
    const apiUrl = `${import.meta.env.VITE_AXIOS_BASE_URL}/social-account/${account.account_id}/groups/count?filter=${filterVal}`;
    // console.log(apiUrl)
    const res = await fetch(`${apiUrl}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      }
    });

    let joinedCount = -1;
    if (res.ok) {
      try {
        const data = await res.json();
        // console.log('[>>> data]', data)
        joinedCount = data?.count;
      } catch (_ignore) { }
    }
    if (joinedCount === -1) {
      throw new Error("Error occurred when getting joined groups count");
    }

    const data = { joinedFbGIds, maximumJoiningGroupDaily, joinedCount };
    // console.log('[handleFetchJoinGroupPreparationData][data]', data);
    if (sendResponse) {
      sendResponse({ data: data });
    }
  } catch (error) {
    sendResponse?.({ ok: false, error: String(error) });
  }
}