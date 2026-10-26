import type { StoragePort } from "../../contracts/storage.port";
import { chromeApi } from "./chrome-api";

/** The only Chrome Storage implementation used by application services. */
export const chromeStorageAdapter: StoragePort = {
  get(keys) {
    return chromeApi.storage.local.get(keys);
  },
  async set(values) {
    await chromeApi.storage.local.set(values);
  },
};
