import { randomFromPair } from "@/utils/random-interval";
import {
  isTaskCanceled,
  randomIntFromInterval,
  sendRequest,
  sleep,
} from "../init-task";

type Inputs = {
  scrollTimes: string;
  feedScrollTimes: string;
  randomScrollUpTimes: string;
  waitingTime: number | string;
  currentIndex: number;
  groupNumber: number;
  groupTypeFocused: string;
  reviewPeriod: string | number;
  groupUrls: string[];
  defaultFeedGroupUrls: string[];
};

type Message = {
  activityName?: string;
  taskId?: string;
  tabId?: number;
  nextTask?: string;
  inputs: Inputs;
};

function shuffleArray<T>(array: T[]): T[] {
  const currentArray = [...array];
  for (let i = currentArray.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    let temp = currentArray[i];
    currentArray[i] = currentArray[j];
    currentArray[j] = temp;
  }
  return currentArray;
}

function setToRecommendationUrl(url: string): string {
  const randNumber = randomIntFromInterval(1, 10);
  if (randNumber % 2 === 0) {
    return url + "?action_source=group_mall_recommendation_affordance";
  }
  return url;
}

export const DEFAULT_SCROLLING_URL = [
  "https://www.facebook.com/",
  "https://www.facebook.com/groups/feed/",
  "https://www.facebook.com/?filter=groups&sk=h_chr",
];

const FB_DOMAIN_REG = /https:\/\/(www|web)\.facebook\.com\/groups(\/?)/;
const FB_GROUP_ID_REG = /https:\/\/(www|web)\.facebook\.com\/groups\/(\d+)(\?action_source=group_mall_recommendation_affordance)?/;

function isFeedUrl(url: string, feedUrls: string[]): boolean {
  const normalized = url.replace(
    "?action_source=group_mall_recommendation_affordance",
    "",
  );
  return feedUrls.some((f) => f === normalized);
}

function resolveScrollTimes(
  url: string,
  feedUrls: string[],
  scrollTimes: string,
  feedScrollTimes: string,
): number {
  const scrollTimeStringVal = isFeedUrl(url, feedUrls) ? feedScrollTimes : scrollTimes;
  let scrollTimesNumberVal = 0;
  if (typeof scrollTimeStringVal === "string" && scrollTimeStringVal.includes(",")) {
    scrollTimesNumberVal = randomFromPair(scrollTimeStringVal) || 0;
  } else {
    scrollTimesNumberVal = parseInt(String(scrollTimeStringVal)) || 0;
  }
  return scrollTimesNumberVal;
}


export const handleScrollGroupsMessage = async (message: Message) => {
  const scriptName = "SCROLL_JOINED_GROUPS";

  const { activityName, taskId, tabId } = message;

  console.log("[SCROLL_JOINED_GROUPS] Message received:", { activityName, taskId, tabId });

  if (activityName !== scriptName) return;
  if (isTaskCanceled(taskId)) {
    console.warn("[SCROLL_JOINED_GROUPS] Canceled; ignoring message", { taskId, tabId });
    return;
  }

  const randomScrollUpTimes = '2,4';
  const waitingTime = parseInt(String(message?.inputs?.waitingTime)) || 0;
  const currentIndex = parseInt(String(message?.inputs?.currentIndex)) || 0;
  const groupNumber = parseInt(String(message?.inputs?.groupNumber)) || 0;
  const groupTypeFocused = message?.inputs?.groupTypeFocused || "";
  const reviewPeriod = parseInt(String(message?.inputs?.reviewPeriod)) || 0;
  const groupUrls = message?.inputs?.groupUrls || [];
  const defaultFeedGroupUrls = message?.inputs?.defaultFeedGroupUrls || DEFAULT_SCROLLING_URL;

  const scrollTimes = String(message?.inputs?.scrollTimes).trim() || "10";
  const feedScrollTimes = String(message?.inputs?.feedScrollTimes).trim() || scrollTimes;

  const currentTask = message?.nextTask;

  try {
    // ── Task 1: collect eligible groups, build URL list ────────────────────
    if (currentTask === "start") {
      if (isTaskCanceled(taskId)) return;

      // Priority 1: archive.fbGUrl (populated by previous SCROLL_URLS / JOIN_GROUPS runs)
      // Priority 2: inputs.groupUrls (full URLs, used on very first run)
      let fbGUrl: string[] | null = null;

      const runtimeReq = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
      const archiveUrls: string[] = runtimeReq?.data?.archive?.fbGUrl?.split(",").filter(Boolean) ?? [];

      if (archiveUrls.length > 0) {
        fbGUrl = archiveUrls;
      } else if (Array.isArray(groupUrls) && groupUrls.length > 0) {
        // Convert full URLs → archive format "id|type|lastScrolledTime=0"
        fbGUrl = groupUrls.map((url: string) => {
          const idMatch = url.match(/facebook\.com\/groups\/(\d+)/);
          const id = idMatch ? idMatch[1] : url;
          return `${id}|0|0`;
        });
      }

      const groupCountMax = Math.min(groupNumber, fbGUrl?.length ?? 0);
      const shuffledGroups = shuffleArray(fbGUrl ?? []);
      const currentDate = Date.now();
      const rPeriod = reviewPeriod ?? 86_400_000;
      const scrollingGroups: string[] = [];

      for (const [idx, g] of shuffledGroups.entries()) {
        if (isTaskCanceled(taskId)) return;
        if (scrollingGroups.length >= groupCountMax) break;

        const [id, type, lastScrolledTime] = g.split("|");
        const groupType = type === "1" ? "public" : "private";

        if (groupTypeFocused === "private" && groupType !== "private") continue;
        if (currentDate - parseInt(lastScrolledTime) < rPeriod) continue;

        scrollingGroups.push(`${id}|${type}|${currentDate}`);
        shuffledGroups[idx] = null as any;
      }

      let treatedGroupUrls: string[];

      if (scrollingGroups.length === 0) {
        treatedGroupUrls = defaultFeedGroupUrls;
      } else {
        const groupUrlList = scrollingGroups.map((e) => {
          const [id] = e.split("|");
          return defaultFeedGroupUrls.includes(id)
            ? id
            : setToRecommendationUrl(`https://www.facebook.com/groups/${id}`);
        });

        treatedGroupUrls = shuffleArray([...groupUrlList, ...defaultFeedGroupUrls]);

        await sleep(waitingTime);
        if (isTaskCanceled(taskId)) return;
      }

      sendRequest({
        type: "CHANGE_TAB_URL",
        inputs: {
          tabId,
          taskId,
          url: treatedGroupUrls[0],
          updateInputs: {
            currentIndex: currentIndex + 1,
            groupUrls: treatedGroupUrls,
          },
          nextTask: "scroll",
        },
      });
      return;
    }

    // Task 2
    if (currentTask === "scroll") {
      const currentUrl: string = groupUrls[currentIndex - 1];
      // 1.Check group is valid
      // IMPORTANT: "groupUrls" element change to format: <id>|<scrolling_result>
      const helpHrefElement =
        document.querySelector('[href="https://www.facebook.com/help"]') ||
        document.querySelector('[href="https://web.facebook.com/help"]');
      if (helpHrefElement) {
        // mark a hint that update archive later: format id|success = 1/error = 0(group invalid/scrolling error)
        groupUrls[currentIndex - 1] =
          (FB_GROUP_ID_REG.test(currentUrl)
            ? currentUrl.replace(FB_DOMAIN_REG, "").replace("?action_source=group_mall_recommendation_affordance", "")
            : currentUrl) + "|0";

        await sleep(waitingTime);
        if (isTaskCanceled(taskId)) return;
        sendRequest({
          type: "CHANGE_TAB_URL",
          inputs: {
            tabId,
            taskId,
            url: groupUrls[currentIndex],
            updateInputs: { currentIndex: currentIndex + 1, groupUrls },
            nextTask: "scroll",
          },
        });
        return;
      }

      // 2.1.Scroll
      await sleep(1000);
      if (isTaskCanceled(taskId)) return;

      const scrollTimesVal = resolveScrollTimes(
        currentUrl,
        defaultFeedGroupUrls,
        scrollTimes,
        feedScrollTimes,
      );

      console.log(
        `[SCROLL_JOINED_GROUPS] Scrolling "${currentUrl}" as ${isFeedUrl(currentUrl, defaultFeedGroupUrls) ? "feed" : "group"
        } — ${scrollTimesVal} times`,
      );

      for (let i = 0; i < scrollTimesVal; i++) {
        if (isTaskCanceled(taskId)) return;
        const scrollInterval: number = randomFromPair(randomScrollUpTimes) ?? 4;
        const scrollLength =
          window.innerHeight + (i <= 5 ? 0 : randomIntFromInterval(400, 1000));

        if (i % scrollInterval === 0) {
          window.scrollBy({ behavior: "smooth", top: -scrollLength });
        } else {
          window.scrollBy({ behavior: "smooth", top: scrollLength });
        }

        if (i <= 3) {
          window.scrollBy({ behavior: "smooth", top: -scrollLength / 2 });
        }

        await sleep(1000 + randomIntFromInterval(500, 2000));
        if (isTaskCanceled(taskId)) return;
      }

      // 2.2.Update result
      if (FB_GROUP_ID_REG.test(currentUrl)) {
        groupUrls[currentIndex - 1] =
          currentUrl
            .replace(FB_DOMAIN_REG, "")
            .replace("?action_source=group_mall_recommendation_affordance", "") + "|1";
      } else {
        groupUrls[currentIndex - 1] = currentUrl + "|1";
      }

      // 3.Verify reach end of urls => break loop + update archive
      // IMPORTANT: "groupUrls" element change to format: <id>|<scrolling_result>
      if (currentIndex >= groupUrls.length) {
        if (isTaskCanceled(taskId)) return;

        const getSettingsReq = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
        const fbGUrl: string[] = getSettingsReq?.data?.archive?.fbGUrl?.split(",").filter(Boolean) ?? [];

        const scrolledGroupIds: string[] = [];
        const scrolledGroupLinks: string[] = [];

        for (const gU of groupUrls) {
          if (isTaskCanceled(taskId)) return;

          const [id, success] = gU.split("|");

          // Only update archive for group URLs, not feed URLs
          if (isFeedUrl(id, defaultFeedGroupUrls)) continue;

          for (const [sGIndex, sGValue] of fbGUrl.entries()) {
            if (isTaskCanceled(taskId)) return;
            if (!sGValue.includes(id)) continue;

            const [sGId, sGType] = sGValue.split("|");
            if (success === "1") {
              fbGUrl[sGIndex] = `${sGId}|${sGType}|${Date.now()}`;
              scrolledGroupIds.push(sGId);
              scrolledGroupLinks.push(`https://www.facebook.com/groups/${sGId}`);
            }
          }
        }

        sendRequest({
          type: "SCRIPT_EXECUTE_RESULT",
          inputs: {
            taskId,
            tabId,
            updateArchive: { fbGUrl: fbGUrl.filter(Boolean).join(",") },
            result: { groupIds: scrolledGroupIds, groupLinks: scrolledGroupLinks },
          },
        });
        return;
      }

      // 4. Go to next url/task
      await sleep(waitingTime);
      if (isTaskCanceled(taskId)) return;

      sendRequest({
        type: "CHANGE_TAB_URL",
        inputs: {
          tabId,
          taskId,
          url: groupUrls[currentIndex],
          updateInputs: { currentIndex: currentIndex + 1, groupUrls },
          nextTask: "scroll",
        },
      });
    }
  } catch (error: any) {
    console.log(">>>> [SCROLL_JOINED_GROUPS] Error:", error);
    if (isTaskCanceled(taskId)) {
      console.warn("[SCROLL_JOINED_GROUPS] Canceled; stopping execution", { taskId, tabId });
      return;
    }
    sendRequest({
      type: "SCRIPT_EXECUTE_RESULT",
      inputs: { taskId, tabId, error: error.message },
    });
  }
};