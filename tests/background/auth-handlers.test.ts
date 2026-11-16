import { describe, expect, it, vi } from "vitest";
import { handleAuthLogin, handleAuthLoginByApiKey, handleAuthGetState, handleAuthAutoLogin } from "../../entrypoints/background/handlers/extension/authHandlers";
import type { ApplicationServices } from "../../entrypoints/background/application-services";

function setup() {
  const post = vi.fn();
  const get = vi.fn();
  const set = vi.fn().mockResolvedValue(undefined);
  const getStorageByKeys = vi.fn().mockResolvedValue({});
  const cache: Record<string, unknown> = {};
  const services = {
    http: { getHttpInstance: () => ({ post, get }) },
    storage: { getBrowserApi: () => ({ set }), getCachedStorage: () => cache, getStorageByKeys },
  } as unknown as ApplicationServices;
  return { services, post, get, set, getStorageByKeys };
}

describe("R1 auth handlers", () => {
  it("normalizes password login and persists the session", async () => {
    const { services, post, set } = setup();
    post.mockResolvedValue({ data: { id: "user", username: "demo", extension_sessions: [{ id: "session" }] } });
    const respond = vi.fn();
    await handleAuthLogin(services, { type: "AUTH_LOGIN", inputs: { username: "demo", password: "test", extensionId: "ext" } }, respond);
    expect(post).toHaveBeenCalledWith("/extension-sessions/signin", { username: "demo", password: "test", extension_id: "ext" });
    expect(set).toHaveBeenCalledWith({ user: expect.objectContaining({ id: "user", extension_session: expect.objectContaining({ id: "session" }) }), isApikeySession: false });
    expect(respond).toHaveBeenCalledTimes(1);
    expect(respond.mock.calls[0][0].success).toBe(true);
  });
  it("enriches API-key session and persists its flag", async () => {
    const { services, post, get, set } = setup();
    post.mockResolvedValue({ data: { id: "user", extension_config_id: "cfg" } });
    get.mockResolvedValue({ data: { extension_sessions: [{ id: "session", automation: true }] } });
    const respond = vi.fn();
    await handleAuthLoginByApiKey(services, { type: "AUTH_LOGIN_BY_API_KEY", inputs: { apiKey: "test", extensionId: "ext" } }, respond);
    expect(set).toHaveBeenCalledWith({ user: expect.objectContaining({ extension_session: expect.objectContaining({ id: "session", automation: true }) }), isApikeySession: true });
    expect(respond.mock.calls[0][0].data.isApikeySession).toBe(true);
  });
  it("rejects malformed credentials without HTTP or persistence", async () => {
    const { services, post, set } = setup();
    const respond = vi.fn();
    await handleAuthLogin(services, { type: "AUTH_LOGIN", inputs: {} }, respond);
    expect(respond.mock.calls[0][0].success).toBe(false);
    expect(post).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });
  it("redacts HTTP failures and does not persist", async () => {
    const { services, post, set } = setup();
    post.mockRejectedValue(new Error("secret"));
    const respond = vi.fn();
    await handleAuthLogin(services, { type: "AUTH_LOGIN", inputs: { username: "demo", password: "test", extensionId: "ext" } }, respond);
    expect(respond).toHaveBeenCalledWith({ success: false, error: "Authentication failed", code: "AUTH_FAILED" });
    expect(set).not.toHaveBeenCalled();
  });
  it("restores durable state without requiring a warmed cache", async () => {
    const { services, getStorageByKeys } = setup();
    getStorageByKeys.mockResolvedValue({ user: { id: "user" }, isApikeySession: true });
    const respond = vi.fn();
    await handleAuthGetState(services, { type: "AUTH_GET_STATE" }, respond);
    expect(respond).toHaveBeenCalledWith({ success: true, data: { user: { id: "user" }, isApikeySession: true } });
  });
});

describe("R1.2 automatic authentication", () => {
  const message = { type: "AUTH_AUTO_LOGIN", inputs: { extensionId: "ext" } };

  it("returns anonymous without HTTP when no injected key exists", async () => {
    const { services, post, getStorageByKeys } = setup();
    const respond = vi.fn();
    await handleAuthAutoLogin(services, message, respond);
    expect(getStorageByKeys).toHaveBeenCalledWith(["user", "isApikeySession", "apikey"]);
    expect(respond).toHaveBeenCalledExactlyOnceWith({ success: true, data: { status: "anonymous" } });
    expect(post).not.toHaveBeenCalled();
  });

  it("restores existing durable user before considering the injected key", async () => {
    const { services, post, getStorageByKeys } = setup();
    getStorageByKeys.mockResolvedValue({ user: { id: "existing" }, isApikeySession: false, apikey: "test" });
    const respond = vi.fn();
    await handleAuthAutoLogin(services, message, respond);
    expect(respond).toHaveBeenCalledExactlyOnceWith({
      success: true, data: { status: "restored", user: { id: "existing" }, isApikeySession: false },
    });
    expect(post).not.toHaveBeenCalled();
  });

  it("coalesces simultaneous requests and persists once", async () => {
    const { services, post, set, getStorageByKeys } = setup();
    getStorageByKeys.mockResolvedValue({ apikey: "test-key" });
    post.mockResolvedValue({ data: { id: "user", extension_sessions: [{ id: "session" }] } });
    const first = vi.fn();
    const second = vi.fn();
    await Promise.all([
      handleAuthAutoLogin(services, message, first),
      handleAuthAutoLogin(services, message, second),
    ]);
    expect(post).toHaveBeenCalledExactlyOnceWith("/extension-sessions/signin", { api_key: "test-key", extension_id: "ext" });
    expect(set).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledExactlyOnceWith(first.mock.calls[0][0]);
    expect(first.mock.calls[0][0].data.status).toBe("authenticated");
  });

  it("rechecks durable state after a queued password login", async () => {
    const { services, post, set, getStorageByKeys } = setup();
    let state: Record<string, unknown> = { apikey: "test-key" };
    set.mockImplementation(async patch => { state = { ...state, ...patch }; });
    getStorageByKeys.mockImplementation(async () => state);
    post.mockResolvedValue({ data: { id: "manual-user" } });
    const manual = handleAuthLogin(services, { type: "AUTH_LOGIN", inputs: { username: "demo", password: "test", extensionId: "ext" } }, vi.fn());
    const respond = vi.fn();
    await Promise.all([manual, handleAuthAutoLogin(services, message, respond)]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(respond.mock.calls[0][0].data.status).toBe("restored");
    expect(respond.mock.calls[0][0].data.user.id).toBe("manual-user");
  });

  it("shares failure, redacts details and allows a later attempt", async () => {
    const { services, post, set, getStorageByKeys } = setup();
    getStorageByKeys.mockResolvedValue({ apikey: "test-key" });
    post.mockRejectedValueOnce(new Error("private detail"));
    const first = vi.fn();
    const second = vi.fn();
    await Promise.all([handleAuthAutoLogin(services, message, first), handleAuthAutoLogin(services, message, second)]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(set).not.toHaveBeenCalled();
    expect(first).toHaveBeenCalledExactlyOnceWith({ success: false, error: "Authentication failed", code: "AUTH_FAILED" });
    expect(second).toHaveBeenCalledExactlyOnceWith(first.mock.calls[0][0]);
    post.mockResolvedValue({ data: { id: "user" } });
    const retry = vi.fn();
    await handleAuthAutoLogin(services, message, retry);
    expect(post).toHaveBeenCalledTimes(2);
    expect(retry.mock.calls[0][0].data.status).toBe("authenticated");
  });
});
