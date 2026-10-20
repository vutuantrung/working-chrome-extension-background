import { ProxyService } from "../../services/proxyServices";
import { StorageService } from "../../services/storageServices";

export function webRequestOnAuthRequiredHandler(
    details: any,
    callback?: (response: chrome.webRequest.BlockingResponse) => void
): chrome.webRequest.BlockingResponse | undefined {
    // Only handle proxy auth challenges; leave site auth challenges untouched.
    if (!details?.isProxy) {
        // callback();
        return;
    }

    const proxyService = ProxyService.getInstance();
    StorageService.getInstance().getStorageCachedByKeys([
        "activeProxy",
        "extensionProxy",
        "personaProxy",
        "settings",
    ]).then((result) => {
        const { activeProxy, extensionProxy, personaProxy, settings } = result;
        const creds =
            proxyService.extractProxyAuthCredentials(activeProxy) ||
            proxyService.extractProxyAuthCredentials(extensionProxy) ||
            proxyService.extractProxyAuthCredentials(personaProxy) ||
            proxyService.extractProxyAuthCredentials((settings as any)?.proxy);

        if (creds && callback) {
            callback({ authCredentials: creds });
            return;
        }
    }).catch((_ignore: any) => { });

    // callback();
}