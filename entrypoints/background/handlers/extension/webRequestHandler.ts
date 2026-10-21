import * as services from "../../services";

export function webRequestOnAuthRequiredHandler(
    details: any,
    callback?: (response: chrome.webRequest.BlockingResponse) => void
): chrome.webRequest.BlockingResponse | undefined {
    // Only handle proxy auth challenges; leave site auth challenges untouched.
    if (!details?.isProxy) {
        // callback();
        return;
    }
    services.storageServices.getStorageCachedByKeys([
        "activeProxy",
        "extensionProxy",
        "personaProxy",
        "settings",
    ]).then((result) => {
        const { activeProxy, extensionProxy, personaProxy, settings } = result;
        const creds =
            services.proxyServices.extractProxyAuthCredentials(activeProxy) ||
            services.proxyServices.extractProxyAuthCredentials(extensionProxy) ||
            services.proxyServices.extractProxyAuthCredentials(personaProxy) ||
            services.proxyServices.extractProxyAuthCredentials((settings as any)?.proxy);

        if (creds && callback) {
            callback({ authCredentials: creds });
            return;
        }
    }).catch((_ignore: any) => { });

    // callback();
}