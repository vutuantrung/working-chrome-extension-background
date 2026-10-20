import { afterEach, describe, expect, it, vi } from "vitest";
import { installChromeMock } from "./mocks/chrome";
import { StorageService } from "../../entrypoints/background/services/storageServices";

afterEach(() => vi.unstubAllGlobals());

describe("StorageService dependency injection", () => {
  it("uses an injected storage provider instead of the browser global", async () => {
    const storage = installChromeMock().storage.local;
    vi.unstubAllGlobals();
    const service = new StorageService(storage);
    await service.setStorageCached({ testKey: "testValue" });
    expect(await service.getStorageByKeys(["testKey"])).toEqual({ testKey: "testValue" });
    expect(storage.set).toHaveBeenCalledWith({ testKey: "testValue" });
  });

  it("keeps cached reads isolated from a different service instance", async () => {
    const first = new StorageService(installChromeMock().storage.local);
    await first.setStorageCached({ testKey: "first" });
    const secondStorage = installChromeMock().storage.local;
    const second = new StorageService(secondStorage);
    await second.setStorageCached({ testKey: "second" });
    expect((await first.getStorageCachedByKeys(["testKey"])).testKey).toBe("first");
    expect((await second.getStorageCachedByKeys(["testKey"])).testKey).toBe("second");
  });
});
