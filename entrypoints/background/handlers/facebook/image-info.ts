import { FacebookImageData, ParseType } from "@/utils/parsers/types";
import { HandlerContext } from "../../types/handle";
import { chromeApi } from "../../infrastructure/chrome-api/chrome-api";

export const handleFbImageInfo = async (dt: ParseType, ctx: HandlerContext) => {
    const {
        cachedFacebookData,
        MAXIMUM_RECORD_ARCHIVED,
        MAXIMUM_TIME_WAIT_SECOND,
        sendFacebookUserData,
        sendFacebookCachedData,
        SEND_FACEBOOK_DATA_ALARM,
    } = ctx;

    const { data } = dt;
    const crawledImageData = data as FacebookImageData[];
    console.log("[Facebook Interceptor] Found crawled images - Images:", crawledImageData?.length);

    if (!Array.isArray(crawledImageData) || !crawledImageData.length) return;

    cachedFacebookData.push(...crawledImageData);
    console.log("[Facebook Interceptor] Total in queue - Records:", cachedFacebookData.length);

    if (cachedFacebookData.length >= MAXIMUM_RECORD_ARCHIVED) {
        await sendFacebookCachedData();
        await sendFacebookUserData();
    } else {
        console.log("[Facebook Interceptor] Scheduling send in", MAXIMUM_TIME_WAIT_SECOND, "seconds");
        chromeApi.alarms.create(SEND_FACEBOOK_DATA_ALARM, {
            delayInMinutes: Math.max(0.05, MAXIMUM_TIME_WAIT_SECOND / 60),
        });
    }
};