import * as helpers from "../../utils/helpers";
import * as services from "../../services";
import { Message, Screenshot } from "../../types/types";
import { ApplicationServices } from "../../application-services";

export function handleCaptureScreenshot(
  applicationServices: ApplicationServices,
  sendResponse: (resp: any) => void) {
  applicationServices.tab?.captureVisibleTab(
    { format: "png" },
    (dataUrl) => {
      const error = services.runtimeService.getRuntimeLastError();
      if (error) {
        sendResponse({ error: error.message });
      } else {
        sendResponse({ dataUrl });
      }
    }
  );
}

export async function handleScreenshotCropped(message: Message, sendResponse: (resp: any) => void) {
  const { dataUrl, caseId, windowId } = message;

  services.sidePanelService.openSidePanel(windowId).catch(console.error)

  const storageKey = helpers.evidenStudio.getCaseStorageKey(caseId);
  const timestamp = Date.now();
  const entry: Screenshot = { dataUrl, timestamp };

  const data = await services.storageService.getStorageByKeys([storageKey]);
  const list = [...((data[storageKey] ?? []) as typeof entry[]), entry];
  await services.storageService.setStorageCached({
    [storageKey]: list,
    lastUnsavedProfileCase: { id: caseId, timestamp },
  });

  sendResponse({ ok: true });
}