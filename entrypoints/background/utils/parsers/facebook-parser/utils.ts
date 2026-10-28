
// FACEBOOK PARSING UTILS
// ===============================================
import SparkMD5 from "spark-md5";
import * as services from "../../../services";
import { FacebookCollectionListKind, FacebookPostData, FacebookPostLocalStorageInfo, ResolvedCollectionPage } from "../types";
import { findAllKeyValuePairs } from "../commons";


/// UTILS
function parsePayloadRoot(payload: unknown): any | null {
  let root: any = payload;
  if (typeof root === "string") {
    const trimmed = root.trim();
    if (!trimmed) return null;
    try {
      root = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (!root || typeof root !== "object" || Array.isArray(root)) return null;
  return root;
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

export function isMeaningfulValue(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return false;
}

export function decodeUnicodeEscapes(value: string): string {
  if (typeof value !== "string" || !value) return "";
  if (!/\\u[0-9a-fA-F]{4}/.test(value)) return value;
  try {
    return JSON.parse(`"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
  } catch {
    return value.replace(/\\u([0-9a-fA-F]{4})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
  }
}

export function readTrimmedId(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function readTrimmedString(v: any): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
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

/// PLATFORM TOOLS
export function deriveArticleId(postId: string): string {
  if (typeof postId !== "string" || !postId) return "";
  const lastUnderscore = postId.lastIndexOf("_");
  return lastUnderscore >= 0 ? postId.slice(lastUnderscore + 1) : "";
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

type FacebookVideoGridRenderer = {
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

type FacebookMediaData = {
  id: string;
  video_grid_renderer: FacebookVideoGridRenderer;
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

type FacebookAttachmentData = {
  media: FacebookMediaData;
  styles?: {
    attachment: {
      media: FacebookMediaData & {
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

type FacebookShortsStory = {
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

type FacebookStyleInfo = {
  __typename: string;
  fb_shorts_story?: FacebookShortsStory;
};

type FacebookReelAttachmentData = {
  styles: {
    attachment: {
      style_infos: FacebookStyleInfo[];
    };
  };
};

type FacebookExtractedData = {
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

export function extractDataFromVideoSubAttachment(data: { media: FacebookMediaData }): FacebookExtractedData {
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

export function extractDataFromPhotoSubAttachment(data: { media: FacebookMediaData }): FacebookExtractedData {
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

export function extractDataFromVideoAttachment(data: FacebookAttachmentData): FacebookExtractedData {
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

export function extractDataFromPhotoAttachment(data: FacebookAttachmentData): FacebookExtractedData | undefined {
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

export function extractDataFromReelAttachment(data: FacebookReelAttachmentData): FacebookExtractedData | undefined {
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

export function extractDataFromProfileMediaAttachment(data: FacebookAttachmentData): FacebookExtractedData {
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
    .map((str) => {
      const [postEntryRowkey, postId, ownerId, ownerName, ownerType] = str
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

export function generatePostKey(timestamp: number, uniqueString: string): string | null {
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

export function generateCommentKey(timestamp: number, uniqueString: string): string | null {
  return generatePostKey(timestamp, uniqueString);
}

export function generateReactionKey(uniqueString: string): string | null {
  if (!uniqueString) return null;

  const hash = SparkMD5.hash(uniqueString);
  const reactionRowKey = BigInt('0x' + hash);
  return reactionRowKey.toString();
}

export type FacebookFormattedText = {
  text: string;
  delight_ranges?: any[];
  image_ranges?: any[];
  inline_style_ranges?: any[];
  aggregated_ranges?: any[];
  ranges?: any[];
  color_ranges?: any[];
};

function normalizeFormattedText(input: any): FacebookFormattedText | null {
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
  const pick = (key: keyof FacebookFormattedText) =>
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

function hasFormatting(rich: FacebookFormattedText): boolean {
  return (
    (Array.isArray(rich.delight_ranges) && rich.delight_ranges.length > 0) ||
    (Array.isArray(rich.image_ranges) && rich.image_ranges.length > 0) ||
    (Array.isArray(rich.inline_style_ranges) && rich.inline_style_ranges.length > 0) ||
    (Array.isArray(rich.aggregated_ranges) && rich.aggregated_ranges.length > 0) ||
    (Array.isArray(rich.ranges) && rich.ranges.length > 0) ||
    (Array.isArray(rich.color_ranges) && rich.color_ranges.length > 0)
  );
}

function pushFormattedText(
  input: any,
  lines: string[],
  rich: FacebookFormattedText[],
) {
  const normalized = normalizeFormattedText(input);
  if (!normalized) return;
  const text = normalized.text.trim();
  if (!text) return;
  lines.push(text);
  rich.push({ ...normalized, text });
}

function dedupeRichText(richLines: FacebookFormattedText[]): FacebookFormattedText[] {
  const map = new Map<string, FacebookFormattedText>();
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

function detectCollectionListKind(meta: {
  name?: string;
  url?: string;
  tabKey?: string;
  edges?: unknown[];
}): FacebookCollectionListKind | null {
  const tabKey = readTrimmedString(meta.tabKey).toLowerCase();
  if (tabKey === "friends_all") return "friends";
  if (tabKey === "followers") return "followers";
  if (tabKey === "following") return "following";

  const name = readTrimmedString(meta.name).toLowerCase();
  const url = readTrimmedString(meta.url).toLowerCase();

  if (
    name.includes("đang theo dõi") ||
    name.includes("dang theo doi") ||
    url.includes("/following")
  ) {
    return "following";
  }
  if (
    name.includes("người theo dõi") ||
    name.includes("nguoi theo doi") ||
    url.includes("/followers")
  ) {
    return "followers";
  }
  if (
    name.includes("bạn bè") ||
    name.includes("ban be") ||
    url.includes("/friends")
  ) {
    return "friends";
  }

  if (Array.isArray(meta.edges) && meta.edges.length > 0) {
    for (const edge of meta.edges) {
      const node = (edge as any)?.node;
      if (!node) continue;

      const actionsRendererType = readTrimmedString(node.actions_renderer?.__typename);

      if (actionsRendererType.includes("FriendsList")) {
        return "friends";
      }
    }
  }

  return null;
}

export function resolveCollectionPageFromPayload(payload: {
  data?: {
    node?: Record<string, unknown>;
    user?: { id?: string }
  };
}): ResolvedCollectionPage | null {
  const node = payload?.data?.node;
  if (!node || typeof node !== "object") return null;

  if (node.__typename === "TimelineAppCollection") {
    const collectionId = readTrimmedString(node.id);
    const edges = Array.isArray((node.pageItems as { edges?: unknown[] } | undefined)?.edges)
      ? (node.pageItems as { edges: unknown[] }).edges
      : [];
    if (!collectionId || !edges.length) return null;

    const name = readTrimmedString(node.name);
    const url = readTrimmedString(node.url);
    const kind = detectCollectionListKind({ name, url, edges }) || ("following" as FacebookCollectionListKind);

    return { collectionId, edges, kind };
  }

  if (node.__typename !== "TimelineAppSection") return null;

  const navNodes = Array.isArray((node.nav_collections as { nodes?: unknown[] } | undefined)?.nodes)
    ? (node.nav_collections as { nodes: unknown[] }).nodes
    : [];

  const navKindById = new Map<string, FacebookCollectionListKind>();
  for (const nav of navNodes) {
    const n = nav as { id?: string; name?: string; url?: string };
    const id = readTrimmedString(n?.id);
    const kind = detectCollectionListKind({
      name: readTrimmedString(n?.name),
      url: readTrimmedString(n?.url),
    });
    if (id && kind) navKindById.set(id, kind);
  }

  const collections = Array.isArray((node.all_collections as { nodes?: unknown[] } | undefined)?.nodes)
    ? (node.all_collections as { nodes: unknown[] }).nodes
    : [];

  for (const c of collections) {
    const wrapper = c as {
      id?: string;
      tab_key?: string;
      style_renderer?: {
        collection?: {
          id?: string;
          name?: string;
          url?: string;
          pageItems?: { edges?: unknown[] };
        };
      };
    };
    const inner = wrapper?.style_renderer?.collection;
    const edges = Array.isArray(inner?.pageItems?.edges)
      ? inner.pageItems.edges
      : [];
    if (!edges.length) continue;

    const collectionId = readTrimmedString(inner?.id) || readTrimmedString(wrapper?.id);
    if (!collectionId) continue;

    const kind =
      navKindById.get(collectionId) ||
      navKindById.get(readTrimmedString(wrapper?.id)) ||
      detectCollectionListKind({
        tabKey: readTrimmedString(wrapper?.tab_key),
        name: readTrimmedString(inner?.name),
        url: readTrimmedString(inner?.url),
        edges,
      });

    if (!kind) continue;

    return { collectionId, edges, kind };
  }

  return null;
}

export function extractListPersonFromEdge(edge: unknown): {
  id: string;
  name: string;
  url: string;
  avatar: string;
} | null {
  const node = (edge as { node?: Record<string, unknown> })?.node;
  if (!node) return null;

  const id =
    readTrimmedString((node.node as { id?: string } | undefined)?.id) ||
    readTrimmedString((node.actions_renderer as { profile_actions?: { profile_owner?: { id?: string } }[]; })?.profile_actions?.[0]?.profile_owner?.id);
  if (!id) return null;

  const name =
    readTrimmedString((node.title as { text?: string } | undefined)?.text) ||
    readTrimmedString((node.actions_renderer as { profile_actions?: { profile_owner?: { name?: string } }[]; })?.profile_actions?.[0]?.profile_owner?.name);

  const url =
    readTrimmedString(node.url) ||
    readTrimmedString((node.node as { url?: string })?.url);

  const avatar = readTrimmedString((node.image_v2 as { uri?: string } | undefined)?.uri);

  return { id, name, url, avatar };
}

/**
 * ProfileCometHeader only: data.user.profile_header_renderer.user (id + name).
 */
export function extractFacebookUserIdAndName(payload: unknown): { id: string; name: string } | null {
  const root = parsePayloadRoot(payload);
  if (!root) return null;

  const header = root.data?.user?.profile_header_renderer;
  if (!header || typeof header !== "object") return null;

  const headerUser = header.user;
  const profileUser = headerUser?.header_top_row?.profile_user;

  const id =
    readTrimmedId(headerUser?.id) ||
    readTrimmedId(profileUser?.id) ||
    readTrimmedId(root.data?.user?.id);

  const rawName =
    (typeof headerUser?.name === "string" && headerUser.name) ||
    (typeof profileUser?.name === "string" && profileUser.name) ||
    "";

  const name = decodeUnicodeEscapes(rawName.trim());
  if (!id || !name) return null;
  return { id, name };
}

/** Map value: decoded display name (legacy JSON blobs still supported). */
function resolveFacebookUserNameFromMapValue(value: string): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("{")) {
    const extracted = extractFacebookUserIdAndName(trimmed);
    if (extracted?.name) return extracted.name;
  }

  return decodeUnicodeEscapes(trimmed);
}

export function normalizeFacebookUserInfoMap(map: Record<string, string> | null | undefined): Record<string, string> {
  if (!map || typeof map !== "object") return {};
  const out: Record<string, string> = {};
  for (const [id, raw] of Object.entries(map)) {
    const key = readTrimmedId(id);
    if (!key) continue;
    const name = resolveFacebookUserNameFromMapValue(String(raw ?? ""));
    if (name) out[key] = name;
  }
  return out;
}
