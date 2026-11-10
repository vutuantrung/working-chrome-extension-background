import { ApplicationServices } from "../../application-services";

export function createOnProxyErrorHandler(applicationServices: ApplicationServices) {
    return (details: any) => onProxyErrorHandlerInternal(applicationServices, details)
}

export function onProxyErrorHandlerInternal(
    applicationServices: ApplicationServices,
    details: any
) {
    try {
        const now = Date.now();
        // Throttle storage writes to avoid spam.
        if (!applicationServices.proxy?.getLastProxyErrorWriteAt()) return;
        if (now - applicationServices.proxy.getLastProxyErrorWriteAt() < 3000) return;
        applicationServices.proxy?.setLastProxyErrorWriteAt(now);

        // Only mark error when proxy is actually in fixed_servers mode.
        const proxyApi: any = applicationServices?.proxy?.getProxySettings();
        if (!proxyApi?.get) {
            applicationServices.proxy?.storeProxyData({
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

            applicationServices.proxy?.storeProxyData({
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