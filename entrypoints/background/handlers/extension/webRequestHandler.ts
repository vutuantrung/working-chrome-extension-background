import * as helpers from "../../utils/helpers";
import { ApplicationServices } from "../../application-services";

export function createwebRequestOnAuthRequiredHandler(applicationServices: ApplicationServices) {
    return (
        details: any,
        callback?: (response: chrome.webRequest.BlockingResponse
        ) => void) => {
        return webRequestOnAuthRequiredHandlerInternal(applicationServices, details, callback);
    };
}

function webRequestOnAuthRequiredHandlerInternal(
    applicationServices: ApplicationServices,
    details: any,
    callback?: (response: chrome.webRequest.BlockingResponse) => void
): chrome.webRequest.BlockingResponse | undefined {
    // Only handle proxy auth challenges; leave site auth challenges untouched.
    if (!details?.isProxy) {
        // callback();
        return;
    }

    const keys = ["activeProxy", "extensionProxy", "personaProxy", "settings"];
    applicationServices.storage?.getStorageCachedByKeys(keys).then((result) => {
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