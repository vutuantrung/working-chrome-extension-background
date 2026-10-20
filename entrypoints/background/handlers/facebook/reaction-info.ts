import { FacebookReactionData, ParseType } from "@/utils/parsers/types";
import { HandlerContext } from "../../types/handle";

export const handleFbReactionInfo = async (dt: ParseType, ctx: HandlerContext) => {
    const {
        cachedFacebookData,
        MAXIMUM_RECORD_ARCHIVED,
        MAXIMUM_TIME_WAIT_SECOND,
        sendFacebookCachedData,
        SEND_FACEBOOK_DATA_ALARM,
    } = ctx;

    const { data } = dt;
    const crawledReactionData = data as FacebookReactionData[];
    console.log("[Facebook Interceptor] Found crawled reactions - Reactions:", crawledReactionData?.length);

    if (!Array.isArray(crawledReactionData) || !crawledReactionData.length) { 
        console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> No reactions found");
        return;
    }

    cachedFacebookData.push(...crawledReactionData);
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