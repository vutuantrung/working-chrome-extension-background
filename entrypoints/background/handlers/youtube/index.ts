import { ParseType, YoutubeDataType, YoutubePostData } from '@/utils/parsers/types';
import { HandlerContext } from '../../types/handle';

export const handleYoutubeDataInfo = async (dt: ParseType, ctx: HandlerContext) => {
    const {
        cachedYoutubeData,
        MAXIMUM_RECORD_ARCHIVED,
        MAXIMUM_TIME_WAIT_SECOND,
        sendYoutubeCachedData,
        SEND_YOUTUBE_DATA_ALARM,
    } = ctx;
    const { data } = dt;

    const crawledDataData = data as YoutubeDataType[];
    if (!Array.isArray(crawledDataData) || !crawledDataData.length) return;
    
    console.log(`[Youtube Interceptor] Found crawled data - ${crawledDataData[0].docType}: ${crawledDataData.length}`);

    if(crawledDataData[0].docType === "Post") {
        // post without entry_rowkey is used for updating comment count
        const existedEntryRowKeyPost = (crawledDataData as YoutubePostData[]).filter(post => !!post.entry_rowkey);
        const tempPost = (crawledDataData as YoutubePostData[]).find(post => !post.entry_rowkey);

        if(tempPost) {
            cachedYoutubeData.forEach((post, index) => {
                if(post.docType === "Post" && (post as YoutubePostData).post_id === tempPost.post_id) {
                    const refDataItem = cachedYoutubeData[index] as YoutubePostData;
                    if(tempPost.comment_count) refDataItem.comment_count = tempPost.comment_count;
                    if(tempPost.transcript?.length) refDataItem.transcript = tempPost.transcript;
                    if(tempPost.transcript) refDataItem.transcription = tempPost.transcription;
                }
            })
        }

        cachedYoutubeData.push(...existedEntryRowKeyPost);
    } else {
        cachedYoutubeData.push(...crawledDataData);
    }    

    console.log("[Youtube Interceptor] Total in queue - Records:", cachedYoutubeData.length);

    if (cachedYoutubeData.length >= MAXIMUM_RECORD_ARCHIVED) {
        await sendYoutubeCachedData();
    } else {
        console.log("[Youtube Interceptor] Scheduling send in", MAXIMUM_TIME_WAIT_SECOND, "seconds");
        chrome.alarms.create(SEND_YOUTUBE_DATA_ALARM, {
            delayInMinutes: Math.max(0.05, MAXIMUM_TIME_WAIT_SECOND / 60),
        });
    }
};