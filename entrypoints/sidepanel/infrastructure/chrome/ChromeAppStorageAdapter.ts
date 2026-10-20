import type { AppStoragePort } from "../../types/BrowserPorts";

/** Minimal WXT-storage-compatible adapter for `local:*` keys. */
export class ChromeAppStorageAdapter implements AppStoragePort {
  private normalize(key: string): string {
    return key.startsWith("local:") ? key.slice("local:".length) : key;
  }

  async getItem<T = unknown>(key: string): Promise<T | null> {
    const normalized = this.normalize(key);
    const result = await chrome.storage.local.get(normalized);
    return (result[normalized] as T | undefined) ?? null;
  }

  async setItem<T = unknown>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [this.normalize(key)]: value });
  }

  async removeItem(key: string): Promise<void> {
    await chrome.storage.local.remove(this.normalize(key));
  }
}
