import { getCaseStorageKey } from "../../helpers/eviden-studio";
import { Message, Screenshot } from "../../types/types";

export function handleCaptureScreenshot(
  sendResponse: (resp: any) => void,
) {
  chrome.tabs.captureVisibleTab(
    { format: "png" },
    (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl });
      }
    }
  );
}
 
export async function handleScreenshotCropped(
  message: Message,
  sendResponse: (resp: any) => void,
) {
  const { dataUrl, caseId, windowId } = message;

  chrome.sidePanel.open({ windowId }).catch(console.error)

  const storageKey = getCaseStorageKey(caseId);
  const timestamp = Date.now();
  const entry: Screenshot = { dataUrl, timestamp };

  const data = await chrome.storage.local.get([storageKey]);
  const list = [...((data[storageKey] ?? []) as typeof entry[]), entry];  
  await chrome.storage.local.set({ [storageKey]: list });
  await chrome.storage.local.set({ lastUnsavedProfileCase: {id: caseId, timestamp} });

  sendResponse({ ok: true });
}