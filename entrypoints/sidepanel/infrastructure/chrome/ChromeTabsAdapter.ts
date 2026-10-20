import type { AppTab, BrowserTabsPort } from "../../types/BrowserPorts";

const toAppTab = (tab?: chrome.tabs.Tab | null): AppTab | null => {
  if (!tab) return null;
  return {
    id: tab.id,
    windowId: tab.windowId,
    url: tab.url,
    pendingUrl: tab.pendingUrl,
    title: tab.title,
    status: tab.status,
  };
};

export class ChromeTabsAdapter implements BrowserTabsPort {
  async getActiveTab(): Promise<AppTab | null> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return toAppTab(tab);
  }

  async getTab(tabId: number): Promise<AppTab | null> {
    return toAppTab(await chrome.tabs.get(tabId));
  }

  async createTab(url: string, active = true): Promise<AppTab | null> {
    return toAppTab(await chrome.tabs.create({ url, active }));
  }
}
