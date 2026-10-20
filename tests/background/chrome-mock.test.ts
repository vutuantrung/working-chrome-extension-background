import { afterEach, describe, expect, it, vi } from "vitest";
import { installChromeMock } from "./mocks/chrome";

afterEach(() => vi.unstubAllGlobals());

describe("local Chrome API mock", () => {
  it("reads and writes isolated storage", async () => {
    const chromeMock = installChromeMock();
    await chromeMock.storage.local.set({ task: { id: "task-001" } });
    expect(await chromeMock.storage.local.get("task")).toEqual({ task: { id: "task-001" } });
  });

  it("emits storage change events", async () => {
    const chromeMock = installChromeMock();
    const listener = vi.fn();
    chromeMock.storage.onChanged.addListener(listener);
    await chromeMock.storage.local.set({ enabled: true });
    expect(listener).toHaveBeenCalledWith({
      enabled: { oldValue: undefined, newValue: true },
    }, "local");
  });

  it("creates, retrieves and clears alarms", async () => {
    const chromeMock = installChromeMock();
    await chromeMock.alarms.create("sync", { delayInMinutes: 1, periodInMinutes: 5 });
    expect((await chromeMock.alarms.get("sync"))?.periodInMinutes).toBe(5);
    expect(await chromeMock.alarms.clear("sync")).toBe(true);
    expect(await chromeMock.alarms.get("sync")).toBeUndefined();
  });
});
