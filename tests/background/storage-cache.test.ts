import { describe, expect, it, vi } from "vitest";
import { StorageService } from "../../entrypoints/background/services/storage.services";
import type { BrowserApplicationStorageApi } from "../../entrypoints/background/services/storage.api";

vi.mock("../../entrypoints/background/utils/helpers", () => ({}));

function setup(values: Record<string, unknown> = {}) {
    const get = vi.fn(async (keys: string[]) =>
        Object.fromEntries(keys.filter(key => key in values).map(key => [key, values[key]])));
    const storage = new StorageService({ get } as unknown as BrowserApplicationStorageApi);
    return { storage, get };
}

describe("StorageService cache reads", () => {
    it("loads a key on an empty cache and reuses it", async () => {
        const { storage, get } = setup({ settings: { example: true } });
        expect(await storage.getStorageCachedByKeys(["settings"])).toEqual({ settings: { example: true } });
        await storage.getStorageCachedByKeys(["settings"]);
        expect(get).toHaveBeenCalledTimes(1);
    });

    it("resolves missing keys without recursion", async () => {
        const { storage, get } = setup();
        expect(await storage.getStorageCachedByKeys(["missing"])).toEqual({ missing: undefined });
        expect(get).toHaveBeenCalledTimes(1);
    });

    it("shares concurrent reads for an existing key", async () => {
        const { storage, get } = setup({ user: { id: "test" } });
        await Promise.all([storage.getStorageCachedByKeys(["user"]), storage.getStorageCachedByKeys(["user"])]);
        expect(get).toHaveBeenCalledTimes(1);
    });

    it("releases the in-flight lock after a rejected read", async () => {
        const { storage, get } = setup({ user: { id: "test" } });
        get.mockRejectedValueOnce(new Error("read failed"));
        await expect(storage.getStorageCachedByKeys(["user"])).rejects.toThrow("read failed");
        expect(await storage.getStorageCachedByKeys(["user"])).toEqual({ user: { id: "test" } });
    });
});
