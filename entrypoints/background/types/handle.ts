import {
    FacebookDataType,
    FacebookGroupJoinedData,
    ThreadsDataType,
    TiktokDataType,
    XDataType,
    YoutubeDataType,
} from "@/utils/parsers/types";


type SetStorageCachedFn = (data: Record<string, any>) => Promise<void>;
type DebounceFn = (...args: any[]) => void;

export type PublishFacebookUserInfoOptions = {
    overrideRaw?: string;
    overrideParsed?: any;
    overrideId?: string;
    overrideTs?: number;
    waitForDescription?: boolean;
};

export type HandlerContext = {
    senderTabId: number;
    isProfileTab: boolean;

    debounce: DebounceFn;

    sendFacebookCachedData: () => Promise<void>;
    sendTiktokCachedData: () => Promise<void>;
    sendThreadsCachedData: () => Promise<void>;
    sendXCachedData: () => Promise<void>;
    sendYoutubeCachedData: () => Promise<void>;

    saveFacebookUserData: () => Promise<void>;
    saveFacebookGroupData: () => Promise<void>;
    // sendFacebookPostData: () => Promise<void>;
    sendFacebookUserData: () => Promise<void>;
    publishFacebookUserInfo: (options?: PublishFacebookUserInfoOptions) => Promise<{
        ok: boolean;
        error?: string;
    }>;

    // sendTiktokPostData: () => Promise<void>;
    // sendTiktokCommentData: () => Promise<void>;

    MAXIMUM_TIME_WAIT_SECOND: number;
    MAXIMUM_RECORD_ARCHIVED: number;
    MAX_PENDING_USERINFO: number;
    USERINFO_PUBLISH_DEBOUNCE_MS: number;

    SEND_X_DATA_ALARM: string;
    SEND_FACEBOOK_DATA_ALARM: string;
    SEND_TIKTOK_DATA_ALARM: string;
    SEND_THREADS_DATA_ALARM: string;
    SEND_YOUTUBE_DATA_ALARM: string;

    cachedXData: XDataType[];
    cachedTiktokData: TiktokDataType[];
    cachedFacebookData: FacebookDataType[];
    cachedThreadsData: ThreadsDataType[];
    cachedYoutubeData: YoutubeDataType[];

    // facebookPostData: FacebookPostData[];
    // facebookImagesData: FacebookImageData[];
    facebookJoinedGroupsData: FacebookGroupJoinedData[];

    // tiktokPostData: TiktokPostData[];
    // tiktokImagesData: TiktokImageData[];
    // tiktokCommentsData: TiktokCommentData[];
};