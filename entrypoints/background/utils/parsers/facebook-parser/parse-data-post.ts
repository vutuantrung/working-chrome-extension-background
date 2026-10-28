import { findAllKeyValuePairs } from "../commons";
import { FacebookAttachment, FacebookCommentData, FacebookImageData, FacebookPostData, Result } from "../types";
import {
  deriveArticleId,
  extractDataFromPhotoAttachment,
  extractDataFromPhotoSubAttachment,
  extractDataFromProfileMediaAttachment,
  extractDataFromReelAttachment,
  extractDataFromVideoAttachment,
  extractDataFromVideoSubAttachment,
  extractReactionAndCommentCount,
  generatePostKey,
  generateCommentKey,
} from "./utils";

export async function parseDataPost(
  payload: any,
  attachementType: "photo" | "profileMedia" | "album" | "video" | "reel" | "text"
): Promise<Result<{
  postDataArray: FacebookPostData[];
  imageDataArray: FacebookImageData[];
  commentDataArray: FacebookCommentData[];
}>> {
  const postDataArray: FacebookPostData[] = [];
  const imageDataArray: FacebookImageData[] = [];
  const commentDataArray: FacebookCommentData[] = [];

  try {
    const root_data =
      payload?.["data"]?.["viewer"]?.["groups_tab"]?.["cross_group_feed"]?.["edges"]?.[0]?.["node"] ||
      payload?.["data"]?.["viewer"]?.["news_feed"]?.["edges"]?.[0]?.["node"] ||
      payload?.["data"]?.["node"]?.["timeline_list_feed_units"]?.["edges"]?.[0]?.["node"] ||
      payload?.["data"]?.["node"]?.["group_feed"]?.["edges"]?.[0]?.["node"] ||
      payload?.["data"]?.["node"] ||
      payload?.["data"]?.["node_v2"] ||
      payload?.["rendering_strategy"]?.["view_model"]?.["click_model"]?.["story"];

    if (!root_data || !root_data?.["post_id"]) {
      return { ok: false, error: new Error("Post not found") };
    }

    const post_id = root_data["post_id"];

    //////////// POST ////////////
    // sections
    const rootDataString = JSON.stringify(root_data);
    const comet_sections_content = root_data?.["comet_sections"]?.["content"];
    const comet_sections_context_layout = root_data?.["comet_sections"]?.["context_layout"];
    const comet_sections_feedback = root_data?.["comet_sections"]?.["feedback"];

    const targetGroup = comet_sections_content?.["story"]?.["target_group"];
    const group_id = targetGroup?.["id"] ?? "";
    const group_name =
      comet_sections_context_layout?.["story"]?.["comet_sections"]?.["actor_photo"]?.["story"]?.["to"]?.["name"] ||
      comet_sections_context_layout?.["story"]?.["comet_sections"]?.["title"]?.["story"]?.["to"]?.["name"] ||
      "";

    const publish_time =
      parseInt(comet_sections_context_layout?.["story"]?.["comet_sections"]?.["timestamp"]?.["story"]?.["creation_time"]) ||
      parseInt(comet_sections_context_layout?.["story"]?.["comet_sections"]?.["metadata"]?.find((e: any) => e["story"]["creation_time"])?.["story"]?.["creation_time"]) ||
      parseInt(comet_sections_content?.["story"]?.["comet_sections"]?.["context_layout"]?.["story"]?.["comet_sections"]?.["metadata"]?.[0]?.["story"]?.["creation_time"]) ||
      parseInt(rootDataString.slice(
        rootDataString.indexOf("'creation_time': ") + 17,
        rootDataString.indexOf(",", rootDataString.indexOf("'creation_time': ")),
      ), 10) ||
      (() => {
        const m = rootDataString.match(/'creation_time': (.*?),/);
        return m ? parseInt(m[1], 10) : -1;
      })() ||
      -1;

    const actor = comet_sections_context_layout?.["story"]?.["comet_sections"]?.["actor_photo"]?.["story"]?.["actors"]?.[0];
    const actor_name = actor?.["name"] ?? "";
    const actor_id = actor?.["id"] ?? "";
    const tmp_actor_type = actor?.["__typename"]
      ? actor["__typename"].toLowerCase()
      : "";
    const actor_type = (tmp_actor_type === "user" ? "person" : tmp_actor_type) ?? "";

    // page
    const createdTimeMilisecond =
      publish_time.toString().length === Date.now().toString().length
        ? parseInt(String(publish_time))
        : parseInt(String(publish_time)) * 1000;
    const receiver_id = group_id ? group_id : actor_id;
    const combinedPostId = `${receiver_id}_${post_id}`;
    const article_id = deriveArticleId(combinedPostId);
    const entryRowkey = generatePostKey(parseInt(String(createdTimeMilisecond)), combinedPostId);
    if (!entryRowkey) {
      // dataStringArr[i] = null as any;
      // continue;
      return { ok: false, error: new Error("Failed to generate entry rowkey") };
    }

    // owner type
    let owner_type = "group";
    if (targetGroup) {
      const metadata = comet_sections_context_layout?.["story"]?.["comet_sections"]?.["metadata"];
      if (Array.isArray(metadata) && metadata) {
        const metaDataItem = metadata.find(
          (e: any) => e["__typename"] === "CometFeedStoryAudienceStrategy",
        );
        if (metaDataItem) {
          const description = metaDataItem?.["story"]?.["privacy_scope"]?.["description"]?.toLowerCase();
          if (description === "private group") {
            owner_type = "private_group";
          } else {
            owner_type = "group";
          }
        }
      }
    } else {
      const delegatePage = actor?.["delegate_page"];
      if (delegatePage) {
        owner_type = "fanpage";
      } else {
        owner_type = "person";
      }
    }

    // attachments & content
    const atts: FacebookAttachment[] = [];
    let medias: string[] = [];
    let _type = "text";
    // let share_title = "";
    // let share_description = "";
    let link = "";
    let message: any = "";

    const attachments = comet_sections_content?.["story"]?.["attachments"];
    const style_list = comet_sections_content?.["story"]?.["attachments"]?.[0]?.["style_list"];

    if (Array.isArray(style_list)) {
      // share
      if (style_list.includes("share")) {
        _type = "share";
        const uri =
          attachments?.[0]?.["styles"]?.["attachment"]?.["media"]?.["large_share_image"]?.["uri"] ||
          attachments?.[0]?.["styles"]?.["attachment"]?.["media"]?.["image"]?.["uri"] ||
          attachments?.[0]?.["styles"]?.["attachment"]?.["media"]?.["cropped_image"]?.["uri"] ||
          "";
        if (uri) medias.push(uri);
        // share_title = attachments?.[0]?.["comet_footer_renderer"]?.["attachment"]?.["title_with_entities"]?.["text"];
        // share_description = comet_sections_content?.["story"]?.["comet_sections"]?.["message_container"]?.["story"]?.["message"]?.["text"];
        link = attachments?.[0]?.["styles"]?.["attachment"]?.["story_attachment_link_renderer"]?.["attachment"]?.["web_link"]?.["url"] ?? link;
      }

      // group_sell_product_item
      if (style_list.includes("group_sell_product_item")) {
        _type = "sell";
        message = comet_sections_content?.["story"]?.["comet_sections"]?.["message"]?.["story"]?.["message"]?.["text"] ?? message;
        const nodes = attachments?.[0]?.["styles"]?.["attachment"]?.["all_subattachments"]?.["nodes"];
        if (Array.isArray(nodes)) {
          for (const node of nodes) {
            const uri = node?.["media"]?.["image"]?.["uri"];
            if (uri) medias.push(uri);
          }
        }
      }

      // avatar
      if (style_list.includes("group") && style_list.includes("avatar")) {
        _type = "share";
        message = comet_sections_content?.["story"]?.["comet_sections"]?.["message_container"]?.["story"]?.["message"]?.["text"] ?? message;
        const uri = attachments?.[0]?.["styles"]?.["cover_photo"]?.["photo"]?.["image"]?.["uri"];
        if (uri) medias.push(uri);
      }
    }

    // photo
    if (attachementType === "photo") {
      _type = "photo";
      const allAttachments = findAllKeyValuePairs(root_data, "attachments");
      for (const att of allAttachments) {
        for (const attValue of att.value) {
          if (attValue?.styles?.__typename !== "StoryAttachmentPhotoStyleRenderer")
            continue;

          let dateExtracted = extractDataFromPhotoAttachment(attValue);
          if (dateExtracted) {
            atts.push(dateExtracted);
          }
        }
      }
    }

    // profile media
    if (attachementType === "profileMedia") {
      _type = "share";
      const allAttachments = findAllKeyValuePairs(root_data, "attachments");
      for (const att of allAttachments) {
        for (const attValue of att.value) {
          if (attValue?.styles?.__typename !== "StoryAttachmentProfileMediaStyleRenderer")
            continue;
          if (!attValue?.target?.id) continue;
          atts.push(extractDataFromProfileMediaAttachment(attValue));
        }
      }
    }

    // album
    if (attachementType === "album") {
      _type = "album";
      const allAttachments = findAllKeyValuePairs(root_data, "attachments");
      for (const att of allAttachments) {
        for (const attValue of att.value) {
          if (attValue?.styles?.__typename !== "StoryAttachmentAlbumStyleRenderer")
            continue;

          const nodes = attValue?.["styles"]?.["attachment"]?.["all_subattachments"]?.["nodes"];
          for (const node of nodes) {
            const typeName = node.media.__typename;
            if (typeName === "Photo")
              atts.push(extractDataFromPhotoSubAttachment(node));
            if (typeName === "Video")
              atts.push(extractDataFromVideoSubAttachment(node));
          }
        }
      }
    }

    // video
    if (attachementType === "video") {
      _type = "video";
      const allAttachments = findAllKeyValuePairs(root_data, "attachments");
      const curAtts: FacebookAttachment[] = [];
      for (const att of allAttachments) {
        for (const attValue of att.value) {
          if (attValue?.styles?.__typename !== "StoryAttachmentVideoStyleRenderer")
            continue;
          curAtts.push(extractDataFromVideoAttachment(attValue));
        }
      }

      if (curAtts.length >= 2) {
        for (let i = 0; i < curAtts.length; i++) {
          const existingVideo = atts.find(
            (e) =>
              e.url === curAtts[i].url &&
              e.width === curAtts[i].width &&
              e.height === curAtts[i].height &&
              e.thumbnails === curAtts[i].thumbnails,
          );
          if (existingVideo) continue;
          atts.push(curAtts[i]);
        }
      }
    }

    // reel
    if (attachementType === "reel") {
      _type = "reel";
      const allAttachments = findAllKeyValuePairs(root_data, "attachments");
      for (const att of allAttachments) {
        for (const attValue of att.value) {
          if (attValue?.styles?.__typename !== "StoryAttachmentFBReelsStyleRenderer")
            continue;

          const stylesInfo = attValue.styles.attachment?.style_infos ?? [];
          for (const styleInfo of stylesInfo) {
            if (styleInfo?.__typename !== "FBShortsShareAttachmentStyleInfo")
              continue;
            let dateExtracted = extractDataFromReelAttachment(attValue);
            if (dateExtracted) {
              atts.push(dateExtracted);
            }
          }
        }
      }
      link = atts?.[0]?.url ?? "";
    }

    const attached_story =
      comet_sections_content?.story?.comet_sections?.attached_story?.story?.attached_story?.comet_sections?.attached_story_layout?.story ||
      comet_sections_content?.story?.attached_story ||
      comet_sections_content?.story;
    message =
      attached_story?.message?.text ||
      attached_story?.comet_sections?.message_container?.story?.message?.text ||
      attached_story?.comet_sections?.message?.story?.message?.text ||
      (typeof message === "object" ? message?.text : message);

    // reactions
    let share_count = null;
    let comment_count = null;
    let reaction_count = null;
    // let top_reaction: any[] = [];
    const feedback_ufi =
      comet_sections_feedback?.["story"]?.["story_ufi_container"]?.["story"]?.["feedback_context"]?.["feedback_target_with_context"]?.["comet_ufi_summary_and_actions_renderer"]?.["feedback"];
    if (feedback_ufi) {
      const extractionReactionResult = extractReactionAndCommentCount(feedback_ufi);
      share_count = extractionReactionResult.shareCount;
      comment_count = extractionReactionResult.commentCount;
      reaction_count = extractionReactionResult.reactionCount;
    }

    const receiver_name = group_name ? group_name : actor_name;
    const post_url =
      comet_sections_context_layout?.["story"]?.["comet_sections"]?.["metadata"]?.[1]?.["story"]?.["url"] ??
      "https://www.facebook.com/" + `${receiver_id}_${post_id}`;

    const postData: FacebookPostData = {
      post_id: combinedPostId,
      article_id,
      profile_id: receiver_id,
      owner_id: receiver_id,
      owner_name: receiver_name,
      author_id: actor_id,
      author_name: actor_name,
      channel_name: "facebook",
      docType: "Post",
      entry_rowkey: entryRowkey,
      description: "",
      hashtags: [],
      story: "",
      title: "",
      tags: [],
      tenant_ids: [],
      _tenants: [],
      type: actor_type,
      owner_type: owner_type,
      category_info: [],
      created_time: createdTimeMilisecond,
      updated_time: createdTimeMilisecond,
      _tags: [],
      url: post_url,
      content: message,
      view_count: 0,
      colect_count: 0,
      share_count: share_count,
      reaction_count: reaction_count,
      comment_count: comment_count,
      attachments: atts,
      source_type: "",
      crawler_system: "extension"
    };
    postDataArray.push(postData);
    console.log("[Facebook Post Parser] Parsed post data for post id:", post_id);


    //////////// PHOTOS ////////////
    for (let i = 0; i < postData.attachments.length; i++) {
      const attachment = postData.attachments[i];
      const common = {
        post_id: postData.post_id,
        created_time: postData["created_time"],
        updated_time: postData["updated_time"],
        tenant_ids: postData["tenant_ids"],
        entry_rowkey: postData["entry_rowkey"],
        channel_name: postData["channel_name"],
      };
      if (attachment.type === "photo") {
        imageDataArray.push({
          docType: "Photo",
          image_type: "photo",
          url: attachment.url,
          media_url: attachment.url,
          article_id: postData.article_id,
          ...common,
        });
      }

      if (attachment.type === "video") {
        imageDataArray.push({
          docType: "Video",
          image_type: "photo",
          url: attachment.thumbnails as string,
          media_url: attachment.thumbnails as string,
          article_id: postData.article_id,
          ...common,
        });
      }
    }

    //////////// COMMENTS ////////////
    const edgesComments =
      payload?.['data']?.['node_v2']?.['comet_sections']?.['feedback']?.['story']?.['story_ufi_container']?.['story']?.['feedback_context']?.['feedback_target_with_context']?.['comment_list_renderer']?.['feedback']?.['comment_rendering_instance_for_feed_location']?.['comments']?.["edges"] ||
      payload?.['data']?.['node']?.['comment_rendering_instance_for_feed_location']?.['comments']?.["edges"] ||
      payload?.['data']?.['node']?.['replies_connection']?.['edges'];

    if (Array.isArray(edgesComments)) {
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
          article_id: article_id,
          entry_rowkey: postData.entry_rowkey,
          comment_rowkey: comment_rowkey,
          comment_id: commentId,
          parent_comment_id: parentCommentId,
          source_type: "",
          _tags: [],
          updated_time: createdTime,
          tenant_ids: [],
          inserted_time: Date.now(),
          created_time: createdTime,
          post_id: postData.post_id,
          owner_id: postData.owner_id || "",
          owner_name: postData.owner_name || "",
          owner_type: postData.owner_type || "",
          profile_id: cmtDataNode?.['author']?.['id'],
          profile_name: cmtDataNode?.['author']?.['name'],
          reaction_count: reactionCount,
          docType: "Comment",
          _tenants: [],
          comment: cmtDataNode?.['body']?.['text'],
          channel_name: "facebook",
        };

        commentDataArray.push(commentData);
        // console.log("[commentData]", commentData);
      }
    }

    return {
      ok: true,
      data: {
        postDataArray: postDataArray,
        imageDataArray: imageDataArray,
        commentDataArray: commentDataArray
      }
    };
  } catch (error: any) {
    console.error(
      "Error (Facebook Posts data parser)",
      error.message
    );
    return { ok: false, error: new Error("Failed to parse Facebook post data") };
  }
}