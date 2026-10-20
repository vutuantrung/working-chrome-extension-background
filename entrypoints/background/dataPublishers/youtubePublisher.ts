import { bgState, SEND_YOUTUBE_DATA_ALARM } from "../state";
import { _runKafkaPublish } from "./kafkaPublisher";
import { handleSyncExtensionInfo } from "../services/syncService";
import { YoutubeImageData, YoutubePostData } from "@/utils/parsers/types";
import { DEFAULT_SETTINGS_JSON } from "../helpers/constants";

export async function sendYoutubeCachedData(): Promise<void> {
  return _runKafkaPublish({
    platform: "youtube",
    retryAlarm: SEND_YOUTUBE_DATA_ALARM,
    logTag: "[sendYoutubeCachedData]",

    resolveTopics(_settings) {
      return {};
    },

    async publishPayloads(ctx) {
      const { settings, tenantObjs, publish, incrementBadge } = ctx;
      const { youtubeTopic: topicSetting } = settings;

      const youtubeTopic = topicSetting || DEFAULT_SETTINGS_JSON.youtubeTopic;
      if (!youtubeTopic) {
        console.warn(this.logTag, "topics missing or invalid — skip publish", youtubeTopic);
        return;
      }

      // Append tenants info
      let videoCount = 0;
      for (const rawRecord of bgState.cachedYoutubeData) {
        const record = rawRecord as YoutubePostData | YoutubeImageData;
        if (!record.entry_rowkey) {
          continue;
        }

        if (record.docType === "Post" || record.docType === "Photo") {
          videoCount++;
          record._tenants = tenantObjs;
          record.tenant_ids = tenantObjs.map((t: any) => t.id);
        }
      }

      // Sending task
      if (bgState.cachedYoutubeData.length) {
        await publish(youtubeTopic, bgState.cachedYoutubeData, true);
        console.log(new Date().toLocaleTimeString(), "[Youtube Cached Data] Sent successfully!");
        await incrementBadge(videoCount);

        bgState.cachedYoutubeData = [];
        try {
          await handleSyncExtensionInfo(true);
        } catch (e) {
          console.warn(this.logTag, "handleSyncExtensionInfo failed:", e);
        }
      }
    },
  });
}
