import { bgState } from "../state";
import { Result, ThreadsDataType, ThreadsPostData } from "@/entrypoints/background/utils/parsers/types";
import { Constants, DefaultValues } from "../utils/constants";
import { Settings } from "../types/types";
import { ApplicationServices } from "../application-services";

const platform = "threads";
const retryAlarm = Constants.SEND_THREADS_DATA_ALARM;
const logTag = "[sendThreadsCachedData]";

function toSafeNonNegInt(v: any) {
    const n = Number(v);
    return !Number.isFinite(n) || n < 0 ? 0 : Math.floor(n);
}

async function attachKafkaMeta(payload: any, meta: any) {
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
}

async function publish(
    url: string,
    topic: string,
    payload: any,
    hasExtensionInfo: boolean,
    extension_id: string,
    extensionUserId: string,
    extensionUserName: string,
): Promise<Result<any>> {
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
            platform: platform,
            extension_id: extension_id,
            message: JSON.stringify(enrichedPayload),
        }),
    });

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        const error = new Error(`HTTP ${res.status} ${res.statusText} ${body}`);
        return { ok: false, error: error };
    }
    return { ok: true, data: null };
}

function appendTenantsInfo(tenants: any, records: ThreadsDataType[]) {
    const tenantObjs: any[] = [];
    if (Array.isArray(tenants) && tenants.length) {
        for (const t of tenants) tenantObjs.push(t);
    } else {
        tenantObjs.push(tenants);
    }

    const tenantAppendedRecords: ThreadsDataType[] = [];
    for (const rawRecord of records) {
        const record = rawRecord as ThreadsPostData;
        if (!record.entry_rowkey) {
            continue;
        }

        if (["post"].includes(record?.docType?.toLowerCase())) {
            record._tenants = tenantObjs;
            record.tenant_ids = tenantObjs.map((t: any) => t.id);
        }
        tenantAppendedRecords.push(record);
    }
    return tenantAppendedRecords;
}

export function createPublishThreadsCachedData(applicationServices: ApplicationServices) {
    return async function () {
        return publishThreadsCachedData(applicationServices);
    };
}

export async function publishThreadsCachedData(applicationServices: ApplicationServices): Promise<void> {
    const BASE_URL = import.meta.env.VITE_AXIOS_BASE_URL;
    const cachedData = bgState.cachedThreadsData;
    if (bgState.__sendDataKafkaInflight) {
        return bgState.__sendDataKafkaInflight;
    }
    const runId = bgState.__sendDataKafkaRunId;

    bgState.__sendDataKafkaInflight = (async () => {
        if (runId !== bgState.__sendDataKafkaRunId) return;

        // 1. Load settings + user
        const runtimeReq: any = await applicationServices.storage?.getStorageCachedByKeys(["settings", "user"]);
        const settings: Settings | null = runtimeReq?.settings ?? null;
        const cachedUserData = runtimeReq?.user ?? null;

        if (!settings || !cachedUserData) {
            console.log(`${logTag} Cannot get settings or user — skip publish`);
            return;
        }

        // 2. Append tenants info
        let treatedData = appendTenantsInfo(
            cachedUserData?.tenants || DefaultValues.SETTINGS_DATA.tenants,
            cachedData
        );

        // ???
        const hasUserPending = typeof bgState.cachedFacebookUserInfoToPublish === "string" && bgState.cachedFacebookUserInfoToPublish.length > 0;
        if (treatedData.length === 0 && !hasUserPending) return;

        // 4. Sending task
        if (treatedData.length) {
            const topic = settings.threadsTopic || DefaultValues.SETTINGS_DATA.threadsTopic;
            if (!topic) {
                console.warn(`${logTag} Threads topic is not defined`);
                return;
            }

            // 3. Build publish URL
            const keySendData = cachedUserData?.apikey || (DefaultValues.SETTINGS_DATA as any)?.apikey;
            if (!keySendData) {
                console.warn(`${logTag} Invalid apikey — skip publish`);
                return;
            }

            const url = `${BASE_URL}/kafka/publish-message/extension?apikey=${keySendData}`;

            // User identity for meta attachment
            const extensionUserIdRaw = cachedUserData?.id;
            const extensionUserNameRaw = cachedUserData?.username || cachedUserData?.name;
            const extensionUserId = typeof extensionUserIdRaw === "string" || typeof extensionUserIdRaw === "number"
                ? String(extensionUserIdRaw)
                : "";
            const extensionUserName = typeof extensionUserNameRaw === "string" ? extensionUserNameRaw : "";

            const result = await publish(
                url,
                topic,
                treatedData,
                true,
                cachedUserData?.extension_session?.extension_id,
                extensionUserId,
                extensionUserName,
            );
            if (result.ok) {
                console.log(new Date().toLocaleTimeString(), "[Facebook Post] Sent successfully!");
                // await incrementBadge(postCount);
            } else {
                console.log(new Date().toLocaleTimeString(), "[Facebook Post] Failed to send:", result.error.message);
            }
        }

        // 5. Set badge count after publishing
        const numberCount = settings?.n_c ?? 0;
        const sentCount = treatedData.length;
        const newNC = toSafeNonNegInt(numberCount) + sentCount;

        await applicationServices.storage?.setStorageCached({ settings: { ...settings, n_c: newNC } });
        await applicationServices.action?.getBrowserApi().setBadgeText({ text: String(newNC) });
        await applicationServices.action?.getBrowserApi().setBadgeBackgroundColor({ color: "#0000FF" });

        // 6. Clear cached data after successful publish
        applicationServices.sync?.handleSyncExtensionInfo(true);
        bgState.cachedThreadsData = [];
        treatedData = [];
    })()
        .catch((err) => {
            console.log(
                new Date().toLocaleTimeString(),
                `${logTag} Publish failed:`,
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
                bgState.cachedThreadsData.length > 0;
            if (hasPending) {
                applicationServices.alarm?.getBrowserApi().create(retryAlarm, { delayInMinutes: 0.05 });
            }
        });

    return bgState.__sendDataKafkaInflight;
}
