import * as helpers from "../../utils/helpers";
import * as tabService from "../../services/tab.service";
import * as sidePanelService from "../../services/side-panel.service";
import * as runtimeService from "../../services/runtime.service";
import { Message, Screenshot } from "../../types/types";
import { storageServices } from "../../services";

export function handleCaptureScreenshot(sendResponse: (resp: any) => void) {
  tabService.captureVisibleTab(
    { format: "png" },
    (dataUrl) => {
      if (runtimeService.getRuntimeLastError()) {
        sendResponse({ error: runtimeService.getRuntimeLastError().message });
      } else {
        sendResponse({ dataUrl });
      }
    }
  );
}

export async function handleScreenshotCropped(message: Message, sendResponse: (resp: any) => void) {
  const { dataUrl, caseId, windowId } = message;

  sidePanelService.openSidePanel(windowId).catch(console.error)

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