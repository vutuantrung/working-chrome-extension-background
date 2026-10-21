import { Result, TiktokImageData, TiktokPostData, TiktokUserProfileData } from "../types";
import { generateKey } from "./utils";

export function parseDataPost(
  dataArr: { data: any, getMethod: string }[] = [],
  extra: any = {},
): Result<{
  tiktokPostData: TiktokPostData[],
  tiktokImageData: TiktokImageData[],
  userProfiles: TiktokUserProfileData[],
}> {

  const postDataArray: TiktokPostData[] = [];
  const imageDataArray: TiktokImageData[] = [];
  const userProfileArray: TiktokUserProfileData[] = [];

  try {
    if (!Array.isArray(dataArr) || dataArr.length === 0) {
      return { ok: false, error: new Error("Invalid data format") };
    }
    // 1. parse post data
    for (const { data: dataJSON } of dataArr) {
      if (dataJSON === null) continue;
      if (!dataJSON?.id) continue;

      const url = "https://www.tiktok.com/@" + dataJSON.author.id + "/video/" + dataJSON.video.id;
      const createTime = dataJSON.createTime.toString().length === Date.now().toString().length
        ? parseInt(String(dataJSON.createTime))
        : parseInt(String(dataJSON.createTime)) * 1000;

      const entry_rowkey = generateKey(createTime, dataJSON.video.id);
      if (!entry_rowkey) {
        continue;
      }

      const postData: TiktokPostData = {
        url: url,
        source_type: "",
        tags: [],
        _tags: [],
        inserted_time: Date.now(),
        updated_time: createTime,
        created_time: createTime,
        tenant_ids: [],
        transcription: "",
        owner_id: dataJSON.author.id,
        owner_name: dataJSON.author.nickname,
        author_id: dataJSON.author.id,
        author_name: dataJSON.author.nickname,
        post_id: dataJSON.video.id,
        entry_rowkey: entry_rowkey,
        category_info: [],
        description: dataJSON.desc,
        content: dataJSON.desc,
        title: dataJSON.desc,
        reaction_count: dataJSON.stats.diggCount,
        share_count: dataJSON.stats.shareCount,
        comment_count: dataJSON.stats.commentCount,
        view_count: dataJSON.stats.playCount,
        type: "post",
        docType: "Post",
        _tenants: [],
        collect_count: 0,
        attachments: [] as any,
        channel_name: "tiktok",
        crawler_system: "extension",
      };

      const photo = {
        docType: "Photo",
        type: "photo",
        url: dataJSON.video.cover,
      };

      const video = {
        docType: "Video",
        type: "video",
        url: url,
        width: dataJSON.video.width,
        height: dataJSON.video.height,
        ratio: dataJSON.video.ratio,
        entry_id: dataJSON.video.id,
        target_id: "",
        target_url: "",
        duration: dataJSON.video.duration,
        description: dataJSON.desc,
        format: dataJSON.video.format,
      };

      const music = {
        docType: "Music",
        type: "video",
        url:
          dataJSON.music.coverLarge ||
          dataJSON.music.coverMedium ||
          dataJSON.music.coverThumb,
        ratio: "",
        width: "",
        height: "",
        entry_id: dataJSON.music.id,
        target_id: "",
        target_url: "",
        duration: dataJSON.music.duration,
        description: dataJSON.music.title,
        format: "",
      };

      postData.attachments = [photo, video, music];
      postDataArray.push(postData);

      const imgData: TiktokImageData = {
        docType: "Photo",
        image_type: "photo",
        url: dataJSON.video.cover,
        media_url: dataJSON.video.cover,
        post_id: dataJSON.video.id,
        entry_rowkey: entry_rowkey,
        channel_name: "tiktok",
        created_time: createTime,
        updated_time: createTime,
      };
      imageDataArray.push(imgData);

      const stats = dataJSON.authorStatsV2 || dataJSON.authorStats || {};
      const userCreateTime = !dataJSON.createTime
        ? null
        : dataJSON.createTime.toString().length === Date.now().toString().length
          ? parseInt(String(dataJSON.createTime))
          : parseInt(String(dataJSON.createTime)) * 1000;
      const userProfileData: TiktokUserProfileData = {
        // statsV2
        videosCount: stats.videosCount ?? "0",
        followingCount: stats.followingCount ?? "0",
        followerCount: stats.followerCount ?? "0",
        heartCount: stats.heart ?? "0",
        diggCount: stats.diggCount ?? "0",
        friendCount: stats.friendCount ?? "0",
        // user
        url: `https://tiktok.com/@${dataJSON.author.id}`,
        portia_spider: "",
        id: dataJSON.author.id,
        avatar: dataJSON.author.avatarLarger || dataJSON.author.avatarMedium || dataJSON.author.avatarThumb,
        social_id: dataJSON.author.id,
        profile_id: dataJSON.author.id,
        name: dataJSON.author.nickname,
        uniqueId: dataJSON.author.uniqueId,
        privateAccount: dataJSON.author.privateAccount,
        verified: dataJSON.author.verified,
        signature: dataJSON.author.signature,
        secUid: dataJSON.author.secUid,
        created_time: userCreateTime,
        "@timestamp": userCreateTime ? new Date(userCreateTime).toISOString() : null,
        // others
        activity: true,
        social_site: "tiktok",
        description: "",
        type: "person",
        main_page: "",
        channel_name: "tiktok",
        is_active: true,
        seed_url: "",
        is_vip: false,
        docType: "Profile",
        active: true,
        source_type: "",
        tenant_ids: [],
        ttl: 0,
        created_by: 1,
        domain: "tiktok.com",
        phone: "",
        region: extra?.region || "",
        locations: [],
        entry_rowkey: dataJSON.author.id
      };
      userProfileArray.push(userProfileData);
    }

    // 3. return data
    return {
      ok: true,
      data: {
        userProfiles: userProfileArray,
        tiktokPostData: postDataArray,
        tiktokImageData: imageDataArray
      },
    };
  } catch (error: any) {
    console.error("Error (Tiktok Posts parser)", error.message);
    return { ok: false, error: new Error("Failed to parse TikTok post data") };
  }
}
