import { FacebookUserFollowData, FacebookUserFriendData } from "@/entrypoints/background/utils/parsers/types";

export type EffectiveProxySource = "extension" | "persona" | "account" | "none";

export type ProxyEndpoint = {
  host: string;
  port: string
};

export type PersonaFacebookAccount = {
  account_id: string;
  account_status?: any[];
  allow_persona_feature?: boolean;
  categories?: string[];
  cookies?: string;
  extension_config_id?: string;
  gender?: string;
  group_limit?: number;
  max_group_joins_per_day?: number;
  name?: string;
  persona_topic_ids?: string[];
  platform: string;
  proxy?: Record<string, unknown>;
  proxy_id?: string;
  status?: string;
  tenant_id?: string;
  ttl?: number;
  uid?: string;
  updated_time?: number;
  user_id?: string;
};

export type Platform = "facebook" | "tiktok" | "x" | "threads" | "youtube";

export type ProxyHealthState = "ok" | "error";

export type ProxyAuthCredentials = {
  username: string;
  password: string;
};

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

export interface User {
    id: string;
    username: string;
    name: string;
    apikey: string;
    tenants: any;
    extension_session: any;
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

export type PendingUserInfo = {
  raw: string;
  parsed?: any;
  ts: number;
  id?: string;
  name?: string;
};

export interface GetMemberSourcesResponse {
  success?: boolean;
  memberSources?: any[];
  data?: any[];
  total?: number;
}

export interface CreatePersonasPayload {
  generate_conditions?: {
    country?: string;
    topic_ids?: string[];
  };
  account_and_device_resources?: any[];
  proxy_resources?: any[];
  email_resources?: any[];
  platforms?: string[];
}

export interface UpdateExtensionSessionPayload {
  schedule_start_time: string; // ISO or "HH:mm:ss" depending on backend
  schedule_end_time: string;
  automation?: boolean;
}