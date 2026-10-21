// THREADS
export type ThreadsUserFollowData = {
  follow_id: string;
  follow_rowkey: string;
  follower_id: string;
  follower_name: string;
  follower_url: string;
  follower_avatar: string;
  followed_id: string | null;
  followed_name: string | null;
  entry_rowkey: string;
  source_type: string;
  updated_time: number;
  inserted_time: number;
  created_time: number;
  type: string;
  docType: string;
  channel_name: string;
};
export type ThreadsUserProfileData = {
  entry_rowkey: string;
  follower_count: number;
  view_count: number;
  profile_id: string;
  social_id: string;
  docType: string;
  type: string;
  profile_pic_url: string;
  created_time: number;
  inserted_time: number;
  username: string;
  name: string;
  url: string;
  channel_name: string;
  is_verified: boolean;
  active: boolean;
  crawler_system: string;
};
export type ThreadsPostData = {
  entry_rowkey: string;
  post_id: string;
  url: string;
  source_type: string;
  tags: any[];
  _tags: any[];
  tenant_ids: string[];
  inserted_time: number;
  created_time: number;
  updated_time: number;
  owner_id: string;
  owner_name: string;
  owner_username: string;
  author_id: string;
  author_name: string;
  author_username: string;
  view_count: number;
  share_count: number;
  comment_count: number;
  reaction_count: number;
  category_info: any[];
  content: string;
  title: string;
  type: string;
  docType: string;
  crawler_system: string;
  _tenants: any[];
  attachments: XAttachment[];
  channel_name: string;
  description: string;
};
export type ThreadsAttachment = {
  type?: string;
  url: string;
  height?: number;
  width?: number;
  [key: string]: any;
};
export type ThreadsUserLocalStorageInfo = {
  profile_id: string;
  username: string;
  full_name: string;
  profile_pic_url: string;
};
export type ThreadsPostLocalStorageInfo = {
  post_key: string;
  profile_id: string;
  full_name: string;
  username: string;
};
export type ThreadsCommentData = {
  url: string;
  comment_rowkey: string;
  comment_id: string;
  article_id: string;
  tags: any[];
  owner_id: string;
  owner_name: string;
  owner_username: string;
  owner_type: string;
  profile_id: string;
  profile_name: string;
  profile_username: string;
  _tags: any[];
  hashtags: any[];
  inserted_time: number;
  updated_time: number;
  created_time: number;
  post_id: string;
  parent_comment_id: string;
  reaction_count: number;
  category_info: any[];
  docType: string;
  _tenants: [];
  tenant_ids: [];
  comment: string;
  channel_name: string;
};

export type ThreadsDataType =
  | ThreadsPostData
  | ThreadsAttachment
  | ThreadsUserProfileData
  | ThreadsUserFollowData;

// X Twitter
export type XUserLocalStorageInfo = {
  profile_id: string;
  user_name: string;
  profile_image_url: string;
  name: string;
};
export type XUserFollowData = {
  follow_id: string;
  follow_rowkey: string;
  follower_id: string;
  follower_name: string;
  follower_url: string;
  follower_avatar: string;
  entry_rowkey: string;
  followed_id: string;
  followed_name: string;
  source_type: string;
  updated_time: number;
  inserted_time: number;
  created_time: number;
  type: string;
  docType: string;
  channel_name: string;
};
export type XUserProfileData = {
  profile_image_url: string;
  profile_created_time: number;
  protected: boolean;
  docType: string;
  url: string;
  active: boolean; // ?
  profile_id: string; // ?
  hy_doc_id: string; // ?
  id: string; // ?
  id_str: string; // ?
  email: string; // ?
  about_account: any; // ?
  channel_name: string;
  created_time: number;
  "@timestamp": string;
  tenant_ids: string[];
  verified: boolean;
  user_name: string;
  description: string;
  created_at_text: string;
  media_count: number;
  followers_count: number;
  favourites_count: number;
  friends_count: number;
  statuses_count: number;
  name: string;
  entry_rowkey: string;
  type: string;
  avatar: string;
  profile_image_url_https: string;
  profile_banner_url: string;
  location: string;
  screen_name: string;
};
export type XPostData = {
  entry_rowkey: string;
  post_id: string;
  url: string;
  source_type: string;
  tags: any[];
  _tags: any[];
  tenant_ids: string[];
  inserted_time: number;
  created_time: number;
  updated_time: number;
  owner_id: string;
  owner_name: string;
  author_id: string;
  author_name: string;
  view_count: number;
  share_count: number;
  comment_count: number;
  reaction_count: number;
  category_info: any[];
  content: string;
  title: string;
  type: string;
  docType: string;
  crawler_system: string;
  _tenants: any[];
  attachments: XAttachment[];
  channel_name: string;
  description: string;
};
export type XAttachment = {
  type?: string;
  url: string;
  height?: number;
  width?: number;
  [key: string]: any;
};
export type XCommentData = {};

export type XDataType =
  | XPostData
  | XAttachment
  | XUserProfileData
  | XUserFollowData;

// Facebook
export type FacebookReactionData = {
  source_type: string;
  article_id: string;
  post_id: string;
  profile_url: string;
  profile_id: string;
  profile_name: string;
  owner_id: string;
  owner_name: string;
  owner_type: string;
  owner_ids: string[];
  reaction_rowkey: string;
  created_time: number;
  entry_rowkey: string;
  reaction_id: string;
  type: string;
  docType: string;
  _tenants: any[];
  tenant_ids: string[];
  tenants: string[];
  channel_name: string;
};
export type FacebookCommentData = {
  article_id: string;
  entry_rowkey: string;
  comment_rowkey: string;
  comment_id: string;
  source_type: string;
  _tags: string[];
  updated_time: number;
  inserted_time: number;
  post_id: string;
  parent_comment_id: string;
  created_time: number;
  reaction_count: number;
  owner_id: string;
  owner_name: string;
  owner_type: string;
  profile_id: string;
  profile_name: string;
  docType: string;
  _tenants: string[];
  tenant_ids: string[];
  comment: string;
  channel_name: string;
};
export type FacebookGroupJoinedData = {
  id: string;
  type: string;
  docType: string;
  status?: string;
  entry_rowkey?: string;
  name?: string;
  channel_name?: string;
  url?: string;
  crawled_time?: number;
  account_id?: string;
};
export type FacebookAttachment = {
  type: string;
  url: string;
  height?: string;
  width?: string;
  thumbnails?: string;
  [key: string]: any;
};
export type FacebookPostData = {
  post_id: string;
  article_id: string;
  owner_name: string;
  owner_id: string;
  owner_type: string;
  profile_id: string;
  channel_name: string;
  docType: string;
  entry_rowkey: string;
  author_id: string;
  author_name: string;
  description: string;
  hashtags: string[];
  story: string;
  title: string;
  tags: string[];
  tenant_ids: string[];
  _tenants: string[];
  _tags: string[];
  type: string;
  category_info: any[];
  created_time: number;
  updated_time: number;
  url: string;
  content: string;
  view_count: number;
  colect_count: number;
  share_count: number | null;
  reaction_count: number | null;
  comment_count: number | null;
  attachments: FacebookAttachment[];
  source_type: string;
  crawler_system: string;
};
export type FacebookImageData = {
  image_type: string;
  url: string;
  media_url: string;
  post_id: string;
  article_id: string;
  created_time: number;
  updated_time: number;
  tenant_ids: string[];
  entry_rowkey: string;
  channel_name: string;
  docType: string;
};
export type FacebookUserProfileData = {
  fbU: string;
  docType: string;
  entry_rowkey: string;
};
export type FacebookUserFollowData = {
  follow_id: string;
  follow_rowkey: string;
  follower_id: string;
  follower_name: string;
  follower_url: string;
  follower_avatar: string;
  followed_id: string;
  followed_name: string;
  entry_rowkey: string;
  source_type: string;
  updated_time: number;
  inserted_time: number;
  created_time: number;
  type: string;
  docType: string;
  channel_name: string;
  platform: string;
  collection_id?: string;
};
export type FacebookUserFriendData = {
  friend_id: string;
  friend_rowkey: string;
  user_id: string;
  user_name: string;
  user_url: string;
  user_avatar: string;
  friend_name: string;
  friend_url: string;
  friend_avatar: string;
  entry_rowkey: string;
  source_type: string;
  updated_time: number;
  inserted_time: number;
  created_time: number;
  type: string;
  docType: string;
  channel_name: string;
  platform: string;
  collection_id?: string;
};
export type FacebookPostLocalStorageInfo = {
  entry_rowkey: string;
  post_id: string;
  owner_id: string;
  owner_name: string;
  owner_type: string;
};
export type FacebookGroupLocalStorageInfo = {
  group_id: string;
  group_name: string;
};
export type FacebookProfileData = {
  profile_id: string;
  profile_name: string;
  profile_url: string;
  profile_type: string;
  entry_rowkey: string;
  docType: string;
  created_time: number;
  updated_time: number;
  base_data: any;
  channel_name: string;
};
export type FacebookDataType =
  | FacebookAttachment
  | FacebookPostData
  | FacebookImageData
  | FacebookCommentData
  | FacebookGroupJoinedData
  | FacebookReactionData
  | FacebookUserProfileData
  | FacebookProfileData
  | FacebookUserFollowData
  | FacebookUserFriendData;

// Tiktok
export type TiktokPostLocalStorageInfo = {
  entry_rowkey: string;
  post_id: string;
  owner_id: string;
  owner_name: string;
};
export type TiktokUserLocalStorageInfo = {
  secUid: string;
  avatar: string;
  id: string;
  name: string;
  uniqueId: string;
  signature: string;
};
export type TiktokPostData = {
  url: string;
  author_id: string;
  source_type: string;
  view_count: string;
  tags: string[];
  _tags: string[];
  updated_time: number;
  tenant_ids: string[];
  transcription: string;
  inserted_time: number;
  owner_id: string;
  owner_name: string;
  post_id: string;
  created_time: number;
  entry_rowkey: string;
  reaction_count: string;
  category_info: [];
  content: string;
  share_count: string;
  title: string;
  type: string;
  docType: string;
  comment_count: string;
  _tenants: string[];
  collect_count: 0;
  attachments: any;
  channel_name: string;
  author_name: string;
  description: string;
  crawler_system: string;
};
export type TiktokImageData = {
  image_type: string;
  url: string;
  media_url: string;
  post_id: string;
  entry_rowkey: string;
  channel_name: string;
  created_time: number;
  updated_time: number;
  docType: string;
};
export type TiktokCommentData = {
  entry_rowkey: string;
  comment_rowkey: string;
  comment_id: string;
  source_type: string;
  tags: string[];
  updated_time: number;
  inserted_time: number;
  post_id: string;
  parent_comment_id: string;
  created_time: number;
  reaction_count: number;
  owner_id: string;
  owner_name: string;
  owner_type: string;
  profile_id: string;
  profile_name: string;
  docType: string;
  _tenants: string[];
  tenant_ids: string[];
  comment: string;
  channel_name: string;
};
export type TiktokUserProfileData = {
  // stats
  videosCount: string;
  followingCount: string;
  followerCount: string;
  heartCount: string;
  diggCount: string;
  friendCount: string;
  // user
  url: string;
  portia_spider: string;
  id: string;
  avatar: string;
  social_id: string;
  profile_id: string;
  name: string;
  uniqueId: string;
  privateAccount: boolean;
  verified: boolean;
  signature: string;
  secUid: string;
  created_time: number | null;
  "@timestamp": string | null;
  // others
  activity: boolean;
  social_site: string;
  description: string;
  type: string;
  main_page: string;
  channel_name: string;
  is_active: boolean;
  seed_url: string;
  is_vip: boolean;
  docType: string;
  active: boolean;
  source_type: string;
  tenant_ids: string[];
  ttl: number;
  created_by: number;
  domain: string;
  phone: string;
  region: string;
  locations: string[];
  entry_rowkey: string;
};
export type TiktokUserFollowData = {
  follow_id: string;
  follow_rowkey: string;
  follower_id: string;
  follower_name: string;
  follower_url: string;
  follower_avatar: string;
  follower_sub_text: string;
  followed_id: string | null;
  followed_name: string | null;
  entry_rowkey: string;
  source_type: string;
  updated_time: number;
  inserted_time: number;
  created_time: number;
  type: string;
  docType: string;
  channel_name: string;
};
export type TiktokDataType =
  | TiktokPostData
  | TiktokImageData
  | TiktokCommentData
  | TiktokUserProfileData
  | TiktokUserFollowData;


// Youtube
export type YoutubePostLocalStorageInfo = {
  entry_rowkey: string;
  post_id: string;
  owner_id: string;
  owner_name: string;
};
export type YoutubeProfileLocalStorageInfo = {
  profile_id: string;
  name: string;
  username: string;
  attachments: XAttachment[];
};

export type YoutubeTranscriptData = {
  start: number;
  duration: number;
  text: string;
}
export type YoutubeAttachment = {
  type?: string;
  url: string;
  height?: number;
  width?: number;
};
export type YoutubePostData = {
  url: string;
  entry_rowkey: string;
  post_id: string;
  source_type: string;
  tags: any[];
  _tags: any[];
  tenant_ids: string[];
  inserted_time: number;
  created_time: number;
  updated_time: number;
  owner_id: string;
  owner_name: string;
  author_id: string;
  author_name: string;
  view_count: number;
  reaction_count: number;
  comment_count: number;
  share_count: number;
  collect_count: number;
  category_info: any[];
  content: string;
  title: string;
  type: "video";
  docType: "Post";
  crawler_system: "extension";
  _tenants: any[];
  attachments: YoutubeAttachment[];
  channel_name: "youtube";
  description: string;
  transcript: YoutubeTranscriptData[];
  transcription: string;
};
export type YoutubeImageData = {
  image_type: "photo";
  url: string;
  media_url: string;
  post_id: string;
  entry_rowkey: string;
  channel_name: "youtube";
  created_time: number;
  updated_time: number;
  docType: "Photo";
  _tenants: any[];
  tenant_ids: string[];
};
export type YoutubeCommentData = {
  entry_rowkey: string;
  comment_rowkey: string;
  comment_id: string;
  source_type: string;
  tags: string[];
  updated_time: number;
  inserted_time: number;
  post_id: string;
  parent_comment_id: string;
  created_time: number;
  reaction_count: number;
  owner_id: string;
  owner_name: string;
  owner_type: string;
  profile_id: string;
  profile_name: string;
  docType: "Comment";
  _tenants: string[];
  tenant_ids: string[];
  comment: string;
  channel_name: "youtube";
};
export type YoutubeUserProfileData = {
  entry_rowkey: string;
  profile_id: string;
  name: string;
  username: string;
  url: string;
  country: string;
  attachments: YoutubeAttachment[];
  channel_name: "youtube";
  type: "channel";
  docType: "Profile";
  description: string;
  subscriber_count: string;
  video_count: string;
  view_count: string;
  links: { link: string, title: string }[];
  joined_date: string;
  "@timestamp": string;
  created_at: number;
  datef: number;
  ttl: number;
  active: boolean;
  tenant_ids: string[];
};

export type YoutubeDataType = YoutubePostData
  | YoutubeCommentData
  | YoutubeUserProfileData
  | YoutubeImageData;

export type Result<T, E = Error> =
  | { ok: true; data: T }
  | { ok: false; error: E };

export type ParseType =
  // Facebook
  | { typeName: "FacebookPostData"; data: FacebookPostData[] }
  | { typeName: "FacebookImageData"; data: FacebookImageData[] }
  | { typeName: "FacebookGroupJoinedData"; data: FacebookGroupJoinedData[] }
  | { typeName: "FacebookUserProfileData"; data: FacebookUserProfileData[] }
  | { typeName: "FacebookUserFollowerData"; data: FacebookUserFollowData[] }
  | { typeName: "FacebookUserFriendData"; data: FacebookUserFriendData[] }
  | { typeName: "FacebookProfileData"; data: FacebookProfileData[] }
  | { typeName: "FacebookCommentData"; data: FacebookCommentData[] }
  | { typeName: "FacebookReactionData"; data: FacebookReactionData[] }
  // Tiktok
  | { typeName: "TiktokPostData"; data: TiktokPostData[] }
  | { typeName: "TiktokImageData"; data: TiktokImageData[] }
  | { typeName: "TiktokCommentData"; data: TiktokCommentData[] }
  | { typeName: "TiktokUserProfileData"; data: TiktokUserProfileData[] }
  | { typeName: "TiktokUserFollowerData"; data: TiktokUserFollowData[] }
  // Threads
  | { typeName: "ThreadsPostData"; data: ThreadsPostData[] }
  | { typeName: "ThreadsAttachmentData"; data: ThreadsAttachment[] }
  | { typeName: "ThreadsCommentData"; data: ThreadsCommentData[] }
  | { typeName: "ThreadsUserProfileData"; data: ThreadsUserProfileData[] }
  | { typeName: "ThreadsUserFollowerData"; data: ThreadsUserFollowData[] }
  // Twitter (X)
  | { typeName: "XPostData"; data: XPostData[] }
  | { typeName: "XAttachmentData"; data: XAttachment[] }
  | { typeName: "XCommentData"; data: XCommentData[] }
  | { typeName: "XUserProfileData"; data: XUserProfileData[] }
  | { typeName: "XUserFollowerData"; data: XUserFollowData[] }
  // Youtube
  | { typeName: "YoutubePostData"; data: YoutubePostData[] }
  | { typeName: "YoutubeCommentData"; data: YoutubeCommentData[] }
  | { typeName: "YoutubeUserProfileData"; data: YoutubeUserProfileData[] }
  | { typeName: "YoutubeImageData"; data: YoutubeImageData[] };
