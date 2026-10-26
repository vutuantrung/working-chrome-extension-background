import { afterEach, describe, expect, it } from "vitest";
import type { StoragePort } from "../../entrypoints/background/contracts/storage.port";
import {
  setStorageAdapter,
  setStorageCached,
  getStorageByKeys,
  getStorageCachedByKeys,
  clearStorageCache,
} from "../../entrypoints/background/services/storage.service";

afterEach(() => setStorageAdapter());

function inMemoryStorage(): StoragePort {
  const entries = new Map<string, any>();
  return {
    async get(keys) {
      const result: Record<string, any> = {};
      for (const key of keys ?? [...entries.keys()]) {
        if (entries.has(key)) result[key] = entries.get(key);
      }
      return result;
    },
    async set(values) {
      for (const [key, value] of Object.entries(values)) entries.set(key, value);
    },
    async remove(keys) {
      for (const key of keys) entries.delete(key);
    },
  };
}

describe("StoragePort integration", () => {
  it("can execute storage services with no Chrome global", async () => {
    setStorageAdapter(inMemoryStorage());
    await setStorageCached({ connection: "local" });
    expect(await getStorageByKeys(["connection"])).toEqual({ connection: "local" });
    clearStorageCache();
    expect(await getStorageCachedByKeys(["connection"])).toEqual({ connection: "local" });
  });
  it("removes keys from persistence and cache", async () => {
    setStorageAdapter(inMemoryStorage());
    await setStorageCached({ retained: 1, removed: 2 });
    const { removeStorageByKeys } = await import("../../entrypoints/background/services/storage.service");
    await removeStorageByKeys(["removed"]);
    expect(await getStorageByKeys(["removed"])).toEqual({});
    expect(await getStorageCachedByKeys(["removed"])).toEqual({});
    expect(await getStorageCachedByKeys(["retained"])).toEqual({ retained: 1 });
  });
});
