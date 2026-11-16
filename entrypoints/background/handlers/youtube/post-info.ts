import { ParseType, YoutubePostData } from '@/entrypoints/background/utils/parsers/types';
import { HandlerContext } from '../../types/handle';

export const handleYoutubePostInfo = async (dt: ParseType, ctx: HandlerContext) => {
    const {
        applicationServices,
        cachedYoutubeData,
        MAXIMUM_RECORD_ARCHIVED,
        MAXIMUM_TIME_WAIT_SECOND,
        sendYoutubeCachedData,
        SEND_YOUTUBE_DATA_ALARM,
    } = ctx;
    const { data } = dt;
    const crawledPostData = data as YoutubePostData[];
    console.log("[Youtube Interceptor] Found crawled posts - Posts:", crawledPostData?.length);

    if (!Array.isArray(crawledPostData) || !crawledPostData.length) return;

    // post without entry_rowkey is used for updating comment count
    const existedEntryRowKeyPost = crawledPostData.filter(post => !!post.entry_rowkey);
    const tempPost = crawledPostData.find(post => !post.entry_rowkey);

    if (tempPost) {
        cachedYoutubeData.forEach((post, index) => {
            if (post.docType === "Post" && post.post_id === tempPost.post_id) {
                const refDataItem = cachedYoutubeData[index] as YoutubePostData;
                if (tempPost.comment_count) refDataItem.comment_count = tempPost.comment_count;
                if (tempPost.transcript?.length) refDataItem.transcript = tempPost.transcript;
                if (tempPost.transcript) refDataItem.transcription = tempPost.transcription;
            }
        })
    }

    cachedYoutubeData.push(...existedEntryRowKeyPost);

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