import { describe, expect, it, vi } from "vitest";
import { createDeferredRuntimeListener } from "../../entrypoints/background/infrastructure/chrome-api/deferred-runtime-listener";
import type { ApplicationServices } from "../../entrypoints/background/application-services";

describe("cold-start runtime listener", () => {
    it("keeps the channel open and dispatches once services are ready", async () => {
        let resolve!: (services: ApplicationServices) => void;
        const ready = new Promise<ApplicationServices>(r => { resolve = r; });
        const handler = vi.fn((_message, _sender, respond) => {
            respond({ data: "ready" });
            return true;
        });
        const listener = createDeferredRuntimeListener(ready, () => handler);
        const respond = vi.fn();
        expect(listener({ type: "GET_SETTINGS" } as any, {}, respond)).toBe(true);
        expect(handler).not.toHaveBeenCalled();
        resolve({} as ApplicationServices);
        await vi.waitFor(() => expect(respond).toHaveBeenCalledWith({ data: "ready" }));
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("returns a stable error on bootstrap failure", async () => {
        const listener = createDeferredRuntimeListener(
            Promise.reject(new Error("private detail")), vi.fn(),
        );
        const respond = vi.fn();
        expect(listener({ type: "GET_SETTINGS" } as any, {}, respond)).toBe(true);
        await vi.waitFor(() => expect(respond).toHaveBeenCalledWith({
            success: false, error: "Background initialization failed", code: "BACKGROUND_UNAVAILABLE",
        }));
        expect(respond).toHaveBeenCalledTimes(1);
    });
});
