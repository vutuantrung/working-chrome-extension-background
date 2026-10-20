import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  appStorage,
  browserCookies,
  browserTabs,
  extensionCommands,
  extensionStorage,
  localStorageService,
} from "../../sidepanel/application/services/SidepanelServices";
import type { BrowserCookie, CookieSetDetails, StorageChangeMap } from "../types/BrowserPorts";
import api from "../infrastructure/api"
import {
  getPlatformCookieDomains,
  SOCIAL_COOKIE_DOMAINS,
} from "../../sidepanel/utils/social-cookie-domains";
import {
  getSelectedPlatformId,
  normalizeSameSite,
  parseList,
  parsePersonaRecord
} from "../helpers/helpers";
import type {
  PlatformId,
  AuthContextType,
  LoginResult,
  NonFacebookPlatform,
  SocialAccount,
  User
} from "../types/types";
import {
  extractPersonaSocialAccounts,
  normalizePersonaSocialAccount,
  extractPersonaProxy,
  findPersonaFacebookAccountProxy,
  findPersonaSocialAccountProxy,
  hasExtensionConfigId,
  resolveEffectiveProxy,
  findExtensionAccountProxyByPlatform,
  isActiveProxy,
} from "../../sidepanel/utils/resolveEffectiveProxy";
import { decryptCookieString } from "../../sidepanel/utils/cookieCipher";
import { PLATFORM_URLS } from "../helpers/constants";
import { useTranslation } from "../helpers/i18n";

const MANUAL_PLATFORM_COOKIES_KEY = "local:manualPlatformCookies";
const LEGACY_MANUAL_FB_COOKIES_KEY = "local:manualFacebookCookies";

const toCookieDetails = (cookie: any): CookieSetDetails => {
  const domain = typeof cookie?.domain === "string" ? cookie.domain : "";
  const path = typeof cookie?.path === "string" ? cookie.path : "/";
  const urlDomain = domain.startsWith(".") ? domain.substring(1) : domain;
  const details: CookieSetDetails = {
    url: `https://${urlDomain}${path}`,
    name: cookie.name,
    value: cookie.value,
    domain,
    path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: normalizeSameSite(cookie.sameSite),
  };

  if (!cookie.session && cookie.expirationDate) {
    details.expirationDate = cookie.expirationDate;
  }

  return details;
};

const applyCookieList = async (cookiesRaw: any): Promise<boolean> => {
  try {
    const decrypted = decryptCookieString(cookiesRaw);
    const cookiesData = typeof decrypted === "string" ? JSON.parse(decrypted) : decrypted;
    if (!Array.isArray(cookiesData) || !cookiesData.length) return false;

    for (const cookie of cookiesData) {
      await browserCookies.set(toCookieDetails(cookie));
    }
    return true;
  } catch (cookieError) {
    console.error("[AuthContext] Failed to restore cookies:", cookieError);
    return false;
  }
};

const cookieRemovalUrl = (cookie: BrowserCookie): string => {
  const host = cookie.domain.startsWith(".")
    ? cookie.domain.slice(1)
    : cookie.domain;
  const path = cookie.path || "/";
  return `https://${host}${path}`;
};

const clearCookiesForDomain = async (domain: string): Promise<void> => {
  try {
    const cookies = await browserCookies.getAllByDomain(domain);
    await Promise.all(
      cookies.map((cookie) => browserCookies.remove(cookieRemovalUrl(cookie), cookie.name)),
    );
  } catch {
    // Best-effort cleanup.
  }
};

const clearPlatformBrowserCookies = async (platformId: string): Promise<void> => {
  const domains = getPlatformCookieDomains(platformId);
  await Promise.all(domains.map((d) => clearCookiesForDomain(d)));
};

const hydrateAccountsWithProxy = async (accounts: SocialAccount[]): Promise<SocialAccount[]> => {
  return Promise.all(
    accounts.map(async (account) => {
      if (
        account.proxy_id &&
        (!account.proxy || Object.keys(account.proxy || {}).length === 0)
      ) {
        try {
          const proxyData = await api.proxy.getProxyInfo(account.proxy_id);
          return { ...account, proxy: proxyData };
        } catch (err) {
          console.warn(
            `[hydrateAccountsWithProxy] Failed to fetch proxy for account ${account.account_id}:`,
            err,
          );
        }
      }
      return account;
    }),
  );
};

const captureSocialCookiesByDomain = async (): Promise<Record<string, BrowserCookie[]>> => {
  const out: Record<string, BrowserCookie[]> = {};
  await Promise.all(
    SOCIAL_COOKIE_DOMAINS.map(
      (domain) =>
        new Promise<void>((resolve) => {
          browserCookies
            .getAllByDomain(domain)
            .then((cookies) => {
              if (cookies.length) out[domain] = cookies;
            })
            .finally(resolve);
        }),
    ),
  );
  return out;
};

const persistManualSocialCookieSnapshot = async () => {
  const byDomain = await captureSocialCookiesByDomain();
  if (!Object.keys(byDomain).length) return;
  await appStorage.setItem(MANUAL_PLATFORM_COOKIES_KEY, JSON.stringify(byDomain));
};

const chromeLoginModeKey = (platformId: string) => platformId === "facebook" ? "fbLoginMode" : `${platformId}LoginMode`;

const readPlatformLoginMode = async (platformId: string): Promise<{ mode: "auto" | "manual"; account_id?: string }> => {
  const stored = await appStorage.getItem<{
    mode?: string;
    account_id?: string;
  }>("local:fbLoginMode");

  try {
    const chromeResult = await extensionStorage.get(chromeLoginModeKey(platformId));
    const chromeMode = chromeResult?.[chromeLoginModeKey(platformId)] as
      | "auto"
      | "manual"
      | undefined;
    if (chromeMode === "auto" || chromeMode === "manual") {
      return {
        mode: chromeMode,
        account_id: stored?.account_id,
      };
    }
  } catch { }

  if (stored?.mode === "auto" || stored?.mode === "manual") {
    return {
      mode: stored.mode,
      account_id: stored.account_id,
    };
  }

  return { mode: "manual" };
};

const accountsForPlatform = (accounts: SocialAccount[], platformId: string): SocialAccount[] =>
  accounts.filter((a) => {
    const p = String(a.platform ?? "").toLowerCase();
    const normalized = p === "twitter" ? "x" : p;
    return (
      normalized === platformId &&
      String(a.status ?? "active").toLowerCase() === "active"
    );
  });

const applyStoredManualSocialCookies = async (stored: unknown): Promise<boolean> => {
  let parsed = stored;
  if (typeof stored === "string") {
    try {
      parsed = JSON.parse(stored);
    } catch {
      return false;
    }
  }

  if (Array.isArray(parsed)) {
    return applyCookieList(parsed);
  }

  if (parsed && typeof parsed === "object") {
    let anyApplied = false;
    for (const value of Object.values(parsed as Record<string, unknown>)) {
      if (Array.isArray(value) && value.length) {
        const ok = await applyCookieList(value);
        if (ok) anyApplied = true;
      }
    }
    return anyApplied;
  }

  return false;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);


// const getPlatformAccounts = async (
//   platform: string,
//   allAccounts: SocialAccount[],
// ): Promise<SocialAccount[]> => {
//   if (platform === "facebook") return allAccounts;
//   const stored = await appStorage.getItem<SocialAccount[]>("local:allSocialAccounts");
//   if (!stored?.length) return [];
//   return stored.filter((a) => a.platform === platform && a.status === "active");
// };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [facebookAccounts, setFacebookAccounts] = useState<SocialAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [extensionId, setExtensionId] = useState<string | null>(null);
  const [extensionProxy, setExtensionProxy] = useState<any>(null);
  // True when the current session was established via apikey (not username/password).
  // Used to hide the logout button for apikey-managed sessions.
  const [isApikeySession, setIsApikeySession] = useState(false);
  const navigate = useNavigate();

  const { t } = useTranslation();

  const setActiveProxy = async (proxy: any) => {
    setExtensionProxy(proxy);
    await appStorage.setItem("local:activeProxy", proxy);
  };

  const readHasExtensionConfig = async (): Promise<boolean> => {
    const storedUser = await appStorage.getItem<User>("local:user");
    return hasExtensionConfigId(
      storedUser?.extension_session?.extension_config_id,
    );
  };

  const applyEffectiveProxy = async (opts?: {
    personaAccountProxy?: unknown;
    extensionAccountProxy?: unknown;
    platform?: string;
  }) => {
    const useExtensionConfig = await readHasExtensionConfig();
    const extensionProxy = await appStorage.getItem<any>("local:extensionProxy");
    const personaProxy = await appStorage.getItem<any>("local:personaProxy");

    let extensionAccountProxy = opts?.extensionAccountProxy;
    let personaAccountProxy = opts?.personaAccountProxy;

    const fbLoginMode = await appStorage.getItem<{
      mode?: string;
      account_id?: string;
      platform?: string;
    }>("local:fbLoginMode");

    const activePlatform =
      opts?.platform ??
      fbLoginMode?.platform ??
      (getSelectedPlatformId() as PlatformId | null) ??
      "facebook";

    if (useExtensionConfig && extensionAccountProxy === undefined) {
      if (fbLoginMode?.mode === "auto") {
        const accounts =
          (await appStorage.getItem<SocialAccount[]>("local:allSocialAccounts")) ||
          (await appStorage.getItem<SocialAccount[]>("local:facebookAccounts")) ||
          [];
        extensionAccountProxy = findExtensionAccountProxyByPlatform(
          accounts,
          activePlatform,
          fbLoginMode.account_id,
        );
      }
    }

    if (!useExtensionConfig && personaAccountProxy === undefined) {
      if (fbLoginMode?.mode === "auto") {
        const accounts =
          (await appStorage.getItem<SocialAccount[]>("local:allSocialAccounts")) ||
          (await appStorage.getItem<SocialAccount[]>("local:personaSocialAccounts")) ||
          (await appStorage.getItem<SocialAccount[]>("local:personaFacebookAccounts")) ||
          [];
        personaAccountProxy = findPersonaSocialAccountProxy(
          accounts,
          fbLoginMode.account_id,
        );
      }
    }

    const { effective } = resolveEffectiveProxy({
      hasExtensionConfig: useExtensionConfig,
      extensionProxy,
      extensionAccountProxy: useExtensionConfig
        ? extensionAccountProxy
        : undefined,
      personaProxy: useExtensionConfig ? undefined : personaProxy,
      personaAccountProxy: useExtensionConfig ? undefined : personaAccountProxy,
    });
    await setActiveProxy(effective);
    await extensionCommands.setProxy(effective);
  };

  const persistPersonaSocialAccounts = async (persona: unknown, updateState = true) => {
    const allAccounts = extractPersonaSocialAccounts(persona) as SocialAccount[];
    const facebookOnly = allAccounts.filter((a) => a.platform === "facebook");

    await appStorage.setItem("local:personaSocialAccounts", allAccounts);
    await appStorage.setItem("local:personaFacebookAccounts", facebookOnly);

    const useExtensionConfig = await readHasExtensionConfig();
    if (!useExtensionConfig && allAccounts.length > 0) {
      const existingAll = await appStorage.getItem<SocialAccount[]>("local:allSocialAccounts");
      const existingHasProxy =
        existingAll?.some((a) => a.proxy && Object.keys(a.proxy).length > 0) ??
        false;
      const newHasProxy = allAccounts.some(
        (a) => a.proxy && Object.keys((a.proxy as any) || {}).length > 0,
      );

      if (!existingAll?.length || newHasProxy || !existingHasProxy) {
        await appStorage.setItem("local:allSocialAccounts", allAccounts);
        await appStorage.setItem("local:facebookAccounts", facebookOnly);
        if (updateState) setFacebookAccounts(facebookOnly);
      } else {
        if (updateState && facebookOnly.length > 0) {
        }
      }
    }
    return allAccounts;
  };

  const persistPersonaFacebookAccounts = async (persona: unknown, updateState = true) => persistPersonaSocialAccounts(persona, updateState);

  const reapplyPlatformLoginAfterPersonaSwitch = async (accounts: SocialAccount[]) => {
    if (localStorageService.getItem("fbLoginModeSelected") !== "1") return;
    const platformId = (getSelectedPlatformId() as PlatformId | null) ?? "facebook";
    const loginMode = await readPlatformLoginMode(platformId);
    const storedAll = await appStorage.getItem<SocialAccount[]>("local:allSocialAccounts");
    const storedHydrated = storedAll?.filter((a) => {
      const p = String(a.platform ?? "").toLowerCase();
      const normalized = p === "twitter" ? "x" : p;
      return (
        normalized === platformId &&
        String(a.status ?? "active").toLowerCase() === "active"
      );
    }) ?? [];

    let platformAccounts = storedHydrated.length > 0
      ? storedHydrated
      : accountsForPlatform(accounts, platformId);

    const hasProxy = platformAccounts.some((a) => a.proxy && Object.keys(a.proxy || {}).length > 0);
    if (!hasProxy) {
      try {
        const personaId = localStorageService.getItem("selectedPersonaId");
        if (personaId) {
          const response = await api.socialAccount.getSocialAccountsByPersona(personaId);
          const rawAccounts: SocialAccount[] = Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response)
              ? response
              : [];

          if (rawAccounts.length) {
            const normalized = rawAccounts.map((a: any) => ({
              ...a,
              platform: a.platform === "twitter" ? "x" : a.platform,
            }));
            const active = normalized.filter((a: any) => a.status === "active");
            const hydrated = await hydrateAccountsWithProxy(active);
            const sanitized = hydrated
              .map((a: unknown) => normalizePersonaSocialAccount(a))
              .filter(
                (a): a is NonNullable<typeof a> => a !== null,
              ) as SocialAccount[];

            await appStorage.setItem("local:allSocialAccounts", sanitized);
            await appStorage.setItem("local:personaSocialAccounts", sanitized);
            const fbOnly = sanitized.filter(
              (a: any) => a.platform === "facebook",
            );
            if (fbOnly.length) {
              await appStorage.setItem("local:facebookAccounts", fbOnly);
              await appStorage.setItem("local:personaFacebookAccounts", fbOnly);
            }

            platformAccounts = accountsForPlatform(sanitized, platformId);
          }
        }
      } catch (err) {
        console.warn(
          "[reapplyPlatformLoginAfterPersonaSwitch] Failed to refresh accounts:",
          err,
        );
      }
    }

    if (loginMode.mode === "auto") {
      const useExtensionConfig = await readHasExtensionConfig();
      const autoAccount =
        platformAccounts.find((a) => a.account_id === loginMode.account_id) ??
        platformAccounts[0];

      if (!autoAccount?.cookies) {
        console.warn(
          "[AuthContext] switchPersona: no system account cookies for",
          platformId,
        );
        return;
      }

      let personaAccountProxy: unknown;
      if (useExtensionConfig) {
        const allSocialAccounts =
          (await appStorage.getItem<SocialAccount[]>("local:allSocialAccounts")) ??
          [];
        personaAccountProxy = findExtensionAccountProxyByPlatform(
          allSocialAccounts,
          platformId,
          autoAccount.account_id,
        );
        await applyEffectiveProxy({
          extensionAccountProxy: personaAccountProxy,
        });
      } else {
        personaAccountProxy = findPersonaSocialAccountProxy(
          platformAccounts,
          autoAccount.account_id,
        );
        await applyEffectiveProxy({ personaAccountProxy });
      }

      await appStorage.setItem("local:fbLoginMode", {
        mode: "auto" as const,
        account_id: autoAccount.account_id,
      });
      try {
        await extensionStorage.set({
          [chromeLoginModeKey(platformId)]: "auto",
        });
      } catch { }

      await applyCookieList(autoAccount.cookies);
      return;
    }

    await clearPlatformBrowserCookies(platformId);
    try {
      await appStorage.removeItem(MANUAL_PLATFORM_COOKIES_KEY);
      await appStorage.removeItem(LEGACY_MANUAL_FB_COOKIES_KEY);
    } catch (err) {
      console.warn("[AuthContext] Failed to clear manual cookie backup:", err);
    }

    await appStorage.setItem("local:fbLoginMode", { mode: "manual" });
    try {
      await extensionStorage.set({
        [chromeLoginModeKey(platformId)]: "manual",
      });
    } catch { }
  };

  const getPersonaId = (persona: unknown): string | undefined => {
    if (!persona || typeof persona !== "object") return undefined;
    const id = (persona as { id?: unknown }).id;
    if (id === null || id === undefined) return undefined;
    const s = String(id).trim();
    return s.length > 0 ? s : undefined;
  };

  const persistSelectedPersonaId = async (persona: unknown) => {
    const personaId =
      getPersonaId(persona) ??
      localStorageService.getItem("selectedPersonaId") ??
      undefined;
    if (!personaId) return;

    localStorageService.setItem("selectedPersonaId", personaId);
    await appStorage.setItem("local:selectedPersonaId", personaId);
  };

  const resolvePersonaProxy = async (
    persona: unknown,
    personaId: string,
    { skipIfCached = false }: { skipIfCached?: boolean } = {},
  ): Promise<Record<string, unknown>> => {
    // First try extracting proxy embedded in the persona object
    const embedded = extractPersonaProxy(persona);
    if (isActiveProxy(embedded)) return embedded;

    if (skipIfCached) {
      const cached =
        await appStorage.getItem<Record<string, unknown>>("local:personaProxy");
      if (
        cached &&
        typeof cached === "object" &&
        Object.keys(cached).length > 0
      ) {
        console.log(
          "[AuthContext] resolvePersonaProxy: using cached proxy, skipping API",
        );
        return cached;
      }
    }

    // Persona has no proxy — fetch from API
    try {
      const list = await api.proxy.getProxiesByPersona(personaId);
      if (Array.isArray(list)) {
        const active = list.find((p: any) => p.active && p.status === "live");
        const first = active ?? list[0];
        if (first && typeof first === "object") {
          return {
            ...first,
            username: first.username || undefined,
            password: first.password || undefined,
          };
        }
      }
    } catch (err) {
      console.warn(
        "[AuthContext] getProxies failed for persona",
        personaId,
        err,
      );
    }
    return {};
  };

  const storePersonaSelection = async (persona: unknown) => {
    await persistSelectedPersonaId(persona);
    try {
      localStorageService.setItem("selectedPersona", JSON.stringify(persona));
    } catch { }
  };

  const ensureDefaultPersonaForExtensionConfig = async (userId: string): Promise<void> => {
    const existing = localStorageService.getItem("selectedPersonaId");
    if (existing) return;

    try {
      const data = await api.persona.getPersonas(userId);
      const list = parseList(data?.data ?? data);
      let persona: unknown = list[0] ?? null;

      if (!persona) {
        const created = await api.persona.createPersona();
        persona = created?.data ?? created;
      }

      if (persona) {
        await storePersonaSelection(persona);
        const personaId = getPersonaId(persona);
        if (personaId) {
          try {
            await api.extensionUser.activatePersonaSession(personaId);
          } catch (err: any) {
            console.warn(
              "[AuthContext] activePersonaSession (extension config):",
              err?.response?.data || err?.message || err,
            );
          }
        }
      }
    } catch (err: any) {
      console.warn(
        "[AuthContext] ensureDefaultPersonaForExtensionConfig:",
        err?.response?.data || err?.message || err,
      );
    }
  };

  const activatePersonaSessionApi = async (personaId: string) => {
    const id = String(personaId).trim();
    if (!id) return;
    try {
      await api.extensionUser.activatePersonaSession(id);
    } catch (err: any) {
      console.warn(
        "[AuthContext] activePersonaSession failed:",
        err?.response?.data || err?.message || err,
      );
    }
  };

  const applyPersonaSession = async (
    persona: unknown,
    options?: {
      applyAutoCookies?: boolean;
      reapplyPlatformLogin?: boolean;
    },
  ) => {
    const useExtensionConfig = await readHasExtensionConfig();
    if (useExtensionConfig) {
      await storePersonaSelection(persona);
      return;
    }

    await persistSelectedPersonaId(persona);

    const personaId = getPersonaId(persona);
    const personaProxy = personaId
      ? await resolvePersonaProxy(persona, personaId)
      : extractPersonaProxy(persona);

    await appStorage.setItem("local:personaProxy", personaProxy);
    const accounts = await persistPersonaSocialAccounts(persona, true);

    const platformId =
      (getSelectedPlatformId() as PlatformId | null) ?? "facebook";
    const loginMode = await readPlatformLoginMode(platformId);
    const platformAccounts = accountsForPlatform(accounts, platformId);

    let personaAccountProxy: unknown;
    if (loginMode.mode === "auto") {
      personaAccountProxy = findPersonaSocialAccountProxy(
        platformAccounts,
        loginMode.account_id,
      );
    }
    await applyEffectiveProxy({ personaAccountProxy });

    if (options?.reapplyPlatformLogin) {
      await reapplyPlatformLoginAfterPersonaSwitch(accounts);
    } else {
      const shouldApplyCookies =
        options?.applyAutoCookies === true &&
        loginMode.mode === "auto" &&
        localStorageService.getItem("fbLoginModeSelected") === "1";

      if (shouldApplyCookies && platformAccounts.length > 0) {
        const account =
          platformAccounts.find((a) => a.account_id === loginMode.account_id) ??
          platformAccounts[0];
        if (account?.cookies) {
          await appStorage.setItem("local:fbLoginMode", {
            mode: "auto" as const,
            account_id: account.account_id,
          });
          await applyCookieList(account.cookies);
        }
      }
    }
  };

  const persistAndApplyPersonaProxy = async (persona: unknown) => {
    await applyPersonaSession(persona, { applyAutoCookies: false });
  };

  const applyPersonaOnSelect = async (persona: unknown) => {
    const useExtensionConfig = await readHasExtensionConfig();
    let resolved = persona;

    const personaId = getPersonaId(persona);
    if (personaId) {
      try {
        const raw = await api.persona.getPersonaById(personaId);
        resolved = parsePersonaRecord(raw) ?? persona;
      } catch {
        resolved = persona;
      }
    }

    await storePersonaSelection(resolved);
    if (useExtensionConfig) {
      return;
    }

    await applyPersonaSession(resolved, { applyAutoCookies: false });
  };

  const switchPersona = async (personaId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (await readHasExtensionConfig()) {
        return {
          success: false,
          error: "Switch persona is only available without extension config.",
        };
      }
      const currentId = String(personaId).trim();
      if (!currentId) {
        return {
          success: false,
          error: "Invalid persona id."
        };
      }
      const localSelectedId = localStorageService.getItem("selectedPersonaId");
      const previousId = String(localSelectedId).trim();


      if (previousId && previousId !== currentId) {
        await api.extensionUser.deactivatePersona(previousId);
      }
      const activationResult = await api.extensionUser.activatePersonaSession(currentId);
      console.log('[activationResult]', activationResult);

      const currentPersonaData = await api.persona.getPersonaById(currentId);
      const persona = parsePersonaRecord(currentPersonaData);
      if (!persona) {
        return {
          success: false,
          error: "Persona not found."
        };
      }

      localStorageService.setItem("selectedPersonaId", currentId);
      localStorageService.setItem("selectedPersona", JSON.stringify(persona));

      await appStorage.setItem("local:selectedPersonaId", currentId);
      await appStorage.removeItem("local:profile");
      await appStorage.removeItem("local:profileId");

      await applyPersonaSession(persona, { reapplyPlatformLogin: true });
      try {
        const user = await appStorage.getItem<User>("local:user");
        await extensionCommands.initializeAfterLogin(user?.extension_session);
      } catch (err) {
        console.warn("[AuthContext] switchPersona: failed to notify background:", err);
      }

      return {
        success: true
      };
    } catch (err) {
      console.error("[AuthContext] switchPersona:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  };

  const hasExtensionConfig = hasExtensionConfigId(user?.extension_session?.extension_config_id);
  const canSwitchPersona = !hasExtensionConfig;

  const syncPersonaContextFromLocalStorage = async (updateState = false) => {
    try {
      const localPersona = localStorageService.getItem("selectedPersona");
      if (!localPersona) return;
      const persona = JSON.parse(localPersona);
      await persistSelectedPersonaId(persona);

      const personaId = getPersonaId(persona);
      const personaProxy = personaId
        ? await resolvePersonaProxy(persona, personaId, { skipIfCached: true })
        : extractPersonaProxy(persona);

      await appStorage.setItem("local:personaProxy", personaProxy);
      await persistPersonaFacebookAccounts(persona, updateState);
    } catch {
      // ignore invalid persona snapshot
    }
  };

  const getPersonaFacebookAccounts = async (): Promise<SocialAccount[]> => {
    if (await readHasExtensionConfig()) return [];

    const stored = await appStorage.getItem<SocialAccount[]>("local:personaFacebookAccounts");
    if (stored?.length) return stored;
    await syncPersonaContextFromLocalStorage(false);

    const personaFacebookAccounts = await appStorage.getItem<SocialAccount[]>("local:personaFacebookAccounts");
    return personaFacebookAccounts || [];
  };

  const getFacebookAccountsForSession = async (): Promise<SocialAccount[]> => {
    if (await readHasExtensionConfig()) {
      if (facebookAccounts?.length) return facebookAccounts;

      const currentFacebookAccounts = await appStorage.getItem<SocialAccount[]>("local:facebookAccounts");
      return currentFacebookAccounts || [];
    }

    const allSocial = await appStorage.getItem<SocialAccount[]>("local:allSocialAccounts");
    const facebookFromAll =
      allSocial?.filter(
        (a) =>
          String(a.platform ?? "").toLowerCase() === "facebook" &&
          String(a.status ?? "active").toLowerCase() === "active",
      ) ?? [];
    if (facebookFromAll.length > 0) return facebookFromAll;

    // Fallback
    const personaAccounts = await getPersonaFacebookAccounts();
    if (personaAccounts.length) return personaAccounts;

    const currentFacebookAccounts = await appStorage.getItem<SocialAccount[]>("local:facebookAccounts");
    return currentFacebookAccounts || [];
  };

  const resolveAccountProxy = async (): Promise<{
    personaAccountProxy?: unknown;
    extensionAccountProxy?: unknown;
  }> => {
    const fbLoginMode = await appStorage.getItem<{
      mode?: string;
      account_id?: string;
      platform?: string;
    }>("local:fbLoginMode");

    if (fbLoginMode?.mode !== "auto") return {};

    const useExtensionConfig = await readHasExtensionConfig();
    const accounts = await getFacebookAccountsForSession();

    if (!accounts.length) return {};

    const activePlatform =
      fbLoginMode?.platform ??
      (getSelectedPlatformId() as PlatformId | null) ??
      "facebook";

    if (useExtensionConfig) {
      const accountAppStorage = await appStorage.getItem<SocialAccount[]>("local:allSocialAccounts");
      return {
        extensionAccountProxy: findExtensionAccountProxyByPlatform(
          accountAppStorage ?? accounts,
          activePlatform,
          fbLoginMode.account_id,
        ),
      };
    }

    return {
      personaAccountProxy: findPersonaFacebookAccountProxy(
        accounts,
        fbLoginMode.account_id,
      ),
    };
  };

  const applyConfigProxyAndManualCookieSnapshot = async () => {
    await syncPersonaContextFromLocalStorage(false);

    const accountProxyOpts = await resolveAccountProxy();
    await applyEffectiveProxy(accountProxyOpts);

    const manualNew = await appStorage.getItem<any>(MANUAL_PLATFORM_COOKIES_KEY);
    const manualLegacy = manualNew
      ? null
      : await appStorage.getItem<any>(LEGACY_MANUAL_FB_COOKIES_KEY);
    const manualCookies = manualNew ?? manualLegacy;
    if (!manualCookies) return;

    const applied = await applyStoredManualSocialCookies(manualCookies);
    if (applied) {
      try {
        await appStorage.removeItem(MANUAL_PLATFORM_COOKIES_KEY);
        await appStorage.removeItem(LEGACY_MANUAL_FB_COOKIES_KEY);
      } catch (err) {
        console.warn("[AuthContext] Failed to clear manual cookies:", err);
      }
    }
  };

  const resumeSocialPlatformAfterRelogin = async (platform: NonFacebookPlatform) => {
    await applyConfigProxyAndManualCookieSnapshot();
    await browserTabs.createTab(PLATFORM_URLS[platform], true);
  };

  useEffect(() => {
    const handleAuthExpiredEvent = () => {
      handleSessionExpired();
    };

    // Listen for same-page dispatched event (from popup's own API calls)
    window.addEventListener("AUTH_EXPIRED", handleAuthExpiredEvent);
    // Listen for cross-context messages (from background/content scripts)
    const messageListener = (message: any) => {
      if (message.type === "AUTH_EXPIRED") {
        handleSessionExpired();
      }
    };
    const unsubscribeRuntime = extensionCommands.subscribe(messageListener);

    return () => {
      window.removeEventListener("AUTH_EXPIRED", handleAuthExpiredEvent);
      unsubscribeRuntime();
    };
  }, []);

  const loginWithMode = async (mode: "auto" | "manual", platform?: string): Promise<LoginResult> => {
    const selectedPlatform = platform ?? "facebook";
    const fbLoginModeData: {
      mode: "auto" | "manual";
      account_id?: string;
      platform?: string;
    } = { mode, platform: selectedPlatform };
    await appStorage.setItem("local:fbLoginMode", fbLoginModeData);

    const platformUrl = PLATFORM_URLS[selectedPlatform] ?? PLATFORM_URLS.facebook;
    const useExtensionConfig = await readHasExtensionConfig();

    let restoredAccounts: SocialAccount[];
    if (selectedPlatform === "facebook") {
      restoredAccounts = await getFacebookAccountsForSession();
    } else {
      const allStored =
        (await appStorage.getItem<SocialAccount[]>("local:allSocialAccounts")) ??
        (await appStorage.getItem<SocialAccount[]>("local:personaSocialAccounts")) ??
        [];
      restoredAccounts = accountsForPlatform(allStored, selectedPlatform);

      if (!allStored.length) {
        console.warn(
          "[loginWithMode] local:allSocialAccounts is empty — " +
          "was login() called this session? Platform:",
          selectedPlatform,
        );
      }
    }

    if (mode === "auto") {
      if (!restoredAccounts.length) {
        return { success: false, reason: "no_accounts" };
      }

      const autoAccount = restoredAccounts.find((a) => a.account_id === fbLoginModeData.account_id) ?? restoredAccounts[0];

      if (useExtensionConfig) {
        const allSocialAccounts = (await appStorage.getItem<SocialAccount[]>("local:allSocialAccounts")) ?? [];
        const accountProxy = findExtensionAccountProxyByPlatform(
          allSocialAccounts.length > 0 ? allSocialAccounts : restoredAccounts,
          selectedPlatform,
          autoAccount.account_id,
        );

        await applyEffectiveProxy({ extensionAccountProxy: accountProxy });
      } else {
        await applyEffectiveProxy({
          personaAccountProxy: findPersonaSocialAccountProxy(
            restoredAccounts,
            autoAccount.account_id,
          ),
        });
      }

      if (!autoAccount?.cookies) {
        return { success: false, reason: "no_cookies" };
      }

      fbLoginModeData.account_id = autoAccount.account_id;
      await appStorage.setItem("local:fbLoginMode", fbLoginModeData);

      const applied = await applyCookieList(autoAccount.cookies);
      if (!applied) {
        return { success: false, reason: "cookies_invalid" };
      }

      await browserTabs.createTab(platformUrl, true);
      return { success: true };
    }

    await applyConfigProxyAndManualCookieSnapshot();
    await browserTabs.createTab(platformUrl, true);
    return { success: true };
  };

  useEffect(() => {
    setExtensionId(extensionCommands.getExtensionId());
    checkAuthAndRestore();
  }, []);

  useEffect(() => {
    let mounted = true;

    const onStorageChanged = (changes: StorageChangeMap, area: string) => {
      if (!mounted) return;
      if (area !== "local") return;
      if (!user) return;

      if (changes.activeProxy) {
        setExtensionProxy(changes.activeProxy.newValue ?? null);
        return;
      }

      if (changes.extensionProxy) {
        const next = changes.extensionProxy.newValue ?? null;
        setExtensionProxy((prev: any) => {
          if (
            prev &&
            typeof prev === "object" &&
            Object.keys(prev).length > 0
          ) {
            return prev;
          }
          return next;
        });
      }
    };

    const unsubscribeStorage = extensionStorage.subscribe(onStorageChanged);

    return () => {
      mounted = false;
      unsubscribeStorage();
    };
  }, [user]);

  // Listen for the apikey being injected into chrome.storage.local while the
  // popup is already open and the user is not yet logged in.
  // This handles the case where the desktop app injects the apikey AFTER the
  // popup has rendered the login screen (e.g. first install: popup opens before
  // the injector runs).
  useEffect(() => {
    if (user) return; // Already authenticated — listener not needed

    const handleApikeyInjected = (
      changes: StorageChangeMap,
      areaName: string,
    ) => {
      if (areaName !== "local") return;
      const newApikey = changes?.apikey?.newValue as string | undefined;
      if (!newApikey) return; // apikey removed or irrelevant change

      console.log(
        "[AuthContext] apikey injected into storage — attempting auto-login",
      );
      (async () => {
        try {
          const curExtensionId = extensionId || extensionCommands.getExtensionId()
          const loginResponse = await api.extensionUser.loginWithApikeyApi(newApikey, curExtensionId);
          await processLoginResponse(loginResponse, true);
        } catch (err) {
          console.warn(
            "[AuthContext] apikey storage-change auto-login failed:",
            err,
          );
        }
      })();
    };

    return extensionStorage.subscribe(handleApikeyInjected);
  }, [user, extensionId]);

  // Polling fallback: every N seconds while not logged in, check for apikey in
  // chrome.storage.local and attempt auto-login if found.
  // — Complements the onChanged listener for cases where the apikey was already
  //   present when the listener was registered but login failed silently.
  // — Automatically stops when user logs in via any method (apikey or
  //   username/password) because `user` becoming non-null triggers cleanup.
  useEffect(() => {
    if (user) return; // Already authenticated — no polling needed

    // Track inflight to avoid concurrent login attempts from overlapping ticks.
    let loginInFlight = false;
    let isCancelled = false;

    const pollForApikey = async () => {
      if (isCancelled || loginInFlight) return;
      try {
        const result = await extensionStorage.get("apikey");
        const apikey = result?.apikey as string | undefined;
        if (!apikey || isCancelled) return;

        loginInFlight = true;
        console.log("[AuthContext] Polling found apikey — attempting auto-login");
        try {
          const loginResponse = await api.extensionUser.loginWithApikeyApi(
            apikey,
            extensionId || extensionCommands.getExtensionId(),
          );
          if (!isCancelled) {
            await processLoginResponse(loginResponse, true);
            // processLoginResponse calls setUser → triggers re-render →
            // useEffect cleanup fires → interval cleared automatically.
          }
        } catch (err) {
          console.warn(
            "[AuthContext] Poll apikey login failed — will retry:",
            err,
          );
          loginInFlight = false;
        }
      } catch {
        // chrome.storage unavailable — skip this tick
      }
    };

    const intervalId = setInterval(pollForApikey, 5000); // every 5 seconds

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [user, extensionId]);

  // ──────────────────────────────────────────────────────────────────────────
  // Shared post-login setup: processes the raw API response from either
  // username/password or apikey login, sets all state, storage and sends
  // background messages.  Business logic is identical for both paths.
  // ──────────────────────────────────────────────────────────────────────────
  const processLoginResponse = async (loginResponse: any, isApikeyLogin = false): Promise<boolean> => {
    const serverSession =
      loginResponse?.extension_session ||
      (Array.isArray(loginResponse?.extension_sessions)
        ? loginResponse.extension_sessions[0]
        : null) ||
      (Array.isArray(loginResponse?.extension_config?.extension_sessions)
        ? loginResponse.extension_config.extension_sessions[0]
        : null) ||
      {};

    const extensionConfigId =
      loginResponse?.extension_config_id ??
      serverSession?.extension_config_id ??
      loginResponse?.extension_config?.id;

    const newUser: User = {
      id: loginResponse.id,
      username: loginResponse.username,
      name: loginResponse.display_name,
      apikey: loginResponse.api_key || loginResponse.apikey,
      tenants: loginResponse.tenant || loginResponse.tenants,
      extension_session: {
        ...serverSession,
        extension_config_id: extensionConfigId,
      },
    };
    await appStorage.setItem("local:user", newUser);
    setUser(newUser);
    // Persist the apikey-session flag so it survives popup re-opens.
    await appStorage.setItem("local:isApikeySession", isApikeyLogin);
    setIsApikeySession(isApikeyLogin); // mark this session as apikey-based

    const useExtensionConfig = hasExtensionConfigId(extensionConfigId);

    try {
      if (useExtensionConfig) {
        const extensionConfigInfo = await api.extensionUser.getExtensionConfigInfo(
          extensionConfigId,
          { include: [{ relation: "extension_sessions" }] },
        );

        // Enrich extension_session if the signin response did not provide the full session
        if (extensionConfigInfo?.extension_sessions?.[0]) {
          const configSession = extensionConfigInfo.extension_sessions[0];
          newUser.extension_session = {
            ...configSession,
            ...newUser.extension_session,
            id: newUser.extension_session?.id || configSession.id,
            extension_session_id: newUser.extension_session?.id || configSession.id,
            extension_config_id: extensionConfigId,
            extension_id: newUser.extension_session?.extension_id || configSession.extension_id,
            automation: newUser.extension_session?.automation ?? configSession.automation ?? false,
          };
          await appStorage.setItem("local:user", newUser);
          setUser(newUser);
        }

        await appStorage.setItem("local:extensionProxy", extensionConfigInfo?.proxy || {});

        const rawSocialAccounts: unknown[] = extensionConfigInfo?.social_accounts || [];
        const socialAccounts: SocialAccount[] = rawSocialAccounts
          .map((a) => normalizePersonaSocialAccount(a))
          .filter((a): a is NonNullable<typeof a> => a !== null) as SocialAccount[];
        await appStorage.setItem("local:allSocialAccounts", socialAccounts);

        const facebookAccts = socialAccounts.filter(
          (a) => a.platform === "facebook" && a.status === "active",
        );
        setFacebookAccounts(facebookAccts);
        await appStorage.setItem("local:facebookAccounts", facebookAccts);

        await ensureDefaultPersonaForExtensionConfig(newUser.id);
        // Notify AppRoutes so it picks up the newly-set selectedPersonaId
        // (ensureDefaultPersonaForExtensionConfig persists the selected persona in
        // the same tab, which doesn't fire the 'storage' event).
        window.dispatchEvent(new Event("localStorageSync"));
        const allSocialAccounts =
          (await appStorage.getItem<SocialAccount[]>("local:allSocialAccounts")) ??
          [];
        await extensionCommands.initializeAfterLogin(
          newUser.extension_session,
          {
            extension_config: extensionConfigInfo || {},
            extension_proxy: extensionConfigInfo?.proxy || {},
            all_social_accounts: allSocialAccounts,
          },
        );
      } else {
        await syncPersonaContextFromLocalStorage(true);
        const personaAccounts = await getPersonaFacebookAccounts();
        if (personaAccounts.length > 0) {
          setFacebookAccounts(personaAccounts);
          await appStorage.setItem("local:facebookAccounts", personaAccounts);
        }
        await extensionCommands.initializeAfterLogin(newUser.extension_session);
      }
      await extensionCommands.startPeriodicCheck();
    } catch (err) {
      console.error("[AuthContext] Failed to initialize extension:", err);
    }

    await syncPersonaContextFromLocalStorage(true);
    const accountProxyOpts = await resolveAccountProxy();
    await applyEffectiveProxy(accountProxyOpts);
    return true;
  };

  // Helper to read apikey from chrome.storage.local (injected by desktop app).
  const getStoredApikey = async (): Promise<string | null> => {
    try {
      const result = await extensionStorage.get("apikey");
      return (result?.apikey as string) || null;
    } catch {
      return null;
    }
  };

  const checkAuthAndRestore = async () => {
    try {
      const storedUser = await appStorage.getItem<User>("local:user");
      if (!storedUser) {
        // No stored session — try apikey auto-login before showing login screen.
        // The apikey is injected into chrome.storage.local by the desktop app.
        const apikey = await getStoredApikey();
        if (apikey) {
          try {
            const loginResponse = await api.extensionUser.loginWithApikeyApi(
              apikey,
              extensionId || extensionCommands.getExtensionId(),
            );
            await processLoginResponse(loginResponse, true);
            return; // login + setup complete
          } catch (err) {
            console.warn("[AuthContext] Apikey auto-login failed:", err);
            // Fall through — show the normal login screen
          }
        }
        // No apikey or apikey login failed — show login screen
        setFacebookAccounts([]);
        setExtensionProxy(null);
        return;
      }

      // Restore existing session (user previously logged in)
      setUser(storedUser);
      // Restore the apikey-session flag so the logout button stays hidden.
      const storedIsApikeySession = await appStorage.getItem<boolean>("local:isApikeySession");
      setIsApikeySession(storedIsApikeySession === true);

      if (hasExtensionConfigId(storedUser.extension_session?.extension_config_id)) {
        await ensureDefaultPersonaForExtensionConfig(storedUser.id);
        // Sync React state in AppRoutes after persona ID may have been set
        window.dispatchEvent(new Event("localStorageSync"));
      }

      const storedFacebookAccounts = await appStorage.getItem<SocialAccount[]>("local:facebookAccounts");
      if (storedFacebookAccounts) setFacebookAccounts(storedFacebookAccounts);

      await syncPersonaContextFromLocalStorage(true);

      const storedActiveProxy = await appStorage.getItem<any>("local:activeProxy");
      if (storedActiveProxy) {
        setExtensionProxy(storedActiveProxy);
      } else {
        const storedProxy = await appStorage.getItem<any>("local:extensionProxy");
        if (storedProxy) setExtensionProxy(storedProxy);
      }

      const accountProxyOpts = await resolveAccountProxy();
      await applyEffectiveProxy(accountProxyOpts);

      if (storedUser.extension_session) {
        try {
          await extensionCommands.initializeAfterLogin(storedUser.extension_session);
        } catch (err) {
          console.error("[AuthContext] Failed to sync settings:", err);
        }
      }
    } catch (error) {
      setError("Failed to check authentication.");
      console.error("Auth check failed:", error);
    } finally {
      setLoading(false);
    }
  };

  // Login with username + password (existing flow — unchanged).
  const login = async (username: string, password: string): Promise<boolean | any> => {
    setError(null);
    try {
      if (username && password) {
        const loginResponse = await api.extensionUser.loginApi(
          username,
          password,
          extensionId || extensionCommands.getExtensionId(),
        );
        return await processLoginResponse(loginResponse, false);
      } else {
        setError("Username and password are required");
        return false;
      }
    } catch (e: any) {
      setError(e?.message || "Login failed");
      return false;
    }
  };

  const logout = async () => {
    try {
      setError(null);

      const idToUse = extensionId || extensionCommands.getExtensionId();
      try {
        await api.extensionUser.logoutApi(idToUse);
      } catch (err) {
        console.warn(
          "[AuthContext] logoutApi error (proceeding with local cleanup):",
          err,
        );
      }

      try {
        await extensionCommands.clearDataAfterLogout();
      } catch (err) {
        console.error("[AuthContext] Failed to clear extension data:", err);
      }

      localStorageService.removeItem("fbLoginModeSelected");
      localStorageService.removeItem("selectedPersonaId");
      localStorageService.removeItem("selectedPersona");
      await appStorage.removeItem("local:draftCredentials");
      await appStorage.removeItem(MANUAL_PLATFORM_COOKIES_KEY);
      await appStorage.removeItem(LEGACY_MANUAL_FB_COOKIES_KEY);
      await appStorage.removeItem("local:user");
      await appStorage.removeItem("local:facebookAccounts");
      await appStorage.removeItem("local:extensionProxy");
      await appStorage.removeItem("local:personaProxy");
      await appStorage.removeItem("local:personaFacebookAccounts");
      await appStorage.removeItem("local:selectedPersonaId");
      await appStorage.removeItem("local:profile");
      await appStorage.removeItem("local:profileId");
      await appStorage.removeItem("local:activeProxy");
      await appStorage.removeItem("local:isApikeySession");
      setUser(null);
      setIsApikeySession(false);
      setFacebookAccounts([]);
      setExtensionProxy(null);
    } catch (e: any) {
      setError(e?.message || t("logoutFailed"));
    }
  };

  const handleSessionExpired = async () => {
    try {
      // 1. Try apikey re-login first — fastest path, no stored credentials needed.
      //    The desktop app keeps the apikey fresh in chrome.storage.local.
      const apikey = await getStoredApikey();
      if (apikey) {
        try {
          const loginResponse = await api.extensionUser.loginWithApikeyApi(
            apikey,
            extensionId || extensionCommands.getExtensionId(),
          );
          await processLoginResponse(loginResponse);
          console.log(
            "[AuthContext] Session expired — re-logged in via apikey",
          );
          return;
        } catch (err) {
          console.warn(
            "[AuthContext] Apikey re-login failed, falling back:",
            err,
          );
        }
      }

      // 2. Fallback: try username/password auto re-login (only if both are stored).
      //    NOTE: password is no longer stored for security; this branch only fires
      //    if an older storage entry still contains a password field.
      const stored = await extensionStorage.get("draftCredentials");
      const hasSelectedFbMode = localStorageService.getItem("fbLoginModeSelected");
      const remembered: any = stored?.draftCredentials;

      if (hasSelectedFbMode && remembered?.username && remembered?.password) {
        console.log(
          "[AuthContext] Session expired, attempting auto re-login with username/password...",
        );
        try {
          const success = await login(remembered.username, remembered.password);
          if (success) {
            console.log("[AuthContext] Auto re-login successful");
            return;
          }
        } catch (err) {
          console.warn(
            "[AuthContext] Auto re-login failed, proceeding to logout:",
            err,
          );
        }
      }

      // 3. Full logout cleanup.
      const fbLoginMode: any = await extensionStorage
        .get("fbLoginMode")
        .then((r) => r.fbLoginMode || null);
      if (fbLoginMode?.mode === "manual") {
        try {
          await persistManualSocialCookieSnapshot();
        } catch (err) {
          console.warn("[AuthContext] Failed to capture cookies:", err);
        }
      }

      try {
        await extensionCommands.clearDataAfterLogout();
      } catch (err) {
        console.error("[AuthContext] Failed to clear extension data:", err);
      }

      localStorageService.removeItem("fbLoginModeSelected");
      localStorageService.removeItem("selectedPersonaId");
      localStorageService.removeItem("selectedPersona");
      await appStorage.removeItem("local:user");
      await appStorage.removeItem("local:facebookAccounts");
      await appStorage.removeItem("local:extensionProxy");
      await appStorage.removeItem("local:personaProxy");
      await appStorage.removeItem("local:personaFacebookAccounts");
      await appStorage.removeItem("local:selectedPersonaId");
      await appStorage.removeItem("local:profile");
      await appStorage.removeItem("local:profileId");
      await appStorage.removeItem("local:activeProxy");
      setUser(null);
      setIsApikeySession(false);
      setFacebookAccounts([]);
      setExtensionProxy(null);

      navigate("/login");
    } catch (e: any) {
      console.error("[AuthContext] Session expiry cleanup failed:", e);
    }
  };

  const restart = async () => {
    // UX label is "Restart", but behavior is intentionally: clear proxy + logout.
    setError(null);

    // IMPORTANT: Clear proxy/background state first so we can recover from a dead proxy.
    // Then call server signout as best-effort (it should work once proxy is cleared).
    try {
      const fbLoginMode: any = await extensionStorage
        .get("fbLoginMode")
        .then((r) => r.fbLoginMode || null);
      if (fbLoginMode?.mode === "manual") {
        try {
          await persistManualSocialCookieSnapshot();
        } catch (err) {
          console.warn("[AuthContext] Failed to capture cookies:", err);
        }
      }

      try {
        await extensionCommands.clearDataAfterLogout();
      } catch (err) {
        console.error("[AuthContext] Failed to clear extension data:", err);
      }

      localStorageService.removeItem("fbLoginModeSelected");
      localStorageService.removeItem("selectedPersonaId");
      localStorageService.removeItem("selectedPersona");
      await appStorage.removeItem("local:draftCredentials");
      await appStorage.removeItem("local:user");
      await appStorage.removeItem("local:facebookAccounts");
      await appStorage.removeItem("local:extensionProxy");
      await appStorage.removeItem("local:personaProxy");
      await appStorage.removeItem("local:personaFacebookAccounts");
      await appStorage.removeItem("local:selectedPersonaId");
      await appStorage.removeItem("local:profile");
      await appStorage.removeItem("local:profileId");
      await appStorage.removeItem("local:activeProxy");

      setUser(null);
      setIsApikeySession(false);
      setFacebookAccounts([]);
      setExtensionProxy(null);
    } catch (e: any) {
      setError(e?.message || t("restartFailed"));
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        facebookAccounts,
        extensionProxy,
        loading,
        login,
        loginWithMode,
        resumeSocialPlatformAfterRelogin,
        logout,
        restart,
        applyEffectiveProxy,
        persistAndApplyPersonaProxy,
        applyPersonaOnSelect,
        hasExtensionConfig,
        canSwitchPersona,
        switchPersona,
        isAuthenticated: !!user,
        isApikeySession,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
