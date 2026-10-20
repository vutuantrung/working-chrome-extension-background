import { ParseType, ThreadsPostData } from "@/utils/parsers/types";
import { HandlerContext } from "../../types/handle";
import { chromeApi } from "../../chrome-api";

export const handleThreadsPostInfo = async (dt: ParseType, ctx: HandlerContext) => {
    const {
        cachedThreadsData,
        MAXIMUM_RECORD_ARCHIVED,
        MAXIMUM_TIME_WAIT_SECOND,
        sendThreadsCachedData,
        SEND_THREADS_DATA_ALARM,
    } = ctx;
    const { data } = dt;

    const crawledPostData = data as ThreadsPostData[];
    console.log("[Threads Interceptor] Found crawled posts - Posts:", crawledPostData?.length);

    if (!Array.isArray(crawledPostData) || !crawledPostData.length) return;

    cachedThreadsData.push(...crawledPostData);
    console.log("[Threads Interceptor] Total in queue - Records:", cachedThreadsData.length);

    if (cachedThreadsData.length >= MAXIMUM_RECORD_ARCHIVED) {
        await sendThreadsCachedData();
    } else {
        console.log("[Threads Interceptor] Scheduling send in", MAXIMUM_TIME_WAIT_SECOND, "seconds");
        chromeApi.alarms.create(SEND_THREADS_DATA_ALARM, {
            delayInMinutes: Math.max(0.05, MAXIMUM_TIME_WAIT_SECOND / 60),
        });
    }
};