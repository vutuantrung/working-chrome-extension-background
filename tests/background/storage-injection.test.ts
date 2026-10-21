import { afterEach, describe, expect, it, vi } from "vitest";
import { installChromeMock } from "./mocks/chrome";
import { clearStorageCache, getStorageByKeys, getStorageCachedByKeys, getStorageCache, setStorageAdapter, setStorageCached } from "../../entrypoints/background/services/storage.services";

afterEach(() => { setStorageAdapter(); vi.unstubAllGlobals(); });

describe("module-level storage functions", () => {
 it("uses an injected storage provider", async () => {
   const provider = installChromeMock().storage.local;
   setStorageAdapter(provider);
   vi.unstubAllGlobals();
   await setStorageCached({ testKey: "testValue" });
   expect(await getStorageByKeys(["testKey"])).toEqual({ testKey: "testValue" });
   expect(provider.set).toHaveBeenCalledWith({ testKey: "testValue" });
 });
 it("shares cache between functions and can clear it", async () => {
   const provider = installChromeMock().storage.local;
   setStorageAdapter(provider);
   await setStorageCached({ testKey: "cached" });
   expect((await getStorageCachedByKeys(["testKey"])).testKey).toBe("cached");
   expect((getStorageCache() as any).testKey).toBe("cached");
   clearStorageCache();
   expect(getStorageCache()).toEqual({});
   expect((await getStorageCachedByKeys(["testKey"])).testKey).toBe("cached");
 });
});