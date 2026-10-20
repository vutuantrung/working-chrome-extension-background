import { ParseType, TiktokCommentData, TiktokImageData, TiktokPostData } from "@/utils/parsers/types";
import { HandlerContext } from "../../types/handle";

export const handleTiktokCommentInfo = async (dt: ParseType, ctx: HandlerContext) => {
    const {
        cachedTiktokData,
        MAXIMUM_RECORD_ARCHIVED,
        MAXIMUM_TIME_WAIT_SECOND,
        sendTiktokCachedData,
        SEND_TIKTOK_DATA_ALARM,
    } = ctx;
    const { data } = dt;
    const crawledCommentData = data as TiktokCommentData[];
    console.log("[Tiktok Interceptor] Found crawled comments - Comments:", crawledCommentData?.length);

    if (!Array.isArray(crawledCommentData) || !crawledCommentData.length) return;

    cachedTiktokData.push(...crawledCommentData);
    console.log("[Tiktok Interceptor] Total in queue - Records:", cachedTiktokData.length);

    if (cachedTiktokData.length >= MAXIMUM_RECORD_ARCHIVED) {
        await sendTiktokCachedData();
    } else {
        console.log("[Tiktok Interceptor] Scheduling send in", MAXIMUM_TIME_WAIT_SECOND, "seconds");
        chrome.alarms.create(SEND_TIKTOK_DATA_ALARM, {
            delayInMinutes: Math.max(0.05, MAXIMUM_TIME_WAIT_SECOND / 60),
        });
    }
};