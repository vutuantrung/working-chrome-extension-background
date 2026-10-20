import { ParseType, ThreadsUserProfileData } from "@/utils/parsers/types";
import { HandlerContext } from "../../types/handle";
import { chromeApi } from "../../infrastructure/chrome-api/chrome-api";

export const handleThreadsUserInfo = async (dt: ParseType, ctx: HandlerContext) => {
    const {
        cachedThreadsData,
        MAXIMUM_RECORD_ARCHIVED,
        MAXIMUM_TIME_WAIT_SECOND,
        sendThreadsCachedData,
        SEND_THREADS_DATA_ALARM,
    } = ctx;
    const { data } = dt;

    const crawledUserData = data as ThreadsUserProfileData[];
    console.log("[Threads Interceptor] Found crawled users - Users:", crawledUserData?.length);
    // console.log("[Threads Interceptor] Found crawled users - Users:", crawledUserData);

    if (!Array.isArray(crawledUserData) || !crawledUserData.length) return;

    cachedThreadsData.push(...crawledUserData);
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