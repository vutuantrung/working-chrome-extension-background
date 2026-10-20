function waitForElement(selector: string, timeout = 8000): Promise<Element> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error("Timeout: element not found"));
    }, timeout);
  });
}

function isChannelPage(): boolean {
  return /^\/(channel\/[^/]+|@[^/]+)\/?$/.test(location.pathname);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let runToken = 0;

export async function autoClickAboutButton(): Promise<void> {
  if (!isChannelPage()) return;

  const myToken = ++runToken;
  const pathAtStart = location.pathname;

  await delay(1000);

  if (myToken !== runToken || location.pathname !== pathAtStart) return;

  try {
    const btn = await waitForElement(
      [
        "yt-description-preview-view-model button.ytTruncatedTextAbsoluteButton",
        'yt-description-preview-view-model button[aria-label*="xem thêm"]',
        'yt-description-preview-view-model button[aria-label*="more" i]',
      ].join(", ")
    );

    if (myToken !== runToken || location.pathname !== pathAtStart) return;

    (btn as HTMLButtonElement).click();
  } catch (e) {
    console.warn("[AUTO-CLICK-ERROR]", (e as Error).message);
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleAutoClick(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    autoClickAboutButton();
  }, 500);
}

scheduleAutoClick();
document.addEventListener("yt-navigate-finish", scheduleAutoClick);