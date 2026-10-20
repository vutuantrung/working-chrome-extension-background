import { State } from "./types/types";
import { isSupportedPlatformUrl } from "./helpers/tools";
import { PLATFORM_TAB_GLOBS } from "./helpers/constants";
import { chromeApi } from "./infrastructure/chrome-api/chrome-api";

export async function ensureFacebookProfileIdBootstrapInstalled(tabId: number, options?: { force?: boolean }): Promise<{ injected: boolean }> {
  try {
    const bootstrapToken = options?.force ? String(Date.now()) : "default";
    await chromeApi.scripting.executeScript({
      target: { tabId },
      func: (token: string) => {
        try {
          const g = globalThis as any;
          // Allow re-running after logout/login by using a changing token.
          // Also prevent duplicate intervals by tracking a single timer.
          const currentToken = g.__fbProfileIdBootstrapToken;
          const tokenChanged = currentToken !== token;

          if (!g.__fbProfileIdBootstrapInstalled) {
            g.__fbProfileIdBootstrapInstalled = true;
          }

          if (tokenChanged) {
            g.__fbProfileIdBootstrapToken = token;
            g.__fbProfileIdFound = undefined;
            if (g.__fbProfileIdBootstrapTimer) {
              window.clearInterval(g.__fbProfileIdBootstrapTimer);
              g.__fbProfileIdBootstrapTimer = null;
            }
          } else {
            // Same token: if we already found it, or a timer is running, do nothing.
            if (g.__fbProfileIdFound) return;
            if (g.__fbProfileIdBootstrapTimer) return;
          }

          const KEY = "screen_time_period_logging_facebook";
          const MAX_TRIES = 90;
          const INTERVAL_MS = 1000;
          let tries = 0;

          const tryExtractAndSend = () => {
            try {
              const cachedDataString = window.localStorage.getItem(KEY) || "{}";
              const cachedDataJSON = JSON.parse(cachedDataString);
              const profileId = cachedDataJSON?.actorId;
              if (!profileId) return false;

              // Avoid re-sending the same value within the same token.
              if (g.__fbProfileIdFound === profileId) return true;
              g.__fbProfileIdFound = profileId;
              try {
                chromeApi.runtime.sendMessage(
                  {
                    type: "UPDATE_ARCHIVE",
                    inputs: { updateArchive: { profileId } },
                  },
                  () => {
                    // Prevent: Uncaught (in promise) Receiving end does not exist
                    void chromeApi.runtime.lastError;
                  },
                );
              } catch { }
              return true;
            } catch {
              return false;
            }
          };

          if (tryExtractAndSend()) return;

          const timer = window.setInterval(() => {
            tries++;
            const ok = tryExtractAndSend();
            if (ok || tries >= MAX_TRIES) {
              window.clearInterval(timer);
              if (g.__fbProfileIdBootstrapTimer === timer) {
                g.__fbProfileIdBootstrapTimer = null;
              }
            }
          }, INTERVAL_MS);

          g.__fbProfileIdBootstrapTimer = timer;
        } catch { }
      },
      args: [bootstrapToken],
    });

    return { injected: true };
  } catch (error) {
    console.warn("[ENSURE_FB_PROFILEID] executeScript error:", error);
    return { injected: false };
  }
}

export async function ensureFacebookGraphForwarderInstalled(tabId: number): Promise<{ injected: boolean }> {
  try {
    await chromeApi.scripting.executeScript({
      target: { tabId },
      func: () => {
        try {
          const g = globalThis as any;
          if (g.__fbGraphMessageForwarderInstalled) return;
          g.__fbGraphMessageForwarderInstalled = true;

          window.addEventListener("message", (event: MessageEvent<any>) => {
            if (event.source !== window) return;
            const data = event.data;
            if (
              data?.type === "FB_GRAPH_INTERCEPTED" &&
              data?.source === "network-interceptor" &&
              data?.data?.responseText
            ) {
              chromeApi.runtime.sendMessage(
                {
                  type: "BODY_DATA_INTERCEPTED",
                  data: data.data,
                },
                () => {
                  void chromeApi.runtime.lastError;
                },
              );
            }
          });
        } catch { }
      },
    });

    return { injected: true };
  } catch (error) {
    console.warn("[ENSURE_FB_FORWARDER] executeScript error:", error);
    return { injected: false };
  }
}

export async function ensureFacebookGraphInterceptorInstalled(tabId: number): Promise<{ injected: boolean }> {
  // Best-effort: inject into MAIN world; the injected function is idempotent via a window flag.
  try {
    await chromeApi.scripting.executeScript({
      target: { tabId },
      world: "MAIN" as any,
      func: () => {
        try {
          const w = window as any;
          if (w.__fbGraphInterceptorInstalled) return;
          w.__fbGraphInterceptorInstalled = true;

          const isPlatformConcerned = (url: string) => {
            if (!url) return false;
            if (url.includes("/graphql/query")) return true;
            if (url.includes("/api/graphql")) return true;
            if (url.includes("tiktok.com")) return true;
            if (url.includes("youtube.com")) return true;
            return false;
          };

          let interceptCount = 0;

          const XHR = XMLHttpRequest.prototype as any;
          const originalOpen = XHR.open;
          const originalSend = XHR.send;

          XHR.open = function (method: string, url: string) {
            this._Url = url;
            this._Method = method;

            return originalOpen.apply(this, arguments as any);
          };

          XHR.send = function (body: any) {
            if (isPlatformConcerned(this._Url)) {
              const originalOnReadyStateChange = this.onreadystatechange;
              this.onreadystatechange = function () {
                try {
                  if (
                    this.readyState === 4 &&
                    this.status === 200 &&
                    this.responseText
                  ) {
                    interceptCount++;
                    window.postMessage(
                      {
                        type: "FB_GRAPH_INTERCEPTED",
                        source: "network-interceptor",
                        data: {
                          postData: body,
                          url: this._Url,
                          method: this._Method,
                          responseText: this.responseText,
                          timestamp: Date.now(),
                          interceptCount,
                        },
                      },
                      "*",
                    );
                  }
                } catch { }

                if (originalOnReadyStateChange) {
                  return originalOnReadyStateChange.apply(this, arguments);
                }
              };
            }
            return originalSend.apply(this, arguments);
          };

          const originalFetch = window.fetch;
          window.fetch = async function (...args: any[]) {
            const url =
              typeof args[0] === "string"
                ? args[0]
                : (args[0] && args[0].url) || "";

            if (!isPlatformConcerned(url)) {
              return originalFetch.apply(this, args as any);
            }

            return originalFetch.apply(this, args as any).then((response) => {
              try {
                response
                  .clone()
                  .text()
                  .then((responseText) => {
                    if (!responseText) return;
                    interceptCount++;
                    window.postMessage(
                      {
                        type: "FB_GRAPH_INTERCEPTED",
                        source: "network-interceptor",
                        data: {
                          url,
                          method: (args[1] && args[1].method) || "GET",
                          responseText,
                          timestamp: Date.now(),
                          interceptCount,
                        },
                      },
                      "*",
                    );
                  })
                  .catch(() => { });
              } catch { }
              return response;
            });
          };
        } catch { }
      },
    });

    return { injected: true };
  } catch (error) {
    console.warn("[ENSURE_FB_INTERCEPTOR] executeScript error:", error);
    return { injected: false };
  }
}

export async function bootstrapExistingFacebookTabs(options?: { forceProfileIdBootstrap?: boolean }): Promise<void> {
  const tabs = await chromeApi.tabs.query({ url: PLATFORM_TAB_GLOBS });
  const targetTabs = (tabs || []).filter((t) => isSupportedPlatformUrl(t.url));
  if (targetTabs.length === 0) {
    console.log("[SETUP] No existing Facebook tabs to bootstrap");
    return;
  }

  for (const tab of targetTabs) {
    if (!tab.id) continue;

    // Check if tab is ready (not loading) to avoid disrupting UI
    if (tab.status !== State.COMPLETE) {
      console.log("[SETUP] Skipping tab", tab.id, "- still loading");
      continue;
    }

    // 1) Install forwarder in isolated world (replaces missing content script until reload)
    await ensureFacebookGraphForwarderInstalled(tab.id).catch(() => { });
    // 2) Install interceptor in MAIN world
    await ensureFacebookGraphInterceptorInstalled(tab.id).catch(() => { });
    // 3) Bootstrap profileId extraction without requiring a reload
    await ensureFacebookProfileIdBootstrapInstalled(tab.id, {
      force: options?.forceProfileIdBootstrap === true,
    }).catch(() => { });
  }
}

export async function cleanupFacebookTabs(): Promise<void> {
  try {
    const tabs = await chromeApi.tabs.query({
      url: ["*://*.facebook.com/*", "*://*.fb.com/*"],
    });

    for (const tab of tabs) {
      if (tab.id) {
        chromeApi.tabs
          .sendMessage(tab.id, { type: "CLEANUP_AFTER_LOGOUT" })
          .catch(() => { });
      }
    }
  } catch (error) {
    console.warn("[cleanupFacebookTabs] Failed:", error);
  }
}
