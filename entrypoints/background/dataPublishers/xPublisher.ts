import { bgState } from "../state";
import { _runKafkaPublish } from "./kafkaPublisher";
import * as services from "../services";
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

      const xTopic = topicSetting || DefaultValues.SETTINGS_DATA.xTopic;
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
        const result = await publish(xTopic, bgState.cachedXData, true);
        if (result.ok) {
          console.log(new Date().toLocaleTimeString(), "[X Cached Data] Sent successfully!");
          await incrementBadge(postCount);
        } else {
          console.log(new Date().toLocaleTimeString(), "[X Cached Data] Failed to send:", result.error.message);
        }

        bgState.cachedXData = [];
        services.syncService.handleSyncExtensionInfo(true);
      }
    },
  });
}
