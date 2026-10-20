import type { LocalUiStoragePort } from "../../types/BrowserPorts";

export class BrowserLocalStorageAdapter implements LocalUiStoragePort {
  getItem(key: string): string | null {
    return globalThis.localStorage?.getItem(key) ?? null;
  }

  setItem(key: string, value: string): void {
    globalThis.localStorage?.setItem(key, value);
  }

  removeItem(key: string): void {
    globalThis.localStorage?.removeItem(key);
  }

  clear(): void {
    globalThis.localStorage?.clear();
  }

  getBoolean(key: string, fallback = false): boolean {
    const value = this.getItem(key);
    if (value === null) return fallback;
    return value === "1" || value === "true";
  }

  setBoolean(key: string, value: boolean): void {
    this.setItem(key, value ? "1" : "0");
  }

  getJson<T>(key: string, fallback?: T): T | null {
    const value = this.getItem(key);
    if (value === null) return fallback ?? null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback ?? null;
    }
  }

  setJson(key: string, value: unknown): void {
    this.setItem(key, JSON.stringify(value));
  }
}
