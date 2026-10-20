import { FacebookUserFollowData, FacebookUserFriendData } from "@/utils/parsers/types";
import { PendingUserInfo } from "../helpers/user-info";
import { User } from "@/entrypoints/sidepanel/types/types";

export type Platform = "facebook" | "tiktok" | "x" | "threads" | "youtube";

export type ProxyAuthCredentials = { username: string; password: string };
export type ProxyHealthState = "ok" | "error";
export type ProxyHealth = {
  state: ProxyHealthState;
  updatedAt: number;
  lastErrorAt?: number;
  lastOkAt?: number;
  consecutiveFailures?: number;
  error?: any;
  details?: any;
  reason?: string;
};

export interface Settings {
  collaboratorId: string;
  collaboratorTopic: string;
  openingDevtoolsTabId: number;
  activatingDevtools: boolean;
  activatingAutomation: boolean;
  domain: string;
  apikey: string;
  // topics
  facebookTopics?: string;
  tiktokTopics?: string;
  facebookTopic?: string;
  threadsTopic?: string;
  tiktokTopic?: string;
  xTopic?: string;
  youtubeTopic?: string;
  tenants: any;
  focus: string;
  proxy: string | ProxyData;
  proxyOption?: string;
  scheduleStartTime: string;
  scheduleEndTime: string;
  archive: Archive;
  n_c: number;
  autoReport: boolean;
  permissions?: string[];
  isTabSpecific?: boolean;
  firstFacebookTabId?: number;
  openAiSettings?: OpenAISettings;
}

export interface OpenAISettings {
  apiKey: string;
  model: string;
  temperature: number;
  apiUrl: string;
}

export interface KafkaTopicTypes {
  topicPost?: string;
  topicImg?: string;
  topicUser?: string;
  topicGroup?: string;
  topicComment?: string;
}

export interface KafkaPlatformTopic {
  x?: string;
  youtube?: string;
  facebook?: string;
  tiktok?: string;
  threads?: string;
}

export interface KafkaPublishConfig {
  platform: Platform;
  retryAlarm: string;
  logTag: string;
  resolveTopics: (settings: Settings) => KafkaTopicTypes | any | null;
  publishPayloads: (ctx: KafkaPublishContext) => Promise<void>;
}

export interface KafkaPublishContext {
  runtimeReq: any;
  settings: Settings;
  url: string;
  tenantObjs: any[];
  extensionUserId: string;
  extensionUserName: string;
  topics: any;
  publish: (
    topic: string,
    payload: any,
    hasExtensionInfo: boolean,
  ) => Promise<void>;
  incrementBadge: (delta: number) => Promise<void>;
}

export interface Archive {
  fbGUrl?: string;
  profileId?: string;
  fbJoinedGroups?: string;
  [key: string]: any;
}

export interface ProxyData {
  http?: { host: string; port: string };
  https?: { host: string; port: string };
}

export interface Activity {
  id: string;
  name: string;
  type: string;
  inputs: Record<string, any>;
  priority?: number;
  platform: string;
  scheduleTime: string;
  scheduleType: string;
  schedule_time?: string;
  schedule_type?: string;
}

export interface Task {
  taskId: string;
  activityId: string;
  activityName: string;
  platform: string;
  priority: number;
  tabId: number;
  inputs: Record<string, any>;
  nextTask: string;
  state: string;
  result?: string;
  createdTime: number;
  startTime?: number;
  endTime?: number;
  wsReporter?: WebSocket | null;
  profileId?: string;
}

export interface StorageData {
  settings?: Settings;
  taskList?: Task[];
  activities?: Activity[];
  user?: User;
  facebookAccounts?: any;
  activeProxy?: any;
  extensionProxy?: any;
  personaProxy?: any;
  personaFacebookAccounts?: any[];
  personaSocialAccounts?: any[];
  automationByUser?: boolean;
  pendingUserInfo?: PendingUserInfo | null;
  pendingUserInfoList?: PendingUserInfo[];
  userInfoPublishStatus?: UserInfoPublishStatus | null;
  extensionUpdateNotice?: {
    version: string;
    lastNotifiedAt: number;
    downloadUrl?: string;
  };
  lastActiveFacebookTab?: any;
  profileId?: string;
  profile?: any;
  allSocialAccounts?: any[];
  selectedPersonaId?: string;
  fbLoginMode?: { mode: string; account_id: string };
  fbAccountCache?: { userId?: string; name?: string; ts: number };
  lastUnsavedProfileCase?: { id: string; timestamp: number };
  newProfileCaseCache?: { name: string; profile_url: string; origin_url: string; description: string };
  facebook_user_info_map?: Record<string, string>;
  facebook_follow_collection_owner_map?: Record<
    string,
    { id: string; name?: string; rows?: FacebookUserFollowData[] }
  >;
  facebook_pending_follow_data?: FacebookUserFollowData[];
  facebook_friend_collection_owner_map?: Record<
    string,
    { id: string; name?: string; list_kind?: string; rows?: FacebookUserFriendData[] }
  >;
  facebook_pending_friend_data?: FacebookUserFriendData[];
  /** Dynamic schedule interval (in minutes) for SYNC_FB_JOINED_GROUPS_ALARM, sourced from API joinedGroupScheduleTime. */
  joinedGroupScheduleTime?: number;
}

export interface Message {
  type: string;
  inputs?: any;
  [key: string]: any;
}

export interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export interface AlarmTime {
  delayInMinutes: number;
  periodInMinutes?: number;
}

export interface UserInfoPublishStatus {
  status: "pending" | "sent" | "failed";
  ts: number;
  message?: string;
}

export interface ExtensionVersionInfo {
  version: string;
  schedule_time_check_update?: number;
  extension_zip_download_link?: string;
}

export interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export interface Screenshot {
  dataUrl: string;
  timestamp: number;
}

export const State = {
  LOADING: "loading",
  PENDING: "pending",
  RUNNING: "running",
  FINISHED: "finished",
  CANCELED: "canceled",
  COMPLETE: "complete",
};

export const Priority = {
  Urgent: 3,
  High: 2,
  Medium: 1,
  Low: 0,
};
