import type { TranslationKey } from "./i18n";
import { AutomationSubTab, PlatformId } from "../types/types";

export const SELECTED_PLATFORM_KEY = "selectedPlatform";

export const TASK_STATES = {
    PENDING: "pending",
    RUNNING: "running",
    FINISHED: "finished",
    CANCELED: "canceled",
};

export const PRIORITY_LABELS: Record<number, TranslationKey> = {
    3: "priorityUrgent",
    2: "priorityHigh",
    1: "priorityMedium",
    0: "priorityLow"
};

export const AUTOMATION_TABS: LocalizedOption[] = [
    { id: "config" as AutomationSubTab, label_id: "configTab" },
    { id: "monitor" as AutomationSubTab, label_id: "monitorTab" },
]

export const PLATFORM_OPTIONS: LocalizedOption[] = [
    { id: "facebook", label_id: "platformFacebook" },
    { id: "youtube", label_id: "platformYoutube" },
    { id: "tiktok", label_id: "platformTiktok" },
    { id: "threads", label_id: "platformThreads" },
    { id: "telegram", label_id: "platformTelegram" },
    { id: "twitter", label_id: "platformTwitter" },
    { id: "discord", label_id: "platformDiscord" },
]

export const FB_GROUP_TYPE: LocalizedOption[] = [
    { id: "group", label_id: "group" },
    { id: "private_group", label_id: "private_group" },
    { id: "profile", label_id: "profile" },
    { id: "fanpage", label_id: "fanpage" },
]

export const PLATFORM_LABELS: Record<PlatformId, string> = {
    facebook: "Facebook",
    tiktok: "TikTok",
    x: "X (Twitter)",
    threads: "Threads",
    youtube: "Youtube"
};

export const PLATFORM_URLS: Record<string, string> = {
    x: "https://x.com/",
    facebook: "https://www.facebook.com/",
    tiktok: "https://www.tiktok.com/",
    threads: "https://www.threads.com/",
    youtube: "https://www.youtube.com/",
};

const PLATFORM_URL_PATTERNS: Record<PlatformId, RegExp> = {
    facebook: /^https?:\/\/(www\.|web\.)?facebook\.com\//i,
    tiktok: /^https?:\/\/(www\.)?(m\.)?(vt\.)?(vm\.)?tiktok\.com\/*.*$/i,
    threads: /^https?:\/\/(www\.)?threads\.com\/*.*$/i,
    x: /^https?:\/\/x\.com\/*.*$/i,
    youtube: /^https?:\/\/(www\.)?youtube\.com\/*.*$/i,
};

export function detectPlatformByPattern(url: string | undefined | null): PlatformId | null {
    if (!url) return null;
    const platformParterns = Object.entries(PLATFORM_URL_PATTERNS) as [PlatformId, RegExp][];
    for (const [platform, re] of platformParterns) {
        if (re.test(url)) return platform;
    }
    return null;
}

export const DEFAULT_SCROLLING_URL = [
    "https://www.facebook.com/",
    "https://www.facebook.com/groups/feed/",
    "https://www.facebook.com/?filter=groups&sk=h_chr",
];

export const JOIN_STATUS_TAB: LocalizedOption[] = [
    { id: "all", label_id: "all" },
    { id: "joined", label_id: "joinedFilter" },
    { id: "not_joined", label_id: "notJoinedFilter" },
    { id: "requested", label_id: "requestedFilter" },
];

export const LOGIN_ERROR_MESSAGES: LocalizedOption[] = [
    { id: "no_accounts", label_id: "login_err_no_account" },
    { id: "no_cookies", label_id: "login_err_no_cookie" },
    { id: "cookies_invalid", label_id: "login_err_cookies_invalid" },
    { id: "unknown", label_id: "login_err_unknown" },
];

export type MainTab = "dashboard" | "automation" | "group" | "eviden";

export const DEFAULT_CASE_ID = 'new';
export const DEFAULT_PAGE_SIZE = 10;

export const PLATFORM_CHANGED_EVENT = "hydra:login-success-redirectplatform-changed";

/** Options keep stable IDs. label_id is a dictionary key, not display text. */
export type LocalizedOption<T extends string = string> = { id: T; label_id: TranslationKey };
export function localizeOptions<T extends string, O extends LocalizedOption<T>>(
    options: readonly O[],
    t: (key: TranslationKey) => string,
): Array<Omit<O, "label_id"> & { label: string }> {
    return options.map(({ label_id, ...option }) => ({
        ...option,
        label: t(label_id),
    })) as Array<Omit<O, "label_id"> & { label: string }>;
}
