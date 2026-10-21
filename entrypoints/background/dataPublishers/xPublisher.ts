import { bgState } from "../state";
import { _runKafkaPublish } from "./kafkaPublisher";
import { handleSyncExtensionInfo } from "../services/syncService";
import { XPostData } from "@/entrypoints/background/utils/parsers/types";
import { Constants, DefaultValues } from "../utils/constants";

export async function sendXCachedData(): Promise<void> {
  return _runKafkaPublish({
    platform: "x",
    retryAlarm: Constants.SEND_X_DATA_ALARM,
    logTag: "[sendXCachedData]",

    resolveTopics(_settings) {
      return {};
    },

    async publishPayloads(ctx) {
      const { settings, tenantObjs, publish, incrementBadge } = ctx;
      const { xTopic: topicSetting } = settings;

      const xTopic = topicSetting || DefaultValues.DEFAULT_SETTINGS_JSON.xTopic;
      if (!xTopic) {
        console.warn(this.logTag, "topics missing or invalid — skip publish", xTopic);
        return;
      }

      // Append tenants info
      let postCount = 0;
      for (const rawRecord of bgState.cachedXData) {
        const record = rawRecord as XPostData;
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
      if (bgState.cachedXData.length) {
        await publish(xTopic, bgState.cachedXData, true);
        console.log(new Date().toLocaleTimeString(), "[X Cached Data] Sent successfully!");
        await incrementBadge(postCount);

        bgState.cachedXData = [];
        try {
          await handleSyncExtensionInfo(true);
        } catch (e) {
          console.warn(this.logTag, "handleSyncExtensionInfo failed:", e);
        }
      }
    },
  });
}
