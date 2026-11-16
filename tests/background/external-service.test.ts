import { describe, expect, it, vi } from "vitest";
import { handleExternalApiCall } from "../../entrypoints/background/handlers/extension/externalServiceHandler";
import type { ApplicationServices } from "../../entrypoints/background/application-services";

function setup() {
    const post = vi.fn();
    const services = { http: { getHttpInstance: () => ({ post }) } } as unknown as ApplicationServices;
    return { services, post };
}

describe("external service gateway", () => {
    it("preserves successful legacy payloads", async () => {
        const { services, post } = setup();
        post.mockResolvedValue({ data: { user: { id: "test" } } });
        const respond = vi.fn();
        await handleExternalApiCall(services, {
            type: "CALL_EXTERNAL_SERVICE", inputs: { serviceName: "login", body: {} },
        } as any, respond);
        expect(respond).toHaveBeenCalledExactlyOnceWith({ user: { id: "test" } });
    });

    it("responds once with a redacted failure", async () => {
        const { services, post } = setup();
        post.mockRejectedValue(new Error("private credentials"));
        const respond = vi.fn();
        await handleExternalApiCall(services, {
            type: "CALL_EXTERNAL_SERVICE", inputs: { serviceName: "login", body: {} },
        } as any, respond);
        expect(respond).toHaveBeenCalledExactlyOnceWith({
            success: false, error: "External service request failed", code: "EXTERNAL_SERVICE_FAILED",
        });
    });

    it("rejects an unknown operation", async () => {
        const { services, post } = setup();
        const respond = vi.fn();
        await handleExternalApiCall(services, {
            type: "CALL_EXTERNAL_SERVICE", inputs: { serviceName: "unknown", body: {} },
        } as any, respond);
        expect(respond).toHaveBeenCalledExactlyOnceWith({
            success: false, error: "Unsupported external service", code: "UNSUPPORTED_SERVICE",
        });
        expect(post).not.toHaveBeenCalled();
    });
});
