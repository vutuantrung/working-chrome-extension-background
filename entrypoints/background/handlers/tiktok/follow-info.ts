import { ParseType, TiktokUserFollowData } from "@/entrypoints/background/utils/parsers/types";
import { HandlerContext } from "../../types/handle";
import { chromeApi } from "../../infrastructure/chrome-api/chrome-api";
export const handleTiktokFollowInfo = async (dt: ParseType, ctx: HandlerContext) => {
    const {
        cachedTiktokData,
        MAXIMUM_RECORD_ARCHIVED,
        MAXIMUM_TIME_WAIT_SECOND,
        sendTiktokCachedData,
        SEND_TIKTOK_DATA_ALARM,
    } = ctx;
    const { data } = dt;

    const crawledFollowData = data as TiktokUserFollowData[];
    console.log("[Tiktok Interceptor] Found crawled follows - Follows:", crawledFollowData?.length);

    if (!Array.isArray(crawledFollowData) || !crawledFollowData.length) return;

    cachedTiktokData.push(...crawledFollowData);
    console.log("[Tiktok Interceptor] Total in queue - Records:", cachedTiktokData.length);

    if (cachedTiktokData.length >= MAXIMUM_RECORD_ARCHIVED) {
        await sendTiktokCachedData();
    } else {
        console.log("[Tiktok Interceptor] Scheduling send in", MAXIMUM_TIME_WAIT_SECOND, "seconds");
        chromeApi.alarms.create(SEND_TIKTOK_DATA_ALARM, {
            delayInMinutes: Math.max(0.05, MAXIMUM_TIME_WAIT_SECOND / 60),
        });
    }
};