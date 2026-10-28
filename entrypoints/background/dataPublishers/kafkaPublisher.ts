import * as services from "../services";
import { bgState } from "../state";
import { KafkaPublishConfig, Settings } from "../types/types";
import { chromeApi } from "../infrastructure/chrome-api/chrome-api";
import { DefaultValues } from "../utils/constants";
import { Result } from "../utils/parsers/types";

export async function _runKafkaPublish(kConfig: KafkaPublishConfig): Promise<void> {

  const BASE_URL = import.meta.env.VITE_AXIOS_BASE_URL;

  if (bgState.__sendDataKafkaInflight) {
    return bgState.__sendDataKafkaInflight;
  }

  const runId = bgState.__sendDataKafkaRunId;

  bgState.__sendDataKafkaInflight = (async () => {
    if (runId !== bgState.__sendDataKafkaRunId) return;

    // 1. Load settings + user
    const runtimeReq: any = await services.storageService.getStorageCachedByKeys(["settings", "user"]);
    const settings: Settings | null = runtimeReq?.settings ?? null;

    if (!settings || !runtimeReq?.user) {
      console.log(`${kConfig.logTag} Cannot get settings or user — skip publish`);
      return;
    }

    // 2. Resolve topics
    const topics = kConfig.resolveTopics(settings);
    if (!topics) return;

    // 3. Build publish URL
    const keySendData = runtimeReq?.user?.apikey || (DefaultValues.SETTINGS_DATA as any)?.apikey;
    if (!keySendData) {
      console.warn(`${kConfig.logTag} Invalid apikey — skip publish`);
      return;
    }
    const url = `${BASE_URL}/kafka/publish-message/extension?apikey=${keySendData}`;

    // 4. Build tenant list
    const tenants = runtimeReq?.user?.tenants || DefaultValues.SETTINGS_DATA.tenants;
    const tenantObjs: any[] = [];
    if (Array.isArray(tenants) && tenants.length) {
      for (const t of tenants) tenantObjs.push(t);
    } else {
      tenantObjs.push(tenants);
    }

    // 5. User identity for meta attachment
    const extensionUserIdRaw = runtimeReq?.user?.id;
    const extensionUserNameRaw = runtimeReq?.user?.username || runtimeReq?.user?.name;
    const extensionUserId = typeof extensionUserIdRaw === "string" || typeof extensionUserIdRaw === "number"
      ? String(extensionUserIdRaw)
      : "";
    const extensionUserName = typeof extensionUserNameRaw === "string" ? extensionUserNameRaw : "";

    // 6. Shared helpers
    const attachKafkaMeta = (payload: any, meta: any) => {
      const attachToItem = (item: any) => {
        if (!item || typeof item !== "object" || Array.isArray(item))
          return item;
        return {
          ...item,
          ...(!item.extension_user_id ? { extension_user_id: meta.extension_user_id } : {}),
          ...(!item.extension_user_name ? { extension_user_name: meta.extension_user_name } : {}),
          ...(!item.push_time ? { push_time: meta.push_time } : {}),
        };
      };
      return Array.isArray(payload)
        ? payload.map(attachToItem)
        : attachToItem(payload);
    };

    const publish = async (topic: string, payload: any, hasExtensionInfo: boolean): Promise<Result<any>> => {
      const enrichedPayload = hasExtensionInfo
        ? attachKafkaMeta(
          payload,
          {
            extension_user_id: extensionUserId,
            extension_user_name: extensionUserName,
            push_time: Date.now(),
          })
        : payload;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          platform: kConfig.platform,
          extension_id: runtimeReq?.user?.extension_session?.extension_id,
          message: JSON.stringify(enrichedPayload),
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const error = new Error(`HTTP ${res.status} ${res.statusText} ${body}`);
        return { ok: false, error: error };
      }
      return { ok: true, data: null };
    };

    const toSafeNonNegInt = (v: any) => {
      const n = Number(v);
      return !Number.isFinite(n) || n < 0 ? 0 : Math.floor(n);
    };

    const incrementBadge = async (delta: number) => {
      try {
        const { settings: cs } = await services.storageService.getStorageCachedByKeys(["settings"]);
        const newNC = toSafeNonNegInt(cs?.n_c) + delta;
        if (cs) {
          await services.storageService.setStorageCached({
            settings: { ...cs, n_c: newNC },
          });
        }
        await chromeApi.action.setBadgeText({ text: String(newNC) });
        await chromeApi.action.setBadgeBackgroundColor({ color: "#0000FF" });
      } catch (_ignored) { }
    };

    // 7. Delegate to platform-specific publish steps
    await kConfig.publishPayloads({
      runtimeReq,
      settings,
      url,
      tenantObjs,
      extensionUserId,
      extensionUserName,
      topics,
      publish,
      incrementBadge,
    });
  })()
    .catch((err) => {
      console.log(
        new Date().toLocaleTimeString(),
        `${kConfig.logTag} Publish failed:`,
        String((err as any)?.message || err),
      );
    })
    .finally(() => {
      if (runId !== bgState.__sendDataKafkaRunId) return;

      bgState.__sendDataKafkaInflight = null;
      const hasUserPending =
        typeof bgState.cachedFacebookUserInfoToPublish === "string" &&
        bgState.cachedFacebookUserInfoToPublish.length > 0;
      const hasPending =
        hasUserPending ||
        bgState.cachedFacebookData.length > 0 ||
        bgState.cachedTiktokData.length > 0;
      if (hasPending) {
        chromeApi.alarms.create(kConfig.retryAlarm, { delayInMinutes: 0.05 });
      }
    });

  return bgState.__sendDataKafkaInflight;
}
