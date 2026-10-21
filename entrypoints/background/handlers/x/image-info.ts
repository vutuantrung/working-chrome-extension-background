import { ParseType, XAttachment } from "@/entrypoints/background/utils/parsers/types";
import { HandlerContext } from "../../types/handle";
import { chromeApi } from "../../infrastructure/chrome-api/chrome-api";
export const handleXImageInfo = async (dt: ParseType, ctx: HandlerContext) => {
    const {
        cachedXData,
        MAXIMUM_RECORD_ARCHIVED,
        MAXIMUM_TIME_WAIT_SECOND,
        sendXCachedData,
        SEND_X_DATA_ALARM,
    } = ctx;
    const { data } = dt;
    const crawledImageData = data as XAttachment[];
    console.log("[X Interceptor] Found crawled images - Images:", crawledImageData?.length);

    if (!Array.isArray(crawledImageData) || !crawledImageData.length) return;

    cachedXData.push(...crawledImageData);
    console.log("[X Interceptor] Total in queue - Records:", cachedXData.length);

    if (cachedXData.length >= MAXIMUM_RECORD_ARCHIVED) {
        console.log("[X Interceptor] Threshold reached, sending data now");
        await sendXCachedData();
    } else {
        console.log("[X Interceptor] Scheduling send in", MAXIMUM_TIME_WAIT_SECOND, "seconds");
        chromeApi.alarms.create(SEND_X_DATA_ALARM, {
            delayInMinutes: Math.max(0.05, MAXIMUM_TIME_WAIT_SECOND / 60),
        });
    }
};