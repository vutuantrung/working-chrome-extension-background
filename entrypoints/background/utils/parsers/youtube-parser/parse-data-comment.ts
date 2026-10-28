import * as services from "../../../services";
import { findAllKeyValuePairs } from "../commons";
import { Result, YoutubeCommentData, YoutubePostData } from "../types";
import { findByKey, generateKey, parseVietnameseRelativeTime, parseYoutubePostsInfo, YOUTUBE_POST_INFO_KEY } from "./utils";

export async function parseCommentData(payload: string)
    : Promise<Result<{
        commentArray: YoutubeCommentData[];
        updatingPost: YoutubePostData | null
    }>> {
    try {
        const commentArray: YoutubeCommentData[] = [];
        let updatingPost: YoutubePostData | null = null;

        const data = JSON.parse(payload);
        const commentEntities = findAllKeyValuePairs(data, "commentEntityPayload");
        if (!commentEntities.length) {
            return { ok: false, error: new Error("No Youtube comment entity found") };
        }

        const postId = findByKey(data, "commentSurfaceEntityPayload")?.publishedTimeCommand.innertubeCommand.watchEndpoint.videoId ?? ""

        const localStoragePostOwner = await services.storageService.getStorageByKeys([YOUTUBE_POST_INFO_KEY]);
        const youtubePostsCached = localStoragePostOwner[YOUTUBE_POST_INFO_KEY] || "";
        const youtubePostsCachedArr = parseYoutubePostsInfo(youtubePostsCached);

        const youtubePostById = youtubePostsCachedArr.find(p => p.post_id === postId);
        if (!youtubePostById) {
            console.warn(`post info not found for comments, post id: ${postId}`);
            return { ok: false, error: new Error("Post info not found for comments") };
        }

        // Parse comments
        commentEntities.forEach(({ value }) => {
            const normalizedComment = normalizeCommentEntity(value);
            const commentRowKey = generateKey(postId, normalizedComment.comment_id)

            const newComment: YoutubeCommentData = {
                ...normalizedComment,
                post_id: postId,
                entry_rowkey: youtubePostById.entry_rowkey,
                comment_rowkey: commentRowKey,
                owner_id: youtubePostById.owner_id,
                owner_name: youtubePostById.owner_name
            }
            commentArray.push(newComment)
        })

        // Parse total comment
        const commentHeader = findByKey(data, "commentsHeaderRenderer")?.countText?.runs;
        if (Array.isArray(commentHeader)) {
            const commentTotal = commentHeader.map((item: { text: string }) => Number(item.text.replace(/[.,]/g, ""))).find(item => !Number.isNaN(item));
            if (commentTotal) {
                updatingPost = {
                    entry_rowkey: "",
                    post_id: postId,
                    comment_count: commentTotal,
                    docType: "Post",
                } as YoutubePostData;
            }
        }

        return {
            ok: true,
            data: {
                commentArray: commentArray,
                updatingPost: updatingPost,
            }
        }
    } catch (error: any) {
        console.error(
            "Error (Youtube Comment data parser)",
            error?.message
        );
        return { ok: false, error: new Error("Failed to parse Youtube comment data") };
    }
}

function normalizeCommentEntity(data: any): YoutubeCommentData {
    let parentCommentId = "";
    let commentId = data.properties.commentId
    const idParts: string[] = data.properties.commentId.split('.')
    if (idParts.length > 1) {
        parentCommentId = idParts[0]
    }

    const createdTime = parseVietnameseRelativeTime(data.properties.publishedTime) ?? 0

    return {
        entry_rowkey: "",
        comment_rowkey: "",
        post_id: "",
        owner_id: "",
        owner_name: "",
        comment_id: commentId,
        parent_comment_id: parentCommentId,
        source_type: "",
        tags: [],
        updated_time: createdTime,
        created_time: createdTime,
        inserted_time: Date.now(),
        reaction_count: Number(data.toolbar.likeCountNotliked) || 0,
        owner_type: "person",
        profile_id: data.author.channelId,
        profile_name: data.author.displayName,
        docType: "Comment",
        _tenants: [],
        tenant_ids: [],
        comment: data.properties.content.content,
        channel_name: "youtube"
    }
}
