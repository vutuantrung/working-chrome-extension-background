import { Constants, DefaultValues } from "../utils/constants";
import { bgState } from "../state";
import { Result } from "../utils/parsers/types";
import { Settings } from "../types/types";
import { ApplicationServices } from "../application-services";

const platform = "facebook"
const retryAlarm = Constants.SEND_FACEBOOK_DATA_ALARM
const logTag = "[sendFacebookUserData]";

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

function appendTenantsInfo(tenants: any, record: string) {
    const tenantObjs: any[] = [];
    if (Array.isArray(tenants) && tenants.length) {
        for (const t of tenants) tenantObjs.push(t);
    } else {
        tenantObjs.push(tenants);
    }

    let userPayload: any = null;
    try {
        userPayload = JSON.parse(record);
    } catch {
        console.warn(logTag, "userInfo pending but payload is invalid JSON — skip user publish");
        return [];
    }

    userPayload._tenants = tenantObjs;
    userPayload.tenant_ids = tenantObjs.map((t: any) => t.id);
    userPayload.entry_rowkey = userPayload.id;
    userPayload.platform = "facebook";
    userPayload.crawler_system = "extension";

    return [userPayload];
}

export function createPublishFacebookUserData(applicationServices: ApplicationServices): () => Promise<void> {
    return async () => {
        await publishFacebookUserData(applicationServices);
    };
}

export async function publishFacebookUserData(applicationServices: ApplicationServices): Promise<void> {
    const BASE_URL = import.meta.env.VITE_AXIOS_BASE_URL;
    const cachedData = bgState.cachedFacebookUserInfoToPublish;
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
            String(cachedData)
        )

        // ???
        const hasUserPending = typeof bgState.cachedFacebookUserInfoToPublish === "string" && bgState.cachedFacebookUserInfoToPublish.length > 0;
        if (!hasUserPending) return;

        // Sending task
        if (treatedData.length) {
            const topic = settings.facebookTopic;
            if (!topic) {
                console.warn(logTag, "topics missing or invalid — skip publish", topic);
                return;
            }

            const keySendData = cachedUserData?.apikey || (DefaultValues.SETTINGS_DATA as any)?.apikey;
            if (!keySendData) {
                console.warn(`${logTag} Invalid apikey — skip publish`);
                return;
            }

            const url = `${BASE_URL}/kafka/publish-message/extension?apikey=${keySendData}`;

            //  User identity for meta attachment
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

        bgState.cachedFacebookUserInfoToPublish = null;
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
                bgState.cachedFacebookData.length > 0 ||
                bgState.cachedTiktokData.length > 0;
            if (hasPending) {
                applicationServices.alarm?.getBrowserApi().create(retryAlarm, { delayInMinutes: 0.05 });
            }
        });

    return bgState.__sendDataKafkaInflight;
}