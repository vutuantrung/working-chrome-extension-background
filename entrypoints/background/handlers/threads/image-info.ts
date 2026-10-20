import { ParseType, ThreadsAttachment } from "@/utils/parsers/types";
import { HandlerContext } from "../../types/handle";
import { chromeApi } from "../../infrastructure/chrome-api/chrome-api";

export const handleThreadsImageInfo = async (dt: ParseType, ctx: HandlerContext) => {
    const {
        cachedThreadsData,
        MAXIMUM_RECORD_ARCHIVED,
        MAXIMUM_TIME_WAIT_SECOND,
        sendThreadsCachedData,
        SEND_THREADS_DATA_ALARM,
    } = ctx;
    const { data } = dt;
    const crawledImageData = data as ThreadsAttachment[];
    console.log("[Threads Interceptor] Found crawled images - Images:", crawledImageData?.length);

    if (!Array.isArray(crawledImageData) || !crawledImageData.length) return;

    cachedThreadsData.push(...crawledImageData);
    console.log("[Threads Interceptor] Total in queue - Records:", cachedThreadsData.length);

    if (cachedThreadsData.length >= MAXIMUM_RECORD_ARCHIVED) {
        console.log("[Threads Interceptor] Threshold reached, sending data now");
        await sendThreadsCachedData();
    } else {
        console.log("[Threads Interceptor] Scheduling send in", MAXIMUM_TIME_WAIT_SECOND, "seconds");
        chromeApi.alarms.create(SEND_THREADS_DATA_ALARM, {
            delayInMinutes: Math.max(0.05, MAXIMUM_TIME_WAIT_SECOND / 60),
        });
    }
};