import type { ApplicationServices } from "../../application-services";
import type { Message, User } from "../../types/types";
import apiCall from "../../infrastructure/api";
import { hasExtensionConfigId } from "../../utils/helpers/proxy";
import { handleClearDataAfterLogout } from "./systemHandlers";
import { Constants } from "../../utils/constants";

type Respond = (response: any) => void;
type AuthenticationInput =
  | { mode: "password"; username: string; password: string; extensionId: string }
  | { mode: "apiKey"; apiKey: string; extensionId: string };

function normalizeAuthenticatedUser(response: any): User {
  if (!response || typeof response.id !== "string" || !response.id.trim() || response.success === false) {
    throw new Error("Invalid authentication response");
  }
  const session = response.extension_session
    || (Array.isArray(response.extension_sessions) ? response.extension_sessions[0] : null)
    || (Array.isArray(response.extension_config?.extension_sessions) ? response.extension_config.extension_sessions[0] : null)
    || {};
  const extensionConfigId = response.extension_config_id
    ?? session.extension_config_id ?? response.extension_config?.id;
  return {
    id: response.id,
    username: response.username,
    name: response.display_name,
    apikey: response.api_key || response.apikey,
    tenants: response.tenant || response.tenants,
    extension_session: { ...session, extension_config_id: extensionConfigId },
  };
}

function enrichSession(user: User, config: any): User {
  const session = config?.extension_sessions?.[0];
  if (!session) return user;
  const existing = user.extension_session;
  return {
    ...user,
    extension_session: {
      ...session,
      ...existing,
      id: existing?.id || session.id,
      extension_session_id: existing?.id || session.id,
      extension_config_id: existing.extension_config_id,
      extension_id: existing?.extension_id || session.extension_id,
      automation: existing?.automation ?? session.automation ?? false,
    },
  };
}

async function authenticate(
  services: ApplicationServices,
  input: AuthenticationInput,
  respond: Respond,
): Promise<void> {
  activeAuthenticationOperations += 1;
  try {
    if (!services.storage) throw new Error("Storage unavailable");
    const http = services.http.getHttpInstance();
    const response = input.mode === "apiKey"
      ? await apiCall.extensionUser.loginByApikey(http, input.apiKey, input.extensionId)
      : await apiCall.extensionUser.login(http, input.username, input.password, input.extensionId);
    let user = normalizeAuthenticatedUser(response);
    let extensionConfig: any = null;
    let configurationUnavailable = false;
    const configId = user.extension_session.extension_config_id;
    if (hasExtensionConfigId(configId)) {
      try {
        extensionConfig = await apiCall.extensionUser.getExtensionConfigInfo(
          http, configId, { include: [{ relation: "extension_sessions" }] },
        );
        user = enrichSession(user, extensionConfig);
      } catch {
        // Preserve existing best-effort post-login configuration behavior.
        configurationUnavailable = true;
      }
    }
    const isApikeySession = input.mode === "apiKey";
    // Write only auth-owned keys; do not deep-merge a previous user's session.
    // Use the existing storage adapter through StorageService, not Chrome directly.
    await services.storage.getBrowserApi().set({ user, isApikeySession });
    services.storage.getCachedStorage().user = user;
    lastExtensionId = input.extensionId;
    authenticationGeneration += 1;
    respond({ success: true, data: { user, isApikeySession, extensionConfig, configurationUnavailable } });
  } catch {
    respond({ success: false, error: "Authentication failed", code: "AUTH_FAILED" });
  } finally {
    activeAuthenticationOperations -= 1;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// Serialize new authentication commands within this worker instance. This is
// not a durable lock and does not serialize legacy commands or other writers.
let authenticationTail: Promise<void> = Promise.resolve();
let activeAuthenticationOperations = 0;
let authenticationGeneration = 0;
let lastExtensionId: string | undefined;

export function getAuthenticationGeneration(): number { return authenticationGeneration; }

// Persona selection shares the auth mutation queue while it reads/commits identity.
export function enqueueSessionOperation<T>(operation: () => Promise<T>): Promise<T> {
  const next = authenticationTail.then(operation);
  authenticationTail = next.then(() => undefined, () => undefined);
  return next;
}
function enqueueAuthentication(services: ApplicationServices, input: AuthenticationInput, respond: Respond): Promise<void> {
  const next = authenticationTail.then(() => authenticate(services, input, respond));
  authenticationTail = next.catch(() => undefined);
  return next;
}

export async function handleAuthLogin(services: ApplicationServices, message: Message, respond: Respond): Promise<void> {
  const { username, password, extensionId } = message.inputs ?? {};
  if (!isNonEmptyString(username) || !isNonEmptyString(password) || !isNonEmptyString(extensionId)) {
    respond({ success: false, error: "Username, password and extension ID are required", code: "INVALID_AUTH_INPUT" });
    return;
  }
  return enqueueAuthentication(services, { mode: "password", username, password, extensionId }, respond);
}

export async function handleAuthLoginByApiKey(services: ApplicationServices, message: Message, respond: Respond): Promise<void> {
  const { apiKey, extensionId } = message.inputs ?? {};
  if (!isNonEmptyString(apiKey) || !isNonEmptyString(extensionId)) {
    respond({ success: false, error: "API key and extension ID are required", code: "INVALID_AUTH_INPUT" });
    return;
  }
  return enqueueAuthentication(services, { mode: "apiKey", apiKey, extensionId }, respond);
}

export async function handleAuthGetState(services: ApplicationServices, _message: Message, respond: Respond): Promise<void> {
  try {
    if (!services.storage) throw new Error("Storage unavailable");
    // Durable read avoids depending on a warmed legacy storage cache.
    const state = await services.storage.getStorageByKeys(["user", "isApikeySession"]);
    respond({ success: true, data: { user: state.user ?? null, isApikeySession: !!state.user && state.isApikeySession === true } });
  } catch {
    respond({ success: false, error: "Unable to restore authentication state", code: "AUTH_STATE_UNAVAILABLE" });
  }
}

type AutoLoginResponse =
  | { success: true; data: { status: "anonymous" } }
  | { success: true; data: { status: "restored"; user: User; isApikeySession: boolean } }
  | { success: true; data: { status: "authenticated"; session: any } }
  | { success: false; error: string; code: string };

async function restoreOrAuthenticate(
  services: ApplicationServices,
  extensionId: string,
): Promise<AutoLoginResponse> {
  try {
    if (!services.storage) throw new Error("Storage unavailable");
    // Durable state is authoritative. Read inside the authentication queue so
    // a completed manual login cannot be overwritten by a queued auto-login.
    lastExtensionId = extensionId;
    const state = await services.storage.getStorageByKeys(["user", "isApikeySession", "apikey"]);
    if (state.user) {
      return { success: true, data: { status: "restored", user: state.user, isApikeySession: state.isApikeySession === true } };
    }
    if (!isNonEmptyString(state.apikey)) {
      return { success: true, data: { status: "anonymous" } };
    }

    let result: AutoLoginResponse | undefined;
    await authenticate(services, { mode: "apiKey", apiKey: state.apikey, extensionId }, response => {
      result = response.success === true
        ? { success: true, data: { status: "authenticated", session: response.data } }
        : response;
    });
    return result ?? { success: false, error: "Authentication failed", code: "AUTH_FAILED" };
  } catch {
    return { success: false, error: "Unable to restore authentication state", code: "AUTH_STATE_UNAVAILABLE" };
  }
}

// Coalesce automatic requests for the same extension within one worker.
// Explicit password/API-key commands keep their existing queue semantics.
const autoLoginInFlight = new Map<string, Promise<AutoLoginResponse>>();
let pendingSessionEnds = 0;
let pendingRecoveries = 0;

function getOrStartAutoLogin(
  services: ApplicationServices,
  extensionId: string,
): Promise<AutoLoginResponse> {
  const existing = autoLoginInFlight.get(extensionId);
  if (existing) return existing;

  const next = authenticationTail.then(() => restoreOrAuthenticate(services, extensionId));
  autoLoginInFlight.set(extensionId, next);
  authenticationTail = next.then(() => undefined, () => undefined);
  void next.then(
    () => autoLoginInFlight.delete(extensionId),
    () => autoLoginInFlight.delete(extensionId),
  );
  return next;
}

export async function handleAuthAutoLogin(
  services: ApplicationServices,
  message: Message,
  respond: Respond,
): Promise<void> {
  const { extensionId } = message.inputs ?? {};
  if (!isNonEmptyString(extensionId)) {
    respond({ success: false, error: "Extension ID is required", code: "INVALID_AUTH_INPUT" });
    return;
  }
  if (pendingSessionEnds > 0 || pendingRecoveries > 0) {
    respond({ success: false, error: "Session cleanup in progress", code: "AUTH_BUSY" });
    return;
  }
  const result = await getOrStartAutoLogin(services, extensionId);
  respond(result);
}

type SessionEndMode = "logout" | "restart" | "expired";
type SessionEndResult = {
  cleared: true;
  snapshotPreserved: boolean;
  signoutConfirmed: boolean | null;
};

const SESSION_END_KEYS = [
  "draftCredentials", "facebookAccounts", "isApikeySession",
];
const MANUAL_SNAPSHOT_KEYS = ["manualPlatformCookies", "manualFacebookCookies"];

async function preserveManualCookies(services: ApplicationServices): Promise<boolean> {
  const storage = services.storage;
  if (!storage) throw new Error("Storage unavailable");
  const { fbLoginMode } = await storage.getStorageByKeys(["fbLoginMode"]);
  if (fbLoginMode !== "manual" && fbLoginMode?.mode !== "manual") return false;
  if (!services.cookie) throw new Error("Cookie service unavailable");

  const browserCookies = services.cookie.getBrowserApi();
  const entries = await Promise.all(Constants.SOCIAL_COOKIE_DOMAINS.map(async domain =>
    [domain, await browserCookies.getAll({ domain })] as const));
  const snapshot = Object.fromEntries(entries.filter(([, cookies]) => cookies && cookies.length > 0));
  if (Object.keys(snapshot).length === 0) return false;
  await storage.getBrowserApi().set({ manualPlatformCookies: JSON.stringify(snapshot) });
  return true;
}

async function tryServerSignout(services: ApplicationServices, extensionId: string): Promise<boolean> {
  try {
    await apiCall.extensionUser.logout(services.http.getHttpInstance(), extensionId);
    return true;
  } catch {
    return false;
  }
}

async function endSession(
  services: ApplicationServices,
  mode: SessionEndMode,
  extensionId: string,
  respond: Respond,
): Promise<void> {
  try {
    if (!services.storage || !services.alarm || !services.proxy || !services.cookie) {
      throw new Error("Session cleanup dependencies unavailable");
    }

    // Restart retains the legacy recovery semantics: capture manual cookies
    // before destructive cleanup; never clear a snapshot on restart.
    const snapshotPreserved = mode !== "logout" ? await preserveManualCookies(services) : false;
    // Explicit logout signs out remotely before cleanup. Restart intentionally
    // keeps the existing local-only behavior for recovery from a dead proxy.
    const signoutConfirmed = mode === "logout" ? await tryServerSignout(services, extensionId) : null;

    let cleared = false;
    await handleClearDataAfterLogout(services, { inputs: {} }, response => {
      cleared = response?.success === true && response?.cleared === true;
    });
    if (!cleared) throw new Error("Session cleanup failed");

    await services.storage.removeStorageByKeys([
      ...SESSION_END_KEYS.filter(key => mode !== "expired" || key !== "draftCredentials"),
      ...(mode === "logout" ? MANUAL_SNAPSHOT_KEYS : []),
    ]);
    authenticationGeneration += 1;
    const data: SessionEndResult = { cleared: true, snapshotPreserved, signoutConfirmed };
    respond({ success: true, data });
  } catch {
    respond({ success: false, error: "Session cleanup failed", code: "AUTH_CLEANUP_FAILED" });
  }
}

function enqueueSessionEnd(
  services: ApplicationServices,
  mode: SessionEndMode,
  message: Message,
  respond: Respond,
): Promise<void> {
  const { extensionId } = message.inputs ?? {};
  if (!isNonEmptyString(extensionId)) {
    respond({ success: false, error: "Extension ID is required", code: "INVALID_AUTH_INPUT" });
    return Promise.resolve();
  }
  pendingSessionEnds += 1;
  const next = authenticationTail.then(() => endSession(services, mode, extensionId, respond));
  authenticationTail = next.catch(() => undefined);
  return next.finally(() => { pendingSessionEnds -= 1; });
}

export function handleAuthLogout(services: ApplicationServices, message: Message, respond: Respond): Promise<void> {
  return enqueueSessionEnd(services, "logout", message, respond);
}

export function handleAuthRestart(services: ApplicationServices, message: Message, respond: Respond): Promise<void> {
  return enqueueSessionEnd(services, "restart", message, respond);
}

type RecoveryResponse =
  | { success: true; data: { status: "recovered"; session: any } }
  | { success: true; data: { status: "signed_out"; snapshotPreserved: boolean } }
  | { success: false; error: string; code: string };

async function attemptRecovery(services: ApplicationServices, input: AuthenticationInput): Promise<any | null> {
  let session: any = null;
  await authenticate(services, input, response => {
    if (response.success === true) session = response.data;
  });
  return session;
}

async function recoverExpiredSession(
  services: ApplicationServices,
  extensionId: string,
  allowLegacyCredentials: boolean,
  expectedGeneration?: number,
): Promise<RecoveryResponse> {
  try {
    if (!services.storage) throw new Error("Storage unavailable");
    if (expectedGeneration !== undefined && expectedGeneration !== authenticationGeneration) {
      return { success: false, error: "Authentication state changed", code: "AUTH_STALE" };
    }
    const state = await services.storage.getStorageByKeys(["user", "apikey", "draftCredentials"]);
    // A delayed expiry notification must not sign in after logout has cleared user.
    if (!state.user) return { success: true, data: { status: "signed_out", snapshotPreserved: false } };

    let session: any = null;
    if (isNonEmptyString(state.apikey)) {
      session = await attemptRecovery(services, { mode: "apiKey", apiKey: state.apikey, extensionId });
    }
    const remembered = state.draftCredentials;
    // Keep the old opt-in condition for existing legacy credentials only.
    // Never create a new stored password or send credentials to Sidepanel.
    if (!session && allowLegacyCredentials && isNonEmptyString(remembered?.username) && isNonEmptyString(remembered?.password)) {
      session = await attemptRecovery(services, {
        mode: "password", username: remembered.username, password: remembered.password, extensionId,
      });
    }
    if (session) return { success: true, data: { status: "recovered", session } };

    let result: RecoveryResponse | undefined;
    await endSession(services, "expired", extensionId, response => {
      result = response.success === true
        ? { success: true, data: { status: "signed_out", snapshotPreserved: response.data.snapshotPreserved } }
        : response;
    });
    return result ?? { success: false, error: "Session recovery failed", code: "AUTH_RECOVERY_FAILED" };
  } catch {
    return { success: false, error: "Session recovery failed", code: "AUTH_RECOVERY_FAILED" };
  }
}

// One recovery per extension in this worker. Run the entire fallback and cleanup
// sequence inside the existing queue; do not recursively enqueue authenticate.
const recoveryInFlight = new Map<string, Promise<RecoveryResponse>>();

export async function handleAuthRecoverSession(
  services: ApplicationServices,
  message: Message,
  respond: Respond,
): Promise<void> {
  const { extensionId, allowLegacyCredentials } = message.inputs ?? {};
  return queueRecovery(services, extensionId, allowLegacyCredentials === true, respond);
}

async function queueRecovery(services: ApplicationServices, extensionId: unknown, allowLegacyCredentials: boolean, respond: Respond, expectedGeneration?: number): Promise<void> {
  if (!isNonEmptyString(extensionId)) {
    respond({ success: false, error: "Extension ID is required", code: "INVALID_AUTH_INPUT" });
    return;
  }
  if (pendingSessionEnds > 0) {
    respond({ success: false, error: "Session cleanup in progress", code: "AUTH_BUSY" });
    return;
  }
  const existing = recoveryInFlight.get(extensionId);
  if (existing) {
    respond(await existing);
    return;
  }
  pendingRecoveries += 1;
  const next = authenticationTail.then(() => recoverExpiredSession(services, extensionId, allowLegacyCredentials, expectedGeneration));
  recoveryInFlight.set(extensionId, next);
  authenticationTail = next.then(() => undefined, () => undefined);
  try {
    respond(await next);
  } finally {
    recoveryInFlight.delete(extensionId);
    pendingRecoveries -= 1;
  }
}

// The HTTP interceptor invokes this only for requests issued outside the
// authentication workflow. No Sidepanel receiver is needed to recover.
export async function recoverFromUnauthorized(
  services: ApplicationServices,
  requestGeneration: number,
): Promise<void> {
  if (activeAuthenticationOperations || pendingSessionEnds || pendingRecoveries ||
      requestGeneration !== authenticationGeneration) return;
  const state = await services.storage?.getStorageByKeys(["user", "fbLoginMode"]);
  if (!state?.user || requestGeneration !== authenticationGeneration ||
      activeAuthenticationOperations || pendingSessionEnds || pendingRecoveries) return;

  const extensionId = lastExtensionId || state.user.extension_session?.extension_id;
  if (!isNonEmptyString(extensionId)) return;

  // The former document-local selection flag is not available in a worker.
  // Use persisted login-mode selection for the existing legacy fallback.
  const selection = state.fbLoginMode;
  const allowLegacy = selection === "manual" || selection === "auto" ||
    selection?.mode === "manual" || selection?.mode === "auto";
  await queueRecovery(services, extensionId, allowLegacy, response => {
    if (response.code === "AUTH_STALE" || response.code === "AUTH_BUSY") return;
    // Notification carries no user, API key, password or cookies. UI reads
    // authoritative storage via AUTH_GET_STATE. Missing receivers are normal.
    try {
      services.runtime?.getBrowserApi().sendMessage({
        type: "AUTH_STATE_CHANGED",
        reason: "recovery",
        success: response.success === true,
        status: response.success === true ? response.data.status : "failed",
      }, () => { void services.runtime?.getBrowserApi().getRuntimeLastError(); });
    } catch { /* no UI receiver */ }
  }, requestGeneration);
}

export function shouldObserveUnauthorized(): boolean {
  return activeAuthenticationOperations === 0 && pendingSessionEnds === 0 && pendingRecoveries === 0;
}
