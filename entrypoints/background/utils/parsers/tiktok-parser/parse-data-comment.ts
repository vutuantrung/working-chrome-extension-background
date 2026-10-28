import * as services from "../../../services";
import { Result, TiktokCommentData } from "../types";
import { parseTiktokPostInfo, TIKTOK_POST_INFO_KEY, generateKey } from "./utils";

export async function parseDataComment(
  dataArr: { data: any; getMethod: string }[] = [],
): Promise<Result<TiktokCommentData[]>> {
  try {
    if (!Array.isArray(dataArr) || dataArr.length === 0) {
      return { ok: false, error: new Error("Invalid data format") };
    }

    // 1. get owner info of posts from localstorage
    // format: postEntryRowkey|postId|ownerId|ownerName, split by comma for multiple records
    const localStoragePostOwner = await services.storageService.getStorageByKeys([TIKTOK_POST_INFO_KEY]);
    const tiktokPostsCached = localStoragePostOwner[TIKTOK_POST_INFO_KEY] || "";
    const tiktokPostsCachedArr = parseTiktokPostInfo(tiktokPostsCached);

    // 2. parse comment data (include owner info)
    const result = [];
    for (const { data: dataJSON } of dataArr) {
      const tiktokPostById = tiktokPostsCachedArr.find((o: any) => o.post_id === dataJSON.aweme_id);
      if (!tiktokPostById) {
        console.warn(`post info not found for comment ${dataJSON.cid}, post id: ${dataJSON.aweme_id}`);
        continue;
      }

      const createdTimeRaw = dataJSON.create_time;
      const createdTime =
        createdTimeRaw.toString().length === Date.now().toString().length
          ? parseInt(String(createdTimeRaw))
          : parseInt(String(createdTimeRaw)) * 1000;

      const comment_rowkey = generateKey(parseInt(String(createdTime)), dataJSON.cid);
      if (!comment_rowkey) {
        continue;
      }

      const commentData: TiktokCommentData = {
        entry_rowkey: tiktokPostById.entry_rowkey,
        comment_rowkey: comment_rowkey,
        comment_id: dataJSON.cid,
        source_type: "",
        tags: [],
        updated_time: createdTime,
        tenant_ids: [],
        inserted_time: Date.now(),
        post_id: dataJSON.aweme_id,
        parent_comment_id: dataJSON.reply_id,
        created_time: createdTime,
        reaction_count: dataJSON.digg_count,
        owner_id: tiktokPostById.owner_id || "",
        owner_name: tiktokPostById.owner_name || "",
        profile_id: dataJSON.user.uid,
        profile_name: dataJSON.user.nickname,
        docType: "Comment",
        _tenants: [],
        owner_type: "person",
        comment: dataJSON.text,
        channel_name: "tiktok",
      };

      result.push(commentData);
      // console.log("[commentData]", commentData);
    }
    return { ok: true, data: result };
  } catch (error: any) {
    console.error("Error (Tiktok Comments parser)", error.message);
    return {
      ok: false,
      error: new Error("Failed to parse TikTok comment data"),
    };
  }
}
