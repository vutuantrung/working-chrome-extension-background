import { afterEach, describe, expect, it, vi } from "vitest";
import { chromeApi } from "../../entrypoints/background/chrome-api";
import { installChromeMock } from "./mocks/chrome";

afterEach(() => vi.unstubAllGlobals());

describe("background Chrome API facade", () => {
  it("can be imported without an active Chrome runtime", () => {
    expect(chromeApi).toBeDefined();
  });

  it("delegates storage access to the current Chrome runtime", async () => {
    const mock = installChromeMock();
    await chromeApi.storage.local.set({ featureEnabled: true });
    expect(await chromeApi.storage.local.get("featureEnabled")).toEqual({ featureEnabled: true });
    expect(mock.storage.local.set).toHaveBeenCalledOnce();
  });

  it("delegates alarm operations without caching the Chrome global", async () => {
    installChromeMock();
    await chromeApi.alarms.create("sync", { delayInMinutes: 1 });
    expect((await chromeApi.alarms.get("sync"))?.name).toBe("sync");
  });
});
