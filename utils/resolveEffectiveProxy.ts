import { encryptCookieString } from "./cookieCipher";

export type EffectiveProxySource = "extension" | "persona" | "account" | "none";

export type ProxyEndpoint = { host: string; port: string };

export type PersonaFacebookAccount = {
  account_id: string;
  account_status?: any[];
  allow_persona_feature?: boolean;
  categories?: string[];
  cookies?: string;
  extension_config_id?: string;
  gender?: string;
  group_limit?: number;
  max_group_joins_per_day?: number;
  name?: string;
  persona_topic_ids?: string[];
  platform: string;
  proxy?: Record<string, unknown>;
  proxy_id?: string;
  status?: string;
  tenant_id?: string;
  ttl?: number;
  uid?: string;
  updated_time?: number;
  user_id?: string;
};

export function isActiveProxy(proxy: unknown): boolean {
  if (!proxy || typeof proxy !== "object") return false;
  const p = proxy as Record<string, unknown>;
  if (Object.keys(p).length === 0) return false;
  // active field is optional — if absent we treat it as active (persona proxies
  // often omit it). Only reject when explicitly false.
  if (p.active === false) return false;
  const host = typeof p.host === "string" ? p.host.trim() : "";
  const port = p.port;
  return (
    !!host && port !== undefined && port !== null && String(port).trim() !== ""
  );
}

export function extractPersonaProxy(persona: unknown): Record<string, unknown> {
  if (!persona || typeof persona !== "object") return {};
  const p = persona as Record<string, unknown>;

  if (isActiveProxy(p.proxy)) return p.proxy as Record<string, unknown>;
  if (p.proxy && typeof p.proxy === "object") {
    return p.proxy as Record<string, unknown>;
  }

  const listCandidates = [
    p.proxies,
    p.assigned_proxies_list,
    p.proxy_resources,
  ];
  for (const list of listCandidates) {
    if (!Array.isArray(list) || list.length === 0) continue;
    const active = list.find((item) => isActiveProxy(item));
    if (active && typeof active === "object") {
      return active as Record<string, unknown>;
    }
    const first = list[0];
    if (first && typeof first === "object") {
      return first as Record<string, unknown>;
    }
  }

  return {};
}

function normalizePersonaPlatform(platform: string): string {
  const p = platform.toLowerCase();
  if (p === "twitter") return "x";
  return p;
}

export function normalizePersonaSocialAccount(raw: unknown): PersonaFacebookAccount | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const platform = normalizePersonaPlatform(String(a.platform ?? "facebook"));
  if (!["facebook", "tiktok", "x", "threads"].includes(platform)) return null;
  if (a.status && String(a.status).toLowerCase() !== "active") return null;

  const accountId = a.account_id ?? a.id ?? a.social_account_id;
  if (accountId === undefined || accountId === null) return null;

  return {
    account_id: String(accountId),
    account_status: Array.isArray(a.account_status) ? a.account_status : [],
    allow_persona_feature:
      a.allow_persona_feature !== undefined
        ? Boolean(a.allow_persona_feature)
        : true,
    categories: Array.isArray(a.categories) ? (a.categories as string[]) : [],
    cookies: encryptCookieString(a.cookies),
    extension_config_id:
      a.extension_config_id !== undefined
        ? String(a.extension_config_id)
        : undefined,
    gender: a.gender !== undefined ? String(a.gender) : undefined,
    group_limit: typeof a.group_limit === "number" ? a.group_limit : undefined,
    max_group_joins_per_day:
      typeof a.max_group_joins_per_day === "number"
        ? a.max_group_joins_per_day
        : undefined,
    name: a.name !== undefined ? String(a.name) : undefined,
    persona_topic_ids: Array.isArray(a.persona_topic_ids)
      ? (a.persona_topic_ids as string[])
      : [],
    platform,
    proxy:
      a.proxy && typeof a.proxy === "object"
        ? (a.proxy as Record<string, unknown>)
        : undefined,
    proxy_id: a.proxy_id !== undefined ? String(a.proxy_id) : undefined,
    status: a.status ? String(a.status) : "active",
    tenant_id: a.tenant_id !== undefined ? String(a.tenant_id) : undefined,
    ttl: typeof a.ttl === "number" ? a.ttl : undefined,
    uid: a.uid !== undefined ? String(a.uid) : undefined,
    updated_time:
      typeof a.updated_time === "number" ? a.updated_time : undefined,
    user_id: a.user_id !== undefined ? String(a.user_id) : undefined,
  };
}

export function extractPersonaSocialAccounts(
  persona: unknown,
): PersonaFacebookAccount[] {
  if (!persona || typeof persona !== "object") return [];
  const p = persona as Record<string, unknown>;

  const listCandidates = [
    p.social_accounts,
    p.logged_accounts,
    p.facebook_accounts,
    p.accounts,
  ];

  const seen = new Set<string>();
  const out: PersonaFacebookAccount[] = [];

  for (const list of listCandidates) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const normalized = normalizePersonaSocialAccount(item);
      if (!normalized) continue;
      const key = `${normalized.platform}:${normalized.account_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(normalized);
    }
  }

  return out;
}

export function extractPersonaFacebookAccounts(
  persona: unknown,
): PersonaFacebookAccount[] {
  return extractPersonaSocialAccounts(persona).filter(
    (a) => a.platform === "facebook",
  );
}

export function findPersonaSocialAccountProxy(
  accountsOrPersona: unknown,
  accountId?: string,
): Record<string, unknown> | null {
  const list = Array.isArray(accountsOrPersona)
    ? (accountsOrPersona as PersonaFacebookAccount[])
    : extractPersonaSocialAccounts(accountsOrPersona);

  if (!list.length) return null;

  const match = accountId
    ? list.find((a) => String(a.account_id) === String(accountId))
    : undefined;

  const account = match ?? list[0];
  const proxy = account?.proxy;
  if (!proxy || typeof proxy !== "object") return null;

  const p = proxy as Record<string, unknown>;
  return {
    ...p,
    username: p.username || undefined,
    password: p.password || undefined,
  };
}

export function hasExtensionConfigId(extensionConfigId: unknown): boolean {
  if (extensionConfigId === null || extensionConfigId === undefined) {
    return false;
  }
  const id = String(extensionConfigId).trim();
  return id.length > 0 && id !== "null" && id !== "undefined";
}

export function findExtensionFacebookAccountProxy(
  socialAccounts: unknown,
  accountId?: string,
): Record<string, unknown> | null {
  if (!Array.isArray(socialAccounts)) return null;
  console.log(
    "[PROXY RESOLUTION] Searching extension config social_accounts for Facebook proxy. Accounts:",
    socialAccounts,
    "Account ID:",
    accountId,
  );

  const facebookAccounts = socialAccounts.filter((raw) => {
    if (!raw || typeof raw !== "object") return false;
    const a = raw as Record<string, unknown>;
    const platform = String(a.platform ?? "").toLowerCase();
    const status = String(a.status ?? "active").toLowerCase();
    return platform === "facebook" && status === "active";
  });

  if (!facebookAccounts.length) return null;

  const match = accountId
    ? facebookAccounts.find(
      (raw) =>
        String((raw as Record<string, unknown>).account_id) ===
        String(accountId),
    )
    : undefined;

  const account = (match ?? facebookAccounts[0]) as Record<string, unknown>;
  const proxy = account?.proxy;
  if (!proxy || typeof proxy !== "object") return null;

  // Normalize: treat empty username/password as absent so downstream
  // proxy handlers don't try to authenticate with empty strings.
  const p = proxy as Record<string, unknown>;
  return {
    ...p,
    username: p.username || undefined,
    password: p.password || undefined,
  };
}

export function findPersonaFacebookAccountProxy(
  accountsOrPersona: unknown,
  accountId?: string,
): Record<string, unknown> | null {
  return findPersonaSocialAccountProxy(accountsOrPersona, accountId);
}

export function findExtensionAccountProxyByPlatform(
  socialAccounts: unknown,
  platformId: string,
  accountId?: string,
): Record<string, unknown> | null {
  if (!Array.isArray(socialAccounts)) return null;

  const normalizedPlatform =
    platformId.toLowerCase() === "twitter" ? "x" : platformId.toLowerCase();

  const platformAccounts = socialAccounts.filter((raw) => {
    if (!raw || typeof raw !== "object") return false;
    const a = raw as Record<string, unknown>;
    const platform = String(a.platform ?? "").toLowerCase();
    const normalized = platform === "twitter" ? "x" : platform;
    const status = String(a.status ?? "active").toLowerCase();
    return normalized === normalizedPlatform && status === "active";
  });

  if (!platformAccounts.length) return null;

  const match = accountId
    ? platformAccounts.find(
      (raw) =>
        String((raw as Record<string, unknown>).account_id) ===
        String(accountId),
    )
    : undefined;

  const account = (match ?? platformAccounts[0]) as Record<string, unknown>;
  const proxy = account?.proxy;
  if (!proxy || typeof proxy !== "object") return null;

  const p = proxy as Record<string, unknown>;
  return {
    ...p,
    username: p.username || undefined,
    password: p.password || undefined,
  };
}

export function resolveEffectiveProxy(input: {
  hasExtensionConfig: boolean;
  extensionProxy?: unknown;
  extensionAccountProxy?: unknown;
  personaProxy?: unknown;
  personaAccountProxy?: unknown;
}): { effective: Record<string, unknown>; source: EffectiveProxySource } {
  if (input.hasExtensionConfig) {
    // Account proxy wins — it is per-account and more specific than the
    // config-level extension proxy. Config proxy is the fallback.
    if (isActiveProxy(input.extensionAccountProxy)) {
      console.log("[PROXY RESOLUTION] Using extension account proxy");
      return {
        effective: input.extensionAccountProxy as Record<string, unknown>,
        source: "account",
      };
    }
    if (isActiveProxy(input.extensionProxy)) {
      console.log("[PROXY RESOLUTION] Using extension config proxy");
      return {
        effective: input.extensionProxy as Record<string, unknown>,
        source: "extension",
      };
    }
    console.log(
      "[PROXY RESOLUTION] No active proxy found (extension config mode)",
    );
    return { effective: {}, source: "none" };
  }

  // Persona mode: account proxy wins over persona-level proxy.
  if (isActiveProxy(input.personaAccountProxy)) {
    console.log("[PROXY RESOLUTION] Using persona account proxy");
    return {
      effective: input.personaAccountProxy as Record<string, unknown>,
      source: "account",
    };
  }
  if (isActiveProxy(input.personaProxy)) {
    console.log("[PROXY RESOLUTION] Using persona proxy");
    return {
      effective: input.personaProxy as Record<string, unknown>,
      source: "persona",
    };
  }
  console.log("[PROXY RESOLUTION] No active proxy found (persona mode)");
  return { effective: {}, source: "none" };
}

export function getProxyEndpoints(proxy: unknown): {
  httpProxy: ProxyEndpoint | null;
  httpsProxy: ProxyEndpoint | null;
} {
  if (!isActiveProxy(proxy)) {
    return { httpProxy: null, httpsProxy: null };
  }
  const p = proxy as Record<string, unknown>;
  const endpoint: ProxyEndpoint = {
    host: String(p.host).trim(),
    port: String(p.port),
  };
  return { httpProxy: endpoint, httpsProxy: endpoint };
}
