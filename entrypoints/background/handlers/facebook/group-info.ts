import { FacebookGroupJoinedData, ParseType } from "@/utils/parsers/types";
import { HandlerContext } from "../../types/handle";

export const handleFbGroupInfo = async (dt: ParseType, ctx: HandlerContext) => {
    const {
        cachedFacebookData,
        facebookJoinedGroupsData: joinedGroups,
        saveFacebookGroupData,
        debounce,
        MAXIMUM_RECORD_ARCHIVED,
        MAXIMUM_TIME_WAIT_SECOND,
        sendFacebookCachedData,
        SEND_FACEBOOK_DATA_ALARM,
    } = ctx;
    const { data } = dt;
    const crawledGroupsData = data as FacebookGroupJoinedData[];
    console.log(
        "[FB Interceptor] Found groupInfo:",
        crawledGroupsData?.length,
        "groups",
    );
    if (!Array.isArray(crawledGroupsData) || !crawledGroupsData.length) return;

    joinedGroups.splice(0, joinedGroups.length, ...crawledGroupsData);

    debounce(saveFacebookGroupData, {}, MAXIMUM_TIME_WAIT_SECOND);

    cachedFacebookData.push(...crawledGroupsData);
    console.log("[Facebook Interceptor] Total in queue - Records:", cachedFacebookData.length);
    if (cachedFacebookData.length >= MAXIMUM_RECORD_ARCHIVED) {
        await sendFacebookCachedData();
    } else {
        console.log("[Facebook Interceptor] Scheduling send in", MAXIMUM_TIME_WAIT_SECOND, "seconds");
        chrome.alarms.create(SEND_FACEBOOK_DATA_ALARM, {
            delayInMinutes: Math.max(0.05, MAXIMUM_TIME_WAIT_SECOND / 60),
        });
    }
};
