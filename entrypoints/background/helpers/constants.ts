import { Priority } from "../types/types";

export const DEFAULT_SETTINGS_JSON = {
  autoReport: true,
  activatingAutomation: true,
  activatingDevtools: true,
  apikey: "",
  collaboratorId: "",
  collaboratorTopic: "",
  domain: "https://random123456.projectsys.org",
  focus: "all",
  openingDevtoolsTabId: 0,
  proxy: "system",
  scheduleEndTime: "23:00:00",
  scheduleStartTime: "00:00:00",
  tenants: [
    {
      id: "581e1bb2d12ae3a0cfe04ac10fc25d80",
      name: "GP",
      project: "rp",
    }
  ],
  facebookTopics: "hydra-facebook-post-group-private|hydra-images-incoming|hydra-data-extension-user-info_lss-h_hm",
  tiktokTopics: "",
  facebookTopic: "facebook-extension-crawled-data",
  threadsTopic: "threads-extension-crawled-data",
  tiktokTopic: "tiktok-extension-crawled-data",
  xTopic: "x-extension-crawled-data",
  youtubeTopic: "youtube-extension-crawled-data",
  n_c: 0,
  archive: { fbGUrl: "" },
  isTabSpecific: false,
  firstFacebookTabId: 0,
}

export const DEFAULT_SCHEDULED_DATA = [
  {
    id: "asldjfnlknlkjsdf",
    name: "SCROLL_URLS",
    type: "auto-scripts",
    inputs: {
      urls: [
        "https://www.facebook.com/groups/joins/?nav_source=tab&ordering=viewer_added",
      ],
      platform: "facebook",
      currentIdx: 0,
      groupNumber: 5,
      scrollTimes: "15,20",
      waitingTime: 3000,
    },
    priority: Priority.High,
    platform: "facebook",
    scheduleTime: "|06:00:00||",
    scheduleType: "period",
  },
  {
    id: "hsd5234hsdf",
    name: "SCROLL_JOINED_GROUPS",
    type: "auto-scripts",
    inputs: {
      scrollTimes: "10,15",
      waitingTime: 3000,
      platform: "facebook",
      groupNumber: 10,
      groupTypeFocused: "private",
      reviewPeriod: 86400000, // 24 hours
      currentIdx: 0,
      groupUrls: [
        "https://www.facebook.com/groups/1234567789",
        "https://www.facebook.com/groups/1251231234",
      ],
      feedScrollTimes: "15,20",
      defaultFeedGroupUrls: [
        "https://www.facebook.com/",
        "https://www.facebook.com/groups/feed/",
        "https://www.facebook.com/?filter=groups&sk=h_chr",
      ],
      randomScrollUpTimes: "2,4",
    },
    priority: Priority.Low,
    platform: "facebook",
    scheduleTime: "|00:07:00||",
    scheduleType: "period",
  },
  {
    id: "kjnasklf234",
    name: "RESET",
    type: "system-scripts",
    inputs: {},
    platform: "extension",
    priority: Priority.Low,
    scheduleTime: "23:00:00|24:00:00||",
    scheduleType: "period",
  },
];

export const PLATFORM_TAB_GLOBS: string[] = [
  "*://*.facebook.com/*",
  "*://facebook.com/*",
  "https://www.facebook.com/*",
  "https://web.facebook.com/*",
  "https://*.tiktok.com/*",
  "https://www.tiktok.com/*",
];
