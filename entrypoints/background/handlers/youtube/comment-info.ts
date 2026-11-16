import { ParseType, YoutubeCommentData } from '@/entrypoints/background/utils/parsers/types';
import { HandlerContext } from '../../types/handle';

export const handleYoutubeCommentInfo = async (dt: ParseType, ctx: HandlerContext) => {
    const {
        applicationServices,
        cachedYoutubeData,
        MAXIMUM_RECORD_ARCHIVED,
        MAXIMUM_TIME_WAIT_SECOND,
        sendYoutubeCachedData,
        SEND_YOUTUBE_DATA_ALARM,
    } = ctx;
    const { data } = dt;

    const crawledDataData = data as YoutubeCommentData[];
    if (!Array.isArray(crawledDataData) || !crawledDataData.length) return;

    console.log(`[Youtube Interceptor] Found crawled data - ${crawledDataData[0].docType}: ${crawledDataData.length}`);
    cachedYoutubeData.push(...crawledDataData);

    console.log("[Youtube Interceptor] Total in queue - Records:", cachedYoutubeData.length);

    if (cachedYoutubeData.length >= MAXIMUM_RECORD_ARCHIVED) {
        await sendYoutubeCachedData();
    } else {
        console.log("[Youtube Interceptor] Scheduling send in", MAXIMUM_TIME_WAIT_SECOND, "seconds");
        applicationServices.alarm?.getBrowserApi().create(SEND_YOUTUBE_DATA_ALARM, {
            delayInMinutes: Math.max(0.05, MAXIMUM_TIME_WAIT_SECOND / 60),
        });
    }
};