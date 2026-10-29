import * as services from "../../services";
import * as helpers from "../../utils/helpers";

export function webRequestOnAuthRequiredHandler(
    details: any,
    callback?: (response: chrome.webRequest.BlockingResponse) => void
): chrome.webRequest.BlockingResponse | undefined {
    // Only handle proxy auth challenges; leave site auth challenges untouched.
    if (!details?.isProxy) {
        // callback();
        return;
    }
    services.storageService.getStorageCachedByKeys([
        "activeProxy",
        "extensionProxy",
        "personaProxy",
        "settings",
    ]).then((result) => {
        const { activeProxy, extensionProxy, personaProxy, settings } = result;
        const creds =
            helpers.proxy.extractProxyAuthCredentials(activeProxy) ||
            helpers.proxy.extractProxyAuthCredentials(extensionProxy) ||
            helpers.proxy.extractProxyAuthCredentials(personaProxy) ||
            helpers.proxy.extractProxyAuthCredentials((settings as any)?.proxy);

        if (creds && callback) {
            callback({ authCredentials: creds });
            return;
        }
    }).catch((_ignore: any) => { });

    // callback();
}