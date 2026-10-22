import * as services from "../services";
import { bgState } from "../state";
import { _runKafkaPublish } from "./kafkaPublisher";
import { TiktokPostData } from "@/entrypoints/background/utils/parsers/types";
import { Constants, DefaultValues } from "../utils/constants";

export async function sendTiktokCachedData(): Promise<void> {
  return _runKafkaPublish({
    platform: "tiktok",
    retryAlarm: Constants.SEND_TIKTOK_DATA_ALARM,
    logTag: "[sendTiktokCachedData]",

    resolveTopics(_settings) {
      return {};
    },

    async publishPayloads(ctx) {
      const { settings, tenantObjs, publish, incrementBadge } = ctx;
      const { tiktokTopic: topicSetting } = settings;

      const tiktokTopic = topicSetting || DefaultValues.SETTINGS_DATA.tiktokTopic;
      if (!tiktokTopic) {
        console.warn(this.logTag, "topics missing or invalid — skip publish", tiktokTopic);
        return;
      }

      // Append tenants info
      let postCount = 0;
      for (const rawRecord of bgState.cachedTiktokData) {
        const record = rawRecord as TiktokPostData;
        if (!record.entry_rowkey) {
          continue;
        }

        if (record?.docType?.toLowerCase() === "post") {
          postCount++;
          record._tenants = tenantObjs;
          record.tenant_ids = tenantObjs.map((t: any) => t.id);
        }
      }

      // Sending task
      if (bgState.cachedTiktokData.length) {
        const result = await publish(tiktokTopic, bgState.cachedTiktokData, true);
        if (result.ok) {
          console.log(new Date().toLocaleTimeString(), "[TikTok Cached Data] Sent successfully!");
          await incrementBadge(postCount);
        } else {
          console.log(new Date().toLocaleTimeString(), "[TikTok Cached Data] Failed to send:", result.error.message);
        }

        bgState.cachedTiktokData = [];
        await services.syncServices.handleSyncExtensionInfo(true);
      }
    },
  });
}
