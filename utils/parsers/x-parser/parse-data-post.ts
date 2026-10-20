import { findAllKeyValuePairs } from "../facebook-parser/utils";
import { Result, XAttachment, XCommentData, XPostData } from "../types";
import { generateKey } from "./utils";

function parseXDataRecursively(
    payload: any,
    postArray: XPostData[],
    commentArray: XCommentData[],
    attachmentArray: XAttachment[]
): void {
    const tweetResultValue = payload;

    const postId = tweetResultValue?.result?.rest_id;
    if (!postId) return;

    const userName = tweetResultValue?.result?.core?.user_results?.result?.core?.screen_name;
    if (!userName) return;

    const ownerId = tweetResultValue.result.core.user_results.result.rest_id;
    const ownerName = tweetResultValue.result.core.user_results.result.core.name;

    let authorId = ownerId, authorName = ownerName;
    // result.quoted_status_result
    if (payload.result.quoted_status_result?.result) {
        parseXDataRecursively(payload.result.quoted_status_result, postArray, commentArray, attachmentArray);
        authorId = payload.result.quoted_status_result.result.core.user_results.result.rest_id;
        authorName = payload.result.quoted_status_result.result.core.user_results.result.core.name;
    }
    // result.retweeted_status_result
    if (payload.result.retweeted_status_result?.result) {
        parseXDataRecursively(payload.result.retweeted_status_result, postArray, commentArray, attachmentArray);
        authorId = payload.result.retweeted_status_result.result.core.user_results.result.rest_id;
        authorName = payload.result.retweeted_status_result.result.core.user_results.result.core.name;
    }

    const createdTimeRaw = tweetResultValue.result.legacy.created_at;
    const createdTime = new Date(createdTimeRaw).getTime();

    const entry_rowkey = generateKey(parseInt(String(createdTime)), postId);
    if (!entry_rowkey) {
        return;
    }

    const tweetData: XPostData = {
        url: `https://x.com/${userName}/status/${postId}`,
        source_type: "",
        tags: [] as any[],
        _tags: [] as any[],
        owner_id: ownerId,
        owner_name: ownerName,
        author_id: authorId,
        author_name: authorName,
        created_time: createdTime,
        updated_time: createdTime,
        inserted_time: Date.now(),
        tenant_ids: [],
        post_id: postId,
        entry_rowkey: entry_rowkey,
        category_info: [] as any[],
        content: tweetResultValue.result.legacy.full_text,
        view_count: tweetResultValue.result.views?.count ? parseInt(tweetResultValue.result.views.count) : 0,
        share_count: tweetResultValue.result.legacy?.retweet_count ? parseInt(tweetResultValue.result.legacy.retweet_count) : 0,
        comment_count: tweetResultValue.result.legacy?.reply_count ? parseInt(tweetResultValue.result.legacy.reply_count) : 0,
        reaction_count: tweetResultValue.result.legacy?.favorite_count ? parseInt(tweetResultValue.result.legacy.favorite_count) : 0,
        title: "",
        type: "post",
        docType: "Post",
        crawler_system: "extension",
        _tenants: [] as any[],
        attachments: [] as XAttachment[],
        channel_name: "twitter",
        description: ""
    }

    // Attachements
    const medias = tweetResultValue.result.legacy.entities?.media;
    if (Array.isArray(medias)) {
        for (const media of medias) {
            const mediaType = media.type; // photo, video, animated_gif
            const mediaExtension = media.media_url_https.split(".").pop()?.split("?")[0] || "";
            const attachment: XAttachment = {
                url: media.media_url_https,
                ratio: "",
                entry_id: "",
                width: media.original_info?.width || 0,
                height: media.original_info?.height || 0,
                target_id: "",
                duration: "",
                type: mediaType.toLowerCase() === "video" ? "video" : "photo",
                target_url: "",
                description: "",
                format: mediaExtension
            }
            tweetData.attachments.push(attachment);

            const imageData: XAttachment = {
                docType: mediaType.toLowerCase() === "video" ? "Video" : "Photo",
                image_type: "photo",
                url: media.media_url_https,
                media_url: media.media_url_https,
                post_id: postId,
                entry_rowkey: entry_rowkey,
                channel_name: "twitter",
                created_time: tweetData.created_time,
                updated_time: tweetData.updated_time,
            }
            attachmentArray.push(imageData);
        }
    }

    postArray.push(tweetData);
}

export function parsePostData(
    payload: any
): Result<{
    postArray: XPostData[];
    commentArray: XCommentData[];
    attachmentArray: XAttachment[];
}> {
    const postArray: XPostData[] = [];
    const commentArray: XCommentData[] = [];
    const attachmentArray: XAttachment[] = [];

    try {
        const tweetResultsObjects = [
            ...findAllKeyValuePairs(payload, "tweet_results"),
            ...findAllKeyValuePairs(payload, "tweetResult")
        ];

        for (const tweetResult of tweetResultsObjects) {
            parseXDataRecursively(tweetResult.value, postArray, commentArray, attachmentArray);
        }

        return {
            ok: true,
            data: {
                postArray: postArray,
                commentArray: commentArray,
                attachmentArray: attachmentArray
            }
        };
    } catch (error: any) {
        console.error(
            "Error (X Posts data parser)",
            error.message
        );
        return { ok: false, error: new Error("Failed to parse X post data") };
    }
}