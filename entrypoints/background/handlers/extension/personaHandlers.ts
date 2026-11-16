import type { ApplicationServices } from "../../application-services";
import type { Message, User } from "../../types/types";
import api from "../../infrastructure/api";
import { hasExtensionConfigId } from "../../utils/helpers/proxy";
import { enqueueSessionOperation, getAuthenticationGeneration } from "./authHandlers";

type Respond = (response: unknown) => void;
type PersonaRecord = Record<string, unknown>;
type PersonaSummary = { id: string; first_name: string; last_name: string; nickname: string; job: string; gender: string; country: string; status: string };
type Selection = { userId: string; sessionId: string; revision: number; persona: PersonaSummary; activation?: "active" | "reconciliation_required"; switchFrom?: string; switchTarget?: string; resourceSetupPending?: boolean };
type PersonaState = {
  selectedPersonaId: string | null;
  selectedPersona: PersonaSummary | null;
  mode: "config_bound" | "persona_bound";
  canSwitch: boolean;
  revision: number;
  resourceSetupPending: boolean;
  status: "unselected" | "selected" | "active" | "reconciliation_required";
};

class PersonaError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
const fail = (code: string, message: string): never => { throw new PersonaError(code, message); };

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function record(value: unknown): PersonaRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail("PERSONA_LOAD_FAILED", "Invalid persona response");
  const outer = value as PersonaRecord;
  if (outer.success === false) return fail("PERSONA_LOAD_FAILED", "Persona request failed");
  const inner = outer.data ?? outer;
  if (!inner || typeof inner !== "object" || Array.isArray(inner) || !nonEmpty((inner as PersonaRecord).id)) {
    return fail("PERSONA_LOAD_FAILED", "Invalid persona record");
  }
  return inner as PersonaRecord;
}
function summary(persona: PersonaRecord): PersonaSummary {
  const field = (key: string) => typeof persona[key] === "string" ? persona[key] as string : "";
  return { id: field("id"), first_name: field("first_name"), last_name: field("last_name"), nickname: field("nickname"), job: field("job"), gender: field("gender"), country: field("country"), status: field("status") };
}
function verifyOwner(persona: PersonaRecord, userId: string): void {
  if (persona.user_id != null && persona.user_id !== userId) fail("PERSONA_FORBIDDEN", "Persona does not belong to current user");
}
function sessionId(user: User): string {
  return String(user.extension_session?.id ?? user.extension_session?.extension_session_id ?? "");
}

async function readContext(services: ApplicationServices) {
  const storage = services.storage;
  if (!storage) return fail("PERSONA_LOAD_FAILED", "Storage unavailable");
  const values = await storage.getStorageByKeys(["user", "selectedPersonaId", "personaSelection"]);
  const user = values.user as User | undefined;
  if (!user || !nonEmpty(user.id)) return fail("AUTH_REQUIRED", "Authentication required");
  return { storage, user, values, generation: getAuthenticationGeneration() };
}
type Context = Awaited<ReturnType<typeof readContext>>;

async function assertSession(ctx: Context): Promise<void> {
  const { user } = await ctx.storage.getStorageByKeys(["user"]);
  if (!user || user.id !== ctx.user.id || sessionId(user) !== sessionId(ctx.user) ||
      getAuthenticationGeneration() !== ctx.generation) fail("SESSION_CHANGED", "Authentication state changed");
}

async function listPersonas(services: ApplicationServices, ctx: Context): Promise<PersonaRecord[]> {
  const raw = await api.persona.getPersonas(services.http.getHttpInstance(), ctx.user.id);
  const rows = Array.isArray(raw) ? raw : raw?.success !== false && Array.isArray(raw?.data) ? raw.data : null;
  if (!rows) return fail("PERSONA_LOAD_FAILED", "Invalid persona list");
  const personas = rows.map((row: unknown) => record(row));
  for (const persona of personas) verifyOwner(persona, ctx.user.id);
  return personas;
}

function storedSelection(ctx: Context): Selection | null {
  const value = ctx.values.personaSelection as Selection | undefined;
  if (!value || value.userId !== ctx.user.id || value.sessionId !== sessionId(ctx.user) ||
      !nonEmpty(value.persona?.id) || value.persona.id !== ctx.values.selectedPersonaId ||
      !Number.isSafeInteger(value.revision) || value.revision < 1) return null;
  return value;
}
function state(ctx: Context, selection: Selection | null): PersonaState {
  const configured = hasExtensionConfigId(ctx.user.extension_session?.extension_config_id);
  return { selectedPersonaId: selection?.persona.id ?? null, selectedPersona: selection ? summary(selection.persona) : null,
    mode: configured ? "config_bound" : "persona_bound", canSwitch: !configured,
    revision: selection?.revision ?? 0, resourceSetupPending: selection?.resourceSetupPending === true, status: selection ? (selection.activation ?? "selected") : "unselected" };
}
async function persistSelection(ctx: Context, persona: PersonaRecord): Promise<PersonaState> {
  await assertSession(ctx);
  const previous = storedSelection(ctx);
  const next: Selection = { userId: ctx.user.id, sessionId: sessionId(ctx.user),
    revision: (previous?.revision ?? 0) + 1, persona: summary(persona) };
  const patch = { selectedPersonaId: next.persona.id, personaSelection: next };
  await ctx.storage.getBrowserApi().set(patch);
  Object.assign(ctx.storage.getCachedStorage(), patch);
  return state(ctx, next);
}

// Migrate only a durable legacy ID that is verified in the current user's list.
// Never import untrusted document-local snapshots. No remote activation here.
async function restoreSelection(services: ApplicationServices, ctx: Context, candidates?: PersonaRecord[]): Promise<PersonaState> {
  const existing = storedSelection(ctx);
  if (existing) { await assertSession(ctx); return state(ctx, existing); }
  const legacyId = ctx.values.selectedPersonaId;
  if (!nonEmpty(legacyId)) { await assertSession(ctx); return state(ctx, null); }
  const list = candidates ?? await listPersonas(services, ctx);
  const match = list.find(p => p.id === legacyId);
  if (match) return persistSelection(ctx, match);
  await assertSession(ctx);
  return state(ctx, null);
}

async function prepareSelection(services: ApplicationServices) {
  const ctx = await readContext(services);
  let candidates = await listPersonas(services, ctx);
  const current = await restoreSelection(services, ctx, candidates);
  if (current.selectedPersonaId && !candidates.some(p => p.id === current.selectedPersonaId)) {
    return fail("PERSONA_CONFLICT", "Selected persona is not in the current list");
  }
  if (candidates.length === 0 && !current.selectedPersonaId) {
    await assertSession(ctx);
    const created = record(await api.persona.createPersona(services.http.getHttpInstance()));
    verifyOwner(created, ctx.user.id);
    await assertSession(ctx);
    candidates = [created];
  }
  const recommendedPersonaId = current.selectedPersonaId ??
    (current.mode === "config_bound" || candidates.length === 1 ? String(candidates[0].id) : null);
  await assertSession(ctx);
  return { state: current, candidates: candidates.map(summary), recommendedPersonaId,
    status: recommendedPersonaId ? "ready" : "selection_required" };
}

async function validateTarget(services: ApplicationServices, ctx: Context, personaId: string): Promise<PersonaRecord> {
  const target = record(await api.persona.getPersonaById(services.http.getHttpInstance(), personaId));
  if (target.id !== personaId) return fail("PERSONA_NOT_FOUND", "Persona not found");
  verifyOwner(target, ctx.user.id);
  if (target.user_id !== ctx.user.id) {
    const candidates = await listPersonas(services, ctx);
    if (!candidates.some(p => p.id === personaId)) return fail("PERSONA_FORBIDDEN", "Persona is not assigned to current user");
  }
  return target;
}

async function selectPersona(services: ApplicationServices, message: Message): Promise<PersonaState> {
  const { personaId, expectedRevision } = message.inputs ?? {};
  if (!nonEmpty(personaId)) return fail("PERSONA_INVALID_ID", "Invalid persona ID");
  const ctx = await readContext(services);
  const previous = await restoreSelection(services, ctx);
  if (expectedRevision !== undefined && expectedRevision !== previous.revision) return fail("PERSONA_CONFLICT", "Persona selection changed");
  if (previous.mode === "config_bound" && previous.selectedPersonaId && previous.selectedPersonaId !== personaId) {
    return fail("PERSONA_SWITCH_NOT_ALLOWED", "Switching is not allowed with extension config");
  }
  if (previous.selectedPersonaId === personaId) return previous;
  if (previous.status === "active" || previous.status === "reconciliation_required") return fail("PERSONA_SWITCH_NOT_ALLOWED", "Use persona switching for an active or uncertain session");
  const target = await validateTarget(services, ctx, personaId);
  // restoreSelection may have migrated a legacy ID; reread its revision.
  const refreshed = await readContext(services);
  await assertSession(ctx);
  return persistSelection(refreshed, target);
}
async function respondWith<T>(operation: () => Promise<T>, respond: Respond): Promise<void> {
  try { respond({ success: true, data: await operation() }); }
  catch (error) {
    respond({ success: false, code: error instanceof PersonaError ? error.code : "PERSONA_LOAD_FAILED",
      error: error instanceof PersonaError ? error.message : "Persona operation failed" });
  }
}

// Single-flight within this worker avoids duplicated create on simultaneous mount.
let preparing: Promise<Awaited<ReturnType<typeof prepareSelection>>> | undefined;
export function handlePersonaGetState(services: ApplicationServices, _message: Message, respond: Respond): Promise<void> {
  return respondWith(() => enqueueSessionOperation(async () => restoreSelection(services, await readContext(services))), respond);
}
export function handlePersonaPrepareSelection(services: ApplicationServices, _message: Message, respond: Respond): Promise<void> {
  if (!preparing) {
    const pending = enqueueSessionOperation(() => prepareSelection(services));
    preparing = pending;
    void pending.then(() => { if (preparing === pending) preparing = undefined; }, () => { if (preparing === pending) preparing = undefined; });
  }
  const pending = preparing;
  return respondWith(() => pending, respond);
}
export function handlePersonaSelect(services: ApplicationServices, message: Message, respond: Respond): Promise<void> {
  return respondWith(() => enqueueSessionOperation(() => selectPersona(services, message)), respond);
}

async function persistActivation(ctx: Context, persona: PersonaRecord, activation: "active" | "reconciliation_required"): Promise<PersonaState> {
  await assertSession(ctx);
  const previous = storedSelection(ctx);
  const next: Selection = {
    userId: ctx.user.id, sessionId: sessionId(ctx.user),
    revision: (previous?.revision ?? 0) + 1, persona: summary(persona), activation,
  };
  const patch = { selectedPersonaId: next.persona.id, personaSelection: next };
  await ctx.storage.getBrowserApi().set(patch);
  Object.assign(ctx.storage.getCachedStorage(), patch);
  return state(ctx, next);
}

async function activatePersona(services: ApplicationServices, personaId: unknown, expectedRevision?: unknown): Promise<PersonaState> {
  if (!nonEmpty(personaId)) return fail("PERSONA_INVALID_ID", "Invalid persona ID");
  const ctx = await readContext(services);
  const previous = await restoreSelection(services, ctx);
  // Exact same confirmed target is a no-op, even after concurrent activation.
  if (previous.selectedPersonaId === personaId && previous.status === "active") return previous;
  if (storedSelection(await readContext(services))?.switchTarget) return fail("PERSONA_RECONCILIATION_REQUIRED", "Previous switch outcome is uncertain; reconcile before activation");
  if (expectedRevision !== undefined && expectedRevision !== previous.revision) return fail("PERSONA_CONFLICT", "Persona selection changed");
  if (previous.selectedPersonaId && previous.selectedPersonaId !== personaId &&
      (previous.mode === "config_bound" || previous.status !== "selected")) {
    return fail("PERSONA_SWITCH_NOT_ALLOWED", "Use persona switching for another selected session");
  }
  const target = await validateTarget(services, ctx, personaId);
  await assertSession(ctx);
  const refreshed = await readContext(services);
  // Record uncertainty before the remote operation. A crash or timeout must
  // never leave an acknowledged active state for an unconfirmed mutation.
  await persistActivation(refreshed, target, "reconciliation_required");
  try {
    const result = await api.extensionUser.activatePersonaSession(services.http.getHttpInstance(), personaId);
    if (result?.success === false || result?.data?.success === false) {
      return fail("PERSONA_ACTIVATION_FAILED", "Persona activation rejected");
    }
  } catch {
    return fail("PERSONA_ACTIVATION_FAILED", "Persona activation not confirmed; reconcile before retrying");
  }
  try {
    await assertSession(ctx);
    return await persistActivation(await readContext(services), target, "active");
  } catch {
    return fail("PERSONA_RECONCILIATION_REQUIRED", "Activation acknowledged but local state could not be committed");
  }
}

export function handlePersonaActivate(services: ApplicationServices, message: Message, respond: Respond): Promise<void> {
  const { personaId, expectedRevision } = message.inputs ?? {};
  return respondWith(() => enqueueSessionOperation(() => activatePersona(services, personaId, expectedRevision)), respond);
}

export function handlePersonaEnsureDefault(services: ApplicationServices, _message: Message, respond: Respond): Promise<void> {
  return respondWith(() => enqueueSessionOperation(async () => {
    const ctx = await readContext(services);
    if (!hasExtensionConfigId(ctx.user.extension_session?.extension_config_id)) {
      return fail("PERSONA_SWITCH_NOT_ALLOWED", "Default persona requires extension config");
    }
    const current = await restoreSelection(services, ctx);
    if (current.status === "active") return current;
    // Do not call a public handler from this queue: it would deadlock.
    if (current.selectedPersonaId) return activatePersona(services, current.selectedPersonaId, current.revision);
    const prepared = await prepareSelection(services);
    return activatePersona(services, prepared.recommendedPersonaId, prepared.state.revision);
  }), respond);
}


// Switching is remote session orchestration, not a storage transaction. Persist
// the old/target IDs before remote mutation; do not assume compensation is safe.
const SWITCH_RESOURCE_KEYS = [
  "profile", "profileId", "personaProxy", "personaSocialAccounts",
  "personaFacebookAccounts", "allSocialAccounts", "facebookAccounts",
  "activeProxy", "fbAccountCache", "lastActiveFacebookTab",
];

async function persistSwitchState(ctx: Context, persona: PersonaRecord, options: {
  activation: "active" | "reconciliation_required";
  switchFrom?: string;
  switchTarget?: string;
  resourceSetupPending?: boolean;
}): Promise<PersonaState> {
  await assertSession(ctx);
  const next: Selection = {
    userId: ctx.user.id, sessionId: sessionId(ctx.user),
    revision: (storedSelection(ctx)?.revision ?? 0) + 1,
    persona: summary(persona), ...options,
  };
  const patch = { selectedPersonaId: next.persona.id, personaSelection: next };
  await ctx.storage.getBrowserApi().set(patch);
  Object.assign(ctx.storage.getCachedStorage(), patch);
  return state(ctx, next);
}

function requireMutationAcknowledgment(result: any): void {
  if (result?.success === false || result?.data?.success === false) {
    throw new Error("Remote persona mutation rejected");
  }
}

async function invalidateSwitchResources(ctx: Context): Promise<void> {
  // Replacement values prevent legacy deep-merge from retaining old account
  // entries in this snapshot. The remaining resource writers are R3/R4 work.
  await ctx.storage.removeStorageByKeys(SWITCH_RESOURCE_KEYS);
  const empty = { personaProxy: {}, activeProxy: {}, personaSocialAccounts: [],
    personaFacebookAccounts: [], allSocialAccounts: [], facebookAccounts: [] };
  await ctx.storage.getBrowserApi().set(empty);
  Object.assign(ctx.storage.getCachedStorage(), empty);
}

async function switchPersonaSession(services: ApplicationServices, message: Message): Promise<PersonaState> {
  const { personaId, expectedRevision } = message.inputs ?? {};
  if (!nonEmpty(personaId)) return fail("PERSONA_INVALID_ID", "Invalid persona ID");
  const ctx = await readContext(services);
  const previous = await restoreSelection(services, ctx);
  if (!previous.canSwitch) return fail("PERSONA_SWITCH_NOT_ALLOWED", "Switching is not allowed with extension config");
  if (previous.status === "reconciliation_required") return fail("PERSONA_RECONCILIATION_REQUIRED", "Previous persona operation requires reconciliation");
  if (previous.selectedPersonaId === personaId && previous.status === "active") return previous;
  if (previous.resourceSetupPending) return fail("PERSONA_CONFLICT", "Complete the current persona resource setup before switching again");
  if (expectedRevision !== undefined && expectedRevision !== previous.revision) return fail("PERSONA_CONFLICT", "Persona selection changed");
  if (!previous.selectedPersonaId || !previous.selectedPersona) return fail("PERSONA_CONFLICT", "No current persona selection");

  // Validate before deactivating the previous session.
  const target = await validateTarget(services, ctx, personaId);
  await assertSession(ctx);
  await persistSwitchState(await readContext(services), previous.selectedPersona, {
    activation: "reconciliation_required", switchFrom: previous.selectedPersonaId, switchTarget: personaId,
  });
  try {
    const http = services.http.getHttpInstance();
    if (previous.selectedPersonaId !== personaId) {
      requireMutationAcknowledgment(await api.extensionUser.deactivatePersona(http, previous.selectedPersonaId));
    }
    await assertSession(ctx);
    requireMutationAcknowledgment(await api.extensionUser.activatePersonaSession(http, personaId));
    await assertSession(ctx);
    await invalidateSwitchResources(ctx);
    return await persistSwitchState(await readContext(services), target, {
      activation: "active", resourceSetupPending: true,
    });
  } catch {
    return fail("PERSONA_RECONCILIATION_REQUIRED", "Persona switch outcome is uncertain; reconcile before retrying");
  }
}

async function completeSwitchResources(services: ApplicationServices, message: Message): Promise<PersonaState> {
  const { personaId, expectedRevision } = message.inputs ?? {};
  const ctx = await readContext(services);
  const selection = storedSelection(ctx);
  if (!selection || selection.activation !== "active" || selection.persona.id !== personaId ||
      selection.revision !== expectedRevision) return fail("PERSONA_CONFLICT", "Persona session changed during resource setup");
  if (!selection.resourceSetupPending) return state(ctx, selection);
  return persistSwitchState(ctx, selection.persona, { activation: "active", resourceSetupPending: false });
}

export function handlePersonaSwitch(services: ApplicationServices, message: Message, respond: Respond): Promise<void> {
  return respondWith(() => enqueueSessionOperation(() => switchPersonaSession(services, message)), respond);
}

export function handlePersonaCompleteSwitchResources(services: ApplicationServices, message: Message, respond: Respond): Promise<void> {
  return respondWith(() => enqueueSessionOperation(() => completeSwitchResources(services, message)), respond);
}
