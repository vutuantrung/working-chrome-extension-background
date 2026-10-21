import { PendingUserInfo } from "../../types/types";
import { delayMs } from "../tools";
import { Constants } from "../constants";
import * as services from "../../services";

export type UserProfileMainFieldKey = (typeof Constants.USER_PROFILE_MAIN_FIELD_KEYS)[number];

export function filterUserProfilePayload(value: any): Record<string, any> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const out: Record<string, any> = {};
  for (const key of Constants.USER_PROFILE_MAIN_FIELD_KEYS) {
    const val = (value as any)[key];
    if (!isMeaningfulValue(val)) continue;
    out[key] = val;
  }

  const id = normalizeUserInfoId(out);
  const name = typeof out.name === "string" ? out.name.trim() : "";
  if (!id || !name) return null;

  out.id = id;
  out.name = name;
  if (!isMeaningfulValue(out.docType)) {
    out.docType = "Profile";
  }

  return out;
}

export function isPublishableUserProfile(value: any): boolean {
  return filterUserProfilePayload(value) !== null;
}

function isPublishFieldPresent(payload: any, key: string): boolean {
  if (!payload || typeof payload !== "object") return false;
  const val = (payload as any)[key];

  if (key === "tenant_ids") {
    return (
      Array.isArray(val) &&
      val.length > 0 &&
      val.every((id) => typeof id === "string" && id.trim().length > 0)
    );
  }

  if (key === "_tenants") {
    return (
      Array.isArray(val) &&
      val.length > 0 &&
      val.every(
        (t) =>
          t &&
          typeof t === "object" &&
          typeof (t as any).id === "string" &&
          (t as any).id.trim().length > 0,
      )
    );
  }

  if (key === "entry_rowkey") {
    const id = normalizeUserInfoId(payload);
    return isMeaningfulValue(val) && (!id || String(val).trim() === id);
  }

  return isMeaningfulValue(val);
}

export function getMissingUserProfilePublishFields(payload: any): string[] {
  return Constants.USER_PROFILE_PUBLISH_REQUIRED_FIELDS.filter(
    (key) => !isPublishFieldPresent(payload, key),
  );
}

export function isUserProfilePublishReady(payload: any): boolean {
  return getMissingUserProfilePublishFields(payload).length === 0;
}

export function getMissingUserProfileCollectFields(payload: any): string[] {
  return Constants.USER_PROFILE_COLLECT_REQUIRED_FIELDS.filter(
    (key) => !isPublishFieldPresent(payload, key),
  );
}

export function isUserProfileCollectReady(payload: any): boolean {
  return getMissingUserProfileCollectFields(payload).length === 0;
}

export function applyFacebookUserProfilePublishMeta(
  profile: Record<string, any>,
  tenantObjs: Array<{ id: string; name?: string; project?: string }>,
): Record<string, any> {
  const out = { ...profile };
  out._tenants = tenantObjs;
  out.tenant_ids = tenantObjs.map((t) => t.id);
  out.entry_rowkey = out.id;
  out.platform = "facebook";
  out.crawler_system = "extension";
  if (!isMeaningfulValue(out.docType)) {
    out.docType = "Profile";
  }
  return out;
}

export function stripNonUserProfileFields(value: any): any {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;

  const out: Record<string, any> = {};
  const USER_PROFILE_MAIN_FIELD_SET = new Set<string>(Constants.USER_PROFILE_MAIN_FIELD_KEYS);
  for (const [key, val] of Object.entries(value)) {
    if (USER_PROFILE_MAIN_FIELD_SET.has(key)) {
      out[key] = val;
    }
  }
  return out;
}

export async function waitForUserInfoDescription(maxWaitMs: number): Promise<{ found: boolean; info?: any } | null> {
  const startedAt = Date.now();
  let lastParsed: any = undefined;

  while (Date.now() - startedAt < maxWaitMs) {
    const { pendingUserInfo } = (await services.storageServices.getStorageCachedByKeys(["pendingUserInfo"])) || {};
    const parsed = pendingUserInfo?.parsed;
    if (parsed) lastParsed = parsed;
    if (hasUserDescription(parsed)) return { found: true, info: parsed };
    await delayMs(Constants.USERINFO_DESCRIPTION_POLL_MS);
  }

  return { found: false, info: lastParsed };
}

export async function waitForUserInfoCollectReady(maxWaitMs: number): Promise<Record<string, any> | null> {
  const startedAt = Date.now();
  let lastFiltered: Record<string, any> | null = null;

  while (Date.now() - startedAt < maxWaitMs) {
    const { pendingUserInfo } = (await services.storageServices.getStorageCachedByKeys(["pendingUserInfo"])) || {};
    let parsed = pendingUserInfo?.parsed;
    if (!parsed && pendingUserInfo?.raw) {
      try {
        parsed = JSON.parse(pendingUserInfo.raw);
      } catch {
        parsed = undefined;
      }
    }
    const filtered = filterUserProfilePayload(parsed);
    if (filtered) lastFiltered = filtered;
    if (filtered && isUserProfileCollectReady(filtered)) return filtered;
    await delayMs(Constants.USERINFO_COLLECT_POLL_MS);
  }

  return lastFiltered;
}

function isMeaningfulValue(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return false;
}

function mergeUserInfo(base: any, patch: any): any {
  const out = { ...(base || {}) };
  if (!patch || typeof patch !== "object") return out;
  for (const [key, val] of Object.entries(patch)) {
    if (isMeaningfulValue(val)) {
      (out as any)[key] = val;
    }
  }
  return out;
}

function normalizeUserInfoId(info: any): string {
  const id = info?.id;
  if (typeof id === "string" && id.trim()) return id.trim();
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  return "";
}

export function mergeUserInfoForProfile(existing: any, incoming: any): any {
  if (!incoming || typeof incoming !== "object") return existing || {};
  const incomingId = normalizeUserInfoId(incoming);
  const existingId = normalizeUserInfoId(existing);
  if (incomingId && existingId && incomingId !== existingId) {
    // Profile changed: drop stale fields from the previous profile.
    return { ...(incoming || {}) };
  }
  return mergeUserInfo(existing, incoming);
}

export function hasUserDescription(info: any): boolean {
  if (!info || typeof info !== "object") return false;
  const desc = info.description;
  if (typeof desc === "string" && desc.trim()) return true;
  const list = info.description_list;
  if (
    Array.isArray(list) &&
    list.some((t) => typeof t === "string" && t.trim())
  )
    return true;
  return false;
}

export function isLikelyProfilePageUrl(
  url: string | undefined | null,
): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (!/facebook\.com$/i.test(parsed.hostname)) return false;

    const rawPath = parsed.pathname.replace(/^\/+|\/+$/g, "");
    if (!rawPath) return false;

    const segments = rawPath.split("/").filter(Boolean);
    if (!segments.length) return false;

    const first = segments[0].toLowerCase();
    if (first === "profile.php") return true;
    if (first === "people" || first === "pages") return true;

    const blockedRoots = new Set([
      "groups",
      "watch",
      "marketplace",
      "messages",
      "notifications",
      "friends",
      "events",
      "gaming",
      "bookmarks",
      "saved",
      "memories",
      "help",
      "settings",
      "ads",
      "business",
      "login",
      "recover",
    ]);
    if (blockedRoots.has(first)) return false;

    if (segments.length === 1) return true;

    const profileSubpages = new Set([
      "about",
      "posts",
      "photos",
      "videos",
      "friends",
      "followers",
      "following",
      "reels",
      "live",
      "reviews",
      "likes",
      "mentions",
      "tagged",
      "timeline",
      "events",
    ]);
    return profileSubpages.has(segments[1].toLowerCase());
  } catch {
    return false;
  }
}

function stableStringify(value: any): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  const entries = keys.map((k) => `${k}:${stableStringify(value[k])}`);
  return `{${entries.join(",")}}`;
}

function normalizeComparableValue(value: any): string {
  if (!isMeaningfulValue(value)) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return stableStringify(value);
}

export function hasMeaningfulUserInfoChange(
  existing: any,
  incoming: any,
): boolean {
  if (!incoming || typeof incoming !== "object") return false;
  if (!existing || typeof existing !== "object") return true;

  const existingId = normalizeUserInfoId(existing);
  const incomingId = normalizeUserInfoId(incoming);
  if (incomingId && existingId && incomingId !== existingId) return true;

  for (const [key, val] of Object.entries(incoming)) {
    if (!isMeaningfulValue(val)) continue;
    const prev = (existing as any)[key];
    if (!isMeaningfulValue(prev)) return true;
    if (normalizeComparableValue(prev) !== normalizeComparableValue(val)) {
      return true;
    }
  }

  return false;
}

export function buildPendingUserInfoItem(
  raw: string,
  parsed?: any,
): PendingUserInfo {
  const parsedObj = parsed && typeof parsed === "object" ? parsed : undefined;
  const id = normalizeUserInfoId(parsedObj);
  const name = typeof parsedObj?.name === "string" ? parsedObj.name.trim() : "";
  return {
    raw,
    parsed: parsedObj,
    ts: Date.now(),
    id: id || undefined,
    name: name || undefined,
  };
}

export function upsertPendingUserInfo(
  list: PendingUserInfo[],
  nextItem: PendingUserInfo,
  maxItems: number,
): PendingUserInfo[] {
  const next = Array.isArray(list) ? [...list] : [];
  if (nextItem.id) {
    const idx = next.findIndex((item) => item?.id === nextItem.id);
    if (idx >= 0) {
      next[idx] = nextItem;
      return next;
    }
  }
  next.push(nextItem);
  if (next.length > maxItems) {
    next.splice(0, next.length - maxItems);
  }
  return next;
}

export function removePendingUserInfo(
  list: PendingUserInfo[],
  criteria: { id?: string; ts?: number; index?: number },
): PendingUserInfo[] {
  const next = Array.isArray(list) ? [...list] : [];
  if (typeof criteria.index === "number") {
    if (criteria.index >= 0 && criteria.index < next.length) {
      next.splice(criteria.index, 1);
    }
    return next;
  }

  if (criteria.id) {
    const idx = next.findIndex((item) => item?.id === criteria.id);
    if (idx >= 0) next.splice(idx, 1);
    return next;
  }

  if (typeof criteria.ts === "number") {
    const idx = next.findIndex((item) => item?.ts === criteria.ts);
    if (idx >= 0) next.splice(idx, 1);
  }

  return next;
}
