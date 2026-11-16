import { describe, expect, it, vi } from "vitest";
import { handleAuthLogin, handleAuthLoginByApiKey, handleAuthGetState } from "../../entrypoints/background/handlers/extension/authHandlers";
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
