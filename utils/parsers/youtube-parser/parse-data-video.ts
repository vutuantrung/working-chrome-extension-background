import { findAllKeyValuePairs } from "../facebook-parser/utils";
import { Result, YoutubeAttachment, YoutubeImageData, YoutubePostData } from "../types";
import { findByKey, generateKey, parseVietnameseRelativeTime, parseVietnameseViewCount, storeYoutubePostData } from "./utils";

export function parsePostData(
    payload: string,
    pathName: string,
    richItemRenderers?: any[]
): Result<{
    youtubePostData: YoutubePostData[],
    youtubeImageData: YoutubeImageData[],
}> {
    const postArray: YoutubePostData[] = [];
    const imageArray: YoutubeImageData[] = [];

    try {
        switch (pathName) {
            case "/": 
                parseHomeDate(payload, postArray, imageArray)
                break;
            case "/youtubei/v1/browse":
                parseHomeContinuationData(payload, postArray, imageArray, richItemRenderers)
                break;
            case "/youtubei/v1/search":
                parseSearchData(payload, postArray, imageArray)
                break;
            case "/youtubei/v1/get_watch":
                parseGetWatchData(payload, postArray, imageArray)
                break;
        }

        storeYoutubePostData(postArray).catch(() => {})

        return {
            ok: true,
            data: {
                youtubePostData: postArray,
                youtubeImageData: imageArray
            }
        };
    } catch (error: any) {
        console.error(
            "Error (Youtube Posts data parser)",
            error?.message
        );
        return { ok: false, error: new Error("Failed to parse Youtube post data") };
    }
}

function normalizeRichItemRenderer(richItemRenderer: any) {
    const content = richItemRenderer.content.lockupViewModel;
    const metadata = content.metadata.lockupMetadataViewModel;
    const authorPart = metadata.metadata.contentMetadataViewModel.metadataRows[0].metadataParts[0].text;
    const authorInfo = authorPart.commandRuns?.[0].onTap.innertubeCommand.browseEndpoint;
    const videoInfo = metadata.metadata.contentMetadataViewModel.metadataRows?.[1].metadataParts;
    
    let viewCount = 0;
    let publishedTime = 0
    if(Array.isArray(videoInfo) && videoInfo.length === 2) {
        const [viewCountText, publishedText] = videoInfo;
        viewCount = parseVietnameseViewCount(viewCountText.text.content) ?? 0;
        publishedTime = parseVietnameseRelativeTime(publishedText.text.content) ?? 0;
    }

    const entryRowKey = generateKey(authorInfo?.browseId, content.contentId);
    const post: YoutubePostData = {
        entry_rowkey: entryRowKey,
        url: `https://www.youtube.com/watch?v=${content.contentId}`,
        post_id: content.contentId,
        source_type: "",
        tags: [],
        _tags: [],
        tenant_ids: [],
        inserted_time: Date.now(),
        created_time: publishedTime,
        updated_time: publishedTime,
        owner_id: authorInfo?.browseId,
        owner_name: authorPart.content,
        author_id: authorInfo?.browseId, 
        author_name: authorPart.content,
        view_count: viewCount,
        reaction_count: 0,
        comment_count: 0,
        share_count: 0,
        collect_count: 0,
        category_info: [],
        title: metadata.title.content,
        content: metadata.title.content,
        description: "",
        transcript: [],
        transcription: "",
        type: "video",
        docType: "Post",
        crawler_system: "extension",
        _tenants: [],
        attachments: [],
        channel_name: "youtube",
    }

    const thumbnail = findByKey(richItemRenderer, "thumbnailViewModel")?.image?.sources?.[0];
    if(thumbnail) {
        post.attachments = [{
            url: thumbnail.url,
            width: thumbnail.width,
            height: thumbnail.height,
            type: "photo"
        }];

        const image: YoutubeImageData = {
            docType: "Photo",
            image_type: "photo",
            url: thumbnail.url,
            media_url: thumbnail.url,
            post_id: post.post_id,
            entry_rowkey: post.entry_rowkey,
            channel_name: "youtube",
            created_time: publishedTime,
            updated_time: publishedTime,
            _tenants: [],
            tenant_ids: []
        };

        return { post, image }
    }

    return { post }
}

function normalizeVideoRenderer(videoRenderer: any) {
    const authorInfo = videoRenderer.ownerText?.runs?.[0];
    const entryRowKey = generateKey(authorInfo?.navigationEndpoint.browseEndpoint.browseId, videoRenderer.videoId);
    const viewCount = parseVietnameseViewCount(videoRenderer.viewCountText.simpleText) ?? 0;
    const publishedTime = parseVietnameseRelativeTime(videoRenderer.publishedTimeText.simpleText) ?? 0;
    
    const post: YoutubePostData = {
        entry_rowkey: entryRowKey,
        url: `https://www.youtube.com/watch?v=${videoRenderer.videoId}`,
        post_id: videoRenderer.videoId,
        source_type: "",
        tags: [],
        _tags: [],
        tenant_ids: [],
        inserted_time: Date.now(),
        created_time: publishedTime,
        updated_time: publishedTime,
        owner_id: authorInfo?.navigationEndpoint.browseEndpoint.browseId,
        owner_name: authorInfo?.text,
        author_id: authorInfo?.navigationEndpoint.browseEndpoint.browseId,
        author_name: authorInfo?.text,
        view_count: viewCount,
        reaction_count: 0,
        comment_count: 0,
        share_count: 0,
        collect_count: 0,
        category_info: [],
        title: videoRenderer.title.runs[0].text,
        content: videoRenderer.title.runs[0].text,
        description: videoRenderer.detailedMetadataSnippets[0].snippetText.runs[0].text,
        transcript: [],
        transcription: "",
        type: "video",
        docType: "Post",
        crawler_system: "extension",
        _tenants: [],
        attachments: [],
        channel_name: "youtube",
    };

    const thumbnail = findByKey(videoRenderer, "thumbnails")?.[0];
    if(thumbnail) {
        post.attachments = [{
            url: thumbnail.url,
            width: thumbnail.width,
            height: thumbnail.height,
            type: "photo"
        }];

        const image: YoutubeImageData = {
            docType: "Photo",
            image_type: "photo",
            url: thumbnail.url,
            media_url: thumbnail.url,
            post_id: post.post_id,
            entry_rowkey: post.entry_rowkey,
            channel_name: "youtube",
            created_time: publishedTime,
            updated_time: publishedTime,
            _tenants: [],
            tenant_ids: []
        };

        return { post, image }
    }

    return { post };
}

function parseHomeDate(
    htmlText: string,
    postArray: YoutubePostData[],
    imageArray: YoutubeImageData[],
) {
    const domParser = new DOMParser();
    const document = domParser.parseFromString(htmlText, 'text/html');
    const scripts = document.querySelectorAll('script');

    for (const s of scripts) {
        if (s.textContent.includes('var ytInitialData')) {
            const match = s.textContent.match(/var ytInitialData = (\{.*?\});/s);
            if (match) {
                const data = JSON.parse(match[1]);
                const richItemRenderers = findAllKeyValuePairs(data, "richItemRenderer");
                richItemRenderers.forEach(({value}) => {
                    const { post, image } = normalizeRichItemRenderer(value);
                    postArray.push(post);
                    image && imageArray.push(image);
                });
            }
        }
    }
}
function parseHomeContinuationData(
    jsonStr: string,
    postArray: YoutubePostData[],
    imageArray: YoutubeImageData[],
    parsedItemRenderers?: any[],
) {
    if(parsedItemRenderers?.length) {
        parsedItemRenderers.forEach((item: any) => {
            try {
                const { post, image } = normalizeRichItemRenderer(item);
                postArray.push(post);
                image && imageArray.push(image);
            } catch (_) {}
        });
        return;
    }

    const data = JSON.parse(jsonStr);
    const {appendContinuationItemsAction, reloadContinuationItemsCommand} = data.onResponseReceivedActions[0];
    const richItemRenderers =
        (appendContinuationItemsAction?.continuationItems ?? reloadContinuationItemsCommand?.continuationItems?.[0].richShelfRenderer.contents)
            .filter((item: any) => item.hasOwnProperty("richItemRenderer"))
            .map((item: any) => item.richItemRenderer)
    richItemRenderers.forEach((item: any) => {
        try {
            const { post, image } = normalizeRichItemRenderer(item);
            postArray.push(post);
            image && imageArray.push(image);
        } catch (_) {}
    });
}

function parseSearchData(
    jsonStr: string,
    postArray: YoutubePostData[],
    imageArray: YoutubeImageData[],
) {
    const data = JSON.parse(jsonStr);
    const videoRenderers = findAllKeyValuePairs(data, "videoRenderer");
    videoRenderers.forEach(({value}) => {
        try {
            const { post, image } = normalizeVideoRenderer(value);
            postArray.push(post);
            image && imageArray.push(image);
        } catch (_) {}
    });
}

function parseGetWatchData(
    jsonStr: string,
    postArray: YoutubePostData[],
    imageArray: YoutubeImageData[],
) {
    const data = JSON.parse(jsonStr);
    if(!Array.isArray(data)) return;

    const playerResponse = data.find(item => item.hasOwnProperty("playerResponse"))?.playerResponse
    if(!playerResponse) return;

    const {videoDetails, microformat} = playerResponse;
    const {playerMicroformatRenderer} = microformat;

    const thumbnail = playerMicroformatRenderer?.thumbnail?.thumbnails?.[0];

    const tags: any[] = [];
    if(Array.isArray(videoDetails?.keywords)) {
        videoDetails.keywords.forEach((keyword: string) => {
            tags.push({
                name: keyword,
                description: "",
                type: "hashtag",
                entry_id: ""
            })
        })
    }

    const entryRowKey = generateKey(videoDetails.channelId, videoDetails.videoId);
    const publishedTime = new Date(playerMicroformatRenderer.publishDate).getTime();
    
    const post: YoutubePostData = {
        entry_rowkey: entryRowKey,
        url: playerMicroformatRenderer.canonicalUrl,
        post_id: videoDetails.videoId,
        source_type: "",
        tags: [],
        _tags: tags,
        tenant_ids: [],
        inserted_time: Date.now(),
        created_time: publishedTime,
        updated_time: publishedTime,
        owner_id: videoDetails.channelId,
        owner_name: videoDetails.author,
        author_id: videoDetails.channelId,
        author_name: videoDetails.author,
        view_count: Number(videoDetails.viewCount),
        reaction_count: Number(playerMicroformatRenderer.likeCount),
        comment_count: 0,
        share_count: 0,
        collect_count: 0,
        category_info: [],
        title: playerMicroformatRenderer.title.simpleText,
        content: playerMicroformatRenderer.title.simpleText,
        description: playerMicroformatRenderer.description?.simpleText ?? "",
        transcript: [],
        transcription: "",
        type: "video",
        docType: "Post",
        crawler_system: "extension",
        _tenants: [],
        attachments: [{
            type: "photo",
            url: thumbnail.url,
            width: thumbnail.width,
            height: thumbnail.height
        }],
        channel_name: "youtube",
    }

    const image: YoutubeImageData = {
        image_type: "photo",
        url: thumbnail.url,
        media_url: thumbnail.url,
        post_id: post.post_id,
        entry_rowkey: post.entry_rowkey,
        channel_name: "youtube",
        created_time: publishedTime,
        updated_time: publishedTime,
        docType: "Photo",
        _tenants: [],
        tenant_ids: []
    }

    postArray.push(post);
    imageArray.push(image);
}
