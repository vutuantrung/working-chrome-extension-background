import { Message, ProxyHealth, Settings } from "../types/types";
import { Constants, DefaultValues } from "../utils/constants";
import { BrowserApplicationProxyApi } from "./proxy.api";
import { StorageService } from "./storage.services";

import * as helpers from "../utils/helpers";

interface Proxy {
    host: string;
    port: string;
}

export class ProxyService {
    constructor(
        private browserProxyApi: BrowserApplicationProxyApi,
        private storageService: StorageService
    ) { }

    private _lastProxyErrorWriteAt = 0;

    getLastProxyErrorWriteAt() {
        return this._lastProxyErrorWriteAt;
    }

    setLastProxyErrorWriteAt(timestamp: number) {
        this._lastProxyErrorWriteAt = timestamp;
    }

    getBrowserApi() {
        return this.browserProxyApi;
    }

    getProxySettings() {
        return this.browserProxyApi.getProxySettings();
    }

    clearProxy() {
        this.browserProxyApi.clear({ scope: "regular" }, () => {
            console.log("Proxy cleared.");
        });
    }

    setProxy(httpProxy?: Proxy, httpsProxy?: Proxy) {
        const rules: any = { bypassList: ["localhost", "127.0.0.1"] };

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

        this.browserProxyApi.getProxySettings()
            .set({
                scope: "regular",
                value: {
                    mode: "fixed_servers",
                    rules: rules,
                }
            }, () => {
                console.log("Proxy is/are set");
            });

        this.storeProxyData({
            state: "ok",
            updatedAt: Date.now(),
            reason: "proxy_set",
            error: undefined,
            details: undefined,
            lastErrorAt: undefined,
        });

        try { Promise.resolve(this.checkProxyStatus()).catch(() => { }); }
        catch { }
    }

    storeProxyData(patch: Partial<ProxyHealth>) {
        const storage = this.storageService.getCachedStorage();
        const prev = storage.proxyHealth;

        const next: ProxyHealth = {
            ...(prev || {}),
            state: "ok",
            updatedAt: Date.now(),
            consecutiveFailures: prev?.consecutiveFailures ?? 0,
            ...patch,
        };
        this.storageService.setStorageCached({ proxyHealth: next }).catch(() => { });
    }

    async checkProxyStatus(): Promise<void> {
        const startedAt = Date.now();

        const proxySettings = this.browserProxyApi.getProxySettings();
        if (!proxySettings) return;

        const details = await proxySettings.get({ incognito: false });
        const proxyValue = details?.value ?? null;

        const cachedStorage = this.storageService.getCachedStorage();
        const prevHealth = cachedStorage?.proxyHealth;
        const prevFailures = prevHealth?.consecutiveFailures ?? 0;

        // If proxy isn't active, keep state as OK (Restart button won't show anyway because proxy won't match).
        if (!proxyValue || proxyValue.mode !== "fixed_servers") {
            this.storeProxyData({
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
                this.storeProxyData({
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
                    this.storeProxyData({
                        ...basePatch,
                        state: "ok",
                        reason: "alarm_check_bad_status_soft",
                    });

                    setTimeout(() => { try { void this.checkProxyStatus(); } catch { } }, 5000);
                } else {
                    this.storeProxyData({ ...basePatch, state: "error" });
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
                this.storeProxyData({
                    ...basePatch,
                    state: "ok",
                    reason: "alarm_check_failed_soft",
                });

                setTimeout(() => { try { void this.checkProxyStatus(); } catch { } }, 5000);
            } else {
                this.storeProxyData({ ...basePatch, state: "error" });
            }
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async handleProxy(message: Message, sendResponse: (resp: any) => void) {
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
                    this.setProxy(httpProxy, httpsProxy);
                }
            } else if (!proxyConfig || (typeof proxyConfig === "object" && !Object.keys(proxyConfig).length) || proxyConfig === "system") {
                this.clearProxy();
            }

            // Persist effective proxy so popup can reflect changes (Restart button logic depends on it).
            try {
                const proxyActive = helpers.proxy.isActiveProxy(proxyConfig);
                await this.storageService.setStorageCached({ activeProxy: proxyActive ? proxyConfig : {} });
            } catch { }

            const { settings } = await this.storageService.getStorageCachedByKeys(["settings"]);
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

            await this.storageService.setStorageCached({ settings: finalSettings });
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
}
