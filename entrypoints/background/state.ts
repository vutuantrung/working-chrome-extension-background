import {
  FacebookDataType,
  FacebookGroupJoinedData,
  FacebookUserProfileData,
  TiktokDataType,
  XDataType,
  ThreadsDataType,
  YoutubeDataType,
} from "@/entrypoints/background/utils/parsers/types";
import { __debouncers } from "@/entrypoints/background/utils/tools";

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
