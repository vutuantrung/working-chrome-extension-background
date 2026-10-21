import * as services from "../../services";

export function onProxyErrorHandler(details: any) {
    const now = Date.now();
    // Throttle storage writes to avoid spam.
    if (now - services.proxyServices.getLastProxyErrorWriteAt() < 3000) return;
    services.proxyServices.setLastProxyErrorWriteAt(now);

    try {
        // Only mark error when proxy is actually in fixed_servers mode.
        const proxyApi: any = (chrome as any)?.proxy?.settings;
        if (!proxyApi?.get) {
            services.proxyServices.setProxyHealth({
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

            services.proxyServices.setProxyHealth({
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