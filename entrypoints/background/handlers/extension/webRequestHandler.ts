import { extractProxyAuthCredentials } from "../../services/proxyServices";
import { getStorageCachedByKeys, getStorageCache } from "../../services/storageServices";

export function webRequestOnAuthRequiredHandler(
    details: any,
    callback?: (response: chrome.webRequest.BlockingResponse) => void
): chrome.webRequest.BlockingResponse | undefined {
    // Only handle proxy auth challenges; leave site auth challenges untouched.
    if (!details?.isProxy) {
        // callback();
        return;
    }
    getStorageCachedByKeys([
        "activeProxy",
        "extensionProxy",
        "personaProxy",
        "settings",
    ]).then((result) => {
        const { activeProxy, extensionProxy, personaProxy, settings } = result;
        const creds =
            extractProxyAuthCredentials(activeProxy) ||
            extractProxyAuthCredentials(extensionProxy) ||
            extractProxyAuthCredentials(personaProxy) ||
            extractProxyAuthCredentials((settings as any)?.proxy);

        if (creds && callback) {
            callback({ authCredentials: creds });
            return;
        }
    }).catch((_ignore: any) => { });

    // callback();
}