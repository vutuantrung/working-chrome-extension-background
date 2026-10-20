import { FacebookProfileData, ParseType } from "@/utils/parsers/types";
import { HandlerContext } from "../../types/handle";
import { chromeApi } from "../../chrome-api";

export const handleFbProfileInfo = async (dt: ParseType, ctx: HandlerContext) => {
    const {
        senderTabId,
        cachedFacebookData,
        MAXIMUM_RECORD_ARCHIVED,
        MAXIMUM_TIME_WAIT_SECOND,
        sendFacebookCachedData,
        SEND_FACEBOOK_DATA_ALARM,
    } = ctx;

    const { data } = dt;
    const crawledProfileData = data as FacebookProfileData[];
    console.log("[Facebook Interceptor] Found crawled profiles - Profiles:", crawledProfileData?.length);

    if (!Array.isArray(crawledProfileData) || !crawledProfileData.length) return;

    cachedFacebookData.push(...crawledProfileData);
    console.log("[Facebook Interceptor] Total in queue - Records:", cachedFacebookData.length);
    
    chromeApi.tabs.sendMessage(senderTabId, {
        activityName: "INJECT_HOVER_POST_OWNER_DATA",
        tabId: senderTabId,
        taskId: "inject_hover_post_owner_data_task",
        inputs: {
            hoverProfileIds: crawledProfileData.map((profile) => profile.profile_id).join(",")
        }
    });

    // get all the post owner that is a group
    // const groupPostOwners = crawledProfileData.filter(profile => profile.profile_type === "Group");

    if (cachedFacebookData.length >= MAXIMUM_RECORD_ARCHIVED) {
        sendFacebookCachedData();
    } else {
        console.log("[Facebook Interceptor] Scheduling send in", MAXIMUM_TIME_WAIT_SECOND, "seconds");
        chromeApi.alarms.create(SEND_FACEBOOK_DATA_ALARM, {
            delayInMinutes: Math.max(0.05, MAXIMUM_TIME_WAIT_SECOND / 60),
        });
    }
};