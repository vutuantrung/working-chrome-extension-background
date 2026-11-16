import type { ApplicationServices } from "../../application-services";
import type { Message, PersonaFacebookAccount } from "../../types/types";
import api from "../../infrastructure/api";
import { hasExtensionConfigId, normalizePersonaSocialAccount } from "../../utils/helpers/proxy";
import { enqueueSessionOperation, getAuthenticationGeneration } from "./authHandlers";

type Source = { userId: string; sessionId: string } & (
  { type: "extension_config"; extensionConfigId: string } |
  { type: "persona"; personaId: string }
);
type Catalog = { source: Source; revision: number; refreshedAt: number; accounts: PersonaFacebookAccount[] };
type Respond = (response: unknown) => void;
class AccountError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
function fail(code: string, message: string): never { throw new AccountError(code, message); }
const platforms = ["facebook", "tiktok", "x", "threads"];
function text(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }

async function readSource(services: ApplicationServices) {
  const storage = services.storage;
  if (!storage) return fail("ACCOUNT_LOAD_FAILED", "Storage unavailable");
  const values = await storage.getStorageByKeys(["user", "selectedPersonaId", "personaSelection", "socialAccountCatalog"]);
  const user = values.user;
  if (!text(user?.id)) return fail("AUTH_REQUIRED", "Authentication required");
  const sessionId = String(user.extension_session?.id ?? user.extension_session?.extension_session_id ?? "");
  const identity = { userId: user.id as string, sessionId };
  let source: Source;
  if (hasExtensionConfigId(user.extension_session?.extension_config_id)) {
    source = { ...identity, type: "extension_config", extensionConfigId: String(user.extension_session.extension_config_id) };
  } else {
    const selection = values.personaSelection;
    if (!selection || selection.userId !== identity.userId || selection.sessionId !== sessionId ||
        !text(selection.persona?.id) || selection.persona.id !== values.selectedPersonaId ||
        selection.activation !== "active") return fail("PERSONA_REQUIRED", "An acknowledged active persona is required");
    source = { ...identity, type: "persona", personaId: selection.persona.id };
  }
  return { storage, source, generation: getAuthenticationGeneration(), catalog: values.socialAccountCatalog as Catalog | undefined,
    personaRevision: source.type === "persona" ? values.personaSelection.revision : undefined };
}
type Context = Awaited<ReturnType<typeof readSource>>;
function sameSource(a: Source | undefined, b: Source): boolean {
  if (!a || a.type !== b.type || a.userId !== b.userId || a.sessionId !== b.sessionId) return false;
  return a.type === "persona" && b.type === "persona" ? a.personaId === b.personaId :
    a.type === "extension_config" && b.type === "extension_config" && a.extensionConfigId === b.extensionConfigId;
}
async function assertSource(services: ApplicationServices, ctx: Context): Promise<void> {
  const now = await readSource(services).catch(() => fail("ACCOUNT_SOURCE_CHANGED", "Account source changed"));
  if (!sameSource(now.source, ctx.source) || now.generation !== ctx.generation ||
      now.personaRevision !== ctx.personaRevision) fail("ACCOUNT_SOURCE_CHANGED", "Account source changed");
}
function parseList(raw: any): unknown[] {
  if (raw?.success === false) return fail("ACCOUNT_LOAD_FAILED", "Account request rejected");
  const rows = Array.isArray(raw) ? raw : raw?.data;
  if (!Array.isArray(rows)) return fail("ACCOUNT_LOAD_FAILED", "Invalid account list");
  return rows;
}
async function loadAccounts(services: ApplicationServices, source: Source): Promise<unknown[]> {
  const http = services.http.getHttpInstance();
  if (source.type === "persona") {
    const rows: unknown[] = [];
    const limit = 100;
    // Explicit pagination with a bound; never publish a partial catalog.
    for (let offset = 0; offset < 10000; offset += limit) {
      const page = parseList(await api.socialAccount.getSocialAccountsByPersona(http, source.personaId, {
        offset, limit, where: { persona_id: source.personaId },
      }));
      rows.push(...page);
      if (page.length < limit) return rows;
    }
    return fail("ACCOUNT_LOAD_FAILED", "Account pagination limit exceeded");
  }
  const raw = await api.extensionUser.getExtensionConfigInfo(http, source.extensionConfigId);
  if (raw?.success === false) return fail("ACCOUNT_LOAD_FAILED", "Configuration request rejected");
  const config = raw?.data ?? raw;
  if (!Array.isArray(config?.social_accounts)) return fail("ACCOUNT_LOAD_FAILED", "Invalid configuration accounts");
  return config.social_accounts;
}
async function normalizeAccounts(services: ApplicationServices, rows: unknown[], source: Source): Promise<PersonaFacebookAccount[]> {
  const unique = new Map<string, PersonaFacebookAccount>();
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) fail("ACCOUNT_LOAD_FAILED", "Invalid account record");
    const raw = row as Record<string, unknown>;
    if (source.type === "persona" && raw.persona_id != null && String(raw.persona_id) !== source.personaId)
      fail("ACCOUNT_LOAD_FAILED", "Account source mismatch");
    if (source.type === "extension_config" && raw.extension_config_id != null && String(raw.extension_config_id) !== source.extensionConfigId)
      fail("ACCOUNT_LOAD_FAILED", "Account source mismatch");
    const platform = String(raw.platform ?? "facebook").toLowerCase().replace(/^twitter$/, "x");
    if (!platforms.includes(platform) || String(raw.status ?? "active").toLowerCase() !== "active") continue;
    const id = raw.account_id ?? raw.id ?? raw.social_account_id;
    if (id == null || !String(id).trim()) fail("ACCOUNT_LOAD_FAILED", "Invalid account identity");
    const account = normalizePersonaSocialAccount({ ...raw, platform });
    if (!account) fail("ACCOUNT_LOAD_FAILED", "Invalid active account");
    const key = platform + ":" + account.account_id;
    if (!unique.has(key)) unique.set(key, account);
  }
  const accounts = [...unique.values()];
  // Preserve legacy enrichment, with bounded concurrency and no cross-source fallback.
  for (let offset = 0; offset < accounts.length; offset += 8) {
    await Promise.all(accounts.slice(offset, offset + 8).map(async account => {
      if (!account.proxy_id || (account.proxy && Object.keys(account.proxy).length)) return;
      try {
        const raw = await api.proxy.getProxyInfo(services.http.getHttpInstance(), account.proxy_id);
        const proxy = raw?.data ?? raw;
        if (raw?.success !== false && proxy && typeof proxy === "object" && !Array.isArray(proxy)) account.proxy = proxy;
      } catch { /* Missing enrichment remains missing; R4 owns proxy policy. */ }
    }));
  }
  return accounts;
}
function publicState(ctx: Context, catalog: Catalog | undefined, platform?: string) {
  const valid = sameSource(catalog?.source, ctx.source) && Array.isArray(catalog?.accounts);
  const accounts = valid ? catalog!.accounts : [];
  return { source: ctx.source, revision: valid ? catalog!.revision : 0,
    refreshedAt: valid ? catalog!.refreshedAt : null, status: valid ? "cached" : "uninitialized",
    accounts: accounts.filter(a => !platform || a.platform === platform).map(a => ({
      accountId: a.account_id, platform: a.platform, name: a.name, status: a.status,
      hasCookies: Boolean(a.cookies), hasProxy: Boolean(a.proxy && Object.keys(a.proxy).length),
    })) };
}
async function refresh(services: ApplicationServices) {
  const ctx = await readSource(services);
  const accounts = await normalizeAccounts(services, await loadAccounts(services, ctx.source), ctx.source);
  await assertSource(services, ctx);
  const catalog: Catalog = { source: ctx.source, revision: sameSource(ctx.catalog?.source, ctx.source) ? ctx.catalog!.revision + 1 : 1,
    refreshedAt: Date.now(), accounts };
  const facebook = accounts.filter(a => a.platform === "facebook");
  const patch = { socialAccountCatalog: catalog, allSocialAccounts: accounts, facebookAccounts: facebook,
    personaSocialAccounts: ctx.source.type === "persona" ? accounts : [],
    personaFacebookAccounts: ctx.source.type === "persona" ? facebook : [] };
  await ctx.storage.getBrowserApi().set(patch);
  Object.assign(ctx.storage.getCachedStorage(), patch);
  return publicState(ctx, catalog);
}
async function respondWith(operation: () => Promise<unknown>, respond: Respond) {
  try { respond({ success: true, data: await enqueueSessionOperation(operation) }); }
  catch (error) { respond({ success: false, code: error instanceof AccountError ? error.code : "ACCOUNT_LOAD_FAILED",
    error: error instanceof AccountError ? error.message : "Account operation failed" }); }
}
export function handleSocialAccountGetState(services: ApplicationServices, message: Message, respond: Respond) {
  return respondWith(async () => {
    const platform = message.inputs?.platform;
    if (platform !== undefined && !platforms.includes(platform)) fail("UNSUPPORTED_PLATFORM", "Unsupported account platform");
    const ctx = await readSource(services);
    return publicState(ctx, ctx.catalog, platform);
  }, respond);
}
export function handleSocialAccountRefresh(services: ApplicationServices, _message: Message, respond: Respond) {
  return respondWith(() => refresh(services), respond);
}
