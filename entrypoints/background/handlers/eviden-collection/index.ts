import * as helpers from "../../utils/helpers";
import { chromeApi } from "../../infrastructure/chrome-api/chrome-api";
import { Message, Screenshot } from "../../types/types";

export function handleCaptureScreenshot(sendResponse: (resp: any) => void) {
  chromeApi.tabs.captureVisibleTab(
    { format: "png" },
    (dataUrl) => {
      if (chromeApi.runtime.lastError) {
        sendResponse({ error: chromeApi.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl });
      }
    }
  );
}

export async function handleScreenshotCropped(message: Message, sendResponse: (resp: any) => void) {
  const { dataUrl, caseId, windowId } = message;

  chromeApi.sidePanel.open({ windowId }).catch(console.error)

  const storageKey = helpers.evidenStudio.getCaseStorageKey(caseId);
  const timestamp = Date.now();
  const entry: Screenshot = { dataUrl, timestamp };

  const data = await chromeApi.storage.local.get([storageKey]);
  const list = [...((data[storageKey] ?? []) as typeof entry[]), entry];
  await chromeApi.storage.local.set({ [storageKey]: list });
  await chromeApi.storage.local.set({ lastUnsavedProfileCase: { id: caseId, timestamp } });

  sendResponse({ ok: true });
}