import * as helpers from "../../utils/helpers";
import { Message, Screenshot } from "../../types/types";
import { ApplicationServices } from "../../application-services";

export function handleCaptureScreenshot(
  applicationServices: ApplicationServices,
  sendResponse: (resp: any) => void
) {
  applicationServices.tab?.getBrowserApi().captureVisibleTab(
    { format: "png" },
    (dataUrl) => {
      const error = applicationServices.runtime?.getBrowserApi().getRuntimeLastError();
      if (error) {
        sendResponse({ error: error.message });
      } else {
        sendResponse({ dataUrl });
      }
    }
  );
}

export async function handleScreenshotCropped(
  applicationServices: ApplicationServices,
  message: Message,
  sendResponse: (resp: any) => void
) {
  const { dataUrl, caseId, windowId } = message;

  applicationServices.sidePanel?.getBrowserApi().openSidePanel(windowId).catch(console.error)

  const storageKey = `screenshots_${caseId}`;
  const timestamp = Date.now();
  const entry: Screenshot = { dataUrl, timestamp };

  if (!applicationServices.storage) {
    sendResponse({ error: "Storage service not available" });
    return;
  }

  const data = await applicationServices.storage?.getStorageByKeys([storageKey]);
  const list = [...((data[storageKey] ?? []) as typeof entry[]), entry];
  await applicationServices.storage?.setStorageCached({
    [storageKey]: list,
    lastUnsavedProfileCase: { id: caseId, timestamp },
  });

  sendResponse({ ok: true });
}