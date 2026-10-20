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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getVideoId(): string | null {
  if (!location.pathname.startsWith("/watch")) return null;
  return new URLSearchParams(location.search).get("v");
}

const TRANSCRIPT_LABELS = [
  "Show transcript",
  "Hiện bản chép lời",
];
function buildTranscriptSelector(): string {
  const labelSelectors = TRANSCRIPT_LABELS.map(
    (label) => `button[aria-label="${label}"]`
  );
  labelSelectors.push('button[aria-label*="transcript" i]');
  return labelSelectors.join(", ");
}

let runToken = 0;
export async function autoClickTranscriptButton(): Promise<void> {
  const videoIdAtStart = getVideoId();
  if (!videoIdAtStart) return;

  const myToken = ++runToken;

  await delay(4000);

  if (myToken !== runToken || getVideoId() !== videoIdAtStart) return;

  try {
    const loadDescriptionBtn = await waitForElement("#description-interaction");
    (loadDescriptionBtn as HTMLButtonElement).click()

    const loadTranscriptBtn = await waitForElement(buildTranscriptSelector());

    if (myToken !== runToken || getVideoId() !== videoIdAtStart) return;

    if (loadTranscriptBtn.getAttribute("aria-disabled") === "true") {
      return;
    }

    (loadTranscriptBtn as HTMLButtonElement).click();
  } catch (e) {
    console.warn("[AUTO-CLICK-ERROR]", (e as Error).message);
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleAutoClick(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    autoClickTranscriptButton();
  }, 500);
}

scheduleAutoClick();
document.addEventListener("yt-navigate-finish", scheduleAutoClick);