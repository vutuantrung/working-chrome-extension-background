import { ParseType, XPostData } from "@/utils/parsers/types";
import { HandlerContext } from "../../types/handle";

export const handleXPostInfo = async (dt: ParseType, ctx: HandlerContext) => {
    const {
        cachedXData,
        MAXIMUM_RECORD_ARCHIVED,
        MAXIMUM_TIME_WAIT_SECOND,
        sendXCachedData,
        SEND_X_DATA_ALARM,
    } = ctx;
    const { data } = dt;

    const crawledPostData = data as XPostData[];
    console.log("[X Interceptor] Found crawled posts - Posts:", crawledPostData?.length);

    if (!Array.isArray(crawledPostData) || !crawledPostData.length) return;

    cachedXData.push(...crawledPostData);
    console.log("[X Interceptor] Total in queue - Records:", cachedXData.length);

    if (cachedXData.length >= MAXIMUM_RECORD_ARCHIVED) {
        await sendXCachedData();
    } else {
        console.log("[X Interceptor] Scheduling send in", MAXIMUM_TIME_WAIT_SECOND, "seconds");
        chrome.alarms.create(SEND_X_DATA_ALARM, {
            delayInMinutes: Math.max(0.05, MAXIMUM_TIME_WAIT_SECOND / 60),
        });
    }
};