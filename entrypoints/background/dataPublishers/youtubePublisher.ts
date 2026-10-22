import { bgState } from "../state";
import { _runKafkaPublish } from "./kafkaPublisher";
import * as services from "../services";
import { YoutubeImageData, YoutubePostData } from "@/entrypoints/background/utils/parsers/types";
import { Constants, DefaultValues } from "../utils/constants";

export async function sendYoutubeCachedData(): Promise<void> {
  return _runKafkaPublish({
    platform: "youtube",
    retryAlarm: Constants.SEND_YOUTUBE_DATA_ALARM,
    logTag: "[sendYoutubeCachedData]",

    resolveTopics(_settings) {
      return {};
    },

    async publishPayloads(ctx) {
      const { settings, tenantObjs, publish, incrementBadge } = ctx;
      const { youtubeTopic: topicSetting } = settings;

      const youtubeTopic = topicSetting || DefaultValues.SETTINGS_DATA.youtubeTopic;
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

        const result = await publish(youtubeTopic, bgState.cachedYoutubeData, true);
        if (result.ok) {
          console.log(new Date().toLocaleTimeString(), "[Youtube Cached Data] Sent successfully!");
          await incrementBadge(videoCount);
        } else {
          console.log(new Date().toLocaleTimeString(), "[Youtube Cached Data] Failed to send:", result.error.message);
        }

        bgState.cachedYoutubeData = [];
        services.syncServices.handleSyncExtensionInfo(true);
      }
    },
  });
}
