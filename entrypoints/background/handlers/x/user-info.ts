import { ParseType, XUserProfileData } from "@/utils/parsers/types";
import { HandlerContext } from "../../types/handle";

export const handleXUserInfo = async (dt: ParseType, ctx: HandlerContext) => {
    const {
        cachedXData,
        MAXIMUM_RECORD_ARCHIVED,
        MAXIMUM_TIME_WAIT_SECOND,
        sendXCachedData,
        SEND_X_DATA_ALARM,
    } = ctx;
    const { data } = dt;

    const crawledUserData = data as XUserProfileData[];
    console.log("[X Interceptor] Found crawled users - Users:", crawledUserData?.length);

    if (!Array.isArray(crawledUserData) || !crawledUserData.length) return;

    cachedXData.push(...crawledUserData);
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