import { Constants } from ".";
import { Platform } from "../../types/types";

export type SocialCookieDomain = (typeof Constants.SOCIAL_COOKIE_DOMAINS)[number];

export const SELECTED_PLATFORM_KEY = "selectedPlatform";

export const PLATFORM_CHANGED_EVENT = "hydra:login-success-redirectplatform-changed";

export const USER_PROFILE_PUBLISH_REQUIRED_FIELDS = [
    "url",
    "username",
    "tenant_ids",
    "id",
    "gender",
    "name",
    "entry_rowkey",
    "docType",
    "crawler_system",
    "_tenants",
    "platform",
];

export const USER_PROFILE_COLLECT_REQUIRED_FIELDS = [
    "url",
    "username",
    "id",
    "gender",
    "name",
    "docType",
];

export const USER_PROFILE_MAIN_FIELD_KEYS = [
    "id",
    "name",
    "username",
    "alternate_name",
    "url",
    "gender",
    "profile_picture",
    "cover_photo",
    "followers_text",
    "following_text",
    "category",
    "current_city",
    "hometown",
    "work",
    "description",
    "description_list",
    "docType",
];

export const PLATFORM_LABELS: Record<Platform, string> = {
    facebook: "Facebook",
    tiktok: "TikTok",
    x: "X (Twitter)",
    threads: "Threads",
    youtube: "Youtube"
};

/** Cookie domains cleared per platform (manual login — avoid cross-persona session bleed). */
export const PLATFORM_COOKIE_DOMAINS: Record<Platform, readonly string[]> = {
    facebook: [".facebook.com", ".fb.com"],
    tiktok: [".tiktok.com"],
    x: [".x.com", ".twitter.com"],
    threads: [".threads.com", ".threads.net"],
    youtube: [],
};

export const PLATFORM_URL_PATTERNS: Record<Platform, RegExp> = {
    facebook: /^https?:\/\/(www\.|web\.)?facebook\.com\//i,
    tiktok: /^https?:\/\/(www\.)?(m\.)?(vt\.)?(vm\.)?tiktok\.com\/*.*$/i,
    threads: /^https?:\/\/(www\.)?threads\.com\/*.*$/i,
    x: /^https?:\/\/x\.com\/*.*$/i,
    youtube: /^https?:\/\/(www\.)?youtube\.com\/*.*$/i,
};

export const SOCIAL_COOKIE_DOMAINS = [
    ".facebook.com",
    ".fb.com",
    ".tiktok.com",
    ".x.com",
    ".twitter.com",
    ".threads.com",
    ".threads.net",
];

export const PLATFORM_TAB_FB_GLOBS = [
    "*://*.facebook.com/*",
    "*://facebook.com/*",
    "https://www.facebook.com/*",
    "https://web.facebook.com/*",
    "https://*.tiktok.com/*",
    "https://www.tiktok.com/*",
];

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

export const FB_WEB_URL = "https://www.facebook.com/";
export const FB_WEB_FAVICON = "https://www.facebook.com/favicon.ico";