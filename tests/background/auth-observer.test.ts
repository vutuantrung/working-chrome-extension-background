import { describe, expect, it, vi } from "vitest";
import type { ApplicationServices } from "../../entrypoints/background/application-services";
vi.mock("../../entrypoints/background/handlers/extension/systemHandlers", () => ({
  handleClearDataAfterLogout: vi.fn(),
}));
import { getAuthenticationGeneration, recoverFromUnauthorized, handleAuthLogin } from "../../entrypoints/background/handlers/extension/authHandlers";

function setup() {
  const post = vi.fn().mockResolvedValue({ data: { id: "user", extension_session: { extension_id: "ext" } } });
  const sendMessage = vi.fn();
  const read = vi.fn().mockResolvedValue({ user: { id: "user", extension_session: { extension_id: "ext" } }, apikey: "test", fbLoginMode: "manual" });
  const services = {
    http: { getHttpInstance: () => ({ post }) },
    storage: { getStorageByKeys: read, getBrowserApi: () => ({ set: vi.fn().mockResolvedValue(undefined) }), getCachedStorage: () => ({}) },
    runtime: { getBrowserApi: () => ({ sendMessage, getRuntimeLastError: vi.fn() }) },
  } as unknown as ApplicationServices;
  return { services, post, sendMessage, read };
}
describe("R1.5 background unauthorized recovery", () => {
  it("recovers directly and emits a credential-free notification", async () => {
    const { services, post, sendMessage } = setup();
    await recoverFromUnauthorized(services, getAuthenticationGeneration());
    expect(post).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith({ type: "AUTH_STATE_CHANGED", reason: "recovery", success: true, status: "recovered" }, expect.any(Function));
  });
  it("ignores a stale generation after login", async () => {
    const { services, post, sendMessage } = setup();
    const previous = getAuthenticationGeneration();
    await handleAuthLogin(services, { type: "AUTH_LOGIN", inputs: { username: "demo", password: "test", extensionId: "ext" } }, vi.fn());
    await recoverFromUnauthorized(services, previous);
    expect(post).toHaveBeenCalledTimes(1);
    expect(sendMessage).not.toHaveBeenCalled();
  });
  it("does not recover when durable user is absent", async () => {
    const { services, read, post } = setup();
    read.mockResolvedValue({ apikey: "test" });
    await recoverFromUnauthorized(services, getAuthenticationGeneration());
    expect(post).not.toHaveBeenCalled();
  });
  it("coalesces concurrent unauthorized observations", async () => {
    const { services, post, sendMessage } = setup();
    const generation = getAuthenticationGeneration();
    await Promise.all([recoverFromUnauthorized(services, generation), recoverFromUnauthorized(services, generation)]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });
});
