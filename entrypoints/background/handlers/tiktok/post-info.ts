import { ParseType, TiktokPostData } from "@/entrypoints/background/utils/parsers/types";
import { HandlerContext } from "../../types/handle";
import { chromeApi } from "../../infrastructure/chrome-api/chrome-api";
export const handleTiktokPostInfo = async (dt: ParseType, ctx: HandlerContext) => {
    const {
        cachedTiktokData,
        MAXIMUM_RECORD_ARCHIVED,
        MAXIMUM_TIME_WAIT_SECOND,
        sendTiktokCachedData,
        SEND_TIKTOK_DATA_ALARM,
    } = ctx;
    const { data } = dt;

    const crawledPostData = data as TiktokPostData[];
    console.log("[Tiktok Interceptor] Found crawled posts - Posts:", crawledPostData?.length);

    if (!Array.isArray(crawledPostData) || !crawledPostData.length) return;

    cachedTiktokData.push(...crawledPostData);
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