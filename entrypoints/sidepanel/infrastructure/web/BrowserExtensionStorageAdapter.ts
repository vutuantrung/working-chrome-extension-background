import type {
  ExtensionStoragePort,
  StorageChangeListener,
  StorageGetKeys,
} from "../../types/BrowserPorts";

const PREFIX = "sidepanel:extension:";

export class BrowserExtensionStorageAdapter implements ExtensionStoragePort {
  private read(key: string): unknown {
    const raw = globalThis.localStorage?.getItem(PREFIX + key);
    if (raw == null) return undefined;
    try { return JSON.parse(raw); } catch { return raw; }
  }

  async get<T extends Record<string, any> = Record<string, any>>(
    keys?: StorageGetKeys,
  ): Promise<T> {
    const out: Record<string, unknown> = {};
    if (keys == null) {
      for (let i = 0; i < (globalThis.localStorage?.length ?? 0); i++) {
        const full = globalThis.localStorage!.key(i);
        if (!full?.startsWith(PREFIX)) continue;
        const key = full.slice(PREFIX.length);
        out[key] = this.read(key);
      }
    } else if (typeof keys === "string") {
      out[keys] = this.read(keys);
    } else if (Array.isArray(keys)) {
      for (const key of keys) out[key] = this.read(key);
    } else {
      for (const [key, fallback] of Object.entries(keys)) {
        out[key] = this.read(key) ?? fallback;
      }
    }
    return out as T;
  }

  async getValue<T = unknown>(key: string, fallback?: T): Promise<T | undefined> {
    return (this.read(key) as T | undefined) ?? fallback;
  }

  async set(items: Record<string, any>): Promise<void> {
    for (const [key, value] of Object.entries(items)) {
      globalThis.localStorage?.setItem(PREFIX + key, JSON.stringify(value));
    }
  }

  async setValue<T>(key: string, value: T): Promise<void> {
    await this.set({ [key]: value });
  }

  async remove(keys: string | string[]): Promise<void> {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      globalThis.localStorage?.removeItem(PREFIX + key);
    }
  }

  async clear(): Promise<void> {
    const keys: string[] = [];
    for (let i = 0; i < (globalThis.localStorage?.length ?? 0); i++) {
      const full = globalThis.localStorage!.key(i);
      if (full?.startsWith(PREFIX)) keys.push(full);
    }
    for (const key of keys) globalThis.localStorage?.removeItem(key);
  }

  subscribe(_listener: StorageChangeListener): () => void {
    return () => {};
  }

  subscribeKey<T = unknown>(
    _key: string,
    _listener: (newValue: T | undefined, oldValue: T | undefined) => void,
  ): () => void {
    return () => {};
  }
}
