import { ParseType, TiktokImageData, TiktokPostData } from "@/utils/parsers/types";
import { HandlerContext } from "../../types/handle";
import { chromeApi } from "../../infrastructure/chrome-api/chrome-api";
export const handleTiktokImageInfo = async (dt: ParseType, ctx: HandlerContext) => {
    const {
        cachedTiktokData,
        MAXIMUM_RECORD_ARCHIVED,
        MAXIMUM_TIME_WAIT_SECOND,
        sendTiktokCachedData,
        SEND_TIKTOK_DATA_ALARM,
    } = ctx;
    const { data } = dt;
    const crawledImageData = data as TiktokImageData[];
    console.log("[Tiktok Interceptor] Found crawled images - Images:", crawledImageData?.length);

    if (!Array.isArray(crawledImageData) || !crawledImageData.length) return;

    cachedTiktokData.push(...crawledImageData);
    console.log("[Tiktok Interceptor] Total in queue - Records:", cachedTiktokData.length);

    if (cachedTiktokData.length >= MAXIMUM_RECORD_ARCHIVED) {
        console.log("[Tiktok Interceptor] Threshold reached, sending data now");
        await sendTiktokCachedData();
    } else {
        console.log("[Tiktok Interceptor] Scheduling send in", MAXIMUM_TIME_WAIT_SECOND, "seconds");
        chromeApi.alarms.create(SEND_TIKTOK_DATA_ALARM, {
            delayInMinutes: Math.max(0.05, MAXIMUM_TIME_WAIT_SECOND / 60),
        });
    }
};