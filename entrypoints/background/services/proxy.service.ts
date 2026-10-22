import * as services from "../services";
import * as helpers from "../utils/helpers";
import { readTrimmedString } from "../utils/tools";
import { Message, ProxyAuthCredentials, ProxyHealth, Settings } from "../types/types";
import { chromeApi } from "../infrastructure/chrome-api/chrome-api";
import { DefaultValues, Constants } from "../utils/constants";

interface Proxy {
    host: string;
    port: string
}

let lastProxyErrorWriteAt = 0;
export function getLastProxyErrorWriteAt(): number { return lastProxyErrorWriteAt; }
export function setLastProxyErrorWriteAt(value: number): void { lastProxyErrorWriteAt = value; }

export function clearProxy(): void {
    chromeApi.proxy.settings.clear({ scope: "regular" }, () => {
        console.log("Proxy cleared.");
    });

    setProxyHealth({
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

    setProxyHealth({
        state: "ok",
        updatedAt: Date.now(),
        reason: "proxy_set",
        error: undefined,
        details: undefined,
        lastErrorAt: undefined,
    });

    try { Promise.resolve(handleProxyHealthCheck()).catch(() => { }); }
    catch { }
}

export function getCachedProxyHealth(): ProxyHealth | undefined {
    try {
        return (services.storageServices.getStorageCache() as any)?.proxyHealth as ProxyHealth | undefined;
    } catch {
        return undefined;
    }
}

export function setProxyHealth(patch: Partial<ProxyHealth>) {
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
        chromeApi.storage.local.set({ proxyHealth: next });

        // Keep cache in sync even if storage event is delayed.
        const cache = services.storageServices.getStorageCache();
        if (cache) {
            (cache as any).proxyHealth = next;
        }
    } catch { }
}

export async function handleProxyHealthCheck() {
    const startedAt = Date.now();
    const getProxyValue = async (): Promise<chrome.proxy.ProxyConfig | null> => {
        const proxySettings = chromeApi.proxy.settings;
        if (!proxySettings) return null;

        return new Promise((resolve) => {
            proxySettings.get({ incognito: false }, (details) => {
                resolve(details?.value ?? null);
            });
        });
    };

    const proxyValue = await getProxyValue();
    const prevHealth = getCachedProxyHealth();
    const prevFailures = prevHealth?.consecutiveFailures ?? 0;

    // If proxy isn't active, keep state as OK (Restart button won't show anyway because proxy won't match).
    if (!proxyValue || proxyValue.mode !== "fixed_servers") {
        setProxyHealth({
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
            setProxyHealth({
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
            } satisfies Partial<ProxyHealth>;

            // Avoid false positives (e.g. transient errors right after applying proxy).
            // Only enter hard error state after 2 consecutive failures.
            if (consecutiveFailures < 2) {
                setProxyHealth({
                    ...basePatch,
                    state: "ok",
                    reason: "alarm_check_bad_status_soft",
                });

                setTimeout(() => {
                    try { void handleProxyHealthCheck(); }
                    catch { }
                }, 5000);
            } else {
                setProxyHealth({
                    ...basePatch,
                    state: "error",
                });
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
        } satisfies Partial<ProxyHealth>;

        if (consecutiveFailures < 2) {
            setProxyHealth({
                ...basePatch,
                state: "ok",
                reason: "alarm_check_failed_soft",
            });

            setTimeout(() => {
                try { void handleProxyHealthCheck(); }
                catch { }
            }, 5000);
        } else {
            setProxyHealth({
                ...basePatch,
                state: "error",
            });
        }
    } finally {
        clearTimeout(timeoutId);
    }
}

export function onProxyErrorHandler(details: any) {
    const now = Date.now();
    // Throttle storage writes to avoid spam.
    if (now - lastProxyErrorWriteAt < 3000) return;
    lastProxyErrorWriteAt = now;

    try {
        // Only mark error when proxy is actually in fixed_servers mode.
        const proxyApi: any = chromeApi?.proxy?.settings;
        if (!proxyApi?.get) {
            setProxyHealth({
                state: "error",
                updatedAt: now,
                lastErrorAt: now,
                consecutiveFailures: 2,
                error: details?.error,
                details,
                reason: "proxy_error",
            });
            return;
        }

        proxyApi.get({ incognito: false }, (current: any) => {
            const value = current?.value;
            if (value?.mode !== "fixed_servers") return;

            setProxyHealth({
                state: "error",
                updatedAt: now,
                lastErrorAt: now,
                consecutiveFailures: 2,
                error: details?.error,
                details,
                reason: "proxy_error",
            });
        });
    } catch { }
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
            await chromeApi.storage.local.set({ activeProxy: proxyActive ? proxyConfig : {} });
        } catch { }

        const { settings } = await services.storageServices.getStorageCachedByKeys(["settings"]);
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

        await chromeApi.storage.local.set({ settings: finalSettings });
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

export function extractProxyAuthCredentials(proxyLike: any): ProxyAuthCredentials | null {
    if (!proxyLike || typeof proxyLike !== "object") return null;

    const candidates: Array<{ u: any; p: any }> = [
        { u: proxyLike.username, p: proxyLike.password },
        { u: proxyLike.user, p: proxyLike.pass },
        { u: proxyLike.user, p: proxyLike.password },
        { u: proxyLike.login, p: proxyLike.password },
        { u: proxyLike.proxy_username, p: proxyLike.proxy_password },
        { u: proxyLike.proxyUser, p: proxyLike.proxyPass },
        { u: proxyLike.usr, p: proxyLike.pwd },
        { u: proxyLike.auth?.username, p: proxyLike.auth?.password },
        { u: proxyLike.credentials?.username, p: proxyLike.credentials?.password },
    ];

    for (const c of candidates) {
        const username = readTrimmedString(c.u);
        const password = readTrimmedString(c.p);
        if (username && password) return { username, password };
    }

    const urlRaw = readTrimmedString(
        proxyLike.url ||
        proxyLike.proxy_url ||
        proxyLike.proxyUrl ||
        proxyLike.proxy,
    );
    if (urlRaw) {
        try {
            const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(urlRaw)
                ? urlRaw
                : `http://${urlRaw}`;
            const u = new URL(withScheme);
            const username = readTrimmedString(decodeURIComponent(u.username || ""));
            const password = readTrimmedString(decodeURIComponent(u.password || ""));
            if (username && password) return { username, password };
        } catch { }
    }

    return null;
}
