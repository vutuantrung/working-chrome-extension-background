import { describe, expect, it, vi } from "vitest";
import type { ApplicationServices } from "../../entrypoints/background/application-services";
vi.mock("../../entrypoints/background/handlers/extension/authHandlers", () => {
  let tail = Promise.resolve();
  return { getAuthenticationGeneration: () => 0, enqueueSessionOperation: (fn: () => Promise<any>) => {
    const next = tail.then(fn); tail = next.then(() => undefined, () => undefined); return next;
  }};
});
import { handleSocialAccountRefresh, handleSocialAccountGetState, readSocialAccountCatalogInSession, refreshSocialAccountCatalogInSession } from "../../entrypoints/background/handlers/extension/socialAccountHandlers";

function setup() {
  const data: Record<string, any> = {
    user: { id: "u", extension_session: { id: "s" } },
    selectedPersonaId: "p", personaSelection: { userId: "u", sessionId: "s", persona: { id: "p" }, revision: 1, activation: "active" },
  };
  const get = vi.fn().mockResolvedValue({ data: [] });
  const set = vi.fn(async (patch: object) => { Object.assign(data, patch); });
  const cache = {};
  const services = { http: { getHttpInstance: () => ({ get }) }, storage: {
    getStorageByKeys: async () => ({ ...data }), getBrowserApi: () => ({ set }), getCachedStorage: () => cache,
  }} as unknown as ApplicationServices;
  const refresh = async () => { const respond = vi.fn(); await handleSocialAccountRefresh(services, { type: "SOCIAL_ACCOUNT_REFRESH" }, respond); return respond.mock.calls[0][0]; };
  const state = async () => { const respond = vi.fn(); await handleSocialAccountGetState(services, { type: "SOCIAL_ACCOUNT_GET_STATE" }, respond); return respond.mock.calls[0][0]; };
  return { data, get, set, services, refresh, state };
}
const row = { account_id: "a", platform: "facebook", status: "active", persona_id: "p", cookies: "fixture" };
describe("R3.2 account catalog regression", () => {
  it("refreshes scoped persona and redacts public credentials", async () => {
    const { get, refresh, data } = setup();
    get.mockResolvedValue({ data: [row, row, { ...row, platform: "twitter" }, { ...row, status: "inactive" }] });
    const result = await refresh();
    expect(result.success).toBe(true);
    expect(result.data.accounts.map((a: any) => a.platform)).toEqual(["facebook", "x"]);
    expect(result.data.accounts[0]).not.toHaveProperty("cookies");
    expect(data.facebookAccounts).toHaveLength(1);
    expect(JSON.parse(get.mock.calls[0][1].params.filter).where).toEqual({ persona_id: "p" });
  });
  it("replaces valid empty catalog and all projections", async () => {
    const { get, refresh, data } = setup();
    get.mockResolvedValueOnce({ data: [row] }).mockResolvedValueOnce({ data: [] });
    await refresh(); expect((await refresh()).data.revision).toBe(2);
    for (const key of ["allSocialAccounts", "facebookAccounts", "personaSocialAccounts", "personaFacebookAccounts"]) expect(data[key]).toEqual([]);
  });
  it("rejects malformed response without persistence", async () => {
    const { get, refresh, set } = setup(); get.mockResolvedValue({ data: {} });
    expect(await refresh()).toMatchObject({ success: false, code: "ACCOUNT_LOAD_FAILED" }); expect(set).not.toHaveBeenCalled();
  });
  it("rejects wrong persona record", async () => {
    const { get, refresh, set } = setup(); get.mockResolvedValue({ data: [{ ...row, persona_id: "wrong" }] });
    expect((await refresh()).success).toBe(false); expect(set).not.toHaveBeenCalled();
  });
  it("rejects changed source during fetch", async () => {
    const { get, refresh, set, data } = setup();
    get.mockImplementation(async () => { data.personaSelection = { ...data.personaSelection, revision: 2 }; return { data: [row] }; });
    expect(await refresh()).toMatchObject({ success: false, code: "ACCOUNT_SOURCE_CHANGED" }); expect(set).not.toHaveBeenCalled();
  });
  it("requires active persona", async () => {
    const { data, refresh, get } = setup(); delete data.personaSelection.activation;
    expect(await refresh()).toMatchObject({ success: false, code: "PERSONA_REQUIRED" }); expect(get).not.toHaveBeenCalled();
  });
  it("uses config source and returns shared configuration", async () => {
    const { data, get, services } = setup(); data.user.extension_session.extension_config_id = "c";
    get.mockResolvedValue({ data: { id: "c", social_accounts: [{ ...row, extension_config_id: "c" }] } });
    const result = await refreshSocialAccountCatalogInSession(services, { include: [] });
    expect(result.configuration.id).toBe("c"); expect(result.catalog.source.type).toBe("extension_config");
    expect(data.personaSocialAccounts).toEqual([]); expect(get).toHaveBeenCalledTimes(1);
  });
  it("does not expose catalog from previous source", async () => {
    const { refresh, data, state, services } = setup(); await refresh();
    data.personaSelection = { ...data.personaSelection, persona: { id: "q" }, revision: 2 }; data.selectedPersonaId = "q";
    expect((await state()).data).toMatchObject({ status: "uninitialized", accounts: [] });
    expect(await readSocialAccountCatalogInSession(services)).toBeNull();
  });
  it("serializes concurrent refresh requests", async () => {
    const { refresh, data } = setup(); await Promise.all([refresh(), refresh()]);
    expect(data.socialAccountCatalog.revision).toBe(2);
  });
});
