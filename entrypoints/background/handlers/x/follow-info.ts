import { ParseType, XUserFollowData } from "@/utils/parsers/types";
import { HandlerContext } from "../../types/handle";
import { chromeApi } from "../../chrome-api";
export const handleXFollowInfo = async (dt: ParseType, ctx: HandlerContext) => {
    const {
        cachedXData,
        MAXIMUM_RECORD_ARCHIVED,
        MAXIMUM_TIME_WAIT_SECOND,
        sendXCachedData,
        SEND_X_DATA_ALARM,
    } = ctx;
    const { data } = dt;

    const crawledFollowData = data as XUserFollowData[];
    console.log("[X Interceptor] Found crawled follows - Follows:", crawledFollowData?.length);

    if (!Array.isArray(crawledFollowData) || !crawledFollowData.length) return;

    cachedXData.push(...crawledFollowData);
    console.log("[X Interceptor] Total in queue - Records:", cachedXData.length);

    if (cachedXData.length >= MAXIMUM_RECORD_ARCHIVED) {
        await sendXCachedData();
    } else {
        console.log("[X Interceptor] Scheduling send in", MAXIMUM_TIME_WAIT_SECOND, "seconds");
        chromeApi.alarms.create(SEND_X_DATA_ALARM, {
            delayInMinutes: Math.max(0.05, MAXIMUM_TIME_WAIT_SECOND / 60),
        });
    }
};