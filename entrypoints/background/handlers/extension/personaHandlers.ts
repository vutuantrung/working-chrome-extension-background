import type { ApplicationServices } from "../../application-services";
import type { Message, User } from "../../types/types";
import api from "../../infrastructure/api";
import { hasExtensionConfigId } from "../../utils/helpers/proxy";
import { enqueueSessionOperation, getAuthenticationGeneration } from "./authHandlers";

type Respond = (response: unknown) => void;
type PersonaRecord = Record<string, unknown>;
type PersonaSummary = { id: string; first_name: string; last_name: string; nickname: string; job: string; gender: string; country: string; status: string };
type Selection = { userId: string; sessionId: string; revision: number; persona: PersonaSummary };
type PersonaState = {
  selectedPersonaId: string | null;
  selectedPersona: PersonaSummary | null;
  mode: "config_bound" | "persona_bound";
  canSwitch: boolean;
  revision: number;
  status: "unselected" | "selected";
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
    revision: selection?.revision ?? 0, status: selection ? "selected" : "unselected" };
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
  const target = record(await api.persona.getPersonaById(services.http.getHttpInstance(), personaId));
  if (target.id !== personaId) return fail("PERSONA_NOT_FOUND", "Persona not found");
  verifyOwner(target, ctx.user.id);
  if (target.user_id !== ctx.user.id) {
    const candidates = await listPersonas(services, ctx);
    if (!candidates.some(p => p.id === personaId)) return fail("PERSONA_FORBIDDEN", "Persona is not assigned to current user");
  }
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
