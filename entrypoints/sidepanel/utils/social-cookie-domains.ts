import type { PlatformId } from "../types/types";

export const SOCIAL_COOKIE_DOMAINS = [
  ".facebook.com",
  ".fb.com",
  ".tiktok.com",
  ".x.com",
  ".twitter.com",
  ".threads.com",
  ".threads.net",
] as const;

export type SocialCookieDomain = (typeof SOCIAL_COOKIE_DOMAINS)[number];

/** Cookie domains cleared per platform (manual login — avoid cross-persona session bleed). */
export const PLATFORM_COOKIE_DOMAINS: Record<PlatformId, readonly string[]> = {
  facebook: [".facebook.com", ".fb.com"],
  tiktok: [".tiktok.com"],
  x: [".x.com", ".twitter.com"],
  threads: [".threads.com", ".threads.net"],
  youtube: [],
};

export function getPlatformCookieDomains(platform: string | null | undefined): readonly string[] {
  const id = String(platform ?? "facebook").toLowerCase() as PlatformId;
  return PLATFORM_COOKIE_DOMAINS[id].length > 0
    ? PLATFORM_COOKIE_DOMAINS[id]
    : PLATFORM_COOKIE_DOMAINS.facebook;
}
