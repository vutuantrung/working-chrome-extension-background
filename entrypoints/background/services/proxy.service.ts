import * as services from "../services";
import * as helpers from "../utils/helpers";
import { Message, ProxyHealth, Settings } from "../types/types";
import { chromeApi } from "../infrastructure/chrome-api/chrome-api";
import { DefaultValues, Constants } from "../utils/constants";

interface Proxy {
    host: string;
    port: string
}

let lastProxyErrorWriteAt = 0;
export function getLastProxyErrorWriteAt(): number { return lastProxyErrorWriteAt; }
export function setLastProxyErrorWriteAt(value: number): void { lastProxyErrorWriteAt = value; }

export function getProxySettings() {
    return chromeApi.proxy.settings;
}

export function clearProxy(): void {
    chromeApi.proxy.settings.clear({ scope: "regular" }, () => {
        console.log("Proxy cleared.");
    });

    storeProxyData({
        state: "ok",
        updatedAt: Date.now(),
        reason: "proxy_cleared",
        error: undefined,
        details: undefined,
        lastErrorAt: undefined,
    });
}

export function setProxy(httpProxy?: Proxy, httpsProxy?: Proxy) {
    const rules: any = {
        bypassList: ["localhost", "127.0.0.1"],
    };

    if (httpProxy) {
        rules.proxyForHttp = {
            scheme: "http",
            host: httpProxy.host,
            port: parseInt(httpProxy.port),
        };
    }

    if (httpsProxy) {
        rules.proxyForHttps = {
            scheme: "http",
            host: httpsProxy.host,
            port: parseInt(httpsProxy.port),
        };
    }

    const config = {
        mode: "fixed_servers" as const,
        rules: rules,
    };

    chromeApi.proxy.settings.set({ value: config, scope: "regular" }, () => {
        console.log("Proxy is/are set");
    });

    storeProxyData({
        state: "ok",
        updatedAt: Date.now(),
        reason: "proxy_set",
        error: undefined,
        details: undefined,
        lastErrorAt: undefined,
    });

    try { Promise.resolve(checkProxyStatus()).catch(() => { }); }
    catch { }
}

function getCachedProxyHealth(): ProxyHealth | undefined {
    try {
        const storage = services.storageService.getStorageCache();
        return (storage as any)?.proxyHealth as ProxyHealth | undefined;
    } catch {
        return undefined;
    }
}

export function storeProxyData(patch: Partial<ProxyHealth>) {
    try {
        const prev = getCachedProxyHealth();
        const now = Date.now();

        const next: ProxyHealth = {
            ...(prev || {} as any),
            state: "ok",
            updatedAt: now,
            consecutiveFailures: prev?.consecutiveFailures ?? 0,
            ...patch,
        };
        void services.storageService.setStorageCached({ proxyHealth: next }).catch(() => { });

        // Keep cache in sync even if storage event is delayed.
        const cache = services.storageService.getStorageCache();
        if (cache) {
            (cache as any).proxyHealth = next;
        }
    } catch { }
}

export async function checkProxyStatus(): Promise<void> {
    const startedAt = Date.now();

    const proxySettings = services.proxyService.getProxySettings();
    if (!proxySettings) return;

    const details = await proxySettings.get({ incognito: false });
    const proxyValue = details?.value ?? null;
    const prevHealth = getCachedProxyHealth();
    const prevFailures = prevHealth?.consecutiveFailures ?? 0;

    // If proxy isn't active, keep state as OK (Restart button won't show anyway because proxy won't match).
    if (!proxyValue || proxyValue.mode !== "fixed_servers") {
        storeProxyData({
            state: "ok",
            updatedAt: Date.now(),
            lastOkAt: Date.now(),
            consecutiveFailures: 0,
            reason: "proxy_not_active",
            details: { mode: proxyValue?.mode || null },
            error: undefined,
            lastErrorAt: undefined,
        });
        return;
    }


    // Set up an abort controller to timeout the fetch request after 7 seconds.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    // Must be allowed by extension_pages CSP (connect-src) and host_permissions.

    try {
        const resp = await fetch(Constants.FB_WEB_FAVICON, {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
        });

        const durationMs = Date.now() - startedAt;
        const ok = resp && resp.status >= 200 && resp.status < 400;

        if (ok) {
            storeProxyData({
                state: "ok",
                updatedAt: Date.now(),
                lastOkAt: Date.now(),
                consecutiveFailures: 0,
                reason: "alarm_check_ok",
                details: { url: Constants.FB_WEB_FAVICON, status: resp.status, durationMs },
                error: undefined,
                lastErrorAt: undefined,
            });
        } else {
            const consecutiveFailures = prevFailures + 1;
            const basePatch = {
                updatedAt: Date.now(),
                lastErrorAt: Date.now(),
                consecutiveFailures,
                reason: "alarm_check_bad_status",
                details: { url: Constants.FB_WEB_FAVICON, status: resp?.status, durationMs },
                error: `HTTP ${resp?.status}`,
            };

            // Avoid false positives (e.g. transient errors right after applying proxy).
            // Only enter hard error state after 2 consecutive failures.
            if (consecutiveFailures < 2) {
                storeProxyData({
                    ...basePatch,
                    state: "ok",
                    reason: "alarm_check_bad_status_soft",
                });

                setTimeout(() => { try { void checkProxyStatus(); } catch { } }, 5000);
            } else {
                storeProxyData({ ...basePatch, state: "error" });
            }
        }
    } catch (err) {
        const durationMs = Date.now() - startedAt;
        const consecutiveFailures = prevFailures + 1;
        const basePatch = {
            updatedAt: Date.now(),
            lastErrorAt: Date.now(),
            consecutiveFailures,
            reason: "alarm_check_failed",
            details: { url: Constants.FB_WEB_FAVICON, durationMs },
            error: err instanceof Error ? err.message : String(err),
        };

        if (consecutiveFailures < 2) {
            storeProxyData({
                ...basePatch,
                state: "ok",
                reason: "alarm_check_failed_soft",
            });

            setTimeout(() => { try { void checkProxyStatus(); } catch { } }, 5000);
        } else {
            storeProxyData({ ...basePatch, state: "error" });
        }
    } finally {
        clearTimeout(timeoutId);
    }
}

export async function handleProxy(message: Message, sendResponse: (resp: any) => void) {
    try {
        const { extension_proxy: proxyConfig } = message.inputs;
        const settingsFromProxy: Partial<Settings> = {};
        console.log("[handleProxy] proxyConfig:", proxyConfig);

        if (helpers.proxy.isActiveProxy(proxyConfig)) {
            settingsFromProxy.proxy = "manual";
            settingsFromProxy.proxyOption = "manual";

            const httpProxy = proxyConfig.host && proxyConfig.port
                ? { host: proxyConfig.host, port: proxyConfig.port }
                : undefined;
            const httpsProxy = proxyConfig.host && proxyConfig.port
                ? { host: proxyConfig.host, port: proxyConfig.port }
                : undefined;

            if (httpProxy || httpsProxy) {
                setProxy(httpProxy, httpsProxy);
            }
        } else if (!proxyConfig || (typeof proxyConfig === "object" && !Object.keys(proxyConfig).length)) {
            clearProxy();
        }

        // Persist effective proxy so popup can reflect changes (Restart button logic depends on it).
        try {
            const proxyActive = helpers.proxy.isActiveProxy(proxyConfig);
            await services.storageService.setStorageCached({ activeProxy: proxyActive ? proxyConfig : {} });
        } catch { }

        const { settings } = await services.storageService.getStorageCachedByKeys(["settings"]);
        const finalSettings = settings
            ? {
                ...settings,
                ...settingsFromProxy,
                archive: settings.archive || {},
            }
            : {
                ...DefaultValues.SETTINGS_DATA,
                ...settingsFromProxy,
            };

        await services.storageService.setStorageCached({ settings: finalSettings });
        if (sendResponse) {
            sendResponse({
                success: true,
                initialized: !settings,
                updated: !!settings,
                settings: finalSettings,
                timestamp: new Date().toISOString(),
            });
        }
    } catch (error) {
        console.error("[handleProxy] Error:", error);
        if (sendResponse) {
            sendResponse({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString(),
            });
        }
    }
}

