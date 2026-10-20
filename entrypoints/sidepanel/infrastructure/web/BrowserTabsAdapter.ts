import type { AppTab, BrowserTabsPort } from "../../types/BrowserPorts";
export class BrowserTabsAdapter implements BrowserTabsPort {
  async getActiveTab(): Promise<AppTab | null> {
    if (typeof window === "undefined") return null;
    return { id: 1, windowId: 1, url: window.location.href, title: document.title, status: "complete" };
  }
  async getTab(_tabId: number): Promise<AppTab | null> { return this.getActiveTab(); }
  async createTab(url: string, active = true): Promise<AppTab | null> {
    if (typeof window !== "undefined") window.open(url, active ? "_blank" : "_blank");
    return { url, status: "complete" };
  }
}
