import { findAllKeyValuePairs } from "../facebook-parser/utils";
import { generateKey, parseThreadsPostsInfo, THREADS_POST_INFO_KEY } from "./utils";
import { Result, ThreadsAttachment, ThreadsCommentData, ThreadsPostData, ThreadsPostLocalStorageInfo } from "../types";
import { getStorageByKeys } from "@/entrypoints/background/services/storageServices";

async function parseThreadsDataRecursively(
    payload: any,
    requestPostData: any,
    postArray: ThreadsPostData[],
    commentArray: ThreadsCommentData[],
    attachmentArray: ThreadsAttachment[],
    cachedPostInfo: ThreadsPostLocalStorageInfo[] = [],
): Promise<void> {

    // console.log(">>>>>> parseThreadsDataRecursively - postData:", requestPostData);

    // Treat post data
    let currentPostKey = null;
    const decodedPostData = decodeURIComponent(requestPostData);
    const postDataComponents = decodedPostData.split("&");
    for (const component of postDataComponents) {
        if (!component.startsWith("variables=")) continue;
        const jsonPart = component.replace("variables=", "");
        const jsonData = JSON.parse(jsonPart);
        currentPostKey = jsonData?.postID || null;
    }
    const threadsResultValue = payload;

    const isPostReply = threadsResultValue.text_post_app_info.is_reply;
    const threadId = threadsResultValue?.id;
    const threadKey = threadsResultValue?.pk;
    const threadCode = threadsResultValue?.code;
    if (!threadId || !threadCode || !threadsResultValue.user) {
        return;
    }

    const ownerId = threadsResultValue.user.id;
    const ownerName = threadsResultValue.user.full_name;
    const ownerUsername = threadsResultValue.user.username;

    let authorId = ownerId, authorName = ownerName, authorUsername = ownerUsername;
    // threadsResultValue?.text_post_app_info.share_info.reposted_post
    // threadsResultValue?.text_post_app_info.share_info.quoted_post
    const resharedPost =
        threadsResultValue?.text_post_app_info.share_info.quoted_post ||
        threadsResultValue?.text_post_app_info.share_info.reposted_post;
    if (resharedPost) {
        await parseThreadsDataRecursively(resharedPost, requestPostData, postArray, commentArray, attachmentArray, cachedPostInfo);
        authorId = resharedPost.user.id;
        authorName = resharedPost.user.full_name;
        authorUsername = resharedPost.user.username;
    }

    const createTime = payload.taken_at.toString().length === Date.now().toString().length
        ? parseInt(String(payload.taken_at))
        : parseInt(String(payload.taken_at)) * 1000;

    const entry_rowkey = generateKey(parseInt(String(createTime)), threadId);
    if (!entry_rowkey) {
        return;
    }

    if (!isPostReply) {
        // post data
        const shareCount = threadsResultValue.text_post_app_info.reshare_count ? parseInt(threadsResultValue.text_post_app_info.reshare_count) : 0;
        const commentCount = threadsResultValue.text_post_app_info.direct_reply_count ? parseInt(threadsResultValue.text_post_app_info.direct_reply_count) : 0
        const reactionCount = threadsResultValue.like_count ? parseInt(threadsResultValue.like_count) : 0;

        const postData: ThreadsPostData = {
            url: `https://www.threads.com/t/${threadCode}`,
            source_type: "",
            tags: [] as any[],
            _tags: [] as any[],
            owner_id: "t" + ownerId,
            owner_name: ownerName ? ownerName : ownerUsername,
            owner_username: ownerUsername,
            author_id: "t" + authorId,
            author_name: authorName ? authorName : authorUsername,
            author_username: authorUsername,
            created_time: createTime,
            updated_time: createTime,
            inserted_time: Date.now(),
            tenant_ids: [],
            post_id: threadId,
            entry_rowkey: entry_rowkey,
            category_info: [] as any[],
            content: threadsResultValue.caption?.text,
            view_count: 0,
            share_count: shareCount,
            comment_count: commentCount,
            reaction_count: reactionCount,
            title: "",
            type: "post",
            docType: "Post",
            crawler_system: "extension",
            _tenants: [] as any[],
            attachments: [] as ThreadsAttachment[],
            channel_name: "threads",
            description: ""
        }

        // post attachments
        const medias = threadsResultValue.carousel_media
            ? threadsResultValue.carousel_media
            : threadsResultValue.image_versions2.candidates.length > 0
                ? [{ image_versions2: threadsResultValue.image_versions2, video_versions: threadsResultValue.video_versions }]
                : []
        for (const media of medias) {
            const mediaType = media.video_versions ? "video" : "photo";
            const bestImageVersion = media.image_versions2?.candidates?.[0];
            const attachment: ThreadsAttachment = {
                url: bestImageVersion?.url || "",
                ratio: "",
                entry_id: "",
                width: bestImageVersion?.width || 0,
                height: bestImageVersion?.height || 0,
                target_id: "",
                duration: "",
                type: mediaType,
                target_url: "",
                description: "",
                format: ""
            }
            postData.attachments.push(attachment);

            const imageData: ThreadsAttachment = {
                docType: mediaType.toLowerCase() === "video" ? "Video" : "Photo",
                image_type: "photo",
                url: bestImageVersion?.url || "",
                media_url: bestImageVersion?.url || "",
                post_id: threadId,
                entry_rowkey: entry_rowkey,
                channel_name: "threads",
                created_time: postData.created_time,
                updated_time: postData.updated_time,
            }
            attachmentArray.push(imageData);
        }

        // post local storage info
        const postLocalStorageInfo: ThreadsPostLocalStorageInfo = {
            post_key: threadKey,
            profile_id: ownerId.replace("t", ""),
            full_name: ownerName ? ownerName : ownerUsername,
            username: ownerUsername,
        }
        // console.log("save new post localstorage:", postLocalStorageInfo);
        cachedPostInfo.push(postLocalStorageInfo);

        postArray.push(postData);
    }

    if (isPostReply && currentPostKey) {
        const postAuthorId = threadsResultValue.text_post_app_info.reply_to_author.id;
        // const postAuthorUsername = threadsResultValue.text_post_app_info.reply_to_author.username;
        const reactionCount = threadsResultValue.like_count ? parseInt(threadsResultValue.like_count) : 0;

        const originalPost = cachedPostInfo.find((post) => post.post_key === currentPostKey);
        if (!originalPost) {
            console.log("Original post not found in local storage for the comment. Post Key:", currentPostKey, "Author ID:", postAuthorId, "cachedPostInfo:", cachedPostInfo);
            return;
        }

        const originalPostId = originalPost.post_key + "_" + originalPost.profile_id;

        const commentData: ThreadsCommentData = {
            url: `https://www.threads.com/t/${threadCode}`,
            comment_rowkey: "822168198299915771562755034",
            comment_id: threadId,
            article_id: originalPostId,
            post_id: originalPostId,
            tags: [],
            _tags: [],
            hashtags: [],
            inserted_time: Date.now(),
            updated_time: createTime,
            created_time: createTime,
            parent_comment_id: "",
            reaction_count: reactionCount,
            category_info: [],
            owner_id: "t" + originalPost.profile_id.replace("t", ""),
            owner_name: originalPost.full_name,
            owner_username: originalPost.username,
            owner_type: "person",
            profile_id: "t" + ownerId.replace("t", ""),
            profile_name: ownerName ? ownerName : ownerUsername,
            profile_username: ownerUsername,
            _tenants: [],
            tenant_ids: [],
            docType: "Comment",
            comment: threadsResultValue.caption?.text,
            channel_name: "threads"
        }

        commentArray.push(commentData);
    }
}

export async function parsePostData(
    payload: any,
    requestPostData: any
): Promise<Result<{
    postArray: ThreadsPostData[];
    commentArray: ThreadsCommentData[];
    attachmentArray: ThreadsAttachment[];
}>> {
    const postArray: ThreadsPostData[] = [];
    const commentArray: ThreadsCommentData[] = [];
    const attachmentArray: ThreadsAttachment[] = [];

    try {
        // 1. Get all posts data
        const threadsPostsKeyValues = findAllKeyValuePairs(payload, "post");
        // console.log(">>>>>> parsePostData - threadsPostsObjects:", threadsPostsObjects.length);

        const localStoragePostInfo = await getStorageByKeys([THREADS_POST_INFO_KEY]);
        const threadsPostInfoStr = localStoragePostInfo[THREADS_POST_INFO_KEY] || "";
        const cachedPostInfo = parseThreadsPostsInfo(threadsPostInfoStr);
        // console.log(">>>>>> parsePostData - currentPostInfo from local storage:", cachedPostInfo);

        for (const { value: threadsPost } of threadsPostsKeyValues) {
            await parseThreadsDataRecursively(threadsPost, requestPostData, postArray, commentArray, attachmentArray, cachedPostInfo);
        }

        // 2. Get thread items in order to find relations between comments (parent/child)
        const threadsItemsKeyValues = findAllKeyValuePairs(payload, "thread_items");
        const threadsItemsPk = [];
        for (const { value: threadValues } of threadsItemsKeyValues) {
            const threadPostPk = threadValues.map((t: any) => t.post.pk);
            threadsItemsPk.push(threadPostPk);
        }

        for (const threadPkList of threadsItemsPk) {
            if (threadPkList.length === 1) continue;
            for (let i = 0; i < threadPkList.length - 1; i++) {
                const parentPk = threadPkList[i];
                const childPk = threadPkList[i + 1];
                const parentComment = commentArray.find(comment => comment.comment_id.includes(parentPk));
                const childComment = commentArray.find(comment => comment.comment_id.includes(childPk));
                if (parentComment && childComment) {
                    childComment.parent_comment_id = parentComment.comment_id;
                }
            }
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
            "Error (Threads Posts data parser)",
            error.message
        );
        // console.log(JSON.stringify(payload));
        return { ok: false, error: new Error("Failed to parse Threads post data") };
    }
}