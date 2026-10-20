import type { AppStoragePort } from "../../types/BrowserPorts";

/** WXT-compatible key adapter for standalone web. Supports `local:*` keys. */
export class BrowserAppStorageAdapter implements AppStoragePort {
  private normalize(key: string): string {
    return key.startsWith("local:") ? key.slice("local:".length) : key;
  }

  async getItem<T = unknown>(key: string): Promise<T | null> {
    const raw = globalThis.localStorage?.getItem(`sidepanel:app:${this.normalize(key)}`);
    if (raw == null) return null;
    try { return JSON.parse(raw) as T; } catch { return raw as T; }
  }

  async setItem<T = unknown>(key: string, value: T): Promise<void> {
    globalThis.localStorage?.setItem(
      `sidepanel:app:${this.normalize(key)}`,
      JSON.stringify(value),
    );
  }

  async removeItem(key: string): Promise<void> {
    globalThis.localStorage?.removeItem(`sidepanel:app:${this.normalize(key)}`);
  }
}
