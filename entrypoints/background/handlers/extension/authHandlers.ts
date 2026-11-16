import type { ApplicationServices } from "../../application-services";
import type { Message, User } from "../../types/types";
import apiCall from "../../infrastructure/api";
import { hasExtensionConfigId } from "../../utils/helpers/proxy";

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
    respond({ success: true, data: { user, isApikeySession, extensionConfig, configurationUnavailable } });
  } catch {
    respond({ success: false, error: "Authentication failed", code: "AUTH_FAILED" });
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// Serialize new authentication commands within this worker instance. This is
// not a durable lock and does not serialize legacy logout or other writers.
let authenticationTail: Promise<void> = Promise.resolve();
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
