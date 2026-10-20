import type {
  ExtensionStoragePort,
  StorageChangeListener,
  StorageGetKeys,
} from "../../types/BrowserPorts";

export class ChromeExtensionStorageAdapter implements ExtensionStoragePort {
  async get<T extends Record<string, any> = Record<string, any>>(
    keys?: StorageGetKeys,
  ): Promise<T> {
    return (await chrome.storage.local.get(keys as any)) as T;
  }

  async getValue<T = unknown>(key: string, fallback?: T): Promise<T | undefined> {
    const result = await this.get<Record<string, T>>(key);
    return result[key] ?? fallback;
  }

  async set(items: Record<string, any>): Promise<void> {
    await chrome.storage.local.set(items);
  }

  async setValue<T>(key: string, value: T): Promise<void> {
    await this.set({ [key]: value });
  }

  async remove(keys: string | string[]): Promise<void> {
    await chrome.storage.local.remove(keys);
  }

  async clear(): Promise<void> {
    await chrome.storage.local.clear();
  }

  subscribe(listener: StorageChangeListener): () => void {
    const chromeListener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => listener(changes, areaName);
    chrome.storage.onChanged.addListener(chromeListener);
    return () => chrome.storage.onChanged.removeListener(chromeListener);
  }

  subscribeKey<T = unknown>(
    key: string,
    listener: (newValue: T | undefined, oldValue: T | undefined) => void,
  ): () => void {
    return this.subscribe((changes, areaName) => {
      if (areaName !== "local" || !changes[key]) return;
      listener(
        changes[key].newValue as T | undefined,
        changes[key].oldValue as T | undefined,
      );
    });
  }
}
