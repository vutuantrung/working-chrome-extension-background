import {
  Activity,
  AlarmTime,
  Platform,
  Task,
  TimeLeft,
} from "../types/types";
import { Constants, State } from "./constants";

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

function detectPlatform(url: string | undefined | null): Platform | null {
  if (!url) return null;
  const platformParterns = Object.entries(Constants.PLATFORM_URL_PATTERNS) as [Platform, RegExp][];
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
    priority: activity.priority != null ? activity.priority : State.Priority.Medium,
    tabId: parseInt(String(assignedTabId)),
    inputs: { tabId: parseInt(String(assignedTabId)), ...treatedInputs },
    nextTask: "start",
    state: State.TaskState.PENDING,
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

export function getStartDayTimestamp() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const timestampMs = startOfDay.getTime();
  return timestampMs;
}


interface DebouncerObj { t: ReturnType<typeof setTimeout> }
export const __debouncers: Map<any, DebouncerObj> = new Map();
export function debounce(fn: Function, delay: any, key: any = fn): void {
  let o: DebouncerObj | undefined | any = __debouncers.get(key);
  if (o) clearTimeout(o.t);
  o = { t: setTimeout(fn, delay) };
  __debouncers.set(key, o);
}

export function formatTimeFromISO(isoString: string): string {
  const date = new Date(isoString);

  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();

  const pad = (n: number) => n.toString().padStart(2, "0");

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function toISOTimeToday(time: string): string {
  const [h, m, s] = time.split(":").map(Number);

  const d = new Date();
  d.setUTCHours(h, m, s, 0); // NO timezone shift

  return d.toISOString();
}

export function isTimeValid(time: string): boolean {
  // matches 00:00:00 to 23:59:59
  const regex = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
  return regex.test(time);
}

export function randomInterval(
  persist: number,
  interval: number,
  direction: string,
) {
  const shouldOffset = Math.random() < 0.5;
  if (!shouldOffset) return persist;

  if (direction === "increase") return persist + interval;
  if (direction === "decrease") return persist - interval;
}

export function randomFromPair(input: string | number | undefined | null | any): number | undefined {
  if (input == null) return undefined;
  if (typeof input === "number") return isNaN(input) ? undefined : input;
  if (typeof input === "string") {
    const numbers = input
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n));
    if (numbers.length === 0) return undefined;
    return numbers[Math.floor(Math.random() * numbers.length)];
  }
  if (Array.isArray(input)) {
    const numbers = input.map(Number).filter((n) => !isNaN(n));
    if (numbers.length === 0) return undefined;
    return numbers[Math.floor(Math.random() * numbers.length)];
  }
  return undefined;
}

export async function hashStringArr(stringArr: string[]): Promise<string | null> {
  if (Array.isArray(stringArr) && stringArr.length > 0) {
    const s = stringArr.join("_");
    // Create SHA-256 hash of the uniqueString
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));

    // Convert the hash buffer to a hexadecimal string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const sha256HexString = hashArray
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    // Use BigInt to safely handle large numbers and take the first 14 digits of the hexadecimal string
    const sha256IntBigInt = BigInt("0x" + sha256HexString);
    const sha256IntString = sha256IntBigInt.toString().slice(0, 14);

    return sha256IntString;
  }
  return null;
}

export function deletePropertiesByNames(obj: any, propNames: string[]): void {
  if (Array.isArray(obj)) {
    for (const item of obj) {
      deletePropertiesByNames(item, propNames);
    }
  } else if (typeof obj === "object" && obj !== null) {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (propNames.includes(key)) {
          delete obj[key];
        } else {
          // Recurse into nested objects or arrays
          deletePropertiesByNames(obj[key], propNames);
        }
      }
    }
  }
}
