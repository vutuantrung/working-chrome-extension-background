import type { ApplicationServices } from "../../application-services";
import type { Message } from "../../types/types";

type RuntimeListener = (
    message: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void,
) => boolean;

export function createDeferredRuntimeListener(
    servicesReady: Promise<ApplicationServices>,
    createHandler: (services: ApplicationServices) => RuntimeListener,
): RuntimeListener {
    let handler: RuntimeListener | undefined;
    const handlerReady = servicesReady.then(services => {
        handler = createHandler(services);
        return handler;
    });
    // Observe initialization failures even if no message arrives.
    void handlerReady.catch(() => undefined);

    return (message, sender, sendResponse) => {
        if (handler) return handler(message, sender, sendResponse);
        void handlerReady.then(readyHandler => {
            if (!readyHandler(message, sender, sendResponse)) {
                // The legacy handler does not need an asynchronous response.
                sendResponse();
            }
        }).catch(() => {
            sendResponse({ success: false, error: "Background initialization failed", code: "BACKGROUND_UNAVAILABLE" });
        });
        return true;
    };
}
