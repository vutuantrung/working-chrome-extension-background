import { describe, expect, it, vi } from "vitest";
import type { ApplicationServices } from "../../entrypoints/background/application-services";

const clear = vi.hoisted(() => vi.fn());
vi.mock("../../entrypoints/background/handlers/extension/systemHandlers", () => ({
  handleClearDataAfterLogout: clear,
}));
import { handleAuthRecoverSession, handleAuthAutoLogin } from "../../entrypoints/background/handlers/extension/authHandlers";

function setup(state: Record<string, unknown>) {
  clear.mockReset();
  clear.mockImplementation(async (_services, _message, respond) => respond({ success: true, cleared: true }));
  const post = vi.fn();
  const set = vi.fn().mockResolvedValue(undefined);
  const remove = vi.fn().mockResolvedValue(undefined);
  const read = vi.fn().mockResolvedValue(state);
  const getAll = vi.fn().mockResolvedValue([]);
  const cache = {};
  const services = {
    http: { getHttpInstance: () => ({ post }) },
    storage: { getStorageByKeys: read, getBrowserApi: () => ({ set }), removeStorageByKeys: remove, getCachedStorage: () => cache },
    alarm: {}, proxy: {}, cookie: { getBrowserApi: () => ({ getAll }) },
  } as unknown as ApplicationServices;
  return { services, post, set, remove, read, getAll };
}

const message = { type: "AUTH_RECOVER_SESSION", inputs: { extensionId: "ext", allowLegacyCredentials: true } };
describe("R1.4 session recovery", () => {
  it("does not reauthenticate a cleared session after delayed expiry", async () => {
    const { services, post } = setup({ apikey: "test" });
    const respond = vi.fn();
    await handleAuthRecoverSession(services, message, respond);
    expect(post).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledExactlyOnceWith({ success: true, data: { status: "signed_out", snapshotPreserved: false } });
  });
  it("recovers using the stored API key", async () => {
    const { services, post, set } = setup({ user: { id: "user" }, apikey: "test" });
    post.mockResolvedValue({ data: { id: "user" } });
    const respond = vi.fn();
    await handleAuthRecoverSession(services, message, respond);
    expect(post).toHaveBeenCalledExactlyOnceWith("/extension-sessions/signin", { api_key: "test", extension_id: "ext" });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ isApikeySession: true }));
    expect(respond.mock.calls[0][0].data.status).toBe("recovered");
    expect(clear).not.toHaveBeenCalled();
  });
  it("uses existing legacy credentials only when allowed", async () => {
    const { services, post } = setup({ user: { id: "user" }, apikey: "test", draftCredentials: { username: "demo", password: "test-password" } });
    post.mockRejectedValueOnce(new Error("failed")).mockResolvedValueOnce({ data: { id: "user" } });
    const respond = vi.fn();
    await handleAuthRecoverSession(services, message, respond);
    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenLastCalledWith("/extension-sessions/signin", { username: "demo", password: "test-password", extension_id: "ext" });
    expect(respond.mock.calls[0][0].data.session.isApikeySession).toBe(false);
  });
  it("cleans expired session and retains manual snapshot and legacy draft", async () => {
    const { services, post, set, remove, getAll } = setup({ user: { id: "user" }, draftCredentials: { username: "demo", password: "test" }, fbLoginMode: "manual" });
    getAll.mockImplementation(async ({ domain }) => domain === ".facebook.com" ? [{ name: "demo" }] : []);
    const respond = vi.fn();
    await handleAuthRecoverSession(services, { ...message, inputs: { extensionId: "ext", allowLegacyCredentials: false } }, respond);
    expect(post).not.toHaveBeenCalled();
    expect(set.mock.invocationCallOrder[0]).toBeLessThan(clear.mock.invocationCallOrder[0]);
    expect(remove).toHaveBeenCalledWith(["facebookAccounts", "isApikeySession"]);
    expect(respond).toHaveBeenCalledExactlyOnceWith({ success: true, data: { status: "signed_out", snapshotPreserved: true } });
  });
  it("coalesces recovery and rejects overlapping auto-login", async () => {
    const { services, post } = setup({ user: { id: "user" }, apikey: "test" });
    post.mockResolvedValue({ data: { id: "user" } });
    const first = vi.fn(), second = vi.fn(), auto = vi.fn();
    const pending = [handleAuthRecoverSession(services, message, first), handleAuthRecoverSession(services, message, second)];
    await handleAuthAutoLogin(services, { type: "AUTH_AUTO_LOGIN", inputs: { extensionId: "ext" } }, auto);
    await Promise.all(pending);
    expect(post).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledExactlyOnceWith(first.mock.calls[0][0]);
    expect(auto.mock.calls[0][0].code).toBe("AUTH_BUSY");
  });
  it("reports cleanup failure without false signed-out acknowledgment", async () => {
    const { services } = setup({ user: { id: "user" } });
    clear.mockImplementation(async (_services, _message, respond) => respond({ success: false }));
    const respond = vi.fn();
    await handleAuthRecoverSession(services, message, respond);
    expect(respond.mock.calls[0][0].code).toBe("AUTH_CLEANUP_FAILED");
  });
});
