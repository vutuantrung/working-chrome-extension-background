import { FACEBOOK_POST_INFO_KEY, generateCommentKey, parseToPostLocalStorage } from "./utils";
import { FacebookCommentData, Result } from "../types";
import * as services from "../../../services";

export async function parseDataComment(payload: any)
    : Promise<Result<FacebookCommentData[]>> {
    try {
        const edgesComments =
            payload?.['data']?.['node_v2']?.['comet_sections']?.['feedback']?.['story']?.['story_ufi_container']?.['story']?.['feedback_context']?.['feedback_target_with_context']?.['comment_list_renderer']?.['feedback']?.['comment_rendering_instance_for_feed_location']?.['comments']?.["edges"] ||
            payload?.['data']?.['node']?.['comment_rendering_instance_for_feed_location']?.['comments']?.["edges"] ||
            payload?.['data']?.['node']?.['replies_connection']?.['edges'];

        // 0. treate data
        if (!Array.isArray(edgesComments) || edgesComments.length === 0) {
            // console.warn("No comments found in the data");
            return { ok: false, error: new Error("No comments found in the data") };
        }

        let commentPostId = payload?.['data']?.['node_v2']?.['post_id'];
        if (!commentPostId) {
            const commentPostIdObj = edgesComments[0]?.['node']?.['feedback']?.['plugins']?.find((p: any) => typeof p?.['post_id'] === "string");
            commentPostId = commentPostIdObj?.['post_id'] || "";
        }
        if (!commentPostId) {
            console.warn("Post ID not found for comments");
            return { ok: false, error: new Error("Post ID not found for comments") };
        }

        // 1. get owner info of posts from localstorage
        const localStoragePostOwner = await services.storageService.getStorageByKeys([FACEBOOK_POST_INFO_KEY]);
        const cachedPostArray = parseToPostLocalStorage(localStoragePostOwner[FACEBOOK_POST_INFO_KEY] || "");

        const cachedPost = cachedPostArray.find((o) => o.post_id === commentPostId);
        if (!cachedPost) {
            console.warn(`Post info not found for comment article id: ${commentPostId}`);
            return { ok: false, error: new Error(`Post info not found for comment article id: ${commentPostId}`) };
        }
        // console.log("[Facebook Comment Parser] Found comment data for article id:", commentPostId, " - Cached post info:", cachedPost);

        // 2. parse comment data (include owner info)
        const result = [];
        for (const cmtData of edgesComments) {
            const cmtDataNode = cmtData.node;

            // comment id
            const nodeId = cmtDataNode?.id;
            if (!nodeId) {
                continue;
            }
            const commentId = atob(nodeId)?.replace("comment:", "") || "";
            if (!commentId) {
                continue;
            }

            // created time
            const createdTimeRaw = cmtDataNode?.['created_time'];
            const createdTime = createdTimeRaw.toString().length === Date.now().toString().length
                ? parseInt(String(createdTimeRaw))
                : parseInt(String(createdTimeRaw)) * 1000;

            // entry rowkey
            const comment_rowkey = generateCommentKey(parseInt(String(createdTime)), commentId);
            if (!comment_rowkey) {
                continue;
            }

            // parent comment id
            let parentCommentId = "";
            const commentDirectParent = cmtDataNode?.['comment_direct_parent'];
            if (commentDirectParent) {
                parentCommentId = commentDirectParent.id;
            }

            // reaction count
            const countVal = cmtDataNode?.['feedback']?.['reactors']?.['count_reduced']
            const reactionCount = countVal ? parseInt(countVal) : 0;

            const commentData: FacebookCommentData = {
                article_id: commentPostId,
                entry_rowkey: cachedPost.entry_rowkey,
                comment_rowkey: comment_rowkey,
                comment_id: commentId,
                parent_comment_id: parentCommentId,
                source_type: "",
                _tags: [],
                updated_time: createdTime,
                tenant_ids: [],
                inserted_time: Date.now(),
                created_time: createdTime,
                post_id: cachedPost.post_id,
                owner_id: cachedPost.owner_id || "",
                owner_name: cachedPost.owner_name || "",
                owner_type: cachedPost.owner_type || "",
                profile_id: cmtDataNode?.['author']?.['id'],
                profile_name: cmtDataNode?.['author']?.['name'],
                reaction_count: reactionCount,
                docType: "Comment",
                _tenants: [],
                comment: cmtDataNode?.['body']?.['text'],
                channel_name: "facebook",
            };

            result.push(commentData);
            // console.log("[commentData]", commentData);
        }

        return { ok: true, data: result };
    } catch (error: any) {
        console.error(
            "Error (Facebook Comments parser)",
            error.message
        );
        return { ok: false, error: new Error("Failed to parse Facebook comment data") };
    }
}