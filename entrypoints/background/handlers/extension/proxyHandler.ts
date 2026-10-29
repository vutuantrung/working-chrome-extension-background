import { chromeApi } from "../../infrastructure/chrome-api/chrome-api";
import * as services from "../../services";

export function onProxyErrorHandler(details: any) {
    try {
        const now = Date.now();
        // Throttle storage writes to avoid spam.
        if (now - services.proxyService.getLastProxyErrorWriteAt() < 3000) return;
        services.proxyService.setLastProxyErrorWriteAt(now);

        // Only mark error when proxy is actually in fixed_servers mode.
        const proxyApi: any = chromeApi?.proxy?.settings;
        if (!proxyApi?.get) {
            services.proxyService.storeProxyData({
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

            services.proxyService.storeProxyData({
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