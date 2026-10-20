import type {
  BrowserScriptingPort,
  BrowserTabsPort,
  ExtensionStoragePort,
} from "../../types/BrowserPorts";

const isRestrictedUrl = (url: string | undefined): boolean => {
  if (!url) return true;
  return (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("https://chrome.google.com/webstore") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("data:") ||
    url.startsWith("chrome-error://")
  );
};

export type ScreenshotCaptureResult =
  | { success: true }
  | { success: false; error: string };

export class ScreenshotCaptureService {
  constructor(
    private readonly tabs: BrowserTabsPort,
    private readonly scripting: BrowserScriptingPort,
    private readonly storage: ExtensionStoragePort,
    private readonly selector: (caseId: string, windowId: number) => unknown,
  ) { }

  async begin(caseId: string): Promise<ScreenshotCaptureResult> {
    const tab = await this.tabs.getActiveTab();

    if (!tab?.id || tab.windowId == null) {
      return {
        success: false,
        error: "No active tab found."
      };
    }
    if (tab.status === "loading") {
      return {
        success: false,
        error: "Page is still loading. Wait for it to finish, then try again.",
      };
    }
    if (isRestrictedUrl(tab.url)) {
      return {
        success: false,
        error: "Can't capture this page. Navigate to a regular website first.",
      };
    }

    await this.storage.set({
      lastUnsavedProfileCase: {
        id: caseId,
        timestamp: Date.now(),
      },
    });

    await this.scripting.executeInTab(
      tab.id,
      this.selector,
      [caseId, tab.windowId],
    );

    return { success: true };
  }
}
