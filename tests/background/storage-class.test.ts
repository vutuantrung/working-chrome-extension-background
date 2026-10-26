import { describe, expect, it } from "vitest";
import type { StoragePort } from "../../entrypoints/background/contracts/storage.port";
import { StorageService } from "../../entrypoints/background/services/storage.services";

function memoryPort(): StoragePort {
  const entries = new Map<string, any>();
  return {
    async get(keys) {
      return Object.fromEntries((keys ?? [...entries.keys()])
        .filter(key => entries.has(key)).map(key => [key, entries.get(key)]));
    },
    async set(values) {
      for (const [key, value] of Object.entries(values)) entries.set(key, value);
    },
    async remove(keys) {
      for (const key of keys) entries.delete(key);
    },
  };
}

describe("StorageService class", () => {
  it("does not require Chrome and isolates instance caches", async () => {
    const first = new StorageService(memoryPort());
    const second = new StorageService(memoryPort());
    await first.setStorageCached({ sample: "one" });
    await second.setStorageCached({ sample: "two" });
    expect(await first.getStorageCachedByKeys(["sample"])).toEqual({ sample: "one" });
    expect(await second.getStorageCachedByKeys(["sample"])).toEqual({ sample: "two" });
    await first.removeStorageByKeys(["sample"]);
    expect(await first.getStorageByKeys(["sample"])).toEqual({});
    expect(await second.getStorageByKeys(["sample"])).toEqual({ sample: "two" });
  });
});
