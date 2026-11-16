import { describe, expect, it, vi } from "vitest";
import type { ApplicationServices } from "../../entrypoints/background/application-services";
vi.mock("../../entrypoints/background/handlers/extension/authHandlers", () => ({
  enqueueSessionOperation: (fn: () => Promise<unknown>) => fn(),
  getAuthenticationGeneration: () => 0,
}));
import { handlePersonaActivate, handlePersonaEnsureDefault, handlePersonaGetState, handlePersonaPrepareSelection } from "../../entrypoints/background/handlers/extension/personaHandlers";

function setup(configured = false) {
  const persona = { id: "p1", user_id: "u1", first_name: "Demo", cookies: "not-for-ui" };
  const storage: Record<string, any> = { user: { id: "u1", extension_session: { id: "s1", ...(configured ? { extension_config_id: "cfg" } : {}) } } };
  const get = vi.fn(async (url: string) => ({ data: url === "/personas" ? [persona] : persona }));
  const patch = vi.fn().mockResolvedValue({ data: {} });
  const post = vi.fn().mockResolvedValue({ data: persona });
  const set = vi.fn(async (values: object) => { Object.assign(storage, values); });
  const services = { http: { getHttpInstance: () => ({ get, patch, post }) }, storage: {
    getStorageByKeys: async () => ({ ...storage }), getBrowserApi: () => ({ set }), getCachedStorage: () => ({}),
  } } as unknown as ApplicationServices;
  return { services, persona, storage, get, patch, post, set };
}
const command = { type: "PERSONA_ACTIVATE", inputs: { personaId: "p1" } };
describe("R2.3 persona activation", () => {
  it("commits active only after server acknowledgment and redacts resources", async () => {
    const { services, patch, set, storage } = setup();
    const respond = vi.fn();
    await handlePersonaActivate(services, command, respond);
    expect(set.mock.calls[0][0]).toMatchObject({ personaSelection: { activation: "reconciliation_required" } });
    expect(patch).toHaveBeenCalledExactlyOnceWith("/extension-sessions/active-persona/p1");
    expect(storage.personaSelection.activation).toBe("active");
    expect(respond.mock.calls[0][0].data.status).toBe("active");
    expect(JSON.stringify(respond.mock.calls[0][0])).not.toContain("not-for-ui");
    expect(set.mock.invocationCallOrder[0]).toBeLessThan(patch.mock.invocationCallOrder[0]);
  });
  it("does not repeat confirmed activation", async () => {
    const { services, patch } = setup();
    await handlePersonaActivate(services, command, vi.fn());
    await handlePersonaActivate(services, command, vi.fn());
    expect(patch).toHaveBeenCalledTimes(1);
  });
  it("retains uncertain state on remote rejection", async () => {
    const { services, patch, storage } = setup();
    patch.mockRejectedValue(new Error("network error"));
    const respond = vi.fn();
    await handlePersonaActivate(services, command, respond);
    expect(storage.personaSelection.activation).toBe("reconciliation_required");
    expect(respond.mock.calls[0][0].code).toBe("PERSONA_ACTIVATION_FAILED");
  });
  it("rejects explicit unsuccessful API response", async () => {
    const { services, patch } = setup();
    patch.mockResolvedValue({ data: { success: false } });
    const respond = vi.fn();
    await handlePersonaActivate(services, command, respond);
    expect(respond.mock.calls[0][0].success).toBe(false);
  });
  it("validates target ownership before activation", async () => {
    const { services, get, patch } = setup();
    get.mockResolvedValue({ data: { id: "p1", user_id: "other" } } as any);
    const respond = vi.fn();
    await handlePersonaActivate(services, command, respond);
    expect(patch).not.toHaveBeenCalled();
    expect(respond.mock.calls[0][0].code).toBe("PERSONA_FORBIDDEN");
  });
  it("ensures configured default through same activation path", async () => {
    const { services, patch } = setup(true);
    const respond = vi.fn();
    await handlePersonaEnsureDefault(services, { type: "PERSONA_ENSURE_DEFAULT" }, respond);
    expect(respond.mock.calls[0][0].data.status).toBe("active");
    expect(patch).toHaveBeenCalledTimes(1);
  });
  it("does not create when list payload is malformed", async () => {
    const { services, get, post } = setup();
    get.mockResolvedValue({ data: { unexpected: true } } as any);
    const respond = vi.fn();
    await handlePersonaPrepareSelection(services, { type: "PERSONA_PREPARE_SELECTION" }, respond);
    expect(post).not.toHaveBeenCalled();
    expect(respond.mock.calls[0][0].code).toBe("PERSONA_LOAD_FAILED");
  });
  it("reports persisted uncertainty through state query", async () => {
    const { services, patch } = setup();
    patch.mockRejectedValue(new Error("failed"));
    await handlePersonaActivate(services, command, vi.fn());
    const respond = vi.fn();
    await handlePersonaGetState(services, { type: "PERSONA_GET_STATE" }, respond);
    expect(respond.mock.calls[0][0].data.status).toBe("reconciliation_required");
  });
});
