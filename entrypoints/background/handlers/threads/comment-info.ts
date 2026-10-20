import { ParseType, ThreadsCommentData } from "@/utils/parsers/types";
import { HandlerContext } from "../../types/handle";

export const handleThreadsCommentInfo = async (dt: ParseType, ctx: HandlerContext) => {
    const {
        cachedThreadsData,
        MAXIMUM_RECORD_ARCHIVED,
        MAXIMUM_TIME_WAIT_SECOND,
        sendThreadsCachedData,
        SEND_THREADS_DATA_ALARM,
    } = ctx;
    const { data } = dt;

    const crawledCommentData = data as ThreadsCommentData[];
    console.log("[Threads Interceptor] Found crawled comments - Comments:", crawledCommentData?.length);

    if (!Array.isArray(crawledCommentData) || !crawledCommentData.length) return;

    cachedThreadsData.push(...crawledCommentData);
    console.log("[Threads Interceptor] Total in queue - Records:", cachedThreadsData.length);

    if (cachedThreadsData.length >= MAXIMUM_RECORD_ARCHIVED) {
        await sendThreadsCachedData();
    } else {
        console.log("[Threads Interceptor] Scheduling send in", MAXIMUM_TIME_WAIT_SECOND, "seconds");
        chrome.alarms.create(SEND_THREADS_DATA_ALARM, {
            delayInMinutes: Math.max(0.05, MAXIMUM_TIME_WAIT_SECOND / 60),
        });
    }
};