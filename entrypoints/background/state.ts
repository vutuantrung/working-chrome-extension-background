import {
  FacebookDataType,
  FacebookGroupJoinedData,
  FacebookUserProfileData,
  TiktokDataType,
  XDataType,
  ThreadsDataType,
  YoutubeDataType,
} from "@/utils/parsers/types";

// ========================================
// DEBOUNCE UTILITY
// ========================================
interface DebouncerObj {
  t: ReturnType<typeof setTimeout>;
}
const __debouncers: Map<any, DebouncerObj> = new Map();
export function debounce(fn: Function, delay: any, key: any = fn): void {
  let o: DebouncerObj | undefined | any = __debouncers.get(key);
  if (o) clearTimeout(o.t);
  o = { t: setTimeout(fn, delay) };
  __debouncers.set(key, o);
}

// ========================================
// CONSTANTS
// ========================================
export const MAXIMUM_TIME_WAIT_SECOND = 10;
export const MAXIMUM_RECORD_ARCHIVED = 50;
export const MAX_TASK_LIST_LENGTH = 10;
export const MAX_PENDING_USERINFO = 3;
export const USERINFO_DESCRIPTION_WAIT_MS = 12000;
export const USERINFO_DESCRIPTION_POLL_MS = 400;
export const USERINFO_COLLECT_POLL_MS = 300;
export const USERINFO_COLLECT_WAIT_MS = 5000;
export const USERINFO_PUBLISH_DEBOUNCE_MS = 3500;
export const EXTENSION_UPDATE_CHECK_URL = `${import.meta.env.VITE_AXIOS_BASE_URL}/extension-versions`;
export const EXTENSION_UPDATE_COOKIE_NAME = "sticky-session-cookie";

// ALARM NAMES
export const SETTINGS_SYNC_ALARM = "settings_sync_3m";
export const SEND_FACEBOOK_DATA_ALARM = "send_fbp_data";
export const SEND_TIKTOK_DATA_ALARM = "send_ttp_data";
export const SEND_X_DATA_ALARM = "send_x_data";
export const SEND_THREADS_DATA_ALARM = "send_threads_data";
export const SEND_YOUTUBE_DATA_ALARM = "send_youtube_data";
export const PROXY_HEALTH_CHECK_ALARM = "proxyHealthCheck";
export const SYNC_FB_JOINED_GROUPS_ALARM = "sync_fb_joined_groups";
export const SEND_FB_JOINED_GROUPS_ALARM = "send_fb_joined_groups";
export const SYNC_FB_PENDING_GROUPS_ALARM = "sync_fb_pending_groups";
export const SEND_FB_PENDING_GROUPS_ALARM = "send_fb_pending_groups";

// ========================================
// MUTABLE GLOBAL STATE
// ========================================
// Wrapped in an object so any module can both read and reassign properties.
// ES module `export let` bindings are read-only to importers, hence the object.
export const bgState = {
  manifests: null as any,
  __periodicServerCheckCount: 0,
  __sendDataKafkaInflight: null as Promise<void> | null,
  __sendDataKafkaRunId: 0,
  __extensionUpdateInflight: null as Promise<void> | null,
  __scheduleTaskLock: Promise.resolve() as Promise<void>,
  injectedTabs: new Map<number, string>(),
  firstFacebookTabId: null as number | null,
  manualBoundTabId: null as number | null,
  // Facebook data interception state
  cachedFacebookData: [] as FacebookDataType[],
  cachedFacebookJoinedGroupsData: [] as FacebookGroupJoinedData[],
  cachedFacebookSyncGroupsData: [] as FacebookGroupJoinedData[],
  cachedFacebookSyncPendingGroupsData: [] as FacebookGroupJoinedData[],
  cachedFacebookUserInfo: null as FacebookUserProfileData | null,
  cachedFacebookUserInfoToPublish: null as string | null,
  // TikTok data interception state
  cachedTiktokData: [] as TiktokDataType[],
  // X data interception state
  cachedXData: [] as XDataType[],
  // Threads data interception state
  cachedThreadsData: [] as ThreadsDataType[],
  // Threads data interception state
  cachedYoutubeData: [] as YoutubeDataType[],
  // Debouncers map reference (for clearing on logout)
  __debouncers,
};
