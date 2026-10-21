
// FACEBOOK PARSING UTILS
// ===============================================
import SparkMD5 from "spark-md5";
import * as services from "../../../services";
import { FacebookPostData, FacebookPostLocalStorageInfo } from "../types";

export function deriveArticleId(postId: string): string {
  if (typeof postId !== "string" || !postId) return "";
  const lastUnderscore = postId.lastIndexOf("_");
  return lastUnderscore >= 0 ? postId.slice(lastUnderscore + 1) : "";
}

export function stripFacebookAntiCsrfPrefix(s: string): string {
  if (typeof s !== "string") return "";
  const trimmed = s.trim();
  if (trimmed.startsWith("for (;;);")) {
    return trimmed.replace(/^for \(;;\);/, "");
  }
  return trimmed;
}

export function safeJsonParse(s: string): any | null {
  if (typeof s !== "string") return null;
  const trimmed = stripFacebookAntiCsrfPrefix(s);
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

export function normalizeGenderLabel(value: any): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  if (!t) return undefined;
  const upper = t.toUpperCase();
  if (upper === "MALE") return "Nam";
  if (upper === "FEMALE") return "Nữ";
  return t;
}

export function deriveUsernameFromUrl(url: any): string | undefined {
  if (typeof url !== "string" || !url) return undefined;
  // Examples:
  // - https://www.facebook.com/nguyen.son.642816
  // - https://m.facebook.com/profile.php?id=123
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/^\/+|\/+$/g, "");
    if (!path) return undefined;
    if (path.toLowerCase() === "profile.php") {
      const id = parsed.searchParams.get("id");
      return id ? `id:${id}` : undefined;
    }
    const firstSegment = path.split("/")[0];
    return firstSegment || undefined;
  } catch {
    // If URL constructor fails (unexpected format), do a best-effort parse.
    const m = url.match(/facebook\.com\/(?:profile\.php\?id=)?([^/?#]+)/i);
    return m?.[1] ? String(m[1]) : undefined;
  }
}

export function normalizePlaceText(s: any): string | undefined {
  if (typeof s !== "string") return undefined;
  const t = s.trim();
  if (!t) return undefined;
  // Common patterns from tiles:
  // - "Lives in Hanoi, Vietnam" -> "Hanoi, Vietnam"
  // - "From Mai Châu" -> "Mai Châu"
  // Also handle Vietnamese common phrases.
  return t
    .replace(/^lives in\s+/i, "")
    .replace(/^from\s+/i, "")
    .replace(/^sống\s+tại\s+/i, "")
    .replace(/^đến\s+từ\s+/i, "")
    .trim();
}

export function normalizeFieldKey(k: any): string | undefined {
  if (typeof k !== "string") return undefined;
  const t = k.trim();
  if (!t) return undefined;
  // Common cases:
  // - "CURRENT_CITY" -> "current_city"
  // - "current_city" -> "current_city"
  // - "home_town" -> "home_town"
  return t.toLowerCase();
}

function pickProfileOwnerName(owner: any): string | undefined {
  if (!owner || typeof owner !== "object") return undefined;
  const name = typeof owner.name === "string" ? owner.name.trim() : "";
  if (name) return name;

  const shortName = typeof owner.short_name === "string" ? owner.short_name.trim() : "";

  return shortName || undefined;
}

export function extractProfileOwnerCandidate(root: any): { id?: string; name?: string } | null {
  try {
    const userNode =
      // root?.data?.node?.comet_hovercard_renderer?.user ||
      root?.data?.node?.user ||
      root?.data?.user;

    const actions: any[] = [];
    if (Array.isArray(userNode?.primaryActions))
      actions.push(...userNode.primaryActions);
    if (Array.isArray(userNode?.secondaryActions))
      actions.push(...userNode.secondaryActions);

    for (const action of actions) {
      const owner = action?.client_handler?.profile_action?.profile_owner;
      if (!owner) continue;
      const name = pickProfileOwnerName(owner);
      const id = typeof owner.id === "string" || typeof owner.id === "number"
        ? String(owner.id)
        : undefined;
      if (name || id) return { id, name };
    }

    // Fallback: shallow scan for any profile_owner object
    const queue: any[] = [root];
    let scanned = 0;
    while (queue.length && scanned < 2000) {
      const node = queue.shift();
      scanned++;
      if (!node || typeof node !== "object") continue;
      if (node.profile_owner && typeof node.profile_owner === "object") {
        const owner = node.profile_owner;
        const name = pickProfileOwnerName(owner);
        const id = typeof owner.id === "string" || typeof owner.id === "number"
          ? String(owner.id)
          : undefined;
        if (name || id) return { id, name };
      }
      for (const value of Object.values(node)) {
        if (value && typeof value === "object") queue.push(value);
      }
    }
  } catch { }

  return null;
}

export function findParentNode(root: any, key: string): any | null {
  if (typeof root !== 'object' || root === null) {
    return null;
  }
  for (let k in root) {
    let child = root[k];
    if (child && typeof child === 'object' && child.hasOwnProperty(key)) {
      return child;
    }
    let found = findParentNode(child, key);
    if (found) return found;
  }
  return null;
}

export function findAllKeyValuePairs(jsonObject: any, key: string): { key: string; value: any }[] {
  let results: { key: string; value: any }[] = [];
  for (const [k, v] of Object.entries(jsonObject)) {
    if (k === key) {
      results.push({ key: k, value: v });
    }
    if (typeof v === "object" && v !== null) {
      results = results.concat(findAllKeyValuePairs(v, key));
    }
  }
  return results;
}

export function isMeaningfulValue(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return false;
}

export function mergeUserInfoFields(base: any, patch: any) {
  const out = { ...(base || {}) };
  if (!patch || typeof patch !== "object") return out;
  for (const [key, val] of Object.entries(patch)) {
    if (!isMeaningfulValue(val)) continue;
    if (Array.isArray(val) && Array.isArray(out[key])) {
      const valIsStrings = val.every((v) => typeof v === "string");
      const outIsStrings = out[key].every((v: any) => typeof v === "string");
      if (valIsStrings && outIsStrings) {
        const merged = [...out[key], ...val].filter(
          (v) => typeof v === "string" && v.trim(),
        );
        const uniq: string[] = [];
        const seen = new Set<string>();
        for (const v of merged) {
          if (seen.has(v)) continue;
          seen.add(v);
          uniq.push(v);
        }
        out[key] = uniq;
        continue;
      }
      out[key] = val;
      continue;
    }
    out[key] = val;
  }
  return out;
}

type VideoGridRenderer = {
  video: {
    permalink_url: string;
    height?: number;
    width?: number;
    playable_duration_in_ms?: number;
    preferred_thumbnail: {
      image: {
        uri: string;
      };
    };
  };
};

type MediaData = {
  id: string;
  video_grid_renderer: VideoGridRenderer;
  viewer_image?: {
    uri: string;
    height?: number;
    width?: number;
  };
  preferred_thumbnail?: {
    image: {
      uri: string;
    };
  };
  height?: number;
  width?: number;
  playable_duration_in_ms?: number;
  permalink_url?: string;
};

type AttachmentData = {
  media: MediaData;
  styles?: {
    attachment: {
      media: MediaData & {
        comet_photo_attachment_resolution_renderer?: {
          uri: string;
          height?: number;
          width?: number;
        };
        photo_image?: {
          uri: string;
          height?: number;
          width?: number;
        };
        image?: {
          uri?: string;
        };
      };
    };
  };
  target?: {
    id?: string;
  };
};

type FBShortsStory = {
  short_form_video_context?: {
    playback_video?: {
      thumbnailImage: { uri: string };
      height?: number;
      width?: number;
      length_in_second: number;
    };
  };
  attachments?: [
    {
      media: {
        thumbnailImage: { uri: string };
        height?: number;
        width?: number;
        length_in_second: number;
      };
    },
  ];
};

type StyleInfo = {
  __typename: string;
  fb_shorts_story?: FBShortsStory;
};

type ReelAttachmentData = {
  styles: {
    attachment: {
      style_infos: StyleInfo[];
    };
  };
};

type ExtractedData = {
  entry_id: string;
  type: string;
  description: string;
  url: string;
  target_id: string;
  target_url: string;
  height: string;
  width: string;
  ratio: string;
  duration: string;
  format: string;
  thumbnails?: string;
};

export function extractDataFromVideoSubAttachment(data: { media: MediaData }): ExtractedData {
  return {
    entry_id: data.media.id,
    type: "video",
    description: "",
    url: data.media.video_grid_renderer.video.permalink_url,
    target_id: "",
    target_url: "",
    height: data.media.video_grid_renderer.video.height?.toString() ?? "",
    width: data.media.video_grid_renderer.video.width?.toString() ?? "",
    ratio: "",
    duration: data.media.video_grid_renderer.video.playable_duration_in_ms?.toString() ?? "",
    format: "",
    thumbnails: data.media.video_grid_renderer.video.preferred_thumbnail.image.uri,
  };
}

export function extractDataFromPhotoSubAttachment(data: { media: MediaData }): ExtractedData {
  return {
    entry_id: "",
    type: "photo",
    description: "",
    url: data.media.viewer_image?.uri ?? "",
    target_id: "",
    target_url: "",
    height: data.media.viewer_image?.height?.toString() ?? "",
    width: data.media.viewer_image?.width?.toString() ?? "",
    ratio: "",
    duration: "",
    format: "",
  };
}

export function extractDataFromVideoAttachment(data: AttachmentData): ExtractedData {
  const media = data.styles?.attachment.media;
  return {
    entry_id: "",
    type: "video_autoplay",
    description: "",
    url: media?.preferred_thumbnail?.image.uri ?? "",
    target_id: "",
    target_url: media?.permalink_url ?? "",
    height: media?.height?.toString() ?? "",
    width: media?.width?.toString() ?? "",
    ratio: "",
    duration: media?.playable_duration_in_ms?.toString() ?? "",
    format: "",
  };
}

export function extractDataFromPhotoAttachment(data: AttachmentData): ExtractedData | undefined {
  const photoObj =
    data?.styles?.attachment?.media
      ?.comet_photo_attachment_resolution_renderer ||
    data?.styles?.attachment?.media?.photo_image;
  if (!photoObj) {
    return undefined;
  }
  return {
    entry_id: "",
    type: "photo",
    description: "",
    url: photoObj.uri,
    target_id: "",
    target_url: "",
    height: photoObj.height?.toString() ?? "",
    width: photoObj.width?.toString() ?? "",
    ratio: "",
    duration: "",
    format: "",
  };
}

export function extractDataFromReelAttachment(data: ReelAttachmentData): ExtractedData | undefined {
  const styleInfo = data.styles.attachment.style_infos.find(
    (e) => e.__typename === "FBShortsShareAttachmentStyleInfo",
  );
  if (!styleInfo) {
    return undefined;
  }
  const rootMedia =
    styleInfo.fb_shorts_story?.short_form_video_context?.playback_video ||
    styleInfo.fb_shorts_story?.attachments?.[0]?.media;
  if (!rootMedia) {
    return undefined;
  }
  return {
    entry_id: "",
    type: "photo",
    description: "",
    url: rootMedia.thumbnailImage.uri,
    target_id: "",
    target_url: "",
    height: rootMedia.height?.toString() ?? "",
    width: rootMedia.width?.toString() ?? "",
    ratio: "",
    duration: (rootMedia.length_in_second * 1000).toString(),
    format: "",
  };
}

export function extractDataFromProfileMediaAttachment(data: AttachmentData): ExtractedData {
  return {
    entry_id: "",
    type: "share",
    description: "",
    url: data.styles?.attachment?.media?.image?.uri ?? "",
    target_id: data.target?.id ?? "",
    target_url: "",
    height: "",
    width: "",
    ratio: "",
    duration: "",
    format: "",
  };
}

export function extractReactionAndCommentCount(data: any) {
  const result = {
    commentCount: null as number | null,
    reactionCount: null as number | null,
    shareCount: null as number | null,
  };
  if (!data) return result;

  const commentsData = findAllKeyValuePairs(data, "comments");
  if (commentsData.length > 0) {
    result.commentCount = commentsData[0].value.total_count ?? null;
  }

  const shareData = findAllKeyValuePairs(data, "share_count");
  if (shareData.length > 0) {
    result.shareCount = shareData[0].value.count ?? null;
  }

  let totalReactions = 0,
    hasReaction = false;
  const topReactionData = data?.top_reactions?.edges;
  if (Array.isArray(topReactionData)) {
    for (const reaction of topReactionData) {
      if (
        reaction?.reaction_count &&
        typeof reaction.reaction_count === "number"
      ) {
        hasReaction = true;
        totalReactions += reaction.reaction_count;
      }
    }
  }
  result.reactionCount = !hasReaction ? null : totalReactions;

  return result;
}

// LOCAL STORAGE UTILS
const MAXIMUM_USERS = 30, MAXIMUM_POSTS = 50;
export const FACEBOOK_POST_INFO_KEY = "facebook_posts_info";
export const FACEBOOK_USER_INFO_KEY = "facebook_user_info";
export function parseFacebookPostInfo(facebookPostsOwnersStr: string = ""): FacebookPostLocalStorageInfo[] {
  if (!facebookPostsOwnersStr) {
    return [];
  }
  return facebookPostsOwnersStr
    .split("::")
    .map((s) => {
      const [postEntryRowkey, postId, ownerId, ownerName, ownerType] = s
        .trim()
        .split("|");
      if (!postEntryRowkey || !postId || !ownerId || !ownerName || !ownerType)
        return null;
      return {
        entry_rowkey: postEntryRowkey,
        post_id: postId,
        owner_id: ownerId,
        owner_name: ownerName,
        owner_type: ownerType,
      } as FacebookPostLocalStorageInfo;
    })
    .filter((item) => item !== null);
}

export async function storeFacebookPostInfo(newGroupPost: FacebookPostData[] = []): Promise<FacebookPostLocalStorageInfo[]> {
  const localStoragePostOwner = await services.storageServices.getStorageByKeys([FACEBOOK_POST_INFO_KEY]);
  const facebookPostsOwnersStr = localStoragePostOwner[FACEBOOK_POST_INFO_KEY] || "";
  const currentGroupPosts = parseFacebookPostInfo(facebookPostsOwnersStr);
  const tmpCurrentGroupPosts = [...currentGroupPosts];

  for (const newPost of newGroupPost) {
    const index = tmpCurrentGroupPosts.findIndex((p) => p.post_id === newPost.post_id);
    if (index !== -1) continue; // Already have this post info -> pass

    if (tmpCurrentGroupPosts.length >= MAXIMUM_POSTS) {
      tmpCurrentGroupPosts.shift();
    }
    const newSavingPosts: FacebookPostLocalStorageInfo = {
      entry_rowkey: newPost.entry_rowkey,
      post_id: newPost.post_id.split("_")[1],
      owner_id: newPost.owner_id,
      owner_name: newPost.owner_name,
      owner_type: newPost.owner_type,
    };
    tmpCurrentGroupPosts.push(newSavingPosts);
  }

  const updatingPostsString = tmpCurrentGroupPosts
    .map((p) => `${p.entry_rowkey}|${p.post_id}|${p.owner_id}|${p.owner_name}|${p.owner_type}`).join("::");
  services.storageServices.setStorageCached({ [FACEBOOK_POST_INFO_KEY]: updatingPostsString });

  return tmpCurrentGroupPosts;
}

function md5HexFromUtf8(input: string): string {
  const encoded = new TextEncoder().encode(input);
  const buffer = encoded.buffer.slice(
    encoded.byteOffset,
    encoded.byteOffset + encoded.byteLength
  );
  return SparkMD5.ArrayBuffer.hash(buffer);
}

function md5PrefixDigits(value: string, digits: number): string {
  const md5HexString = md5HexFromUtf8(value);
  return BigInt("0x" + md5HexString)
    .toString()
    .slice(0, digits);
}

export function generatePostKey(
  timestamp: number,
  uniqueString: string
): string | null {
  if (uniqueString === "") return null;

  // Match Python logic exactly:
  // 1) timestamp > 1772038800000 -> (optionally split on '_') + MD5 -> int -> first 27 digits
  if (timestamp > 1772038800000) {
    const normalizedUniqueString = uniqueString.includes("_")
      ? uniqueString.split("_").slice(-1)[0]
      : uniqueString;
    return md5PrefixDigits(normalizedUniqueString, 27);
  }

  // 2) 0 <= timestamp <= 9999999999999 -> reversed timestamp + MD5 -> int -> first 14 digits
  if (timestamp >= 0 && timestamp <= 9999999999999) {
    const reversedSecondTimestamp = 9999999999999 - timestamp;
    return reversedSecondTimestamp.toString() + md5PrefixDigits(uniqueString, 14);
  }

  return null;
}

export function generateCommentKey(
  timestamp: number,
  uniqueString: string
): string | null {
  return generatePostKey(timestamp, uniqueString);
}

export function generateReactionKey(uniqueString: string): string | null {
  if (!uniqueString) return null;

  const hash = SparkMD5.hash(uniqueString);
  const reactionRowKey = BigInt('0x' + hash);
  return reactionRowKey.toString();
}

export type FbFormattedText = {
  text: string;
  delight_ranges?: any[];
  image_ranges?: any[];
  inline_style_ranges?: any[];
  aggregated_ranges?: any[];
  ranges?: any[];
  color_ranges?: any[];
};

function normalizeFormattedText(input: any): FbFormattedText | null {
  if (typeof input === "string") {
    return { text: input };
  }
  if (!input || typeof input !== "object") return null;

  const textValue =
    typeof input.text === "string"
      ? input.text
      : typeof input?.text?.text === "string"
        ? input.text.text
        : null;
  if (!textValue) return null;

  const src = typeof input.text === "object" ? input.text : input;
  const pick = (key: keyof FbFormattedText) =>
    Array.isArray((src as any)[key]) ? (src as any)[key] : undefined;

  return {
    text: textValue,
    delight_ranges: pick("delight_ranges"),
    image_ranges: pick("image_ranges"),
    inline_style_ranges: pick("inline_style_ranges"),
    aggregated_ranges: pick("aggregated_ranges"),
    ranges: pick("ranges"),
    color_ranges: pick("color_ranges"),
  };
}

function hasFormatting(rich: FbFormattedText): boolean {
  return (
    (Array.isArray(rich.delight_ranges) && rich.delight_ranges.length > 0) ||
    (Array.isArray(rich.image_ranges) && rich.image_ranges.length > 0) ||
    (Array.isArray(rich.inline_style_ranges) &&
      rich.inline_style_ranges.length > 0) ||
    (Array.isArray(rich.aggregated_ranges) &&
      rich.aggregated_ranges.length > 0) ||
    (Array.isArray(rich.ranges) && rich.ranges.length > 0) ||
    (Array.isArray(rich.color_ranges) && rich.color_ranges.length > 0)
  );
}

function pushFormattedText(
  input: any,
  lines: string[],
  rich: FbFormattedText[],
) {
  const normalized = normalizeFormattedText(input);
  if (!normalized) return;
  const text = normalized.text.trim();
  if (!text) return;
  lines.push(text);
  rich.push({ ...normalized, text });
}

function dedupeRichText(richLines: FbFormattedText[]): FbFormattedText[] {
  const map = new Map<string, FbFormattedText>();
  const order: string[] = [];
  for (const entry of richLines) {
    const text = entry.text.trim();
    if (!text) continue;
    const normalized = { ...entry, text };
    const existing = map.get(text);
    if (!existing) {
      map.set(text, normalized);
      order.push(text);
      continue;
    }
    if (hasFormatting(normalized) && !hasFormatting(existing)) {
      map.set(text, normalized);
    }
  }
  return order.map((t) => map.get(t)!).filter(Boolean);
}

function isLikelyDescriptionLabel(label: any): boolean {
  if (typeof label !== "string") return false;
  const t = label.toLowerCase().trim();
  if (!t) return false;
  if (
    t.includes("bio") ||
    t.includes("intro") ||
    t.includes("about") ||
    t.includes("description") ||
    t.includes("details") ||
    t.includes("gioi thieu") ||
    t.includes("giới thiệu") ||
    t.includes("mo ta") ||
    t.includes("mô tả")
  ) {
    return true;
  }
  return false;
}

function isLikelyDescriptionText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const lower = t.toLowerCase();

  if (
    lower.includes("http://") ||
    lower.includes("https://") ||
    lower.includes("facebook.com/") ||
    lower.includes("l.facebook.com/") ||
    lower.includes("mibextid=")
  ) {
    return false;
  }

  if (
    lower.includes("followers") ||
    lower.includes("following") ||
    lower.includes("người theo dõi") ||
    lower.includes("dang theo doi") ||
    lower.includes("đang theo dõi")
  ) {
    return false;
  }

  if (
    lower.includes("·") &&
    (lower.includes("trang") ||
      lower.includes("page") ||
      lower.includes("creator") ||
      lower.includes("người sáng tạo") ||
      lower.includes("nguoi sang tao"))
  ) {
    return false;
  }

  const hasLineBreak = t.includes("\n");
  const hasEmail = t.includes("@");
  const hasBooking = /(booking|contact|liên hệ|lien he)/i.test(t);
  const digits = t.replace(/\D/g, "");
  const hasPhone = digits.length >= 8;

  return hasLineBreak || hasEmail || hasBooking || hasPhone;
}
