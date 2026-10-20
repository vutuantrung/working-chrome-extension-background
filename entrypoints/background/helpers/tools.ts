import {
  Activity,
  AlarmTime,
  Platform,
  Priority,
  State,
  Task,
  TimeLeft,
} from "../types/types";

export function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function readTrimmedString(v: any): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

export function decodeHtmlEntities(input: string): string {
  return input
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

export function isLikelyPlaceholderFacebookName(name: string): boolean {
  const t = (name || "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!t) return true;
  if (t === "facebook") return true;
  if (t === "your profile" || t === "trang cá nhân của bạn") return true;
  if (t.startsWith("facebook")) return true;
  return false;
}

export function parseFacebookNameFromHtml(html: string): string {
  if (!html) return "";

  const ogTitleMatch = html.match(
    /property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
  );
  if (ogTitleMatch?.[1]) {
    const og = decodeHtmlEntities(ogTitleMatch[1]).trim();
    return isLikelyPlaceholderFacebookName(og) ? "" : og;
  }

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch?.[1]) {
    const title = decodeHtmlEntities(titleMatch[1]).trim();
    // Common patterns: "Name | Facebook" or "Name - Facebook"
    const split = title.split("|")[0]?.split("-")[0]?.trim();
    const candidate = split || title;
    return isLikelyPlaceholderFacebookName(candidate) ? "" : candidate;
  }

  return "";
}

export function normalizeTopics(
  platform: string,
  topicType: string,
  topics: any,
) {
  for (const topic of topics) {
    if (topic.platform === platform && topic.type === topicType) {
      return topic.value;
    }
  }
}

export function isValidArrayAct(arr: any) {
  return Array.isArray(arr) && arr.length > 0;
}

export function makeid(length: number): string {
  let result = "";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

export const PLATFORM_URL_PATTERNS: Record<Platform, RegExp> = {
  facebook: /^https?:\/\/(www\.|web\.)?facebook\.com\//i,
  tiktok: /^https?:\/\/(www\.)?(m\.)?(vt\.)?(vm\.)?tiktok\.com\/*.*$/i,
  threads: /^https?:\/\/(www\.)?threads\.com\/*.*$/i,
  x: /^https?:\/\/x\.com\/*.*$/i,
  youtube: /^https?:\/\/(www\.)?youtube\.com\/*.*$/i,
};

function detectPlatform(url: string | undefined | null): Platform | null {
  if (!url) return null;
  const platformParterns = Object.entries(PLATFORM_URL_PATTERNS) as [Platform, RegExp][];
  for (const [platform, re] of platformParterns) {
    // console.log(`>>>>>> detectPlatform - testing platform: ${platform}, url: ${url}`);
    if (re.test(url)) return platform;
  }
  return null;
}

export function isSupportedPlatformUrl(url: string | undefined | null): boolean {
  return detectPlatform(url) !== null;
}

export function timeLeftToNext(
  targetHour: number,
  targetMinute: number = 0,
  targetSecond: number = 0,
  type: "ms" | "s" | "m" | "h" | "obj" = "ms",
): number | TimeLeft {
  // Validate inputs
  if (typeof targetHour !== "number" || targetHour < 0 || targetHour > 23) {
    console.error("[timeLeftToNext] Invalid targetHour:", targetHour);
    return type === "obj" ? { days: 0, hours: 0, minutes: 0, seconds: 0 } : 0;
  }

  if (
    typeof targetMinute !== "number" ||
    targetMinute < 0 ||
    targetMinute > 59
  ) {
    console.error("[timeLeftToNext] Invalid targetMinute:", targetMinute);
    return type === "obj" ? { days: 0, hours: 0, minutes: 0, seconds: 0 } : 0;
  }

  if (
    typeof targetSecond !== "number" ||
    targetSecond < 0 ||
    targetSecond > 59
  ) {
    console.error("[timeLeftToNext] Invalid targetSecond:", targetSecond);
    return type === "obj" ? { days: 0, hours: 0, minutes: 0, seconds: 0 } : 0;
  }

  try {
    const now: Date = new Date();
    const targetTime: Date = new Date();

    // Set target time
    targetTime.setHours(targetHour, targetMinute, targetSecond, 0);

    // If target time has already passed today, move to tomorrow
    if (targetTime.getTime() <= now.getTime()) {
      targetTime.setDate(targetTime.getDate() + 1);
    }

    const diffMs: number = targetTime.getTime() - now.getTime();

    // Ensure positive difference
    if (diffMs < 0) {
      console.error("[timeLeftToNext] Negative time difference:", diffMs);
      return type === "obj" ? { days: 0, hours: 0, minutes: 0, seconds: 0 } : 0;
    }

    // Return based on type
    switch (type) {
      case "ms":
        return diffMs;

      case "s":
        return Math.floor(diffMs / 1000);

      case "m":
        return Math.floor(diffMs / 1000 / 60);

      case "h":
        return Math.floor(diffMs / 1000 / 60 / 60);

      case "obj": {
        const totalSeconds: number = Math.floor(diffMs / 1000);
        const seconds: number = totalSeconds % 60;

        const totalMinutes: number = Math.floor(totalSeconds / 60);
        const minutes: number = totalMinutes % 60;

        const totalHours: number = Math.floor(totalMinutes / 60);
        const hours: number = totalHours % 24;

        const days: number = Math.floor(totalHours / 24);

        return { days, hours, minutes, seconds };
      }

      default:
        console.error("[timeLeftToNext] Invalid type:", type);
        return 0;
    }
  } catch (error) {
    console.error("[timeLeftToNext] Unexpected error:", error);
    return type === "obj" ? { days: 0, hours: 0, minutes: 0, seconds: 0 } : 0;
  }
}

export function generateTaskFromActivity(activity: Activity, assignedTabId: number): Task {
  let treatedInputs = activity.inputs;

  if (activity.name === "SCROLL_JOINED_GROUPS") {
    // Handle both string (from scheduled tasks)
    let groupUrlsArray: string[] = [];
    if (Array.isArray(activity.inputs.groupUrls)) {
      groupUrlsArray = activity.inputs.groupUrls.filter((e: string) => e);
    }
    if (typeof activity.inputs.groupUrls === "string") {
      groupUrlsArray = activity.inputs.groupUrls
        .split(",")
        .map((e: string) => e.trim())
        .filter((e: string) => e);
    }

    treatedInputs = {
      ...activity.inputs,
      groupUrls: groupUrlsArray,
    };
  }

  return {
    taskId: makeid(8),
    activityId: activity.id,
    activityName: activity.name,
    platform: activity.platform,
    priority: activity.priority != null ? activity.priority : Priority.Medium,
    tabId: parseInt(String(assignedTabId)),
    inputs: { tabId: parseInt(String(assignedTabId)), ...treatedInputs },
    nextTask: "start",
    state: State.PENDING,
    createdTime: Date.now(),
  };
}

export function parseDelayAndPeriodInMinutes(scheduleTime: string): AlarmTime {
  const [startTime, periodTime, startPeriod, endPeriod] = scheduleTime?.split("|");
  let delayInMinutes = 1;
  if (startTime) {
    // Always call timeLeftToNext — it wraps to tomorrow if the time has already passed today.
    // This prevents the "startTime passed → fallback delay=1" bug that causes spurious re-triggers.
    const [startTime_h, startTime_m, startTime_s] = startTime?.split(":")?.map((e) => parseInt(e));
    const startTimeLeft = timeLeftToNext(startTime_h, startTime_m, startTime_s, "m") as number;
    delayInMinutes = Math.max(1, parseFloat(startTimeLeft.toFixed(1)));
  }

  let periodInMinutes = 30;
  if (periodTime) {
    const [periodTime_h, periodTime_m, periodTime_s] = periodTime?.split(":")?.map((e) => parseInt(e));
    const periodTimeInMinutes = periodTime_h * 60 + periodTime_m + periodTime_s / 60;
    periodInMinutes = parseFloat(periodTimeInMinutes.toFixed(1));
  }

  return { delayInMinutes, periodInMinutes };
}

export function parseDelayInMinutes(scheduleTime: string): AlarmTime {
  let delayInMinutes = 1;
  if (scheduleTime) {
    const [startTime_h, startTime_m, startTime_s] = scheduleTime?.split(":")?.map((e) => parseInt(e));
    const startTimeLeft = timeLeftToNext(startTime_h, startTime_m, startTime_s, "m") as number;
    delayInMinutes = parseFloat(startTimeLeft.toFixed(1));
  }
  return { delayInMinutes };
}

export function isTimePassed(inputTimeStr: string): boolean {
  if (!inputTimeStr) {
    return false;
  }

  const [inputHours, inputMinutes, inputSeconds] = inputTimeStr.split(":");

  const currentTime = new Date();
  const inputTime = new Date();
  inputTime.setHours(
    Number(inputHours),
    Number(inputMinutes),
    Number(inputSeconds),
    0,
  );

  return inputTime < currentTime;
}

export function distinctPlatformByRequestUrl(
  requestUrl?: string,
  tabUrl?: string,
): Platform | null {
  // console.log(">>>>>> distinctPlatformByRequestUrl - requestUrl:", requestUrl, "tabUrl:", tabUrl);
  if (!requestUrl || !tabUrl) return null;

  if (tabUrl.includes("facebook.com") && requestUrl.includes("/api/graphql")) return "facebook";
  if (tabUrl.includes("tiktok.com")) return "tiktok";
  if (tabUrl.includes("x.com") && requestUrl.includes("/api/graphql")) return "x";
  if (tabUrl.includes("threads.com") && requestUrl.includes("/graphql/query")) return "threads";
  if (tabUrl.includes("youtube.com")) return "youtube";

  return null;
}

export function getStartDayTimestamp() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const timestampMs = startOfDay.getTime();
  return timestampMs;
}
