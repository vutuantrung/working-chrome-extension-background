import { describe, expect, it, vi } from "vitest";
import type { ApplicationServices } from "../../entrypoints/background/application-services";
vi.mock("../../entrypoints/background/handlers/extension/authHandlers", () => ({
  enqueueSessionOperation: (fn: () => Promise<unknown>) => fn(),
  getAuthenticationGeneration: () => 0,
}));
import { handlePersonaSwitch, handlePersonaCompleteSwitchResources } from "../../entrypoints/background/handlers/extension/personaHandlers";

const command = { type: "PERSONA_SWITCH", inputs: { personaId: "p2", expectedRevision: 1 } };
function setup() {
  const storage: Record<string, any> = {
    user: { id: "u1", extension_session: { id: "s1" } },
    selectedPersonaId: "p1", personaSelection: { userId: "u1", sessionId: "s1", revision: 1, persona: { id: "p1" }, activation: "active" },
    profileId: "old", allSocialAccounts: [{ account_id: "old" }],
  };
  const get = vi.fn().mockResolvedValue({ data: { id: "p2", user_id: "u1" } });
  const patch = vi.fn().mockResolvedValue({ data: {} });
  const set = vi.fn(async (values: object) => { Object.assign(storage, values); });
  const remove = vi.fn(async (keys: string[]) => { for (const key of keys) delete storage[key]; });
  const services = { http: { getHttpInstance: () => ({ get, patch }) }, storage: {
    getStorageByKeys: async () => ({ ...storage }), getBrowserApi: () => ({ set }),
    getCachedStorage: () => ({}), removeStorageByKeys: remove,
  } } as unknown as ApplicationServices;
  return { services, storage, get, patch, set, remove };
}

describe("R2.4 persona switching", () => {
  it("validates before remote mutation, invalidates old resources and commits pending setup", async () => {
    const { services, get, patch, set, storage } = setup();
    const respond = vi.fn();
    await handlePersonaSwitch(services, command, respond);
    expect(get.mock.invocationCallOrder[0]).toBeLessThan(patch.mock.invocationCallOrder[0]);
    expect(set.mock.calls[0][0]).toMatchObject({ personaSelection: { activation: "reconciliation_required", switchFrom: "p1", switchTarget: "p2" } });
    expect(patch.mock.calls).toEqual([["/extension-sessions/inactive-persona/p1"], ["/extension-sessions/active-persona/p2"]]);
    expect(storage.profileId).toBeUndefined();
    expect(storage.allSocialAccounts).toEqual([]);
    expect(respond.mock.calls[0][0].data).toMatchObject({ selectedPersonaId: "p2", status: "active", resourceSetupPending: true, revision: 3 });
  });
  it("rejects wrong owner without mutation", async () => {
    const { services, get, patch } = setup();
    get.mockResolvedValue({ data: { id: "p2", user_id: "other" } });
    const respond = vi.fn(); await handlePersonaSwitch(services, command, respond);
    expect(patch).not.toHaveBeenCalled();
    expect(respond.mock.calls[0][0].code).toBe("PERSONA_FORBIDDEN");
  });
  it("rejects config-bound switching", async () => {
    const { services, storage, patch } = setup();
    storage.user.extension_session.extension_config_id = "cfg";
    const respond = vi.fn(); await handlePersonaSwitch(services, command, respond);
    expect(patch).not.toHaveBeenCalled();
    expect(respond.mock.calls[0][0].code).toBe("PERSONA_SWITCH_NOT_ALLOWED");
  });
  it("does not activate after failed deactivation", async () => {
    const { services, patch, storage } = setup();
    patch.mockResolvedValueOnce({ data: { success: false } });
    const respond = vi.fn(); await handlePersonaSwitch(services, command, respond);
    expect(patch).toHaveBeenCalledTimes(1);
    expect(storage.personaSelection.activation).toBe("reconciliation_required");
    expect(respond.mock.calls[0][0].code).toBe("PERSONA_RECONCILIATION_REQUIRED");
  });
  it("retains uncertain switch intent if activation fails; no blind retry", async () => {
    const { services, patch, storage } = setup();
    patch.mockResolvedValueOnce({ data: {} }).mockRejectedValueOnce(new Error("timeout"));
    await handlePersonaSwitch(services, command, vi.fn());
    const respond = vi.fn(); await handlePersonaSwitch(services, command, respond);
    expect(patch).toHaveBeenCalledTimes(2);
    expect(storage.personaSelection.switchTarget).toBe("p2");
    expect(respond.mock.calls[0][0].code).toBe("PERSONA_RECONCILIATION_REQUIRED");
  });
  it("rejects stale revision; same confirmed target does not mutate", async () => {
    const { services, patch } = setup();
    const respond = vi.fn();
    await handlePersonaSwitch(services, { ...command, inputs: { personaId: "p2", expectedRevision: 0 } }, respond);
    expect(respond.mock.calls[0][0].code).toBe("PERSONA_CONFLICT");
    await handlePersonaSwitch(services, { ...command, inputs: { personaId: "p1", expectedRevision: 1 } }, respond);
    expect(patch).not.toHaveBeenCalled();
  });
  it("accepts resource completion only for matching identity and revision", async () => {
    const { services, storage } = setup();
    await handlePersonaSwitch(services, command, vi.fn());
    const respond = vi.fn();
    await handlePersonaCompleteSwitchResources(services, { type: "PERSONA_COMPLETE_SWITCH_RESOURCES", inputs: { personaId: "p2", expectedRevision: 2 } }, respond);
    expect(respond.mock.calls[0][0].code).toBe("PERSONA_CONFLICT");
    await handlePersonaCompleteSwitchResources(services, { type: "PERSONA_COMPLETE_SWITCH_RESOURCES", inputs: { personaId: "p2", expectedRevision: 3 } }, respond);
    expect(storage.personaSelection.resourceSetupPending).toBe(false);
  });
});
