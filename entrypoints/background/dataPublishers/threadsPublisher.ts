import { bgState, SEND_THREADS_DATA_ALARM } from "../state";
import { _runKafkaPublish } from "./kafkaPublisher";
import { handleSyncExtensionInfo } from "../services/syncService";
import { ThreadsPostData } from "@/utils/parsers/types";
import { DEFAULT_SETTINGS_JSON } from "../helpers/constants";

export async function sendThreadsCachedData(): Promise<void> {
  return _runKafkaPublish({
    platform: "threads",
    retryAlarm: SEND_THREADS_DATA_ALARM,
    logTag: "[sendThreadsCachedData]",

    resolveTopics(_settings) {
      return {};
    },

    async publishPayloads(ctx) {
      const { settings, tenantObjs, publish, incrementBadge } = ctx;
      const { threadsTopic: topicSetting } = settings;

      const threadsTopic = topicSetting || DEFAULT_SETTINGS_JSON.threadsTopic;
      if (!threadsTopic) {
        console.warn(this.logTag, "topics missing or invalid — skip publish", threadsTopic);
        return;
      }

      // Append tenants info
      let postCount = 0;
      for (const rawRecord of bgState.cachedThreadsData) {
        const record = rawRecord as ThreadsPostData;
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
      if (bgState.cachedThreadsData.length) {
        await publish(threadsTopic, bgState.cachedThreadsData, true);
        console.log(new Date().toLocaleTimeString(), "[Threads Cached Data] Sent successfully!");

        await incrementBadge(postCount);

        bgState.cachedThreadsData = [];
        try {
          await handleSyncExtensionInfo(true);
        } catch (e) {
          console.warn(this.logTag, "handleSyncExtensionInfo failed:", e);
        }
      }
    },
  });
}
