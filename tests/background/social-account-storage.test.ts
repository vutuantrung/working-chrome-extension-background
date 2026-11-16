import { describe, expect, it, vi } from "vitest";
import { StorageService } from "../../entrypoints/background/services/storage.services";
import type { BrowserApplicationStorageApi } from "../../entrypoints/background/services/storage.api";
function setup() {
  const data: Record<string, any> = { settings: { a: 1 }, socialAccountCatalog: { revision: 5 }, allSocialAccounts: [{ account_id: "new" }] };
  const get = vi.fn(async (keys: string[]) => Object.fromEntries(keys.filter(k => k in data).map(k => [k, data[k]])));
  const set = vi.fn(async (patch: object) => { Object.assign(data, patch); });
  const remove = vi.fn(async (keys: string[]) => { for (const key of keys) delete data[key]; });
  const storage = new StorageService({ get, set, remove } as unknown as BrowserApplicationStorageApi);
  return { storage, data, get, set };
}
describe("R3.2 storage regression", () => {
  it("loads missing keys on cold cache, including absent keys", async () => {
    const { storage, get } = setup();
    expect(await storage.getStorageCachedByKeys(["settings", "missing"])).toEqual({ settings: { a: 1 }, missing: undefined });
    expect(get).toHaveBeenCalledTimes(1);
  });
  it("reads authoritative accounts from durable storage even when cache is stale", async () => {
    const { storage } = setup(); Object.assign(storage.getCachedStorage(), { socialAccountCatalog: { revision: 4 } });
    expect(await storage.getStorageCachedByKeys(["socialAccountCatalog"])).toEqual({ socialAccountCatalog: { revision: 5 } });
  });
  it("writes only requested settings, ignoring stale account cache", async () => {
    const { storage, set, data } = setup(); Object.assign(storage.getCachedStorage(), { socialAccountCatalog: { revision: 4 } });
    await storage.setStorageCached({ settings: { b: 2 } });
    expect(set).toHaveBeenCalledExactlyOnceWith({ settings: { a: 1, b: 2 } }); expect(data.socialAccountCatalog.revision).toBe(5);
  });
  it("blocks direct legacy account writes", async () => {
    const { storage, set } = setup(); await storage.setStorageCached({ allSocialAccounts: [] }); expect(set).not.toHaveBeenCalled();
  });
  it("does not resurrect removed catalog on unrelated patch", async () => {
    const { storage, data } = setup(); await storage.removeStorageByKeys(["socialAccountCatalog"]); await storage.setStorageCached({ settings: { b: 2 } });
    expect(data.socialAccountCatalog).toBeUndefined();
  });
});
