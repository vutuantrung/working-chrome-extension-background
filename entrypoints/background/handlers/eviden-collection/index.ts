import * as helpers from "../../utils/helpers";
import { chromeApi } from "../../infrastructure/chrome-api/chrome-api";
import { Message, Screenshot } from "../../types/types";
import { storageServices } from "../../services";

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

  const data = await storageServices.getStorageByKeys([storageKey]);
  const list = [...((data[storageKey] ?? []) as typeof entry[]), entry];
  await storageServices.setStorageCached({
    [storageKey]: list,
    lastUnsavedProfileCase: { id: caseId, timestamp },
  });

  sendResponse({ ok: true });
}