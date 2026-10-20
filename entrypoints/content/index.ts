import {
  autoFetchProfileId,
  handleGetFbProfileIdMessage,
} from "./facebook/get-fb-profile-id";
import {
  cancelAllTasks,
  cancelTask,
  handleInitTaskMessage,
  resetCancelState,
} from "./init-task";
import { handleJoinGroupsMessage } from "./facebook/join-groups";
import { handleScrollGroupsMessage } from "./facebook/scroll-groups";
import { handleScrollUrlsMessage } from "./facebook/scroll-urls";
import { simulateHumanClick } from "./helpers/simulate-click";
import {
  handleEnhanceSpanMessage,
  handleInjectHoverPostOwner,
  handleInjectPostOwner,
} from "./facebook/ui-ele-inject";
import {
  fetchAllFbJoinedGroups,
  fetchAllFbPendingGroups,
} from "./facebook/fb-joined-groups-fetcher";
import { autoClickAboutButton } from "./youtube/click-about-button";
import { autoClickTranscriptButton } from "./youtube/click-transcript-button";

type Platform = "facebook" | "tiktok" | "threads" | "x" | "youtube";

interface PlatformConfig {
  name: Platform;
  matches: (url: string) => boolean;
}

const PLATFORMS: PlatformConfig[] = [
  {
    name: "facebook",
    matches: (url) => /^https?:\/\/(www\.|web\.)?facebook\.com\//i.test(url),
  },
  {
    name: "tiktok",
    matches: (url) =>
      /^https?:\/\/(www\.)?(m\.)?(vt\.)?(vm\.)?tiktok\.com\/*.*$/i.test(url),
  },
  {
    name: "threads",
    matches: (url) => /^https?:\/\/(www\.)?threads\.com\//i.test(url),
  },
  {
    name: "x",
    matches: (url) => /^https?:\/\/(www\.)?(x|twitter)\.com\//i.test(url),
  },
  {
    name: "youtube",
    matches: (url) => /^https?:\/\/(www\.)?youtube\.com\//i.test(url),
  },
];

function detectPlatform(url: string): Platform | null {
  return PLATFORMS.find((p) => p.matches(url))?.name ?? null;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const evaluateXPathNode = (xpath: string): Node | null => {
  try {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null,
    );
    return result.singleNodeValue;
  } catch {
    return null;
  }
};

const getTextFromNode = (node: Node | null): string => {
  if (!node) return "";
  const el = node as any;
  return ((el?.textContent ?? "") as string).trim();
};

const UPDATE_BANNER_ID = "__hydra_extension_update_banner";

const waitForBody = async (maxWaitMs = 5000): Promise<boolean> => {
  const startedAt = Date.now();
  while (!document.body) {
    if (Date.now() - startedAt > maxWaitMs) return false;
    await sleep(50);
  }
  return true;
};

const showExtensionUpdateBanner = async (payload: any) => {
  const ok = await waitForBody();
  if (!ok) return;

  if (document.getElementById(UPDATE_BANNER_ID)) return;

  const currentVersion = payload?.currentVersion ?? "";
  const latestVersion = payload?.latestVersion ?? "";

  const wrapper = Object.assign(document.createElement("div"), {
    id: UPDATE_BANNER_ID,
  });
  Object.assign(wrapper.style, {
    position: "fixed",
    top: "28px",
    right: "28px",
    zIndex: "2147483647",
    background: "#ffffff",
    color: "#213547",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
    boxShadow:
      "0 8px 22px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.06) inset",
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
    fontSize: "16px",
    maxWidth: "320px",
  });

  const title = document.createElement("div");
  title.textContent = "Lerna Lakes Extension Update Available!";
  Object.assign(title.style, {
    fontWeight: "600",
    marginBottom: "6px",
    color: "#646cff",
  });

  const message = document.createElement("div");
  message.textContent = `New version ${latestVersion} (current ${currentVersion}). Please update via the service notification in the Lerna Lakes app.`;
  Object.assign(message.style, { opacity: "0.9", fontSize: "13px" });

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Dismiss";
  Object.assign(closeBtn.style, {
    marginTop: "8px",
    background: "#f9fafb",
    color: "#213547",
    border: "1px solid #e5e7eb",
    padding: "4px 8px",
    borderRadius: "6px",
    cursor: "pointer",
  });
  closeBtn.onclick = () => wrapper.remove();

  wrapper.append(title, message, closeBtn);
  document.body.appendChild(wrapper);
  setTimeout(() => wrapper.remove(), 15_000);
};

const ensureTabIdBadge = async () => {
  const g = globalThis as any;
  if (g.__hydraTabIdBadgeInstalled) return;

  try {
    const resp = await chrome.runtime.sendMessage({ type: "GET_MY_TAB_ID" });
    const tabId: number | undefined = resp?.tabId;
    if (typeof tabId !== "number") return;

    const POS_KEY = "__hydra_tabid_badge_pos";
    const readPos = (): { left: number; top: number } | null => {
      try {
        const raw = localStorage.getItem(POS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (
          typeof parsed?.left === "number" &&
          typeof parsed?.top === "number" &&
          Number.isFinite(parsed.left) &&
          Number.isFinite(parsed.top)
        )
          return { left: parsed.left, top: parsed.top };
        return null;
      } catch {
        return null;
      }
    };
    const writePos = (left: number, top: number) => {
      try {
        localStorage.setItem(POS_KEY, JSON.stringify({ left, top }));
      } catch {}
    };

    const mount = () => {
      if (document.getElementById("__hydra_tabid_badge")) return;

      const container = document.createElement("div");
      container.id = "__hydra_tabid_badge";
      Object.assign(container.style, {
        position: "fixed",
        top: "10px",
        left: "50%",
        right: "auto",
        transform: "translateX(-50%)",
        zIndex: "2147483647",
        background: "rgba(24, 119, 242, 0.92)",
        color: "#fff",
        fontSize: "12px",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
        padding: "6px 8px",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.22)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        pointerEvents: "auto",
        cursor: "move",
        userSelect: "none",
        boxShadow:
          "0 6px 18px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.12) inset",
      });

      const saved = readPos();
      if (saved) {
        container.style.left = `${saved.left}px`;
        container.style.top = `${saved.top}px`;
        container.style.right = "auto";
        container.style.transform = "none";
      }

      const label = document.createElement("div");
      label.textContent = `Tab ID: ${tabId}`;

      const close = document.createElement("button");
      Object.assign(close, { type: "button", textContent: "×", title: "Hide" });
      Object.assign(close.style, {
        background: "transparent",
        border: "none",
        color: "#fff",
        cursor: "pointer",
        fontSize: "16px",
        lineHeight: "12px",
        padding: "0 2px",
        opacity: "0.9",
      });
      close.onclick = () => container.remove();

      // Drag-to-move
      let dragging = false;
      let startX = 0,
        startY = 0,
        startLeft = 0,
        startTop = 0;
      const clamp = (v: number, min: number, max: number) =>
        Math.min(Math.max(v, min), max);

      container.addEventListener("pointerdown", (ev) => {
        if ((ev.target as HTMLElement)?.tagName === "BUTTON") return;
        dragging = true;
        container.setPointerCapture(ev.pointerId);
        const rect = container.getBoundingClientRect();
        startX = ev.clientX;
        startY = ev.clientY;
        startLeft = rect.left;
        startTop = rect.top;
        container.style.left = `${rect.left}px`;
        container.style.top = `${rect.top}px`;
        container.style.right = "auto";
        container.style.transform = "none";
        ev.preventDefault();
      });

      container.addEventListener("pointermove", (ev) => {
        if (!dragging) return;
        const rect = container.getBoundingClientRect();
        const left = clamp(
          startLeft + ev.clientX - startX,
          0,
          Math.max(0, window.innerWidth - rect.width),
        );
        const top = clamp(
          startTop + ev.clientY - startY,
          0,
          Math.max(0, window.innerHeight - rect.height),
        );
        container.style.left = `${left}px`;
        container.style.top = `${top}px`;
      });

      const endDrag = (ev: PointerEvent) => {
        if (!dragging) return;
        dragging = false;
        try {
          container.releasePointerCapture(ev.pointerId);
        } catch {}
        const rect = container.getBoundingClientRect();
        writePos(rect.left, rect.top);
      };

      container.addEventListener("pointerup", endDrag);
      container.addEventListener("pointercancel", endDrag);
      container.append(label, close);
      (document.documentElement ?? document.body)?.appendChild(container);
    };

    const tryMount = () =>
      document.documentElement ? mount() : setTimeout(tryMount, 50);
    tryMount();

    g.__hydraTabIdBadgeInstalled = true;
  } catch {}
};

const findAvatarButton = (): HTMLElement | null => {
  const selectors = [
    'div[role="button"][aria-label="Trang cá nhân của bạn"]',
    'div[role="button"][aria-label="Your profile"]',
    'div[role="button"][aria-label="Your Profile"]',
    'a[role="link"][aria-label="Trang cá nhân của bạn"]',
    'a[role="link"][aria-label="Your profile"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) return el;
  }
  return null;
};

const getAccountNameFromAvatarMenu = async (): Promise<string> => {
  const normalizeName = (txt: string) =>
    (txt || "").replace(/\s+/g, " ").trim();

  const isVisible = (el: HTMLElement | null): boolean => {
    if (!el) return false;
    try {
      if (el.getClientRects().length === 0) return false;
      const { display, visibility } = window.getComputedStyle(el);
      return display !== "none" && visibility !== "hidden";
    } catch {
      return true;
    }
  };

  const getOpenMenuLikeContainers = (): HTMLElement[] =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        'div[role="dialog"], div[role="menu"]',
      ),
    ).filter(isVisible);

  const isBlockingModalOpen = (): boolean => {
    const modal = document.querySelector<HTMLElement>(
      'div[role="dialog"][aria-modal="true"], [role="dialog"][aria-modal="true"]',
    );
    return !!modal && isVisible(modal);
  };

  const isAnyMenuLikeOpen = () => getOpenMenuLikeContainers().length > 0;

  const isBadName = (txt: string) => {
    const t = normalizeName(txt).toLowerCase();
    if (!t) return true;
    if (
      [
        "facebook",
        "your profile",
        "trang cá nhân của bạn",
        "profile",
        "trang cá nhân",
      ].includes(t)
    )
      return true;
    if (t.startsWith("facebook")) return true;
    return false;
  };

  const XPATHS = [
    "/html/body/div[1]/div/div[1]/div/div[2]/div[5]/div[2]/div/div/div[1]/div[1]/div/div/div/div/div/div/div/div/div/div[1]/div/div/div[1]/div[1]/div/div/a/div[1]/div[2]/span",
    '//*[@id="mount_0_0_Zp"]/div/div[1]/div/div[2]/div[5]/div[2]/div/div/div[1]/div[1]/div/div/div/div/div/div/div/div/div/div[1]/div/div/div[1]/div[1]/div/div/a/div[1]/div[2]/span',
  ];

  const tryXPaths = (): string => {
    for (const xp of XPATHS) {
      const t = getTextFromNode(evaluateXPathNode(xp));
      if (t && !isBadName(t)) return normalizeName(t);
    }
    return "";
  };

  const extractNameFromContainers = (containers: HTMLElement[]): string => {
    for (const container of containers) {
      for (const span of Array.from(
        container.querySelectorAll<HTMLElement>("span"),
      )) {
        const txt = normalizeName(span.textContent || "");
        if (!txt || isBadName(txt)) continue;
        if (txt.length >= 2 && txt.length <= 60) return txt;
      }
    }
    return "";
  };

  // 1) Direct XPath
  const direct = tryXPaths();
  if (direct) return direct;

  // 2) Already-open menus (no UI side-effects)
  const fromOpenMenus = extractNameFromContainers(getOpenMenuLikeContainers());
  if (fromOpenMenus) return fromOpenMenus;

  // 3) Open avatar menu, retry, then close if we opened it
  const avatar = findAvatarButton();
  if (avatar && !isBlockingModalOpen()) {
    const wasOpenBefore = isAnyMenuLikeOpen();
    try {
      simulateHumanClick(avatar);
    } catch {}

    let name = "";
    for (let i = 0; i < 12 && !name; i++) {
      name = tryXPaths();
      if (!name) await sleep(250);
    }
    if (!name) name = extractNameFromContainers(getOpenMenuLikeContainers());

    const openedByUs = !wasOpenBefore && isAnyMenuLikeOpen();
    if (openedByUs)
      try {
        simulateHumanClick(avatar);
      } catch {}

    if (name) return name;
  }

  // 4) Fallback: profile links in dialogs/menus
  for (const container of Array.from(
    document.querySelectorAll<HTMLElement>(
      'div[role="dialog"], div[role="menu"]',
    ),
  )) {
    for (const link of Array.from(
      container.querySelectorAll<HTMLAnchorElement>("a"),
    )) {
      const href = link.getAttribute("href") || "";
      if (
        href.includes("/profile.php") ||
        href.includes("/me/") ||
        href.includes("facebook.com/profile")
      ) {
        const firstLine = (link.innerText || "")
          .trim()
          .split("\n")
          .map((s) => s.trim())
          .find(Boolean);
        if (firstLine && !isBadName(firstLine)) return normalizeName(firstLine);
      }
    }
  }

  return "";
};

const ensureLogoutMenuItemRemoved = () => {
  const g = globalThis as any;
  if (g.__hydraLogoutHiderInstalled) return;

  try {
    const normalize = (txt: string) =>
      txt.replace(/\s+/g, " ").trim().toLowerCase();
    const isLogoutText = (txt: string) =>
      ["đăng xuất", "log out", "logout"].includes(normalize(txt));

    const isVisible = (el: HTMLElement | null): boolean => {
      if (!el) return false;
      try {
        if (el.getClientRects().length === 0) return false;
        const { display, visibility } = window.getComputedStyle(el);
        return display !== "none" && visibility !== "hidden";
      } catch {
        return true;
      }
    };

    const getOpenMenuLikeContainers = (): HTMLElement[] =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          'div[role="menu"], div[role="dialog"]',
        ),
      )
        .filter(isVisible)
        .filter(
          (n) =>
            !!n.querySelector(
              '[role="menuitem"], [role="button"], a[role="link"], [tabindex]',
            ),
        );

    const findLogoutItem = (): HTMLElement | null => {
      for (const container of getOpenMenuLikeContainers()) {
        for (const span of Array.from(
          container.querySelectorAll<HTMLElement>("span"),
        )) {
          if (!span?.textContent || !isLogoutText(span.textContent)) continue;
          const clickable = span.closest<HTMLElement>(
            '[role="menuitem"], [role="button"], a[role="link"], [tabindex]',
          );
          if (clickable && container.contains(clickable)) return clickable;
          if (container.contains(span as any)) return span;
        }
      }
      return null;
    };

    const hideLogoutItem = (): boolean => {
      const el = findLogoutItem();
      if (!el) return false;
      if (el.getAttribute("data-hydra-logout-hidden") === "1") return true;
      el.setAttribute("data-hydra-logout-hidden", "1");
      Object.assign(el.style, {
        display: "none",
        pointerEvents: "none",
        opacity: "0",
      });
      return true;
    };

    const scheduleMicrotask = (fn: () => void) => {
      try {
        queueMicrotask(fn);
      } catch {
        Promise.resolve().then(fn);
      }
    };

    const runHideBurst = () => {
      try {
        hideLogoutItem();
        scheduleMicrotask(() => hideLogoutItem());
        setTimeout(() => hideLogoutItem(), 0);
        let frames = 0;
        const tick = () => {
          hideLogoutItem();
          if (++frames < 12) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      } catch {}
    };

    let lastRun = 0;
    const safeHideLogoutItem = () => {
      const now = Date.now();
      if (now - lastRun < 50) return;
      lastRun = now;
      hideLogoutItem();
    };

    const installInstantHideTriggers = () => {
      if (g.__hydraLogoutHiderInstantTriggersInstalled) return;
      const onUserOpenAccountMenu = (ev: Event) => {
        try {
          const avatarBtn = findAvatarButton();
          if (avatarBtn?.contains(ev.target as Node)) runHideBurst();
        } catch {}
      };
      document.addEventListener("pointerdown", onUserOpenAccountMenu, true);
      document.addEventListener("click", onUserOpenAccountMenu, true);
      g.__hydraLogoutHiderInstantTriggersInstalled = true;
    };

    const observer = new MutationObserver(safeHideLogoutItem);
    const startObserver = () => {
      if (!document.documentElement) return;
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
      installInstantHideTriggers();
      runHideBurst();
    };

    const tryStart = () =>
      document.documentElement ? startObserver() : setTimeout(tryStart, 50);
    tryStart();

    g.__hydraLogoutHiderInstalled = true;
  } catch {}
};

const installFbGraphForwarder = () => {
  const g = globalThis as any;
  if (g.__fbGraphMessageForwarderInstalled) {
    console.log(
      "[CONTENT SCRIPT] Message listener already installed (bootstrap forwarder)",
    );
    return;
  }

  window.addEventListener("message", (event: any) => {
    if (event.source !== window) return;
    if (
      event.data?.type !== "FB_GRAPH_INTERCEPTED" ||
      event.data?.source !== "network-interceptor"
    )
      return;
    const { url, method, responseText, timestamp, postData } = event.data.data;
    // console.log("[CONTENT SCRIPT] Intercepted FB GraphQL request");

    let requestPostData = null;
    if (url && ["/graphql/query"].includes(url)) {
      requestPostData = postData;
    }

    chrome.runtime
      .sendMessage({
        type: "BODY_DATA_INTERCEPTED",
        data: {
          url,
          method,
          responseText,
          timestamp,
          postData: requestPostData,
        },
      })
      .then(() => console.log("[CONTENT SCRIPT] Sent to background script"))
      .catch((err) =>
        console.error("[CONTENT SCRIPT] Error sending to background:", err),
      );
  });

  g.__fbGraphMessageForwarderInstalled = true;
};

const setupPlatformFeatures = async (platform: Platform) => {
  console.log(`[CONTENT SCRIPT] Setting up features for platform: ${platform}`);

  ensureTabIdBadge();
  chrome.runtime
    .sendMessage({ type: "ENSURE_FB_INTERCEPTOR" })
    .then((resp) => console.log("[CONTENT SCRIPT] Interceptor ensure:", resp))
    .catch((err) =>
      console.error("[CONTENT SCRIPT] Failed to ensure interceptor:", err),
    );
  installFbGraphForwarder();

  if (platform === "facebook") {
    ensureLogoutMenuItemRemoved();

    chrome.runtime.sendMessage({
      type: "CONTENT_READY",
      name: "getFbProfileId",
    });
    chrome.runtime.sendMessage({ type: "CONTENT_READY", name: "initTask" });
    chrome.runtime.sendMessage({ type: "CONTENT_READY", name: "joinGroups" });
    chrome.runtime.sendMessage({
      type: "CONTENT_READY",
      name: "scrollGroupsNoResponse",
    });
    chrome.runtime.sendMessage({ type: "CONTENT_READY", name: "scrollGroups" });
    chrome.runtime.sendMessage({ type: "CONTENT_READY", name: "scrollUrls" });

    setTimeout(() => autoFetchProfileId(), 3000);
  }

  if (platform === "tiktok") {
    // TikTok-only features
    // TODO: add tiktok-specific CONTENT_READY messages and auto-init calls here
    // e.g. chrome.runtime.sendMessage({ type: "CONTENT_READY", name: "tiktokTask" });
  }

  if (platform === "youtube") {
    chrome.runtime.sendMessage({
      type: "CONTENT_READY",
      name: "clickAboutButton",
    });
    chrome.runtime.sendMessage({
      type: "CONTENT_READY",
      name: "clickTranscriptButton",
    });
  }
};

const installMessageRouter = (platform: Platform) => {
  chrome.runtime.onMessage.addListener(
    (message: any, _sender, sendResponse) => {
      console.log("[CONTENT SCRIPT] Message received:", message);

      if (message?.type === "PING") {
        sendResponse({ ready: true });
        return true;
      }

      if (message?.type === "STOP_ALL_AUTOMATION") {
        cancelAllTasks();
        sendResponse({ success: true });
        return true;
      }

      if (message?.type === "STOP_TASK") {
        cancelTask(message?.taskId ?? message?.inputs?.taskId);
        sendResponse({ success: true });
        return true;
      }

      if (message?.type === "RESET_AUTOMATION_CANCEL") {
        resetCancelState();
        sendResponse({ success: true });
        return true;
      }

      if (message?.type === "SHOW_EXTENSION_UPDATE") {
        showExtensionUpdateBanner(message?.payload || {});
        sendResponse?.({ success: true });
        return true;
      }

      if (platform === "facebook") {
        if (message?.type === "GET_FB_ACCOUNT_CONTEXT") {
          (async () => {
            try {
              const name = await getAccountNameFromAvatarMenu();
              sendResponse?.({ ok: true, name });
            } catch (error: any) {
              sendResponse?.({
                ok: false,
                error: String(error?.message || error),
              });
            }
          })();
          return true;
        }

        if (message?.type === "FETCH_FB_JOINED_GROUPS") {
          (async () => {
            try {
              const accountId: string = message.accountId || "";
              const groups = await fetchAllFbJoinedGroups(accountId);
              sendResponse?.({ ok: true, groups });
            } catch (error: any) {
              console.error(
                "[CONTENT SCRIPT] FETCH_FB_JOINED_GROUPS error:",
                error,
              );
              sendResponse?.({
                ok: false,
                error: String(error?.message || error),
              });
            }
          })();
          return true;
        }

        if (message?.type === "FETCH_FB_PENDING_GROUPS") {
          (async () => {
            try {
              const accountId: string = message.accountId || "";
              const groups = await fetchAllFbPendingGroups(accountId);
              sendResponse?.({ ok: true, groups });
            } catch (error: any) {
              console.error(
                "[CONTENT SCRIPT] FETCH_FB_PENDING_GROUPS error:",
                error,
              );
              sendResponse?.({
                ok: false,
                error: String(error?.message || error),
              });
            }
          })();
          return true;
        }

        if (!message.activityName && !message.nextTask && message.platform) {
          handleInitTaskMessage(message)
            .then(() => {
              console.log("[CONTENT SCRIPT] Init task completed");
              sendResponse({ success: true, handled: true });
            })
            .catch((error) => {
              console.error("[CONTENT SCRIPT] Init task error:", error);
              sendResponse({ success: false, error: error.message });
            });
          return true;
        }

        if (message.taskId === "getFbProfileId") {
          handleGetFbProfileIdMessage(message)
            .then((result) => {
              console.log(
                "[CONTENT SCRIPT] Profile ID handler completed:",
                result,
              );
              sendResponse({ success: true, result });
            })
            .catch((error) => {
              console.error(
                "[CONTENT SCRIPT] Profile ID handler error:",
                error,
              );
              sendResponse({ success: false, error: error.message });
            });
          return true;
        }

      if (message.activityName === "JOIN_GROUPS") {
        (async () => {
          const resp = await chrome.runtime.sendMessage({ type: "GET_FB_ACCOUNT_CACHE" });
          const account_id: string | undefined = resp?.data?.userId;
          if (!account_id) {
            sendResponse({ success: false, error: "Account ID not found" });
            return;
          }

            handleJoinGroupsMessage(message)
              .then(() => {
                console.log("[CONTENT SCRIPT] JOIN_GROUPS completed");
                sendResponse({ success: true, handled: true });
              })
              .catch((error) => {
                console.error("[CONTENT SCRIPT] JOIN_GROUPS error:", error);
                sendResponse({ success: false, error: error.message });
              });
          })();
          return true;
        }

        if (message.activityName === "SCROLL_JOINED_GROUPS") {
          handleScrollGroupsMessage(message)
            .then(() => {
              console.log("[CONTENT SCRIPT] SCROLL_JOINED_GROUPS completed");
              sendResponse({ success: true, handled: true });
            })
            .catch((error) => {
              console.warn(
                "[CONTENT SCRIPT] SCROLL_JOINED_GROUPS error:",
                error?.message || error,
              );
              sendResponse({ success: false, error: error?.message });
            });
          return true;
        }

        if (message.activityName === "SCROLL_URLS") {
          handleScrollUrlsMessage(message)
            .then(() => {
              console.log("[CONTENT SCRIPT] SCROLL_URLS completed");
              sendResponse({ success: true, handled: true });
            })
            .catch((error) => {
              console.warn(
                "[CONTENT SCRIPT] SCROLL_URLS error:",
                error?.message || error,
              );
              sendResponse({ success: false, error: error?.message });
            });
          return true;
        }

        if (message.activityName === "INJECT_POST_OWNER_DATA") {
          handleInjectPostOwner(message)
            .then(() => {
              console.log("[CONTENT SCRIPT] INJECT_POST_OWNER_DATA completed");
              sendResponse({ success: true, handled: true });
            })
            .catch((error) => {
              console.warn(
                "[CONTENT SCRIPT] INJECT_POST_OWNER_DATA error:",
                error?.message || error,
              );
              sendResponse({ success: false, error: error?.message });
            });
          return true;
        }

        if (message.activityName === "INJECT_HOVER_POST_OWNER_DATA") {
          handleInjectHoverPostOwner(message)
            .then(() => {
              console.log(
                "[CONTENT SCRIPT] INJECT_HOVER_POST_OWNER_DATA completed",
              );
              sendResponse({ success: true, handled: true });
            })
            .catch((error) => {
              console.warn(
                "[CONTENT SCRIPT] INJECT_HOVER_POST_OWNER_DATA error:",
                error?.message || error,
              );
              sendResponse({ success: false, error: error?.message });
            });
          return true;
        }

        if (message.activityName === "ENHANCE_SPAN") {
          handleEnhanceSpanMessage(message)
            .then(() => {
              console.log("[CONTENT SCRIPT] ENHANCE_SPAN completed");
              sendResponse({ success: true, handled: true });
            })
            .catch((error) => {
              console.warn(
                "[CONTENT SCRIPT] ENHANCE_SPAN error:",
                error?.message || error,
              );
              sendResponse({ success: false, error: error?.message });
            });
          return true;
        }
      }

      if (platform === "tiktok") {
        // TODO: dispatch TikTok-specific messages here
        // e.g.:
        // if (message.activityName === "TIKTOK_SCROLL_FEED") {
        //   handleTikTokMessage(message).then(() => ...);
        //   sendResponse({ success: true, handled: true });
        //   return true;
        // }
      }

      if (platform === "youtube") {
        if (message?.type === "CLICK_ABOUT_BUTTON") {
          (async () => {
            try {
              const name = await autoClickAboutButton();
              sendResponse?.({ ok: true, name });
            } catch (error: any) {
              sendResponse?.({
                ok: false,
                error: String(error?.message || error),
              });
            }
          })();
          return true;
        }

        if (message?.type === "CLICK_TRANSCRIPT_BUTTON") {
          (async () => {
            try {
              const name = await autoClickTranscriptButton();
              sendResponse?.({ ok: true, name });
            } catch (error: any) {
              sendResponse?.({
                ok: false,
                error: String(error?.message || error),
              });
            }
          })();
          return true;
        }
      }

      return true;
    },
  );
};

export default defineContentScript({
  matches: [
    "<all_urls>",
    "*://*.google.com/*",
    "*://*.facebook.com/*",
    "https://www.facebook.com/*",
    "https://web.facebook.com/*",
    "https://www.tiktok.com/*",
    "https://*.tiktok.com/*",
    "https://www.youtube.com/*",
  ],
  runAt: "document_start",

  async main() {
    console.log("[CONTENT SCRIPT] Content script starting...");
    const platform = detectPlatform(window.location.href);
    if (!platform) return;

    await setupPlatformFeatures(platform);
    installMessageRouter(platform);
  },
});
