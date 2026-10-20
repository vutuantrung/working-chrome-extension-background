
export interface SavedImage {
    id: string;
    url: string;
    name: string;
    description: string;
    capture_time: number;
    capacity: number;
}

export interface ImageMeta {
    name: string;
    description: string;
    capture_time: number;
    capacity?: number;
}

export type ImageItem =
    | { kind: "saved"; image: SavedImage }
    | { kind: "pending"; dataUrl: string; timestamp: number };

export interface CaseFilter {
    search: string;
    offset: number;
    limit: number;
}

interface ProfileCategory {
    id: string;
    name: string;
    level: number;
}

export interface GroupProfile {
    id: string;
    active: boolean;
    socialId: string;
    profileName: string;
    originalProfileType: string;
    profileType: string;
    channelName: string;
    accountUrl: string;
    assignedGroupId: string | null;
    assignedGroupName: string | null;
    assignedUserId: string | null;
    assignedUserName: string | null;
    categories: ProfileCategory[];
    totalMemberCount: number;
    favorite: boolean;
    avatarPath: string;
    /** Assignment status codes provided by the API. */
    assign_status?: string[];
    /** Membership status codes supplied by the source API. */    status?: string[]; group_id?: string; is_profile?: boolean; crawler_system?: string; crawled_time?: number; created_time?: number; updated_time?: number;
    /** Optional infiltration/task details when supplied by the API. */
    infiltrationStatus?: "NOT_JOINED" | "REQUESTED" | "JOINED";
    infiltratedAccountCount?: number;
    accountDisplayName?: string;
    online?: boolean;
    type?: string;
    createdAt: string;
    updatedAt: string;
}

export type PlatformId = "facebook" | "tiktok" | "x" | "threads" | "youtube";

export type PlatformObject = {
    id: PlatformId;
    label: string;
    url?: string;
    gradient: string;
    hoverGlow: string;
    icon: React.ReactNode;
    disabled?: boolean;
};

export type ViewState =
    | "initializing"
    | "activating"
    | "ready"
    | "no-options"
    | "unavailable";

export type AutomationSubTab = "config" | "monitor" | "raw";

export interface Tab<T extends string> {
    id: T;
    label: string;
    icon?: React.ReactNode;
    count?: number;
}

export interface User {
    id: string;
    username: string;
    name: string;
    apikey: string;
    tenants: any;
    extension_session: any;
}

export type LoginFailedReason = "no_accounts" | "no_cookies" | "cookies_invalid" | "unknown";

export type LoginResult =
    | { success: true }
    | {
        success: false;
        reason: LoginFailedReason;
    };

export type NonFacebookPlatform = "tiktok" | "x" | "threads";

export interface AuthContextType {
    user: User | null;
    facebookAccounts: SocialAccount[];
    extensionProxy: any;
    loading: boolean;
    login: (email: string, password: string) => Promise<boolean>;
    loginWithMode: (mode: "auto" | "manual", platform?: string) => Promise<LoginResult>;
    resumeSocialPlatformAfterRelogin: (platform: NonFacebookPlatform) => Promise<void>;
    logout: () => Promise<void>;
    restart: () => Promise<void>;
    applyEffectiveProxy: (opts?: {
        personaAccountProxy?: unknown;
        extensionAccountProxy?: unknown;
    }) => Promise<void>;
    persistAndApplyPersonaProxy: (persona: unknown) => Promise<void>;
    applyPersonaOnSelect: (persona: unknown) => Promise<void>;
    hasExtensionConfig: boolean;
    canSwitchPersona: boolean;
    switchPersona: (personaId: string) => Promise<{ success: boolean; error?: string }>;
    isAuthenticated: boolean;
    isApikeySession: boolean;
    error: string | null;
    clearError: () => void;
}

export interface SocialAccount {
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
    proxy?: any;
    proxy_id?: string;
    status: string;
    tenant_id?: string;
    ttl?: number;
    uid?: string;
    updated_time?: number;
    user_id?: string;
}

export type Persona = {
    id: string;
    job: string;
    gender: "male" | "female" | string;
    status: "active" | "inactive" | string;
    address: string;
    country: string;
    user_id: string;
    nickname: string;
    last_name: string;
    platforms: string[];
    extra_meta: any;
    first_name: string;
    description: string;
    assigned_vms: any;
    created_time: number;
    updated_time: number;
    date_of_birth: string;
    marital_status: string;
    total_accounts: any;
    assigned_emails: number;
    logged_accounts: any;
    place_of_origin: string;
    assigned_mobiles: any;
    assigned_proxies: number;
    proxy?: Record<string, unknown>;
};

export interface Task {
    taskId: string;
    activityId: string;
    activityName: string;
    platform: string;
    priority: number;
    state: string;
    tabId?: number;
    result?: string | { groupLinks?: string[]; groupIds?: string[] };
    createdTime: number;
    startTime?: number;
    endTime?: number;
}

export interface ProfileCaseEviden {
    id: string;
    name: string;
    description: string;
    type: string;
    capacity: number;
    s3_key: string;
    capture_time: number;
    profile_case_id: string;
}

export interface ProfileCase {
    id: string;
    name: string;
    platform: string;
    description: string;
    profile_url: string;
    origin_url: string;
    profile_id: string;
    created_time: number;
    updated_time: number;
    profileCaseEvidens?: ProfileCaseEviden[];
}

export interface GetProfileCasesResponse {
    data: ProfileCase[];
    meta: {
        total_count: number;
        offset: number;
        limit: number
    }
}