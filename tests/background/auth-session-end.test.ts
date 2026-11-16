import { describe, expect, it, vi } from "vitest";
import type { ApplicationServices } from "../../entrypoints/background/application-services";

const clear = vi.hoisted(() => vi.fn());
vi.mock("../../entrypoints/background/handlers/extension/systemHandlers", () => ({
  handleClearDataAfterLogout: clear,
}));
import { handleAuthLogout, handleAuthRestart, handleAuthAutoLogin } from "../../entrypoints/background/handlers/extension/authHandlers";

function setup() {
  clear.mockReset();
  clear.mockImplementation(async (_services, _message, respond) => respond({ success: true, cleared: true }));
  const post = vi.fn().mockResolvedValue({ data: {} });
  const set = vi.fn().mockResolvedValue(undefined);
  const remove = vi.fn().mockResolvedValue(undefined);
  const read = vi.fn().mockResolvedValue({ fbLoginMode: { mode: "manual" } });
  const getAll = vi.fn().mockResolvedValue([]);
  const services = {
    http: { getHttpInstance: () => ({ post }) },
    storage: { getStorageByKeys: read, getBrowserApi: () => ({ set }), removeStorageByKeys: remove },
    alarm: {}, proxy: {}, cookie: { getBrowserApi: () => ({ getAll }) },
  } as unknown as ApplicationServices;
  return { services, post, set, remove, read, getAll };
}
const logout = { type: "AUTH_LOGOUT", inputs: { extensionId: "ext" } };
const restart = { type: "AUTH_RESTART", inputs: { extensionId: "ext" } };

describe("R1.3 session end orchestration", () => {
  it("signs out then clears local session and both manual snapshots", async () => {
    const { services, post, remove } = setup();
    const respond = vi.fn();
    await handleAuthLogout(services, logout, respond);
    expect(post).toHaveBeenCalledExactlyOnceWith("/extension-sessions/signout", { extension_id: "ext" });
    expect(post.mock.invocationCallOrder[0]).toBeLessThan(clear.mock.invocationCallOrder[0]);
    expect(remove).toHaveBeenCalledWith(expect.arrayContaining(["draftCredentials", "facebookAccounts", "isApikeySession", "manualPlatformCookies", "manualFacebookCookies"]));
    expect(respond).toHaveBeenCalledExactlyOnceWith({ success: true, data: { cleared: true, snapshotPreserved: false, signoutConfirmed: true } });
  });

  it("continues local logout when remote signout fails", async () => {
    const { services, post } = setup();
    post.mockRejectedValue(new Error("private detail"));
    const respond = vi.fn();
    await handleAuthLogout(services, logout, respond);
    expect(clear).toHaveBeenCalledTimes(1);
    expect(respond).toHaveBeenCalledExactlyOnceWith({ success: true, data: { cleared: true, snapshotPreserved: false, signoutConfirmed: false } });
  });

  it("captures manual cookies before restart cleanup and preserves snapshot keys", async () => {
    const { services, post, set, remove, getAll } = setup();
    getAll.mockImplementation(async ({ domain }) => domain === ".facebook.com" ? [{ name: "demo", value: "test" }] : []);
    const respond = vi.fn();
    await handleAuthRestart(services, restart, respond);
    expect(set).toHaveBeenCalledWith({ manualPlatformCookies: JSON.stringify({ ".facebook.com": [{ name: "demo", value: "test" }] }) });
    expect(set.mock.invocationCallOrder[0]).toBeLessThan(clear.mock.invocationCallOrder[0]);
    expect(remove).toHaveBeenCalledWith(["draftCredentials", "facebookAccounts", "isApikeySession"]);
    expect(post).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledExactlyOnceWith({ success: true, data: { cleared: true, snapshotPreserved: true, signoutConfirmed: null } });
  });

  it("does not destroy manual cookies if snapshot fails", async () => {
    const { services, getAll } = setup();
    getAll.mockRejectedValue(new Error("failed"));
    const respond = vi.fn();
    await handleAuthRestart(services, restart, respond);
    expect(clear).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledExactlyOnceWith({ success: false, error: "Session cleanup failed", code: "AUTH_CLEANUP_FAILED" });
  });

  it("rejects auto-login during queued cleanup and fails on missing cleanup ACK", async () => {
    const { services, remove } = setup();
    clear.mockImplementation(async (_services, _message, respond) => respond({ success: false }));
    const respond = vi.fn();
    const pending = handleAuthLogout(services, logout, respond);
    const auto = vi.fn();
    await handleAuthAutoLogin(services, { type: "AUTH_AUTO_LOGIN", inputs: { extensionId: "ext" } }, auto);
    await pending;
    expect(auto.mock.calls[0][0].code).toBe("AUTH_BUSY");
    expect(remove).not.toHaveBeenCalled();
    expect(respond.mock.calls[0][0].code).toBe("AUTH_CLEANUP_FAILED");
  });
});
