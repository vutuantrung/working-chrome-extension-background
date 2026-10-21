import SparkMD5 from "spark-md5";
import { YoutubePostData, YoutubePostLocalStorageInfo, YoutubeProfileLocalStorageInfo, YoutubeUserProfileData } from "../types";
import { getStorageByKeys, setStorageCached } from "@/entrypoints/background/services/storageServices";

export const YOUTUBE_POST_INFO_KEY = "youtube_posts_info";
export const YOUTUBE_PROFILE_INFO_KEY = "youtube_profiles_info";
export const MAXIMUM_USERS = 10;

export function generateKey(socialId: string, videoId: string) {
  const md5HexStringSocialId = SparkMD5.hash(socialId);
  const md5HexStringVideoId = SparkMD5.hash(videoId);

  const decSocialId = BigInt('0x' + md5HexStringSocialId).toString();
  const decVideoId = BigInt('0x' + md5HexStringVideoId).toString();

  return decSocialId.slice(0, 14) + decVideoId.slice(0, 14);
}

export function parseYoutubePostsInfo(youtubePostsInfoStr = ""): YoutubePostLocalStorageInfo[] {
    if (!youtubePostsInfoStr) {
        return [];
    }
    return JSON.parse(youtubePostsInfoStr);
}

export function parseYoutubeProfilesInfo(youtubeProfilesInfoStr = ""): YoutubeProfileLocalStorageInfo[] {
    if (!youtubeProfilesInfoStr) {
        return [];
    }
    return JSON.parse(youtubeProfilesInfoStr);
}

export async function storeYoutubePostData(newPosts: YoutubePostData[] = []): Promise<YoutubePostLocalStorageInfo[]> {
    const localStoragePostInfo = await getStorageByKeys([YOUTUBE_POST_INFO_KEY]);
    const youtubePostInfoStr = localStoragePostInfo[YOUTUBE_POST_INFO_KEY] || "";
    const currentPostInfo = parseYoutubePostsInfo(youtubePostInfoStr);
    const tmpCurrentPostInfo = [...currentPostInfo];

    for (const newPost of newPosts) {
        const index = tmpCurrentPostInfo.findIndex((p) => p.post_id === newPost.post_id);
        if (index !== -1) {
            console.log("Post info already exists in local storage, skip saving. Post ID:", newPost.post_id, "Profile ID:", newPost.owner_id);
            continue;
        }
        if (tmpCurrentPostInfo.length >= MAXIMUM_USERS) {
            tmpCurrentPostInfo.shift();
        }
        const newPostLocalStorageInfo: YoutubePostLocalStorageInfo = {
          entry_rowkey: newPost.entry_rowkey,
          post_id: newPost.post_id,
          owner_id: newPost.owner_id,
          owner_name: newPost.owner_name || newPost.author_name,
        };
        tmpCurrentPostInfo.push(newPostLocalStorageInfo);
    }

    setStorageCached({ [YOUTUBE_POST_INFO_KEY]: JSON.stringify(tmpCurrentPostInfo) });
    return tmpCurrentPostInfo;
}

export async function storeYoutubeProfileData(newProfiles: YoutubeProfileLocalStorageInfo[] = []): Promise<YoutubeProfileLocalStorageInfo[]> {
    const localStoragePostInfo = await getStorageByKeys([YOUTUBE_PROFILE_INFO_KEY]);
    const youtubeProfileInfoStr = localStoragePostInfo[YOUTUBE_PROFILE_INFO_KEY] || "";
    const currentProfileInfo = parseYoutubeProfilesInfo(youtubeProfileInfoStr);
    const tmpCurrentProfileInfo = [...currentProfileInfo];

    for (const newProfile of newProfiles) {
        const index = tmpCurrentProfileInfo.findIndex((p) => p.profile_id === newProfile.profile_id);
        if (index !== -1) {
            console.log("Profile info already exists in local storage, skip saving. Profile ID:", newProfile.profile_id);
            continue;
        }
        if (tmpCurrentProfileInfo.length >= MAXIMUM_USERS) {
            tmpCurrentProfileInfo.shift();
        }
        const newPostLocalStorageInfo: YoutubeProfileLocalStorageInfo = { ...newProfile };
        tmpCurrentProfileInfo.push(newPostLocalStorageInfo);
    }

    setStorageCached({ [YOUTUBE_PROFILE_INFO_KEY]: JSON.stringify(tmpCurrentProfileInfo) });
    return tmpCurrentProfileInfo;
}

function parseVietnameseAbbreviatedNumber(cleaned: string): number | null {
  if (!cleaned || typeof cleaned !== "string") return null;

  const match = cleaned.match(/^([\d.,]+)\s*(nghìn|ngàn|triệu|tỷ|tr|n|k|m|b)?$/i);
  if (!match) return null;

  const numberPart = match[1];
  const suffixRaw = (match[2] || "").toLowerCase();

  const suffixMap: Record<string, string> = {
    nghìn: "n",
    ngàn: "n",
    triệu: "tr",
    tỷ: "tỷ",
  };
  const suffixKey = suffixMap[suffixRaw] || suffixRaw;

  let normalized: string;
  const hasComma = numberPart.includes(",");
  const hasDot = numberPart.includes(".");

  if (hasComma && hasDot) {
    const lastComma = numberPart.lastIndexOf(",");
    const lastDot = numberPart.lastIndexOf(".");
    normalized =
      lastComma > lastDot
        ? numberPart.replace(/\./g, "").replace(",", ".")
        : numberPart.replace(/,/g, "");
  } else if (hasComma) {
    const decimalDigits = numberPart.split(",")[1]?.length ?? 0;
    normalized =
      suffixKey || decimalDigits <= 2
        ? numberPart.replace(",", ".")
        : numberPart.replace(/,/g, "");
  } else if (hasDot) {
    const decimalDigits = numberPart.split(".")[1]?.length ?? 0;
    normalized =
      suffixKey || decimalDigits <= 2
        ? numberPart
        : numberPart.replace(/\./g, "");
  } else {
    normalized = numberPart;
  }

  const baseNumber = parseFloat(normalized);
  if (isNaN(baseNumber)) return null;

  const VIEW_SUFFIX_MULTIPLIER: Record<string, number> = {
    n: 1_000,
    k: 1_000,
    tr: 1_000_000,
    m: 1_000_000,
    b: 1_000_000_000,
    tỷ: 1_000_000_000,
  };

  const multiplier = suffixKey ? VIEW_SUFFIX_MULTIPLIER[suffixKey] : 1;
  if (suffixKey && multiplier === undefined) return null;

  return Math.round(baseNumber * (multiplier ?? 1));
}

export function parseVietnameseViewCount(raw: string): number | null {
  if (!raw || typeof raw !== "string") return null;

  const text = raw.replace(/[\u00A0\u2000-\u200B\u202F\u3000]/g, " ").trim();

  if (/không\s*có\s*l(ư|u)ợt\s*xem/i.test(text)) {
    return 0;
  }

  const cleaned = text
    .replace(/l(ư|u)ợt\s*xem/gi, "")
    .replace(/views?/gi, "")
    .trim();

  return parseVietnameseAbbreviatedNumber(cleaned);
}

export function parseVietnameseSubscriberCount(raw: string): number | null {
  if (!raw || typeof raw !== "string") return null;

  const text = raw.replace(/[\u00A0\u2000-\u200B\u202F\u3000]/g, " ").trim();

  if (/(chưa|không)\s*có\s*ng(ư|u)ời\s*đăng\s*ký/i.test(text)) {
    return 0;
  }

  const cleaned = text
    .replace(/ng(ư|u)ời\s*đăng\s*ký/gi, "")
    .replace(/subscribers?/gi, "")
    .replace(/\bsubs?\b/gi, "")
    .trim();

  return parseVietnameseAbbreviatedNumber(cleaned);
}

export function parseVietnameseVideoCount(raw: string): number | null {
  if (!raw || typeof raw !== "string") return null;
 
  const text = raw.replace(/[\u00A0\u2000-\u200B\u202F\u3000]/g, " ").trim();
 
  if (/không\s*có\s*video/i.test(text)) {
    return 0;
  }
 
  const cleaned = text
    .replace(/videos?/gi, "")
    .replace(/\bnào\b/gi, "")
    .trim();
 
  return parseVietnameseAbbreviatedNumber(cleaned);
}

type TimeUnit = "giây" | "phút" | "giờ" | "ngày" | "tuần" | "tháng" | "năm";
export function parseVietnameseRelativeTime(
  raw: string,
  baseDate: Date = new Date()
): number | null {
  if (!raw || typeof raw !== "string") return null;
  const text = raw
    .replace(/[\u00A0\u2000-\u200B\u202F\u3000]/g, " ")
    .trim()
    .toLowerCase();

  if (/vừa\s*xong|just\s*now/.test(text)) {
    return baseDate.getTime();
  }

  const match = text.match(
    /(\d+)\s*(giây|giay|phút|phut|giờ|gio|ngày|ngay|tuần|tuan|tháng|thang|năm|nam|second|minute|hour|day|week|month|year)s?\s*(trước|ago)/
  );
  if (!match) return null;

  const amount = parseInt(match[1], 10);
  if (isNaN(amount)) return null;

  const ENGLISH_UNIT_TO_VIETNAMESE: Record<string, TimeUnit> = {
    second: "giây",
    minute: "phút",
    hour: "giờ",
    day: "ngày",
    week: "tuần",
    month: "tháng",
    year: "năm",
  };

  const UNIT_ALIASES: Record<string, TimeUnit> = {
    giây: "giây",
    giay: "giây",
    phút: "phút",
    phut: "phút",
    giờ: "giờ",
    gio: "giờ",
    ngày: "ngày",
    ngay: "ngày",
    tuần: "tuần",
    tuan: "tuần",
    tháng: "tháng",
    thang: "tháng",
    năm: "năm",
    nam: "năm",
  };

  const unitRaw = match[2];
  const unit = UNIT_ALIASES[unitRaw] || ENGLISH_UNIT_TO_VIETNAMESE[unitRaw];
  if (!unit) return null;

  const UNIT_TO_MS: Record<TimeUnit, number> = {
    giây: 1000,
    phút: 60 * 1000,
    giờ: 60 * 60 * 1000,
    ngày: 24 * 60 * 60 * 1000,
    tuần: 7 * 24 * 60 * 60 * 1000,
    tháng: 30 * 24 * 60 * 60 * 1000,
    năm: 365 * 24 * 60 * 60 * 1000,
  };

  const ms = UNIT_TO_MS[unit] * amount;
  return baseDate.getTime() - ms;
}

export function parseVietnameseChannelJoinDate(raw: string): Date | null {
  if (!raw || typeof raw !== "string") return null;
 
  const text = raw
    .replace(/[\u00A0\u2000-\u200B\u202F\u3000]/g, " ")
    .trim()
    .toLowerCase();

  const viMatch = text.match(
    /(\d{1,2})\s*(?:thg\.?|tháng)\s*(\d{1,2})\s*(?:,|năm)?\s*(\d{4})/
  );
  if (viMatch) {
    const day = parseInt(viMatch[1], 10);
    const month = parseInt(viMatch[2], 10);
    const year = parseInt(viMatch[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return new Date(year, month - 1, day);
  }
 
  const enMatch = text.match(
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*(\d{1,2}),?\s*(\d{4})/
  );
  
  if (enMatch) {
    const ENGLISH_MONTH_TO_NUMBER: Record<string, number> = {
      jan: 1,
      feb: 2,
      mar: 3,
      apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      aug: 8,
      sep: 9,
      sept: 9,
      oct: 10,
      nov: 11,
      dec: 12,
    };

    const month = ENGLISH_MONTH_TO_NUMBER[enMatch[1]];
    const day = parseInt(enMatch[2], 10);
    const year = parseInt(enMatch[3], 10);
    if (!month || day < 1 || day > 31) return null;
    return new Date(year, month - 1, day);
  }
 
  return null;
}

export function parseTimestampToSeconds(timestamp: string) {
  const parts = timestamp.split(":").map((p) => parseInt(p, 10));

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  }

  return parts[0] || 0;
}

export function findByKey(jsonObject: any, targetKey: string): any {
  if (jsonObject === null || typeof jsonObject !== 'object') {
    return undefined;
  }

  if (Array.isArray(jsonObject)) {
    for (const item of jsonObject) {
      const result = findByKey(item, targetKey);
      if (result !== undefined) return result;
    }
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(jsonObject, targetKey)) {
    return jsonObject[targetKey];
  }

  for (const key of Object.keys(jsonObject)) {
    const result = findByKey(jsonObject[key], targetKey);
    if (result !== undefined) return result;
  }

  return undefined;
}
